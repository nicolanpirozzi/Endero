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
import { numeroInternazionale } from '../src/controlli.mjs';

const BLU = '#0f285e', CARTA = '#faf9f7', PANNELLO = '#eceae5', FILO = '#fbf9f4', TENUE = '#5b6b8c';
const CARATTERE = `'Archivo', 'Helvetica Neue', Helvetica, Arial, sans-serif`;
// le immagini cambiano nome se cambiano: le email già mandate continuano a mostrare le loro
const VERSIONE_IMMAGINI = 1;
const TIPI = ['contatto', 'presa-misure', 'rivenditore'];

const pulisci = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const riempi = (modello, valori) => modello.replace(/\{(\w+)\}/g, (_, k) => valori[k] ?? '');
// nelle intestazioni (oggetto, nomi) niente a capo né caratteri di controllo
const inRiga = (v) => String(v ?? '').replace(/[\u0000-\u001F\u007F]+/g, ' ').trim().slice(0, 160);
const tipoDi = (r) => (TIPI.includes(r.tipo) ? r.tipo : 'contatto');
const dominio = () => String(sito.dominio || 'https://endero.men').replace(/\/$/, '');
const immagine = (nome) => `${dominio()}/email/${nome}?v=${VERSIONE_IMMAGINI}`;

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
export function righe(r, { tecniche = true } = {}) {
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
    for (const c of rivenditori.modulo.campi) if (c.nome in d) metti(c.etichetta.replace(/\s*\(facoltativ[oa]\)\s*$/i, ''), d[c.nome]);
  }
  metti(v.messaggio, r.messaggio);
  if (tecniche) {
    metti(v.pagina, r.pagina);
    metti(v.paese, paeseScritto(r.paese));
  }
  return out;
}

// ---------------------------------------------------------------- i pezzi dell'HTML

/** Un tasto: pieno (blu) o di contorno. Un link vero, che funziona anche dove gli stili non arrivano. */
function tasto(testo, href, { pieno = true } = {}) {
  const colore = pieno ? FILO : BLU;
  const fondo = pieno ? BLU : '#ffffff';
  return `<a href="${pulisci(href)}" target="_blank" class="tasto" style="display:inline-block;margin:0 8px 10px 0;padding:15px 26px;border-radius:999px;border:1px solid ${BLU};background:${fondo};color:${colore};font-family:${CARATTERE};font-size:13px;font-weight:600;letter-spacing:0.08em;line-height:16px;text-transform:uppercase;text-decoration:none;mso-padding-alt:0;">${pulisci(testo)}</a>`;
}

/** Il riquadro con le righe: etichetta piccola sopra, valore sotto (si legge bene anche sul telefono). */
function riquadro(titolo, elenco) {
  if (!elenco.length) return '';
  const voci = elenco.map(([e, v], i) => `<tr><td style="padding:${i ? '14px' : '0'} 0 0;font-family:${CARATTERE};">
      <div style="font-size:11px;line-height:16px;letter-spacing:0.08em;text-transform:uppercase;color:${TENUE};">${pulisci(e)}</div>
      <div style="padding-top:3px;font-size:15px;line-height:22px;color:${BLU};word-break:break-word;">${pulisci(v).replace(/\r?\n/g, '<br>')}</div>
    </td></tr>`).join('\n');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;background:${CARTA};border-radius:14px;">
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
  return `<tr><td class="dentro" style="padding:34px 44px 30px;background:${BLU};font-family:${CARATTERE};color:${FILO};">
    <a href="${pulisci(dominio())}/" target="_blank"><img src="${immagine('logo-bianco.png')}" width="120" alt="Endero" style="display:block;width:120px;height:auto;border:0;color:${FILO};font-size:18px;font-weight:600;letter-spacing:0.08em;"></a>
    <p style="margin:20px 0 0;font-size:14px;line-height:21px;">${pulisci(c.via)}, ${pulisci(c.citta)} (${pulisci(c.provincia)})<br>${link(testi.comune.come_arrivare, c.mappa)}</p>
    <p style="margin:14px 0 0;font-size:14px;line-height:21px;">${contatti}</p>
    <p style="margin:22px 0 0;font-size:11px;line-height:17px;color:#b9c1d3;">${pulisci(sito.societa?.ragione_sociale || '')}${sito.societa?.partita_iva ? ` · P. IVA ${pulisci(sito.societa.partita_iva)}` : ''}<br>${pulisci(nota)}</p>
  </td></tr>`;
}

