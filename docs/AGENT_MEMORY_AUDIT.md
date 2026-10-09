# Agent memory — audit against the vision of 2026-10-09

> **Working document, English only for now** (not yet translated: the bilingual-docs rule applies once it becomes a
> project document or its content moves into DATA_MODEL / API / VISION / EPISODIC_MEMORY_TODO). Written 2026-10-09.
> Read: `main` and `news-memory` (14c78ca: adds `extract.v11`, D49, WORK_PLAN 5.9). Line numbers are
> those of the working tree on `news-memory` (identical to `main` except `service/src/engine/extraction.prompt.ts`
> lines 9 and 74–81 and the D49 section of `EPISODIC_MEMORY_TODO.md`). Nothing in code or docs was changed.
>
> **Decided 2026-10-09 — see D50** (EPISODIC_MEMORY_TODO) and WORK_PLAN M8: personal mode = first person with the
> account holder as "I" and no distinction between the person and the assistant (the D38 echo guard kept); gender is a
> per-memory setting; an identified speaker asking about themselves gets their own memories, an undeclared one the
> agent's; no consent; no viewer filter for now.

## 0. The vision in engineering terms

| # | Owner's decision | Consequence in Recordare |
|---|---|---|
| 1 | One memory = one **agent** (a client account, e.g. "Caino"); another account = another memory, isolated | `owners` stop being humans: a memory belongs to an account. Humans become **contacts of that memory** (scoped persons). The per-memory isolation already built stays; cross-memory person identity (`external_identities` binding one human to a global person) goes |
| 2 | Two modes: **personal** (undeclared input = the agent itself, **first person**; declared speakers by name) and **entity** (undeclared input = "someone"; declared by name; input marked **own** = the agent, first person) | `persons.kind human / entity` becomes the memory's **mode** `personal / entity`. Both modes attribute identified speakers by name (today only entity does). Ingest needs an **own** marker. Prompts change voice: first person replaces "the owner … by name" |
| 3 | Every memory keeps **who said what and whose it is** (declared identity, voiceprint, other methods, with confidence) | New attribution columns: subject of every episode / fact / note (`self`, a contact, `someone`), attribution **method** and **confidence** on messages / participants and on memories |
| 4 | **No viewer rule / no disclosure filtering** for now | Remove `ownerOnly` gating everywhere (MCP reads, memory context); keep `audience` / `disclosure` as recorded data for the later privacy work |
| 5 | **No consent** in Recordare | Remove `episodic_enabled*`, `ingest_refused_at`, the consent gates in ingest / extraction / consolidation / MCP writes, the console toggle, consent states in the client library and connectors |
| 6 | The **Diary stays** (correction tool for whoever maintains the memory) | Read API stays; its framing changes from "the person's own diary" to "the memory's maintainer" |
| 7 | **All inputs** enrich the agent's memory; D49 joins | Ingest of non-chat sources (documents, photos / audio / video transcripts, sensors) with the own marker; the extraction gate must not require a `user` message |
| 8 | The agent will later **reflect** and develop | Not built now; reserve an origin (`reflected`) and keep self-model notes `inferred` + pending (vision H12) |

The biggest single change is **#2 + #3**: "who is the self, and whose is each memory" moves from an implicit rule
("role `user` = the owner") to explicit attribution data, and the extraction prompts move from third person to
first person. Everything else (consent, viewer rule) is mostly removal.

---

## 1. Inventory by area

Legend — **Kind**: R = remove, N = rename, M = modify, + = new. **Re-measure**: the evaluation needed (WORK_PLAN →
Evaluation budget; prompt changes = dev set(s) + 3 blind runs).

### A. Data model (`service/src/db/migrations`, `service/src/identity/identity.entities.ts`, `rawlog.entities.ts`)

