// Logica delle taglie: dalle misure scritte dal cliente alla taglia di partenza con le variazioni, cioè la riga
// che il reparto legge nell'ordine: «Taglia 41 · collo +2 cm · manica −6 cm».
//
// Regole confermate dal titolare di Endero (novembre 2026):
// - il cliente misura il proprio corpo; i fogli riportano la camicia campione di ogni taglia: prima del confronto
//   a ogni misura del cliente si aggiunge l'agio, che decide il sarto;
// - la taglia si sceglie con tutte le misure insieme, e pesano di più collo, spalle e torace;
// - la taglia è il giro collo in centimetri (41 = 41 cm);
// - una differenza diventa variazione da mezzo centimetro in su, arrotondata al mezzo centimetro;
// - nella riga compaiono solo le voci che cambiano;
// - se le misure sono fuori dalle otto taglie, o una variazione è molto grande, si parte comunque dalla taglia più
//   vicina e l'ordine arriva segnato «da verificare con il cliente»;
// - il polso non si confronta (sui fogli c'è l'altezza del polsino, non il giro): arriva così com'è.
//
// Qui non c'è nessuna misura di Endero. La tabella delle camicie campione e i numeri del sarto stanno nella
// configurazione riservata del Worker (un JSON, vedi `leggiConfigurazione`), mai nel repository.
// Scelte nostre, da far vedere al sarto: come si misura "la più vicina" (vedi `scegliTaglia`) e il peso doppio.

/** Le misure del riquadro, nell'ordine del foglio. `riga` è il nome nella riga per il reparto. */
export const VOCI = [
  { campo: 'giro_collo', nome: 'Giro collo', riga: 'collo', peso: 2 },
  { campo: 'spalla', nome: 'Spalla', riga: 'spalla', peso: 2 },
  { campo: 'spallina', nome: 'Spallina', riga: 'spallina', peso: 1 },
  { campo: 'torace', nome: 'Torace', riga: 'torace', peso: 2 },
  { campo: 'pancia', nome: 'Pancia', riga: 'pancia', peso: 1 },
  { campo: 'bacino', nome: 'Bacino', riga: 'bacino', peso: 1 },
  { campo: 'lunghezza_manica', nome: 'Lunghezza manica', riga: 'manica', peso: 1 },
  { campo: 'braccio', nome: 'Braccio', riga: 'braccio', peso: 1 },
  { campo: 'avambraccio', nome: 'Avambraccio', riga: 'avambraccio', peso: 1 },
  { campo: 'polso', nome: 'Polso', riga: 'polso', confronto: false },
  { campo: 'lunghezza_davanti', nome: 'Lunghezza davanti', riga: 'lunghezza davanti', peso: 1 },
  { campo: 'lunghezza_dietro', nome: 'Lunghezza dietro', riga: 'lunghezza dietro', peso: 1 },
];
const CONFRONTATE = VOCI.filter((v) => v.confronto !== false);

const finito = (n) => typeof n === 'number' && Number.isFinite(n);

/** Un numero scritto all'italiana ("41,5") o già numero; altrimenti undefined. */
export function centimetri(v) {
  if (finito(v)) return v;
  if (typeof v !== 'string') return undefined;
  const t = v.trim().replace(',', '.');
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(t)) return undefined;
  return parseFloat(t);
}

/** 2 → "2", 1.5 → "1,5". */
const cifra = (n) => String(Math.round(n * 100) / 100).replace('.', ',');
/** +2 → "+2 cm", -6 → "−6 cm" (con il segno meno vero, come nell'esempio del titolare). */
const conSegno = (n) => `${n < 0 ? '−' : '+'}${cifra(Math.abs(n))} cm`;

