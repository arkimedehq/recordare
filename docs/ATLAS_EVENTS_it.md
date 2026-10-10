# Eventi di Atlas — contratto v2

*Traduzione italiana di [ATLAS_EVENTS.md](ATLAS_EVENTS.md) — la versione inglese è quella di riferimento.*

Il contratto tra Recordare e qualsiasi visualizzatore in tempo reale — prima di tutto **Recordare Atlas**
(`arkimedehq/recordare-atlas`, opzionale, WORK_PLAN 5b.7). Recordare funziona allo stesso modo senza alcun
visualizzatore collegato.

**Regole.** Ogni evento rispecchia un passo reale all'interno del servizio, emesso mentre accade; nulla è sintetizzato.
**Solo metadati**: id, tipi, conteggi, token, durate — mai testo di messaggi, ricordi, query o prompt. Solo accesso
amministrativo. Ogni evento porta `v` (versione del contratto) e `at` (ora ISO). **Versionamento**: nuovi tipi di
evento e nuovi campi sono additivi e mantengono `v`; rimuovere o cambiare il significato di un campo la incrementa. Un
visualizzatore ignora i tipi che non conosce.

**Versioni.** **v2** (WORK_PLAN 8.10): ogni evento porta `memoryId` al posto di `ownerId`; gli endpoint
`api/v1/admin/owners…` sono diventati `api/v1/admin/memories…`, il filtro del flusso `?owner=` è diventato `?memory=`,
`owner {id, name}` dello snapshot è diventato `memory {id, name}`, e il ruolo dell'autore `owner` è diventato `holder`.
**v1** (WORK_PLAN 5b.7): il primo contratto, con quei vecchi nomi.

## Endpoint (chiave admin; sola lettura)

| Endpoint | Che cosa |
|---|---|
| `GET api/v1/admin/memories` | Elenco delle memorie: `id, name, episodes, lastActivity` (più recenti prima, max 200) |
| `GET api/v1/admin/memories/:id/atlas` | Snapshot di una memoria: episodi (tipo, ruolo dell'autore, importanza, giorno, stato del piano, stato nascosto, posizione `xyz` per significato), archi reali (`similar`, `corrects`, `duplicate`, `outcome`, `rescheduled`, `people`), fatti / note / digest (id e tipi), `totals` complessivi (chiamate LLM, token di input / output, richiami) |
| `GET api/v1/admin/telemetry/stream[?memory=<id>]` | Server-Sent Events, uno per ciascun passo sotto (`event:` = tipo, `data:` = JSON) |

## Eventi

| Tipo | Campi (oltre a `v`, `at`, `memoryId`) | Emesso quando |
|---|---|---|
| `message.ingested` | `conversationId`, `messages`, `roles` (conteggio per ruolo) | messaggi memorizzati dall'ingest |
| `extraction.started` / `extraction.finished` | `runId`, `conversationId`, `messages` / `status` (`done`, `failed`, `skipped`), `written` | una finestra di estrazione inizia / finisce |
| `llm.started` | `runId`, `promptId`, `task` (`extract`, `extract_economy`, `resolve`, `facts`, `digest`) | parte una chiamata LLM |
| `llm.call` | `runId`, `promptId`, `model`, `inputTokens`, `cachedInputTokens`, `outputTokens`, `latencyMs`, `status` | la chiamata è tornata (o è fallita) |
| `work.started` / `work.finished` | `op` (`embed.messages`, `context`, `embed.memories`, `recall`, `consolidation`), `id` (le accoppia) / `ms` | un lavoro senza chiamata LLM inizia / finisce |
| `memory.written` | `runId`, `table` (`episodes`, `facts`, `notes`), `id`, `kind`, `authorRole`, `importance`, `corrects` | una riga di memoria scritta |
| `episode.linked` | `relation` (`duplicate`, `corrects`), `from`, `to` | il resolver ha collegato due episodi |
| `recall.served` | `tool` (uno strumento MCP, oppure `memory_context` per il blocco prima del turno, solo quando non è vuoto), `mode`, `episodeIds`, `claimIds`, `chats`, `digests`, `facts`, `notes` | un richiamo ha risposto |
| `digest.written` | `level` (`day`, `month`), `period`, `sources` | un diario notturno scritto |
| `consolidation.finished` | `days`, `months`, `llmCalls`, `failed` | il consolidamento di una memoria termina |
| `episode.forgotten` | `ids` | episodi dimenticati |

Le piattaforme client (agenti, le loro chiamate LLM, strumenti) raggiungono l'atlas sul proprio canale — tracce
OpenTelemetry GenAI — non tramite questo flusso (WORK_PLAN 5b.8).
