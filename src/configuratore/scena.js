// La scena intorno alla camicia del configuratore: una parete blu, la luce di una finestra che ci disegna sopra le
// sue sbarre, l'ombra della camicia, la gruccia di legno a cui è appesa e il nastro che sale fuori dall'inquadratura.
// L'ha chiesta il proprietario il 16 novembre 2026 su una sua immagine di riferimento (una maglietta appesa davanti a
// un muro, con l'ombra e la luce di una finestra).
//
// La luce della finestra è un fascio di raggi paralleli. Per questo l'ombra non ha bisogno di calcoli pesanti: ogni
// punto della camicia si schiaccia sulla parete lungo il raggio che lo attraversa, si disegna così in una piccola
// immagine, la si sfuma, e la parete la legge. La camicia si muove col vento e l'ombra con lei.
import {
  BufferAttribute, BufferGeometry, CatmullRomCurve3, Color, DoubleSide, Group, LinearFilter, Mesh, MeshStandardMaterial,
  OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, TubeGeometry, Vector2, Vector3, Vector4, WebGLRenderTarget,
} from 'three';

export const PARETE = -0.62;          // la parete sta a 62 cm dietro il centro della camicia
const LATO_OMBRA = 512;               // punti di lato dell'immagine dell'ombra
const BLU = 0x0a1b45;                 // il blu della pagina (--blu-notte): la parete in ombra
const BLU_IN_LUCE = 0x1b3c7e;         // lo stesso blu dove batte la finestra

/** La luce della finestra in un punto della parete: 1 dove passa, 0 dietro le sbarre e fuori dal riquadro.
 *  La stessa funzione serve alla camicia: chiede "il raggio che passa da me dove finisce sulla parete?". */
export const FINESTRA = /* glsl */`
  uniform vec4 uFinestra;              // sulla parete: centro (x, y), mezza larghezza, mezza altezza della luce
  uniform vec3 uVersoFinestra;         // verso da cui arriva la luce
  uniform float uParete;
  float vetri(float t, float passo, float sbarra, float morbida) {
    float d = abs(fract(t / passo) - 0.5) * passo;                  // distanza dalla sbarra più vicina
    return 1.0 - smoothstep(passo * 0.5 - sbarra * 0.5 - morbida, passo * 0.5 - sbarra * 0.5 + morbida, d);
  }
  float finestra(vec2 q) {
    vec2 p = q - uFinestra.xy;
    p = vec2(p.x + 0.09 * p.y, p.y - 0.13 * p.x);                   // il sole entra di sbieco: il riquadro è un po' storto
    vec2 fuori = abs(p) - uFinestra.zw;
    float dentro = (1.0 - smoothstep(-0.04, 0.03, fuori.x)) * (1.0 - smoothstep(-0.04, 0.03, fuori.y));
    float montante = smoothstep(0.018, 0.05, abs(p.x));             // il montante tra le due ante
    // sbarre sottili e sfumate: la finestra è lontana
    return dentro * montante * vetri(p.x, 0.247, 0.016, 0.017) * vetri(p.y + 0.06, 0.30, 0.016, 0.017);
  }
  /** La luce della finestra che arriva in un punto dello spazio. */
  float finestraIn(vec3 punto) {
    return finestra(punto.xy - uVersoFinestra.xy * ((punto.z - uParete) / uVersoFinestra.z));
  }`;

const SCHIACCIA = /* glsl */`
  uniform vec3 uVersoFinestra;
  uniform float uParete;
  uniform vec4 uRiquadro;               // la zona della parete che l'immagine dell'ombra copre: centro, mezzi lati
  vec4 sullaParete(vec3 mondo) {
    vec2 q = mondo.xy - uVersoFinestra.xy * ((mondo.z - uParete) / uVersoFinestra.z);
    return vec4((q - uRiquadro.xy) / uRiquadro.zw, 0.0, 1.0);
  }`;

