"""Scena 3D dell'apertura "La cucitura": tessuto blu, ricami, testa in acciaio, luci e camere.

Si usa con il modulo Python di Blender (`pip install bpy`), senza interfaccia:

    python film/scena.py --vista macro --s 6.8 --out prova.png
    python film/scena.py --vista alto  --s 26.9 --out prova.png
    python film/scena.py --vista logo  --logo 0.8 --out prova.png

Unità: metri. Il tessuto è fermo sul piano z = 0; la macchina avanza verso Y negativo.
Il parametro `s` è l'avanzamento in punti di cucitura (può avere decimali: la parte
decimale è la fase del ciclo dell'ago, 0 = ago in alto, 0.5 = ago in basso).
"""
import argparse
import math
import os
import sys

import bpy  # per primo: prepara i percorsi degli altri moduli di Blender
import bmesh  # noqa: E402
import numpy as np
from mathutils import Matrix, Vector  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import geometria as G  # noqa: E402

MM = 0.001
QUI = os.path.dirname(os.path.abspath(__file__))
RADICE = os.path.dirname(QUI)
CACHE = os.environ.get("ENDERO_FILM_CACHE", os.path.join(QUI, ".cache"))

# ------------------------------------------------------------------ misure della scena
PASSO = 3.5 * MM            # lunghezza del punto della cucitura
R_CUC = 0.27 * MM           # raggio del filo della cucitura
R_RIC = 0.175 * MM          # raggio del filo da ricamo
PASSO_RIC = 0.36 * MM       # distanza tra le file del ricamo
BLU = (0.0020, 0.0128, 0.0840)      # blu scuro del tessuto, in lineare: tarato perché in luce renda circa come il #0f285e del logo

# Vista dall'alto: camera dal lato di chi cuce, inclinata e senza prospettiva. La macchina resta in piedi,
# la cucitura corre in verticale. Inclinando la camera il tessuto appare schiacciato in verticale di
# sin(elevazione): logo e cifre sono ricamati più alti di altrettanto, così sullo schermo hanno le proporzioni giuste.
ELEV = 58.0
KY = 1.0 / math.sin(math.radians(ELEV))
VISTA_LARG = 0.16           # larghezza inquadrata
AGO_A = 0.64                # l'ago sta al 64 % dell'altezza dello schermo: sopra si vede la cucitura finita
MARGINE_TESTI = 13 * MM     # distanza tra la cucitura e le scritte ricamate
INTERLINEA = 3.6 * MM
CAPITOLI = [                # scritte ricamate: lato, y della prima linea di base, righe (testo, altezza delle maiuscole)
    {"lato": "sx", "y": -0.090, "righe": [("1996", 13 * MM)]},
    {"lato": "dx", "y": -0.185, "righe": [("1,3", 13 * MM), ("MILIONI", 6.2 * MM)]},
    {"lato": "sx", "y": -0.280, "righe": [("2.500", 12.5 * MM)]},
    {"lato": "dx", "y": -0.375, "righe": [("ITALIA", 10 * MM)]},
]
LOGO_LARG = 0.092           # larghezza del logo
LOGO_Y = -0.500
FINE_CUCITURA = LOGO_Y + KY * LOGO_LARG * (119.3 / 207.8) / 2 + 7 * MM      # la cucitura dritta finisce poco sopra il logo

# zona del tessuto modellata fitta (quella che si vede da vicino)
FITTO = (-0.118, 0.118, -0.66, 0.085)       # x0, x1, y0, y1


# ------------------------------------------------------------------ rilievo del tessuto
def _pieghe(seme=11):
    """Pieghe morbide sparse lungo il tessuto: (cx, cy, angolo, larghezza, altezza, lunghezza)."""
    rng = np.random.default_rng(seme)
    out, y = [], 0.06
    while y > -0.70:
        lato = rng.choice([-1, 1])
        out.append((lato * rng.uniform(0.038, 0.090), y, math.radians(rng.uniform(22, 68)) * rng.choice([-1, 1]),
                    rng.uniform(0.0065, 0.0115), rng.uniform(1.3, 2.9) * MM * rng.choice([1.0, 1.0, -0.55]), rng.uniform(0.045, 0.085)))
        y -= rng.uniform(0.030, 0.055)
    return out


PIEGHE = _pieghe()
RILIEVO = None      # rilievo attorno ai ricami: si imposta in `costruisci`


class RilievoRicami:
    """Il ricamo tira il tessuto: sotto i fili il tessuto si abbassa, appena fuori dal bordo si alza in un piccolo cordolo."""

    def __init__(self, forme, passo=0.25 * MM, affondo=0.20 * MM, cordolo=0.30 * MM):
        from PIL import Image, ImageDraw, ImageFilter
        x0, x1, y0, y1 = FITTO
        self.x0, self.y0, self.passo = x0, y0, passo
        nx, ny = int((x1 - x0) / passo), int((y1 - y0) / passo)
        img = Image.new("L", (nx, ny), 0)
        dr = ImageDraw.Draw(img)
        px = lambda c: [((x - x0) / passo, (y - y0) / passo) for x, y in c]
        for forma in forme:
            for poli in G.parti(forma):
                dr.polygon(px(poli.exterior.coords), fill=255)
                for buco in poli.interiors:
                    dr.polygon(px(buco.coords), fill=0)
        stretta = np.asarray(img.filter(ImageFilter.GaussianBlur(0.45 * MM / passo)), np.float32) / 255.0
        larga = np.asarray(img.filter(ImageFilter.GaussianBlur(1.5 * MM / passo)), np.float32) / 255.0
        self.mappa = -affondo * stretta + cordolo * np.clip(larga - stretta, 0, 1) * 1.8

    def valuta(self, x, y):
        fx = (np.asarray(x, float) - self.x0) / self.passo
        fy = (np.asarray(y, float) - self.y0) / self.passo
        ny, nx = self.mappa.shape
        dentro = (fx >= 0) & (fx < nx - 1) & (fy >= 0) & (fy < ny - 1)
        ix = np.clip(np.floor(fx).astype(int), 0, nx - 2)
        iy = np.clip(np.floor(fy).astype(int), 0, ny - 2)
        ax, ay = fx - ix, fy - iy
        m = self.mappa
        v = (m[iy, ix] * (1 - ax) * (1 - ay) + m[iy, ix + 1] * ax * (1 - ay) + m[iy + 1, ix] * (1 - ax) * ay + m[iy + 1, ix + 1] * ax * ay)
        return np.where(dentro, v, 0.0)


