// Controlla la logica delle taglie (worker/taglie.mjs).
//
//   node tools/prova-taglie.mjs [file JSON con la configurazione vera]
//
// I numeri qui sotto sono INVENTATI per la prova: otto taglie che crescono a passo regolare. Non sono le misure di
// Endero, che stanno solo nella configurazione riservata. Con un file in più (fuori dal repository) controlla anche
// che la configurazione vera si legga e che ogni camicia campione ritrovi la propria taglia.
import { readFileSync } from 'node:fs';
import { scegliTaglia, leggiConfigurazione, perIlReparto, centimetri, VOCI } from '../worker/taglie.mjs';

let passati = 0;
const falliti = [];
function controlla(nome, vero, dettaglio = '') {
  if (vero) passati++; else falliti.push(nome + (dettaglio ? ` (${dettaglio})` : ''));
  console.log(`${vero ? '  ok ' : '  NO '} ${nome}${!vero && dettaglio ? ' → ' + dettaglio : ''}`);
}

const TAGLIE = [38, 39, 40, 41, 42, 43, 44, 45];
const cresce = (da, passo) => TAGLIE.map((_, i) => Math.round((da + passo * i) * 10) / 10);
const AGIO = { giro_collo: 1, spalla: 0, spallina: 0, torace: 10, pancia: 10, bacino: 8, lunghezza_manica: 2, braccio: 6, avambraccio: 5, lunghezza_davanti: 0, lunghezza_dietro: 0 };
const finta = leggiConfigurazione(JSON.stringify({
  taglie: TAGLIE,
  misure: {
    spalla: cresce(44, 1), spallina: cresce(15, 0.5), torace: cresce(100, 4), pancia: cresce(90, 4), bacino: cresce(96, 4),
    lunghezza_manica: cresce(64, 1), braccio: cresce(34, 1.5), avambraccio: cresce(28, 1),
    lunghezza_davanti: cresce(66, 1), lunghezza_dietro: cresce(76, 1.5),
  },
  regole: { agio: AGIO, verifica: 8 },
}));
/** Il corpo di chi veste esattamente una taglia: la camicia campione meno l'agio. */
function corpo(taglia, configurazione = finta, agio = AGIO) {
  const i = configurazione.taglie.indexOf(taglia), m = { polso: 17 };
  for (const v of VOCI) {
    if (v.confronto === false) continue;
    const campione = v.campo === 'giro_collo' ? configurazione.taglie : configurazione.misure[v.campo];
    m[v.campo] = Math.round((campione[i] - (agio[v.campo] || 0)) * 100) / 100;
  }
  return m;
}

console.log('La taglia giusta');
for (const t of TAGLIE) {
  const r = scegliTaglia(corpo(t), finta);
  controlla(`chi veste la ${t} riceve «Taglia ${t}» e niente altro`, r.riga === `Taglia ${t}` && !r.daVerificare, r.riga + ' ' + r.motivi.join('; '));
}

console.log('L\'esempio del proprietario');
let m = { ...corpo(41) }; m.giro_collo += 2; m.lunghezza_manica -= 6;
let r = scegliTaglia(m, finta);
controlla('«Taglia 41 · collo +2 cm · manica −6 cm»', r.riga === 'Taglia 41 · collo +2 cm · manica −6 cm', r.riga);
controlla('non è da verificare (6 cm sono sotto la soglia di prova, 8)', !r.daVerificare, r.motivi.join('; '));
controlla('le variazioni escono anche come dati', r.variazioni.length === 2 && r.variazioni[0].campo === 'giro_collo' && r.variazioni[0].cm === 2 && r.variazioni[1].cm === -6);

console.log('Mezzo centimetro');
const con = (campo, piu) => { const x = { ...corpo(41) }; x[campo] = Math.round((x[campo] + piu) * 100) / 100; return scegliTaglia(x, finta).riga; };
controlla('+0,4 non si scrive', con('torace', 0.4) === 'Taglia 41', con('torace', 0.4));
controlla('+0,5 si scrive', con('torace', 0.5) === 'Taglia 41 · torace +0,5 cm', con('torace', 0.5));
controlla('+0,7 diventa +0,5', con('torace', 0.7) === 'Taglia 41 · torace +0,5 cm', con('torace', 0.7));
controlla('+0,8 diventa +1', con('torace', 0.8) === 'Taglia 41 · torace +1 cm', con('torace', 0.8));
controlla('+1,5 resta +1,5', con('torace', 1.5) === 'Taglia 41 · torace +1,5 cm', con('torace', 1.5));
controlla('−1,3 diventa −1,5', con('bacino', -1.3) === 'Taglia 41 · bacino −1,5 cm', con('bacino', -1.3));
controlla('−0,4 non si scrive', con('bacino', -0.4) === 'Taglia 41', con('bacino', -0.4));
controlla('−1,25 e +1,25 si arrotondano allo stesso modo', con('pancia', -1.25) === 'Taglia 41 · pancia −1,5 cm' && con('pancia', 1.25) === 'Taglia 41 · pancia +1,5 cm', con('pancia', -1.25) + ' / ' + con('pancia', 1.25));

console.log('Tutte le misure insieme');
m = { ...corpo(42) }; m.giro_collo = corpo(40).giro_collo;
r = scegliTaglia(m, finta);
controlla('collo da 40 e tutto il resto da 42: si parte dalla 42', r.taglia === 42 && r.riga === 'Taglia 42 · collo −2 cm', r.riga);
m = { ...corpo(40) }; m.pancia = corpo(43).pancia; m.bacino = corpo(42).bacino;
r = scegliTaglia(m, finta);
controlla('pancia e bacino più larghi non spostano collo, spalle e torace', r.taglia === 40, r.riga);
m = {}; for (const [k, v] of Object.entries(corpo(41))) m[k] = (v + corpo(42)[k]) / 2;
r = scegliTaglia(m, finta);
controlla('a metà tra due taglie ne sceglie una delle due', r.taglia === 41 || r.taglia === 42, r.riga);
controlla('il polso non entra mai nella riga', !scegliTaglia({ ...corpo(41), polso: 40 }, finta).riga.includes('polso'));

