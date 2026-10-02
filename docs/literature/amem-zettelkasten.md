# A-MEM: Agentic Memory for LLM Agents (Xu, Liang, Mei, Gao, Tan, Zhang, NeurIPS 2025 / arXiv Feb 2025, arXiv:2502.12110)
Read: full arXiv HTML (main text, ablation, scaling, appendix prompts) plus the released system code (`agentic_memory/memory_system.py` of A-mem-sys, read). Code: https://github.com/WujiangXu/A-mem-sys (system) and https://github.com/WujiangXu/AgenticMemory (benchmark reproduction). Venue: the source contains a NeurIPS checklist, so a NeurIPS submission; acceptance not verified.

## Problem
Existing agent memories need predefined storage structures, write points and retrieval timing (and graph DBs need fixed schemas), so they generalise poorly. A-MEM wants memory that organises itself, following the Zettelkasten method: atomic notes plus flexible links.

## Mechanism (how it works)
1. **Note construction**: for each interaction an LLM produces keywords, a one-sentence context and tags; the note is embedded (all-minilm-l6-v2) from all its text fields.
2. **Link generation**: cosine top-k neighbours of the new note; the LLM decides which to link, based on shared attributes (the paper's "box" idea: a note can sit in several overlapping boxes).
3. **Memory evolution**: for each neighbour the LLM decides whether to update its context, keywords and tags given the new note; the evolved note **replaces** the old one.
4. **Retrieval**: embed the query, cosine top-k (k=10 by default; tuned per category in Appendix A.5); linked notes of the hits are also returned.

In the released code, steps 2 and 3 are one LLM call (`process_memory`) returning `should_evolve`, `actions`, `suggested_connections`, `tags_to_update`, `new_context_neighborhood`, `new_tags_neighborhood`; only the actions `strengthen` (append links, overwrite the note's tags) and `update_neighbor` (overwrite neighbour tags and context) are implemented; the prompt also offers `merge` and `prune` but code ignores them. Evolution runs on the 5 nearest neighbours. The vector index is rebuilt every `evo_threshold` (100) evolutions.

## Data model (fields, statuses, tables/stores)
Paper: note m_i = {c_i content, t_i timestamp, K_i keywords, G_i tags, X_i context, e_i embedding, L_i links}. Code `MemoryNote`: `content`, `id`, `keywords`, `links`, `retrieval_count`, `timestamp` (YYYYMMDDHHMM), `last_accessed`, `context`, `evolution_history`, `category`, `tags`. Store: in-memory dict plus ChromaDB (metadata duplicated there). The `evolution_history` field exists but is never appended to in `memory_system.py`: evolution is destructive, no versions. No validity interval, event date, importance, or status.

## Prompts / LLM usage
Per note at least two LLM calls: note construction (JSON: keywords, context, tags; "Don't include keywords that are the name of the speaker or time") and one evolution/link call over the new note plus neighbours (appendix B.2/B.3: "You are an AI memory evolution agent responsible for managing and evolving a knowledge base ... determine ... strengthen, update_neighbor"). Everything else (similarity, retrieval, storage) is code. Cost claims: ~1,200 tokens per memory operation, < $0.0003 per operation with commercial APIs, 5.4 s with GPT-4o-mini and 1.1 s with a local Llama 3.2 1B. Models tested: GPT-4o-mini, GPT-4o, Qwen2.5 1.5B/3B, Llama 3.2 1B/3B via Ollama (plus DeepSeek-R1-32B, Claude 3 Haiku, 3.5 Haiku in appendix); structured output via LiteLLM or the OpenAI schema API.

## Evaluation
- Datasets: LoCoMo (the paper says 7,512 QA pairs; five categories) and DialSim (TV-show dialogue, ~350k tokens). Metrics F1 and BLEU-1 (also ROUGE, METEOR, SBERT). Baselines: LoCoMo, ReadAgent, MemoryBank, MemGPT.
- GPT-4o-mini: A-Mem F1 27.02 (multi-hop), 45.85 (temporal), 12.14 (open-domain), 44.65 (single-hop), 50.03 (adversarial); DialSim F1 3.45 vs LoCoMo 2.55, MemGPT 1.18. Category labelling differs between the A-Mem and Mem0 papers (the same numbers appear under different category names), so do not mix tables.
- Ablation (GPT-4o-mini F1): without link generation and evolution multi-hop 9.65, temporal 24.55, single-hop 13.28; with links only 21.35 / 31.24 / 39.17; full 27.02 / 45.85 / 44.65. Links give most of the gain, evolution the rest.
- Scaling: retrieval time 0.31 -> 3.70 from 1k to 1M notes (unit lost in the HTML conversion, not stated here).
- Independent re-run (Mem0 paper, J metric): A-Mem* single-hop 39.79, multi-hop 18.85, open-domain 54.05, temporal 49.91, overall 48.38; search p50 0.67 s, ~2.5k tokens. Much lower than other systems; Mem0's re-run is not authoritative either.

## Limitations
Authors: quality depends on the underlying LLM; text only. Ours: no judge metric in the original paper (F1/BLEU reward lexical overlap); no cost of ingestion at scale beyond one number; evolution rewrites neighbour context/tags in place with no provenance or versions (risk of drift and cascading errors, "telephone game"); no time semantics (timestamp is the interaction time, not the event date); no distinction of fact, event, plan; links are LLM judgement on top-k neighbours only; every note costs ≥ 2 LLM calls; the nearest-neighbour update can rewrite unrelated notes; unimplemented actions in the prompt (`merge`, `prune`) show the schema outran the code; ablation shows links help but does not isolate evolution cleanly on judged correctness.

## Implications for Recordare
- **Important:** A-MEM's evolution (destructive context/tag rewriting) is the "reconsolidation" we rejected in the cognitive table. Arkimede already limits it to one conservative pass; in Recordare keep notes append-only and store links on the episode/fact side (D19, D28). If a neighbour's description must change, write a new version with provenance, never overwrite.
- **Important:** the ablation shows the benefit comes mainly from link generation (multi-hop 9.65 -> 21.35 F1), not from evolution. For Layer 3 (semantic notes), invest in linking (episode -> note, episode -> episode via `linkedNoteIds`, D19/D20) and skip neighbour rewriting.
- ADOPT: the three LLM-written descriptors (keywords, one-sentence context, tags) as retrieval keys for episodes and digests, embedded together with the content — consistent with LongMemEval "fact-augmented keys" already in the TODO. But produce them in the **same extraction call** (D2), not an extra call per note: A-MEM's 2+ calls per note conflicts with our 1.2-calls-per-window cost rule.
- ADOPT: keep `retrieval_count`/`last_accessed` (our `accessCount`/`lastAccessedAt`), as the code does; and the "return the linked notes of hits" retrieval expansion (our D19 v2).
- ADOPT the rule "Don't include keywords that are the name of the speaker or time" in keyword generation (avoids useless tags).
- AVOID: rebuilding the vector index periodically (`consolidate_memories` recreates the whole Chroma collection); use incremental upserts in pgvector.
- AVOID: a prompt schema offering actions the code does not implement; validate model output against a closed enum in code (D27).
- Evaluation (H6): do not use F1/BLEU or generous judges; A-Mem's numbers across papers (original vs Mem0's re-run) differ by a factor of two, a warning that benchmark scores of this family are not comparable.
- Arkimede note: the existing A-MEM implementation matches the paper's note structure; migrating it into Recordare later means adding validity/versioning fields the paper lacks (D28).
