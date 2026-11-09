// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

// Recordare admin console (WORK_PLAN 6.9): a thin page over the admin API. The admin key stays in this tab's
// sessionStorage and goes only to this origin; data is always inserted as text (never as HTML).
'use strict';

const T = {
  it: {
    persons: 'Persone', clients: 'Client', logout: 'Esci', signIn: 'Accesso amministratore',
    signInHint: 'Inserisci la chiave admin di Recordare (ADMIN_API_KEY). Resta solo in questa scheda.', enter: 'Entra',
    badKey: 'Chiave non valida.', newPerson: 'Nuova persona', newClient: 'Nuovo client',
    personal: 'personale', entity: 'condivisa', mode: 'Modo della memoria',
    modePersonal: 'Personale', modeEntity: 'Condivisa (entità)', profile: 'Profilo qualità', profileDefault: 'predefinito',
    gender: 'Genere della prima persona', masculine: 'Maschile', feminine: 'Femminile', neutral: 'Neutro', contacts: 'contatti',
    account: 'account', participant: 'partecipante',
    name: 'Nome', rename: 'Rinomina', renameHint: 'Se la persona è collegata a un client, il nome segue il suo profilo lì e verrà riscritto.',
    messages: 'messaggi', pending: 'da estrarre', episodes: 'episodi', facts: 'fatti', notes: 'note', last: 'ultimo messaggio',
    identities: 'Identità collegate', none: 'nessuna', noneM: 'nessuno', unlink: 'Scollega', link: 'Collega un utente di un client',
    people: 'Persone', merge: 'Unisci', mergeInto: 'in', mentions: 'citazioni',
    mergeConfirm: 'Unire le due schede? La prima confluisce nella seconda (nomi, indirizzi, ricordi, iniziative); non si può annullare.',
    address: 'Collega un indirizzo', addressChannel: 'canale (es. homeassistant, telegram)', addressId: 'id (es. person.chloe)',
    externalId: 'id utente nel client', tokens: 'Token personali', newToken: 'Nuovo token', revoke: 'Revoca',
    consolidate: 'Consolida ora', consolidated: 'Consolidamento eseguito', saved: 'Salvato',
    modeConfirm: 'La memoria contiene già ricordi: cambiare modo mescola ricordi in prima persona e ricordi di "qualcuno". Continuare?',
    unlinkConfirm: 'Scollegare questa identità? Quell\'utente del client non raggiungerà più questa memoria (i ricordi restano).',
    revokeConfirm: 'Revocare? Smette di funzionare subito.',
    keys: 'Chiavi', newKey: 'Nuova chiave', newKeyScopes: 'Permessi per una nuova chiave:', scopes: 'permessi', autoProvision: 'Crea le persone al primo contatto',
    disabled: 'Disabilitato', active: 'attivo', disableConfirm: 'Disabilitare il client? Tutte le sue chiavi e i token smettono di funzionare.',
    clientName: 'Nome del client', kindLabel: 'Tipo', personName: 'Nome della persona', create: 'Crea', cancel: 'Annulla',
    secretTitle: 'Copia ora il segreto', secretHint: 'Non verrà più mostrato: Recordare ne conserva solo l\'impronta.',
    copy: 'Copia', close: 'Chiudi', copied: 'Copiato', client: 'client', never: 'mai', used: 'usato', search: 'Cerca per nome',
    shown: '{n} di {total}',
    linkCode: 'Codice di collegamento', linkCodeHint: 'Il titolare lo invia all\'agente dal canale, in chat diretta, entro 10 minuti; poi la richiesta si conferma qui.',
    claims: 'Da confermare', isHolder: 'È il titolare', notHolder: 'Non è il titolare',
    claimConfirm: 'Da ora i messaggi di questo mittente saranno del titolare ("io"); i messaggi passati restano come sono. Confermare?',
    save: 'Salva', locale: 'Lingua (BCP 47)', timezone: 'Fuso orario', quiet: 'Ore di quiete (nessuna iniziativa)', from: 'dalle', to: 'alle', perceptionKeep: 'Percezioni conservate per', days: 'giorni', installDefault: 'predefinito',
    run: 'Esegui ora', reviewFacts: 'Revisione fatti', patterns: 'Abitudini', thoughts: 'Pensieri', initiatives: 'Iniziative', done: 'Eseguito',
    tokenScopes: 'Permessi del nuovo token:', erase: 'Cancella la memoria',
    eraseConfirm: 'Cancellare per sempre TUTTA la memoria di «{name}»? Scrivi il nome per confermare.', erased: 'Memoria cancellata',
    rawLog: 'Estratti del registro grezzo', rawOwn: 'solo conversazioni di questo client', rawAll: 'tutte le conversazioni',
    channels: 'Canali (iniziative)', chNone: 'no', chAlways: 'sempre', chPresence: 'con presenza',
    chat: 'chat', messaging: 'messaggistica', voice: 'voce',
    webhooks: 'Webhook (iniziative)', webhookUrl: 'URL (https, o http interno se WEBHOOK_ALLOW_PRIVATE)', description: 'Descrizione',
    events: 'eventi', allEvents: 'tutti', register: 'Registra', removeConfirm: 'Rimuovere il webhook? Il client non riceverà più le iniziative qui.',
    helpsShow: 'Mostra aiuti', helpsHide: 'Nascondi aiuti', helpLabel: 'cos\'è?', connected: 'collegato', signedOut: 'non collegato',
    expandAll: 'Apri tutte', collapseAll: 'Chiudi tutte',
    remove: 'Rimuovi', webhookSecret: 'Segreto del webhook (whsec_): dallo al client, non verrà più mostrato.',
  },
  en: {
    persons: 'People', clients: 'Clients', logout: 'Sign out', signIn: 'Administrator sign-in',
    signInHint: 'Enter Recordare\'s admin key (ADMIN_API_KEY). It stays in this tab only.', enter: 'Sign in',
    badKey: 'Invalid key.', newPerson: 'New person', newClient: 'New client',
    personal: 'personal', entity: 'shared', mode: 'Memory mode',
    modePersonal: 'Personal', modeEntity: 'Shared (entity)', profile: 'Quality profile', profileDefault: 'default',
    gender: 'First-person gender', masculine: 'Masculine', feminine: 'Feminine', neutral: 'Neutral', contacts: 'contacts',
    account: 'account', participant: 'participant',
    name: 'Name', rename: 'Rename', renameHint: 'If the person is linked to a client, the name follows their profile there and will be overwritten.',
    messages: 'messages', pending: 'to extract', episodes: 'episodes', facts: 'facts', notes: 'notes', last: 'last message',
    identities: 'Linked identities', none: 'none', noneM: 'none', unlink: 'Unlink', link: 'Link a client\'s user',
    people: 'People', merge: 'Merge', mergeInto: 'into', mentions: 'mentions',
    mergeConfirm: 'Merge the two cards? The first goes into the second (names, addresses, memories, initiatives); it cannot be undone.',
    address: 'Link an address', addressChannel: 'channel (e.g. homeassistant, telegram)', addressId: 'id (e.g. person.chloe)',
    externalId: 'user id in the client', tokens: 'Personal tokens', newToken: 'New token', revoke: 'Revoke',
    consolidate: 'Consolidate now', consolidated: 'Consolidation done', saved: 'Saved',
    modeConfirm: 'The memory already holds memories: changing its mode mixes first-person memories with "someone"\'s. Continue?',
    unlinkConfirm: 'Unlink this identity? That client user will no longer reach this memory (memories stay).',
    revokeConfirm: 'Revoke? It stops working at once.',
    keys: 'Keys', newKey: 'New key', newKeyScopes: 'Scopes for a new key:', scopes: 'scopes', autoProvision: 'Create people on first contact',
    disabled: 'Disabled', active: 'active', disableConfirm: 'Disable the client? All its keys and tokens stop working.',
    clientName: 'Client name', kindLabel: 'Kind', personName: 'Person\'s name', create: 'Create', cancel: 'Cancel',
    secretTitle: 'Copy the secret now', secretHint: 'It will not be shown again: Recordare keeps only its hash.',
    copy: 'Copy', close: 'Close', copied: 'Copied', client: 'client', never: 'never', used: 'used', search: 'Search by name',
    shown: '{n} of {total}',
    linkCode: 'Link code', linkCodeHint: 'The holder sends it to the agent from the channel, in a direct chat, within 10 minutes; then the claim is confirmed here.',
    claims: 'To confirm', isHolder: 'It is the holder', notHolder: 'Not the holder',
    claimConfirm: 'From now on this sender\'s messages will be the holder\'s ("I"); past messages stay as they are. Confirm?',
    save: 'Save', locale: 'Language (BCP 47)', timezone: 'Time zone', quiet: 'Quiet hours (no initiative)', from: 'from', to: 'to', perceptionKeep: 'Perceptions kept for', days: 'days', installDefault: 'default',
    run: 'Run now', reviewFacts: 'Facts review', patterns: 'Habits', thoughts: 'Thoughts', initiatives: 'Initiatives', done: 'Done',
    tokenScopes: 'Scopes for a new token:', erase: 'Erase the memory',
    eraseConfirm: 'Erase ALL of «{name}»\'s memory for good? Type the name to confirm.', erased: 'Memory erased',
    rawLog: 'Raw-log excerpts', rawOwn: 'this client\'s conversations only', rawAll: 'all conversations',
    channels: 'Channels (initiatives)', chNone: 'no', chAlways: 'always', chPresence: 'on presence',
    chat: 'chat', messaging: 'messaging', voice: 'voice',
    webhooks: 'Webhooks (initiatives)', webhookUrl: 'URL (https, or internal http with WEBHOOK_ALLOW_PRIVATE)', description: 'Description',
    events: 'events', allEvents: 'all', register: 'Register', removeConfirm: 'Remove the webhook? The client will no longer receive initiatives here.',
    helpsShow: 'Show help', helpsHide: 'Hide help', helpLabel: 'what is it?', connected: 'connected', signedOut: 'not connected',
    expandAll: 'Open all', collapseAll: 'Close all',
    remove: 'Remove', webhookSecret: 'The webhook\'s secret (whsec_): give it to the client, it will not be shown again.',
  },
};