/**
 * La configurazione riservata: un JSON con
 *   taglie   [38, 39, …]                      i numeri delle taglie, in ordine
 *   misure   { spalla: [..], torace: [..] }   per ogni misura confrontata, la camicia campione taglia per taglia
 *                                             (il collo non serve: è il numero della taglia)
 *   regole   { agio: { giro_collo: n, … },    centimetri da aggiungere alla misura del corpo (0 se non serve)
 *              verifica: n,                    da quanti centimetri una variazione va controllata (facoltativo)
 *              soglia: 0.5, passo: 0.5,        facoltativi
 *              pesi: { campo: n } }            facoltativi: sostituiscono i pesi scritti qui sopra
 * Restituisce la configurazione controllata, o lancia un errore che dice cosa manca.
 */
export function leggiConfigurazione(testo) {
  let c;
  try { c = typeof testo === 'string' ? JSON.parse(testo) : testo; } catch { throw new Error('La configurazione delle taglie non è un JSON valido.'); }
  if (!c || !Array.isArray(c.taglie) || c.taglie.length < 2 || !c.taglie.every(finito)) throw new Error('Nella configurazione delle taglie manca l\'elenco "taglie".');
  if (!c.misure || typeof c.misure !== 'object') throw new Error('Nella configurazione delle taglie mancano le "misure".');
  for (const v of CONFRONTATE) {
    if (v.campo === 'giro_collo' && !c.misure.giro_collo) continue;
    const riga = c.misure[v.campo];
    if (!Array.isArray(riga) || riga.length !== c.taglie.length || !riga.every(finito)) throw new Error(`Nella configurazione delle taglie la misura "${v.campo}" deve avere un numero per ogni taglia.`);
  }
  return { taglie: c.taglie, misure: c.misure, regole: c.regole && typeof c.regole === 'object' ? c.regole : {} };
}

/**
 * Sceglie la taglia di partenza e scrive le variazioni.
 *
 * `misure` è ciò che ha scritto il cliente ({ giro_collo: '41', torace: 104.5, … }; vale anche il vecchio nome
 * "taglia" per il giro collo). `configurazione` è quella di `leggiConfigurazione`.
 *
 * Come si misura la taglia più vicina: per ogni taglia, a ogni misura del cliente si aggiunge l'agio e si guarda
 * quanto dista dalla camicia campione. La distanza si conta in taglie, non in centimetri (un centimetro di collo
 * è una taglia intera, un centimetro di torace è un quinto di taglia), si moltiplica per il peso della misura e
 * si somma: vince la taglia con la somma più bassa. A parità, quella con il collo più vicino.
 */
