# Recordare — context for Claude Code

Standalone memory + **digital twin** service for agentic platforms (MCP + REST ingest + SDK).
Arkimede (`~/Development/personalAgent`, public mirror `arkimedehq/arkimede`) is the first
client. Status (2026-11-09): **v0.12.0 released and public** (2026-11-09, initiatives pushed to OpenClaw — session notices — and Hermes — a webhook route —, D55 F3, `for.addressOn`, a diary entry cut short asked again with twice the budget, `digest.day.v3`; client and connectors 0.12.0; v0.11.0 on 2026-11-08, gaps and confirmations — D55 F2b —, timing v2 the moment's context — D55 F6 —, reminders moved or asked again, dense-day digests; client and connectors 0.11.0 with `PresenceImpulse.busy` / `talking`; v0.10.0 on 2026-11-06, timing v1 learns from outcomes — D55 F4 —, a chosen time past the daily limit, messaging only to a real address; service only, client 0.9.0; v0.9.1 on 2026-11-06, asking who it is names no one, `charter.v3`; v0.9.0 on 2026-11-06, initiatives by channel — ordered `channels`, the person's `for.addresses`, presence by place, voice in the room, the opening —, client library delivering by channel, two cards of one person merged from the console; v0.8.0 on 2026-11-05, `InitiativeInbox` in the client library, every setting from the admin console in the Atlas style, hook look-ups; v0.7.0 on 2026-11-04, initiatives decided by Recordare D55 F1–F2: presence impulses, timing v0, things left to finish, questions to who could know; interactive embeddings first; v0.6.0 on 2026-11-03, the agent's own mind D53 + memory-first D54; v0.5.0 on 2026-10-27, private memories, D52; v0.4.0 on 2026-10-26, plans apart from facts, my own replies, cards and erasure; v0.3.0 on 2026-10-17, memory quality and control; v0.2.0 on 2026-10-10, the agent memory, M8 8.0–8.10; v0.1.0 on 2026-10-08; `CHANGELOG.md`): service
implemented (`service/`): M0–M4b done, M5 done or partial (5.7 memory context done 2026-10-08), M5b mostly done, M6 mostly
done (Arkimede integrated, full-level connectors in `connectors/`), M7 v0.1 criteria met — per-row status in
`docs/WORK_PLAN.md`. Published: npm `@arkimedehq/recordare-client` and `@arkimedehq/openclaw-recordare` (0.12.0), image
`ghcr.io/arkimedehq/recordare-openai-proxy`; GitHub Sponsors (`.github/FUNDING.yml`).

## Read first
- `docs/DIGITAL_TWIN_VISION.md` — goal, pillars, disclosure tiers, initiative levels, legacy
  mode, architecture (standalone, own DB, one memory per person), name, roadmap.
- `docs/EPISODIC_MEMORY_TODO.md` — phase 1 design, decisions D1–D55 (layered memory: raw log →
  episodes → digests → semantic notes; one extraction call per window (D32); idle+nightly triggers; tools
  `log_episode` / `search_episodes`; bi-temporal episodes; Memobase-like profile+events).
- `spikes/memory-eval/RESULTS.md` — engine comparison (baseline / Graphiti / Memobase / prototype
  D) and embedding comparison. Round 2 + held-out: D wins; **D23 approved: build D**; in the DeepSeek test setup `deepseek-flash` = `v4-pro` quality.
  Spike runs cost real money (DeepSeek): keep runs minimal, prefer base before noise.
  Reasoning-off switch per provider: `evalkit/common.py` → `REASONING_OFF` (override with
  `REASONING_OFF_BODY`).
- `docs/API.md`, `docs/DATA_MODEL.md` — contracts: identity / auth (D24), REST ingest, MCP tools as built
  (`search_episodes`, `search_memory` — notes + facts with `as_of`, `resolve_period`, `log_episode`, `remember`,
  `correct_episode`, `forget_episode`; `search_facts` planned), no viewer filter (D50: whole memory in every conversation; 8.2); memory context
  `POST api/v1/context`; read API (§4) built; client library (§5) built as `packages/client`; OpenAPI generated from the routes (`GET api/v1/openapi.json`, `service/src/openapi/`): every JSON route needs a `@Returns` response
  schema (tests check every answer against it, `test/helpers/response-contract.ts`);
  data model v1. **D33**: build only the v1
  home / research profile; public-profile hardening is specified but deferred (stay on the twin).
- `docs/WORK_PLAN.md` — milestones M0–M7 for phase 1 with done / partial / TODO per row, watch list, D26 (decided 2026-10-12),
  evaluation budget rules 1–9.
- `docs/INTEGRATION.md` — the client-platform guide (set-up, the client's on/off switch — no consent in Recordare,
  D50 —, people, outbox ingest, MCP with the conversation header, telemetry).
- `connectors/*/README.md` — the full-level connectors (Claude Code, Codex, OpenClaw, Hermes Agent, OpenAI-compatible
  memory proxy); `docs/connectors/` — research notes on the target platforms; WORK_PLAN 6.6 / 6.6b.
- `CHANGELOG.md` — release notes (Keep a Changelog, SemVer 0.x).
- `docs/RESEARCH_NOTES.md` — hypotheses register (H1–H12) with literature verdicts: phase 1 is
  mostly integration; open ground = unresolved user plans (H1), twin disclosure (H2), holder vs
  twin provenance (H3). Never claim novelty without re-checking it.
- `docs/literature/` — deep-reading cards of 15 key sources + `README.md` synthesis (D29 data-model
  additions, D30 assistant turns, recall changes, eval-suite upgrade). Read before designing a component.
- `docs/DEPLOYMENT.md` — infrastructure profiles: standalone (default) and **co-hosted with Arkimede** on small servers
  (own database + user on Arkimede's pgvector Postgres, own Redis db + queue prefix, Arkimede's bge-m3 embedder).
- `docs/ATLAS_EVENTS.md` — contract v1 (endpoints + telemetry events, metadata only) with the optional live brain
  view **Recordare Atlas**, its own repo `~/Development/recordare-atlas` (`arkimedehq/recordare-atlas`, published with
  Recordare); Recordare must work without it.
- `docs/MODELS.md` — supported-models table (measured engine models, scores, weight licences); `provider_eval.py` measures one.
- `docs/KNOBS.md` — every setting in one place (quality profiles, service env, models, per person / client, deploy, atlas,
  client side, spike), with defaults and what was measured. Update it with every new knob.
- `docs/ENGINE_IDEAS.md` — what we borrow from Memobase / Graphiti, what we reject, held-out
  gaps, and **cost principles** (economy-profile defaults: zero LLM calls when nothing to do, cheap
  model, no reasoning, prefix caching — D35 makes cost a deployer's option).

## Conventions (the maintainer's preferences — follow them)
- Chat with the maintainer in **Italian**; code comments and dev-facing docs in **English**.
- **Bilingual docs** (maintainer's rule 2026-10-07): every project document (`README.md`, `service/README.md`, `docs/*.md`,
  `docs/literature/*.md`, `docs/connectors/*.md`, `connectors/*/README.md`, `packages/client/README.md`,
  `CHANGELOG.md`) has an Italian copy next to it, `<name>_it.md`; the English one is the reference. Any change
  to an English document updates its `_it.md` in the same commit. Not translated: `CLAUDE.md` and the evaluation
  artefacts (`spikes/**`: RESULTS, GOLD_AUDIT, dataset READMEs).
- Commits as the maintainer (`andreagenovese <info@rstonline.it>`), **no Claude/Anthropic trailers**.
- **Ask before any push / publish** (the repositories are public since v0.1.0; so are the npm packages and the proxy
  image — a release, tag, npm publish or image push always needs the maintainer's OK).
- Substantial work on a dedicated branch, merge `--no-ff` after the maintainer's OK; small obvious
  fixes directly on `main`. Delete merged branches.
- Never break existing behaviour: enumerate call sites, prefer additive changes, test old and new.
- Platform code and prompts stay generic (no customer/domain names hardcoded).
- **All languages** (maintainer's rule 2026-10-08): Recordare supports all languages, at least the most used. Never add a
  word list for IT / EN only: language data lives in `service/src/lang/` (Intl where possible, tables otherwise; scripts
  without spaces matched as substrings), one test per language.
- Development phase: clean code over backward compatibility (no dual paths / lazy migrations).
- Stack preference: TypeScript / NestJS (service), Postgres; i18n IT/EN. Before committing service code run, in
  `service/`, `npm run typecheck`, `npm run lint` and `npm test` (CI runs the same; lint broke CI once).
- Don't ask for confirmation at each intermediate step inside agreed work.
- **Licences** (`docs/LICENSING.md`): ideas may be reimplemented with citation; code / prompt text
  only from AGPL-compatible licences (MIT, BSD, Apache-2.0, GPL family) with notices recorded in
  `THIRD_PARTY_NOTICES.md` at the moment of reuse; never copy unlicensed / non-commercial
  sources (e.g. LoCoMo is CC BY-NC); paper text is rewritten, not copied.
- **Any LLM provider** (D27): Recordare must work with any LLM / embedding provider; DeepSeek and
  local Ollama are only our test setups — never hardcode provider specifics outside the
  provider-profile configuration.
- Cost (**D35**): an option, not a limit — costly mechanisms sit behind quality profiles
  (economy / balanced / full) the deployer chooses; never trade quality silently; measure every profile.

## Spike (`spikes/memory-eval/`) — how to run
- Python via `uv`; run commands as `uv run --directory <abs path to spikes/memory-eval> python …`
  (a Claude Code permission rule allows exactly this prefix).
- `.env` (gitignored, recreate if missing): `LLM_BASE_URL=https://api.deepseek.com/v1`,
  `LLM_MODEL=deepseek-flash` (answer + judge), `LLM_API_KEY=…` (DeepSeek key, same as Arkimede's
  `llm_configs` entry), `ENGINE_MODEL=deepseek-v4-pro`, `ENGINE_NO_THINKING=1`.
- `embed_server.py` = local gateway on :8790: `/v1/embeddings` (fastembed/sentence-transformers)
  and `/v1/chat/completions` → DeepSeek with **thinking disabled** (required by Memobase's
  1024-token cap; also used by Graphiti when `ENGINE_NO_THINKING=1`).
- Engines: Graphiti on FalkorDB container `memeval-falkordb` (**image `falkordb/falkordb:v4.22.0`**,
  host port 6390 — 6.x breaks Graphiti); Memobase via `memobase/docker-compose.yml` (API :8019,
  `setup_memobase.py` writes the gitignored `config.yaml`; currently configured for bge-m3).
- `run_eval.py --system baseline|graphiti|memobase|d [--noise] [--only q01,…]` → `results/*.json`;
  `EVAL_DATASET=dataset_holdout` selects the held-out set (keep it blind: do not tune prompts on it)
  (gitignored). `emb_eval.py` with `EMBED_MODEL=st:<hf-model>|ollama:<name>|<fastembed-model>`.
- Gotchas: reasoning models need high `max_tokens` (empty content otherwise); the Mac's Docker VM
  disk is nearly full — clean images before pulling big ones. Run evals with
  `EMBED_MODEL=st:BAAI/bge-m3`. Local model: `ENGINE_BASE_URL=http://localhost:11434/v1
  ENGINE_MODEL=qwen3:8b` (D), or a second gateway with `LLM_BASE_URL` = Ollama + `EMBED_PORT=8791`
  and `setup_memobase.py` (Memobase). Long-running gateways need a long background timeout.
- Evaluation of the service (rule 9, D46): one service instance per queue (separate ports + `QUEUE_PREFIX` to compare
  versions); a run whose extractions carry more than one `extraction_runs.prompt_version` is discarded.

## Client library (`packages/client`)
- `@arkimedehq/recordare-client` (WORK_PLAN 6.7): the one client every platform uses, built on standards (official MCP
  SDK, RFC 9457, Retry-After, W3C trace context); no host-specific code. Checks: `npm run typecheck`, `npm test` in
  `packages/client`; the conformance suite runs it against the service (`service/test/conformance`, needs `npm ci` in
  `packages/client` first).
- Published on npm (0.12.0); Arkimede installs the package (since 2026-10-26, no synced copy): a library change reaches
  Arkimede through a new npm release (the maintainer publishes) and a version bump there.

## Connectors (`connectors/`)
- Claude Code plugin, Codex (hooks + MCP installer), OpenClaw plugin (npm `@arkimedehq/openclaw-recordare`), Hermes
  Agent memory provider (Python), OpenAI-compatible memory proxy (image built by `.github/workflows/proxy-image.yml`
  on `v*` tags). TypeScript connectors build on `packages/client`; CI typechecks, tests and builds them.
- The Claude Code / Codex hook script is shared: the two copies stay byte-identical (`connectors/check-shared.sh`).
- Bundles ship `THIRD_PARTY_LICENSES.txt` (`connectors/scripts/bundle-licenses.mjs`, `docs/LICENSING.md` rule 8).

## Related repos
- `~/Development/recordare-atlas` (`arkimedehq/recordare-atlas`) — optional live brain view (D42).

## Arkimede facts relevant here
- Embeddings: Arkimede now runs **BAAI/bge-m3** (1024 dims) in its own `embedding-service`;
  admin re-embed job exists (`/api/admin/vector-db/reembed*`); never change embedding model
  without it.
- Existing semantic memory: A-MEM (`backend/src/user-memory/`, `docs/MEMORY.md`, per-user
  `autoMemoryEnabled` governs extraction + injection + tools; scopes personal / team / org).
  **D34** (done 2026-10-13): A-MEM stays in Arkimede unchanged; Recordare is complete (notes too); users copy notes
  Recordare → A-MEM by hand or by category rule, kept in step by the notes change feed (`replaces`); Arkimede's toggle
  is split: `autoMemoryEnabled` (personal notes) and `sharedMemoryEnabled` (team / org notes).
- Integration (M6.2, done): outbox ingest, identity + naming, Recordare MCP tools as `recordare_*` (no `log_episode`),
  its per-user memory switch is the only on/off (D50, no consent state); voice spans from its Wyoming server act for
  the Wyoming user (D47).
- API convention: no global prefix, controllers hard-code `api/...`.

## Next steps
Follow `docs/WORK_PLAN.md`, memory engine first (maintainer, 2026-10-12: connectors last). Done 2026-10-12: 5.3, 5.4 (+ blind),
5.5, 4.1, 4.7, 5.7 taint; 5.8 parked; blind11 entity set 98.8 %; 5.4 follow-ups tried and reverted (known limit).
Done 2026-10-13: D34 A-MEM toggle split + note copies (Arkimede); 6.6b (5) durable OpenClaw queue, (10) `/mcp` plain JSON;
6.6b (6) real-channel tests on hold. Done 2026-10-14: 8.7 follow-ups (alias, personal-token `PATCH me`, gender in
`PersonDirectory`); D51 holder link codes (one-time code + holder's confirmation), merged and deployed. Done 2026-10-15:
4.4c cost budget gate (`service/test/cost/`, `budget.json`; `COST_BUDGET_UPDATE=1` records an intended rise); 6.5 (1)–(3)
continuous listening (source `ambient`, `extract.v16`, everything heard pending, pending items only propose replacements —
migration `PendingProposals` —, `heard` in recall; dev set `dataset_dev_ambient` 86.7 %). Done 2026-10-16: 6.5 (4) room fan-out
(`POST api/v1/ingest/room`, client `ingestRoom`); 4.5c the two H1 rates (`spikes/memory-eval/outcome_eval.py`, a second
grading of stored answers; RESULTS.md). Done 2026-10-18: v0.3.0 released; OpenAPI with request and response
schemas; 2.3 closed by decision (no `VectorStorePort`: pgvector helpers in `service/src/db/pgvector.ts`).; 6.4 Arkimede regression checklist done (`memory-regression.integration.spec.ts` in Arkimede).; 2.6 done (the service's own sentences in all languages: `service/src/lang/messages.ts`; any BCP 47 locale). Done 2026-10-19: 4.5b CLI `provider_eval.py` + `docs/MODELS.md` (native OpenAI / Gemini / Anthropic runs wait for keys); H1 harder blind set `dataset_blind12` (Recordare 92.6 %, nothing invented on unknown; full context 95.4 % but invents outcomes); `extract.v17` (an event told as done that a later window contradicts is corrected), lists without a period by relevance, facts unknown again (migration `UnknownFactHistory`). Done since 2026-10-19 (per release, `CHANGELOG.md`): v0.4.0 (10-26: plans apart from facts, my own replies, cards and erasure); v0.5.0 (10-27: private memories, D52); v0.6.0 (11-03: the agent's own mind D53, memory-first D54); v0.7.0 (11-04: initiatives decided by Recordare, D55 F1–F2); v0.8.0 (11-05: `InitiativeInbox`, every setting from the console); v0.9.0 (11-06: F3a channels / addresses / presence by place, F3b client library, two cards of one person merged from the console; Arkimede built F3c–F3d and F5a — one `telegram` skill, guests words only unless authorized, Home Assistant native, a satellite turn as a presence, a host task as the source of truth against duplicate reminders); v0.9.1 (11-06: asking who it is names no one, `charter.v3`; a name the speaker says is never an identity — maintainer). Next, in order (maintainer 2026-11-06): the dev-set timing cases of D55 §5c (arrival, 30-minute pace, the opening with others present) → F4 timing v1 (learning from outcomes, measured on the dev set and on Kinox); F2b the growing-household curve (done 2026-11-06: gaps "who is X?" asked of who named them, `dataset_dev_household`, 0 errors in 2 runs; confirmations of a note heard once or guessed and one learning question a day, done 2026-11-07: up to 8 facts learnt by asking against 3, 0 errors, the end count within noise; perceptions that fade in WORK_PLAN 8.12e, waiting for Arkimede's camera recognition); F6 timing v2 (done 2026-11-07: the moment's context — a pause after a refusal, `busy` / `talking` on a presence, company learnt apart; `INITIATIVE_TIMING=v2`, Kinox in shadow first; Recordare's only part of the old F5 — voiceprint, face and the quacksat duck are Arkimede's work, F5 / F5b); F3 push for OpenClaw and Hermes; 6.6b (6) real-channel tests on hold. Follow `docs/WORK_PLAN.md`.
