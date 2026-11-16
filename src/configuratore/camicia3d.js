// Camicia 3D del configuratore, in diretta nel browser con three.js.
// La camicia è sospesa e si muove come mossa dal vento: una brezza appena accennata quando è ferma, una folata
// leggera che nasce dove passa il puntatore e corre nel verso in cui lo si muove. Si gira trascinandola.
// Il proprietario ha bocciato le onde ad anello e l'oscillazione a molla ("non è naturale"): non rimetterle.
// Questo file si carica solo nella pagina del configuratore: il resto del sito non conosce three.js.
import {
  BackSide, Box3, BoxGeometry, CanvasTexture, Color, DirectionalLight, Group, Matrix4, Mesh, MeshBasicMaterial,
  MeshPhysicalMaterial, MeshStandardMaterial, NeutralToneMapping, PerspectiveCamera, PlaneGeometry, PMREMGenerator, Raycaster,
  RepeatWrapping, Scene, SphereGeometry, SRGBColorSpace, Vector2, Vector3, Vector4, WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const RAFFICHE = 4;               // quante folate possono convivere
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

/** Il vento, scritto dentro lo shader dei vertici. Vale per il tessuto e, nella sola parte che sposta tutto insieme,
 *  per bottoni e fili, che devono restare attaccati alla stoffa.
 *  - `gOnda`: quanto il tessuto si gonfia lungo la sua normale (le pieghe che corrono nel verso del vento)
 *  - `gSposta`: quanto si sposta di peso (la spinta della folata e l'inclinazione di tutta la camicia appesa) */
const VENTO_DICHIARAZIONI = `
  uniform vec4 uRaffiche[${RAFFICHE}];   // xyz: dove nasce la folata (metri), w: quando
  uniform vec4 uVersi[${RAFFICHE}];      // xyz: verso del vento, w: forza 0..1
  uniform vec4 uBrezza;                  // xyz: verso della brezza di fondo, w: forza
  uniform vec3 uPiega;                   // di quanto è spinto il fondo della camicia, in metri
  uniform float uTempo;
  uniform float uSpalle;                 // quota delle spalle: da lì in giù la camicia è appesa
  uniform float uAltezza;
  uniform mat4 uInMetri;                 // dalle posizioni compresse del file ai metri
  uniform float uScala;
  float gOnda; vec3 gPendenza; vec3 gSposta;
  void vento(vec3 pm, float liberta) {
    float appeso = clamp((uSpalle - pm.y) / uAltezza, 0.0, 1.0);
    float onda = 0.0; vec3 pend = vec3(0.0); vec3 spinta = vec3(0.0); float somma = 0.0;
    for (int i = 0; i < ${RAFFICHE}; i++) {
      float eta = uTempo - uRaffiche[i].w;
      if (eta > 0.0 && eta < 4.5) {
        vec3 d = uVersi[i].xyz;
        // la folata arriva in fretta e se ne va piano; il suo centro corre col vento e si allarga
        float inv = uVersi[i].w * (1.0 - exp(-eta * 8.0)) * exp(-eta * 1.1);
        vec3 rel = pm - (uRaffiche[i].xyz + d * (0.5 * eta));
        float raggio = 0.20 + 0.28 * eta;
        float a = inv * exp(-dot(rel, rel) / (raggio * raggio));
        // due pieghe di passo diverso che corrono nel verso del vento, un po' di traverso perché non siano righe dritte
        float s = dot(pm, d);
        float f1 = s * 24.0 - eta * 6.0 + pm.y * 5.0;
        float f2 = s * 57.0 - eta * 10.5 + pm.x * 8.0 + 1.7;
        float w = sin(f1) + 0.33 * sin(f2);
        onda += a * w;
        pend += a * (cos(f1) * (24.0 * d + vec3(0.0, 5.0, 0.0)) + 0.33 * cos(f2) * (57.0 * d + vec3(8.0, 0.0, 0.0)))
              + w * a * (-2.0 * rel / (raggio * raggio));
        spinta += d * a;
        somma += a;
      }
    }
    // più folate nello stesso punto non si sommano all'infinito: il tessuto resta leggero
    float misura = 1.0 / (1.0 + 0.9 * somma);
    onda *= misura; pend *= misura; spinta *= misura;
    // brezza di fondo: sempre presente, appena visibile
    float sb = dot(pm, uBrezza.xyz);
    float b1 = sb * 16.0 - uTempo * 1.9 + pm.y * 4.0;
    float b2 = sb * 37.0 - uTempo * 3.1 + 0.9;
    onda += uBrezza.w * (sin(b1) + 0.4 * sin(b2));
    pend += uBrezza.w * (cos(b1) * (16.0 * uBrezza.xyz + vec3(0.0, 4.0, 0.0)) + 0.4 * cos(b2) * 37.0 * uBrezza.xyz);
    // in basso, dove è più libero, il tessuto si muove di più
    float peso = liberta * (0.3 + 0.7 * appeso);
    gOnda = 0.0052 * onda * peso;
    gPendenza = 0.0052 * pend * peso;
    gSposta = 0.011 * spinta * peso + uPiega * appeso * appeso;
  }`;

function conVento(materiale, uniformi, { stoffa }) {
  materiale.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniformi);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        ${stoffa ? `attribute vec4 aDati;             // r: libertà di movimento, g: ombra d'ambiente senza taschino, b: con il taschino
        uniform float uTaschino;
        varying float vOcclusione;` : ''}
        ${VENTO_DICHIARAZIONI}`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        vento((uInMetri * vec4(position, 1.0)).xyz, ${stoffa ? 'aDati.r' : '0.0'});
        ${stoffa ? 'objectNormal = normalize(objectNormal - (gPendenza - objectNormal * dot(objectNormal, gPendenza)));' : ''}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        transformed += (normal * gOnda + gSposta) / uScala;
        ${stoffa ? 'vOcclusione = mix(aDati.g, aDati.b, uTaschino);' : ''}`);
    if (!stoffa) return;
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
  // ogni pezzo ha le sue misure di decompressione: lo shader va tenuto distinto anche se il materiale è uguale
  materiale.customProgramCacheKey = () => (stoffa ? 'stoffa' : 'rigido');
  return materiale;
}

