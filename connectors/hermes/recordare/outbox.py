# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese

"""Durable ingest outbox: a small SQLite file in the profile's HERMES_HOME.

Turns are written here first and delivered to `POST api/v1/ingest/messages` by one background worker per file (and
synchronously when the provider needs a message stored before it reads, see `deliver_now`, or stores it with its memory
context in one call, see `send_with`). Delivery is at least once:
message externalIds are fixed when a row is written, so a re-sent batch is stored once by Recordare. Back-off is
exponential, Retry-After is honoured, a 4xx other than 408 / 425 / 429 drops the row (it would never succeed), rows older
than `MAX_AGE_S` are dropped. Rows left at exit are delivered the next time Hermes starts with this provider.

"End of conversation" rows become `POST api/v1/ingest/conversations/{id}/end` (a 404 — never ingested — is done), and
they wait until every pending batch of that conversation is delivered, so extraction starts only after the last turn
arrived.
"""

from __future__ import annotations

import json
import logging
import sqlite3
import threading
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Callable, Dict, Iterator, Optional, Tuple

from .client import RecordareClient, RecordareError

logger = logging.getLogger(__name__)

MAX_AGE_S = 7 * 24 * 3600
MAX_BACKOFF_S = 600.0
IDLE_WAIT_S = 60.0
SEND_TIMEOUT = (3.0, 10.0)
_RETRYABLE_4XX = {408, 425, 429}

_SCHEMA = """
CREATE TABLE IF NOT EXISTS outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,                 -- 'batch' | 'end'
  conv TEXT NOT NULL,                 -- conversation externalId (also the X-Recordare-Conversation header)
  user TEXT,                          -- X-Recordare-User (client keys); NULL with a personal token
  payload TEXT NOT NULL,              -- ingest body ('batch'); '{}' ('end')
  dedupe TEXT UNIQUE,                 -- one pending 'end' per conversation
  attempts INTEGER NOT NULL DEFAULT 0,
  next_at REAL NOT NULL DEFAULT 0,
  created_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS lineage (session_id TEXT PRIMARY KEY, conv TEXT NOT NULL);
"""

_OUTBOXES: Dict[str, "Outbox"] = {}
_OUTBOXES_LOCK = threading.Lock()


def get_outbox(path: Path, client: RecordareClient, spawn: Callable[..., threading.Thread]) -> "Outbox":
    """One outbox (and one worker) per file and process: every agent of a gateway profile shares it."""
    key = str(path.resolve())
    with _OUTBOXES_LOCK:
        box = _OUTBOXES.get(key)
        if box is None:
            box = _OUTBOXES[key] = Outbox(path, client)
            box.start(spawn)
        else:
            box.client = client
        return box