/** What every field means, for someone who is not a developer (shown under each field; maintainer, 2026-11-04). */
const HELP = {
  it: {
    introPersons: 'Ogni scheda è una memoria: quella di una persona (personale) o di un agente condiviso da più persone, come l\'assistente di casa (condivisa). Qui si sceglie come ricorda, come si collega ai programmi che la usano e quando può prendere iniziativa.',
    introClients: 'Un client è un programma che usa Recordare (Arkimede, Claude Code, un plugin…). Ognuno ha le sue chiavi, i canali con cui raggiunge le persone e gli indirizzi (webhook) dove riceve ciò che la memoria vuole dire di sua iniziativa.',
    mode: 'Personale: la memoria è di una persona e scrive "io" per lei. Condivisa: è di un agente che parla con più persone; chi non si identifica è "qualcuno". Si cambia di solito solo finché la memoria è vuota.',
    gender: 'Il genere grammaticale con cui la memoria parla di sé in prima persona (es. "sono andato" / "sono andata"). Conta solo nelle lingue che lo distinguono.',
    profile: 'Quanto lavoro fa il modello per capire e ricordare. Economy: costa meno. Balanced: equilibrio (consigliato). Full: massima qualità, costa di più. "Predefinito" usa l\'impostazione dell\'installazione.',
    name: 'Il nome della memoria (della persona o dell\'agente). Se un client la collega a un profilo, il nome segue quello del client.',
    locale: 'La lingua in cui la memoria scrive i suoi ricordi e le sue iniziative, come codice BCP 47: it, en, es, pt-BR…',
    timezone: 'Il fuso orario della persona: serve per capire "domani", "stasera", le ore di quiete e l\'ora dei promemoria.',
    quiet: 'Le ore in cui la memoria non disturba: nessun messaggio spontaneo, salvo un promemoria chiesto proprio per quell\'ora.',
    perceptionKeep: 'Quanto la memoria ricorda ciò che i sensori dell\'agente hanno notato (una telecamera, un sensore) prima che svanisca. Vuoto: il valore dell\'installazione; 0: per sempre. Ciò che una persona ne ha detto resta.',
    identities: 'Chi può aprire questa memoria: un "account" è un utente di un client (es. l\'utente di Arkimede) che arriva qui. Scollegare non cancella i ricordi.',
    merge: 'La stessa persona conosciuta due volte (es. "Eriona" e "Eriona Rossi"): la prima scheda confluisce nella seconda, che tiene tutti i nomi, gli indirizzi, ciò che la memoria sa di lei e ciò che intende dirle. Le citazioni aiutano a scegliere quale tenere.',
    address: 'Come raggiungere una persona di questa memoria e riconoscerla (D55): la persona di Home Assistant (canale homeassistant, id person.chloe), la chat Telegram (canale telegram, id del chat). L\'agente la usa per consegnarle un\'iniziativa a voce o per messaggio, e per sapere chi è quando la vede.',
    link: 'Collega un utente di un client a questa memoria: scegli il client e scrivi l\'id che quel client usa per l\'utente.',
    linkCode: 'Un codice monouso per riconoscere il titolare quando scrive da un altro canale (es. Telegram): lo invia all\'agente in chat diretta, poi confermi qui.',
    claims: 'Richieste arrivate con un codice di collegamento: conferma solo se quel mittente è davvero il titolare.',
    tokens: 'Chiavi personali di questa memoria, per un programma che la usa direttamente (es. Claude Code). Si mostrano una sola volta alla creazione: copiale subito.',
    actions: 'Di notte la memoria riordina da sola. Questi pulsanti la fanno lavorare subito: Consolida (diario del giorno e del mese), Revisione fatti, Abitudini, Pensieri, Iniziative (cosa dire di sua iniziativa).',
    erase: 'Cancella per sempre tutta la memoria: ricordi, conversazioni, identità. Non si può annullare.',
    autoProvision: 'Se attivo, quando il client presenta un utente nuovo Recordare gli crea subito una memoria. Se spento, va collegato a mano qui.',
    disabled: 'Ferma subito tutte le chiavi e i token di questo client, senza cancellare nulla. Si può riattivare.',
    rawLog: 'Quando l\'agente cerca nelle vecchie conversazioni: solo in quelle avvenute in questo client, o in tutte quelle della memoria.',
    channels: 'Come il client raggiunge una persona quando la memoria vuole dirle qualcosa di sua iniziativa. Sempre: il messaggio arriva comunque (chat, messaggistica). Con presenza: solo quando l\'agente vede o sente la persona (voce). No: canale assente.',
    webhooks: 'L\'indirizzo del client dove Recordare invia ciò che la memoria vuole dire. Alla registrazione ricevi un segreto (whsec_…) da dare al client: si mostra una sola volta.',
    webhookUrl: 'https e un indirizzo pubblico; un indirizzo interno (es. http://backend:3000/…) solo se il server ha WEBHOOK_ALLOW_PRIVATE=true.',
    keys: 'Le chiavi con cui il client usa Recordare. Si mostrano una sola volta alla creazione. Dai solo i permessi che servono.',
    newClientKind: 'Platform: un\'applicazione con i suoi utenti (es. Arkimede). MCP client: un agente che usa gli strumenti di memoria (es. Claude Code). Import: solo per importare storici.',
    scopesLegend: 'ingest: invia conversazioni · mcp: strumenti di memoria per l\'agente · read: legge memoria e contesto · write: corregge e scrive ricordi · erase: cancella memorie intere · memory_settings: cambia le impostazioni della memoria · export: esporta la memoria',
    eventsLegend: 'deliver: "dillo adesso" — l\'unico che serve per consegnare; per un client che deve solo parlare (come Arkimede) basta questo. '
      + 'Gli altri sono solo informativi, per un client che vuole seguire la vita delle iniziative: '
      + 'created: decisa ma non ancora da dire (mostrare cosa arriva, prepararsi) · '
      + 'updated: cambiata di stato — offerta, detta, chiesta, rifiutata, fatta (una copia locale, una dashboard, sapere che un altro client l\'ha già detta) · '
      + 'expired: scaduta senza essere detta (togliere un promemoria locale, statistiche). '
      + 'Un client che non li usa li riceve inutilmente. Nessun evento spuntato = tutti e quattro.',
  },
  en: {
    introPersons: 'Each card is a memory: a person\'s own (personal) or that of an agent several people talk to, like the home assistant (shared). Here you choose how it remembers, how it is linked to the programs that use it, and when it may take initiative.',
    introClients: 'A client is a program that uses Recordare (Arkimede, Claude Code, a plugin…). Each has its keys, the channels it reaches people on, and the addresses (webhooks) where it receives what the memory wants to say on its own.',
    mode: 'Personal: the memory belongs to one person and writes "I" for them. Shared: it belongs to an agent that talks with several people; whoever is not identified is "someone". Usually changed only while the memory is empty.',
    gender: 'The grammatical gender the memory uses for itself in the first person. Matters only in languages that mark it.',
    profile: 'How much work the model does to understand and remember. Economy: cheapest. Balanced: the balance (recommended). Full: best quality, costs more. "Default" uses the installation\'s setting.',
    name: 'The memory\'s name (the person\'s or the agent\'s). When a client links it to a profile, the name follows the client\'s.',
    locale: 'The language the memory writes its memories and initiatives in, as a BCP 47 code: it, en, es, pt-BR…',
    timezone: 'The person\'s time zone: it resolves "tomorrow", "tonight", the quiet hours and when reminders are due.',
    quiet: 'Hours when the memory does not disturb: no message of its own, except a reminder asked for that very hour.',
    perceptionKeep: 'How long the memory keeps what the agent\'s senses noticed (a camera, a sensor) before it fades. Empty: the installation\'s value; 0: forever. What a person said about it stays.',
    identities: 'Who can open this memory: an "account" is a client\'s user (e.g. Arkimede\'s user) arriving here. Unlinking deletes no memory.',
    merge: 'The same person known twice (e.g. "Eriona" and "Eriona Rossi"): the first card goes into the second, which keeps every name, address, what the memory knows about them and what it means to tell them. The mentions help to choose which one to keep.',
    address: 'How to reach a person of this memory and recognise them (D55): their Home Assistant person (channel homeassistant, id person.chloe), their Telegram chat (channel telegram, the chat id). The agent uses it to deliver an initiative by voice or by message, and to know who it is when it sees them.',
    link: 'Link a client\'s user to this memory: pick the client and type the id that client uses for the user.',
    linkCode: 'A one-time code to recognise the holder writing from another channel (e.g. Telegram): they send it to the agent in a direct chat, then you confirm here.',
    claims: 'Claims made with a link code: confirm only if that sender really is the holder.',
    tokens: 'Personal keys of this memory, for a program that uses it directly (e.g. Claude Code). Shown once, when created: copy them at once.',
    actions: 'At night the memory tidies up on its own. These buttons make it work now: Consolidate (the day\'s and month\'s diary), Facts review, Habits, Thoughts, Initiatives (what to say on its own).',
    erase: 'Erases the whole memory for good: memories, conversations, identities. Cannot be undone.',
    autoProvision: 'When on, a new user presented by the client gets a memory at once. When off, link them here by hand.',
    disabled: 'Stops every key and token of this client at once, deleting nothing. Can be switched back on.',
    rawLog: 'Where the agent searches old conversations: only those held in this client, or all of the memory\'s.',
    channels: 'How the client reaches a person when the memory wants to tell them something on its own. Always: the message arrives anyway (chat, messaging). On presence: only when the agent sees or hears the person (voice). No: not available.',
    webhooks: 'The client\'s address where Recordare sends what the memory wants to say. Registering gives a secret (whsec_…) for the client: shown only once.',
    webhookUrl: 'https and a public address; an internal one (e.g. http://backend:3000/…) only when the server has WEBHOOK_ALLOW_PRIVATE=true.',
    keys: 'The keys the client uses Recordare with. Shown once, when created. Give only the scopes it needs.',
    newClientKind: 'Platform: an application with its users (e.g. Arkimede). MCP client: an agent using the memory tools (e.g. Claude Code). Import: only to import history.',
    scopesLegend: 'ingest: sends conversations · mcp: memory tools for the agent · read: reads the memory and its context · write: corrects and writes memories · erase: erases whole memories · memory_settings: changes the memory\'s settings · export: exports the memory',
    eventsLegend: 'deliver: "say it now" — the only one delivering needs; a client that only speaks (like Arkimede) needs just this. '
      + 'The others are information only, for a client that follows the initiatives\' life: '
      + 'created: decided but not due yet (show what is coming, get ready) · '
      + 'updated: its status changed — offered, said, asked, declined, done (a local copy, a dashboard, knowing another client already said it) · '
      + 'expired: lapsed unsaid (drop a local reminder, statistics). '
      + 'A client that does not use them receives them for nothing. No event ticked = all four.',
  },
};
/** A field's explanation, folded away behind a small "?" (all opened at once with the header's switch). */
const help = (...keys) => h('details', { class: 'help', open: helpsOpen },
  h('summary', {}, t('helpLabel')), keys.map((key) => h('p', {}, HELP[lang][key] ?? '')));
