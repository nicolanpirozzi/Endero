// Il tessuto scelto colora la camicia (proprietario, 2026-11-26; docs/direzione-creativa.md, punto 16).
//
// La camicia del sito è un'immagine calcolata da Blender di una camicia bianca: la sua luce è vera (ombre, pieghe,
// riflessi della parete blu). Qui non si ricalcola niente: per ogni punto di stoffa si sa dove sta nel cartamodello
// (la «trama», calcolata con Blender: camicia/opzioni/parti.py trama e trame.py), lì si legge il colore del tessuto
// scelto (il suo campione, ripetuto) e lo si moltiplica per la luce della camicia bianca. Così le righe seguono il
// verso di ogni pezzo (maniche, colletto, polsini) come su una camicia vera, e le ombre restano quelle di Blender.
// Bottoni, gruccia e nastro non cambiano. Polsini e taschino possono avere un tessuto loro. Dove c'è stoffa, e di
// quale zona, lo dice la «maschera», grande quanto la foto: i bordi sono netti.
//
// La camicia si tinge tutta insieme, in un colpo: prima si compone la trama della camicia com'è adesso (quella di
// base, con sopra i riquadri del collo scelto e del taschino), poi la scheda grafica tinge la foto composta allo
// stesso modo. Una volta per cambio di scelta, mai a ogni fotogramma. Dove la scheda grafica non c'è, la camicia
// resta bianca.

