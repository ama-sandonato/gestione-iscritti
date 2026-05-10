let timerAma      = null;
let timerFulltext = null;
let indiceAma      = -1;
let indiceFulltext = -1;

// =====================
// INPUT CODICE AMA
// =====================
/** @deprecated */
function onInputAma(valore) {
  chiudiAutocomplete('fulltext');
  clearTimeout(timerAma);

  if (!valore) {
    chiudiAutocomplete('ama');
    return;
  }

  timerAma = setTimeout(() => {
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
      mostraAutocompleteAma(res);
    })
    .catch(err => {
      console.error(err);
    });
  }, 300);
}



// =====================
// INPUT FULLTEXT
// =====================
/** @deprecated */
function onInputFulltext(valore) {
  chiudiAutocomplete('ama');
  clearTimeout(timerFulltext);

  if (valore.length < 3) {
    chiudiAutocomplete('fulltext');
    return;
  }

  timerFulltext = setTimeout(() => {
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
      mostraAutocompleteFulltext(res);
    })
    .catch(err => {
      console.error(err);
    });
  }, 300);
}


// =====================
// AUTOCOMPLETE AMA
// =====================
/** @deprecated */
function mostraAutocompleteAma(lista) {
  const div = document.getElementById('autocomplete-ama');

  if (!lista || lista.length === 0) {
    chiudiAutocomplete('ama');
    return;
  }

  div.innerHTML = lista.map(user => `
    <div class="autocomplete-item" onclick="selezionaCodiceTitolare('${user.codiceTitolare}')">
      <strong>${user.nome} ${user.cognome}</strong>
      <div class="sub">${user.email} — ${user.codiceBonifico} - ${user.prezzo}€</div>
    </div>
  `).join('');

  div.style.display = 'block';
}


// =====================
// AUTOCOMPLETE FULLTEXT
// =====================
/** @deprecated */
function mostraAutocompleteFulltext(lista) {
  const div = document.getElementById('autocomplete-fulltext');

  if (!lista || lista.length === 0) {
    chiudiAutocomplete('fulltext');
    return;
  }

  div.innerHTML = lista.map(user => `
    <div class="autocomplete-item" onclick="selezionaCodiceTitolare('${user.codiceTitolare}')">
      <strong>${user.nome} ${user.cognome}</strong>
      <div class="sub">${user.email} — ${user.codiceBonifico} - ${user.prezzo}€</div>
    </div>
  `).join('');

  div.style.display = 'block';
}


/**
 * 
 * @param {string} codiceTitolare 
 * @deprecated
 */
function selezionaCodiceTitolare(codiceTitolare) {
  chiudiAutocomplete('ama');
  chiudiAutocomplete('fulltext');
  findByCodiceTitolare(codiceTitolare); // cerca per codice esatto una volta selezionato
}


function onKeydown(event, tipo) {
  const listaId = `autocomplete-${tipo}`;
  const lista   = document.getElementById(listaId);
  const items   = lista.querySelectorAll('.autocomplete-item');

  // Freccia giù
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    if (tipo === 'ama') {
      indiceAma = Math.min(indiceAma + 1, items.length - 1);
      evidenziaItem(items, indiceAma);
    } else {
      indiceFulltext = Math.min(indiceFulltext + 1, items.length - 1);
      evidenziaItem(items, indiceFulltext);
    }
    return;
  }

  // Freccia su
  if (event.key === 'ArrowUp') {
    event.preventDefault();
    if (tipo === 'ama') {
      indiceAma = Math.max(indiceAma - 1, 0);
      evidenziaItem(items, indiceAma);
    } else {
      indiceFulltext = Math.max(indiceFulltext - 1, 0);
      evidenziaItem(items, indiceFulltext);
    }
    return;
  }

  // Enter o Tab — seleziona la voce evidenziata
  if (event.key === 'Enter' || event.key === 'Tab') {
    const indice = tipo === 'ama' ? indiceAma : indiceFulltext;

    // Se c'è una voce evidenziata nel dropdown → selezionala
    if (lista.style.display === 'block' && indice >= 0 && items[indice]) {
      event.preventDefault();
      items[indice].click();
      resetIndice(tipo);
      return;
    }

      // Altrimenti → cerca con il valore digitato (solo Enter)
    if (event.key === 'Enter') {
      if (tipo === 'ama') {
        const valore = document.getElementById('input-ama').value.trim();
        chiudiAutocomplete('ama');
        cerca('codiceBonifico', valore);
      } else {
        const valore = document.getElementById('input-fulltext').value.trim();
        chiudiAutocomplete('fulltext');
        if (valore) cerca('fulltext', valore);
      }
    }
  }

  // Escape — chiudi dropdown
  if (event.key === 'Escape') {
    chiudiAutocomplete(tipo);
    resetIndice(tipo);
  }
}


