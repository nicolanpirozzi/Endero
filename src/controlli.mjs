// I controlli dei campi dei moduli (proprietario, 2026-11-25). Li usa la pagina mentre si compila (src/sito.js: l'avviso
// compare sotto il campo) e il Worker a ogni invio (worker/index.js): senza script, o con uno script aggirato, vale
// lo stesso controllo. Le frasi stanno in contenuti/it/controlli.json.
//
// Ogni controllo prende il valore scritto e restituisce '' se va bene, altrimenti la frase da mostrare.
// Regole larghe con chi scrive giusto in un modo insolito (revisione del 2026-11-25: numeri incollati dalla rubrica
// dell'iPhone, «(+39)», prefissi esteri, nomi cinesi, partite IVA svizzere), strette con ciò che finisce nelle email:
// niente indirizzi web nascosti in nome, città e Paese, niente caratteri strani nell'email.

import testi from '../contenuti/it/controlli.json';

export { testi };

// caratteri invisibili che arrivano incollando: la rubrica e il telefono dell'iPhone racchiudono i numeri tra segni di
// direzione del testo, WhatsApp pure. Restano ZWJ e ZWNJ (U+200C, U+200D), che fanno parte di alcune scritture.
const INVISIBILI = /[­​‎‏‪-‮⁠-⁤⁦-⁩﻿]/g;
/** Il valore senza i caratteri invisibili: il Worker lo usa per ciò che salva e manda per email. */
export const senzaInvisibili = (v) => String(v ?? '').replace(INVISIBILI, '');
const spazi = (v) => senzaInvisibili(v).replace(/\s+/g, ' ').trim();
const haLettere = (s) => /\p{L}/u.test(s);
// un punto seguito da due lettere è un indirizzo web («premio.truffa.it»), non un'iniziale («J.R.» o «D.C.»)
const sembraIndirizzo = (s) => /\.\p{L}{2}/u.test(s);
const CJK = /[\p{Script=Han}\p{Script=Hangul}\p{Script=Hiragana}\p{Script=Katakana}]/u;

