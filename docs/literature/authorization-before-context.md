# Authorization Before Context: A Model-Neutral Audience Boundary Against Cross-Audience Memory Leakage in Agentic Systems (Sibo Liu, AdvML-Frontiers x CoTMA workshop at COLM 2026, non-archival, arXiv:2608.17148)
Read: full arXiv HTML (https://arxiv.org/html/2608.17148), fetched through a page-to-markdown extractor with a detailed extraction prompt (not a manual read of the raw HTML; formulas and numbers below are as extracted); Code: not released (authors state the production system and its source are not released; sealed synthetic evidence with SHA-256 digests is published)

## Problem
A personal language agent works across several channels (private, one-to-one, group). A fact learned from one audience can later be stored, retrieved and placed in the prompt for a different audience. The paper treats the memory-to-context transition as the attack surface. Threats: (1) cross-audience prying (a participant elicits facts outside their scope), (2) channel ambiguity (inconsistent participant identification causes over-sharing), (3) poisoned memory (content planted in one scope later reaches others). Core claim: once an unauthorized item is in context, later defences are too late, so a forbidden fact must be absent before the model is called.

## Mechanism (how it works)
1. All memory lives in one shared store; every item F is tagged at write time with the audience present when it was recorded, Aud(F).
2. At read time the system derives the viewer set V(C) of the current conversation container C from channel metadata (sender, container, observed participants).
3. If that evidence is missing or inconsistent, V(C) is set to U (everyone) and authorization fails closed to public-only items.
4. Each retrieval path applies the admission test before returning anything: V(C) ⊆ Aud(F).
5. The prompt is assembled only from admitted items. Direct-lookup primitives return the same "not-found" whether the item is absent or merely unauthorized (existence opacity).
6. Three structurally different stores enforce the same decision: an in-turn recency buffer (recall confined to the current turn), a summarized long-term store (authorized scopes pushed into the query so only admissible items are fetched), and a knowledge graph (hybrid search and entity lookup with audience checks before return). Raw record, derived memory and exact prompt are kept as separate layers linked by provenance.
7. Graph entity summaries are aggregates that may span audiences and carry no per-item provenance; they cannot be checked fact by fact, so the system fails closed on them too.

## Data model
- Per item: an audience tag Aud(F) = the set of participants present at recording time (exact field names beyond Aud / V / U / Pub are not stated).
- Per request: viewer set V(C); U = all participants (unknown fallback); Pub = public items.
- Rule: admit F iff V(C) ⊆ Aud(F). Admissible set Adm(C).
- Proven properties: P1 one-way confinement (m ∈ Adm(C) ⟹ V(C) ⊆ Aud(m)); P2 anti-monotonicity (V(C1) ⊆ V(C2) ⟹ Adm(C2) ⊆ Adm(C1); owner alone sees everything); P3 fail-closed soundness (undetermined V ⟹ Adm = Pub); P4 poisoning containment (write-time binding fixes an injected item's audience to its origin container's authenticated membership). P4 is confidentiality only, not integrity.
- Audiences are sets of participants, not graded tiers. Audience widening (promoting a fact that several contacts independently know) is deliberately rejected because it would add content inference to a content-free boundary.

## LLM usage
Authorization is purely deterministic set membership on metadata, independent of any model. The LLM is not used in the decision. The paper does not describe summarization algorithms or prompting strategy ("not stated"). Memory quality is explicitly out of scope.

## Evaluation
Synthetic benchmark from a fixed-seed generator (seed 42617) with Contextual-Integrity labels (subject, sender, recipient, information type, transmission principle): 79 scenarios in 13 families (owner-private 8, exact-shared one-to-one/group 16, directional cross-channel 4, trusted canonical shared 4, ambiguous/unknown viewer 6, mixed-inbound inconsistent evidence 6, adversarial boundary 8, negative control 10, others 17). Primary metric: forbidden facts in the exact assembled context, counted before any answer. Results: 0/79 forbidden facts, 79/79 decision match, 16/16 fail-closed coverage, 79/79 permitted-context coverage, 253/253 model-neutral assertions. Baselines are definitional projections, not tuned runtimes: unscoped (79/79 forbidden inclusions by construction) and a one-store diagnostic (0/79 forbidden but only 76/79 allowed facts retained). No latency, user study or output-leakage evaluation; no prompt-only defence comparison.

## Limitations
Authors: data are synthetic; assumes the transport correctly names participants; no general prompt-injection defence; no production-reliability, latency, deletion/conflict resolution, action safety or memory-quality claims; code not released; P4 is not an integrity guarantee. Future work: drive the decision through every store incl. graph retrieval, evaluate write admission, adversarial suite with forged metadata, stale labels, multi-hop transitions, overlapping audiences.
Own observations: the 0/79 result is near-tautological for a deterministic rule on synthetic labels; the real risk (label correctness, derived artefacts, inference leakage by combining permitted facts, existence leakage via refusals) is not measured. Audience-as-set is exact but brittle: a later-added person in a group makes old group facts invisible to the group; no revocation or relabel story. Third-party confidences ("Marco told me X") are not modelled.

## Implications for Recordare
- (important) Store at write time, on every episode, fact, digest and profile entry, the audience set actually present (resolved person ids, owner and twin included) in addition to the D28 `disclosure` tier label. The tier is a policy view; the audience set is the immutable fact of what was witnessed. Keeping both avoids a migration when phase 3 picks one or both (D28, H2).
- (important) Enforce the filter inside every retrieval path (vector, FTS, date filter, graph or profile lookup) before the prompt is assembled; never as a post-filter or prompt instruction. Lookup-by-id must return the same "not found" for missing and forbidden items (existence opacity).
- (important) Derived artefacts (digests, semantic notes, profile) must carry per-item source ids so the label can be recomputed; the paper shows aggregates without per-item provenance cannot be checked and must fail closed. Our rule: derived audience = intersection of source audiences (most restrictive wins), and never merge across audiences into an unprovenanced summary (D28 source-id requirement).
- (important) Viewer set comes from channel binding only (vision: interlocutor tiers, "unknown = public"); store the channel, container and observed participants on the conversation. Missing or inconsistent evidence maps to public-only, including mixed-inbound groups: V is the union of all participants in a group, and the group sees only facts all of them already knew.
- Keep the tier model (owner/inner/friends/acquaintances/public) on top of the audience-set check; the paper has no graded tiers, so a v1 rule needs both: tier ceiling AND V ⊆ Aud (or a per-person grant).
- Write-time binding resists poisoning: a memory written from a public-channel conversation can only be disclosed within that audience. Record `origin` (D28) and source conversation id so injected content stays confined.
- Avoid: audience widening by content inference; relying on the LLM to decide disclosure; relying on the owner-only default without recording the audience (loses what could be shared later); updating a label in place without keeping the original audience (no revocation story in the paper, so design relabel/revoke events ourselves).
- Measure what the paper skips (H2): output and inference leakage, over-refusal, and write-time labelling accuracy.
