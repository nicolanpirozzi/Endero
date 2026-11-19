// La pagina in cui il proprietario carica da sé le foto che mancano al sito (Worker "endero-domande").
//
//   node domande/foto.mjs crea <cartella fuori dal repository> [--base <indirizzo del Worker>]
//        la cartella contiene elenco.json: { "voci": [{ "id", "numero", "pagina", "titolo", "dove", "formato" }] }
//        e riceve chiave.txt; stampa il link da dare al proprietario
//   node domande/foto.mjs scarica <link> <cartella>
//        scarica le foto caricate (una per riquadro, con il suo id come nome) e dice quali mancano
//
// Le foto non arrivano sul sito da sole: si scaricano, si guardano, si ritagliano e comprimono con
// tools/comprimi-foto.py. Valgono le regole di sempre (CLAUDE.md): solo foto vere di Endero.
import { readFileSync, writeFileSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const radice = join(dirname(fileURLToPath(import.meta.url)), '..');
const [cosa, uno, ...resto] = process.argv.slice(2);
if (cosa === 'crea' && uno) {
  const base = (resto[resto.indexOf('--base') + 1] || '').replace(/\/$/, '');
  const elenco = JSON.parse(readFileSync(join(uno, 'elenco.json'), 'utf8'));
  for (const v of elenco.voci) if (!/^[a-z0-9-]{1,60}$/.test(v.id) || !v.titolo || !v.pagina) throw new Error(`voce non valida: ${JSON.stringify(v)}`);
  const fileChiave = join(uno, 'chiave.txt');
  let chiave = existsSync(fileChiave) ? readFileSync(fileChiave, 'utf8').trim() : '';
  if (!/^[a-z0-9]{20,40}$/.test(chiave)) {
    const alfabeto = 'abcdefghijkmnpqrstuvwxyz23456789';
    chiave = [...randomBytes(28)].map((b) => alfabeto[b % alfabeto.length]).join('');
    writeFileSync(fileChiave, chiave + '\n');
  }
  const lavoro = mkdtempSync(join(tmpdir(), 'foto-'));
  writeFileSync(join(lavoro, 'voci.json'), JSON.stringify([{ key: `f/${chiave}/elenco`, value: JSON.stringify(elenco) }]));
  const esito = spawnSync('npx', ['wrangler', 'kv', 'bulk', 'put', join(lavoro, 'voci.json'), '--binding', 'DOMANDE', '--config', join(radice, 'wrangler.domande.toml'), '--remote'], { cwd: radice, stdio: 'inherit' });
  rmSync(lavoro, { recursive: true, force: true });
  if (esito.status !== 0) process.exit(esito.status || 1);
  console.log(`\n${elenco.voci.length} riquadri.`);
  console.log(base ? `Link: ${base}/${chiave}/` : `Chiave: ${chiave}`);
} else if (cosa === 'scarica' && uno && resto[0]) {
  const base = uno.replace(/\/?$/, '/'), dove = resto[0];
  mkdirSync(dove, { recursive: true });
  const { voci, caricate } = await (await fetch(base + 'foto.json')).json();
  const estensione = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif' };
  for (const v of voci) {
    const m = caricate[v.id];
    if (!m) { console.log(`  manca   ${v.numero} · ${v.titolo}`); continue; }
    const r = await fetch(`${base}foto/${v.id}`);
    const file = `${v.id}.${estensione[m.tipo] || 'bin'}`;
    writeFileSync(join(dove, file), Buffer.from(await r.arrayBuffer()));
    console.log(`  ${file.padEnd(28)} ${(m.peso / 1e6).toFixed(1)} MB  ${m.quando}  (${m.nome})`);
  }
} else {
  console.error('Uso: node domande/foto.mjs crea <cartella> [--base <indirizzo>] | scarica <link> <cartella>');
  process.exit(1);
}
