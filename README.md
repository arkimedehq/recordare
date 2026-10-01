# Recordare

*Recordare* — Latin for "remember!" (*re-* + *cor*: "bring back to the heart").

Recordare is a standalone memory and **digital twin** service for agentic platforms.
It recreates a person's memory — facts, episodes, the story of their life — and their
persona (style, way of thinking, voice), so that an agent can act as their declared
digital twin, answer on their behalf and take initiative.

It is usable from any platform: via **MCP** (basic integration, any MCP client) or via
**MCP + REST ingest + SDK** (full integration). [Arkimede](https://github.com/arkimedehq/arkimede)
is the first client.

> Status: design phase — nothing implemented yet.

## Documents

- [Digital twin vision](docs/DIGITAL_TWIN_VISION.md) — goal, pillars, disclosure tiers,
  initiative levels, legacy mode, architecture, name, roadmap.
- [Episodic memory design](docs/EPISODIC_MEMORY_TODO.md) — phase 1: layered memory
  (raw log → episodes → digests → semantic notes), decisions D1–D22.
- [Memory engine evaluation](spikes/memory-eval/README.md) — spike comparing existing
  engines (Graphiti, Memobase) against a raw baseline before building our own.

## License

[AGPL-3.0-or-later](LICENSE) © 2026 Andrea Genovese
