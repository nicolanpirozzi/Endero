// Controlla il Worker del sito vero (worker/index.js) senza Cloudflare: si avvia, riceve i moduli, cancella le
// richieste vecchie come promette l'informativa privacy.
//
//   node tools/prova-worker.mjs
//
// Perché serve: «wrangler deploy --dry-run» non si accorge di un Worker che non parte. Il 2026-11-20 due costanti
// esportate dal file principale lo bloccavano (Cloudflare prende ogni cosa esportata per un punto d'ingresso, e un
// numero non lo è): qui si guarda che esporti solo funzioni.
import { build } from 'esbuild';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const RADICE = join(dirname(fileURLToPath(import.meta.url)), '..');
let passati = 0;
const falliti = [];
const controlla = (nome, vero, dettaglio = '') => {
  if (vero) passati++; else falliti.push(nome + (dettaglio ? ` (${dettaglio})` : ''));
  console.log(`${vero ? '  ok ' : '  NO '} ${nome}${!vero && dettaglio ? ' → ' + dettaglio : ''}`);
};

// il Worker com'è caricato su Cloudflare: un file solo, con i testi dentro
const cartella = mkdtempSync(join(tmpdir(), 'endero-worker-'));
const uscita = join(cartella, 'worker.mjs');
await build({ entryPoints: [join(RADICE, 'worker/index.js')], bundle: true, format: 'esm', platform: 'neutral', outfile: uscita, logLevel: 'silent' });
const worker = await import(pathToFileURL(uscita));
const conservazione = await import(pathToFileURL(join(RADICE, 'worker/conservazione.mjs')));

console.log('Il Worker si avvia');
const nomi = Object.keys(worker).filter((n) => n !== 'default');
controlla('esporta solo funzioni (altrimenti Cloudflare non lo avvia)', nomi.every((n) => typeof worker[n] === 'function'), nomi.filter((n) => typeof worker[n] !== 'function').join(', '));
controlla('ha fetch e scheduled', typeof worker.default?.fetch === 'function' && typeof worker.default?.scheduled === 'function');
const configurazione = readFileSync(join(RADICE, 'wrangler.toml'), 'utf8');
controlla('wrangler.toml lo fa partire ogni notte', /\[triggers\][\s\S]*crons\s*=\s*\["[0-9*,/ -]+"\]/.test(configurazione));

// un database vero (SQLite, come D1) con lo schema del sito
const nuovoDb = () => {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(join(RADICE, 'db/schema.sql'), 'utf8'));
  // D1 visto dal Worker: prepare(...).bind(...).run()
  return {
    db,
    d1: {
      prepare: (sql) => {
        let valori = [];
        const passo = { bind: (...v) => { valori = v; return passo; }, run: async () => ({ meta: { changes: Number(db.prepare(sql.replace(/\?(\d+)/g, '?')).run(...valori).changes) } }) };
        return passo;
      },
    },
  };
};

console.log('I moduli');
{
  const { db, d1 } = nuovoDb();
  const invia = (campi) => {
    const corpo = new URLSearchParams({ privacy: 'si', ...campi });
    return worker.default.fetch(new Request('https://www.endero.it/api/contatto', { method: 'POST', body: corpo, headers: { Accept: 'application/json', Origin: 'https://www.endero.it', 'Content-Type': 'application/x-www-form-urlencoded' } }), { DB: d1 });
  };
  const r = await invia({ tipo: 'presa-misure', nome: 'Prova', telefono: '+39 333 000 0005', email: ' Mario@X.it ' });
  controlla('una prenotazione si salva', r.status === 200 && (await r.json()).ok === true, String(r.status));
  const riga = db.prepare('SELECT telefono, email, chiave_telefono, chiave_email FROM richieste').get();
  controlla('con telefono ed email come li ha scritti, e le chiavi per riconoscere la persona', riga?.telefono === '+39 333 000 0005' && riga?.chiave_telefono === '3330000005' && riga?.chiave_email === 'mario@x.it', JSON.stringify(riga));
  const senza = await invia({ tipo: 'presa-misure', nome: 'Prova', telefono: '' });
  controlla('senza telefono non si salva', senza.status === 422);
}

