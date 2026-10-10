# Dev set — learned sources (WORK_PLAN 8.9, NOT blind)

Written by the engine developer for 8.9 (D49: semantic memory of learned sources). One personal memory (Chiara,
Bologna, feminine) learns five texts in October 2026: a boiler manual from her brother Paolo (on its own), her
grandmother's recipe from her mother (in a conversation), her lease (on its own), her photography notes (in a
conversation), and a resignation draft that she later asks to forget. Six conversations around them; 15 questions asked
on 11 October.

Format: `conversations.json` sessions may be `{"type": "source", id, ts, title, text, provided_by?, kind?,
conversation?}` (learned through `POST api/v1/ingest/sources`) or `{"type": "forget_source", source, ts}` (forgotten);
the harness then also calls `search_knowledge`.

What it exercises: answers found only in the sources' text, who gave a source and when, what was learned on a day
(episode ↔ source), a forgotten source that must not answer any more, sources not mixed with memories, a negative.

Not blind: never use it to confirm a decision.
