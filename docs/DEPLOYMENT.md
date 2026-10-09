# Deployment profiles — infrastructure

How Recordare's infrastructure is laid out. (Not to be confused with the **trust** profiles home / public of
`API.md` §0, D33.) Recordare's code never depends on another product: sharing infrastructure is configuration only.

Recordare needs:
- **Postgres ≥ 16** with the `vector` (pgvector) and `pg_trgm` extensions;
- **Redis** (BullMQ queues);
- an **OpenAI-compatible embedding endpoint** (`/v1/embeddings`), the model fixed per installation (`EMBEDDING_DIM`);
- an LLM provider (D27).

## Install with the scripts (`deploy/`)

```sh
deploy/install.sh            # asks the profile (standalone | cohosted), the LLM provider and key, the port and LAN access; writes deploy/.env (600)
deploy/update.sh             # backup, git pull (in a clone), rebuild, restart (migrations run at start)
deploy/backup.sh             # dump of Recordare's database into deploy/backups/ (keeps the last 14)
```

- **Standalone**: `deploy/docker-compose.yml` — Recordare, Postgres (pgvector), Redis and Hugging Face
  text-embeddings-inference (Apache-2.0) serving BAAI/bge-m3 (CPU image per architecture). Plan **≈ 6 GB of RAM** for
  the stack (the embedder alone ≈ 4.5 GB, `EMBEDDER_MAX_BATCH_TOKENS`); on smaller hosts use the co-hosted profile or an
  external embedding endpoint. Tested end to end on a clean clone 2026-10-08 (macOS, arm64).
- **Co-hosted with Arkimede**: `deploy/docker-compose.cohosted.yml` — the installer finds Arkimede's stack, checks its
  Postgres runs the pgvector image and its embedder serves bge-m3, creates the `recordare` database, user and `vector`
  extension, uses Redis db 1, joins the network those services share, then (optionally) creates Arkimede's client and
  writes `RECORDARE_URL` / `RECORDARE_API_KEY` into Arkimede's `.env` (backed up); restart Arkimede's backend after.
- Non-interactive: `deploy/install.sh --profile cohosted --yes` with `LLM_API_KEY_FILE=…` (the key never on the command
  line). Re-running keeps the secrets already in `deploy/.env`. The scripts never ask for sudo.
- Recordare listens on `127.0.0.1:8090` on the host (`RECORDARE_PORT`); Arkimede reaches it by name
  (`http://recordare:8080`) on the shared network.

## Standalone (default)

Recordare runs its own Postgres (pgvector image), Redis and embedding server. The right choice wherever resources
allow it: a failure or an upgrade of one product never touches the other.

## Co-hosted with Arkimede (small servers)

On a machine with limited resources, Recordare reuses the services Arkimede already runs. Embeddings are the heavy
part, so sharing the embedder is the biggest saving.

| Service | Shared how | Recordare settings |
|---|---|---|
| Postgres | Same server, **own database and own user**. Arkimede's Postgres must use a `pgvector/pgvector` image (`pg16`: Arkimede's default from that change on; an existing install switches with Arkimede's upgrade script, which rebuilds text indexes for the musl → glibc change) | `DATABASE_URL=postgres://recordare:<pw>@postgres:5432/recordare` |
| Redis | Same instance, **own logical database** and own queue prefix | `REDIS_URL=redis://redis:6379/1`, `QUEUE_PREFIX=recordare` |
| Embeddings | Arkimede's `embedding-service`, **only if it serves the model Recordare uses** (`BAAI/bge-m3`, 1024 dims — the model Recordare was measured with; Arkimede's default) | `EMBEDDING_BASE_URL=http://embedding:8000/v1`, `EMBEDDING_MODEL=BAAI/bge-m3`, `EMBEDDING_DIM=1024` |

Set-up, once, as the Postgres superuser of Arkimede's server:

```sql
CREATE ROLE recordare LOGIN PASSWORD '<pw>';
CREATE DATABASE recordare OWNER recordare;
\c recordare
CREATE EXTENSION IF NOT EXISTS vector;   -- not a trusted extension: the superuser creates it
```

(`pg_trgm` is trusted and is created by Recordare's own migration.) Then run Recordare's migrations with its own
`DATABASE_URL`. Recordare joins Arkimede's Docker network (an external network in its compose file) and reaches the
services by name; nothing is published on the host.

**What sharing costs** — say it to the operator: one Postgres or Redis down stops both products; the embedder serves
two loads (Recordare's extraction comes in bursts, after idle periods and at night), so give it the CPU / memory both
need; backups stay separate (`pg_dump` per database). Changing the embedding model of the shared embedder changes it
for both: Arkimede re-embeds with its admin job, Recordare re-embeds its episodes, facts, notes and digests — never
change it for one side only.

**Recordare Atlas** (optional) runs next to them as before; Arkimede's agents export their OpenTelemetry traces to it
(`recordare-atlas` README). Set `ATLAS_URL` in Recordare's `.env` (the address people open, e.g. `http://<server>:5175`):
`GET /me` hands it to clients, and Arkimede links it for its admins.

**Admin console**: `http://<host>:<RECORDARE_PORT>/admin` (people, memory kind, clients, keys, tokens). Recordare
listens on `127.0.0.1` by default: open it on the home LAN with `RECORDARE_BIND=0.0.0.0` in `deploy/.env` (every API route
still needs a key), or reach it through an SSH tunnel (`ssh -L 8090:127.0.0.1:8090 <server>`). Over plain HTTP the admin
key crosses the network unencrypted: a trusted home network only, or put HTTPS in front.

**Connectors** (`connectors/`) run on the agent platform's side, not here; the only one that is a service of its own is
the OpenAI-compatible memory proxy (image `ghcr.io/arkimedehq/recordare-openai-proxy`, amd64 + arm64), placed on the
platform's private network next to it (`connectors/openai-proxy/compose.example.yml`). Settings: `docs/KNOBS.md` §8b.
