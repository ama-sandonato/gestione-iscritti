#!/usr/bin/env node
/**
 * Incrocia gli export bancari grezzi ("Lista Movimenti_CAI_*.csv") con gli export di
 * validazione ("movimenti-importati-*.csv") per capire quali bonifici risultano ancora
 * da validare, tenendo conto che gli export bancari possono sovrapporsi (lo stesso
 * bonifico può comparire in più file, con range di date che si ripetono).
 *
 * Uso:
 *   node scripts/verifica-bonifici-mancanti.js [cartella]
 *
 * Se "cartella" non è indicata, usa ./bonifici (relativa alla working directory).
 * Nessuna dipendenza esterna: solo Node.js (fs/path).
 */
const fs = require('fs');
const path = require('path');

const cartella = path.resolve(process.argv[2] || 'bonifici');

const PREFIX = 'AMA';
const FORMATTER_LEN = 3;

// Stessa logica di estrazione del backend (bank-import.js), con una tolleranza in più:
// l'ancora "DESCR.OPERAZIONE SCT:" viene cercata con spazi opzionali/variabili tra le parole
// (es. "DESCR.OPERAZIONESCT:" senza spazio, visto in alcuni export reali) invece che come
// stringa fissa — il backend resta rigido su questo, qui recuperiamo il caso in più.
function estraiCausale(descrizione) {
  const ancora = /DESCR\.OPERAZIONE\s*SCT\s*:/i;
  const match = (descrizione || '').match(ancora);
  if (!match) return null;
  const resto = descrizione.substring(match.index + match[0].length);
  const idxAsterisco = resto.indexOf('<*>');
  const idxTrattinoSct = resto.indexOf('-SCT');
  const candidati = [idxAsterisco, idxTrattinoSct].filter(i => i !== -1);
  const idxFine = candidati.length > 0 ? Math.min(...candidati) : resto.length;
  return resto.substring(0, idxFine).trim();
}

// Match "rigido": stesso identico formato preteso dal backend (bank-import.js) — un numero,
// un trattino, "Donazione", "A.M.A.". Se una causale passa questo match, il sistema live la
// riconoscerebbe già oggi così com'è, nessuna riscrittura necessaria.
function estraiNumeroStrict(causale) {
  if (!causale) return null;
  const match = causale.match(/^0*(\d+)\s*-\s*Donazione\s+A\.?M\.?A\.?/i);
  return match ? match[1].padStart(FORMATTER_LEN, '0') : null;
}

// Match "permissivo": cerca "donazione" e una variante di "ama" VICINE tra loro (zero o più
// spazi in mezzo — copre anche il caso limite di parole attaccate, es. "DONAZIONEAMA"), più un
// numero (1-4 cifre) come token isolato ovunque nella causale, in qualunque ordine rispetto al
// resto (puo comparire anche dopo la frase, non solo prima). Serve per recuperare causali
// scritte "a mano" dai donatori nei modi più vari — senza trattino, con il nome prima del
// codice, con codice e frase invertiti, parole unite, ecc. — che il backend (volutamente
// rigido) scarterebbe.
function estraiNumeroLenient(causale) {
  if (!causale) return null;
  if (!/donazion[ei]?\s*a\.?\s*m\.?\s*a\.?\b/i.test(causale)) return null;
  const match = causale.match(/\b(\d{1,4})\b/);
  return match ? match[1].padStart(FORMATTER_LEN, '0') : null;
}

/**
 * Prova prima il match rigido (identico al backend), poi in fallback quello permissivo.
 * @returns {{ numero: string, causaleNonStandard: boolean }|null}
 */
function trovaNumero(causale) {
  const strict = estraiNumeroStrict(causale);
  if (strict) return { numero: strict, causaleNonStandard: false };
  const lenient = estraiNumeroLenient(causale);
  if (lenient) return { numero: lenient, causaleNonStandard: true };
  return null;
}

/**
 * Riscrive la Descrizione nel formato causale STANDARD ("<numero> - Donazione A.M.A."),
 * mantenendo intatto il prefisso "ORD:...DT.ORD:..." (serve al backend per l'ordinante) —
 * così il backend (che resta rigido, non tocchiamo bank-import.js) riconosce la riga al
 * ricaricamento del csv generato da questo script.
 */
