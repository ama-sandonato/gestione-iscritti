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

// Stessa logica di estrazione usata dal backend (bank-import.js), per restare coerenti
// con quello che il sistema live considera "riconosciuto".
function estraiCausale(descrizione) {
  const ancora = 'DESCR.OPERAZIONE SCT:';
  const idx = (descrizione || '').indexOf(ancora);
  if (idx === -1) return null;
  const resto = descrizione.substring(idx + ancora.length);
  const idxAsterisco = resto.indexOf('<*>');
  const idxTrattinoSct = resto.indexOf('-SCT');
  const candidati = [idxAsterisco, idxTrattinoSct].filter(i => i !== -1);
  const idxFine = candidati.length > 0 ? Math.min(...candidati) : resto.length;
  return resto.substring(0, idxFine).trim();
}

function ricostruisciCodice(causale) {
  if (!causale) return null;
  const match = causale.match(/^0*(\d+)\s*-\s*Donazione\s+A\.?M\.?A\.?/i);
  if (!match) return null;
  return PREFIX + match[1].padStart(FORMATTER_LEN, '0');
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
const fileGrezzi = fs.readdirSync(cartella)
  .filter(f => /^Lista Movimenti.*\.csv$/i.test(f));

if (fileGrezzi.length === 0) {
  console.error(`Nessun file "Lista Movimenti*.csv" trovato in ${cartella}`);
  process.exit(1);
}

const bonificiPerCodice = new Map(); // codice -> { importo, ordinante, dataOp, occorrenze }
const nonRiconosciuti = new Map();   // descrizione -> { importo, dataOp, occorrenze } (niente codice: dedup per testo)

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
    const codice = ricostruisciCodice(causale);

    if (codice) {
      if (!bonificiPerCodice.has(codice)) {
        //tengo la riga grezza originale (dataOp, dataVal, causaleTipo, descrizione, importoStr,
        //divisa) così posso rigenerare un csv identico nella struttura a "Lista Movimenti"
        bonificiPerCodice.set(codice, {
          importo, ordinante, dataOp, occorrenze: 1,
          rigaOriginale: [dataOp, dataVal, causaleTipo, descrizione, importoStr, divisa]
        });
      } else {
        bonificiPerCodice.get(codice).occorrenze++;
      }
    } else {
      const chiave = descrizione.trim();
      if (!nonRiconosciuti.has(chiave)) {
        nonRiconosciuti.set(chiave, { importo, ordinante, dataOp, occorrenze: 1 });
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
      const codice = ricostruisciCodice(estraiCausale(descrizione));
      if (codice) codiciValidati.add(codice);
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

if (daValidare.length > 0) {
  console.log(`\n--- Ancora da validare ---`);
  daValidare.forEach(c => {
    const b = bonificiPerCodice.get(c);
    const dup = b.occorrenze > 1 ? ` [in ${b.occorrenze} export]` : '';
    console.log(`  ${c}  €${b.importo.toFixed(2).padStart(8)}  ${b.dataOp}  ${b.ordinante || '—'}${dup}`);
  });
}

// --- 4. Genera il csv "Lista Movimenti da validare" (stessa struttura dei csv bancari,
// solo i bonifici con codice riconosciuto ma non ancora validati) — in sovrascrittura ---
const headerGrezzo = 'Data Op.;Data Val.;Causale;Descrizione;Importo;Divisa';
const righeOutput = daValidare.map(c => bonificiPerCodice.get(c).rigaOriginale.join(';'));
const outputPath = path.join(cartella, 'Lista Movimenti da validare.csv');
fs.writeFileSync(outputPath, [headerGrezzo, ...righeOutput].join('\r\n') + '\r\n', 'utf8');
console.log(`\n💾 Generato: ${outputPath} (${righeOutput.length} righe)`);

if (nonRiconosciuti.size > 0) {
  console.log(`\n⚠️  Bonifici con causale NON riconosciuta (${nonRiconosciuti.size}) — vanno controllati a mano:`);
  [...nonRiconosciuti.entries()].forEach(([descr, b]) => {
    const dup = b.occorrenze > 1 ? ` [in ${b.occorrenze} export]` : '';
    console.log(`  €${b.importo.toFixed(2).padStart(8)}  ${b.dataOp}  ${b.ordinante || '—'}${dup}`);
    console.log(`    ${descr}`);
  });
}

console.log('');
