# Recordare for OpenClaw

An [OpenClaw](https://github.com/openclaw/openclaw) plugin that gives your agent a long-term episodic memory kept by your
own [Recordare](../../README.md) service — the **full** client level:

- **Capture**: each message a person sends and each answer of the agent go to Recordare; when the OpenClaw session ends
  (`/new`, `/reset`, the daily or idle reset) Recordare extracts what happened, plans, facts and notes.
- **Recall before each turn**: one call stores the message and returns the memories relevant to it, added before it as
  a fenced `<memory-context>` block (`POST api/v1/context` with `ingest`, no LLM call, nothing added when nothing is
  relevant).
- **Memory tools**: `recordare_search_episodes`, `recordare_search_memory`, `recordare_resolve_period`,
  `recordare_remember`, `recordare_correct_episode`, `recordare_forget_episode` (Recordare's MCP tools, bound in code to
  the memory and the conversation — neither the model nor the user can point them elsewhere), with the schemas the
  service publishes (`TOOLS` of the client library). `log_episode` is left out: the conversation is already captured.
- **One memory for the agent** (D50): the Gateway's agent has one memory; the people who talk to it — on any channel,
  in direct chats and groups — are **participants** recognised inside it (each `<channel>:<senderId>` becomes a contact
  of the memory, named after their channel name). You, the account holder, are the memory's "I". One memory per person
  stays available (`memoryPer: "user"`).
- **Group chats**: every member's messages are captured with the turn that follows (other members as role `other`).
  Recall works in groups too: Recordare answers with the whole memory in every conversation (D50: no viewer filter
  for now — privacy and disclosure come later), so what the agent remembers can surface in front of the group.

It does not take OpenClaw's memory slot: `memory-core` (`MEMORY.md`, `memory_search`) keeps working beside it. Recordare
stores every turn the plugin sends (it has no consent flag, D50). The plugin never blocks or breaks a turn: every call
is time-boxed (3 s before the turn), failures are logged without content, captured messages that could not be sent are
retried in the background for about ten minutes (in memory: a Gateway restart drops them).

Requires OpenClaw ≥ 2026.9.9 (Node ≥ 24, as OpenClaw itself).

## Install

1. Install it into OpenClaw (on the Gateway's machine) from npm:
   ```
   openclaw plugins install npm:@arkimedehq/openclaw-recordare --accept-capabilities
   ```
2. Or from a checkout (development): `cd connectors/openclaw && npm ci && npm run build`, then
   `openclaw plugins install --link /path/to/recordare/connectors/openclaw --accept-capabilities` (`--link` keeps it
   pointing at the folder; without it OpenClaw copies it). Restart the Gateway, then check
   `openclaw plugins inspect recordare --runtime --json` (status `loaded`, 4 hooks, 6 tools).
3. Ask the Recordare admin for a credential for the agent's memory:
   - a **personal token** with the scopes `mcp`, `ingest`, `read` (`POST api/v1/admin/owners/{id}/tokens`, client of
     kind `mcp_client`) — the token's memory is the agent's;
   - or a **client key** with the same scopes and the agent's account in `defaultUser` (a client user, known to
     Recordare or auto-provisioned if the client allows it); a client key is also what one memory per person needs.

   The memory's **mode** and **gender** are set by the admin (`PATCH api/v1/admin/owners/{id}` `{mode, gender}`), or
   with a client key by `PATCH api/v1/me`: `personal` (your own assistant: you are "I", what arrives undeclared is
   yours) or `entity` (an agent shared by a family, a team, a place: what arrives undeclared is "someone"'s); `gender`
   `masculine` (default) | `feminine` | `neutral` for the first person in gendered languages. The plugin has no setting
   for them.
4. Configure it in `~/.openclaw/openclaw.json`:
   ```json5
   {
     plugins: {
       entries: {
         recordare: {
           enabled: true,
           // Required: the capture and recall hooks read the conversation.
           hooks: { allowConversationAccess: true },
           config: {
             url: "http://localhost:8080",
             apiKey: "${RECORDARE_API_KEY}",   // rp_… or rk_…; ${VAR} is read from the environment
             selfSenders: ["telegram:123456789"], // your own sender ids: you are the memory's "I"
             // defaultUser: "my-agent",         // with a client key: the agent's Recordare account
           },
         },
       },
     },
   }
   ```
   `allowPromptInjection: false` on the entry would block the recall block (the plugin still captures).

### Options

| Option | Default | Meaning |
|---|---|---|
| `url` | `RECORDARE_URL` | Recordare's address |
| `apiKey` | `RECORDARE_API_KEY` | Client key (`rk_…`) or personal token (`rp_…`) |
| `memoryPer` | `agent` | `agent`: one memory for the agent, every sender a participant of it. `user`: one memory per person (`users`) |
| `defaultUser` | — (`me` with a personal token) | `agent`: the agent's Recordare account (client key; without it memory is off). `user`: the user of turns without a channel sender |
| `selfSenders` | `[]` | `agent`: the `"<channel>:<senderId>"` ids that are the account holder — the memory's "I". Turns without a channel sender (CLI, Control UI) are always theirs |
| `users` | `{}` | `user`: `"<channel>:<senderId>"` → Recordare user. Unmapped senders are not remembered |
| `autoRecall` | `true` | Add the memory block before each turn |
| `capture` | `true` | Send the conversations |
| `tools` | `true` | Offer the `recordare_*` tools |
| `groups` | `true` | Capture group chats too |
| `timeoutMs` | `3000` | For the call before the turn (the message's ingest with its context) |

**Your own sender ids.** With `memoryPer: "agent"` a sender not in `selfSenders` is somebody the agent knows, not you:
list your ids there (or have the admin bind them to the memory's self, `POST api/v1/admin/identities`
`{kind: "participant", ownerScope, personId: <the memory>, channel, externalId}`, before you first write). Other
people's words are kept as theirs (role `other`, attributed to their contact), so what they say about themselves never
becomes a fact about you.

**Upgrading from a `users` map.** The earlier behaviour (each mapped sender a separate Recordare user, unmapped senders
not remembered) is `memoryPer: "user"`: add it to keep your memories split per person.

### Several people on one Gateway
OpenClaw's default `session.dmScope: "main"` puts **all direct messages of all people into one session**. Every message
is still attributed to its sender, but the agent sees one person's turns in another's context. Set
```json5
{ session: { dmScope: "per-channel-peer" } }
```
(or `per-peer` with `session.identityLinks` for people who write from several channels). Check with
`openclaw security audit`. Recordare answers with the whole memory in every conversation (D50): what one person told
the agent can come up with another; whoever runs the Gateway tells the people who talk to it.

## How it maps

| OpenClaw | Recordare |
|---|---|
| session (key + session id) | conversation `openclaw:<sessionKey>/<sessionId>` (channel `openclaw:<channel>`, title = session key) |
| the agent (`memoryPer: agent`) — or `<channel>:<senderId>` (`users`) / `defaultUser` (`memoryPer: user`) | the memory (`X-Recordare-User` with a client key; the token's memory otherwise) |
| a sender (`memoryPer: agent`) | the account holder (`selfSenders`, CLI, Control UI): participant `owner`, message `user`; anyone else: participant `<channel>:<senderId>` with the channel identity `{channel, externalId: senderId}` and their channel name (from `message_received`), message `other` — Recordare links it to a contact of the memory, created on first sight |
| the person's message (`before_prompt_build`) | message (as above), id `<currentUserMessageId or runId>:u`, stored **before** the agent runs, in the same call that returns the memory block (so what the agent stores with `recordare_remember` binds to the person's own words); a plain ingest when `autoRecall` is off |
| the agent's text after it (`agent_end`) | message `assistant`, id `<runId>:a` (tool calls and results are not sent) |
| other members' messages in a group (`message_received`) | messages `other`, author `<channel>:<senderId>` (participant with a channel identity); the account holder's own as `user` (`memoryPer: agent`) |
| session end (`session_end`: new, reset, idle, daily, deleted) | `POST api/v1/ingest/conversations/{id}/end` → extraction now instead of after the idle delay (not on compaction, shutdown or restart) |
| memory block | `prependContext` of `before_prompt_build` (model-only in OpenClaw; never sent back to Recordare — the plugin strips it) |
| cron, heartbeat, sub-agent, agent-to-agent and incognito runs | not remembered |

## Smoke test

`SMOKE_DIR=<scratch dir> connectors/openclaw/smoke.sh` runs the whole loop against a local Recordare with OpenClaw in
Docker (throwaway state dir, three LLM turns): see the header of [smoke.sh](smoke.sh). Unit tests: `npm test`.

Licence: AGPL-3.0-or-later, like Recordare.