// Evidenzia la voce corrente nel dropdown
/** @deprecated */
function evidenziaItem(items, indice) {
  items.forEach((item, i) => {
    item.style.background = i === indice ? '#f0f9f0' : '';
    item.style.fontWeight = i === indice ? 'bold'    : 'normal';
  });

  // Scroll automatico se la voce è fuori dalla lista visibile
  if (items[indice]) {
    items[indice].scrollIntoView({ block: 'nearest' });
  }
}

// Reset indice quando si chiude o si seleziona
/** @deprecated */
function resetIndice(tipo) {
  if (tipo === 'ama') indiceAma = -1;
  else                indiceFulltext = -1;
}    

// =====================
// CERCA
// =====================
function cerca(criterio, valore) {
  if (!valore) return;

  document.getElementById('loading').style.display          = 'block';
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
    })
    .catch(err => {
      console.error(err);
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
    })
    .catch(err => {
      console.error(err);
    });
  } else {
    //sono cazzi
  }
}

/** @deprecated */
function findByCodiceTitolare(codiceTitolare) {
  if (!codiceTitolare) return;

  document.getElementById('loading').style.display          = 'block';
  document.getElementById('risultati').style.display        = 'none';
  document.getElementById('nessun-risultato').style.display = 'none';

  fetch(AppConfig.apiUrl, {
    method: 'POST',
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({
      action: "findPendingRegistered",
      formData: codiceTitolare
    })
  })
  .then(res => res.json())
  .then(res => {
    mostraRisultati(res);
  })
  .catch(err => {
    console.error(err);
  });
}




// =====================
// MOSTRA RISULTATI
// =====================
function mostraRisultati(lista) {
  document.getElementById('loading').style.display = 'none';

  if (!lista || lista.length === 0) {
    document.getElementById('nessun-risultato').style.display = 'block';
    return;
  }

  document.getElementById('contatore').innerText =
    `${lista.length} iscritto/i trovato/i`;

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
  })
  .catch(err => {
    console.error(err);
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
// CHIUDI AUTOCOMPLETE
// =====================
/** @deprecated */
function chiudiAutocomplete(tipo) {
  document.getElementById(`autocomplete-${tipo}`).style.display = 'none';
  document.getElementById(`autocomplete-${tipo}`).innerHTML     = '';
  resetIndice(tipo);
}


// =====================
// CHIUDI AUTOCOMPLETE
// cliccando fuori
// =====================
/*
document.addEventListener('click', (e) => {
  if (!e.target.closest('.search-box')) {
    chiudiAutocomplete('ama');
    chiudiAutocomplete('fulltext');
  }
});
*/

// =====================
// ERRORE GENERICO
// =====================
function errore(err, btn) {
  document.getElementById('loading').style.display = 'none';
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
    alert("Email inviata con successo!");
    closeMailModal();
  })
  .catch(err => {
    console.error(err);
    alert("Errore nell'invio: " + err.message);
  });
}