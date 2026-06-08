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
  showTab('pagamenti');
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
  document.getElementById('tbody').innerHTML                        = '';
  document.getElementById('risultati').style.display               = 'none';
  document.getElementById('nessun-risultato').style.display        = 'none';
  document.getElementById('input-ama').value                       = '';
  document.getElementById('input-fulltext').value                  = '';
  document.getElementById('tbody-scordarelli').innerHTML           = '';
  document.getElementById('risultati-scordarelli').style.display   = 'none';
  document.getElementById('nessun-scordarello').style.display      = 'none';
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

// "AMA005" → "005 - Donazione A.M.A."
function formatCodiceEmail(codice) {
  return codice.replace(/^AMA/i, '') + ' - Donazione A.M.A.';
}

function openMailModal(email, nomeUtente, codiceBonifico, prezzo, btn) {
  const codiceFormattato = formatCodiceEmail(codiceBonifico);
  const importoAtteso    = Number(prezzo).toFixed(2);
  document.getElementById('modalTitle').innerHTML = '&#128231; Invia Segnalazione';
  document.getElementById('modalEmail').value   = email;
  document.getElementById('modalSubject').value = `Verifica importo bonifico - Le Mille e Una Notte 2026`;
  document.getElementById('modalBody').value    =
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


// =====================
// TAB NAVIGATION
// =====================
function showTab(tab) {
  document.getElementById('tab-pagamenti').style.display    = tab === 'pagamenti'    ? 'block' : 'none';
  document.getElementById('tab-scordarelli').style.display  = tab === 'scordarelli'  ? 'block' : 'none';
  document.getElementById('tab-btn-pagamenti').classList.toggle('active',   tab === 'pagamenti');
  document.getElementById('tab-btn-scordarelli').classList.toggle('active', tab === 'scordarelli');
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
    const dataIscrizione = r.dataIscrizione || '—';

    const tr  = document.createElement('tr');
    tr.id     = `riga-sc-${r.codiceBonifico}`;
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
      <td class="data-iscrizione">${dataIscrizione}</td>
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
  document.getElementById('modalSubject').value = `Sollecito pagamento - Le Mille e Una Notte 2026`;
  document.getElementById('modalBody').value    =
`Ciao ${nome},
ti contattiamo perché non abbiamo ancora ricevuto il pagamento per confermare la tua iscrizione alla festa "Le Mille e Una Notte 2026" del 19 settembre prossimo.

Ti ricordiamo che il versamento della quota di €${importoAtteso} dovrà essere effettuato tramite bonifico bancario, inserendo questa specifica causale:
${codiceFormattato}

Per aiutarci nell'organizzazione della serata e permettere una corretta gestione delle richieste ricevute, ti chiediamo gentilmente di effettuare il pagamento il prima possibile. In assenza di conferma, saremo costretti a liberare il posto per consentire ad altre famiglie attualmente in lista d'attesa di partecipare.

Se invece hai già effettuato il pagamento, ti chiediamo semplicemente di rispondere a questa email indicando gli estremi del bonifico, così da poter verificare insieme.

Grazie,
AMA Crew`;
  document.getElementById('mailModal').style.display = 'flex';
}
