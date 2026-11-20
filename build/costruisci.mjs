// Genera il sito in dist/: pagine HTML complete, script e stili compilati con esbuild, file per Google.
//
//   node build/costruisci.mjs              anteprima: pagine non indicizzabili (noindex, robots chiuso)
//   node build/costruisci.mjs --pubblico   messa online su endero.it: solo dopo l'ok del proprietario
//
// Variabili facoltative: TURNSTILE_SITE_KEY (chiave pubblica dell'antispam del modulo),
// URL_ANTEPRIMA (indirizzo provvisorio dell'anteprima, per esempio https://endero-anteprima.xxx.workers.dev).
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import home from '../src/pagine/home.mjs';
import paginaSuMisura from '../src/pagine/su-misura.mjs';
import paginaConfiguratore from '../src/pagine/configuratore.mjs';
import paginaCollezione, { paginaCapo, paginaCategoria, indirizzoCapo, indirizzoCategoria } from '../src/pagine/collezione.mjs';
import paginaCultura, { PERCORSO as PERCORSO_CULTURA } from '../src/pagine/chi-siamo.mjs';
import paginaRivenditori, { PERCORSO as PERCORSO_RIVENDITORI } from '../src/pagine/rivenditori.mjs';
import paginaDoveSiamo from '../src/pagine/dove-siamo.mjs';
import paginaLegale from '../src/pagine/legale.mjs';
import semplice from '../src/pagine/semplice.mjs';
import { INTESTAZIONI, IMPRONTA_SCRIPT_IN_LINEA } from '../worker/intestazioni.mjs';
import { fileRedirects } from '../worker/reindirizzamenti.mjs';

const RADICE = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(RADICE, 'dist');
const pubblico = process.argv.includes('--pubblico');
const anteprima = !pubblico;
const lingua = 'it';

const leggi = (f) => JSON.parse(readFileSync(join(RADICE, 'contenuti', lingua, f), 'utf8'));
const sito = leggi('sito.json');
const testiHome = leggi('home.json');
const servizio = leggi('servizio.json');
const testi = {
  suMisura: leggi('su-misura.json'),
  cultura: leggi('chi-siamo.json'),
  rivenditori: leggi('diventa-rivenditore.json'),
  collezione: leggi('collezione.json'),
  doveSiamo: leggi('dove-siamo.json'),
  legale: leggi('legale.json'),
};
const prodotti = leggi('prodotti.json').prodotti;

function scrivi(percorso, contenuto) {
  const file = join(DIST, percorso);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, contenuto);
}

const inizio = performance.now();
rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

// 1 · file pronti: film dell'apertura e carattere
cpSync(join(RADICE, 'public'), DIST, { recursive: true });

// 2 · script e stili, con l'impronta nel nome così si possono tenere in cache per sempre
// lo script e il foglio del configuratore si caricano solo nella sua pagina
const ENTRATE = {
  sito: 'src/sito.js', apertura: 'src/apertura/apertura.js', stile: 'src/stili/sito.css',
  configuratore: 'src/configuratore/configuratore.js', 'stile-configuratore': 'src/configuratore/configuratore.css',
};
const esito = await build({
  absWorkingDir: RADICE,
  entryPoints: ENTRATE,
  outdir: join(DIST, 'risorse'),
  entryNames: '[name]-[hash]',
  bundle: true,
  minify: true,
  format: 'esm',
  target: ['es2020', 'safari15'],
  external: ['/font/*', '/film/*'],
  metafile: true,
  logLevel: 'warning',
});
const risorsa = {};
for (const [file, info] of Object.entries(esito.metafile.outputs)) {
  if (!info.entryPoint) continue;
  const nome = Object.keys(ENTRATE).find((n) => ENTRATE[n] === info.entryPoint);
  risorsa[nome] = '/' + relative(DIST, join(RADICE, file)).split('\\').join('/');
}

