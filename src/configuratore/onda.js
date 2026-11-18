// La stoffa che ondeggia: la camicia leggera, ma con il tessuto che si muove come un telo.
// PROVA (2026-11-18): si apre con ?prova=onda nell'indirizzo (anche onda-a, più lieve, e onda-c, più mossa).
//
// Il proprietario ha mandato un sito di riferimento (motion-depth.framer.website: passando sopra un'immagine, quella
// ondeggia come un telo di stoffa, con le pieghe in chiaro e scuro) e ha chiesto: "Oggi la camicia è immobile e si
// muove solo a destra e sinistra, riesci ad applicare l'animazione [...] sulla nostra camicia? (Anche più leggero)".
// Qui la camicia ritagliata di leggera.js non è più un'immagine spostata tutta insieme: è stesa su una griglia di
// 900 punti che si comporta come stoffa. In alto, dove c'è la gruccia, la griglia è appesa e segue il dondolio;
// sotto è libera: resta indietro quando la gruccia si muove, ondeggia finché il mouse le sta sopra, cede dove passa
// la mano, e poi torna piatta. Le pieghe prendono un po' più o un po' meno luce secondo come si girano verso la
// finestra della scena. Piatta, è l'immagine di Blender punto per punto.
// Lo disegna la scheda grafica (WebGL, un solo disegno di 1.700 triangoli); il conto della stoffa pesa meno di un
// millisecondo a fotogramma. Dove il browser non ha l'accelerazione grafica non parte, e resta la camicia leggera.

const COLONNE = 22, RIGHE = 40;        // i punti della griglia
const BORDO = 40;                      // punti del fotogramma di griglia in più intorno alla camicia
const APPESA = [240, 440];             // (punti del fotogramma, dall'alto) fin qui la griglia è appesa alla gruccia; poi si libera piano, fino a qui (uno stacco netto farebbe una piega sotto le spalle)
const RITORNO = 60, FRENO = 2.8;       // quanto il tessuto torna piatto (più è alto, meno resta indietro quando la gruccia dondola) e quanto si smorza
const GIRI = 3;                        // passate che tengono le maglie della griglia alla loro lunghezza
// quanto ondeggia sotto il mouse, quanto cede sotto la mano e quanto la segue, quanto le pieghe cambiano luce
const MISURA = { vento: 0.48, mano: 0.6, trascina: 0.35, luce: 0.8 };
const INDIETRO = 0.3;                  // quando la gruccia si sposta, di quanta parte di quello spostamento il tessuto resta indietro (il resto lo segue subito)

const VS = `
attribute vec3 aPos;
attribute vec3 aNrm;
attribute vec2 aUv;
uniform mat4 uCamera;
varying vec2 vUv;
varying vec3 vN;
void main() {
  vUv = aUv;
  vN = aNrm;
  gl_Position = uCamera * vec4(aPos, 1.0);
}`;
const FS = `
precision mediump float;
uniform sampler2D uFoto;
uniform vec3 uSole;
uniform vec3 uPiatta;
uniform float uLuce;
varying vec2 vUv;
varying vec3 vN;
void main() {
  if (vUv.x < 0.0 || vUv.x > 1.0 || vUv.y < 0.0 || vUv.y > 1.0) discard;
  vec4 c = texture2D(uFoto, vUv);
  float luce = clamp(1.0 + uLuce * (dot(normalize(vN), uSole) - dot(uPiatta, uSole)), 0.74, 1.2);
  gl_FragColor = vec4(c.rgb * luce, c.a);
}`;

/**
 * @param {object} o
 *   piano      l'elemento che misura in punti del fotogramma (da leggera.js), dove mettere la tela
 *   dopo       l'elemento dopo il quale metterla (l'ombra)
 *   foto       l'immagine della camicia ritagliata, già caricata
 *   riquadro   [x, y, larghezza, altezza] della camicia nel fotogramma
 *   rx         dove comincia il piano nel fotogramma
 *   camera     3 righe x 4: da un punto della scena a (x per w, y per w, w) nel fotogramma
 *   daFerma    3 x 3: da un punto del fotogramma al piano della camicia ferma
 *   zPiano     dove sta quel piano
 *   sole       il verso da cui arriva la luce nella scena
 *   forza      1 è la misura di mezzo
 *   comunque   disegna anche se il browser non ha l'accelerazione grafica (solo per le prove)
 * @returns l'oggetto che leggera.js fa avanzare e disegnare, o null se qui la stoffa non si può fare
 */