const PROFILES = ['economy', 'balanced', 'full'];
const KEY_SCOPES = ['ingest', 'mcp', 'read', 'write', 'erase'];
/** A personal token's scopes (never admin). */
const TOKEN_SCOPES = ['mcp', 'ingest', 'read', 'write', 'memory_settings', 'export', 'erase'];
const CHANNEL_KINDS = ['chat', 'messaging', 'voice'];
const EVENTS = ['initiative.created', 'initiative.deliver', 'initiative.updated', 'initiative.expired'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const TIMEZONES = (() => { try { return Intl.supportedValuesOf('timeZone'); } catch { return []; } })();
/** Checkboxes for a list of values; `on` says which start checked. */
const boxes = (values, on) => values.map((v) => h('label', { class: 'switch' }, h('input', { type: 'checkbox', value: v, checked: on(v) }), v));
const checked = (list) => list.map((l) => l.querySelector('input')).filter((i) => i.checked).map((i) => i.value);

const store = {
  get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch { /* private mode */ } },
};
let lang = store.get('lang') || ((navigator.language || 'it').startsWith('it') ? 'it' : 'en');
let adminKey = store.get('adminKey');
let tab = 'persons';
let clientsCache = [];
let personsCache = [];
/** Helps open everywhere (remembered in this browser). */
const prefs = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};
let helpsOpen = prefs.get('helpsOpen') === '1';
/** Cards open (kept across reloads of the list). */
const expanded = new Set();
const t = (k, vars = {}) => (T[lang][k] ?? k).replace(/\{(\w+)\}/g, (_, v) => vars[v] ?? '');
const $ = (id) => document.getElementById(id);

