// La camicia in diretta: le forme per il browser.
//
// Lega la camicia semplificata e i bottoni (da `scatta.py`) al telaio su cui gira la fisica (da `telaio.py`), come
// fa il film, e scrive tutto in un file solo, compresso:
//
//   node camicia/viva/monta.mjs <cartella di scatta.py> <cartella di telaio.py> public/camicia/viva
//
//   forma.gz    i numeri (vedi `parti` in viva.json): per camicia e bottoni, su quale triangolo del telaio sta ogni
//               punto, e i triangoli; per gruccia e nastro, che non si deformano, i punti e i triangoli
//   telaio.json la camicia semplificata su cui gira la fisica (stoffa.mjs), tale e quale
//   viva.json   la scena (camera, sole, parete, gancio), le immagini (da immagini.py) e l'indice di forma.gz
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { creaStoffa } from '../film/stoffa.mjs';
import { legatura, segue } from '../film/lega.mjs';

const [lavoro, moto, uscita] = process.argv.slice(2);
if (!uscita) { console.error('uso: node camicia/viva/monta.mjs <cartella di scatta.py> <cartella di telaio.py> <uscita>'); process.exit(2); }
const f32 = (cartella, nome) => { const b = readFileSync(join(cartella, nome)); return new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4); };
const i32 = (cartella, nome) => { const b = readFileSync(join(cartella, nome)); return new Int32Array(b.buffer, b.byteOffset, b.byteLength / 4); };
const json = (cartella, nome) => JSON.parse(readFileSync(join(cartella, nome), 'utf8'));

const telaio = json(moto, 'telaio.json');
const stoffa = creaStoffa(telaio, { adatta: false });
const scena = json(lavoro, 'scena.json');
const SCARTO = 20000;                  // lo scarto si scrive in ventimillesimi di metro (mezzo decimo di millimetro)

// --- la camicia: ogni punto prende la parte (corpo, manica destra, manica sinistra) del punto vero più vicino
const camicia = f32(lavoro, 'camicia.f32'), vera = f32(moto, 'camicia.f32'), parteVera = i32(moto, 'camicia-parte.i32');
const LATO = 0.02, celle = new Map(), chiave = (i, j, k) => (i + 512) + (j + 512) * 1024 + (k + 512) * 1048576;
for (let i = 0; i < vera.length / 3; i++) {
  const q = chiave(Math.floor(vera[3 * i] / LATO), Math.floor(vera[3 * i + 1] / LATO), Math.floor(vera[3 * i + 2] / LATO));
  (celle.get(q) || celle.set(q, []).get(q)).push(i);
}
const parte = new Int32Array(camicia.length / 3);
for (let i = 0; i < parte.length; i++) {
  const x = camicia[3 * i], y = camicia[3 * i + 1], z = camicia[3 * i + 2];
  let meglio = -1, vicino = Infinity;
  for (let giro = 1; giro <= 6 && meglio < 0; giro++) {
    for (let a = -giro; a <= giro; a++) for (let b = -giro; b <= giro; b++) for (let c = -giro; c <= giro; c++) {
      for (const j of celle.get(chiave(Math.floor(x / LATO) + a, Math.floor(y / LATO) + b, Math.floor(z / LATO) + c)) || []) {
        const d = (vera[3 * j] - x) ** 2 + (vera[3 * j + 1] - y) ** 2 + (vera[3 * j + 2] - z) ** 2;
        if (d < vicino) { vicino = d; meglio = j; }
      }
    }
  }
  parte[i] = meglio < 0 ? 0 : parteVera[meglio];
}
// Lungo le cuciture i bordi di due pezzi (una manica e il corpo) quasi coincidono, e il punto vero più vicino può
// essere dell'altro pezzo: la manica si sfrangerebbe. I pezzi però non sono cuciti tra loro: ogni pezzo intero prende
// la parte della maggioranza dei suoi punti.
{
  const tri = i32(lavoro, 'camicia-tri.i32'), capo = Int32Array.from({ length: parte.length }, (_, i) => i);
  const radice = (i) => { while (capo[i] !== i) { capo[i] = capo[capo[i]]; i = capo[i]; } return i; };
  for (let q = 0; q < tri.length; q += 3) { const a = radice(tri[q]), b = radice(tri[q + 1]), c = radice(tri[q + 2]); capo[b] = a; capo[c] = a; }
  const voti = new Map();
  for (let i = 0; i < parte.length; i++) { const r = radice(i), v = voti.get(r) || voti.set(r, [0, 0, 0]).get(r); v[parte[i]]++; }
  let cambiati = 0;
  for (let i = 0; i < parte.length; i++) { const v = voti.get(radice(i)), scelta = v.indexOf(Math.max(...v)); if (parte[i] !== scelta) { parte[i] = scelta; cambiati++; } }
  console.log(`camicia: ${voti.size} pezzi · ${cambiati} punti di bordo riportati alla parte del loro pezzo`);
}

