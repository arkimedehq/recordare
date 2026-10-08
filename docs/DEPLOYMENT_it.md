# Profili di deployment — infrastruttura

*Traduzione italiana di [DEPLOYMENT.md](DEPLOYMENT.md) — la versione inglese è quella di riferimento.*

Come è organizzata l'infrastruttura di Recordare. (Da non confondere con i profili di **fiducia** privato / pubblico (`home` / `public`) di
`API.md` §0, D33.) Il codice di Recordare non dipende mai da un altro prodotto: condividere l'infrastruttura è solo
configurazione.

Recordare richiede:
- **Postgres ≥ 16** con le estensioni `vector` (pgvector) e `pg_trgm`;
- **Redis** (code BullMQ);
- un **endpoint di embedding compatibile con OpenAI** (`/v1/embeddings`), con il modello fissato per installazione (`EMBEDDING_DIM`);
- un provider LLM (D27).

## Installare con gli script (`deploy/`)

```sh
deploy/install.sh            # asks the profile (standalone | cohosted), the LLM provider and key; writes deploy/.env (600)
deploy/update.sh             # backup, rebuild on the current code, restart (migrations run at start)
deploy/backup.sh             # dump of Recordare's database into deploy/backups/ (keeps the last 14)
```

- **Standalone**: `deploy/docker-compose.yml` — Recordare, Postgres (pgvector), Redis e Hugging Face
  text-embeddings-inference (Apache-2.0) che serve BAAI/bge-m3 (immagine CPU per architettura).
- **Co-ospitato con Arkimede**: `deploy/docker-compose.cohosted.yml` — l'installer trova lo stack di Arkimede, verifica
  che il suo Postgres usi l'immagine pgvector e che il suo embedder serva bge-m3, crea il database `recordare`, l'utente
  e l'estensione `vector`, usa il db Redis 1, si unisce alla rete condivisa da quei servizi, poi (facoltativamente)
  crea il client di Arkimede e scrive `RECORDARE_URL` / `RECORDARE_API_KEY` nel `.env` di Arkimede (con backup); dopo,
  riavviare il backend di Arkimede.
- Non interattivo: `deploy/install.sh --profile cohosted --yes` con `LLM_API_KEY_FILE=…` (la chiave mai sulla riga di
  comando). Rieseguirlo mantiene i segreti già presenti in `deploy/.env`. Gli script non chiedono mai sudo.
- Recordare ascolta su `127.0.0.1:8090` sull'host (`RECORDARE_PORT`); Arkimede lo raggiunge per nome
  (`http://recordare:8080`) sulla rete condivisa.

## Standalone (predefinito)

Recordare esegue il proprio Postgres (immagine pgvector), Redis e server di embedding. È la scelta giusta ovunque le
risorse lo permettano: un guasto o un aggiornamento di un prodotto non tocca mai l'altro.

## Co-ospitato con Arkimede (piccoli server)

Su una macchina con risorse limitate, Recordare riusa i servizi che Arkimede già esegue. Gli embedding sono la parte
pesante, quindi condividere l'embedder è il risparmio maggiore.

| Servizio | Come è condiviso | Impostazioni di Recordare |
|---|---|---|
| Postgres | Stesso server, **database proprio e utente proprio**. Il Postgres di Arkimede deve usare l'immagine `pgvector/pgvector:pg16` (default di Arkimede da quella modifica in poi; un'installazione esistente passa con lo script di aggiornamento di Arkimede, che ricostruisce gli indici di testo per il passaggio musl → glibc) | `DATABASE_URL=postgres://recordare:<pw>@postgres:5432/recordare` |
| Redis | Stessa istanza, **database logico proprio** e prefisso di coda proprio | `REDIS_URL=redis://redis:6379/1`, `QUEUE_PREFIX=recordare` |
| Embedding | L'`embedding-service` di Arkimede, **solo se serve il modello che usa Recordare** (`BAAI/bge-m3`, 1024 dimensioni — il modello con cui Recordare è stato misurato; default di Arkimede) | `EMBEDDING_BASE_URL=http://embedding:8000/v1`, `EMBEDDING_MODEL=BAAI/bge-m3`, `EMBEDDING_DIM=1024` |

Configurazione, una volta sola, come superutente Postgres del server di Arkimede:

```sql
CREATE ROLE recordare LOGIN PASSWORD '<pw>';
CREATE DATABASE recordare OWNER recordare;
\c recordare
CREATE EXTENSION IF NOT EXISTS vector;   -- not a trusted extension: the superuser creates it
```

(`pg_trgm` è un'estensione fidata e viene creata dalla migrazione di Recordare stessa.) Poi eseguire le migrazioni di
Recordare con il suo `DATABASE_URL`. Recordare si unisce alla rete Docker di Arkimede (una rete esterna nel suo file
compose) e raggiunge i servizi per nome; nulla viene pubblicato sull'host.

**Che cosa costa la condivisione** — dirlo all'operatore: un Postgres o Redis fermo blocca entrambi i prodotti;
l'embedder serve due carichi (l'estrazione di Recordare arriva a raffiche, dopo i periodi di inattività e di notte),
quindi dargli la CPU / memoria che servono a entrambi; i backup restano separati (`pg_dump` per database). Cambiare il
modello di embedding dell'embedder condiviso lo cambia per entrambi: Arkimede ri-calcola gli embedding con il suo job di
amministrazione, Recordare ri-calcola quelli di episodi, fatti, note e digest — non cambiarlo mai per un solo lato.

**Recordare Atlas** (opzionale) gira accanto a loro come prima; gli agenti di Arkimede esportano le loro tracce
OpenTelemetry verso di esso (README di `recordare-atlas`). Impostare `ATLAS_URL` nel `.env` di Recordare (l'indirizzo
che le persone aprono, ad es. `http://<server>:5175`): `GET /me` lo consegna ai client, e Arkimede lo collega per i suoi
amministratori.

**Console admin**: `http://<host>:<RECORDARE_PORT>/admin` (persone, consenso, tipo di memoria, client, chiavi, token).
Recordare ascolta su `127.0.0.1` per impostazione predefinita: aprila sulla LAN di casa con `RECORDARE_BIND=0.0.0.0` in
`deploy/.env` (ogni rotta della API richiede comunque una chiave), oppure raggiungila con un tunnel SSH
(`ssh -L 8090:127.0.0.1:8090 <server>`). In HTTP semplice la chiave admin attraversa la rete in chiaro: solo su una rete di
casa fidata, oppure mettici davanti HTTPS.
