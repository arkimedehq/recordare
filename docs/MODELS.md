# Supported models

Recordare runs on any LLM and embedding provider (D27): what changes from one to another is configuration, a provider
profile (`LLM_PROFILE`, `docs/KNOBS.md` §3). This page says which models have been **measured** as the memory's engine
(the extraction behind every memory), how they scored, and under which licence their weights are released.

**The bar** (maintainer's rule): an engine model is supported when it reaches 95 % on the evaluation suite; models
below it are not recommended, and their results are kept. Answer and judge are the same model in every row
(`deepseek-flash`), so the rows differ only in the engine. Scores are from one blind set each, 1 run unless noted;
differences of a few points are within noise (`spikes/memory-eval/RESULTS.md`).

## Engine models

| Model | Access | Weights licence | Measured on | Accuracy | Status |
|---|---|---|---|---|---|
| **deepseek-flash** (DeepSeek V4 Flash) | DeepSeek API, thinking off (`deepseek` profile) | MIT (DeepSeek-V4-Flash weights) | blind3, 5, 7, 9, 10, 11 (3 runs each, except blind5) | 94.9, 91.3, 91.3, 97.2, 96.7, 98.8 % | **Reference** — the default engine; cheapest per token with prefix caching |
| DeepSeek V4 Pro | OpenRouter | MIT | blind5 | 87.1 % | Below the bar; best on facts and notes |
| Claude Sonnet 5.5 | OpenRouter, reasoning minimal | API only | blind5 | 89.5 % | Below the bar (premium reference) |
| Claude Haiku 4.5 | OpenRouter, thinking off | API only | blind5 | 81.0 % | Below the bar |
| Gemini 3.1 Flash-Lite | OpenRouter, reasoning off | API only | blind5 | 81.0 % | Below the bar |
| Qwen 3.7 Flash | OpenRouter | API only (no open weights found) | blind5 | 78.5 % | Below the bar |
| GPT-5.4 nano | OpenRouter | API only | blind5 | 77.9 % | Below the bar |
| Gemini 2.5 Flash-Lite | OpenRouter | API only | blind5 | 73.0 % | Below the bar |
| Mistral Small 4 (2603) | OpenRouter | Apache-2.0 (119B MoE) | blind5 | 61.5 % | Below the bar |
| gpt-oss 20B | Ollama (local), reasoning low | Apache-2.0 | blind3 | 83.3 % | Below the bar; best local model |
| Qwen3.5 9B | Ollama (local) | Apache-2.0 | blind3 | 73.6 % | Below the bar |
| Gemma 4 12B | Ollama (local) | Apache-2.0 | blind3 | 73.6 % | Below the bar |
| Qwen3 14B | Ollama (local) | Apache-2.0 | blind3 | 66.7 % | Below the bar |
| Qwen3 8B | Ollama (local) | Apache-2.0 | blind3 | 59.7 % | Below the bar |
| Gemma 4 26B | Ollama (local) | Apache-2.0 | — | — | Not measured: does not fit a 24 GB machine next to the service |
| MiniCPM 4.1 8B | Ollama (local) | Apache-2.0 | — | — | Excluded after probes |

Not yet measured through their own APIs (WORK_PLAN 4.5b): OpenAI, Gemini and Anthropic directly — the rows above reach
them through OpenRouter. Licences come from the models' Hugging Face cards (checked 2026-10-18); "API only" models are
used under their vendor's terms. Check a licence again before you ship a model: they change (Gemma 4 moved to
Apache-2.0 from the Gemma Terms of Use).

## Embedding model

| Model | Licence | Notes |
|---|---|---|
| BAAI/bge-m3 | MIT | 1024 dimensions; every evaluation uses it. Another model needs a re-embed (`EMBEDDING_DIM` is fixed per installation) |

## Measuring a model

One command per model, from a profile file (`spikes/memory-eval/profiles/*.json`: provider, service profile, endpoint,
model, the variable holding the key, prices):

```sh
uv run --directory spikes/memory-eval python provider_eval.py --config profiles/<model>.json --smoke-only
uv run --directory spikes/memory-eval python provider_eval.py --config profiles/<model>.json   # blind5, 1 run
uv run --directory spikes/memory-eval python provider_eval.py --table
```

It checks the model with one tiny structured call first (trying the profile's ways to switch reasoning off), then runs
the service on that model in an instance of its own, scores the answers and the extraction, and reports the engine's
cost. Runs cost money: the evaluation budget rules in `WORK_PLAN.md` apply.

A client platform that hands Recordare's MCP tools to its own LLM can check that its provider accepts their schemas:
`service/scripts/dump-mcp-tools.ts` prints them as `tools/list` returns them.