def quota(x, y):
    """Altezza del tessuto in ogni punto: pieghe morbide, grinze lungo la cucitura, rilievo attorno ai ricami."""
    x, y = np.asarray(x, float), np.asarray(y, float)
    ax = np.abs(x)
    largo = np.clip((ax - 0.016) / 0.030, 0, 1)
    largo = largo * largo * (3 - 2 * largo)                      # il tessuto è tenuto piatto sotto il piedino
    z = np.zeros(np.broadcast(x, y).shape)
    for cx, cy, ang, larg, alt, lung in PIEGHE:
        ca, sa = math.cos(ang), math.sin(ang)
        trasv = -(x - cx) * sa + (y - cy) * ca
        longit = (x - cx) * ca + (y - cy) * sa
        z = z + alt * np.exp(-0.5 * (trasv / larg) ** 2) * np.exp(-0.5 * (longit / lung) ** 2)
    z = z * largo
    # il filo tira: piccole grinze di traverso alla cucitura, che si spengono in pochi millimetri
    cucito = (y <= 0.002) & (y >= FINE_CUCITURA - 0.002)
    z = z + np.where(cucito, 0.20 * MM * np.exp(-ax / (4.5 * MM)) * np.cos(2 * np.pi * y / (2 * PASSO)) * np.clip(ax / (0.8 * MM), 0, 1), 0.0)
    if RILIEVO is not None:
        z = z + RILIEVO.valuta(x, y)
    return z


# ------------------------------------------------------------------ movimento della macchina
def liscio(u):
    u = min(1.0, max(0.0, u))
    return u * u * (3 - 2 * u)


def punta_ago(s):
    """Altezza della punta dell'ago sopra il tessuto."""
    return 4 * MM + 10 * MM * math.cos(2 * math.pi * s)


def y_macchina(s):
    """Posizione della macchina lungo Y: ferma mentre l'ago è nel tessuto, avanza mentre è fuori."""
    q = s - 0.25
    k = math.floor(q)
    f = q - k
    if f < 0.5:
        return -PASSO * k
    return -PASSO * (k + liscio((f - 0.5) / 0.5))


def punti_fatti(s):
    """Quanti punti della cucitura sono già chiusi."""
    return max(0, math.floor(s - 0.45))


# ------------------------------------------------------------------ utilità per le mesh
def mesh_da_array(nome, vert, facce, uv=None):
    vert, facce = np.asarray(vert, np.float32), np.asarray(facce, np.int32)
    me = bpy.data.meshes.new(nome)
    nf, lati = facce.shape
    me.vertices.add(len(vert))
    me.vertices.foreach_set("co", vert.ravel())
    me.loops.add(nf * lati)
    me.loops.foreach_set("vertex_index", facce.ravel())
    me.polygons.add(nf)
    me.polygons.foreach_set("loop_start", np.arange(0, nf * lati, lati, dtype=np.int32))
    try:
        me.polygons.foreach_set("loop_total", np.full(nf, lati, dtype=np.int32))
    except Exception:
        pass        # nelle versioni recenti basta l'inizio di ogni faccia
    me.update(calc_edges=True)
    if len(me.polygons) != nf or me.polygons[0].loop_total != lati:
        bpy.data.meshes.remove(me)
        me = bpy.data.meshes.new(nome)
        me.from_pydata(vert.tolist(), [], facce.tolist())
        me.update()
    if uv is not None:
        strato = me.uv_layers.new(name="UVMap")
        strato.data.foreach_set("uv", np.asarray(uv, np.float32).ravel())
    me.polygons.foreach_set("use_smooth", np.ones(len(me.polygons), bool))
    return me


def oggetto(nome, me, mat=None, genitore=None):
    ob = bpy.data.objects.new(nome, me)
    bpy.context.scene.collection.objects.link(ob)
    if mat is not None:
        ob.data.materials.append(mat)
    if genitore is not None:
        ob.parent = genitore
    return ob


def _rivoluzione(profilo, lati):
    prof = np.array(profilo, float)
    a = np.linspace(0, 2 * np.pi, lati, endpoint=False)
    anelli = np.stack([prof[:, 0:1] * np.cos(a)[None, :], prof[:, 0:1] * np.sin(a)[None, :],
                       np.broadcast_to(prof[:, 1:2], (len(prof), lati))], axis=-1)
    n = len(prof)
    i = np.arange(n - 1)[:, None]
    j = np.arange(lati)[None, :]
    j2 = (j + 1) % lati
    facce = np.stack([i * lati + j, i * lati + j2, (i + 1) * lati + j2, (i + 1) * lati + j], axis=-1).reshape(-1, 4)
    return anelli.reshape(-1, 3), facce


def tornio(nome, profilo, lati=48, mat=None, genitore=None, asse="Z"):
    """Solido di rivoluzione da un profilo [(raggio, quota), ...], con gli spigoli vivi."""
    vert, facce = _rivoluzione(profilo, lati)
    if asse == "X":
        vert = vert[:, [2, 0, 1]]
    me = mesh_da_array(nome, vert, facce)
    if hasattr(me, "set_sharp_from_angle"):
        me.set_sharp_from_angle(angle=math.radians(32))          # smussi e gradini restano netti, come nel metallo lavorato
    return oggetto(nome, me, mat, genitore)


