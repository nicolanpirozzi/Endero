// La camicia in diretta: il browser muove la forma, e sopra ci proietta le immagini calcolate da Blender.
// PROVA (2026-11-17): si apre con ?prova=viva nell'indirizzo.
//
// Il proprietario vuole "poterla muovere come voglio, quanto voglio, anche continuamente", come il cappotto di
// beat.noomoagency.com, e ha scelto: camicia sempre di fronte, tessuto che cede e ondeggia dove passa il mouse.
// Le prime prove di 3D in diretta le aveva bocciate perché sembravano finte ("di plastica"): lì la luce la calcolava
// il browser. Qui il browser non calcola nessuna luce. Fa tre cose:
//  1. la fisica della stoffa (camicia/film/stoffa.mjs, la stessa del film): il mouse è una mano che preme e
//     accompagna il tessuto, e la camicia, appesa al nastro, dondola e si torce;
//  2. sposta la forma della camicia (13.000 punti, legati alla stoffa) e sopra ci proietta, dalla stessa camera,
//     due immagini calcolate da Cycles: la camicia col sole pieno e la camicia col sole spento. Quanto sole arriva
//     in ogni punto lo dicono le sbarre della finestra, che restano ferme nello spazio mentre la camicia si muove;
//  3. l'ombra sulla parete: la sagoma della camicia vista dal sole, sfumata, che sceglie tra la parete illuminata
//     e la parete senza sole (anche queste calcolate da Cycles).
// Da ferma è l'immagine di Blender, punto per punto. I file li preparano camicia/viva/scatta.py, immagini.py, monta.mjs.
import { creaStoffa } from '../../camicia/film/stoffa.mjs';

const RITMO = 0.6;          // la fisica va più piano del vero: il proprietario ha voluto il movimento "molto più lento"
const MANO = {
  raggio: 0.21,             // metri: un palmo largo
  fondo: 0.026,             // di quanto il tessuto cede sotto il palmo
  trascina: 0.01,           // e di quanto si lascia portare di lato (i tre numeri approvati sul film)
  maniche: 0.4,             // le maniche, che pendono libere, cedono meno: premute come il corpo si accartocciano
  lato: 0.9, parete: 0.38, torce: 4.2,     // quanto il tocco fa dondolare la camicia e la torce sul nastro (come nel film)
};
const PENDOLO = 2.86, FRENO = 1.25, TORSIONE = 2.3, FRENO_TORSIONE = 1.7;
const VIVA = 'configura__posa--viva';

// ---------------------------------------------------------------------------------------------- conti

/** Matrici 4 x 4 scritte per righe. */
const per = (a, b) => { const c = new Array(16).fill(0); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) c[4 * i + j] += a[4 * i + k] * b[4 * k + j]; return c; };
const sposta = (x, y, z) => [1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z, 0, 0, 0, 1];
const giraX = (a) => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0, 0, 0, 0, 1]; };
const giraY = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0, 0, 0, 0, 1]; };
const giraZ = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; };
const applica = (m, p, w = 1) => [m[0] * p[0] + m[1] * p[1] + m[2] * p[2] + m[3] * w, m[4] * p[0] + m[5] * p[1] + m[6] * p[2] + m[7] * w,
  m[8] * p[0] + m[9] * p[1] + m[10] * p[2] + m[11] * w, m[12] * p[0] + m[13] * p[1] + m[14] * p[2] + m[15] * w];
function inversa(m) {
  const a = m.map(Number), n = 4, e = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(a[4 * r + c]) > Math.abs(a[4 * p + c])) p = r;
    for (let k = 0; k < 4; k++) { [a[4 * c + k], a[4 * p + k]] = [a[4 * p + k], a[4 * c + k]]; [e[4 * c + k], e[4 * p + k]] = [e[4 * p + k], e[4 * c + k]]; }
    const d = a[4 * c + c];
    for (let k = 0; k < 4; k++) { a[4 * c + k] /= d; e[4 * c + k] /= d; }
    for (let r = 0; r < n; r++) if (r !== c) { const f = a[4 * r + c]; for (let k = 0; k < 4; k++) { a[4 * r + k] -= f * a[4 * c + k]; e[4 * r + k] -= f * e[4 * c + k]; } }
  }
  return e;
}

// ---------------------------------------------------------------------------------------------- shader

