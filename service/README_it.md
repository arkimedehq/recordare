# Servizio Recordare

*Traduzione italiana di [README.md](README.md) — la versione inglese è quella di riferimento.*

Servizio NestJS che implementa `docs/API.md` e `docs/DATA_MODEL.md` (profilo v1 privato / di ricerca, D33). Stato
(2026-10-08, rilasciato come v0.1.0): ingest, motore, consolidamento, strumenti MCP, il contesto di memoria
(`POST api/v1/context`), l'API di lettura (`API.md` §4), API e console di amministrazione e telemetria realizzati; ciò
che resta aperto è indicato riga per riga in `docs/WORK_PLAN.md` (ad esempio OpenAPI, `search_facts`). Guida per i
client: `docs/INTEGRATION.md` (libreria client: `packages/client`); deployment: `docs/DEPLOYMENT.md`; tutte le
impostazioni: `docs/KNOBS.md`.

## Sviluppo

```bash
docker compose up -d db redis          # from the repository root (Postgres :5433, Redis :6380)
cd service && cp .env.example .env     # set ADMIN_API_KEY, LLM_* and EMBEDDING_*
npm install
npm run build && npm run migration:run # needs DATABASE_URL and EMBEDDING_DIM in the environment
npm run start:dev                      # SWC + watch
```

Controlli — eseguili tutti e tre prima di ogni commit (la CI li esegue): `npm run typecheck`, `npm run lint`, `npm test`
(i test di integrazione usano il database `recordare_test` del `db` di compose).

## Struttura

| Percorso | Che cosa |
|---|---|
| `src/config` | Schema dell'ambiente (zod), validato all'avvio |
| `src/db` | Data source, migrazioni (SQL esplicito: enum, indici HNSW / GIN / parziali) |
| `src/llm` | `LlmPort` + adattatori compatibili con OpenAI e Anthropic nativo, profili dei provider (D27), contabilità per chiamata |
| `src/embedding`, `src/clock` | Porta degli embedding (qualsiasi server compatibile con OpenAI), porta dell'orologio |
| `src/auth`, `src/admin`, `src/me` | Chiavi API dei client, token personali, API di amministrazione, risoluzione della memoria, risoluzione della conversazione; `GET / PATCH api/v1/me` |
| `src/console` | Console di amministrazione, una pagina statica servita su `/admin` sopra l'API di amministrazione |
| `src/identity` | Entità di identità |
| `src/rawlog` | Layer 0: ingest REST (idempotente, conserva sempre — l'interruttore acceso / spento è del client, D50), modifiche ed eliminazioni, ricerca nel log grezzo (full-text + vettoriale) |
| `src/queue` | BullMQ: job di estrazione a inattività con debounce, embedding dei messaggi e dei passaggi delle fonti, sweep orario di consolidamento |
| `src/engine` | Estrazione (una chiamata per finestra, writer con regole del ciclo di vita e protezione dall'eco del richiamo), resolver di quasi-duplicati / correzioni, profili di qualità, consolidamento notturno (digest), revisione dei fatti |
| `src/recall` | `search_episodes`, `search_memory`, risolutore di periodi, richiamo consapevole delle persone, scritture esplicite e oblio, il contesto di memoria prima del turno (`POST api/v1/context`), log dei richiami |
| `src/knowledge` | Fonti apprese (D49, WORK_PLAN 8.9): ingest delle fonti a parti, passaggi (divisi nel codice, embedding in background), `search_knowledge`, l'episodio dell'apprendimento scritto nel codice, rotte di lettura / oblio |
| `src/read` | API di lettura / scrittura per le interfacce dei client — il diario della persona (`API.md` §4) |
| `src/lang` | Dati linguistici per gli helper deterministici: periodi e mesi (da `Intl`, le 25 lingue più parlate), parole di parentela, i sostituti del sé per il rilevatore di fughe |
| `src/mcp` | Server MCP su `/mcp` (HTTP in streaming): gli strumenti di `docs/API.md` §3 |
| `src/telemetry`, `src/atlas` | Flusso di eventi in tempo reale per gli operatori (SSE) e snapshot di atlas — contratto `docs/ATLAS_EVENTS.md` |
| `src/health` | `GET api/v1/health` (controllo di salute del container) |

## Scegliere un provider LLM (D27)

`LLM_PROVIDER=openai-compatible` con `LLM_PROFILE` = `deepseek` | `openai` | `openrouter` | `ollama` | `vllm` |
`generic` (oppure `LLM_PROFILE_JSON` per qualsiasi altro server), oppure `LLM_PROVIDER=anthropic` con
`LLM_PROFILE=anthropic` (`LLM_PROVIDER=claude-cli`: solo valutazioni locali, con il piano Claude dell'operatore).
`LLM_MODEL` è il modello predefinito di ogni compito.

**Un modello per compito.** Ogni compito LLM può avere il proprio modello e, se serve, il proprio provider:
`LLM_<TASK>_MODEL`, `LLM_<TASK>_PROVIDER`, `LLM_<TASK>_PROFILE`, `LLM_<TASK>_PROFILE_JSON`, `LLM_<TASK>_BASE_URL`,
`LLM_<TASK>_API_KEY` (non impostato → il default `LLM_*`). Compiti:

| Compito | Che cosa fa | Consigliato (misurato, `spikes/memory-eval/RESULTS.md`) |
|---|---|---|
| `EXTRACT` | episodi, piani, fatti e note da una finestra di conversazione (una chiamata per finestra) | `deepseek-flash`, ragionamento disattivato — le migliori risposte (91 % blind5) e i migliori esiti sui piani, il più economico con la cache dei prefissi |
| `EXTRACT_ECONOMY` | lo stesso per le memorie con il profilo `economy` | `deepseek-flash` (nessun modello più economico misurato lo ha raggiunto: Gemini 3.1 Flash-Lite 81 %, Qwen 3.7 Flash 78,5 %) |
| `RESOLVE` | controllo di quasi-duplicati / correzioni su coppie brevi (solo quando esistono candidati) | `deepseek-flash` (basta un modello leggero; quelli più economici non sono ancora misurati su questo compito) |
| `DIGEST` | consolidamento notturno (M5): il diario di ogni giorno e mese cambiato | `deepseek-flash` (da misurare) |
| `FACTS` | la revisione notturna dei fatti (parametro `factsReview` / `FACTS_REVIEW`) e il passaggio separato fatti-e-note (`FACTS_PASS=separate`) — entrambi disattivati in ogni profilo | entrambi misurati senza guadagno sui fatti (DeepSeek V4 Pro per il passaggio, blind5 per la revisione) — tenerli disattivati |

I modelli del motore sono supportati se ≥ 95 % sulla suite o se i migliori misurati; vedi RESULTS.md per la matrice
completa (modelli premium come Claude Sonnet 5.5 non hanno risposto meglio; DeepSeek V4 Pro estrae meglio fatti e
note — un candidato per un futuro compito di fatti / consolidamento).
