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
    human: 'personale', entity: 'condivisa', consent: 'Consenso (memoria attiva)', kind: 'Tipo di memoria',
    kindHuman: 'Personale', kindEntity: 'Condivisa (entità)', profile: 'Profilo qualità', profileDefault: 'predefinito',
    name: 'Nome', rename: 'Rinomina', renameHint: 'Se la persona è collegata a un client, il nome segue il suo profilo lì e verrà riscritto.',
    messages: 'messaggi', pending: 'da estrarre', episodes: 'episodi', facts: 'fatti', notes: 'note', last: 'ultimo messaggio',
    identities: 'Identità collegate', none: 'nessuna', noneM: 'nessuno', unlink: 'Scollega', link: 'Collega un utente di un client',
    externalId: 'id utente nel client', tokens: 'Token personali', newToken: 'Nuovo token', revoke: 'Revoca',
    consolidate: 'Consolida ora', consolidated: 'Consolidamento eseguito', saved: 'Salvato',
    kindConfirm: 'La memoria contiene già ricordi: cambiare tipo mescola ricordi personali e condivisi. Continuare?',
    unlinkConfirm: 'Scollegare questa identità? Quell\'utente del client non raggiungerà più questa memoria (i ricordi restano).',
    revokeConfirm: 'Revocare? Smette di funzionare subito.', consentOn: 'Attivare la memoria di {name}? Da ora i messaggi vengono conservati ed estratti.',
    consentOff: 'Sospendere la memoria di {name}? I nuovi messaggi non verranno più conservati.',
    keys: 'Chiavi', newKey: 'Nuova chiave', newKeyScopes: 'Permessi per una nuova chiave:', scopes: 'permessi', autoProvision: 'Crea le persone al primo contatto',
    disabled: 'Disabilitato', active: 'attivo', waiting: 'chiede il consenso', waitingTitle: 'Un client ha inviato messaggi per questa persona: senza consenso non vengono salvati. Ultimo invio:', disableConfirm: 'Disabilitare il client? Tutte le sue chiavi e i token smettono di funzionare.',
    clientName: 'Nome del client', kindLabel: 'Tipo', personName: 'Nome della persona', create: 'Crea', cancel: 'Annulla',
    secretTitle: 'Copia ora il segreto', secretHint: 'Non verrà più mostrato: Recordare ne conserva solo l\'impronta.',
    copy: 'Copia', close: 'Chiudi', copied: 'Copiato', client: 'client', never: 'mai', used: 'usato', search: 'Cerca per nome',
    shown: '{n} di {total}',
  },
  en: {
    persons: 'People', clients: 'Clients', logout: 'Sign out', signIn: 'Administrator sign-in',
    signInHint: 'Enter Recordare\'s admin key (ADMIN_API_KEY). It stays in this tab only.', enter: 'Sign in',
    badKey: 'Invalid key.', newPerson: 'New person', newClient: 'New client',
    human: 'personal', entity: 'shared', consent: 'Consent (memory on)', kind: 'Memory type',
    kindHuman: 'Personal', kindEntity: 'Shared (entity)', profile: 'Quality profile', profileDefault: 'default',
    name: 'Name', rename: 'Rename', renameHint: 'If the person is linked to a client, the name follows their profile there and will be overwritten.',
    messages: 'messages', pending: 'to extract', episodes: 'episodes', facts: 'facts', notes: 'notes', last: 'last message',
    identities: 'Linked identities', none: 'none', noneM: 'none', unlink: 'Unlink', link: 'Link a client\'s user',
    externalId: 'user id in the client', tokens: 'Personal tokens', newToken: 'New token', revoke: 'Revoke',
    consolidate: 'Consolidate now', consolidated: 'Consolidation done', saved: 'Saved',
    kindConfirm: 'The memory already holds memories: changing its type mixes personal and shared ones. Continue?',
    unlinkConfirm: 'Unlink this identity? That client user will no longer reach this memory (memories stay).',
    revokeConfirm: 'Revoke? It stops working at once.', consentOn: 'Turn on {name}\'s memory? From now on messages are stored and extracted.',
    consentOff: 'Pause {name}\'s memory? New messages will no longer be stored.',
    keys: 'Keys', newKey: 'New key', newKeyScopes: 'Scopes for a new key:', scopes: 'scopes', autoProvision: 'Create people on first contact',
    disabled: 'Disabled', active: 'active', waiting: 'waiting for consent', waitingTitle: 'A client sent messages for this person: without consent they are not stored. Last attempt:', disableConfirm: 'Disable the client? All its keys and tokens stop working.',
    clientName: 'Client name', kindLabel: 'Kind', personName: 'Person\'s name', create: 'Create', cancel: 'Cancel',
    secretTitle: 'Copy the secret now', secretHint: 'It will not be shown again: Recordare keeps only its hash.',
    copy: 'Copy', close: 'Close', copied: 'Copied', client: 'client', never: 'never', used: 'used', search: 'Search by name',
    shown: '{n} of {total}',
  },
};
const PROFILES = ['economy', 'balanced', 'full'];
const KEY_SCOPES = ['ingest', 'mcp', 'read', 'write'];

