# Recordare per OpenAI Codex

Dà a Codex (CLI; l'estensione per IDE e l'app desktop condividono il suo nucleo e la sua configurazione) una memoria
episodica a lungo termine tenuta dal tuo servizio [Recordare](../../README_it.md) — il livello client **completo**:

- **Cattura**: ogni richiesta e ogni risposta vanno a Recordare (hook `UserPromptSubmit` e `Stop`); a fine sessione
  Recordare estrae ciò che è successo, piani, fatti e note (`SessionEnd`).
- **Richiamo prima di ogni richiesta**: i ricordi rilevanti per ciò che hai appena scritto vengono aggiunti al turno in
  un blocco delimitato `<memory-context>`, che Codex passa al modello come messaggio developer (`POST api/v1/context`,
  nessuna chiamata LLM, nulla se nulla è rilevante).
- **Strumenti di memoria** (MCP): `search_episodes`, `search_memory`, `resolve_period`, `log_episode`, `remember`,
  `correct_episode`, `forget_episode`. Ciò che l'agente scrive vale come tuo solo se lo dicono le tue parole recenti
  (altrimenti attende la tua conferma nel diario).

Recordare conserva ogni turno che gli hook inviano (non ha un flag di consenso, D50): per smettere, disattivare il
plugin. Gli hook non bloccano mai Codex: se Recordare non risponde, il turno prosegue senza memoria.

**Di chi è la memoria** (D50): il token personale apre una sola memoria — quella del tuo agente, in cui tu sei l'"io"
(una memoria `personal`: sei insieme il suo utente e il suo agente). La stessa
memoria può servire anche i tuoi altri agenti (un altro token o client). La modalità e il genere della sua prima persona
li imposta l'amministratore (`PATCH api/v1/admin/owners/{id}` `{mode, gender}`; `gender` `masculine` per default,
`feminine`, `neutral`); il plugin non ha impostazioni per questi valori.

## Installazione

1. Chiedi all'amministratore di Recordare un **token personale** con gli scope `mcp`, `ingest` e `read` (console admin →
   la tua memoria → token, client di tipo `mcp_client`; oppure `POST api/v1/admin/owners/{id}/tokens`).
2. Avvia l'installer (serve Node.js ≥ 18 nel PATH; niente sudo). Da una copia del repository:
   ```sh
   connectors/codex/install.sh --url http://localhost:8090
   ```
   oppure senza:
   ```sh
   curl -fsSL https://raw.githubusercontent.com/arkimedehq/recordare/main/connectors/codex/install.sh | bash -s -- --url http://localhost:8090
   ```
   Chiede il token (input nascosto; oppure imposta `RECORDARE_TOKEN` nell'ambiente — il token non è mai accettato come
   argomento, così resta fuori dalla cronologia della shell), lo verifica con `GET api/v1/me` e si può rilanciare senza
   problemi.
3. **Dai fiducia agli hook.** Codex esegue un nuovo hook utente solo dopo che gli hai dato fiducia: apri `codex`, scrivi
   **`/hooks`** e dai fiducia ai tre hook di Recordare. Fino ad allora nulla viene catturato né richiamato (gli
   strumenti MCP funzionano comunque). `install.sh --trust` (oppure `RECORDARE_TRUST_HOOKS=1`) registra invece la
   fiducia in `config.toml`; usa il formato interno di hash degli hook di Codex (verificato con Codex 0.161.0), quindi
   se una versione successiva di Codex li mostra di nuovo come non fidati, dagli fiducia in `/hooks`.
4. Verifica: `codex mcp list` mostra `recordare`; dopo una breve sessione la conversazione compare nella console di
   Recordare.

Per rimuovere tutto: `connectors/codex/install.sh uninstall`.

## Cosa scrive l'installer

Ogni file che modifica viene prima copiato in `<file>.bak-<timestamp>`.

