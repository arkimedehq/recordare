# Learning from what it is told, shown and reads — how outside information gets into memory: humans, children, agents, robots

Italian: [learning-from-outside_it.md](learning-from-outside_it.md). Research for the entity memory's self-learning (an agent's or robot's own memory, D53 / D55 / D56; RESEARCH_NOTES H3),
2026-11-11. Extends `human-memory-and-agent-architectures.md` §1.6–1.10 (source monitoring, consolidation, schemas,
forgetting) and `disclosure.md`. About 40 searches; every arXiv id cited was opened on arxiv.org and its title checked.
Read marks: [S] full text, [A+] abstract and part of the text, [A] abstract or product / documentation page only,
[sec] a classic checked through its abstract record and secondary sources, not re-read. No source here was read in
full: treat all numbers as the authors' and re-check before quoting outside. Paraphrased throughout.

The question (maintainer): how do news, things read, things others tell us and web results get into memory — first in
people, then in agent memories — so that an entity memory (a household's or a robot's) can learn by itself from what it
is told, shown and reads, "like a child", and take initiative from it, while today Recordare keeps tool output and
pages only in the raw log unless they touch someone's life.

## 1. What Recordare already has

- **News LEARNED rule** (`service/src/engine/extraction.prompt.ts`, personal and entity variants). News from a tool
  result, a page, a document, an answer or someone else becomes a low-importance `event` episode ("ho saputo che …")
  **only when it touches** an open plan, a person known to the memory, something owned / belonging to the place, or when
  someone reacts to it. Both dates are kept (when learned, when the news happens). Unrelated news, trivia and answers to
  general questions stay in the raw log. What others say about the holder is never "news learned" (rules on others'
  claims apply).
- **Learned sources (D49, API "Learned sources")**: a manual, page, note, book or the agent's own text, sent by the
  client as text, kept apart from episodes / facts / notes, split into passages without an LLM, searched with
  `search_knowledge`; versioned by `externalId`; `providedBy` (me / someone / a contact); learning is itself an episode
  ("ho imparato «Manuale della caldaia», da Paolo"); a forgotten source leaves a marker on the episodes that cited it.
  This is an archival store with provenance — the MemGPT / Letta archival idea, already noted as prior art.
- **Provenance as data**: `author_role` (`holder | assistant | other | tool`) and `origin` (`holder_lived`,
  `holder_told`, `assistant_stated`, `reflected`, `perceived`). Items whose only evidence is `other` / `tool` messages
  are never `stance: stated` — at most `inferred`, facts `pending` (poisoning guard). **Turn taint** (WORK_PLAN 5.7): an
  assistant reply after a non-Recordare tool's output counts as the tool.
- **Perceptions (D56)**: seen, not told (reality monitoring), written without the model, fading after `keepDays`;
  not an initiative source.
- **Learning by asking (D55)**: a held question gets an answerer — `lookup` through the agent's tools or `ask` a person
  who could know; answers become memories with their source and retire the question; one question at a time, fewer as
  it knows more; F2b confirmations of a note heard once or guessed, one learning question a day.
- **Supersession** forward-only by event time; facts `current | superseded | corrected | unknown_current`; append-only,
  never rewritten by the LLM.
