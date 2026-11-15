// Camicia 3D del configuratore, in diretta nel browser con three.js.
// La camicia galleggia, segue il puntatore con inerzia, si increspa dove la si sfiora e si può girare trascinandola.
// Questo file si carica solo nella pagina del configuratore: il resto del sito non conosce three.js.
import {
  BackSide, Box3, BoxGeometry, CanvasTexture, Color, DirectionalLight, Group, Matrix4, Mesh, MeshBasicMaterial,
  MeshPhysicalMaterial, MeshStandardMaterial, NeutralToneMapping, PerspectiveCamera, PlaneGeometry, PMREMGenerator, Raycaster,
  RepeatWrapping, Scene, SphereGeometry, SRGBColorSpace, Vector2, Vector3, Vector4, WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const TOCCHI = 4;                 // quante increspature possono convivere
const AVORIO = 0xf4f2ec;

/** Grana del tessuto: un rilievo finissimo e ripetibile, disegnato qui. Toglie alla superficie l'aria di plastica. */
function grana(metriPerUv) {
  const n = 256, c = document.createElement('canvas'); c.width = c.height = n;
  const g = c.getContext('2d'), img = g.createImageData(n, n);
  // somma di onde con frequenze intere: si ripete senza giunte. Più energia lungo trama e ordito.
  let seme = 7; const caso = () => (seme = (seme * 16807) % 2147483647) / 2147483647;
  const onde = [];
  for (let i = 0; i < 46; i++) {
    const lungo = i % 3;                                   // 0: lungo l'ordito, 1: lungo la trama, 2: libero
    const kx = lungo === 0 ? Math.round(caso() * 3) : Math.round(6 + caso() * 34) * (caso() < 0.5 ? -1 : 1);
    const ky = lungo === 1 ? Math.round(caso() * 3) : Math.round(6 + caso() * 34) * (caso() < 0.5 ? -1 : 1);
    onde.push([kx, ky, caso() * 6.283, (lungo === 2 ? 0.5 : 1) / Math.hypot(kx, ky)]);
  }
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    let dx = 0, dy = 0;
    for (const [kx, ky, f, a] of onde) { const co = Math.cos(6.283185 * (kx * x + ky * y) / n + f) * a; dx += co * kx; dy += co * ky; }
    const nx = -dx * 0.3, ny = -dy * 0.3, l = Math.hypot(nx, ny, 1), i = (y * n + x) * 4;
    img.data[i] = (nx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (ny / l * 0.5 + 0.5) * 255; img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.setScalar(metriPerUv / 0.018);                  // una ripetizione ogni 1,8 cm di tessuto
  t.anisotropy = 4;
  return t;
}

/** Lo studio fotografico: pannelli luminosi intorno alla camicia, come nel film. Nessuna immagine da scaricare. */
function studio(renderer) {
  const s = new Scene();
  const pannello = (colore, forza, pos, dim) => {
    const m = new Mesh(new BoxGeometry(...dim), new MeshBasicMaterial({ color: new Color(colore).multiplyScalar(forza) }));
    m.position.set(...pos); m.lookAt(0, 0, 0); s.add(m);
  };
  // il blu della stanza: è lui a colorare le ombre
  s.add(new Mesh(new SphereGeometry(12, 32, 16), new MeshBasicMaterial({ color: new Color(0x16306e).multiplyScalar(0.55), side: BackSide })));
  pannello(0xfff4e6, 5.5, [-4.5, 3.2, 4.5], [5, 5, 0.1]);      // luce principale, morbida, davanti a sinistra
  pannello(0xdfe8ff, 1.6, [5, 0.5, 3], [4, 6, 0.1]);          // schiarita fredda a destra
  pannello(0xffd9ad, 9.0, [3.5, 2.5, -5], [3, 5, 0.1]);       // controluce caldo: il segno dell'apertura
  pannello(0xffffff, 2.2, [0, 7, 0], [7, 7, 0.1]);            // soffitto
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
  // un'ellisse schiacciata rivolta alla camera: si legge come l'ombra su un pavimento che non c'è
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false }));
}

