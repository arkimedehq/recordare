# Modelli supportati

Recordare funziona con qualunque provider di LLM e di embedding (D27): da uno all'altro cambia solo la configurazione,
un profilo del provider (`LLM_PROFILE`, `docs/KNOBS_it.md` §3). Questa pagina dice quali modelli sono stati **misurati**
come motore della memoria (l'estrazione dietro ogni memoria), con che risultato e con quale licenza sono rilasciati i
loro pesi.

**La soglia** (regola del maintainer): un modello motore è supportato quando raggiunge il 95 % sulla suite di
valutazione; quelli sotto non sono raccomandati, e i loro risultati restano. Risposta e giudice sono lo stesso modello in
ogni riga (`deepseek-flash`), quindi le righe differiscono solo per il motore. I punteggi vengono da un set cieco
ciascuno, 1 run salvo dove indicato; differenze di pochi punti rientrano nel rumore (`spikes/memory-eval/RESULTS.md`).

## Modelli motore

| Modello | Accesso | Licenza dei pesi | Misurato su | Accuratezza | Stato |
|---|---|---|---|---|---|
| **deepseek-flash** (DeepSeek V4 Flash) | API DeepSeek, ragionamento spento (profilo `deepseek`) | MIT (pesi DeepSeek-V4-Flash) | blind3, 5, 7, 9, 10, 11 (3 run ciascuno, tranne blind5) | 94,9, 91,3, 91,3, 97,2, 96,7, 98,8 % | **Riferimento** — il motore predefinito; il più economico per token con il prefix caching |
| DeepSeek V4 Pro | OpenRouter | MIT | blind5 | 87,1 % | Sotto la soglia; il migliore su fatti e note |
| Claude Sonnet 5.5 | OpenRouter, ragionamento minimo | Solo API | blind5 | 89,5 % | Sotto la soglia (riferimento premium) |
| Claude Haiku 4.5 | OpenRouter, ragionamento spento | Solo API | blind5 | 81,0 % | Sotto la soglia |
| Gemini 3.1 Flash-Lite | OpenRouter, ragionamento spento | Solo API | blind5 | 81,0 % | Sotto la soglia |
| Qwen 3.7 Flash | OpenRouter | Solo API (nessun peso aperto trovato) | blind5 | 78,5 % | Sotto la soglia |
| GPT-5.4 nano | OpenRouter | Solo API | blind5 | 77,9 % | Sotto la soglia |
| Gemini 2.5 Flash-Lite | OpenRouter | Solo API | blind5 | 73,0 % | Sotto la soglia |
| Mistral Small 4 (2603) | OpenRouter | Apache-2.0 (MoE da 119B) | blind5 | 61,5 % | Sotto la soglia |
| gpt-oss 20B | Ollama (locale), ragionamento basso | Apache-2.0 | blind3 | 83,3 % | Sotto la soglia; il miglior modello locale |
| Qwen3.5 9B | Ollama (locale) | Apache-2.0 | blind3 | 73,6 % | Sotto la soglia |
| Gemma 4 12B | Ollama (locale) | Apache-2.0 | blind3 | 73,6 % | Sotto la soglia |
| Qwen3 14B | Ollama (locale) | Apache-2.0 | blind3 | 66,7 % | Sotto la soglia |
| Qwen3 8B | Ollama (locale) | Apache-2.0 | blind3 | 59,7 % | Sotto la soglia |
| Gemma 4 26B | Ollama (locale) | Apache-2.0 | — | — | Non misurato: non entra in una macchina da 24 GB insieme al servizio |
| MiniCPM 4.1 8B | Ollama (locale) | Apache-2.0 | — | — | Escluso dopo le prove |

Non ancora misurati attraverso le loro API (WORK_PLAN 4.5b): OpenAI, Gemini e Anthropic diretti — le righe sopra li
raggiungono tramite OpenRouter. Le licenze vengono dalle schede Hugging Face dei modelli (controllate il 2026-10-18); i
modelli "solo API" si usano secondo i termini del fornitore. Ricontrolla una licenza prima di distribuire un modello:
cambiano (Gemma 4 è passata ad Apache-2.0 dai Gemma Terms of Use).

## Modello di embedding

| Modello | Licenza | Note |
|---|---|---|
| BAAI/bge-m3 | MIT | 1024 dimensioni; ogni valutazione lo usa. Un altro modello richiede un re-embed (`EMBEDDING_DIM` è fisso per installazione) |

## Misurare un modello

Un comando per modello, da un file di profilo (`spikes/memory-eval/profiles/*.json`: provider, profilo del servizio,
endpoint, modello, la variabile con la chiave, prezzi):

```sh
uv run --directory spikes/memory-eval python provider_eval.py --config profiles/<modello>.json --smoke-only
uv run --directory spikes/memory-eval python provider_eval.py --config profiles/<modello>.json   # blind5, 1 run
uv run --directory spikes/memory-eval python provider_eval.py --table
```

Prima prova il modello con una piccola chiamata strutturata (tentando i modi del profilo per spegnere il ragionamento),
poi avvia il servizio su quel modello in un'istanza tutta sua, valuta risposte ed estrazione e riporta il costo del
motore. I run costano: valgono le regole del budget di valutazione in `WORK_PLAN_it.md`.

Una piattaforma client che passa gli strumenti MCP di Recordare al proprio LLM può controllare che il suo provider ne
accetti gli schemi: `service/scripts/dump-mcp-tools.ts` li stampa come li restituisce `tools/list`.