// --- i bottoni: gli stessi di telaio.py, nello stesso ordine, ognuno col suo gruppo (un bottone si muove intero)
const bottoni = f32(lavoro, 'bottoni.f32'), gruppi = i32(moto, 'bottoni-gruppi.i32');
if (gruppi.length !== bottoni.length / 3) throw new Error(`i bottoni di scatta.py (${bottoni.length / 3}) non sono quelli di telaio.py (${gruppi.length})`);

/** Lega dei punti al telaio e controlla che, a telaio fermo, tornino dove stavano. */
function lega(nome, punti, parti, gruppo) {
  const l = legatura(stoffa, punti, parti, gruppo, true);
  const scarto = new Int16Array(punti.length), peso = new Uint8Array(punti.length), osso = new Uint16Array(punti.length);
  for (let k = 0; k < punti.length; k++) {
    const s = Math.round(l.scarto[k] * SCARTO);
    if (Math.abs(s) > 32767) throw new Error(`${nome}: uno scarto di ${l.scarto[k]} m non sta in sedici bit`);
    scarto[k] = s; l.scarto[k] = s / SCARTO;
    osso[k] = l.osso[k];
  }
  for (let i = 0; i < punti.length / 3; i++) {
    const a = Math.round(l.peso[3 * i] * 255), b = Math.round(l.peso[3 * i + 1] * 255);
    peso[3 * i] = a; peso[3 * i + 1] = b; peso[3 * i + 2] = 255 - a - b;
  }
  const torna = new Float32Array(punti.length);
  segue(stoffa, l)(torna, 0);
  let errore = 0;
  for (let k = 0; k < punti.length; k++) errore = Math.max(errore, Math.abs(torna[k] - punti[k]));
  console.log(`${nome}: ${punti.length / 3} punti legati · a telaio fermo tornano al loro posto entro ${(errore * 1000).toFixed(3)} mm`);
  return { osso, peso, scarto };
}
const lCamicia = lega('camicia', camicia, parte, null), lBottoni = lega('bottoni', bottoni, null, gruppi);

// --- tutto in un file: ogni pezzo allineato a quattro byte
const pezzi = [], parti = {};
let lungo = 0;
const aggiungi = (nome, vettore) => {
  const byte = Buffer.from(vettore.buffer, vettore.byteOffset, vettore.byteLength);
  parti[nome] = { da: lungo, quanti: vettore.length, tipo: vettore.constructor.name.replace('Array', '').toLowerCase() };
  pezzi.push(byte); lungo += byte.length;
  const resto = (4 - (lungo % 4)) % 4;
  if (resto) { pezzi.push(Buffer.alloc(resto)); lungo += resto; }
};
const tri16 = (nome, quantiPunti) => {
  const t = i32(lavoro, `${nome}-tri.i32`);
  if (quantiPunti > 65535) throw new Error(`${nome}: troppi punti per indici a sedici bit`);
  return Uint16Array.from(t);
};
for (const [nome, l, punti] of [['camicia', lCamicia, camicia], ['bottoni', lBottoni, bottoni]]) {
  aggiungi(`${nome}.osso`, l.osso); aggiungi(`${nome}.peso`, l.peso); aggiungi(`${nome}.scarto`, l.scarto);
  aggiungi(`${nome}.tri`, tri16(nome, punti.length / 3));
}
for (const nome of ['gruccia', 'nastro']) {
  const punti = f32(lavoro, `${nome}.f32`);
  aggiungi(`${nome}.punti`, new Float32Array(punti)); aggiungi(`${nome}.tri`, tri16(nome, punti.length / 3));
}
const tutto = Buffer.concat(pezzi), stretto = gzipSync(tutto, { level: 9 });
writeFileSync(join(uscita, 'forma.gz'), stretto);
const telaioScritto = JSON.stringify(telaio);
writeFileSync(join(uscita, 'telaio.json'), telaioScritto);

const immagini = existsSync(join(uscita, 'immagini.json')) ? json(uscita, 'immagini.json') : null;
if (!immagini) console.warn('attenzione: manca immagini.json (lo scrive immagini.py): viva.json esce senza le misure delle immagini');
const impronta = createHash('sha256').update(stretto).update(telaioScritto);
for (const n of ['sole.webp', 'ombra.webp', 'parete-luce.webp', 'parete-ombra.webp', 'finestra.png']) if (existsSync(join(uscita, n))) impronta.update(readFileSync(join(uscita, n)));
writeFileSync(join(uscita, 'viva.json'), JSON.stringify({
  versione: impronta.digest('hex').slice(0, 10), scena, immagini, scarto: SCARTO, byte: tutto.length, parti,
  telaio: { punti: telaio.punti.length / 3, triangoli: telaio.triangoli.length / 3 },
}));
console.log(`forma.gz ${Math.round(stretto.length / 1024)} KB (${Math.round(tutto.length / 1024)} KB distesa) · telaio.json ${Math.round(telaioScritto.length / 1024)} KB`);
