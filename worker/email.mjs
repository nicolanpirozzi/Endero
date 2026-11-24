// Le email dei moduli (proprietario, 2026-11-24). A Endero arriva ogni richiesta salvata dal sito; chi l'ha mandata
// riceve una conferma breve, se ha lasciato l'email. Si mandano con Resend (https://resend.com) dal dominio
// endero.men; i testi stanno in contenuti/it/email.json.
//
// Segreti del Worker, mai nel repository: RESEND_API_KEY (la chiave di Resend) ed EMAIL_DESTINATARIO (la casella di
// Endero che riceve le richieste; più indirizzi separati da virgole). Variabili (wrangler.toml): EMAIL_MITTENTE
// ("Endero <noreply@endero.men>") ed EMAIL_RISPOSTE (dove rispondono i clienti alla conferma: info@endero.men).
// Senza chiave o senza destinatario non parte nulla: la richiesta resta comunque salvata nel database.
//
// Questo file non è il punto d'ingresso del Worker: può esportare anche costanti (vedi CLAUDE.md, 2026-11-20).

import testi from '../contenuti/it/email.json';
import rivenditori from '../contenuti/it/diventa-rivenditore.json';

const BLU = '#0f285e';
const pulisci = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const riempi = (modello, valori) => modello.replace(/\{(\w+)\}/g, (_, k) => valori[k] ?? '');
// nelle intestazioni (oggetto, nomi) niente a capo né caratteri di controllo
const inRiga = (v) => String(v ?? '').replace(/[\u0000-\u001F\u007F]+/g, ' ').trim().slice(0, 160);

/** Le righe della richiesta, nell'ordine in cui le legge Endero: [etichetta, valore], solo quelle compilate. */
export function righe(r) {
  const v = testi.a_endero.voci;
  const out = [];
  const metti = (etichetta, valore) => {
    const testo = Array.isArray(valore) ? valore.join(', ') : String(valore ?? '').trim();
    if (testo) out.push([etichetta, testo]);
  };
  metti(v.nome, r.nome);
  metti(v.telefono, r.telefono);
  metti(v.email, r.email);
  metti(v.giorno, r.giorno);
  metti(v.fascia, r.fascia);
  // i campi propri dei rivenditori, con le etichette della loro pagina
  if (r.tipo === 'rivenditore' && r.dettagli) {
    let d = {};
    try { d = JSON.parse(r.dettagli); } catch { d = {}; }
    for (const c of rivenditori.modulo.campi) if (c.nome in d) metti(c.etichetta.replace(/\s*\(facoltativ[oa]\)\s*$/i, ''), d[c.nome]);
  }
  metti(v.messaggio, r.messaggio);
  metti(v.pagina, r.pagina);
  metti(v.paese, r.paese);
  return out;
}

/** L'email per Endero: oggetto, testo semplice e HTML. Chi risponde, risponde al cliente (reply_to). */
export function perEndero(r) {
  const t = testi.a_endero;
  const tipo = t.tipi[r.tipo] || t.tipi.contatto;
  const elenco = righe(r);
  const nota = r.email ? riempi(t.rispondi, { email: r.email }) : t.senza_email;
  const testo = [t.titolo + ' · ' + tipo, '', ...elenco.map(([e, v]) => `${e}: ${v}`), '', nota].join('\n');
  const html = pagina(`<h1 style="margin:0 0 4px;font-size:18px;letter-spacing:.06em;text-transform:uppercase">${pulisci(t.titolo)}</h1>
<p style="margin:0 0 20px;font-size:13px;opacity:.7">${pulisci(tipo)}</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:15px">
${elenco.map(([e, v]) => `<tr><td style="padding:8px 16px 8px 0;vertical-align:top;white-space:nowrap;opacity:.65">${pulisci(e)}</td><td style="padding:8px 0;vertical-align:top;white-space:pre-wrap">${pulisci(v)}</td></tr>`).join('\n')}
</table>
<p style="margin:24px 0 0;font-size:13px;opacity:.7">${pulisci(nota)}</p>`);
  return { oggetto: inRiga(riempi(t.oggetto, { tipo, nome: r.nome })), testo, html };
}

/** La conferma per chi ha mandato la richiesta: due righe, e i contatti. */
export function perCliente(r) {
  const t = testi.al_cliente;
  const saluto = riempi(t.saluto, { nome: inRiga(r.nome).split(' ')[0] || '' });
  const corpo = t.testo[r.tipo] || t.testo.contatto;
  const testo = [saluto, corpo, '', t.contatti, '', t.firma].join('\n');
  const html = pagina(`<p style="margin:0 0 12px;font-size:16px">${pulisci(saluto)}</p>
<p style="margin:0 0 24px;font-size:16px;line-height:1.55">${pulisci(corpo)}</p>
<p style="margin:0 0 24px;font-size:13px;opacity:.75">${pulisci(t.contatti)}</p>
<p style="margin:0;font-size:14px;letter-spacing:.12em;text-transform:uppercase">${pulisci(t.firma)}</p>`);
  return { oggetto: inRiga(t.oggetto), testo, html };
}

function pagina(contenuto) {
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:24px;background:#faf9f7;color:${BLU};font-family:Helvetica,Arial,sans-serif;line-height:1.5">
<div style="max-width:560px;margin:0 auto;padding:28px;background:#fff;border-radius:12px">
${contenuto}
</div></body></html>`;
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
