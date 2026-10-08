# Changelog

All notable changes to Recordare. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/) (0.x: the API may still change between minor versions).
Italian: [CHANGELOG_it.md](CHANGELOG_it.md).

## [0.1.0] — 2026-10-08

First public release: the **private profile** (an installation run by someone its users trust — README → Limits).

### Memory engine
- **Raw log**: REST ingest of chats (idempotent, edits and deletions, group chats with participants and authors),
  per-conversation idle trigger and nightly consolidation; nothing is processed without the person's consent.
- **Episodes**: one LLM extraction call per conversation window (`extract.v8`) — events, plans with their outcome
  (done, cancelled, moved, open, unresolved), state changes, people, places, feelings; bi-temporal (when it happened,
  when it was learned) with date precision; provenance (`author_role`, `stance`) keeps what the person lived apart from
  what others claim; corrections link to the version they replace; forgetting sticks.
- **Facts** with history and validity (as-of questions), **notes** (preferences, habits, knowledge), **daily and
  monthly digests**.
- Guards measured on blind sets: claims of others never become the person's facts; a group message addressed to the
  assistant by someone else is not the person's request; a plan cannot be confirmed before its date; an assistant's
  recall echoed back is not new evidence; the person's name instead of "the owner".
- **Entity memory** (experimental): one memory for a shared device or account (a household's kitchen assistant);
  facts carry the person they are about; who speaks is only who identifies in the conversation.
- **Quality profiles** `economy | balanced | full` (cost against quality), per installation with a per-person override.
- Any LLM provider (OpenAI-compatible, Anthropic, Claude CLI; provider profiles for their quirks) and any
  OpenAI-compatible embedding endpoint (measured with BAAI/bge-m3).

### Interfaces
- **MCP** (Streamable HTTP): `search_episodes`, `search_memory`, `resolve_period`, `log_episode`, `remember`,
  `correct_episode`, `forget_episode`; client keys acting for their users, or personal tokens (Claude Code — INTEGRATION
  §4b, `npm run smoke:mcp`).
- **Viewer context** on every read: what is said in a conversation others take part in never leaks to them.
- **Memory context** `POST api/v1/context`: the memories relevant to the next answer as one fenced block, no LLM call.
- **Read API** (the person's diary): timeline, episode detail with evidence, digests, facts as of a date, notes, plans,
  and the person's edits (correct, forget, pin, confirm, reject).
- **Admin API** and **admin console** (`/admin`): people, consent, memory kind, clients, keys, tokens.
- **Client library** `@arkimedehq/recordare-client` (`packages/client`): delivery with retries, people directory, MCP
  sessions, RFC 9457 errors; conformance suite against the service. Published on npm
  (`@arkimedehq/recordare-client`), with the OpenClaw plugin (`@arkimedehq/openclaw-recordare`); the OpenAI-compatible proxy
  as an image (`ghcr.io/arkimedehq/recordare-openai-proxy`).
- Telemetry contract for the optional live view **Recordare Atlas** (`arkimedehq/recordare-atlas`, metadata only).

### Installation
- `deploy/install.sh` (guided, or `--yes` non-interactive), `deploy/update.sh`, `deploy/backup.sh`.
- Profiles: **standalone** (own Postgres + pgvector, Redis, text-embeddings-inference with bge-m3; ≈ 6 GB RAM) and
  **co-hosted** with Arkimede (own database and Redis db on Arkimede's services). Both tested end to end.

### Quality (DeepSeek `deepseek-flash`, 3 runs each, `spikes/memory-eval/RESULTS.md`)
- Fresh blind set written by a separate agent: **91.3 %** (person memory, 46 questions); entity memory 82.1 %.
- Earlier blind sets: 90.7 % (blind5); on par with a full-context baseline and ahead of Mem0 on blind4.

### Clients
- **Arkimede**: ingest, recall tools, memory context per agent, the Diary, memory kind and consent in its settings.
- **Connectors at the full level** (capture + memory context before each turn + memory tools), in `connectors/`, each
  smoke-tested for real: **Claude Code** plugin (`/plugin marketplace add arkimedehq/recordare`), **Codex** (hooks +
  MCP installer), **OpenClaw** plugin, **Hermes Agent** memory provider, and an **OpenAI-compatible memory proxy** for
  platforms without hooks (AnythingLLM tested; Open WebUI and LibreChat by the same mechanism).
- **Any MCP client** at the basic level with a personal token (e.g. Claude Desktop through a local bridge, untested);
  an agent's writes count as the person's only when their own recent words say it.

### Known limits
- No owner login, OAuth or read audit yet (public profile deferred, D33); plain HTTP on a trusted network only.
- Entity memory: a speaker who never identifies may still be attributed to a named person.
- Claude Desktop / claude.ai: basic level only (no hooks to capture the conversation); Desktop needs OAuth or a local
  bridge (untested). The memory context misses questions with instruction suffixes, other languages or periods
  (WORK_PLAN 6.6b) — the memory tools do not.