const VERTICI = `attribute vec2 p; uniform vec4 dove, da; varying vec2 q;
void main() { q = da.xy + p * da.zw; gl_Position = vec4(dove.xy + p * dove.zw, 0.0, 1.0); }`;
// copia un pezzo di immagine così com'è (per comporre la trama: lì i colori sono numeri, non si sfumano)
const COPIA = `precision mediump float; uniform sampler2D foto; varying vec2 q; void main() { gl_FragColor = texture2D(foto, q); }`;
// (niente accenti gravi nei commenti dello shader: chiuderebbero la stringa)
const TINGE = `#extension GL_EXT_shader_texture_lod : enable
precision highp float;
uniform sampler2D foto, trama, maschera, t0, t1, t2;
uniform vec2 misura, r0, r1, r2;
uniform float morbido, fitto, passo, mezzo;
varying vec2 q;
// Un punto della trama: xy dove sta nel cartamodello, z se la posizione c'e (0 no, 1 vera, 3 presa in prestito dal
// punto buono piu vicino: contorni, cuciture, risvolti stretti; vale come una vera). La trama e larga il
// doppio: a sinistra la prima coordinata (rosso i bit alti, verde i bassi) e nel blu se c'e; a destra la seconda
vec3 leggi(vec2 i) {
  vec2 d = vec2(0.5 / misura.x, 1.0 / misura.y);
  vec2 c = clamp(i, vec2(0.0), misura - 1.0);
  vec3 a = floor(texture2D(trama, vec2(c.x + 0.5, c.y + 0.5) * d).rgb * 255.0 + 0.5);
  if (a.b < 100.0) return vec3(0.0);
  vec3 b = floor(texture2D(trama, vec2(c.x + 0.5 + misura.x, c.y + 0.5) * d).rgb * 255.0 + 0.5);
  return vec3((a.r * 256.0 + a.g) / 65535.0, (b.r * 256.0 + b.g) / 65535.0, a.b < 228.0 ? 3.0 : 1.0);
}
// due punti stanno sulla stessa stoffa: posizioni vicine nel cartamodello (a cavallo di una cucitura no)
float stessa(vec3 m, vec3 n) {
  return (m.z * n.z > 0.0 && max(abs(m.x - n.x), abs(m.y - n.y)) < 0.02) ? 1.0 : 0.0;
}
// il colore (lineare) di un campione in un punto del cartamodello: quanto sfocato lo dice quanto cambia la posizione
// da un punto dello schermo al vicino (da lontano le righe sottili diventano il loro colore medio)
vec3 campione(sampler2D t, vec2 rip, vec2 uv, vec2 dx, vec2 dy, float orlo, float prestito) {
  vec2 ex = dx * rip * 256.0 / fitto, ey = dy * rip * 256.0 / fitto;
  // (mai piu nitido della stoffa stesa di fronte; oltre la sagoma, dove la foto sfuma nella parete, appena piu morbido.
  // Fino al 26 novembre li e lungo le cuciture si leggeva il colore medio del tessuto: su un rigato contrastato
  // veniva un profilo rosa tutto intorno. Ora il disegno prosegue fino al bordo: vedi impacchetta in trame.py)
  float piano = passo * max(rip.x, rip.y) * 256.0 / fitto;
  float fine = max(0.0, 0.5 * log2(max(max(dot(ex, ex), dot(ey, ey)), piano * piano) + 1e-12) + morbido);
  fine = max(fine, mix(0.0, 1.5, orlo));
  // Dove la posizione e presa in prestito (contorni, cuciture) e la stessa per due o tre punti di fila: un disegno
  // piu fine di cosi li darebbe un colore a caso per ogni punto (puntini lungo le cuciture). Li si legge sfocato di
  // tre punti: le righe larghe restano righe, i microdisegni diventano il loro colore
  fine = max(fine, 0.5 * log2(piano * piano + 1e-12) + morbido + 1.6 * prestito);
  // (la seconda coordinata del cartamodello cresce verso l'alto, le righe del campione verso il basso)
  return pow(texture2DLodEXT(t, vec2(uv.x, -uv.y) * rip, fine).rgb, vec3(2.2));
}
// Il colore (lineare) della stoffa del gruppo del punto k, che sta in pk: la posizione e la media pesata dei punti del
// gruppo fra i quattro intorno (pesi w); zone dice quanto di ogni campione (corpo, polsini, taschino)
vec3 stoffaDi(vec3 k, vec2 pk, vec3 a, vec3 b, vec3 c, vec3 d, vec4 w, vec3 zone, float orlo) {
  float ma = w.x * stessa(k, a), mb = w.y * stessa(k, b), mc = w.z * stessa(k, c), md = w.w * stessa(k, d);
  float tutti = max(ma + mb + mc + md, 1e-6);
  vec2 uv = (a.xy * ma + b.xy * mb + c.xy * mc + d.xy * md) / tutti;
  // Di quanto cambia la posizione da un punto al vicino: si misura sul punto scelto, verso il vicino che sta sulla sua
  // stessa stoffa, da una parte o dall'altra. Se non ne ha (una striscia larga un punto solo: un bordo di colletto
  // visto di taglio) li si legge il colore medio: ogni punto prenderebbe una riga a caso, e verrebbe un pulviscolo
  vec3 xp = leggi(pk + vec2(1.0, 0.0)), xm = leggi(pk - vec2(1.0, 0.0)), yp = leggi(pk + vec2(0.0, 1.0)), ym = leggi(pk - vec2(0.0, 1.0));
  vec2 dx = stessa(k, xp) > 0.0 ? xp.xy - k.xy : (stessa(k, xm) > 0.0 ? k.xy - xm.xy : vec2(0.04, 0.0));
  vec2 dy = stessa(k, yp) > 0.0 ? yp.xy - k.xy : (stessa(k, ym) > 0.0 ? k.xy - ym.xy : vec2(0.0, 0.04));
  float prestate = (ma * float(a.z == 3.0) + mb * float(b.z == 3.0) + mc * float(c.z == 3.0) + md * float(d.z == 3.0)) / tutti;
  vec3 colore = vec3(0.0);
  if (zone.x > 0.002) colore += zone.x * campione(t0, r0, uv, dx, dy, orlo, prestate);
  if (zone.y > 0.002) colore += zone.y * campione(t1, r1, uv, dx, dy, orlo, prestate);
  if (zone.z > 0.002) colore += zone.z * campione(t2, r2, uv, dx, dy, orlo, prestate);
  return colore;
}
void main() {
  vec4 f = texture2D(foto, q);
  // La maschera, grande quanto la foto e larga il doppio di se: a sinistra dove c'e stoffa (rosso), il suo bordo
  // vicino (verde) e quello lontano (blu, che vale solo dove la foto e sfumata: il contorno della camicia
  // ritagliata, non la parete dipinta da un collo piu piccolo); a destra le zone (rosso i polsini, verde il taschino).
  // Letta sfumata: il bordo di un bottone, della gruccia, di un polsino di un altro tessuto e netto e senza scalini
  float mx = clamp(q.x, mezzo, 1.0 - mezzo) * 0.5;
  vec3 mc = texture2D(maschera, vec2(mx, q.y)).rgb, mz = texture2D(maschera, vec2(mx + 0.5, q.y)).rgb;
  float lontano = f.a < 0.98 ? mc.b : 0.0;
  // Un collo piu piccolo (coreano, diplomatico) dipinge la parete dove quello di base non c'e piu: li la foto non e
  // camicia, e tingerla darebbe una riga quasi nera lungo le spalle. La parete si riconosce dal suo blu pieno (la
  // camicia bianca, anche in ombra, non e mai cosi satura)
  float parete = smoothstep(0.58, 0.70, (f.b - f.r) / max(f.b, 0.02));
  float copre = (mc.r + mc.g + lontano) * (1.0 - parete);
  vec2 s = q * misura - 0.5, i = floor(s), t = s - i;
  vec3 a = leggi(i), b = leggi(i + vec2(1.0, 0.0)), c = leggi(i + vec2(0.0, 1.0)), d = leggi(i + vec2(1.0, 1.0));
  vec4 w = vec4((1.0 - t.x) * (1.0 - t.y), t.x * (1.0 - t.y), (1.0 - t.x) * t.y, t.x * t.y);
  // Dei quattro punti intorno, i gruppi (quelli sulla stessa stoffa: a cavallo di una cucitura sono due) pesano
  // ciascuno la sua parte. Vale il colore del gruppo piu pesante, sfumato con quello del secondo dove i due si
  // equivalgono: una cucitura e una linea netta e morbida, senza colori presi a meta strada fra due pezzi
  float ga = a.z > 0.0 ? w.x + w.y * stessa(a, b) + w.z * stessa(a, c) + w.w * stessa(a, d) : -1.0;
  float gb = b.z > 0.0 ? w.y + w.x * stessa(b, a) + w.z * stessa(b, c) + w.w * stessa(b, d) : -1.0;
  float gc = c.z > 0.0 ? w.z + w.x * stessa(c, a) + w.y * stessa(c, b) + w.w * stessa(c, d) : -1.0;
  float gd = d.z > 0.0 ? w.w + w.x * stessa(d, a) + w.y * stessa(d, b) + w.z * stessa(d, c) : -1.0;
  vec3 k = a; float g = ga; vec2 pk = i;
  if (gb > g) { k = b; g = gb; pk = i + vec2(1.0, 0.0); }
  if (gc > g) { k = c; g = gc; pk = i + vec2(0.0, 1.0); }
  if (gd > g) { k = d; g = gd; pk = i + vec2(1.0, 1.0); }
  if (copre < 0.004 || g < 0.0) { gl_FragColor = vec4(f.rgb * f.a, f.a); return; }
  // il secondo gruppo: il piu pesante fra i punti che non stanno nel primo
  vec3 k2 = k; float g2 = 0.0; vec2 pk2 = pk;
  if (ga > g2 && stessa(k, a) == 0.0) { k2 = a; g2 = ga; pk2 = i; }
  if (gb > g2 && stessa(k, b) == 0.0) { k2 = b; g2 = gb; pk2 = i + vec2(1.0, 0.0); }
  if (gc > g2 && stessa(k, c) == 0.0) { k2 = c; g2 = gc; pk2 = i + vec2(0.0, 1.0); }
  if (gd > g2 && stessa(k, d) == 0.0) { k2 = d; g2 = gd; pk2 = i + vec2(1.0, 1.0); }
  // quanto di ogni zona, e quanto si e sul bordo
  float tutta = max(mc.r + mc.g + mc.b, 1e-4);
  float polsini = clamp(mz.r / tutta, 0.0, 1.0), taschino = clamp(mz.g / tutta, 0.0, 1.0 - polsini);
  vec3 zone = vec3(1.0 - polsini - taschino, polsini, taschino);
  float orlo = clamp((mc.g + mc.b) / tutta, 0.0, 1.0);
  vec3 stoffa = stoffaDi(k, pk, a, b, c, d, w, zone, orlo);
  if (g2 > 0.0) stoffa = mix(stoffaDi(k2, pk2, a, b, c, d, w, zone, orlo), stoffa, smoothstep(0.3, 0.7, g / (g + g2)));
  // la luce della camicia bianca: quanto e di che colore arriva in quel punto (il bianco in pieno sole vale 0.93)
  vec3 luce = pow(f.rgb, vec3(2.2)) / pow(0.93, 2.2);
  vec3 colore = pow(clamp(stoffa * luce, 0.0, 1.0), vec3(1.0 / 2.2));
  gl_FragColor = vec4(mix(f.rgb, colore, clamp(copre, 0.0, 1.0)) * f.a, f.a);
}`;