def scatola(nome, dim, smusso=0.4 * MM, tagli_y=0, mat=None, genitore=None, piega=None):
    """Parallelepipedo con spigoli smussati. `piega(co)` può deformare i vertici dopo lo smusso."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= dim[0]
        v.co.y *= dim[1]
        v.co.z *= dim[2]
    for k in range(1, tagli_y + 1):
        yk = -dim[1] / 2 + dim[1] * k / (tagli_y + 1)
        bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, yk, 0), plane_no=(0, 1, 0))
    if smusso > 0:
        spigoli = [e for e in bm.edges if len(e.link_faces) == 2 and e.calc_face_angle(0) > 0.5]
        bmesh.ops.bevel(bm, geom=spigoli, offset=smusso, segments=3, profile=0.5, affect="EDGES")
    if piega is not None:
        for v in bm.verts:
            piega(v.co)
    me = bpy.data.meshes.new(nome)
    bm.to_mesh(me)
    bm.free()
    me.polygons.foreach_set("use_smooth", np.ones(len(me.polygons), bool))
    ob = oggetto(nome, me, mat, genitore)
    ob.modifiers.new("normali", "WEIGHTED_NORMAL")
    return ob


# ------------------------------------------------------------------ immagini generate
def immagine(nome, arr, non_colore=True):
    """Salva un array (h, w) o (h, w, 3) come EXR nella cartella di lavoro e lo carica in Blender."""
    arr = np.asarray(arr, np.float32)
    if arr.ndim == 2:
        arr = np.repeat(arr[..., None], 3, axis=2)
    h, w, _ = arr.shape
    rgba = np.concatenate([arr, np.ones((h, w, 1), np.float32)], axis=2)
    tmp = bpy.data.images.new(nome + "_tmp", w, h, alpha=False, float_buffer=True)
    tmp.pixels.foreach_set(rgba[::-1].ravel())
    os.makedirs(CACHE, exist_ok=True)
    percorso = os.path.join(CACHE, nome + ".exr")
    tmp.filepath_raw = percorso
    tmp.file_format = "OPEN_EXR"
    tmp.save()
    bpy.data.images.remove(tmp)
    img = bpy.data.images.load(percorso)
    if non_colore:
        img.colorspace_settings.name = "Non-Color"
    return img


def rumore_ripetibile(n, scala, seme):
    """Rumore morbido che si ripete senza giunte, ottenuto filtrando in frequenza."""
    rng = np.random.default_rng(seme)
    f = np.fft.fft2(rng.normal(size=(n, n)))
    fy, fx = np.meshgrid(np.fft.fftfreq(n), np.fft.fftfreq(n), indexing="ij")
    f *= np.exp(-(fx ** 2 + fy ** 2) * (scala ** 2) * 20)
    r = np.real(np.fft.ifft2(f))
    return (r - r.min()) / (r.max() - r.min() + 1e-9)


def trama(n=1024, fili=16, seme=3):
    """Altezza e tono di una tela: ordito verticale, trama orizzontale, intreccio uno sopra uno sotto."""
    rng = np.random.default_rng(seme)
    p = n / fili
    y, x = np.mgrid[0:n, 0:n].astype(np.float32)
    # i fili non sono righe perfette: serpeggiano appena
    x = x + 0.10 * p * np.sin(2 * np.pi * y / n * 3 + 1.0) + 0.06 * p * (rumore_ripetibile(n, 6.0, seme + 5) - 0.5)
    y = y + 0.10 * p * np.sin(2 * np.pi * x / n * 2 + 0.3) + 0.06 * p * (rumore_ripetibile(n, 6.0, seme + 6) - 0.5)
    i, j = np.floor(x / p).astype(int), np.floor(y / p).astype(int)
    fx, fy = x / p - i - 0.5, y / p - j - 0.5
    segno = np.where((i + j) % 2 == 0, 1.0, -1.0)
    spess_o = (1 + rng.normal(0, 0.11, fili))[i % fili]
    spess_t = (1 + rng.normal(0, 0.11, fili))[j % fili]
    ordito = np.clip(np.cos(np.pi * fx), 0, 1) ** 0.7 * (0.55 + 0.45 * segno * np.cos(np.pi * fy)) * spess_o
    tramaf = np.clip(np.cos(np.pi * fy), 0, 1) ** 0.7 * (0.55 - 0.45 * segno * np.cos(np.pi * fx)) * spess_t
    alt = np.maximum(ordito, tramaf)
    fibre = rumore_ripetibile(n, 1.0, seme + 1) * 0.55 + rumore_ripetibile(n, 3.5, seme + 2) * 0.45
    alt = alt * (0.86 + 0.28 * fibre)
    tono_o = (1 + rng.normal(0, 0.05, fili))[i % fili]
    tono_t = (1.07 + rng.normal(0, 0.05, fili))[j % fili]
    tono = np.where(ordito >= tramaf, tono_o, tono_t) * (0.84 + 0.32 * fibre) * (0.58 + 0.42 * alt)
    return alt / alt.max(), tono


def studio_hdri(tipo="luce", w=1536, h=768):
    """Ambiente da studio fotografico, in due versioni.

    "luce": fondo quasi nero e pochi pannelli. È quello che illumina il tessuto: lascia le ombre profonde.
    "riflessi": una tenda chiara con lame di luce e bandiere nere. È quello che si specchia nell'acciaio e nei
    fili lucidi, come nei set dove il metallo è circondato da superfici bianche.
    """
    v, u = np.mgrid[0:h, 0:w].astype(np.float32)
    az = (u / w - 0.5) * 2 * np.pi
    el = (v / h - 0.5) * np.pi
    d = np.stack([-np.cos(el) * np.cos(az), np.cos(el) * np.sin(az), np.sin(el)], axis=-1)
    img = np.zeros((h, w, 3), np.float32)
    if tipo == "riflessi":
        su = np.clip(d[..., 2] + 0.12, 0, 1)
        img += (0.05 + 0.75 * su ** 0.6)[..., None] * np.array([0.92, 0.96, 1.06], np.float32)
    else:
        img += (0.010 + 0.020 * np.clip(d[..., 2], 0, 1))[..., None] * np.array([0.55, 0.75, 1.25], np.float32)

    def pannello(direz, larg, alt, forza, colore=(1, 1, 1), bordo=0.25):
        c = np.array(direz, np.float32)
        c /= np.linalg.norm(c)
        su = np.array([0, 0, 1], np.float32)
        r = np.cross(su, c)
        r /= np.linalg.norm(r) + 1e-9
        t = np.cross(c, r)
        dc = d @ c
        px = np.where(dc > 0.05, (d @ r) / np.maximum(dc, 0.05), 99)
        py = np.where(dc > 0.05, (d @ t) / np.maximum(dc, 0.05), 99)
        sm = lambda a, lim: np.clip((lim - np.abs(a)) / (lim * bordo), 0, 1)
        m = sm(px, math.tan(math.radians(larg / 2))) * sm(py, math.tan(math.radians(alt / 2)))
        m = m * m * (3 - 2 * m)
        return (forza * m)[..., None] * np.array(colore, np.float32)

    if tipo == "riflessi":
        img += pannello((0.00, 0.45, 0.89), 96, 80, 2.6, (0.98, 0.99, 1.02))        # grande tenda bianca sopra e dietro
        img += pannello((-0.95, -0.10, 0.22), 13, 80, 9.0, (0.94, 0.98, 1.08))      # lama di luce a sinistra
        img += pannello((0.95, 0.10, 0.22), 17, 80, 6.5, (1.08, 1.00, 0.90))        # lama a destra, più calda
        img += pannello((0.20, -0.95, 0.30), 60, 40, 1.6, (1.0, 1.0, 1.0))          # pannello davanti: riempie le facce verso la camera
        for direz in ((-0.62, -0.74, 0.25), (0.55, -0.80, 0.22), (-0.70, 0.66, 0.25), (0.66, 0.70, 0.25)):
            img *= 1.0 - 0.92 * np.clip(pannello(direz, 9, 90, 1.0), 0, 1)          # bandiere nere: righe scure nette nel metallo
        return img
    img += pannello((0.00, 0.55, 0.83), 64, 46, 1.7, (0.80, 0.90, 1.10))        # diffusore freddo in alto, dietro la macchina
    img += pannello((-0.95, -0.10, 0.25), 11, 72, 6.0, (0.90, 0.96, 1.10))      # lama di luce a sinistra
    img += pannello((0.95, 0.10, 0.25), 15, 72, 4.0, (1.10, 1.00, 0.88))        # lama a destra, più calda
    img += pannello((0.30, -0.90, 0.24), 54, 34, 2.4, (0.90, 0.95, 1.08))       # pannello di schiarita davanti: apre le ombre verso la camera
    return img


# ------------------------------------------------------------------ materiali
def nodi(mat):
    mat.use_nodes = True
    return mat.node_tree.nodes, mat.node_tree.links


def mescola(N, L, a, b, tipo="MULTIPLY"):
    """Nodo che combina due colori. `a` e `b` possono essere prese d'uscita oppure terne di colore."""
    m = N.new("ShaderNodeMix")
    m.data_type = "RGBA"
    m.blend_type = tipo
    [s for s in m.inputs if s.name == "Factor" and s.type == "VALUE"][0].default_value = 1.0
    ingressi = [s for s in m.inputs if s.type == "RGBA"]
    for presa, val in zip(ingressi, (a, b)):
        if isinstance(val, (tuple, list)):
            presa.default_value = (*val[:3], 1)
        else:
            L.new(val, presa)
    return [s for s in m.outputs if s.type == "RGBA"][0]


