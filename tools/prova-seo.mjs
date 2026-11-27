// Controllo SEO del sito generato: guarda i file di dist/ come li vedrà Google, senza aprire un browser.
//
//   node tools/prova-seo.mjs            costruisce il sito "pubblico" in una cartella a parte e lo controlla
//   node tools/prova-seo.mjs <cartella> controlla una cartella già costruita (per esempio dist/)
//
// Due elenchi. Gli ERRORI sono difetti nostri: titoli doppi, pagine senza descrizione, link rotti, dati
// strutturati sbagliati, pagine fuori dalla mappa. Con anche un solo errore il comando esce con 1.
// Le cose DA CHIUDERE PRIMA DELLA MESSA ONLINE non sono difetti: sono ciò che aspetta una risposta di Endero
// (i testi tra [[ ]], gli orari, i profili social) o un lavoro non ancora fatto (l'ordine del configuratore).
// Finché ce ne sono il sito resta in anteprima.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, statSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RADICE = join(dirname(fileURLToPath(import.meta.url)), '..');
let cartella = process.argv[2];
let daTogliere = '';
if (!cartella) {
  // la versione pubblica si costruisce in dist/ e si copia da parte; poi torna il dist/ di prima, così com'era.
  // Non si ricostruisce: senza le variabili del build di prima (TURNSTILE_SITE_KEY, URL_ANTEPRIMA) i moduli
  // uscivano senza antispam e, pubblicati così, il Worker li rifiutava tutti (2026-11-25).
  const DIST = join(RADICE, 'dist'), PRIMA = join(RADICE, '.dist-prima-seo');
  rmSync(PRIMA, { recursive: true, force: true });
  const cera = existsSync(DIST);
  if (cera) renameSync(DIST, PRIMA);
  try {
    execFileSync('node', ['build/costruisci.mjs', '--pubblico'], { cwd: RADICE, stdio: 'ignore' });
    daTogliere = mkdtempSync(join(tmpdir(), 'endero-seo-'));
    cartella = join(daTogliere, 'dist');
    cpSync(DIST, cartella, { recursive: true });
  } finally {
    rmSync(DIST, { recursive: true, force: true });
    if (cera) renameSync(PRIMA, DIST);
    else execFileSync('node', ['build/costruisci.mjs'], { cwd: RADICE, stdio: 'ignore' });
  }
}

const errori = [], daChiudere = [], note = [];
let controlli = 0;
const vero = (cosa, ok, dettaglio = '') => { controlli++; if (!ok) errori.push(cosa + (dettaglio ? `: ${dettaglio}` : '')); };
const chiudi = (cosa) => { if (!daChiudere.includes(cosa)) daChiudere.push(cosa); };
const leggi = (f) => readFileSync(join(cartella, f), 'utf8');
const senzaTag = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
const attr = (tag, nome) => (tag.match(new RegExp(`\\b${nome}="([^"]*)"`)) || [])[1];

// ---------------------------------------------------------------- le pagine
const pagine = [];
(function cerca(dove, percorso) {
  for (const nome of readdirSync(dove)) {
    const file = join(dove, nome);
    if (statSync(file).isDirectory()) cerca(file, `${percorso}${nome}/`);
    else if (nome === 'index.html') pagine.push({ percorso, html: readFileSync(file, 'utf8') });
  }
})(cartella, '/');
pagine.sort((a, b) => a.percorso.localeCompare(b.percorso));
const dominio = (leggi('index.html').match(/<link rel="canonical" href="(https?:\/\/[^/"]+)/) || [])[1] || '';
const pubblico = !/<meta name="robots" content="noindex/.test(leggi('index.html'));
vero('la pagina iniziale ha un indirizzo canonico', Boolean(dominio));