class Outbox:
    def __init__(self, path: Path, client: RecordareClient):
        self.path, self.client = path, client
        self._send_lock = threading.Lock()
        self._wake = threading.Event()
        path.parent.mkdir(parents=True, exist_ok=True)
        with self._db() as db:
            db.executescript(_SCHEMA)

    @contextmanager
    def _db(self) -> Iterator[sqlite3.Connection]:
        db = sqlite3.connect(self.path, timeout=5.0, isolation_level=None)  # autocommit: one statement at a time
        try:
            db.execute("PRAGMA journal_mode=WAL")
            yield db
        finally:
            db.close()

    # -- writing --------------------------------------------------------------------------------------------------------

    def add_batch(self, conv: str, user: Optional[str], body: Dict[str, Any], *, wake: bool = True) -> int:
        """Queue an ingest body; returns its row id. `wake=False` leaves it to `send_with` (or the worker's next round)."""
        with self._db() as db:
            rid = db.execute("INSERT INTO outbox (kind, conv, user, payload, created_at) VALUES ('batch', ?, ?, ?, ?)",
                             (conv, user, json.dumps(body), time.time())).lastrowid
        if wake:
            self._wake.set()
        return int(rid)

    def add_end(self, conv: str, user: Optional[str]) -> None:
        with self._db() as db:
            db.execute("INSERT OR IGNORE INTO outbox (kind, conv, user, payload, dedupe, created_at) "
                       "VALUES ('end', ?, ?, '{}', ?, ?)", (conv, user, f"end:{conv}", time.time()))
        self._wake.set()

    def wake(self) -> None:
        self._wake.set()

    def lineage_get(self, session_id: str) -> Optional[str]:
        with self._db() as db:
            row = db.execute("SELECT conv FROM lineage WHERE session_id = ?", (session_id,)).fetchone()
        return row[0] if row else None

    def lineage_set(self, session_id: str, conv: str) -> None:
        with self._db() as db:
            db.execute("INSERT OR REPLACE INTO lineage (session_id, conv) VALUES (?, ?)", (session_id, conv))

    # -- delivery -------------------------------------------------------------------------------------------------------

    def start(self, spawn: Callable[..., threading.Thread]) -> None:
        spawn(self._run, name="recordare-outbox").start()

    def _run(self) -> None:
        while True:
            try:
                wait = self.flush()
            except Exception as exc:  # never let the worker die
                logger.warning("Recordare outbox: %s", exc)
                wait = IDLE_WAIT_S
            self._wake.wait(wait)
            self._wake.clear()

    def deliver_now(self, deadline_s: float) -> None:
        """Deliver what is due now, within `deadline_s` (the caller is about to read and needs its message stored)."""
        self.flush(deadline=time.monotonic() + deadline_s, timeout=(min(1.5, deadline_s), deadline_s))

    def send_with(self, rid: int, deadline_s: float, call: Callable[[Dict[str, Any]], Any]) -> Tuple[bool, Any]:
        """Deliver batch `rid` through `call(ingest body)` instead of a plain ingest (the provider's ingest with memory
        context), when it is still pending and no older row of its conversation is (order kept). Returns (True, result)
        when `call` stored it; (False, None) when it did not run (already delivered, an older row comes first, or the
        worker held the outbox past the deadline). An error of `call` propagates and the row stays for the worker."""
        if not self._send_lock.acquire(timeout=deadline_s):
            return False, None
        try:
            with self._db() as db:
                row = db.execute("SELECT conv, payload FROM outbox WHERE id = ? AND kind = 'batch'", (rid,)).fetchone()
                older = row is not None and db.execute("SELECT 1 FROM outbox WHERE conv = ? AND id < ? LIMIT 1",
                                                       (row[0], rid)).fetchone() is not None
            if row is None or older:
                return False, None
            result = call(json.loads(row[1]))
            self._delete(rid)
            return True, result
        finally:
            self._send_lock.release()

    def flush(self, deadline: Optional[float] = None, timeout=SEND_TIMEOUT) -> float:
        """Send every due row (batches before end markers). Returns seconds until the next row is due."""
        if not self._send_lock.acquire(timeout=max(0.0, deadline - time.monotonic()) if deadline else -1):
            return 1.0
        try:
            while deadline is None or time.monotonic() < deadline:
                row = self._next_due()
                if row is None:
                    break
                self._send(row, timeout)
            return self._seconds_to_next()
        finally:
            self._send_lock.release()

    def _next_due(self):
        now = time.time()
        with self._db() as db:
            db.execute("DELETE FROM outbox WHERE created_at < ?", (now - MAX_AGE_S,))
            return db.execute(
                "SELECT id, kind, conv, user, payload, attempts FROM outbox o WHERE next_at <= ? AND (kind = 'batch' OR "
                "NOT EXISTS (SELECT 1 FROM outbox b WHERE b.kind = 'batch' AND b.conv = o.conv)) "
                "ORDER BY kind = 'end', id LIMIT 1", (now,)).fetchone()

    def _seconds_to_next(self) -> float:
        with self._db() as db:
            row = db.execute("SELECT MIN(next_at) FROM outbox").fetchone()
        return IDLE_WAIT_S if row[0] is None else min(IDLE_WAIT_S, max(0.5, row[0] - time.time()))

    def _send(self, row, timeout) -> None:
        rid, kind, conv, user, payload, attempts = row
        try:
            if kind == "batch":
                self.client.ingest(json.loads(payload), user=user, conversation=conv, timeout=timeout)
            else:
                self.client.end_conversation(conv, user=user, timeout=timeout)
        except RecordareError as err:
            if kind == "end" and err.status == 404:  # nothing was ever stored in this conversation: nothing to end
                self._delete(rid)
                return
            if err.status < 500 and err.status not in _RETRYABLE_4XX:
                logger.warning("Recordare ingest rejected (%s): dropping %s of %s", err, kind, conv)
                self._delete(rid)
                return
            self._retry(rid, attempts, err.retry_after)
            logger.info("Recordare ingest deferred (%s)", err)
            return
        except Exception as exc:  # network: connection refused, timeout…
            self._retry(rid, attempts, None)
            logger.info("Recordare ingest deferred (%s)", type(exc).__name__)
            return
        self._delete(rid)

    def _retry(self, rid: int, attempts: int, retry_after: Optional[float]) -> None:
        delay = retry_after if retry_after is not None else min(MAX_BACKOFF_S, 5.0 * 2 ** attempts)
        with self._db() as db:
            db.execute("UPDATE outbox SET attempts = attempts + 1, next_at = ? WHERE id = ?", (time.time() + delay, rid))

    def _delete(self, rid: int) -> None:
        with self._db() as db:
            db.execute("DELETE FROM outbox WHERE id = ?", (rid,))