def scala_valori(N, L, presa, a_min, a_max, da_min=0.0, da_max=1.0):
    mr = N.new("ShaderNodeMapRange")
    mr.inputs["From Min"].default_value = da_min
    mr.inputs["From Max"].default_value = da_max
    mr.inputs["To Min"].default_value = a_min
    mr.inputs["To Max"].default_value = a_max
    L.new(presa, mr.inputs["Value"])
    return mr.outputs[0]


def mat_tessuto():
    m = bpy.data.materials.new("tessuto")
    N, L = nodi(m)
    b = N["Principled BSDF"]
    alt, tono = trama()
    tc = N.new("ShaderNodeTexCoord")
    mp = N.new("ShaderNodeMapping")
    lato = 16 * 0.42 * MM
    mp.inputs["Scale"].default_value = (1 / lato, 1 / lato, 1)
    L.new(tc.outputs["Object"], mp.inputs["Vector"])
    ta = N.new("ShaderNodeTexImage")
    ta.image = immagine("trama_alt", alt)
    ta.interpolation = "Cubic"
    tt = N.new("ShaderNodeTexImage")
    tt.image = immagine("trama_tono", tono)
    L.new(mp.outputs["Vector"], ta.inputs["Vector"])
    L.new(mp.outputs["Vector"], tt.inputs["Vector"])
    # macchie larghe appena accennate
    rum = N.new("ShaderNodeTexNoise")
    rum.inputs["Scale"].default_value = 26.0
    rum.inputs["Detail"].default_value = 3.0
    L.new(tc.outputs["Object"], rum.inputs["Vector"])
    macchie = scala_valori(N, L, rum.outputs[0], 0.88, 1.12)
    # fiammature: fili più chiari o più scuri nelle due direzioni, come in un oxford; si leggono anche da lontano
    strisce = []
    for scala in ((1100.0, 16.0, 1.0), (16.0, 1100.0, 1.0)):
        mps = N.new("ShaderNodeMapping")
        mps.inputs["Scale"].default_value = scala
        L.new(tc.outputs["Object"], mps.inputs["Vector"])
        ns = N.new("ShaderNodeTexNoise")
        ns.inputs["Scale"].default_value = 1.0
        ns.inputs["Detail"].default_value = 2.0
        L.new(mps.outputs["Vector"], ns.inputs["Vector"])
        strisce.append(ns.outputs[0])
    somma = N.new("ShaderNodeMath")
    somma.operation = "ADD"
    L.new(strisce[0], somma.inputs[0])
    L.new(strisce[1], somma.inputs[1])
    fiamme = scala_valori(N, L, somma.outputs[0], 0.88, 1.13, 0.6, 1.4)
    colore = mescola(N, L, BLU, tt.outputs["Color"])
    colore = mescola(N, L, colore, macchie)
    colore = mescola(N, L, colore, fiamme)
    L.new(colore, b.inputs["Base Color"])
    # rilievo: intreccio fine più le fiammature
    alt_tot = N.new("ShaderNodeMath")
    alt_tot.operation = "ADD"
    L.new(ta.outputs["Color"], alt_tot.inputs[0])
    L.new(scala_valori(N, L, somma.outputs[0], -0.25, 0.25, 0.6, 1.4), alt_tot.inputs[1])
    bump = N.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 1.0
    bump.inputs["Distance"].default_value = 0.17 * MM
    L.new(alt_tot.outputs[0], bump.inputs["Height"])
    L.new(bump.outputs["Normal"], b.inputs["Normal"])
    b.inputs["Roughness"].default_value = 0.80
    # peluria del cotone: un velo chiaro che si accende in controluce
    b.inputs["Sheen Weight"].default_value = 0.08
    b.inputs["Sheen Roughness"].default_value = 0.42
    b.inputs["Sheen Tint"].default_value = (0.40, 0.58, 1.0, 1)
    b.inputs["Specular IOR Level"].default_value = 0.05
    return m