const esiste = (indirizzo) => {
  const p = indirizzo.split('#')[0].split('?')[0];
  if (p === '') return true;
  const file = join(cartella, decodeURIComponent(p));
  return existsSync(file) && (statSync(file).isFile() || existsSync(join(file, 'index.html')));
};
const mappa = leggi('sitemap.xml');
const inMappa = [...mappa.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const titoli = new Map(), descrizioni = new Map();
// Regola del progetto: mai «dal 1996» e «fatto in Italia» nella stessa frase (insieme direbbero una cosa che Endero
// non ha confermato). Si guarda frase per frase: titolo, descrizione, e ogni paragrafo, titolo e voce di elenco.
const frasi = (testo) => testo.split(/(?<=[.!?])\s+/);
const insieme = (testo) => frasi(testo).filter((f) => /1996/.test(f) && /fatt[oaie] in Italia/i.test(f));

for (const p of pagine) {
  const { html, percorso } = p;
  const testa = html.slice(0, html.indexOf('</head>'));
  const corpo = html.slice(html.indexOf('<body'));
  const servizio = /<meta name="robots" content="noindex/.test(testa) && pubblico;      // /grazie/: fuori da Google per scelta
  const chi = `${percorso}`;
  const titolo = senzaTag((testa.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '');
  const descrizione = attr(testa.match(/<meta name="description"[^>]*>/)?.[0] || '', 'content') || '';
  vero(`${chi} ha un titolo`, titolo.length >= 10, titolo);
  vero(`${chi} ha una descrizione`, descrizione.length >= 30, descrizione);
  vero(`${chi} dichiara la lingua`, /<html lang="it"/.test(html));
  vero(`${chi} si adatta al telefono`, /<meta name="viewport"/.test(testa));
  const h1 = [...corpo.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => senzaTag(m[1]));
  vero(`${chi} ha un solo titolo principale`, h1.length === 1 && h1[0].length > 2, JSON.stringify(h1));
  // i titoli non saltano livelli: dopo un h2 non viene un h4
  const livelli = [...corpo.matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]));
  vero(`${chi} non salta livelli di titolo`, livelli.every((l, i) => i === 0 || l - livelli[i - 1] <= 1), livelli.join(' '));
  if (servizio) { vero(`${chi} non sta nella mappa del sito`, !inMappa.includes(dominio + percorso)); continue; }

  // ---- testa: titolo, descrizione, canonico, lingue, anteprima per i social
  vero(`${chi}: titolo entro 60 caratteri`, titolo.length <= 60, `${titolo.length}: ${titolo}`);
  vero(`${chi}: descrizione tra 70 e 160 caratteri`, descrizione.length >= 70 && descrizione.length <= 160, `${descrizione.length}`);
  vero(`${chi}: il titolo nomina Endero`, /endero/i.test(titolo), titolo);
  if (titoli.has(titolo)) vero(`${chi}: titolo diverso dalle altre pagine`, false, `uguale a ${titoli.get(titolo)}`); else { controlli++; titoli.set(titolo, percorso); }
  if (descrizioni.has(descrizione)) vero(`${chi}: descrizione diversa dalle altre pagine`, false, `uguale a ${descrizioni.get(descrizione)}`); else { controlli++; descrizioni.set(descrizione, percorso); }
  const canonico = attr(testa.match(/<link rel="canonical"[^>]*>/)?.[0] || '', 'href');
  vero(`${chi}: indirizzo canonico giusto`, canonico === dominio + percorso, canonico);
  vero(`${chi}: versione italiana dichiarata`, new RegExp(`<link rel="alternate" hreflang="it" href="${dominio + percorso}"`).test(testa));
  vero(`${chi}: icone del sito (quadrata per Google, .ico, PNG, iPhone)`, ['<link rel="icon" href="/favicon.ico"', '<link rel="icon" href="/favicon.svg"', '<link rel="icon" href="/icona-192.png"', '<link rel="apple-touch-icon" href="/icona-180.png"'].every((x) => testa.includes(x)));
  if (pubblico) vero(`${chi}: Google può mostrare le foto grandi`, /<meta name="robots" content="[^"]*max-image-preview:large/.test(testa));
  const og = (nome) => attr(testa.match(new RegExp(`<meta property="og:${nome}"[^>]*>`))?.[0] || '', 'content');
  const legale = ['/privacy/', '/cookie/', '/condizioni-di-vendita/'].includes(percorso);
  vero(`${chi}: titolo e descrizione per i social`, og('title') === titolo && og('description') === descrizione);
  const pezzi = [titolo, descrizione, ...[...corpo.matchAll(/<(p|h[1-6]|li|dd|summary|figcaption)\b[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => senzaTag(m[2]))];
  vero(`${chi}: mai «dal 1996» e «fatto in Italia» nella stessa frase`, pezzi.every((x) => insieme(x).length === 0), pezzi.flatMap(insieme).join(' | '));
  vero(`${chi}: la camicia del configuratore non è più «in 3D»`, !/\bin 3D\b/i.test(descrizione + ' ' + senzaTag(corpo)));
  if (!legale) {
    const immagine = og('image') || '';
    vero(`${chi}: ha un'immagine di anteprima che esiste`, immagine.startsWith(dominio + '/') && esiste(immagine.slice(dominio.length)), immagine);
    vero(`${chi}: l'anteprima è 1200 x 630 e lo dichiara`, Number(og('image:width')) === 1200 && Number(og('image:height')) === 630, `${og('image:width')} x ${og('image:height')}`);
    vero(`${chi}: l'anteprima pesa meno di 300 KB (oltre, WhatsApp può non mostrarla)`, esiste(immagine.slice(dominio.length)) && statSync(join(cartella, immagine.slice(dominio.length))).size < 300000);
    vero(`${chi}: l'anteprima ha una descrizione`, (og('image:alt') || '').length > 8);
    vero(`${chi}: scheda grande su X e simili`, /<meta name="twitter:card" content="summary_large_image">/.test(testa) && /<meta name="twitter:image"/.test(testa));
  }

  // ---- dati strutturati
  const blocchi = [...testa.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  let nodi = [];
  try { for (const b of blocchi) { const j = JSON.parse(b); nodi.push(...(Array.isArray(j) ? j : j['@graph'] || [j])); } } catch (e) { vero(`${chi}: dati strutturati leggibili`, false, String(e)); }
  if (!legale) {
    const tipo = (t) => nodi.filter((n) => n['@type'] === t);
    const TIPI_PAGINA = ['WebPage', 'AboutPage', 'ContactPage', 'CollectionPage', 'ItemPage', 'FAQPage'];
    const pagina = nodi.find((n) => TIPI_PAGINA.includes(n['@type']) && n.url === dominio + percorso);
    vero(`${chi}: un solo nodo descrive la pagina`, nodi.filter((n) => TIPI_PAGINA.includes(n['@type'])).length === 1, nodi.filter((n) => TIPI_PAGINA.includes(n['@type'])).map((n) => n['@type']).join(' '));
    vero(`${chi}: il nome della pagina nei dati è il suo titolo`, pagina?.name === titolo, pagina?.name);
    const logo = (nodi.find((n) => n['@type'] === 'Organization') || {}).logo || '';
    vero(`${chi}: il logo per Google è un'immagine con le sue misure (PNG), e c'è`, /\.png$/.test(logo) && esiste(logo.slice(dominio.length)), logo);
    vero(`${chi}: dati di organizzazione, sito e sede`, tipo('Organization').length === 1 && tipo('WebSite').length === 1 && tipo('ClothingStore').length === 1);
    vero(`${chi}: la pagina si descrive (nome, descrizione, sito, lingua)`, Boolean(pagina && pagina.name && pagina.description === descrizione && pagina.isPartOf && pagina.inLanguage === 'it-IT'), JSON.stringify(pagina || {}).slice(0, 120));
    const sede = tipo('ClothingStore')[0] || {};
    vero(`${chi}: la sede ha indirizzo completo, telefono, foto e mappa`, Boolean(sede.address?.streetAddress && sede.address?.postalCode && sede.address?.addressLocality && sede.telephone && sede.image && esiste(sede.image.slice(dominio.length)) && sede.hasMap));
    if (percorso !== '/') {
      const briciole = tipo('BreadcrumbList')[0];
      const voci = briciole?.itemListElement || [];
      vero(`${chi}: briciole dalla pagina iniziale a qui`, voci.length >= 2 && voci[0].item === dominio + '/' && voci.at(-1).item === dominio + percorso && voci.every((v, i) => v.position === i + 1 && v.name && esiste(v.item.slice(dominio.length))) && pagina?.breadcrumb?.['@id'] === briciole?.['@id'], JSON.stringify(voci.map((v) => v.name)));
    }
    // ogni riferimento interno ai dati punta a un nodo che c'è
    const ids = new Set(nodi.map((n) => n['@id']).filter(Boolean));
    const riferimenti = JSON.stringify(nodi).match(/\{"@id":"[^"]+"\}/g) || [];
    vero(`${chi}: i riferimenti dentro i dati strutturati tornano`, riferimenti.every((r) => ids.has(JSON.parse(r)['@id'])), riferimenti.filter((r) => !ids.has(JSON.parse(r)['@id'])).join(' '));
    for (const f of tipo('FAQPage')) vero(`${chi}: le domande frequenti hanno domanda e risposta, senza segnaposto`, f.mainEntity.length >= 2 && f.mainEntity.every((q) => q.name && q.acceptedAnswer?.text && !/\[\[/.test(q.name + q.acceptedAnswer.text)));
    for (const s of tipo('Service')) vero(`${chi}: il servizio «${s.name}» ha nome, descrizione e chi lo offre`, Boolean(s.name && s.description && s.provider?.['@id']));
    for (const c of tipo('CollectionPage')) if (c.image) {
      vero(`${chi}: le foto dichiarate esistono e hanno una descrizione`, c.image.length > 0 && c.image.every((i) => i.caption && esiste(i.contentUrl.slice(dominio.length))));
      // ogni foto ha un indirizzo solo: quello della pagina, impronta compresa
      const altrove = c.image.map((i) => i.contentUrl.slice(dominio.length)).filter((u) => !corpo.includes(`"${u}"`));
      vero(`${chi}: le foto dichiarate hanno lo stesso indirizzo che hanno nella pagina`, altrove.length === 0, altrove.slice(0, 3).join(' '));
    }
    for (const pr of tipo('Product')) vero(`${chi}: il capo ha nome, marchio e prezzo (senza, Google lo segna incompleto)`, Boolean(pr.name && pr.brand && pr.offers?.price && pr.offers?.priceCurrency === 'EUR'));
    if (!sede.openingHoursSpecification) chiudi('Orari della sede: mancano sul sito e nei dati per Google (sito.json, "orari").');
    if (!(tipo('Organization')[0] || {}).sameAs) chiudi('Profili social (Instagram e altri): mancano i link (sito.json, "social").');
  }

  // ---- corpo: link, immagini, segnaposto
  const link = [...corpo.matchAll(/<a\b[^>]*\bhref="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)];
  const rotti = link.map((m) => m[1]).filter((h) => h.startsWith('/') && !esiste(h));
  vero(`${chi}: nessun link interno rotto`, rotti.length === 0, [...new Set(rotti)].join(' '));
  const ancore = link.map((m) => m[1]).filter((h) => h.startsWith('#') && h.length > 1 && !new RegExp(`\\bid="${h.slice(1)}"`).test(corpo));
  vero(`${chi}: nessuna ancora che non porta da nessuna parte`, ancore.length === 0, [...new Set(ancore)].join(' '));
  // il testo di un link dice dove porta: un numero attaccato in fondo («Maglieria20») lo sporca
  const sporchi = link.filter((m) => /[a-zà-ù]\d+\s*$/i.test(m[2].replace(/<[^>]+>/g, ''))).map((m) => senzaTag(m[2]));
  vero(`${chi}: nessun link con un numero attaccato al nome`, sporchi.length === 0, sporchi.join(' · '));
  p.link = link.map((m) => m[1].split('#')[0]);
  const muti = link.filter((m) => !senzaTag(m[2]) && !/aria-label="[^"]+"/.test(m[0]) && !/<img\b[^>]*\balt="[^"]+"/.test(m[2])).map((m) => m[1]);
  vero(`${chi}: ogni link ha un nome`, muti.length === 0, muti.join(' '));
  const immagini = [...corpo.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]).filter((i) => !/data-visore-img/.test(i));
  const senzaAlt = immagini.filter((i) => !/\balt="[^"]+"/.test(i));
  vero(`${chi}: ogni immagine ha la sua descrizione`, senzaAlt.length === 0, senzaAlt.map((i) => attr(i, 'src')).join(' '));
  const senzaMisure = immagini.filter((i) => !/\bwidth="\d+"/.test(i) || !/\bheight="\d+"/.test(i));
  vero(`${chi}: ogni immagine dichiara le sue misure (la pagina non salta mentre carica)`, senzaMisure.length === 0, senzaMisure.map((i) => attr(i, 'src')).join(' '));
  const mancanti = immagini.map((i) => attr(i, 'src')).filter((s) => s && s.startsWith('/') && !esiste(s));
  vero(`${chi}: nessuna immagine mancante`, mancanti.length === 0, mancanti.join(' '));
  vero(`${chi} sta nella mappa del sito`, inMappa.includes(dominio + percorso));
  // la foto più grande della prima schermata non aspetta: nelle pagine di categoria è la prima del lookbook
  if (/pagina-categoria/.test(html)) vero(`${chi}: la prima foto si carica subito`, /fetchpriority="high"/.test((corpo.match(/<ul class="lookbook__griglia">[\s\S]*?<img\b[^>]*>/) || [''])[0].match(/<img\b[^>]*>$/)?.[0] || ''));
  const parole = senzaTag(corpo.replace(/<script[\s\S]*?<\/script>|<svg[\s\S]*?<\/svg>|<dialog[\s\S]*?<\/dialog>|<footer[\s\S]*?<\/footer>|<header class="testata"[\s\S]*?<\/header>/g, ' ')).split(' ').length;
  p.parole = parole;
  const segnaposto = [...corpo.replace(/<footer[\s\S]*?<\/footer>/, '').matchAll(/class="da-confermare">([^<]*)/g)].map((m) => senzaTag(m[1]));
  if (segnaposto.length) chiudi(`${percorso}: ${segnaposto.length} testi da confermare (${[...new Set(segnaposto)].slice(0, 4).join(' · ')}${new Set(segnaposto).size > 4 ? ' …' : ''}).`);
  if (/class="attesa/.test(corpo)) chiudi(`${percorso}: ci sono ancora riquadri «Foto in arrivo».`);
  if (/data-non-invia/.test(corpo)) chiudi(`${percorso}: il modulo non invia ancora l'ordine (il configuratore è al passo 1).`);
}

// ---------------------------------------------------------------- piè di pagina, mappa, robots, reindirizzamenti
const piede = (leggi('index.html').match(/<footer[\s\S]*?<\/footer>/) || [''])[0];
for (const s of [...piede.matchAll(/class="da-confermare">([^<]*)/g)].map((m) => senzaTag(m[1]))) chiudi(`Piè di pagina, in tutte le pagine: «${s}».`);
vero('la mappa del sito elenca solo pagine che esistono', inMappa.every((u) => u.startsWith(dominio + '/') && esiste(u.slice(dominio.length))), inMappa.filter((u) => !esiste(u.slice(dominio.length))).join(' '));
vero('la mappa del sito non ripete indirizzi', new Set(inMappa).size === inMappa.length);
const fotoMappa = [...mappa.matchAll(/<image:loc>([^<]+)<\/image:loc>/g)].map((m) => m[1]);
vero('la mappa del sito porta le foto, e le foto esistono', fotoMappa.length >= 40 && fotoMappa.every((u) => esiste(u.slice(dominio.length))), `${fotoMappa.length} foto`);
const tutteLePagine = pagine.map((p) => p.html).join('\n');
const soloInMappa = fotoMappa.map((u) => u.slice(dominio.length)).filter((u) => !tutteLePagine.includes(`src="${u}"`));
vero('nella mappa ogni foto ha lo stesso indirizzo che ha nella sua pagina', soloInMappa.length === 0, soloInMappa.slice(0, 3).join(' '));
// le misure si chiamano allo stesso modo ovunque: nel riquadro del configuratore e nella scheda del su misura (se un
// nome cambia, per esempio «Taglia» in «Giro collo», cambia in tutti e due)
const htmlDi = (percorso) => pagine.find((p) => p.percorso === percorso)?.html || '';
const configuratore = htmlDi('/camicie-su-misura/configuratore/');
const nelRiquadro = [...(configuratore.slice(configuratore.indexOf('configura__gruppo--misure')).split('</fieldset>')[0] || '').matchAll(/<label class="misura__nome"[^>]*>([^<]+)<\/label>/g)].map((m) => senzaTag(m[1]));
{
  const html = htmlDi('/camicie-su-misura/');
  const nellaScheda = [...(html.slice(html.indexOf('class="vetro scheda-misure')).split('</section>')[0] || '').matchAll(/<dt>([^<]+)<\/dt>/g)].map((m) => senzaTag(m[1]));
  vero('/camicie-su-misura/: la scheda misure ha le stesse voci del configuratore', nelRiquadro.length >= 10 && nellaScheda.join('|') === nelRiquadro.join('|'), nellaScheda.filter((v) => !nelRiquadro.includes(v)).join(', ') || `${nellaScheda.length} voci contro ${nelRiquadro.length}`);
}
// la scheda della pagina iniziale (2026-11-27) dice quanto si sceglie nel configuratore: i numeri devono essere quelli
// veri. Colli e misure contati nella pagina del configuratore, i tessuti in tessuti.json («oltre» la decina sotto)
{
  const home = htmlDi('/');
  const scheda = (home.slice(home.indexOf('class="vetro scheda-misure scheda-misure--camicia personalizza"')).split('</section>')[0] || '');
  // dentro il solo riquadro (un riquadro senza numero non prende quello del riquadro dopo); il punto delle migliaia via
  const riquadro = (classe) => (scheda.split(`personalizza__riquadro--${classe}"`)[1] || '').split('</li>')[0];
  const numero = (classe) => Number(((riquadro(classe).match(/personalizza__numero">([\d.]+)</) || [])[1] || '0').replace(/\./g, ''));
  const conf = (() => { try { return JSON.parse(readFileSync(join(RADICE, 'contenuti/it/configuratore.json'), 'utf8')); } catch { return {}; } })();
  const campi = conf.scheda?.camicia?.campi || [];
  const colli = (campi.find((x) => x.nome === 'collo')?.opzioni || []).map((o) => o.nome.toLowerCase());
  const posizioni = (campi.find((x) => x.nome === 'iniziali')?.se_si?.[0]?.opzioni || []).map((o) => o.nome.toLowerCase());
  const colliVeri = (configuratore.match(/<select[^>]*name="collo"[\s\S]*?<\/select>/) || [''])[0].match(/<option value="[^"]+"/g)?.length || 0;
  const elenco = (() => { try { return JSON.parse(readFileSync(join(RADICE, 'contenuti/it/tessuti.json'), 'utf8')).tessuti; } catch { return []; } })();
  const tessutiVeri = elenco.length;
  vero('/: la scheda del su misura conta i colli del configuratore', colliVeri >= 2 && numero('colli') === colliVeri, `${numero('colli')} contro ${colliVeri}`);
  vero('/: la scheda del su misura conta le misure del configuratore', numero('misure') === nelRiquadro.length, `${numero('misure')} contro ${nelRiquadro.length}`);
  vero('/: «oltre» un numero di tessuti più piccolo di quelli veri, di non più di dieci (sotto i 20 nessun numero)',
    tessutiVeri < 20 ? numero('tessuti') === 0 : numero('tessuti') < tessutiVeri && tessutiVeri - numero('tessuti') <= 10, `${numero('tessuti')} su ${tessutiVeri}`);
  // i campioni: tutti quelli scelti in home.json, ognuno un tessuto che nel configuratore c'è davvero
  const scelti = (() => { try { return JSON.parse(readFileSync(join(RADICE, 'contenuti/it/home.json'), 'utf8')).porta_su_misura.scelte.campioni; } catch { return []; } })();
  const alt = [...riquadro('tessuti').matchAll(/<img\b[^>]*\balt="([^"]*)"/g)].map((m) => m[1]);
  vero('/: nella scheda ci sono tutti i campioni scelti, con il nome di un tessuto vero', scelti.length >= 3 && alt.length === scelti.length && alt.every((a) => elenco.some((x) => x.nome === a)), `${alt.length} su ${scelti.length}: ${alt.join(', ')}`);
  // le righe scritte a mano citano opzioni che il configuratore ha davvero (se un collo esce, la riga va cambiata)
  const parole = senzaTag(riquadro('colli') + riquadro('iniziali')).toLowerCase();
  const citati = [...['francese', 'coreano'].filter((n) => parole.includes(n) && !colli.includes(n)), ...['polso', 'collo', 'cuore'].filter((n) => parole.includes(`sul ${n}`) && !posizioni.some((x) => x.includes(n)))];
  vero('/: le righe della scheda citano colli e posizioni delle iniziali che il configuratore ha davvero', citati.length === 0, citati.join(', '));
}
// nessun segnaposto rimasto con le parentesi: nel testo visibile i [[ ]] diventano il giallo da confermare
for (const p of pagine) {
  const visibile = senzaTag(p.html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ''));
  vero(`${p.percorso}: nessun segnaposto [[ ]] rimasto con le parentesi`, !/\[\[|\]\]/.test(visibile), (visibile.match(/.{0,40}(\[\[|\]\]).{0,40}/) || [''])[0]);
}
// i dati della società: piè di pagina (in tutte le pagine), informativa privacy e dati per Google dicono la stessa cosa
const iva = (piede.match(/Partita IVA (\d{11})/) || [])[1] || '';
const privacy = htmlDi('/privacy/');
const organizzazione = (() => { try { return JSON.parse(leggi('index.html').match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])['@graph'].find((n) => n['@type'] === 'Organization') || {}; } catch { return {}; } })();
// come lo legge chi ascolta la pagina: senza le parti nascoste ai lettori di schermo, e con gli spazi veri
const testoPiede = senzaTag(piede.replace(/<span[^>]*aria-hidden="true"[^>]*>[^<]*<\/span>/g, '')).replace(/\u00a0/g, ' ');
vero('nel piè di pagina il nome della società non va a capo e si legge staccato dalla partita IVA', /Endero(&nbsp;|\u00a0)S\.r\.l\.s\./.test(piede) && /S\.r\.l\.s\. Partita IVA/.test(testoPiede), testoPiede.slice(-80));
vero('il piè di pagina ha ragione sociale e partita IVA, le stesse dei dati per Google', Boolean(iva) && Boolean(organizzazione.legalName) && testoPiede.includes(organizzazione.legalName), testoPiede.slice(-120));
vero('l\'informativa privacy ha la stessa società e la stessa partita IVA del piè di pagina', Boolean(iva) && privacy.includes(`partita IVA ${iva}`) && Boolean(organizzazione.legalName) && senzaTag(privacy).includes(organizzazione.legalName));
vero('i dati per Google hanno ragione sociale e partita IVA', organizzazione.vatID === `IT${iva}` && Boolean(organizzazione.legalName));
for (const percorso of ['/privacy/', '/cookie/']) vero(`${percorso}: non è più una bozza`, !/legale__avviso|[Bb]ozza/.test(htmlDi(percorso)) && !/\{\{|\}\}/.test(htmlDi(percorso)));
// l'antispam dei moduli è stato deciso (Cloudflare Turnstile): senza la sua chiave nel build, i moduli non lo hanno
if (!/data-turnstile/.test(htmlDi('/camicie-su-misura/'))) chiudi('Antispam dei moduli (Cloudflare Turnstile): il build pubblico va fatto con TURNSTILE_SITE_KEY, e il Worker con TURNSTILE_SECRET. Allora l\'informativa lo nomina da sé.');
// le pagine di categoria si raggiungono dalla pagina iniziale e dalla collezione
const categorie = pagine.filter((p) => /pagina-categoria/.test(p.html)).map((p) => p.percorso);
for (const da of ['/', '/collezione/']) {
  const sue = pagine.find((p) => p.percorso === da)?.link || [];
  vero(`${da} porta a tutte le pagine di categoria`, categorie.length >= 4 && categorie.every((c) => sue.includes(c)), categorie.filter((c) => !sue.includes(c)).join(' '));
}
vero('la mappa del sito dice quando sono cambiate le pagine', (mappa.match(/<lastmod>\d{4}-\d\d-\d\d<\/lastmod>/g) || []).length >= inMappa.length - 1);
const robots = leggi('robots.txt');
if (pubblico) vero('robots.txt apre il sito e indica la mappa', /Allow: \//.test(robots) && robots.includes(`Sitemap: ${dominio}/sitemap.xml`) && !/Disallow: \/\s*$/m.test(robots));
else vero('in anteprima robots.txt chiude il sito', /Disallow: \/\s*$/m.test(robots));
const reindirizzamenti = leggi('_redirects').trim().split('\n').map((r) => r.split(/\s+/));
vero('ogni vecchio indirizzo porta a una pagina che esiste, per sempre', reindirizzamenti.length >= 10 && reindirizzamenti.every(([da, a, come]) => da.startsWith('/') && esiste(a) && come === '301' && !esiste(da)), JSON.stringify(reindirizzamenti.filter(([da, a]) => !esiste(a) || esiste(da))));
vero('c\'è la pagina «non trovata»', existsSync(join(cartella, '404.html')) && /noindex/.test(leggi('404.html')));
vero('il sito che oggi risponde su endero.it ha una pagina /configuratore/: porta al nostro configuratore', reindirizzamenti.some(([da, a]) => da === '/configuratore/' && a === '/camicie-su-misura/configuratore/'));
const icona = existsSync(join(cartella, 'favicon.svg')) ? leggi('favicon.svg') : '';
const quadro = (icona.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/) || []).slice(1).map(Number);
vero('l\'icona del sito è quadrata (Google la mostra nei risultati solo così)', quadro.length === 2 && quadro[0] === quadro[1], quadro.join(' x '));
vero('icone e logo per Google ci sono', ['favicon.svg', 'favicon.ico', 'icona-192.png', 'icona-180.png', 'logo-endero.png', 'logo.svg'].every((f) => existsSync(join(cartella, f))));
// pagine con poco testo: non è un errore, ma Google le considera deboli
for (const p of pagine) if (p.parole !== undefined && p.parole < 150) note.push(`${p.percorso} ha poco testo (${p.parole} parole): regge sulle foto e sui dati, ma più avanti le serve più contenuto.`);
if (!pubblico) note.push('Questa è la versione di anteprima (non indicizzabile): per il controllo vero lanciare il comando senza argomenti.');

if (daTogliere) rmSync(daTogliere, { recursive: true, force: true });
console.log(`${pagine.length} pagine, ${controlli} controlli (${pubblico ? 'versione pubblica' : 'anteprima'})\n`);
console.log(errori.length ? `ERRORI (${errori.length})\n${errori.map((e) => ' - ' + e).join('\n')}` : 'Nessun errore.');
console.log(`\nDA CHIUDERE PRIMA DELLA MESSA ONLINE (${daChiudere.length})\n${daChiudere.map((e) => ' - ' + e).join('\n') || ' - niente'}`);
if (note.length) console.log(`\nNOTE\n${note.map((e) => ' - ' + e).join('\n')}`);
process.exit(errori.length ? 1 : 0);
