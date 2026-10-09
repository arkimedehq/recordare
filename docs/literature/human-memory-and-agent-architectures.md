# Human memory and cognitive architectures for agents — mapped onto "a brain for any machine" (survey, 2026-10-09)

Read (2026-10-09): **abstracts** of every human-memory source, through PubMed (efetch by DOI) or the publisher record;
metadata of every DOI checked on Crossref and of every arXiv id on arxiv.org. **Full text** (ar5iv HTML) of Generative
Agents, CoALA, MemGPT and Voyager; full PDF of Laird 2022 (Soar); the "memory subjects" section of Huang et al. 2026;
Turing 1950 section 7 through the publisher page. These claims rest on **secondary sources** (encyclopaedia / review
pages found by web search) because the primary text was not reachable: Tulving 1972 (definitions, page range), Tulving
1985 (the anoetic / noetic / autonoetic triad), the detailed boxes of Squire's taxonomy, the three levels of Conway's
autobiographical knowledge base, McDaniel & Einstein 2000, Conway 2005, Johnson & Raye 1981, the ACT-R base-level
equation, Nuxoll & Laird 2012. Bartlett 1932 is cited as the classic origin of "schema" and was not re-read. Builds on
the "Cognitive model" table of `../EPISODIC_MEMORY_TODO.md`, on `agent-platform-memory.md` (Letta, Honcho, OpenClaw)
and on H3 / H12 in `../RESEARCH_NOTES.md`.

## 0. The vision this card is mapped onto (owner, 2026-10-09)

A memory belongs to **the agent itself**: "Caino" (one account of a client platform) has one memory, "Abele" (another
account) another, isolated. Everything that comes in enriches it: conversations, voice, documents, photos, audio,
video, later a robot's cameras and sensors. The agent tells kinds of memory apart (episodes, facts, knowledge,
notes…) and always knows **who said what and whose it is** (declared identity, voiceprint, other methods). Two modes
per memory:
- **personal**: whatever comes without a declared identity is the agent's own, in the first person, so the agent
  becomes an indirect digital twin of the person who talks to it;
- **entity**: whatever comes without a declared identity belongs to "someone", unless it is marked as the agent's own
  (knowledge it is given, or what a robot perceives while working on its own).

The agent develops like a child: it acquires data, recognises people and things, consolidates at night, and later has
thoughts of its own. Goal: anyone can give a machine a brain.

None of this is new as an aspiration. Turing (1950, §7) already proposed: "Instead of trying to produce a programme to
simulate the adult mind, why not rather try to produce one which simulates the child's?", and developmental robotics
has been a field for over twenty years (Lungarella et al. 2003). What follows asks which parts of human memory and of
existing agent architectures the vision needs, and what Recordare already has.

## 1. Human memory — what the literature says

### 1.1 Episodic vs semantic, and the "self" in episodic memory
- **Tulving (1972)** split long-term declarative memory into *episodic* memory (personal events and their temporal and
  spatial relations) and *semantic* memory (organised knowledge of words, concepts, rules), as "two parallel and
  partially overlapping" systems (secondary sources).
- **Tulving (1985)** paired three memory systems with three kinds of awareness: procedural with *anoetic*
  (non-knowing), semantic with *noetic* (knowing), episodic with **autonoetic** (self-knowing: re-experiencing "here and
  now something that happened before"). **Tulving (2002)**, Annual Review abstract: the concept was first defined by
  materials and tasks and "subsequently refined and elaborated in terms of ideas such as self, subjective time, and
  autonoetic consciousness".
- For us: an episode is not only "what / when / where" but **whose experience it was**. The vision's first-person mode
  is exactly a claim about autonoesis: the agent remembers an event *as its own*.

### 1.2 Declarative vs non-declarative (Squire)
- **Squire (2004)**: from about 1980 evidence converged on a distinction between memory "accessible to conscious
  recollection" and memory that is not, and then on "multiple separate systems" (hippocampus and related structures,
  amygdala, neostriatum, cerebellum). The usual taxonomy (secondary sources): *declarative* = facts (semantic) + events
  (episodic); *non-declarative* = procedural skills and habits, priming and perceptual learning, simple classical
  conditioning, non-associative learning. **Squire & Zola (1996)** list non-declarative learning tasks: classification
  learning, perceptuo-motor skill, artificial grammar, prototype abstraction.
- For us: everything Recordare stores today is declarative. Non-declarative memory in an LLM agent lives in the model
  weights and in the host's code (CoALA, §2.1), which a memory service does not own.

### 1.3 Working memory
- **Baddeley & Hitch (1974)** proposed a multi-component working memory; **Baddeley (2000)** added the **episodic
  buffer**: limited-capacity temporary storage "in a multimodal code" that binds information from the subsystems *and
  from long-term memory* into "a unitary episodic representation". **Cowan (2001)**: the central capacity limit averages
  "about four chunks".
- For us: the agent's working memory is the client's context window. What Recordare injects before a turn (the memory
  context) plays the episodic buffer's role: long-term content bound into the current scene. Capacity limits argue for
  a small, selected injection, which matches our own measurements (digests in recall −1.9 pt, `agent-platform-memory.md`).

### 1.4 Prospective memory
- **Einstein & McDaniel (1990)** built the laboratory paradigm (perform an action when a target event occurs) and found
  no reliable relation between prospective and retrospective memory performance: "some basic differences" between the
  two. **McDaniel & Einstein (2000)**, the *multiprocess framework* (abstract via secondary sources): intentions are
  retrieved either by strategic **monitoring** of the environment or by **spontaneous, cue-driven** retrieval; which
  one dominates depends on task, cue and person.
