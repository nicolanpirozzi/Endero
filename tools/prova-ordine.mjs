// Controlla le regole dell'ordine del configuratore (src/configuratore/ordine.mjs), le stesse in pagina e nel Worker:
// prezzo per numero di personalizzazioni, quantità, spedizione, campi che dipendono da una scelta, misure, valori
// ostili. Solo dati inventati.
//
//   node tools/prova-ordine.mjs
import { build } from 'esbuild';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RADICE = join(dirname(fileURLToPath(import.meta.url)), '..');
const cartella = mkdtempSync(join(tmpdir(), 'prova-ordine-'));
const uscita = join(cartella, 'ordine.mjs');
await build({ entryPoints: [join(RADICE, 'src/configuratore/ordine.mjs')], bundle: true, format: 'esm', platform: 'neutral', outfile: uscita, logLevel: 'silent' });
const R = await import(pathToFileURL(uscita).href);
const { controllaOrdine, conti, ordinePulito, personalizzazioni, PERSONALIZZAZIONI } = R;
const catalogo = JSON.parse(readFileSync(join(RADICE, 'contenuti/it/tessuti.json'), 'utf8'));
const TESSUTI = new Set(catalogo.tessuti.map((t) => t.id));
const [T1, T2, T3] = catalogo.tessuti.map((t) => t.id);

let passati = 0;
const falliti = [];
const controlla = (nome, vero, dettaglio = '') => {
  if (vero) passati++; else falliti.push(nome + (dettaglio ? ` (${dettaglio})` : ''));
  console.log(`${vero ? '  ok ' : '  NO '} ${nome}${!vero && dettaglio ? ' → ' + dettaglio : ''}`);
};
const chiavi = (e) => Object.keys(e).sort().join(',');

// un ordine base, giusto in ogni campo: camicia senza personalizzazioni, ritiro in laboratorio
const BASE = {
  quantita: '1', tessuto: T1, collo: 'italiano', taschino: 'no', asola: 'no', bottone: 'tinta', filato_bottone: '', iniziali: 'no',
  interno_collo: 'standard', interno_polso: 'standard', polsino: 'standard',
  giro_collo: '41', spalla: '46', spallina: '15', torace: '54', pancia: '50', bacino: '52', lunghezza_manica: '65',
  braccio: '18', avambraccio: '14', polso: '24', lunghezza_davanti: '76', lunghezza_dietro: '80',
  nome: 'Mario Prova', telefono: '333 000 0001', email: 'mario@esempio.it',
  spedizione: 'ritiro', privacy: 'si',
};
const SPEDIRE = { spedizione: 'cinque', destinatario: 'Mario Prova', indirizzo: 'Via Inventata 1', cap: '80100', citta: 'Napoli', provincia: 'NA' };
const TUTTE = {
  taschino: 'si', taschino_tessuto: T2, asola: 'si', asola_colore: 'rosso', bottone: 'contrasto', filato_bottone: 'blu',
  iniziali: 'si', iniziali_posizione: 'polso', iniziali_lettere: 'mp', interno_collo: 'personalizzato', interno_collo_tessuto: T2,
  interno_polso: 'personalizzato', interno_polso_tessuto: T3, polsino: 'personalizzato', polsino_tessuto: T3,
};
const ordineCon = (...pezzi) => Object.assign({}, BASE, ...pezzi);
const errori = (d) => controllaOrdine(d, { tessuti: TESSUTI });

console.log('Un ordine giusto');
controlla('l\'ordine base non ha errori', chiavi(errori(BASE)) === '', JSON.stringify(errori(BASE)));
controlla('nemmeno con tutte le personalizzazioni e la spedizione', chiavi(errori(ordineCon(TUTTE, SPEDIRE))) === '', JSON.stringify(errori(ordineCon(TUTTE, SPEDIRE))));
controlla('le otto personalizzazioni sono quelle di configuratore.json', PERSONALIZZAZIONI.join() === 'taschino,asola,bottone,filato_bottone,iniziali,interno_collo,interno_polso,polsino', PERSONALIZZAZIONI.join());

