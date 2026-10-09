# Recordare per Claude Code

Un plugin di Claude Code che dà a Claude una memoria episodica a lungo termine tenuta dal tuo servizio
[Recordare](../../README_it.md) — il livello client **completo**:

- **Cattura**: ogni richiesta e ogni risposta vanno a Recordare (hook `UserPromptSubmit` e `Stop`); a fine sessione
  Recordare estrae ciò che è successo, piani, fatti e note (`SessionEnd`).
- **Richiamo prima di ogni richiesta**: i ricordi rilevanti per ciò che hai appena scritto vengono aggiunti al turno in
  un blocco delimitato `<memory-context>` (`POST api/v1/context`, nessuna chiamata LLM, nulla se nulla è rilevante).
- **Strumenti di memoria** (MCP): `search_episodes`, `search_memory`, `resolve_period`, `log_episode`, `remember`,
  `correct_episode`, `forget_episode`. Ciò che l'agente scrive vale come tuo solo se lo dicono le tue parole recenti
  (altrimenti attende la tua conferma nel diario).

Recordare conserva ogni turno che gli hook inviano (non ha un flag di consenso, D50): per smettere, disattivare il
plugin. Gli hook non bloccano mai Claude Code: se Recordare non risponde, il turno prosegue senza memoria.

## Installazione

1. Chiedi all'amministratore di Recordare un **token personale** con gli scope `mcp`, `ingest` e `read` (console admin →
   la tua persona → token, client di tipo `mcp_client`; oppure `POST api/v1/admin/owners/{id}/tokens`).
2. In Claude Code:
   ```
   /plugin marketplace add arkimedehq/recordare
   /plugin install recordare@recordare
   ```
   Claude Code chiede le opzioni del plugin: **url** (per esempio `http://localhost:8090`) e **token** (salvato nel
   portachiavi di sistema).
3. Serve Node.js ≥ 18 nel PATH (gli hook sono un piccolo script senza dipendenze).

In alternativa alle opzioni (per esempio con `claude -p` o in CI): gli hook usano `RECORDARE_URL` e `RECORDARE_TOKEN`
dall'ambiente, oppure il file `~/.config/recordare/claude-code.json` (`{"url", "token"}`, modo 600); gli strumenti MCP
richiedono le opzioni del plugin.

## Corrispondenze

| Claude Code | Recordare |
|---|---|
| sessione | conversazione `claude-code:<id sessione>` (canale `claude-code`, titolo = cartella del progetto) |
| la tua richiesta / la risposta di Claude | messaggi `user` / `assistant` (chiamate a strumenti e sotto-agenti non vengono inviati) |
| fine sessione | `POST …/conversations/{id}/end` → estrazione subito invece che dopo il ritardo di inattività |

Lo script degli hook (`scripts/recordare-hook.mjs`) è condiviso con il [connettore Codex](../codex/README_it.md); le
due copie devono restare identiche byte per byte (`connectors/check-shared.sh`, eseguito in CI): modificane una e
copiala nell'altra.

Prova senza installare: `RECORDARE_URL=… RECORDARE_TOKEN=rp_… claude -p --plugin-dir connectors/claude-code "…"`.

Licenza: AGPL-3.0-or-later, come Recordare.