const turnstile = process.env.TURNSTILE_SITE_KEY || '';
// URL_ANTEPRIMA: l'indirizzo provvisorio su cui va l'anteprima (per l'immagine nella scheda del link)
const origineAnteprima = (process.env.URL_ANTEPRIMA || '').replace(/\/$/, '');
/** Larghezza e altezza di un JPEG di public/, lette dal file: servono ai social per mostrare grande l'anteprima del link. */
const misureLette = new Map();
function misure(indirizzo) {
  if (misureLette.has(indirizzo)) return misureLette.get(indirizzo);
  let esito = null;
  const file = join(RADICE, 'public', indirizzo.split('?')[0]);
  if (/\.jpe?g$/i.test(file) && existsSync(file)) {
    const b = readFileSync(file);
    // si scorrono i segmenti del JPEG fino a quello che porta le misure (SOF0…SOF15, esclusi quelli che non lo sono)
    for (let i = 2; i + 9 < b.length && b[i] === 0xff;) {
      const tipo = b[i + 1], lungo = b.readUInt16BE(i + 2);
      if (tipo >= 0xc0 && tipo <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(tipo)) { esito = [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)]; break; }
      i += 2 + lungo;
    }
  }
  misureLette.set(indirizzo, esito);
  return esito;
}
const base = { css: [risorsa.stile], js: [risorsa.sito], turnstile, origineAnteprima, misure };

// le foto vere di Endero (tools/comprimi-foto.py): per ogni cartella, le grandezze di ogni foto e, per ogni foto,
// un'impronta di tutte le sue grandezze, che va in fondo al suo indirizzo: se una foto si rifà chi torna non vede
// quella vecchia rimasta nel browser. L'impronta è della foto e non della cartella: aggiungendone una, gli indirizzi
// delle altre non cambiano, e Google non deve rileggerle tutte.
sito.foto = {};
for (const cartella of existsSync(join(RADICE, 'public/foto')) ? readdirSync(join(RADICE, 'public/foto')) : []) {
  const dove = join(RADICE, 'public/foto', cartella);
  if (!existsSync(join(dove, 'foto.json'))) continue;
  const indice = JSON.parse(readFileSync(join(dove, 'foto.json'), 'utf8'));
  const impronte = {};
  for (const nome of readdirSync(dove).sort()) {
    const foto = (nome.match(/^(.+)-[ov]-\d+\.(?:avif|webp)$/) || [])[1];
    if (foto && indice[foto]) (impronte[foto] ||= createHash('sha256')).update(nome).update(readFileSync(join(dove, nome)));
  }
  sito.foto[cartella] = { cartella: `/foto/${cartella}/`, indice, versioni: Object.fromEntries(Object.entries(impronte).map(([foto, i]) => [foto, i.digest('hex').slice(0, 10)])) };
}
// i video dell'apertura (tools/prepara-video.py): la stessa impronta, per lo stesso motivo
sito.video = {};
if (existsSync(join(RADICE, 'public/video'))) {
  const dove = join(RADICE, 'public/video');
  const impronta = createHash('sha256');
  for (const nome of readdirSync(dove).sort()) impronta.update(nome).update(readFileSync(join(dove, nome)));
  sito.video = { cartella: '/video/', file: readdirSync(dove), versione: impronta.digest('hex').slice(0, 10) };
}

// la camicia del configuratore (serve anche alla pagina iniziale, che ne mostra l'immagine ferma). L'immagine ferma c'è sempre; i pezzi che si muovono,
// se i loro file mancano, la pagina ne fa a meno. Ogni file porta la sua versione nell'indirizzo: il browser li tiene
// in memoria una settimana, e rifatti vanno riscaricati.
const conVersione = (nome) => {
  const file = join(RADICE, 'public/camicia', nome);
  return existsSync(file) ? `/camicia/${nome}?v=${createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 10)}` : '';
};
const camicia = { stile: risorsa['stile-configuratore'], script: risorsa.configuratore,
  ferma: { computer: conVersione('ferma.webp'), computer2x: conVersione('ferma-2x.webp'), telefono: conVersione('ferma-telefono.webp'), telefono2x: conVersione('ferma-telefono-2x.webp') } };
// i tre pezzi della camicia che si muove (src/configuratore/leggera.js), fatti da camicia/leggera/
if (existsSync(join(RADICE, 'public/camicia/leggera/leggera.json'))) {
  camicia.leggera = '/camicia/leggera/';
  // l'impronta di tutta la cartella: se i pezzi si rifanno, chi torna non si ritrova i vecchi rimasti nel browser
  const impronta = createHash('sha256');
  for (const nome of readdirSync(join(RADICE, 'public/camicia/leggera')).sort()) impronta.update(nome).update(readFileSync(join(RADICE, 'public/camicia/leggera', nome)));
  camicia.leggeraV = impronta.digest('hex').slice(0, 10);
}
if (!camicia.ferma.computer || !camicia.ferma.telefono) throw new Error('mancano public/camicia/ferma.webp e ferma-telefono.webp: si rifanno con camicia/film/monta.py');
if (!camicia.leggera) console.warn('  attenzione: manca public/camicia/leggera/, il configuratore mostra solo la camicia ferma');
const testiConfiguratore = leggi('configuratore.json');

