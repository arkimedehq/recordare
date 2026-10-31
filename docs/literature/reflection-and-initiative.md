# Reflection, self-model, procedures and initiative — what Recordare has, what others do, how the human mind does it

Research for WORK_PLAN 8.12 / D53 (2026-11-01), three surveys: the repository, agent systems and products, cognitive
science. Italian: [reflection-and-initiative_it.md](reflection-and-initiative_it.md). Sources marked *(unverified)* were
seen only as an abstract or a secondary source; the 2026 benchmarks are all in that state. Paraphrased throughout.

## 1. What Recordare already has

- **Recurring patterns** (`service/src/engine/patterns.service.ts`, `patterns.v2`, D26): the nightly pass writes habits
  seen in ≥ 3 episodes on 3 days as the memory's own `inferred` notes, never pending; the code decides (support, no
  restating, no reviving a retired one without new episodes); public, first-hand episodes only. Stored with
  `origin = holder_lived` — wrong for something concluded (D53 moves it to `reflected`).
- **Diaries** in the agent's voice (`digest.day.v2` / `digest.month.v2`): a chronicle that adds nothing, not reflection.
- **Self and contact cards** (`recall/cards.ts`, no LLM): the only self-model today.
- **Clarifications** ("which Marco?", `engine/clarifications.ts`): the only initiative, passive — asked when a turn
  touches the topic.
