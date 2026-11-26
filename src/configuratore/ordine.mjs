// Le regole dell'ordine del configuratore (proprietario, 2026-11-25): cosa si può scegliere, cosa manca, quanto costa.
// Le usano la pagina mentre si compila (prezzo in vista, avvisi sotto i campi) e il Worker quando l'ordine arriva:
// il prezzo che conta è sempre quello rifatto dal Worker. Opzioni, prezzi e frasi stanno in
// contenuti/it/configuratore.json; qui c'è solo la logica.
//
// I dati arrivano "piatti", come li manda un modulo: un nome di campo, un valore di testo.
//   quantita, tessuto, collo,
//   taschino (si|no) + taschino_tessuto, asola (si|no) + asola_colore, bottone (tinta|contrasto|personalizzato),
//   filato_bottone (un colore, o vuoto), iniziali (si|no) + iniziali_posizione + iniziali_lettere,
//   interno_collo, interno_polso, polsino (standard|personalizzato) + …_tessuto,
//   le dodici misure, nome, telefono, email,
//   spedizione (ritiro|cinque|sette) + destinatario, indirizzo, cap, citta, provincia, note_consegna, privacy.
//
// Prezzo (parole sue): «prezzo base 90 euro, con 1 personalizzazione 100 euro, con 3 personalizzazioni 120 euro, con
// tutte le personalizzazioni 150 euro». Le personalizzazioni sono le otto voci segnate in configuratore.json:
// taschino, asola colorata, bottone non tinta su tinta, filato bottone, iniziali, interno collo, interno polso,
// polsino. Interpretazione nostra, da confermare: con due si paga come con una, da tre a sette come con tre.
// Spedizione: «5 gg lavorativi 15 euro… oppure 7 gg lavorativi 30 euro (spedizione gratis sopra 200 euro di spesa)»:
// gratis da 200 euro di camicie compresi (confermato dal proprietario il 2026-11-26).

import testi from '../../contenuti/it/configuratore.json';
import { controlla, senzaInvisibili } from '../controlli.mjs';

const S = testi.scheda;
const CAMPI = S.camicia.campi;
const campo = (nome) => CAMPI.find((c) => c.nome === nome);
const pulito = (v) => senzaInvisibili(v).replace(/\s+/g, ' ').trim();
const ID = /^[a-z0-9_-]{1,32}$/;

/** I nomi delle voci che fanno salire il prezzo, nell'ordine della pagina. */
export const PERSONALIZZAZIONI = CAMPI.filter((c) => c.personalizzazione).map((c) => c.nome);
export const MISURE = S.misure.campi;
export const COLORI = S.colori_filo;
export const SPEDIZIONI = S.spedizione.opzioni;
// le sigle delle province italiane (per il campo «Provincia»)
const PROVINCE = new Set(('AG AL AN AO AP AQ AR AT AV BA BG BI BL BN BO BR BS BT BZ CA CB CE CH CL CN CO CR CS CT CZ EN FC FE FG FI FM FR GE GO GR '
  + 'IM IS KR LC LE LI LO LT LU MB MC ME MI MN MO MS MT NA NO NU OR PA PC PD PE PG PI PN PO PR PT PU PV PZ RA RC RE RG RI RM RN RO SA SI SO SP SR SS SU SV '
  + 'TA TE TN TO TP TR TS TV UD VA VB VC VE VI VR VT VV').split(' '));

/** Un numero scritto con la virgola o con il punto; NaN se non è un numero. */
export function numero(v) {
  const s = pulito(v).replace(',', '.');
  return /^\d{1,3}(\.\d{1,2})?$/.test(s) ? Number(s) : NaN;
}

/** Quali personalizzazioni ha l'ordine (i nomi dei campi). */
export function personalizzazioni(o) {
  const attive = {
    taschino: o.taschino === 'si',
    asola: o.asola === 'si',
    bottone: !!o.bottone && o.bottone !== 'tinta',
    // ripulito come in controllaOrdine e ordinePulito: uno spazio solo non è un colore, e non deve far salire il prezzo
    filato_bottone: !!pulito(o.filato_bottone),
    iniziali: o.iniziali === 'si',
    interno_collo: o.interno_collo === 'personalizzato',
    interno_polso: o.interno_polso === 'personalizzato',
    polsino: o.polsino === 'personalizzato',
  };
  return PERSONALIZZAZIONI.filter((n) => attive[n]);
}

