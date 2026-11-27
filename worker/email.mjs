// Le email dei moduli (proprietario, 2026-11-24). A Endero arriva ogni richiesta salvata dal sito; chi l'ha mandata
// riceve una conferma breve, se ha lasciato l'email. Si mandano con Resend (https://resend.com) dal dominio
// endero.men; i testi stanno in contenuti/it/email.json.
//
// Aspetto (proprietario, 2026-11-25: «Con una foto», «invece di mettere il numero WA inserisci un tasto»): in cima la
// foto del tipo di richiesta con il logo (public/email/, fatte da tools/immagini-email.js), poi il testo, il
// riepilogo e i tasti; in fondo la fascia blu con sede, WhatsApp e Instagram. È HTML da email: tabelle e stili
// scritti su ogni elemento, perché molti programmi di posta ignorano il resto. Senza immagini resta tutto leggibile.
//
// Segreti del Worker, mai nel repository: RESEND_API_KEY (la chiave di Resend) ed EMAIL_DESTINATARIO (la casella di
// Endero che riceve le richieste; più indirizzi separati da virgole). Variabili (wrangler.toml): EMAIL_MITTENTE
// ("Endero <noreply@endero.men>") ed EMAIL_RISPOSTE (dove rispondono i clienti alla conferma: info@endero.men).
// Senza chiave o senza destinatario non parte nulla: la richiesta resta comunque salvata nel database.
//
// Questo file non è il punto d'ingresso del Worker: può esportare anche costanti (vedi CLAUDE.md, 2026-11-20).

import testi from '../contenuti/it/email.json';
import rivenditori from '../contenuti/it/diventa-rivenditore.json';
import sito from '../contenuti/it/sito.json';
import configuratore from '../contenuti/it/configuratore.json';
import catalogo from '../contenuti/it/tessuti.json';
import { numeroInternazionale, controlla } from '../src/controlli.mjs';

const BLU = '#0f285e', CARTA = '#faf9f7', PANNELLO = '#eceae5', FILO = '#fbf9f4', TENUE = '#5b6b8c';
const CARATTERE = `'Archivo', 'Helvetica Neue', Helvetica, Arial, sans-serif`;
// le immagini hanno la versione nel nome (testata-contatto-1.jpg): se si rifanno, si cambia numero e si tengono i file
// vecchi in public/email/, che le email già mandate continuano a mostrare (il sito non distingue «?v=»)
const VERSIONE_IMMAGINI = 1;
const TIPI = ['contatto', 'presa-misure', 'rivenditore'];

const pulisci = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const riempi = (modello, valori) => modello.replace(/\{(\w+)\}/g, (_, k) => valori[k] ?? '');
// nelle intestazioni (oggetto, nomi) niente a capo né caratteri di controllo, e al più 160 caratteri. Se è più lunga
// (l'oggetto dell'ordine con tante variazioni di taglia) si taglia a una voce intera e si chiude con «…», non a metà
// di una misura con un «·» rimasto in fondo (l'ordine di prova del 2026-11-27); la riga intera è nel testo
const inRiga = (v) => {
  const s = String(v ?? '').replace(/[\u0000-\u001F\u007F]+/g, ' ').trim();
  if (s.length <= 160) return s;
  const taglio = s.slice(0, 159);
  const voce = taglio.lastIndexOf(' · ');
  const fine = voce > 60 ? voce : taglio.lastIndexOf(' ') > 60 ? taglio.lastIndexOf(' ') : 159;
  return `${taglio.slice(0, fine).replace(/[\s·]+$/, '')}…`;
};
const tipoDi = (r) => (TIPI.includes(r.tipo) ? r.tipo : 'contatto');
const dominio = () => String(sito.dominio || 'https://endero.men').replace(/\/$/, '');
const immagine = (nome) => `${dominio()}/email/${nome.replace(/(\.\w+)$/, `-${VERSIONE_IMMAGINI}$1`)}`;
// nel riepilogo al cliente solo ciò che il sito ha controllato: il testo libero (messaggio, negozio, sito) no, perché
// la conferma parte verso un indirizzo che nessuno ha verificato e non deve poter portare parole o link di altri
const LIBERI = ['messaggio', 'attivita', 'profilo'];

/** Il giorno scelto per la presa misure, all'italiana: «martedì 1 dicembre 2026». */
function giornoScritto(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))) return String(s || '');
  try {
    return new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(s + 'T12:00:00Z'));
  } catch {
    return s;
  }
}