const COMUNE = /* glsl */`#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
uniform mat4 uPendolo;        // dallo spazio della stoffa al mondo (la camicia appesa che dondola)
uniform mat4 uCamera;         // dal mondo alla tela
uniform vec3 uSole;           // verso il sole
uniform float uParete;        // la parete e' il piano z = uParete
uniform int uOmbra;           // 1: si disegna la sagoma vista dal sole, schiacciata sulla parete
out vec4 vFoto; out vec3 vMondo; out vec3 vN; out vec3 vN0;
vec3 unita(vec3 v, vec3 riserva) { float l = length(v); return l > 1e-7 ? v / l : riserva; }
void posa(vec3 p, vec3 n, vec3 n0, vec4 foto) {
  vec4 m = uPendolo * vec4(p, 1.0);
  if (uOmbra == 1) m.xyz -= uSole * ((m.z - uParete) / uSole.z);
  vMondo = m.xyz; vN = mat3(uPendolo) * n; vN0 = n0; vFoto = foto;
  gl_Position = uCamera * m;
}
`;
// camicia e bottoni: ogni punto sta su un triangolo del telaio, di cui legge i tre vertici (le "ossa")
const VS_STOFFA = COMUNE + /* glsl */`
uniform sampler2D uOssa;      // due punti per osso: dove sta, dove guarda
uniform int uLarga;
uniform float uScarto;
in uvec3 aOsso; in vec3 aPeso; in vec3 aScarto; in vec3 aNorma; in vec3 aNorma0; in vec4 aFoto;
vec3 osso(uint i, int quale) { int k = int(i) * 2 + quale; return texelFetch(uOssa, ivec2(k % uLarga, k / uLarga), 0).xyz; }
void main() {
  vec3 pa = osso(aOsso.x, 0), pb = osso(aOsso.y, 0), pc = osso(aOsso.z, 0);
  vec3 su = unita(aPeso.x * osso(aOsso.x, 1) + aPeso.y * osso(aOsso.y, 1) + aPeso.z * osso(aOsso.z, 1), vec3(0.0, 0.0, 1.0));
  vec3 l = pb - pa; l = unita(l - dot(l, su) * su, vec3(1.0, 0.0, 0.0));
  vec3 t = cross(su, l), s = aScarto * uScarto;
  posa(aPeso.x * pa + aPeso.y * pb + aPeso.z * pc + s.x * l + s.y * t + s.z * su, aNorma.x * l + aNorma.y * t + aNorma.z * su, aNorma0, aFoto);
}
`;
// gruccia e nastro: non si deformano
const VS_RIGIDO = COMUNE + /* glsl */`
in vec3 aPunto; in vec3 aNorma; in vec3 aNorma0; in vec4 aFoto;
void main() { posa(aPunto, aNorma, aNorma0, aFoto); }
`;
const CURVE = /* glsl */`
vec3 luce(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
vec3 schermo(vec3 c) { c = clamp(c, 0.0, 1.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
`;
const FS_COSA = /* glsl */`#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uSoleT, uOmbraT, uFinestra;
uniform vec2 uRitaglio;       // la fascia del fotogramma coperta dalle due immagini della camicia
uniform float uScala;         // le immagini sono luce vera divisa per questo numero
uniform vec3 uSole, uSchiarita, uFinCentro, uFinLato, uFinSu;
uniform float uFinMetri;
uniform int uOmbra;
uniform int uNudo;            // per le prove: la sola forma, senza immagini
in vec4 vFoto; in vec3 vMondo; in vec3 vN; in vec3 vN0;
out vec4 esce;
${CURVE}
void main() {
  if (uOmbra == 1) { esce = vec4(1.0); return; }
  vec2 f = vFoto.xy / vFoto.w * 0.5 + 0.5;                  // dove stava questo punto nel fotogramma, da fermo
  vec2 t = vec2((f.x - uRitaglio.x) / (uRitaglio.y - uRitaglio.x), 1.0 - f.y);
  vec4 pieno = texture(uSoleT, t);
  // fuori dalla sagoma (allargata) della camicia nell'immagine non c'e' nulla da mostrare
  if (pieno.a < 0.5 || t.x < 0.0 || t.x > 1.0 || t.y < 0.0 || t.y > 1.0) discard;
  if (uNudo == 1) { vec3 q = normalize(vN); if (!gl_FrontFacing) q = -q; esce = vec4(vec3(0.25 + 0.7 * max(dot(q, uSole), 0.0)), 1.0); return; }
  vec3 A = luce(pieno.rgb) * uScala, B = luce(texture(uOmbraT, t).rgb) * uScala;
  // quanto sole passa dalla finestra in questo punto dello spazio: le sbarre stanno ferme, la camicia si muove
  vec3 d = vMondo - uFinCentro;
  float passa = texture(uFinestra, vec2(0.5) + vec2(dot(d, uFinLato), -dot(d, uFinSu)) / uFinMetri).r;
  // il tessuto che si gira verso la luce si schiarisce, quello che si gira via si scurisce: rispetto a da fermo
  vec3 n = normalize(vN), n0 = normalize(vN0);
  if (!gl_FrontFacing) { n = -n; n0 = -n0; }
  float sole = clamp((max(dot(n, uSole), 0.0) + 0.16) / (max(dot(n0, uSole), 0.0) + 0.16), 0.35, 2.2);
  float stanza = clamp((0.62 + 0.38 * dot(n, uSchiarita)) / (0.62 + 0.38 * dot(n0, uSchiarita)), 0.7, 1.4);
  esce = vec4(schermo(B * stanza + max(A - B, vec3(0.0)) * passa * sole), 1.0);
}
`;
const VS_TELA = /* glsl */`#version 300 es
void main() { gl_Position = vec4(gl_VertexID == 1 ? 3.0 : -1.0, gl_VertexID == 2 ? 3.0 : -1.0, 0.0, 1.0); }
`;
const FS_PARETE = /* glsl */`#version 300 es
precision highp float;
uniform sampler2D uLuce, uSenza, uSagoma;
uniform vec2 uTela;
uniform float uFonda;         // quanto e' scura l'ombra della camicia (misurata sul film)
out vec4 esce;
${CURVE}
void main() {
  vec2 q = gl_FragCoord.xy / uTela, t = vec2(q.x, 1.0 - q.y);
  float ombra = texture(uSagoma, q).r * uFonda;
  esce = vec4(schermo(mix(luce(texture(uLuce, t).rgb), luce(texture(uSenza, t).rgb), ombra)), 1.0);
}
`;
const FS_SFUMA = /* glsl */`#version 300 es
precision highp float;
uniform sampler2D uSagoma;
uniform vec2 uPasso;          // un passo di sfumatura, in frazione dell'immagine
out vec4 esce;
void main() {
  vec2 c = gl_FragCoord.xy / vec2(textureSize(uSagoma, 0));
  float s = texture(uSagoma, c).r * 0.2270270;
  s += (texture(uSagoma, c + uPasso * 1.3846154).r + texture(uSagoma, c - uPasso * 1.3846154).r) * 0.3162162;
  s += (texture(uSagoma, c + uPasso * 3.2307692).r + texture(uSagoma, c - uPasso * 3.2307692).r) * 0.0702703;
  esce = vec4(s, s, s, 1.0);
}
`;