console.log('Prezzo per numero di personalizzazioni (90 · 100 · 100 · 120 … 120 · 150)');
// le personalizzazioni una alla volta, nell'ordine della pagina
const UNA = [
  { taschino: 'si', taschino_tessuto: T2 }, { asola: 'si', asola_colore: 'rosso' }, { bottone: 'contrasto' }, { filato_bottone: 'blu' },
  { iniziali: 'si', iniziali_posizione: 'cuore', iniziali_lettere: 'MP' }, { interno_collo: 'personalizzato', interno_collo_tessuto: T2 },
  { interno_polso: 'personalizzato', interno_polso_tessuto: T2 }, { polsino: 'personalizzato', polsino_tessuto: T2 },
];
const ATTESI = { 0: 90, 1: 100, 2: 100, 3: 120, 4: 120, 5: 120, 6: 120, 7: 120, 8: 150 };
for (const n of [0, 1, 2, 3, 7, 8]) {
  const d = ordineCon(...UNA.slice(0, n));
  const c = conti(d);
  controlla(`${n} personalizzazioni → ${ATTESI[n]} €`, c.camicia === ATTESI[n] && c.personalizzazioni.length === n && !chiavi(errori(d)), `${c.camicia} €, ${c.personalizzazioni.length}`);
}
for (const p of UNA) controlla(`una sola: ${Object.keys(p)[0]} → 100 €`, conti(ordineCon(p)).camicia === 100, String(conti(ordineCon(p)).camicia));
controlla('bottone «tinta su tinta» non è una personalizzazione', !personalizzazioni(BASE).includes('bottone'));
controlla('bottone personalizzato sì (con 100 pezzi)', personalizzazioni(ordineCon({ bottone: 'personalizzato', quantita: '100' })).includes('bottone'));
controlla('un filato fatto di soli spazi non fa salire il prezzo (era un errore: contava come personalizzazione)', conti(ordineCon({ filato_bottone: '  ' })).camicia === 90 && !chiavi(errori(ordineCon({ filato_bottone: '  ' }))), String(conti(ordineCon({ filato_bottone: '  ' })).camicia));
controlla('un tessuto del taschino con il taschino «no» non conta e sparisce dall\'ordine', conti(ordineCon({ taschino_tessuto: T2 })).camicia === 90 && ordinePulito(ordineCon({ taschino_tessuto: T2 })).taschino === null);

console.log('Quantità');
for (const [q, giusto] of [['1', true], ['2', true], ['999', true], ['007', true], ['0', false], ['1000', false], ['-1', false], ['1.5', false], ['1e2', false], ['', false], ['due', false], [' 3 ', true], ['0x10', false]]) {
  const e = errori(ordineCon({ quantita: q }));
  controlla(`quantità «${q}» ${giusto ? 'va' : 'no'}`, giusto ? !e.quantita : !!e.quantita, JSON.stringify(e));
}
controlla('3 camicie con una personalizzazione: 300 €', conti(ordineCon(UNA[0], { quantita: '3' })).capi === 300);
controlla('il prezzo è a camicia, il totale per la quantità', (() => { const c = conti(ordineCon(UNA[0], { quantita: '2' }, SPEDIRE)); return c.camicia === 100 && c.capi === 200 && c.spedizione === 0 && c.totale === 200; })());

console.log('Bottone personalizzato: da 100 pezzi');
controlla('con 99 si ferma', !!errori(ordineCon({ bottone: 'personalizzato', quantita: '99' })).bottone);
controlla('con 100 va', !errori(ordineCon({ bottone: 'personalizzato', quantita: '100' })).bottone);
controlla('con una quantità sbagliata l\'avviso è sulla quantità, non sul bottone', (() => { const e = errori(ordineCon({ bottone: 'personalizzato', quantita: 'x' })); return !!e.quantita && !e.bottone; })());