/** Il Paese da cui ci si è collegati, per nome: «IT» → «Italia». */
function paeseScritto(codice) {
  const c = String(codice || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return c;
  try {
    return new Intl.DisplayNames(['it'], { type: 'region' }).of(c) || c;
  } catch {
    return c;
  }
}

/** Giorno e ora di arrivo, all'ora italiana: «mercoledì 25 novembre alle 20:49». */
export function quando(data = new Date()) {
  try {
    const giorno = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Rome' }).format(data);
    const ora = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' }).format(data);
    return `${giorno} alle ${ora}`;
  } catch {
    return data.toISOString();
  }
}

/**
 * Le righe della richiesta, nell'ordine in cui le legge Endero: [etichetta, valore], solo quelle compilate.
 * `tecniche`: anche pagina del sito e Paese di collegamento (servono a Endero, non al cliente).
 */
export function righe(r, { tecniche = true, liberi = true } = {}) {
  const v = testi.a_endero.voci;
  const out = [];
  const metti = (etichetta, valore) => {
    const testo = Array.isArray(valore) ? valore.join(', ') : String(valore ?? '').trim();
    if (testo) out.push([etichetta, testo]);
  };
  metti(v.nome, r.nome);
  metti(v.telefono, r.telefono);
  metti(v.email, r.email);
  metti(v.giorno, giornoScritto(r.giorno));
  metti(v.fascia, r.fascia);
  // i campi propri dei rivenditori, con le etichette della loro pagina
  if (r.tipo === 'rivenditore' && r.dettagli) {
    let d = {};
    try { d = JSON.parse(r.dettagli); } catch { d = {}; }
    for (const c of rivenditori.modulo.campi) {
      if (c.nome in d && (liberi || !LIBERI.includes(c.nome))) metti(c.etichetta.replace(/\s*\(facoltativ[oa]\)\s*$/i, ''), d[c.nome]);
    }
  }
  if (liberi) metti(v.messaggio, r.messaggio);
  if (tecniche) {
    metti(v.pagina, r.pagina);
    metti(v.paese, paeseScritto(r.paese));
  }
  return out;
}

// ---------------------------------------------------------------- i pezzi dell'HTML

/**
 * Un tasto: pieno (blu) o di contorno. Una piccola tabella con il link dentro: Outlook per Windows non dà spazio
 * interno ai link, alle celle sì. Sul telefono i tasti prendono tutta la larghezza, uno sotto l'altro.
 */
function tasto(testo, href, { pieno = true } = {}) {
  const colore = pieno ? FILO : BLU;
  const fondo = pieno ? BLU : '#ffffff';
  return `<table role="presentation" class="tasto" align="left" cellpadding="0" cellspacing="0" border="0" style="margin:0 8px 10px 0;border-collapse:separate;">
      <tr><td bgcolor="${fondo}" style="border:1px solid ${BLU};border-radius:999px;background:${fondo};mso-padding-alt:15px 26px;"><a href="${pulisci(href)}" target="_blank" style="display:inline-block;padding:15px 26px;border-radius:999px;color:${colore};font-family:${CARATTERE};font-size:13px;font-weight:600;letter-spacing:0.08em;line-height:16px;text-transform:uppercase;text-decoration:none;">${pulisci(testo)}</a></td></tr>
    </table>`;
}

/** Il riquadro con le righe: etichetta piccola sopra, valore sotto (si legge bene anche sul telefono). */
function riquadro(titolo, elenco) {
  if (!elenco.length) return '';
  const voci = elenco.map(([e, v], i) => `<tr><td style="padding:${i ? '14px' : '0'} 0 0;font-family:${CARATTERE};">
      <div style="font-size:11px;line-height:16px;letter-spacing:0.08em;text-transform:uppercase;color:${TENUE};">${pulisci(e)}</div>
      <div style="padding-top:3px;font-size:15px;line-height:22px;color:${BLU};word-break:break-word;">${pulisci(v).replace(/\r?\n/g, '<br>')}</div>
    </td></tr>`).join('\n');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${CARTA}" style="border-collapse:separate;background:${CARTA};border-radius:14px;">
  <tr><td style="padding:22px 24px 24px;">
    <div style="padding-bottom:14px;margin-bottom:16px;border-bottom:1px solid ${PANNELLO};font-family:${CARATTERE};font-size:12px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:${BLU};">${pulisci(titolo)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${voci}</table>
  </td></tr></table>`;
}

/** La fascia blu in fondo: logo, sede (con il link alla mappa), WhatsApp, Instagram, il sito. */
function piede(nota) {
  const c = sito.contatti;
  const insta = (sito.social || []).find((s) => /instagram/i.test(s.nome));
  const link = (testo, href) => `<a href="${pulisci(href)}" target="_blank" style="color:${FILO};text-decoration:underline;text-underline-offset:2px;">${pulisci(testo)}</a>`;
  const contatti = [
    link(`${testi.comune.whatsapp} ${c.whatsapp}`, c.whatsapp_link),
    insta ? link(testi.comune.instagram, insta.link) : '',
    link(dominio().replace(/^https?:\/\//, ''), dominio() + '/'),
  ].filter(Boolean).join(' &nbsp;·&nbsp; ');
  return `<tr><td class="dentro" bgcolor="${BLU}" style="padding:34px 44px 30px;background:${BLU};font-family:${CARATTERE};color:${FILO};">
    <a href="${pulisci(dominio())}/" target="_blank"><img src="${immagine('logo-bianco.png')}" width="120" alt="Endero" style="display:block;width:120px;height:auto;border:0;color:${FILO};font-size:18px;font-weight:600;letter-spacing:0.08em;"></a>
    <p style="margin:20px 0 0;font-size:14px;line-height:21px;">${pulisci(c.via)}, ${pulisci(c.citta)} (${pulisci(c.provincia)})<br>${link(testi.comune.come_arrivare, c.mappa)}</p>
    <p style="margin:14px 0 0;font-size:14px;line-height:21px;">${contatti}</p>
    <p style="margin:22px 0 0;font-size:11px;line-height:17px;color:#b9c1d3;">${pulisci(sito.societa?.ragione_sociale || '')}${sito.societa?.partita_iva ? ` · P. IVA ${pulisci(sito.societa.partita_iva)}` : ''}<br>${pulisci(nota)}</p>
  </td></tr>`;
}

/** La pagina intera: testata con la foto, il contenuto, il piè di pagina. `testata` ({ src, alt }) sostituisce la
 *  foto di sempre: la camicia dell'ordine, nell'email al cliente. */
function pagina({ titolo, anteprima, tipo, corpo, nota, avviso = '', testata = null }) {
  return `<!doctype html>
<html lang="it" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${pulisci(titolo)}</title>
<style>
  body { margin: 0; padding: 0; -webkit-text-size-adjust: 100%; }
  .titolo { font-stretch: 118%; }
  /* Mail dell'iPhone trasforma da sé in link numeri e indirizzi: restano del colore del testo intorno */
  a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; font-size: inherit !important; font-family: inherit !important; font-weight: inherit !important; line-height: inherit !important; }
  @media (max-width: 620px) {
    .fuori { padding: 0 !important; }
    .scatola { border-radius: 0 !important; }
    .dentro { padding-left: 24px !important; padding-right: 24px !important; }
    .titolo { font-size: 26px !important; line-height: 32px !important; }
    .tasto { width: 100% !important; float: none !important; margin: 0 0 10px !important; }
    .tasto a { display: block !important; text-align: center !important; }
  }
</style>
<!-- il carattere del sito, dove si può: Outlook per Windows non legge le media query, e senza questa barriera
     scriverebbe tutto in Times New Roman -->
<style>
  @media screen { @font-face { font-family: 'Archivo'; src: url('${dominio()}/font/archivo-var.woff2') format('woff2'); font-weight: 100 900; font-stretch: 62% 125%; } }
</style>
<!--[if mso]><style>td, p, div, a, h1, strong { font-family: Arial, Helvetica, sans-serif !important; }</style><![endif]-->
</head>
<body style="margin:0;padding:0;background:${PANNELLO};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${pulisci(anteprima)}${'&#8199;&#847; '.repeat(90)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PANNELLO};">
<tr><td class="fuori" align="center" style="padding:32px 12px;">
  <!--[if mso]><table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
  <table role="presentation" class="scatola" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width:100%;max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden;">
    <tr><td bgcolor="${BLU}" style="background:${BLU};line-height:0;">
      <a href="${pulisci(dominio())}/" target="_blank"><img src="${pulisci(testata?.src || immagine(`testata-${tipo}.jpg`))}" width="600" alt="${pulisci(testata?.alt || testi.comune.alt_testata)}" style="display:block;width:100%;max-width:600px;height:auto;border:0;background:${BLU};color:${FILO};font-family:${CARATTERE};font-size:22px;font-weight:600;letter-spacing:0.1em;line-height:60px;text-align:center;"></a>
    </td></tr>
    ${avviso ? `<tr><td class="dentro" bgcolor="#fff3c4" style="padding:16px 44px;background:#fff3c4;font-family:${CARATTERE};font-size:15px;line-height:22px;font-weight:600;color:${BLU};">${pulisci(avviso)}</td></tr>` : ''}
    ${corpo}
    ${piede(nota)}
  </table>
  <!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`;
}

/** Il blocco di apertura: etichetta piccola, titolo grande, testo. */
function apertura(etichetta, titolo, testo) {
  return `<tr><td class="dentro" style="padding:40px 44px 26px;font-family:${CARATTERE};color:${BLU};">
    <div style="font-size:12px;font-weight:600;letter-spacing:0.12em;line-height:16px;text-transform:uppercase;color:${TENUE};">${pulisci(etichetta)}</div>
    <h1 class="titolo" style="margin:12px 0 0;font-size:30px;line-height:36px;font-weight:600;letter-spacing:-0.01em;color:${BLU};word-break:break-word;">${pulisci(titolo)}</h1>
    ${testo ? `<p style="margin:14px 0 0;font-size:16px;line-height:25px;color:${BLU};">${pulisci(testo)}</p>` : ''}
  </td></tr>`;
}

// ---------------------------------------------------------------- le due email

/** L'email per Endero: chi ha scritto, i tasti per rispondergli, tutta la richiesta. Chi risponde, risponde al cliente. */
export function perEndero(r, { arrivo = new Date() } = {}) {
  const t = testi.a_endero;
  const tipo = t.tipi[r.tipo] || t.tipi.contatto;
  const elenco = righe(r);
  const nome = inRiga(r.nome);
  let dettagli = {};
  try { dettagli = JSON.parse(r.dettagli || '{}'); } catch { dettagli = {}; }
  const numero = numeroInternazionale(r.telefono, r.tipo === 'rivenditore' ? dettagli.nazione : '');
  // WhatsApp solo per i cellulari: un fisso italiano (39 e poi 0) su WhatsApp di solito non c'è
  const wa = numero && !/^390/.test(numero) ? numero : '';
  // l'indirizzo nel link mailto, codificato: nessun carattere può aggiungere destinatari
  const mailto = r.email ? r.email.split('@').map(encodeURIComponent).join('@') : '';
  const nota = r.email ? riempi(t.rispondi, { email: r.email }) : t.senza_email;
  const arrivata = riempi(t.arrivata, { quando: quando(arrivo) });
  const tasti = [
    wa ? tasto(t.tasti.whatsapp, `https://wa.me/${wa}?text=${encodeURIComponent(riempi(t.whatsapp_testo, { nome: nome.split(' ')[0] }))}`) : '',
    numero ? tasto(t.tasti.chiama, `tel:+${numero}`, { pieno: !wa }) : '',
    mailto ? tasto(t.tasti.email, `mailto:${mailto}?subject=${encodeURIComponent(`Endero · ${tipo}`)}`, { pieno: !numero }) : '',
  ].join('\n');
  const corpo = `${apertura(riempi(t.etichetta, { tipo }), nome, arrivata)}
    ${tasti ? `<tr><td class="dentro" style="padding:0 44px 18px;">${tasti}</td></tr>` : ''}
    <tr><td class="dentro" style="padding:6px 44px 0;">${riquadro(t.dati, elenco)}</td></tr>
    <tr><td class="dentro" style="padding:18px 44px 38px;font-family:${CARATTERE};font-size:13px;line-height:20px;color:${TENUE};">${pulisci(nota)}</td></tr>`;
  const testo = [riempi(t.etichetta, { tipo }), nome, arrivata, '', ...elenco.map(([e, v]) => `${e}: ${v}`), '',
    wa ? `${t.tasti.whatsapp}: https://wa.me/${wa}` : '', nota].filter((x, i, a) => x !== '' || a[i - 1] !== '').join('\n');
  const oggetto = inRiga(riempi(t.oggetto, { tipo, nome }));
  const anteprima = [nome, r.telefono, dettagli.citta].filter(Boolean).join(' · ');
  return { oggetto, testo, html: pagina({ titolo: oggetto, anteprima, tipo: tipoDi(r), corpo, nota: t.piede }) };
}