/**
 * Avvia la camicia dentro `contenitore`.
 * @param {HTMLElement} contenitore  l'elemento che ospita la tela
 * @param {object} o
 * @param {string} o.modello         indirizzo del file .glb
 * @param {number} o.metriPerUv      quanti metri di tessuto vale un'unità della mappa del modello (da camicia.json)
 * @param {boolean} [o.taschino]     con il taschino (di base la camicia è senza)
 * @param {(caricati:number, totali:number)=>void} [o.avanzamento]  byte scaricati e, se il server lo dice, byte totali
 * @param {boolean} [o.fermo]        movimento ridotto: niente vento, si gira solo trascinando
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

  // ciò che il vento condivide tra tutti i pezzi; le misure di decompressione sono invece di ogni pezzo
  const comuni = {
    uRaffiche: { value: Array.from({ length: RAFFICHE }, () => new Vector4(0, 0, 0, -10)) },
    uVersi: { value: Array.from({ length: RAFFICHE }, () => new Vector4(1, 0, 0, 0)) },
    uBrezza: { value: new Vector4(1, 0, 0, 0) },
    uPiega: { value: new Vector3() },
    uTempo: { value: 0 },
    uSpalle: { value: 0 },
    uAltezza: { value: 1 },
    uTaschino: { value: o.taschino ? 1 : 0 },
  };
  const perno = new Group();        // gira e galleggia
  const camicia = gltf.scene;
  const bersagli = [];              // dove il puntatore può toccare la stoffa
  const taschino = [];
  const grano = grana(o.metriPerUv || 2.8);
  perno.add(camicia);
  scena.add(perno);
  perno.updateMatrixWorld(true);
  const delTaschino = (m) => { for (let p = m; p; p = p.parent) if (p.name === 'taschino') return true; return false; };
  camicia.traverse((m) => {
    if (!m.isMesh) return;
    const g = m.geometry, nome = m.material.name;
    m.material.dispose();
    const uniformi = {
      ...comuni,
      uInMetri: { value: new Matrix4().copy(m.matrixWorld) },          // il perno è ancora fermo nell'origine
      uScala: { value: new Vector3().setFromMatrixColumn(m.matrixWorld, 0).length() },
    };
    if (nome === 'bottone' || nome === 'filo') {
      g.deleteAttribute('color');
      m.material = conVento(nome === 'bottone'
        ? new MeshPhysicalMaterial({ color: 0xece6d8, roughness: 0.28, clearcoat: 0.7, clearcoatRoughness: 0.25, iridescence: 0.35, iridescenceIOR: 1.6 })
        : new MeshStandardMaterial({ color: AVORIO, roughness: 0.9 }), uniformi, { stoffa: false });
      return;
    }
    if (g.attributes.color) { g.setAttribute('aDati', g.attributes.color); g.deleteAttribute('color'); }
    m.material = conVento(new MeshPhysicalMaterial({
      color: AVORIO, roughness: 0.8, metalness: 0, sheen: 0.6, sheenRoughness: 0.5, sheenColor: new Color(0xffffff),
      envMapIntensity: 1.0, normalMap: grano, normalScale: new Vector2(0.16, 0.16),
    }), uniformi, { stoffa: true });
    if (delTaschino(m)) { taschino.push(m); m.visible = Boolean(o.taschino); } else bersagli.push(m);
  });
  const ingombro = new Box3().setFromObject(camicia);
  const mezzo = new Vector3().subVectors(ingombro.max, ingombro.min).multiplyScalar(0.5);
  comuni.uSpalle.value = ingombro.max.y - 0.13;                         // sotto il collo
  comuni.uAltezza.value = comuni.uSpalle.value - ingombro.min.y;
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
  const punta = new Vector2(2, 2);                     // puntatore in coordinate della tela (-1..1)
  let ultimaMossa = 0, ultimaFolata = -1;
  let prossima = 0;
  const raggio = new Raycaster();
  const locale = new Vector3(), verso = new Vector3(), metaPiega = new Vector3();
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

  /** Una folata: nasce nel punto (x, y) della tela se lì c'è la camicia, e soffia nel verso (dx, dy) dello schermo. */
  function soffia(x, y, dx, dy, forza) {
    if (o.fermo) return false;
    raggio.setFromCamera(punta.set(x, y), camera);
    const colpi = raggio.intersectObjects(bersagli, false);
    if (!colpi.length) return false;
    locale.copy(colpi[0].point); perno.worldToLocal(locale);
    // il vento segue il gesto e spinge un po' verso il fondo della scena; poi si porta nel sistema della camicia
    const l = Math.hypot(dx, dy) || 1;
    verso.set(dx / l, (dy / l) * 0.55, -0.45).normalize().transformDirection(perno.matrixWorld.clone().invert());
    // se soffia già molto, la folata nuova è più debole: il tessuto non deve mai agitarsi
    let carico = 0;
    for (let i = 0; i < RAFFICHE; i++) {
      const eta = tempo - comuni.uRaffiche.value[i].w;
      if (eta >= 0 && eta < 4.5) carico += comuni.uVersi.value[i].w * Math.exp(-eta * 1.1);
    }
    const i = prossima++ % RAFFICHE;
    comuni.uRaffiche.value[i].set(locale.x, locale.y, locale.z, tempo);
    comuni.uVersi.value[i].set(verso.x, verso.y, verso.z, forza * Math.max(0.3, 1 - carico * 0.55));
    return true;
  }

  const inTela = (e) => {
    const r = tela.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1)];
  };
  function suMovimento(e) {
    const [x, y] = inTela(e);
    const dx = x - punta.x, dy = y - punta.y;
    const ora = performance.now();
    const corsa = Math.hypot(dx, dy), dt = Math.max(ora - ultimaMossa, 1) / 1000;
    const fuori = punta.x > 1.5;                        // prima mossa dopo essere entrato: non si sa da dove viene
    if (trascina) {
      const passo = (e.clientX - trascina.x) * 0.0085;
      base += passo; velBase = passo / Math.max(dt, 0.008);
      metaInclina = Math.max(-0.28, Math.min(0.28, metaInclina + (e.clientY - trascina.y) * 0.003));
      trascina.x = e.clientX; trascina.y = e.clientY; ultimoGesto = tempo;
    }
    // passando sopra la camicia si alza una folata, tanto più viva quanto più svelto è il gesto
    if (!fuori && corsa > 0.006 && tempo - ultimaFolata > (trascina ? 0.3 : 0.16)) {
      const svelto = Math.min(corsa / dt / 2.2, 1);     // 2,2 larghezze di tela al secondo: gesto deciso
      if (soffia(x, y, dx, dy, (trascina ? 0.35 : 0.45) + 0.55 * svelto)) ultimaFolata = tempo;
    }
    punta.set(x, y); ultimaMossa = ora;
  }
  function suGiu(e) {
    trascina = { x: e.clientX, y: e.clientY };
    velBase = 0;
    tela.setPointerCapture?.(e.pointerId);
    tela.classList.add('camicia__tela--presa');
    const [x, y] = inTela(e); punta.set(x, y); ultimaMossa = performance.now();
  }
  function suSu() { trascina = null; tela.classList.remove('camicia__tela--presa'); }
  function suFuori() { if (!trascina) punta.set(2, 2); }
  tela.addEventListener('pointermove', suMovimento);
  tela.addEventListener('pointerdown', suGiu);
  tela.addEventListener('pointerup', suSu);
  tela.addEventListener('pointercancel', suSu);
  tela.addEventListener('pointerleave', suFuori);

  let salutata = false;
  function passo(dt) {
    dt = Math.min(dt, 0.05);
    tempo += dt;
    comuni.uTempo.value = tempo;
    const vivo = o.fermo ? 0 : 1;
    // appena compare, un soffio da sinistra: dice che è viva
    if (vivo && !salutata && tempo > 0.7) { salutata = true; soffia(-0.25, 0.1, 1, 0.1, 0.7); }

    // rotazione: segue il trascinamento senza rimbalzi; lasciata andare scivola e poi, dopo un po', torna di tre quarti
    if (!trascina) {
      base += velBase * dt; velBase *= Math.exp(-dt * 3.2);
      if (tempo - ultimoGesto > 5) base += (Math.round(base / (2 * Math.PI)) * 2 * Math.PI - base) * (1 - Math.exp(-dt * 1.1));
      if (tempo - ultimoGesto > 2.5) metaInclina *= Math.exp(-dt * 1.5);
    }
    const segue = 1 - Math.exp(-dt * 11);
    giro += (base + RIPOSO - giro) * segue;
    inclina += (metaInclina - inclina) * segue;
    perno.rotation.set(inclina, giro + vivo * Math.sin(tempo * 0.37) * 0.035, 0);
    perno.position.y = vivo * Math.sin(tempo * 0.8) * 0.008;

    // brezza di fondo: gira piano intorno alla camicia
    const ab = tempo * 0.21;
    comuni.uBrezza.value.set(Math.cos(ab), 0.12, Math.sin(ab) * 0.6, vivo * 0.16).setW(vivo * 0.16);
    const lb = Math.hypot(comuni.uBrezza.value.x, comuni.uBrezza.value.y, comuni.uBrezza.value.z);
    comuni.uBrezza.value.x /= lb; comuni.uBrezza.value.y /= lb; comuni.uBrezza.value.z /= lb;
    // tutta la camicia, appesa alle spalle, si lascia spingere dalle folate: sale svelta, torna piano, mai un rimbalzo
    metaPiega.set(0, 0, 0);
    for (let i = 0; i < RAFFICHE; i++) {
      const eta = tempo - comuni.uRaffiche.value[i].w, v = comuni.uVersi.value[i];
      if (eta >= 0 && eta < 4.5) metaPiega.addScaledVector(v, v.w * (1 - Math.exp(-eta * 4)) * Math.exp(-eta * 0.9) * 0.02);
    }
    metaPiega.x += vivo * Math.sin(tempo * 0.5) * 0.003; metaPiega.z += vivo * Math.sin(tempo * 0.33 + 1) * 0.003;
    metaPiega.y *= 0.3;                                 // il vento non solleva la camicia
    if (metaPiega.length() > 0.016) metaPiega.setLength(0.016);   // al più un dito e mezzo, anche con molte folate
    const cresce = metaPiega.lengthSq() > comuni.uPiega.value.lengthSq();
    comuni.uPiega.value.lerp(metaPiega, 1 - Math.exp(-dt * (cresce ? 5 : 1.6)));

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
      comuni.uTaschino.value = con ? 1 : 0;
    },
    /** Solo per le prove: fa avanzare il tempo di `dt` secondi e ridisegna. */
    avanza: passo,
    /** Solo per le prove: una folata dal punto (x, y) della tela, da -1 a 1, nel verso (dx, dy). */
    soffia,
    ferma() {
      cancelAnimationFrame(quadro); osserva.disconnect(); vista.disconnect();
      renderer.dispose(); tela.remove();
    },
  };
}