- **Schacter, Addis & Buckner (2007)**: imagining the future uses much of the same neural machinery as remembering the
  past ("the prospective brain").
- For us: prospective memory is its own system, not a flavour of episodes. Recordare's plans with a lifecycle are
  prospective memory *of the owner*. The two retrieval routes map onto two mechanisms already discussed: time-based
  intents → a scheduler ("monitoring"), event-conditioned intents → a cue match at pre-turn recall ("spontaneous
  retrieval"; OpenClaw standing intents, `agent-platform-memory.md` idea 8).

### 1.5 Autobiographical memory and the self (Conway)
- **Conway & Pleydell-Pearce (2000)**: autobiographical memories are "transitory mental constructions" within a
  **self-memory system** made of an autobiographical knowledge base and the **current goals of the working self**;
  control processes shape the retrieval cues; the knowledge base "grounds" the goals and the goals modulate access.
  The knowledge base is organised in three levels (secondary sources): **lifetime periods**, **general events**,
  **event-specific knowledge**.
- **Conway (2005)** (secondary sources): memory construction balances **coherence** with the self against
  **correspondence** with what was actually experienced.
- For us: two lessons. (a) A hierarchy above single episodes (period → general event → episode) is how people
  navigate a life; our digests (day, month) are a chronological approximation, not lifetime periods ("when I lived in
  Milan", "the house renovation"). (b) Memory in humans is biased toward coherence with the self; Recordare's
  append-only, evidence-bound design deliberately favours correspondence. A self-model that steers recall must not
  rewrite what was lived.

### 1.6 Source monitoring and reality monitoring
- **Johnson & Raye (1981)**, *reality monitoring*: how people discriminate memories of externally derived (perceived)
  experiences from internally generated ones (imagined, thought) (secondary sources).
- **Johnson, Hashtroudi & Lindsay (1993)**, PubMed abstract: source monitoring is a **judgment made at remembering
  time**, "based on qualities of experience resulting from combinations of perceptual and reflective processes", with
  "attributions varying in deliberateness"; judgments "evaluate information according to flexible criteria and are
  subject to error and disruption". Phenomena covered include misattributed familiarity, **cryptomnesia** (taking
  someone else's idea for one's own), "incorporation of fiction into fact", and disruptions from confabulation,
  amnesia and ageing.
- Development: **Poole & Lindsay (2002)**, a source-monitoring training reduced 7–8-year-olds' false reports of events
  they had only heard described, but did not help younger children: a "transition between 3 and 8 years of age in the strategic use
  of source-monitoring information".
- LLMs: **Ranjan, Sokratous & Odegaard (2026)** test reality monitoring in six LLMs: attribution of self-generated vs
  user content depends on how conversational memory is structured; with episodic delay the advantage reverses, and in
  some models internal and external judgments swap. Their opening line is our D38 problem stated generally: "A
  conversational AI that cannot tell its own output from what a user said will treat its own mistakes as
  user-provided facts."
- For us: this is the most important human system for the vision ("always knows who said what"). Humans **do not
  store a source label**: they reconstruct the source from features of the trace, and they get it wrong, more so when
  young. A machine can do better by storing the source as data at write time, with **how** it was established and how
  sure it is. H3 already names this field (Johnson et al. 1993 cited there).

### 1.7 Systems consolidation, sleep and replay
- **McClelland, McNaughton & O'Reilly (1995)**, *complementary learning systems* (CLS): the hippocampus learns new
  items rapidly; the neocortex learns slowly, and only gradual **interleaved** learning lets it discover structure
  across experiences without disrupting what it knows; reinstatement of hippocampal memories interleaves new items
  with old ones. **Kumaran, Hassabis & McClelland (2016)** update CLS: replay allows "goal-dependent weighting of
  experience statistics"; neocortical learning "can be rapid for information that is consistent with known
  structure"; explicit relevance to artificial agents. **McClelland (2013)** shows by simulation that
  schema-consistent information can be learned fast without interference, while fast learning of inconsistent
  information causes catastrophic interference.
- Replay and sleep: **Wilson & McNaughton (1994)**: hippocampal place cells that fired together during behaviour fire
  together again in subsequent slow-wave sleep. **Diekelmann & Born (2010)**: slow-wave sleep supports system
  consolidation (re-activation and redistribution of hippocampus-dependent memories to neocortex); REM supports
  synaptic consolidation.
- Not settled: **Nadel & Moscovitch (1997)** (multiple trace theory) argue the hippocampal complex stays involved in
  autobiographical episodic memories "for as long as they exist", against the standard model in which consolidated
  memories become hippocampus-independent.
- For us: Recordare's "extract at idle, consolidate at night" is a CLS-shaped design (already cited in
  `../EPISODIC_MEMORY_TODO.md` via HEMA / Active Dreaming). One difference matters: our extraction writes facts and notes
  **directly** (fast) rather than by slow interleaving. CLS says that is safe for schema-consistent items (a new value
  of an existing slot) and risky for inconsistent ones, which is what our supersession verdicts and `pending` inferred
  items already guard. Multiple trace theory supports keeping the episode (and the raw log) as the permanent anchor of
  semantic items, as we do.

### 1.8 Reconsolidation
- **Nader, Schafe & LeDoux (2000)**: consolidated fear memories, when reactivated, "return to a labile state" that
  needs new protein synthesis to be stored again. **Loftus & Palmer (1974)** (classic, title verified, not re-read):
  wording of a question after the event changes what witnesses later report.