/** La conferma per chi ha mandato la richiesta: due righe, il riepilogo, WhatsApp e un rimando al sito. */
export function perCliente(r) {
  const t = testi.al_cliente;
  const tipo = tipoDi(r);
  const saluto = riempi(t.saluto, { nome: inRiga(r.nome).split(' ')[0] || '' });
  const corpoTesto = t.testo[tipo];
  const elenco = righe(r, { tecniche: false, liberi: false });
  const rimando = t.rimandi[tipo];
  const whatsapp = `${sito.contatti.whatsapp_link}?text=${encodeURIComponent(t.whatsapp_testo)}`;
  const corpo = `${apertura(t.etichetta, saluto, corpoTesto)}
    <tr><td class="dentro" style="padding:0 44px 8px;">${riquadro(t.riepilogo, elenco)}</td></tr>
    <tr><td class="dentro" style="padding:22px 44px 12px;">${tasto(t.whatsapp, whatsapp)}\n${rimando ? tasto(rimando.testo, dominio() + rimando.href, { pieno: false }) : ''}</td></tr>
    <tr><td class="dentro" style="padding:6px 44px 38px;font-family:${CARATTERE};font-size:15px;line-height:22px;color:${BLU};">${pulisci(t.firma)}<br><strong style="letter-spacing:0.12em;text-transform:uppercase;">Endero</strong></td></tr>`;
  const testo = [saluto, corpoTesto, '', t.riepilogo + ':', ...elenco.map(([e, v]) => `${e}: ${v}`), '',
    `${t.whatsapp}: ${whatsapp}`, rimando ? `${rimando.testo}: ${dominio()}${rimando.href}` : '', '', t.firma, 'Endero', '',
    `${sito.contatti.via}, ${sito.contatti.citta} · ${sito.contatti.email}`].join('\n').replace(/\n{3,}/g, '\n\n');
  return { oggetto: inRiga(t.oggetto), testo, html: pagina({ titolo: t.oggetto, anteprima: `${saluto} ${corpoTesto}`, tipo, corpo, nota: t.piede }) };
}

