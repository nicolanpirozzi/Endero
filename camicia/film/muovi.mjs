// La camicia del configuratore come film: il movimento.
//
// Simula sul telaio (la camicia semplificata che scrive `telaio.py`) una mano che tocca il tessuto, con la fisica
// della stoffa di `stoffa.mjs`, e fa seguire al telaio tutti i punti veri della camicia e i bottoni. Scrive, per ogni
// scena, dove sta ogni punto in ogni fotogramma: `produci.py` li calcola con Cycles.
//
//   node camicia/film/muovi.mjs <cartella scritta da telaio.py> [curve.csv]
//
// Le scene sono due: la mano che passa da sinistra verso destra e quella che passa da destra verso sinistra. Ognuna
// parte dalla camicia ferma e ci ritorna: sul sito, quando il mouse passa, parte quella del suo lato.
// Il proprietario, provata la prima versione (folate di vento): "il movimento non deve essere proprio il vento: deve
// essere come se io toccassi con la mano il tessuto in modo leggero, ampio però e morbido. Mi piace, però, che quando
// muovo sulla camicia si muova anche la gruccia e il cavo". Quindi: un palmo largo che preme appena e accompagna il
// tessuto mentre attraversa il petto, e la camicia, appesa al nastro, che cede, dondola e si torce piano, con la
// gruccia e il nastro. Niente increspature di vento.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { creaStoffa } from './stoffa.mjs';
import { legatura, segue } from './lega.mjs';

const cartella = process.argv[2];
if (!cartella) { console.error('uso: node camicia/film/muovi.mjs <cartella scritta da telaio.py> [curve.csv]'); process.exit(2); }

const FOTOGRAMMI_AL_SECONDO = 24;          // del movimento simulato. Il film va a metà velocità ("molto più lento", ha scelto il
                                       // proprietario provandolo): questi stati diventano 12 al secondo, vedi monta.py
const DURATA = 4.0;                    // secondi di movimento simulato per ogni scena (otto nel film)
const RITORNO = 0.9;                   // negli ultimi secondi tutto torna, dolcemente, esattamente a riposo
const PASSO = 1 / 120;                 // passo della fisica
const SCENE = { 'da-sinistra': 1, 'da-destra': -1 };       // il verso in cui passa la mano sullo schermo
const SCIA = Number(process.env.SCIA) || 0.3;               // quanto il tessuto resta indietro quando la camicia dondola
const num = (nome, base) => (process.env[nome] === undefined ? base : Number(process.env[nome]));
// la mano: quando tocca e per quanto, quanto è largo il palmo, di quanto il tessuto cede e si lascia portare di lato
const MANO = {
  inizio: 0.05, durata: num('MANO_DURATA', 1.0),
  raggio: num('MANO_RAGGIO', 0.21), fondo: num('MANO_FONDO', 0.026), trascina: num('MANO_TRASCINA', 0.01),
  da: -0.27, a: 0.23,                  // da dove a dove attraversa il petto, in metri dall'asse della camicia
  alta: -0.40, scende: 0.07,           // a che altezza passa (sotto il gancio) e di quanto scende lungo la passata
  // quanto il tocco fa dondolare la camicia di lato e verso la parete, e quanto la torce sul nastro
  lato: num('MANO_LATO', 0.9), versoParete: num('MANO_PARETE', 0.38), torce: num('MANO_TORCE', 4.2),
};
const gradino = (a, b, t) => { const u = Math.max(0, Math.min(1, (t - a) / (b - a))); return u * u * (3 - 2 * u); };

const leggiJson = (nome) => JSON.parse(readFileSync(join(cartella, nome), 'utf8'));
const leggiF32 = (nome) => { const b = readFileSync(join(cartella, nome)); return new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4); };
const leggiI32 = (nome) => { const b = readFileSync(join(cartella, nome)); return new Int32Array(b.buffer, b.byteOffset, b.byteLength / 4); };
const telaio = leggiJson('telaio.json'), misure = leggiJson('misure.json');
const camicia = leggiF32('camicia.f32'), parteCamicia = leggiI32('camicia-parte.i32');
const bottoni = leggiF32('bottoni.f32'), gruppi = leggiI32('bottoni-gruppi.i32');