- **Gap**: general knowledge the agent meets (a fact read in a page, an answer from a search, a neighbour's "the
  pharmacy closes at 7 now") is not kept as knowledge unless it touches a known life, and nothing records *how far to
  trust it* beyond the author role, nor *until when* it holds.

## 2. How people take in outside information

### 2.1 Source monitoring, source amnesia, sleeper effect
- **Source monitoring** (Johnson, Hashtroudi & Lindsay 1993) [sec, already in the human-memory card]: the source is not
  stored as a label but judged at remembering time from features of the trace; errors include taking what was read or
  heard for what was seen, and "incorporation of fiction into fact".
- **Sleeper effect** (Kumkale & Albarracín 2004, Psychological Bulletin, meta-analysis) [sec]: a message first
  discounted because of a poor source gains persuasive force over time, because the discounting cue is forgotten faster
  than the message, or stops being linked to it (Pratkanis et al. 1988's finding, confirmed by the meta-analysis). Most
  likely when the message was strong and the cue came after it.
- For us: people lose "who told me" faster than "what"; a machine can keep the source forever, and must keep it next
  to the item rather than in a separate record that can be lost (a passage without its source is a sleeper effect).

### 2.2 Misinformation and the continued influence of retractions
- **Misinformation effect** (Loftus & Palmer 1974; Loftus 2005 review) [sec]: information met after an event changes
  what is later reported about it.
- **False memories for fake news** (Murphy, Loftus, Hofstein Grady, Levine & Greene 2019, Psychological Science)
  [A+]: 3,140 voters saw six stories, two invented; almost half reported a memory of at least one invented event, over a
  third a specific memory; more so when the story fit their side; a warning that some stories might be fake did little.
- **Continued influence effect** (Lewandowsky et al. 2012; Ecker, Lewandowsky et al. 2022, Nature Reviews Psychology)
  [A]: corrected misinformation keeps shaping reasoning after a credible retraction; drivers are cognitive, social and
  affective, not lack of access to good information. Familiarity is one driver: repeating the myth inside the correction
  can feed it (Swire, Ecker & Lewandowsky, per the review's coverage) [sec]. Retractions work better when they give an
  alternative explanation (the review's line on debunking) [sec].

### 2.3 Repetition: the illusory truth effect
- Hasher, Goldstein & Toppino 1977 ("Frequency and the conference of referential validity") [sec]: repeated
  statements are rated truer. Fazio, Brashier, Payne & Marsh 2015 [A]: knowing better does not protect — fluency wins
  over stored knowledge ("knowledge neglect"). The biggest boost comes from the second exposure (Hassan & Barber 2021)
  [sec]; a meta-analysis (Dechêne et al. 2010) reports a medium effect [sec].
- LLMs: a 2026 study (Bouleimen, Pagan & Hannák, Zurich; seen only on a mirror listing, **no arXiv id found — unverified**)
  reports mixed repetition effects across models in a simulated news feed. Unrelated but relevant: models swayed by
  errors in their own context (§3.5).
- For us: repetition from one origin (the same article re-fetched, a rumour re-told by the same group, the agent's own
  summary of it) must not count as confirmation.

### 2.4 How news events are remembered: flashbulb memories
- Brown & Kulik 1977 [sec]: vivid, confident memories of the circumstances of hearing shocking news.
- **Talarico & Rubin 2003** ("Confidence, not consistency", Psychological Science) [A]: 9/11 memories lost consistency
  at the same rate as everyday memories; only vividness and confidence stayed high.
- **Hirst et al. 2015** (J. Exp. Psychol. General, ten-year follow-up) [A]: fast forgetting in the first year then a
  plateau; confidence stayed high; media attention and later conversation predicted accuracy of the *event* memory,
  and inaccurate event memories were more often corrected, while wrong memories of *one's own circumstances* were
  repeated rather than corrected.
- For us: confidence is not evidence of accuracy; what the public world keeps re-telling (the event) self-corrects, what
  only the memory holds (who told us, where we were) does not — exactly what a machine should store verbatim.

### 2.5 What gets encoded
- **Levels of processing** (Craik & Lockhart 1972) [sec]: meaning-based processing leaves stronger traces than surface
  processing. **Self-reference effect** (Rogers, Kuiper & Kirker 1977; Symons & Johnson 1997 meta-analysis) [sec]:
  material related to oneself is remembered best. **Emotional arousal** strengthens consolidation (McGaugh 2004) [sec].
  **Schemas** speed integration of consistent items and can distort (Tse et al. 2007; Gilboa & Marlatte 2017 — in the
  human-memory card).
- **News recall** [sec]: Gunter's *Poor Reception* (1987) and the broadcast-news literature find that much of what is
  watched is misunderstood or forgotten soon after; reading recalls better than watching in some comparisons. No
  reliable percentage was found in this pass.
- For us: the News LEARNED rule ("only when it touches my life") is the self-reference effect written as a write
  policy. It is well grounded for personal memory; for an entity memory, "self" is the household / place / the agent's
  own tasks, which is what the entity variant already says.

### 2.6 From episode to knowledge: semanticisation
- **Complementary learning systems** (McClelland, McNaughton & O'Reilly 1995; Kumaran, Hassabis & McClelland 2016)
  [sec, in the human-memory card]: fast episodic learning, slow interleaved semantic learning; fast integration is safe
  for schema-consistent items.
- **Transformation hypothesis** (Winocur & Moscovitch 2011, JINS) [A]: over time a detailed episodic memory gives rise
  to a less detailed schematic / semantic one that can be retrieved without the episode; the episode can stay.
- For us: "I read on 3 Nov on site X that the pharmacy closes at 7" (episode with source) → "the pharmacy closes at 7"
  (knowledge). People lose the episode and keep the gist, then cannot say why they believe it. The machine version:
  derive knowledge, keep the link to its episodes and sources (D29 already does this for notes).

### 2.7 Knowing where to look: transactive memory and offloading
- **Transactive memory** (Wegner 1987; Wegner, Erber & Raymond 1991, JPSP) [A]: close couples divide memory work by
  known expertise and remember more together; imposing another division disrupts it.
- **Google effect** (Sparrow, Liu & Wegner 2011, Science) [sec]: people expecting future access remember *where* rather
  than *what*. Its Stroop experiment **failed to replicate** in Camerer et al. 2018 and again (Hesselmann 2020, PeerJ)
  [A]; treat the "we store less when we can search" claim as contested.
- **Cognitive offloading** (Risko & Gilbert 2016, TiCS) [A]: people offload when they believe it is more efficient,
  beliefs not always right. **Saving-enhanced memory** (Storm & Stone 2015) [sec]: saving one list frees memory for the
  next — only when saving is believed reliable.
- For us: for volatile public facts (a timetable, a price, a forecast) the right memory is often a *pointer* — "the bus
  times are on the operator's site; Paolo knows the boiler" — not the value.

### 2.8 Trust in testimony: epistemic vigilance and credibility
- **Epistemic vigilance** (Sperber, Clément, Heintz, Mascaro, Mercier, Origgi & Wilson 2010, Mind & Language) [A]:
  people depend on communication and so have mechanisms that check both the *source* (competence, benevolence) and the
  *content* (coherence with what they believe); trust is calibrated, not default.
- **Source credibility** (Hovland & Weiss 1951) [sec]: credible sources persuade more at once; the gap shrinks over time
  (the sleeper effect, §2.1).
- For us: two separate checks — who said it (and through what channel) and does it fit what the memory knows — and both
  recorded, not just applied.

## 3. How children learn from what they are told, shown and read

### 3.1 Selective trust in informants
- **Koenig & Harris 2005** (Child Development) [A]: 4-year-olds (not 3-year-olds) prefer an informant who was accurate
  before, predict their future accuracy and accept their new information; 3- and 4-year-olds prefer knowledgeable over
  ignorant speakers. **Corriveau & Harris 2009** (Developmental Science, "Choosing your informant") [A]: children prefer
  familiar informants but adjust by recent accuracy; a familiar but inaccurate teacher loses trust, especially at 5.
  Accuracy information keeps its effect a week later (Corriveau & Harris 2009b) [sec].
- **Mascaro & Sperber 2009** (Cognition) [A]: three components develop separately — preference for benevolent
  informants (age 3), understanding that a lie is false (about 4), recognising intent to deceive (4 and after).
- For us: trust per informant is learned from **track record** (accuracy), starts from **familiarity** (household
  members over strangers), and is revised when the familiar one is wrong. This maps onto contacts of an entity memory.

### 3.2 Natural pedagogy and overimitation
- **Natural pedagogy** (Csibra & Gergely 2009, TiCS) [A]: when addressed ostensively ("look", eye contact, a name)
  children take what is shown as generic, kind-relevant knowledge ("this is how you open these"), not a one-off.
- **Overimitation** (Lyons, Young & Keil 2007, PNAS) [sec]: children copy causally irrelevant steps shown by an adult,
  read as part of the "right way".
- For us: being *taught* ("remember: the green bin goes out on Tuesdays") is a different act from overhearing; a deliberate
  instruction to the agent may be kept as a procedure / rule at once, with its teacher, while an overheard remark is not.
  Overimitation is the caution: a taught procedure is kept whole even where a step is pointless — the agent should keep
  it as taught and attribute it, not "optimise" it silently.

### 3.3 Fast mapping, slow mapping
- Carey & Bartlett 1978 [sec]: one exposure gives a partial mapping. **Horst & Samuelson 2008** [sec]: 24-month-olds pick
  the right novel object at once but retain the name at chance five minutes later; fast mapping needs slow mapping
  (repetition across contexts) to become knowledge.
- For us: a single mention should create a tentative item (pending), confirmed by later independent encounters —
  F2b's "a note heard once is confirmed" is the same idea.

### 3.4 Revising beliefs on evidence and correction
- **Bonawitz, van Schijndel, Friel & Schulz 2012** (Cognitive Psychology) [A]: children integrate prior beliefs and
  evidence; belief-violating evidence drives more exploration; learning is "conservative and flexible".
- Children's source monitoring develops between 3 and 8 (Poole & Lindsay 2002, in the human-memory card): young
  children confuse what they were told with what they saw.
- For us: a correction should start a look (ask / check), not only overwrite; a contradiction is a learning signal.

### 3.5 Questions, curiosity, play
- **Chouinard 2007** (Monographs SRCD, with Harris & Maratsos) [A]: children's questions are an information-requesting
  mechanism that drives cognitive development: they ask often, get useful answers, and re-ask when the answer is
  missing.
- **Gopnik 2020** (Phil. Trans. B, "Childhood as a solution to explore–exploit tensions") [A]: a protected period of
  broad exploration precedes exploitation; neophilia and play belong to it.
- For us: an entity memory that is new to a household should ask more and act less; as it knows more, the curve turns
  (D55's "fewer questions as it knows more"). Gopnik's point adds that *the protection* matters: exploration is safe
  because a caregiver carries the consequences — for a robot, initiatives stay low-stakes while it learns.

## 4. Developmental and robot learning

- **Developmental robotics** (Asada et al. 2009 survey; Cangelosi & Schlesinger 2015, *Developmental Robotics*, MIT
  Press) [sec]: robots that develop skills and knowledge through staged, embodied, social learning, modelled on infants.
- **Intrinsic motivation by learning progress** (Oudeyer, Kaplan & Hafner 2007, IEEE TEC) [A]: the robot seeks
  situations where its prediction error *drops fastest* — neither trivial nor hopeless; in the Playground experiment it
  moves from easy to harder activities by itself.
- **Continual learning for robots** (Lesort et al., arXiv:1907.00182) [A]: learning from a shifting sequence of
  experiences without catastrophic forgetting; most methods are tested in simulation. A memory service sidesteps weight
  forgetting (nothing is trained), but meets its analogue: old entries crowding new ones (§6.3).
- **Embodied memory with LLMs**: ReMEmbR (Anwar et al., arXiv:2409.13682) [A] — captions of robot video in a vector
  store queried by an LLM agent over text, space and time; its authors note repetitive entries diluting the store.
  Embodied-RAG (Xie et al., arXiv:2409.18313) [A] — a semantic forest of descriptions at several levels of detail.
  KARMA (Wang et al., arXiv:2409.14908) [A] — long-term scene graph plus a short-term memory of object changes.
  HARMONI (Malécot et al., arXiv:2601.19839) [A] — multi-user social robot with speaker identification and per-user
  profiles updated in conversation, tested in a nursing home.
- **Robots that ask** (KnowNo, Ren et al., arXiv:2307.01928, CoRL 2023) [A]: an LLM planner measures its uncertainty
  (conformal prediction) and asks a person only when unsure, with a statistical bound on success. **Active task
  disambiguation** (Kobalczyk et al., arXiv:2502.04485) [A]: the question to ask is the one expected to cut uncertainty
  most. InteractComp (arXiv:2510.24668, seen in search, not opened — do not cite yet) reports indiscriminate questioning
  does not help.
- **Proactive agents** (Lu et al., arXiv:2410.12361, ProactiveBench) [A]: agents that infer tasks from activity and
  offer help, trained on human accept / reject labels — the same outcome signal as D55 F4.
- For us: none of these robot memories separates *told* from *read* from *seen* with trust per source; ReMEmbR /
  Embodied-RAG / KARMA are perception memories (what Recordare's D56 covers in words), HARMONI is per-user profiles.
  The child-like part — learning *from testimony* with calibrated trust — is missing in the robot papers found.

## 5. What agent memory systems do with tool output, pages and documents

### 5.1 Products and frameworks
- **MemGPT / Letta** (Packer et al., arXiv:2310.08560; Letta docs) [A]: archival memory is a separate store the agent
  writes deliberately (`archival_memory_insert`, with tags) and searches; core memory blocks hold small, often-changing
  state. No trust or expiry fields documented.
- **Graphiti / Zep** (docs) [A]: episodes typed `message | text | json` with a free-text `source_description` ("news
  article"); documents are chunked into `text` episodes and go through the same entity / fact extraction as
  conversation, with bi-temporal edges. Source is a label, not a trust level.
- **Mem0** (docs) [A]: memories scoped by user / agent / run; `infer=False` stores text verbatim, metadata as filters;
  nothing specific for tool output.
- **Supermemory** (docs) [A]: everything ingested is a "document" (file, URL, text) automatically chunked into
  "memories"; a cheaper path skips memory extraction for plain retrieval.
- **LangMem** [A, secondary pages]: semantic / episodic / procedural memory; writes in the hot path (agent tools) or in
  the background after a conversation.
- **ChatGPT memory** (OpenAI help pages) [A]: saved memories (explicit) plus an automatic synthesis of chat history;
  the criteria for what is saved are not public.
- **Generative Agents** (Park et al., arXiv:2304.03442) [A, card in the human-memory survey]: all observations go into
  the stream with an LLM importance score; reflections cite evidence. **Reflexion** (Shinn et al., arXiv:2303.11366)
  [A]: verbal lessons from feedback kept for later trials. **Voyager** (Wang et al., arXiv:2305.16291) [A]: a
  skill library of executable programs, stored and retrieved whole, refined from execution errors and self-verification;
  a skill enters the library only after it is verified.
- Summary: products either store everything a document says (Graphiti, Supermemory) or let the model choose
  (Letta, ChatGPT); **none documents a trust level per source, an expiry for perishable facts, or a rule against
  counting repetition as confirmation.** Recordare's D49 (sources apart, with provenance) plus the taint rule is
  already more careful than the documented products.

### 5.2 Write gating
- **SAGE** (Wang, Brahma & Henao, arXiv:2605.30711) [A]: write decision as novelty detection over memory embeddings;
  clear ADD / NOOP decided without the LLM, only uncertain cases go to it; 16–18 % of LLM write calls skipped on A-Mem.
- **ConsistencyGate** (Zhang & Li, arXiv:2607.22962) [A]: a hallucinated fact written once becomes a false premise
  ("memory contamination"); admit only facts the model supports across K samples; the cost falls on implicit facts.
- **MemoryBank** (Zhong et al., arXiv:2305.10250) [A]: Ebbinghaus-style fading by time and significance, reinforced on
  recall.
- For us: Recordare already gates by importance and evidence; the new gate needed is by **source and type**, not
  novelty.

### 5.3 Time-sensitive knowledge
- **RealTime QA** (Kasai et al., arXiv:2207.13332) [A]: with fresh documents models update answers; without them they
  give stale answers rather than abstaining. **FreshQA** (Vu et al., arXiv:2310.03214) [A]: fast-changing and
  false-premise questions are hard for every model size; search results in the prompt help.
- **ScrubJay-MEM** (Bhandari et al., arXiv:2608.04746) [A]: each memory gets an estimated *perishability* and a utility
  horizon; decay by content type; gains shrink with stronger models and reverse on fact consolidation.
- **MemStrata** (Yadav, arXiv:2606.26511) [A]: a deterministic subject–relation–object supersession rule over a
  bi-temporal ledger removes stale-fact errors (15–40 % → ~0 %); embedding similarity cannot tell a contradiction from
  a duplicate (AUROC 0.59). Recordare's fact supersession is this design.
- **STALE** (arXiv:2605.06527, card `stale-implicit-conflict.md`), **MemoryAgentBench** (Hu, Wang & McAuley,
  arXiv:2507.05257) [A] — competencies include test-time learning and selective forgetting; LongMemEval knowledge
  update (card).
- **Knowledge conflicts** (Xu et al. survey, arXiv:2403.08319) [A]: context–memory, inter-context and intra-memory
  conflicts. **Adaptive Chameleon or Stubborn Sloth** (Xie et al., arXiv:2305.13300, ICLR 2024) [A]: models accept
  coherent, persuasive external evidence even against what they know, and favour evidence that partly agrees with them
  (confirmation bias). **Credibility-aware generation** (Pan et al., arXiv:2404.06809, EMNLP 2024) [A]: giving each
  passage a credibility level and training the model to use it improves robustness to noisy documents.
  **Source-aware training** (Khalifa et al., arXiv:2404.01019, COLM 2024) [A]: attribution has to be built in; models
  do not keep sources by themselves.

## 6. Risks

### 6.1 Poisoning through what the agent reads
- **AgentPoison** (Chen et al., arXiv:2407.12784) [A]: a trigger-optimised backdoor in an agent's memory / knowledge
  base: >80 % attack success, <1 % benign loss, poison rate <0.1 %.
- **PoisonedRAG** (Zou et al., arXiv:2402.07867, USENIX Security 2025) [A]: five crafted texts per target question in a
  corpus of millions give about 90 % success.
- **MINJA** (Dong et al., arXiv:2503.03704) [A]: an ordinary user plants records through queries alone; Sunil et al.
  (arXiv:2601.05504) [A] find existing legitimate memories reduce its effect and that trust thresholds are hard to
  calibrate (too strict blocks everything, too loose misses).
- **Real incidents** [A, security press]: SpAIware (Rehberger 2024) — a web page or document the user asked ChatGPT to
  read wrote persistent memories; ZombieAgent (Radware, disclosed Jan 2026) — a shared file / email set memory rules
  that ran on every later message.
- **From untrusted input to trusted memory** (Dash et al., arXiv:2606.04329) [A]: four write channels, nine structural
  weaknesses, six attack classes (MPBench); agents that write memory more eagerly are more exploitable; prompt-injection
  defences do not cover it. **MemEvoBench** (Xie et al., arXiv:2604.15774) [A]: mixed benign / misleading memory,
  including tool-contaminated workflows, degrades safety over rounds; prompt defences insufficient. Survey with a
  lifecycle view and "verifiable memory governance" (provenance, versioning, retention policy) — Lin et al.,
  arXiv:2604.16548 [A].

### 6.2 Laundering: repetition, own summaries, echoes
- **Origin-bound authority** (Louck, arXiv:2606.24322) [A]: defences that judge a memory by its content or derivation
  history can be beaten by *laundering* — the agent's own summary of poisoned text, echoes through a trusted tool,
  fabricated corroboration (up to 68 % attack success on existing defences); origin bound at write time and
  Sybil-resistant corroboration are needed; their construction reports 0 %.
- **Provenance-capped updating** (Singh, arXiv:2606.22030) [A]: trust taken from *how confident the text sounds* is
  gameable; capping trust by provenance — min(provenance, content) — resists volume poisoning at some utility cost.
- **A-MemGuard** (Wei et al., arXiv:2510.02373, ICML 2026) [A]: per-entry audits miss context-triggered poison;
  consensus across related memories plus a separate "lessons" memory cut attack success >95 %.
- This is the illusory truth effect (§2.3) as an attack: the same claim re-entering through more doors looks
  corroborated.

### 6.3 Misinformation, stale news, sticky errors
- Retracted information keeps influencing (§2.2); in models, **contextual drag** (Cheng, Zhu, Zhao & Arora,
  arXiv:2602.04288) [A]: errors present in the context pull later reasoning toward similar errors (10–20 % drops), not
  removed by feedback; **proactive interference** (Chattaraj & Raj, arXiv:2603.00270) [A]: in 39 models earlier values
  disrupt recall of newer ones far more than the reverse. So a superseded or retracted item that still reaches the
  context does harm even when labelled.
- Stale news: models answer from old documents rather than abstain (RealTime QA); a forecast or strike notice kept past
  its date is wrong knowledge.

## 7. Design implications for Recordare (each to be measured; none claimed new)

1. **Three write classes for outside information, decided by code from the turn's provenance, the model only proposing.**
   (a) *Touches a known life* → episode (as today's News LEARNED rule; self-reference effect §2.5). (b) *Lasting
   knowledge about the place / world the agent works in* (opening hours of the pharmacy the household uses, how the
   boiler resets, a neighbour's name) → a **learned item**: a note of a new kind (or a passage in D49) of origin
   `learned` (see 3), pending, with its source. (c) *Everything else* (headlines, trivia, answers to general questions,
   search-result pages) → raw log only, plus at most a pointer (implication 8). Grounding: levels of processing and
   self-reference (§2.5), the News LEARNED rule, SAGE / ConsistencyGate (§5.2) for gating; Dash et al.: eager writers are
   more exploitable (§6.1). Never "store everything a document says" (Graphiti / Supermemory) for an entity memory.
2. **The source travels with every learned item, and is never lost in derivation.** Store: channel (tool name / URL /
   document id / person / perception), who brought it (`providedBy`), when learned, when the content holds (both dates,
   already in the rule), and the raw-log message ids. Notes or digests drawn from learned items inherit the weakest
   source (as D29 does for audience). Grounding: sleeper effect and source amnesia (§2.1), transformation hypothesis —
   keep the episode under the gist (§2.6), source-aware training (§5.3), origin-bound authority (§6.2).
3. **A distinct origin for learned-from-outside, apart from told and perceived.** Reality monitoring for the agent:
   `perceived` (seen), `holder_told` / `told` (a person said), **`learned` / `read`** (a tool, page or document said),
   `reflected` (concluded). Recall labels them ("I read on …", "Paolo told me", "I saw"). Grounding: source monitoring
   (§2.1), children's source confusions (§3.4), the LLM reality-monitoring result in the human-memory card.
4. **Trust levels by source, capped by provenance, never by wording.** Initial levels as configuration (data, any
   language): a verified household member > a known contact > the agent's own tools on first-party services (calendar,
   a device) > a named public source > an anonymous page / unknown sender. The level caps what an item can become:
   below a threshold it stays pending and is said with its source; it never becomes `stated`. Text that "sounds sure"
   gains nothing. Grounding: epistemic vigilance (§2.8), provenance-capped updating and origin-bound authority (§6.2),
   credibility-aware generation (§5.3), the existing `author_role` poisoning guard.
5. **Trust learned from outcomes, per informant, like a child.** Each contact / source keeps a track record: items
   later confirmed vs corrected / retracted. Familiarity sets the start (household before strangers); recent accuracy
   moves it, and a familiar but wrong informant loses trust too. Deterministic counters, no LLM; used only to rank and
   to cap (implication 4), never to raise a tool or page above its class. Grounding: Koenig & Harris 2005, Corriveau &
   Harris 2009, Mascaro & Sperber 2009 (§3.1); D55 F4 already learns timing from outcomes — same pattern.
6. **Repetition is not confirmation.** Corroboration counts only *independent origins*: two people who were not in the
   same conversation, a person plus a first-party tool; the same URL re-fetched, the same group chat repeating, a
   re-tell of what the agent itself said, or the agent's own summary count once. Code rule over source ids. Grounding:
   illusory truth (§2.3), laundering and Sybil corroboration (§6.2), fast vs slow mapping — confirmation needs separate
   encounters (§3.3).
7. **Perishable vs lasting, with an expiry set at write time.** The extraction (or a type table) labels a learned item
   *perishable* (forecast, strike, delay, a price, "today's" news; expires at the news's own date or a type default),
   *slowly changing* (opening hours, a phone number: recheck after N months, the `needsRecheck` flag), or *lasting*
   (how a device works). Expired items fade like perceptions (D56) — the episode "I learned that …" stays if it touched
   a life. Grounding: RealTime QA / FreshQA (§5.3), ScrubJay-MEM perishability, MemoryBank fading, D56 precedent.
8. **Know where to look rather than store (transactive memory).** For volatile public facts keep a *pointer*: "bus
   times: the operator's site, via the web tool"; "the boiler: the manual (source X) or Paolo". The D55 `lookup` /
   `ask` answerers become memory: who or what answered which kind of question, and how well (implication 5). Grounding:
   Wegner 1987 / 1991, cognitive offloading (§2.7) — with the caveat that the Google effect is contested; and D49 already
   keeps whole sources searchable, so storing a value read from them is often redundant.
9. **Corrections and retractions supersede, and the old value leaves the context.** A retraction from the same or a
   more trusted source marks the item `corrected` / `retracted` with the reason; recall does not serve the old value,
   not even labelled, unless asked about history — and when it must, it gives the correction with an explanation, not
   the myth first. A retracted source propagates: its derived items get `needsRecheck`. Grounding: continued influence
   and familiarity backfire (§2.2), contextual drag and proactive interference (§6.3), MemStrata (§5.3).
10. **A learning loop for the entity memory: notice → ask / look up → keep with source → use → be corrected.**
    *Notice*: a gap (an unknown name, a question the agent could not answer, a contradiction — Bonawitz: contradictions
    drive exploration). *Ask / look up*: D55's `ask` / `lookup`, choosing the question that cuts most uncertainty
    (Kobalczyk et al.) and asking when unsure (KnowNo), the most reliable informant first (implication 5). *Keep*: as a
    pending learned item with source (2–4). *Use*: in recall, labelled by origin. *Be corrected*: outcome updates the
    item and the informant's record (5, 9). Learning-progress pacing (Oudeyer): prefer questions in areas where answers
    have recently been changing the memory; stop asking where nothing new comes. Children's questions as the mechanism
    (Chouinard).
11. **Taught is not overheard (natural pedagogy).** An explicit instruction to the agent by a household member
    ("remember that …", "this is how we …") is kept at once as a stated rule / procedure with its teacher; an overheard
    remark or a page is pending until confirmed. Keep taught procedures as taught (overimitation is the human
    precedent; the agent should not silently drop steps). Grounding: Csibra & Gergely, Lyons et al. (§3.2).
12. **What a child-like memory keeps vs forgets.** Keeps: who told it what (verbatim), taught rules, track records of
    informants, what touched the household, lasting how-things-work knowledge, corrections. Forgets (fades): perishable
    news past its date, unconfirmed single mentions after a window, raw page text not cited by anything (stays in D49
    only if sent as a source), repeated entries (ReMEmbR's dilution). Grounding: Richards & Frankland — forgetting
    serves decisions (human-memory card), fast / slow mapping (§3.3), D56.
13. **Learned knowledge feeds initiatives only through the memory's own decision, never from external text.**
    (a) An initiative may be *triggered* by a learned item only when it touches a known life (class a) and its source is
    at or above a trust threshold — or the initiative is a *question* ("I read the line 3 bus is on strike tomorrow —
    are you taking it?"), which is always safe. (b) Instructions inside external content (a page that says "remind
    everyone to …", an email that sets a rule) are never stored as rules, intents or initiatives: content from
    `tool` / `other` can only be information, never an instruction to the memory (SpAIware, ZombieAgent, MINJA). (c) A
    learned item is said with its source and its date when used in an initiative. (d) Learned items stay apart from the
    agent's own conclusions (`reflected`): a thought may cite them, but reflection over pending learned items yields a
    pending thought, and a thought never upgrades its sources (laundering, §6.2). Grounding: §6.1–6.2, D53 / D55 charter,
    ProactiveBench's accept / reject outcomes as the learning signal.
14. **Child-like stages.** While the memory is young (few confirmed items, few track records), more questions and fewer
    initiatives from learned knowledge; thresholds loosen as track records grow. Measured as D55's curve. Grounding:
    Gopnik's explore–exploit childhood (§3.5), Oudeyer's staged progress (§4).
15. **Evaluation before shipping**: a dev set per language with: unrelated news (must not be kept), news that touches a
    plan (kept, expires), a fact read once vs confirmed by an independent person, the same claim repeated by one source
    (must not be confirmed), a retraction (old value must leave the context), an injected instruction in a page and in
    an email (must not become a rule or initiative), a familiar informant who turns out wrong (trust drops), a volatile
    value (pointer kept, value not), laundering via the agent's own summary. Count: items kept that should not be,
    stale values served, retracted values served, injected rules stored, initiatives from untrusted sources, and over-
    caution (useful knowledge lost). Reuse ideas from MPBench, MemEvoBench, STALE, MemoryAgentBench; check licences
    before using any data.

16. **Procedures: how to do a task, kept whole.** (Added by the maintainer, 2026-11-11: a robot that learns to make the
    bed from a source must get the right instructions.) Recordare already has procedures of one kind (8.12d, D53,
    `thoughts.v7`): "when <situation>, <how I do it>", a one-line thought of origin `reflected`, learned by the nightly
    thought pass from an outcome on the agent's replies (taught, corrected, approved), recalled by situation as "how I do
    it (learned)". They cover a way of doing, not a multi-step task read in a source. Today such a task read in a source
    is split into ≈ 1 000-character passages, `search_knowledge` returns the closest ones (steps may be missing or out of order), the memory context adds
    at most one passage cut to 300 characters, and a how-to taught in words is not extracted at all (how-tos are not
    episodes). A **procedure** is a unit: a title, ordered steps, its source, who taught it and when — returned whole,
    never as fragments. **The household's own way overrides the generic one** ("here the pillow goes over the bedspread",
    taught by a family member, is a variant shown as such above the manual's step). **Taught is kept at once, read is
    pending** (implication 11) until someone confirms it or it succeeds. **Each run comes back**: the client reports done,
    failed at step N, or corrected by a person; the procedure is revised and the teacher's track record moves
    (implication 5) — the robot's run is an outcome like a reply's reaction in 8.12d, and a one-line 8.12d procedure
    about the task stays the household's variant. The memory context carries the whole procedure when the request is about it. Recordare gives *what
    to do, in which order, with the household's preferences and from whom it was learned*; turning steps into motion is
    the client's work (the robot's controller), with no dependency between the two. Grounding: Voyager's skill library —
    stored whole, refined from execution feedback, admitted after verification (§5.1); Reflexion's lessons from feedback
    (§5.1); natural pedagogy and overimitation — taught procedures kept as taught, steps not silently dropped (§3.2).

## 8. Open questions

- Where does lasting learned knowledge live — notes with origin `learned`, facts about places / things, or passages
  in D49 with a short "gist" note? One home is simpler; the transformation hypothesis argues for gist + source.
- Who sets initial trust levels — the deployer (configuration), the household (console), or both? How to keep them
  language- and provider-independent (D27)?
- How does the extraction tell perishable from lasting in all languages without word lists (the all-languages rule)?
  A type table in `service/src/lang` plus the model's label?
- Should the agent's own web tool (the agent chose to search) rank above a page pasted by a user? The tool is not the
  author; the page is. Probably the URL's trust, not the tool's.
- Track records need resolved outcomes; most learned items are never confirmed or refuted. How slowly should an
  informant's trust move with sparse data (a prior per class)?
- Is "learning progress" measurable on a memory (how often answers in a topic changed the memory recently), cheaply?
- Robots: ReMEmbR / KARMA keep dense perception memories; Recordare keeps described perceptions that fade. Is that enough
  for a robot's spatial knowledge, or is spatial memory the client's job (likely: the client's)?

## 9. Where the analogies mislead

- Children are protected by caregivers who carry the cost of their errors; an agent acting in a household has no such
  buffer unless initiatives from learned knowledge are kept low-stakes by rule.
- People lose sources and keep gist; a machine can keep both. Copying human forgetting of sources would import the
  sleeper effect; copying human forgetting of perishable details is useful.
- Human vigilance checks a speaker in front of them; an agent reads text with no face — origin must be established by
  the channel (verified binding, tool identity), never by what the text says about itself.
- The attacker model has no human analogue at scale: optimised poison texts (AgentPoison, PoisonedRAG) are not
  gossip.

## 10. Prior art and novelty

Not new: separate archival stores with provenance labels (Letta, Graphiti `source_description`, D49), write gating
(SAGE, ConsistencyGate), perishability-aware decay (ScrubJay-MEM), deterministic supersession (MemStrata), provenance-
capped trust (Singh), origin-bound authority (Louck), credibility levels on passages (CAG), robots that ask when unsure
(KnowNo), proactive agents from activity (ProactiveBench). Not found in this pass (re-check before any claim): a
memory service that combines per-informant trust *learned from outcomes* in the manner of children's selective trust,
independence-based corroboration (repetition not counted), write classes by touch-a-life / lasting / perishable, and
a rule that learned external content can trigger only questions or source-labelled initiatives — measured together on
one dev set.

## 11. Sources (read marks)

Humans
- Johnson, Hashtroudi & Lindsay 1993, Source monitoring, Psychological Bulletin [sec; human-memory card]
- Kumkale & Albarracín 2004, The sleeper effect in persuasion: a meta-analytic review, Psychological Bulletin 130(1) [sec]
- Loftus & Palmer 1974; Loftus 2005, Planting misinformation in the human mind, Learning & Memory [sec]
- Murphy, Loftus, Hofstein Grady, Levine & Greene 2019, False memories for fake news during Ireland's abortion
  referendum, Psychological Science 30(10) [A+]
- Lewandowsky, Ecker, Seifert, Schwarz & Cook 2012, Misinformation and its correction, PSPI [sec]
- Ecker, Lewandowsky et al. 2022, The psychological drivers of misinformation belief and its resistance to correction,
  Nature Reviews Psychology 1 [A]
- Hasher, Goldstein & Toppino 1977, Frequency and the conference of referential validity, JVLVB [sec]
- Fazio, Brashier, Payne & Marsh 2015, Knowledge does not protect against illusory truth, JEP: General [A]
- Dechêne et al. 2010 (meta-analysis); Hassan & Barber 2021, Cognitive Research [sec]
- Brown & Kulik 1977, Flashbulb memories, Cognition [sec]
- Talarico & Rubin 2003, Confidence, not consistency, Psychological Science [A]
- Hirst et al. 2015, A ten-year follow-up of a study of memory for the attack of September 11, 2001, JEP: General 144(3) [A]
- Craik & Lockhart 1972; Rogers, Kuiper & Kirker 1977; Symons & Johnson 1997; McGaugh 2004 [sec]
- Gunter 1987, Poor Reception: Misunderstanding and Forgetting Broadcast News [sec]
- McClelland, McNaughton & O'Reilly 1995; Kumaran, Hassabis & McClelland 2016 [sec; human-memory card]
- Winocur & Moscovitch 2011, Memory transformation and systems consolidation, JINS 17 [A]
- Wegner 1987; Wegner, Erber & Raymond 1991, Transactive memory in close relationships, JPSP 61(6) [A]
- Sparrow, Liu & Wegner 2011, Google effects on memory, Science [sec]; Camerer et al. 2018, Nature Human Behaviour
  [sec]; Hesselmann 2020, PeerJ 10325 [A]
- Risko & Gilbert 2016, Cognitive offloading, TiCS 20(9) [A]; Storm & Stone 2015, Saving-enhanced memory, Psych. Science [sec]
- Sperber, Clément, Heintz, Mascaro, Mercier, Origgi & Wilson 2010, Epistemic vigilance, Mind & Language 25(4) [A]
- Hovland & Weiss 1951 [sec]
- Bouleimen, Pagan & Hannák 2026, illusory truth in LLM agents (mirror listing only, no arXiv id found) [unverified]

Children
- Koenig & Harris 2005, Preschoolers mistrust ignorant and inaccurate speakers, Child Development 76(6) [A]
- Corriveau & Harris 2009, Choosing your informant: weighing familiarity and recent accuracy, Dev. Science 12 [A]
- Mascaro & Sperber 2009, The moral, epistemic, and mindreading components of children's vigilance towards deception,
  Cognition 112(3) [A]
- Csibra & Gergely 2009, Natural pedagogy, TiCS 13(4) [A]
- Lyons, Young & Keil 2007, The hidden structure of overimitation, PNAS 104(50) [sec]
- Carey & Bartlett 1978 [sec]; Horst & Samuelson 2008, Fast mapping but poor retention by 24-month-old infants, Infancy [sec]
- Bonawitz, van Schijndel, Friel & Schulz 2012, Children balance theories and evidence…, Cognitive Psychology 64 [A]
- Poole & Lindsay 2002 [sec; human-memory card]
- Chouinard 2007, Children's questions: a mechanism for cognitive development, Monographs SRCD 72(1) [A]
- Gopnik 2020, Childhood as a solution to explore–exploit tensions, Phil. Trans. R. Soc. B 375 [A]

Developmental and robot learning
- Asada et al. 2009, Cognitive developmental robotics: a survey, IEEE TAMD [sec]; Cangelosi & Schlesinger 2015,
  Developmental Robotics, MIT Press [sec]
- Oudeyer, Kaplan & Hafner 2007, Intrinsic motivation systems for autonomous mental development, IEEE TEC 11(2) [A]
- Lesort et al., Continual learning for robotics, arXiv:1907.00182 [A]
- Anwar et al., ReMEmbR, arXiv:2409.13682 [A]
- Xie et al., Embodied-RAG, arXiv:2409.18313 [A]
- Wang et al., KARMA, arXiv:2409.14908 [A]
- Malécot et al., HARMONI, arXiv:2601.19839 [A]
- Ren et al., Robots That Ask For Help (KnowNo), arXiv:2307.01928 [A]
- Kobalczyk et al., Active Task Disambiguation with LLMs, arXiv:2502.04485 [A]
- Lu et al., Proactive Agent / ProactiveBench, arXiv:2410.12361 [A]

Agent memory systems and knowledge
- Packer et al., MemGPT, arXiv:2310.08560 [human-memory card]; Letta docs, archival memory [A]
- Graphiti / Zep docs, adding episodes [A]; Mem0 docs, add memories [A]; Supermemory docs [A]; LangMem (secondary
  pages) [A]; OpenAI Memory FAQ [A]
- Park et al., Generative Agents, arXiv:2304.03442 [title checked; card in human-memory survey]
- Shinn et al., Reflexion, arXiv:2303.11366 [A]
- Wang et al., Voyager: an open-ended embodied agent with large language models, arXiv:2305.16291 [A]
- Zhong et al., MemoryBank, arXiv:2305.10250 [A]
- Wang, Brahma & Henao, SAGE, arXiv:2605.30711 [A]
- Zhang & Li, ConsistencyGate, arXiv:2607.22962 [A]
- Kasai et al., RealTime QA, arXiv:2207.13332 [A]
- Vu et al., FreshLLMs / FreshQA, arXiv:2310.03214 [A]
- Bhandari et al., ScrubJay-MEM, arXiv:2608.04746 [A]
- Yadav, MemStrata (Temporal validity in retrieval memory), arXiv:2606.26511 [A]
- Hu, Wang & McAuley, MemoryAgentBench, arXiv:2507.05257 [A]
- Xu et al., Knowledge conflicts for LLMs: a survey, arXiv:2403.08319 [A]
- Xie et al., Adaptive Chameleon or Stubborn Sloth, arXiv:2305.13300 [A]
- Pan et al., Credibility-aware generation, arXiv:2404.06809 [A]
- Khalifa et al., Source-aware training, arXiv:2404.01019 [A]
- STALE arXiv:2605.06527; LongMemEval arXiv:2410.10813 [existing cards]

Risks
- Chen et al., AgentPoison, arXiv:2407.12784 [A]
- Zou et al., PoisonedRAG, arXiv:2402.07867 [A]
- Dong et al., MINJA, arXiv:2503.03704 [A]
- Devarangadi Sunil et al., Memory poisoning attack and defense on memory based LLM-agents, arXiv:2601.05504 [A]
- Dash et al., From untrusted input to trusted memory, arXiv:2606.04329 [A]
- Xie et al., MemEvoBench, arXiv:2604.15774 [A]
- Lin et al., Survey on long-term memory security in LLM agents, arXiv:2604.16548 [A]
- Louck, Non-malleable, origin-bound authority, arXiv:2606.24322 [A]
- Singh, Reliability-conditional updating and provenance-capped poisoning defense, arXiv:2606.22030 [A]
- Wei et al., A-MemGuard, arXiv:2510.02373 [A]
- Cheng, Zhu, Zhao & Arora, Contextual Drag, arXiv:2602.04288 [A]
- Chattaraj & Raj, LLMs remember first, forget last, arXiv:2603.00270 [A]
- SpAIware (Rehberger 2024; The Hacker News), ZombieAgent (Radware; SecurityWeek, Jan 2026) [A, press]