/** Il legno della gruccia: una sbarra a sezione ovale lungo la linea delle spalle (misure da camicia.json). */
function legno(punti) {
  const GIRO = 14, n = punti.length, pos = new Float32Array(n * GIRO * 3), ind = [];
  for (let i = 0; i < n; i++) {
    const [x, y, z, alta, larga] = punti[i];
    const punta = Math.sqrt(Math.max(0, 1 - Math.abs((i / (n - 1)) * 2 - 1) ** 10));       // le estremità sono arrotondate
    for (let k = 0; k < GIRO; k++) {
      const a = (k / GIRO) * Math.PI * 2;
      pos.set([x, y + alta * punta * Math.sin(a), z + larga * punta * Math.cos(a)], (i * GIRO + k) * 3);
    }
    if (i) for (let k = 0; k < GIRO; k++) {
      const a = (i - 1) * GIRO + k, b = (i - 1) * GIRO + (k + 1) % GIRO, c = i * GIRO + k, d = i * GIRO + (k + 1) % GIRO;
      ind.push(a, c, b, b, c, d);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3)); g.setIndex(ind); g.computeVertexNormals();
  return g;
}

/** Il nastro: scende dall'alto, passa sotto il gancio e risale di poco, cucito su sé stesso. */
function nastro(cima) {
  const R = 0.0034, L = 0.0105, via = [[cima.y + 1.7, cima.z + R]];
  for (let k = 0; k <= 8; k++) { const a = (k / 8) * Math.PI; via.push([cima.y - R * Math.sin(a), cima.z + R * Math.cos(a)]); }
  via.push([cima.y + 0.03, cima.z - R], [cima.y + 0.05, cima.z + R * 0.6]);
  const pos = [], ind = [];
  via.forEach(([y, z], i) => {
    pos.push(-L, y, z, L, y, z);
    if (i) ind.push(2 * i - 2, 2 * i - 1, 2 * i, 2 * i, 2 * i - 1, 2 * i + 1);
  });
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3)); g.setIndex(ind); g.computeVertexNormals();
  return g;
}

/**
 * Costruisce la scena. Restituisce i pezzi da aggiungere e le funzioni per tenerli aggiornati.
 * @param {object} o
 * @param {import('three').WebGLRenderer} o.renderer
 * @param {object} o.dati          camicia.json: verso della finestra, misure per la gruccia
 * @param {string} o.ossa          il pezzo di shader con cui la camicia segue il telaio
 * @param {object} o.definizioni   le sue definizioni
 */
