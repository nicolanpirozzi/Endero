// Legare i punti veri della camicia al telaio (la camicia semplificata su cui gira la fisica di stoffa.mjs).
// Serve al film (muovi.mjs: dove sta ogni punto in ogni fotogramma) e alla camicia in diretta (camicia/viva/monta.mjs:
// gli stessi numeri vanno al browser, che fa il conto nella scheda grafica).
import { sulTriangolo } from './stoffa.mjs';

/** Cerca, per un punto, il triangolo del telaio più vicino tra quelli della sua parte (una manica non deve
 *  attaccarsi al fianco che le sta accanto). */
export function cercatore(stoffa) {
  const x = stoffa.riposo, tri = stoffa.triangoli, nt = tri.length / 3, LATO = 0.03;
  const parti = new Uint8Array(nt), celle = new Map();
  const chiave = (i, j, k) => (i + 512) + (j + 512) * 1024 + (k + 512) * 1048576;
  for (let t = 0; t < nt; t++) {
    const a = tri[3 * t] * 3, b = tri[3 * t + 1] * 3, c = tri[3 * t + 2] * 3;
    parti[t] = (1 << stoffa.parte[a / 3]) | (1 << stoffa.parte[b / 3]) | (1 << stoffa.parte[c / 3]);
    const lo = [0, 1, 2].map((e) => Math.floor(Math.min(x[a + e], x[b + e], x[c + e]) / LATO));
    const hi = [0, 1, 2].map((e) => Math.floor(Math.max(x[a + e], x[b + e], x[c + e]) / LATO));
    for (let i = lo[0]; i <= hi[0]; i++) for (let j = lo[1]; j <= hi[1]; j++) for (let k = lo[2]; k <= hi[2]; k++) {
      const q = chiave(i, j, k); (celle.get(q) || celle.set(q, []).get(q)).push(t);
    }
  }
  const pesi = [0, 0, 0];
  return (px, py, pz, parte) => {
    const ci = Math.floor(px / LATO), cj = Math.floor(py / LATO), ck = Math.floor(pz / LATO), bit = 1 << parte;
    let meglio = -1, vicino = Infinity, w = [1, 0, 0];
    const prova = (t) => {
      if (!(parti[t] & bit)) return;
      const d = sulTriangolo(px, py, pz, x, tri[3 * t] * 3, tri[3 * t + 1] * 3, tri[3 * t + 2] * 3, pesi);
      if (d < vicino) { vicino = d; meglio = t; w = [pesi[0], pesi[1], pesi[2]]; }
    };
    for (let giro = 1; giro <= 4 && (meglio < 0 || vicino > ((giro - 1) * LATO) ** 2); giro++) {
      for (let i = -giro; i <= giro; i++) for (let j = -giro; j <= giro; j++) for (let k = -giro; k <= giro; k++) {
        if (Math.max(Math.abs(i), Math.abs(j), Math.abs(k)) !== giro && giro > 1) continue;
        for (const t of celle.get(chiave(ci + i, cj + j, ck + k)) || []) prova(t);
      }
    }
    if (meglio < 0) for (let t = 0; t < nt; t++) prova(t);
    return [tri[3 * meglio], tri[3 * meglio + 1], tri[3 * meglio + 2], w[0], w[1], w[2]];
  };
}

/** I tre assi che seguono il tessuto nel punto di un triangolo: verso fuori, lungo il lato più lungo, di traverso. */
export function assi(pos, nor, a, b, c, wa, wb, wc, esce) {
  let sx = wa * nor[a] + wb * nor[b] + wc * nor[c], sy = wa * nor[a + 1] + wb * nor[b + 1] + wc * nor[c + 1], sz = wa * nor[a + 2] + wb * nor[b + 2] + wc * nor[c + 2];
  let l = Math.hypot(sx, sy, sz) || 1; sx /= l; sy /= l; sz /= l;
  let lx = pos[b] - pos[a], ly = pos[b + 1] - pos[a + 1], lz = pos[b + 2] - pos[a + 2];
  const s = lx * sx + ly * sy + lz * sz; lx -= s * sx; ly -= s * sy; lz -= s * sz;
  l = Math.hypot(lx, ly, lz) || 1; lx /= l; ly /= l; lz /= l;
  esce[0] = wa * pos[a] + wb * pos[b] + wc * pos[c]; esce[1] = wa * pos[a + 1] + wb * pos[b + 1] + wc * pos[c + 1]; esce[2] = wa * pos[a + 2] + wb * pos[b + 2] + wc * pos[c + 2];
  esce[3] = lx; esce[4] = ly; esce[5] = lz;
  esce[6] = sy * lz - sz * ly; esce[7] = sz * lx - sx * lz; esce[8] = sx * ly - sy * lx;
  esce[9] = sx; esce[10] = sy; esce[11] = sz;
}

/** Lega i punti veri al telaio: per ogni punto, i tre vertici del triangolo del telaio su cui sta (`osso`), il punto
 *  del triangolo che gli sta sotto (`peso`) e lo scarto da lì, sui tre assi che seguono il tessuto (`scarto`, metri).
 *  `gruppo` (per i bottoni): i punti dello stesso gruppo si muovono interi, col tessuto che sta sotto il loro centro.
 *  `tondi`: i pesi si arrotondano a 255esimi prima di misurare lo scarto (così si possono scrivere in un byte). */