console.log('Spedizione: gratis da 200 € compresi');
const sped = (q, p, modo = 'cinque') => conti(ordineCon(...UNA.slice(0, p), SPEDIRE, { spedizione: modo, quantita: String(q) }));
let c = sped(2, 1);            // 2 × 100 = 200
controlla('200 € di camicie esatti: spedizione già gratis', c.capi === 200 && c.spedizione === 0 && c.gratis && c.totale === 200, JSON.stringify(c));
c = sped(1, 3);                // 1 × 120 = 120
controlla('120 € di camicie: la spedizione si paga (5 giorni: 30 €)', c.capi === 120 && c.spedizione === 30 && !c.gratis && c.totale === 150, JSON.stringify(c));
c = sped(3, 0);                // 3 × 90 = 270
controlla('270 € di camicie: spedizione gratis', c.capi === 270 && c.spedizione === 0 && c.gratis && c.totale === 270, JSON.stringify(c));
c = sped(1, 1, 'sette');
controlla('7 giorni a 100 €: 15 €', c.spedizione === 15 && c.totale === 115, JSON.stringify(c));
c = sped(2, 3, 'sette');       // 2 × 120 = 240
controlla('7 giorni a 240 €: gratis', c.spedizione === 0 && c.totale === 240, JSON.stringify(c));
c = conti(ordineCon({ quantita: '5' }));
controlla('ritiro: niente spedizione, anche sopra i 200', c.spedizione === 0 && !c.gratis && c.totale === 450, JSON.stringify(c));
controlla('senza scelta: spedizione da scegliere', conti(ordineCon({ spedizione: '' })).spedizione === null && !!errori(ordineCon({ spedizione: '' })).spedizione);
controlla('una spedizione inventata non vale', !!errori(ordineCon({ spedizione: 'gratis' })).spedizione);
controlla('ritiro: l\'indirizzo non serve e non entra nell\'ordine', !chiavi(errori(ordineCon({ spedizione: 'ritiro', cap: 'x' }))) && !ordinePulito(ordineCon({ cap: '1' })).spedizione.indirizzo);

console.log('Indirizzo (solo con la spedizione)');
const ind = (pezzo) => errori(ordineCon(SPEDIRE, pezzo));
controlla('senza indirizzo: tutti i campi segnati', chiavi(errori(ordineCon({ spedizione: 'cinque' }))) === 'cap,citta,destinatario,indirizzo,provincia', chiavi(errori(ordineCon({ spedizione: 'cinque' }))));
for (const [cap, giusto] of [['80100', true], ['00100', true], ['8010', false], ['801000', false], ['80 100', false], ['abcde', false]]) controlla(`CAP «${cap}» ${giusto ? 'va' : 'no'}`, giusto ? !ind({ cap }).cap : !!ind({ cap }).cap);
for (const [p, giusto] of [['NA', true], ['na', true], [' Na ', true], ['RM', true], ['XX', false], ['NAP', false], ['', false]]) controlla(`provincia «${p}» ${giusto ? 'va' : 'no'}`, giusto ? !ind({ provincia: p }).provincia : !!ind({ provincia: p }).provincia);
for (const [p, sigla] of [['Roma', 'RM'], ['napoli', 'NA'], ['Forlì', 'FC'], ['Reggio Emilia', 'RE'], ['Monza', 'MB'], ["L'Aquila", 'AQ'], ['Ro', 'RO']]) controlla(`provincia «${p}» → ${sigla}`, ordinePulito(ordineCon(SPEDIRE, { provincia: p })).spedizione.indirizzo.provincia === sigla && !errori(ordineCon(SPEDIRE, { provincia: p })).provincia);
controlla('provincia salvata in maiuscolo', ordinePulito(ordineCon(SPEDIRE, { provincia: 'na' })).spedizione.indirizzo.provincia === 'NA');
controlla('indirizzo con un link: no', !!ind({ indirizzo: 'Via https://truffa.example 1' }).indirizzo);
controlla('indirizzo troppo corto o senza lettere: no', !!ind({ indirizzo: 'V 1' }).indirizzo && !!ind({ indirizzo: '12345' }).indirizzo);
controlla('note per il corriere con un link: no', !!ind({ note_consegna: 'vedi www.truffa.example' }).note_consegna);
controlla('note normali: sì', !ind({ note_consegna: 'Citofono Prova, secondo piano' }).note_consegna);
controlla('destinatario con un solo nome: no', !!ind({ destinatario: 'Mario' }).destinatario);
controlla('città con cifre: no', !!ind({ citta: 'Napoli 2' }).citta);

