# Recordare

*Recordare* — Latin for "remember!" (*re-* + *cor*: "bring back to the heart").

Recordare is a standalone memory and **digital twin** service for agentic platforms.
It recreates a person's memory — facts, episodes, the story of their life — and their
persona (style, way of thinking, voice), so that an agent can act as their declared
digital twin, answer on their behalf and take initiative.

It is usable from any platform: via **MCP** (basic integration, any MCP client) or via
**MCP + REST ingest + SDK** (full integration). [Arkimede](https://github.com/arkimedehq/arkimede)
is the first client.

> Status (2026-10-07): the service is implemented (`service/`, NestJS + Postgres/pgvector + BullMQ): raw log, episodes,
> plans, facts, notes, nightly digests, MCP recall and write tools, admin API, live telemetry. Arkimede is integrated
> as the first client; the read API, the client library and connectors are next (`docs/WORK_PLAN.md`). Not published
> yet.

## Documents

- [Digital twin vision](docs/DIGITAL_TWIN_VISION.md) — goal, pillars, disclosure tiers,
  initiative levels, legacy mode, architecture, name, roadmap.
- [Episodic memory design](docs/EPISODIC_MEMORY_TODO.md) — phase 1: layered memory
  (raw log → episodes → digests → semantic notes), decisions D1–D47.
- [Work plan](docs/WORK_PLAN.md) — milestones M0–M7 with their status.
- [API](docs/API.md), [data model](docs/DATA_MODEL.md) — contracts (built parts and v1 plan).
- [Integration guide](docs/INTEGRATION.md) — how a client platform connects; [deployment](docs/DEPLOYMENT.md) —
  standalone or co-hosted with Arkimede; [Atlas events](docs/ATLAS_EVENTS.md) — the contract with
  [Recordare Atlas](https://github.com/arkimedehq/recordare-atlas), the optional live brain view.
- [Service](service/README.md) — development, layout, LLM provider per task.
- [Memory engine evaluation](spikes/memory-eval/README.md) — spike comparing existing
  engines (Graphiti, Memobase) against a raw baseline; results in
  [RESULTS.md](spikes/memory-eval/RESULTS.md).
- [CLAUDE.md](CLAUDE.md) — context and conventions for development sessions.

## License

[AGPL-3.0-or-later](LICENSE) © 2026 Andrea Genovese
