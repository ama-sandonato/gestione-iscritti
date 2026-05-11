// =====================
// AUTH & SESSION
// =====================
const TOKEN_KEY = 'ama_token';
const USER_KEY  = 'ama_user';

function getToken()  { return sessionStorage.getItem(TOKEN_KEY); }
function getUser()   { return sessionStorage.getItem(USER_KEY); }

function saveSession(token, user) {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(USER_KEY, user);
}

function clearSession() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
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
}

// Eseguito al caricamento della pagina
document.addEventListener('DOMContentLoaded', () => {
  if (getToken()) {
    showMainCard();
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
      saveSession(res.token, res.user);
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
  // reset UI
  document.getElementById('tbody').innerHTML        = '';
  document.getElementById('risultati').style.display     = 'none';
  document.getElementById('nessun-risultato').style.display = 'none';
  document.getElementById('input-ama').value        = '';
  document.getElementById('input-fulltext').value   = '';
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
// MOSTRA RISULTATI
// =====================
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
      <td title="codice titolare: ${r.codiceTitolare}"><strong>${r.codiceBonifico}</strong></td>
      <td>${r.nome}</td>
      <td>${r.cognome}</td>
      <td>${r.email}</td>
      <td><span class="badge" title="${r.adulti} Adulti, ${r.bambini} Minori, ${r.infanti} Infanti">${partecipanti}</span></td>
      <td>${r.menu1}</td>
      <td>${r.menu2}</td>
      <td>${r.birre}</td>
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
            onclick="openMailModal('${r.email}', '${r.nome}', '${r.codiceBonifico}', this)">
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
      btn.disabled  = true;
      btn.innerText = '⏳ Salvataggio...';
      document.getElementById('loading-overlay').style.display = 'flex';

      apiCall({ action: 'confirmPayment', formData: { codiceTitolare, codiceBonifico } })
        .then(res => esitoPagamento(res, codiceBonifico, btn))
        .catch(err => {
          if (err !== 'auth') console.error(err);
          btn.disabled  = false;
          btn.innerText = '✓ Conferma Pagamento';
        })
        .finally(() => { document.getElementById('loading-overlay').style.display = 'none'; });
    }
  );
}


// =====================
// MODALE DI CONFERMA
// =====================
let _confirmCallback = null;

function openConfirmModal(testo, onConfirm) {
  document.getElementById('confirmModalText').innerHTML = testo;
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
// ESITO PAGAMENTO
// =====================
function esitoPagamento(risposta, codiceBonifico, btn) {
  if (risposta.esito === "OK") {
    btn.innerText = "✅ Pagato";
    btn.classList.add("confermato");
    const riga = document.getElementById(`riga-${codiceBonifico}`);
    if (riga) riga.classList.add("pagata");
    const btnIssue = document.getElementById(`btn-issue-${codiceBonifico}`);
    if (btnIssue) btnIssue.style.display = 'none';
  } else {
    btn.disabled  = false;
    btn.innerText = "✓ Conferma Pagamento";
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
function openMailModal(email, nomeUtente, codiceBonifico, btn) {
  document.getElementById('modalEmail').value   = email;
  document.getElementById('modalSubject').value = "AMA - Festa 2026 - Problema pagamento bonifico : " + codiceBonifico;
  document.getElementById('modalBody').value    = "Ciao " + nomeUtente + ",\nti scriviamo in merito alla tua iscrizione...";
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
  const email   = document.getElementById('modalEmail').value;
  const subject = document.getElementById('modalSubject').value;
  const body    = document.getElementById('modalBody').value;

  document.getElementById('loading-overlay').style.display = 'flex';
  btn.disabled  = true;
  btn.innerText = 'Invio in corso...';

  apiCall({ action: 'sendIssueMail', formData: { destinationEmail: email, emailSubject: subject, emailBody: body } })
    .then(() => closeMailModal())
    .catch(err => { if (err !== 'auth') alert("Errore nell'invio: " + err); })
    .finally(() => { document.getElementById('loading-overlay').style.display = 'none'; btn.disabled = false; btn.innerText = 'Invia'; });
}