function standardizzaDescrizione(descrizioneOriginale, numero) {
  //stessa ricerca tollerante di estraiCausale: l'ancora originale può avere spazi mancanti/
  //variabili, ma nel riscrivere la mettiamo sempre nella forma canonica, spazio incluso
  const ancoraCanonica = 'DESCR.OPERAZIONE SCT:';
  const match = descrizioneOriginale.match(/DESCR\.OPERAZIONE\s*SCT\s*:/i);
  const prefisso = match
    ? descrizioneOriginale.substring(0, match.index) + ancoraCanonica
    : `${descrizioneOriginale} ${ancoraCanonica}`;
  return `${prefisso}${numero} - Donazione A.M.A.<*>`;
}

function parseImportoItaliano(s) {
  if (!s) return NaN;
  return parseFloat(s.toString().trim().replace(/\./g, '').replace(',', '.'));
}

function leggiCsv(filePath) {
  let raw = fs.readFileSync(filePath, 'utf8');
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  return raw.split(/\r?\n/).filter(r => r.trim() !== '');
}

// --- 1. Bonifici bancari grezzi: dedup per codice ricostruito ---
//pattern ristretto al nome reale degli export bancari (con "_CAI_"): il file generato da
//questo stesso script ("Lista Movimenti da validare.csv") NON deve matchare, altrimenti al
//giro successivo verrebbe riletto come se fosse un nuovo export bancario, gonfiando i conteggi
const fileGrezzi = fs.readdirSync(cartella)
  .filter(f => /^Lista Movimenti_CAI_.*\.csv$/i.test(f));

if (fileGrezzi.length === 0) {
  console.error(`Nessun file "Lista Movimenti_CAI_*.csv" trovato in ${cartella}`);
  process.exit(1);
}

const bonificiPerCodice = new Map(); // codice -> { importo, ordinante, dataOp, occorrenze, numero, causaleNonStandard }
const nonRiconosciuti = new Map();   // descrizione -> { importo, dataOp, occorrenze } (niente codice: dedup per testo)
let recuperatiConLenient = 0;

fileGrezzi.forEach(file => {
  const righe = leggiCsv(path.join(cartella, file));
  righe.shift(); // header
  righe.forEach(riga => {
    const campi = riga.split(';');
    if (campi.length < 6) return;
    const [dataOp, dataVal, causaleTipo, descrizione, importoStr, divisa] = campi;
    const importo = parseImportoItaliano(importoStr);
    if (isNaN(importo) || importo <= 0) return;

    const ordMatch = (descrizione || '').match(/ORD:(.*?)DT\.ORD:/);
    const ordinante = ordMatch ? ordMatch[1].trim() : null;

    const causale = estraiCausale(descrizione);
    const trovato = trovaNumero(causale);
    const codice = trovato ? PREFIX + trovato.numero : null;

    if (codice) {
      if (!bonificiPerCodice.has(codice)) {
        //tengo la riga grezza originale (dataOp, dataVal, causaleTipo, descrizione, importoStr,
        //divisa) così posso rigenerare un csv identico nella struttura a "Lista Movimenti" —
        //oppure, se causaleNonStandard, una versione con la causale riscritta in formato standard
        bonificiPerCodice.set(codice, {
          importo, ordinante, dataOp, occorrenze: 1,
          numero: trovato.numero,
          causaleNonStandard: trovato.causaleNonStandard,
          rigaOriginale: [dataOp, dataVal, causaleTipo, descrizione, importoStr, divisa]
        });
        if (trovato.causaleNonStandard) recuperatiConLenient++;
      } else {
        bonificiPerCodice.get(codice).occorrenze++;
      }
    } else {
      const chiave = descrizione.trim();
      if (!nonRiconosciuti.has(chiave)) {
        //tengo anche qui la riga grezza originale: questi bonifici finiscono comunque nel
        //csv di output, così l'operatore può correggere a mano la causale e ricaricarli
        nonRiconosciuti.set(chiave, {
          importo, ordinante, dataOp, occorrenze: 1,
          rigaOriginale: [dataOp, dataVal, causaleTipo, descrizione, importoStr, divisa]
        });
      } else {
        nonRiconosciuti.get(chiave).occorrenze++;
      }
    }
  });
});

// --- 2. Export di validazione: quali codici risultano già validati ---
const fileValidati = fs.readdirSync(cartella)
  .filter(f => /^movimenti-importati.*\.csv$/i.test(f));

const codiciValidati = new Set();

