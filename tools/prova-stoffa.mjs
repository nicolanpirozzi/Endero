// Prova la fisica della stoffa senza browser: carica il telaio, lascia passare un po' di brezza, poi fa
// attraversare il petto dal mouse e misura come risponde il tessuto in alcuni punti. Serve a regolare i numeri di TESSUTO in
// src/configuratore/stoffa.js guardando le curve, non a occhio.
//   node tools/prova-stoffa.mjs <telaio.json> [curve.csv] [forza di una folata, m/s] [quanto preme] [smorzamento]
import { readFileSync, writeFileSync } from 'node:fs';
import { creaStoffa } from '../src/configuratore/stoffa.js';

const dati = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const t0 = performance.now();
const stoffa = creaStoffa(dati);
console.log('punti', stoffa.punti, '· triangoli', stoffa.triangoli.length / 3, '· vincoli', stoffa.vincoli, '· cuciture', stoffa.cuciture, '· preparata in', Math.round(performance.now() - t0), 'ms');

const x0 = stoffa.riposo, x = stoffa.adesso, n = stoffa.punti;
const vicinoA = (px, py, pz) => {
  let m = 0, d = Infinity;
  for (let i = 0; i < n; i++) { const q = Math.hypot(x0[3 * i] - px, x0[3 * i + 1] - py, x0[3 * i + 2] - pz); if (q < d) { d = q; m = i; } }
  return m;
};
let ymin = Infinity, ymax = -Infinity, zmax = -Infinity, xmax = -Infinity;
for (let i = 0; i < n; i++) { ymin = Math.min(ymin, x0[3 * i + 1]); ymax = Math.max(ymax, x0[3 * i + 1]); zmax = Math.max(zmax, x0[3 * i + 2]); xmax = Math.max(xmax, x0[3 * i]); }
const sonde = {
  orlo: vicinoA(0.12, ymin, zmax), petto: vicinoA(0.1, 0.08, zmax), fianco: vicinoA(0.25, -0.1, 0), schiena: vicinoA(0, -0.1, -zmax),
  manica: vicinoA(xmax * 0.75, 0.05, 0), polsino: vicinoA(xmax, -0.2, 0), spalla: vicinoA(0.15, ymax - 0.08, 0),
};
const sposta = (i) => Math.hypot(x[3 * i] - x0[3 * i], x[3 * i + 1] - x0[3 * i + 1], x[3 * i + 2] - x0[3 * i + 2]) * 1000;
const lati = []; { const t = stoffa.triangoli; for (let i = 0; i < t.length; i += 3) lati.push([t[i], t[i + 1]], [t[i + 1], t[i + 2]], [t[i + 2], t[i]]); }
const lung = (a, b, p) => Math.hypot(p[3 * a] - p[3 * b], p[3 * a + 1] - p[3 * b + 1], p[3 * a + 2] - p[3 * b + 2]);
const allungo = () => { let m = 0; for (const [a, b] of lati) m = Math.max(m, lung(a, b, x) / lung(a, b, x0) - 1); return m * 100; };
const allunghi = () => lati.map(([a, b]) => (lung(a, b, x) / lung(a, b, x0) - 1) * 100).sort((p, q) => p - q);

const righe = ['t,' + Object.keys(sonde).join(',')];
const DT = 1 / 60;
const FORZA = Number(process.argv[4]) || 0.25, PREME = Number(process.argv[5]) || 0.5, SMORZA = Number(process.argv[6]) || 4;
let massimo = Object.fromEntries(Object.keys(sonde).map((k) => [k, [0, 0]])), tiro = 0, speso = 0;
const quiete = {};
for (let f = 0; f < 60 * 12; f++) {
  const t = f * DT;
  if (f === 60 * 4) for (const k in sonde) quiete[k] = sposta(sonde[k]);
  // il mouse attraversa il petto in poco più di un secondo: una folata ogni 0,12 s, come fa la pagina
  if (f >= 60 * 4 && f < 60 * 4 + 66 && (f - 240) % 7 === 0) {
    const a = (f - 240) / 66, p = sonde.petto;
    stoffa.folata(-0.25 + 0.5 * a, x0[3 * p + 1], x0[3 * p + 2], 1, 0.05, -PREME, FORZA / (1 + SMORZA * stoffa.carico()));
  }
  const a = performance.now(); stoffa.passo(DT); speso += performance.now() - a;
  righe.push(t.toFixed(3) + ',' + Object.values(sonde).map((i) => sposta(i).toFixed(2)).join(','));
  if (f >= 60 * 4) for (const k in sonde) { const s = sposta(sonde[k]); if (s > massimo[k][0]) massimo[k] = [s, t - 4]; }
  tiro = Math.max(tiro, allungo());
  if (f === 60 * 4 + 24) { const q = allunghi(); console.log('fili al culmine: accorciati 1%', q[Math.floor(q.length * 0.01)].toFixed(2) + '%', '· mediana', q[q.length >> 1].toFixed(3) + '%', '· allungati 99%', q[Math.floor(q.length * 0.99)].toFixed(2) + '%', '· 99,9%', q[Math.floor(q.length * 0.999)].toFixed(2) + '%'); }
}
console.log('calcolo per fotogramma:', (speso / (60 * 12)).toFixed(2), 'ms · allungamento massimo di un filo:', tiro.toFixed(2) + '%');
console.log('sonda       brezza(mm)  picco(mm)  dopo(s)');
for (const k in sonde) console.log(k.padEnd(11), quiete[k].toFixed(1).padStart(9), massimo[k][0].toFixed(1).padStart(10), massimo[k][1].toFixed(2).padStart(8));
if (process.argv[3]) writeFileSync(process.argv[3], righe.join('\n'));