// 3 · pagine
/**
 * Quando è cambiato l'ultima volta il contenuto di una pagina: la data dell'ultimo commit dei suoi testi (i nomi
 * semplici stanno in contenuti/<lingua>/) e degli elenchi delle sue foto (i percorsi che cominciano con public/).
 * Un cambio di grafica non la sposta: a Google interessa quando è cambiato ciò che si legge. Serve la cronologia
 * intera di git: con una copia parziale del repository tutte le pagine prenderebbero la stessa data.
 */
function ultimaModifica(file) {
  try {
    return execFileSync('git', ['log', '-1', '--format=%cs', '--', ...file.map((f) => (f.startsWith('public/') ? f : join('contenuti', lingua, f)))], { cwd: RADICE, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { return ''; }
}
/**
 * Le immagini di una pagina, per la mappa del sito: le foto di Endero (public/foto/) e la camicia del configuratore
 * (public/camicia/), ognuna una volta e con lo stesso indirizzo che ha nella pagina, impronta compresa.
 */
const fotoDi = (html) => [...new Set([...html.matchAll(/<img\b[^>]*\bsrc="(\/(?:foto|camicia)\/[^"]+)"/g)].map((m) => m[1]))];
// gli elenchi delle foto, cartella per cartella: se cambiano le foto di una pagina, cambia la sua data
const FOTO = { collezione: 'public/foto/collezione/foto.json', artigianato: 'public/foto/artigianato/foto.json', sede: 'public/foto/sede/foto.json', suMisura: 'public/foto/su-misura/foto.json' };
// la mappa del sito: per ogni pagina l'indirizzo, la data dell'ultima modifica dei suoi testi e le sue foto
const pagine = [];
function genera(percorso, html, fonti = []) {
  scrivi(percorso === '/' ? 'index.html' : percorso.slice(1) + 'index.html', html);
  pagine.push({ percorso, modificata: fonti.length ? ultimaModifica(fonti) : '', foto: fotoDi(html) });
}
genera('/', home({
  sito,
  testi: testiHome,
  cultura: testi.cultura,
  suMisura: testi.suMisura,
  configuratore: testiConfiguratore,
  camicia: camicia.ferma,
  rivenditori: testi.rivenditori,
  prodotti,
  collezione: testi.collezione,
  anteprima,
  risorse: {
    ...base,
    js: [risorsa.sito, risorsa.apertura],
    precarica: ['<link rel="preload" href="/film/film.json" as="fetch" crossorigin>'],
  },
}), ['home.json', 'collezione.json', 'chi-siamo.json', FOTO.collezione, FOTO.artigianato]);
genera('/camicie-su-misura/', paginaSuMisura({ sito, testi: testi.suMisura, risorse: base, anteprima }), ['su-misura.json', FOTO.sede, FOTO.suMisura]);
genera('/camicie-su-misura/configuratore/', paginaConfiguratore({ sito, testi: testiConfiguratore, camicia, risorse: base, anteprima }), ['configuratore.json']);
genera('/collezione/', paginaCollezione({ sito, testi: testi.collezione, prodotti, risorse: base, anteprima }), ['collezione.json', 'prodotti.json', FOTO.collezione]);
// una pagina per ogni categoria della collezione che ha i suoi testi (collezione.json, "categorie") e almeno una foto
const visti = new Set();
for (const tipo of testi.collezione.lookbook.tipi) {
  if (!testi.collezione.categorie?.[tipo.id] || !sito.foto.collezione || !testi.collezione.look.some((k) => k.tipo === tipo.id)) continue;
  visti.add(tipo.id);
  genera(indirizzoCategoria(tipo.id), paginaCategoria({ sito, testi: testi.collezione, tipo, risorse: base, anteprima }), ['collezione.json', FOTO.collezione]);
}
for (const capo of prodotti) {
  // l'indirizzo del capo diventa una cartella: solo minuscole, cifre e trattini, e mai due uguali
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(capo.slug || '')) throw new Error(`prodotti.json: slug non valido per "${capo.nome}": "${capo.slug}"`);
  if (visti.has(capo.slug)) throw new Error(`prodotti.json: slug doppio, o uguale al nome di una categoria: "${capo.slug}"`);
  visti.add(capo.slug);
}
for (const capo of prodotti) genera(indirizzoCapo(capo), paginaCapo({ sito, testi: testi.collezione, capo, risorse: base, anteprima }), ['prodotti.json']);
genera(PERCORSO_CULTURA, paginaCultura({ sito, testi: testi.cultura, nastro: testiHome.nastro, richiamo: testi.rivenditori.richiami.cultura, risorse: base, anteprima }), ['chi-siamo.json', FOTO.artigianato]);
genera(PERCORSO_RIVENDITORI, paginaRivenditori({ sito, testi: testi.rivenditori, nastro: testiHome.nastro, risorse: base, anteprima }), ['diventa-rivenditore.json', FOTO.sede]);
genera('/dove-siamo/', paginaDoveSiamo({ sito, testi: testi.doveSiamo, risorse: base, anteprima }), ['dove-siamo.json', FOTO.sede]);
genera('/privacy/', paginaLegale({ sito, testi: testi.legale, quale: 'privacy', risorse: base, anteprima }), ['legale.json']);
genera('/cookie/', paginaLegale({ sito, testi: testi.legale, quale: 'cookie', risorse: base, anteprima }), ['legale.json']);
scrivi('grazie/index.html', semplice({ sito, testi: servizio.grazie, percorso: '/grazie/', risorse: base }));
scrivi('404.html', semplice({ sito, testi: servizio.non_trovata, percorso: '/404', risorse: base }));

// 4 · il logo vettoriale, dal disegno approvato. Le icone quadrate e il logo in PNG per Google stanno già in public/:
// li fa tools/icone.js dallo stesso disegno, e si rifanno solo se il logo cambia.
const svg = (nome, colore) => readFileSync(join(RADICE, 'brand/logo', `endero-${nome}.svg`), 'utf8').replace(/currentColor/g, colore);
scrivi('logo.svg', svg('completo', '#0f285e'));

// 5 · file per i motori di ricerca. In anteprima il sito resta chiuso.
scrivi('robots.txt', anteprima
  ? 'User-agent: *\nDisallow: /\n'
  : `User-agent: *\nAllow: /\n\nSitemap: ${sito.dominio}/sitemap.xml\n`);
// La mappa dice a Google quali pagine ci sono, quando sono cambiate i loro testi e quali foto contengono
// (le foto contano: chi cerca un capo spesso cerca per immagini).
const xml = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
scrivi('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${pagine.map((p) => `  <url>
    <loc>${xml(sito.dominio + p.percorso)}</loc>${p.modificata ? `\n    <lastmod>${p.modificata}</lastmod>` : ''}${p.foto.map((f) => `\n    <image:image><image:loc>${xml(sito.dominio + f)}</image:loc></image:image>`).join('')}
  </url>`).join('\n')}
</urlset>
`);

// 6 · reindirizzamenti: vecchi indirizzi PrestaShop e /storia/ (elenco in worker/reindirizzamenti.mjs)
scrivi('_redirects', fileRedirects());

// 7 · intestazioni per Cloudflare: cache lunga per i file con l'impronta, sicurezza per tutti
// l'unico script in linea delle pagine deve corrispondere all'impronta ammessa dalla Content-Security-Policy
const inLinea = readFileSync(join(DIST, 'index.html'), 'utf8').match(/<script>([^<]*)<\/script>/)?.[1] ?? '';
const impronta = 'sha256-' + createHash('sha256').update(inLinea).digest('base64');
if (impronta !== IMPRONTA_SCRIPT_IN_LINEA) throw new Error(`Lo script in linea è cambiato: aggiornare IMPRONTA_SCRIPT_IN_LINEA in worker/intestazioni.mjs a '${impronta}'`);

scrivi('_headers', `/*
${Object.entries(INTESTAZIONI).map(([nome, valore]) => `  ${nome}: ${valore}`).join('\n')}
${anteprima ? '  X-Robots-Tag: noindex, nofollow\n' : ''}
/risorse/*
  Cache-Control: public, max-age=31536000, immutable

/font/*
  Cache-Control: public, max-age=31536000, immutable

/film/*
  Cache-Control: public, max-age=604800

/camicia/*
  Cache-Control: public, max-age=604800

/video/*
  Cache-Control: public, max-age=604800

/foto/*
  Cache-Control: public, max-age=604800
`);

console.log(`${pagine.length} pagine generate in dist/ (${anteprima ? 'anteprima, non indicizzabile' : 'pubblico'}) in ${Math.round(performance.now() - inizio)} ms`);
for (const [nome, file] of Object.entries(risorsa)) console.log(`  ${nome.padEnd(9)} ${file}`);