/** Nome e cognome: almeno due parole, solo lettere (con apostrofi, trattini e punti, come «D'Angelo» o «De Rosa»). */
function nome(v, { obbligatorio = true } = {}) {
  const s = spazi(v);
  if (!s) return obbligatorio ? testi.nome.vuoto : '';
  if (/[^\p{L}\p{M} '’.-]/u.test(s) || sembraIndirizzo(s)) return testi.nome.caratteri;
  // in cinese, giapponese e coreano nome e cognome si scrivono attaccati
  if (CJK.test(s) && [...s.replace(/\s/g, '')].length >= 2) return '';
  if (s.split(' ').filter(haLettere).length < 2) return testi.nome.cognome;
  return '';
}

// ---------------------------------------------------------------- Paese

// il nome del Paese ridotto all'osso: minuscole, senza accenti né punteggiatura
const normale = (s) => spazi(s).toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
// i Paesi dove si chiama con i numeri italiani (anche scritti a modo proprio)
const ITALIANI = new Set(['italia', 'italy', 'italie', 'italien', 'it', 'ita', 'repubblica italiana', 'san marino', 'repubblica di san marino',
  'vaticano', 'citta del vaticano', 'stato della citta del vaticano', 'santa sede']);
/** Vero se il Paese scritto è l'Italia (o è vuoto: i moduli senza Paese sono italiani). */
export const italiano = (paese) => !normale(paese) || ITALIANI.has(normale(paese));

// i codici dei Paesi del mondo: con i loro nomi (in italiano, inglese, francese, tedesco, spagnolo) si riconosce un
// Paese estero scritto nel campo. Un nome che non si riconosce (una regione, un errore) non cambia nulla.
const CODICI = 'AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IM IN IQ IR IS JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SK SL SN SO SR SS ST SV SX SY SZ TC TD TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW'.split(' ');
const ALTRI_NOMI = ['usa', 'uk', 'inghilterra', 'england', 'scozia', 'scotland', 'galles', 'wales', 'olanda', 'holland', 'stati uniti d america', 'america', 'emirati', 'russia'];
let esteri = null;
function paeseEstero(paese) {
  const n = normale(paese);
  if (!n || ITALIANI.has(n)) return false;
  if (!esteri) {
    esteri = new Set(ALTRI_NOMI);
    try {
      for (const lingua of ['it', 'en', 'fr', 'de', 'es']) {
        const nomi = new Intl.DisplayNames([lingua], { type: 'region' });
        for (const c of CODICI) { esteri.add(normale(nomi.of(c) || '')); esteri.add(c.toLowerCase()); }
      }
    } catch { /* senza i nomi dei Paesi resta l'elenco corto */ }
    esteri.delete('it');
  }
  return esteri.has(n);
}

// ---------------------------------------------------------------- telefono

/**
 * Le cifre del numero col prefisso del Paese davanti (senza +), oppure un errore. Un numero senza prefisso è
 * italiano, a meno che il Paese del modulo dica altro: cellulari di 9 o 10 cifre che cominciano per 3, fissi da 6 a
 * 11 cifre che cominciano per 0.
 */
function leggiTelefono(v, paese = '') {
  let s = spazi(v)
    .replace(/[‐-―−]/g, '-')              // trattini tipografici
    .replace(/^\(\s*(\+?\d{1,4})\s*\)/, '$1');           // «(+39) 333…» come sui biglietti da visita
  if (!s) return { errore: 'vuoto' };
  if (/[^\d+ ().\/-]/.test(s) || s.indexOf('+') > 0 || (s.match(/\+/g) || []).length > 1) return { errore: 'caratteri' };
  // «+44 (0) 20…»: lo zero tra parentesi si scrive ma non si compone dall'estero
  // (in Italia invece lo zero è parte del numero: «+39 (0)81…» resta 081)
  s = /^(\+|00)\s*0?39/.test(s) ? s.replace(/\(\s*0\s*\)/g, '0') : s.replace(/\(\s*0\s*\)/g, '');
  let cifre = s.replace(/\D/g, '');
  let estero = s.startsWith('+');
  if (!estero && cifre.startsWith('00')) { estero = true; cifre = cifre.slice(2); }
  if (estero) cifre = cifre.replace(/^00/, '').replace(/^0(?=39)/, '');   // «+0039», «+039»
  // «39 333 1234567» scritto senza +: undici o dodici cifre che cominciano per 39 e poi 0 o 3
  if (!estero && cifre.length >= 11 && cifre.startsWith('39') && /^[03]/.test(cifre.slice(2))) { estero = true; }
  if (!estero && !italiano(paese) && paeseEstero(paese)) return { errore: 'estero' };
  let nazionale = cifre;
  if (estero) {
    if (cifre.startsWith('0')) return { errore: 'prefisso' };
    if (cifre.length < 8) return { errore: 'corto' };
    if (cifre.length > 15) return { errore: 'lungo' };
    if (!cifre.startsWith('39')) return /^(\d)\1+$/.test(cifre.slice(2)) ? { errore: 'corto' } : { numero: cifre };
    nazionale = cifre.slice(2);
  }
  if (/^3/.test(nazionale)) {
    if (nazionale.length < 9) return { errore: 'corto' };
    if (nazionale.length > 10) return { errore: 'lungo' };
  } else if (/^0/.test(nazionale)) {
    if (nazionale.length < 6) return { errore: 'corto' };
    if (nazionale.length > 11) return { errore: 'lungo' };
  } else if (/^[18]/.test(nazionale)) {
    return { errore: 'speciale' };                         // numeri verdi, a pagamento, di emergenza
  } else {
    return { errore: estero ? 'corto' : 'estero' };
  }
  if (/^(\d)\1+$/.test(nazionale.slice(1))) return { errore: 'corto' };
  return { numero: '39' + nazionale };
}

function telefono(v, { obbligatorio = true, paese = '' } = {}) {
  const { errore } = leggiTelefono(v, paese);
  if (errore === 'vuoto') return obbligatorio ? testi.telefono.vuoto : '';
  return errore ? testi.telefono[errore] : '';
}

/** Il numero per i link di WhatsApp (wa.me/<cifre>) e del telefono (tel:+<cifre>); '' se non si capisce. */
export function numeroInternazionale(v, paese = '') {
  return leggiTelefono(v, paese).numero || '';
}

// ---------------------------------------------------------------- email

// una chiocciola, prima lettere, cifre, punto, trattino, trattino basso, + e apostrofo (i caratteri che le caselle
// usano davvero: ? & = % / cambierebbero il destinatario di un link mailto), dopo un dominio con il punto
const EMAIL = /^[A-Za-z0-9_'+-]+(\.[A-Za-z0-9_'+-]+)*@([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,24}$/;

function email(v, { obbligatorio = false } = {}) {
  const s = senzaInvisibili(v).trim();
  if (!s) return obbligatorio ? testi.email.vuota : '';
  if (s.length > 160 || s.split('@')[0].length > 64 || !EMAIL.test(s)) return testi.email.formato;
  return '';
}

// le caselle più usate in Italia (e all'estero, per i rivenditori): un dominio a una o due lettere di distanza da
// uno di questi è probabilmente un errore di battitura. L'ordine conta: a pari distanza vince il primo.
const NOTI = ['gmail.com', 'libero.it', 'hotmail.it', 'hotmail.com', 'yahoo.it', 'yahoo.com', 'outlook.it', 'outlook.com',
  'icloud.com', 'live.it', 'live.com', 'virgilio.it', 'alice.it', 'tiscali.it', 'tin.it', 'tim.it', 'fastwebnet.it',
  'email.it', 'me.com', 'mac.com', 'msn.com', 'inwind.it', 'iol.it', 'pec.it', 'legalmail.it', 'aruba.it', 'arubapec.it',
  'googlemail.com', 'ymail.com', 'mail.com', 'email.com', 'aol.com', 'protonmail.com', 'protonmail.ch', 'proton.me',
  'gmx.de', 'gmx.com', 'gmx.net', 'web.de', 't-online.de', 'orange.fr', 'free.fr', 'sfr.fr', 'laposte.net', 'wanadoo.fr',
  'bluewin.ch', 'yandex.ru', 'mail.ru', 'qq.com', '163.com', 'naver.com'];
// i marchi che hanno caselle in molti Paesi: hotmail.de o yahoo.co.jp sono veri, non errori di battitura
const MARCHI = ['hotmail', 'outlook', 'live', 'yahoo', 'gmx', 'aol', 'msn', 'windowslive'];
const PAESI_POSTA = /^(de|fr|es|nl|be|ch|at|ca|pt|gr|ie|dk|se|no|fi|pl|cz|sk|hu|ro|bg|hr|si|ru|tr|jp|in|cn|kr|ar|mx|br|cl|co|au|nz|sg|hk|tw|za|co\.uk|co\.jp|co\.in|co\.kr|co\.za|co\.nz|co\.id|com\.br|com\.ar|com\.mx|com\.au|com\.tr|com\.sg|com\.hk|com\.tw|com\.my|com\.ph|com\.vn)$/;
// desinenze sbagliate di domini che esistono solo con l'altra
const SCAMBI = { 'gmail.it': 'gmail.com', 'gmail.co': 'gmail.com', 'libero.com': 'libero.it', 'virgilio.com': 'virgilio.it', 'alice.com': 'alice.it', 'icloud.it': 'icloud.com', 'tiscali.com': 'tiscali.it', 'fastwebnet.com': 'fastwebnet.it' };

/** Quante modifiche servono per passare da a a b (anche lo scambio di due lettere vicine conta una). */
function distanza(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/** Se il dominio sembra un errore di battitura di una casella nota, l'indirizzo corretto; altrimenti ''. */
export function suggerisciEmail(v) {
  const s = senzaInvisibili(v).trim();
  const at = s.lastIndexOf('@');
  if (at < 1) return '';
  const dominio = s.slice(at + 1).toLowerCase();
  if (!dominio || NOTI.includes(dominio)) return '';
  const [marchio, ...resto] = dominio.split('.');
  if (MARCHI.includes(marchio) && PAESI_POSTA.test(resto.join('.'))) return '';
  let giusto = SCAMBI[dominio] || '';
  if (!giusto && dominio.length >= 5) {
    let migliore = 3;
    for (const n of NOTI) {
      const k = distanza(dominio, n);
      if (k < migliore && (k === 1 || dominio.length >= 8)) { migliore = k; giusto = n; }
    }
  }
  return giusto ? s.slice(0, at) + '@' + giusto : '';
}

// ---------------------------------------------------------------- città, Paese, partita IVA, sito

/** Città o Paese: lettere, spazi, apostrofi, trattini, punti, virgole, & e parentesi; nessuna cifra. */
function luogo(chiave) {
  return (v, { obbligatorio = true } = {}) => {
    const s = spazi(v);
    if (!s) return obbligatorio ? testi[chiave].vuota : '';
    if (/[^\p{L}\p{M} '’.,&()\/-]/u.test(s) || !haLettere(s) || sembraIndirizzo(s)) return testi[chiave].caratteri;
    return '';
  };
}

/** Partita IVA (facoltativa): in Italia 11 cifre con la cifra di controllo giusta; all'estero da 4 a 15 tra lettere e cifre. */
function partitaIva(v, { paese = '' } = {}) {
  const s = spazi(v)
    .replace(/^(P(artita)?\.?\s*IVA|VAT|USt-?IdNr\.?|TVA|NIF|CIF)[:\s.]*/i, '')    // la sigla copiata dalla carta intestata
    .replace(/[\s.-]/g, '').toUpperCase();
  if (!s) return '';
  if (!italiano(paese) && !/^IT\d/.test(s)) return /^[A-Z0-9]{4,15}$/.test(s.replace(/(MWST|TVA|IVA)$/, '')) ? '' : testi.partita_iva.estera;
  const n = s.replace(/^IT/, '');
  if (!/^\d{11}$/.test(n)) return testi.partita_iva.cifre;
  const c = [...n].map(Number);
  let somma = 0;
  for (let i = 0; i < 10; i++) somma += i % 2 === 0 ? c[i] : (2 * c[i] > 9 ? 2 * c[i] - 9 : 2 * c[i]);
  return (10 - (somma % 10)) % 10 === c[10] ? '' : testi.partita_iva.sbagliata;
}

/** Sito o Instagram (facoltativo): un indirizzo web, @nome, oppure il nome del profilo da solo. */
function profilo(v) {
  const s = spazi(v);
  if (!s) return '';
  const instagram = /^@?[A-Za-z0-9._]{1,30}$/.test(s);
  const sito = /^(https?:\/\/)?([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,24}(:\d{2,5})?([/?#]\S*)?$/i.test(s);
  return instagram || sito ? '' : testi.profilo.formato;
}

/** Il messaggio: basta che ci sia, dove è obbligatorio. */
function messaggio(v, { obbligatorio = false } = {}) {
  return obbligatorio && !spazi(v) ? testi.messaggio.vuoto : '';
}

/** Oggi in Italia, come AAAA-MM-GG (il giorno della presa misure non può essere passato). */
export function oggiInItalia(adesso = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(adesso);
  } catch {
    return adesso.toISOString().slice(0, 10);
  }
}

/** Il giorno preferito (facoltativo): da oggi in poi. */
function giorno(v, { oggi = oggiInItalia() } = {}) {
  const s = String(v ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && s < oggi ? testi.giorno.passato : '';
}

const CONTROLLI = { nome, telefono, email, citta: luogo('citta'), nazione: luogo('nazione'), partita_iva: partitaIva, profilo, messaggio, giorno };

/** I campi che hanno un controllo (in pagina: data-controllo con uno di questi nomi). */
export const CAMPI = Object.keys(CONTROLLI);

/** Controlla un campo: `quale` è uno dei CAMPI; contesto: { obbligatorio, paese, oggi }. '' se va bene. */
export function controlla(quale, valore, contesto = {}) {
  const f = CONTROLLI[quale];
  return f ? f(valore, contesto) : '';
}
