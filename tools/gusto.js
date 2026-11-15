// Controllo di qualità con la skill design-taste-frontend, adattato a Endero.
//
//   node tools/gusto.js /                       pagina iniziale già generata in dist/
//   node tools/gusto.js /camicie-su-misura/     un'altra pagina
//   node tools/gusto.js / --tutto               senza filtro: anche le segnalazioni che per Endero non valgono
//
// Apre la pagina generata a 1440, 390 e 320 px in un Chrome senza interfaccia e ne misura margini, zone di tocco,
// contrasti, messa a fuoco da tastiera, testi tagliati. Dura qualche minuto per pagina. Prima serve `npm run build`.
//
// La skill è pensata per siti costruiti con il suo kit e ha regole che per Endero non valgono, perché il
// proprietario ha deciso diversamente (CLAUDE.md): quelle segnalazioni sono elencate in NON_VALE e si saltano.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const RADICE = path.join(__dirname, '..');
const SKILL = path.join(RADICE, '.claude/skills/design-taste-frontend');

const NON_VALE = {
  // approvato dal proprietario: apertura che avanza con lo scorrimento, scorrimento morbido, comparse, nastro
  'scroll-reveal': 'comparse approvate', 'scroll-linked': 'apertura approvata', pinned: 'apertura approvata',
  'effect-kind': 'scorrimento morbido chiesto dal proprietario', 'photo-print': "tela dell'apertura", marquee: 'nastro del riferimento',
  'loop-pause': 'nastro del riferimento', 'hero-enter': "l'ingresso è l'apertura", 'moment-none': 'i momenti sono nostri, non del kit',
  // ritmo "una sezione per schermo" e griglia del kit: Endero segue le proporzioni del riferimento
  'section-height': 'ritmo del riferimento', 'one-section': 'ritmo del riferimento', 'one-heading': 'ritmo del riferimento',
  'section-air': 'ritmo del riferimento', 'hero-screen': "prima dell'eroe c'è l'apertura", 'container-edges': 'markup del kit',
  'row-lines': 'markup del kit', 'split-pair': 'markup del kit', 'one-screen': 'ritmo del riferimento', 'heading-scale': 'titoli a 24 px come il riferimento',
  'nav-family': 'selettore del riferimento', grounds: 'colori approvati', 'empty-area': 'ritmo del riferimento',
  flush: 'griglie di foto a filo come nel riferimento',
  // azienda vera: indirizzo, CAP e numero sono quelli giusti e vanno pubblicati
  'street-number': 'sede vera', postcode: 'sede vera', 'phone-number': 'numero vero', coordinates: 'sede vera', 'company-number': 'dati veri', 'map-link': 'sede vera',
  // foto: solo quelle vere di Endero; finché non arrivano restano i riquadri segnaposto
  placeholder: 'segnaposto voluti', 'sample-label': 'segnaposto voluti', 'no-visual': 'foto in arrivo', 'visual-empty': 'foto in arrivo',
  'empty-visual': 'foto in arrivo', 'product-shown': 'foto in arrivo', 'text-only': 'foto in arrivo', 'photo-set': 'foto in arrivo',
  'visual-caption': 'note dei segnaposto e invito a scorrere', 'busy-ground': "testi dell'apertura approvati",
  // testi: il controllo ragiona in inglese
  'copy-fact': 'inglese', 'copy-headings': 'inglese', 'copy-buttons': 'inglese', 'copy-headline': 'inglese', cta: "prima dell'eroe c'è l'apertura",
};

function chrome() {
  const { chromium } = require('playwright');
  const vero = chromium.executablePath();
  // nel container si lavora come root: Chrome parte solo senza sandbox
  const involucro = path.join(os.tmpdir(), 'endero-chrome-senza-sandbox.sh');
  fs.writeFileSync(involucro, `#!/bin/sh\nexec "${vero}" --no-sandbox "$@"\n`, { mode: 0o755 });
  return involucro;
}

const argomenti = process.argv.slice(2);
const tutto = argomenti.includes('--tutto');
const pagina = argomenti.find((a) => a.startsWith('/')) || '/';
const file = path.join(RADICE, 'dist', pagina, pagina.endsWith('.html') ? '' : 'index.html');
if (!fs.existsSync(file)) { console.error(`Non trovo ${path.relative(RADICE, file)}: prima "npm run build".`); process.exit(2); }

const esito = spawnSync(process.execPath, [
  path.join(SKILL, 'scripts/consistency.mjs'), path.relative(RADICE, file), '--root', 'dist', '--quick', '--widths', '1440,390',
  '--page', 'product', '--category', 'camicie da uomo', '--primary', 'Prenota la presa misure',
], { cwd: RADICE, env: { ...process.env, CHROME_PATH: chrome() }, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 15 * 60 * 1000 });

const righe = (esito.stdout || '').split('\n');
if (!righe.some((r) => /^\d+x\d+ /.test(r))) { console.error('Il controllo non è partito:\n' + (esito.stderr || esito.stdout).slice(0, 2000)); process.exit(2); }

// ogni segnalazione: una riga "  FAIL nome  dove" seguita da righe rientrate con la spiegazione
const segnalazioni = [];
let larghezza = '';
for (const r of righe) {
  const testa = r.match(/^(\d+x\d+) /);
  if (testa) { larghezza = testa[1]; continue; }
  const m = r.match(/^  (FAIL|WARN) (\S+)\s+(.*)$/);
  if (m) segnalazioni.push({ larghezza: /^\[320\]/.test(m[3]) ? '320' : larghezza, peso: m[1], nome: m[2], dove: m[3], note: [] });
  else if (/^ {7}\S/.test(r) && segnalazioni.length) segnalazioni[segnalazioni.length - 1].note.push(r.trim());
}
const valide = tutto ? segnalazioni : segnalazioni.filter((s) => !(s.nome in NON_VALE));
const saltate = segnalazioni.length - valide.length;

console.log(`${pagina}: ${valide.filter((s) => s.peso === 'FAIL').length} da correggere, ${valide.filter((s) => s.peso === 'WARN').length} da guardare` + (tutto ? '' : ` (${saltate} saltate perché non valgono per Endero: --tutto per vederle)`));
for (const s of valide) {
  console.log(`\n${s.peso === 'FAIL' ? 'CORREGGI' : 'GUARDA  '} ${s.nome} · ${s.larghezza} px\n  ${s.dove.slice(0, 200)}`);
  for (const n of s.note.filter((x) => !x.startsWith('fix:')).slice(0, 2)) console.log('  ' + n.slice(0, 300));
}
process.exit(valide.some((s) => s.peso === 'FAIL') ? 1 : 0);
