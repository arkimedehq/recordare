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

**Di chi è la memoria** (D50): il token personale apre una sola memoria — quella del tuo agente, in cui tu sei l'"io"
(una memoria `personal`: sei insieme il suo utente e il suo agente). La stessa
memoria può servire anche i tuoi altri agenti (un altro token o client). La modalità e il genere della sua prima persona
li imposta l'amministratore (`PATCH api/v1/admin/memories/{id}` `{mode, gender}`; `gender` `masculine` per default,
`feminine`, `neutral`) oppure lo stesso token personale, se ha lo scope `ingest` (`PATCH api/v1/me {mode?, gender?}`; la
modalità solo finché la memoria è vuota); il plugin non ha impostazioni per questi valori.

## Contratto memory-first (D54)

- **La carta della memoria a inizio sessione**: un hook `SessionStart` legge la carta della memoria
  (`GET api/v1/charter`: come l'agente usa la sua memoria — la sua mente, da consultare prima degli altri strumenti e
  prima di dire che non sa) e la aggiunge come contesto per tutta la sessione, quanto di più vicino al prompt di sistema
  permettono gli hook; viene ripetuto dopo `/clear` e dopo una compattazione. Il server MCP invia la stessa carta come
  sue `instructions`, che Claude Code mette anch'esso nel prompt di sistema: l'hook la garantisce anche quando il server
  MCP non è connesso.
- **Il contesto di memoria prima di ogni richiesta**, aperto dalla scheda di sé (chi sono; attiva per default in
  Recordare). Una breve domanda di seguito ("e lui?") viene collegata al turno precedente da Recordare stesso.
- **Le iniziative nel turno** (Recordare 0.7.0, D55): il contesto di memoria porta anche ciò che l'agente voleva dire
  o chiedere a chi sta parlando — un promemoria richiesto, "com'è andata?", "hai steso i panni?" — offerto una volta,
  senza configurazione; la carta della memoria (`charter.v2`) dice come usarlo. Dalla 0.8.0 l'hook chiede anche le
  ricerche (`initiatives: {lookups: true}`): l'agente ha degli strumenti, quindi una verifica che la memoria vuole fare
  può essergli affidata nel turno.
- **Ripiego**: se Recordare non risponde, niente carta e niente blocco — la sessione e il turno proseguono senza
  memoria.

## Installazione

1. Chiedi all'amministratore di Recordare un **token personale** con gli scope `mcp`, `ingest` e `read` (console admin →
   la tua memoria → token, client di tipo `mcp_client`; oppure `POST api/v1/admin/memories/{id}/tokens`).
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
| inizio sessione (anche dopo `/clear` o una compattazione) | `GET api/v1/charter` → la carta della memoria come contesto della sessione (D54) |
| fine sessione | `POST …/conversations/{id}/end` → estrazione subito invece che dopo il ritardo di inattività |

Lo script degli hook (`scripts/recordare-hook.mjs`) è condiviso con il [connettore Codex](../codex/README_it.md); le
due copie devono restare identiche byte per byte (`connectors/check-shared.sh`, eseguito in CI): modificane una e
copiala nell'altra.

Test unitari dello script di hook: `node --test connectors/codex/test/hook.test.mjs` (la copia di Codex è lo stesso
file).
Prova senza installare: `RECORDARE_URL=… RECORDARE_TOKEN=rp_… claude -p --plugin-dir connectors/claude-code "…"`.

Licenza: AGPL-3.0-or-later, come Recordare.
