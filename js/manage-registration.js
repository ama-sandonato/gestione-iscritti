// =====================
// AUTH & SESSION
// =====================
const TOKEN_KEY    = 'ama_token';
const USER_KEY     = 'ama_user';
const PERMESSI_KEY = 'ama_permessi';

// Mappa tab → permesso richiesto
const TAB_PERMESSI = {
  'pagamenti':            'tab:validazione-pagamenti',
  'import-movimenti':     'tab:validazione-pagamenti',
  'scordarelli':          'tab:scordarelli',
  'cancellati':           'tab:cancellati',
  'confermati':           'tab:confermati',
  'dashboard-approvator': 'tab:dashboard-approvator',
  'dashboard-cucina':     'tab:dashboard-cucina',
  'report':               'tab:report',
  'gestione-utenti':      'tab:gestione-utenti'
};

function getToken()    { return sessionStorage.getItem(TOKEN_KEY); }
function getUser()     { return sessionStorage.getItem(USER_KEY); }
function getPermessi() { return JSON.parse(sessionStorage.getItem(PERMESSI_KEY) || '[]'); }
function hasPermesso(p) { return getPermessi().includes(p); }

function saveSession(token, user, permessi) {
  sessionStorage.setItem(TOKEN_KEY,    token);
  sessionStorage.setItem(USER_KEY,     user);
  sessionStorage.setItem(PERMESSI_KEY, JSON.stringify(permessi || []));
}

function clearSession() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(PERMESSI_KEY);
}

function applyPermissions() {
  Object.keys(TAB_PERMESSI).forEach(tab => {
    const visible = hasPermesso(TAB_PERMESSI[tab]);
    document.getElementById(`tab-btn-${tab}`).style.display = visible ? '' : 'none';
  });
}

function firstAvailableTab() {
  return Object.keys(TAB_PERMESSI).find(tab => hasPermesso(TAB_PERMESSI[tab]));
}

// Aggiorna i permessi dal backend senza richiedere logout/login.
// Chiamata al caricamento pagina e ad ogni ciclo di polling.
function refreshPermessi() {
  return apiCall({ action: 'getPermessi' })
    .then(res => {
      if (res.esito === 'OK') {
        sessionStorage.setItem(PERMESSI_KEY, JSON.stringify(res.permessi || []));
        applyPermissions();
        // Se il tab corrente non è più autorizzato, reindirizza
        const tabAttivo = Object.keys(TAB_PERMESSI).find(t =>
          document.getElementById(`tab-${t}`)?.style.display !== 'none'
        );
        if (tabAttivo && !hasPermesso(TAB_PERMESSI[tabAttivo])) {
          showTab(firstAvailableTab());
        }
      }
    })
    .catch(err => { if (err !== 'auth') console.warn('refreshPermessi error', err); });
}

function showLoginCard() {
  document.getElementById('login-card').style.display    = 'block';
  document.getElementById('main-card').style.display     = 'none';
  document.getElementById('user-header').style.display   = 'none';
  document.getElementById('loading-overlay').style.display = 'none';
}

function showMainCard() {
  document.getElementById('login-card').style.display    = 'none';
  document.getElementById('main-card').style.display     = 'block';
  document.getElementById('user-header').style.display   = 'flex';
  document.getElementById('user-header-name').innerText  = getUser();
  applyPermissions();
  showTab(firstAvailableTab() || 'pagamenti');
  loadDashboardStats();
  startStatsPolling();
}

// Eseguito al caricamento della pagina
document.addEventListener('DOMContentLoaded', () => {
  if (getToken()) {
    showMainCard();      // mostra subito con i permessi già in sessionStorage
    refreshPermessi();   // aggiorna i permessi in background (se l'admin ha cambiato ruoli)
  } else {
    showLoginCard();
  }
});

function onLoginKeydown(event) {
  if (event.key === 'Enter') doLogin();
}

function doLogin() {
  const user     = document.getElementById('login-user').value.trim();
  const password = document.getElementById('login-password').value;
  const errorDiv = document.getElementById('login-error');
  const btn      = document.getElementById('btn-login');

  errorDiv.style.display = 'none';

  if (!user || !password) {
    errorDiv.innerText     = 'Inserisci utente e password.';
    errorDiv.style.display = 'block';
    return;
  }

  btn.disabled  = true;
  btn.innerText = 'Accesso in corso...';
  document.getElementById('loading-overlay').style.display = 'flex';

  fetch(AppConfig.apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'login', formData: { user, password } })
  })
  .then(res => res.json())
  .then(res => {
    document.getElementById('loading-overlay').style.display = 'none';
    btn.disabled  = false;
    btn.innerText = 'Accedi';

    if (res.esito === 'OK') {
      saveSession(res.token, res.user, res.permessi);
      document.getElementById('login-password').value = '';
      showMainCard();
    } else {
      errorDiv.innerText     = '❌ ' + (res.messaggio || 'Credenziali non valide.');
      errorDiv.style.display = 'block';
    }
  })
  .catch(err => {
    document.getElementById('loading-overlay').style.display = 'none';
    btn.disabled       = false;
    btn.innerText      = 'Accedi';
    errorDiv.innerText = '❌ Errore di connessione.';
    errorDiv.style.display = 'block';
    console.error(err);
  });
}

function logout() {
  clearSession();
  document.getElementById('tbody').innerHTML                        = '';
  document.getElementById('risultati').style.display               = 'none';
  document.getElementById('nessun-risultato').style.display        = 'none';
  document.getElementById('input-ama').value                       = '';
  document.getElementById('input-fulltext').value                  = '';
  document.getElementById('tbody-scordarelli').innerHTML           = '';
  document.getElementById('risultati-scordarelli').style.display   = 'none';
  document.getElementById('nessun-scordarello').style.display      = 'none';
  document.getElementById('tbody-cancellati').innerHTML            = '';
  document.getElementById('risultati-cancellati').style.display    = 'none';
  document.getElementById('nessun-cancellato').style.display       = 'none';
  document.getElementById('tbody-confermati').innerHTML            = '';
  document.getElementById('risultati-confermati').style.display    = 'none';
  document.getElementById('nessun-confermato').style.display       = 'none';
  document.getElementById('pagination-confermati').innerHTML       = '';
  document.getElementById('confermati-search').value               = '';
  document.getElementById('confermati-search').disabled            = true;
  _listaConfermati    = [];
  _filteredConfermati = [];
  _pageConfermati     = 0;
  _sortConfermatiKey  = null;
  _sortConfermatiDir  = 0;
  showLoginCard();
}


// =====================
// API WRAPPER
// =====================
function apiCall(body) {
  body.token = getToken();

  return fetch(AppConfig.apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(body)
  })
  .then(res => res.json())
  .then(res => {
    if (res.motivo === 'AUTH_EXPIRED' || res.motivo === 'AUTH_MISSING' || res.motivo === 'AUTH_INVALID') {
      clearSession();
      showLoginCard();
      // mostra messaggio solo per scadenza, non per missing/invalid (logout volontario)
      if (res.motivo === 'AUTH_EXPIRED') {
        const errorDiv = document.getElementById('login-error');
        errorDiv.innerText     = '⏰ Sessione scaduta. Effettua nuovamente il login.';
        errorDiv.style.display = 'block';
      }
      return Promise.reject('auth');
    }
    return res;
  });
}


function onKeydown(event, tipo) {
  if (event.key === 'Enter') {
    if (tipo === 'ama') {
      const valore = document.getElementById('input-ama').value.trim();
      if (valore) cerca('codiceBonifico', valore);
    } else {
      const valore = document.getElementById('input-fulltext').value.trim();
      if (valore) cerca('fulltext', valore);
    }
  }
}


// =====================
// CERCA
// =====================
/*
function cerca(criterio, valore) {
  if (!valore) return;

  document.getElementById('loading-overlay').style.display = 'flex';
  document.getElementById('risultati').style.display        = 'none';
  document.getElementById('nessun-risultato').style.display = 'none';

  if (criterio === "codiceBonifico") {
    fetch(AppConfig.apiUrl, {
      method: 'POST',
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "autocompleteCodiceBonifico", formData: valore })
    })
    .then(res => res.json())
    .then(res => { mostraRisultati(res); document.getElementById('loading-overlay').style.display = 'none'; })
    .catch(err => { console.error(err); document.getElementById('loading-overlay').style.display = 'none'; });

  } else if (criterio === "fulltext") {
    fetch(AppConfig.apiUrl, {
      method: 'POST',
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "autocompleteFulltext", formData: valore })
    })
    .then(res => res.json())
    .then(res => { mostraRisultati(res); document.getElementById('loading-overlay').style.display = 'none'; })
    .catch(err => { console.error(err); document.getElementById('loading-overlay').style.display = 'none'; });

  } else {
    throw new Error(`Criterio di ricerca [${criterio}] non valido!`);
  }
}
*/
function cerca(criterio, valore) {
  if (!valore) return;

  document.getElementById('loading-overlay').style.display      = 'flex';
  document.getElementById('risultati').style.display            = 'none';
  document.getElementById('nessun-risultato').style.display     = 'none';

  const actionMap = {
    codiceBonifico: 'autocompleteCodiceBonifico',
    fulltext:       'autocompleteFulltext'
  };
  const action = actionMap[criterio];
  if (!action) throw new Error(`Criterio di ricerca [${criterio}] non valido!`);

  apiCall({ action, formData: valore })
    .then(res => mostraRisultati(res))
    .catch(err => { if (err !== 'auth') console.error(err); })
    .finally(() => { document.getElementById('loading-overlay').style.display = 'none'; });
}

// =====================
// LINK CODICE BONIFICO -> MODIFICA PRENOTAZIONE (solo administrator)
// =====================
// Helper condiviso da tutte le tabelle che mostrano il "Cod. Bonifico" (Validazione Pagamenti,
// Scordarelli, Cancellati, Confermati): se l'utente ha il permesso, il codice diventa un link
// che apre la modale di modifica amministrativa; altrimenti resta testo semplice come oggi.
function _renderCodiceBonifico(codiceTitolare, codiceBonifico) {
  if (!hasPermesso('azione:modifica-prenotazione')) return `<strong>${codiceBonifico}</strong>`;
  return `<a href="#" class="link-codice-bonifico" title="Modifica prenotazione" onclick="apriModificaPrenotazioneModal('${codiceTitolare}'); return false;"><strong>${codiceBonifico}</strong></a>`;
}

// Stesso principio, per il numero "Partec.": apre la modale di modifica dei partecipanti
// aggiuntivi (sheet "partecipanti") invece di quella dei dati generali della prenotazione.
function _renderPartecipantiCount(codiceTitolare, count) {
  if (!hasPermesso('azione:modifica-prenotazione')) return `${count}`;
  return `<a href="#" class="link-codice-bonifico" title="Modifica partecipanti" onclick="apriModificaPartecipantiModal('${codiceTitolare}'); return false;">${count}</a>`;
}


// =====================
// MOSTRA RISULTATI
// =====================
function esportaPendingCsv(btn) {
  btn.disabled = true;
  document.getElementById('loading-overlay').style.display = 'flex';

  apiCall({ action: 'esportaPendingCompleto' })
    .then(lista => {
      if (!lista || lista.length === 0) {
        alert('Nessuna prenotazione in attesa da esportare.');
        return;
      }
      const intestazione = [
        'Cod. Bonifico', 'Cognome', 'Nome', 'Codice Fiscale', 'Email', 'Indirizzo', 'Città', 'Provincia',
        'Adulti', 'Bambini', 'Infanti', 'Menu 1', 'Menu 2', 'Birre', 'Prezzo Atteso', 'Frequenta SMA',
        'Data Registrazione'
      ];
      const righe = lista.map(r => [
        r.codiceBonifico, r.cognome, r.nome, r.codiceFiscale, r.email, r.indirizzo, r.citta, r.provincia,
        r.adulti, r.bambini, r.infanti, r.menu1, r.menu2, r.birre, r.prezzo, r.frequentaSma,
        r.dataRegistrazione
      ]);
      const oggi = new Date().toISOString().slice(0, 10);
      _scaricaCsv(`validazione-pagamenti_${oggi}.csv`, [intestazione, ...righe]);
    })
    .catch(err => { if (err !== 'auth') { console.error(err); alert('Errore durante l\'esportazione.'); } })
    .finally(() => {
      btn.disabled = false;
      document.getElementById('loading-overlay').style.display = 'none';
    });
}

