# Guida Operatore

Questo documento descrive tutte le funzionalità disponibili nel backoffice di gestione iscritti.

---

## Indice

1. [Accesso e login](#1-accesso-e-login)
2. [Barra di stato (footer)](#2-barra-di-stato-footer)
3. [Tab: Validazione Pagamenti](#3-tab-validazione-pagamenti)
4. [Tab: Scordarelli](#4-tab-scordarelli)
5. [Tab: Cancellati](#5-tab-cancellati)
6. [Tab: Confermati](#6-tab-confermati)
7. [Modali e operazioni](#7-modali-e-operazioni)

---

## 1. Accesso e login

Per accedere al backoffice è necessario inserire le credenziali operative (username e password) nella schermata di login.

- La sessione rimane attiva finché non si clicca **Esci** o si chiude il browser.
- Se la sessione scade (timeout), il sistema reindirizza automaticamente alla schermata di login con un messaggio di avviso.
- Le credenziali sono personali: ogni operazione registrata nel sistema riporta il nome dell'operatore che l'ha eseguita.

---

## 2. Barra di stato (footer)

In fondo alla pagina è sempre visibile una barra scura con 6 indicatori aggiornati in tempo reale (ogni 5 minuti, oppure manualmente con il pulsante **↻**).

| Indicatore | Descrizione |
|---|---|
| ⏳ **Da approvare** | Iscrizioni con pagamento ricevuto ma non ancora validato. Lampeggia in giallo se > 0. **Cliccabile**: apre direttamente il tab Validazione Pagamenti con l'elenco precaricato. |
| ✓ **Confermati** | Numero totale di iscritti con pagamento validato. **Cliccabile**: apre il tab Confermati con l'elenco caricato automaticamente. |
| 👥 **Partecipanti** | Totale partecipanti confermati (pagamento validato). |
| 🍕 **Menu 1** | Posti rimanenti / totali per il menu 1. Giallo sotto il 25%, rosso sotto il 10%. |
| 🍔 **Menu 2** | Posti rimanenti / totali per il menu 2. Stessa logica colori del Menu 1. |
| 🍺 **Birre** | Totale boccali e litri di birra prenotati. |
| ✉️ **Email oggi** | Quota email giornaliera rimanente. Giallo sotto 50, rosso sotto 20. |

> **Suggerimento:** cliccare su "Da approvare" è il modo più rapido per aprire la coda dei pagamenti in attesa di validazione; cliccare su "Confermati" apre direttamente l'elenco degli iscritti con pagamento già confermato.

---

## 3. Tab: Validazione Pagamenti

Questo è il tab principale per la gestione dei pagamenti. Permette di cercare un iscritto e confermarne il pagamento.

### Ricerca iscritto

Sono disponibili due modalità di ricerca:

**Per Codice Bonifico**
Inserire le 3 cifre numeriche del codice AMA (es. `005` per AMA005) e premere **Cerca** o `Invio`. La ricerca è esatta.

**Ricerca libera**
Digitare almeno 3 caratteri di nome, cognome o email e premere **Cerca** o `Invio`. Restituisce tutti gli iscritti che corrispondono al testo inserito.

### Tabella risultati

Per ogni iscritto trovato la tabella mostra:

- **Codice Bonifico** — codice univoco del titolare (hovering mostra il codice titolare interno)
- **Nome / Cognome / Email**
- **Partecipanti** — totale adulti + bambini + infanti (hovering mostra il dettaglio)
- **Menu 1 / Menu 2 / Birre** — quantità prenotate
- **Totale** — importo atteso in €
- **Azioni** — pulsanti *Conferma* e *Segnala*

### Confermare un pagamento

1. Cliccare **Conferma** sulla riga dell'iscritto.
2. Comparirà una modale di conferma con il riepilogo dell'operazione.
3. Premere **✓ Conferma** per procedere.

Dopo la conferma:
- Il pulsante diventa **✅ Pagato** (verde) e non è più cliccabile.
- La riga viene evidenziata in verde.
- Gli indicatori nella barra di stato vengono aggiornati.

### Inviare una segnalazione

Il pulsante **Segnala** apre una finestra email precompilata con:
- Destinatario (email dell'iscritto)
- Oggetto standard
- Corpo del messaggio con importo atteso e causale bonifico

Il testo è modificabile prima dell'invio. Utilizzare questa funzione quando l'importo ricevuto non corrisponde a quello atteso.

---

## 4. Tab: Scordarelli

Gli "scordarelli" sono iscritti che si sono registrati ma non hanno ancora effettuato il pagamento entro un certo numero di giorni.

### Caricare l'elenco

1. Selezionare la soglia temporale dal menu a tendina (1, 3, 5 o 7 giorni — default: 3).
2. Premere **Carica elenco**.

La tabella mostrerà tutti gli iscritti in stato *Nuovo Iscritto* (registrati ma non pagati) che hanno superato la soglia selezionata. La colonna **Iscritto il** riporta la data di registrazione.

### Cancellare una prenotazione

Per le prenotazioni non pagate è possibile procedere alla cancellazione:

1. Cliccare **🗑 Cancella** sulla riga dell'iscritto.
2. Selezionare il **motivo della cancellazione** tra le opzioni proposte:
   - Pagamento mai ricevuto
   - Richiesta dell'iscritto
   - Prenotazione duplicata
   - Altro *(richiede l'inserimento di un testo libero)*
3. Premere **Conferma cancellazione**.

L'iscritto riceverà automaticamente una **email di notifica** della cancellazione con il motivo indicato.

> **Nota:** la cancellazione non è irreversibile — è possibile ripristinare una prenotazione dal tab *Cancellati*.

### Inviare un sollecito

Il pulsante **Sollecita** apre una finestra email precompilata con un messaggio di sollecito al pagamento, che include la causale bonifico e l'importo dovuto. Il testo è modificabile prima dell'invio.

---

## 5. Tab: Cancellati

Questo tab mostra tutte le prenotazioni in stato *Cancellato* e permette di ripristinarle.

### Caricare l'elenco

Premere **Carica elenco** per visualizzare tutte le prenotazioni cancellate.

La tabella mostra, oltre ai dati anagrafici e di prenotazione:

| Colonna | Descrizione |
|---|---|
| **Motivo** | Motivo della cancellazione inserito al momento dell'operazione |
| **Data Canc.** | Data e ora in cui è stata eseguita la cancellazione |
| **Operatore** | Username dell'operatore che ha eseguito la cancellazione |

### Ripristinare una prenotazione

1. Cliccare **↺ Ripristina** sulla riga desiderata.
2. Comparirà una modale di conferma con i dati dell'iscritto.

**Verifica limiti automatica:** prima di chiedere conferma, il sistema confronta i posti richiesti dalla prenotazione con i posti ancora disponibili nei menu. Se il ripristino porterebbe a un *overbooking*, la modale mostra un avviso in rosso del tipo:

```
⚠️ Attenzione — Overbooking
Menu 1: Rimanenti 3 — Richiesti 4 → 1 in Overbooking
Menu 2: Rimanenti 1 — Richiesti 2 → 1 in Overbooking
```

Il ripristino **non è bloccato**: l'operatore può comunque scegliere di procedere, consapevole che i rimanenti andranno in negativo.

3. Premere **↺ Ripristina** per confermare.

Dopo il ripristino l'iscritto torna allo stato *Registrazione OK* e comparirà nuovamente nel tab Validazione Pagamenti in attesa di conferma pagamento.

---

## 6. Tab: Confermati

Questo tab mostra tutti gli iscritti con pagamento confermato (stato *Pagato*) e permette di reinoltrare il biglietto via email.

### Caricare l'elenco

Premere **Carica elenco** per recuperare tutti i confermati. L'elenco viene caricato una sola volta per sessione; premere nuovamente il pulsante per aggiornarlo.

La tabella mostra, per ogni iscritto:

| Colonna | Descrizione |
|---|---|
| **Codice Bonifico** | Codice univoco del titolare |
| **Cognome / Nome** | Dati anagrafici |
| **Email** | Indirizzo email dell'iscritto |
| **Partecipanti** | Totale adulti + bambini + infanti |
| **Menu 1 / Menu 2 / Birre** | Quantità prenotate |
| **Totale** | Importo pagato in € |

### Ricerca

Il campo di testo in alto permette di filtrare l'elenco in tempo reale per nome, cognome, email o codice bonifico.

### Ordinamento colonne

Le intestazioni **Codice Bonifico**, **Cognome** e **Nome** sono cliccabili:

| Click | Effetto |
|---|---|
| 1° click | Ordinamento **ascendente** ▲ |
| 2° click | Ordinamento **discendente** ▼ |
| 3° click | Ritorno all'**ordine originale** |

L'ordinamento è esclusivo: cliccare su una nuova colonna annulla il precedente. Il filtro di ricerca e la paginazione rispettano sempre l'ordinamento attivo.

### Paginazione

L'elenco è suddiviso in pagine da 25 record. Usare i pulsanti **Prec / Succ** o i numeri di pagina per navigare.

### Reinoltrare il biglietto

Per ogni iscritto è disponibile il pulsante **✉ Reinoltra biglietto**:

1. Cliccare il pulsante sulla riga dell'iscritto.
2. Comparirà una modale di conferma con nome e cognome del destinatario.
3. Premere **✉ Reinoltra** per inviare nuovamente l'email con il biglietto allegato.

Dopo l'invio il pulsante diventa **✅ Inviato** (verde) e non è più cliccabile per quella sessione.

> **Nota:** il biglietto inviato è identico a quello originale; non viene rigenerato.

---

## 7. Modali e operazioni

### Modale di conferma generica

Utilizzata per conferma pagamenti e altre azioni irreversibili. Richiede sempre un click esplicito su **Conferma** — premere Annulla per tornare indietro senza eseguire nulla.

### Modale email (Segnalazione / Sollecito)

- Il campo **Destinatario** è in sola lettura (impostato automaticamente).
- **Oggetto** e **Messaggio** sono modificabili prima dell'invio.
- Premere **Invia** per spedire l'email oppure **Annulla** per chiudere senza inviare.

### Spinner di caricamento

Durante ogni operazione verso il backend compare uno spinner sovrapposto alla pagina. Non eseguire altre operazioni mentre lo spinner è visibile.

---

## Note operative

- Tutte le operazioni (conferma pagamento, cancellazione, ripristino) vengono registrate nel foglio Excel con data, ora e nome dell'operatore.
- La barra di stato si aggiorna automaticamente ogni 5 minuti; in caso di operazioni importanti è consigliabile aggiornarla manualmente con **↻**.
- In caso di sessione scaduta, il sistema reindirizza al login: le operazioni non salvate vengono perse.
- Per segnalare anomalie o malfunzionamenti fare riferimento alla sezione **Supporto tecnico** in fondo a questa guida.

---

## Supporto tecnico

Per assistenza tecnica sull'applicazione contattare il referente tramite email o WhatsApp.

