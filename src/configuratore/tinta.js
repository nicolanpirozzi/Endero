// PROVA (proprietario, 2026-11-26: «Sì, prepara una prova»): il tessuto scelto colora la camicia.
//
// La camicia del sito è un'immagine calcolata da Blender di una camicia bianca: la sua luce è vera (ombre, pieghe,
// riflessi della parete blu). Qui non si ricalcola niente: per ogni punto di stoffa si sa dove sta nel cartamodello
// (la «trama», calcolata con Blender: camicia/opzioni/parti.py trama e trame.py), lì si legge il colore del tessuto
// scelto (il suo campione, ripetuto) e lo si moltiplica per la luce della camicia bianca. Così le righe seguono il
// verso di ogni pezzo (maniche, colletto, polsini) come su una camicia vera, e le ombre restano quelle di Blender.
// Bottoni, gruccia e nastro non cambiano. Lo fa la scheda grafica in un colpo solo, una volta per immagine, quando
// il tessuto cambia: mai a ogni fotogramma. Dove la scheda grafica non c'è, la camicia resta bianca.

const VERTICI = `attribute vec2 p; varying vec2 q; void main() { q = vec2(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5); gl_Position = vec4(p, 0.0, 1.0); }`;
// (niente accenti gravi nei commenti dello shader: chiuderebbero la stringa)
const PUNTI = `#extension GL_EXT_shader_texture_lod : enable
precision highp float;
uniform sampler2D foto, trama, tessera;
uniform vec2 misura, ripeti;
uniform float morbido, fitto, passo;
varying vec2 q;
// dove sta il punto nel cartamodello: xy la posizione, z 1 stoffa, 2 ferro (bottoni, gruccia), 0 niente.
// La trama e larga il doppio: a sinistra la prima coordinata (rosso i bit alti, verde i bassi) e nel blu che cosa c'e,
// a destra la seconda coordinata
vec3 leggi(vec2 i) {
  vec2 d = vec2(0.5 / misura.x, 1.0 / misura.y);
  vec3 a = floor(texture2D(trama, vec2(i.x + 0.5, i.y + 0.5) * d).rgb * 255.0 + 0.5);
  if (a.b < 64.0) return vec3(0.0);
  if (a.b < 164.0) return vec3(0.0, 0.0, 2.0);
  vec3 b = floor(texture2D(trama, vec2(i.x + 0.5 + misura.x, i.y + 0.5) * d).rgb * 255.0 + 0.5);
  // (3: fuori dalla sagoma netta, sul bordo sfumato della foto; la posizione e quella del punto di stoffa piu vicino)
  return vec3((a.r * 256.0 + a.g) / 65535.0, (b.r * 256.0 + b.g) / 65535.0, a.b < 228.0 ? 3.0 : 1.0);
}
void main() {
  vec4 f = texture2D(foto, q);
  vec2 s = q * misura - 0.5, i = floor(s), t = s - i;
  vec3 a = leggi(i), b = leggi(i + vec2(1.0, 0.0)), c = leggi(i + vec2(0.0, 1.0)), d = leggi(i + vec2(1.0, 1.0));
  vec3 n = t.x < 0.5 ? (t.y < 0.5 ? a : c) : (t.y < 0.5 ? b : d);
  if (n.z != 1.0 && n.z != 3.0) { gl_FragColor = vec4(f.rgb * f.a, f.a); return; }
  vec2 uv = n.xy;
  // Quanto sfocato si legge il campione lo si calcola qui, dai quattro punti della trama (quanti punti del campione
  // stanno in un punto dello schermo): le derivate automatiche, dopo un «if», non sono affidabili e sui bordi davano
  // un pulviscolo. A cavallo di una cucitura si prende il punto più vicino, sfocato quanto basta per un tessuto steso
  // di fronte (passo: quanto cartamodello sta in un punto della trama).
  float fine = max(0.0, log2(passo * max(ripeti.x, ripeti.y) * 256.0 / fitto) + morbido + 2.0);
  if (n.z == 3.0) fine = 8.0;      // sul bordo sfumato: il colore medio del tessuto
  if (a.z == 1.0 && b.z == 1.0 && c.z == 1.0 && d.z == 1.0) {
    float salto = max(max(distance(a.xy, b.xy), distance(a.xy, c.xy)), max(distance(d.xy, b.xy), distance(d.xy, c.xy)));
    if (salto < 0.004) {
      uv = mix(mix(a.xy, b.xy, t.x), mix(c.xy, d.xy, t.x), t.y);
      vec2 dx = (b.xy - a.xy) * ripeti * 256.0 / fitto, dy = (c.xy - a.xy) * ripeti * 256.0 / fitto;
      fine = max(0.0, 0.5 * log2(max(dot(dx, dx), dot(dy, dy)) + 1e-12) + morbido);
    }
  }
  vec3 stoffa = pow(texture2DLodEXT(tessera, uv * ripeti, fine).rgb, vec3(2.2));
  // la luce della camicia bianca: quanto e di che colore arriva in quel punto (il bianco in pieno sole vale 0.93)
  vec3 luce = pow(f.rgb, vec3(2.2)) / pow(0.93, 2.2);
  vec3 colore = pow(clamp(stoffa * luce, 0.0, 1.0), vec3(1.0 / 2.2));
  gl_FragColor = vec4(colore * f.a, f.a);
}`;