- For us: Recordare deliberately does **not** copy this (`../EPISODIC_MEMORY_TODO.md`, cognitive model table). Updates
  are appended (`corrects`, `supersedes`); recall never rewrites. The literature supports this choice for a memory
  that must also be evidence.

### 1.9 Schemas
- **Bartlett (1932)** introduced schemas into memory research (classic, not re-read). **Tse et al. (2007)**: with a
  pre-existing associative schema, new paired associates learned in **one trial** were assimilated and "rapidly
  hippocampal-independent". **Gilboa & Marlatte (2017)**: schemas "enhance or distort" memory from encoding onwards, and
  accelerate neocortical integration.
- For us: our fact-slot schema (keys with cardinality and merge policy, Memobase idea) and note categories are
  schemas in this sense: an item that fits a known slot is integrated at once. Gilboa & Marlatte's "or distort" is
  the warning: a schema can bend an item to fit (e.g. forcing a one-off into a "habit").

### 1.10 Forgetting
- **Anderson & Schooler (1991)** (secondary sources): the probability that a memory will be needed follows the
  recency and frequency of past use in the environment; ACT-R's base-level activation `B_i = ln(Σ t_j^−d)` (d usually
  0.5) encodes this. **Anderson, Bjork & Bjork (1994)**: retrieving some items causes forgetting of related unretrieved
  ones (retrieval-induced forgetting). **Wixted (2004)**: everyday forgetting is mainly interference from later mental
  activity with not-yet-consolidated memories. **Richards & Frankland (2017)**: transience is useful: it reduces the
  weight of outdated information and prevents overfitting to specific events; "the goal of memory is to optimize
  decision-making".
- For us: forgetting in humans serves **decision-making**, not storage limits. Recordare keeps everything and forgets
  only in ranking (recency, access) and by the owner's choice; that gets the decision-making benefit without losing the
  record, as long as outdated values are labelled (value chains, status). Retrieval-induced forgetting has a machine
  analogue to watch: items recalled often push similar ones down (use signals for ranking only, never for truth,
  `agent-platform-memory.md` idea 7).

### 1.11 Development: infantile amnesia, recognising people, the self
- **Infantile amnesia.** **Howe & Courage (1993)**: earlier theories "falter"; the offset of infantile amnesia is tied
  to the emergence of a **cognitive sense of self** that lets event memories be personalised. **Nelson & Fivush
  (2004)**: autobiographical memory emerges gradually across the preschool years from basic memory, language and
  narrative, adults' memory talk, temporal understanding and understanding of self and others. **Josselyn & Frankland
  (2012)**: animals show it too, so it is not only a human, language-based phenomenon; they propose high hippocampal
  neurogenesis as a cause. **Bauer (2015)**: a complementary-processes account: early, gradual development of the
  ability to form and retrieve personal memories **plus** accelerated forgetting in childhood.
- **Faces and voices.** **DeCasper & Fifer (1980)**: newborns work (by sucking patterns) to hear their mother's voice
  rather than another woman's. **Johnson, Dziurawiec, Ellis & Morton (1991)**: newborns in their first hour track
  face-like patterns further than scrambled ones; the preference declines in the second month. **Pascalis, de Haan &
  Nelson (2002)**: 6-month-olds tell apart individual human *and* monkey faces, 9-month-olds and adults only human
  ones: **perceptual narrowing** with experience.
- **The self.** **Rochat (2003)**: five levels of self-awareness unfold from birth to about 4–5 years.
- For us: (a) a person-like memory needs a **self** and a **cast of people** before episodes become organised personal
  history; (b) recognition starts from a few strong priors and is tuned by exposure to the familiar people around;
  (c) children are poor at source monitoring until about 7–8 (1.6). A "child" agent therefore should be cautious about
  attribution early on, and, unlike a child, can **re-read its early life** once it knows its people, because the raw
  log is kept.

## 2. Cognitive architectures for agents