- **Plans** with outcome (`plan_status`; past open plans `unresolved`): the open loops nobody raises unprompted.
- **Hooks without behaviour**: conversation source `perception`, attribution methods `face` / `voiceprint`.
- **Designed, not built**: H12 resting-state thinking (`RESEARCH_NOTES.md`), the gaps of
  [human-memory-and-agent-architectures.md](human-memory-and-agent-architectures.md) §3.3 (procedure notes, evidence-bound
  reflection, self-model, the agent's own prospective memory, a perceptual layer, lifetime periods), standing intents
  ([agent-platform-memory.md](agent-platform-memory.md) idea 8), typed intention stores
  ([pis-typed-intention-stores.md](pis-typed-intention-stores.md)), initiative levels L1 / L2 and research mode
  (`DIGITAL_TWIN_VISION.md`).

## 2. What others do

**Reflection**
- Generative Agents (Park et al., 2023, arXiv:2304.03442): when the importance of recent memories sums past a threshold,
  the agent asks itself a few questions, retrieves evidence and writes insights that cite it; insights are memories,
  so a tree grows. Known failure: embellishment.
- Reflexion (Shinn et al., 2023, arXiv:2303.11366): a short verbal lesson after a failure, kept for the next attempt;
  needs a reliable success signal.
- Think-in-Memory (Liu et al., 2023, arXiv:2311.08719): store the conclusions reached, not the turns.
- Reflective Memory Management (Tan et al., ACL 2025, arXiv:2503.08026): summaries at several granularities plus
  retrieval tuned by what the model actually cited; > 10 % on LongMemEval.
- A-MEM (Xu et al., 2025, arXiv:2502.12110): a new note rewrites the context of linked old ones — drift risk.
- Letta sleep-time agents (Lin et al., 2025, arXiv:2504.13171): a background agent rewrites shared memory blocks every
  few steps, anticipating questions.
- Inner Thoughts (Liu et al., CHI 2025, arXiv:2501.00383): a parallel stream of thoughts, each scored for whether it is
  worth saying now — where reflection becomes initiative.

**Self-model**
- LLM self-assessment is poorly calibrated: models approve their own errors (MetaLoop, MIRROR, 2026 *(unverified)*);
  introspection is limited (Anthropic, 2025). Products keep the self as editable text (Letta persona block, Hermes
  `MEMORY.md`). Lesson: build it from observed outcomes.

**Procedures**
- Voyager (Wang et al., 2023, arXiv:2305.16291): code skills kept only after a critic confirms success.
- ExpeL (Zhao et al., AAAI 2024, arXiv:2308.10144): insights from successes vs failures, kept by ADD / EDIT / UPVOTE /
  DOWNVOTE, removed at zero — a template for any list the agent writes about itself.
- CLIN (Majumder et al., 2023, arXiv:2310.10134): causal abstractions with hedged confidence.
- Agent Workflow Memory (Wang et al., 2024, arXiv:2409.07429), ReasoningBank (Google, ICLR 2026, arXiv:2509.25140):
  reusable workflows and lessons from successes and failures, judged by an LLM.
- LangMem: procedural memory as rewriting the system prompt from scored conversations.

**Intents and initiative**
- Proactive Agent / ProactiveBench (Lu et al., 2024, arXiv:2410.12361): predict whether and what to propose from an event
  stream; the best fine-tuned model ≈ 66 % F1 — even trained models misfire often. 2026 benchmarks (ProAgentBench,
  PARE-Bench, ChronosBench, ProEvent *(unverified)*) score timing apart from content.
- BDI with LLMs (ChatBDI, AAMAS 2025; arXiv:2512.09458): intentions persist until a cue triggers reconsideration.
- Products: ChatGPT Pulse (2025: nightly research, morning cards that expire, feedback) was folded into user-configured
  Scheduled Tasks in 2026 *(date and reasons unverified)*; Gemini's personal context was called pushy; OpenClaw
  heartbeat: a periodic turn from a checklist — empty checklist, no model call; "nothing" is dropped; active hours.
  Companion apps: proactive messages felt intrusive (ComPeer, arXiv:2407.18064) and goodbyes met with manipulative
  replies (HBS working paper, 2025) — initiative for engagement, not for the person.

**Risks seen**: confabulated insights; memory raising sycophancy (Jain et al., arXiv:2509.12517: user profiles raised
agreement sycophancy most, up to +45 %; PersistBench, arXiv:2602.01146 *(abstract)*); self-narratives compounding;
intrusive initiative; inferred traits more sensitive than stated facts; background loops costing when nothing changed.

## 3. How the human mind does it

- **Metacognition** (Nelson & Narens 1990; Koriat 1993; Fleming 2024, doi:10.1146/annurev-psych-022423-032425): a
  meta-level monitors (feeling of knowing, confidence) and controls (search more, stop, ask); confidence is an estimate
  apart from performance and must be calibrated; feeling of knowing is cue-based and can be fooled by familiarity.
- **Reflection vs rumination** (Trapnell & Campbell 1999; Watkins 2008, doi:10.1037/0033-2909.134.2.163): repetitive
  thought helps when concrete and process-focused ("how did it happen, what next"), harms when abstract and evaluative
  on unresolved material.
- **Offline consolidation** (Diekelmann & Born 2010, doi:10.1038/nrn2762; Stickgold & Walker 2013, doi:10.1038/nn.3303):
  replay moves gist into long-term knowledge and integrates it with schemas; related memories replayed together yield
  shared structure — and false memories (Lewis & Durrant 2011). Selective consolidation of what will matter is weaker
  than claimed; tagging while awake decides what sleep processes.
- **Spontaneous thought** (Christoff et al. 2016, doi:10.1038/nrn.2016.113; Andrews-Hanna et al. 2014): resting thought
  is mostly about the future, the self and others; incubation helps a little, more on open problems (Sio & Ormerod 2009).
- **The self** (Conway & Pleydell-Pearce 2000, doi:10.1037/0033-295X.107.2.261; Conway 2005): memories are built from
  lifetime periods, general events and event-specific knowledge; a working self (current goals) steers recall; coherence
  pushes toward confabulation, correspondence must be enforced. Trait self-knowledge is kept as summaries apart from
  episodes (Klein *(details unverified)*); the self as a predictive model revised by errors (Seth 2013).
- **Procedures** (Fitts & Posner 1967; Anderson 1982; Soar chunking 1986): declarative steps used repeatedly compile into
  condition → action rules; habits are context → response, insensitive to outcome value (Dickinson 1985; Daw et al.
  2005); errors made with confidence and then corrected are learned best (Metcalfe 2017).
- **Intentions** (McDaniel & Einstein 2000; Gollwitzer 1999, Gollwitzer & Sheeran 2006): "if X, then Y" plans hand
  control to a cue; event cues beat time cues. The Zeigarnik effect does not hold in general, the Ovsiankina effect
  (resuming interrupted tasks) does (Ghibellini & Meier 2025, doi:10.1057/s41599-025-05000-w); making a plan quiets an
  unfinished goal (Masicampo & Baumeister 2011). Goals as feedback loops: a stalled goal is the signal (Carver &
  Scheier 1982). Intentions are commitments reconsidered only on a cue (Bratman 1987).
- **Curiosity and motivation** (Loewenstein 1994; Gottlieb & Oudeyer 2018, doi:10.1038/s41583-018-0078-0; Ryan & Deci
  2000): curiosity comes from a small, closable information gap; controlling prompts undermine motivation.
- **Speaking up** (Horvitz 1999; Iqbal & Bailey 2007; Brown & Levinson 1987): interrupt only when expected value beats the
  cost, at a breakpoint; give the reason and an easy way to decline; when in doubt, defer.
- **Forgetting as a feature** (Anderson & Schooler 1991; Richards & Frankland 2017; Anderson & Hulbert 2021): availability
  follows the odds of need; in an agent, forgetting means lower priority, erasure stays a separate act.

## 4. From mechanism to Recordare

| Human mechanism | Recordare mechanism | Trigger | Output |
|---|---|---|---|
| Concrete reflection, not rumination | Thought pass with a novelty gate | New public episodes with enough importance | Thoughts (insight / question / opinion) citing episodes, or nothing |
| Overlapping replay → schemas | Patterns from clusters of episodes (built) | Nightly, ≥ 3 episodes on 3 days | Habits as `reflected` notes |
| Reappraisal | Supersede with provenance | A contradicting episode | A new version; the old one in history |
| Insight / incubation | Free pass linking open problems and new material (full profile) | Idle, open problems, new input | Tentative thoughts, never facts |
| Working self | Current goals and roles weighting recall | A goal formed or closed | Relevance |
| Semantic self-knowledge | Self-model from outcomes | Corrections, errors pointed out | Hedged self notes with evidence |
| Hypercorrection | Weight corrections of confident errors | A correction | A strong rule, calibration |
| Knowledge compilation | Procedures "when X, I do it this way" | Repeated success, a resolved impasse | Recalled by situation |
| Implementation intentions | Intents as cue → action rows, matched at ingest | A matching person / topic / event / time | An initiative candidate |
| Ovsiankina, plan relief | Open loop offered once, muted when planned | A stalled plan, a passed deadline | One resumption offer, then back-off |
| Information gap | Gap detector (plan without outcome, conflicting facts) | Nightly | One question at a breakpoint |
| Mixed-initiative, politeness | Gate: value × confidence − interruption cost | A candidate and a breakpoint | A pushed message with its reason, or deferral |
| Rational forgetting | Ranking by recency × use; superseded lose priority | Time, no use | Recall order |

## 5. Where the analogy misleads

Rumination loops (re-running reflection on the same material finds ever more meaning); coherence-driven confabulation
(every inferred item needs its evidence and a lower prior than what was said); schema false memories (minimum support,
counter-examples); narrative identity is the person's, not the agent's to impose; an offline pass does not "know" what
matters — tag at ingest; no nagging (Zeigarnik does not hold); a habit is not a preference; forgetting is priority, not
erasure; familiarity is not knowledge (calibrate); the agent lacks social intuition about when to speak — a wrong
interruption costs more than a missed one.

## 6. What Recordare takes (D53)

Thoughts with evidence, confidence, a support counter and a novelty gate, at most one level deep, origin `reflected`;
a self-model from outcomes; intents as cue → action rows with BDI reconsideration; initiative scored and **pushed** to
the client, with feedback, back-off, rate limits and quiet hours; procedures only with an outcome signal; costly passes
behind quality profiles; evaluation by evidence support, initiative precision and false alarms, and a sycophancy check.
Avoided: rewriting old notes in place, unbounded reflection trees, personality traits stored as facts, opinions that
mirror the person, engagement nudges, self-claims without outcomes, procedures without a success signal, fixed-interval
loops that call a model when nothing changed.