/** La macchina che tinge: una per pagina. `null` dove la scheda grafica non c'è. */
export function creaTinta() {
  const tela = document.createElement('canvas');
  const gl = tela.getContext('webgl', { premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: false });
  if (!gl || !gl.getExtension('EXT_shader_texture_lod')) return null;
  const pezzo = (tipo, testo) => { const s = gl.createShader(tipo); gl.shaderSource(s, testo); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
  const v = pezzo(gl.VERTEX_SHADER, VERTICI), f = pezzo(gl.FRAGMENT_SHADER, PUNTI);
  if (!v || !f) return null;
  const pr = gl.createProgram();
  gl.attachShader(pr, v); gl.attachShader(pr, f); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
  gl.useProgram(pr);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const dove = gl.getAttribLocation(pr, 'p');
  gl.enableVertexAttribArray(dove); gl.vertexAttribPointer(dove, 2, gl.FLOAT, false, 0, 0);
  // le immagini entrano così come sono: niente conversioni di colore (la trama è fatta di numeri, non di colori)
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  const anis = gl.getExtension('EXT_texture_filter_anisotropic');
  const massimo = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  const carica = (posto, sorgente, { ripete = null, netta = false } = {}) => {
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + posto); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sorgente);
    if (ripete) {
      // il campione: si ripete (a specchio dove non ha un passo suo) e si rimpicciolisce bene (da lontano le righe sottili diventano il loro colore medio)
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, ripete[0] ? gl.MIRRORED_REPEAT : gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, ripete[1] ? gl.MIRRORED_REPEAT : gl.REPEAT);
      if (anis) gl.texParameterf(gl.TEXTURE_2D, anis.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(anis.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, netta ? gl.NEAREST : gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, netta ? gl.NEAREST : gl.LINEAR);
    return t;
  };
  const u = (nome) => gl.getUniformLocation(pr, nome);
  gl.uniform1i(u('foto'), 0); gl.uniform1i(u('trama'), 1); gl.uniform1i(u('tessera'), 2);
  let perso = false;
  tela.addEventListener('webglcontextlost', (e) => { e.preventDefault(); perso = true; });

  /**
   * Tinge un'immagine della camicia bianca (o un suo pezzo).
   * @param {CanvasImageSource} foto     l'immagine bianca (con la sua trasparenza, se ne ha)
   * @param {HTMLImageElement} trama     la sua trama: stessa zona del fotogramma, qualunque grandezza
   * @param {HTMLImageElement} tessera   il campione ripetibile del tessuto
   * @param {object} t                   { cm: [largo, alto] della tessera, specchio: [x, y], alMetro: metri per unità del
   *                                     cartamodello, alMetroSchermo: punti della trama per metro di camicia }
   * @returns {HTMLCanvasElement|null}   una tela nuova, grande quanto la foto; null se non si può
   */
  return function tingi(foto, trama, tessera, t) {
    const w = foto.naturalWidth || foto.width, h = foto.naturalHeight || foto.height;
    if (perso || !w || !h || w > massimo || h > massimo) return null;
    tela.width = w; tela.height = h;
    gl.viewport(0, 0, w, h);
    const usate = [carica(0, foto), carica(1, trama, { netta: true }), carica(2, tessera, { ripete: t.specchio || [true, true] })];
    gl.uniform2f(u('misura'), trama.naturalWidth / 2, trama.naturalHeight);
    // un filo più morbido del necessario: le righe finissime, rimpicciolite dallo schermo, non fanno onde
    gl.uniform1f(u('morbido'), 0.7);
    gl.uniform1f(u('fitto'), w / (trama.naturalWidth / 2));
    gl.uniform1f(u('passo'), 1 / (t.alMetroSchermo * t.alMetro));
    gl.uniform2f(u('ripeti'), (t.alMetro * 100) / t.cm[0], (t.alMetro * 100) / t.cm[1]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    // la si copia subito su una tela sua: quella della scheda grafica serve alla prossima
    const copia = document.createElement('canvas');
    copia.width = w; copia.height = h;
    copia.getContext('2d').drawImage(tela, 0, 0);
    for (const x of usate) gl.deleteTexture(x);
    return copia;
  };
}
