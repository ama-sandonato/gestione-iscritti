# Gestione Iscritti — Le Mille e Una Notte 2026

Backoffice web per la gestione delle iscrizioni e dei pagamenti della festa "Le Mille e Una Notte 2026".
Il backend è un Google Apps Script (GAS) collegato a un foglio Google Sheets.

---

## Struttura file

```
gestione-iscritti/
├── index.html                  # SPA principale
├── js/
│   ├── config.js               # Configurazione ambiente (locale / GitHub Pages)
│   └── manage-registration.js  # Logica applicativa completa
├── css/
│   └── ama-style.css           # Stili
└── favicon.ico
```

---

## Sezioni dell'applicazione

### Login
Form username/password con autenticazione via API GAS. La sessione è mantenuta tramite `sessionStorage`.

### 💰 Validazione Pagamenti
Ricerca iscritti per codice bonifico (`AMA + 3 cifre`) o testo libero (nome, cognome, email).
Per ogni risultato è possibile:
- **Conferma** — valida il pagamento sul foglio Google (modale di conferma)
- **Segnala** — invia una email all'iscritto con oggetto e corpo preimpostati (modificabili)

### ⏰ Scordarelli
Elenco degli iscritti che non hanno ancora pagato da almeno N giorni.
Una select permette di scegliere la soglia temporale: **3 / 5 / 7 / 10 / 15 / 30 giorni**.
Per ogni risultato è possibile:
- **Cancella prenotazione** — cancella definitivamente l'iscrizione sul foglio Google (modale di conferma)
- **Sollecita** — invia una email di avviso con testo preimpostato che avverte l'iscritto dell'imminente cancellazione (modificabile prima dell'invio)

---

## Funzioni JavaScript (`manage-registration.js`)

### Autenticazione e sessione
| Funzione | Descrizione |
|---|---|
| `getToken()` | Legge il token da `sessionStorage` |
| `getUser()` | Legge lo username da `sessionStorage` |
| `saveSession(token, user)` | Salva token e username |
| `clearSession()` | Cancella la sessione |
| `doLogin()` | Gestisce il form di login via API |
| `logout()` | Cancella sessione e torna al login |
| `showLoginCard()` | Mostra la schermata di login |
| `showMainCard()` | Mostra il backoffice (default: tab Pagamenti) |

### Navigazione
| Funzione | Descrizione |
|---|---|
| `showTab(tab)` | Attiva il tab `'pagamenti'` o `'scordarelli'` |

### API
| Funzione | Descrizione |
|---|---|
| `apiCall(body)` | Wrapper fetch con token e gestione scadenza sessione |

### Validazione Pagamenti
| Funzione | Descrizione |
|---|---|
| `cerca(criterio, valore)` | Ricerca per `codiceBonifico` o `fulltext` |
| `mostraRisultati(lista)` | Renderizza la tabella dei risultati |
| `confermaPagamento(codiceTitolare, codiceBonifico, btn)` | Apre modale e chiama API `confirmPayment` |
| `esitoPagamento(risposta, codiceBonifico, btn)` | Aggiorna la riga dopo la conferma |
| `onKeydown(event, tipo)` | Gestisce Enter nei campi di ricerca |

### Overdue Registrants
| Funzione | Descrizione |
|---|---|
| `loadOverdueRegistrants()` | Chiama API `findOverdueRegistrants` con i giorni selezionati |
| `showOverdueRegistrants(lista)` | Renderizza la tabella degli iscritti morosi |
| `cancellaPrenotazione(codiceTitolare, codiceBonifico, btn)` | Apre modale e chiama API `cancellaPrenotazione` |
| `esitoAnnullamento(risposta, codiceBonifico, btn)` | Segna la riga come annullata (barrato + grigio) |
| `openMailModalSollecito(email, nome, codiceBonifico, btn)` | Apre la modale email con testo sollecito preimpostato |

### Modali
| Funzione | Descrizione |
|---|---|
| `openConfirmModal(testo, onConfirm)` | Modale generica di conferma con callback |
| `closeConfirmModal()` | Chiude la modale di conferma |
| `openMailModal(email, nome, codiceBonifico, btn)` | Modale email per segnalazione problema pagamento |
| `openMailModalSollecito(email, nome, codiceBonifico, btn)` | Modale email per sollecito pagamento (scordarelli) |
| `closeMailModal()` | Chiude la modale email |
| `confirmSendMail(btn)` | Invia l'email tramite API `sendIssueMail` |

---

## Classi CSS principali (`ama-style.css`)

| Classe | Descrizione |
|---|---|
| `.tab-nav` | Contenitore tab di navigazione |
| `.tab-btn` | Singolo tab (inattivo) |
| `.tab-btn.active` | Tab attivo (sfondo arancio) |
| `.scordarelli-filter` | Area filtro giorni nella sezione Scordarelli |
| `.scordarelli-filter-row` | Riga con select + pulsante Carica |
| `.btn-conferma` | Pulsante azione principale (arancio) |
| `.btn-issue` | Pulsante segnalazione (rosso tenue) |
| `.btn-delete` | Pulsante cancellazione (rosso pieno, ombra) |
| `.btn-annulla` | Pulsante annulla nelle modali (grigio) |
| `.btn-delete.confermato` | Stato post-cancellazione (verde) |
| `tr.pagata` | Riga con pagamento confermato (verde chiaro) |
| `tr.annullata` | Riga con prenotazione cancellata (barrato + trasparente) |
| `.data-iscrizione` | Colonna data iscrizione (scordarelli) |
| `.badge` | Badge numero partecipanti |
| `.totale` | Colonna totale in grassetto |

---

## API GAS — Azioni disponibili

| Action | Sezione | Descrizione |
|---|---|---|
| `login` | Login | Autenticazione utente |
| `autocompleteCodiceBonifico` | Pagamenti | Ricerca per codice bonifico |
| `autocompleteFulltext` | Pagamenti | Ricerca libera |
| `confirmPayment` | Pagamenti | Conferma pagamento |
| `sendIssueMail` | Entrambe | Invio email (segnalazione e sollecito) |
| `findOverdueRegistrants` | Scordarelli | Lista iscritti senza pagamento da N giorni |
| `cancellaPrenotazione` | Scordarelli | Cancellazione definitiva prenotazione |
