// Genera il sito in dist/: pagine HTML complete, script e stili compilati con esbuild, file per Google.
//
//   node build/costruisci.mjs              anteprima: pagine non indicizzabili (noindex, robots chiuso)
//   node build/costruisci.mjs --pubblico   messa online su endero.it: solo dopo l'ok del proprietario
//
// Variabili facoltative: TURNSTILE_SITE_KEY (chiave pubblica dell'antispam del modulo),
// URL_ANTEPRIMA (indirizzo provvisorio dell'anteprima, per esempio https://endero-anteprima.xxx.workers.dev).
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import home from '../src/pagine/home.mjs';
import paginaSuMisura from '../src/pagine/su-misura.mjs';
import paginaConfiguratore from '../src/pagine/configuratore.mjs';
import paginaCollezione, { paginaCapo, indirizzoCapo } from '../src/pagine/collezione.mjs';
import paginaCultura, { PERCORSO as PERCORSO_CULTURA } from '../src/pagine/cultura.mjs';
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
  cultura: leggi('cultura-e-artigianato.json'),
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
const base = { css: [risorsa.stile], js: [risorsa.sito], turnstile, origineAnteprima };

// 3 · pagine
scrivi('index.html', home({
  sito,
  testi: testiHome,
  cultura: testi.cultura,
  suMisura: testi.suMisura,
  rivenditori: testi.rivenditori,
  prodotti,
  anteprima,
  risorse: {
    ...base,
    js: [risorsa.sito, risorsa.apertura],
    precarica: ['<link rel="preload" href="/film/film.json" as="fetch" crossorigin>'],
  },
}));
const pagine = ['/'];
function genera(percorso, html) {
  scrivi(percorso.slice(1) + 'index.html', html);
  pagine.push(percorso);
}
genera('/camicie-su-misura/', paginaSuMisura({ sito, testi: testi.suMisura, risorse: base, anteprima }));
// configuratore: la camicia è un film calcolato prima (camicia/film/). L'immagine ferma c'è sempre; le scene del tocco,
// se i loro file mancano, la pagina ne fa a meno. Ogni file porta la sua versione nell'indirizzo: il browser li tiene
// in memoria una settimana, e rifatti vanno riscaricati.
const conVersione = (nome) => {
  const file = join(RADICE, 'public/camicia', nome);
  return existsSync(file) ? `/camicia/${nome}?v=${createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 10)}` : '';
};
const camicia = { stile: risorsa['stile-configuratore'], script: risorsa.configuratore,
  ferma: { computer: conVersione('ferma.webp'), computer2x: conVersione('ferma-2x.webp'), telefono: conVersione('ferma-telefono.webp'), telefono2x: conVersione('ferma-telefono-2x.webp') }, scene: {} };
for (const nome of ['da-sinistra', 'da-destra']) {
  const computer = conVersione(`${nome}.mp4`), telefono = conVersione(`${nome}-telefono.mp4`);
  if (computer && telefono) camicia.scene[nome] = { computer, telefono };
}
if (!camicia.ferma.computer || !camicia.ferma.telefono) throw new Error('mancano public/camicia/ferma.webp e ferma-telefono.webp: si rifanno con camicia/film/monta.py');
if (!camicia.scene['da-destra']) console.warn('  attenzione: in public/camicia/ mancano le scene del tocco, il configuratore mostra solo la camicia ferma');
genera('/camicie-su-misura/configuratore/', paginaConfiguratore({ sito, testi: leggi('configuratore.json'), camicia, risorse: base, anteprima }));
genera('/collezione/', paginaCollezione({ sito, testi: testi.collezione, prodotti, risorse: base, anteprima }));
const visti = new Set();
for (const capo of prodotti) {
  // l'indirizzo del capo diventa una cartella: solo minuscole, cifre e trattini, e mai due uguali
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(capo.slug || '')) throw new Error(`prodotti.json: slug non valido per "${capo.nome}": "${capo.slug}"`);
  if (visti.has(capo.slug)) throw new Error(`prodotti.json: slug doppio "${capo.slug}"`);
  visti.add(capo.slug);
}
for (const capo of prodotti) genera(indirizzoCapo(capo), paginaCapo({ sito, testi: testi.collezione, capo, risorse: base, anteprima }));
genera(PERCORSO_CULTURA, paginaCultura({ sito, testi: testi.cultura, nastro: testiHome.nastro, richiamo: testi.rivenditori.richiami.cultura, risorse: base, anteprima }));
genera(PERCORSO_RIVENDITORI, paginaRivenditori({ sito, testi: testi.rivenditori, nastro: testiHome.nastro, risorse: base, anteprima }));
genera('/dove-siamo/', paginaDoveSiamo({ sito, testi: testi.doveSiamo, risorse: base, anteprima }));
genera('/privacy/', paginaLegale({ sito, testi: testi.legale, quale: 'privacy', risorse: base, anteprima }));
genera('/cookie/', paginaLegale({ sito, testi: testi.legale, quale: 'cookie', risorse: base, anteprima }));
scrivi('grazie/index.html', semplice({ sito, testi: servizio.grazie, percorso: '/grazie/', risorse: base }));
scrivi('404.html', semplice({ sito, testi: servizio.non_trovata, percorso: '/404', risorse: base }));

// 4 · icona e logo per Google, dal vettoriale approvato
const svg = (nome, colore) => readFileSync(join(RADICE, 'brand/logo', `endero-${nome}.svg`), 'utf8').replace(/currentColor/g, colore);
scrivi('favicon.svg', svg('simbolo', '#0f285e'));
scrivi('logo.svg', svg('completo', '#0f285e'));

// 5 · file per i motori di ricerca. In anteprima il sito resta chiuso.
scrivi('robots.txt', anteprima
  ? 'User-agent: *\nDisallow: /\n'
  : `User-agent: *\nAllow: /\n\nSitemap: ${sito.dominio}/sitemap.xml\n`);
scrivi('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pagine.map((p) => `  <url><loc>${sito.dominio}${p}</loc></url>`).join('\n')}
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
`);

console.log(`${pagine.length} pagine generate in dist/ (${anteprima ? 'anteprima, non indicizzabile' : 'pubblico'}) in ${Math.round(performance.now() - inizio)} ms`);
for (const [nome, file] of Object.entries(risorsa)) console.log(`  ${nome.padEnd(9)} ${file}`);