export function legatura(stoffa, punti, parteDi, gruppo, tondi = false) {
  const n = punti.length / 3, cerca = cercatore(stoffa), x0 = stoffa.riposo, n0 = stoffa.normaliRiposo;
  const osso = new Uint32Array(n * 3), peso = new Float32Array(n * 3), scarto = new Float32Array(n * 3), f = new Float64Array(12);
  const scrivi = (i, a, b, c, wa, wb, wc) => {
    // il lato che dà il verso dev'essere lungo: se il primo è corto si gira il triangolo
    const l2 = (p, q) => (x0[3 * p] - x0[3 * q]) ** 2 + (x0[3 * p + 1] - x0[3 * q + 1]) ** 2 + (x0[3 * p + 2] - x0[3 * q + 2]) ** 2;
    const ab = l2(a, b), bc = l2(b, c), ca = l2(c, a);
    if (bc > ab && bc >= ca) { [a, b, c] = [b, c, a]; [wa, wb, wc] = [wb, wc, wa]; } else if (ca > ab && ca > bc) { [a, b, c] = [c, a, b]; [wa, wb, wc] = [wc, wa, wb]; }
    if (tondi) {
      let pa = Math.round(wa * 255), pb = Math.round(wb * 255); const pc = Math.max(0, 255 - pa - pb);
      if (pa + pb > 255) pb = 255 - pa;
      wa = pa / 255; wb = pb / 255; wc = pc / 255;
    }
    assi(x0, n0, a * 3, b * 3, c * 3, wa, wb, wc, f);
    const dx = punti[3 * i] - f[0], dy = punti[3 * i + 1] - f[1], dz = punti[3 * i + 2] - f[2];
    osso.set([a, b, c], 3 * i); peso.set([wa, wb, wc], 3 * i);
    scarto.set([dx * f[3] + dy * f[4] + dz * f[5], dx * f[6] + dy * f[7] + dz * f[8], dx * f[9] + dy * f[10] + dz * f[11]], 3 * i);
  };
  if (!gruppo) {
    for (let i = 0; i < n; i++) scrivi(i, ...cerca(punti[3 * i], punti[3 * i + 1], punti[3 * i + 2], parteDi ? parteDi[i] : 0));
  } else {
    const liste = new Map();
    for (let i = 0; i < n; i++) (liste.get(gruppo[i]) || liste.set(gruppo[i], []).get(gruppo[i])).push(i);
    for (const lista of liste.values()) {
      let cx = 0, cy = 0, cz = 0;
      for (const i of lista) { cx += punti[3 * i]; cy += punti[3 * i + 1]; cz += punti[3 * i + 2]; }
      cx /= lista.length; cy /= lista.length; cz /= lista.length;
      // i bottoni dei polsini stanno sulle maniche: la parte è quella del tessuto più vicino, qualunque sia
      let meglio = null, vicino = Infinity;
      for (const parte of [0, 1, 2]) {
        const r = cerca(cx, cy, cz, parte); assi(x0, n0, r[0] * 3, r[1] * 3, r[2] * 3, r[3], r[4], r[5], f);
        const d = (cx - f[0]) ** 2 + (cy - f[1]) ** 2 + (cz - f[2]) ** 2;
        if (d < vicino) { vicino = d; meglio = r; }
      }
      for (const i of lista) scrivi(i, ...meglio);
    }
  }
  return { punti: n, osso, peso, scarto };
}

/** Restituisce la funzione che, dato lo stato del telaio, scrive dove stanno adesso i punti legati. */
export function segue(stoffa, { punti: n, osso, peso, scarto }) {
  const f = new Float64Array(12);
  return (esce, da) => {
    const pos = stoffa.adesso, nor = normaliDi(stoffa);
    for (let i = 0; i < n; i++) {
      assi(pos, nor, osso[3 * i] * 3, osso[3 * i + 1] * 3, osso[3 * i + 2] * 3, peso[3 * i], peso[3 * i + 1], peso[3 * i + 2], f);
      const u = scarto[3 * i], v = scarto[3 * i + 1], w = scarto[3 * i + 2], k = da + 3 * i;
      esce[k] = f[0] + u * f[3] + v * f[6] + w * f[9];
      esce[k + 1] = f[1] + u * f[4] + v * f[7] + w * f[10];
      esce[k + 2] = f[2] + u * f[5] + v * f[8] + w * f[11];
    }
  };
}

/** Le normali del telaio com'è adesso (stoffa.mjs le tiene nell'immagine delle ossa, una ogni due punti). */
let scorta = null;
export function normaliDi(stoffa) {
  if (!scorta || scorta.length !== stoffa.punti * 3) scorta = new Float32Array(stoffa.punti * 3);
  for (let i = 0; i < stoffa.punti; i++) { scorta[3 * i] = stoffa.ossa[8 * i + 4]; scorta[3 * i + 1] = stoffa.ossa[8 * i + 5]; scorta[3 * i + 2] = stoffa.ossa[8 * i + 6]; }
  return scorta;
}
