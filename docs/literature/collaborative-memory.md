# Collaborative Memory: Multi-User Memory Sharing in LLM Agents with Dynamic Access Control (Rezazadeh, Li, Lou, Zhao, Wei, Bao, arXiv preprint cs.MA, May 2025, arXiv:2505.18279)
Read: full arXiv HTML (https://arxiv.org/html/2505.18279), fetched through a page-to-markdown extractor with a detailed extraction prompt (not a manual read of raw HTML; symbols and numbers are as extracted); Code: not released (no repository link on the arXiv page)

## Problem
Multi-user, multi-agent LLM systems benefit from persistent shared memory, but existing memory work assumes a single user. Two challenges: information asymmetry (users reach different agents and resources) and dynamic access (permissions change over time). Question posed: how to maximise the utility of collective memory while sharing conforms to permissions.

## Mechanism (how it works)
1. Users, agents and resources (tools, APIs, databases) are connected by two time-varying bipartite graphs of permissions.
2. A coordinator LLM receives the user query, agent specialization strings and conversation history, and emits JSON {"agent": ID, "subquery": ...} or {"stop": true}.
3. For each chosen agent, retrieval takes top-k_user fragments from the user's private tier plus top-k_cross from the cross-user shared tier, by cosine similarity, restricted to fragments whose provenance satisfies current permissions.
4. The read policy filters the candidate fragments (the simple version returns admissible fragments verbatim); the agent answers from the filtered view.
5. After the answer, write policies run: an LLM-based transformation writes a private-memory version and a shared-memory version into the respective tiers.
6. A response aggregator synthesises the (subquery, response) pairs into the final answer.
7. When graph edges change, previously stored fragments are re-checked against the new graph at read time using their stored provenance (retrospective permission check).

## Data model
- Sets: 𝒰 users, 𝒜 agents, ℛ resources.
- Graphs (Eq. 1): G𝒰𝒜(t) ⊆ 𝒰 × 𝒜 and G𝒜ℛ(t) ⊆ 𝒜 × ℛ.
- Accessibility (Eq. 2-3): 𝒜(u,t) := {a | (u,a) ∈ G𝒰𝒜(t)}; ℛ(a,t) := {r | (a,r) ∈ G𝒜ℛ(t)}.
- Fragment access: ℳ(u,a,t) := {m ∈ ℳ | 𝒜(m) ⊆ 𝒜(u,t) ∧ ℛ(m) ⊆ ℛ(a,t)}.
- Immutable provenance per fragment m: 𝒯(m) creation timestamp, 𝒰(m) originating user, 𝒜(m) contributing agents, ℛ(m) resources accessed during creation.
- Tiers: ℳ = ℳ^private ∪ ℳ^shared; ℳ^private(u,t) is isolated to one user; ℳ^shared(a,t) is agent-scoped and accessible across users per permissions.
- Policies: π^read_{u,a,t}; π^{write/private}_{u,a,t} and π^{write/shared}_{u,a,t} (Eq. 4-5). Instantiations: simple (store verbatim) or transformation (LLM redaction, anonymization, paraphrase). Granularity levels: π^global, π^u, π^a, π^t (system, per user, per agent, temporal).
- Fragments are LLM-generated key-value pairs annotated with provenance. Note the access test is on the fragment's contributing agents and resources, not on the fragment's content or a per-fragment audience; the originating user 𝒰(m) is recorded but the quoted formula for ℳ(u,a,t) does not use it directly (private tier covers that).

## LLM usage
LLM: coordinator routing, memory encoding into key-value fragments, write-policy transformation (private and shared prompts; the shared prompt says to extract generally applicable knowledge and remove user-specific details), the domain agents, response aggregation (all GPT-4o; embeddings text-embedding-3-large). Deterministic: the permission graphs, the accessibility functions, the provenance subset test, top-k retrieval. Enforcement of the shared-tier content relies on the LLM redacting correctly.

## Evaluation
Metrics: accuracy, agent utilization (distinct agents per query), resource utilization (KB/API calls per query). No leakage metric.
- Scenario 1, fully collaborative: MultiHop-RAG (609 articles, 2,556 queries, 6 domain agents, 5 users, overlap 0/25/50/75%, k=10/10). Accuracy above 0.90 throughout; resource calls reduced 61% at 50% overlap and 59% at 75% versus isolated memory.
- Scenario 2, asymmetric: synthetic 200 business queries (100 easy, 100 hard), 4 roles, 4 agents, 4 simulated resources, k=20/20; fewer resource calls than isolated, no quantitative ground truth.
- Scenario 3, dynamic: SciQAG, 5 agents, 5 users, 100 queries, Bernoulli edge grants then revocations over 8 time blocks. Accuracy rises with grants and falls with revocation; users only reach granted agents and resources; resource use falls over time through reuse.
Baselines: isolated memory only (scenario 1).

## Limitations
Authors: benchmarks and synthetic queries may not reflect real use; moderate numbers of users and agents; LLMs can cause occasional hallucinations or policy breaches despite enforcement; resource utilization measured only as call counts. Not stated: formal security proofs, scalability limits, cost of LLM transformation, comparison with other memory systems.
Own observations: the goal is efficiency and task accuracy among cooperating users, not protecting against an adversarial interlocutor; no leakage test at all, despite the access-control framing. The permission unit is agent/resource capability, which does not map to "who was in the conversation". Shared-tier safety depends on LLM redaction. Revocation works only because fragments are re-checked at read time; derived (redacted) shared fragments that already absorbed private content are not retracted. Authors of paper 2608.17148 contrast it as redaction + task utility versus their exclusion.

## Implications for Recordare
- (important) Store immutable provenance on every memory unit (timestamp, originating person/conversation, contributing tool/agent, resources touched) and evaluate permissions at read time against current policy, not frozen at write time. This is what makes grants and revocations (a friend demoted, a person's grant removed) take effect without rewriting data; it complements the write-time audience set of 2608.17148 and fits D28 (`origin`, source ids, bi-temporal rows).
- (important) Do not use LLM transformation as the security control. Their shared tier relies on an LLM to strip user-specific details; for us redaction may improve utility but disclosure must be decided by deterministic labels (D28 `disclosure`) before the prompt. If we generate a "shareable version" of an episode, keep it as a separate derived item with source ids and its own label, never a replacement.
- Private/shared maps to our owner-only vs disclosable split, but our tiers are graded (owner/inner/friends/acquaintances/public) and per-person, so a boolean two-tier column is insufficient; keep the graded label plus provenance.
- Time-varying permissions: model grants as data with validity intervals (valid-from / valid-to), consistent with our bi-temporal approach, so audit questions ("what could this person see on date X") are answerable.
- Keep write policies configurable at several granularities (global, per person, per channel, per time) as in π^global/π^u/π^a/π^t, but only as config, not code paths (D27 style profiles).
- Audit log: record which fragments were admitted into which prompt (conversation id, viewer, policy version). Useful for H2 evaluation and for retroactive review.
- Avoid: permission test only on agent/resource provenance (misses the "who was present" dimension: pair it with the audience set); no leakage metrics; treating efficiency gains from cross-user reuse as a goal, since a twin should share less by default.