console.log('Campi che dipendono da una scelta');
const dipende = [
  ['taschino', { taschino: 'si' }, 'taschino_tessuto'],
  ['asola', { asola: 'si' }, 'asola_colore'],
  ['iniziali (posizione)', { iniziali: 'si', iniziali_lettere: 'MP' }, 'iniziali_posizione'],
  ['iniziali (lettere)', { iniziali: 'si', iniziali_posizione: 'collo' }, 'iniziali_lettere'],
  ['interno collo', { interno_collo: 'personalizzato' }, 'interno_collo_tessuto'],
  ['interno polso', { interno_polso: 'personalizzato' }, 'interno_polso_tessuto'],
  ['polsino', { polsino: 'personalizzato' }, 'polsino_tessuto'],
];
for (const [nome, pezzo, atteso] of dipende) controlla(`${nome}: scelto senza il suo campo → errore su ${atteso}`, chiavi(errori(ordineCon(pezzo))) === atteso, chiavi(errori(ordineCon(pezzo))));
for (const nome of ['taschino', 'asola', 'iniziali']) controlla(`${nome}: né sì né no → errore`, !!errori(ordineCon({ [nome]: 'forse' }))[nome]);
for (const nome of ['interno_collo', 'interno_polso', 'polsino']) controlla(`${nome}: né standard né personalizzato → errore`, !!errori(ordineCon({ [nome]: '' }))[nome]);
controlla('colore dell\'asola inventato: no', !!errori(ordineCon({ asola: 'si', asola_colore: 'oro' })).asola_colore);
controlla('filato bottone inventato: no; vuoto: sì (è facoltativo)', !!errori(ordineCon({ filato_bottone: 'oro' })).filato_bottone && !errori(ordineCon({ filato_bottone: '' })).filato_bottone);
controlla('collo inventato: no', !!errori(ordineCon({ collo: 'alla coreana' })).collo);
controlla('posizione delle iniziali inventata: no', !!errori(ordineCon({ iniziali: 'si', iniziali_posizione: 'schiena', iniziali_lettere: 'A' })).iniziali_posizione);

console.log('Iniziali');
for (const [l, giusto, salvate] of [['MP', true, 'MP'], ['m.p.', true, 'MP'], ['a b c', true, 'ABC'], ['Ž', true, 'Ž'], ['ABCD', false], ['', false], ['M1', false], ['<b>', false], ['😀', false]]) {
  const d = ordineCon({ iniziali: 'si', iniziali_posizione: 'polso', iniziali_lettere: l });
  const e = errori(d);
  controlla(`iniziali «${l}» ${giusto ? `vanno, salvate «${salvate}»` : 'no'}`, giusto ? !e.iniziali_lettere && ordinePulito(d).iniziali.lettere === salvate : !!e.iniziali_lettere, JSON.stringify(e));
}

console.log('Tessuti');
controlla('un tessuto che non è nel catalogo: no', !!errori(ordineCon({ tessuto: 'z999' })).tessuto);
controlla('un id con caratteri strani: no', !!errori(ordineCon({ tessuto: '../../etc' })).tessuto && !!errori(ordineCon({ tessuto: 'T001' })).tessuto);
controlla('senza catalogo (in pagina) basta la forma', !chiavi(controllaOrdine(ordineCon({ tessuto: 'z999' }))));
controlla('anche i tessuti delle parti sono controllati', !!errori(ordineCon({ polsino: 'personalizzato', polsino_tessuto: 'z999' })).polsino_tessuto);