const store = {
  get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch { /* private mode */ } },
};
let lang = store.get('lang') || ((navigator.language || 'it').startsWith('it') ? 'it' : 'en');
let adminKey = store.get('adminKey');
let tab = 'persons';
let clientsCache = [];
let personsCache = [];
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
async function act(fn, done = t('saved')) {
  try { await fn(); if (done) toast(done); } catch (e) { toast(e.message, true); }
  await render();
}

function showSecret(value) {
  $('secret-value').textContent = value;
  $('secret').showModal();
}

const when = (d) => (d ? new Date(d).toLocaleString(lang === 'it' ? 'it-IT' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' }) : t('never'));

// ── People ─────────────────────────────────────────────────────────────────────

function personCard(p) {
  const hasMemories = p.episodes + p.facts + p.notes > 0;
  const consent = h('input', {
    type: 'checkbox', checked: p.episodicEnabled,
    onchange: (e) => {
      const on = e.target.checked;
      if (!confirm(t(on ? 'consentOn' : 'consentOff', { name: p.name }))) { e.target.checked = !on; return; }
      act(() => api('PATCH', `owners/${p.id}`, { episodicEnabled: on }));
    },
  });
  const kind = h('select', {
    onchange: (e) => {
      if (hasMemories && !confirm(t('kindConfirm'))) { e.target.value = p.kind; return; }
      act(() => api('PATCH', `owners/${p.id}`, { kind: e.target.value }));
    },
  }, h('option', { value: 'human', selected: p.kind === 'human' }, t('kindHuman')),
     h('option', { value: 'entity', selected: p.kind === 'entity' }, t('kindEntity')));
  const profile = h('select', {
    onchange: (e) => act(() => api('PATCH', `owners/${p.id}`, { qualityProfile: e.target.value || null })),
  }, h('option', { value: '', selected: !p.qualityProfile }, t('profileDefault')),
     PROFILES.map((q) => h('option', { value: q, selected: p.qualityProfile === q }, q)));
  const nameInput = h('input', { value: p.name, maxlength: 200 });

  const clientOptions = () => clientsCache.map((c) => h('option', { value: c.id }, c.name));
  const linkClient = h('select', {}, clientOptions());
  const linkId = h('input', { placeholder: t('externalId') });
  const tokenClient = h('select', {}, clientOptions());

  return h('div', { class: 'card' },
    h('div', { class: 'head' },
      h('span', { class: 'name' }, p.name),
      h('span', { class: `chip ${p.kind === 'entity' ? 'warn' : ''}` }, t(p.kind)),
      h('span', { class: `chip ${p.episodicEnabled ? 'ok' : 'danger'}` }, p.episodicEnabled ? t('active') : t('disabled')),
      p.waitingForConsentSince ? h('span', { class: 'chip warn', title: `${t('waitingTitle')} ${new Date(p.waitingForConsentSince).toLocaleString()}` }, t('waiting')) : null,
    ),
    h('div', { class: 'stats' },
      h('span', {}, h('b', {}, p.messages), ` ${t('messages')}`),
      h('span', {}, h('b', {}, p.pending), ` ${t('pending')}`),
      h('span', {}, h('b', {}, p.episodes), ` ${t('episodes')}`),
      h('span', {}, h('b', {}, p.facts), ` ${t('facts')}`),
      h('span', {}, h('b', {}, p.notes), ` ${t('notes')}`),
      h('span', {}, `${t('last')}: ${when(p.lastMessage)}`),
    ),
    h('div', { class: 'grid' },
      h('label', { class: 'switch' }, consent, t('consent')),
      h('label', { class: 'field' }, h('span', {}, t('kind')), kind),
      h('label', { class: 'field' }, h('span', {}, t('profile')), profile),
      h('div', { class: 'field' }, h('span', { title: t('renameHint') }, `${t('name')} ⓘ`),
        h('div', { class: 'row' }, nameInput, h('button', {
          class: 'ghost small', onclick: () => nameInput.value.trim() && act(() => api('PATCH', `owners/${p.id}`, { displayName: nameInput.value.trim() })),
        }, t('rename')))),
    ),
    h('div', { class: 'sub' },
      h('h4', {}, t('identities')),
      p.identities.length ? p.identities.map((i) => h('div', { class: 'item' },
        h('span', { class: 'chip' }, i.client ?? i.channel ?? i.kind), h('code', {}, i.externalId),
        h('button', { class: 'danger small', onclick: () => confirm(t('unlinkConfirm')) && act(() => api('DELETE', `identities/${i.id}`)) }, t('unlink')),
      )) : h('div', { class: 'muted' }, t('none')),
      clientsCache.length ? h('div', { class: 'row' }, linkClient, linkId, h('button', {
        class: 'ghost small',
        onclick: () => linkId.value.trim() && act(() => api('POST', 'identities',
          { kind: 'client_user', personId: p.id, clientId: linkClient.value, externalId: linkId.value.trim() })),
      }, t('link'))) : null,
    ),
    h('div', { class: 'sub' },
      h('h4', {}, t('tokens')),
      p.tokens.length ? p.tokens.map((k) => h('div', { class: 'item' },
        h('code', {}, `${k.prefix}…`), h('span', { class: 'chip' }, k.client), h('span', { class: 'muted' }, k.scopes.join(', ')),
        h('span', { class: 'muted' }, `${t('used')}: ${when(k.lastUsedAt)}`),
        h('button', { class: 'danger small', onclick: () => confirm(t('revokeConfirm')) && act(() => api('DELETE', `tokens/${k.id}`)) }, t('revoke')),
      )) : h('div', { class: 'muted' }, t('noneM')),
      clientsCache.length ? h('div', { class: 'row' }, tokenClient, h('button', {
        class: 'ghost small',
        onclick: () => act(async () => {
          const res = await api('POST', `owners/${p.id}/tokens`, { clientId: tokenClient.value, scopes: ['mcp', 'read', 'write'] });
          showSecret(res.token);
        }, null),
      }, t('newToken'))) : null,
    ),
    h('div', { class: 'row' },
      h('button', { class: 'ghost small', onclick: () => act(() => api('POST', `owners/${p.id}/consolidate`), t('consolidated')) }, t('consolidate')),
    ),
  );
}

function newPersonForm() {
  const name = h('input', { placeholder: t('personName'), required: true, maxlength: 200 });
  const kind = h('select', {}, h('option', { value: 'human' }, t('kindHuman')), h('option', { value: 'entity' }, t('kindEntity')));
  const form = h('form', {
    class: 'card',
    onsubmit: (e) => { e.preventDefault(); act(() => api('POST', 'owners', { displayName: name.value.trim(), kind: kind.value })); },
  }, h('div', { class: 'row' }, name, kind, h('button', { type: 'submit' }, t('create')),
    h('button', { type: 'button', class: 'ghost', onclick: () => form.remove() }, t('cancel'))));
  return form;
}

// ── Clients ────────────────────────────────────────────────────────────────────

function clientCard(c) {
  const scopeBoxes = KEY_SCOPES.map((s) => h('label', { class: 'switch' }, h('input', { type: 'checkbox', value: s, checked: true }), s));
  return h('div', { class: 'card' },
    h('div', { class: 'head' },
      h('span', { class: 'name' }, c.name), h('span', { class: 'chip' }, c.kind),
      h('span', { class: `chip ${c.disabledAt ? 'danger' : 'ok'}` }, c.disabledAt ? t('disabled') : t('active')),
    ),
    h('div', { class: 'grid' },
      h('label', { class: 'switch' }, h('input', {
        type: 'checkbox', checked: c.autoProvision, onchange: (e) => act(() => api('PATCH', `clients/${c.id}`, { autoProvision: e.target.checked })),
      }), t('autoProvision')),
      h('label', { class: 'switch' }, h('input', {
        type: 'checkbox', checked: !!c.disabledAt,
        onchange: (e) => {
          if (e.target.checked && !confirm(t('disableConfirm'))) { e.target.checked = false; return; }
          act(() => api('PATCH', `clients/${c.id}`, { disabled: e.target.checked }));
        },
      }), t('disabled')),
    ),
    h('div', { class: 'sub' },
      h('h4', {}, t('keys')),
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
    ),
  );
}

function newClientForm() {
  const name = h('input', { placeholder: t('clientName'), required: true, maxlength: 200 });
  const kind = h('select', {}, ['platform', 'mcp_client', 'import'].map((k) => h('option', { value: k }, k)));
  const form = h('form', {
    class: 'card',
    onsubmit: (e) => { e.preventDefault(); act(() => api('POST', 'clients', { name: name.value.trim(), kind: kind.value })); },
  }, h('div', { class: 'row' }, name, kind, h('button', { type: 'submit' }, t('create')),
    h('button', { type: 'button', class: 'ghost', onclick: () => form.remove() }, t('cancel'))));
  return form;
}

// ── Shell ──────────────────────────────────────────────────────────────────────

function applyText() {
  document.documentElement.lang = lang;
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  $('lang').textContent = lang === 'it' ? 'EN' : 'IT';
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
    $(target).replaceChildren(...(shown.length < items.length ? [h('p', { class: 'muted' }, t('shown', { n: shown.length, total: items.length }))] : []),
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
