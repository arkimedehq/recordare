# Recordare — context for Claude Code

Standalone memory + **digital twin** service for agentic platforms (MCP + REST ingest + SDK).
Arkimede (`~/Development/personalAgent`, public mirror `arkimedehq/arkimede`) is the first
client. Status: **design + evaluation spike; no service code yet.**

## Read first
- `docs/DIGITAL_TWIN_VISION.md` — goal, pillars, disclosure tiers, initiative levels, legacy
  mode, architecture (standalone, own DB, one memory per person), name, roadmap.
- `docs/EPISODIC_MEMORY_TODO.md` — phase 1 design, decisions D1–D33 (layered memory: raw log →
  episodes → digests → semantic notes; two LLM calls; idle+nightly triggers; tools
  `log_episode` / `search_episodes`; bi-temporal episodes; Memobase-like profile+events).
- `spikes/memory-eval/RESULTS.md` — engine comparison (baseline / Graphiti / Memobase / prototype
  D) and embedding comparison. Round 2 + held-out: D wins; **D23 approved: build D**; in the DeepSeek test setup `deepseek-flash` = `v4-pro` quality.
  Spike runs cost real money (DeepSeek): keep runs minimal, prefer base before noise.
  Reasoning-off switch per provider: `evalkit/common.py` → `REASONING_OFF` (override with
  `REASONING_OFF_BODY`).
- `docs/API.md`, `docs/DATA_MODEL.md` — M1 contracts: identity / auth (D24), REST ingest, MCP tools
  (`log_episode`, `correct_episode`, `forget_episode`, `search_episodes`, `search_facts`,
  `resolve_period`), viewer context on every read, read API, SDK; data model v1. **D33**: build only the v1
  home / research profile; public-profile hardening is specified but deferred (stay on the twin).
- `docs/WORK_PLAN.md` — milestones M0–M7 for phase 1 and open decisions D23–D26.
- `docs/RESEARCH_NOTES.md` — hypotheses register (H1–H8) with literature verdicts: phase 1 is
  mostly integration; open ground = unresolved user plans (H1), twin disclosure (H2), owner vs
  twin provenance (H3). Never claim novelty without re-checking it.
- `docs/literature/` — deep-reading cards of 15 key sources + `README.md` synthesis (D29 data-model
  additions, D30 assistant turns, recall changes, eval-suite upgrade). Read before designing a component.
- `docs/ENGINE_IDEAS.md` — what we borrow from Memobase / Graphiti, what we reject, held-out
  gaps, and **cost principles** (the owner wants Recordare as cheap as possible: zero LLM calls
  when nothing to do, cheap model, no reasoning, prefix caching).

## Conventions (the owner's preferences — follow them)
- Chat with the owner in **Italian**; code comments and dev-facing docs in **English**.
- Commits as the owner (`andreagenovese <info@rstonline.it>`), **no Claude/Anthropic trailers**.
- **Ask before any push / publish** (repo is private for now).
- Substantial work on a dedicated branch, merge `--no-ff` after the owner's OK; small obvious
  fixes directly on `main`. Delete merged branches.
- Never break existing behaviour: enumerate call sites, prefer additive changes, test old and new.
- Platform code and prompts stay generic (no customer/domain names hardcoded).
- Development phase: clean code over backward compatibility (no dual paths / lazy migrations).
- Stack preference: TypeScript / NestJS (service), Postgres; i18n IT/EN; type-check with
  `tsc --noEmit` before committing.
- Don't ask for confirmation at each intermediate step inside agreed work.
- **Licences** (`docs/LICENSING.md`): ideas may be reimplemented with citation; code / prompt text
  only from AGPL-compatible licences (MIT, BSD, Apache-2.0, GPL family) with notices recorded in
  `THIRD_PARTY_NOTICES.md` at the moment of reuse; never copy unlicensed / non-commercial
  sources (e.g. LoCoMo is CC BY-NC); paper text is rewritten, not copied.
- **Any LLM provider** (D27): Recordare must work with any LLM / embedding provider; DeepSeek and
  local Ollama are only our test setups — never hardcode provider specifics outside the
  provider-profile configuration.
- Cost: as cheap as possible **without losing quality** — at equal measured quality the cheaper
  option wins; never trade quality for cost.

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

## Arkimede facts relevant here
- Embeddings: Arkimede now runs **BAAI/bge-m3** (1024 dims) in its own `embedding-service`;
  admin re-embed job exists (`/api/admin/vector-db/reembed*`); never change embedding model
  without it.
- Existing semantic memory: A-MEM (`backend/src/user-memory/`, `docs/MEMORY.md`); raw-log search
  `search_conversations`. A-MEM stays in Arkimede for now; migrating it into Recordare is a
  later roadmap phase.
- API convention: no global prefix, controllers hard-code `api/...`.

## Next steps
Follow `docs/WORK_PLAN.md`: M0 done (D23 approved) → M1 contracts and M2 scaffold.