/** Manda un'email con Resend. Restituisce vero se Resend l'ha presa in carico. */
async function manda(env, { a, oggetto, testo, html, rispondiA }) {
  const risposta = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.EMAIL_MITTENTE || 'Endero <noreply@endero.men>',
      to: a,
      subject: oggetto,
      text: testo,
      html,
      ...(rispondiA ? { reply_to: rispondiA } : {}),
    }),
  });
  if (!risposta.ok) console.error('email non partita', risposta.status, (await risposta.text()).slice(0, 300));
  return risposta.ok;
}

/** Dopo il salvataggio: l'avviso a Endero e la conferma al cliente. Non blocca la risposta al modulo. */
export async function avvisa(env, r) {
  if (!env.RESEND_API_KEY || !env.EMAIL_DESTINATARIO) return { endero: false, cliente: false };
  const destinatari = String(env.EMAIL_DESTINATARIO).split(',').map((x) => x.trim()).filter(Boolean);
  const esito = { endero: false, cliente: false };
  try {
    esito.endero = await manda(env, { a: destinatari, ...perEndero(r), rispondiA: r.email || undefined });
  } catch (errore) {
    console.error('avviso a Endero non partito', errore);
  }
  if (r.email) {
    try {
      esito.cliente = await manda(env, { a: [r.email], ...perCliente(r), rispondiA: env.EMAIL_RISPOSTE || 'info@endero.men' });
    } catch (errore) {
      console.error('conferma al cliente non partita', errore);
    }
  }
  return esito;
}

// ================================================================ le email dell'ordine del configuratore
//
// Partono a pagamento fatto (worker/ordine.mjs, webhook di Stripe), una volta sola. A Endero e a Ennio tutto l'ordine
// come lo legge il reparto: in cima la taglia di partenza con le variazioni, poi la camicia, i tessuti con il nome
// vero della cartella colori (configurazione riservata, mai nel repository), le misure, il cliente con i tasti per
// rispondergli, la consegna e gli importi. Al cliente la conferma con il riepilogo, i nomi dei tessuti del sito e il
// totale pagato. Destinatari: segreto EMAIL_ORDINI (uno o più indirizzi separati da virgola; se manca,
// EMAIL_DESTINATARIO).

const C = configuratore.scheda;
const NOMI_TESSUTI = new Map(catalogo.tessuti.map((t) => [t.id, t.nome]));
const ROSSO = '#9c2a1a', ROSATO = '#fbeae6';
const campoConf = (nome) => C.camicia.campi.find((c) => c.nome === nome);
const opzione = (elenco, id) => (elenco || []).find((x) => x.id === id)?.nome || id || '';
const colore = (id) => opzione(C.colori_filo, id);
// le parti della camicia che hanno un tessuto, nell'ordine della pagina
const PARTI_TESSUTO = [
  ['tessuto', (o) => o.tessuto],
  ['taschino', (o) => o.taschino?.tessuto],
  ['interno_collo', (o) => o.interno_collo?.tessuto],
  ['interno_polso', (o) => o.interno_polso?.tessuto],
  ['polsino', (o) => o.polsino?.tessuto],
];

/** Euro all'italiana: «120 €», «12,50 €». */
export function euro(n) {
  const v = Number(n) || 0;
  try {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: Number.isInteger(v) ? 0 : 2 }).format(v);
  } catch {
    return `${v} €`;
  }
}
const cm = (n) => String(Math.round(Number(n) * 100) / 100).replace('.', ',');

/** Il nome del sito di un tessuto («Popeline bianco»), o l'id se non è nel catalogo. */
const tessutoSito = (id) => NOMI_TESSUTI.get(id) || id || '';

/** Le scelte della camicia, [voce, valore], con i nomi del sito. Per il cliente e per Endero. */
export function scelteCamicia(o) {
  const v = testi.ordine.a_endero.voci;
  const et = (nome) => campoConf(nome)?.etichetta || nome;
  const personalizzato = C.personalizzato || 'Personalizzato';
  const out = [[v.quantita, String(o.quantita || 1)], [et('tessuto'), tessutoSito(o.tessuto)]];
  out.push([et('collo'), opzione(campoConf('collo')?.opzioni, o.collo)]);
  out.push([et('taschino'), o.taschino ? `${v.si} · ${tessutoSito(o.taschino.tessuto)}` : v.no]);
  out.push([et('asola'), o.asola ? `${v.si} · ${colore(o.asola.colore)}` : v.no]);
  out.push([et('bottone'), opzione(campoConf('bottone')?.opzioni, o.bottone)]);
  out.push([et('filato_bottone'), o.filato_bottone ? colore(o.filato_bottone) : v.nessuna]);
  const posizioni = campoConf('iniziali')?.se_si?.[0]?.opzioni;
  // (un ordine salvato prima del 27 novembre non ha il colore del filo: lì il ricamo era blu Endero)
  out.push([et('iniziali'), o.iniziali ? riempi(v.iniziali, { lettere: o.iniziali.lettere, posizione: opzione(posizioni, o.iniziali.posizione), colore: o.iniziali.colore ? colore(o.iniziali.colore).toLowerCase() : v.filo_predefinito }) : v.no]);
  for (const nome of ['interno_collo', 'interno_polso', 'polsino']) {
    out.push([et(nome), o[nome] ? `${personalizzato} · ${tessutoSito(o[nome].tessuto)}` : (C.standard || v.standard)]);
  }
  return out;
}

