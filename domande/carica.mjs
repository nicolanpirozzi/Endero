// Carica un questionario nell'archivio del Worker "endero-domande" e ne stampa il link.
//
//   node domande/carica.mjs <cartella> [--base https://endero-domande.<conto>.workers.dev] [--locale]
//
// Con --locale scrive nell'archivio finto di "wrangler dev" (per provare la pagina sul proprio computer).
//
// La cartella sta FUORI dal repository (le domande citano le misure dei cartamodelli) e contiene:
//   domande.json     il questionario, vedi sotto
//   ritagli/*.jpg    le immagini citate nelle domande
//   chiave.txt       l'indirizzo segreto: se manca lo crea questo script, e va conservato per ricaricare
// Le risposte già date non si toccano. Per ripartire da zero su un dispositivo che ha già risposto si alza "giro".
//
// domande.json:
//   { "titolo": "…", "giro": 1, "passi": [ … ] }
// Un passo è una schermata: "id", "gruppo" (in alto a sinistra), "titolo", "ritagli": [[file, didascalia]],
// "testo" (una riga o più: frasi corte, dette semplici), e poi secondo il "tipo":
//   "ipotesi"  una proposta da approvare: "etichetta"?, "ipotesi", "nota"?, "domanda" (es. «Va bene così?»),
//              "conferma" e "altro" (le scritte dei due tasti), "altre"?: [[id, testo]] per altre risposte pronte,
//              "modifica": true se chi dice di no deve correggere il testo proposto invece di scriverlo da capo
//   "scelta"   una domanda con le risposte pronte: "domanda", "scelte": [[id, testo]], "altro"? (false per toglierlo)
//   "numero"   un numero da scrivere: "domanda", "unita", "min", "max", "altro",
//              "riprende"?: id di un passo "ipotesi" (se ne mostra il testo, o quello corretto da chi risponde),
//              "esempio"?: { "da": 100, "frase": "Con {n} cm … {r} cm.", "vuota": "…" }   ({r} = da − n)
// Chi risponde non è pratico di tecnologia: la pagina si apre già sulla prima domanda. Con ?prova in fondo al link
// si guarda senza salvare.
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const radice = join(dirname(fileURLToPath(import.meta.url)), '..');
const [cartella, ...resto] = process.argv.slice(2);
if (!cartella) { console.error('Uso: node domande/carica.mjs <cartella> [--base <indirizzo del Worker>] [--locale]'); process.exit(1); }
const dopo = (nome) => (resto.includes(nome) ? resto[resto.indexOf(nome) + 1] || '' : '');
const base = dopo('--base').replace(/\/$/, '');
const locale = resto.includes('--locale');

const q = JSON.parse(readFileSync(join(cartella, 'domande.json'), 'utf8'));
const errori = [];
const visti = new Set(), immagini = new Set();
if (!q.titolo || !Array.isArray(q.passi) || !q.passi.length) errori.push('servono "titolo" e almeno un passo');
for (const p of q.passi || []) {
  if (!/^[a-z0-9-]{1,60}$/.test(p.id || '')) errori.push(`id non valido: ${p.id}`);
  if (visti.has(p.id)) errori.push(`id ripetuto: ${p.id}`);
  visti.add(p.id);
  if (!['ipotesi', 'scelta', 'numero'].includes(p.tipo)) errori.push(`${p.id}: tipo sconosciuto`);
  if (!p.gruppo || !p.titolo) errori.push(`${p.id}: servono gruppo e titolo`);
  if (p.tipo === 'ipotesi' && !p.ipotesi) errori.push(`${p.id}: manca l'ipotesi`);
  if (p.tipo !== 'ipotesi' && !p.domanda) errori.push(`${p.id}: manca la domanda`);
  if (p.tipo === 'scelta' && !(Array.isArray(p.scelte) && p.scelte.length >= 2)) errori.push(`${p.id}: servono almeno due scelte`);
  for (const [file] of p.ritagli || []) {
    if (!/^[a-z0-9-]{1,60}$/.test(file) || !existsSync(join(cartella, 'ritagli', file + '.jpg'))) errori.push(`${p.id}: manca il ritaglio ${file}.jpg`);
    immagini.add(file);
  }
}
for (const p of q.passi || []) if (p.riprende && !visti.has(p.riprende)) errori.push(`${p.id}: "riprende" punta a un passo che non c'è (${p.riprende})`);
if (errori.length) { console.error(errori.join('\n')); process.exit(1); }

const fileChiave = join(cartella, 'chiave.txt');
let chiave = existsSync(fileChiave) ? readFileSync(fileChiave, 'utf8').trim() : '';
if (!/^[a-z0-9]{20,40}$/.test(chiave)) {
  const alfabeto = 'abcdefghijkmnpqrstuvwxyz23456789';   // senza 0/o e 1/l, che a mano si confondono
  chiave = [...randomBytes(28)].map((b) => alfabeto[b % alfabeto.length]).join('');
  writeFileSync(fileChiave, chiave + '\n');
}

const voci = [{ key: `q/${chiave}/domande`, value: JSON.stringify(q) }];
for (const file of immagini) voci.push({ key: `q/${chiave}/ritagli/${file}`, value: readFileSync(join(cartella, 'ritagli', file + '.jpg')).toString('base64'), base64: true });
const avanzano = readdirSync(join(cartella, 'ritagli')).filter((f) => f.endsWith('.jpg') && !immagini.has(f.slice(0, -4)));

const lavoro = mkdtempSync(join(tmpdir(), 'domande-'));
const elenco = join(lavoro, 'voci.json');
writeFileSync(elenco, JSON.stringify(voci));
const esito = spawnSync('npx', ['wrangler', 'kv', 'bulk', 'put', elenco, '--binding', 'DOMANDE', '--config', join(radice, 'wrangler.domande.toml'), locale ? '--local' : '--remote'], { cwd: radice, stdio: 'inherit' });
rmSync(lavoro, { recursive: true, force: true });
if (esito.status !== 0) process.exit(esito.status || 1);

console.log(`\n${q.passi.length} domande, ${immagini.size} ritagli caricati${avanzano.length ? ` (${avanzano.length} immagini della cartella non servono a nessuna domanda)` : ''}.`);
console.log(base ? `Link: ${base}/${chiave}/` : `Chiave: ${chiave}  (il link è <indirizzo del Worker>/${chiave}/)`);