def mat_filo(nome="filo", colore=(0.90, 0.88, 0.83), ritorto=1.5, capi=3.0, ruvidezza=0.5, lucido=0.0):
    """Filo ritorto. `lucido` > 0 dà il riflesso direzionale dei filati da ricamo."""
    m = bpy.data.materials.new(nome)
    N, L = nodi(m)
    b = N["Principled BSDF"]
    uv = N.new("ShaderNodeUVMap")
    sep = N.new("ShaderNodeSeparateXYZ")
    L.new(uv.outputs["UV"], sep.inputs["Vector"])

    def per(presa, k):
        n = N.new("ShaderNodeMath")
        n.operation = "MULTIPLY"
        n.inputs[1].default_value = k
        L.new(presa, n.inputs[0])
        return n.outputs[0]

    som = N.new("ShaderNodeMath")
    som.operation = "ADD"
    L.new(per(sep.outputs["X"], ritorto * 2 * math.pi), som.inputs[0])
    L.new(per(sep.outputs["Y"], capi * 2 * math.pi), som.inputs[1])
    sen = N.new("ShaderNodeMath")
    sen.operation = "SINE"
    L.new(som.outputs[0], sen.inputs[0])
    ab = N.new("ShaderNodeMath")
    ab.operation = "ABSOLUTE"
    L.new(sen.outputs[0], ab.inputs[0])
    fib = N.new("ShaderNodeTexNoise")
    fib.inputs["Scale"].default_value = 9000.0
    alt = N.new("ShaderNodeMath")
    alt.operation = "ADD"
    L.new(ab.outputs[0], alt.inputs[0])
    L.new(per(fib.outputs[0], 0.6 if lucido == 0 else 0.15), alt.inputs[1])
    bump = N.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.9 if lucido == 0 else 0.45
    bump.inputs["Distance"].default_value = 0.05 * MM
    L.new(alt.outputs[0], bump.inputs["Height"])
    L.new(bump.outputs["Normal"], b.inputs["Normal"])
    L.new(mescola(N, L, colore, scala_valori(N, L, ab.outputs[0], 0.74 if lucido == 0 else 0.90, 1.0)), b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = ruvidezza
    b.inputs["Sheen Weight"].default_value = 0.6 if lucido == 0 else 0.15
    b.inputs["Sheen Roughness"].default_value = 0.35
    b.inputs["Subsurface Weight"].default_value = 0.08
    b.inputs["Subsurface Radius"].default_value = (0.0003, 0.0003, 0.0003)
    if lucido > 0:
        # filato da ricamo: il riflesso corre di traverso al filo e cambia con la direzione del punto
        tg = N.new("ShaderNodeTangent")
        tg.direction_type = "UV_MAP"
        L.new(tg.outputs["Tangent"], b.inputs["Tangent"])
        b.inputs["Anisotropic"].default_value = 0.85
        b.inputs["Specular IOR Level"].default_value = 0.9
        b.inputs["Coat Weight"].default_value = lucido
        b.inputs["Coat Roughness"].default_value = 0.16
    return m


def mat_acciaio(nome, ruvidezza=0.16, tornito=0.0, colore=(0.83, 0.835, 0.845)):
    m = bpy.data.materials.new(nome)
    N, L = nodi(m)
    b = N["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*colore, 1)
    b.inputs["Metallic"].default_value = 1.0
    tc = N.new("ShaderNodeTexCoord")
    rum = N.new("ShaderNodeTexNoise")
    rum.inputs["Scale"].default_value = 420.0
    rum.inputs["Detail"].default_value = 6.0
    L.new(tc.outputs["Object"], rum.inputs["Vector"])
    L.new(scala_valori(N, L, rum.outputs[0], ruvidezza * 0.75, ruvidezza * 1.35), b.inputs["Roughness"])
    b.inputs["Anisotropic"].default_value = tornito
    return m


def mat_opaco(nome, colore, ruvidezza=0.6):
    m = bpy.data.materials.new(nome)
    N, L = nodi(m)
    b = N["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*colore, 1)
    b.inputs["Roughness"].default_value = ruvidezza
    b.inputs["Sheen Weight"].default_value = 0.4
    return m


# ------------------------------------------------------------------ pezzi della scena
def crea_tessuto(mat):
    """Tessuto in due parti: una zona fitta dove si guarda da vicino, un bordo largo e rado intorno."""
    x0, x1, y0, y1 = FITTO

    def griglia(xs, ys, abbassa=None):
        X, Y = np.meshgrid(xs, ys)
        Z = quota(X, Y)
        if abbassa is not None:
            Z = Z - abbassa(X, Y)
        vert = np.stack([X, Y, Z], axis=-1).reshape(-1, 3)
        nx, ny = len(xs), len(ys)
        i = np.arange(ny - 1)[:, None]
        j = np.arange(nx - 1)[None, :]
        facce = np.stack([i * nx + j, i * nx + j + 1, (i + 1) * nx + j + 1, (i + 1) * nx + j], axis=-1).reshape(-1, 4)
        return vert, facce

    fitto = griglia(np.arange(x0, x1 + 1e-9, 0.6 * MM), np.arange(y0, y1 + 1e-9, 0.6 * MM))
    oggetto("tessuto", mesh_da_array("tessuto", *fitto), mat)

    def sotto(X, Y):        # il bordo rado passa appena sotto la zona fitta, per non sovrapporsi
        m = 0.012
        fx = np.clip(np.minimum(X - (x0 + m), (x1 - m) - X) / m, 0, 1)
        fy = np.clip(np.minimum(Y - (y0 + m), (y1 - m) - Y) / m, 0, 1)
        return 0.6 * MM * fx * fy

    rado = griglia(np.arange(-0.60, 0.60 + 1e-9, 4 * MM), np.arange(-1.05, 0.65 + 1e-9, 4 * MM), sotto)
    oggetto("tessuto_bordo", mesh_da_array("tessuto_bordo", *rado), mat)


def crea_fili(nome, punti, raggio, mat, lati=6, seme=2, gonfiore=0.10 * MM):
    if len(punti) == 0:
        return None
    linee, _ = G.fili_3d(punti, raggio, quota=quota, gonfiore=gonfiore, seme=seme)
    vert, facce, uv = G.tubi(linee, raggio, lati=lati)
    return oggetto(nome, mesh_da_array(nome, vert, facce, uv), mat)


def crea_fili_ritorti(nome, punti, raggio, mat, seme=5, gonfiore=0.02 * MM):
    """Punti della cucitura con i capi del filo modellati uno per uno."""
    if len(punti) == 0:
        return None
    linee, _ = G.fili_3d(punti, raggio, quota=quota, gonfiore=gonfiore, seme=seme)
    capi, r_capo = G.ritorci(G.infittisci(linee, 30), raggio)
    vert, facce, uv = G.tubi(capi, r_capo, lati=7)
    return oggetto(nome, mesh_da_array(nome, vert, facce, uv), mat)


def crea_filo_libero(nome, punti3d, raggio, mat):
    """Un solo filo ritorto che passa per una serie di punti nello spazio."""
    p = np.asarray(punti3d, float)
    q = np.concatenate([p[:1], p, p[-1:]])
    fine = []
    for k in range(len(p) - 1):
        t = np.linspace(0, 1, 9)[:-1, None]
        a, b, c, d = q[k], q[k + 1], q[k + 2], q[k + 3]
        fine.append(0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t ** 3))
    fine = np.concatenate(fine + [p[-1:]])
    seg = np.linalg.norm(np.diff(fine, axis=0), axis=1)
    arco = np.concatenate([[0], np.cumsum(seg)])
    u = np.arange(0, arco[-1], 0.12 * MM)
    fine = np.stack([np.interp(u, arco, fine[:, k]) for k in range(3)], axis=1)
    capi, r_capo = G.ritorci(fine[None, :, :], raggio)
    vert, facce, uv = G.tubi(capi, r_capo, lati=7)
    return oggetto(nome, mesh_da_array(nome, vert, facce, uv), mat)


Z_BARRA_PIEDINO = 46 * MM       # cima della barra del piedino: sopra c'è il rocchetto
Y_BARRA_PIEDINO = 10.5 * MM


def crea_macchina(s, mat, posizione=None):
    """Parti in acciaio vicino all'ago: ago, morsetto, barra dell'ago, barra e piedino premistoffa, rocchetto.

    `posizione` (x, y) sposta la macchina in un punto qualsiasi del tessuto: serve per il ricamo del logo.
    """
    xm, ym = (0.0, y_macchina(s)) if posizione is None else posizione
    zt = punta_ago(s)
    base = (xm, ym, 0.0)
    testa = bpy.data.objects.new("macchina", None)
    bpy.context.scene.collection.objects.link(testa)
    testa.location = base
    mobile = bpy.data.objects.new("gruppo_ago", None)
    bpy.context.scene.collection.objects.link(mobile)
    mobile.parent = testa
    mobile.location = (0, 0, zt)

    # ago: punta, lama, colletto, codolo
    tornio("ago", [(0.0, 0.0), (0.12 * MM, 0.5 * MM), (0.30 * MM, 2.0 * MM), (0.46 * MM, 4.0 * MM), (0.55 * MM, 6.0 * MM),
                   (0.55 * MM, 27 * MM), (0.85 * MM, 29.5 * MM), (0.85 * MM, 40 * MM)], lati=32, mat=mat["ago"], genitore=mobile)
    cruna = scatola("cruna", (0.34 * MM, 1.4 * MM, 1.3 * MM), smusso=0.1 * MM, mat=mat["scuro"], genitore=mobile)
    cruna.location = (0, 0, 4.6 * MM)

    # morsetto con vite a testa tonda
    mors = scatola("morsetto", (7.5 * MM, 8.0 * MM, 9.0 * MM), smusso=0.8 * MM, mat=mat["lucido"], genitore=mobile)
    mors.location = (0, 0, 38.5 * MM)
    vite = tornio("vite", [(0.0, 0.0), (1.5 * MM, 0.0), (1.5 * MM, 3.4 * MM), (2.5 * MM, 3.6 * MM), (2.7 * MM, 3.9 * MM), (2.7 * MM, 6.0 * MM),
                           (2.5 * MM, 6.5 * MM), (1.6 * MM, 6.9 * MM), (0.0, 7.0 * MM)], lati=40, mat=mat["lucido"], genitore=mobile, asse="X")
    vite.location = (3.2 * MM, 0.6 * MM, 38.5 * MM)
    taglio = scatola("taglio_vite", (0.5 * MM, 5.2 * MM, 0.5 * MM), smusso=0.05 * MM, mat=mat["scuro"], genitore=mobile)
    taglio.location = (10.05 * MM, 0.6 * MM, 38.5 * MM)
    taglio.rotation_euler = (math.radians(28), 0, 0)
    occ = tornio("passafilo", [(0.9 * MM + 0.22 * MM * math.cos(a), 0.22 * MM * math.sin(a)) for a in np.linspace(0, 2 * np.pi, 13)],
                 lati=24, mat=mat["lucido"], genitore=mobile)
    occ.location = (0, -4.9 * MM, 39.5 * MM)

    # barra dell'ago, con la testa smussata
    tornio("barra_ago", [(0.0, 43 * MM), (3.0 * MM, 43 * MM), (3.3 * MM, 43.4 * MM), (3.3 * MM, 51.2 * MM), (2.6 * MM, 52 * MM), (0.0, 52 * MM)],
           lati=56, mat=mat["tornito"], genitore=mobile)

    # barra del piedino: ferma, con passafilo e rocchetto in cima
    yb, zc = Y_BARRA_PIEDINO, Z_BARRA_PIEDINO
    tornio("barra_piedino", [(0.0, 18 * MM), (3.0 * MM, 18 * MM), (3.0 * MM, zc - 5 * MM), (4.4 * MM, zc - 4.6 * MM), (4.6 * MM, zc - 4.2 * MM),
                             (4.6 * MM, zc - 1.2 * MM), (4.3 * MM, zc - 0.8 * MM), (1.2 * MM, zc - 0.8 * MM), (1.2 * MM, zc), (0.0, zc)],
           lati=56, mat=mat["tornito"], genitore=testa).location = (0, yb, 0)
    occ2 = tornio("passafilo_alto", [(1.1 * MM + 0.25 * MM * math.cos(a), 0.25 * MM * math.sin(a)) for a in np.linspace(0, 2 * np.pi, 13)],
                  lati=24, mat=mat["lucido"], genitore=testa, asse="X")
    occ2.location = (0, yb - 5.4 * MM, zc - 2.6 * MM)
    # rocchetto conico: piattello e anima in acciaio, filo bianco avvolto
    tornio("piattello", [(0.0, zc), (6.4 * MM, zc), (6.6 * MM, zc + 0.2 * MM), (6.6 * MM, zc + 1.0 * MM), (6.3 * MM, zc + 1.2 * MM), (0.0, zc + 1.2 * MM)],
           lati=64, mat=mat["lucido"], genitore=testa).location = (0, yb, 0)
    tornio("anima", [(0.0, zc + 1.2 * MM), (1.5 * MM, zc + 1.2 * MM), (1.5 * MM, zc + 16.6 * MM), (1.2 * MM, zc + 17.0 * MM), (0.0, zc + 17.0 * MM)],
           lati=32, mat=mat["tornito"], genitore=testa).location = (0, yb, 0)
    h0, h1 = zc + 1.2 * MM, zc + 15.2 * MM
    cono = [(5.7 * MM - 3.0 * MM * k + 0.11 * MM * math.cos(k * 2 * np.pi * 26), h0 + (h1 - h0) * k) for k in np.linspace(0, 1, 210)]
    vert, facce = _rivoluzione([(1.5 * MM, h0)] + cono + [(1.5 * MM, h1)], 72)
    oggetto("filo_rocchetto", mesh_da_array("filo_rocchetto", vert, facce), mat["filo_avvolto"], testa).location = (0, yb, 0)

    gambo = scatola("gambo", (6.4 * MM, 6.4 * MM, 19 * MM), smusso=0.7 * MM, mat=mat["lucido"], genitore=testa)
    gambo.location = (0, yb, 1.3 * MM + 9.5 * MM)
    vg = tornio("vite_gambo", [(0.0, 0.0), (1.9 * MM, 0.0), (2.1 * MM, 0.3 * MM), (2.1 * MM, 1.8 * MM), (1.7 * MM, 2.3 * MM), (0.0, 2.4 * MM)],
                lati=32, mat=mat["lucido"], genitore=testa, asse="X")
    vg.location = (3.2 * MM, yb, 13 * MM)
    perno = tornio("perno", [(0.0, -4.4 * MM), (1.0 * MM, -4.4 * MM), (1.2 * MM, -4.1 * MM), (1.2 * MM, 4.1 * MM), (1.0 * MM, 4.4 * MM), (0.0, 4.4 * MM)],
                   lati=24, mat=mat["lucido"], genitore=testa, asse="X")
    perno.location = (0, yb - 3.6 * MM, 3.1 * MM)
    sp = 1.35 * MM
    cy = -6.0 * MM

    def punta_su(co, y_piega=-5.5 * MM):
        yl = co.y + cy
        if yl < y_piega:
            co.z += 47.0 * (y_piega - yl) ** 2

    for lato in (-1, 1):
        dito = scatola("dito_%d" % lato, (4.7 * MM, 16.5 * MM, sp), smusso=0.5 * MM, tagli_y=14, mat=mat["lucido"], genitore=testa, piega=punta_su)
        dito.location = (lato * 3.75 * MM, cy, sp / 2 + 0.25 * MM)
    tallone = scatola("tallone", (12.2 * MM, 13.0 * MM, sp), smusso=0.5 * MM, mat=mat["lucido"], genitore=testa)
    tallone.location = (0, 7.4 * MM, sp / 2 + 0.25 * MM)
    cerniera = scatola("cerniera", (8.6 * MM, 5.0 * MM, 3.2 * MM), smusso=0.6 * MM, mat=mat["lucido"], genitore=testa)
    cerniera.location = (0, yb - 3.6 * MM, sp + 1.7 * MM)
    return base, zt


def crea_filo_ago(s, base, zt, mat, foro=None):
    """Il filo scende dal rocchetto, passa dai due occhielli, entra nella cruna e torna all'ultimo foro.

    `base` è la posizione della macchina; `foro` l'ultimo punto cucito, se diverso dalla cucitura dritta.
    """
    o = np.array(base)
    zc, yb = Z_BARRA_PIEDINO, Y_BARRA_PIEDINO
    occhio = o + np.array([0.0, 0.0, zt + 4.6 * MM])
    p = [o + np.array([0.0, yb - 4.2 * MM, zc + 8.2 * MM]),
         o + np.array([0.0, yb - 5.6 * MM, zc + 2.0 * MM]),
         o + np.array([0.0, yb - 5.4 * MM, zc - 2.6 * MM]),
         o + np.array([0.0, -2.0 * MM, (zc + zt + 39.5 * MM) / 2]),
         o + np.array([0.0, -4.9 * MM, zt + 39.5 * MM]),
         o + np.array([0.0, -1.6 * MM, zt + 31.5 * MM]),
         o + np.array([0.0, -0.80 * MM, zt + 22 * MM]),
         o + np.array([0.0, -0.78 * MM, zt + 9.0 * MM]),
         occhio + np.array([0, -0.55 * MM, 0.35 * MM]),
         occhio + np.array([0, 0.55 * MM, -0.1 * MM])]
    if zt < 0.4 * MM:        # ago nel tessuto: il filo entra con lui
        p.append(o + np.array([0.0, 0.3 * MM, max(zt + 2.5 * MM, -2 * MM)]))
    else:                    # ago fuori: il filo torna all'ultimo foro
        if foro is None:
            foro = (0.0, -PASSO * punti_fatti(s))
        f = np.array([foro[0], foro[1], float(quota(foro[0], foro[1])) - 0.1 * MM])
        if np.linalg.norm(f[:2] - o[:2]) > 0.2 * MM:
            p.append((occhio + f) / 2 + np.array([0, 0, -0.2 * zt]))
        p.append(f)
    return crea_filo_libero("filo_ago", p, R_CUC * 0.92, mat)


def allunga(forma, y_perno):
    """Allunga una forma in verticale di KY attorno a `y_perno`: compensa l'inclinazione della camera."""
    from shapely import affinity
    return affinity.scale(forma, 1.0, KY, origin=(0.0, y_perno))


def poligoni_capitoli(ttf):
    """Le scritte ricamate, una forma per capitolo (anche su più righe)."""
    from shapely.ops import unary_union
    forme = []
    for cap in CAPITOLI:
        righe, y = [], cap["y"]
        for k, (testo, alt) in enumerate(cap["righe"]):
            if k > 0:
                y -= INTERLINEA + alt
            if cap["lato"] == "sx":
                righe.append(G.testo_in_poligoni(ttf, testo, alt, origine=(-MARGINE_TESTI, y), allinea="destra"))
            else:
                righe.append(G.testo_in_poligoni(ttf, testo, alt, origine=(MARGINE_TESTI, y), allinea="sinistra"))
        forme.append(allunga(unary_union(righe), cap["y"]))
    return forme


def poligoni_logo(svg):
    return allunga(G.logo_da_svg(svg, LOGO_LARG, centro=(0.0, LOGO_Y)), LOGO_Y)


# ------------------------------------------------------------------ camera, luci, resa
def guarda(cam, pos, verso, su):
    """Orienta la camera: guarda `verso`, con `su` come alto dell'immagine."""
    f = (Vector(verso) - Vector(pos)).normalized()
    u = Vector(su)
    u = (u - f * u.dot(f)).normalized()
    r = f.cross(u)
    cam.matrix_world = Matrix(((r.x, u.x, -f.x, pos[0]), (r.y, u.y, -f.y, pos[1]), (r.z, u.z, -f.z, pos[2]), (0, 0, 0, 1)))


def prepara_scena(larg, alt, campioni, trasparente=False):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    c = sc.cycles
    c.device = "CPU"
    c.samples = campioni
    c.use_adaptive_sampling = True
    c.adaptive_threshold = 0.02
    c.use_denoising = True
    c.max_bounces = 6
    c.glossy_bounces = 4
    c.diffuse_bounces = 3
    c.caustics_reflective = False
    c.caustics_refractive = False
    sc.render.resolution_x, sc.render.resolution_y = larg, alt
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = trasparente
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA" if trasparente else "RGB"
    sc.render.image_settings.compression = 30
    sc.view_settings.view_transform = "Standard"       # resa diretta: fili bianchi davvero bianchi, blu profondo
    sc.view_settings.look = "None"
    return sc


def crea_mondo(sc, forza=1.0, forza_riflessi=1.0):
    w = bpy.data.worlds.new("studio")
    sc.world = w
    w.use_nodes = True
    N, L = w.node_tree.nodes, w.node_tree.links
    def ambiente(tipo):
        env = N.new("ShaderNodeTexEnvironment")
        env.image = immagine("studio_" + tipo, studio_hdri(tipo), non_colore=False)
        spazi = [i.identifier for i in env.image.colorspace_settings.bl_rna.properties["name"].enum_items]
        if "Linear Rec.709" in spazi:
            env.image.colorspace_settings.name = "Linear Rec.709"
        return env.outputs["Color"]

    # due ambienti: uno illumina, l'altro si specchia. Il nodo "percorso della luce" sceglie quale usare.
    luce = N["Background"]
    luce.inputs["Strength"].default_value = forza
    L.new(ambiente("luce"), luce.inputs["Color"])
    riflessi = N.new("ShaderNodeBackground")
    riflessi.inputs["Strength"].default_value = forza_riflessi
    L.new(ambiente("riflessi"), riflessi.inputs["Color"])
    percorso = N.new("ShaderNodeLightPath")
    mix = N.new("ShaderNodeMixShader")
    L.new(percorso.outputs["Is Glossy Ray"], mix.inputs[0])
    L.new(luce.outputs[0], mix.inputs[1])
    L.new(riflessi.outputs[0], mix.inputs[2])
    L.new(mix.outputs[0], N["World Output"].inputs["Surface"])


def crea_sole(sc, forza=8.5, elevazione=30.0, direzione=(-0.34, 0.94), diametro=4.0, colore=(1.0, 0.92, 0.82)):
    """Luce principale: calda, bassa, da dietro la macchina. È infinitamente lontana, quindi illumina
    allo stesso modo ogni punto del tessuto che scorre."""
    ld = bpy.data.lights.new("sole", "SUN")
    ld.energy = forza
    ld.angle = math.radians(diametro)
    ld.color = colore
    ob = bpy.data.objects.new("sole", ld)
    sc.collection.objects.link(ob)
    g = Vector((direzione[0], direzione[1], 0)).normalized()
    e = math.radians(elevazione)
    verso_luce = Vector((g.x * math.cos(e), g.y * math.cos(e), math.sin(e)))
    ob.rotation_euler = verso_luce.to_track_quat("Z", "Y").to_euler()
    return ob


def camera_macro(sc, ym, diaframma=13.0):
    """Primo piano: camera bassa, davanti a destra. La luce arriva da dietro e disegna i bordi di ago e piedino."""
    cd = bpy.data.cameras.new("macro")
    cam = bpy.data.objects.new("macro", cd)
    sc.collection.objects.link(cam)
    sc.camera = cam
    pos = (0.072, ym - 0.092, 0.040)        # davanti a destra, come chi cuce che si china a guardare l'ago
    mira = (0.0, ym - 0.002, 0.0075)
    guarda(cam, pos, mira, (0, 0, 1))
    cd.lens = 90
    cd.sensor_width = 36
    cd.clip_start, cd.clip_end = 0.005, 20
    cd.dof.use_dof = diaframma > 0
    cd.dof.focus_distance = (Vector(pos) - Vector((0, ym, 0.004))).length
    cd.dof.aperture_fstop = max(diaframma, 0.1)
    cd.dof.aperture_blades = 9
    return cam


def camera_alto(sc, y_ago, larghezza=VISTA_LARG, elev=ELEV, dist=2.0, ago_a=AGO_A):
    """Vista dall'alto dal lato di chi cuce, senza prospettiva: il tessuto può scorrere senza deformarsi.

    `y_ago` è il punto del tessuto che deve cadere alla frazione `ago_a` dell'altezza dello schermo.
    """
    cd = bpy.data.cameras.new("alto")
    cam = bpy.data.objects.new("alto", cd)
    sc.collection.objects.link(cam)
    sc.camera = cam
    e = math.radians(elev)
    alt_vista = larghezza * sc.render.resolution_y / sc.render.resolution_x
    y_centro = y_ago - (0.5 - ago_a) * alt_vista / math.sin(e)
    centro = Vector((0.0, y_centro, 0.0))
    pos = centro + Vector((0.0, -dist * math.cos(e), dist * math.sin(e)))
    guarda(cam, pos, centro, (0, 0, 1))
    cd.type = "ORTHO"
    cd.ortho_scale = max(larghezza, alt_vista)
    cd.clip_start, cd.clip_end = 0.1, 10
    return cam


# ------------------------------------------------------------------ montaggio
def costruisci(vista, s, larg, alt, campioni, ttf, logo_svg, quota_logo=1.0, y_centro=None, diaframma=13.0, esposizione=0.0):
    global RILIEVO
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = prepara_scena(larg, alt, campioni)
    sc.view_settings.exposure = esposizione
    crea_mondo(sc)
    crea_sole(sc)
    mat = {
        "tessuto": mat_tessuto(),
        "filo": mat_filo("filo_capi", ritorto=0.0, capi=0.0, ruvidezza=0.6),
        "ricamo": mat_filo("filo_ricamo", colore=(0.80, 0.79, 0.76), ritorto=0.9, capi=2.0, ruvidezza=0.22, lucido=0.9),
        "filo_avvolto": mat_opaco("filo_avvolto", (0.90, 0.88, 0.83)),
        "ago": mat_acciaio("ago", 0.03, colore=(0.95, 0.95, 0.96)),
        "lucido": mat_acciaio("lucido", 0.15, tornito=0.35),
        "tornito": mat_acciaio("tornito", 0.17, tornito=0.45),
        "scuro": mat_acciaio("scuro", 0.5, colore=(0.02, 0.02, 0.025)),
    }

    capitoli = poligoni_capitoli(ttf)
    logo = poligoni_logo(logo_svg)
    RILIEVO = None
    RILIEVO = RilievoRicami(capitoli + [logo])
    crea_tessuto(mat["tessuto"])

    # cucitura dritta: solo i punti già chiusi, ognuno con i tre capi del filo modellati
    tutti = G.impuntura(0.0, FINE_CUCITURA, PASSO)
    n = len(tutti) if vista == "logo" else min(punti_fatti(s), len(tutti))
    crea_fili_ritorti("cucitura", tutti[:n], R_CUC, mat["filo"])

    # scritte: già ricamate nel tessuto, a punto raso (file lunghe e lucide)
    for k, forma in enumerate(capitoli):
        crea_fili("scritta_%d" % k, G.riempi_tatami(forma, 48.0, PASSO_RIC, 7.0 * MM, seme=10 + k), R_RIC, mat["ricamo"], seme=20 + k)
        crea_fili("scritta_bordo_%d" % k, G.contorno_a_punti(forma, passo=1.3 * MM), R_RIC * 0.9, mat["ricamo"], seme=30 + k, gonfiore=0.03 * MM)

    # logo: ricamato fino alla quota richiesta
    pl = G.riempi_tatami(logo, 62.0, PASSO_RIC, 6.5 * MM, seme=40)
    nl = int(round(len(pl) * max(0.0, min(1.0, quota_logo))))
    crea_fili("logo", pl[:nl], R_RIC, mat["ricamo"], seme=41)
    if quota_logo >= 1.0:
        crea_fili("logo_bordo", G.contorno_a_punti(logo, passo=1.3 * MM), R_RIC * 0.9, mat["ricamo"], seme=42, gonfiore=0.03 * MM)

    if vista == "logo":
        ultimo = pl[max(0, nl - 1)][1] if nl > 0 else pl[0][0]
        base, zt = crea_macchina(s, mat, posizione=(float(ultimo[0]), float(ultimo[1])))
        crea_filo_ago(s, base, zt, mat["filo"], foro=(float(ultimo[0]), float(ultimo[1])))
        camera_alto(sc, LOGO_Y if y_centro is None else y_centro, ago_a=0.5)      # nel finale il logo è al centro
    else:
        base, zt = crea_macchina(s, mat)
        crea_filo_ago(s, base, zt, mat["filo"])
        if vista == "macro":
            camera_macro(sc, base[1], diaframma)
        else:
            camera_alto(sc, base[1] if y_centro is None else y_centro)
    return sc


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--vista", default="macro", choices=["macro", "alto", "logo"])
    ap.add_argument("--s", type=float, default=4.6)
    ap.add_argument("--larg", type=int, default=1440)
    ap.add_argument("--alt", type=int, default=900)
    ap.add_argument("--campioni", type=int, default=64)
    ap.add_argument("--logo", type=float, default=1.0, help="quota del logo già ricamata, da 0 a 1")
    ap.add_argument("--y", type=float, default=None, help="punto del tessuto da inquadrare, lungo Y")
    ap.add_argument("--ttf", default=os.path.join(QUI, "font", "archivo-largo-700.ttf"))
    ap.add_argument("--svg", default=os.path.join(RADICE, "brand", "logo", "endero-completo.svg"))
    ap.add_argument("--diaframma", type=float, default=13.0, help="0 = tutto a fuoco")
    ap.add_argument("--esposizione", type=float, default=0.0)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    import time
    t0 = time.time()
    sc = costruisci(a.vista, a.s, a.larg, a.alt, a.campioni, a.ttf, a.svg, a.logo, a.y, a.diaframma, a.esposizione)
    print("scena costruita in %.1f s" % (time.time() - t0))
    sc.render.filepath = a.out
    t0 = time.time()
    bpy.ops.render.render(write_still=True)
    print("TEMPO RENDER %.1f s -> %s" % (time.time() - t0, a.out))