function mostraRisultati(lista) {
  if (!lista || lista.length === 0) {
    document.getElementById('nessun-risultato').style.display = 'block';
    return;
  }

  document.getElementById('contatore').innerText =
    `${lista.length} iscritt${lista.length === 1 ? 'o' : 'i'} trovat${lista.length === 1 ? 'o' : 'i'}`;

  const tbody = document.getElementById('tbody');
  tbody.innerHTML = '';

  lista.forEach(r => {
    const partecipanti = r.adulti + r.bambini + r.infanti;

    const tr  = document.createElement('tr');
    tr.id     = `riga-${r.codiceBonifico}`;
    tr.innerHTML = `
      <td title="codice titolare: ${r.codiceTitolare}">${_renderCodiceBonifico(r.codiceTitolare, r.codiceBonifico)}</td>
      <td>${r.nome}</td>
      <td>${r.cognome}</td>
      <td class="cell-email cell-email-clickable" title="Modifica email" onclick="apriCorreggiEmailModal('${r.codiceTitolare}', '${r.codiceBonifico}', '${r.email}')">${r.email}</td>
      <td><span class="badge" title="${r.adulti} Adulti, ${r.bambini} Minori, ${r.infanti} Infanti">${_renderPartecipantiCount(r.codiceTitolare, partecipanti)}</span></td>
      <td>${r.menu1}</td>
      <td>${r.menu2}</td>
      <td>${r.birre}</td>
      <td>${r.frequentaSma || '—'}</td>
      <td>${r.dataRegistrazione || '—'}</td>
      <td class="totale">€ ${Number(r.prezzo).toFixed(2)}</td>
      <td>
        <div class="cell-actions">
          <button
            class="btn-conferma"
            id="btn-${r.codiceBonifico}"
            onclick="confermaPagamento('${r.codiceTitolare}', '${r.codiceBonifico}', this)">
            Conferma
          </button>
          <button
            class="btn-issue"
            id="btn-issue-${r.codiceBonifico}"
            onclick="openMailModal('${r.email}', '${r.nome}', '${r.codiceBonifico}', ${r.prezzo}, this)">
            Segnala
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById('risultati').style.display = 'block';
}


// =====================
// CONFERMA PAGAMENTO
// =====================
/*
function confermaPagamento(codiceTitolare, codiceBonifico, btn) {
  openConfirmModal(
    `Stai per confermare il pagamento per il codice <strong>${codiceBonifico}</strong>. Continuare?`,
    () => {
      btn.disabled  = true;
      btn.innerText = "⏳ Salvataggio...";
      document.getElementById('loading-overlay').style.display = 'flex';

      fetch(AppConfig.apiUrl, {
        method: 'POST',
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({
          action: "confirmPayment",
          formData: { codiceTitolare, codiceBonifico }
        })
      })
      .then(res => res.json())
      .then(res => {
        esitoPagamento(res, codiceBonifico, btn);
        document.getElementById('loading-overlay').style.display = 'none';
      })
      .catch(err => {
        console.error(err);
        document.getElementById('loading-overlay').style.display = 'none';
      });
    }
  );
}
*/
function confermaPagamento(codiceTitolare, codiceBonifico, btn) {
  openConfirmModal(
    `Stai per confermare il pagamento per il codice <strong>${codiceBonifico}</strong>. Continuare?`,
    () => {
      //testo originale salvato per poterlo ripristinare esatto in caso di errore: è diverso
      //tra i tab ("Conferma" in Validazione Pagamenti, "✓ Valida" in Importa Movimenti),
      //un valore hardcoded qui non andrebbe mai bene per entrambi
      btn.dataset.originalText = btn.dataset.originalText || btn.innerText;
      btn.disabled  = true;
      btn.innerText = '⏳ Salvataggio...';
      document.getElementById('loading-overlay').style.display = 'flex';

      apiCall({ action: 'confirmPayment', formData: { codiceTitolare, codiceBonifico } })
        .then(res => esitoPagamento(res, btn))
        .catch(err => {
          if (err !== 'auth') console.error(err);
          btn.disabled  = false;
          btn.innerText = btn.dataset.originalText;
        })
        .finally(() => { document.getElementById('loading-overlay').style.display = 'none'; });
    }
  );
}


// =====================
// MODALE DI CONFERMA
// =====================
let _confirmCallback = null;

function openConfirmModal(testo, onConfirm, { icon = '💳', title = 'Conferma Pagamento' } = {}) {
  document.getElementById('confirmModalIcon').innerText  = icon;
  document.getElementById('confirmModalTitle').innerText = title;
  document.getElementById('confirmModalText').innerHTML  = testo;
  _confirmCallback = onConfirm;
  const modal = document.getElementById('confirmModal');
  modal.style.display = 'flex';

  document.getElementById('confirmModalOkBtn').onclick = () => {
    const cb = _confirmCallback;
    closeConfirmModal();
    if (cb) cb();
  };
}

function closeConfirmModal() {
  document.getElementById('confirmModal').style.display = 'none';
  _confirmCallback = null;
}


// =====================
// MODALE CORREZIONE EMAIL
// =====================
let _fixEmailCtx = null;

function apriCorreggiEmailModal(codiceTitolare, codiceBonifico, emailAttuale) {
  _fixEmailCtx = { codiceTitolare, codiceBonifico };
  document.getElementById('fixEmailModalText').innerHTML =
    `Correggi l'indirizzo email per la prenotazione <strong>${codiceBonifico}</strong><br><br><strong>Verrà reinviata la mail di preiscrizione al nuovo indirizzo!</strong>`;
  document.getElementById('fixEmailInput').value = emailAttuale;
  document.getElementById('fixEmailModal').style.display = 'flex';

  document.getElementById('fixEmailModalOkBtn').onclick = () => {
    if (!_fixEmailCtx) return;

    const nuovaEmail = document.getElementById('fixEmailInput').value.trim();
    if (!nuovaEmail || !nuovaEmail.includes('@')) {
      alert('Inserisci un indirizzo email valido.');
      return;
    }

    const { codiceTitolare, codiceBonifico } = _fixEmailCtx;
    const btn = document.getElementById('fixEmailModalOkBtn');
    btn.disabled = true;

    apiCall({ action: 'correggiEmailIscrizione', formData: { codiceTitolare, codiceBonifico, email: nuovaEmail } })
      .then(res => {
        if (res.esito === 'OK') {
          const cellaEmail = document.getElementById(`riga-${codiceBonifico}`)?.querySelector('.cell-email');
          if (cellaEmail) {
            cellaEmail.textContent = nuovaEmail;
            cellaEmail.title = nuovaEmail;
          }
          closeFixEmailModal();
        } else {
          alert(res.messaggio || 'Errore durante la correzione email.');
        }
      })
      .catch(err => { if (err !== 'auth') { console.error(err); alert('Errore di connessione.'); } })
      .finally(() => { btn.disabled = false; });
  };
}

function closeFixEmailModal() {
  document.getElementById('fixEmailModal').style.display = 'none';
  _fixEmailCtx = null;
}


// =====================
// MODALE MODIFICA PRENOTAZIONE (solo administrator)
// =====================
let _mpCodiceTitolare = null;
let _mpCodiceBonifico = null;

function apriModificaPrenotazioneModal(codiceTitolare) {
  _mpCodiceTitolare = codiceTitolare;
  _mpCodiceBonifico = null;
  document.getElementById('mpCodiceInfo').textContent = 'Caricamento...';
  document.getElementById('modificaPrenotazioneModal').style.display = 'flex';

  apiCall({ action: 'adminCercaPrenotazione', formData: { codiceTitolare } })
    .then(res => {
      if (res.esito !== 'OK') {
        alert(res.messaggio || 'Prenotazione non trovata.');
        closeModificaPrenotazioneModal();
        return;
      }
      const p = res.prenotazione;
      _mpCodiceBonifico = p.codiceBonifico;
      document.getElementById('mpCodiceInfo').textContent = `${p.codiceBonifico} — ${p.nome} ${p.cognome}`;
      document.getElementById('mpNome').value      = p.nome;
      document.getElementById('mpCognome').value   = p.cognome;
      document.getElementById('mpCf').value        = p.cf;
      document.getElementById('mpEmail').value     = p.email;
      document.getElementById('mpIndirizzo').value = p.indirizzo;
      document.getElementById('mpCitta').value     = p.citta;
      document.getElementById('mpProvincia').value = p.provincia;
      document.getElementById('mpStato').value     = p.stato;
      document.getElementById('mpAdulti').value    = p.adulti;
      document.getElementById('mpBambini').value   = p.bambini;
      document.getElementById('mpInfanti').value   = p.infanti;
      document.getElementById('mpMenu1').value     = p.menu1;
      document.getElementById('mpMenu2').value     = p.menu2;
      document.getElementById('mpBirre').value     = p.birre;
      document.getElementById('mpInviaEmail').checked = false;
    })
    .catch(err => {
      if (err !== 'auth') { console.error(err); alert('Errore di connessione.'); }
      closeModificaPrenotazioneModal();
    });
}

function closeModificaPrenotazioneModal() {
  document.getElementById('modificaPrenotazioneModal').style.display = 'none';
  _mpCodiceTitolare = null;
  _mpCodiceBonifico = null;
}

function salvaModificaPrenotazione(btn) {
  if (!_mpCodiceTitolare) return;

  const formData = {
    codiceTitolare : _mpCodiceTitolare,
    nome           : document.getElementById('mpNome').value.trim(),
    cognome        : document.getElementById('mpCognome').value.trim(),
    cf             : document.getElementById('mpCf').value.trim().toUpperCase(),
    email          : document.getElementById('mpEmail').value.trim(),
    indirizzo      : document.getElementById('mpIndirizzo').value.trim(),
    citta          : document.getElementById('mpCitta').value.trim(),
    provincia      : document.getElementById('mpProvincia').value.trim().toUpperCase(),
    adulti         : Number(document.getElementById('mpAdulti').value)  || 0,
    bambini        : Number(document.getElementById('mpBambini').value) || 0,
    infanti        : Number(document.getElementById('mpInfanti').value) || 0,
    menu1          : Number(document.getElementById('mpMenu1').value)   || 0,
    menu2          : Number(document.getElementById('mpMenu2').value)   || 0,
    birre          : Number(document.getElementById('mpBirre').value)   || 0,
    stato          : document.getElementById('mpStato').value,
    inviaEmail     : document.getElementById('mpInviaEmail').checked
  };

  btn.disabled = true;
  btn.innerText = 'Salvataggio...';
  document.getElementById('loading-overlay').style.display = 'flex';

  const codiceBonifico = _mpCodiceBonifico;

  apiCall({ action: 'adminModificaPrenotazione', formData })
    .then(res => {
      if (res.esito !== 'OK') {
        alert(res.messaggio || 'Errore durante il salvataggio.');
        return;
      }
      closeModificaPrenotazioneModal();
      loadDashboardStats();
      _refreshTabDopoModifica(codiceBonifico);
      alert('Prenotazione aggiornata con successo.');
    })
    .catch(err => { if (err !== 'auth') { console.error(err); alert('Errore di connessione.'); } })
    .finally(() => {
      btn.disabled = false;
      btn.innerText = '💾 Salva';
      document.getElementById('loading-overlay').style.display = 'none';
    });
}

/**
 * Ricarica la tabella del tab da cui è stata aperta la modale di modifica, individuandolo in
 * base all'id della riga presente nel DOM (ogni tab usa un prefisso diverso) — senza questo,
 * dopo il salvataggio si continuerebbero a vedere i dati vecchi finché non si ricarica a mano.
 */
function _refreshTabDopoModifica(codiceBonifico) {
  if (!codiceBonifico) return;

  if (document.getElementById(`riga-${codiceBonifico}`)) {
    apiCall({ action: 'findAllPendingPayments' }).then(res => mostraRisultati(res)).catch(() => {});
  } else if (document.getElementById(`riga-sc-${codiceBonifico}`)) {
    loadOverdueRegistrants();
  } else if (document.getElementById(`riga-can-${codiceBonifico}`)) {
    loadCancellati();
  } else if (document.getElementById(`riga-conf-${codiceBonifico}`)) {
    loadConfermati();
  }
}


// =====================
// MODALE MODIFICA PARTECIPANTI (solo administrator)
// =====================
let _mpartCodiceTitolare = null;

function apriModificaPartecipantiModal(codiceTitolare) {
  _mpartCodiceTitolare = codiceTitolare;
  document.getElementById('mpartCodiceInfo').textContent = 'Caricamento...';
  document.getElementById('mpartLista').innerHTML = '';
  document.getElementById('modificaPartecipantiModal').style.display = 'flex';

  apiCall({ action: 'adminCercaPartecipanti', formData: { codiceTitolare } })
    .then(res => {
      if (res.esito !== 'OK') {
        alert(res.messaggio || 'Errore nel caricamento dei partecipanti.');
        closeModificaPartecipantiModal();
        return;
      }
      const n = res.partecipanti.length;
      document.getElementById('mpartCodiceInfo').textContent =
        `${n} partecipante${n === 1 ? '' : 'i'} aggiuntiv${n === 1 ? 'o' : 'i'} (oltre al titolare)`;

      if (n === 0) {
        aggiungiRigaPartecipante();
      } else {
        res.partecipanti.forEach(p => aggiungiRigaPartecipante(p.nome, p.cognome, p.eta));
      }
    })
    .catch(err => {
      if (err !== 'auth') { console.error(err); alert('Errore di connessione.'); }
      closeModificaPartecipantiModal();
    });
}

function aggiungiRigaPartecipante(nome = '', cognome = '', eta = 'adulto') {
  const div = document.createElement('div');
  div.className = 'mpart-row';
  div.innerHTML = `
    <input type="text" class="mpart-nome" placeholder="Nome" value="${nome}">
    <input type="text" class="mpart-cognome" placeholder="Cognome" value="${cognome}">
    <select class="mpart-eta">
      <option value="adulto"${eta === 'adulto' ? ' selected' : ''}>Adulto</option>
      <option value="bambino"${eta === 'bambino' ? ' selected' : ''}>Bambino</option>
      <option value="infante"${eta === 'infante' ? ' selected' : ''}>Infante</option>
    </select>
    <button type="button" class="mpart-rimuovi" title="Rimuovi" onclick="this.closest('.mpart-row').remove()">&#10060;</button>
  `;
  document.getElementById('mpartLista').appendChild(div);
}

function closeModificaPartecipantiModal() {
  document.getElementById('modificaPartecipantiModal').style.display = 'none';
  _mpartCodiceTitolare = null;
}

function salvaModificaPartecipanti(btn) {
  if (!_mpartCodiceTitolare) return;

  const partecipanti = [...document.querySelectorAll('#mpartLista .mpart-row')]
    .map(row => ({
      nome    : row.querySelector('.mpart-nome').value.trim(),
      cognome : row.querySelector('.mpart-cognome').value.trim(),
      eta     : row.querySelector('.mpart-eta').value
    }))
    .filter(p => p.nome && p.cognome);

  btn.disabled = true;
  btn.innerText = 'Salvataggio...';
  document.getElementById('loading-overlay').style.display = 'flex';

  apiCall({ action: 'adminModificaPartecipanti', formData: { codiceTitolare: _mpartCodiceTitolare, partecipanti } })
    .then(res => {
      if (res.esito !== 'OK') {
        alert(res.messaggio || 'Errore durante il salvataggio.');
        return;
      }
      closeModificaPartecipantiModal();
      alert('Partecipanti aggiornati con successo.');
    })
    .catch(err => { if (err !== 'auth') { console.error(err); alert('Errore di connessione.'); } })
    .finally(() => {
      btn.disabled = false;
      btn.innerText = '💾 Salva';
      document.getElementById('loading-overlay').style.display = 'none';
    });
}


// =====================
// GESTIONE UTENTI (operatori + ruoli + permessi, tab solo administrator)
//
// Modello "modifica in locale, salva a blocco": ogni sezione tiene una copia "originale"
// (ultimo stato salvato sul server) e una copia "locale" (con le modifiche in corso). Le azioni
// di aggiungi/modifica/elimina/riordina toccano SOLO la copia locale e rifanno il render, senza
// alcuna chiamata di rete — solo il bottone "Salva" della sezione invia l'intera copia locale al
// server in un colpo solo. Le validazioni di coerenza tra sezioni (es. "questo ruolo è ancora
// assegnato a un operatore") sono quindi fatte lato server al momento del Salva, non qui.
// =====================
let _guOperatoriOriginale = {};
let _guOperatoriLocale    = {};
let _guRuoliOriginale     = {};
let _guRuoliLocale        = {};
let _guPermessiOriginale  = [];
let _guPermessiLocale     = [];

let _guOperatoreInModifica = null;
let _guRuoloInModifica     = null;
let _guPermessoInModifica  = null;

let _guSortablePermessi = null;

const _GU_SEZIONE_PREFISSO = { operatori: 'op', ruoli: 'ru', permessi: 'pe' };

function loadGestioneUtenti() {
  document.getElementById('gu-operatori-content').innerHTML = '<div class="dashboard-loading">&#8987; Caricamento in corso...</div>';
  document.getElementById('gu-ruoli-content').innerHTML     = '<div class="dashboard-loading">&#8987; Caricamento in corso...</div>';
  document.getElementById('gu-permessi-content').innerHTML  = '<div class="dashboard-loading">&#8987; Caricamento in corso...</div>';

  Promise.all([
    apiCall({ action: 'getUtentiERuoli' }),
    apiCall({ action: 'getPermessiDisponibili' })
  ])
    .then(([resUtenti, resPermessi]) => {
      if (resUtenti.esito !== 'OK' || resPermessi.esito !== 'OK') {
        document.getElementById('gu-operatori-content').innerHTML = '<div class="dashboard-loading">&#10060; Errore nel caricamento dei dati.</div>';
        document.getElementById('gu-ruoli-content').innerHTML     = '';
        document.getElementById('gu-permessi-content').innerHTML  = '';
        return;
      }
      _guOperatoriOriginale = resUtenti.operatori || {};
      _guRuoliOriginale     = resUtenti.ruoli || {};
      _guPermessiOriginale  = resPermessi.permessi || [];

      annullaModificheSezione('operatori');
      annullaModificheSezione('ruoli');
      annullaModificheSezione('permessi');
    })
    .catch(err => {
      if (err !== 'auth') {
        document.getElementById('gu-operatori-content').innerHTML = '<div class="dashboard-loading">&#10060; Errore nel caricamento dei dati.</div>';
        document.getElementById('gu-ruoli-content').innerHTML     = '';
        document.getElementById('gu-permessi-content').innerHTML  = '';
      }
    });
}

function _guClone(x) { return JSON.parse(JSON.stringify(x)); }

/** Riporta la sezione indicata all'ultimo stato salvato sul server, scartando le modifiche locali. */
function annullaModificheSezione(sezione) {
  if (sezione === 'operatori') {
    _guOperatoriLocale = _guClone(_guOperatoriOriginale);
    renderGuOperatori();
  } else if (sezione === 'ruoli') {
    _guRuoliLocale = _guClone(_guRuoliOriginale);
    renderGuRuoli();
  } else if (sezione === 'permessi') {
    _guPermessiLocale = _guClone(_guPermessiOriginale);
    renderGuPermessi();
  }
  aggiornaStatoSezione(sezione);
}

function _guSezioneEDirty(sezione) {
  if (sezione === 'operatori') return JSON.stringify(_guOperatoriLocale) !== JSON.stringify(_guOperatoriOriginale);
  if (sezione === 'ruoli')     return JSON.stringify(_guRuoliLocale)     !== JSON.stringify(_guRuoliOriginale);
  if (sezione === 'permessi')  return JSON.stringify(_guPermessiLocale)  !== JSON.stringify(_guPermessiOriginale);
  return false;
}

function aggiornaStatoSezione(sezione) {
  const prefisso = _GU_SEZIONE_PREFISSO[sezione];
  const dirty = _guSezioneEDirty(sezione);
  document.getElementById(`gu-${prefisso}-dirty-badge`).style.display = dirty ? 'inline' : 'none';
  document.getElementById(`gu-${prefisso}-annulla-btn`).style.display = dirty ? 'inline-block' : 'none';
  document.getElementById(`gu-${prefisso}-salva-btn`).disabled        = !dirty;
}

// ── Sezione Operatori ────────────────────────────────────────────
function renderGuOperatori() {
  const usernames = Object.keys(_guOperatoriLocale).sort();

  if (usernames.length === 0) {
    document.getElementById('gu-operatori-content').innerHTML = '<p class="dashboard-loading">Nessun operatore.</p>';
    return;
  }

  const righe = usernames.map(user => {
    const ruoli = _guOperatoriLocale[user].ruoli || [];
    const badge = ruoli.length
      ? ruoli.map(r => `<span class="gu-badge">${r}</span>`).join(' ')
      : '<em>nessun ruolo</em>';
    return `
      <tr>
        <td>${user}</td>
        <td>${badge}</td>
        <td><div class="gu-azioni-cell">
          <button type="button" class="btn-small-outline" onclick="apriModificaOperatoreModal('${user}')">Modifica</button>
          <button type="button" class="btn-delete" onclick="confermaEliminaOperatore('${user}')">Elimina</button>
        </div></td>
      </tr>`;
  }).join('');

  document.getElementById('gu-operatori-content').innerHTML = `
    <div class="table-wrapper">
      <table class="gu-table">
        <thead><tr><th>Username</th><th>Ruoli assegnati</th><th>Azioni</th></tr></thead>
        <tbody>${righe}</tbody>
      </table>
    </div>`;
}

function apriModificaOperatoreModal(user) {
  const isNuovo = !user;
  _guOperatoreInModifica = user || null;

  document.getElementById('guOperatoreModalTitle').innerHTML = isNuovo
    ? '&#128100; Nuovo Operatore'
    : `&#128100; Modifica Operatore &mdash; ${user}`;
  document.getElementById('guOpUsername').value    = user || '';
  document.getElementById('guOpUsername').readOnly = !isNuovo; // lo username è la chiave: non rinominabile
  document.getElementById('guOpPassword').value    = '';
  document.getElementById('guOpPasswordConferma').value = '';
  document.getElementById('guOpPasswordLabel').textContent = 'Password *';

  // In creazione la password è sempre visibile e obbligatoria; in modifica resta nascosta
  // dietro un link, per non suggerire che vada ridigitata ogni volta che si tocca un ruolo.
  document.getElementById('guOpPasswordGroup').style.display = isNuovo ? 'block' : 'none';
  document.getElementById('guOpCambiaPasswordLink').style.display = isNuovo ? 'none' : 'block';

  // I ruoli assegnabili sono solo quelli già SALVATI (non le eventuali modifiche pendenti nella
  // sezione Ruoli): sono gli unici che il server accetterà al momento del Salva Operatori.
  const ruoliEsistenti = Object.keys(_guRuoliOriginale).sort();
  const ruoliAssegnati = user ? (_guOperatoriLocale[user]?.ruoli || []) : [];
  document.getElementById('guOpRuoliLista').innerHTML = ruoliEsistenti.length
    ? ruoliEsistenti.map(r => `
        <label class="gu-checkbox-item">
          <input type="checkbox" value="${r}" ${ruoliAssegnati.includes(r) ? 'checked' : ''}>
          ${r}
        </label>`).join('')
    : '<em>Nessun ruolo disponibile: salvane uno prima nella sezione Ruoli.</em>';

  document.getElementById('modificaOperatoreModal').style.display = 'flex';
}

function mostraCampiPasswordOperatore() {
  document.getElementById('guOpPasswordGroup').style.display = 'block';
  document.getElementById('guOpCambiaPasswordLink').style.display = 'none';
  document.getElementById('guOpPassword').focus();
}

function closeModificaOperatoreModal() {
  document.getElementById('modificaOperatoreModal').style.display = 'none';
  _guOperatoreInModifica = null;
}

/** Applica la modale alla copia LOCALE (nessuna chiamata di rete): salvare resta un'azione a
 * parte, con il bottone "Salva Operatori" della sezione. */
function applicaOperatoreDaModal() {
  const user             = document.getElementById('guOpUsername').value.trim();
  const password          = document.getElementById('guOpPassword').value.trim();
  const passwordConferma  = document.getElementById('guOpPasswordConferma').value.trim();
  const ruoli             = [...document.querySelectorAll('#guOpRuoliLista input[type=checkbox]:checked')].map(cb => cb.value);
  const isNuovo           = !_guOperatoreInModifica;

  if (!user) { alert('Username obbligatorio.'); return; }
  if (isNuovo && _guOperatoriLocale.hasOwnProperty(user)) { alert('Esiste già un operatore con questo username.'); return; }
  if (isNuovo && !password) { alert('Password obbligatoria per un nuovo operatore.'); return; }
  if (password && password !== passwordConferma) { alert('Le due password non coincidono.'); return; }

  const nuovaEntry = { ruoli };
  if (password) {
    nuovaEntry._passwordNuova = password; // in chiaro, solo in memoria: consumata dal server al Salva
  } else if (!isNuovo && _guOperatoriLocale[user] && _guOperatoriLocale[user]._passwordNuova) {
    // riedito senza toccare la password: mantengo un eventuale cambio password già in sospeso
    nuovaEntry._passwordNuova = _guOperatoriLocale[user]._passwordNuova;
  }

  _guOperatoriLocale[user] = nuovaEntry;
  closeModificaOperatoreModal();
  renderGuOperatori();
  aggiornaStatoSezione('operatori');
}

function confermaEliminaOperatore(user) {
  if (user === getUser()) {
    alert('Non puoi eliminare l\'operatore con cui hai eseguito l\'accesso.');
    return;
  }
  openConfirmModal(
    `Eliminare l'operatore <strong>${user}</strong> dalla lista? Diventa definitivo solo salvando la sezione.`,
    () => {
      delete _guOperatoriLocale[user];
      renderGuOperatori();
      aggiornaStatoSezione('operatori');
    },
    { icon: '🗑️', title: 'Elimina Operatore' }
  );
}

function salvaSezioneOperatoriBtn(btn) {
  const payload = {};
  Object.keys(_guOperatoriLocale).forEach(user => {
    const entry = _guOperatoriLocale[user];
    payload[user] = { ruoli: entry.ruoli || [], password: entry._passwordNuova || '' };
  });

  btn.disabled = true;
  const testoOriginale = btn.innerText;
  btn.innerText = 'Salvataggio...';
  document.getElementById('loading-overlay').style.display = 'flex';

  apiCall({ action: 'salvaSezioneOperatori', formData: { operatori: payload } })
    .then(res => {
      if (res.esito !== 'OK') { alert(res.messaggio || 'Errore durante il salvataggio.'); return; }
      Object.keys(_guOperatoriLocale).forEach(user => { delete _guOperatoriLocale[user]._passwordNuova; });
      _guOperatoriOriginale = _guClone(_guOperatoriLocale);
      renderGuOperatori();
      aggiornaStatoSezione('operatori');
      alert('Operatori salvati con successo.');
    })
    .catch(err => { if (err !== 'auth') { console.error(err); alert('Errore di connessione.'); } })
    .finally(() => {
      btn.disabled = _guSezioneEDirty('operatori') ? false : true;
      btn.innerText = testoOriginale;
      document.getElementById('loading-overlay').style.display = 'none';
    });
}

// ── Sezione Ruoli ────────────────────────────────────────────────
function renderGuRuoli() {
  const nomiRuoli = Object.keys(_guRuoliLocale).sort();

  if (nomiRuoli.length === 0) {
    document.getElementById('gu-ruoli-content').innerHTML = '<p class="dashboard-loading">Nessun ruolo.</p>';
    return;
  }

  const righe = nomiRuoli.map(ruolo => {
    const permessi = _guRuoliLocale[ruolo] || [];
    const badge = permessi.length
      ? permessi.map(p => `<span class="gu-badge gu-badge-permesso">${p}</span>`).join(' ')
      : '<em>nessun permesso</em>';
    return `
      <tr>
        <td>${ruolo}</td>
        <td>${badge}</td>
        <td><div class="gu-azioni-cell">
          <button type="button" class="btn-small-outline" onclick="apriModificaRuoloModal('${ruolo}')">Modifica</button>
          <button type="button" class="btn-delete" onclick="confermaEliminaRuolo('${ruolo}')">Elimina</button>
        </div></td>
      </tr>`;
  }).join('');

  document.getElementById('gu-ruoli-content').innerHTML = `
    <div class="table-wrapper">
      <table class="gu-table">
        <thead><tr><th>Ruolo</th><th>Permessi</th><th>Azioni</th></tr></thead>
        <tbody>${righe}</tbody>
      </table>
    </div>`;
}

function apriModificaRuoloModal(ruolo) {
  const isNuovo = !ruolo;
  _guRuoloInModifica = ruolo || null;

  document.getElementById('guRuoloModalTitle').innerHTML = isNuovo
    ? '&#128273; Nuovo Ruolo'
    : `&#128273; Modifica Ruolo &mdash; ${ruolo}`;
  document.getElementById('guRuNome').value    = ruolo || '';
  document.getElementById('guRuNome').readOnly = !isNuovo; // il nome ruolo è la chiave: non rinominabile

  // Solo i permessi già SALVATI sono selezionabili (checkbox nell'ordine di priorità del
  // catalogo): il server rifiuterebbe comunque un riferimento a un permesso ancora solo
  // "locale" nella sezione Permessi non ancora salvata.
  const permessiAssegnati = ruolo ? (_guRuoliLocale[ruolo] || []) : [];
  document.getElementById('guRuPermessiLista').innerHTML = _guPermessiOriginale.length
    ? _guPermessiOriginale.map(p => `
        <label class="gu-checkbox-item">
          <input type="checkbox" value="${p.permesso}" ${permessiAssegnati.includes(p.permesso) ? 'checked' : ''}>
          <span><strong>${p.permesso}</strong><br><small>${p.descrizione || ''}</small></span>
        </label>`).join('')
    : '<em>Nessun permesso disponibile: salvane uno prima nella sezione Permessi.</em>';

  document.getElementById('modificaRuoloModal').style.display = 'flex';
}

function closeModificaRuoloModal() {
  document.getElementById('modificaRuoloModal').style.display = 'none';
  _guRuoloInModifica = null;
}

function applicaRuoloDaModal() {
  const ruolo    = document.getElementById('guRuNome').value.trim();
  const permessi = [...document.querySelectorAll('#guRuPermessiLista input[type=checkbox]:checked')].map(cb => cb.value);
  const isNuovo  = !_guRuoloInModifica;

  if (!ruolo) { alert('Nome ruolo obbligatorio.'); return; }
  if (isNuovo && _guRuoliLocale.hasOwnProperty(ruolo)) { alert('Esiste già un ruolo con questo nome.'); return; }

  _guRuoliLocale[ruolo] = permessi;
  closeModificaRuoloModal();
  renderGuRuoli();
  aggiornaStatoSezione('ruoli');
}

function confermaEliminaRuolo(ruolo) {
  const usatoDa = Object.keys(_guOperatoriOriginale).filter(u => (_guOperatoriOriginale[u].ruoli || []).includes(ruolo));
  const avviso = usatoDa.length > 0
    ? `<br><br>&#9888;&#65039; Attualmente assegnato a: <strong>${usatoDa.join(', ')}</strong>. Il salvataggio verrà rifiutato finché non lo rimuovi anche da lì.`
    : '';
  openConfirmModal(
    `Eliminare il ruolo <strong>${ruolo}</strong> dalla lista? Diventa definitivo solo salvando la sezione.${avviso}`,
    () => {
      delete _guRuoliLocale[ruolo];
      renderGuRuoli();
      aggiornaStatoSezione('ruoli');
    },
    { icon: '🗑️', title: 'Elimina Ruolo' }
  );
}

function salvaSezioneRuoliBtn(btn) {
  btn.disabled = true;
  const testoOriginale = btn.innerText;
  btn.innerText = 'Salvataggio...';
  document.getElementById('loading-overlay').style.display = 'flex';

  apiCall({ action: 'salvaSezioneRuoli', formData: { ruoli: _guRuoliLocale } })
    .then(res => {
      if (res.esito !== 'OK') { alert(res.messaggio || 'Errore durante il salvataggio.'); return; }
      _guRuoliOriginale = _guClone(_guRuoliLocale);
      renderGuRuoli();
      aggiornaStatoSezione('ruoli');
      alert('Ruoli salvati con successo.');
    })
    .catch(err => { if (err !== 'auth') { console.error(err); alert('Errore di connessione.'); } })
    .finally(() => {
      btn.disabled = _guSezioneEDirty('ruoli') ? false : true;
      btn.innerText = testoOriginale;
      document.getElementById('loading-overlay').style.display = 'none';
    });
}

// ── Sezione Permessi (riordino via drag & drop, SortableJS) ──────
function renderGuPermessi() {
  const permessi = _guPermessiLocale || [];

  if (permessi.length === 0) {
    document.getElementById('gu-permessi-content').innerHTML = '<p class="dashboard-loading">Nessun permesso.</p>';
    return;
  }

  const righe = permessi.map(p => `
    <tr data-permesso="${p.permesso}">
      <td class="gu-drag-handle" title="Trascina per riordinare">&#9776;</td>
      <td><span class="gu-badge gu-badge-permesso">${p.permesso}</span></td>
      <td>${p.descrizione || ''}</td>
      <td><div class="gu-azioni-cell">
        <button type="button" class="btn-small-outline" onclick="apriModificaPermessoModal('${p.permesso}')">Modifica</button>
        <button type="button" class="btn-delete" onclick="confermaEliminaPermesso('${p.permesso}')">Elimina</button>
      </div></td>
    </tr>`).join('');

  document.getElementById('gu-permessi-content').innerHTML = `
    <div class="table-wrapper">
      <table class="gu-table gu-table-permessi">
        <thead><tr><th></th><th>Permesso</th><th>Descrizione</th><th>Azioni</th></tr></thead>
        <tbody id="gu-permessi-tbody">${righe}</tbody>
      </table>
    </div>`;

  _guInitSortablePermessi();
}

function _guInitSortablePermessi() {
  const tbody = document.getElementById('gu-permessi-tbody');
  if (!tbody) return;
  if (_guSortablePermessi) { _guSortablePermessi.destroy(); _guSortablePermessi = null; }
  _guSortablePermessi = new Sortable(tbody, {
    handle: '.gu-drag-handle',
    animation: 150,
    onEnd: () => {
      const nuovoOrdine = [...tbody.children].map(tr => tr.dataset.permesso);
      _guPermessiLocale.sort((a, b) => nuovoOrdine.indexOf(a.permesso) - nuovoOrdine.indexOf(b.permesso));
      aggiornaStatoSezione('permessi');
    }
  });
}

function apriModificaPermessoModal(permesso) {
  const isNuovo = !permesso;
  _guPermessoInModifica = permesso || null;

  document.getElementById('guPeModalTitle').innerHTML = isNuovo
    ? '&#127991;&#65039; Nuovo Permesso'
    : `&#127991;&#65039; Modifica Permesso &mdash; ${permesso}`;

  const esistente = permesso ? _guPermessiLocale.find(p => p.permesso === permesso) : null;
  document.getElementById('guPePermesso').value    = permesso || '';
  document.getElementById('guPePermesso').readOnly = !isNuovo; // il permesso è la chiave: non rinominabile
  document.getElementById('guPeDescrizione').value = esistente ? esistente.descrizione : '';

  document.getElementById('modificaPermessoModal').style.display = 'flex';
}

function closeModificaPermessoModal() {
  document.getElementById('modificaPermessoModal').style.display = 'none';
  _guPermessoInModifica = null;
}

function applicaPermessoDaModal() {
  const permesso    = document.getElementById('guPePermesso').value.trim();
  const descrizione = document.getElementById('guPeDescrizione').value.trim();
  const isNuovo     = !_guPermessoInModifica;

  if (!permesso) { alert('Nome permesso obbligatorio.'); return; }
  if (!descrizione) { alert('Descrizione obbligatoria.'); return; }
  if (isNuovo && _guPermessiLocale.some(p => p.permesso === permesso)) {
    alert('Esiste già un permesso con questo nome.');
    return;
  }

  if (isNuovo) {
    _guPermessiLocale.push({ permesso, descrizione });
  } else {
    const entry = _guPermessiLocale.find(p => p.permesso === _guPermessoInModifica);
    if (entry) entry.descrizione = descrizione;
  }

  closeModificaPermessoModal();
  renderGuPermessi();
  aggiornaStatoSezione('permessi');
}

function confermaEliminaPermesso(permesso) {
  const usatoDa = Object.keys(_guRuoliOriginale).filter(r => (_guRuoliOriginale[r] || []).includes(permesso));
  const avviso = usatoDa.length > 0
    ? `<br><br>&#9888;&#65039; Attualmente assegnato ai ruoli: <strong>${usatoDa.join(', ')}</strong>. Il salvataggio verrà rifiutato finché non lo rimuovi anche da lì.`
    : '';
  openConfirmModal(
    `Eliminare il permesso <strong>${permesso}</strong> dalla lista? Diventa definitivo solo salvando la sezione.${avviso}`,
    () => {
      _guPermessiLocale = _guPermessiLocale.filter(p => p.permesso !== permesso);
      renderGuPermessi();
      aggiornaStatoSezione('permessi');
    },
    { icon: '🗑️', title: 'Elimina Permesso' }
  );
}

function salvaSezionePermessiBtn(btn) {
  btn.disabled = true;
  const testoOriginale = btn.innerText;
  btn.innerText = 'Salvataggio...';
  document.getElementById('loading-overlay').style.display = 'flex';

  apiCall({ action: 'salvaSezionePermessi', formData: { permessi: _guPermessiLocale } })
    .then(res => {
      if (res.esito !== 'OK') { alert(res.messaggio || 'Errore durante il salvataggio.'); return; }
      _guPermessiOriginale = _guClone(_guPermessiLocale);
      renderGuPermessi();
      aggiornaStatoSezione('permessi');
      alert('Permessi salvati con successo.');
    })
    .catch(err => { if (err !== 'auth') { console.error(err); alert('Errore di connessione.'); } })
    .finally(() => {
      btn.disabled = _guSezioneEDirty('permessi') ? false : true;
      btn.innerText = testoOriginale;
      document.getElementById('loading-overlay').style.display = 'none';
    });
}


// =====================
// ESITO PAGAMENTO
// =====================
function esitoPagamento(risposta, btn) {
  if (risposta.esito === "OK") {
    btn.innerText = "✅ Pagato";
    btn.classList.add("confermato");
    //reso read-only qui (non solo dal chiamante): il flusso di validazione multipla non
    //disabilita mai i bottoni delle singole righe prima di chiamare questa funzione
    btn.disabled = true;
    //riga trovata risalendo dal bottone cliccato (non da un getElementById per codiceBonifico):
    //lo stesso codiceBonifico può comparire sia nel tab "Validazione Pagamenti" che in "Importa
    //Movimenti", con id duplicati nel DOM — un lookup per id rischierebbe di aggiornare la riga
    //sbagliata (quella dell'altro tab) invece di quella realmente cliccata
    const riga = btn.closest('tr');
    if (riga) {
      riga.classList.add("pagata");
      //tab "Importa Movimenti": se la riga ha una checkbox di selezione multipla, la disattivo
      //(un movimento già validato non deve restare selezionabile per una nuova validazione)
      const checkbox = riga.querySelector('.import-csv-check');
      if (checkbox) { checkbox.checked = false; checkbox.disabled = true; aggiornaRiepilogoImportCsv(); }
      const btnIssue = riga.querySelector('.btn-issue');
      if (btnIssue) btnIssue.style.display = 'none';
    }
    loadDashboardStats();
  } else {
    btn.disabled  = false;
    //ripristina il testo originale del bottone (salvato dal chiamante prima di sovrascriverlo
    //con "Salvataggio..."), diverso tra i tab — niente hardcoded, non andrebbe mai bene ovunque
    btn.innerText = btn.dataset.originalText || btn.innerText;
    alert("❌ Errore: " + risposta.messaggio);
  }
}


// =====================
// ERRORE GENERICO
// =====================
function errore(err, btn) {
  if (btn) {
    btn.disabled  = false;
    btn.innerText = "✓ Conferma Pagamento";
  }
  alert("❌ Errore: " + err);
  console.error(err);
}


// =====================
// MODALE EMAIL
// =====================

// "AMA005" → "005 - Donazione A.M.A."
function formatCodiceEmail(codice) {
  return codice.replace(/^AMA/i, '') + ' - Donazione A.M.A.';
}

/**
 * Tagged template per popolare l'editor contenteditable con un testo che contiene GIÀ tag HTML
 * scritti a mano nel template (es. <b>, <u>) e che devono essere renderizzati come formattazione
 * vera. Solo i valori interpolati (${...}, dati letti dallo sheet) vengono escapati: le parti
 * statiche del template restano intatte perché scritte dallo sviluppatore, non dall'utente finale.
 * I \n del template vengono comunque convertiti in <br>.
 */
function _templateEmailHtml(strings, ...valori) {
  let html = strings[0];
  valori.forEach((valore, i) => {
    html += String(valore)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    html += strings[i + 1];
  });
  return html.replace(/\n/g, '<br>');
}

function openMailModal(email, nomeUtente, codiceBonifico, prezzo, btn) {
  const codiceFormattato = formatCodiceEmail(codiceBonifico);
  const importoAtteso    = Number(prezzo).toFixed(2);
  document.getElementById('modalTitle').innerHTML = '&#128231; Invia Segnalazione';
  document.getElementById('modalEmail').value   = email;
  document.getElementById('modalSubject').value = `Verifica importo bonifico - Le Mille e Una Notte 2026`;
  document.getElementById('modalBody').innerHTML = _templateEmailHtml
`Ciao ${nomeUtente},
ti scriviamo in merito alla tua iscrizione alla festa "Le Mille e Una Notte 2026".
Controllando il pagamento associato alla tua causale personale (${codiceFormattato}), abbiamo notato una differenza tra l'importo previsto e quello ricevuto.

In base alla tua prenotazione, la quota corretta da versare risulta essere di €${importoAtteso}.

Ti chiediamo gentilmente di verificare il bonifico effettuato e, se necessario, di procedere con un versamento integrativo della differenza. Se invece pensi possa esserci un errore o hai già effettuato il pagamento corretto, rispondi pure a questa email allegando la ricevuta del bonifico: verificheremo insieme la situazione.

Ci scusiamo per il disturbo e restiamo a disposizione per qualsiasi dubbio o chiarimento.
Grazie per la collaborazione.

Un caro saluto,
AMA Crew`;
  document.getElementById('mailModal').style.display = 'flex';
}

function closeMailModal() {
  document.getElementById('mailModal').style.display = 'none';
}

/*
function confirmSendMail(btn) {
  const email   = document.getElementById('modalEmail').value;
  const subject = document.getElementById('modalSubject').value;
  const body    = document.getElementById('modalBody').value;

  document.getElementById('loading-overlay').style.display = 'flex';
  btn.disabled  = true;
  btn.innerText = "Invio in corso...";

  fetch(AppConfig.apiUrl, {
    method: 'POST',
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({
      action: "sendIssueMail",
      formData: { destinationEmail: email, emailSubject: subject, emailBody: body }
    })
  })
  .then(res => res.json())
  .then(() => {
    closeMailModal();
    document.getElementById('loading-overlay').style.display = 'none';
  })
  .catch(err => {
    console.error(err);
    document.getElementById('loading-overlay').style.display = 'none';
    alert("Errore nell'invio: " + err.message);
  });
}
  */

function confirmSendMail(btn) {
  const email      = document.getElementById('modalEmail').value;
  const subject    = document.getElementById('modalSubject').value;
  const editor     = document.getElementById('modalBody');
  const bodyHtml   = editor.innerHTML;
  const bodyText   = editor.innerText;

  document.getElementById('loading-overlay').style.display = 'flex';
  btn.disabled  = true;
  btn.innerText = 'Invio in corso...';

  apiCall({ action: 'sendIssueMail', formData: { destinationEmail: email, emailSubject: subject, emailBodyHtml: bodyHtml, emailBodyText: bodyText } })
    .then(() => closeMailModal())
    .catch(err => { if (err !== 'auth') alert("Errore nell'invio: " + err); })
    .finally(() => { document.getElementById('loading-overlay').style.display = 'none'; btn.disabled = false; btn.innerText = 'Invia'; });
}


// =====================
// TAB NAVIGATION
// =====================
function showTab(tab) {
  // Guard: redirect al primo tab disponibile se non autorizzato
  if (TAB_PERMESSI[tab] && !hasPermesso(TAB_PERMESSI[tab])) {
    const fallback = firstAvailableTab();
    if (fallback) { showTab(fallback); }
    return;
  }
  document.getElementById('tab-pagamenti').style.display           = tab === 'pagamenti'            ? 'block' : 'none';
  document.getElementById('tab-import-movimenti').style.display    = tab === 'import-movimenti'     ? 'block' : 'none';
  document.getElementById('tab-scordarelli').style.display         = tab === 'scordarelli'          ? 'block' : 'none';
  document.getElementById('tab-cancellati').style.display          = tab === 'cancellati'           ? 'block' : 'none';
  document.getElementById('tab-confermati').style.display          = tab === 'confermati'           ? 'block' : 'none';
  document.getElementById('tab-dashboard-approvator').style.display = tab === 'dashboard-approvator' ? 'block' : 'none';
  document.getElementById('tab-dashboard-cucina').style.display      = tab === 'dashboard-cucina'     ? 'block' : 'none';
  document.getElementById('tab-report').style.display                = tab === 'report'               ? 'block' : 'none';
  document.getElementById('tab-gestione-utenti').style.display       = tab === 'gestione-utenti'      ? 'block' : 'none';
  document.getElementById('tab-btn-pagamenti').classList.toggle('active',            tab === 'pagamenti');
  document.getElementById('tab-btn-import-movimenti').classList.toggle('active',     tab === 'import-movimenti');
  document.getElementById('tab-btn-scordarelli').classList.toggle('active',          tab === 'scordarelli');
  document.getElementById('tab-btn-cancellati').classList.toggle('active',           tab === 'cancellati');
  document.getElementById('tab-btn-confermati').classList.toggle('active',           tab === 'confermati');
  document.getElementById('tab-btn-dashboard-approvator').classList.toggle('active', tab === 'dashboard-approvator');
  document.getElementById('tab-btn-dashboard-cucina').classList.toggle('active',     tab === 'dashboard-cucina');
  document.getElementById('tab-btn-report').classList.toggle('active',               tab === 'report');
  document.getElementById('tab-btn-gestione-utenti').classList.toggle('active',      tab === 'gestione-utenti');
  if (tab === 'dashboard-approvator') loadDashboardApprovator();
  if (tab === 'dashboard-cucina')     loadDashboardCucina();
  if (tab === 'report')               loadReport();
  if (tab === 'gestione-utenti')      loadGestioneUtenti();
}


// =====================
// IMPORTA MOVIMENTI CSV
// =====================
let _importCsvContent = null;
let _importCsvRisultati = null;
let _importCsvRiepilogo = null;

function onImportCsvFileSelected(input) {
  const file = input.files[0];
  const nomeFileSpan = document.getElementById('importCsvFileName');

  document.getElementById('importCsvOkBtn').disabled = !file;
  _importCsvContent = null;

  if (!file) {
    nomeFileSpan.textContent = 'Nessun file selezionato';
    nomeFileSpan.classList.remove('import-csv-filename-selected');
    return;
  }

  nomeFileSpan.textContent = file.name;
  nomeFileSpan.classList.add('import-csv-filename-selected');

  const reader = new FileReader();
  reader.onload = (e) => { _importCsvContent = e.target.result; };
  reader.readAsText(file, 'UTF-8');
}

function avviaImportCsv() {
  if (!_importCsvContent) {
    alert('Seleziona prima un file CSV.');
    return;
  }

  const btn = document.getElementById('importCsvOkBtn');
  btn.disabled = true;
  document.getElementById('import-csv-loading').style.display   = 'block';
  document.getElementById('import-csv-risultati').style.display = 'none';

  apiCall({ action: 'importaMovimentiBancari', formData: { csv: _importCsvContent } })
    .then(res => {
      if (res.esito !== 'OK') {
        alert(res.messaggio || 'Errore durante l\'importazione.');
        return;
      }
      _importCsvRisultati = res.risultati;
      _importCsvRiepilogo = res.riepilogo;
      renderRisultatiImportCsv(res.risultati);
    })
    .catch(err => { if (err !== 'auth') { console.error(err); alert('Errore di connessione.'); } })
    .finally(() => {
      btn.disabled = false;
      document.getElementById('import-csv-loading').style.display = 'none';
    });
}

// Ricalcola il riepilogo (Totale/Validabili/Da segnalare/Già validati/Non trovati/Scartati)
// leggendo lo stato LIVE delle righe validate in questa sessione (classe "pagata"), invece di
// restare fermo ai numeri del momento dell'import — altrimenti "Validabili" resta gonfio anche
// dopo aver validato tutto. I validati "ora" si sommano a "Già validati" (quelli import-time,
// GIA_VALIDATO) invece di aggiungere un contatore a parte.
function aggiornaRiepilogoImportCsv() {
  const el = document.getElementById('import-csv-riepilogo');
  if (!el || !_importCsvRiepilogo) return;

  const validatiOra = document.querySelectorAll('#tbody-import-csv tr.pagata').length;
  const r = _importCsvRiepilogo;

  el.innerHTML =
    `Totale righe: <strong>${r.totale}</strong> &mdash; ` +
    `Validabili: <strong style="color: var(--green);">${r.validabili - validatiOra}</strong> &mdash; ` +
    `Da segnalare: <strong style="color:#e8a000;">${r.daSegnalare}</strong> &mdash; ` +
    `Già validati: <strong style="color:#999;">${(r.giaValidati || 0) + validatiOra}</strong> &mdash; ` +
    `Non trovati: <strong style="color:#c0392b;">${r.nonTrovati}</strong> &mdash; ` +
    `Scartati: <strong style="color:#999;">${r.scartati}</strong> &mdash; ` +
    `Ignorati: <strong style="color:#999;">${r.ignorati || 0}</strong> &mdash; ` +
    `Duplicati nel file: <strong style="color:#999;">${r.duplicatiNelFile || 0}</strong>`;
}

function renderRisultatiImportCsv(risultati) {
  aggiornaRiepilogoImportCsv();

  const tbody = document.getElementById('tbody-import-csv');
  tbody.innerHTML = risultati.map(r => {
    const trovato      = r.trovato === 'SI';
    const giaValidato   = r.trovato === 'GIA_VALIDATO';
    const validabile   = trovato && r.importoOk;
    const daSegnalare  = trovato && !r.importoOk;
    const classeRiga = validabile ? 'import-riga-ok' : (daSegnalare ? 'import-riga-warning' : (giaValidato ? 'import-riga-neutra' : ''));
    const descrizioneSicura = (r.descrizione || '').replace(/"/g, '&quot;');
    const nominativo = (trovato || giaValidato) ? `${r.nome || ''} ${r.cognome || ''}`.trim() : '—';
    const atteso = trovato ? `&euro; ${r.prezzo}` : '—';

    let checkboxCell = '<td></td>';
    let azioniCell = '<td></td>';

    if (validabile) {
      checkboxCell = `<td><input type="checkbox" class="import-csv-check" data-codice-titolare="${r.codiceTitolare}" data-codice-bonifico="${r.codiceBonifico}" onchange="aggiornaContatoreSelezionatiImportCsv()"></td>`;
      azioniCell = `<td>
        <button class="btn-conferma" id="btn-${r.codiceBonifico}" onclick="confermaPagamento('${r.codiceTitolare}', '${r.codiceBonifico}', this)">
          &#10003; Valida
        </button>
      </td>`;
    } else if (daSegnalare) {
      azioniCell = `<td>
        <button class="btn-issue" id="btn-issue-${r.codiceBonifico}" onclick="openMailModal('${r.email}', '${r.nome}', '${r.codiceBonifico}', ${r.prezzo}, this)">
          Segnala
        </button>
      </td>`;
    }

    const rigaId = trovato ? ` id="riga-${r.codiceBonifico}"` : '';

    return `<tr class="${classeRiga}"${rigaId}>
      ${checkboxCell}
      <td>${r.dataOp || '—'}</td>
      <td class="cell-email" title="${descrizioneSicura}">${r.causale || r.descrizione || '—'}</td>
      <td>&euro; ${r.importo || '—'}</td>
      <td>${atteso}</td>
      <td>${nominativo}</td>
      <td>${r.ordinante || '—'}</td>
      <td class="import-csv-note">${r.note || ''}</td>
      ${azioniCell}
    </tr>`;
  }).join('');

  document.getElementById('import-csv-select-all').checked = false;
  aggiornaContatoreSelezionatiImportCsv();
  document.getElementById('import-csv-risultati').style.display = 'block';
}

function toggleSelezionaTuttiImportCsv(masterCheckbox) {
  document.querySelectorAll('.import-csv-check:not(:disabled)').forEach(cb => { cb.checked = masterCheckbox.checked; });
  aggiornaContatoreSelezionatiImportCsv();
}

function aggiornaContatoreSelezionatiImportCsv() {
  const selezionati = document.querySelectorAll('.import-csv-check:checked').length;
  document.getElementById('import-csv-num-selezionati').textContent = selezionati;
  //la validazione collettiva ha senso solo con 2+ selezionate; per una sola riga c'è già "Valida" individuale
  document.getElementById('btnValidaSelezionati').disabled = selezionati < 2;
}

function validaSelezionatiImportCsv() {
  const checkbox = [...document.querySelectorAll('.import-csv-check:checked')];
  if (checkbox.length === 0) return;

  const lista = checkbox.map(cb => ({ codiceTitolare: cb.dataset.codiceTitolare, codiceBonifico: cb.dataset.codiceBonifico }));

  openConfirmModal(
    `Stai per validare <strong>${lista.length}</strong> pagament${lista.length === 1 ? 'o' : 'i'} selezionat${lista.length === 1 ? 'o' : 'i'}. Continuare?`,
    () => {
      const btnBulk = document.getElementById('btnValidaSelezionati');
      btnBulk.disabled = true;
      document.getElementById('loading-overlay').style.display = 'flex';

      apiCall({ action: 'confermaPagamentiMultipli', formData: { lista } })
        .then(res => {
          if (res.esito !== 'OK') {
            alert(res.messaggio || 'Errore durante la validazione multipla.');
            return;
          }
          const falliti = [];
          res.risultati.forEach(r => {
            //bottone risalito dalla checkbox effettivamente selezionata (non da un getElementById
            //per codiceBonifico, ambiguo se lo stesso codice compare anche nel tab Validazione
            //Pagamenti): garantisce di aggiornare la riga giusta di QUESTA tabella
            const cb = checkbox.find(c => c.dataset.codiceBonifico === r.codiceBonifico);
            const btnRiga = cb?.closest('tr')?.querySelector('.btn-conferma');
            if (r.esito === 'OK') {
              //esitoPagamento gestisce già btn + riga + checkbox (vedi definizione)
              if (btnRiga) esitoPagamento({ esito: 'OK' }, btnRiga);
            } else {
              //riga NON toccata di proposito: il pagamento non è stato confermato lato BE
              //(quota email esaurita, errore invio biglietto...), resta ri-validabile subito
              console.error(`Validazione fallita per ${r.codiceBonifico}: ${r.messaggio}`);
              falliti.push(`${r.codiceBonifico}: ${r.messaggio}`);
            }
          });

          if (falliti.length > 0) {
            const validati = res.risultati.length - falliti.length;
            alert(
              `${validati} pagament${validati === 1 ? 'o' : 'i'} validat${validati === 1 ? 'o' : 'i'} con successo.\n\n` +
              `${falliti.length} NON validat${falliti.length === 1 ? 'o' : 'i'} (puoi riprovare):\n` +
              falliti.map(f => `- ${f}`).join('\n')
            );
          }

          aggiornaContatoreSelezionatiImportCsv();
          loadDashboardStats();
        })
        .catch(err => { if (err !== 'auth') { console.error(err); alert('Errore di connessione.'); } })
        .finally(() => {
          btnBulk.disabled = false;
          document.getElementById('loading-overlay').style.display = 'none';
        });
    },
    { icon: '✓', title: 'Validazione collettiva' }
  );
}

function scaricaRisultatiImportCsv() {
  if (!_importCsvRisultati || _importCsvRisultati.length === 0) return;

  const header = 'Data Op.;Data Val.;Descrizione;Importo;Divisa;Match;Trovato;Importo OK;Nominativo;Ordinante;Stato;Note';
  const righe = _importCsvRisultati.map(r => {
    const descrizioneSanificata = (r.descrizione || '').replace(/;/g, ',');
    const ordinanteSanificato   = (r.ordinante || '').replace(/;/g, ',');
    const noteSanificata        = (r.note || '').replace(/;/g, ',');
    const nominativo            = (r.trovato === 'SI' || r.trovato === 'GIA_VALIDATO') ? `${r.nome || ''} ${r.cognome || ''}`.trim() : '';

    //leggo lo stato reale dalla riga in pagina (aggiornato sia da validazione singola che multipla),
    //così lo scarico riflette sempre quello che è successo davvero, non solo l'esito dell'import iniziale
    let stato = '';
    if (r.trovato === 'SI') {
      //cerco solo dentro il tbody di QUESTA tabella: lo stesso codiceBonifico può comparire
      //anche nel tab Validazione Pagamenti con lo stesso id riga, un getElementById globale
      //rischierebbe di leggere lo stato dell'altro tab
      const riga = document.getElementById('tbody-import-csv').querySelector(`[id="riga-${r.codiceBonifico}"]`);
      stato = (riga && riga.classList.contains('pagata')) ? 'VALIDATO' : 'NON VALIDATO';
    } else if (r.trovato === 'GIA_VALIDATO') {
      stato = 'GIA VALIDATO IN PRECEDENZA';
    }

    return [r.dataOp, r.dataVal, descrizioneSanificata, r.importo, r.divisa, r.match, r.trovato, r.importoOk ? 'SI' : 'NO', nominativo, ordinanteSanificato, stato, noteSanificata].join(';');
  });

  const csvContent = [header, ...righe].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `movimenti-importati-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}


// =====================
// OVERDUE REGISTRANTS
// =====================
function loadOverdueRegistrants() {
  const giorni = document.getElementById('select-giorni').value;

  document.getElementById('loading-overlay').style.display          = 'flex';
  document.getElementById('risultati-scordarelli').style.display    = 'none';
  document.getElementById('nessun-scordarello').style.display       = 'none';

  apiCall({ action: 'findOverdueRegistrants', formData: { giorni: Number(giorni) } })
    .then(res => showOverdueRegistrants(res))
    .catch(err => { if (err !== 'auth') console.error(err); })
    .finally(() => { document.getElementById('loading-overlay').style.display = 'none'; });
}

function esportaScordarelliCsv(btn) {
  const giorni = Number(document.getElementById('select-giorni').value);

  btn.disabled = true;
  document.getElementById('loading-overlay').style.display = 'flex';

  apiCall({ action: 'esportaScordarelliCompleto', formData: { giorni } })
    .then(lista => {
      if (!lista || lista.length === 0) {
        alert('Nessuno scordarello da esportare.');
        return;
      }
      const intestazione = [
        'Cod. Bonifico', 'Cognome', 'Nome', 'Codice Fiscale', 'Email', 'Indirizzo', 'Città', 'Provincia',
        'Adulti', 'Bambini', 'Infanti', 'Menu 1', 'Menu 2', 'Birre', 'Prezzo Atteso', 'Frequenta SMA',
        'Data Registrazione'
      ];
      const righe = lista.map(r => [
        r.codiceBonifico, r.cognome, r.nome, r.codiceFiscale, r.email, r.indirizzo, r.citta, r.provincia,
        r.adulti, r.bambini, r.infanti, r.menu1, r.menu2, r.birre, r.prezzo, r.frequentaSma,
        r.dataRegistrazione
      ]);
      const oggi = new Date().toISOString().slice(0, 10);
      _scaricaCsv(`scordarelli_${giorni}gg_${oggi}.csv`, [intestazione, ...righe]);
    })
    .catch(err => { if (err !== 'auth') { console.error(err); alert('Errore durante l\'esportazione.'); } })
    .finally(() => {
      btn.disabled = false;
      document.getElementById('loading-overlay').style.display = 'none';
    });
}

function showOverdueRegistrants(lista) {
  if (!lista || lista.length === 0) {
    document.getElementById('nessun-scordarello').style.display      = 'block';
    document.getElementById('risultati-scordarelli').style.display   = 'none';
    return;
  }

  document.getElementById('contatore-scordarelli').innerText =
    `${lista.length} scordarell${lista.length === 1 ? 'o' : 'i'} trovat${lista.length === 1 ? 'o' : 'i'}`;

  const tbody = document.getElementById('tbody-scordarelli');
  tbody.innerHTML = '';

  lista.forEach(r => {
    const partecipanti = r.adulti + r.bambini + r.infanti;
    const dataRegistrazione = r.dataRegistrazione || '—';

    const tr  = document.createElement('tr');
    tr.id     = `riga-sc-${r.codiceBonifico}`;
    tr.innerHTML = `
      <td title="codice titolare: ${r.codiceTitolare}">${_renderCodiceBonifico(r.codiceTitolare, r.codiceBonifico)}</td>
      <td>${r.nome}</td>
      <td>${r.cognome}</td>
      <td class="cell-email" title="${r.email}">${r.email}</td>
      <td><span class="badge" title="${r.adulti} Adulti, ${r.bambini} Minori, ${r.infanti} Infanti">${_renderPartecipantiCount(r.codiceTitolare, partecipanti)}</span></td>
      <td>${r.menu1}</td>
      <td>${r.menu2}</td>
      <td>${r.birre}</td>
      <td>${r.frequentaSma || '—'}</td>
      <td class="data-iscrizione">${dataRegistrazione}</td>
      <td class="totale">€ ${Number(r.prezzo).toFixed(2)}</td>
      <td>
        <div class="cell-actions">
          <button
            class="btn-delete"
            id="btn-sc-${r.codiceBonifico}"
            onclick="cancellaPrenotazione('${r.codiceTitolare}', '${r.codiceBonifico}', this)">
            🗑 Cancella
          </button>
          <button
            class="btn-issue"
            id="btn-sc-issue-${r.codiceBonifico}"
            onclick="openMailModalSollecito('${r.email}', '${r.nome}', '${r.codiceBonifico}', '${r.prezzo}', this)">
            Sollecita
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById('risultati-scordarelli').style.display = 'block';
}


// =====================
// CANCELLA PRENOTAZIONE
// =====================
function cancellaPrenotazione(codiceTitolare, codiceBonifico, btn) {
  // reset radio buttons e campo Altro
  document.querySelectorAll('input[name="motivo"]').forEach(r => r.checked = false);
  document.getElementById('motivo-altro-container').style.display = 'none';
  document.getElementById('motivo-altro-text').value = '';
  document.getElementById('cancelModalText').innerHTML =
    `Stai per <strong>cancellare definitivamente</strong> la prenotazione per il codice <strong>${codiceBonifico}</strong>.<br>Questa operazione non è reversibile.`;

  // mostra/nascondi campo testo Altro al cambio selezione
  document.querySelectorAll('input[name="motivo"]').forEach(r => {
    r.onchange = () => {
      document.getElementById('motivo-altro-container').style.display =
        r.value === 'Altro' && r.checked ? 'block' : 'none';
    };
  });

  const modal = document.getElementById('cancelModal');
  modal.style.display = 'flex';

  document.getElementById('cancelModalOkBtn').onclick = () => {
    const motivoSelezionato = document.querySelector('input[name="motivo"]:checked')?.value;
    if (!motivoSelezionato) { alert('Seleziona un motivo per la cancellazione.'); return; }

    let motivo = motivoSelezionato;
    if (motivoSelezionato === 'Altro') {
      const altroText = document.getElementById('motivo-altro-text').value.trim();
      if (!altroText) { alert('Specifica il motivo per la scelta "Altro".'); return; }
      motivo = `Altro: ${altroText}`;
    }

    closeCancelModal();
    btn.disabled  = true;
    btn.innerText = '⏳ Annullo...';
    document.getElementById('loading-overlay').style.display = 'flex';

    apiCall({ action: 'cancellaPrenotazione', formData: { codiceTitolare, codiceBonifico, motivo } })
      .then(res => esitoAnnullamento(res, codiceBonifico, btn))
      .catch(err => {
        if (err !== 'auth') console.error(err);
        btn.disabled  = false;
        btn.innerText = '🗑 Cancella';
      })
      .finally(() => { document.getElementById('loading-overlay').style.display = 'none'; });
  };
}

function closeCancelModal() {
  document.getElementById('cancelModal').style.display = 'none';
}

function esitoAnnullamento(risposta, codiceBonifico, btn) {
  if (risposta.esito === 'OK') {
    btn.innerText = '✅ Cancellata';
    btn.classList.add('confermato');
    const riga = document.getElementById(`riga-sc-${codiceBonifico}`);
    if (riga) riga.classList.add('annullata');
    const btnIssue = document.getElementById(`btn-sc-issue-${codiceBonifico}`);
    if (btnIssue) btnIssue.style.display = 'none';
    loadDashboardStats();
  } else {
    btn.disabled  = false;
    btn.innerText = '🗑 Cancella';
    alert('❌ Errore: ' + risposta.messaggio);
  }
}


// =====================
// MAIL SOLLECITO
// =====================
function openMailModalSollecito(email, nome, codiceBonifico, prezzo, btn) {
  const codiceFormattato = formatCodiceEmail(codiceBonifico);
  const importoAtteso    = Number(prezzo).toFixed(2);
  document.getElementById('modalTitle').innerHTML = '&#128231; Invia Sollecito';
  document.getElementById('modalEmail').value   = email;
  document.getElementById('modalSubject').value = `ATTENZIONE: saldo iscrizione da completare entro oggi`;
  document.getElementById('modalBody').innerHTML = _templateEmailHtml
`<b>ATTENZIONE: LA TUA ISCRIZIONE NON È ANCORA STATA CONFERMATA.</b>

Ciao ${nome},

non avendo ancora ricevuto il saldo di €${importoAtteso}, 
ti chiediamo di effettuare il bonifico istantaneo e inviarci l'evidenza del versamento <b>entro oggi, 15 settembre</b>.

Dettagli per il versamento dell'offerta:
• IBAN: IT88Z0623033711000015114948
• Intestazione: A.M.A. ASSOCIAZIONE AMICI MARIA AUSILIATRICE A P.S.
• Causale: <b>${codiceFormattato}</b>

<b>IMPORTANTE: senza evidenza del versamento entro la giornata di oggi, 15 settembre 2026, la prenotazione sarà considerata annullata</b> 
e i posti verranno resi disponibili per altre famiglie in lista d'attesa.

Se invece hai già effettuato il bonifico, <b>rispondi a questa e-mail inviando copia degli estremi del pagamento.</b>

Grazie per la collaborazione.
AMA Crew
`;

  document.getElementById('mailModal').style.display = 'flex';
}


// =====================
// PENDING PAYMENTS SHORTCUT
// =====================
function openPendingPayments() {
  showTab('pagamenti');
  document.getElementById('loading-overlay').style.display = 'flex';
  document.getElementById('risultati').style.display       = 'none';
  document.getElementById('nessun-risultato').style.display = 'none';

  apiCall({ action: 'findAllPendingPayments' })
    .then(res => mostraRisultati(res))
    .catch(err => { if (err !== 'auth') console.error(err); })
    .finally(() => { document.getElementById('loading-overlay').style.display = 'none'; });
}

function openConfermati() {
  showTab('confermati');
  loadConfermati();
}


// =====================
// STATUS FOOTER
// =====================
const STATS_REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minuti
let _statsTimer = null;
let _lastStats  = null;

function startStatsPolling() {
  if (_statsTimer) clearInterval(_statsTimer);
  _statsTimer = setInterval(() => {
    loadDashboardStats();
    refreshPermessi();
  }, STATS_REFRESH_INTERVAL_MS);
}

function loadDashboardStats() {
  apiCall({ action: 'getDashboardStats' })
    .then(stats => renderDashboardStats(stats))
    .catch(err => { if (err !== 'auth') console.warn('stats error', err); });
}

function renderDashboardStats(s) {
  _lastStats = s;
  document.getElementById('status-footer').classList.add('visible');

  _setStatVal('stat-pending-val', s.utentiDaApprovare,
    s.utentiDaApprovare > 0 ? 'warn' : '');

  _setStatVal('stat-confermati-val', s.confermati, '');

  _setStatVal('stat-totale-val', s.partecipantiTotali, '');

  const m1pct = s.menu1Max > 0 ? s.menu1Rimanenti / s.menu1Max : 1;
  _setStatVal('stat-menu1-val', `${s.menu1Rimanenti} / ${s.menu1Max}`,
    m1pct < 0.1 ? 'alert' : m1pct < 0.25 ? 'warn' : '');

  const m2pct = s.menu2Max > 0 ? s.menu2Rimanenti / s.menu2Max : 1;
  _setStatVal('stat-menu2-val', `${s.menu2Rimanenti} / ${s.menu2Max}`,
    m2pct < 0.1 ? 'alert' : m2pct < 0.25 ? 'warn' : '');

  _setStatVal('stat-birre-val', `${s.birreBoccali} boc. (${s.birreLitri} L)`, '');

  _setStatVal('stat-email-val', s.emailQuota,
    s.emailQuota < 20 ? 'alert' : s.emailQuota < 50 ? 'warn' : '');

  const now = new Date();
  document.getElementById('stat-last-update').innerText =
    `Agg. ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
}

function _setStatVal(id, value, cssClass) {
  const el = document.getElementById(id);
  el.innerText  = value;
  el.className  = 'stat-value' + (cssClass ? ' ' + cssClass : '');
}


// =====================
// CANCELLATI
// =====================
function loadCancellati() {
  document.getElementById('loading-overlay').style.display       = 'flex';
  document.getElementById('risultati-cancellati').style.display  = 'none';
  document.getElementById('nessun-cancellato').style.display     = 'none';

  apiCall({ action: 'findCancellati' })
    .then(res => showCancellati(res))
    .catch(err => { if (err !== 'auth') console.error(err); })
    .finally(() => { document.getElementById('loading-overlay').style.display = 'none'; });
}

function showCancellati(lista) {
  if (!lista || lista.length === 0) {
    document.getElementById('nessun-cancellato').style.display = 'block';
    return;
  }

  document.getElementById('contatore-cancellati').innerText =
    `${lista.length} prenotazion${lista.length === 1 ? 'e cancellata' : 'i cancellate'}`;

  const tbody = document.getElementById('tbody-cancellati');
  tbody.innerHTML = '';

  lista.forEach(r => {
    const partecipanti = r.adulti + r.bambini + r.infanti;
    const tr  = document.createElement('tr');
    tr.id     = `riga-can-${r.codiceBonifico}`;
    tr.innerHTML = `
      <td title="codice titolare: ${r.codiceTitolare}"><strong>${r.codiceBonifico}</strong></td>
      <td>${r.nome}</td>
      <td>${r.cognome}</td>
      <td class="cell-email" title="${r.email}">${r.email}</td>
      <td><span class="badge" title="${r.adulti} Adulti, ${r.bambini} Minori, ${r.infanti} Infanti">${_renderPartecipantiCount(r.codiceTitolare, partecipanti)}</span></td>
      <td>${r.menu1}</td>
      <td>${r.menu2}</td>
      <td>${r.birre}</td>
      <td>${r.frequentaSma || '&#8212;'}</td>
      <td class="totale">&#8364; ${Number(r.prezzo).toFixed(2)}</td>
      <td class="motivo-cell">${r.motivoCancellazione || '&#8212;'}</td>
      <td>${r.dataRegistrazione || '&#8212;'}</td>
      <td class="data-gestione">${r.dataGestione || '&#8212;'}</td>
      <td>${r.operatore || '&#8212;'}</td>
      <td>
        <button
          class="btn-restore"
          id="btn-can-${r.codiceBonifico}"
          onclick="apriRipristinoModal('${r.codiceTitolare}', '${r.codiceBonifico}', '${r.nome}', '${r.cognome}', ${r.menu1}, ${r.menu2}, this)">
          &#128260; Ripristina
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById('risultati-cancellati').style.display = 'block';
}


// =====================
// RIPRISTINO PRENOTAZIONE
// =====================
let _ripristinoCallback = null;

function apriRipristinoModal(codiceTitolare, codiceBonifico, nome, cognome, menu1, menu2, btn) {
  document.getElementById('ripristinoModalText').innerHTML =
    `Stai per ripristinare la prenotazione di:<br><strong>${nome} ${cognome} (${codiceBonifico})</strong><br>L'iscritto torner&#224; allo stato <em>Registrazione OK</em>.`;

  const warningDiv  = document.getElementById('ripristino-overbooking-warning');
  const warningText = document.getElementById('ripristino-warning-text');
  const righe = [];

  if (_lastStats) {
    const m1dopo = _lastStats.menu1Rimanenti - menu1;
    const m2dopo = _lastStats.menu2Rimanenti - menu2;
    if (m1dopo < 0) righe.push(`Menu 1: Rimanenti ${_lastStats.menu1Rimanenti} &mdash; Richiesti ${menu1} &#8594; <strong>${-m1dopo} in Overbooking</strong>`);
    if (m2dopo < 0) righe.push(`Menu 2: Rimanenti ${_lastStats.menu2Rimanenti} &mdash; Richiesti ${menu2} &#8594; <strong>${-m2dopo} in Overbooking</strong>`);
  }

  if (righe.length > 0) {
    warningText.innerHTML = righe.map(r => `<div class="ripristino-warning-row">${r}</div>`).join('');
    warningDiv.style.display = 'block';
  } else {
    warningDiv.style.display = 'none';
  }

  document.getElementById('ripristinoModal').style.display = 'flex';

  document.getElementById('ripristinoModalOkBtn').onclick = () => {
    closeRipristinoModal();
    btn.disabled  = true;
    btn.innerText = '&#9203; Ripristino...';
    document.getElementById('loading-overlay').style.display = 'flex';

    apiCall({ action: 'ripristinaPrenotazione', formData: { codiceTitolare, codiceBonifico } })
      .then(res => esitoRipristino(res, codiceBonifico, btn))
      .catch(err => {
        if (err !== 'auth') console.error(err);
        btn.disabled  = false;
        btn.innerHTML = '&#128260; Ripristina';
      })
      .finally(() => { document.getElementById('loading-overlay').style.display = 'none'; });
  };
}

function closeRipristinoModal() {
  document.getElementById('ripristinoModal').style.display = 'none';
}

function esitoRipristino(risposta, codiceBonifico, btn) {
  if (risposta.esito === 'OK') {
    btn.innerHTML = '&#9989; Ripristinata';
    btn.classList.add('confermato');
    const riga = document.getElementById(`riga-can-${codiceBonifico}`);
    if (riga) riga.classList.add('ripristinata');
    loadDashboardStats();
  } else {
    btn.disabled  = false;
    btn.innerHTML = '&#128260; Ripristina';
    alert('&#10060; Errore: ' + risposta.messaggio);
  }
}


// =====================
// CONFERMATI
// =====================
let _listaConfermati    = [];
let _filteredConfermati = [];
let _pageConfermati     = 0;
let _sortConfermatiKey  = null;
let _sortConfermatiDir  = 0;   // 0=originale, 1=discendente, 2=ascendente
let _filtroStatoConfermati = ''; // '' = tutti, 'PAGATO', 'ENTRATO'
const PAGE_SIZE_CONFERMATI = 25;

const _CONF_SORT_COLS = ['codiceBonifico', 'cognome', 'nome', 'stato', 'dataRegistrazione', 'dataGestione'];

/**
 * Etichetta colorata per lo stato — stessi colori usati lato BE per
 * REGISTRATION_STATUS_COLOR_MAP (PAGATO/ENTRATO), per coerenza visiva in tutto il sistema.
 */
function _renderStatoBadge(stato) {
  const classe = stato === 'ENTRATO' ? 'badge-stato-entrato' : 'badge-stato-pagato';
  const etichetta = stato === 'ENTRATO' ? 'Entrato' : 'Pagato';
  return `<span class="badge-stato ${classe}">${etichetta}</span>`;
}

function loadConfermati() {
  document.getElementById('loading-overlay').style.display       = 'flex';
  document.getElementById('risultati-confermati').style.display  = 'none';
  document.getElementById('nessun-confermato').style.display     = 'none';

  apiCall({ action: 'findConfermati' })
    .then(res => showConfermati(res))
    .catch(err => { if (err !== 'auth') console.error(err); })
    .finally(() => { document.getElementById('loading-overlay').style.display = 'none'; });
}

/**
 * Costruisce e scarica un CSV lato client (nessuna dipendenza esterna). Delimitatore ";" e BOM
 * UTF-8 in testa al file: Excel in locale italiano si aspetta ";" (la "," è già il separatore
 * decimale) e senza BOM interpreta erroneamente gli accenti in un file UTF-8.
 */
function _csvEscape(valore) {
  const str = (valore === null || valore === undefined) ? '' : String(valore);
  return /[;"\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function _scaricaCsv(nomeFile, righe) {
  const contenuto = righe.map(riga => riga.map(_csvEscape).join(';')).join('\r\n');
  const blob = new Blob(['﻿' + contenuto], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeFile;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function esportaConfermatiCsv(btn) {
  btn.disabled = true;
  document.getElementById('loading-overlay').style.display = 'flex';

  apiCall({ action: 'esportaConfermatiCompleto' })
    .then(lista => {
      if (!lista || lista.length === 0) {
        alert('Nessun confermato da esportare.');
        return;
      }
      const intestazione = [
        'Cod. Bonifico', 'Cognome', 'Nome', 'Codice Fiscale', 'Email', 'Indirizzo', 'Città', 'Provincia',
        'Adulti', 'Bambini', 'Infanti', 'Menu 1', 'Menu 2', 'Birre', 'Prezzo', 'Frequenta SMA', 'Stato',
        'Data Registrazione', 'Data Conferma', 'Data Ingresso', 'Operatore Ingresso', 'Partecipanti Aggiuntivi'
      ];
      const righe = lista.map(r => [
        r.codiceBonifico, r.cognome, r.nome, r.codiceFiscale, r.email, r.indirizzo, r.citta, r.provincia,
        r.adulti, r.bambini, r.infanti, r.menu1, r.menu2, r.birre, r.prezzo, r.frequentaSma, r.stato,
        r.dataRegistrazione, r.dataGestione, r.dataIngresso, r.operatoreIngresso, r.partecipantiAggiuntivi
      ]);
      const oggi = new Date().toISOString().slice(0, 10);
      _scaricaCsv(`confermati_${oggi}.csv`, [intestazione, ...righe]);
    })
    .catch(err => { if (err !== 'auth') { console.error(err); alert('Errore durante l\'esportazione.'); } })
    .finally(() => {
      btn.disabled = false;
      document.getElementById('loading-overlay').style.display = 'none';
    });
}

/**
 * Lista di backup per la gestione manuale degli ingressi in caso di problemi tecnici (mancata
 * connettività per la scansione/verifica online dei QR code). Colori delle colonne Pizze/
 * Focacce/Birre da applicare a mano in Excel dopo il download (coerenti con i token nell'app
 * verifica-biglietti): Pizze #E53935 testo bianco, Focacce #FF8C32 testo scuro, Birre #FFD400
 * testo scuro.
 */
/**
 * Genera un vero file .xlsx (via xlsx-js-style, vendorizzata in js/vendor/xlsx-js-style.min.js
 * — mai da CDN esterno) con le colonne Pizze/Focacce/Birre già colorate come i token nell'app
 * verifica-biglietti, senza bisogno di colorarle a mano dopo il download.
 *
 * Scelta deliberata rispetto a ExcelJS (provata prima): ExcelJS ha un bug noto e documentato
 * per cui workbook.xlsx.writeBuffer() a volte non si risolve mai nei bundle browser/minificati
 * ("silently breaks in production" — riscontrato proprio così in test). xlsx-js-style (fork di
 * SheetJS) scrive il file in modo SINCRONO (XLSX.write, nessuna Promise che possa restare
 * pending), evitando alla radice quella classe di problema.
 */
function esportaIngressiManualeCsv(btn) {
  btn.disabled = true;
  document.getElementById('loading-overlay').style.display = 'flex';

  apiCall({ action: 'esportaIngressiManualeCompleto' })
    .then(lista => {
      if (!lista || lista.length === 0) {
        alert('Nessun confermato da esportare.');
        return;
      }

      //prima colonna vuota con un quadratino ☐: da spuntare a mano (a schermo o su stampa) man
      //mano che le persone entrano, in caso di validazione manuale senza connettività
      //Cod. Bonifico: SOLO i tre numeri, senza il prefisso "AMA" (richiesta esplicita) — resta
      //testo (non numero), altrimenti si perderebbero gli eventuali zeri iniziali (es. "023"->23)
      const intestazione = ['Ingresso', 'Cod. Bonifico', 'Cod. AMA', 'Cognome', 'Nome', 'Partecipanti', 'Pizze', 'Focacce', 'Birre'];
      const righe = lista.map(r => [
        '☐', r.codiceBonifico.replace(/^AMA/i, ''), r.codiceAma, r.cognome, r.nome, r.partecipanti, r.menu1, r.menu2, r.birre
      ]);

      const worksheet = XLSX.utils.aoa_to_sheet([intestazione, ...righe]);
      //colonne più larghe e font generale più grande: pensato per stampare in orizzontale
      //occupando tutto lo spazio di un A4 (nota: l'orientamento/adattamento pagina va comunque
      //impostato a mano in Excel — Imposta pagina > Orizzontale > Adatta a 1 pagina — la
      //libreria usata per generare il file non supporta di scriverlo lei stessa)
      worksheet['!cols'] = [{ wch: 11 }, { wch: 15 }, { wch: 14 }, { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 11 }, { wch: 11 }, { wch: 11 }];

      const FONT_BASE = 13;

      //intestazione in grassetto
      intestazione.forEach((_, colIdx) => {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: colIdx });
        if (worksheet[cellRef]) worksheet[cellRef].s = { font: { bold: true, sz: FONT_BASE } };
      });

      //font più grande su tutte le celle dati (poi sovrascritto dove serve grassetto/colore)
      righe.forEach((_, rowIdx) => {
        for (let colIdx = 0; colIdx < intestazione.length; colIdx++) {
          const cellRef = XLSX.utils.encode_cell({ r: rowIdx + 1, c: colIdx });
          if (worksheet[cellRef]) worksheet[cellRef].s = { font: { sz: FONT_BASE } };
        }
      });

      //quadratino centrato, ben visibile
      righe.forEach((_, rowIdx) => {
        const cellRef = XLSX.utils.encode_cell({ r: rowIdx + 1, c: 0 });
        if (worksheet[cellRef]) worksheet[cellRef].s = { font: { sz: 18 }, alignment: { horizontal: 'center', vertical: 'center' } };
      });

      //Partecipanti/Pizze/Focacce/Birre in grassetto (richiesta esplicita, sono i numeri che
      //contano per la consegna dei token) — Pizze/Focacce/Birre hanno anche gli stessi colori
      //dei token nell'app verifica-biglietti (css/ama-pwa.css)
      const coloreColonna = {
        6: { sfondo: 'E53935', testo: 'FFFFFF' }, //Pizze:   rosso, testo bianco
        7: { sfondo: 'FF8C32', testo: '1A1000' }, //Focacce: arancione, testo scuro
        8: { sfondo: 'FFD400', testo: '1A1000' }  //Birre:   giallo, testo scuro
      };
      righe.forEach((_, rowIdx) => {
        const cellPartecipanti = XLSX.utils.encode_cell({ r: rowIdx + 1, c: 5 });
        if (worksheet[cellPartecipanti]) worksheet[cellPartecipanti].s = { font: { bold: true, sz: FONT_BASE } };

        Object.entries(coloreColonna).forEach(([colIdx, { sfondo, testo }]) => {
          const cellRef = XLSX.utils.encode_cell({ r: rowIdx + 1, c: Number(colIdx) });
          if (worksheet[cellRef]) worksheet[cellRef].s = { fill: { fgColor: { rgb: sfondo } }, font: { bold: true, sz: FONT_BASE, color: { rgb: testo } } };
        });
      });

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, worksheet, 'Ingressi');
      //ripete la riga di intestazione su ogni pagina in stampa ("Righe da ripetere in alto" di
      //Excel) — a differenza dell'orientamento pagina, questa impostazione è supportata dalla
      //libreria e viene già salvata nel file, non serve impostarla a mano dopo il download
      wb.Workbook = { Names: [{ Sheet: 0, Name: '_xlnm.Print_Titles', Ref: "'Ingressi'!$1:$1" }] };
      const arrayBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

      const blob = new Blob([arrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ingressi-backup-manuale_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    })
    .catch(err => { if (err !== 'auth') { console.error(err); alert('Errore durante l\'esportazione.'); } })
    .finally(() => {
      btn.disabled = false;
      document.getElementById('loading-overlay').style.display = 'none';
    });
}

function showConfermati(lista) {
  _listaConfermati   = lista;
  _pageConfermati    = 0;
  _sortConfermatiKey = null;
  _sortConfermatiDir = 0;
  _filtroStatoConfermati = '';
  document.querySelectorAll('#filtro-stato-confermati .filtro-stato-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.stato === '');
  });
  document.getElementById('confermati-search').disabled = false;
  document.getElementById('confermati-search').value    = '';
  cercaConfermati('');
}

/** Filtro per stato (Tutti/Pagato/Entrato), applicato insieme alla ricerca testuale già attiva. */
function filtraStatoConfermati(stato, btn) {
  _filtroStatoConfermati = stato;
  document.querySelectorAll('#filtro-stato-confermati .filtro-stato-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  cercaConfermati(document.getElementById('confermati-search').value);
}

function cercaConfermati(q) {
  const needle = q.trim().toLowerCase();
  const base = _filtroStatoConfermati
    ? _listaConfermati.filter(r => r.stato === _filtroStatoConfermati)
    : _listaConfermati;
  _filteredConfermati = needle
    ? base.filter(r =>
        r.nome.toLowerCase().includes(needle)           ||
        r.cognome.toLowerCase().includes(needle)        ||
        r.email.toLowerCase().includes(needle)          ||
        r.codiceBonifico.toLowerCase().includes(needle) ||
        (r.dataRegistrazione || '').includes(needle)
      )
    : base.slice();
  _applySortConfermati();
  _pageConfermati = 0;
  _renderPaginaConfermati();
}

function _applySortConfermati() {
  if (_sortConfermatiDir === 0 || !_sortConfermatiKey) return;
  const key = _sortConfermatiKey;
  const dir = _sortConfermatiDir === 1 ? -1 : 1; // 1=desc→-1, 2=asc→+1
  _filteredConfermati.sort((a, b) => {
    let va, vb;
    if (key === 'dataRegistrazione' || key === 'dataGestione') {
      const parseDate = s => { if (!s) return 0; const [d, m, y] = s.split('/'); return new Date(+y, +m - 1, +d).getTime(); };
      va = parseDate(a[key]);
      vb = parseDate(b[key]);
    } else {
      va = a[key];
      vb = b[key];
    }
    if (typeof va === 'string') return dir * va.localeCompare(vb, 'it');
    return dir * (va - vb);
  });
}

function sortConfermati(key) {
  if (_sortConfermatiKey === key) {
    // ciclo: asc(2) → desc(1) → originale(0)
    _sortConfermatiDir--;
    if (_sortConfermatiDir === 0) _sortConfermatiKey = null;
  } else if (_sortConfermatiKey === null && key === 'cognome') {
    // già in ordine naturale = cognome asc → il primo click va a discendente
    _sortConfermatiKey = 'cognome';
    _sortConfermatiDir = 1;
  } else {
    _sortConfermatiKey = key;
    _sortConfermatiDir = 2; // parte da ascendente (▼)
  }
  const q = document.getElementById('confermati-search').value;
  cercaConfermati(q);
}

function _renderPaginaConfermati() {
  const lista  = _filteredConfermati;
  const totale = lista.length;
  const pages  = Math.max(1, Math.ceil(totale / PAGE_SIZE_CONFERMATI));
  if (_pageConfermati >= pages) _pageConfermati = pages - 1;

  const start = _pageConfermati * PAGE_SIZE_CONFERMATI;
  const slice = lista.slice(start, start + PAGE_SIZE_CONFERMATI);

  const nessuno = document.getElementById('nessun-confermato');
  const risultati = document.getElementById('risultati-confermati');

  if (totale === 0) {
    nessuno.style.display   = 'block';
    risultati.style.display = 'none';
    return;
  }

  nessuno.style.display   = 'none';
  risultati.style.display = 'block';

  const totStr = _listaConfermati.length === _filteredConfermati.length
    ? `<strong>${totale}</strong> iscritti confermati`
    : `<strong>${totale}</strong> risultati su ${_listaConfermati.length} confermati`;
  document.getElementById('contatore-confermati').innerHTML = totStr;

  _CONF_SORT_COLS.forEach((col) => {
    const th = document.getElementById(`th-conf-${col}`);
    if (!th) return;
    th.querySelector('.sort-arrow')?.remove();
    th.querySelector('.sort-hint')?.remove();

    const isDefault = (col === 'cognome' && _sortConfermatiDir === 0);
    const isActive  = (col === _sortConfermatiKey);
    const span = document.createElement('span');

    if (isActive || isDefault) {
      span.className = 'sort-arrow';
      // ▼ = ascendente (A→Z), ▲ = discendente (Z→A)
      span.innerHTML = (isDefault || _sortConfermatiDir === 2) ? '&#9660;' : '&#9650;';
    } else {
      span.className = 'sort-hint';
      span.innerHTML = '&#9650;&#9660;'; // ▲▼ hint inattivo
    }
    th.appendChild(span);
    th.style.backgroundColor = (isActive || isDefault) ? '#1565c0' : '#082652';
  });

  const tbody = document.getElementById('tbody-confermati');
  tbody.innerHTML = slice.map(r => {
    const part = r.adulti + r.bambini + r.infanti;
    return `<tr id="riga-conf-${r.codiceBonifico}">
      <td>${_renderCodiceBonifico(r.codiceTitolare, r.codiceBonifico)}</td>
      <td>${r.cognome}</td>
      <td>${r.nome}</td>
      <td class="cell-email" title="${r.email}">${r.email}</td>
      <td>${_renderPartecipantiCount(r.codiceTitolare, part)}</td>
      <td>${_renderStatoBadge(r.stato)}</td>
      <td>${r.dataRegistrazione || '&#8212;'}</td>
      <td>${r.dataGestione || '&#8212;'}</td>
      <td title="${r.operatoreIngresso ? 'Operatore: ' + r.operatoreIngresso : ''}">${r.dataIngresso || '&#8212;'}</td>
      <td>
        <button class="btn-resend"
          id="btn-resend-${r.codiceBonifico}"
          onclick="reinoltraBiglietto('${r.codiceBonifico}','${r.nome}','${r.cognome}',this)">
          &#128231; Reinoltra biglietto
        </button>
      </td>
    </tr>`;
  }).join('');

  _renderPaginazioneConfermati(pages);
}

function _renderPaginazioneConfermati(pages) {
  const bar = document.getElementById('pagination-confermati');
  if (pages <= 1) { bar.innerHTML = ''; return; }

  let html = `<button onclick="_goPageConfermati(${_pageConfermati - 1})" ${_pageConfermati === 0 ? 'disabled' : ''}>&lsaquo; Prec</button>`;
  for (let i = 0; i < pages; i++) {
    html += `<button class="${i === _pageConfermati ? 'active' : ''}" onclick="_goPageConfermati(${i})">${i + 1}</button>`;
  }
  html += `<button onclick="_goPageConfermati(${_pageConfermati + 1})" ${_pageConfermati === pages - 1 ? 'disabled' : ''}>Succ &rsaquo;</button>`;
  html += `<span class="pagination-info">Pagina ${_pageConfermati + 1} di ${pages}</span>`;
  bar.innerHTML = html;
}

function _goPageConfermati(page) {
  _pageConfermati = page;
  _renderPaginaConfermati();
  document.getElementById('tab-confermati').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

let _resendCodiceBonifico = null;
let _resendBtn            = null;

function reinoltraBiglietto(codiceBonifico, nome, cognome, btn) {
  _resendCodiceBonifico = codiceBonifico;
  _resendBtn            = btn;

  document.getElementById('resendModalText').innerHTML =
    `Stai per reinviare il biglietto a:<br><strong>${nome} ${cognome} (${codiceBonifico})</strong><br><br>` +
    `L'iscritto riceverà nuovamente l'email con il PDF allegato.`;

  const okBtn = document.getElementById('resendModalOkBtn');
  okBtn.disabled  = false;
  okBtn.innerHTML = '&#128231; Reinoltra';
  okBtn.onclick   = _confermaResend;

  document.getElementById('resendModal').style.display = 'flex';
}

function closeResendModal() {
  document.getElementById('resendModal').style.display = 'none';
  _resendCodiceBonifico = null;
  _resendBtn            = null;
}

function _confermaResend() {
  const okBtn = document.getElementById('resendModalOkBtn');
  okBtn.disabled  = true;
  okBtn.innerHTML = '&#8987; Invio in corso...';

  apiCall({ action: 'resendTicket', formData: { codiceBonifico: _resendCodiceBonifico } })
    .then(res => {
      if (res.esito === 'OK') {
        const rowBtn = _resendBtn;
        closeResendModal();
        if (rowBtn) {
          rowBtn.innerHTML = '&#9989; Inviato';
          rowBtn.classList.add('inviato');
          rowBtn.disabled  = true;
        }
      } else {
        okBtn.disabled  = false;
        okBtn.innerHTML = '&#128231; Reinoltra';
        alert('&#10060; Errore: ' + res.messaggio);
      }
    })
    .catch(err => {
      if (err !== 'auth') {
        okBtn.disabled  = false;
        okBtn.innerHTML = '&#128231; Reinoltra';
      }
    });
}


// =====================
// DASHBOARD APPROVATOR
// =====================
let _dashboardApprovatorLoaded = false;

function loadDashboardApprovator(force) {
  if (_dashboardApprovatorLoaded && !force) return;
  document.getElementById('dashboard-approvator-content').innerHTML =
    '<div class="dashboard-loading">&#8987; Caricamento in corso...</div>';

  apiCall({ action: 'getDashboardApprovator' })
    .then(data => {
      _dashboardApprovatorLoaded = true;
      renderDashboardApprovator(data);
    })
    .catch(err => {
      if (err !== 'auth') {
        document.getElementById('dashboard-approvator-content').innerHTML =
          '<div class="dashboard-loading">&#10060; Errore nel caricamento dei dati.</div>';
      }
    });
}

function renderDashboardApprovator(data) {
  const { iscrizioni, partecipanti, prenotazioni } = data;
  const fmt  = n => '€ ' + Number(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pct  = (a, b) => b > 0 ? Math.round(a / b * 100) : 0;
  const barColor = p => p >= 90 ? 'green' : p >= 70 ? 'blue' : 'orange';

  const totTicket    = iscrizioni.ticketDaApprovare + iscrizioni.ticketConfermati;
  const pctConferma  = pct(iscrizioni.ticketConfermati, totTicket);
  const pctTotale    = pct(prenotazioni.totaleIncassato, prenotazioni.totaleAtteso);

  const ecoRow = (icon, label, iscritti, confermati, incassato, atteso) => {
    const p = pct(incassato, atteso);
    const cntI = iscritti   != null ? `<strong>${iscritti}</strong>`   : '<span class="eco-na">—</span>';
    const cntC = confermati != null ? `<strong>${confermati}</strong>` : '<span class="eco-na">—</span>';
    return `
      <tr>
        <td class="eco-label">${icon} ${label}</td>
        <td class="eco-count">${cntI}</td>
        <td class="eco-count eco-count-conf">${cntC}</td>
        <td class="eco-value">${fmt(incassato)}<span class="eco-atteso"> / ${fmt(atteso)}</span></td>
        <td class="eco-bar-pct">
          <div class="eco-bar-wrap">
            <div class="dash-progress"><div class="dash-progress-bar ${barColor(p)}" style="width:${p}%"></div></div>
            <span class="eco-pct">${p}%</span>
          </div>
        </td>
      </tr>`;
  };

  document.getElementById('dashboard-approvator-content').innerHTML = `

    <div class="dash-section">
      <div class="dash-section-title">&#127915; Iscrizioni</div>
      <div class="dash-cards">
        <div class="dash-card">
          <div class="dash-card-label">Da approvare</div>
          <div class="dash-card-value" style="color:${iscrizioni.ticketDaApprovare > 0 ? '#e65100' : '#2e7d32'}">${iscrizioni.ticketDaApprovare}</div>
        </div>
        <div class="dash-card">
          <div class="dash-card-label">Confermati</div>
          <div class="dash-card-value" style="color:#1565c0">${iscrizioni.ticketConfermati}</div>
          <div class="dash-progress"><div class="dash-progress-bar ${barColor(pctConferma)}" style="width:${pctConferma}%"></div></div>
          <div class="dash-card-sub">${pctConferma}% su ${totTicket} totali</div>
        </div>
      </div>
    </div>

    <div class="dash-section">
      <div class="dash-section-title">&#128101; Partecipanti</div>
      <div class="dash-cards">
        <div class="dash-card">
          <div class="dash-card-label">Adulti</div>
          <div class="dash-card-value">${partecipanti.adultiConfermati}</div>
          <div class="dash-card-sub">su ${partecipanti.adultiIscritti} iscritti</div>
        </div>
        <div class="dash-card">
          <div class="dash-card-label">Bambini</div>
          <div class="dash-card-value">${partecipanti.bambiniConfermati}</div>
          <div class="dash-card-sub">su ${partecipanti.bambiniIscritti} iscritti</div>
        </div>
        <div class="dash-card">
          <div class="dash-card-label">Infanti</div>
          <div class="dash-card-value">${partecipanti.infantiConfermati}</div>
          <div class="dash-card-sub">su ${partecipanti.infantiIscritti} iscritti</div>
        </div>
        <div class="dash-card dash-card-total">
          <div class="dash-card-label">Partecipanti</div>
          <div class="dash-card-value">${partecipanti.totaleConfermati}</div>
          <div class="dash-card-sub">su ${partecipanti.totaleIscritti} iscritti</div>
        </div>
      </div>
    </div>

    <div class="dash-section">
      <div class="dash-section-title">&#128203; Riepilogo Prenotazioni</div>
      <table class="dash-eco-table">
        <thead>
          <tr>
            <th class="eco-th-voce">Voce</th>
            <th class="eco-th-count">Iscritti</th>
            <th class="eco-th-count">Confermati</th>
            <th class="eco-th-money">Incassato / Atteso</th>
            <th class="eco-th-bar">Avanzamento</th>
          </tr>
        </thead>
        <tbody>
          ${ecoRow('&#127829;', 'Menu 1', prenotazioni.menu1Iscritti, prenotazioni.menu1Confermati, prenotazioni.menu1Incassato, prenotazioni.menu1Atteso)}
          ${ecoRow('&#127789;', 'Menu 2', prenotazioni.menu2Iscritti, prenotazioni.menu2Confermati, prenotazioni.menu2Incassato, prenotazioni.menu2Atteso)}
          ${ecoRow('&#127866;', 'Birre',  prenotazioni.birreIscritti, prenotazioni.birreConfermati, prenotazioni.birreIncassate, prenotazioni.birreAttese)}
        </tbody>
        <tfoot>
          <tr class="eco-total-row">
            <td class="eco-label"><strong>&#128176; Totale</strong></td>
            <td class="eco-count"></td>
            <td class="eco-count"></td>
            <td class="eco-value"><strong>${fmt(prenotazioni.totaleIncassato)}</strong><span class="eco-atteso"> / ${fmt(prenotazioni.totaleAtteso)}</span></td>
            <td class="eco-bar-pct">
              <div class="eco-bar-wrap">
                <div class="dash-progress"><div class="dash-progress-bar ${barColor(pctTotale)}" style="width:${pctTotale}%"></div></div>
                <span class="eco-pct"><strong>${pctTotale}%</strong></span>
              </div>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;
}


// =====================
// DASHBOARD CUCINA
// =====================
let _dashboardCucinaLoaded = false;

function loadDashboardCucina(force) {
  if (_dashboardCucinaLoaded && !force) return;
  document.getElementById('dashboard-cucina-content').innerHTML =
    '<div class="dashboard-loading">&#8987; Caricamento in corso...</div>';

  apiCall({ action: 'getDashboardCucina' })
    .then(data => {
      _dashboardCucinaLoaded = true;
      renderDashboardCucina(data);
    })
    .catch(err => {
      if (err !== 'auth') {
        document.getElementById('dashboard-cucina-content').innerHTML =
          '<div class="dashboard-loading">&#10060; Errore nel caricamento dei dati.</div>';
      }
    });
}

function renderDashboardCucina(data) {
  const { menu1, menu2 } = data;
  const pct      = (a, b) => b > 0 ? Math.round(a / b * 100) : 0;
  const barColor = p => p >= 90 ? 'green' : p >= 60 ? 'blue' : 'orange';

  const cucinaCard = (icon, label, entrati, confermati) => {
    const rimanenti = confermati - entrati;
    const p         = pct(entrati, confermati);
    const rimClass  = rimanenti <= 0 ? 'cucina-rimanenti ok' : rimanenti <= 5 ? 'cucina-rimanenti warn' : 'cucina-rimanenti';
    return `
      <div class="cucina-card">
        <div class="cucina-card-header">${icon} ${label}</div>
        <div class="cucina-counters">
          <div class="cucina-counter">
            <div class="cucina-counter-val">${entrati}</div>
            <div class="cucina-counter-lbl">Token Consegnati</div>
          </div>
          <div class="cucina-counter-sep">／</div>
          <div class="cucina-counter">
            <div class="cucina-counter-val">${confermati}</div>
            <div class="cucina-counter-lbl">Totali</div>
          </div>
        </div>
        <div class="dash-progress" style="margin:10px 0 6px">
          <div class="dash-progress-bar ${barColor(p)}" style="width:${p}%"></div>
        </div>
        <div class="${rimClass}">
          ${rimanenti > 0 ? '&#9200; ' + rimanenti + ' token ancora da consegnare' : '&#10003; Tutti i token consegnati!'}
        </div>
      </div>`;
  };

  document.getElementById('dashboard-cucina-content').innerHTML = `
    <div class="cucina-cards">
      ${cucinaCard('&#127829;', 'Menu 1', menu1.entrati, menu1.confermati)}
      ${cucinaCard('&#127789;', 'Menu 2', menu2.entrati, menu2.confermati)}
    </div>
  `;
}


// =====================
// REPORT (statistiche post-evento)
// =====================
let _reportCharts = {}; // canvasId -> istanza Chart.js, per distruggerle prima di ridisegnare

// Colori dalla palette validata (skill dataviz): slot 1/2/3 dell'ordine categoriale, gli unici
// tre garantiti "all-pairs" CVD-safe insieme. Ingressi in violetto per coerenza con il badge
// "Entrato" già usato nel tab Confermati (stessa famiglia di colore per lo stesso concetto).
// Ogni grafico ora ha 2 serie (biglietti/prenotazioni vs persone): l'identità categoriale resta
// nella tinta (blu=iscrizioni, arancio=validazioni, viola=ingressi), biglietti/persone si
// distinguono per luminosità della stessa tinta — non due tinte scorrelate — ed entrambe restano
// sulla stessa scala (nessun doppio asse).
const _REPORT_COLORE = {
  iscrizioni: { biglietti: '#2a78d6', persone: '#a9c9ee' },
  pagamenti:  { biglietti: '#eb6834', persone: '#f5c3ab' },
  ingressi:   { biglietti: '#4a3aa7', persone: '#beb3e0' }
};

function loadReport() {
  document.getElementById('report-content').innerHTML =
    '<div class="dashboard-loading">&#8987; Caricamento in corso...</div>';

  apiCall({ action: 'getStatisticheReport' })
    .then(data => renderReport(data))
    .catch(err => {
      if (err !== 'auth') {
        document.getElementById('report-content').innerHTML =
          '<div class="dashboard-loading">&#10060; Errore nel caricamento dei dati.</div>';
      }
    });
}

function renderReport(data) {
  const { riepilogo: r, serieTemporali: s } = data;

  const tile = (label, value, sub) => `
    <div class="report-tile">
      <div class="report-tile-val">${value}</div>
      <div class="report-tile-lbl">${label}</div>
      ${sub ? `<div class="report-tile-sub">${sub}</div>` : ''}
    </div>`;

  const oraDa = (dt) => dt ? dt.split(' ')[1] : '&#8212;';

  const _ingressiOraAttivi = _ritagliaOreAttive(s.ingressiPerMezzora, s.ingressiPerMezzoraPersone);

  document.getElementById('report-content').innerHTML = `
    <div class="report-tiles">
      ${tile('Iscritti totali', r.totaleIscritti, r.totalePersoneIscritte + ' persone')}
      ${tile('Confermati (pagato)', r.totalePagati, r.totalePersonePagate + ' persone')}
      ${tile('Entrati', r.totaleEntrati, r.totalePersoneEntrate + ' persone')}
      ${tile('No-show', r.noShow, r.totalePagati > 0 ? r.percentualeNoShow + '% dei pagati' : '')}
      ${tile('Cancellati', r.totaleCancellati)}
      ${tile('Tempo medio reg.&rarr;pag.', r.tempoMedioRegistrazionePagamentoOre !== null ? r.tempoMedioRegistrazionePagamentoOre + ' h' : '&#8212;')}
      ${tile('Ritmo ingressi (mediana)', r.medianaIntervalloIngressiSecondi !== null ? _formattaSecondi(r.medianaIntervalloIngressiSecondi) : '&#8212;', 'tra un ingresso e il successivo')}
      ${tile('Primo &rarr; ultimo ingresso', r.primoIngresso ? oraDa(r.primoIngresso) + ' &rarr; ' + oraDa(r.ultimoIngresso) : '&#8212;')}
    </div>

    <div class="report-charts-row">
      <div class="report-chart-box">
        <h3>Iscrizioni per giorno</h3>
        <canvas id="chart-iscrizioni-giorno"></canvas>
        ${_tabellaToggle('tbl-iscrizioni-giorno', ['Giorno', 'Iscrizioni', 'Persone'], s.iscrizioniPerGiorno.map(x => [x.data, x.conteggio, x.persone]))}
      </div>
      <div class="report-chart-box">
        <h3>Iscrizioni per fascia oraria</h3>
        <canvas id="chart-iscrizioni-ora"></canvas>
        ${_tabellaToggle('tbl-iscrizioni-ora', ['Ora', 'Iscrizioni', 'Persone'], s.iscrizioniPerOra.map((v, i) => [i + ':00', v, s.iscrizioniPerOraPersone[i]]))}
      </div>
    </div>
    <div class="report-charts-row">
      <div class="report-chart-box">
        <h3>Validazioni per giorno</h3>
        <canvas id="chart-pagamenti-giorno"></canvas>
        ${_tabellaToggle('tbl-pagamenti-giorno', ['Giorno', 'Validazioni', 'Persone'], s.pagamentiPerGiorno.map(x => [x.data, x.conteggio, x.persone]))}
      </div>
      <div class="report-chart-box">
        <h3>Validazioni per fascia oraria</h3>
        <canvas id="chart-pagamenti-ora"></canvas>
        ${_tabellaToggle('tbl-pagamenti-ora', ['Ora', 'Validazioni', 'Persone'], s.pagamentiPerOra.map((v, i) => [i + ':00', v, s.pagamentiPerOraPersone[i]]))}
      </div>
    </div>
    <div class="report-charts-row report-charts-row-single">
      <div class="report-chart-box">
        <h3>Ingressi ogni 30 minuti (giorno evento)</h3>
        <canvas id="chart-ingressi-ora"></canvas>
        ${_tabellaToggle('tbl-ingressi-ora', ['Ora', 'Ingressi', 'Persone'], _ingressiOraAttivi.righe)}
      </div>
    </div>
  `;

  _renderBarChart('chart-iscrizioni-giorno', s.iscrizioniPerGiorno.map(x => x.data), [
    { label: 'Iscrizioni', dati: s.iscrizioniPerGiorno.map(x => x.conteggio), colore: _REPORT_COLORE.iscrizioni.biglietti },
    { label: 'Persone',    dati: s.iscrizioniPerGiorno.map(x => x.persone),   colore: _REPORT_COLORE.iscrizioni.persone }
  ]);
  _renderBarChart('chart-pagamenti-giorno', s.pagamentiPerGiorno.map(x => x.data), [
    { label: 'Validazioni', dati: s.pagamentiPerGiorno.map(x => x.conteggio), colore: _REPORT_COLORE.pagamenti.biglietti },
    { label: 'Persone',     dati: s.pagamentiPerGiorno.map(x => x.persone),   colore: _REPORT_COLORE.pagamenti.persone }
  ]);
  _renderBarChart('chart-iscrizioni-ora', _oreLabels(), [
    { label: 'Iscrizioni', dati: s.iscrizioniPerOra,        colore: _REPORT_COLORE.iscrizioni.biglietti },
    { label: 'Persone',    dati: s.iscrizioniPerOraPersone, colore: _REPORT_COLORE.iscrizioni.persone }
  ], { oreComplete: true });
  _renderBarChart('chart-pagamenti-ora', _oreLabels(), [
    { label: 'Validazioni', dati: s.pagamentiPerOra,        colore: _REPORT_COLORE.pagamenti.biglietti },
    { label: 'Persone',     dati: s.pagamentiPerOraPersone, colore: _REPORT_COLORE.pagamenti.persone }
  ], { oreComplete: true });
  _renderBarChart('chart-ingressi-ora', _ingressiOraAttivi.labels, [
    { label: 'Ingressi', dati: _ingressiOraAttivi.valori,  colore: _REPORT_COLORE.ingressi.biglietti },
    { label: 'Persone',  dati: _ingressiOraAttivi.persone, colore: _REPORT_COLORE.ingressi.persone }
  ], { oreComplete: true });
}

/**
 * Ritaglia un array di fasce da mezz'ora (48 valori) alla sola parte "attiva": dalla prima alla
 * ultima mezz'ora con almeno un ingresso, inclusi eventuali zeri in mezzo (es. un calo
 * momentaneo). Fuori da quella fascia non c'è nulla da mostrare (giorno evento, non l'intera
 * giornata). L'array "persone" (parallelo, stesso indice) viene ritagliato con la STESSA
 * finestra determinata dai biglietti, per restare allineato nei grafici/tabelle.
 */
function _ritagliaOreAttive(valoriPerMezzora, valoriPerMezzoraPersone) {
  const primo = valoriPerMezzora.findIndex(v => v > 0);
  if (primo === -1) return { labels: [], valori: [], persone: [], righe: [] };
  let ultimo = primo;
  for (let i = valoriPerMezzora.length - 1; i >= 0; i--) {
    if (valoriPerMezzora[i] > 0) { ultimo = i; break; }
  }
  const labels  = _mezzoreLabels().slice(primo, ultimo + 1);
  const valori  = valoriPerMezzora.slice(primo, ultimo + 1);
  const persone = (valoriPerMezzoraPersone || []).slice(primo, ultimo + 1);
  const righe   = valori.map((v, i) => [labels[i], v, persone[i]]);
  return { labels, valori, persone, righe };
}

function _oreLabels() {
  return Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0') + ':00');
}

/** Etichette a fasce da 30 minuti: indice 0 = "00:00", indice 1 = "00:30", ecc. */
function _mezzoreLabels() {
  return Array.from({ length: 48 }, (_, i) =>
    String(Math.floor(i / 2)).padStart(2, '0') + ':' + (i % 2 === 0 ? '00' : '30'));
}

function _formattaSecondi(sec) {
  if (sec < 60)   return Math.round(sec) + ' sec';
  if (sec < 3600) return Math.round(sec / 60) + ' min';
  return (Math.round(sec / 360) / 10) + ' h';
}

/** Tabella accessibile alternativa al grafico, dietro un <details> nativo (niente JS di toggle
 * da scrivere/mantenere, accessibile da tastiera di suo). */
function _tabellaToggle(id, headers, righe) {
  if (!righe || righe.length === 0) return '';
  const theadHtml = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
  const tbodyHtml = righe.map(riga => `<tr>${riga.map(c => `<td>${c}</td>`).join('')}</tr>`).join('');
  return `
    <details class="report-table-toggle" id="${id}">
      <summary>Mostra tabella dati</summary>
      <div class="table-wrapper">
        <table><thead>${theadHtml}</thead><tbody>${tbodyHtml}</tbody></table>
      </div>
    </details>`;
}

/**
 * Grafico a barre raggruppate con N serie (es. biglietti + persone), stessa scala/asse per
 * tutte (mai doppio asse, vedi skill "dataviz"). Con 1 sola serie niente legenda (il titolo del
 * box la identifica già); con 2+ serie la legenda è sempre presente, perché l'identità delle
 * serie non è più deducibile dal solo titolo. Tooltip attivo al passaggio del mouse, barre
 * sottili con estremità arrotondate.
 *
 * @param {Array<{label:string, dati:number[], colore:string}>} serie
 */
function _renderBarChart(canvasId, labels, serie, opzioni) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  if (_reportCharts[canvasId]) _reportCharts[canvasId].destroy();

  // Chart.js di default "salta" le etichette dell'asse x quando non c'è spazio (autoSkip),
  // mostrandone una ogni due: per i grafici orari (24 categorie) vogliamo sempre una barra e
  // un'etichetta per ogni ora, quindi disattiviamo autoSkip e ruotiamo/rimpiccioliamo il testo.
  const oreComplete = !!(opzioni && opzioni.oreComplete);
  const xTicks = oreComplete
    ? { autoSkip: false, maxRotation: 90, minRotation: 45, font: { size: 9 } }
    : {};

  _reportCharts[canvasId] = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: serie.map(s => ({
        label: s.label,
        data: s.dati,
        backgroundColor: s.colore,
        borderRadius: 4,
        maxBarThickness: 28
      }))
    },
    options: {
      responsive: true,
      plugins: {
        legend:  { display: serie.length > 1, labels: { boxWidth: 12, font: { size: 11 } } },
        tooltip: { enabled: true }
      },
      scales: {
        x: { grid: { display: false }, ticks: xTicks },
        y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#e1e0d9' } }
      }
    }
  });
}