export function scegliTaglia(misure, configurazione) {
  const { taglie, misure: tabella, regole } = configurazione;
  const soglia = finito(regole.soglia) ? regole.soglia : 0.5, passo = finito(regole.passo) ? regole.passo : 0.5;
  const agio = regole.agio || {}, pesi = regole.pesi || {};
  const n = taglie.length;
  const scritte = { ...misure };
  if (scritte.giro_collo == null && scritte.taglia != null) scritte.giro_collo = scritte.taglia;

  const motivi = [];
  const voci = [];           // le misure che entrano nel confronto, già con l'agio
  const mancanti = [], senzaAgio = [];
  for (const v of CONFRONTATE) {
    const corpo = centimetri(scritte[v.campo]);
    if (corpo === undefined) { mancanti.push(v.nome.toLowerCase()); continue; }
    if (!finito(agio[v.campo])) senzaAgio.push(v.nome.toLowerCase());
    const campione = v.campo === 'giro_collo' && !tabella.giro_collo ? taglie : tabella[v.campo];
    // quanto cambia la misura da una taglia alla successiva, in media: è il metro con cui si contano le distanze
    const scala = Math.abs(campione[n - 1] - campione[0]) / (n - 1);
    voci.push({ ...v, camicia: corpo + (finito(agio[v.campo]) ? agio[v.campo] : 0), campione, scala, peso: finito(pesi[v.campo]) ? pesi[v.campo] : v.peso });
  }
  if (!voci.length) return { taglia: null, variazioni: [], riga: '', daVerificare: true, motivi: ['non c\'è nessuna misura da confrontare'] };

  let scelta = 0, minima = Infinity, colloMinimo = Infinity;
  for (let i = 0; i < n; i++) {
    let somma = 0, collo = 0;
    for (const v of voci) {
      if (!v.scala) continue;
      const taglieDiDistanza = Math.abs(v.camicia - v.campione[i]) / v.scala;
      somma += v.peso * taglieDiDistanza;
      if (v.campo === 'giro_collo') collo = taglieDiDistanza;
    }
    if (somma < minima - 1e-9 || (Math.abs(somma - minima) <= 1e-9 && collo < colloMinimo - 1e-9)) { scelta = i; minima = somma; colloMinimo = collo; }
  }

  // fuori dalle taglie: scelta la prima o l'ultima, e in media il cliente sta oltre di più di mezza taglia
  if (scelta === 0 || scelta === n - 1) {
    let oltre = 0, peso = 0;
    for (const v of voci) if (v.scala) { oltre += v.peso * (v.camicia - v.campione[scelta]) / v.scala * Math.sign(v.campione[n - 1] - v.campione[0] || 1); peso += v.peso; }
    const media = peso ? oltre / peso : 0;
    if (scelta === 0 && media < -0.5) motivi.push(`misure più piccole della taglia ${taglie[0]}`);
    if (scelta === n - 1 && media > 0.5) motivi.push(`misure più grandi della taglia ${taglie[n - 1]}`);
  }

  const variazioni = [];
  for (const v of voci) {
    const differenza = Math.round((v.camicia - v.campione[scelta]) * 100) / 100;
    if (Math.abs(differenza) < soglia) continue;
    const cm = Math.sign(differenza) * Math.max(passo, Math.round(Math.abs(differenza) / passo) * passo);
    variazioni.push({ campo: v.campo, voce: v.riga, cm });
  }
  if (finito(regole.verifica)) {
    const grandi = variazioni.filter((v) => Math.abs(v.cm) >= regole.verifica);
    if (grandi.length) motivi.push(`variazione grande: ${grandi.map((v) => `${v.voce} ${conSegno(v.cm)}`).join(', ')}`);
  }
  if (mancanti.length) motivi.push(`misure non scritte: ${mancanti.join(', ')}`);
  if (senzaAgio.length) motivi.push(`agio non ancora impostato: ${senzaAgio.join(', ')}`);

  const riga = [`Taglia ${taglie[scelta]}`, ...variazioni.map((v) => `${v.voce} ${conSegno(v.cm)}`)].join(' · ');
  return { taglia: taglie[scelta], variazioni, riga, daVerificare: motivi.length > 0, motivi };
}

/** Tutte le misure scritte dal cliente, nell'ordine del foglio: vanno sotto la riga, per controllo. */
export function misureScritte(misure) {
  const scritte = { ...misure };
  if (scritte.giro_collo == null && scritte.taglia != null) scritte.giro_collo = scritte.taglia;
  return VOCI.map((v) => ({ nome: v.nome, cm: centimetri(scritte[v.campo]) })).filter((m) => m.cm !== undefined);
}

/** Il blocco di testo per l'ordine che arriva in azienda: la riga, l'eventuale avviso, e sotto le misure del cliente. */
export function perIlReparto(misure, configurazione) {
  const r = scegliTaglia(misure, configurazione);
  const righe = [r.riga || 'Taglia non calcolata'];
  if (r.daVerificare) righe.push(`DA VERIFICARE CON IL CLIENTE: ${r.motivi.join('; ')}`);
  righe.push(`Misure scritte dal cliente: ${misureScritte(misure).map((m) => `${m.nome.toLowerCase()} ${cifra(m.cm)}`).join(' · ')}`);
  return { ...r, testo: righe.join('\n') };
}