/** Il prezzo di una camicia con `n` personalizzazioni. */
export function prezzoCamicia(n) {
  const p = S.prezzi;
  if (n >= PERSONALIZZAZIONI.length) return p.tutte;
  let prezzo = p.base;
  for (const s of p.scaglioni) if (n >= s.da) prezzo = s.prezzo;
  return prezzo;
}

/**
 * I conti dell'ordine, in euro interi. `spedizione` è null finché non si è scelto tra ritiro e spedizione.
 * @returns {{ personalizzazioni: string[], camicia: number, quantita: number, capi: number, spedizione: number|null, gratis: boolean, totale: number }}
 */
export function conti(o) {
  const quante = personalizzazioni(o);
  const camicia = prezzoCamicia(quante.length);
  const q = Number.parseInt(o.quantita, 10);
  const quantita = Number.isFinite(q) && q >= 1 ? q : 1;
  const capi = camicia * quantita;
  const modo = SPEDIZIONI.find((s) => s.id === o.spedizione);
  const gratis = !!modo && modo.prezzo > 0 && capi >= S.spedizione.gratis_da;
  const spedizione = modo ? (gratis ? 0 : modo.prezzo) : null;
  return { personalizzazioni: quante, camicia, quantita, capi, spedizione, gratis, totale: capi + (spedizione || 0) };
}

/** Le lettere delle iniziali: maiuscole, senza spazi né punti. */
export const lettere = (v) => pulito(v).toUpperCase().replace(/[\s.]/g, '');

/**
 * Controlla un passo, o tutto l'ordine. Restituisce { campo: frase } per ciò che non va (vuoto se va tutto bene).
 * @param {object} d        i dati piatti del modulo
 * @param {object} [quali]  { passo: 'camicia'|'misure'|'dati'|'spedizione'|'pagamento' (niente: tutti),
 *                           tessuti: un Set con gli id dei tessuti che esistono (solo il Worker lo passa) }
 */
