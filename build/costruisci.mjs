// Genera il sito in dist/: pagine HTML complete, script e stili compilati con esbuild, file per Google.
//
//   node build/costruisci.mjs              anteprima: pagine non indicizzabili (noindex, robots chiuso)
//   node build/costruisci.mjs --pubblico   messa online su endero.it: solo dopo l'ok del proprietario
//
// Variabili facoltative: TURNSTILE_SITE_KEY (chiave pubblica dell'antispam del modulo).
import { build } from 'esbuild';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import home from '../src/pagine/home.mjs';
import semplice from '../src/pagine/semplice.mjs';

const RADICE = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(RADICE, 'dist');
const pubblico = process.argv.includes('--pubblico');
const anteprima = !pubblico;
const lingua = 'it';

const leggi = (f) => JSON.parse(readFileSync(join(RADICE, 'contenuti', lingua, f), 'utf8'));
const sito = leggi('sito.json');
const testiHome = leggi('home.json');
const servizio = leggi('servizio.json');

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
const esito = await build({
  absWorkingDir: RADICE,
  entryPoints: { sito: 'src/sito.js', apertura: 'src/apertura/apertura.js', stile: 'src/stili/sito.css' },
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
  const nome = info.entryPoint.includes('apertura') ? 'apertura' : info.entryPoint.endsWith('.css') ? 'stile' : 'sito';
  risorsa[nome] = '/' + relative(DIST, join(RADICE, file)).split('\\').join('/');
}

const base = { css: [risorsa.stile], js: [risorsa.sito] };

// 3 · pagine
scrivi('index.html', home({
  sito,
  testi: testiHome,
  anteprima,
  risorse: {
    ...base,
    js: [risorsa.sito, risorsa.apertura],
    precarica: ['<link rel="preload" href="/film/film.json" as="fetch" crossorigin>'],
    turnstile: process.env.TURNSTILE_SITE_KEY || '',
  },
}));
scrivi('grazie/index.html', semplice({ sito, testi: servizio.grazie, percorso: '/grazie/', risorse: base }));
scrivi('404.html', semplice({ sito, testi: servizio.non_trovata, percorso: '/404', risorse: base }));

// 4 · icona e logo per Google, dal vettoriale approvato
const svg = (nome, colore) => readFileSync(join(RADICE, 'brand/logo', `endero-${nome}.svg`), 'utf8').replace(/currentColor/g, colore);
scrivi('favicon.svg', svg('simbolo', '#0f285e'));
scrivi('logo.svg', svg('completo', '#0f285e'));

// 5 · file per i motori di ricerca. In anteprima il sito resta chiuso.
const pagine = ['/'];
scrivi('robots.txt', anteprima
  ? 'User-agent: *\nDisallow: /\n'
  : `User-agent: *\nAllow: /\n\nSitemap: ${sito.dominio}/sitemap.xml\n`);
scrivi('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pagine.map((p) => `  <url><loc>${sito.dominio}${p}</loc></url>`).join('\n')}
</urlset>
`);

// 6 · intestazioni per Cloudflare: cache lunga per i file con l'impronta, sicurezza per tutti
scrivi('_headers', `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
${anteprima ? '  X-Robots-Tag: noindex, nofollow\n' : ''}
/risorse/*
  Cache-Control: public, max-age=31536000, immutable

/font/*
  Cache-Control: public, max-age=31536000, immutable

/film/*
  Cache-Control: public, max-age=604800
`);

console.log(`sito generato in dist/ (${anteprima ? 'anteprima, non indicizzabile' : 'pubblico'}) in ${Math.round(performance.now() - inizio)} ms`);
for (const [nome, file] of Object.entries(risorsa)) console.log(`  ${nome.padEnd(9)} ${file}`);