### 2.1 CoALA (Sumers, Yao, Narasimhan & Griffiths, 2023; TMLR)
- A language agent has **working memory** ("a data structure that persists across LLM calls": perceptual inputs,
  active knowledge, goals) and three long-term memories: **episodic** ("experience from earlier decision cycles"),
  **semantic** ("knowledge about the world and itself"), **procedural** (two forms: implicit in LLM weights, explicit
  in the agent's code). Internal actions: **retrieval** (long-term → working memory), **reasoning** (working → working),
  **learning** (writing to long-term memory: episodic experience, semantic knowledge, LLM parameters, agent code).
- Notes taken from the text: procedural memory "must be initialized by the designer"; updating the agent's own code is
  "risky both for the agent's functionality and alignment"; "modifying and deleting (a case of 'unlearning') are
  understudied". Perception in physical environments is turned into text "via pre-trained captioning models".
- For us: CoALA is the closest map of the vision ("the agent distinguishes kinds of memory"). Recordare covers
  episodic and semantic long-term memory as a service; working memory and procedural memory belong to the host agent.

### 2.2 Generative Agents (Park et al., UIST 2023)
- **Memory stream**: "a comprehensive list of the agent's experiences" in natural language. **Retrieval** score =
  α·recency + α·importance + α·relevance, each min-max normalised, all α = 1 in their implementation; recency is an
  exponential decay (factor 0.995 per game hour) since the memory was **last retrieved**; importance is an LLM rating
  1–10 ("mundane" to "poignant") given at creation; relevance is embedding cosine.
- **Reflection**: triggered when the summed importance of recent events exceeds 150 (about two or three times a game
  day); the LLM reads the 100 most recent records, asks "3 most salient high-level questions", retrieves for each, and
  writes "5 high-level insights" **citing the records used as evidence**; reflections are stored in the stream with
  pointers and can build on other reflections (a reflection tree). Plans are fed back into the stream.
- Failure noted by the authors: agents "embellished" knowledge (adding plausible details, or world knowledge from the
  model), though they did not claim experiences they had not had.
- For us: Recordare already follows this prior art: importance 1–10 at encoding, recency + importance + relevance
  ranking (D14), derived items carry source ids (D29). Reflection is what is missing (H12), and the embellishment
  finding is why reflections must stay `inferred`, evidence-bound and pending.

### 2.3 MemGPT / Letta (Packer et al., 2023)
- OS analogy: **main context** (system instructions, working context, FIFO message queue) vs **external context**:
  **recall storage** (the message database) and **archival storage** (arbitrary text). A queue manager sends a
  "memory pressure" warning before eviction so the LLM can save what matters; evicted messages are folded into a
  recursive summary. Later work (sleep-time compute, Lin et al. 2025) lets models "think" offline about a context before queries arrive.
- For us: recall storage ≈ our raw log (Layer 0); archival storage ≈ D49 learned sources; the warning before eviction
  ≈ the pre-compaction hook (`agent-platform-memory.md` idea 10). Already prior art for D49.

### 2.4 Voyager (Wang et al., 2023): procedural memory as a skill library
- An "ever-growing skill library of executable code": a program is added only after a **self-verification** step
  confirms the task succeeded, indexed by the embedding of its description, retrieved by embedding of the plan and
  environment feedback (top-5 retrieval accuracy 96.5 %). The authors say compositional skills alleviate catastrophic
  forgetting.
- For us: the clearest LLM-era procedural memory. It is the agent's, not the person's; in a memory "of the agent
  itself" it becomes relevant (§3, gap 1).

### 2.5 Classical architectures: ACT-R and Soar
- **ACT-R** (Anderson et al., 2004): modules (perceptual-motor, goal, declarative memory) place chunks in buffers
  read by a production system; subsymbolic quantities guide retrieval. Declarative retrieval uses base-level
  activation (recency and frequency, §1.10).
- **Soar** (Laird 2022, read in full): working memory; **procedural** memory of rules, learned by **chunking**
  (compiling deliberate reasoning in a substate into a rule) and reinforcement learning; **semantic** memory retrieved
  by a partial cue with base-level plus spreading activation, and, as of 9.6, "no automatic learning mechanism for
  semantic memory, but an agent can deliberately store information"; **episodic** memory = automatic **snapshots of
  working memory**, retrieved by partial cue, returning **the most recent** matching episode, with next / previous
  navigation; episodic memory is also used "to store goals for future situations in prospective tasks". **Nuxoll &
  Laird (2012)** argue a task-independent episodic memory supports sensing, reasoning and learning capabilities.
- **Laird, Lebiere & Rosenbloom (2017)** propose a community "standard model of the mind" built from cognitive
  architectures.
- For us: our `latest` mode is Soar's "most recent match"; next / previous navigation is a cheap addition (the diary
  read API already orders by time). Soar's split (procedural learning automatic, semantic writing deliberate) is a
  reminder that automatic semantic learning, which Recordare does at every window, is the riskier part.