/** La pagina intera: testata con la foto, il contenuto, il piè di pagina. */
function pagina({ titolo, anteprima, tipo, corpo, nota }) {
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
  @font-face { font-family: 'Archivo'; src: url('${dominio()}/font/archivo-var.woff2') format('woff2'); font-weight: 100 900; font-stretch: 62% 125%; }
  body { margin: 0; padding: 0; -webkit-text-size-adjust: 100%; }
  a { color: ${BLU}; }
  .titolo { font-stretch: 118%; }
  @media (max-width: 620px) {
    .fuori { padding: 0 !important; }
    .scatola { border-radius: 0 !important; }
    .dentro { padding-left: 24px !important; padding-right: 24px !important; }
    .titolo { font-size: 26px !important; line-height: 32px !important; }
    .tasto { display: block !important; margin: 0 0 10px !important; text-align: center !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${PANNELLO};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${pulisci(anteprima)}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PANNELLO};">
<tr><td class="fuori" align="center" style="padding:32px 12px;">
  <table role="presentation" class="scatola" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden;">
    <tr><td style="background:${BLU};line-height:0;">
      <a href="${pulisci(dominio())}/" target="_blank"><img src="${immagine(`testata-${tipo}.jpg`)}" width="600" alt="${pulisci(testi.comune.alt_testata)}" style="display:block;width:100%;max-width:600px;height:auto;border:0;background:${BLU};color:${FILO};font-family:${CARATTERE};font-size:22px;font-weight:600;letter-spacing:0.1em;line-height:60px;text-align:center;"></a>
    </td></tr>
    ${corpo}
    ${piede(nota)}
  </table>
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
  const numero = numeroInternazionale(r.telefono);
  const nota = r.email ? riempi(t.rispondi, { email: r.email }) : t.senza_email;
  const arrivata = riempi(t.arrivata, { quando: quando(arrivo) });
  const tasti = [
    numero ? tasto(t.tasti.whatsapp, `https://wa.me/${numero}?text=${encodeURIComponent(riempi(t.whatsapp_testo, { nome: nome.split(' ')[0] }))}`) : '',
    numero ? tasto(t.tasti.chiama, `tel:+${numero}`, { pieno: false }) : '',
    r.email ? tasto(t.tasti.email, `mailto:${r.email}?subject=${encodeURIComponent(`Endero · ${tipo}`)}`, { pieno: false }) : '',
  ].join('');
  const corpo = `${apertura(riempi(t.etichetta, { tipo }), nome, arrivata)}
    ${tasti ? `<tr><td class="dentro" style="padding:0 44px 18px;">${tasti}</td></tr>` : ''}
    <tr><td class="dentro" style="padding:6px 44px 0;">${riquadro(t.dati, elenco)}</td></tr>
    <tr><td class="dentro" style="padding:18px 44px 38px;font-family:${CARATTERE};font-size:13px;line-height:20px;color:${TENUE};">${pulisci(nota)}</td></tr>`;
  const testo = [riempi(t.etichetta, { tipo }), nome, arrivata, '', ...elenco.map(([e, v]) => `${e}: ${v}`), '',
    numero ? `${t.tasti.whatsapp}: https://wa.me/${numero}` : '', nota].filter((x, i, a) => x !== '' || a[i - 1] !== '').join('\n');
  const oggetto = inRiga(riempi(t.oggetto, { tipo, nome }));
  const anteprima = [nome, r.telefono, (() => { try { return JSON.parse(r.dettagli || '{}').citta; } catch { return ''; } })()].filter(Boolean).join(' · ');
  return { oggetto, testo, html: pagina({ titolo: oggetto, anteprima, tipo: tipoDi(r), corpo, nota: t.piede }) };
}

/** La conferma per chi ha mandato la richiesta: due righe, il riepilogo, WhatsApp e un rimando al sito. */
export function perCliente(r) {
  const t = testi.al_cliente;
  const tipo = tipoDi(r);
  const saluto = riempi(t.saluto, { nome: inRiga(r.nome).split(' ')[0] || '' });
  const corpoTesto = t.testo[tipo];
  const elenco = righe(r, { tecniche: false });
  const rimando = t.rimandi[tipo];
  const whatsapp = `${sito.contatti.whatsapp_link}?text=${encodeURIComponent(t.whatsapp_testo)}`;
  const corpo = `${apertura(t.etichetta, saluto, corpoTesto)}
    <tr><td class="dentro" style="padding:0 44px 8px;">${riquadro(t.riepilogo, elenco)}</td></tr>
    <tr><td class="dentro" style="padding:22px 44px 12px;">${tasto(t.whatsapp, whatsapp)}${rimando ? tasto(rimando.testo, dominio() + rimando.href, { pieno: false }) : ''}</td></tr>
    <tr><td class="dentro" style="padding:6px 44px 38px;font-family:${CARATTERE};font-size:15px;line-height:22px;color:${BLU};">${pulisci(t.firma)}<br><strong style="letter-spacing:0.12em;text-transform:uppercase;">Endero</strong></td></tr>`;
  const testo = [saluto, corpoTesto, '', t.riepilogo + ':', ...elenco.map(([e, v]) => `${e}: ${v}`), '',
    `${t.whatsapp}: ${whatsapp}`, rimando ? `${rimando.testo}: ${dominio()}${rimando.href}` : '', '', t.firma, 'Endero', '',
    `${sito.contatti.via}, ${sito.contatti.citta} · ${sito.contatti.email}`].join('\n').replace(/\n{3,}/g, '\n\n');
  return { oggetto: inRiga(t.oggetto), testo, html: pagina({ titolo: t.oggetto, anteprima: corpoTesto, tipo, corpo, nota: t.piede }) };
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
