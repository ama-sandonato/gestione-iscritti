
function onKeydown(event, tipo) {
  // Enter o Tab — seleziona la voce evidenziata
  if (event.key === 'Enter') {
    // Altrimenti → cerca con il valore digitato (solo Enter)
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

}


// =====================
// CERCA
// =====================
function cerca(criterio, valore) {
  if (!valore) return;

  document.getElementById('loading-overlay').style.display = 'flex';
  document.getElementById('risultati').style.display        = 'none';
  document.getElementById('nessun-risultato').style.display = 'none';

  if ( criterio === "codiceBonifico" ) {

    //chiamo la "autocomplete" in modalità "codice bonifico"
    fetch(AppConfig.apiUrl, {
      method: 'POST',
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({
        action: "autocompleteCodiceBonifico",
        formData: valore
      })
    })
    .then(res => res.json())
    .then(res => {
      mostraRisultati(res);
      document.getElementById('loading-overlay').style.display = 'none';
    })
    .catch(err => {
      console.error(err);
      document.getElementById('loading-overlay').style.display = 'none';
    });

  } else if ( criterio === "fulltext" ) {
     //chiamo la "autocomplete" in modalità "ricerca fulltext"
    fetch(AppConfig.apiUrl, {
      method: 'POST',
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({
        action: "autocompleteFulltext",
        formData: valore
      })
    })
    .then(res => res.json())
    .then(res => {
      mostraRisultati(res);
      document.getElementById('loading-overlay').style.display = 'none';
    })
    .catch(err => {
      console.error(err);
      document.getElementById('loading-overlay').style.display = 'none';
    });
  } else {
    //sono cazzi
    throw new Error(`Criterio di ricerca [${criterio}] non valido!`);
  }
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
    const email   = r.email;

    const tr           = document.createElement('tr');
    tr.id              = `riga-${r.codiceBonifico}`;
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
        <button
          class="btn-conferma"
          id="btn-${r.codiceBonifico}"
          onclick="confermaPagamento('${r.codiceTitolare}', '${r.codiceBonifico}', this)">
          &#10003; Conferma Pagamento
        </button>
        <button
          class="btn-issue"
          id="btn-issue-${r.codiceBonifico}"
          onclick="openMailModal('${r.email}', '${r.nome}', '${r.codiceBonifico}', this)">
          📧 Segnala Problema
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById('risultati').style.display = 'block';
}


// =====================
// CONFERMA PAGAMENTO
// =====================
function confermaPagamento(codiceTitolare, codiceBonifico, btn) {
  if (!confirm(`Confermi il pagamento per ${codiceBonifico}?`)) return;

  btn.disabled  = true;
  btn.innerText = "⏳ Salvataggio...";
  document.getElementById('loading-overlay').style.display = 'flex';

  fetch(AppConfig.apiUrl, {
    method: 'POST',
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({
      action: "confirmPayment",
      formData: {
        codiceTitolare: codiceTitolare,
        codiceBonifico: codiceBonifico
      }
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


// =====================
// ESITO PAGAMENTO
// =====================
function esitoPagamento(risposta, codiceBonifico, btn) {
  if (risposta.esito === "OK") {
    btn.innerText = "✅ Pagato";
    btn.classList.add("confermato");
    const riga = document.getElementById(`riga-${codiceBonifico}`);
    if (riga) riga.style.background = "#e8f5e9";
    //nascondo il pulsante "invia segnalazione"
    document.getElementById(`btn-issue-${codiceBonifico}`).style.display = 'none';
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


/**
 * Apre una modale per l'invio di una segnalazione
 * 
 * @param {*} email 
 * @param {*} nomeUtente 
 * @param {*} codiceBonifico 
 * @param {*} btn 
 */
function openMailModal(email, nomeUtente, codiceBonifico, btn) {

  // Imposta i valori predefiniti
  document.getElementById('modalEmail').value = email;
  document.getElementById('modalSubject').value = "AMA - Festa 2026 - Problema pagamento bonifico : " + codiceBonifico;
  document.getElementById('modalBody').value = "Ciao " + nomeUtente + ",\nti scriviamo in merito alla tua iscrizione...";
  
  // Mostra la modale
  document.getElementById('mailModal').style.display = 'block';
}

function closeMailModal() {
  document.getElementById('mailModal').style.display = 'none';
}

function confirmSendMail(btn) {
  const email = document.getElementById('modalEmail').value;
  const subject = document.getElementById('modalSubject').value;
  const body = document.getElementById('modalBody').value;

  //metto lo spinner
  document.getElementById('loading-overlay').style.display = 'flex';

  // Disabilita il tasto per evitare doppi invii
  btn.disabled = true;
  btn.innerText = "Invio in corso...";

  // Chiamata alla funzione Apps Script sul server
  fetch(AppConfig.apiUrl, {
    method: 'POST',
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({
      action: "sendIssueMail",
      formData: {
        destinationEmail: email,
        emailSubject: subject,
        emailBody: body
      }
    })
  })
  .then(res => res.json())
  .then(res => {
    closeMailModal();
    document.getElementById('loading-overlay').style.display = 'none';
  })
  .catch(err => {
    console.error(err);
    document.getElementById('loading-overlay').style.display = 'none';
    alert("Errore nell'invio: " + err.message);
  });

}