console.log('Da verificare con il cliente');
m = {}; for (const [k, v] of Object.entries(corpo(38))) m[k] = k === 'polso' ? v : v - (corpo(39)[k] - v) * 2;
r = scegliTaglia(m, finta);
controlla('due taglie sotto la 38: Taglia 38, da verificare', r.taglia === 38 && r.daVerificare && r.motivi.some((x) => x.includes('più piccole della taglia 38')), r.riga + ' | ' + r.motivi.join('; '));
m = {}; for (const [k, v] of Object.entries(corpo(45))) m[k] = k === 'polso' ? v : v + (v - corpo(44)[k]) * 2;
r = scegliTaglia(m, finta);
controlla('due taglie sopra la 45: Taglia 45, da verificare', r.taglia === 45 && r.daVerificare && r.motivi.some((x) => x.includes('più grandi della taglia 45')), r.riga + ' | ' + r.motivi.join('; '));
controlla('chi veste la 38 o la 45 esatta non è da verificare', !scegliTaglia(corpo(38), finta).daVerificare && !scegliTaglia(corpo(45), finta).daVerificare);
m = { ...corpo(41) }; m.lunghezza_manica -= 9;
r = scegliTaglia(m, finta);
controlla('manica −9 con soglia 8: da verificare, e dice quale', r.daVerificare && r.motivi.some((x) => x.includes('manica −9 cm')), r.motivi.join('; '));
m = { ...corpo(41) }; delete m.bacino; delete m.avambraccio;
r = scegliTaglia(m, finta);
controlla('misure non scritte: calcola lo stesso e lo segnala', r.taglia === 41 && r.daVerificare && r.motivi.some((x) => x.includes('bacino') && x.includes('avambraccio')), r.motivi.join('; '));
const senza = leggiConfigurazione({ taglie: finta.taglie, misure: finta.misure, regole: { agio: { giro_collo: 1 } } });
r = scegliTaglia(corpo(41), senza);
controlla('agio non impostato: lo dice, non fa finta di niente', r.daVerificare && r.motivi.some((x) => x.includes('agio non ancora impostato') && x.includes('torace')), r.motivi.join('; '));
r = scegliTaglia({}, finta);
controlla('nessuna misura: nessuna taglia, da verificare', r.taglia === null && r.daVerificare);

console.log('Come arriva scritto');
controlla('"41,5" con la virgola', centimetri('41,5') === 41.5 && centimetri(' 104 ') === 104 && centimetri('abc') === undefined && centimetri('') === undefined);
m = Object.fromEntries(Object.entries(corpo(41)).map(([k, v]) => [k, String(v).replace('.', ',')]));
controlla('le misure arrivano come testo dal modulo', scegliTaglia(m, finta).riga === 'Taglia 41', scegliTaglia(m, finta).riga);
m = { ...corpo(41) }; m.taglia = m.giro_collo; delete m.giro_collo;
controlla('vale anche il vecchio nome «taglia» per il giro collo', scegliTaglia(m, finta).riga === 'Taglia 41', scegliTaglia(m, finta).riga);
m = { ...corpo(41) }; m.giro_collo += 2; m.lunghezza_manica -= 9;
const blocco = perIlReparto(m, finta).testo.split('\n');
controlla('per il reparto: riga, avviso, misure del cliente', blocco.length === 3 && blocco[0].startsWith('Taglia 41 · collo +2 cm') && blocco[1].startsWith('DA VERIFICARE CON IL CLIENTE: ') && blocco[2].startsWith('Misure scritte dal cliente: giro collo 42 · spalla 47'), blocco.join(' | '));
controlla('senza variazioni grandi niente avviso', perIlReparto(corpo(41), finta).testo.split('\n').length === 2);

console.log('Configurazione sbagliata');
const rifiuta = (c) => { try { leggiConfigurazione(c); return false; } catch { return true; } };
controlla('non è un JSON', rifiuta('{'));
controlla('mancano le taglie', rifiuta({ misure: {} }));
controlla('una misura con meno numeri delle taglie', rifiuta({ taglie: TAGLIE, misure: { ...finta.misure, torace: [100, 104] } }));
controlla('una misura che manca', rifiuta({ taglie: TAGLIE, misure: { ...finta.misure, spalla: undefined } }));

// la configurazione vera, se c'è: si legge, e ogni camicia campione ritrova la propria taglia senza variazioni
if (process.argv[2]) {
  console.log('Configurazione vera');
  const vera = leggiConfigurazione(readFileSync(process.argv[2], 'utf8'));
  const agio = vera.regole.agio || {};
  controlla(`si legge: ${vera.taglie.length} taglie`, vera.taglie.length >= 2);
  for (const t of vera.taglie) {
    const x = scegliTaglia(corpo(t, vera, agio), vera);
    controlla(`la camicia campione della ${t} ritrova «Taglia ${t}»`, x.riga === `Taglia ${t}`, x.riga);
  }
  const mancano = VOCI.filter((v) => v.confronto !== false && !(typeof agio[v.campo] === 'number')).map((v) => v.campo);
  console.log(mancano.length ? `  (agio ancora da impostare: ${mancano.join(', ')})` : '  (agio impostato per tutte le misure)');
}

console.log(`\n${passati} controlli passati, ${falliti.length} falliti`);
if (falliti.length) { console.log(falliti.map((f) => ' - ' + f).join('\n')); process.exit(1); }