export function creaScena({ renderer, dati, ossa, definizioni }) {
  const verso = new Vector3(...dati.finestra).normalize();
  // dove cade sulla parete l'ombra del centro della camicia: lì intorno sta la luce della finestra
  const cade = new Vector2(-verso.x, -verso.y).multiplyScalar(-PARETE / verso.z);
  const uniformi = {
    uVersoFinestra: { value: verso },
    uParete: { value: PARETE },
    uFinestra: { value: new Vector4(cade.x + 0.05, cade.y + 0.16, 0.741, 0.78) },
    uRiquadro: { value: new Vector4(cade.x, cade.y + 0.12, 0.8, 0.8) },
    uPerno: { value: null },
  };

  // --- l'ombra: la camicia schiacciata sulla parete, in una piccola immagine che poi si sfuma
  const nuova = () => new WebGLRenderTarget(LATO_OMBRA, LATO_OMBRA, { depthBuffer: false, minFilter: LinearFilter, magFilter: LinearFilter });
  const [grezza, mezza, morbida] = [nuova(), nuova(), nuova()];
  const scenaOmbra = new Scene(), occhio = new OrthographicCamera(-1, 1, 1, -1, 0, 1), gemelli = [];
  const bianco = { depthTest: false, depthWrite: false, side: DoubleSide, toneMapped: false };
  const sfuma = new ShaderMaterial({
    uniforms: { uT: { value: null }, uPasso: { value: new Vector2() } }, depthTest: false, depthWrite: false, toneMapped: false,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: /* glsl */`
      uniform sampler2D uT; uniform vec2 uPasso; varying vec2 vUv;
      void main() {
        float somma = 0.0, pesi = 0.0;
        for (int i = -6; i <= 6; i++) { float w = exp(-float(i * i) / 14.0); somma += w * texture2D(uT, vUv + uPasso * float(i)).r; pesi += w; }
        gl_FragColor = vec4(vec3(somma / pesi), 1.0);
      }`,
  });
  const scenaSfuma = new Scene();
  const foglio = new Mesh(new PlaneGeometry(2, 2), sfuma); foglio.frustumCulled = false; scenaSfuma.add(foglio);

  /** Il gemello di un pezzo di camicia: la stessa geometria, disegnata schiacciata sulla parete. */
  function gemello(mesh, uniformiDelPezzo) {
    const m = new Mesh(mesh.geometry, new ShaderMaterial({
      ...bianco, defines: definizioni, uniforms: { ...uniformiDelPezzo, ...uniformi },
      vertexShader: `${ossa}\n${SCHIACCIA}\nuniform mat4 uPerno;\nvoid main() { vec3 P, N; segui(P, N); gl_Position = sullaParete((uPerno * vec4(P, 1.0)).xyz); }`,
      fragmentShader: 'void main() { gl_FragColor = vec4(1.0); }',
    }));
    m.frustumCulled = false; scenaOmbra.add(m); gemelli.push([m, mesh]);
  }
  /** Il gemello di un pezzo rigido (gruccia, gancio, nastro). */
  function gemelloRigido(mesh) {
    const m = new Mesh(mesh.geometry, new ShaderMaterial({
      ...bianco, uniforms: uniformi,
      vertexShader: `${SCHIACCIA}\nvoid main() { gl_Position = sullaParete((modelMatrix * vec4(position, 1.0)).xyz); }`,
      fragmentShader: 'void main() { gl_FragColor = vec4(1.0); }',
    }));
    m.frustumCulled = false; m.matrixAutoUpdate = false; m.matrixWorldAutoUpdate = false; scenaOmbra.add(m); gemelli.push([m, mesh]);
  }

  // --- la parete
  const parete = new Mesh(new PlaneGeometry(14, 9), new ShaderMaterial({
    uniforms: { ...uniformi, uOmbra: { value: morbida.texture }, uBase: { value: new Color(BLU) }, uChiara: { value: new Color(BLU_IN_LUCE) } },
    toneMapped: false,
    vertexShader: 'varying vec3 vMondo; void main() { vMondo = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vMondo, 1.0); }',
    fragmentShader: /* glsl */`
      uniform sampler2D uOmbra; uniform vec4 uRiquadro; uniform vec3 uBase, uChiara; varying vec3 vMondo;
      ${FINESTRA}
      void main() {
        vec2 q = vMondo.xy;
        vec2 uv = (q - uRiquadro.xy) / uRiquadro.zw * 0.5 + 0.5;
        float ombra = texture2D(uOmbra, uv).r * step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
        float luce = finestra(q) * (1.0 - 0.94 * ombra);
        // fuori dalla luce della finestra la camicia toglie alla parete solo un poco di luce d'ambiente
        vec3 colore = mix(uBase, uChiara, luce) * (1.0 - 0.16 * ombra);
        colore *= mix(0.86, 1.0, smoothstep(2.4, 0.4, length(q - uFinestra.xy)));      // la parete si spegne piano verso i bordi
        gl_FragColor = vec4(colore, 1.0);
        #include <colorspace_fragment>
      }`,
  }));
  parete.position.z = PARETE;

  // --- la gruccia: legno lungo le spalle, gancio di metallo, nastro avorio
  const gruccia = new Group();
  const mezzo = dati.gruccia[(dati.gruccia.length - 1) >> 1];
  const piede = new Vector3(0, mezzo[1] + mezzo[3] - 0.002, mezzo[2]), RAGGIO = 0.021;
  // il legno sta dentro il colletto: il gambo del gancio è lungo quanto serve perché l'anello ne esca tutto
  const gambo = Math.max(0.046, dati.mezzo_ingombro[1] + 0.014 - piede.y);
  const filo = [piede.clone(), piede.clone().setY(piede.y + gambo * 0.6)];
  for (let k = 0; k <= 26; k++) {
    const a = (-90 + 285 * (k / 26)) * Math.PI / 180;
    filo.push(new Vector3(RAGGIO * Math.cos(a), piede.y + gambo + RAGGIO + RAGGIO * Math.sin(a), piede.z));
  }
  const cima = new Vector3(0, piede.y + gambo + 2 * RAGGIO, piede.z);                // il punto più alto del gancio: il nastro gli passa sotto
  const pezzi = {
    legno: new Mesh(legno(dati.gruccia), new MeshStandardMaterial({ color: 0x9b6b43, roughness: 0.48, side: DoubleSide })),
    gancio: new Mesh(new TubeGeometry(new CatmullRomCurve3(filo), 90, 0.0021, 8), new MeshStandardMaterial({ color: 0xdcdcdc, metalness: 1, roughness: 0.3 })),
    nastro: new Mesh(nastro(cima), new MeshStandardMaterial({ color: 0xf3ecdf, roughness: 0.85, side: DoubleSide, emissive: 0x9a9384 })),
  };
  // il nastro è fissato in alto: girando la camicia si torce, più in basso che in alto
  const torsione = { value: 0 };
  pezzi.nastro.material.onBeforeCompile = (sh) => {
    sh.uniforms.uTorsione = torsione;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTorsione;')
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        float torce = -uTorsione * smoothstep(${cima.y.toFixed(4)}, ${(cima.y + 2.6).toFixed(4)}, position.y);
        mat2 gira = mat2(cos(torce), -sin(torce), sin(torce), cos(torce));
        objectNormal.xz = gira * objectNormal.xz;`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed.xz = gira * transformed.xz;');
  };
  for (const m of Object.values(pezzi)) { m.frustumCulled = false; gruccia.add(m); gemelloRigido(m); }

  return {
    parete, gruccia, uniformi, gemello,
    cima: cima.y,                       // l'altezza del punto più alto del gancio
    ancora: new Vector3(0, cima.y + 0.75, cima.z),      // dove il nastro è fissato, fuori dall'inquadratura: da lì dondola tutto
    /** Da chiamare a ogni fotogramma, dopo aver mosso il perno: aggiorna e ridisegna l'ombra. */
    disegnaOmbra(perno) {
      uniformi.uPerno.value = perno.matrixWorld;
      torsione.value = perno.rotation.y;
      for (const [m, vero] of gemelli) { m.visible = vero.visible; if (!m.matrixAutoUpdate) m.matrixWorld.copy(vero.matrixWorld); }
      const prima = renderer.getRenderTarget(), colore = renderer.getClearColor(new Color()), alfa = renderer.getClearAlpha();
      renderer.setClearColor(0x000000, 1);
      renderer.setRenderTarget(grezza); renderer.clear(); renderer.render(scenaOmbra, occhio);
      sfuma.uniforms.uT.value = grezza.texture; sfuma.uniforms.uPasso.value.set(2 / LATO_OMBRA, 0);
      renderer.setRenderTarget(mezza); renderer.render(scenaSfuma, occhio);
      sfuma.uniforms.uT.value = mezza.texture; sfuma.uniforms.uPasso.value.set(0, 2 / LATO_OMBRA);
      renderer.setRenderTarget(morbida); renderer.render(scenaSfuma, occhio);
      renderer.setRenderTarget(prima); renderer.setClearColor(colore, alfa);
    },
    libera() { for (const t of [grezza, mezza, morbida]) t.dispose(); },
  };
}
