// La stoffa della camicia: fisica vera, calcolata nel browser a ogni fotogramma.
//
// Non si simula la camicia intera (140.000 triangoli) ma il suo telaio: la stessa camicia semplificata a circa
// 2.800 punti (`telaio.json`, lo prepara `camicia/prepara.py`). Ogni punto del telaio ha una massa, una velocità
// e i suoi vincoli: i fili non si allungano, il tessuto si piega ma ricorda la sua forma, collo e spalle sono
// appesi. L'aria spinge ogni lembo solo per la parte che lo investe di piatto e lo frena quando si muove: è
// questo, non un'onda disegnata, che fa nascere le pieghe e le fa spegnere senza rimbalzi.
// La camicia vera segue il telaio: ogni suo punto sta su un triangolo del telaio e si sposta con lui (vedi `lega`
// in camicia3d.js).
//
// Questo file non conosce three.js né il browser: si può provare da solo con Node (tools/prova-stoffa.js).
// Il proprietario ha bocciato le onde ad anello e l'oscillazione a molla ("non è naturale"): qui non ci sono.

const PASSO = 1 / 300;            // passo di calcolo, in secondi: piccolo, così i fili restano inestensibili
const PASSO_LENTO = 1 / 150;      // su un telefono lento: metà dei conti, i fili cedono appena di più
const LARGHEZZA = 128;            // punti per riga nell'immagine delle ossa (due per osso: posizione e normale)
const FOLATE = 6;                 // quante folate possono convivere

export const TESSUTO = {
  ritorno: 10,          // con che forza ogni punto torna al suo posto (1/s²): bassa, la camicia dondola piano
  appeso: 900,          // in più su collo e spalle, da cui pende
  aria: 7.5,            // quanto l'aria trascina il tessuto (1/s): alta, perché il cotone leggero è in balìa dell'aria
  attrito: 1.1,         // smorzamento del moto lungo il tessuto (1/s)
  compressione: 2600,   // un lato schiacciato cede (il tessuto fa una grinza); tirato, non si allunga
  piega: 70,            // memoria della forma tra due triangoli vicini
  rigido: 14,           // di quante volte è più dura la piega su polsini e abbottonatura
  brezza: 0.011,       // vento di fondo, in metri al secondo: appena un respiro
};

/** Il punto del triangolo (a, b, c: posizioni in `x`) più vicino a p: restituisce i tre pesi e il quadrato della distanza. */
export function sulTriangolo(px, py, pz, x, a, b, c, esce) {
  const abx = x[b] - x[a], aby = x[b + 1] - x[a + 1], abz = x[b + 2] - x[a + 2];
  const acx = x[c] - x[a], acy = x[c + 1] - x[a + 1], acz = x[c + 2] - x[a + 2];
  const apx = px - x[a], apy = py - x[a + 1], apz = pz - x[a + 2];
  const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
  let u, v, w;
  if (d1 <= 0 && d2 <= 0) { u = 1; v = 0; w = 0; } else {
    const bpx = px - x[b], bpy = py - x[b + 1], bpz = pz - x[b + 2];
    const d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
    if (d3 >= 0 && d4 <= d3) { u = 0; v = 1; w = 0; } else {
      const vc = d1 * d4 - d3 * d2;
      if (vc <= 0 && d1 >= 0 && d3 <= 0) { v = d1 / (d1 - d3); u = 1 - v; w = 0; } else {
        const cpx = px - x[c], cpy = py - x[c + 1], cpz = pz - x[c + 2];
        const d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
        if (d6 >= 0 && d5 <= d6) { u = 0; v = 0; w = 1; } else {
          const vb = d5 * d2 - d1 * d6;
          if (vb <= 0 && d2 >= 0 && d6 <= 0) { w = d2 / (d2 - d6); u = 1 - w; v = 0; } else {
            const va = d3 * d6 - d5 * d4;
            if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { w = (d4 - d3) / (d4 - d3 + d5 - d6); v = 1 - w; u = 0; } else {
              const k = 1 / (va + vb + vc); v = vb * k; w = vc * k; u = 1 - v - w;
            }
          }
        }
      }
    }
  }
  const qx = x[a] * u + x[b] * v + x[c] * w - px, qy = x[a + 1] * u + x[b + 1] * v + x[c + 1] * w - py, qz = x[a + 2] * u + x[b + 2] * v + x[c + 2] * w - pz;
  esce[0] = u; esce[1] = v; esce[2] = w;
  return qx * qx + qy * qy + qz * qz;
}

