# Dataset format (for writers of blind sets)

What a dataset folder contains and which fields the harness reads. Written for WORK_PLAN 8.11 so that blind-set writers
know the format without reading the service, the harness (`systems/`) or other datasets' content. Fictional content
only.

## Files
- `conversations.json` — `{"_note": str, "users": {user_id: "Name, City"}, "genders": {user_id: "masculine" |
  "feminine" | "neutral"}, "entities": [user_id, …] (entity memories only), "sessions": [ … ]}`.
- `questions.json` — `{"_note": str, "user": user_id, "questions": [ … ]}` (all questions are asked of that memory).
- `gold.json` — what the memory should hold (for the extraction check): see blind sets 6–8 (`_gold.py` → `build.py`).
- Write the JSON from Python sources (`_sessions.py`, `_questions.py`, `_gold.py`) with a `build.py`, and a `check.py`
  that verifies shape, ids, dates and consistency (see `dataset_blind6/` or `dataset_blind8/` for the pattern).

## The memory
Every session has `"user": user_id` — the memory it belongs to. The memory's name is derived from the id: a personal
memory's id is the holder's first name in lower case (`giacomo` → "Giacomo"); an entity's id is words joined by `_`
(`casa_bellandi` → "Casa Bellandi"). Two modes:
- **personal** (user id not in `entities`): the agent of one person (the holder). The holder's turns are
  `role: "user"`; the agent's are `"assistant"`. The agent remembers in the first person — its memory and the holder's
  life are one "I" ("I booked the dentist for Thursday").
- **entity** (user id listed in `entities`): one agent many people use (a shared device, a shop assistant). Everyone
  speaks as `role: "user"`; nobody is identified unless they say who they are in the text ("sono Paolo", "I'm Aoife"),
  or never.

## Sessions
A conversation: `{"id": "s01", "user": user_id, "ts": ISO-8601 with offset (start), "messages": [ … ]}`; messages are
sent one second apart from `ts`, in order. Message fields:
- `role`: `user` | `assistant` | `other` (personal group chats: someone else writing) | `tool` (rare).
- `content`: text.
- `author` (with `role: "other"`): display name of who wrote it in a group chat ("Marta").
- `own: true` (optional, entity memories): content handed to the agent to keep as its own — a price list, a house
  note, a procedure — not a person's statement.

Optional session field `participants: [{"name": "Giulia", "identity": "giulia-r"}]` (personal memories): the platform
**declares** who these group-chat authors are (their account on the platform). Authors not listed are known by display
name only. An identified person is the same contact of the memory in every session with the same `identity`.

## Learned sources
A text the agent learns (a manual, a recipe, a contract, notes), as its own entry in `sessions`, in time order with the
conversations:
`{"type": "source", "id": "k-boiler", "user": user_id, "ts": ISO (when learned), "title": str, "text": str (Markdown
headings allowed; any length), "kind": "document" | "page" | "note" | "book" | "own_text" (optional),
"author": str (optional), "provided_by": "Paolo" (optional: a person who gave it; absent = the memory's self),
"conversation": "s05" (optional: the session in which it was handed over — the source's `ts` is later than that
session's last message)}`. Entries are processed in `ts` order (sessions and sources together).
Forgetting one: `{"type": "forget_source", "id": "forget-k-boiler", "user": user_id, "ts": ISO, "source": "k-boiler"}`
— its text is gone afterwards; the memory may still recall *that* something was learned and forgotten, never its
content.

## Questions
`{"id": "q01", "category": str, "asked_at": ISO (after all its evidence), "q": str, "expected": str
(the full correct answer, with dates), "must_not": [str, …] (claims that must not appear as true)}`. Optional
`asker: {"name": "Giulia", "identity": "giulia-r"}` — the question is asked by that identified person (a contact of the
memory), not by the holder / an unidentified user: "I" in the question is the asker. Without `asker`, a personal
memory's question comes from the holder, an entity memory's from someone unidentified.

The judge compares the answer to `expected` and `must_not`; it never sees the gold or the sessions. Write `expected` so
that a correct answer is unambiguous (dates as dates, who did what), and say "not known" / "never said" when that is
the right answer.