### 2.6 Recent surveys (2024–2026)
- **Zhang et al. (2024)**, the first broad survey of LLM-agent memory.
- **Wu et al. (2025)** relate human memory categories to AI memory along three dimensions (object, form, time).
- **Du et al. (2025)** define six operations: consolidation, updating, indexing, forgetting, retrieval, condensation.
- **Hu et al. (2025)** separate forms (token-level, parametric, latent) from functions (factual, experiential, working).
- **Liang et al. (2025)** survey from cognitive neuroscience to agents, including memory security.
- **Huang et al. (2026, TMLR)** add a **memory subject** dimension: *user-centric* memory (facts and preferences about
  the user) vs *agent-centric* memory (the agent's own trajectories, outcomes, skills). They note that "a single system
  may maintain" both and that "current benchmarks rarely require both simultaneously".
- **Ding et al. (2026)** treat always-on agents as persistent-state systems (memories but also commitments,
  provenance, permissions) and find that the literature studies accumulating and retrieving state more than
  governing or relinquishing it.
- **Pink et al. (2025)** (position): episodic memory is "the missing piece", with five properties (already our
  checklist).
- Robots and perception: **Ego4D** (Grauman et al., 2022) defines episodic-memory queries over first-person video;
  **ReMEmbR** (Anwar et al., 2024) builds a long-horizon spatio-temporal memory of a robot's video for "where / when /
  how long ago" questions.
- For us: the vision is, in Huang et al.'s terms, an **agent-centric memory that contains user-centric memory with
  attribution**. That combination is named as under-studied by that survey; it is not proven new (Honcho's
  observer / observed peers and Collaborative Memory are close, `agent-platform-memory.md`, `collaborative-memory.md`).

## 3. Mapping onto Recordare

### 3.1 System by system

| Memory system | Human / prior art | Recordare today | Missing |
|---|---|---|---|
| Sensory / perceptual | Brief sensory buffers; perceptual learning (Squire); faces / voices from birth (§1.11) | Raw log of **text** (Layer 0), verbatim, forever; voiceprints only on the client device (D45), no audio stored | Non-text inputs (photos, audio, video, sensor streams) as Layer-0 items with descriptions; recognition memory for people and things (enrolled voices / faces, places, objects) |
| Working memory | Baddeley's episodic buffer; ~4 chunks (Cowan); CoALA working memory | Host context; Recordare's pre-turn memory context = the buffer's long-term input | Nothing to own: stays in the host (budgeted injection) |
| Episodic | Tulving; Generative Agents stream; Soar snapshots | Episodes: bi-temporal, people, place, importance, valence / feelings / opinion, evidence, raw-log fallback, `latest` / `list` / period recall | Agent-lived episodes (`twin_experienced` reserved, not written); next / previous navigation |
| Semantic — about people | Tulving; Conway's knowledge base | Facts as state slots with value chains (D31), notes by category (D34), `subject_person_id` in entity memory (D48) | Facts about third parties in a person's memory (by design today) |
| Semantic — knowledge of the world | CoALA semantic memory; MemGPT archival | D49 learned sources: proposal, not built (WORK_PLAN 5.9) | All of it |
| Autobiographical / self | Conway's self-memory system; lifetime periods | Day and month digests (chronological) | Lifetime periods / general events; a **self-model** (who the agent is, its relations with each person); the owner card idea |
| Prospective | Einstein & McDaniel; multiprocess framework; Soar goals in episodic memory | Plans with lifecycle in code (`open … unresolved`, D10, D37): the **owner's** intentions | The **agent's own** intentions: promises, requests addressed to it, standing intents (idea 8) |
| Procedural | Squire; CoALA (weights + code); Voyager skill library; Soar chunking | None; rejected earlier as "the host agent's job" (`agent-platform-memory.md` §4) | To be decided under the new vision (gap 1) |
| Priming / conditioning | Squire non-declarative | Access counts in ranking only | Not proposed |
| Source / reality monitoring | Johnson & Raye; Johnson et al. 1993; LLM reality monitoring (2026) | `origin` (`owner_lived / owner_told / assistant_stated`), `author_role`, `stance`, `confidence`, `audience`, `confidence_of`; D38 echo guard in code; D48 "someone" and name-in-window guard | **How** the source was established (declared binding, self-introduction, voiceprint, face, inferred) and **how sure**, as data; an "unknown speaker" that can be re-attributed later |
| Consolidation / replay | CLS; Wilson & McNaughton; Diekelmann & Born | Nightly job (zero calls when nothing new), digests; near-duplicate resolver at extraction | Pattern promotions (D20, TODO), consolidation dedup pass (5.3 partial); facts review built but off (D41, no gain) |
| Reflection / own thoughts | Generative Agents reflection; Reflexion; Letta sleep-time | H12 design only; `kind = thought / goal` reserved for track R | All of it |
| Reconsolidation | Nader et al.; Loftus & Palmer | Deliberately not copied: append-only `corrects` / `supersedes` | Nothing (keep) |
| Schemas | Bartlett; Tse et al.; Gilboa & Marlatte | Fact-slot schema with cardinality and merge policy; note categories | A check that schemas do not distort one-offs into habits (eval probe) |
| Forgetting | Anderson & Schooler; Richards & Frankland; ACT-R | Ranking demotion; owner-driven forgetting of one episode (period TODO, D16) | Nothing new; forgetting a period |
| Development | Turing; developmental robotics; infantile amnesia | None | Stages and re-processing of early life (§3.3) |

### 3.2 What the new vision changes

1. **The owner is the agent account.** Today an owner is a person (`kind = human`) or an entity (`kind = entity`,
   D48). In the vision both are "the agent's memory" with a mode. Data-wise this is close to what exists: personal mode
   ≈ today's person memory (the account's user is the owner; their words are `owner_lived`), entity mode ≈ D48. The
   change is mostly in **how the memory speaks** (first person) and in two new provenance values below.
2. **Personal mode, first person: keep reality monitoring.** If everything undeclared is the agent's own, the user's
   words and the agent's own replies are both "mine". Johnson & Raye's distinction (perceived vs self-generated) and
   the 2026 LLM result say this is exactly where systems fail: the agent's own outputs come back as facts. So first
   person should be a **rendering choice at read time**, while the data keeps `origin` / `author_role` apart (what the
   person said vs what the agent generated, D30) and the D38 echo guard stays in code. This also keeps the
   "indirect twin" honest: the twin of the person is built from what the person said, not from what the agent replied.
3. **Entity mode, "someone": store the unknown source, re-attribute later.** Today D48 records episodes naming nobody
   and drops personal facts of unidentified speakers. Human source monitoring and infant development suggest a third
   way: keep items as **"someone (unidentified)"** with low attribution confidence, and when identity becomes known
   (a later self-introduction, a voiceprint enrolled after the fact) **add** an attribution link, never rewrite the
   item. The raw log makes this possible; the D48 guard (name must occur in the window) stays for *automatic*
   attribution.
4. **Own-memory marking needs two new provenance values.** "Knowledge it is given" = learned sources (D49), with the
   provider as source. "What a robot perceives working on its own" = first-hand perception by the agent, which none of
   `owner_lived / owner_told / assistant_stated` describes: something like `agent_perceived` (perceived first-hand)
   next to `agent_generated` (its own words and thoughts). Reality monitoring is precisely perceived vs generated, so
   the two should not share a value.
5. **Identity methods as attribution evidence, not as authority.** Declared identity (secure binding), self-
   introduction, voiceprint, face, context inference: each gives an attribution with a method and a confidence.
   D48's rule stays: only a secure binding routes content into a person's **own** memory or widens disclosure;
   biometric or inferred identity only says whose an item probably is inside the agent's memory.