| File | Contenuto |
|---|---|
| `~/.config/recordare/codex.json` (modo 600) | `{"url", "token"}` — letto dagli hook e dall'helper delle intestazioni MCP (rispetta `XDG_CONFIG_HOME`) |
| `$CODEX_HOME/recordare/recordare-hook.mjs` | lo script degli hook (`CODEX_HOME` vale `~/.codex` di default) |
| `$CODEX_HOME/hooks.json` | tre handler `node "…/recordare-hook.mjs" codex`: `UserPromptSubmit` (10 s), `Stop` (15 s), `SessionEnd` (3 s, il limite di Codex); gli altri tuoi hook restano |
| `$CODEX_HOME/config.toml` | un blocco marcato (`# >>> recordare` … `# <<< recordare`) con `[mcp_servers.recordare]`: `url = "<url>/mcp"` e `http_headers_helper`, che stampa l'intestazione `Authorization` da `codex.json` — il token non viene salvato in `config.toml`; con `--trust`, anche le voci `[hooks.state."…"]` |

L'installer scrive da sé il blocco MCP perché `codex mcp add` non sa impostare un helper per le intestazioni. Una
tabella `[mcp_servers.recordare]` già presente e non scritta da lui viene prima rimossa con `codex mcp remove recordare`.

**Configurazione.** Lo script degli hook legge prima `RECORDARE_URL` / `RECORDARE_TOKEN` dall'ambiente, poi
`~/.config/recordare/codex.json`. Alternativa per il server MCP se preferisci una variabile d'ambiente all'helper:
`bearer_token_env_var = "RECORDARE_TOKEN"` nella tabella (allora `RECORDARE_TOKEN` deve essere impostata ovunque parta
Codex, IDE e app compresi).

## Corrispondenze

| Codex | Recordare |
|---|---|
| sessione (thread; sopravvive a `codex resume`) | conversazione `codex:<id sessione>` (canale `codex`, titolo = cartella del progetto) |
| la tua richiesta / la risposta di Codex | messaggi `user` / `assistant` (`last_assistant_message`; se vuoto, l'ultimo messaggio dell'agente nel file rollout). Le chiamate a strumenti non vengono inviate |
| turni dei sotto-agenti (payload con `agent_id`) | non inviati |
| fine sessione (`SessionEnd`) | `POST …/conversations/{id}/end` → estrazione subito invece che dopo il ritardo di inattività |

Lo script degli hook è lo stesso file del connettore Claude Code (`node recordare-hook.mjs codex`); le due copie sono
mantenute identiche byte per byte da `connectors/check-shared.sh`, eseguito in CI.

## Limiti

- Gli hook girano solo dopo la fiducia (passo 3); gli amministratori possono disattivare del tutto gli hook utente
  (`allow_managed_hooks_only` in `requirements.toml`).
- `SessionEnd` ha un limite di 3 s in Codex: se Recordare non risponde entro 2,5 s il segnale di fine va perso e
  l'estrazione avviene dopo il ritardo di inattività. Lo stesso vale per una sessione che non si chiude in modo pulito.
- I rollout compressi (`.jsonl.zst`) non vengono letti; contano solo quando Codex invia un `last_assistant_message`
  vuoto.
- Codex ha una sua funzione di memoria (`[features] memories`); è indipendente da Recordare e possono convivere.
  Recordare è quella condivisa fra le tue piattaforme.
- Verificato con la CLI di Codex 0.161.0; l'estensione per IDE e l'app desktop non sono state provate.

## Prova senza un modello a pagamento

`test/mock-responses.mjs` è una piccola imitazione della Responses API di OpenAI (Codex parla solo quella) che dà
sempre la stessa risposta e registra ogni richiesta, così puoi verificare che il blocco `<memory-context>` sia arrivato
al modello:

```sh
node connectors/codex/test/mock-responses.mjs 8799 /tmp/mock-requests.jsonl &
T=$(mktemp -d); export HOME=$T CODEX_HOME=$T/.codex     # mai il tuo vero ~/.codex
RECORDARE_URL=http://localhost:8090 RECORDARE_TOKEN=rp_… connectors/codex/install.sh --trust
codex exec --json --skip-git-repo-check \
  -c 'model_provider="mock"' -c 'model_providers.mock.name="mock"' \
  -c 'model_providers.mock.base_url="http://127.0.0.1:8799/v1"' -c 'model_providers.mock.wire_api="responses"' \
  -c 'model="mock-model"' "Mia sorella si chiama Giulia." </dev/null
```

`--dangerously-bypass-hook-trust` esegue gli hook non fidati per una sola
invocazione.

Licenza: AGPL-3.0-or-later, come Recordare.
