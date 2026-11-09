# Disclosure — what the memory may tell whom: what Recordare has, what others do, how people do it

Research for the twin phases (VISION phases 2–4, RESEARCH_NOTES H2 / H3), 2026-11-09. Extends the October pass in
`RESEARCH_NOTES.md` H2 and the cards `authorization-before-context`, `collaborative-memory`, `memir-typed-memory`.
Italian: [disclosure_it.md](disclosure_it.md). About 25 searches; every arXiv id opened on arxiv.org. Read marks: [S] full
text through an extractor, [A+] abstract and part of the text, [A] abstract or product page only. Most 2026 sources are
[A]: re-check numbers before quoting them outside. Paraphrased throughout; model names in the numbers are the papers'.

## 1. What Recordare already has

- **Private memories (D52, built 2026-10-27).** A message is private when the person who said it asks in words ("don't
  tell anyone", any language; extraction section PRIVATE) or the client flags it (a message, a private conversation).
  Everything extracted from it inherits it, and so does the agent's reply in that turn. It is told only to that person
  and, in a personal memory, to the holder.
- **A deterministic filter on every read path** (`service/src/recall/privacy.ts`). An item is hidden when any message
  behind it is private to someone else (fail closed). Digests and recurring patterns are built from public memories only.
- **The reader** is the author of the conversation's latest person's turn: the holder of a personal memory reads
  everything, an identified contact reads the public plus their own private items, anyone unidentified reads the public
  only. Identities come from verified channel bindings (D24, D51), never from what someone says.
- **Recorded, never read:** `audience` (verified people present when it was said), `audience_unverified`, `disclosure`
  (a tier, always `holder`), `confidence_of` (a third party's confidence), `origin` (`holder_lived`, `holder_told`,
  `assistant_stated`, `reflected`; `twin_experienced` not yet).
- **Everything else is public** (D50, D52). So in a personal memory, an identified contact who writes to the agent can
  be told anything the holder did not declare private — health, money, family matters. A third party's confidence told
  without "don't tell" can be passed to anyone. In an entity memory, what one family member said in the open can reach a
  guest. Proxy mode — the twin speaking for its holder — already exists in practice, with no rule beyond D52.

## 2. What others do

**Enforcement: only a hard filter before the context holds.**
- MemLeak (arXiv:2610.04195, NeurIPS-PALM 2026) [A]: a vector store pooled across users leaks 70–100 % with no attacker.
  Of three mitigations, only a deterministic ownership filter restored the clean baseline.
- Inadvertent Context Leakage (arXiv:2608.19857, NeurIPS 2026) [A]: a secret in the context window leaks into harmless
  replies even when the model refuses to reveal it; more capable models leak more. A prompt is not a boundary.
- InferPriv (arXiv:2610.34640, 2026-10-25) [S]: a personal agent writes a routine reply to a third party. With a
  privacy prompt direct leakage is near zero, but the recipient can still infer the sensitive attribute (health,
  religion, money) 16–25 % of the time, even with the attribute's name removed from the memory.
- Agent Mosaic (arXiv:2610.30418) [A]: allowed documents combine into a forbidden conclusion (about 7 %), and some
  refusals reveal the conclusion (existence leakage).
- PiSAs (arXiv:2607.05318, data Apache-2.0) [A+]: two labels per item — fit for the task, and which users may hold it.
  Shared memory moves violations rather than removing them; private details attached to a task leak about 36 %; LLM
  filters reach about 6 % violations at the cost of completeness (75–78 %).
- Multi-party settings leak more: MuPPET (arXiv:2606.23217) [A], Loose Lips (arXiv:2610.14071, ×3 over six turns) [A],
  Got a Secret? (arXiv:2605.27766, a peer's disclosure makes the next one about 8× likelier) [A].

**Deciding without an explicit "don't tell".**
- Write-time labels by an LLM: EP-Mem (arXiv:2609.35233, 2026-09-28) [A+] — the closest work to H2 now: the user gives
  contacts levels (with life / work domains) and per-fact allow / deny lists; an LLM labels each event when the memory is
  built (94 % on the authors' set); a "confidentiality agreement" label only on an explicit no-spread cue, close to D52;
  an LLM judges each answer per audience and rewrites or deflects. No identity binding, no adversaries, no over-refusal
  metric, no code. AIM / MUMBench (arXiv:2609.12320) [A]: private / public at 96 %. Both on their own synthetic sets.
- Read-time contextual-integrity reasoning: PrivacyChecker (arXiv:2509.17488) [A], CI reasoning trained by RL
  (arXiv:2506.04245, code Apache-2.0) [A], ARIEL (arXiv:2512.05065, the user's own precedents) [A]. Weak spots:
  CIMemories (arXiv:2511.14937) [A] — models share everything or nothing, so privacy prompts turn into over-refusal;
  AgentSocialBench (arXiv:2604.01487) [A] — telling agents to abstract sensitive things makes them talk about them more.
- What leaks most is not identifiers: AgentCIScope (arXiv:2610.19158) [A] — preferences and booking details leak far more
  than card numbers or social-security numbers.
- On the reply side: Disclosure Begets Disclosure (arXiv:2610.28315) [A+] — memory replies presuppose stored attributes,
  the user lets them stand, guesses become facts. The best mitigation is one instruction: do not state or presuppose
  personal attributes unless the person raises them. It brings leakage close to the no-memory level and keeps most of
  the quality. HUSH-Bench (arXiv:2606.06055) [A]: memory makes models use a sensitive past disclosure when nothing in the
  turn asks for it (the *warrant*).
- **Over-refusal is barely measured anywhere** (PiSAs, InferPriv, EP-Mem, GateMem report completeness, not refusals).

**A delegate speaking for its principal.**
- AirGapAgent (arXiv:2405.05175) [S]: give the delegate only what the task needs before it meets the third party.
  Firewalls for agentic networks (arXiv:2502.01822, code MIT) [A]: incoming messages through a closed protocol, outgoing
  data abstracted to the task's level of detail.
- AI Delegates with a Dual Focus (arXiv:2409.17642, Microsoft) [A]: some goals need the delegate to reveal something;
  pure restriction is wrong.
- SovereignNegotiation-Bench (arXiv:2607.02814) [A]: agency-law duties (loyalty, obedience, confidentiality, candour,
  diligence) as deterministic log checks; models often break them.
- Products (vendor pages) [A]: ChatGPT switches personal memory off in any chat with more than one member; Meta's creator
  AIs take topics to avoid, a reply scope and an AI label; Personal.ai keeps one persona per audience (family / work) and
  drafts for approval below a confidence; Delphi lets the owner read every conversation; Honcho builds a peer's model of
  others only from what it witnessed; Microsoft 365 Copilot gives generated content the highest-priority sensitivity label
  of its sources (the deployed precedent for our digests rule). None documents third-party confidences.

**Evaluation to reuse (ideas; code only under compatible licences).** Context leakage counted before the model runs
(ABC); direct leakage over five samples; inferential leakage minus a control memory (InferPriv); existence leakage — the
same question about a private item and about a missing one; utility on entitled askers and over-refusal; leakage after
deletion (GateMem, arXiv:2606.18829, code MIT, data CC BY 4.0); repeated and multi-session sampling. Usable data:
PiSAs (Apache-2.0). Not usable: CIMemories, InferPriv data (non-commercial). CC BY 4.0 data needs the maintainer's OK.

## 3. How people do it

- **Communication privacy management** (Petronio 2002) [secondary sources]: people own their private information;
  whoever is told becomes a co-owner bound by rules about telling it on; breaches come from mistakes, deliberate leaks or,
  most often, **no rule at all**. The owner is the **subject**: Marco's illness told by his sister is still Marco's.
- **Audience segregation and context collapse** (Goffman 1959; Marwick & boyd 2011): one face per audience; trouble
  comes when audiences mix — a group chat, a voice in a room.
- **Contextual integrity** (Nissenbaum): a flow is judged by sender, recipient, subject, kind of information and the
  principle of transmission; the frame of most papers above.
- **Agents are held to a stricter standard**: It's My Agent, Not Me (arXiv:2509.21712) [A] — 169 people, 1,650 boundaries:
  delegating to an AI made them more protective, about themselves and about others.
- **Households** (arXiv:2602.16975 and SOUPS / UBC studies, [A]): partners and children accepted, neighbours and guests not;
  housemates fear each other's reminders and calendars reached through misrecognised voices; they want per-person control.
- **What everyone treats as sensitive**: health, sexuality, money trouble, relationships and infidelity, addiction,
  religion, politics, legal trouble (Slepian et al. 2017, 38 secret categories; GDPR art. 9 special categories — a
  licence-free, language-independent list).

## 4. From these to Recordare

1. **Keep enforcement deterministic and before the context.** The literature backs D52's filter more strongly than in
   October; nothing should move into prompts. Prompts are a second line, not the boundary.
2. **The audience, not only the asker.** D52 reads as the latest speaker. In a group chat or a voice room, an asker's
   own private item would be said in front of everyone present. ABC, PiSAs and MuPPET take the recipients as the unit:
   a private item only when everyone present may hear it. Participants and presences are already resolved; `audience`
   is already written.
3. **The subject owns it, for the categories everyone treats as sensitive.** D52's "a sensitive topic told without
   asking stays public" is where every source disagrees — for special categories and third parties, not for D52's
   explicit rule (which matches EP-Mem's cue). A measured extension: sensitive-category information about a person is
   told only to that person, the one who told it and, in a personal memory, the holder — unless the person frees it.
   The categories as data in `service/src/lang`'s spirit (language-independent, GDPR art. 9 as the base); labelled by
   the same extraction call, no new call; accuracy and over-refusal measured on a dev set in several languages first.
4. **One rule on the reply side, at no cost.** The memory context tells the agent not to state or presuppose a remembered
   personal attribute unless the person raised it or the task needs it (arXiv:2610.28315). Measure it.
5. **Existence opacity.** A hidden item must be indistinguishable from a missing one in what the agent gets — no "there
   is something I can't say". Test it.
6. **Inference leakage cannot be filtered item by item.** Public pieces can add up to a private conclusion; measure it
   (InferPriv's control subtraction, on our own set) and document the residual.
7. **Proxy mode (phase 4), when it comes:** what the task needs rather than tiers alone; the delegate's duties as
   deterministic checks; a digest for the holder of what the twin told whom; the AI label at first contact (VISION
   principle 4); optional drafts for approval.
8. **An evaluation set** before any of this ships: leakage (context, direct, inferential, existence), over-refusal on
   entitled askers, leakage after forgetting, five samples; adversaries — a claimed identity in a shared channel,
   multi-turn probing, two low-trust people together, a mixed group; enforcement compared: none, prompt only, LLM filter,
   the filter before the context.

## 5. Where the analogy misleads

- People decide disclosure in the moment, with the listener's face in front of them; an agent decides from labels
  written earlier, and a label error is a leak or a refusal every ~20 items at the reported accuracies.
- A human confidant forgets the details; the agent keeps them verbatim, so the inference risk is larger than for a person.
- "The subject owns it" assumes the subject is known; an unresolved name ("a friend of mine") has no owner to ask.

## 6. Novelty (H2, updated)

Still partially novel, narrower than in October. EP-Mem now covers graded per-contact levels with per-fact exceptions,
LLM labels at write time and audience-specific answers; ABC covers fail-closed audience filtering; PiSAs, GateMem and
MemArena cover multi-user evaluation with honest users. Not found in any paper: (a) third-party confidences as a
deterministic subject-ownership rule; (b) labels carried into digests and notes, failing closed (Recordare has it);
(c) audience-aware disclosure for voice and room settings, with identity from channel binding or voiceprint; (d) an
adversarial comparison of prompt-only, LLM-filter and pre-context enforcement on one multi-user memory, with inference
and existence leakage and over-refusal. Claim (d) only after searching again: the field moves monthly.