console.log('Misure');
const MIS = R.MISURE;
controlla('dodici misure', MIS.length === 12, String(MIS.length));
for (const m of MIS) {
  const sotto = errori(ordineCon({ [m.nome]: String(m.min - 1) }))[m.nome];
  const sopra = errori(ordineCon({ [m.nome]: String(m.max + 1) }))[m.nome];
  const ai = !errori(ordineCon({ [m.nome]: String(m.min) }))[m.nome] && !errori(ordineCon({ [m.nome]: String(m.max) }))[m.nome];
  controlla(`${m.nome}: fuori da ${m.min}–${m.max} no, ai limiti sì`, !!sotto && !!sopra && ai && sotto.includes(String(m.min)) && sotto.includes(String(m.max)));
}
for (const [v, giusto] of [['41,5', true], ['41.5', true], ['41,25', true], ['41,255', false], ['41 cm', false], ['NaN', false], ['Infinity', false], ['4e1', false], ['-41', false], ['', false], ['0x29', false]]) {
  controlla(`giro collo «${v}» ${giusto ? 'va' : 'no'}`, giusto ? !errori(ordineCon({ giro_collo: v })).giro_collo : !!errori(ordineCon({ giro_collo: v })).giro_collo);
}
controlla('misure salvate come numeri', ordinePulito(ordineCon({ giro_collo: '41,5' })).misure.giro_collo === 41.5);

console.log('Dati e consenso');
controlla('senza nome, telefono, email: tre errori', chiavi(errori(ordineCon({ nome: '', telefono: '', email: '' }))) === 'email,nome,telefono');
controlla('l\'email è obbligatoria (il pagamento e la conferma partono per email)', !!errori(ordineCon({ email: '' })).email);
controlla('email con una virgola (due destinatari): no', !!errori(ordineCon({ email: 'a@b.it,c@d.it' })).email);
controlla('senza consenso: no', !!errori(ordineCon({ privacy: '' })).privacy && !!errori(ordineCon({ privacy: 'no' })).privacy);
controlla('consenso «on» (casella senza valore) e true: sì', !errori(ordineCon({ privacy: 'on' })).privacy && !errori(ordineCon({ privacy: true })).privacy);

console.log('Passi');
controlla('il passo «camicia» guarda solo la camicia', chiavi(controllaOrdine({ ...BASE, nome: '', cap: 'x', giro_collo: '' }, { passo: 'camicia' })) === '');
controlla('il passo «misure» guarda solo le misure', chiavi(controllaOrdine({ ...BASE, tessuto: '', giro_collo: '' }, { passo: 'misure' })) === 'giro_collo');

console.log('Valori ostili');
const ostili = ordineCon({ collo: '__proto__', bottone: 'constructor', quantita: '1<script>', nome: '<img src=x onerror=alert(1)>', tessuto: 't001"><b>' });
const eo = errori(ostili);
controlla('nomi di proprietà e codice nei campi: tutti rifiutati', ['collo', 'bottone', 'quantita', 'nome', 'tessuto'].every((k) => eo[k]), chiavi(eo));
controlla('un oggetto al posto di un testo non rompe nulla', (() => { try { const e = errori(ordineCon({ collo: { toString: () => 'italiano' }, quantita: ['1'] })); return !!e.collo; } catch { return false; } })());
controlla('il prezzo scritto dal browser non conta', conti(ordineCon({ prezzo: '1', totale: '1', camicia: '1' })).totale === 90);
const p = ordinePulito(ordineCon(TUTTE, SPEDIRE, { prezzo: '1', sconto: '100' }));
controlla('nell\'ordine pulito entrano solo i campi previsti', !('prezzo' in p) && !('sconto' in p));
controlla('tutte le personalizzazioni con spedizione in 5 giorni: 150 + 30', p.conti.camicia === 150 && p.conti.spedizione === 30 && p.conti.totale === 180, JSON.stringify(p.conti));

rmSync(cartella, { recursive: true, force: true });
console.log(`\n${passati} controlli passati, ${falliti.length} falliti`);
if (falliti.length) { console.log(falliti.map((x) => ' - ' + x).join('\n')); process.exit(1); }