| Item | Today | Must change | Kind | Risk / re-measure |
|---|---|---|---|---|
| `owners` table (`InitialSchema` 88–98; entity `identity.entities.ts` 22–34) | One row per human with a memory; PK = `persons.id` | It is the **memory of an account**. Either keep the table name and redefine it (cheap) or rename `owners` → `memories` and every `owner_id` (209 SQL occurrences, 442 `ownerId` in TS, 58 files) in one mechanical branch | M (N optional) | Mechanical; no eval. Recommend: behaviour first, physical rename last (step 10 of the plan) |
| `owners.episodic_enabled`, `_at`, `_by` (`InitialSchema` 94–96; entity 28–30) | Consent (D4) | Drop | R | Migration `down` restores `true` |
| `owners.ingest_refused_at` (`1791040000000-ConsentWaiting.ts` 14; not in the entity class — raw SQL only) | "waiting for consent" | Drop (the whole migration's purpose is gone) | R | — |
| `persons.kind` enum `human \| entity` (`InitialSchema` 48, 85; `1791030000000-EntityMemory.ts` 15; entity 17) | Kind of the owner person (D48) | The memory's **mode** `personal \| entity`. Belongs to the memory row (`owners.mode`), not to `persons` (contacts have no mode). `synthetic` (DATA_MODEL 87, 383) stays reserved | N + M | Migration maps `human → personal` |
| `persons.owner_scope` (`InitialSchema` 83, 99–101) | null for owners, set for contacts | Every human is a contact of exactly one memory (`owner_scope NOT NULL` for humans); the memory's own row keeps null | M | Existing owners that appear as participants in another memory (e.g. Andrea in Arkim3de's chats) need a contact row in that memory |
| `external_identities` (`InitialSchema` 139–153) | `client_user` binds a client's user id to a **global** person (unique `(client_id, external_id)`); `channel` optionally scoped | Split the two meanings: (a) **account identity** — which memory a client account opens (today's `client_user` → owner); (b) **participant identity** — a declared speaker resolved to a contact **inside one memory** (`owner_scope` required, unique per memory). The same Arkimede user id is then both Andrea's account and a participant in Arkim3de | M (+ enum value `account`) | Ingest participant resolution changes (E) |
| `conversation_participants.role` enum `owner \| assistant \| other` (`InitialSchema` 54, 208) | `owner` = the account's user | `owner` → `self` (personal: the account's speaker; entity: means "the speaker on the account", whose identity is unknown unless declared). See open question Q2 | N | Wire-format change in ingest (`ingest.schemas.ts` 21) |
| `conversation_participants` / `messages` attribution | `person_id` only when a verified identity exists; `messages.author_person_id`, `author_ref` (`1790970000000-MessageAuthorRef.ts`) | + `attribution_method` enum (`account`, `declared_identity`, `self_introduction`, `addressed_by_name`, `voiceprint`, `client_assertion`, `none`) and `attribution_confidence real` — on participants (per conversation) and overridable per message (a voice span with its own voiceprint score) | + | Additive |
| `messages` own marker | none | + `own boolean` (or `role`-independent `scope`): content the client marks as the agent's own (knowledge given to it, its perceptions, a document) | + | Ingest contract (E) |
| `conversation_source` enum (`InitialSchema` 53) | chat, voice, mcp_tool, import_* , interview | + `document`, `perception` / `sensor`, `ambient` (WORK_PLAN 6.5 already plans `ambient`) | + | Additive |
| `origin_kind` `owner_lived \| owner_told \| assistant_stated` (`InitialSchema` 56; `extraction.schema.ts` 19) | Who lived / said it, relative to the owner | Re-base on the subject: `lived` (the subject's own experience), `told` (reported about others), `agent_stated` (the assistant said / did it), + `perceived` (own sensor / robot), `learned` (D49 source), reserve `reflected` (vision #8) and DATA_MODEL's `twin_experienced` (382) is absorbed | N + M | Prompt schema change → part of the prompt step (F) |
| `author_role` `owner \| assistant \| other \| tool` (`InitialSchema` 57) | Who wrote the evidence | `owner` → `self` (undeclared account speaker in personal mode), + `person` (identified participant) vs `other` (unidentified other), + `own` (marked own input) | N + M | Consolidation, facts review, recall and Atlas filter on it (G, H, K) |
| `audience`, `audience_unverified`, `disclosure`, `confidence_of` (`InitialSchema` 32–36; Notes 52–54; digests 339–340) | Enforced by the viewer rule; `audience` always contains the owner | **Keep as recorded data, stop enforcing.** `audience` = contacts present (the memory's own row may stay as a member). Indexes (`episodes_audience_idx` 284, `facts_audience_idx` 394, `notes_audience_idx` Notes 63) stay for the later privacy work | M (doc) | None |
| Subject of a memory | `facts.subject_person_id` (373; null = owner / entity), set **only in entity memories** (`extraction.writer.ts` 412); episodes have `episode_people` (297–302) but no subject; notes have none | `subject` on **episodes, facts, notes** in both modes: null = self (personal) / the agent (entity, own); a contact id; or **someone** (needs a non-null marker: `subject_kind enum self \| person \| someone` + `subject_person_id`) + `attribution_method`, `attribution_confidence` | + / M | The `facts_single_current_check` trigger (396–414) and `facts_owner_key_idx` already include the subject; "someone" must never hold a single-value slot (today: personal facts of unidentified speakers are dropped — keep) |
| `digests` (329–345) | One diary per owner, `audience = [owner]` (`consolidation.service.ts` 222) | The agent's diary; audience recorded only | M | — |
| `recall_log.owner_id` references `persons` (`1791000000000-RecallLog.ts` 16) | fine | none (rename only with the global rename) | — | — |
| Sources (D49) | not built | + `sources`, `source_passages`, links episode ↔ source, `provided_by` (contact / own) | + | Later step |

### B. Identity, auth, which memory a request opens (`service/src/auth`, `service/src/me`, `service/src/admin`)

| Item | Today | Must change | Kind | Risk / re-measure |
|---|---|---|---|---|
| `OwnerResolver` (`owner-resolver.service.ts` 9–59) | `X-Recordare-User` = the client's user → owner (auto-provision creates a human person + owner + `client_user` identity, 50–58); 404 when bound to a non-owner (39–48) | Resolves the **account** → memory. Provisioning creates the memory row + its own person (mode default `personal`) + an `account` identity. Header name: keep `X-Recordare-User` (documented as the account id) or rename to `X-Recordare-Account` everywhere at once (Q1) | M | All clients send it: Arkimede, 5 connectors, Hermes (Python), conformance suite |
| Personal tokens (`access_tokens.owner_id`, `auth.service.ts` 62–72, `principal.ts` 10 `owner_token`) | A person's token | A token **for one memory** (an account) — e.g. Claude Code reaching Caino's memory. Rename `owner_token` → `memory_token` with the global rename | N | — |
| `ViewerContextService` (`viewer-context.service.ts` whole file, 16–49) | Computes `ownerOnly` from participants; `X-Recordare-Viewers` may only narrow | Remove the viewer rule. Keep only **conversation resolution** (external id → conversation id), still needed by MCP writes for evidence binding and by recall (`conversationId` for raw-log / recall log). Rename to `ConversationResolver`; drop `VIEWERS_HEADER` and `_meta.recordare.viewers` | R + N | Tests `mcp.int.spec.ts` 78, `context-ingest.int.spec.ts` 48 assert the old rule |
| `GET api/v1/me` (`me.controller.ts` 25–37) | `{ownerId, displayName, kind, episodicEnabled, atlasUrl, via, scopes}` | Drop `episodicEnabled`; `kind` → `mode`; `ownerId` → `memoryId` (with the rename) | M | Client library contract + conformance |
| `PATCH api/v1/me` (`me.controller.ts` 14–18, 39–66) | Name follows the platform's user; `kind` only while empty (409 `memory_not_empty`); "Consent stays with the admin" (43) | Name = the account's name (the agent's, e.g. "Caino"); `mode` only while empty — **keep** that guard (first-person items would otherwise mix with "someone" items); drop the consent sentence | M | — |
| Admin schemas (`admin.schemas.ts` 23 comment, 28–47) | `createOwner/updateOwner {displayName, kind, locale, timezone, episodicEnabled, qualityProfile}`; key scopes never `owner_settings` "(consent stays with the owner, D33)" | Drop `episodicEnabled`; `kind` → `mode`; scope `owner_settings` loses its consent purpose (keep for locale / timezone / profile or drop) | M | — |
| Admin service (`admin.service.ts` 32–60, 104–130) | create / update set consent fields; `listPersons` returns `episodicEnabled`, `waitingForConsentSince` | Remove consent; list **memories** with their contacts count, mode, identities (account + participant) | M | `console.int.spec.ts` 42 |
| Admin identities (`admin.schemas.ts` 49–55, `POST identities`) | bind `client_user` / `channel` to a global person | Two forms: account identity → memory; participant identity → contact of one memory (`ownerScope` required) | M | — |

### C. Consent removal — every place

| Place | Line(s) | Change |
|---|---|---|
| `rawlog/ingest.service.ts` | 6 (doc), 38–43 (gate + `ingest_refused_at`), 147 (comment) | R — ingest always stores |
| `rawlog/ingest.schemas.ts` | 46 `stored` in `IngestResult` | R or keep always `true` (clean code: remove; client contract changes) |
| `engine/extraction.runner.ts` | 48, 51 (`if (!conv?.episodic_enabled) return`) | R |
| `engine/consolidation.service.ts` | 71–72 | R |
| `queue/consolidation.processor.ts` | 46 (`WHERE o.episodic_enabled`) | R — every memory is consolidated (still zero LLM calls when nothing changed, D5) |
| `recall/memory-write.service.ts` | 42–45 `consented()` | R |
| `mcp/mcp-tools.ts` | 129, 147, 159 (`memory is off for this person`) | R |
| `me/me.controller.ts` | 30–31, 35 | R |
| `admin/*` | schemas 23, 34, 44; service 36–37, 46–50, 106–107 | R |
| `identity/identity.entities.ts` | 28–30 | R |
| Migrations | `InitialSchema` 94–96, `ConsentWaiting` | + migration dropping the columns |
| Console | `service/console/app.js` 13, 22–25, 35, 44–47, 123–129, 153–154, 165 | R (consent switch, "waiting" chip) |
| Client library | `packages/client/src/contract.ts` 28–29, 96–97; `people.ts` 5, 12–21 (`ConsentState`, `consent`), 61, 69–72 (`knownOff`), 74–84 (`status`), 105, 111, 116; `client.ts` 23, 36, 53 | R / M — `PersonDirectory` becomes an **account directory** (memory id, mode, atlas, name sync); `ConsentState` goes |
| Connectors | `openai-proxy/src/memory.ts` 38–39, 67, 106–113 (`noConsent`); bundled `dist/` of openclaw and openai-proxy (rebuild) | R |
| Arkimede (`personalAgent/backend/src/recordare/recordare-identity.service.ts`) | 10–16, 34–38 (`waiting_activation`), 57, 111–131 (`cachedConsent`, `consentKnownOff`, `status`) + the outbox's consent-off skip | R — the Arkimede switch stays (client-side opt-in, vision #5); "active" whenever on. Sync the library copy, never edit it |
| Tests | `rawlog/ingest.int.spec.ts` 43–53; `mcp/mcp.int.spec.ts` 215; `conformance/client.int.spec.ts` 6, 52–69, 92; `auth/auth.int.spec.ts` 34, 39, 74; `console.int.spec.ts` 42; every `episodicEnabled: true` in setup (read, recall, isolation, atlas, engine/*, telemetry) | M |
| Eval harness | `spikes/memory-eval/systems/service_sys.py` 67 | M (drop the field) |
| Docs | D4 (`EPISODIC_MEMORY_TODO.md` 177–179), D33 (431–433 "consent flag (D4)"), D36 (483–486), D48 follow-up (556), D49 "Same rules … consent" (583); `API.md` 44, 51, 61, 79, 170–172, 185, 199–201, 311, 362, 365; `DATA_MODEL.md` 5, 104–106, 116; `INTEGRATION.md` 9, 19–23, 34–35; `KNOBS.md` 64, 78, 113; `DEPLOYMENT.md` 72; `README.md` 40, 72–73, 196, 227; `service/README.md` 33; `CLAUDE.md` 30, 133; `WORK_PLAN.md` 151 (4.5), 251 & 265 (consent state, toggle), 272 (6.9 console), 6.6b (11); `DIGITAL_TWIN_VISION.md` 52, 60–62 (principle 8), 268 | Supersede with a new decision (D50) — do not silently delete history |

Risk: none for quality (no prompt change). Re-measure: none (unit / integration tests only). Legal note in Q9.

### D. Viewer rule removal — every place

| Place | Line(s) | Change |
|---|---|---|
| `auth/viewer-context.service.ts` | 1–50 | R the rule; keep conversation lookup (36–42 query) as a resolver |
| `mcp/mcp-tools.ts` | 6–7 (doc), 12, 40 `NOTHING`, 49–57 `context()`, 58 `writable`, 83, 100 | R the `ownerOnly` early returns; `writable` keeps "needs a resolvable conversation or a token" (evidence binding) |
| `recall/context.module.ts` | 10, 49, 62–64 | R |
| `recall/context.service.ts` | 9 (doc "reads follow the viewer rule") | M doc |
| `read/read.service.ts` / `read.module.ts` | 8 / 50 (comments: owner-direct, no viewer rule) | M doc only |
| `rawlog/rawlog-search.service.ts` | 7–8, 118–122 `raw_log_scope` | **Keep** — a client-scope rule (which client's chats are quoted), not a viewer rule. Re-check if one memory gets several clients (Q12) |
| Docs | `API.md` 32 (title), 91–107, 197–198, 265, 298, 316, 341–342, 387; `DATA_MODEL.md` 43–58 (read rule), 166; `README.md` 68–71; `ENGINE_IDEAS.md` 62–63; `RESEARCH_NOTES.md` 83–124 (H2 claims stay as research, mark as deferred); `INTEGRATION.md` 47–49; `CLAUDE.md` 24 ("viewer context on every read") | M |
| Tests | `mcp.int.spec.ts` 78 ("nothing in shared conversations"); `context-ingest.int.spec.ts` 48; `context.int.spec.ts` (viewer cases) | Invert: shared conversations now get the memory |

Risk: behavioural only. The eval harness asks with a personal token (owner-direct), so no eval number moves. Real
clients (Arkimede group chats, OpenClaw groups) start receiving memories in shared conversations — intended.

### E. Ingest (`service/src/rawlog`)

| Item | Today | Must change | Kind | Risk |
|---|---|---|---|---|
| Undeclared `user` author (`ingest.service.ts` 73) | `role user` without `authorRef` → `author_person_id = ownerId` — also in **entity** memories (the entity is recorded as the speaker) | Personal: author = self (the memory's own row), method `account`. Entity: author **unknown** ("someone"), method `none` | M | Extraction speaker labels (F) and `authorRole` (writer 207–212) depend on it |
| Implicit owner participant (`ingest.service.ts` 183) | Adds `{ref: 'owner', role: 'owner'}` when missing | `self` participant only in personal mode; entity: none implied | M | — |
| Participant resolution (`ingest.service.ts` 176–213) | `client_user` → **global** person; `channel` → person scoped to the owner or global; unverified → display name only | Resolve inside the memory: participant identity → contact (create the contact on first sight when the client declares the identity — the client is trusted, vision #3), store method + confidence | M | New: contacts created by ingest; dedup with contacts created by the writer by name (`extraction.writer.ts` 497–509) — one resolver for both |
| Own marker | none | + `messages[].own` (and/or `conversation.source: document \| perception`) | + | Validation: `own` only with the `ingest` scope of the account itself |
| Declared voiceprint / confidence | none (talkiosk D45 plans voiceprints on the device) | + `participants[].identity.method` and `confidence`, per-message override | + | — |
| Non-chat inputs (vision #7, D49) | chat-shaped only | + a `POST api/v1/ingest/sources` (text the client extracted: documents, transcripts of audio / video, photo captions, sensor events) | + | Later step (D49) |
| `IngestResult.stored` (`ingest.schemas.ts` 46) | false without consent | R | R | Client contract |

### F. Extraction — prompts, schema, context, writer (`service/src/engine`, `service/src/lang/owner.ts`)

| Item | Today | Must change | Kind | Risk / re-measure |
|---|---|---|---|---|
| `EXTRACTION_SYSTEM` (`extraction.prompt.ts` 11–140) | "memory encoder of a **personal** memory service … about the **OWNER**'s life"; OWNER everywhere (fields 27–30, rules 72–137); news rule v11 74–81 ("<owner> learned that…") | Rewrite for an **agent memory**: the SELF (personal) written in the **first person** in the conversation's language; identified speakers by name with a `subject`; unidentified others as claims. Every "owner" rule re-worded for "self". v11's news rule becomes "I learned that…" | M | **High.** Dev sets (`dataset`, `dataset_dev_news`, `dataset_dev_poison`, `dataset_dev_echo`, a new personal-agent dev set) + **blind7 3 runs** (bar: 91.7 %, v11) |
| `ENTITY_RULES` (`extraction.prompt.ts` 147–169, `entity.v3`) | "THIS MEMORY BELONGS TO AN ENTITY … overrides 'the owner'"; speaker label `person`; "someone"; subject only for facts | Becomes the **entity mode** rules: undeclared = someone; declared by name; **own-marked input = the agent, first person**; subject on episodes / notes too; drop "shared, readable by everyone" (no disclosure now) | M | **High.** `dataset_dev_entity` + a new own-input dev set + **blind8 3 runs** (bar: 82.1 %, entity.v3) |
| `FACTS_SYSTEM` (`facts.prompt.ts` 21–75, `facts.v1`) | "state and profile of the OWNER"; "Only the owner's own words (speaker 'owner') can create or change facts" (70–72) | Facts and notes of the self **and of identified people** (with `subject`); only a subject's own words (or the self's) change that subject's facts | M | Measured with the extraction prompt (same runs; the facts pass runs only on profiles that ask for it — run blind7 with the default profile, plus one `full` run if the profile matters) |
| `buildExtractionUser` (`extraction.prompt.ts` 192–203) | `OWNER LANGUAGE` (194) | `MEMORY LANGUAGE`, + `MODE`, + the self's known names (Q3) | M | Part of the prompt step |
| Speaker labels (`extraction.context.ts` 107–113) | `owner` / `person` (entity) / `assistant` / `tool:x` / `other:Name` | `self` (personal, undeclared), `someone` (entity, undeclared), `person:Name` (identified, with method), `own` (marked), `assistant`, `tool:x`, `other:Name` (named but not identified) | M | Part of the prompt step |
| Context facts (`extraction.context.ts` 125–130, 180–181) | Person memory: only facts with `subject IS NULL`; entity: all, with `[Name]` | All facts in both modes, with `[self]` / `[Name]` | M | Prompt-size growth: keep the caps (MAX_FACTS) |
| `Owner` type (`extraction.context.ts` 35–43) | `{id, name, locale, timezone, entity}` | `{id, name, mode, selfNames, locale, timezone}` | M | — |
| Extraction gate D5 (`extraction.runner.ts` 77–83) | No LLM call unless the window has a `user` message or an owner-authored one | Call when the window has input from the self, an identified person, `someone` (entity), or own-marked content. A group chat with only identified others now costs a call | M | Cost goes up for group chats / own inputs (D35: measure tokens per message on Kinox-like traffic; ENGINE_IDEAS cost principles) |
| Prompt version (`extraction.runner.ts` 101–102, 110, 198–199) | `extract.v11` (+`+entity.v3`) | `extract.v12` (+ mode rules version) | M | Rule 9: one prompt version per run |
| `ExtractionWriter` ctx (`extraction.writer.ts` 37–44, 115–116 in runner) | `entity?`, `ownerName?` (named only for persons) | `mode`, no `ownerName` | M | — |
| `named()` / `nameOwner` (`extraction.writer.ts` 135–145; `lang/owner.ts` 1–72; `lang/index.ts` 11) | Replaces "the owner" / "l'owner" / "il proprietario" / … with the person's name, deterministic, measured (≈ 5 % leak; naming in the prompt cost ≈ 2 pt, extract.v9) | First person cannot be produced by substitution (verbs agree with the subject). Replace with a **detector**: count items still speaking of "the owner / the user / l'utente / <self name> in the third person" into the run summary (4.12) and, if frequent, drop or re-ask. `owner.ts` is removed or reduced to the detector | R / M | Measure the leak rate on the dev sets (counts only) |
| `authorRole()` (`extraction.writer.ts` 207–212) | `user` or owner-authored → `owner` | → `self` / `person` / `own` / `assistant` / `tool` / `other` from the message attribution | M | Feeds `stance` (`inferred` when only others / tools, 409–410): keep that poisoning guard, but an identified person's statement about **themself** is `stated` for that subject |
| Origin from role (`extraction.writer.ts` 239–240, 471, 540) | assistant → `assistant_stated`, else the model's `owner_*` | New origin enum (A) | M | — |
| `namedInWindow` guard (`extraction.writer.ts` 233, 411, 480–490) | Entity only: a person named by an item must occur **in the window text** | Both modes; also satisfied by a **declared participant** (its display name / identity), not only by words in the text (today a speaker declared by the client but never named in the text is dropped) | M | dev_entity and the new dev sets; blind8 |
| `subject()` (`extraction.writer.ts` 492–509) | Entity only; finds / creates contacts by display name | Both modes; resolves to the same contact as ingest's participant identity (one resolver), keeps the method / confidence | M | Duplicate contacts by spelling ("Marta" / "Marta Rossi") — already a risk today |
| Episode / note subject | Not stored (only `episode_people`) | Store `subject` from the model's output (new schema field) | + | Schema `extraction.schema.ts` 14–49: + `subject` on episodes and notes; `origin` enum |
| Facts in a person memory (`extraction.writer.ts` 412) | `subjectId = null` always | Subject from output; null = self | M | — |
| Tombstones / plans / echo / assertedAfterRecall (`extraction.writer.ts` 158–205, 270–380) | Owner-neutral except the plan-anchor stop-list `owner` name (313–322) | Plan anchors: exclude the self's names (Q3) instead of the owner's display name | M (small) | — |
| Near-duplicate resolver (`episode-resolver.ts` 20–25, `resolve.v1`) | "memories of a personal memory service … the owner corrected it" | Reword for an agent memory ("a later message corrected it") | M (small) | Resolver prompt change → covered by the same dev / blind runs |

### G. Consolidation, digests, facts review

| Item | Today | Must change | Kind | Risk / re-measure |
|---|---|---|---|---|
| Digest prompts (`consolidation.prompt.ts` 15–27, `digest.day.v1` / `digest.month.v1`) | "in the third person about the owner by name"; "a person's life" | Personal: the agent's diary **in the first person**, others by name. Entity: the agent's diary — what happened around it, named people, "someone", its own perceptions / actions in the first person | M | Digests are **off in recall** (`recallDigests`, −1.9 pt measured), so no blind runs needed; check the Diary output on the dev sets (1 consolidation run) and `consolidation.int.spec.ts` |
| Digest input (`consolidation.service.ts` 76–83, 113, 135) | Only `author_role IN ('owner','assistant')` ("claims never laundered into the owner's diary", 8–9); user message `OWNER: <name>` | Include identified persons' own episodes (attributed), keep unidentified others' claims about the self out; `OWNER:` → `MEMORY: <name>, MODE` | M | Same |
| Facts review (`facts-review.prompt.ts` 14–30, `facts-review.service.ts` 43–73) | "the owner's FACTS", `subject_person_id IS NULL` only, episodes of owner / assistant | All subjects; rule "what others claim about the owner" → "about the self / about another subject" | M | Built **off** by default (D41): measure only if turned on (blind5-style check, 1 run) |
| Consolidation lock / zero-call rule (`consolidation.service.ts` 50–67) | per owner | per memory | — | — |

### H. Recall — MCP tools, searches, memory context (`service/src/mcp`, `service/src/recall`)

| Item | Today | Must change | Kind | Risk / re-measure |
|---|---|---|---|---|
| Tool descriptions (`mcp-tools.ts` 66–71, 89–92, 114–116, 137–139, 152–154, 166–168) | "what the **user** lived", "who the user is", "The user corrects…" | "what is in this agent's memory: its own life in the first person (personal: the person it is the twin of), other people by name" — answer framing for first-person items | M | Tool text is read by the answering model: **measured with the prompt step** (blind7 / blind8). Keep schemas provider-neutral (D27) |
| `search_episodes` result (`episode-search.service.ts` 53–62, 160–200) | `owner: {name}` "items name the owner in the third person — that is the user asking"; `claims` = authorRole other / tool; notes "claims … not the owner's memories" | `memory: {name, mode}` + per item `subject` (`self` / name / `someone`) + `attribution`; `claims` = items whose author is not their subject (someone speaking about another); localized notes reworded | M | dev_poison (others' claims) + blind7 |
| `search_memory` (`memory-search.service.ts` 27, 38–39, 89–100, 131) | facts by subject only in entity; `owner: {name}` | Facts / notes with subject in both modes | M | Same |
| Raw-log search (`rawlog-search.service.ts` 20–21, 55, 108) | `authorRole` `owner` when `author_person_id = ownerId` | `self` / `person` / `someone` / `tool` | M | — |
| People-aware recall (`recall/people.ts` 5–28; `lang/relations.ts`) | "my mother" resolved against the owner's people | Personal: relations are the self's. Entity: "my mother" depends on who asks — resolve only when the asker is identified (the conversation's declared participant) | M | dev set `mcp.int.spec.ts` 113 |
| Memory context (`context.service.ts` 70–120, `context.module.ts` 62–64) | viewer gate; facts with `about` in entity | No gate; per-item subject marker in the block (`[me]` / `[Name]`) | M | Its own dev set `dataset_dev_context` (1 run) + one blind run with the context on (KNOBS: off by default in Arkimede) |
| MCP writes (`memory-write.service.ts` 7, 18, 29–30, 47–110, 152–190) | `byOwner` = a recent `user` / owner-authored message overlaps the text; else `assistant_stated`, inferred, pending | "by the self" (personal) or "by the identified speaker" (subject = that person); entity: an unidentified speaker's write is `someone` / inferred | M | `mcp.int.spec.ts`; dev_poison slice |
| `forget_episode` / `correct_episode` | owner's | the maintainer's (Diary) — unchanged logic | — | — |
| `resolve_period` | owner timezone | memory timezone | — | — |

### I. Read API / Diary, admin console

| Item | Today | Must change | Kind |
|---|---|---|---|
| Read API (`read/read.service.ts` 4–9; `read.module.ts` 50–66, 73–170) | "the diary a platform shows **the person**: … the reader is the person themself (owner-direct)" | Stays (vision #6); the reader is **whoever maintains the memory**. Items gain `subject` / attribution; facts already grouped by `about` (215–225) — now in both modes | M (doc + fields) |
| Read API in shared accounts (`API.md` 341–342) | "In an entity memory everyone using the account…" | Unchanged in effect (no privacy now) | M doc |
| Console (`service/console/app.js` 10–48, 121–212; `index.html` 16–42) | "Persone" / "People" list, consent switch, kind select "Personale / Condivisa (entità)", "waiting for consent" | "Memories" (agents), mode select `personal / entity`, contacts count, account + participant identities; no consent | M |
| Admin runs (`admin.controller.ts` 36, `admin.service.ts` 95–101) | per owner | per memory | — |

### J. Client library, connectors, Arkimede

| Item | Today | Must change | Kind | Risk |
|---|---|---|---|---|
| `packages/client/src/contract.ts` | `MeResponse {ownerId, kind, episodicEnabled}` (25–29), `IngestParticipant.role 'owner'` (49), `IngestResult.stored` (96–97), `MemoryKind` | `memoryId`, `mode`, participant `self`, identity method / confidence, `own` messages; no `stored` | M | Conformance suite `service/test/conformance` + sync to Arkimede |
| `packages/client/src/people.ts` (`PersonDirectory`) | Per platform **user**: person, consent, kind, atlas; platform opt-in; name sync | Per platform **account** (agent): memory id, mode, atlas, name sync. Drop `consent`, `ConsentState`, `knownOff`, `status` | M | Arkimede uses `status()` for its Settings badge |
| `packages/client/src/tools.ts` (`TOOLS`) | descriptions kept in sync with the service | follow the new tool texts | M | conformance checks it |
| Arkimede (`personalAgent/backend/src/recordare/`) | `recordare-identity.service.ts`: Arkimede user → person, `waiting_activation`; `recordare-ingest.mapper.ts` 12–15, 74–96: the chat owner's turns `user` + `authorRef 'owner'`, other Arkimede users `other` with `identity = their user id` | The Arkimede **user account** is the account (Andrea → his memory; Arkim3de → the voice account's memory). Other users in shared chats become **participant identities** resolved to contacts inside the account's memory (today they resolve to their own global person). Wyoming voice spans (D47) act for the voice account; a voiceprint (talkiosk) is a declared identity with confidence. Settings: "Personal / shared" → "personal / entity" mode, no consent badge | M | Cross-repo; never edit the synced copy |
| Connectors — user mapping | OpenClaw `identity.ts` 8–18 (`users` map channel:sender → Recordare user, unmapped senders not remembered), group buffer `plugin.ts` 10, 81–82; openai-proxy `identity.ts` 6–12, 167–190 (platform user → Recordare user); Hermes `client.py` 6–7, 73–79, `__init__.py` 254 (participant `owner`); claude-code / codex hooks (personal token) | Decide per connector what the **account** is (Q13): OpenClaw = the agent (one memory; senders become participants with `channel` identities); openai-proxy = the platform's user account (as today); Hermes = the agent profile; Claude Code / Codex = the token's memory. Rename participant `owner` → `self` | M | Each connector's smoke test + README (bilingual) |
| Connectors — consent | openai-proxy `memory.ts` 38–39, 106–113 | R | R | — |

### K. Telemetry / Atlas

| Item | Today | Must change | Kind |
|---|---|---|---|
| Events (`telemetry.service.ts` 14–29) | `ownerId` on every event; `memory.written.authorRole` | `memoryId` (with the rename); new `authorRole` values | N / M |
| Atlas snapshot (`atlas.service.ts` 13–75) | `owners()` list, `owner: {id, name}`, `authorRole` | memories; + subject per episode (metadata only) | M |
| Contract (`ATLAS_EVENTS.md` 9, 17, 29) | v1 "Snapshot of one person" | Renaming fields raises `v` → coordinated change in `recordare-atlas` | M |

### L. Evaluation harness and datasets (`spikes/memory-eval`)

| Item | Today | Must change | Risk |
|---|---|---|---|
| `systems/service_sys.py` 51–73 | one owner per dataset user, `episodicEnabled: True`, `kind: entity` for `entities`, `client_user` identity + personal token per user | one **account** per dataset user (same isolation role: the second / third user of every blind set is now a separate agent); `mode` instead of `kind`; no consent | Harness change: record in RESULTS which runs use the new harness |
| `service_sys.py` 77–99 (participants) | others in group sessions as unverified `other` | sessions may declare identities (new datasets) | — |
| Answer framing `service_sys.py` 209–211, 232, 240 | "MEMORIA DI: X — è l'utente che fa la domanda (i ricordi parlano di lui/lei in terza persona)"; "scritto dal proprietario" | "Memoria dell'agente (modalità personale): i ricordi in prima persona sono dell'utente che ti parla…"; entity: subject per item | **Changes every number**: the first measurement after it is the new baseline |
| `evalkit/common.py` `ANSWER_SYSTEM` 149–153, `JUDGE_SYSTEM` 166–182 | "assistente personale dell'utente"; judge neutral | Answer: unchanged wording works for personal mode; entity sets need "you are the household's agent". Judge: add "a first-person memory of the agent about the user is the user's" only if the judge misreads (validate with `judge_eval.py`, rule 6) | Judge change = re-validation |
| Datasets | person-centric ("Quando sono andato a sciare…", `dataset`…`blind7`, `dev_*`); entity `dataset_dev_entity`, `blind8`; isolation users | Person sets stay valid for **personal mode** (undeclared user = self). Missing: (1) **personal mode with declared other speakers** (family members identified in the agent's chats; facts about them; "what did Marta tell me?"), (2) **entity mode with own-marked input** (knowledge given to the robot, its perceptions), (3) attribution with confidence (voiceprint). New **dev** sets for (1) and (2) written by the developer; **fresh blind** sets (blind9 personal-agent, blind10 entity-agent) written by separate agents and re-read (4.8 procedure) | blind7 / blind8 must not be used to tune the new prompts (keep them blind) |
| `GOLD_AUDIT.md`, `RESULTS.md` | — | New section "agent memory (D50)" | — |

### M. Service tests (`service/test`)

To rewrite: `engine/entity-memory.int.spec.ts` (81, 104, 118 — mode, contacts, `PATCH /me`), `engine/name-owner.spec.ts`
(whole file — `nameOwner` goes), `engine/extraction.int.spec.ts` 152 ("writes the person's name where the model wrote
the owner"), `rawlog/ingest.int.spec.ts` 43–53, `mcp/mcp.int.spec.ts` 78, 113, 215, 245, `recall/context-ingest.int.spec.ts`
48, `conformance/client.int.spec.ts` 6, 52–69, 90–92, `auth/auth.int.spec.ts` 34–39, 66–74, `console/console.int.spec.ts`
42, and every setup passing `episodicEnabled: true`. **Stay as they are (renamed only)**: `isolation/isolation.int.spec.ts`
(memories of two accounts never cross — exactly vision #1), `engine/consolidation`, `facts-review`, `facts-pass`,
`lang/lang.spec.ts` (except `nameOwner`), `llm/*`, `telemetry`, `atlas`, `read` (shape changes only).

### N. Docs

| Doc | Places | Change |
|---|---|---|
| `DIGITAL_TWIN_VISION.md` | 3 ("owner-lived vs twin-lived never mix", 42–44), 5 / 8 consent (52, 60–62), 88, 207 ("One memory per person"), roadmap row G (241), "Future direction G" 243–270 (this vision **is** direction G, now the default), D45 bullet 284–287 ("each person's words into their own memory") | Rewrite: one memory per agent; personal mode = indirect twin; principles 3 and 8 restated (Q4, Q9) |
| `EPISODIC_MEMORY_TODO.md` | D4 177–179, D15 234–235 ("Episodes are personal only… consolidation never crosses users"), D33 425–438, D36 483–486, D45 529–531, D47 537–538, D48 540–563, D49 565–587, "Open questions" 589–591, regression checklist 604–611 | + **D50 — Agent memory** (superseding D4, D36, D48's "a person's memory is written only through a secure identity", the viewer part of D33); D49 rewritten as the agent's learned sources (own / provided by a contact) |
| `API.md` | 25, 32–60, 64–79, 91–107, 109–112, 125–151, 170–172, 185, 195–202, 211–224, 244, 255–269, 290–299, 308–316, 324–342, 362–366, 376, 387, 394–398, 404–413 | §1 identity (account, memory, contacts, participant identities, attribution), no viewer context, no consent; §2 ingest (`self`, `own`, identity method / confidence, sources); §3 tool texts and result fields; §4 Diary framing; §6 admin / console |
| `DATA_MODEL.md` | 5–11, 22, 37–58, 79–106, 116–141, 166, 192, 209–245, 261–282, 303, 316–347, 382–383 | Identity section rewritten; subject / attribution columns; new enums; read rule removed (kept as "recorded for later"); `twin_experienced` absorbed |
| `INTEGRATION.md` | 9, 16–35, 47–49, 92–94 | Account = agent; participants with identities; no consent; mode |
| `KNOBS.md` | 9–10 "per person", 60–66, 74–78, 113–115 | Per memory; `mode`; consent row removed; Arkimede "Memory type" row |
| `README.md` | 8 ("one memory per person"), 19, 29–40, 68–73, 83, 123, 172–196, 227, 240 | New positioning: memory of an agent; personal mode = twin; no consent, no viewer rule (privacy later) |
| `service/README.md` | 30, 33 | auth / rawlog lines |
| `ATLAS_EVENTS.md` | 3–9, 17, 29 | memory instead of person; `v` bump if fields renamed |
| `DEPLOYMENT.md` | 72 | console description |
| `ENGINE_IDEAS.md` | 32, 40, 62–63, 72 | "per person" → per memory; viewer rule note |
| `RESEARCH_NOTES.md` | H2 (83–124) | Mark the disclosure work deferred; H3 (owner vs twin provenance) now about self vs agent-own in personal mode (Q4) |
| `WORK_PLAN.md` | 81 (1.1 "one memory per person"), 86 (1.5), 151 (4.5), 250–272 (M6 status, 6.2, 6.3, 6.5, 6.6b(11), 6.8, 6.9), 213 (5.9), M7 criteria 306–322 | + milestone for D50 (the plan of §5 below) |
| `CLAUDE.md` | 12–13, 24, 30, 133 | Summary lines (not translated) |
| `docs/connectors/*`, connector READMEs | user mapping, consent | per connector (J) |
| `*_it.md` | every English change | same commit (owner's rule) |
| `CHANGELOG.md` / `_it` | Unreleased | breaking API changes listed |

---

## 2. What stays valid as is

- Layer 0 raw log, idempotent ingest, edits / deletes / `conversations/{id}/end`, outbox delivery and retries (client
  library), RFC 9457 errors, W3C trace context.
- Bi-temporal episodes, plan lifecycle and its code guards (D10, D37, 4.11), corrections that never rewrite, the
  near-duplicate resolver, the recall-echo guard (D38) and `assertedAfterRecall`, tombstones and forgetting (D16),
  facts as slots with value chains (D31) and the single-current trigger (already subject-aware), notes (D34).
- Per-memory isolation (every query is scoped by `owner_id`; `isolation.int.spec.ts`) — it is exactly "another account
  = another memory".
- Quality profiles (D35), the LLM / embedding ports and provider profiles (D27), embeddings and HNSW, prefix caching
  (constant system prompts), run summaries (4.12), recall log, telemetry metadata-only and Atlas (renames only).
- `resolve_period`, `lang` helpers (periods, locales, relations), `engine/time.ts`, the memory context's relevance
  floors and budget (5.7), the raw-log fallback and its `raw_log_scope`.
- The admin model of clients / keys / tokens (D33 home profile), the console as a page over the admin API.
- The person-centric eval sets as **personal-mode** sets (the questioner is the self), the judge and its validation.
- D48's code guard idea (no identity carried across conversations) — generalised, not dropped.

---

## 3. Tensions and open questions

**Q1 — The account header.** `X-Recordare-User` now names an account (agent). Rename (`X-Recordare-Account`) in every
client at once (clean code, no dual path), or keep the name and redefine it? Rename touches Arkimede, 5 connectors,
Hermes (Python), the library, the conformance suite, INTEGRATION / API. *Suggestion:* rename together with the
`owners → memories` rename (step 10), not earlier.

**Q2 — Is the account's own user "declared"?** In Arkimede, Andrea logs in to his account: the client knows his name
and id. If declared identities are attributed by name, Andrea's own words would become "Andrea …" in the third person
— the opposite of personal mode. *Suggestion:* the account's primary speaker (participant role `self`) is the self in
personal mode even when the client knows the name; "declared" applies to **other** participants. In entity mode the
account's speaker is always undeclared unless an identity is sent per turn (voiceprint, self-introduction).

**Q3 — The self's names.** Others will mention the self by name ("Andrea arriva tardi", said by Marta in Andrea's
agent). Without knowing that "Andrea" is the self, those become facts about a contact "Andrea". *Suggestion:* the
memory keeps the self's names / aliases (`person_aliases` of the memory's own row, set by the client from the account
profile); the prompt gets `SELF NAMES`; the plan-anchor stop-list (writer 313–322) uses them. What is the agent's own
name ("Caino") vs the human's ("Andrea")? Both can be aliases of the self in personal mode.

**Q4 — First person mixes the human's life and the agent's actions.** In personal mode "Ho prenotato l'Aldina" may be
the human (who booked) or the assistant (who booked on their behalf). The vision's principle 3 ("owner-lived vs
twin-lived never mix") then holds only in the data (`origin` / `author_role`), not in the text. Decide: accept (the
twin is one self), or write the assistant's own actions differently ("l'assistente ha prenotato…" / the agent's name).
Same question for entity mode: are the assistant's turns "own" by default? *Suggestion:* entity mode — yes (the agent
said / did it); personal mode — first person with `origin = agent_stated` kept and shown in the Diary.

**Q5 — Who is asking, without a viewer rule.** In personal mode, if a declared other person (Marta) talks to Andrea's
agent and asks "what did I do on Saturday?", first-person memories are Andrea's, not hers. With no viewer filtering the
answering model must know who is asking: recall results need a per-item `subject` and the conversation's declared
speaker, and tool descriptions must say "first-person memories are of the self, not of a declared other speaker".
Measure with the new personal-agent dev set.

**Q6 — The own marker's granularity.** Per message, per conversation (source `document` / `perception`), per source
(D49)? *Suggestion:* message flag + source kinds; a document sent via `ingest/sources` is own unless `providedBy` names
a contact ("Marta gave me this manual").

**Q7 — Grammar of the first person.** Italian (and es / fr / pt / de / ru / pl / uk…) agree participles and
adjectives with the self's gender ("sono andato / andata"); the agent in entity mode may have none. Options: let the
model infer from the speaker's own words; or a per-memory `selfGender` knob (KNOBS). Japanese / Chinese / Korean drop
pronouns — fine. Languages without the model's strength in first person need a check (multilingual rule 2026-10-08).
*Measure:* the dev sets in IT + EN at least; a small multilingual slice.

**Q8 — Leakage detector replacing `nameOwner`.** `nameOwner` fixed ≈ 5 % of items deterministically; first person
cannot be fixed by substitution. Expect the model to write "l'utente" / "the user" / the self's name in the third
person in some items. Detector + drop / retry, or accept. Measure the rate before deciding.

**Q9 — No consent vs the vision's principle 8 and the law.** Principle 8 ("only consenting people are modelled") and
the README's "Consent per person" become false. Recordare will hold facts about third parties (family members) without
their consent, and the responsibility moves to the client operator (the switch is the client's). The GDPR household
exemption covers personal use only; an agent for others is not household use. Not a blocker (owner's decision), but
the README / VISION must say who is responsible, and D50 should record that privacy (and legal notices) come later.

**Q10 — "Kind changes only while empty".** Keep it for `mode`: first-person items and "someone" items do not mix.
The admin keeps the override (console confirm dialog). Changing the mode of a non-empty memory = re-extraction (§4).

**Q11 — Contacts are per memory.** The same human in two agents is two unrelated contacts (isolation, vision #1).
Cross-memory linking (the old "one memory per person across platforms") is dropped; a human who wants one memory on
several platforms uses one account reached by several clients (personal tokens / several client keys bound to the
same account).

**Q12 — One memory, several clients.** Allowed (Caino via Arkimede and via Claude Code with a token)? Then
`raw_log_scope` keeps its meaning (which client's chats are quoted). If an account is strictly one client, the scope
column can go.

**Q13 — What is the account in each connector?** OpenClaw: the agent (senders → participants) — a real change of
its identity code; openai-proxy: the platform user (unchanged); Hermes: the agent profile; Claude Code / Codex: the
token's memory. Owner's call per connector.

**Q14 — Talkiosk (D45, WORK_PLAN 6.5).** Its design routes "each recognised person's words into their own memory";
under the vision a voice device is an **account** (an entity agent), recognised voices are declared identities with
a voiceprint confidence. D45 and `~/Development/talkiosk/docs/DESIGN.md` must be revised.

**Q15 — Digests' voice.** Personal: first person ("Oggi sono andato…"). Entity: the agent's day — a mix of named
people, someone and its own first-person actions; one paragraph may read oddly. Decide on the Diary samples.

**Q16 — Facts of "someone".** Today personal facts of unidentified speakers are dropped (ENTITY_RULES 166–167).
Keep (a single-value slot for "someone" is meaningless); episodes about someone stay.

**Q17 — Self-model / reflection (vision #8).** Out of scope now; reserve `origin = reflected`, notes `inferred` +
`pending`; consolidation is the natural place (vision H12). No schema work needed beyond the enum value.

---

## 4. Migration of the existing memories (Kinox)

Two memories today: **"Andrea"** (`human`, third person "Andrea ha…", facts with `subject NULL`) and **"Arkim3de"**
(`entity`, "qualcuno …", named people, facts with subjects; Andrea also appears as a participant through his global
person).

| Option | How | Pros | Cons |
|---|---|---|---|
| a. Re-extract from the raw log | Delete derived rows (episodes, facts, notes, digests, links), reset `messages.extracted_run_id`, run extraction + consolidation with the new prompts | Clean, one voice, new attribution columns filled properly; tombstones (keyed by message id / period) survive | LLM cost ≈ one extraction per window of all history; **Diary corrections are lost** unless replayed (corrections made with `correct_episode` produce new episodes, not message edits); notes / facts confirmed by hand lost |
| b. Rewrite pass | One LLM call per batch of rows: third person → first person (Andrea), subjects filled from `episode_people` / `subject_person_id`; ids, evidence, corrections and history kept | Keeps every manual decision; cheap (text only) | A new prompt to measure (small: spot check on a sample); Arkim3de needs only subject backfill, not voice change |
| c. Leave old rows | Only new rows in the new voice | Free | Mixed voices in one memory: recall and Diary read badly; not acceptable for a clean dev phase |

*Suggestion:* **b for Andrea** (rewrite + subject backfill, measured on a sample against the raw log) and **backfill
only for Arkim3de** (subjects / contacts; its "someone" and named items already match entity mode); contacts: create
"Andrea" as a contact of Arkim3de and re-point `conversation_participants.person_id` / `messages.author_person_id`
from his global person to that contact. Before anything, count windows / rows on Kinox and state the budget (rule 8).
Back up the database first (Kinox: rebuild only the changed service, `--no-deps`; never rsync `deploy/` with
`--delete`).

---

## 5. Implementation plan — small measurable branches

Order: decisions → removals (no eval) → identity data model → prompts (the measured part) → digests → migration →
sources → renames → fresh blind sets. Budget per DeepSeek direct, rule 8 (state it, check the balance first); one
service per queue (rule 9). Order of magnitude per full service run on a blind set: cents to a few tenths of a USD
(the 2026-10-05 measurement: 41 runs / 2,178 questions ≈ 6.4 USD, Mem0 alone 56 %).

| # | Branch | Content | Eval | Rough budget |
|---|---|---|---|---|
| 0 | `d50-agent-memory` (docs only) | D50 in EPISODIC_MEMORY_TODO (+ `_it`), supersede D4 / D36 / parts of D33, D45, D48; resolve Q1–Q7, Q13 with the owner; VISION direction G becomes the default | none | 0 |
| 1 | `no-consent` | §C everywhere (service, migration, console, library, connectors, Arkimede sync); tests | tests only | 0 |
| 2 | `no-viewer-rule` | §D: drop `ownerOnly`, keep a conversation resolver; tests inverted | tests only (harness uses personal tokens: numbers unchanged) | 0 |
| 3 | `memory-identity` | §A + §B + §E: memory = account (`mode` personal / entity, migration `human → personal`), contacts per memory, account vs participant identities, attribution method / confidence on participants / messages, `own` marker, `self` participant, entity undeclared author = unknown. **Prompt input kept identical** (speaker labels mapped to today's) so no number moves | tests; **1 run** blind7 + **1 run** dev_entity as a no-change check | ≈ 2 runs |
| 4 | `personal-first-person` | §F personal mode (`extract.v12`, facts prompt, subject on episodes / notes / facts in both modes, `namedInWindow` with declared participants, leak detector replacing `nameOwner`) + §H recall framing (tool texts, `memory` / `subject` in results, claims redefined) + harness answer framing (§L). New dev set **`dataset_dev_agent_personal`** (declared family members in the agent's chats) | Iterate: dev sets 1 run each, slices (`--only`): `dataset` (24 q), `dev_news` (4), `dev_poison` (10), `dev_echo` (9), `dev_context` (15), new dev set (~15). Confirm: **blind7 × 3** (bar 91.7 %) | ≈ 6–10 dev runs + 3 blind runs |
| 5 | `entity-agent` | §F entity mode (own-marked input first person, someone, subjects everywhere) + new dev set **`dataset_dev_entity_own`** (knowledge given to the robot, perceptions) | `dev_entity` + new dev set, 1 run each while iterating; confirm **blind8 × 3** (bar 82.1 %) | ≈ 4–6 dev runs + 3 blind runs |
| 6 | `agent-digests` | §G digest prompts (first person / agent diary), input includes identified persons, facts review with subjects | `consolidation.int.spec.ts`; one consolidation run on the dev sets, read the Diary; no blind runs (digests off in recall) | ≈ 1 run |
| 7 | `arkimede-agent` (Arkimede + library + connectors) | §J: account directory, participant identities for other Arkimede users, mode in Settings, connectors' account choice (Q13), conformance suite | conformance + connector smoke tests | 0 |
| 8 | `migrate-kinox` | §4: count, back up, rewrite pass for Andrea (sample-checked), subject / contact backfill for Arkim3de | spot check of a sample of rewritten rows against the raw log | rewrite calls only (state after counting) |
| 9 | `learned-sources` | D49 as the agent's sources: `ingest/sources`, passages + embeddings, own / provided-by, episode ↔ source links, `search_knowledge`, context passage | new dev set; then one blind run on a source-aware slice | ≈ 3–4 runs |
| 10 | `rename-memories` | mechanical: `owners → memories`, `owner_id → memory_id`, `ownerId → memoryId`, `owner_token`, header (Q1), Atlas contract `v` bump | tests only | 0 |
| 11 | `blind-agent-sets` | fresh blind9 (personal agent with declared speakers) and blind10 (entity agent with own input), written by separate agents and re-read (4.8 procedure) | **3 runs each** for the reported numbers (README / RESULTS) | 6 runs |
| — | later | Reflection (vision #8), privacy / disclosure (vision #4 later), stronger identification | — | — |

Why this order: 1–2 are pure removals that unblock the clients and cannot move a quality number; 3 changes the data
model without changing the prompt input, so a single-run check is enough to prove it is behaviour-neutral; 4 and 5
are the only steps that touch prompts and carry the full rule (dev sets + 3 blind runs); 6 depends on 4–5's voice;
the Kinox migration waits until the voice is final; renames come last so the measured branches stay small.

Total measured budget (steps 3–6, 9, 11): roughly 25–35 service runs, of which 12 blind — comparable to the M4b
round. Every step leaves `main` working (owner's rule: never break existing behaviour; additive where possible,
clean code over dual paths).