6. **"Develops like a child" = staged capabilities, measured.** The literature gives an order: perception and
   recognition of familiar people first (§1.11), a self and a cast of people before organised personal history
   (Howe & Courage; Nelson & Fivush), reliable source monitoring late (Poole & Lindsay), reflection and own goals last.
   For Recordare: (a) acquisition = raw log + episodes (built); (b) recognition = a people registry with aliases
   (`person_aliases` table created, unused) and enrolled voices / faces on the client; (c) consolidation = nightly
   (built, promotions TODO); (d) own thoughts = H12 / track R. One advantage over the child: with the raw log kept,
   early periods can be **re-extracted** once the agent knows its people (a costed, opt-in job per quality profile,
   D35), instead of suffering infantile amnesia.

### 3.3 Gaps worth designing (each to be measured; none claimed new)

1. **Procedural memory.** Earlier we kept skills out ("the host agent's job"). If the memory is the agent's own, a
   small, evidence-bound **procedure note** (category `procedure`: "to reset the boiler, …", learned from a person or a
   successful run) is semantic-style storage of procedural knowledge and fits the data model. Executable skills
   (Voyager) stay in the host. Prior art: Voyager, Letta and Hermes skills, CoALA.
2. **Reflection with evidence.** H12 as designed, with Generative Agents' mechanics (questions → retrieval → insights
   citing evidence ids), `stance = inferred`, pending, never injected as fact. Trigger by accumulated importance (their
   150 threshold) is cheaper than a fixed schedule and matches "zero calls when nothing to do".
3. **Attribution confidence as a first-class field.** Separate from content `confidence`: `attributed_to`,
   `attribution_method`, `attribution_confidence`, re-attribution links. H3's measure (misattribution traps) becomes
   the test.
4. **Self-model.** Conway's working self: the agent's goals and identity steer recall. Start as the derived owner card
   (idea 6) for personal mode, and as an inferred "who I am / my relation with each person" for entity mode
   (vision direction G), always `inferred`, traceable, never rewriting episodes.
5. **Agent's own prospective memory.** Promises and requests addressed to the agent as intents with lifecycle
   (idea 8), cue-matched at pre-turn recall and time-based via the host scheduler (multiprocess framework).