function programma(gl, vs, fs) {
  const compila = (tipo, testo) => {
    const s = gl.createShader(tipo); gl.shaderSource(s, testo); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(s));
    return s;
  };
  const p = gl.createProgram();
  gl.attachShader(p, compila(gl.VERTEX_SHADER, vs)); gl.attachShader(p, compila(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('programma: ' + gl.getProgramInfoLog(p));
  const u = {};
  for (let i = 0; i < gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i++) { const n = gl.getActiveUniform(p, i).name; u[n] = gl.getUniformLocation(p, n); }
  return { p, u, a: (nome) => gl.getAttribLocation(p, nome) };
}

// ---------------------------------------------------------------------------------------------- la camicia

/**
 * @param {HTMLElement} palco  il palco della camicia, con l'immagine ferma dentro
 * @param {string} dove        la cartella dei file, per esempio "/camicia/viva/"
 */
export async function viva(palco, dove) {
  const ridotto = matchMedia('(prefers-reduced-motion: reduce)'), stretto = matchMedia('(max-width: 599px)');
  if (ridotto.matches || navigator.connection?.saveData || typeof DecompressionStream === 'undefined') return;
  const ferma = palco.querySelector('.configura__ferma');
  const tela = document.createElement('canvas');
  const gl = tela.getContext('webgl2', { alpha: false, antialias: true, depth: true, premultipliedAlpha: false, powerPreference: 'high-performance' });
  if (!gl) return;

  // --- i file
  const dati = await (await fetch(dove + 'viva.json')).json();
  const v = '?v=' + dati.versione, S = dati.scena, I = dati.immagini;
  const figura = async (nome) => createImageBitmap(await (await fetch(dove + nome + v)).blob(), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  const [telaio, forma, tSole, tOmbra, tLuce, tSenza, tFinestra] = await Promise.all([
    fetch(dove + 'telaio.json' + v).then((r) => r.json()),
    fetch(dove + 'forma.gz' + v).then((r) => new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()),
    figura('sole.webp'), figura('ombra.webp'), figura('parete-luce.webp'), figura('parete-ombra.webp'), figura('finestra.png'),
  ]);
  const TIPI = { uint16: Uint16Array, int16: Int16Array, uint8: Uint8Array, float32: Float32Array };
  const pezzo = (nome) => { const q = dati.parti[nome]; return new TIPI[q.tipo](forma, q.da, q.quanti); };

  // --- la scena
  const stoffa = creaStoffa(telaio);
  const G = S.gancio, ancora = [G[0], G[1] + S.ancora, G[2]];
  /** Dove sta la camicia appesa: girata di `giro` sul nastro, e spostata dal dondolio di lato e verso la parete. */
  const pendolo = (giro, lato, fondo) => per(per(per(sposta(...ancora), per(giraZ(lato), giraX(fondo))), sposta(-ancora[0], -ancora[1], -ancora[2])),
    per(per(sposta(...G), giraY(giro)), sposta(-G[0], -G[1], -G[2])));
  const camera = S.camera.flat(), aRiposo = pendolo(S.riposo, 0, 0);
  // la tela copre solo il riquadro del fotogramma in cui la camicia e la sua ombra si muovono
  const [rx, , rw] = I.riquadro, [FL, FA] = S.fotogramma, k = FL / rw;
  const inquadra = per([k, 0, 0, k - 1 - 2 * rx / rw, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], camera);
  const daSchermo = inversa(per(camera, aRiposo));       // dal fotogramma allo spazio della stoffa, a camicia ferma
  const schiarita = (() => { const d = [-2.3, 0.3, 2.6], l = Math.hypot(...d); return d.map((c) => c / l); })();

  tela.className = 'configura__posa configura__posa--tela';
  tela.setAttribute('aria-hidden', 'true');
  palco.style.setProperty('--posa-x', rx / FL); palco.style.setProperty('--posa-w', rw / FL);
  palco.style.setProperty('--posa-x-tel', (rx - 336) / 750); palco.style.setProperty('--posa-w-tel', rw / 750);
  ferma.closest('picture').after(tela);

  // --- immagini
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  const immagine = (figura, sfumata) => {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, figura);
    if (sfumata) gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, sfumata ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    figura.close?.();
    return t;
  };
  const T = { sole: immagine(tSole, true), ombra: immagine(tOmbra, true), luce: immagine(tLuce), senza: immagine(tSenza), finestra: immagine(tFinestra) };
  const ossa = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, ossa);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, stoffa.larghezza, stoffa.righe, 0, gl.RGBA, gl.FLOAT, stoffa.ossa);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  // --- le forme. Per ogni punto: dove sta da fermo (per sapere dove cade nel fotogramma) e dove guarda
  const pStoffa = programma(gl, VS_STOFFA, FS_COSA), pRigido = programma(gl, VS_RIGIDO, FS_COSA);
  const pParete = programma(gl, VS_TELA, FS_PARETE), pSfuma = programma(gl, VS_TELA, FS_SFUMA);
  const x0 = stoffa.riposo, n0 = stoffa.normaliRiposo;
  const normali = (punti, tri) => {
    const n = new Float32Array(punti.length);
    for (let q = 0; q < tri.length; q += 3) {
      const a = tri[q] * 3, b = tri[q + 1] * 3, c = tri[q + 2] * 3;
      const ux = punti[b] - punti[a], uy = punti[b + 1] - punti[a + 1], uz = punti[b + 2] - punti[a + 2], wx = punti[c] - punti[a], wy = punti[c + 1] - punti[a + 1], wz = punti[c + 2] - punti[a + 2];
      const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
      for (const i of [a, b, c]) { n[i] += nx; n[i + 1] += ny; n[i + 2] += nz; }
    }
    for (let i = 0; i < n.length; i += 3) { const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1; n[i] /= l; n[i + 1] /= l; n[i + 2] /= l; }
    return n;
  };
  const attributo = (p, nome, vettore, quanti, tipo, intero, normale) => {
    const dove = p.a(nome);
    if (dove < 0) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, vettore, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(dove);
    if (intero) gl.vertexAttribIPointer(dove, quanti, tipo, 0, 0); else gl.vertexAttribPointer(dove, quanti, tipo, !!normale, 0, 0);
  };
  /** Gli attributi comuni: dove cade ogni punto nel fotogramma da fermo, e la sua normale nel mondo da fermo. */
  const comuni = (p, punti, norme) => {
    const foto = new Float32Array(punti.length / 3 * 4), mondo = new Float32Array(punti.length), daFermo = per(camera, aRiposo);
    for (let i = 0; i < punti.length / 3; i++) {
      foto.set(applica(daFermo, [punti[3 * i], punti[3 * i + 1], punti[3 * i + 2]]), 4 * i);
      mondo.set(applica(aRiposo, [norme[3 * i], norme[3 * i + 1], norme[3 * i + 2]], 0).slice(0, 3), 3 * i);
    }
    attributo(p, 'aFoto', foto, 4, gl.FLOAT); attributo(p, 'aNorma0', mondo, 3, gl.FLOAT);
  };
  const indici = (tri) => { gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, tri, gl.STATIC_DRAW); return tri.length; };
  const cose = [];
  for (const nome of ['camicia', 'bottoni']) {
    const osso = pezzo(nome + '.osso'), peso = pezzo(nome + '.peso'), scarto = pezzo(nome + '.scarto'), tri = pezzo(nome + '.tri'), n = osso.length / 3;
    // da fermo: lo stesso conto che lo shader fa a ogni fotogramma (vedi `assi` in camicia/film/lega.mjs)
    const punti = new Float32Array(n * 3), assi = new Float32Array(n * 9);
    for (let i = 0; i < n; i++) {
      const a = osso[3 * i] * 3, b = osso[3 * i + 1] * 3, c = osso[3 * i + 2] * 3, wa = peso[3 * i] / 255, wb = peso[3 * i + 1] / 255, wc = peso[3 * i + 2] / 255;
      let sx = wa * n0[a] + wb * n0[b] + wc * n0[c], sy = wa * n0[a + 1] + wb * n0[b + 1] + wc * n0[c + 1], sz = wa * n0[a + 2] + wb * n0[b + 2] + wc * n0[c + 2];
      let l = Math.hypot(sx, sy, sz) || 1; sx /= l; sy /= l; sz /= l;
      let lx = x0[b] - x0[a], ly = x0[b + 1] - x0[a + 1], lz = x0[b + 2] - x0[a + 2];
      const s = lx * sx + ly * sy + lz * sz; lx -= s * sx; ly -= s * sy; lz -= s * sz;
      l = Math.hypot(lx, ly, lz) || 1; lx /= l; ly /= l; lz /= l;
      const tx = sy * lz - sz * ly, ty = sz * lx - sx * lz, tz = sx * ly - sy * lx;
      const u = scarto[3 * i] / dati.scarto, w = scarto[3 * i + 1] / dati.scarto, h = scarto[3 * i + 2] / dati.scarto;
      punti[3 * i] = wa * x0[a] + wb * x0[b] + wc * x0[c] + u * lx + w * tx + h * sx;
      punti[3 * i + 1] = wa * x0[a + 1] + wb * x0[b + 1] + wc * x0[c + 1] + u * ly + w * ty + h * sy;
      punti[3 * i + 2] = wa * x0[a + 2] + wb * x0[b + 2] + wc * x0[c + 2] + u * lz + w * tz + h * sz;
      assi.set([lx, ly, lz, tx, ty, tz, sx, sy, sz], 9 * i);
    }
    const norme = normali(punti, tri), sugliAssi = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) for (let e = 0; e < 3; e++) sugliAssi[3 * i + e] = norme[3 * i] * assi[9 * i + 3 * e] + norme[3 * i + 1] * assi[9 * i + 3 * e + 1] + norme[3 * i + 2] * assi[9 * i + 3 * e + 2];
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    attributo(pStoffa, 'aOsso', osso, 3, gl.UNSIGNED_SHORT, true); attributo(pStoffa, 'aPeso', peso, 3, gl.UNSIGNED_BYTE, false, true);
    attributo(pStoffa, 'aScarto', scarto, 3, gl.SHORT); attributo(pStoffa, 'aNorma', sugliAssi, 3, gl.FLOAT);
    comuni(pStoffa, punti, norme);
    cose.push({ p: pStoffa, vao, quanti: indici(tri), ombra: nome === 'camicia' });
  }
  for (const nome of ['gruccia', 'nastro']) {
    const punti = pezzo(nome + '.punti'), tri = pezzo(nome + '.tri'), norme = normali(punti, tri);
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    attributo(pRigido, 'aPunto', punti, 3, gl.FLOAT); attributo(pRigido, 'aNorma', norme, 3, gl.FLOAT);
    comuni(pRigido, punti, norme);
    cose.push({ p: pRigido, vao, quanti: indici(tri), ombra: true });
  }
  gl.bindVertexArray(null);

  // --- la sagoma dell'ombra: due immagini a mezza grandezza, una per disegnarla e una per sfumarla
  const sagoma = [0, 1].map(() => ({ t: gl.createTexture(), f: gl.createFramebuffer() }));
  let larga = 0, alta = 0;
  const misura = () => {
    const r = tela.getBoundingClientRect(), fitto = Math.min(2, devicePixelRatio || 1);
    const l = Math.max(2, Math.min(rw * 2, Math.round(r.width * fitto))), a = Math.max(2, Math.round(l * FA / rw));
    if (l === larga && a === alta) return false;
    larga = l; alta = a; tela.width = l; tela.height = a;
    for (const s of sagoma) {
      gl.bindTexture(gl.TEXTURE_2D, s.t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, l >> 1, a >> 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindFramebuffer(gl.FRAMEBUFFER, s.f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, s.t, 0);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return true;
  };

  // --- il disegno di un fotogramma
  const nudo = new URLSearchParams(location.search).has('nudo');
  const stato = { giro: S.riposo, lato: 0, fondo: 0 };
  const lega = (unita, t) => { gl.activeTexture(gl.TEXTURE0 + unita); gl.bindTexture(gl.TEXTURE_2D, t); };
  const matrice = (dove, m) => gl.uniformMatrix4fv(dove, true, m);
  const disegnaCose = (ombra) => {
    const M = pendolo(stato.giro, stato.lato, stato.fondo);
    for (const c of cose) {
      if (ombra && !c.ombra) continue;
      const { p, u } = c.p;
      gl.useProgram(p);
      matrice(u.uPendolo, M); matrice(u.uCamera, inquadra);
      gl.uniform3fv(u.uSole, S.sole); gl.uniform1f(u.uParete, S.parete); gl.uniform1i(u.uOmbra, ombra ? 1 : 0); gl.uniform1i(u.uNudo, nudo ? 1 : 0);
      if (u.uOssa) { lega(0, ossa); gl.uniform1i(u.uOssa, 0); gl.uniform1i(u.uLarga, stoffa.larghezza); gl.uniform1f(u.uScarto, 1 / dati.scarto); }
      lega(1, T.sole); gl.uniform1i(u.uSoleT, 1); lega(2, T.ombra); gl.uniform1i(u.uOmbraT, 2); lega(3, T.finestra); gl.uniform1i(u.uFinestra, 3);
      gl.uniform2fv(u.uRitaglio, I.ritaglio); gl.uniform1f(u.uScala, I.scala); gl.uniform3fv(u.uSchiarita, schiarita);
      gl.uniform3fv(u.uFinCentro, S.finestra.centro); gl.uniform3fv(u.uFinLato, S.finestra.lato); gl.uniform3fv(u.uFinSu, S.finestra.su); gl.uniform1f(u.uFinMetri, S.finestra.metri);
      gl.bindVertexArray(c.vao);
      gl.drawElements(gl.TRIANGLES, c.quanti, gl.UNSIGNED_SHORT, 0);
    }
    gl.bindVertexArray(null);
  };
  const disegna = () => {
    misura();
    lega(0, ossa); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, stoffa.larghezza, stoffa.righe, gl.RGBA, gl.FLOAT, stoffa.ossa);
    gl.disable(gl.CULL_FACE);
    // 1. la sagoma della camicia vista dal sole, sulla parete
    gl.bindFramebuffer(gl.FRAMEBUFFER, sagoma[0].f); gl.viewport(0, 0, larga >> 1, alta >> 1);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    disegnaCose(true);
    // 2. sfumata: la penombra, poco più di un centimetro sulla parete (il sole è largo 1,3 gradi)
    const penombra = Math.max(1, 0.0024 * (alta >> 1) / 1.212);          // un passo della sfumatura, in punti dell'immagine a mezza grandezza
    gl.useProgram(pSfuma.p);
    for (const [da, a, px, py] of [[0, 1, penombra / (larga >> 1), 0], [1, 0, 0, penombra / (alta >> 1)]]) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, sagoma[a].f);
      lega(0, sagoma[da].t); gl.uniform1i(pSfuma.u.uSagoma, 0); gl.uniform2f(pSfuma.u.uPasso, px, py);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    // 3. la parete con la sua ombra, poi la camicia
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, larga, alta);
    gl.useProgram(pParete.p);
    lega(0, T.luce); gl.uniform1i(pParete.u.uLuce, 0); lega(1, T.senza); gl.uniform1i(pParete.u.uSenza, 1); lega(2, sagoma[0].t); gl.uniform1i(pParete.u.uSagoma, 2);
    gl.uniform2f(pParete.u.uTela, larga, alta); gl.uniform1f(pParete.u.uFonda, I.ombra);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.clearDepth(1); gl.clear(gl.DEPTH_BUFFER_BIT);
    disegnaCose(false);
  };

  // --- la mano e il movimento
  const p = { lato: 0, fondo: 0, torce: 0, vLato: 0, vFondo: 0, vTorce: 0 };
  const mano = { sopra: false, x: 0, y: 0, vx: 0, vy: 0, preme: 0, mossa: 0, colpo: null };
  const dondolo = new Float32Array(5);
  let giroPrima = S.riposo, prima = 0, quieta = 0, corre = 0;
  /** Dal punto dello schermo al raggio nello spazio della stoffa (a camicia com'è adesso). */
  const raggio = (fx, fy) => {
    const M = inversa(per(camera, pendolo(stato.giro, stato.lato, stato.fondo)));
    const a = applica(M, [fx * 2 - 1, 1 - fy * 2, -1]), b = applica(M, [fx * 2 - 1, 1 - fy * 2, 1]);
    const o = a.slice(0, 3).map((c) => c / a[3]), q = b.slice(0, 3).map((c) => c / b[3]), d = [q[0] - o[0], q[1] - o[1], q[2] - o[2]], l = Math.hypot(...d);
    return [o, d.map((c) => c / l)];
  };
  const fisica = (dt) => {
    const angolo = S.riposo + p.torce * 2.2, c = Math.cos(angolo), s = Math.sin(angolo);
    const locale = (q) => [q[0] * c - q[2] * s, q[1], q[0] * s + q[2] * c];          // dallo schermo alla camicia, girata di `angolo`
    if (mano.preme > 0.01 && mano.colpo) {
      const l = Math.hypot(mano.vx, mano.vy) || 1;
      stoffa.tocca({ c: mano.colpo, d: locale([0, 0, -1]), t: locale([mano.vx / l, mano.vy / l, 0]), raggio: MANO.raggio, fondo: MANO.fondo * mano.preme, trascina: MANO.trascina * mano.preme, maniche: MANO.maniche });
      // la camicia è appesa: la mano che preme la manda verso la parete, quella che accompagna la porta di lato,
      // e premendo lontano dal nastro la fa girare
      const corsa = Math.max(-1.1, Math.min(1.1, mano.vx));
      p.vLato += MANO.lato * mano.preme * corsa * dt;
      p.vFondo += MANO.parete * mano.preme * Math.min(1, Math.abs(corsa) * 2 + 0.2) * dt;
      p.vTorce += MANO.torce * mano.preme * (mano.colpo[0] - G[0]) * Math.min(1, Math.abs(corsa) * 2 + 0.2) * dt;
    } else stoffa.tocca(null);
    for (const [ang, vel, w, fr] of [['lato', 'vLato', PENDOLO, FRENO], ['fondo', 'vFondo', PENDOLO, FRENO], ['torce', 'vTorce', TORSIONE, FRENO_TORSIONE]]) {
      p[vel] += (-w * w * p[ang] - fr * p[vel]) * dt;
      p[ang] = Math.max(-0.17, Math.min(0.17, p[ang] + p[vel] * dt));
    }
    const adesso = S.riposo + p.torce * 2.2, c2 = Math.cos(adesso), s2 = Math.sin(adesso);
    // dondolando la camicia attraversa l'aria ferma e il tessuto resta indietro (vedi camicia/film/muovi.mjs)
    dondolo[0] = 0.3 * (p.vFondo * c2 - p.vLato * s2); dondolo[1] = 0.3 * (p.vFondo * s2 + p.vLato * c2);
    dondolo[2] = ancora[0] * c2 - ancora[2] * s2; dondolo[3] = ancora[1]; dondolo[4] = ancora[0] * s2 + ancora[2] * c2;
    stoffa.passo(dt, (adesso - giroPrima) / dt, dondolo);
    giroPrima = adesso;
    stato.giro = adesso; stato.lato = p.lato; stato.fondo = p.fondo;
  };
  const passo = (ora) => {
    const vero = Math.min(0.034, Math.max(0.001, (ora - prima) / 1000));
    prima = ora;
    // la mano: preme finché si muove sulla camicia; ferma o uscita, lascia
    const manoFerma = ora - mano.mossa > 160;
    const vuole = mano.sopra && !manoFerma ? Math.min(1, Math.hypot(mano.vx, mano.vy) / 0.18) : 0;
    mano.preme += (vuole - mano.preme) * Math.min(1, vero * (vuole > mano.preme ? 12 : 5));
    if (manoFerma) { mano.vx *= 0.8; mano.vy *= 0.8; }
    let resta = vero * RITMO;
    while (resta > 1e-5) { const dt = Math.min(resta, 1 / 120); fisica(dt); resta -= dt; }
    disegna();
    const energia = Math.abs(p.lato) + Math.abs(p.fondo) + Math.abs(p.torce) + (Math.abs(p.vLato) + Math.abs(p.vFondo) + Math.abs(p.vTorce)) * 0.5 + mano.preme;
    quieta = energia < 0.0015 ? quieta + vero : 0;
    // ferma da un po': si smette di calcolare, e torna in vista l'immagine di Blender, che e' la stessa
    if (quieta < 2.5) corre = requestAnimationFrame(passo); else { corre = 0; tela.classList.remove(VIVA); }
  };
  const sveglia = () => {
    quieta = 0;
    if (corre) return;
    disegna(); tela.classList.add(VIVA);
    prima = performance.now(); corre = requestAnimationFrame(passo);
  };

  /** La mano è nel punto (x, y) dello schermo. */
  const tocca = (e) => {
    if (ridotto.matches) return;
    const r = ferma.getBoundingClientRect();
    let fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
    if (stretto.matches) fx = (336 + fx * 750) / FL;                       // sul telefono l'immagine è il ritaglio verticale
    // dove la mano tocca: sul tessuto com'era da fermo (vedi `colpo` in stoffa.mjs)
    const ora = performance.now(), [o, d] = raggio(fx, fy), colpo = stoffa.colpo(o[0], o[1], o[2], d[0], d[1], d[2], true);
    const metri = 1.212 / r.height;                                          // un punto dello schermo, in metri sulla camicia
    if (mano.sopra && colpo) {
      const dt = Math.max(0.004, (ora - mano.mossa) / 1000), vx = (e.clientX - mano.x) * metri / dt, vy = -(e.clientY - mano.y) * metri / dt;
      mano.vx += (vx - mano.vx) * 0.5; mano.vy += (vy - mano.vy) * 0.5;
      palco.dataset.toccata = '';
    }
    mano.sopra = !!colpo; mano.colpo = colpo || mano.colpo; mano.x = e.clientX; mano.y = e.clientY; mano.mossa = ora;
    if (colpo) sveglia();
  };
  palco.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') tocca(e); });
  palco.addEventListener('pointerleave', () => { mano.sopra = false; });
  // il dito: conta quando si muove di lato sulla camicia; in verticale è la pagina che scorre
  let dito = null;
  palco.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') { dito = { x: e.clientX, y: e.clientY, verso: '' }; mano.sopra = false; } });
  palco.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse' || !dito) return;
    const dx = e.clientX - dito.x, dy = e.clientY - dito.y;
    if (!dito.verso && Math.hypot(dx, dy) > 8) dito.verso = Math.abs(dx) > Math.abs(dy) ? 'lato' : 'su';
    if (dito.verso === 'lato') tocca(e);
  });
  const alza = () => { dito = null; mano.sopra = false; };
  palco.addEventListener('pointerup', alza); palco.addEventListener('pointercancel', alza);
  ridotto.addEventListener('change', () => { if (ridotto.matches) { mano.sopra = false; delete palco.dataset.viva; } else palco.dataset.viva = ''; });
  new ResizeObserver(() => { if (misura() && !corre) disegna(); }).observe(tela);
  tela.addEventListener('webglcontextlost', (e) => { e.preventDefault(); cancelAnimationFrame(corre); corre = 0; tela.classList.remove(VIVA); });

  // --- pronta. Finché nessuno la tocca resta in vista l'immagine ferma di Blender; la tela compare col movimento
  disegna();
  palco.dataset.viva = '';
  // per le prove: il tempo si può far avanzare a comando (?manuale), perché nel browser di prova il 3D gira sul processore
  if (new URLSearchParams(location.search).has('manuale')) {
    window.__camicia = { passo: (ms) => { prima = performance.now() - ms; passo(performance.now()); cancelAnimationFrame(corre); corre = 0; }, tocca, mano, p, stato, disegna };
  }
}
