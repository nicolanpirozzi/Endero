// Legge le risposte di un questionario dal suo link (non serve la chiave di Cloudflare).
//
//   node domande/leggi.mjs <link del questionario> [--json]
//
// Stampa, domanda per domanda, che cosa è stato risposto e quando. Con --json stampa i dati così come sono salvati.
const [link, come] = process.argv.slice(2);
if (!link) { console.error('Uso: node domande/leggi.mjs <link> [--json]'); process.exit(1); }
const base = link.replace(/\/?$/, '/');
const leggi = async (nome) => {
  const r = await fetch(base + nome, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`${nome}: ${r.status}`);
  return r.json();
};
const [q, { risposte }] = await Promise.all([leggi('domande.json'), leggi('risposte.json')]);
if (come === '--json') { console.log(JSON.stringify(risposte, null, 2)); process.exit(0); }
const date = Object.values(risposte).map((r) => r.quando).sort();
console.log(`${q.titolo}: ${Object.keys(risposte).length} risposte su ${q.passi.length}${date.length ? `, dal ${date[0]} al ${date.at(-1)}` : ''}\n`);
let gruppo = '';
for (const p of q.passi) {
  if (p.gruppo !== gruppo) { gruppo = p.gruppo; console.log(`— ${gruppo}`); }
  const r = risposte[p.id];
  const detto = !r ? '(senza risposta)' : r.stato === 'confermato' ? 'CONFERMA' : `${r.stato === 'modificato' ? 'MODIFICA' : 'RISPONDE'}: ${r.risposta.replace(/\s*\n\s*/g, ' / ')}`;
  console.log(`  [${p.id}] ${p.titolo} → ${detto}`);
}
