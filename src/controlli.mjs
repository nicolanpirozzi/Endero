// I controlli dei campi dei moduli (proprietario, 2026-11-25). Li usa la pagina mentre si compila (src/sito.js: l'avviso
// compare sotto il campo) e il Worker a ogni invio (worker/index.js): senza script, o con uno script aggirato, vale
// lo stesso controllo. Le frasi stanno in contenuti/it/controlli.json.
//
// Ogni controllo prende il valore scritto e restituisce '' se va bene, altrimenti la frase da mostrare.

import testi from '../contenuti/it/controlli.json';

export { testi };

const spazi = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
const haLettere = (s) => /\p{L}/u.test(s);

/** Nome e cognome: almeno due parole, solo lettere (con apostrofi, trattini e punti, come «D'Angelo» o «De Rosa»). */
function nome(v, { obbligatorio = true } = {}) {
  const s = spazi(v);
  if (!s) return obbligatorio ? testi.nome.vuoto : '';
  if (/[^\p{L}\p{M} '’.-]/u.test(s)) return testi.nome.caratteri;
  if (s.split(' ').filter(haLettere).length < 2) return testi.nome.cognome;
  return '';
}

/**
 * Le cifre del numero col prefisso del Paese davanti (senza +), oppure un errore. Un numero senza prefisso è
 * italiano: cellulari di 9 o 10 cifre che cominciano per 3, fissi da 6 a 11 cifre che cominciano per 0.
 */
function leggiTelefono(v) {
  const s = spazi(v);
  if (!s) return { errore: 'vuoto' };
  if (/[^\d+ ().\/-]/.test(s) || s.indexOf('+') > 0 || (s.match(/\+/g) || []).length > 1) return { errore: 'caratteri' };
  let cifre = s.replace(/\D/g, '');
  let estero = s.startsWith('+');
  if (!estero && cifre.startsWith('00')) { estero = true; cifre = cifre.slice(2); }
  // «39 333 1234567» scritto senza +: dodici cifre che cominciano per 39 sono il prefisso italiano e un cellulare
  if (!estero && cifre.length >= 11 && cifre.startsWith('39') && /^[03]/.test(cifre.slice(2))) { estero = true; }
  let nazionale = cifre;
  if (estero) {
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
  } else {
    return { errore: estero ? 'corto' : 'estero' };
  }
  if (/^(\d)\1+$/.test(nazionale.slice(1))) return { errore: 'corto' };
  return { numero: '39' + nazionale };
}

function telefono(v, { obbligatorio = true } = {}) {
  const { errore } = leggiTelefono(v);
  if (errore === 'vuoto') return obbligatorio ? testi.telefono.vuoto : '';
  return errore ? testi.telefono[errore] : '';
}

/** Il numero per i link di WhatsApp (wa.me/<cifre>) e del telefono (tel:+<cifre>); '' se non si capisce. */
export function numeroInternazionale(v) {
  return leggiTelefono(v).numero || '';
}

// l'indirizzo email: una chiocciola, un nome senza spazi, un dominio con il punto e una desinenza di sole lettere
const EMAIL = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,24}$/;

function email(v, { obbligatorio = false } = {}) {
  const s = String(v ?? '').trim();
  if (!s) return obbligatorio ? testi.email.vuota : '';
  if (s.length > 160 || s.split('@')[0].length > 64 || !EMAIL.test(s)) return testi.email.formato;
  return '';
}

// le caselle più usate in Italia (e qualcuna all'estero, per i rivenditori): un dominio a una o due lettere di
// distanza da uno di questi è probabilmente un errore di battitura
const NOTI = ['gmail.com', 'libero.it', 'hotmail.it', 'hotmail.com', 'yahoo.it', 'yahoo.com', 'outlook.it', 'outlook.com',
  'icloud.com', 'live.it', 'live.com', 'virgilio.it', 'alice.it', 'tiscali.it', 'tin.it', 'tim.it', 'fastwebnet.it',
  'email.it', 'me.com', 'msn.com', 'inwind.it', 'pec.it', 'legalmail.it', 'aruba.it', 'googlemail.com', 'protonmail.com',
  'proton.me', 'gmx.de', 'gmx.com', 'web.de', 'yahoo.fr', 'orange.fr', 'hotmail.fr', 'hotmail.co.uk', 'yahoo.co.uk', 'yahoo.es', 'hotmail.es'];
// desinenze sbagliate di domini che esistono solo con l'altra
const SCAMBI = { 'gmail.it': 'gmail.com', 'libero.com': 'libero.it', 'virgilio.com': 'virgilio.it', 'alice.com': 'alice.it', 'icloud.it': 'icloud.com', 'tiscali.com': 'tiscali.it', 'fastwebnet.com': 'fastwebnet.it' };

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
  const s = String(v ?? '').trim();
  const at = s.lastIndexOf('@');
  if (at < 1) return '';
  const dominio = s.slice(at + 1).toLowerCase();
  if (!dominio || NOTI.includes(dominio)) return '';
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

/** Città o Paese: lettere, spazi, apostrofi, trattini, punti e parentesi; nessuna cifra. */
function luogo(chiave) {
  return (v, { obbligatorio = true } = {}) => {
    const s = spazi(v);
    if (!s) return obbligatorio ? testi[chiave].vuota : '';
    if (/[^\p{L}\p{M} '’.()\/-]/u.test(s) || !haLettere(s)) return testi[chiave].caratteri;
    return '';
  };
}

const ITALIA = /^(italia|italy|italie|italien|it|ita)$/i;

/** Partita IVA (facoltativa): in Italia 11 cifre con la cifra di controllo giusta; all'estero da 4 a 15 tra lettere e cifre. */
function partitaIva(v, { paese = '' } = {}) {
  const s = String(v ?? '').replace(/[\s.-]/g, '').toUpperCase();
  if (!s) return '';
  const italiana = !spazi(paese) || ITALIA.test(spazi(paese)) || /^IT\d/.test(s);
  if (!italiana) return /^[A-Z0-9]{4,15}$/.test(s) ? '' : testi.partita_iva.estera;
  const n = s.replace(/^IT/, '');
  if (!/^\d{11}$/.test(n)) return testi.partita_iva.cifre;
  const c = [...n].map(Number);
  let somma = 0;
  for (let i = 0; i < 10; i++) somma += i % 2 === 0 ? c[i] : (2 * c[i] > 9 ? 2 * c[i] - 9 : 2 * c[i]);
  return (10 - (somma % 10)) % 10 === c[10] ? '' : testi.partita_iva.sbagliata;
}

/** Sito o Instagram (facoltativo): un indirizzo web, @nome, oppure il nome del profilo da solo. */
function profilo(v) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  const instagram = /^@?[A-Za-z0-9._]{1,30}$/.test(s);
  const sito = /^(https?:\/\/)?([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,24}(:\d{2,5})?([/?#]\S*)?$/.test(s);
  return instagram || sito ? '' : testi.profilo.formato;
}

/** Il messaggio: basta che ci sia, dove è obbligatorio. */
function messaggio(v, { obbligatorio = false } = {}) {
  return obbligatorio && !String(v ?? '').trim() ? testi.messaggio.vuoto : '';
}

const CONTROLLI = { nome, telefono, email, citta: luogo('citta'), nazione: luogo('nazione'), partita_iva: partitaIva, profilo, messaggio };

/** I campi che hanno un controllo (in pagina: data-controllo con uno di questi nomi). */
export const CAMPI = Object.keys(CONTROLLI);

/** Controlla un campo: `quale` è uno dei CAMPI; contesto: { obbligatorio, paese }. '' se va bene. */
export function controlla(quale, valore, contesto = {}) {
  const f = CONTROLLI[quale];
  return f ? f(valore, contesto) : '';
}