console.log('La stessa persona');
for (const [scritto, atteso] of [['333 000 0005', '3330000005'], ['+39 333-000-0005', '3330000005'], ['0039 3330000005', '3330000005'], ['(+39) 347 000 1111', '3470001111'], ['393470001111', '3470001111'], ['\u202a+39 333 123 4567\u202c', '3331234567'], ['Tel. 333.000.0005', '3330000005'], ['+41 79 123 45 67', '41791234567'], ['0041 79 123 45 67', '41791234567'], ['081 123 4567', '0811234567'], ['+39 081 123 4567', '0811234567'], ['', '']]) {
  controlla(`telefono «${scritto}» → ${atteso || 'vuoto'}`, conservazione.chiaveTelefono(scritto) === atteso, conservazione.chiaveTelefono(scritto));
}

console.log('Dopo 24 mesi dall\'ultima richiesta, via');
{
  const { db, d1 } = nuovoDb();
  const fa = (mesi) => db.prepare(`SELECT strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-${mesi} months', '-1 day') AS d`).get().d;
  const metti = (nome, telefono, email, mesi) => db.prepare('INSERT INTO richieste (nome, telefono, email, chiave_telefono, chiave_email, creata) VALUES (?, ?, ?, ?, ?, ?)').run(nome, telefono, email, conservazione.chiaveTelefono(telefono), conservazione.chiaveEmail(email), fa(mesi));
  metti('vecchia, sola', '333 111 1111', '', 30);
  metti('vecchia, la persona è tornata con il telefono scritto in un altro modo', '333 222 2222', '', 30);
  metti('recente, stesso telefono', '+39 3332222222', '', 2);
  metti('vecchia, la persona è tornata con l\'email in maiuscolo', '333 333 3333', 'mario@x.it', 26);
  metti('recente, stessa email', '333 999 9999', 'Mario@X.it', 1);
  metti('di 23 mesi', '333 444 4444', '', 23);
  metti('vecchia senza email, altri senza email recenti', '333 555 5555', '', 40);
  metti('recente senza email', '333 666 6666', '', 1);
  const via = await conservazione.dimentica(d1);
  const restano = db.prepare('SELECT nome FROM richieste ORDER BY id').all().map((x) => x.nome);
  controlla('cancella solo quelle di più di 24 mesi della persona che non è tornata', via === 2 && !restano.includes('vecchia, sola') && !restano.includes('vecchia senza email, altri senza email recenti') && restano.length === 6, `${via} cancellate; restano: ${restano.join(' | ')}`);
  // con molte richieste la cancellazione usa gli indici, non confronta ogni riga con tutte le altre
  const piano = db.prepare('EXPLAIN QUERY PLAN ' + conservazione.DIMENTICA).all().map((x) => x.detail).join(' | ');
  controlla('usa gli indici per telefono ed email', /richieste_per_telefono/.test(piano) && /richieste_per_email/.test(piano), piano);
  // e il Worker la fa partire da sé
  const prima = db.prepare('SELECT COUNT(*) AS n FROM richieste').get().n;
  metti('altra vecchia', '333 777 7777', '', 30);
  const attese = [];
  await worker.default.scheduled({}, { DB: d1 }, { waitUntil: (p) => attese.push(p) });
  await Promise.all(attese);
  controlla('il lavoro di ogni notte la cancella', db.prepare('SELECT COUNT(*) AS n FROM richieste').get().n === prima);
}

rmSync(cartella, { recursive: true, force: true });
console.log(`\n${passati} controlli passati, ${falliti.length} falliti`);
if (falliti.length) { console.log(falliti.map((x) => ' - ' + x).join('\n')); process.exit(1); }