/** Ritiro o spedizione, [voce, valore]. `note`: anche le note per il corriere (solo a Endero: sono testo libero). */
export function consegna(o, { note = true } = {}) {
  const v = testi.ordine.a_endero.voci;
  const modo = C.spedizione.opzioni.find((s) => s.id === o.spedizione?.modo);
  const out = [[v.modo, modo ? [modo.nome, modo.giorni ? modo.dettaglio : ''].filter(Boolean).join(' · ') : '']];
  const a = o.spedizione?.indirizzo;
  if (a) {
    out.push([v.destinatario, a.destinatario]);
    out.push([v.indirizzo, `${a.indirizzo}\n${a.cap} ${a.citta} (${a.provincia})`]);
    if (note && a.note) out.push([v.note, a.note]);
  }
  return out.filter(([, x]) => x);
}

/** Gli importi, [voce, valore]: camicia, personalizzazioni (`dettagli`), camicie, spedizione, totale. */
export function importi(o, { dettagli = true, totaleCentesimi = null } = {}) {
  const v = testi.ordine.a_endero.voci;
  const c = o.conti || {};
  const out = [[v.camicia, euro(c.camicia)]];
  if (dettagli) out.push([v.personalizzazioni, String((c.personalizzazioni || []).length)]);
  out.push([v.camicie, `${c.quantita} × ${euro(c.camicia)}`]);
  if (o.spedizione?.modo !== 'ritiro') out.push([v.spedizione, c.spedizione ? euro(c.spedizione) : v.gratis]);
  out.push([v.totale, euro(Number.isInteger(totaleCentesimi) ? totaleCentesimi / 100 : c.totale)]);
  return out;
}