6. **Perceptual Layer 0.** Non-text items (photo, audio clip, video segment, sensor event) stored as references with
   a description produced by the client or a configured model (CoALA's captioning route), time and place, then
   extracted like messages. Ego4D and ReMEmbR are the evaluation shapes for "where / when did I see X".
7. **Lifetime periods.** An optional thematic or period layer above digests (TSM's monthly topic / persona summaries
   helped preference questions, `tsm-temporal-semantic-memory.md`).

## 4. What the literature confirms in Recordare (no change)

- Append-only memory with corrections instead of reconsolidation (Nader et al.; Loftus & Palmer as the risk).
- Encoding at idle + nightly consolidation as a CLS-shaped design; episodes as the permanent anchor of semantic items
  (multiple trace theory).
- Importance at encoding and recency + importance + relevance ranking: follows Generative Agents and ACT-R / Anderson
  & Schooler.
- Forgetting only in ranking and by the owner's choice (Richards & Frankland: forgetting is for decisions).
- Provenance stored at write time instead of reconstructed at recall (source-monitoring errors in people and in LLMs).

## 5. Open questions

1. Is a single owner kind ("agent") with a mode (personal / entity) cleaner than `human` / `entity`, or only a rename?
   (Development phase: clean code over compatibility.)
2. In personal mode, does the person ever need to be *distinct* from the agent (the agent's own perceptions on a
   phone camera, its own opinions)? If yes, personal mode needs `agent_perceived` / `agent_generated` too.
3. Who confirms a re-attribution of a "someone" item: the person, the admin, or a confidence threshold?
4. Procedure notes: do they belong to notes (category) or to D49 sources (the person's own writing)?
5. Re-extracting early life: when, at what cost, and how to avoid duplicates with what was already extracted?
6. Evaluation: which blind sets measure source monitoring (misattribution traps, unknown-speaker re-attribution),
   reflection (false-reflection rate) and perception ("where did I leave X") before any of this is built?

## References

All DOIs were checked on Crossref and all arXiv ids on arxiv.org on 2026-10-09. "Abstract" = abstract read (PubMed or
arXiv); "full" = full text read; "secondary" = content taken from secondary pages, metadata verified; "classic" =
not re-read.

Human memory
- Anderson, J. R., & Schooler, L. J. (1991). Reflections of the environment in memory. *Psychological Science*, 2(6),
  396–408. doi:10.1111/j.1467-9280.1991.tb00174.x — secondary.
- Anderson, M. C., Bjork, R. A., & Bjork, E. L. (1994). Remembering can cause forgetting. *JEP: LMC*, 20(5),
  1063–1087. doi:10.1037/0278-7393.20.5.1063 — abstract.
- Baddeley, A. D., & Hitch, G. (1974). Working memory. *Psychology of Learning and Motivation*, 8, 47–89.
  doi:10.1016/S0079-7421(08)60452-1 — metadata only.
- Baddeley, A. (2000). The episodic buffer: a new component of working memory? *Trends Cogn. Sci.*, 4(11), 417–423.
  doi:10.1016/S1364-6613(00)01538-2 — abstract.
- Bartlett, F. C. (1932). *Remembering*. Cambridge University Press — classic.
- Bauer, P. J. (2015). A complementary processes account of the development of childhood amnesia and a personal past.
  *Psychological Review*, 122(2), 204–231. doi:10.1037/a0038939 — abstract.
- Conway, M. A., & Pleydell-Pearce, C. W. (2000). The construction of autobiographical memories in the self-memory
  system. *Psychological Review*, 107(2), 261–288. doi:10.1037/0033-295X.107.2.261 — abstract; three levels secondary.
- Conway, M. A. (2005). Memory and the self. *Journal of Memory and Language*, 53(4), 594–628.
  doi:10.1016/j.jml.2005.08.005 — secondary.
- Cowan, N. (2001). The magical number 4 in short-term memory. *Behavioral and Brain Sciences*, 24(1), 87–114.
  doi:10.1017/S0140525X01003922 — abstract.
- DeCasper, A. J., & Fifer, W. P. (1980). Of human bonding: newborns prefer their mothers' voices. *Science*, 208,
  1174–1176. doi:10.1126/science.7375928 — abstract.
- Diekelmann, S., & Born, J. (2010). The memory function of sleep. *Nat. Rev. Neurosci.*, 11, 114–126.
  doi:10.1038/nrn2762 — abstract.
- Einstein, G. O., & McDaniel, M. A. (1990). Normal aging and prospective memory. *JEP: LMC*, 16(4), 717–726.
  doi:10.1037/0278-7393.16.4.717 — abstract.
- Gilboa, A., & Marlatte, H. (2017). Neurobiology of schemas and schema-mediated memory. *Trends Cogn. Sci.*, 21(8),
  618–631. doi:10.1016/j.tics.2017.04.013 — abstract.
- Howe, M. L., & Courage, M. L. (1993). On resolving the enigma of infantile amnesia. *Psychological Bulletin*,
  113(2), 305–326. doi:10.1037/0033-2909.113.2.305 — abstract.
- Johnson, M. H., Dziurawiec, S., Ellis, H., & Morton, J. (1991). Newborns' preferential tracking of face-like stimuli
  and its subsequent decline. *Cognition*, 40(1–2), 1–19. doi:10.1016/0010-0277(91)90045-6 — abstract.
- Johnson, M. K., & Raye, C. L. (1981). Reality monitoring. *Psychological Review*, 88(1), 67–85.
  doi:10.1037/0033-295X.88.1.67 — secondary.
- Johnson, M. K., Hashtroudi, S., & Lindsay, D. S. (1993). Source monitoring. *Psychological Bulletin*, 114(1), 3–28.
  doi:10.1037/0033-2909.114.1.3 — abstract.
- Josselyn, S. A., & Frankland, P. W. (2012). Infantile amnesia: a neurogenic hypothesis. *Learning & Memory*, 19(9),
  423–433. doi:10.1101/lm.021311.110 — abstract.
- Kumaran, D., Hassabis, D., & McClelland, J. L. (2016). What learning systems do intelligent agents need?
  Complementary learning systems theory updated. *Trends Cogn. Sci.*, 20(7), 512–534. doi:10.1016/j.tics.2016.05.004
  — abstract.
- Loftus, E. F., & Palmer, J. C. (1974). Reconstruction of automobile destruction. *J. Verbal Learning and Verbal
  Behavior*, 13(5), 585–589. doi:10.1016/S0022-5371(74)80011-3 — classic.
- McClelland, J. L., McNaughton, B. L., & O'Reilly, R. C. (1995). Why there are complementary learning systems in the
  hippocampus and neocortex. *Psychological Review*, 102(3), 419–457. doi:10.1037/0033-295X.102.3.419 — abstract.
- McClelland, J. L. (2013). Incorporating rapid neocortical learning of new schema-consistent information into
  complementary learning systems theory. *JEP: General*, 142(4), 1190–1210. doi:10.1037/a0033812 — abstract.
- McDaniel, M. A., & Einstein, G. O. (2000). Strategic and automatic processes in prospective memory retrieval: a
  multiprocess framework. *Applied Cognitive Psychology*, 14(7), S127–S144. doi:10.1002/acp.775 — secondary (page range
  not returned by Crossref).
- Nadel, L., & Moscovitch, M. (1997). Memory consolidation, retrograde amnesia and the hippocampal complex. *Curr.
  Opin. Neurobiol.*, 7(2), 217–227. doi:10.1016/S0959-4388(97)80010-4 — abstract.
- Nader, K., Schafe, G. E., & LeDoux, J. E. (2000). Fear memories require protein synthesis in the amygdala for
  reconsolidation after retrieval. *Nature*, 406, 722–726. doi:10.1038/35021052 — abstract.
- Nelson, K., & Fivush, R. (2004). The emergence of autobiographical memory. *Psychological Review*, 111(2), 486–511.
  doi:10.1037/0033-295X.111.2.486 — abstract.
- Pascalis, O., de Haan, M., & Nelson, C. A. (2002). Is face processing species-specific during the first year of
  life? *Science*, 296, 1321–1323. doi:10.1126/science.1070223 — abstract.
- Poole, D. A., & Lindsay, D. S. (2002). Reducing child witnesses' false reports of misinformation from parents.
  *J. Exp. Child Psychol.*, 81(2), 117–140. doi:10.1006/jecp.2001.2648 — abstract (PubMed).
- Richards, B. A., & Frankland, P. W. (2017). The persistence and transience of memory. *Neuron*, 94(6), 1071–1084.
  doi:10.1016/j.neuron.2017.04.037 — abstract.
- Rochat, P. (2003). Five levels of self-awareness as they unfold early in life. *Consciousness and Cognition*, 12(4),
  717–731. doi:10.1016/S1053-8100(03)00081-3 — abstract.
- Schacter, D. L., Addis, D. R., & Buckner, R. L. (2007). Remembering the past to imagine the future: the prospective
  brain. *Nat. Rev. Neurosci.*, 8, 657–661. doi:10.1038/nrn2213 — abstract.
- Squire, L. R., & Zola, S. M. (1996). Structure and function of declarative and nondeclarative memory systems.
  *PNAS*, 93(24), 13515–13522. doi:10.1073/pnas.93.24.13515 — abstract.
- Squire, L. R. (2004). Memory systems of the brain: a brief history and current perspective. *Neurobiol. Learn.
  Mem.*, 82(3), 171–177. doi:10.1016/j.nlm.2004.06.005 — abstract; taxonomy boxes secondary.
- Tse, D., Langston, R. F., Kakeyama, M., et al. (2007). Schemas and memory consolidation. *Science*, 316, 76–82.
  doi:10.1126/science.1135935 — abstract.
- Tulving, E. (1972). Episodic and semantic memory. In E. Tulving & W. Donaldson (Eds.), *Organization of Memory*
  (pp. 381–403). Academic Press — secondary (no DOI; page range from secondary records).
- Tulving, E. (1985). Memory and consciousness. *Canadian Psychology*, 26(1), 1–12. doi:10.1037/h0080017 — secondary.
- Tulving, E. (2002). Episodic memory: from mind to brain. *Annu. Rev. Psychol.*, 53, 1–25.
  doi:10.1146/annurev.psych.53.100901.135114 — abstract.
- Wilson, M. A., & McNaughton, B. L. (1994). Reactivation of hippocampal ensemble memories during sleep. *Science*,
  265, 676–679. doi:10.1126/science.8036517 — abstract.
- Wixted, J. T. (2004). The psychology and neuroscience of forgetting. *Annu. Rev. Psychol.*, 55, 235–269.
  doi:10.1146/annurev.psych.55.090902.141555 — abstract.

Development and machines
- Turing, A. M. (1950). Computing machinery and intelligence. *Mind*, 59(236), 433–460. doi:10.1093/mind/LIX.236.433 —
  §7 quote checked on the publisher page.
- Lungarella, M., Metta, G., Pfeifer, R., & Sandini, G. (2003). Developmental robotics: a survey. *Connection
  Science*, 15(4), 151–190. doi:10.1080/09540090310001655110 — metadata only.

Agent architectures and surveys
- Anderson, J. R., Bothell, D., Byrne, M. D., Douglass, S., Lebiere, C., & Qin, Y. (2004). An integrated theory of the
  mind. *Psychological Review*, 111(4), 1036–1060. doi:10.1037/0033-295X.111.4.1036 — abstract; base-level equation
  secondary.
- Anwar, A., Welsh, J., Biswas, J., Pouya, S., et al. (2024). ReMEmbR. arXiv:2409.13682 — abstract.
- Ding, T., et al. (2026). Always-On Agents: a survey of persistent memory, state, and governance in LLM agents.
  arXiv:2606.30306 — abstract.
- Du, Y., et al. (2025). Rethinking memory in LLM based agents. arXiv:2505.00675 — abstract.
- Grauman, K., et al. (2022). Ego4D. CVPR 2022; arXiv:2110.07058 — abstract.
- Hu, Y., et al. (2025). Memory in the age of AI agents. arXiv:2512.13564 — abstract.
- Huang, W.-C., et al. (2026). A survey of agent memory in the second half. *TMLR* (07/2026); arXiv:2602.06052 —
  abstract and §3.3.
- Laird, J. E., Lebiere, C., & Rosenbloom, P. S. (2017). A standard model of the mind. *AI Magazine*, 38(4), 13–26.
  doi:10.1609/aimag.v38i4.2744 — abstract.
- Laird, J. E. (2022). Introduction to Soar. arXiv:2205.03854 — full.
- Liang, J., et al. (2025). AI meets brain: memory systems from cognitive neuroscience to autonomous agents.
  arXiv:2512.23343 — abstract.
- Lin, K., Snell, C., et al. (2025). Sleep-time compute. arXiv:2504.13171 — abstract.
- Nuxoll, A. M., & Laird, J. E. (2012). Enhancing intelligent agents with episodic memory. *Cognitive Systems
  Research*, 17–18, 34–48. doi:10.1016/j.cogsys.2011.10.002 — secondary.
- Packer, C., et al. (2023). MemGPT: towards LLMs as operating systems. arXiv:2310.08560 — full.
- Park, J. S., O'Brien, J. C., Cai, C. J., Morris, M. R., Liang, P., & Bernstein, M. S. (2023). Generative agents:
  interactive simulacra of human behavior. UIST 2023. doi:10.1145/3586183.3606763; arXiv:2304.03442 — full.
- Pink, M., et al. (2025). Position: episodic memory is the missing piece for long-term LLM agents. arXiv:2502.06975 —
  abstract.
- Ranjan, S., Sokratous, K., & Odegaard, B. (2026). Reality monitoring in large language models. arXiv:2607.23927 —
  abstract.
- Shinn, N., et al. (2023). Reflexion: language agents with verbal reinforcement learning. arXiv:2303.11366 —
  abstract.
- Sumers, T. R., Yao, S., Narasimhan, K., & Griffiths, T. L. (2023). Cognitive architectures for language agents.
  TMLR; arXiv:2309.02427 — full.
- Wang, G., et al. (2023). Voyager: an open-ended embodied agent with large language models. arXiv:2305.16291 — full.
- Wu, Y., et al. (2025). From human memory to AI memory. arXiv:2504.15965 — abstract.
- Zhang, Z., et al. (2024). A survey on the memory mechanism of large language model based agents. arXiv:2404.13501 —
  abstract.

Not verified: none of the references above failed verification. Venues come from the arXiv records (CoALA "TMLR camera
ready", Ego4D "CVPR 2022", Huang et al. "TMLR 07/2026"); CoALA's TMLR year was not checked.