// ---------------------------------------------------------------------------------------------- una scena

function scena(nome, verso) {
  const stoffa = creaStoffa(telaio, { adatta: false });      // sempre lo stesso risultato, anche a macchina occupata
  const segueCamicia = segue(stoffa, legatura(stoffa, camicia, parteCamicia, null)), segueBottoni = segue(stoffa, legatura(stoffa, bottoni, null, gruppi));
  const nc = camicia.length, nb = bottoni.length, quanti = Math.round(DURATA * FOTOGRAMMI_AL_SECONDO) + 1;
  const esce = new Float32Array(quanti * (nc + nb)), angoli = [];
  // il pendolo: di lato, avanti e indietro, e la torsione sul nastro (radianti e loro velocità)
  const p = { lato: 0, fondo: 0, torce: 0, vLato: 0, vFondo: 0, vTorce: 0 };
  const PENDOLO = 2.86, FRENO = 1.25, TORSIONE = 2.3, FRENO_TORSIONE = 1.7;
  const A = [misure.appiglio[0], misure.appiglio[1] + misure.ancora, misure.appiglio[2]];       // dove il nastro è fissato
  const dondolo = new Float32Array(5);
  let tempo = 0, giroPrima = misure.riposo;
  const sonde = [];
  // dove sta la mano sullo schermo (x a destra, y in alto) a un certo momento, e quanto preme (0-1)
  const manoA = (t) => {
    const tau = (t - MANO.inizio) / MANO.durata, u = gradino(0, 1, tau);
    return { x: misure.appiglio[0] + verso * (MANO.da + (MANO.a - MANO.da) * u), y: misure.appiglio[1] + MANO.alta - MANO.scende * u,
      preme: tau <= 0 || tau >= 1 ? 0 : gradino(0, 0.28, tau) * (1 - gradino(0.68, 1, tau)) };
  };
  for (let k = 0; k < quanti; k++) {
    const fino = k / FOTOGRAMMI_AL_SECONDO;
    while (tempo < fino - 1e-9) {
      const angolo = misure.riposo + p.torce * 2.2, c = Math.cos(angolo), s = Math.sin(angolo);
      // dallo schermo alla camicia, che è girata di `angolo` intorno alla verticale
      const locale = (q) => [q[0] * c - q[2] * s, q[1], q[0] * s + q[2] * c];
      const m = manoA(tempo), poi = manoA(tempo + PASSO);
      if (m.preme > 0) {
        // dondolando la camicia si sposta sotto la mano: il palmo tocca il tessuto dove il tessuto è adesso
        const spostata = p.lato * (misure.ancora + 0.45);
        const lx = poi.x - m.x, ly = poi.y - m.y, l = Math.hypot(lx, ly) || 1;
        stoffa.tocca({ c: locale([m.x - spostata, m.y, 0]), d: locale([0, 0, -1]), t: locale([lx / l, ly / l, 0]),
          raggio: MANO.raggio, fondo: MANO.fondo * m.preme, trascina: MANO.trascina * m.preme });
        // la camicia è appesa: la mano che preme la manda verso la parete, quella che accompagna la porta di lato,
        // e premendo lontano dal nastro la fa girare
        const corre = (poi.x - m.x) / PASSO;                                   // metri al secondo, col segno
        p.vLato += MANO.lato * m.preme * corre * PASSO;
        p.vFondo += MANO.versoParete * m.preme * PASSO;
        p.vTorce += MANO.torce * m.preme * (m.x - spostata - misure.appiglio[0]) * PASSO;
      } else stoffa.tocca(null);
      for (const [ang, vel, w, fr] of [['lato', 'vLato', PENDOLO, FRENO], ['fondo', 'vFondo', PENDOLO, FRENO], ['torce', 'vTorce', TORSIONE, FRENO_TORSIONE]]) {
        p[vel] += (-w * w * p[ang] - fr * p[vel]) * PASSO;
        p[ang] = Math.max(-0.17, Math.min(0.17, p[ang] + p[vel] * PASSO));
      }
      const adesso = misure.riposo + p.torce * 2.2, c2 = Math.cos(adesso), s2 = Math.sin(adesso);
      // dondolando la camicia attraversa l'aria ferma e il tessuto resta indietro: molto meno del vero (l'orlo sta
      // a più di un metro e mezzo dal punto in cui il nastro è fissato), o il corpo della camicia si sbilencherebbe
      dondolo[0] = SCIA * (p.vFondo * c2 - p.vLato * s2); dondolo[1] = SCIA * (p.vFondo * s2 + p.vLato * c2);
      dondolo[2] = A[0] * c2 - A[2] * s2; dondolo[3] = A[1]; dondolo[4] = A[0] * s2 + A[2] * c2;
      stoffa.passo(PASSO, (adesso - giroPrima) / PASSO, dondolo);
      giroPrima = adesso; tempo += PASSO;
    }
    const da = k * (nc + nb);
    segueCamicia(esce, da); segueBottoni(esce, da + nc);
    // alla fine tutto torna a riposo, esattamente: così la scena si chiude sull'immagine da cui era partita
    const t = Math.max(0, (fino - (DURATA - RITORNO)) / RITORNO), torna = t * t * (3 - 2 * t);
    if (torna > 0) {
      for (let i = 0; i < nc; i++) esce[da + i] += (camicia[i] - esce[da + i]) * torna;
      for (let i = 0; i < nb; i++) esce[da + nc + i] += (bottoni[i] - esce[da + nc + i]) * torna;
    }
    angoli.push({ giro: misure.riposo + p.torce * 2.2 * (1 - torna), lato: p.lato * (1 - torna), fondo: p.fondo * (1 - torna) });
    // quanto si è spostato il tessuto in questo fotogramma (massimo e medio, in millimetri)
    let massimo = 0, somma = 0;
    for (let i = 0; i < nc; i += 3) { const d = Math.hypot(esce[da + i] - camicia[i], esce[da + i + 1] - camicia[i + 1], esce[da + i + 2] - camicia[i + 2]); massimo = Math.max(massimo, d); somma += d; }
    sonde.push([fino, massimo * 1000, (somma / (nc / 3)) * 1000, angoli[k].lato * 57.3, angoli[k].fondo * 57.3, (angoli[k].giro - misure.riposo) * 57.3]);
  }
  writeFileSync(join(cartella, `scena-${nome}.f32`), Buffer.from(esce.buffer));
  writeFileSync(join(cartella, `scena-${nome}.json`), JSON.stringify({ fotogrammi: quanti, al_secondo: FOTOGRAMMI_AL_SECONDO, camicia: nc / 3, bottoni: nb / 3, angoli }));
  const picco = (j) => sonde.reduce((m, r) => (Math.abs(r[j]) > Math.abs(m[j]) ? r : m));
  console.log(`${nome}: ${quanti} fotogrammi · il tessuto si sposta al massimo di ${picco(1)[1].toFixed(0)} mm (in media ${picco(2)[2].toFixed(0)} mm) dopo ${picco(1)[0].toFixed(2)} s`,
    `· dondola di lato ${picco(3)[3].toFixed(1)}°, avanti-indietro ${picco(4)[4].toFixed(1)}°, si torce di ${picco(5)[5].toFixed(1)}°`,
    `· a 3 secondi: lato ${sonde[72][3].toFixed(1)}°, torsione ${sonde[72][5].toFixed(1)}°, tessuto ${sonde[72][1].toFixed(0)} mm`);
  return sonde;
}

// SOLO=da-destra rifà una scena sola e lascia l'altra com'è
let prime = null;
for (const [nome, verso] of Object.entries(SCENE)) {
  if (process.env.SOLO && process.env.SOLO !== nome) continue;
  const s = scena(nome, verso); prime = prime || s;
}
if (process.argv[3]) writeFileSync(process.argv[3], ['t,tessuto_max_mm,tessuto_medio_mm,lato_gradi,fondo_gradi,torsione_gradi', ...prime.map((r) => r.map((v) => v.toFixed(2)).join(','))].join('\n'));
