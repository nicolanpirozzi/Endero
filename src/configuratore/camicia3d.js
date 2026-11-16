// Camicia 3D del configuratore, in diretta nel browser con three.js.
//
// Tre cose la tengono lontana dalla plastica (il proprietario aveva bocciato la versione di prima: "sembra finta,
// le ombre sono sbagliate, sembra fatta di plastica, non si muove come mossa dal vento"):
//  1. la luce non si calcola qui: ombre e rimbalzi li ha calcolati Cycles, lo stesso motore dell'apertura, e
//     arrivano fissati sul tessuto in un'immagine stesa sul cartamodello (`luce.webp`);
//  2. il tessuto è opaco, senza riflessi, con le costure e le impunture ricostruite dai bordi del cartamodello
//     (`cuciture.webp`) e una trama appena irregolare;
//  3. il vento è fisica vera: una stoffa semplificata simulata a ogni fotogramma (`stoffa.js`), che la camicia
//     segue punto per punto. Niente onde disegnate, niente molle: il proprietario le ha bocciate.
// I file li prepara `camicia/prepara.py`. Questo file si carica solo nella pagina del configuratore.
import {
  BackSide, Box3, BoxGeometry, BufferAttribute, CanvasTexture, Color, DataTexture, DoubleSide, FloatType, FrontSide, Group, LinearFilter,
  LinearMipmapLinearFilter, Matrix4, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial, NearestFilter,
  NeutralToneMapping, PerspectiveCamera, PlaneGeometry, PMREMGenerator, RGBAFormat, Scene, ShaderMaterial, SphereGeometry,
  SRGBColorSpace, TextureLoader, Vector3, WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { creaStoffa, sulTriangolo } from './stoffa.js';

const AVORIO = new Color(0xf6f3ec);           // il bianco caldo del cotone

/** Lo studio fotografico per i soli bottoni, che sono lucidi: pannelli luminosi come quelli del calcolo. */
function studio(renderer) {
  const s = new Scene();
  const pannello = (colore, forza, pos, dim) => {
    const m = new Mesh(new BoxGeometry(...dim), new MeshBasicMaterial({ color: new Color(colore).multiplyScalar(forza) }));
    m.position.set(...pos); m.lookAt(0, 0, 0); s.add(m);
  };
  s.add(new Mesh(new SphereGeometry(12, 32, 16), new MeshBasicMaterial({ color: new Color(0x16306e).multiplyScalar(0.55), side: BackSide })));
  pannello(0xfff4e6, 5.5, [-4.5, 3.2, 4.5], [5, 5, 0.1]);
  pannello(0xdfe8ff, 1.6, [5, 0.5, 3], [4, 6, 0.1]);
  pannello(0xffd9ad, 9.0, [3.5, 2.5, -5], [3, 5, 0.1]);
  pannello(0xffffff, 2.2, [0, 7, 0], [7, 7, 0.1]);
  const pm = new PMREMGenerator(renderer);
  const ambiente = pm.fromScene(s, 0.035).texture;
  pm.dispose();
  s.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  return ambiente;
}

/** L'ombra morbida sotto la camicia: dice che è sospesa. */
function ombra() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  r.addColorStop(0, 'rgba(2,8,26,0.55)'); r.addColorStop(0.55, 'rgba(2,8,26,0.18)'); r.addColorStop(1, 'rgba(2,8,26,0)');
  g.fillStyle = r; g.fillRect(0, 0, 256, 256);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false }));
}

// ------------------------------------------------------------------------------------------------ shader

/** Ogni punto della camicia sta su un triangolo del telaio: ne legge i tre vertici (le "ossa"), dove sono e dove
 *  guardano, ritrova il punto del triangolo che gli sta sotto e ci aggiunge il suo piccolo scarto, misurato su tre
 *  assi che seguono il tessuto (lungo un lato, di traverso, verso fuori). */