/** Il bianco della camicia calcolata: un «tessuto» che la lascia com'è (per le zone senza un tessuto scelto). */
const BIANCO = 237;

/**
 * La macchina che tinge: una per pagina. `null` dove la scheda grafica non c'è o non basta (allora il suo contesto si
 * rilascia subito: i browser ne tengono pochi, e quello del tessuto che ondeggia non deve farne le spese). La funzione
 * che restituisce ha `persa()`: vero quando la scheda grafica se l'è ripresa (telefono in secondo piano, memoria
 * finita); allora chi la usa ne crea un'altra.
 */
export function creaTinta() {
  const tela = document.createElement('canvas');
  const gl = tela.getContext('webgl', { premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: false });
  if (!gl) return null;
  const rinuncia = () => { gl.getExtension('WEBGL_lose_context')?.loseContext(); tela.width = tela.height = 0; return null; };
  if (!gl.getExtension('EXT_shader_texture_lod')) return rinuncia();
  const pezzo = (tipo, testo) => { const s = gl.createShader(tipo); gl.shaderSource(s, testo); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
  const programma = (punti) => {
    const v = pezzo(gl.VERTEX_SHADER, VERTICI), f = pezzo(gl.FRAGMENT_SHADER, punti);
    if (!v || !f) return null;
    const pr = gl.createProgram();
    gl.attachShader(pr, v); gl.attachShader(pr, f); gl.bindAttribLocation(pr, 0, 'p'); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
    const u = {};
    return { pr, u: (nome) => (u[nome] ||= gl.getUniformLocation(pr, nome)) };
  };
  const copia = programma(COPIA), tinge = programma(TINGE);
  if (!copia || !tinge) return rinuncia();
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  // le immagini entrano così come sono: niente conversioni di colore (la trama è fatta di numeri, non di colori)
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
  const anis = gl.getExtension('EXT_texture_filter_anisotropic');
  const massimo = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  /** Una texture da un'immagine o da una tela. `ripete`: null (non si ripete), 'specchio' o 'uguale'. */
  const carica = (posto, sorgente, { ripete = null, netta = false } = {}) => {
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + posto); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sorgente);
    if (ripete) {
      // il campione: si ripete (a specchio se non ha un verso) e si rimpicciolisce bene (da lontano le righe sottili diventano il loro colore medio)
      const modo = ripete === 'specchio' ? gl.MIRRORED_REPEAT : gl.REPEAT;
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, modo); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, modo);
      if (anis) gl.texParameterf(gl.TEXTURE_2D, anis.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(anis.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, netta ? gl.NEAREST : gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, netta ? gl.NEAREST : gl.LINEAR);
    return t;
  };
  // (un contesto perso non si aspetta che torni: programmi e immagini andrebbero rifatti tutti. Se ne crea uno nuovo)
  let perso = false;
  tela.addEventListener('webglcontextlost', () => { perso = true; });

  // --- la trama e la maschera composte: quelle di base con sopra i riquadri del collo e del taschino. Stanno
  // ciascuna in una texture sua, e si rifanno solo quando cambiano i pezzi
  const telaio = gl.createFramebuffer();
  const nuova = (posto, morbida) => ({ tex: gl.createTexture(), posto, morbida, larga: 0, alta: 0, chiave: null });   // (chiave null: mai composta; '' è la camicia di base)
  const tramaC = nuova(1, false), mascheraC = nuova(5, true);
  /** Compone in `C` l'immagine `base` (larga il doppio) con sopra i `pezzi` [{ img, x, y }] (larghi il doppio, in punti di `base`). */
  function componi(C, chiave, base, pezzi) {
    if (chiave === C.chiave) return true;
    const w2 = base.naturalWidth, h = base.naturalHeight, w = w2 / 2;
    if (!w2 || w2 > massimo || h > massimo) return false;
    gl.activeTexture(gl.TEXTURE0 + C.posto); gl.bindTexture(gl.TEXTURE_2D, C.tex);
    if (w2 !== C.larga || h !== C.alta) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w2, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      const filtro = C.morbida ? gl.LINEAR : gl.NEAREST;
      for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, filtro], [gl.TEXTURE_MAG_FILTER, filtro], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
      C.larga = w2; C.alta = h;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, telaio);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, C.tex, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) { gl.bindFramebuffer(gl.FRAMEBUFFER, null); return false; }
    gl.viewport(0, 0, w2, h);
    gl.useProgram(copia.pr);
    gl.uniform1i(copia.u('foto'), 0);
    // un rettangolo della sorgente (in frazioni) in un rettangolo della tela composta (in punti): la riga 0 resta la riga 0
    const metti = (sx, x, y, lw, lh) => {
      gl.uniform4f(copia.u('da'), sx, 0, lw === w2 ? 1 : 0.5, 1);
      gl.uniform4f(copia.u('dove'), (2 * x) / w2 - 1, (2 * y) / h - 1, (2 * lw) / w2, (2 * lh) / h);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    const usate = [carica(0, base, { netta: true })];
    metti(0, 0, 0, w2, h);
    for (const pz of pezzi) {
      const pw = pz.img.naturalWidth / 2, ph = pz.img.naturalHeight;
      usate.push(carica(0, pz.img, { netta: true }));
      // la metà di sinistra e quella di destra vanno ciascuna nella sua metà
      metti(0, pz.x, pz.y, pw, ph);
      metti(0.5, w + pz.x, pz.y, pw, ph);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    for (const x of usate) gl.deleteTexture(x);
    C.chiave = chiave;
    return true;
  }

  // il bianco della camicia, per le zone senza tessuto
  const bianca = document.createElement('canvas');
  bianca.width = bianca.height = 1;
  { const g = bianca.getContext('2d'); g.fillStyle = `rgb(${BIANCO},${BIANCO},${BIANCO})`; g.fillRect(0, 0, 1, 1); }

  /**
   * Tinge la camicia.
   * @param {object} o
   * @param {CanvasImageSource} o.foto     la camicia bianca composta (con il collo e il taschino scelti), ritagliata
   * @param {string} o.chiave              cambia quando cambiano i pezzi della trama
   * @param {HTMLImageElement} o.base      la trama di base (trama-base.png)
   * @param {HTMLImageElement} o.maschera  la maschera di base (maschera-base.png, grande il doppio della trama)
   * @param {Array} o.pezzi                [{ img, maschera, x, y }]: i riquadri da metterle sopra, in punti della trama
   * @param {Array} o.tessere              tre voci, per corpo, polsini e taschino: { img, cm: [largo, alto], specchio } o null (bianco)
   * @param {number} o.alMetroUv           metri di stoffa per unità del cartamodello
   * @param {number} o.alMetro             punti della trama per metro di camicia (stesa di fronte)
   * @returns {HTMLCanvasElement|null}     una tela nuova, grande quanto la foto; null se non si può
   */
  function tingi({ foto, chiave, base, maschera, pezzi, tessere, alMetroUv, alMetro }) {
    const w = foto.naturalWidth || foto.width, h = foto.naturalHeight || foto.height;
    if (perso || gl.isContextLost() || !w || !h || w > massimo || h > massimo) return null;
    if (!componi(tramaC, chiave, base, pezzi) || !componi(mascheraC, chiave, maschera, pezzi.map((p) => ({ img: p.maschera, x: p.x * 2, y: p.y * 2 })))) return null;
    tela.width = w; tela.height = h;
    gl.viewport(0, 0, w, h);
    gl.useProgram(tinge.pr);
    const usate = [carica(0, foto)];
    gl.activeTexture(gl.TEXTURE0 + 1); gl.bindTexture(gl.TEXTURE_2D, tramaC.tex);
    gl.activeTexture(gl.TEXTURE0 + 5); gl.bindTexture(gl.TEXTURE_2D, mascheraC.tex);
    gl.uniform1i(tinge.u('foto'), 0); gl.uniform1i(tinge.u('trama'), 1); gl.uniform1i(tinge.u('maschera'), 5);
    tessere.forEach((t, k) => {
      usate.push(carica(2 + k, t ? t.img : bianca, { ripete: t && !t.specchio ? 'uguale' : 'specchio' }));
      gl.uniform1i(tinge.u('t' + k), 2 + k);
      const cm = t ? t.cm : [1, 1];
      gl.uniform2f(tinge.u('r' + k), (alMetroUv * 100) / cm[0], (alMetroUv * 100) / cm[1]);
    });
    gl.uniform2f(tinge.u('misura'), tramaC.larga / 2, tramaC.alta);
    gl.uniform1f(tinge.u('mezzo'), 1 / mascheraC.larga);            // mezzo punto della maschera (che è larga il doppio)
    // un filo più morbido del necessario: le righe finissime, rimpicciolite dallo schermo, non fanno onde
    gl.uniform1f(tinge.u('morbido'), 0.6);
    gl.uniform1f(tinge.u('fitto'), w / (tramaC.larga / 2));
    gl.uniform1f(tinge.u('passo'), 1 / (alMetro * alMetroUv));
    gl.uniform4f(tinge.u('da'), 0, 0, 1, 1);
    gl.uniform4f(tinge.u('dove'), -1, 1, 2, -2);               // la riga 0 della foto in cima alla tela
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    // la si copia subito su una tela sua: quella della scheda grafica serve alla prossima
    const esce = document.createElement('canvas');
    esce.width = w; esce.height = h;
    esce.getContext('2d').drawImage(tela, 0, 0);
    for (const x of usate) gl.deleteTexture(x);
    if (perso || gl.isContextLost()) { esce.width = esce.height = 0; return null; }
    return esce;
  }
  tingi.persa = () => perso || gl.isContextLost();
  return tingi;
}
