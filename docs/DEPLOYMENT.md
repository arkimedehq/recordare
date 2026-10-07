# Deployment profiles — infrastructure

How Recordare's infrastructure is laid out. (Not to be confused with the **trust** profiles home / public of
`API.md` §0, D33.) Recordare's code never depends on another product: sharing infrastructure is configuration only.

Recordare needs:
- **Postgres ≥ 16** with the `vector` (pgvector) and `pg_trgm` extensions;
- **Redis** (BullMQ queues);
- an **OpenAI-compatible embedding endpoint** (`/v1/embeddings`), the model fixed per installation (`EMBEDDING_DIM`);
- an LLM provider (D27).

## Install with the scripts (`deploy/`)

```sh
deploy/install.sh            # asks the profile (standalone | cohosted), the LLM provider and key; writes deploy/.env (600)
deploy/update.sh             # backup, rebuild on the current code, restart (migrations run at start)
deploy/backup.sh             # dump of Recordare's database into deploy/backups/ (keeps the last 14)
```

- **Standalone**: `deploy/docker-compose.yml` — Recordare, Postgres (pgvector), Redis and Hugging Face
  text-embeddings-inference (Apache-2.0) serving BAAI/bge-m3 (CPU image per architecture).
- **Co-hosted with Arkimede**: `deploy/docker-compose.cohosted.yml` — the installer finds Arkimede's stack, checks its
  Postgres runs the pgvector image and its embedder serves bge-m3, creates the `recordare` database, user and `vector`
  extension, uses Redis db 1, joins the network those services share, then (optionally) creates Arkimede's client and
  writes `RECORDARE_URL` / `RECORDARE_API_KEY` into Arkimede's `.env` (backed up); restart Arkimede's backend after.
- Non-interactive: `deploy/install.sh --profile cohosted --yes` with `LLM_API_KEY_FILE=…` (the key never on the command
  line). Re-running keeps the secrets already in `deploy/.env`. The scripts never ask for sudo.
- Recordare listens on `127.0.0.1:8090` on the host (`RECORDARE_PORT`); Arkimede reaches it by name
  (`http://recordare:8080`) on the shared network.

## Standalone (default)

Recordare runs its own Postgres (pgvector image), Redis and embedding server. The right choice wherever resources
allow it: a failure or an upgrade of one product never touches the other.

## Co-hosted with Arkimede (small servers)

On a machine with limited resources, Recordare reuses the services Arkimede already runs. Embeddings are the heavy
part, so sharing the embedder is the biggest saving.

| Service | Shared how | Recordare settings |
|---|---|---|
| Postgres | Same server, **own database and own user**. Arkimede's Postgres must use the `pgvector/pgvector:pg16` image (Arkimede's default from that change on; an existing install switches with Arkimede's upgrade script, which rebuilds text indexes for the musl → glibc change) | `DATABASE_URL=postgres://recordare:<pw>@postgres:5432/recordare` |
| Redis | Same instance, **own logical database** and own queue prefix | `REDIS_URL=redis://redis:6379/1`, `QUEUE_PREFIX=recordare` |
| Embeddings | Arkimede's `embedding-service`, **only if it serves the model Recordare uses** (`BAAI/bge-m3`, 1024 dims — the model Recordare was measured with; Arkimede's default) | `EMBEDDING_BASE_URL=http://embedding:8000/v1`, `EMBEDDING_MODEL=BAAI/bge-m3`, `EMBEDDING_DIM=1024` |

Set-up, once, as the Postgres superuser of Arkimede's server:

```sql
CREATE ROLE recordare LOGIN PASSWORD '<pw>';
CREATE DATABASE recordare OWNER recordare;
\c recordare
CREATE EXTENSION IF NOT EXISTS vector;   -- not a trusted extension: the superuser creates it
```

(`pg_trgm` is trusted and is created by Recordare's own migration.) Then run Recordare's migrations with its own
`DATABASE_URL`. Recordare joins Arkimede's Docker network (an external network in its compose file) and reaches the
services by name; nothing is published on the host.

**What sharing costs** — say it to the operator: one Postgres or Redis down stops both products; the embedder serves
two loads (Recordare's extraction comes in bursts, after idle periods and at night), so give it the CPU / memory both
need; backups stay separate (`pg_dump` per database). Changing the embedding model of the shared embedder changes it
for both: Arkimede re-embeds with its admin job, Recordare re-embeds its episodes, facts, notes and digests — never
change it for one side only.

**Recordare Atlas** (optional) runs next to them as before; Arkimede's agents export their OpenTelemetry traces to it
(`recordare-atlas` README).