const OSSA = /* glsl */`
  uniform highp sampler2D uOssa;       // due punti per osso: posizione, normale
  uniform mat4 uInMetri;               // dalle posizioni compresse del file ai metri
  uniform mat4 uDaMetri;
  attribute vec3 aOssi;                // i tre vertici del triangolo
  attribute vec3 aPesi;                // il punto del triangolo che gli sta sotto
  attribute vec3 aScarto;              // da lì al punto: lungo il lato, di traverso, verso fuori (metri)
  attribute vec3 aNorma;               // la sua normale, sugli stessi tre assi
  void leggi(float quale, out vec3 p, out vec3 n) {
    int k = int(quale + 0.5) * 2;
    ivec2 c = ivec2(k % LARGHEZZA_OSSA, k / LARGHEZZA_OSSA);
    p = texelFetch(uOssa, c, 0).xyz; n = texelFetch(uOssa, c + ivec2(1, 0), 0).xyz;
  }
  void segui(out vec3 P, out vec3 N) {
    vec3 pa, pb, pc, na, nb, nc;
    leggi(aOssi.x, pa, na); leggi(aOssi.y, pb, nb); leggi(aOssi.z, pc, nc);
    vec3 su = normalize(aPesi.x * na + aPesi.y * nb + aPesi.z * nc);
    vec3 lato = pb - pa;
    vec3 lungo = normalize(lato - su * dot(su, lato));
    vec3 traverso = cross(su, lungo);
    P = aPesi.x * pa + aPesi.y * pb + aPesi.z * pc + aScarto.x * lungo + aScarto.y * traverso + aScarto.z * su;
    N = normalize(aNorma.x * lungo + aNorma.y * traverso + aNorma.z * su);
  }`;

const VERTICI = /* glsl */`
  ${OSSA}
  attribute vec4 aDati;                // rgb: luce sul vertice (radice quadrata), a: parte
  varying vec2 vUv; varying vec3 vPos; varying vec3 vN; varying vec3 vN0; varying vec3 vLuce;
  void main() {
    vec3 P, N;
    segui(P, N);
    vUv = uv; vPos = P; vN = N; vN0 = normalize(mat3(uInMetri) * normal); vLuce = aDati.rgb * aDati.rgb;
    gl_Position = projectionMatrix * modelViewMatrix * (uDaMetri * vec4(P, 1.0));
  }`;

/** La luce in funzione dell'orientamento (nove coefficienti per colore, ricavati dal calcolo di Cycles). */
const CIELO = /* glsl */`
  uniform vec3 uSfera[9];
  uniform float uLuceMedia;
  vec3 cielo(vec3 n) {
    return uSfera[0] + uSfera[1] * n.y + uSfera[2] * n.z + uSfera[3] * n.x + uSfera[4] * n.x * n.y + uSfera[5] * n.y * n.z
         + uSfera[6] * (3.0 * n.z * n.z - 1.0) + uSfera[7] * n.x * n.z + uSfera[8] * (n.x * n.x - n.y * n.y);
  }
  /** La luce fissata vale per la posa di riposo: se il vento gira il lembo, cambia in proporzione.
   *  Poi le si dà un po' di contrasto intorno al suo valore medio, come si fa stampando una fotografia: le pieghe
   *  prendono corpo e il bianco resta bianco. */
  vec3 corretta(vec3 fissata, vec3 riposo, vec3 adesso) {
    vec3 luce = fissata * clamp(max(cielo(adesso), vec3(0.0)) / max(cielo(riposo), vec3(0.05)), 0.25, 2.6);
    return uLuceMedia * pow(luce / uLuceMedia, vec3(CONTRASTO));
  }`;