fileValidati.forEach(file => {
  const righe = leggiCsv(path.join(cartella, file));
  righe.shift(); // header
  righe.forEach(riga => {
    const campi = riga.split(';');
    if (campi.length < 12) return;
    const descrizione = campi[2];
    const stato = campi[10];

    if (stato === 'VALIDATO' || stato === 'GIA VALIDATO IN PRECEDENZA') {
      const trovato = trovaNumero(estraiCausale(descrizione));
      if (trovato) codiciValidati.add(PREFIX + trovato.numero);
    }
  });
});

// --- 3. Report ---
const tuttiCodici = [...bonificiPerCodice.keys()].sort((a, b) => {
  const na = parseInt(a.replace(PREFIX, ''), 10);
  const nb = parseInt(b.replace(PREFIX, ''), 10);
  return na - nb;
});

const daValidare = tuttiCodici.filter(c => !codiciValidati.has(c));

console.log(`\n📂 Cartella analizzata: ${cartella}`);
console.log(`📄 Export bancari letti: ${fileGrezzi.length} (${fileGrezzi.join(', ')})`);
console.log(`📄 Export di validazione letti: ${fileValidati.length} (${fileValidati.join(', ') || '—'})`);
console.log(`\n💰 Bonifici unici riconosciuti: ${tuttiCodici.length}`);
console.log(`✅ Già validati: ${tuttiCodici.length - daValidare.length}`);
console.log(`⏳ Ancora da validare: ${daValidare.length}`);
if (recuperatiConLenient > 0) {
  console.log(`✏️  Di cui con causale non standard, recuperati e riscritti nel csv di output: ${recuperatiConLenient}`);
}

if (daValidare.length > 0) {
  console.log(`\n--- Ancora da validare ---`);
  daValidare.forEach(c => {
    const b = bonificiPerCodice.get(c);
    const dup = b.occorrenze > 1 ? ` [in ${b.occorrenze} export]` : '';
    const nota = b.causaleNonStandard ? ' [causale riscritta]' : '';
    console.log(`  ${c}  €${b.importo.toFixed(2).padStart(8)}  ${b.dataOp}  ${b.ordinante || '—'}${dup}${nota}`);
  });
}

// --- 4. Genera il csv "Lista Movimenti da validare" (stessa struttura dei csv bancari) —
// include sia i bonifici con codice riconosciuto ma non ancora validati (causale riscritta in
// formato standard se recuperata col validatore permissivo, altrimenti riga originale
// invariata), sia quelli con causale scritta male al punto da non essere ricostruibile
// nemmeno col validatore permissivo: questi ultimi vanno corretti a mano nel file prima di
// ricaricarlo nel tab "Importa Movimenti" — in sovrascrittura ---
const headerGrezzo = 'Data Op.;Data Val.;Causale;Descrizione;Importo;Divisa';
const righeDaValidare = daValidare.map(c => {
  const b = bonificiPerCodice.get(c);
  if (!b.causaleNonStandard) return b.rigaOriginale.join(';');
  const [dataOp, dataVal, causaleTipo, descrizione, importoStr, divisa] = b.rigaOriginale;
  return [dataOp, dataVal, causaleTipo, standardizzaDescrizione(descrizione, b.numero), importoStr, divisa].join(';');
});
const righeNonRiconosciute = [...nonRiconosciuti.values()].map(b => b.rigaOriginale.join(';'));
const righeOutput = [...righeDaValidare, ...righeNonRiconosciute];
const outputPath = path.join(cartella, 'Lista Movimenti da validare.csv');
fs.writeFileSync(outputPath, [headerGrezzo, ...righeOutput].join('\r\n') + '\r\n', 'utf8');
console.log(`\n💾 Generato: ${outputPath} (${righeOutput.length} righe: ${righeDaValidare.length} da validare + ${righeNonRiconosciute.length} con causale da correggere)`);

if (nonRiconosciuti.size > 0) {
  console.log(`\n⚠️  Bonifici con causale NON riconosciuta (${nonRiconosciuti.size}) — presenti nel csv di output, ma vanno corretti a mano prima di ricaricarli:`);
  [...nonRiconosciuti.entries()].forEach(([descr, b]) => {
    const dup = b.occorrenze > 1 ? ` [in ${b.occorrenze} export]` : '';
    console.log(`  €${b.importo.toFixed(2).padStart(8)}  ${b.dataOp}  ${b.ordinante || '—'}${dup}`);
    console.log(`    ${descr}`);
  });
}

console.log('');