/**
 * @param {{punti:number[], triangoli:number[], appeso:number[], rigido:number[], parte:number[]}} dati  il telaio
 * @param {Partial<typeof TESSUTO>} [o]
 */
export function creaStoffa(dati, o = {}) {
  const P = { ...TESSUTO, ...o };
  const n = dati.punti.length / 3, nt = dati.triangoli.length / 3;
  const tri = Uint32Array.from(dati.triangoli);
  const x0 = Float32Array.from(dati.punti), x = Float32Array.from(dati.punti);
  const xp = new Float32Array(n * 3), v = new Float32Array(n * 3);
  const aria = new Float32Array(n * 3);            // il vento su ogni punto, in questo fotogramma
  const nor = new Float32Array(n * 3);
  const libero = new Uint8Array(n), ritorno = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = dati.appeso[i], r = dati.rigido[i];
    libero[i] = a < 0.9 ? 1 : 0;
    ritorno[i] = P.ritorno * (1 + 2.5 * r) + P.appeso * a * a;
  }

  // --- vincoli ---------------------------------------------------------------------------------------------
  // lati dei triangoli (i fili) e, per ogni lato tra due triangoli, la coppia di punti opposti (la piega)
  const indice = new Map(); const la = [], lb = [], o1 = [], o2 = [];
  for (let t = 0; t < nt; t++) for (let k = 0; k < 3; k++) {
    const a = tri[3 * t + k], b = tri[3 * t + (k + 1) % 3], c = tri[3 * t + (k + 2) % 3];
    const chiave = a < b ? a * n + b : b * n + a;
    const i = indice.get(chiave);
    if (i === undefined) { indice.set(chiave, la.length); la.push(a); lb.push(b); o1.push(c); o2.push(-1); }
    else if (o2[i] < 0) o2[i] = c;
  }
  const dist0 = (a, b) => Math.hypot(x0[3 * a] - x0[3 * b], x0[3 * a + 1] - x0[3 * b + 1], x0[3 * a + 2] - x0[3 * b + 2]);
  const va = [], vb = [], lungo = [], cedeTeso = [], cedeStretto = [];
  const vincolo = (a, b, teso, stretto) => {
    if (!libero[a] && !libero[b]) return;
    va.push(a); vb.push(b); lungo.push(dist0(a, b)); cedeTeso.push(teso); cedeStretto.push(stretto);
  };
  const vicini = Array.from({ length: n }, () => []);
  for (let i = 0; i < la.length; i++) {
    vicini[la[i]].push(lb[i]); vicini[lb[i]].push(la[i]);
    vincolo(la[i], lb[i], 0, 1 / P.compressione);
  }
  for (let i = 0; i < la.length; i++) {
    if (o2[i] < 0) continue;
    const duro = 1 + P.rigido * Math.max(dati.rigido[o1[i]], dati.rigido[o2[i]]);
    vincolo(o1[i], o2[i], 1 / (P.piega * duro), 1 / (P.piega * duro));
  }
  // cuciture: un punto vicinissimo a un triangolo che lungo il tessuto è lontano sta su un lembo sovrapposto
  // (le due metà dell'abbottonatura, il collo sulle spalle, i polsini chiusi). Lì la camicia è cucita o
  // abbottonata: il punto resta alla sua distanza da quel triangolo, e i lembi non si aprono.
  const cuc = [];                 // i, a, b, c (punti del triangolo), pesi (3), distanza
  {
    // nel modello i due lembi dell'abbottonatura stanno a 7-10 mm l'uno dall'altro (c'è il gambo dei bottoni)
    const R = 0.03, PRESA = 0.014, celle = new Map(), pesi = [0, 0, 0];
    const chiave = (i, j, k) => (i + 512) + (j + 512) * 1024 + (k + 512) * 1048576;
    for (let q = 0; q < nt; q++) {
      const a = tri[3 * q] * 3, b = tri[3 * q + 1] * 3, c = tri[3 * q + 2] * 3;
      const lo = [0, 1, 2].map((e) => Math.floor((Math.min(x0[a + e], x0[b + e], x0[c + e]) - PRESA) / R));
      const hi = [0, 1, 2].map((e) => Math.floor((Math.max(x0[a + e], x0[b + e], x0[c + e]) + PRESA) / R));
      for (let i = lo[0]; i <= hi[0]; i++) for (let j = lo[1]; j <= hi[1]; j++) for (let k = lo[2]; k <= hi[2]; k++) {
        const m = chiave(i, j, k); (celle.get(m) || celle.set(m, []).get(m)).push(q);
      }
    }
    for (let i = 0; i < n; i++) {
      // tutto ciò che sta entro tre lati dal punto è lo stesso lembo
      const stesso = new Set([i]);
      let fronte = [i];
      for (let g = 0; g < 3; g++) { const poi = []; for (const a of fronte) for (const b of vicini[a]) if (!stesso.has(b)) { stesso.add(b); poi.push(b); } fronte = poi; }
      const k = 3 * i;
      let meglio = null, vicino = PRESA * PRESA;
      for (const q of celle.get(chiave(Math.floor(x0[k] / R), Math.floor(x0[k + 1] / R), Math.floor(x0[k + 2] / R))) || []) {
        const a = tri[3 * q], b = tri[3 * q + 1], c = tri[3 * q + 2];
        if (stesso.has(a) || stesso.has(b) || stesso.has(c)) continue;
        if (dati.parte[a] !== dati.parte[i] && dati.parte[b] !== dati.parte[i] && dati.parte[c] !== dati.parte[i]) continue;
        if (!libero[i] && !libero[a] && !libero[b] && !libero[c]) continue;
        const d = sulTriangolo(x0[k], x0[k + 1], x0[k + 2], x0, a * 3, b * 3, c * 3, pesi);
        if (d < vicino) { vicino = d; meglio = [i, a, b, c, pesi[0], pesi[1], pesi[2], Math.sqrt(d)]; }
      }
      if (meglio) cuc.push(meglio);
    }
  }
  const nc = cuc.length;
  const CP = Uint32Array.from(cuc.flatMap((q) => q.slice(0, 4))), CW = Float32Array.from(cuc.flatMap((q) => q.slice(4, 8)));
  const nv = va.length;
  const VA = Uint32Array.from(va), VB = Uint32Array.from(vb), L0 = Float32Array.from(lungo);
  const CT = Float32Array.from(cedeTeso), CS = Float32Array.from(cedeStretto);

  // --- ossa: ciò che la camicia vera legge a ogni fotogramma. Per ogni punto del telaio, dove sta e dove guarda
  const righe = Math.ceil((n * 2) / LARGHEZZA);
  const ossa = new Float32Array(LARGHEZZA * righe * 4);

  function normali() {
    nor.fill(0);
    for (let t = 0; t < nt; t++) {
      const a = tri[3 * t] * 3, b = tri[3 * t + 1] * 3, c = tri[3 * t + 2] * 3;
      const ux = x[b] - x[a], uy = x[b + 1] - x[a + 1], uz = x[b + 2] - x[a + 2];
      const wx = x[c] - x[a], wy = x[c + 1] - x[a + 1], wz = x[c + 2] - x[a + 2];
      const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
      nor[a] += nx; nor[a + 1] += ny; nor[a + 2] += nz;
      nor[b] += nx; nor[b + 1] += ny; nor[b + 2] += nz;
      nor[c] += nx; nor[c + 1] += ny; nor[c + 2] += nz;
    }
    for (let i = 0; i < n * 3; i += 3) {
      const l = Math.hypot(nor[i], nor[i + 1], nor[i + 2]) || 1;
      nor[i] /= l; nor[i + 1] /= l; nor[i + 2] /= l;
    }
  }
  function scriviOssa() {
    for (let i = 0; i < n; i++) {
      const k = 3 * i, q = 8 * i;
      ossa[q] = x[k]; ossa[q + 1] = x[k + 1]; ossa[q + 2] = x[k + 2];
      ossa[q + 4] = nor[k]; ossa[q + 5] = nor[k + 1]; ossa[q + 6] = nor[k + 2];
    }
  }
  normali();
  const nor0 = Float32Array.from(nor);
  scriviOssa();

  // --- vento -----------------------------------------------------------------------------------------------
  const folate = [];              // { c:[x,y,z], d:[x,y,z], q:[x,y,z], forza, nata, fase }
  let tempo = 0, spesa = 0, passoDiCalcolo = PASSO;
  const orologio = () => (typeof performance === 'undefined' ? 0 : performance.now());
  /** Una folata che nasce nel punto (px,py,pz) e soffia nel verso (dx,dy,dz), con velocità `forza` in m/s. */
  function folata(px, py, pz, dx, dy, dz, forza) {
    const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
    // un asse di traverso al vento, per le increspature che non corrono dritte
    let qx = dy * 0.3 - dz * 0.9, qy = dz * 0.3 - dx * 0.3, qz = dx * 0.9 - dy * 0.3;
    const lq = Math.hypot(qx, qy, qz) || 1; qx /= lq; qy /= lq; qz /= lq;
    if (folate.length >= FOLATE) folate.shift();
    folate.push({ c: [px, py, pz], d: [dx, dy, dz], q: [qx, qy, qz], forza, nata: tempo, fase: (px * 37 + py * 91 + tempo * 7) % 6.283 });
  }
  /** Quanto soffia già: serve a non sommare folate all'infinito. */
  function carico() {
    let s = 0;
    for (const f of folate) { const eta = tempo - f.nata; s += f.forza * Math.exp(-eta / 0.5); }
    return s;
  }
  function soffia(gira) {
    // brezza di fondo: gira piano intorno alla camicia e respira; le sue increspature corrono col vento
    const giro = tempo * 0.17, respiro = 0.55 + 0.45 * Math.sin(tempo * 0.43) * Math.sin(tempo * 0.29 + 1.3);
    const bx = Math.cos(giro), bz = Math.sin(giro) * 0.8 + 0.2, forzaB = P.brezza * respiro;
    for (let i = folate.length - 1; i >= 0; i--) if (tempo - folate[i].nata > 5) folate.splice(i, 1);
    for (let i = 0; i < n; i++) {
      const k = 3 * i, px = x0[k], py = x0[k + 1], pz = x0[k + 2];
      const sb = px * bx + pz * bz;
      const mb = 0.6 + 0.4 * Math.sin(sb * 11 - tempo * 1.7 + py * 3.1) + 0.25 * Math.sin(sb * 23 - tempo * 2.9 + 1.1);
      // girando su sé stessa la camicia attraversa l'aria ferma: vista da lei, è l'aria che le gira intorno
      let wx = bx * forzaB * mb - gira * pz, wy = 0, wz = bz * forzaB * mb + gira * px;
      for (const f of folate) {
        const eta = tempo - f.nata;
        // arriva in fretta e se ne va piano; il suo centro corre col vento e si allarga
        const inv = f.forza * (1 - Math.exp(-eta / 0.05)) * Math.exp(-eta / 0.5);
        if (inv < 1e-4) continue;
        const corsa = 0.5 * eta, raggio = 0.11 + 0.14 * eta;
        const rx = px - (f.c[0] + f.d[0] * corsa), ry = py - (f.c[1] + f.d[1] * corsa), rz = pz - (f.c[2] + f.d[2] * corsa);
        const a = inv * Math.exp(-(rx * rx + ry * ry + rz * rz) / (raggio * raggio));
        if (a < 1e-4) continue;
        // il vento non è mai uniforme: raffiche più fitte che corrono nel suo verso
        const s = px * f.d[0] + py * f.d[1] + pz * f.d[2], tr = px * f.q[0] + py * f.q[1] + pz * f.q[2];
        // più increspatura che spinta: il tessuto va e viene, non si sposta di peso
        const m = 0.5 + 0.8 * Math.sin(s * 44 - eta * 12 + f.fase) + 0.5 * Math.sin(s * 23 + tr * 19 - eta * 7.3 + 2 * f.fase);
        wx += f.d[0] * a * m; wy += f.d[1] * a * m; wz += f.d[2] * a * m;
      }
      aria[k] = wx; aria[k + 1] = wy; aria[k + 2] = wz;
    }
  }

  /** Fa avanzare la stoffa di `dt` secondi. `gira` è la velocità con cui la camicia sta girando (radianti al secondo). */
  function passo(dt, gira = 0) {
    dt = Math.min(dt, 0.05);
    tempo += dt;
    const inizio = orologio();
    soffia(Math.max(-3, Math.min(3, gira)) * 0.22);      // meno del vero: girandola deve restare una camicia, non una bandiera
    const passi = Math.max(1, Math.min(12, Math.ceil(dt / passoDiCalcolo - 1e-6))), h = dt / passi, inv = 1 / (h * h);
    const frena = Math.max(0, 1 - P.attrito * h), tira = P.aria * h;
    for (let s = 0; s < passi; s++) {
      for (let i = 0; i < n; i++) {
        if (!libero[i]) continue;
        const k = 3 * i, nx = nor[k], ny = nor[k + 1], nz = nor[k + 2];
        // l'aria agisce solo di piatto: spinge il lembo che la riceve di fronte e frena quello che si muove
        const di = ((aria[k] - v[k]) * nx + (aria[k + 1] - v[k + 1]) * ny + (aria[k + 2] - v[k + 2]) * nz) * tira;
        const r = ritorno[i] * h;
        v[k] = (v[k] + di * nx - r * (x[k] - x0[k])) * frena;
        v[k + 1] = (v[k + 1] + di * ny - r * (x[k + 1] - x0[k + 1])) * frena;
        v[k + 2] = (v[k + 2] + di * nz - r * (x[k + 2] - x0[k + 2])) * frena;
        xp[k] = x[k]; xp[k + 1] = x[k + 1]; xp[k + 2] = x[k + 2];
        x[k] += v[k] * h; x[k + 1] += v[k + 1] * h; x[k + 2] += v[k + 2] * h;
      }
      for (let c = 0; c < nv; c++) {
        const ia = VA[c], ib = VB[c], a = 3 * ia, b = 3 * ib;
        const dx = x[a] - x[b], dy = x[a + 1] - x[b + 1], dz = x[a + 2] - x[b + 2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d < 1e-9) continue;
        const C = d - L0[c], wa = libero[ia], wb = libero[ib];
        const g = -C / ((wa + wb + (C > 0 ? CT[c] : CS[c]) * inv) * d);
        if (wa) { x[a] += g * dx; x[a + 1] += g * dy; x[a + 2] += g * dz; }
        if (wb) { x[b] -= g * dx; x[b + 1] -= g * dy; x[b + 2] -= g * dz; }
      }
      for (let c = 0; c < nc; c++) {
        const i = CP[4 * c] * 3, a = CP[4 * c + 1] * 3, b = CP[4 * c + 2] * 3, e = CP[4 * c + 3] * 3;
        const pa = CW[4 * c], pb = CW[4 * c + 1], pe = CW[4 * c + 2];
        const dx = x[i] - (pa * x[a] + pb * x[b] + pe * x[e]), dy = x[i + 1] - (pa * x[a + 1] + pb * x[b + 1] + pe * x[e + 1]), dz = x[i + 2] - (pa * x[a + 2] + pb * x[b + 2] + pe * x[e + 2]);
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d < 1e-7) continue;
        const wi = libero[i / 3], wa = libero[a / 3] * pa, wb = libero[b / 3] * pb, we = libero[e / 3] * pe;
        const g = -(d - CW[4 * c + 3]) / ((wi + wa * pa + wb * pb + we * pe + 1e-9) * d);
        if (wi) { x[i] += g * dx; x[i + 1] += g * dy; x[i + 2] += g * dz; }
        x[a] -= g * wa * dx; x[a + 1] -= g * wa * dy; x[a + 2] -= g * wa * dz;
        x[b] -= g * wb * dx; x[b + 1] -= g * wb * dy; x[b + 2] -= g * wb * dz;
        x[e] -= g * we * dx; x[e + 1] -= g * we * dy; x[e + 2] -= g * we * dz;
      }
      const su = 1 / h;
      for (let i = 0; i < n; i++) {
        if (!libero[i]) continue;
        const k = 3 * i;
        v[k] = (x[k] - xp[k]) * su; v[k + 1] = (x[k + 1] - xp[k + 1]) * su; v[k + 2] = (x[k + 2] - xp[k + 2]) * su;
      }
    }
    // se qualcosa va storto (un numero impossibile), la stoffa torna a riposo invece di sparire
    for (let k = 0; k < n * 3; k++) {
      if (!(Math.abs(x[k] - x0[k]) < 0.3)) { x.set(x0); v.fill(0); break; }
    }
    normali();
    scriviOssa();
    // se il calcolo pesa troppo (più di 6 millesimi di secondo a fotogramma, in media) si dimezzano i passi
    spesa += (orologio() - inizio - spesa) * 0.05;
    if (spesa > 6 && passoDiCalcolo === PASSO) passoDiCalcolo = PASSO_LENTO;
  }

  /** Dove un raggio (origine e direzione, nello spazio della camicia) incontra il tessuto com'è adesso. */
  function colpo(ox, oy, oz, dx, dy, dz) {
    let vicino = Infinity;
    for (let t = 0; t < nt; t++) {
      const a = tri[3 * t] * 3, b = tri[3 * t + 1] * 3, c = tri[3 * t + 2] * 3;
      const e1x = x[b] - x[a], e1y = x[b + 1] - x[a + 1], e1z = x[b + 2] - x[a + 2];
      const e2x = x[c] - x[a], e2y = x[c + 1] - x[a + 1], e2z = x[c + 2] - x[a + 2];
      const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
      const det = e1x * px + e1y * py + e1z * pz;
      if (Math.abs(det) < 1e-12) continue;
      const f = 1 / det, sx = ox - x[a], sy = oy - x[a + 1], sz = oz - x[a + 2];
      const u = f * (sx * px + sy * py + sz * pz);
      if (u < 0 || u > 1) continue;
      const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
      const w = f * (dx * qx + dy * qy + dz * qz);
      if (w < 0 || u + w > 1) continue;
      const d = f * (e2x * qx + e2y * qy + e2z * qz);
      if (d > 0 && d < vicino) vicino = d;
    }
    return vicino < Infinity ? [ox + dx * vicino, oy + dy * vicino, oz + dz * vicino] : null;
  }

  return {
    punti: n, triangoli: tri, riposo: x0, normaliRiposo: nor0, adesso: x, parte: dati.parte, vincoli: nv, cuciture: nc, cucite: CP,
    ossa, larghezza: LARGHEZZA, righe,
    passo, folata, carico, colpo,
  };
}