/** Il tessuto: fisico, con la peluria del cotone (sheen) e le increspature nello shader.
 *  Il modello ha due strati, il diritto e il rovescio, a meno di 2 mm: ognuno si disegna solo dal suo lato,
 *  così da fuori il rovescio non può mai spuntare davanti al diritto. */
function tessuto(uniformi, metriPerUv) {
  const m = new MeshPhysicalMaterial({
    color: AVORIO, roughness: 0.8, metalness: 0, sheen: 0.6, sheenRoughness: 0.5, sheenColor: new Color(0xffffff),
    envMapIntensity: 1.0, normalMap: grana(metriPerUv), normalScale: new Vector2(0.16, 0.16),
  });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniformi);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec4 aDati;                 // r: quanto il punto è libero di muoversi, g: occlusione calcolata con Blender
        uniform vec4 uTocchi[${TOCCHI}];      // xyz: dove, w: quando
        uniform float uForze[${TOCCHI}];
        uniform float uTempo;
        uniform float uVento;
        uniform mat4 uInMetri;                // dalle posizioni compresse del file ai metri
        uniform float uScala;
        varying float vOcclusione;
        float gOnda; vec3 gPendenza;`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        gOnda = 0.0; gPendenza = vec3(0.0);
        vec3 pm = (uInMetri * vec4(position, 1.0)).xyz;
        for (int i = 0; i < ${TOCCHI}; i++) {
          float eta = uTempo - uTocchi[i].w;
          if (eta > 0.0 && eta < 3.0) {
            vec3 da = pm - uTocchi[i].xyz;
            float d = length(da) + 1e-5;
            float fronte = eta * 0.42;                              // l'onda corre a 42 cm al secondo
            float larg = 0.07 + eta * 0.05;
            float inv = uForze[i] * exp(-eta * 1.9) * exp(-pow((d - fronte) / larg, 2.0));
            float fase = (d - fronte) * 34.0;
            gOnda += inv * cos(fase);
            float dInv = inv * (-2.0 * (d - fronte) / (larg * larg));
            gPendenza += (dInv * cos(fase) - inv * 34.0 * sin(fase)) * da / d;
          }
        }
        // respiro lento del tessuto, più ampio dove è libero
        float fv = pm.y * 7.0 + pm.x * 4.0 + uTempo * 1.1;
        gOnda += uVento * sin(fv); gPendenza += uVento * cos(fv) * vec3(4.0, 7.0, 0.0);
        gOnda *= aDati.r; gPendenza *= aDati.r;
        objectNormal = normalize(objectNormal - (gPendenza - objectNormal * dot(objectNormal, gPendenza)));`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        transformed += normal * (gOnda / uScala);
        vOcclusione = aDati.g;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying float vOcclusione;`)
      .replace('#include <aomap_fragment>', `#include <aomap_fragment>
        float occ = smoothstep(0.0, 0.95, vOcclusione);
        reflectedLight.indirectDiffuse *= mix(0.16, 1.0, occ);
        reflectedLight.indirectSpecular *= occ * occ;
        reflectedLight.directDiffuse *= mix(0.3, 1.0, occ);
        reflectedLight.directSpecular *= occ;`);
  };
  return m;
}

/**
 * Avvia la camicia dentro `contenitore`.
 * @param {HTMLElement} contenitore  l'elemento che ospita la tela
 * @param {object} o
 * @param {string} o.modello         indirizzo del file .glb
 * @param {number} o.metriPerUv      quanti metri di tessuto vale un'unità della mappa del modello (da camicia.json)
 * @param {(caricati:number, totali:number)=>void} [o.avanzamento]  byte scaricati e, se il server lo dice, byte totali
 * @param {boolean} [o.fermo]        movimento ridotto: niente galleggiamento, si gira solo trascinando
 * @param {boolean} [o.manuale]      il tempo lo fa avanzare chi chiama (per registrare i video di prova)
 */
export async function avviaCamicia(contenitore, o) {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NeutralToneMapping;        // lascia bianco il bianco: con altre curve la camicia ingrigisce
  renderer.toneMappingExposure = 1.22;
  const tela = renderer.domElement;
  tela.className = 'camicia__tela';
  tela.setAttribute('aria-hidden', 'true');
  contenitore.appendChild(tela);

  const scena = new Scene();
  scena.environment = studio(renderer);
  const camera = new PerspectiveCamera(24, 1, 0.1, 20);
  const sole = new DirectionalLight(0xffe2bd, 1.3);       // il controluce caldo
  sole.position.set(2.2, 1.6, -2.6);
  scena.add(sole);
  const chiave = new DirectionalLight(0xfff6ea, 0.9);
  chiave.position.set(-2.0, 2.2, 3.0);
  scena.add(chiave);

  // scaricamento con avanzamento
  MeshoptDecoder.ready && (await MeshoptDecoder.ready);
  const caricatore = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const gltf = await new Promise((si, no) => caricatore.load(o.modello, si, (e) => {
    if (o.avanzamento) o.avanzamento(e.loaded, e.lengthComputable ? e.total : 0);
  }, no));

  const uniformi = {
    uTocchi: { value: Array.from({ length: TOCCHI }, () => new Vector4(0, 0, 0, -10)) },
    uForze: { value: new Array(TOCCHI).fill(0) },
    uTempo: { value: 0 },
    uVento: { value: o.fermo ? 0 : 0.0024 },
    uInMetri: { value: new Matrix4() },
    uScala: { value: 1 },
  };
  const perno = new Group();        // gira e galleggia
  const camicia = gltf.scene;
  const bersagli = [];
  const stoffa = tessuto(uniformi, o.metriPerUv || 2.8);
  const perla = new MeshPhysicalMaterial({ color: 0xece6d8, roughness: 0.28, clearcoat: 0.7, clearcoatRoughness: 0.25, iridescence: 0.35, iridescenceIOR: 1.6 });
  const filo = new MeshStandardMaterial({ color: AVORIO, roughness: 0.9 });
  perno.add(camicia);
  scena.add(perno);
  perno.updateMatrixWorld(true);
  camicia.traverse((m) => {
    if (!m.isMesh) return;
    const g = m.geometry, nome = m.material.name;
    m.material.dispose();
    if (nome === 'bottone' || nome === 'filo') {
      m.material = nome === 'bottone' ? perla : filo;
      g.deleteAttribute('color');
      return;
    }
    if (g.attributes.color) { g.setAttribute('aDati', g.attributes.color); g.deleteAttribute('color'); }
    m.material = stoffa;
    bersagli.push(m);
    uniformi.uInMetri.value.copy(m.matrixWorld);          // il perno è ancora fermo nell'origine
    uniformi.uScala.value = new Vector3().setFromMatrixColumn(m.matrixWorld, 0).length();
  });
  const ingombro = new Box3().setFromObject(camicia);
  const mezzo = new Vector3().subVectors(ingombro.max, ingombro.min).multiplyScalar(0.5);
  const sotto = ombra();
  const largOmbra = mezzo.x * 1.9;
  sotto.position.y = ingombro.min.y - 0.15;
  scena.add(sotto);

  // --- stato del movimento -------------------------------------------------------------------------------
  const giro = { y: 0.42, x: 0.0, vy: 0, vx: 0 };      // angoli attuali e velocità
  const meta = { y: 0.0, x: 0.0 };                     // dove vuole andare seguendo il puntatore
  let base = 0;                                        // rotazione scelta trascinando
  let trascina = null;
  let ultimoGesto = -10;
  const punta = new Vector2(2, 2);                     // puntatore in coordinate della tela (-1..1)
  const velPunta = new Vector2();
  let puntaDentro = false;
  let prossimo = 0;
  const raggio = new Raycaster();
  const locale = new Vector3();
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

  function tocca(x, y, forza) {
    raggio.setFromCamera(punta.set(x, y), camera);
    const colpi = raggio.intersectObjects(bersagli, false);
    if (!colpi.length) return false;
    locale.copy(colpi[0].point); perno.worldToLocal(locale);
    const i = prossimo++ % TOCCHI;
    uniformi.uTocchi.value[i].set(locale.x, locale.y, locale.z, tempo);
    uniformi.uForze.value[i] = forza;
    return true;
  }

  let ultimoTocco = -1;
  function suMovimento(e) {
    const r = tela.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 2 - 1, y = -(((e.clientY - r.top) / r.height) * 2 - 1);
    velPunta.set(x - punta.x, y - punta.y);
    const primo = !puntaDentro;
    puntaDentro = true;
    if (trascina) {
      base += (e.clientX - trascina.x) * 0.0085; giro.vy = (e.clientX - trascina.x) * 0.5;
      meta.x = Math.max(-0.3, Math.min(0.3, meta.x + (e.clientY - trascina.y) * 0.003));
      trascina.x = e.clientX; trascina.y = e.clientY; ultimoGesto = tempo;
      punta.set(x, y);
      return;
    }
    if (e.pointerType === 'touch') { punta.set(x, y); return; }
    if (!o.fermo) { meta.y = x * 0.5; meta.x = -y * 0.14; }
    // passando sopra il tessuto: una spinta e un'increspatura
    const corsa = primo ? 0 : velPunta.length();
    if (corsa > 0.004 && tempo - ultimoTocco > 0.09 && tocca(x, y, Math.min(0.011 + corsa * 0.12, 0.026))) {
      ultimoTocco = tempo;
      if (!o.fermo) { giro.vy += velPunta.x * 4.4; giro.vx -= velPunta.y * 1.6; }
    }
    punta.set(x, y);
  }
  function suGiu(e) {
    trascina = { x: e.clientX, y: e.clientY };
    tela.setPointerCapture?.(e.pointerId);
    tela.classList.add('camicia__tela--presa');
    const r = tela.getBoundingClientRect();
    tocca(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1), 0.022);
  }
  function suSu() { trascina = null; tela.classList.remove('camicia__tela--presa'); }
  function suFuori() { puntaDentro = false; meta.y = 0; meta.x = 0; }
  tela.addEventListener('pointermove', suMovimento);
  tela.addEventListener('pointerdown', suGiu);
  tela.addEventListener('pointerup', suSu);
  tela.addEventListener('pointercancel', suSu);
  tela.addEventListener('pointerleave', suFuori);

  function passo(dt) {
    dt = Math.min(dt, 0.05);
    tempo += dt;
    uniformi.uTempo.value = tempo;
    // dopo un po' che nessuno la gira, torna a mostrarsi di tre quarti
    if (!trascina && tempo - ultimoGesto > 5) base += (Math.round(base / (2 * Math.PI)) * 2 * Math.PI - base) * Math.min(dt * 1.2, 1);
    // molla smorzata verso la meta
    const k = 34, c = 6.8;         // poco smorzata: dopo una spinta oscilla un paio di volte prima di fermarsi
    const ty = base + (o.fermo ? 0 : 0.34) + meta.y, tx = meta.x;
    giro.vy += (k * (ty - giro.y) - c * giro.vy) * dt; giro.y += giro.vy * dt;
    giro.vx += (k * (tx - giro.x) - c * giro.vx) * dt; giro.x += giro.vx * dt;
    const g = o.fermo ? 0 : 1;
    perno.rotation.set(giro.x + g * Math.sin(tempo * 0.7) * 0.012, giro.y + g * Math.sin(tempo * 0.43) * 0.05, g * Math.sin(tempo * 0.55) * 0.014);
    perno.position.y = g * Math.sin(tempo * 0.9) * 0.012;
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
    /** Solo per le prove: fa avanzare il tempo di `dt` secondi e ridisegna. */
    avanza: passo,
    /** Solo per le prove: un tocco nel punto (x, y) della tela, da -1 a 1. */
    tocca,
    ferma() {
      cancelAnimationFrame(quadro); osserva.disconnect(); vista.disconnect();
      renderer.dispose(); tela.remove();
    },
  };
}