/** Element builder: attributes, event handlers (on*), children (strings become text nodes). */
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) el.append(c instanceof Node ? c : String(c));
  return el;
}

async function api(method, path, body) {
  const res = await fetch(`/api/v1/admin/${path}`, {
    method,
    headers: { authorization: `Bearer ${adminKey}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) { signOut(); throw new Error(t('badKey')); }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.detail || data?.title || data?.code || `${res.status}`);
  return data;
}

let toastTimer;
function toast(msg, error = false) {
  const el = $('toast');
  el.textContent = msg;
  el.className = error ? 'error' : '';
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3500);
}

/** Runs an action, reports its outcome, reloads the current tab. */
/** A person in a select: the name, and how often the memory mentions them (to tell two cards with one name apart). */
const personLabel = (x) => (x.self || x.mentions === undefined ? x.name : `${x.name} · ${x.mentions} ${t('mentions')}`);

async function act(fn, done = t('saved')) {
  try { await fn(); if (done) toast(done); } catch (e) { toast(e.message, true); }
  await render();
}

function showSecret(value) {
  $('secret-value').textContent = value;
  $('secret').showModal();
}

const when = (d) => (d ? new Date(d).toLocaleString(lang === 'it' ? 'it-IT' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' }) : t('never'));

/** A card that folds: the head (name, chips, counters) is a button; the body shows when open. */
function foldCard(id, head, ...body) {
  const open = expanded.has(id);
  const card = h('div', { class: `card panel${open ? ' open corner' : ''}` });
  const bodyEl = h('div', { class: 'card-body', hidden: !open }, ...body);
  const toggle = h('button', {
    class: 'card-head', type: 'button', 'aria-expanded': String(open),
    onclick: () => {
      const now = !expanded.has(id);
      if (now) expanded.add(id); else expanded.delete(id);
      card.classList.toggle('open', now); card.classList.toggle('corner', now);
      bodyEl.hidden = !now; toggle.setAttribute('aria-expanded', String(now));
    },
  }, h('span', { class: 'chev', 'aria-hidden': 'true' }), ...head);
  card.append(toggle, bodyEl);
  return card;
}

// ── People ─────────────────────────────────────────────────────────────────────

function personCard(p) {
  const hasMemories = p.episodes + p.facts + p.notes > 0;
  const mode = h('select', {
    onchange: (e) => {
      if (hasMemories && !confirm(t('modeConfirm'))) { e.target.value = p.mode; return; }
      act(() => api('PATCH', `memories/${p.id}`, { mode: e.target.value }));
    },
  }, h('option', { value: 'personal', selected: p.mode === 'personal' }, t('modePersonal')),
     h('option', { value: 'entity', selected: p.mode === 'entity' }, t('modeEntity')));
  const gender = h('select', {
    onchange: (e) => act(() => api('PATCH', `memories/${p.id}`, { gender: e.target.value })),
  }, ['masculine', 'feminine', 'neutral'].map((g) => h('option', { value: g, selected: p.gender === g }, t(g))));
  const profile = h('select', {
    onchange: (e) => act(() => api('PATCH', `memories/${p.id}`, { qualityProfile: e.target.value || null })),
  }, h('option', { value: '', selected: !p.qualityProfile }, t('profileDefault')),
     PROFILES.map((q) => h('option', { value: q, selected: p.qualityProfile === q }, q)));
  const nameInput = h('input', { value: p.name, maxlength: 200 });

  const clientOptions = () => clientsCache.map((c) => h('option', { value: c.id }, c.name));
  const linkClient = h('select', {}, clientOptions());
  const linkId = h('input', { placeholder: t('externalId') });
  const addressPerson = h('select', {}, (p.people ?? []).map((x) => h('option', { value: x.id }, personLabel(x))));
  // The memory's contacts (never its self) for a merge: the same person known twice.
  const contacts = (p.people ?? []).filter((x) => !x.self);
  const contactSelect = () => h('select', {}, contacts.map((x) => h('option', { value: x.id }, personLabel(x))));
  const mergeFrom = contactSelect();
  const mergeInto = contactSelect();
  const addressChannel = h('input', { placeholder: t('addressChannel'), list: `channels-${p.id}` });
  const addressId = h('input', { placeholder: t('addressId') });
  const tokenClient = h('select', {}, clientOptions());
  const tokenScopes = boxes(TOKEN_SCOPES, (v) => ['mcp', 'read', 'write'].includes(v));
  const patch = (body) => act(() => api('PATCH', `memories/${p.id}`, body));
  const localeInput = h('input', { value: p.locale ?? '', maxlength: 35, size: 8 });
  const tzList = `tz-${p.id}`;
  const tzInput = h('input', { value: p.timezone ?? '', list: tzList, size: 18 });
  // 8.12e: days a perception is kept before it fades; empty = the installation's default, 0 = kept.
  const keepInput = h('input', { type: 'number', min: 0, max: 3650, value: p.perceptionKeepDays ?? '', placeholder: t('installDefault'), style: 'width:6em' });
  const hourSelect = (value, key) => h('select', { onchange: (e) => patch({ [key]: Number(e.target.value) }) },
    HOURS.map((x) => h('option', { value: x, selected: Number(value) === x }, `${String(x).padStart(2, '0')}:00`)));
  const runNow = (path, label) => h('button', { class: 'ghost small', onclick: () => act(() => api('POST', `memories/${p.id}/${path}`), t('done')) }, label);

  return foldCard(p.id, [
    h('div', { class: 'head' },
      h('span', { class: 'name' }, p.name),
      h('span', { class: `chip ${p.mode === 'entity' ? 'warn' : ''}` }, t(p.mode)),
    ),
    h('div', { class: 'stats' },
      h('span', {}, h('b', {}, p.messages), ` ${t('messages')}`),
      h('span', {}, h('b', {}, p.pending), ` ${t('pending')}`),
      h('span', {}, h('b', {}, p.episodes), ` ${t('episodes')}`),
      h('span', {}, h('b', {}, p.facts), ` ${t('facts')}`),
      h('span', {}, h('b', {}, p.notes), ` ${t('notes')}`),
      h('span', {}, h('b', {}, p.contacts), ` ${t('contacts')}`),
      h('span', {}, `${t('last')}: ${when(p.lastMessage)}`),
    )],
    h('div', { class: 'grid' },
      h('label', { class: 'field' }, h('span', {}, t('mode')), mode, help('mode')),
      h('label', { class: 'field' }, h('span', {}, t('gender')), gender, help('gender')),
      h('label', { class: 'field' }, h('span', {}, t('profile')), profile, help('profile')),
      h('div', { class: 'field' }, h('span', { title: t('renameHint') }, `${t('name')} ⓘ`),
        h('div', { class: 'row' }, nameInput, h('button', {
          class: 'ghost small', onclick: () => nameInput.value.trim() && act(() => api('PATCH', `memories/${p.id}`, { displayName: nameInput.value.trim() })),
        }, t('rename'))), help('name')),
      h('div', { class: 'field' }, h('span', {}, t('locale')),
        h('div', { class: 'row' }, localeInput, h('button', { class: 'ghost small', onclick: () => localeInput.value.trim() && patch({ locale: localeInput.value.trim() }) }, t('save'))), help('locale')),
      h('div', { class: 'field' }, h('span', {}, t('timezone')),
        h('div', { class: 'row' }, tzInput, h('datalist', { id: tzList }, TIMEZONES.map((z) => h('option', { value: z }))),
          h('button', { class: 'ghost small', onclick: () => tzInput.value.trim() && patch({ timezone: tzInput.value.trim() }) }, t('save'))), help('timezone')),
      h('div', { class: 'field' }, h('span', {}, t('quiet')),
        h('div', { class: 'row' }, t('from'), hourSelect(p.quietFrom, 'quietFrom'), t('to'), hourSelect(p.quietTo, 'quietTo')), help('quiet')),
      h('div', { class: 'field' }, h('span', {}, t('perceptionKeep')),
        h('div', { class: 'row' }, keepInput, t('days'), h('button', {
          class: 'ghost small', onclick: () => patch({ perceptionKeepDays: keepInput.value.trim() === '' ? null : Number(keepInput.value) }),
        }, t('save'))), help('perceptionKeep')),
    ),
    h('div', { class: 'sub' },
      h('h4', {}, t('identities')), help('identities'),
      p.identities.length ? p.identities.map((i) => h('div', { class: 'item' },
        h('span', { class: 'chip' }, t(i.kind)), h('span', { class: 'chip' }, i.client ?? i.channel), h('code', {}, i.externalId),
        i.kind === 'participant' ? h('span', { class: 'muted' }, i.person) : null,
        h('button', { class: 'danger small', onclick: () => confirm(t('unlinkConfirm')) && act(() => api('DELETE', `identities/${i.id}`)) }, t('unlink')),
      )) : h('div', { class: 'muted' }, t('none')),
      clientsCache.length ? h('div', { class: 'row' }, linkClient, linkId, h('button', {
        class: 'ghost small',
        onclick: () => linkId.value.trim() && act(() => api('POST', 'identities',
          { kind: 'account', personId: p.id, clientId: linkClient.value, externalId: linkId.value.trim() })),
      }, t('link'))) : null,
      clientsCache.length ? help('link') : null,
      // D55 §5c: an address of one of its people (the self or a contact) — verified, it reaches and recognises them.
      h('datalist', { id: `channels-${p.id}` }, ['homeassistant', 'telegram', 'whatsapp', 'voice', 'face'].map((c) => h('option', { value: c }))),
      h('div', { class: 'row' }, addressPerson, addressChannel, addressId, h('button', {
        class: 'ghost small',
        onclick: () => addressChannel.value.trim() && addressId.value.trim() && act(() => api('POST', 'identities', {
          kind: 'participant', memoryId: p.id, personId: addressPerson.value, channel: addressChannel.value.trim(), externalId: addressId.value.trim(), verified: true,
        })),
      }, t('address'))),
      help('address'),
      // Two cards of the same person: the first goes into the second (engine/contacts.ts mergeContacts).
      contacts.length > 1 ? h('h4', {}, t('people')) : null,
      contacts.length > 1 ? h('div', { class: 'row' }, mergeFrom, t('mergeInto'), mergeInto, h('button', {
        class: 'ghost small',
        onclick: () => mergeFrom.value !== mergeInto.value && confirm(t('mergeConfirm'))
          && act(() => api('POST', `memories/${p.id}/persons/${mergeFrom.value}/merge`, { into: mergeInto.value })),
      }, t('merge'))) : null,
      contacts.length > 1 ? help('merge') : null,
      // D51: the holder's channel identities — a one-time code, then the claim it made is confirmed here.
      p.linkClaims.length ? h('h4', {}, t('claims')) : null,
      p.linkClaims.length ? help('claims') : null,
      ...p.linkClaims.map((c) => h('div', { class: 'item' },
        h('span', { class: 'chip' }, c.client ?? c.channel), h('code', {}, c.externalId),
        c.displayName ? h('span', { class: 'muted' }, c.displayName) : null, h('span', { class: 'muted' }, when(c.claimedAt)),
        h('button', { class: 'small', onclick: () => confirm(t('claimConfirm')) && act(() => api('POST', `memories/${p.id}/link-claims/${c.id}/confirm`)) }, t('isHolder')),
        h('button', { class: 'danger small', onclick: () => act(() => api('DELETE', `memories/${p.id}/link-claims/${c.id}`)) }, t('notHolder')),
      )),
      p.mode === 'personal' ? h('div', { class: 'row' }, h('button', {
        class: 'ghost small', title: t('linkCodeHint'),
        onclick: () => act(async () => showSecret((await api('POST', `memories/${p.id}/link-codes`)).code), null),
      }, `${t('linkCode')} ⓘ`)) : null,
      p.mode === 'personal' ? help('linkCode') : null,
    ),
    h('div', { class: 'sub' },
      h('h4', {}, t('tokens')), help('tokens'),
      p.tokens.length ? p.tokens.map((k) => h('div', { class: 'item' },
        h('code', {}, `${k.prefix}…`), h('span', { class: 'chip' }, k.client), h('span', { class: 'muted' }, k.scopes.join(', ')),
        h('span', { class: 'muted' }, `${t('used')}: ${when(k.lastUsedAt)}`),
        h('button', { class: 'danger small', onclick: () => confirm(t('revokeConfirm')) && act(() => api('DELETE', `tokens/${k.id}`)) }, t('revoke')),
      )) : h('div', { class: 'muted' }, t('noneM')),
      clientsCache.length ? h('div', { class: 'row' }, h('span', { class: 'muted' }, t('tokenScopes')), tokenScopes, tokenClient, h('button', {
        class: 'ghost small',
        onclick: () => {
          const scopes = checked(tokenScopes);
          if (scopes.length) act(async () => showSecret((await api('POST', `memories/${p.id}/tokens`, { clientId: tokenClient.value, scopes })).token), null);
        },
      }, t('newToken'))) : null,
      clientsCache.length ? help('scopesLegend') : null,
    ),
    h('div', { class: 'row actions' },
      h('button', { class: 'ghost small', onclick: () => act(() => api('POST', `memories/${p.id}/consolidate`), t('consolidated')) }, t('consolidate')),
      h('span', { class: 'muted' }, `${t('run')}:`),
      runNow('review-facts', t('reviewFacts')), runNow('patterns', t('patterns')), runNow('thoughts', t('thoughts')), runNow('initiatives', t('initiatives')),
      h('button', {
        class: 'danger small',
        onclick: () => {
          const typed = prompt(t('eraseConfirm', { name: p.name }));
          if (typed !== null && typed.trim() === p.name) act(() => api('DELETE', `memories/${p.id}?confirm=${encodeURIComponent(p.id)}`), t('erased'));
        },
      }, t('erase')),
    ),
    help('actions', 'erase'),
  );
}

function newPersonForm() {
  const name = h('input', { placeholder: t('personName'), required: true, maxlength: 200 });
  const mode = h('select', {}, h('option', { value: 'personal' }, t('modePersonal')), h('option', { value: 'entity' }, t('modeEntity')));
  const form = h('form', {
    class: 'card panel corner form open',
    onsubmit: (e) => { e.preventDefault(); act(() => api('POST', 'memories', { displayName: name.value.trim(), mode: mode.value })); },
  }, h('div', { class: 'row' }, name, mode, h('button', { type: 'submit' }, t('create')),
    h('button', { type: 'button', class: 'ghost', onclick: () => form.remove() }, t('cancel'))), help('mode'));
  return form;
}

// ── Clients ────────────────────────────────────────────────────────────────────

function clientCard(c) {
  const scopeBoxes = boxes(KEY_SCOPES, (s) => s !== 'erase');
  const patch = (body) => act(() => api('PATCH', `clients/${c.id}`, body));
  const reachOf = (kind) => (c.channels ?? []).find((x) => x.kind === kind)?.reach ?? '';
  // One select per channel kind: no / always / on presence; the whole list is saved (D55).
  const channelSelects = CHANNEL_KINDS.map((kind) => h('label', { class: 'field' }, h('span', {}, t(kind)), h('select', {
    'data-kind': kind,
    onchange: () => patch({ channels: channelSelects.map((l) => l.querySelector('select')).filter((x) => x.value).map((x) => ({ kind: x.dataset.kind, reach: x.value })) }),
  }, h('option', { value: '', selected: !reachOf(kind) }, t('chNone')),
     h('option', { value: 'always', selected: reachOf(kind) === 'always' }, t('chAlways')),
     h('option', { value: 'presence', selected: reachOf(kind) === 'presence' }, t('chPresence')))));
  const hookUrl = h('input', { placeholder: t('webhookUrl'), size: 40 });
  const hookDescription = h('input', { placeholder: t('description'), maxlength: 200 });
  const hookEvents = boxes(EVENTS, (e) => e === 'initiative.deliver');
  return foldCard(c.id, [
    h('div', { class: 'head' },
      h('span', { class: 'name' }, c.name), h('span', { class: 'chip' }, c.kind),
      h('span', { class: `chip ${c.disabledAt ? 'danger' : 'ok'}` }, c.disabledAt ? t('disabled') : t('active')),
    ),
    h('div', { class: 'stats' },
      h('span', {}, h('b', {}, c.keys.length), ` ${t('keys').toLowerCase()}`),
      h('span', {}, h('b', {}, (c.webhooks ?? []).length), ' webhook'),
      h('span', {}, `${t('channels').replace(/\s*\(.*\)/, '')}: ${(c.channels ?? []).map((x) => t(x.kind)).join(', ') || t('noneM')}`),
    )],
    h('div', { class: 'grid' },
      h('div', { class: 'field' }, h('label', { class: 'switch' }, h('input', {
        type: 'checkbox', checked: c.autoProvision, onchange: (e) => act(() => api('PATCH', `clients/${c.id}`, { autoProvision: e.target.checked })),
      }), t('autoProvision')),
      help('autoProvision')),
      h('div', { class: 'field' }, h('label', { class: 'switch' }, h('input', {
        type: 'checkbox', checked: !!c.disabledAt,
        onchange: (e) => {
          if (e.target.checked && !confirm(t('disableConfirm'))) { e.target.checked = false; return; }
          act(() => api('PATCH', `clients/${c.id}`, { disabled: e.target.checked }));
        },
      }), t('disabled')),
      help('disabled')),
      h('label', { class: 'field' }, h('span', {}, t('rawLog')), h('select', { onchange: (e) => patch({ rawLogScope: e.target.value }) },
        h('option', { value: 'own', selected: c.rawLogScope === 'own' }, t('rawOwn')),
        h('option', { value: 'all', selected: c.rawLogScope === 'all' }, t('rawAll'))), help('rawLog')),
    ),
    h('div', { class: 'sub' }, h('h4', {}, t('channels')), help('channels'), h('div', { class: 'grid' }, channelSelects)),
    h('div', { class: 'sub' },
      h('h4', {}, t('webhooks')), help('webhooks'),
      (c.webhooks ?? []).length ? c.webhooks.map((w) => h('div', { class: 'item' },
        h('code', {}, w.url), h('span', { class: 'muted' }, `${t('events')}: ${(w.events ?? [t('allEvents')]).join(', ')}`),
        w.description ? h('span', { class: 'muted' }, w.description) : null,
        w.disabledAt ? h('span', { class: 'chip danger' }, `${t('disabled')}: ${w.disabledReason ?? ''}`) : null,
        h('button', { class: 'danger small', onclick: () => confirm(t('removeConfirm')) && act(() => api('DELETE', `webhooks/${w.id}`)) }, t('remove')),
      )) : h('div', { class: 'muted' }, t('noneM')),
      h('div', { class: 'row' }, hookUrl, hookDescription),
      h('div', { class: 'row' }, h('span', { class: 'muted' }, `${t('events')}:`), hookEvents, h('button', {
        class: 'ghost small',
        onclick: () => {
          const events = checked(hookEvents);
          if (!hookUrl.value.trim()) return;
          act(async () => {
            const res = await api('POST', `clients/${c.id}/webhooks`, { url: hookUrl.value.trim(), ...(hookDescription.value.trim() ? { description: hookDescription.value.trim() } : {}),
              ...(events.length && events.length < EVENTS.length ? { events } : {}) });
            showSecret(res.secret);
            toast(t('webhookSecret'));
          }, null);
        },
      }, t('register'))),
      help('webhookUrl', 'eventsLegend'),
    ),
    h('div', { class: 'sub' },
      h('h4', {}, t('keys')), help('keys'),
      c.keys.length ? c.keys.map((k) => h('div', { class: 'item' },
        h('code', {}, `${k.prefix}…`), h('span', { class: 'muted' }, `${t('scopes')}: ${k.scopes.join(', ')}`),
        h('span', { class: 'muted' }, `${t('used')}: ${when(k.lastUsedAt)}`),
        h('button', { class: 'danger small', onclick: () => confirm(t('revokeConfirm')) && act(() => api('DELETE', `keys/${k.id}`)) }, t('revoke')),
      )) : h('div', { class: 'muted' }, t('none')),
      h('div', { class: 'row' }, h('span', { class: 'muted' }, t('newKeyScopes')), scopeBoxes, h('button', {
        class: 'ghost small',
        onclick: () => {
          const scopes = scopeBoxes.map((l) => l.querySelector('input')).filter((i) => i.checked).map((i) => i.value);
          if (scopes.length) act(async () => showSecret((await api('POST', `clients/${c.id}/keys`, { scopes })).key), null);
        },
      }, t('newKey'))),
      help('scopesLegend'),
    ),
  );
}

function newClientForm() {
  const name = h('input', { placeholder: t('clientName'), required: true, maxlength: 200 });
  const kind = h('select', {}, ['platform', 'mcp_client', 'import'].map((k) => h('option', { value: k }, k)));
  const form = h('form', {
    class: 'card panel corner form open',
    onsubmit: (e) => { e.preventDefault(); act(() => api('POST', 'clients', { name: name.value.trim(), kind: kind.value })); },
  }, h('div', { class: 'row' }, name, kind, h('button', { type: 'submit' }, t('create')),
    h('button', { type: 'button', class: 'ghost', onclick: () => form.remove() }, t('cancel'))), help('newClientKind'));
  return form;
}

// ── Shell ──────────────────────────────────────────────────────────────────────

function applyText() {
  document.documentElement.lang = lang;
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  $('lang').textContent = lang === 'it' ? 'EN' : 'IT';
  $('helps').textContent = helpsOpen ? t('helpsHide') : t('helpsShow');
  $('helps').setAttribute('aria-pressed', String(helpsOpen));
  $('status').textContent = adminKey ? t('connected') : t('signedOut');
  $('status').className = `status${adminKey ? ' on' : ''}`;
  $('key').placeholder = 'ADMIN_API_KEY';
  $('person-search').placeholder = t('search');
  $('client-search').placeholder = t('search');
}

async function render() {
  const signedIn = !!adminKey;
  $('login').hidden = signedIn;
  $('tabs').hidden = !signedIn;
  $('logout').hidden = !signedIn;
  $('persons').hidden = !signedIn || tab !== 'persons';
  $('clients').hidden = !signedIn || tab !== 'clients';
  for (const b of document.querySelectorAll('#tabs button')) b.classList.toggle('active', b.dataset.tab === tab);
  applyText();
  if (!signedIn) return;
  try {
    clientsCache = await api('GET', 'clients');
    if (tab === 'persons') personsCache = await api('GET', 'persons');
    draw();
  } catch (e) {
    if (adminKey) toast(e.message, true);
  }
}

/** Draws the current tab from the cached lists, filtered by the search box (no reload while typing). */
function draw() {
  const match = (input) => (x) => x.name.toLowerCase().includes($(input).value.trim().toLowerCase());
  const list = (items, input, card, target) => {
    const shown = items.filter(match(input));
    if (items.length === 1) expanded.add(items[0].id); // a single card opens by itself
    const allOpen = shown.length > 0 && shown.every((x) => expanded.has(x.id));
    $(target).replaceChildren(h('p', { class: 'intro panel' }, HELP[lang][tab === 'persons' ? 'introPersons' : 'introClients']),
      h('div', { class: 'row' },
        shown.length < items.length ? h('span', { class: 'muted' }, t('shown', { n: shown.length, total: items.length })) : null,
        h('span', { class: 'spacer' }),
        shown.length > 1 ? h('button', { class: 'ghost small', onclick: () => {
          for (const x of shown) { if (allOpen) expanded.delete(x.id); else expanded.add(x.id); }
          draw();
        } }, allOpen ? t('collapseAll') : t('expandAll')) : null),
      ...shown.map(card));
  };
  if (tab === 'persons') list(personsCache, 'person-search', personCard, 'person-list');
  else list(clientsCache, 'client-search', clientCard, 'client-list');
}

function signOut() {
  adminKey = null;
  store.set('adminKey', null);
  render();
}

$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  adminKey = $('key').value.trim();
  try {
    await api('GET', 'clients');
    store.set('adminKey', adminKey);
    $('key').value = '';
    $('login-error').hidden = true;
  } catch {
    adminKey = null;
    $('login-error').textContent = t('badKey');
    $('login-error').hidden = false;
  }
  render();
});
$('logout').addEventListener('click', signOut);
$('helps').addEventListener('click', () => {
  helpsOpen = !helpsOpen;
  prefs.set('helpsOpen', helpsOpen ? '1' : '0');
  for (const d of document.querySelectorAll('details.help')) d.open = helpsOpen;
  applyText();
});
$('lang').addEventListener('click', () => { lang = lang === 'it' ? 'en' : 'it'; store.set('lang', lang); applyText(); render(); });
for (const b of document.querySelectorAll('#tabs button')) b.addEventListener('click', () => { tab = b.dataset.tab; render(); });
$('person-search').addEventListener('input', draw);
$('client-search').addEventListener('input', draw);
$('new-person').addEventListener('click', () => $('person-list').prepend(newPersonForm()));
$('new-client').addEventListener('click', () => $('client-list').prepend(newClientForm()));
$('secret-close').addEventListener('click', () => { $('secret').close(); $('secret-value').textContent = ''; });
$('secret-copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('secret-value').textContent); toast(t('copied')); } catch { /* insecure context: select manually */ }
});

applyText();
render();