/** Il riquadro a due colonne: voce a sinistra, valore a destra. Per elenchi di cose brevi (camicia, misure, importi). */
function colonne(titolo, elenco, { nota = '', ultimaForte = false } = {}) {
  const voci = elenco.map(([e, v], i) => {
    const forte = ultimaForte && i === elenco.length - 1;
    const bordo = i ? `border-top:1px solid ${PANNELLO};` : '';
    return `<tr>
      <td valign="top" style="${bordo}padding:10px 12px 10px 0;font-family:${CARATTERE};font-size:${forte ? 15 : 14}px;line-height:20px;color:${forte ? BLU : TENUE};${forte ? 'font-weight:600;' : ''}">${pulisci(e)}</td>
      <td valign="top" align="right" style="${bordo}padding:10px 0;font-family:${CARATTERE};font-size:${forte ? 18 : 15}px;line-height:20px;color:${BLU};font-weight:600;text-align:right;word-break:break-word;">${pulisci(v).replace(/\r?\n/g, '<br>')}</td>
    </tr>`;
  }).join('\n');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${CARTA}" style="border-collapse:separate;background:${CARTA};border-radius:14px;">
  <tr><td style="padding:22px 24px 14px;">
    <div style="padding-bottom:12px;margin-bottom:2px;border-bottom:1px solid ${PANNELLO};font-family:${CARATTERE};font-size:12px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:${BLU};">${pulisci(titolo)}</div>
    ${nota ? `<div style="padding:10px 0 4px;font-family:${CARATTERE};font-size:13px;line-height:19px;color:${TENUE};">${pulisci(nota)}</div>` : ''}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${voci}</table>
  </td></tr></table>`;
}

/** Un avviso in rosso, ben visibile. */
const avvisoRosso = (testo) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;"><tr><td bgcolor="${ROSATO}" style="padding:12px 14px;background:${ROSATO};border-radius:10px;font-family:${CARATTERE};font-size:14px;line-height:20px;font-weight:600;color:${ROSSO};">${pulisci(testo)}</td></tr></table>`;

/** La taglia per il reparto, in grande sul blu; sotto, in rosso, il motivo per cui va verificata. */
function riquadroTaglia(t) {
  const a = testi.ordine.a_endero;
  const avviso = !t ? a.taglia_assente : t.daVerificare ? `${a.verifica}: ${(t.motivi || []).join('; ')}` : '';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BLU}" style="border-collapse:separate;background:${BLU};border-radius:14px;">
  <tr><td style="padding:22px 24px 24px;font-family:${CARATTERE};color:${FILO};">
    <div style="font-size:12px;font-weight:600;letter-spacing:0.1em;line-height:16px;text-transform:uppercase;color:#b9c1d3;">${pulisci(a.taglia)}</div>
    ${(() => {
      // la taglia in grande, sotto una variazione per riga: «collo +2 cm» non si spezza a metà sul telefono
      const [prima, ...variazioni] = String(t?.riga || '—').split(' · ');
      return `<div class="titolo" style="padding-top:10px;font-size:28px;line-height:34px;font-weight:600;color:${FILO};">${pulisci(prima)}</div>
    ${variazioni.map((x) => `<div style="padding-top:4px;font-size:18px;line-height:25px;font-weight:600;color:${FILO};white-space:nowrap;">${pulisci(x)}</div>`).join('')}`;
    })()}
    ${avviso ? `<div style="height:16px;line-height:16px;font-size:16px;">&nbsp;</div>${avvisoRosso(avviso)}` : ''}
  </td></tr></table>`;
}

/** Il nome vero di un tessuto, se la configurazione riservata ce l'ha: «Articolo · codice». */
const haNomeVero = (vero) => !!(vero && typeof vero === 'object' && (vero.articolo || vero.codice));

/** Se il codice letto sulla cartella colori non era sicuro: la frase da mostrare, con le altre letture possibili. */
function dubbioTessuto(vero) {
  if (!haNomeVero(vero) || !vero.incerto) return '';
  const altre = (Array.isArray(vero.alternative) ? vero.alternative : []).map((x) => String(x).slice(0, 80)).filter(Boolean).slice(0, 4);
  return testi.ordine.a_endero.tessuto_incerto + (altre.length ? ` ${altre.join(' / ')}` : '');
}

/** Un tessuto per il reparto: la foto del campione, il nome vero della cartella colori e, sotto, il nome del sito. */
function rigaTessuto(parte, id, vero, primo) {
  const a = testi.ordine.a_endero;
  const f = a.campo_tessuto;
  const buono = haNomeVero(vero);
  const titolo = buono ? [vero.articolo, vero.codice].filter(Boolean).join(' · ') : tessutoSito(id);
  // il gruppo: nelle cartelle con più articoli lo stesso codice torna in gruppi diversi, e senza il gruppo non si sa quale sia
  const dettagli = buono ? [['gruppo', vero.gruppo], ['cartella', vero.cartella], ['posizione', vero.posizione], ['composizione', vero.composizione]]
    .filter(([, x]) => x).map(([k, x]) => `${f[k]}: ${x}`) : [];
  const sito = riempi(a.tessuto_sito, { nome: tessutoSito(id), id });
  const dubbio = dubbioTessuto(vero);
  const campione = `${dominio()}/camicia/tessuti/${encodeURIComponent(id)}.webp`;
  return `<tr><td style="${primo ? '' : `border-top:1px solid ${PANNELLO};`}padding:14px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="84" valign="top" style="width:84px;padding-right:14px;"><img src="${pulisci(campione)}" width="84" height="56" alt="${pulisci(tessutoSito(id))}" style="display:block;width:84px;height:56px;border:0;border-radius:8px;background:${PANNELLO};color:${TENUE};font-family:${CARATTERE};font-size:10px;"></td>
      <td valign="top" style="font-family:${CARATTERE};color:${BLU};">
        <div style="font-size:11px;line-height:16px;letter-spacing:0.08em;text-transform:uppercase;color:${TENUE};">${pulisci(parte)}</div>
        <div style="padding-top:2px;font-size:16px;line-height:22px;font-weight:600;color:${BLU};word-break:break-word;">${pulisci(titolo)}</div>
        ${dettagli.map((x) => `<div style="font-size:13px;line-height:19px;color:${BLU};word-break:break-word;">${pulisci(x)}</div>`).join('')}
        ${buono ? '' : `<div style="padding-top:6px;font-size:13px;line-height:18px;font-weight:600;color:${ROSSO};">${pulisci(a.tessuto_mancante)}</div>`}
        ${dubbio ? `<div style="padding-top:6px;font-size:13px;line-height:18px;font-weight:600;color:${ROSSO};word-break:break-word;">${pulisci(dubbio)}</div>` : ''}
        <div style="padding-top:4px;font-size:12px;line-height:17px;color:${TENUE};">${pulisci(sito)}</div>
      </td>
    </tr></table>
  </td></tr>`;
}

/** I tessuti dell'ordine: [parte, id, nome vero o null], nell'ordine della pagina. */
export function tessutiOrdine(o, veri = {}) {
  return PARTI_TESSUTO.map(([nome, prendi]) => [campoConf(nome)?.etichetta || nome, prendi(o)]).filter(([, id]) => id)
    .map(([parte, id]) => [parte, id, veri && Object.hasOwn(veri, id) ? veri[id] : null]);
}

/** L'indirizzo della miniatura della camicia di un ordine (worker/ordine.mjs, camiciaOrdine), o '' se non c'è. */
export function indirizzoMiniatura(m) {
  return m && /^[0-9a-f]{32}$/.test(m.o || '') && /^[0-9a-f]{32}$/.test(m.k || '') ? `${dominio()}/api/camicia-ordine?o=${m.o}&k=${m.k}` : '';
}
/** La descrizione della miniatura: il tessuto (nome del sito) e il collo. */
const descriviCamicia = (modello, o, valori = {}) => riempi(modello, { ...valori, tessuto: tessutoSito(o.tessuto), collo: opzione(campoConf('collo')?.opzioni, o.collo).toLowerCase() });

/** Le misure scritte dal cliente, come le ha scritte, in centimetri (la taglia e le variazioni restano a Endero). */
export function misureCliente(o) {
  return C.misure.campi.filter((m) => Number.isFinite(o.misure?.[m.nome])).map((m) => [m.etichetta, `${cm(o.misure[m.nome])} cm`]);
}

/** Le misure della camicia stesa, come le legge il reparto: «52» e, per le larghezze, «52 (giro 104)». */
export function misureOrdine(o) {
  const a = testi.ordine.a_endero;
  return C.misure.campi.filter((m) => Number.isFinite(o.misure?.[m.nome]))
    .map((m) => [m.etichetta, `${cm(o.misure[m.nome])}${m.giro ? ` (${riempi(a.giro, { cm: cm(o.misure[m.nome] * 2) })})` : ''}`]);
}

/**
 * L'email dell'ordine per Endero e per Ennio. `dati` è quello di comeEmail in worker/ordine.mjs:
 * { numero, ordine, taglia, pagato, pagatoCentesimi, totaleCentesimi, emailCliente, tessutiVeri }.
 */
export function ordinePerEndero(dati) {
  const a = testi.ordine.a_endero, v = a.voci;
  const o = dati.ordine || {};
  const cl = o.cliente || {};
  const nome = inRiga(cl.nome);
  const numeroTel = numeroInternazionale(cl.telefono);
  // WhatsApp solo per i cellulari, come nell'avviso dei moduli
  const wa = numeroTel && !/^390/.test(numeroTel) ? numeroTel : '';
  const mailto = cl.email ? cl.email.split('@').map(encodeURIComponent).join('@') : '';
  const tasti = [
    wa ? tasto(testi.a_endero.tasti.whatsapp, `https://wa.me/${wa}?text=${encodeURIComponent(riempi(a.whatsapp_testo, { nome: nome.split(' ')[0], numero: dati.numero }))}`) : '',
    numeroTel ? tasto(testi.a_endero.tasti.chiama, `tel:+${numeroTel}`, { pieno: !wa }) : '',
    mailto ? tasto(testi.a_endero.tasti.email, `mailto:${mailto}?subject=${encodeURIComponent(`Endero · ordine ${dati.numero}`)}`, { pieno: !numeroTel }) : '',
  ].join('\n');
  const t = dati.taglia;
  const tessuti = tessutiOrdine(o, dati.tessutiVeri);
  const clienti = [[v.nome, cl.nome], [v.telefono, cl.telefono], [v.email, cl.email]];
  if (dati.emailCliente && dati.emailCliente.toLowerCase() !== String(cl.email || '').toLowerCase()) clienti.push([v.email_pagamento, dati.emailCliente]);
  const totale = Number.isInteger(dati.totaleCentesimi) ? dati.totaleCentesimi : Math.round((o.conti?.totale || 0) * 100);
  const diverso = Number.isInteger(dati.pagatoCentesimi) && dati.pagatoCentesimi !== totale
    ? riempi(a.attenzione_importo, { pagato: euro(dati.pagatoCentesimi / 100), totale: euro(totale / 100) }) : '';
  const pagato = riempi(a.pagato, { quando: quando(dati.pagato || new Date()) });
  const nota = '';
  const conti = importi(o, { totaleCentesimi: totale }).concat([[v.pagamento, v.pagato_stripe]]);
  const blocco = (html, sotto = 14) => `<tr><td class="dentro" style="padding:0 44px ${sotto}px;">${html}</td></tr>`;
  const foto = indirizzoMiniatura(dati.miniatura);
  const miniatura = foto ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${CARTA}" style="border-collapse:separate;background:${CARTA};border-radius:14px;">
      <tr><td style="padding:22px 24px 24px;">
        <div style="padding-bottom:12px;margin-bottom:18px;border-bottom:1px solid ${PANNELLO};font-family:${CARATTERE};font-size:12px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:${BLU};">${pulisci(a.miniatura)}</div>
        <img src="${pulisci(foto)}" width="300" alt="${pulisci(descriviCamicia(a.alt_camicia, o, { numero: dati.numero }))}" style="display:block;width:100%;max-width:300px;height:auto;margin:0 auto;border:0;border-radius:14px;background:${BLU};color:${FILO};font-family:${CARATTERE};font-size:14px;">
      </td></tr></table>` : '';
  const corpo = `${apertura(a.etichetta, dati.numero, `${nome} · ${pagato}`)}
    ${blocco(riquadroTaglia(t), 14)}
    ${diverso ? blocco(avvisoRosso(diverso)) : ''}
    ${miniatura ? blocco(miniatura) : ''}
    ${blocco(colonne(a.camicia, scelteCamicia(o)))}
    ${blocco(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${CARTA}" style="border-collapse:separate;background:${CARTA};border-radius:14px;">
      <tr><td style="padding:22px 24px 8px;">
        <div style="padding-bottom:12px;border-bottom:1px solid ${PANNELLO};font-family:${CARATTERE};font-size:12px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:${BLU};">${pulisci(a.tessuti)}</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${tessuti.map(([p, id, vero], i) => rigaTessuto(p, id, vero, i === 0)).join('\n')}</table>
      </td></tr></table>`)}
    ${blocco(colonne(a.misure, misureOrdine(o), { nota: a.misure_nota }))}
    ${blocco(riquadro(a.cliente, clienti.filter(([, x]) => x)), 16)}
    ${tasti ? `<tr><td class="dentro" style="padding:0 44px 4px;">${tasti}</td></tr>` : ''}
    ${blocco(riquadro(a.consegna, consegna(o)))}
    ${blocco(colonne(a.importi, conti.slice(0, -1), { ultimaForte: true }), 0)}
    <tr><td class="dentro" style="padding:16px 44px 38px;font-family:${CARATTERE};font-size:13px;line-height:20px;color:${TENUE};">${pulisci(pagato)}${nota ? `<br>${pulisci(nota)}` : ''}</td></tr>`;

  const rigaVera = ([p, id, x]) => `${p}: ${haNomeVero(x)
    ? [x.articolo, x.codice, dubbioTessuto(x), x.gruppo && `${a.campo_tessuto.gruppo}: ${x.gruppo}`, x.cartella && `${a.campo_tessuto.cartella}: ${x.cartella}`, x.posizione && `${a.campo_tessuto.posizione}: ${x.posizione}`, x.composizione].filter(Boolean).join(' · ')
    : a.tessuto_mancante.toUpperCase()} (${riempi(a.tessuto_sito, { nome: tessutoSito(id), id })})`;
  const sezione = (titolo, elenco) => [titolo.toUpperCase(), ...elenco.map(([e, x]) => `${e}: ${String(x).replace(/\n/g, ', ')}`), ''];
  const testo = [
    `${a.etichetta} · ${dati.numero}`, `${nome} · ${pagato}`, '',
    `${a.taglia.toUpperCase()}: ${t?.riga || a.taglia_assente}`,
    t?.daVerificare ? `${a.verifica.toUpperCase()}: ${(t.motivi || []).join('; ')}` : '',
    diverso, '',
    ...sezione(a.camicia, scelteCamicia(o)),
    a.tessuti.toUpperCase(), ...tessuti.map(rigaVera), '',
    `${a.misure.toUpperCase()} · ${a.misure_nota}`, ...misureOrdine(o).map(([e, x]) => `${e}: ${x}`), '',
    ...(foto ? [`${a.miniatura}: ${foto}`, ''] : []),
    ...sezione(a.cliente, clienti.filter(([, x]) => x)), wa ? `WhatsApp: https://wa.me/${wa}` : '', '',
    ...sezione(a.consegna, consegna(o)),
    ...sezione(a.importi, conti), nota,
  ].filter((x, i, arr) => x !== '' || (i > 0 && arr[i - 1] !== '')).join('\n');
  // un ordine pagato con il pagamento di prova (o con le chiavi di prova di Stripe): PROVA in oggetto e in cima
  const P = dati.prova ? testi.ordine.prova : null;
  const oggetto = inRiga(`${P ? `${P.oggetto} ` : ''}${t?.riga ? riempi(a.oggetto, { numero: dati.numero, nome, taglia: t.riga }) : riempi(a.oggetto_senza_taglia, { numero: dati.numero, nome })}`);
  const anteprima = [P?.a_endero, t?.riga, `${o.quantita || 1} × ${tessutoSito(o.tessuto)}`, euro(totale / 100)].filter(Boolean).join(' · ');
  return { oggetto, testo: P ? `${P.a_endero}\n\n${testo}` : testo, html: pagina({ titolo: oggetto, anteprima, tipo: 'ordine', corpo, nota: a.piede, avviso: P?.a_endero }) };
}

/** La conferma dell'ordine per il cliente: nomi dei tessuti del sito (mai quelli veri), consegna, totale, WhatsApp. */
export function ordinePerCliente(dati) {
  const t = testi.ordine.al_cliente;
  const o = dati.ordine || {};
  const saluto = riempi(t.saluto, { nome: inRiga(o.cliente?.nome).split(' ')[0] || '' });
  const whatsapp = `${sito.contatti.whatsapp_link}?text=${encodeURIComponent(riempi(t.whatsapp_testo, { numero: dati.numero }))}`;
  const etichetta = riempi(t.etichetta, { numero: dati.numero });
  // nel riepilogo solo ciò che il sito ha controllato: le note per il corriere (testo libero) restano fuori
  const scelte = scelteCamicia(o);
  const dove = consegna(o, { note: false });
  const conti = importi(o, { dettagli: false, totaleCentesimi: Number.isInteger(dati.totaleCentesimi) ? dati.totaleCentesimi : null });
  const misure = misureCliente(o);
  // in cima, al posto della foto di sempre, la sua camicia com'è l'ha creata (proprietario, 2026-11-27)
  const foto = indirizzoMiniatura(dati.miniatura);
  const testata = foto ? { src: foto, alt: descriviCamicia(t.alt_camicia, o) } : null;
  const corpo = `${apertura(etichetta, saluto, t.testo)}
    <tr><td class="dentro" style="padding:0 44px 14px;">${colonne(t.riepilogo, scelte)}</td></tr>
    ${misure.length ? `<tr><td class="dentro" style="padding:0 44px 14px;">${colonne(t.misure, misure)}</td></tr>` : ''}
    <tr><td class="dentro" style="padding:0 44px 14px;">${riquadro(t.consegna, dove)}</td></tr>
    <tr><td class="dentro" style="padding:0 44px 8px;">${colonne(testi.ordine.a_endero.importi, conti, { ultimaForte: true })}</td></tr>
    <tr><td class="dentro" style="padding:22px 44px 12px;">${tasto(t.whatsapp, whatsapp)}\n${tasto(t.rimando.testo, dominio() + t.rimando.href, { pieno: false })}</td></tr>
    <tr><td class="dentro" style="padding:6px 44px 38px;font-family:${CARATTERE};font-size:15px;line-height:22px;color:${BLU};">${pulisci(t.firma)}<br><strong style="letter-spacing:0.12em;text-transform:uppercase;">Endero</strong></td></tr>`;
  const testo = [saluto, t.testo, '', `${t.riepilogo} · ${dati.numero}`, ...scelte.map(([e, v]) => `${e}: ${v}`), '',
    ...(misure.length ? [t.misure, ...misure.map(([e, v]) => `${e}: ${v}`), ''] : []),
    ...dove.map(([e, v]) => `${e}: ${v.replace(/\n/g, ', ')}`), '',
    ...conti.map(([e, v]) => `${e}: ${v}`), '',
    `${t.whatsapp}: ${whatsapp}`, '', t.firma, 'Endero', '', `${sito.contatti.via}, ${sito.contatti.citta} · ${sito.contatti.email}`].join('\n').replace(/\n{3,}/g, '\n\n');
  const P = dati.prova ? testi.ordine.prova : null;
  const oggetto = inRiga(`${P ? `${P.oggetto} ` : ''}${riempi(t.oggetto, { numero: dati.numero })}`);
  return { oggetto, testo: P ? `${P.al_cliente}\n\n${testo}` : testo, html: pagina({ titolo: oggetto, anteprima: `${P ? `${P.al_cliente} ` : ''}${saluto} ${t.testo}`, tipo: 'ordine', corpo, nota: t.piede, avviso: P?.al_cliente, testata }) };
}

/** A pagamento fatto: l'ordine a Endero e a Ennio, la conferma al cliente. Restituisce { endero, cliente }. */
export async function avvisaOrdine(env, dati) {
  const esito = { endero: false, cliente: false };
  const elenco = String(env.EMAIL_ORDINI || env.EMAIL_DESTINATARIO || '').split(',').map((x) => x.trim()).filter(Boolean);
  if (!env.RESEND_API_KEY || !elenco.length) return esito;
  // l'indirizzo del cliente deve essere un'email semplice e scritta bene: niente virgole o nomi che aggiungono destinatari
  const cliente = [dati.emailCliente, dati.ordine?.cliente?.email].find((x) => x && !controlla('email', x, { obbligatorio: true }));
  try {
    // niente «Rispondi a» del cliente: una risposta porterebbe citati il nome vero dei tessuti e la taglia, che restano
    // a Endero (revisione del 2026-11-26). Per scrivere al cliente ci sono i tasti, che aprono un messaggio nuovo
    esito.endero = await manda(env, { a: elenco, ...ordinePerEndero(dati), rispondiA: env.EMAIL_RISPOSTE || 'info@endero.men' });
  } catch (errore) {
    console.error('ordine a Endero non partito', dati.numero, errore);
  }
  // se l'ordine a Endero non è partito, Stripe ripete l'avviso e si rimanda tutto: la conferma aspetta quel giro,
  // così il cliente non la riceve due volte
  if (cliente && esito.endero) {
    try {
      esito.cliente = await manda(env, { a: [cliente], ...ordinePerCliente(dati), rispondiA: env.EMAIL_RISPOSTE || 'info@endero.men' });
    } catch (errore) {
      console.error('conferma dell\'ordine al cliente non partita', dati.numero, errore);
    }
  }
  return esito;
}