export function controllaOrdine(d, { passo = '', tessuti = null } = {}) {
  const e = {};
  const E = S.errori;
  const tutto = !passo;
  const tessuto = (nome) => {
    const v = pulito(d[nome]);
    if (!v || !ID.test(v) || (tessuti && !tessuti.has(v))) e[nome] = E[nome] || E.tessuto;
  };
  const tra = (nome, opzioni) => { if (!opzioni.some((x) => x.id === d[nome])) e[nome] = E[nome] || E.scelta; };

  if (tutto || passo === 'camicia') {
    const c = campo('quantita');
    const q = pulito(d.quantita);
    if (!/^\d{1,3}$/.test(q) || Number(q) < c.min || Number(q) > c.max) e.quantita = E.quantita;
    tessuto('tessuto');
    tra('collo', campo('collo').opzioni);
    if (d.taschino === 'si') tessuto('taschino_tessuto'); else if (d.taschino !== 'no') e.taschino = E.scelta;
    if (d.asola === 'si') tra('asola_colore', COLORI); else if (d.asola !== 'no') e.asola = E.scelta;
    tra('bottone', campo('bottone').opzioni);
    const minimo = campo('bottone').opzioni.find((x) => x.id === d.bottone)?.quantita_minima;
    if (minimo && !e.quantita && Number(q) < minimo) e.bottone = E.bottone_minimo;
    if (pulito(d.filato_bottone)) tra('filato_bottone', COLORI);
    if (d.iniziali === 'si') {
      tra('iniziali_posizione', campo('iniziali').se_si[0].opzioni);
      if (!/^\p{L}{1,3}$/u.test(lettere(d.iniziali_lettere))) e.iniziali_lettere = E.iniziali_lettere;
    } else if (d.iniziali !== 'no') e.iniziali = E.scelta;
    for (const nome of ['interno_collo', 'interno_polso', 'polsino']) {
      if (d[nome] === 'personalizzato') tessuto(`${nome}_tessuto`); else if (d[nome] !== 'standard') e[nome] = E.scelta;
    }
  }
  if (tutto || passo === 'misure') {
    for (const m of MISURE) {
      const v = pulito(d[m.nome]);
      if (!v) { e[m.nome] = E.misura_vuota; continue; }
      const n = numero(v);
      if (!(n >= m.min && n <= m.max)) e[m.nome] = S.misure.errore_misura.replace('{min}', m.min).replace('{max}', m.max);
    }
  }
  if (tutto || passo === 'dati') {
    for (const nome of ['nome', 'telefono', 'email']) {
      const frase = controlla(nome, d[nome], { obbligatorio: true });
      if (frase) e[nome] = frase;
    }
  }
  if (tutto || passo === 'spedizione') {
    const modo = SPEDIZIONI.find((s) => s.id === d.spedizione);
    if (!modo) e.spedizione = E.spedizione;
    else if (modo.prezzo > 0 || modo.giorni) {
      const chi = controlla('nome', d.destinatario, { obbligatorio: true });
      if (chi) e.destinatario = chi;
      const via = pulito(d.indirizzo);
      if (via.length < 5 || !/\p{L}/u.test(via) || /https?:|www\./i.test(via)) e.indirizzo = E.indirizzo;
      if (!/^\d{5}$/.test(pulito(d.cap))) e.cap = E.cap;
      const citta = controlla('citta', d.citta, { obbligatorio: true });
      if (citta) e.citta = citta;
      if (!PROVINCE.has(pulito(d.provincia).toUpperCase())) e.provincia = E.provincia;
      if (/https?:|www\./i.test(pulito(d.note_consegna))) e.note_consegna = E.note_consegna;
    }
  }
  if (tutto || passo === 'pagamento') {
    if (!(d.privacy === 'si' || d.privacy === 'on' || d.privacy === true)) e.privacy = E.privacy;
  }
  return e;
}

/**
 * L'ordine ripulito, come lo salva e lo manda il Worker: solo i campi che contano per le scelte fatte (il tessuto del
 * taschino sparisce se il taschino è «no»), numeri al posto dei testi. Da chiamare dopo `controllaOrdine` senza errori.
 */
export function ordinePulito(d) {
  const o = {
    quantita: Number.parseInt(pulito(d.quantita), 10),
    tessuto: pulito(d.tessuto),
    collo: d.collo,
    taschino: d.taschino === 'si' ? { tessuto: pulito(d.taschino_tessuto) } : null,
    asola: d.asola === 'si' ? { colore: d.asola_colore } : null,
    bottone: d.bottone,
    filato_bottone: pulito(d.filato_bottone) || null,
    iniziali: d.iniziali === 'si' ? { posizione: d.iniziali_posizione, lettere: lettere(d.iniziali_lettere) } : null,
    interno_collo: d.interno_collo === 'personalizzato' ? { tessuto: pulito(d.interno_collo_tessuto) } : null,
    interno_polso: d.interno_polso === 'personalizzato' ? { tessuto: pulito(d.interno_polso_tessuto) } : null,
    polsino: d.polsino === 'personalizzato' ? { tessuto: pulito(d.polsino_tessuto) } : null,
    misure: Object.fromEntries(MISURE.map((m) => [m.nome, numero(d[m.nome])])),
    cliente: { nome: pulito(d.nome), telefono: pulito(d.telefono), email: pulito(d.email) },
    spedizione: { modo: d.spedizione },
  };
  const modo = SPEDIZIONI.find((s) => s.id === d.spedizione);
  if (modo && (modo.prezzo > 0 || modo.giorni)) {
    o.spedizione.indirizzo = {
      destinatario: pulito(d.destinatario), indirizzo: pulito(d.indirizzo), cap: pulito(d.cap), citta: pulito(d.citta),
      provincia: pulito(d.provincia).toUpperCase(), note: pulito(d.note_consegna),
    };
  }
  o.conti = conti(d);
  return o;
}