export function creaOnda({ piano, dopo, foto, riquadro, rx, camera, daFerma, zPiano, sole, forza = 1, comunque = false }) {
  const tela = document.createElement('canvas');
  const opzioni = { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: !comunque };
  const gl = tela.getContext('webgl', opzioni);
  if (!gl) return null;

  // --- la griglia: dove sta ogni punto da fermo, sul piano della camicia, e quale punto della foto porta
  const [fx0, fy0, fw, fh] = [riquadro[0] - BORDO, riquadro[1] - BORDO, riquadro[2] + 2 * BORDO, riquadro[3] + 2 * BORDO];
  const N = COLONNE * RIGHE;
  const fermo = new Float32Array(N * 3), ora = new Float32Array(N * 3), prima = new Float32Array(N * 3), meta = new Float32Array(N * 3);
  const appeso = new Float32Array(N), uv = new Float32Array(N * 2);
  for (let r = 0; r < RIGHE; r++) for (let c = 0; c < COLONNE; c++) {
    const i = r * COLONNE + c, x = fx0 + fw * c / (COLONNE - 1), y = fy0 + fh * r / (RIGHE - 1);
    const w = daFerma[2][0] * x + daFerma[2][1] * y + daFerma[2][2];
    fermo[i * 3] = (daFerma[0][0] * x + daFerma[0][1] * y + daFerma[0][2]) / w;
    fermo[i * 3 + 1] = (daFerma[1][0] * x + daFerma[1][1] * y + daFerma[1][2]) / w;
    fermo[i * 3 + 2] = zPiano;
    uv[i * 2] = (x - riquadro[0]) / riquadro[2]; uv[i * 2 + 1] = (y - riquadro[1]) / riquadro[3];
    const t = Math.max(0, Math.min(1, 1 - (y - APPESA[0]) / (APPESA[1] - APPESA[0])));
    appeso[i] = t * t * (3 - 2 * t) * (t < 1 ? 0.6 : 1);                    // sotto la gruccia tiene sempre meno, senza scalini
  }
  ora.set(fermo); prima.set(fermo); meta.set(fermo);
  // le maglie: ogni punto con quello a destra, quello sotto e i due in diagonale, alla distanza che hanno da fermi
  const maglie = [];
  const lega = (a, b) => maglie.push(a, b, Math.hypot(fermo[a * 3] - fermo[b * 3], fermo[a * 3 + 1] - fermo[b * 3 + 1]));
  for (let r = 0; r < RIGHE; r++) for (let c = 0; c < COLONNE; c++) {
    const i = r * COLONNE + c;
    if (c + 1 < COLONNE) lega(i, i + 1);
    if (r + 1 < RIGHE) lega(i, i + COLONNE);
    if (c + 1 < COLONNE && r + 1 < RIGHE) { lega(i, i + COLONNE + 1); lega(i + 1, i + COLONNE); }
  }
  const triangoli = new Uint16Array((COLONNE - 1) * (RIGHE - 1) * 6);
  for (let r = 0, k = 0; r < RIGHE - 1; r++) for (let c = 0; c < COLONNE - 1; c++) {
    const i = r * COLONNE + c;
    triangoli.set([i, i + COLONNE, i + 1, i + 1, i + COLONNE, i + COLONNE + 1], k); k += 6;
  }

  // --- la tela: copre la griglia, più un margine per quando la camicia dondola
  const MARGINE = 90, tx0 = fx0 - MARGINE, ty0 = fy0 - MARGINE, tw = fw + 2 * MARGINE, th = fh + 2 * MARGINE;
  tela.className = 'configura__onda';
  tela.setAttribute('aria-hidden', 'true');
  tela.style.left = tx0 - rx + 'px'; tela.style.top = ty0 + 'px'; tela.style.width = tw + 'px'; tela.style.height = th + 'px';
  dopo.after(tela);
  // dal punto della scena al punto della tela (per colonne, come le vuole la scheda grafica)
  const C = camera, m = new Float32Array(16);
  for (let j = 0; j < 4; j++) {
    m[j * 4] = 2 / tw * (C[0][j] - tx0 * C[2][j]) - C[2][j];
    m[j * 4 + 1] = C[2][j] - 2 / th * (C[1][j] - ty0 * C[2][j]);
    m[j * 4 + 2] = 0;
    m[j * 4 + 3] = C[2][j];
  }

  const programma = gl.createProgram();
  for (const [tipo, testo] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, FS]]) {
    const s = gl.createShader(tipo);
    gl.shaderSource(s, testo); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { tela.remove(); return null; }
    gl.attachShader(programma, s);
  }
  gl.linkProgram(programma);
  if (!gl.getProgramParameter(programma, gl.LINK_STATUS)) { tela.remove(); return null; }
  gl.useProgram(programma);
  const normali = new Float32Array(N * 3);
  const serbatoio = (dati, dinamico, nome, quanti) => {
    const b = gl.createBuffer(), dove = gl.getAttribLocation(programma, nome);
    gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, dati, dinamico ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
    gl.enableVertexAttribArray(dove); gl.vertexAttribPointer(dove, quanti, gl.FLOAT, false, 0, 0);
    return b;
  };
  const bPunti = serbatoio(ora, true, 'aPos', 3), bNormali = serbatoio(normali, true, 'aNrm', 3);
  serbatoio(uv, false, 'aUv', 2);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, triangoli, gl.STATIC_DRAW);
  const carica = (immagine) => {
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, immagine);
  };
  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  carica(foto);
  gl.uniformMatrix4fv(gl.getUniformLocation(programma, 'uCamera'), false, m);
  const lungo = Math.hypot(...sole), luce = sole.map((v) => v / lungo);
  gl.uniform3fv(gl.getUniformLocation(programma, 'uSole'), luce);
  gl.uniform1f(gl.getUniformLocation(programma, 'uLuce'), MISURA.luce * forza);
  const uPiatta = gl.getUniformLocation(programma, 'uPiatta');
  gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.clearColor(0, 0, 0, 0);

  // --- la stoffa
  let tempo = 0, vento = 0, mossa = 0, persa = false;
  /**
   * Un passo di tempo. `appesa`: la matrice 4 x 4 (per righe) del dondolio; `soffia`: da 0 a 1, quanto il mouse la
   * tiene mossa; `mano`: null, o { x, y (sul piano, in metri), vx, vy (metri al secondo), preme (da 0 a 1) }.
   */
  function passo(dt, appesa, soffia, mano) {
    tempo += dt;
    vento += (soffia - vento) * Math.min(1, dt * (soffia > vento ? 3.2 : 1.3));
    // nella misura più lieve il tessuto è più teso e segue la gruccia da vicino; in quella più mossa resta più indietro
    const A = appesa, smorza = Math.max(0, 1 - FRENO * dt), dt2 = dt * dt, spinta = MISURA.vento * forza * vento, torna = RITORNO / forza;
    const segue = 1 - Math.max(0.12, Math.min(0.6, INDIETRO * forza));
    for (let i = 0; i < N; i++) {
      const k = i * 3, x0 = fermo[k], y0 = fermo[k + 1], z0 = fermo[k + 2];
      // dove starebbe il punto se la camicia fosse rigida: è lì che il tessuto vuole tornare
      const mx = A[0][0] * x0 + A[0][1] * y0 + A[0][2] * z0 + A[0][3], my = A[1][0] * x0 + A[1][1] * y0 + A[1][2] * z0 + A[1][3], mz = A[2][0] * x0 + A[2][1] * y0 + A[2][2] * z0 + A[2][3];
      // la gruccia porta con sé il tessuto: la gran parte del suo spostamento passa subito a ogni punto, il resto no,
      // ed è quel resto che il tessuto recupera in ritardo
      const sx = (mx - meta[k]) * segue, sy = (my - meta[k + 1]) * segue, sz = (mz - meta[k + 2]) * segue;
      meta[k] = mx; meta[k + 1] = my; meta[k + 2] = mz;
      if (appeso[i] >= 1) { ora[k] = prima[k] = mx; ora[k + 1] = prima[k + 1] = my; ora[k + 2] = prima[k + 2] = mz; continue; }
      ora[k] += sx; ora[k + 1] += sy; ora[k + 2] += sz; prima[k] += sx; prima[k + 1] += sy; prima[k + 2] += sz;
      const x = ora[k], y = ora[k + 1], z = ora[k + 2];
      let ax = torna * (mx - x), ay = torna * (my - y), az = torna * (mz - z);
      if (spinta > 0) {
        // l'aria: tre onde lente che si incrociano, mai uguali due volte. Muovono il tessuto avanti e indietro
        az += spinta * (0.55 * Math.sin(7.3 * x0 + 1.9 * y0 + 2.1 * tempo) + 0.35 * Math.sin(-5.1 * x0 + 9.7 * y0 - 3.3 * tempo + 1.7) + 0.25 * Math.sin(13.1 * x0 - 4.2 * y0 + 5.2 * tempo + 0.6));
      }
      if (mano) {
        const dx = x0 - mano.x, dy = y0 - mano.y, vicino = Math.exp(-(dx * dx + dy * dy) / 0.0098) * mano.preme * forza;
        if (vicino > 0.01) { az -= MISURA.mano * vicino; ax += MISURA.trascina * mano.vx * vicino; ay += MISURA.trascina * mano.vy * vicino; }
      }
      ora[k] = x + (x - prima[k]) * smorza + ax * dt2; ora[k + 1] = y + (y - prima[k + 1]) * smorza + ay * dt2; ora[k + 2] = z + (z - prima[k + 2]) * smorza + az * dt2;
      prima[k] = x; prima[k + 1] = y; prima[k + 2] = z;
    }
    // le maglie tornano alla loro lunghezza: è questo che fa del telo una stoffa e non una gomma
    for (let giro = 0; giro < GIRI; giro++) for (let e = 0; e < maglie.length; e += 3) {
      const a = maglie[e] * 3, b = maglie[e + 1] * 3, pa = 1 - appeso[maglie[e]], pb = 1 - appeso[maglie[e + 1]], pesi = pa + pb;
      if (pesi <= 0) continue;
      const dx = ora[b] - ora[a], dy = ora[b + 1] - ora[a + 1], dz = ora[b + 2] - ora[a + 2], d = Math.hypot(dx, dy, dz) || 1e-6, q = (d - maglie[e + 2]) / d / pesi * 0.5;
      ora[a] += dx * q * pa; ora[a + 1] += dy * q * pa; ora[a + 2] += dz * q * pa;
      ora[b] -= dx * q * pb; ora[b + 1] -= dy * q * pb; ora[b + 2] -= dz * q * pb;
    }
    // vicino alla gruccia il tessuto è tenuto: più su, più è fermo
    mossa = 0;
    for (let i = 0; i < N; i++) {
      const k = i * 3, t = appeso[i];
      if (t > 0 && t < 1) { ora[k] += (meta[k] - ora[k]) * t; ora[k + 1] += (meta[k + 1] - ora[k + 1]) * t; ora[k + 2] += (meta[k + 2] - ora[k + 2]) * t; }
      const s = Math.abs(ora[k] - meta[k]) + Math.abs(ora[k + 1] - meta[k + 1]) + Math.abs(ora[k + 2] - meta[k + 2]) + (Math.abs(ora[k] - prima[k]) + Math.abs(ora[k + 2] - prima[k + 2])) * 20;
      if (s > mossa) mossa = s;
    }
  }

  /** Quanto è lontana dall'essere ferma e piatta (metri, più il vento che ancora soffia): a zero si può smettere. */
  const energia = () => mossa * 0.4 + vento * 0.004;
  /** Di quanto, al massimo, un punto è lontano da dove starebbe a camicia rigida (metri): per le prove. */
  const scarto = () => { let max = 0; for (let k = 0; k < N * 3; k += 3) max = Math.max(max, Math.hypot(ora[k] - meta[k], ora[k + 1] - meta[k + 1], ora[k + 2] - meta[k + 2])); return max; };

  /** Rimette la stoffa esattamente piatta sulla camicia rigida (ferma: `appesa` è la matrice del dondolio, o niente). */
  function stendi(appesa) {
    for (let i = 0; i < N; i++) {
      const k = i * 3, x0 = fermo[k], y0 = fermo[k + 1], z0 = fermo[k + 2], A = appesa;
      ora[k] = prima[k] = A ? A[0][0] * x0 + A[0][1] * y0 + A[0][2] * z0 + A[0][3] : x0;
      ora[k + 1] = prima[k + 1] = A ? A[1][0] * x0 + A[1][1] * y0 + A[1][2] * z0 + A[1][3] : y0;
      ora[k + 2] = prima[k + 2] = A ? A[2][0] * x0 + A[2][1] * y0 + A[2][2] * z0 + A[2][3] : z0;
    }
    vento = 0; mossa = 0;
  }

  /** Le normali della griglia, dai punti vicini. */
  function gira() {
    for (let r = 0; r < RIGHE; r++) for (let c = 0; c < COLONNE; c++) {
      const i = (r * COLONNE + c) * 3, sx = (r * COLONNE + Math.max(0, c - 1)) * 3, dx = (r * COLONNE + Math.min(COLONNE - 1, c + 1)) * 3, su = (Math.max(0, r - 1) * COLONNE + c) * 3, giu = (Math.min(RIGHE - 1, r + 1) * COLONNE + c) * 3;
      const ux = ora[dx] - ora[sx], uy = ora[dx + 1] - ora[sx + 1], uz = ora[dx + 2] - ora[sx + 2], vx = ora[su] - ora[giu], vy = ora[su + 1] - ora[giu + 1], vz = ora[su + 2] - ora[giu + 2];
      normali[i] = uy * vz - uz * vy; normali[i + 1] = uz * vx - ux * vz; normali[i + 2] = ux * vy - uy * vx;
    }
  }

  /** Disegna la stoffa com'è adesso. `appesa`: la matrice del dondolio (per sapere com'è girata la camicia rigida). */
  function disegna(appesa) {
    if (persa) return;
    gira();
    gl.bindBuffer(gl.ARRAY_BUFFER, bPunti); gl.bufferSubData(gl.ARRAY_BUFFER, 0, ora);
    gl.bindBuffer(gl.ARRAY_BUFFER, bNormali); gl.bufferSubData(gl.ARRAY_BUFFER, 0, normali);
    const A = appesa;
    gl.uniform3f(uPiatta, A ? A[0][2] : 0, A ? A[1][2] : 0, A ? A[2][2] : 1);
    gl.viewport(0, 0, tela.width, tela.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawElements(gl.TRIANGLES, triangoli.length, gl.UNSIGNED_SHORT, 0);
  }

  /** La tela prende i punti dello schermo che servono: `scala` è quanto il piano è rimpicciolito sullo schermo. */
  function misura(scala) {
    const fitto = Math.min(window.devicePixelRatio || 1, 2), w = Math.max(2, Math.round(tw * scala * fitto)), h = Math.max(2, Math.round(th * scala * fitto));
    if (tela.width === w && tela.height === h) return false;
    tela.width = w; tela.height = h;
    return true;
  }

  tela.addEventListener('webglcontextlost', (e) => { e.preventDefault(); persa = true; tela.dispatchEvent(new CustomEvent('ondapersa', { bubbles: true })); });
  return { tela, passo, energia, scarto, stendi, disegna, misura, cambiaFoto: carica, get persa() { return persa; } };
}