const DIRITTO = /* glsl */`
  uniform sampler2D uLuce;
  uniform sampler2D uCuciture;         // r: distanza dal bordo del pezzo, g: passo dell'impuntura (coseno)
  uniform float uLuceScala, uPortata, uMetri;
  uniform vec3 uColore, uOcchio;
  varying vec2 vUv; varying vec3 vPos; varying vec3 vN; varying vec3 vN0; varying vec3 vLuce;
  #define CONTRASTO 1.22
  ${CIELO}
  float caso(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float rumore(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(caso(i), caso(i + vec2(1.0, 0.0)), f.x), mix(caso(i + vec2(0.0, 1.0)), caso(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  /** Il rilievo: gira la normale secondo la pendenza di un'altezza (metri) misurata sullo schermo. */
  vec3 rilievo(vec3 pos, vec3 n, float h) {
    vec3 sx = dFdx(pos), sy = dFdy(pos);
    vec3 r1 = cross(sy, n), r2 = cross(n, sx);
    float det = dot(sx, r1);
    vec3 g = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
    return normalize(abs(det) * n - g);
  }
  /** Una riga larga s intorno a d0, che non sfarfalla quando è più sottile di un punto dello schermo. */
  float riga(float d, float d0, float s, float punto) {
    float larga = sqrt(s * s + 0.3 * punto * punto);
    float x = (d - d0) / larga;
    return (s / larga) * exp(-x * x);
  }
  void main() {
    vec3 N0 = normalize(vN0), N = normalize(vN);
    #ifdef ROVESCIO
      // Lo strato interno ha due facce. Quella che guarda dentro la camicia si vede dal collo e dai polsini: prende
      // la luce calcolata sui vertici più quella che attraversa il tessuto da fuori (il cotone bianco ne lascia
      // passare un terzo: l'interno di una camicia chiara non è mai buio). Quella che guarda fuori sta un paio di
      // millimetri dietro il diritto e gli fa da fodera: ha la sua stessa mappa, quindi si disegna identica a lui.
      // Le due cose insieme nascondono i forellini che il modello ha lungo le cuciture.
      if (gl_FrontFacing) {
        vec3 dentro = corretta(vLuce / uLuceScala, N0, N) + 0.36 * vec3(1.0, 0.97, 0.92) * texture2D(uLuce, vUv).rgb / uLuceScala;
        gl_FragColor = vec4(uColore * 0.94 * dentro, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        return;
      }
      N0 = -N0; N = -N;
    #endif
    vec3 V = normalize(uOcchio - vPos);
    float punto = max(length(dFdx(vPos)), length(dFdy(vPos)));       // quanto tessuto sta in un punto dello schermo

    // --- costure e impunture, dai bordi del cartamodello
    vec4 cuc = texture2D(uCuciture, vUv);
    float d = cuc.r * uPortata;
    float passo = cuc.g * 2.0 - 1.0;                                 // +1 a metà del punto, -1 dove il filo entra nel tessuto
    float costura = riga(d, 0.0, 0.0006, punto);                     // il solco dove due pezzi si uniscono
    float filo = riga(d, 0.0055, 0.00042, punto);                    // l'impuntura, a cinque millimetri e mezzo dal bordo
    float fascia = 1.0 - smoothstep(0.0048, 0.0064, d);              // tra bordo e impuntura il tessuto è doppio, e più alto
    float h = 0.00016 * fascia - 0.00028 * costura - 0.00012 * filo * (0.6 - 0.4 * passo)
            + 0.00004 * fascia * (1.0 - costura) * passo;            // tra un punto e l'altro il tessuto si arriccia appena
    vec3 Np = rilievo(vPos, N, h);

    // --- la luce: quella fissata, corretta per come è girato adesso il tessuto
    vec3 luce = corretta(texture2D(uLuce, vUv).rgb / uLuceScala, N0, Np);

    // --- il tessuto: popeline di cotone. I fili non si distinguono a questa distanza: si vede che non è uniforme
    vec2 m = vUv * uMetri;
    float fine = clamp(0.0007 / punto, 0.0, 1.0);
    float ordito = rumore(vec2(m.x / 0.00055, m.y / 0.012)) - 0.5;
    float trama = rumore(vec2(m.x / 0.014, m.y / 0.00055) + 37.0) - 0.5;
    float nuvola = rumore(m / 0.006) - 0.5;
    vec3 colore = uColore * (1.0 + fine * 0.05 * (ordito + trama) + 0.018 * nuvola);
    colore *= 1.0 - 0.26 * costura - 0.13 * filo * (0.65 - 0.35 * passo);
    colore *= 1.0 + 0.05 * filo * max(passo, 0.0);                   // il filo, appena più chiaro del tessuto

    // cotone: nessun riflesso, solo la peluria che si schiarisce di taglio
    float taglio = pow(1.0 - clamp(dot(Np, V), 0.0, 1.0), 3.5);
    vec3 esce = colore * luce * (1.0 + 0.22 * taglio);
    gl_FragColor = vec4(esce, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

/** Bottoni e fili usano i materiali di three.js: qui gli si insegna a seguire le ossa. */
function cheSegue(materiale, uniformi, larghezza) {
  materiale.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniformi);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\n#define LARGHEZZA_OSSA ${larghezza}\n${OSSA}`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        vec3 oP, oN; segui(oP, oN);
        objectNormal = normalize(mat3(uDaMetri) * oN);`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed = (uDaMetri * vec4(oP, 1.0)).xyz;');
  };
  return materiale;
}

// ------------------------------------------------------------------------------------------------ legatura

/** Prepara la ricerca "quale triangolo del telaio è più vicino a questo punto", limitata alla parte giusta
 *  (una manica non deve attaccarsi al fianco che le sta accanto). */
function cercatore(stoffa) {
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
  /** Scrive in `esce` i tre punti del telaio e i loro pesi per il punto (px,py,pz) della parte `parte`. */
  return function cerca(px, py, pz, parte, esce) {
    const ci = Math.floor(px / LATO), cj = Math.floor(py / LATO), ck = Math.floor(pz / LATO), bit = 1 << parte;
    let meglio = -1, vicino = Infinity;
    const prova = (t) => {
      if (!(parti[t] & bit)) return;
      const d = sulTriangolo(px, py, pz, x, tri[3 * t] * 3, tri[3 * t + 1] * 3, tri[3 * t + 2] * 3, pesi);
      if (d < vicino) { vicino = d; meglio = t; esce[3] = pesi[0]; esce[4] = pesi[1]; esce[5] = pesi[2]; }
    };
    for (let giro = 1; giro <= 3 && (meglio < 0 || vicino > ((giro - 1) * LATO) ** 2); giro++) {
      for (let i = -giro; i <= giro; i++) for (let j = -giro; j <= giro; j++) for (let k = -giro; k <= giro; k++) {
        if (Math.max(Math.abs(i), Math.abs(j), Math.abs(k)) !== giro && giro > 1) continue;      // solo il guscio nuovo
        for (const t of celle.get(chiave(ci + i, cj + j, ck + k)) || []) prova(t);
      }
    }
    if (meglio < 0) for (let t = 0; t < nt; t++) prova(t);
    if (meglio < 0) { esce[0] = esce[1] = esce[2] = 0; esce[3] = 1; esce[4] = esce[5] = 0; return; }
    esce[0] = tri[3 * meglio]; esce[1] = tri[3 * meglio + 1]; esce[2] = tri[3 * meglio + 2];
  };
}

/** Lega una mesh al telaio: per ogni vertice trova il triangolo del telaio più vicino, il punto di quel triangolo
 *  che gli sta sotto e lo scarto tra i due, misurato su tre assi che seguono il tessuto. A riposo ogni vertice
 *  torna esattamente dov'era; quando il telaio si muove lo segue senza strapparsi dai vicini, perché il punto
 *  sotto di lui cambia con continuità e lo scarto è di pochi millimetri.
 *  I pezzi rigidi (bottoni, fili) si legano tutti interi al punto che sta sotto il loro centro: non si deformano. */
function lega(mesh, stoffa, cerca, rigido) {
  const g = mesh.geometry, pos = g.attributes.position, nrm = g.attributes.normal, n = pos.count;
  const x = stoffa.riposo, nt = stoffa.normaliRiposo;
  const ossi = new Float32Array(n * 3), pesi = new Float32Array(n * 3), scarto = new Float32Array(n * 3), norma = new Float32Array(n * 3);
  const esce = new Float32Array(6), dati = g.attributes.aDati, p = new Vector3(), q = new Vector3();
  const gira = new Matrix4().extractRotation(mesh.matrixWorld);
  const parteDi = (i) => (dati ? Math.round(dati.getW(i) * 2) : 0);
  const metri = (i) => p.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
  // il triangolo di adesso: i suoi vertici (per tre), i pesi del punto sotto, quel punto, i tre assi
  let a, b, c, wa, wb, wc, cx, cy, cz, sx, sy, sz, lx, ly, lz, tx, ty, tz;
  const prepara = (px, py, pz, parte) => {
    cerca(px, py, pz, parte, esce);
    a = esce[0] * 3; b = esce[1] * 3; c = esce[2] * 3; wa = esce[3]; wb = esce[4]; wc = esce[5];
    // il lato che dà il verso dev'essere lungo: se il primo è corto si gira il triangolo
    const l2 = (i, j) => (x[i] - x[j]) ** 2 + (x[i + 1] - x[j + 1]) ** 2 + (x[i + 2] - x[j + 2]) ** 2;
    const ab = l2(a, b), bc = l2(b, c), ca = l2(c, a);
    if (bc > ab && bc >= ca) { [a, b, c] = [b, c, a]; [wa, wb, wc] = [wb, wc, wa]; } else if (ca > ab && ca > bc) { [a, b, c] = [c, a, b]; [wa, wb, wc] = [wc, wa, wb]; }
    cx = wa * x[a] + wb * x[b] + wc * x[c]; cy = wa * x[a + 1] + wb * x[b + 1] + wc * x[c + 1]; cz = wa * x[a + 2] + wb * x[b + 2] + wc * x[c + 2];
    sx = wa * nt[a] + wb * nt[b] + wc * nt[c]; sy = wa * nt[a + 1] + wb * nt[b + 1] + wc * nt[c + 1]; sz = wa * nt[a + 2] + wb * nt[b + 2] + wc * nt[c + 2];
    let l = Math.hypot(sx, sy, sz) || 1; sx /= l; sy /= l; sz /= l;
    lx = x[b] - x[a]; ly = x[b + 1] - x[a + 1]; lz = x[b + 2] - x[a + 2];
    const s = lx * sx + ly * sy + lz * sz; lx -= s * sx; ly -= s * sy; lz -= s * sz;
    l = Math.hypot(lx, ly, lz) || 1; lx /= l; ly /= l; lz /= l;
    tx = sy * lz - sz * ly; ty = sz * lx - sx * lz; tz = sx * ly - sy * lx;
  };
  const scrivi = (i) => {
    const k = i * 3, dx = p.x - cx, dy = p.y - cy, dz = p.z - cz;
    q.fromBufferAttribute(nrm, i).applyMatrix4(gira).normalize();
    ossi[k] = a / 3; ossi[k + 1] = b / 3; ossi[k + 2] = c / 3;
    pesi[k] = wa; pesi[k + 1] = wb; pesi[k + 2] = wc;
    scarto[k] = dx * lx + dy * ly + dz * lz; scarto[k + 1] = dx * tx + dy * ty + dz * tz; scarto[k + 2] = dx * sx + dy * sy + dz * sz;
    norma[k] = q.x * lx + q.y * ly + q.z * lz; norma[k + 1] = q.x * tx + q.y * ty + q.z * tz; norma[k + 2] = q.x * sx + q.y * sy + q.z * sz;
  };
  if (!rigido) {
    for (let i = 0; i < n; i++) { metri(i); prepara(p.x, p.y, p.z, parteDi(i)); scrivi(i); }
  } else {
    // i pezzi staccati tra loro (ogni bottone, ogni filo) si trovano seguendo i triangoli
    const capo = new Uint32Array(n).map((_, i) => i);
    const trova = (i) => { while (capo[i] !== i) { capo[i] = capo[capo[i]]; i = capo[i]; } return i; };
    const ind = g.index.array;
    for (let i = 0; i < ind.length; i += 3) { const u = trova(ind[i]); capo[trova(ind[i + 1])] = u; capo[trova(ind[i + 2])] = u; }
    const gruppi = new Map();
    for (let i = 0; i < n; i++) { const u = trova(i); (gruppi.get(u) || gruppi.set(u, []).get(u)).push(i); }
    const centro = new Vector3();
    for (const lista of gruppi.values()) {
      centro.set(0, 0, 0);
      for (const i of lista) centro.add(metri(i));
      centro.multiplyScalar(1 / lista.length);
      prepara(centro.x, centro.y, centro.z, parteDi(lista[0]));
      for (const i of lista) { metri(i); scrivi(i); }
    }
  }
  g.setAttribute('aOssi', new BufferAttribute(ossi, 3));
  g.setAttribute('aPesi', new BufferAttribute(pesi, 3));
  g.setAttribute('aScarto', new BufferAttribute(scarto, 3));
  g.setAttribute('aNorma', new BufferAttribute(norma, 3));
}

// ------------------------------------------------------------------------------------------------ avvio

/**
 * Avvia la camicia dentro `contenitore`.
 * @param {HTMLElement} contenitore  l'elemento che ospita la tela
 * @param {object} o
 * @param {string} o.modello         indirizzo di camicia.glb; gli altri file (camicia.json, telaio.json, luce.webp,
 *                                   cuciture.webp) stanno accanto, con la stessa versione
 * @param {boolean} [o.taschino]     con il taschino (di base la camicia è senza)
 * @param {(quota:number)=>void} [o.avanzamento]  quanta parte è stata scaricata, da 0 a 1
 * @param {number} [o.peso]          byte del modello (il server comprime: la lunghezza vera la dice la pagina)
 * @param {boolean} [o.fermo]        movimento ridotto: niente vento, si gira solo trascinando
 * @param {boolean} [o.manuale]      il tempo lo fa avanzare chi chiama (per registrare i video di prova)
 */
export async function avviaCamicia(contenitore, o) {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NeutralToneMapping;        // lascia bianco il bianco: con altre curve la camicia ingrigisce
  renderer.toneMappingExposure = 0.98;
  const tela = renderer.domElement;
  tela.className = 'camicia__tela';
  tela.setAttribute('aria-hidden', 'true');
  contenitore.appendChild(tela);

  // --- scaricamento: il modello pesa di più e dà l'avanzamento, gli altri tre file contano un decimo l'uno
  const accanto = (nome) => o.modello.replace(/[^/?]+(\?|$)/, nome + '$1');
  const fatto = { modello: 0, altri: 0 };
  const segna = () => o.avanzamento?.(0.7 * fatto.modello + 0.1 * fatto.altri);
  const poi = (promessa) => promessa.then((v) => { fatto.altri++; segna(); return v; });
  MeshoptDecoder.ready && (await MeshoptDecoder.ready);
  const immagini = new TextureLoader();
  const [gltf, dati, telaio, luce, cuciture] = await Promise.all([
    new Promise((si, no) => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(o.modello, si, (e) => {
      fatto.modello = Math.min(e.loaded / ((e.lengthComputable && e.total) || o.peso || e.loaded * 2), 1); segna();
    }, no)).then((v) => { fatto.modello = 1; segna(); return v; }),
    poi(fetch(accanto('camicia.json')).then((r) => r.json())),
    poi(fetch(accanto('telaio.json')).then((r) => r.json())),
    poi(immagini.loadAsync(accanto('luce.webp'))),
    poi(immagini.loadAsync(accanto('cuciture.webp'))),
  ]);
  for (const t of [luce, cuciture]) {
    t.flipY = false; t.generateMipmaps = true; t.minFilter = LinearMipmapLinearFilter; t.magFilter = LinearFilter;
    t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy()); t.needsUpdate = true;
  }
  luce.colorSpace = SRGBColorSpace;

  // --- la stoffa e le sue ossa
  const stoffa = creaStoffa(telaio);
  const ossa = new DataTexture(stoffa.ossa, stoffa.larghezza, stoffa.righe, RGBAFormat, FloatType);
  ossa.minFilter = ossa.magFilter = NearestFilter; ossa.needsUpdate = true;

  const scena = new Scene();
  scena.environment = studio(renderer);
  const camera = new PerspectiveCamera(24, 1, 0.1, 20);
  const perno = new Group();        // gira e galleggia
  const camicia = gltf.scene;
  perno.add(camicia);
  scena.add(perno);
  perno.updateMatrixWorld(true);

  const comuni = {
    uOssa: { value: ossa },
    uLuce: { value: luce }, uCuciture: { value: cuciture },
    uLuceScala: { value: dati.luce_scala }, uPortata: { value: dati.cuciture_portata }, uMetri: { value: dati.metri_per_uv },
    uColore: { value: AVORIO }, uOcchio: { value: new Vector3() }, uLuceMedia: { value: dati.luce_media },
    uSfera: { value: dati.luce_sfera.map((c) => new Vector3(...c)) },
  };
  const cerca = cercatore(stoffa);
  const taschino = [];
  const delTaschino = (m) => { for (let p = m; p; p = p.parent) if (p.name === 'taschino') return true; return false; };
  const definizioni = { LARGHEZZA_OSSA: stoffa.larghezza };
  camicia.traverse((m) => {
    if (!m.isMesh) return;
    const g = m.geometry, nome = m.material.name;
    m.material.dispose();
    m.frustumCulled = false;                              // i vertici si spostano nello shader
    if (g.attributes.color) { g.setAttribute('aDati', g.attributes.color); g.deleteAttribute('color'); }
    const uniformi = {
      ...comuni,
      uInMetri: { value: new Matrix4().copy(m.matrixWorld) },          // il perno è ancora fermo nell'origine
      uDaMetri: { value: new Matrix4().copy(m.matrixWorld).invert() },
    };
    const rigido = nome === 'bottone' || nome === 'filo';
    lega(m, stoffa, cerca, rigido);
    if (nome === 'bottone') {
      m.material = cheSegue(new MeshPhysicalMaterial({ color: 0xe9e3d5, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.3, iridescence: 0.3, iridescenceIOR: 1.6, envMapIntensity: 0.8 }), uniformi, stoffa.larghezza);
    } else if (nome === 'filo') {
      m.material = cheSegue(new MeshStandardMaterial({ color: AVORIO, roughness: 0.95, envMapIntensity: 0.8 }), uniformi, stoffa.larghezza);
    } else {
      const diritto = nome === 'tessuto';
      m.material = new ShaderMaterial({
        uniforms: uniformi, vertexShader: VERTICI, fragmentShader: DIRITTO,
        defines: diritto ? definizioni : { ...definizioni, ROVESCIO: 1 }, side: diritto ? FrontSide : DoubleSide,
      });
    }
    if (delTaschino(m)) { taschino.push(m); m.visible = Boolean(o.taschino); }
  });
  const ingombro = new Box3().setFromObject(camicia);
  const mezzo = new Vector3().subVectors(ingombro.max, ingombro.min).multiplyScalar(0.5);
  const sotto = ombra();
  const largOmbra = mezzo.x * 1.9;
  sotto.position.y = ingombro.min.y - 0.15;
  scena.add(sotto);

  // --- stato del movimento -------------------------------------------------------------------------------
  const RIPOSO = 0.34;                                 // di tre quarti, come nell'immagine ferma
  let giro = RIPOSO + 0.12, inclina = 0;               // angoli attuali
  let base = 0, velBase = 0, metaInclina = 0;          // rotazione scelta trascinando, con la sua inerzia
  let trascina = null;
  let ultimoGesto = -10;
  let puntaX = 2, puntaY = 2;                          // puntatore in coordinate della tela (-1..1)
  let ultimaMossa = 0, ultimaFolata = -1;
  const origine = new Vector3(), verso = new Vector3(), versoVento = new Vector3(), inversa = new Matrix4();
  let tempo = 0;

  function misura() {
    const w = contenitore.clientWidth || 1, h = contenitore.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // la camera si allontana quanto serve perché la camicia stia tutta, anche in uno schermo verticale stretto
    const tan = Math.tan((camera.fov / 2) * Math.PI / 180);
    camera.position.set(0, -0.03, Math.max((mezzo.y + 0.17) / tan, (mezzo.x + 0.05) / (tan * camera.aspect)));
    // piani di taglio stretti intorno alla camicia: i due strati del tessuto restano distinti anche con poca precisione
    camera.near = Math.max(camera.position.z - 1.4, 0.1); camera.far = camera.position.z + 2.5;
    camera.updateProjectionMatrix();
  }
  misura();
  const osserva = new ResizeObserver(misura);
  osserva.observe(contenitore);

  /** Una folata: nasce nel punto (x, y) della tela se lì c'è la camicia, e soffia nel verso (dx, dy) dello schermo.
   *  `forza` è la velocità dell'aria in metri al secondo: bastano pochi centimetri al secondo, perché il cotone
   *  leggero va dove va l'aria. */
  function soffia(x, y, dx, dy, forza) {
    if (o.fermo) return false;
    inversa.copy(perno.matrixWorld).invert();
    // il raggio del puntatore, portato nello spazio della camicia
    origine.set(x, y, -1).unproject(camera);
    verso.set(x, y, 1).unproject(camera).sub(origine).normalize();
    origine.applyMatrix4(inversa); verso.transformDirection(inversa);
    const colpo = stoffa.colpo(origine.x, origine.y, origine.z, verso.x, verso.y, verso.z);
    if (!colpo) return false;
    // il vento segue il gesto e preme sul tessuto: una parte va verso il fondo della scena
    const l = Math.hypot(dx, dy) || 1;
    versoVento.set(dx / l, (dy / l) * 0.5, -0.5).normalize().transformDirection(inversa);
    // se soffia già molto, la folata nuova è più debole: il tessuto non deve mai agitarsi
    stoffa.folata(colpo[0], colpo[1], colpo[2], versoVento.x, versoVento.y, versoVento.z, forza / (1 + 3 * stoffa.carico()));
    return true;
  }

  const inTela = (e) => {
    const r = tela.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1)];
  };
  function suMovimento(e) {
    const [x, y] = inTela(e);
    const dx = x - puntaX, dy = y - puntaY;
    const ora = performance.now();
    const corsa = Math.hypot(dx, dy), dt = Math.max(ora - ultimaMossa, 1) / 1000;
    const fuori = puntaX > 1.5;                         // prima mossa dopo essere entrato: non si sa da dove viene
    if (trascina) {
      const passo = (e.clientX - trascina.x) * 0.0085;
      // la velocità con cui la si lascia andare: mai più di un giro in due secondi, o un gesto brusco la farebbe trottolare
      base += passo; velBase = Math.max(-3.2, Math.min(3.2, passo / Math.max(dt, 0.008)));
      metaInclina = Math.max(-0.28, Math.min(0.28, metaInclina + (e.clientY - trascina.y) * 0.003));
      trascina.x = e.clientX; trascina.y = e.clientY; ultimoGesto = tempo;
    }
    // passando sopra la camicia si alza una folata, tanto più viva quanto più svelto è il gesto
    if (!fuori && !trascina && corsa > 0.006 && tempo - ultimaFolata > 0.12) {
      const svelto = Math.min(corsa / dt / 2.2, 1);     // 2,2 larghezze di tela al secondo: gesto deciso
      if (soffia(x, y, dx, dy, 0.2 + 0.4 * svelto)) ultimaFolata = tempo;
    }
    puntaX = x; puntaY = y; ultimaMossa = ora;
  }
  function suGiu(e) {
    trascina = { x: e.clientX, y: e.clientY };
    velBase = 0;
    tela.setPointerCapture?.(e.pointerId);
    tela.classList.add('camicia__tela--presa');
    [puntaX, puntaY] = inTela(e); ultimaMossa = performance.now();
    // toccata, cede appena sotto il dito: sul telefono è il solo modo di sentirla
    if (soffia(puntaX, puntaY, 0, -0.2, 0.22)) ultimaFolata = tempo;
  }
  function suSu() { trascina = null; tela.classList.remove('camicia__tela--presa'); }
  function suFuori() { if (!trascina) puntaX = puntaY = 2; }
  tela.addEventListener('pointermove', suMovimento);
  tela.addEventListener('pointerdown', suGiu);
  tela.addEventListener('pointerup', suSu);
  tela.addEventListener('pointercancel', suSu);
  tela.addEventListener('pointerleave', suFuori);

  let salutata = false, giroPrima = giro;
  function passo(dt) {
    dt = Math.min(dt, 0.05);
    tempo += dt;
    const vivo = o.fermo ? 0 : 1;
    // appena compare, un soffio da sinistra: dice che è viva
    if (vivo && !salutata && tempo > 0.7) { salutata = true; soffia(-0.2, 0.05, 1, 0.1, 0.36); }

    // rotazione: segue il trascinamento senza rimbalzi; lasciata andare scivola e poi, dopo un po', torna di tre quarti
    if (!trascina) {
      base += velBase * dt; velBase *= Math.exp(-dt * 3.2);
      if (tempo - ultimoGesto > 5) base += (Math.round(base / (2 * Math.PI)) * 2 * Math.PI - base) * (1 - Math.exp(-dt * 1.1));
      if (tempo - ultimoGesto > 2.5) metaInclina *= Math.exp(-dt * 1.5);
    }
    const segue = 1 - Math.exp(-dt * 11);
    giro += (base + RIPOSO - giro) * segue;
    inclina += (metaInclina - inclina) * segue;
    const angolo = giro + vivo * Math.sin(tempo * 0.37) * 0.035;
    perno.rotation.set(inclina, angolo, 0);
    perno.position.y = vivo * Math.sin(tempo * 0.8) * 0.008;
    perno.updateMatrixWorld(true);

    if (vivo) {
      // girandola, la camicia attraversa l'aria ferma: il tessuto resta indietro, come quello di una camicia vera
      stoffa.passo(dt, dt > 0 ? (angolo - giroPrima) / dt : 0);
      ossa.needsUpdate = true;
    }
    giroPrima = angolo;
    comuni.uOcchio.value.copy(camera.position).applyMatrix4(inversa.copy(perno.matrixWorld).invert());

    const q = 1 - perno.position.y * 6;
    sotto.scale.set(largOmbra * q, largOmbra * 0.13 * q, 1); sotto.material.opacity = 0.9 * q;
    renderer.render(scena, camera);
  }

  let quadro = 0, prima = 0, visibile = true;
  function giraFotogramma(ora) {
    quadro = requestAnimationFrame(giraFotogramma);
    if (!visibile) { prima = ora; return; }
    passo(prima ? (ora - prima) / 1000 : 0.016);
    prima = ora;
  }
  const vista = new IntersectionObserver(([v]) => { visibile = v.isIntersecting; });
  vista.observe(contenitore);
  if (o.manuale) passo(0.016); else quadro = requestAnimationFrame(giraFotogramma);

  return {
    tela,
    /** Mette o toglie il taschino. */
    imposta({ taschino: con }) {
      if (con === undefined) return;
      for (const m of taschino) m.visible = Boolean(con);
    },
    /** Solo per le prove: fa avanzare il tempo di `dt` secondi e ridisegna. */
    avanza: passo,
    /** Solo per le prove: una folata dal punto (x, y) della tela, da -1 a 1, nel verso (dx, dy). */
    soffia,
    /** Solo per le prove: la gira di `angolo` radianti rispetto alla posa di tre quarti. */
    gira(angolo) { base = angolo; velBase = 0; ultimoGesto = tempo; },
    ferma() {
      cancelAnimationFrame(quadro); osserva.disconnect(); vista.disconnect();
      renderer.dispose(); tela.remove();
    },
  };
}
