"""Le linee delle misure sulla camicia del configuratore: dove si prende ogni misura.

Nel configuratore il cliente misura una camicia che gli sta bene, stesa sul tavolo. Accanto a ogni misura una "i"
gli mostra sulla camicia del sito dove si prende: una linea blu tratteggiata sull'immagine di Blender (ferma.webp,
fotogramma 1800 x 1000) o, per spalla e lunghezza dietro, sull'immagine della camicia girata (`retro.py`).
Le linee non si disegnano a mano: si calcolano sulla camicia comprata, con i suoi modificatori, nella stessa posa e
con la stessa camera delle immagini (`camicia/film/scena.py`). Così stanno sul tessuto calcolato, punto per punto.

Come si trovano:
  - i 28 pezzi staccati della mesh sono i pezzi del cartamodello, e le loro coordinate UV sono il cartamodello steso
    (1 unità UV = 1,54 m circa, uguale nei due versi). Una linea dritta sul cartamodello è la linea che il cliente
    misura sulla camicia stesa sul tavolo: colletto e polso (a metà altezza, da bottone a bottone), spallina (la
    cucitura della spalla), spalla (dritta sul carré da un punto spalla all'altro), lunghezze (lungo il filo del
    davanti; al centro del carré e del dietro), manica (la piega di sopra, poi il polsino) si tracciano lì e si portano
    sulla camicia appesa;
  - torace, pancia e bacino si prendono di traverso sul davanti, da cucitura a cucitura del fianco: sono la sezione
    orizzontale del corpo a una quota (1,5 cm sotto le ascelle, al 3° e al 1° bottone dal basso), sullo strato più
    esterno (dove l'abbottonatura copre i davanti, la linea passa sull'abbottonatura). Braccio e avambraccio sono la
    sezione della manica con il piano perpendicolare alla manica, alla quota presa sul cartamodello. Sul dietro, sotto
    il carré, la lunghezza passa sopra la piega centrale, sullo strato più esterno;
  - ogni punto si porta sulla superficie calcolata (Solidify + Subsurf), si proietta con la camera della scena e si
    guarda se dalla camera si vede: un raggio contro camicia, bottoni, gruccia e nastro, con TOLLERANZA. Le parti
    nascoste (dietro la manica, sotto il colletto, sul retro dei giri) escono come tratti a parte;
  - ogni tratto si semplifica: scarto massimo SCARTO punti del fotogramma.

Il file che esce (coordinate nel fotogramma 1800 x 1000 delle immagini ferme, y in giù, al decimo di punto):
    {"fotogramma": [1800, 1000], "telefono": {"x": 336, "larga": 750},
     "viste": {"davanti": {"perno": "RIPOSO", …}, "dietro": {"perno": "RIPOSO+pi", …}},
     "misure": {"<nome>": {"vista": "davanti" | "dietro",
                           "tratti": [{"punti": [[x, y], …], "visibile": true | false, "chiuso": false}, …],
                           "capi": [[x, y], [x, y]] (dove vanno le stanghette; [] per i giri chiusi),
                           "centro": [x, y] (un punto della linea, per l'etichetta),
                           "riquadro": [x0, y0, x1, y1] (la linea con 40 punti di margine, dentro la sagoma)}}}
I tratti di una linea sono in fila, ognuno comincia dove finisce il precedente; in un giro chiuso l'ultimo finisce
dove comincia il primo. "chiuso" è vero solo per un giro tutto visibile o tutto nascosto, dato in un tratto solo.
"sagoma" in ogni vista è il riquadro di camicia, bottoni e gruccia (senza il nastro).

    <venv>/bin/python camicia/guide/linee.py <file .blend comprato> public/camicia/guide.json [--controllo <file.json>]

Con `--controllo` scrive anche i punti 3D e le lunghezze in cm di ogni linea (servono a controllarle con una camicia
vera, non vanno sul sito). Le immagini di controllo le disegna `anteprime.py`.
Il Python con Blender: vedi CLAUDE.md, "Problemi già incontrati". Non calcola immagini: una decina di secondi.
"""
import argparse
import json
import math
import os
import sys

QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(QUI, '..', 'film'))
import scena  # noqa: E402  (importa bpy, per primo)
import bpy  # noqa: E402
import numpy as np  # noqa: E402
from bpy_extras.object_utils import world_to_camera_view  # noqa: E402
from mathutils import Vector  # noqa: E402
from mathutils.bvhtree import BVHTree  # noqa: E402
from scipy.sparse import coo_matrix  # noqa: E402
from scipy.sparse.csgraph import connected_components  # noqa: E402
from scipy.spatial import cKDTree  # noqa: E402
from shapely.geometry import LineString, MultiLineString, Point, Polygon  # noqa: E402

L, A = scena.LARGA, scena.ALTA
TELEFONO = {'x': 336, 'larga': 750}   # la fascia del fotogramma che il telefono mostra (film/monta.py)
TOLLERANZA = 0.004       # un punto si vede se sul raggio della camera non c'è niente più di 4 mm prima di lui
SCARTO = 0.5             # semplificazione: scarto massimo dalla linea vera, in punti del fotogramma
PASSO = 0.001            # le linee si campionano ogni millimetro
CORTO = 8.0              # un tratto visibile o nascosto che sta tutto in 8 punti (1 cm) si unisce ai vicini: è una
                         # piega che nasconde il tessuto per un attimo, o un filo che spunta
RIPIEGA = 8.0            # una coda nascosta che torna sopra la parte visibile (a meno di 8 punti) non si disegna
MARGINE = 40             # intorno alla linea, nel riquadro per l'ingrandimento
SOTTO_ASCELLA = 0.015    # il torace si prende 1,5 cm sotto il punto più basso delle cuciture del giromanica
BRACCIO = 0.10           # il braccio 10 cm sotto l'ascella, lungo la manica
AVAMBRACCIO = 0.15       # l'avambraccio 15 cm sopra il polsino
STACCO = 3.5             # una linea che passa a meno di 3,5 punti dal bordo della camicia (la parete, la gruccia) si
                         # sposta verso l'interno: il tratteggio e l'alone restano sul tessuto
PUNTA = 150              # una punta (la linea torna indietro di più di 150 gradi) con lati sotto PUNTA_LATO si toglie
PUNTA_LATO = 30
LISCIA = 15              # torace, pancia e bacino: media mobile di y su 15 campioni (1,5 cm), contro i dentini delle pieghe
DRITTE = ('torace', 'pancia', 'bacino')

# I pezzi del cartamodello, numerati come li trova scena._pezzi (sempre gli stessi per questo file). "Sinistra" e
# "destra" sono di chi guarda la camicia di fronte: la destra di chi guarda è la sinistra di chi la indossa.
# Il numero di vertici di ognuno serve a controllare che il file sia quello giusto.
PEZZI = {
    'abbottonatura': (0, 802), 'abbottonatura_sotto': (1, 802), 'dietro': (3, 11116), 'piede_colletto': (4, 556),
    'polsino_dx': (6, 557), 'polsino_sx': (7, 557), 'davanti_dx': (11, 5209), 'davanti_sx': (13, 5324),
    'cucitura_spalle': (17, 244), 'carre': (18, 1153), 'manica_sx': (22, 5691), 'manica_dx': (23, 5698),
}
CORPO_DAVANTI = (0, 1, 10, 11, 12, 13, 15)       # davanti, abbottonature, strisce dell'orlo davanti
CORPO_DIETRO = (3,)
GIROMANICA = (21, 24, 25)                        # le strisce delle cuciture del giromanica
SOTTO_MANICA = {'dx': (8, 14), 'sx': (9, 2)}     # le strisce della cucitura sotto la manica (e la finta del polso)
# Dalla camicia comprata: la manica, il polsino e il davanti più in vista nell'immagine ferma (la camicia è girata
# verso sinistra, quindi la metà di destra viene avanti). Si ricontrolla con `--controllo` (visibile per lato).
LATO = 'dx'

MISURE = ('giro_collo', 'spalla', 'spallina', 'torace', 'pancia', 'bacino', 'lunghezza_manica', 'braccio',
          'avambraccio', 'polso', 'lunghezza_davanti', 'lunghezza_dietro')


# ------------------------------------------------------------------------------------------------- la mesh e i pezzi

def matrice(ob):
    return np.array(ob.matrix_world)


def nel_mondo(co, M):
    return co @ M[:3, :3].T + M[:3, 3]


def base(ob):
    """La mesh com'è nel file (senza modificatori), nel mondo: vertici, triangoli e UV di ogni angolo dei triangoli."""
    me = ob.data
    co = np.empty(len(me.vertices) * 3, np.float32); me.vertices.foreach_get('co', co)
    me.calc_loop_triangles()
    lt = me.loop_triangles
    tv = np.empty(len(lt) * 3, np.int32); lt.foreach_get('vertices', tv)
    tl = np.empty(len(lt) * 3, np.int32); lt.foreach_get('loops', tl)
    uv = np.empty(len(me.loops) * 2, np.float32); me.uv_layers['UVMap'].data.foreach_get('uv', uv)
    return (nel_mondo(co.reshape(-1, 3).astype(np.float64), matrice(ob)), tv.reshape(-1, 3),
            uv.reshape(-1, 2)[tl.reshape(-1, 3)].astype(np.float64))


def calcolata(ob):
    """La mesh come la calcola Cycles (Solidify, Subsurf…), nel mondo: vertici e triangoli."""
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    me = ev.to_mesh()
    me.calc_loop_triangles()
    co = np.empty(len(me.vertices) * 3, np.float32); me.vertices.foreach_get('co', co)
    tv = np.empty(len(me.loop_triangles) * 3, np.int32); me.loop_triangles.foreach_get('vertices', tv)
    co = nel_mondo(co.reshape(-1, 3).astype(np.float64), np.array(ev.matrix_world))
    ev.to_mesh_clear()
    return co, tv.reshape(-1, 3)


def albero(co, tri):
    return BVHTree.FromPolygons(co.tolist(), tri.tolist(), all_triangles=True)


def contorni(tri):
    """I contorni di una mesh: i lati che stanno in un solo triangolo, messi in fila. Liste di vertici."""
    lati = np.sort(np.concatenate([tri[:, [0, 1]], tri[:, [1, 2]], tri[:, [2, 0]]]), axis=1)
    lati, quante = np.unique(lati, axis=0, return_counts=True)
    vicini = {}
    for a, b in lati[quante == 1]:
        vicini.setdefault(int(a), []).append(int(b)); vicini.setdefault(int(b), []).append(int(a))
    visti, anelli = set(), []
    for s in vicini:
        if s in visti:
            continue
        anello, prima, ora = [s], None, s
        visti.add(s)
        while True:
            dopo = [w for w in vicini[ora] if w != prima and w not in visti]
            if not dopo:
                break
            prima, ora = ora, dopo[0]
            visti.add(ora); anello.append(ora)
        anelli.append(anello)
    return anelli


class Pezzo:
    """Un pezzo del cartamodello: i suoi triangoli nella mesh di base, la sua sagoma in UV, i suoi angoli."""

    def __init__(self, k, co, tri, tri_uv, etichetta):
        sel = etichetta[tri[:, 0]] == k
        self.k, self.co, self.tri, self.tuv = k, co, tri[sel], tri_uv[sel]
        uv = np.zeros((len(co), 2)); uv[self.tri.ravel()] = self.tuv.reshape(-1, 2)
        cuciture = np.abs(uv[self.tri] - self.tuv).max()
        assert cuciture < 1e-6, f'k{k}: un vertice ha due UV (taglio dentro il pezzo, {cuciture})'
        self.uv = uv
        self.cerca = cKDTree(self.tuv.mean(axis=1))
        self.bordo = max(contorni(self.tri), key=len)
        self.sagoma = Polygon(uv[self.bordo]).buffer(0)
        lati = np.concatenate([self.tri[:, [0, 1]], self.tri[:, [1, 2]]])
        self.scala = float(np.median(np.linalg.norm(co[lati[:, 0]] - co[lati[:, 1]], axis=1)
                                     / np.maximum(np.linalg.norm(uv[lati[:, 0]] - uv[lati[:, 1]], axis=1), 1e-9)))

    def giro(self, i, passo=3):
        """Di quanti gradi gira il contorno in UV al suo vertice i (confrontando i lati a `passo` vertici di distanza)."""
        b, n = self.bordo, len(self.bordo)
        p0, p1, p2 = self.uv[b[(i - passo) % n]], self.uv[b[i]], self.uv[b[(i + passo) % n]]
        d1, d2 = p1 - p0, p2 - p1
        c = np.dot(d1, d2) / (np.linalg.norm(d1) * np.linalg.norm(d2) + 1e-15)
        return math.degrees(math.acos(max(-1.0, min(1.0, c))))

    def angoli(self, soglia=60):
        """Gli angoli vivi del contorno (indici nel contorno), uno per angolo."""
        cand = sorted(((self.giro(i), i) for i in range(len(self.bordo))), reverse=True)
        scelti = []
        for g, i in cand:
            if g < soglia:
                break
            if all(np.linalg.norm(self.uv[self.bordo[i]] - self.uv[self.bordo[j]]) > 0.004 for j in scelti):
                scelti.append(i)
        return scelti

    def cammina(self, da, a):
        """Il contorno da un suo vertice all'altro (indici nel contorno), per la strada più corta."""
        n = len(self.bordo)
        avanti = [(da + s) % n for s in range((a - da) % n + 1)]
        indietro = [(da - s) % n for s in range((da - a) % n + 1)]
        return [self.bordo[i] for i in min(avanti, indietro, key=len)]

    def in_3d(self, q):
        """Punti UV del pezzo → punti nel mondo sulla mesh di base (coordinate baricentriche del triangolo che li
        contiene). Restituisce anche quanto il punto sta fuori dal triangolo (0 se dentro)."""
        q = np.atleast_2d(q)
        _, idx = self.cerca.query(q, k=min(32, len(self.tri)))
        T = self.tuv[idx]
        a, b, c = T[..., 0, :], T[..., 1, :], T[..., 2, :]
        v0, v1, v2 = b - a, c - a, q[:, None, :] - a
        d00, d01, d11 = (v0 * v0).sum(-1), (v0 * v1).sum(-1), (v1 * v1).sum(-1)
        d20, d21 = (v2 * v0).sum(-1), (v2 * v1).sum(-1)
        with np.errstate(divide='ignore', invalid='ignore'):
            den = d00 * d11 - d01 * d01
            w1 = (d11 * d20 - d01 * d21) / den
            w2 = (d00 * d21 - d01 * d20) / den
        w0 = 1 - w1 - w2
        m = np.nan_to_num(np.minimum(np.minimum(w0, w1), w2), nan=-np.inf)
        j = m.argmax(axis=1)
        r = np.arange(len(q))
        W = np.clip(np.stack([w0, w1, w2], -1)[r, j], 0, None)
        W /= W.sum(axis=1, keepdims=True)
        return (self.co[self.tri[idx[r, j]]] * W[..., None]).sum(axis=1), -np.minimum(m[r, j], 0)

    def linea(self, p0, p1):
        """Il segmento dritto in UV da p0 a p1, campionato ogni PASSO (in metri della camicia), nel mondo."""
        n = max(2, int(math.ceil(np.linalg.norm(np.subtract(p1, p0)) * self.scala / PASSO)) + 1)
        q = np.linspace(p0, p1, n)
        punti, fuori = self.in_3d(q)
        assert fuori.max() < 0.02, f'k{self.k}: la linea esce dal pezzo ({fuori.max():.3f})'
        return punti

    def taglio(self, punto, verso):
        """La corda della sagoma UV lungo la retta che passa per `punto` con direzione `verso`: (inizio, fine)."""
        verso = np.asarray(verso, float) / np.linalg.norm(verso)
        lungo = 10.0
        r = LineString([np.asarray(punto) - verso * lungo, np.asarray(punto) + verso * lungo]).intersection(self.sagoma)
        pezzi = [g for g in getattr(r, 'geoms', [r]) if g.length > 0]
        g = min(pezzi, key=lambda s: s.distance(Point(punto)))
        a, b = np.array(g.coords[0]), np.array(g.coords[-1])
        return (a, b) if np.dot(b - a, verso) > 0 else (b, a)


class Camicia:
    """La camicia nella posa a riposo: pezzi, mesh calcolata divisa per pezzi, bottoni."""

    def __init__(self, p):
        self.p = p
        co, tri, tuv = base(p['camicia'])
        pezzi = scena._pezzi(p['camicia'].data)
        etichetta = np.zeros(len(co), np.int32)
        for k, q in enumerate(pezzi):
            etichetta[q] = k
        for nome, (k, quanti) in PEZZI.items():
            assert len(pezzi[k]) == quanti, f'il pezzo {k} ({nome}) ha {len(pezzi[k])} vertici, attesi {quanti}: è un altro file?'
        self.co, self.etichetta = co, etichetta
        self.pezzo = {k: Pezzo(k, co, tri, tuv, etichetta) for k in {k for k, _ in PEZZI.values()}}
        # la mesh calcolata: Solidify e Subsurf tengono in testa i vertici di base nello stesso ordine, quindi ogni
        # isola della mesh calcolata prende il pezzo dei suoi vertici di base
        self.ev, self.ev_tri = calcolata(p['camicia'])
        n = len(self.ev)
        t = self.ev_tri
        g = coo_matrix((np.ones(3 * len(t)), (np.r_[t[:, 0], t[:, 1], t[:, 2]], np.r_[t[:, 1], t[:, 2], t[:, 0]])), shape=(n, n))
        _, isola = connected_components(g, directed=False)
        del g
        isole = isola[:len(co)]
        self.ev_pezzo = np.full(n, -1, np.int32)
        for i in np.unique(isola):
            dentro = etichetta[isole == i]
            k = np.bincount(dentro).argmax()
            assert np.mean(dentro == k) > 0.99, 'la mesh calcolata non segue l\'ordine dei vertici di base'
            self.ev_pezzo[isola == i] = k
        scarto = np.linalg.norm(self.ev[:len(co)] - co, axis=1)
        assert np.median(scarto) < 0.001, f'mesh calcolata lontana da quella di base ({np.median(scarto)})'
        self._alberi = {}
        self.bottoni = self._bottoni(p['bottoni'])
        self.perno = np.array(p['perno'].matrix_world)

    def albero_di(self, pezzi):
        chiave = tuple(sorted(pezzi))
        if chiave not in self._alberi:
            sel = np.isin(self.ev_pezzo[self.ev_tri[:, 0]], chiave)
            self._alberi[chiave] = albero(self.ev, self.ev_tri[sel])
        return self._alberi[chiave]

    def sulla_stoffa(self, punti, pezzi):
        """Porta i punti sulla superficie calcolata (Solidify + Subsurf) dei pezzi dati: il punto più vicino."""
        t = self.albero_di(pezzi)
        out = np.empty_like(punti)
        for i, q in enumerate(punti):
            out[i] = t.find_nearest(Vector(q))[0]
        return out

    def _bottoni(self, ob):
        """I bottoni: ognuno è fatto di più pezzi staccati vicini. Centro di ognuno, nel mondo."""
        me = ob.data
        co = np.empty(len(me.vertices) * 3, np.float32); me.vertices.foreach_get('co', co)
        co = nel_mondo(co.reshape(-1, 3).astype(np.float64), matrice(ob))
        gruppi = []
        for q in scena._pezzi(me):
            c = co[q].mean(axis=0)
            for g in gruppi:
                if np.linalg.norm(g['c'] - c) < 0.008:
                    g['v'] += q; g['c'] = co[g['v']].mean(axis=0); break
            else:
                gruppi.append({'v': list(q), 'c': c})
        return np.array([g['c'] for g in gruppi])


# ------------------------------------------------------------------------------------------------- vista e camera

class Vista:
    """Una posa della camicia (il perno girato) vista dalla camera della scena: proiezione e cosa si vede."""

    def __init__(self, p, angolo):
        p['perno'].rotation_euler = (0, 0, angolo)
        bpy.context.view_layer.update()
        self.perno = np.array(p['perno'].matrix_world)
        sc, cam = bpy.context.scene, p['camera']
        dg = bpy.context.evaluated_depsgraph_get()
        self.PV = np.array(cam.calc_matrix_camera(dg, x=L, y=A)) @ np.linalg.inv(np.array(cam.matrix_world))
        self.occhio = Vector(cam.matrix_world.translation)
        tutte, tri, sagoma = [], [], []
        for nome in ('camicia', 'bottoni', 'gruccia', 'nastro'):
            c, t = calcolata(p[nome])
            tri.append(t + sum(len(x) for x in tutte)); tutte.append(c)
            if nome != 'nastro':
                sagoma.append(self.proietta(c))
        self.ostacoli = albero(np.concatenate(tutte), np.concatenate(tri))
        self.stoffa = albero(np.concatenate(tutte[:2]), np.concatenate(tri[:2]))     # solo camicia e bottoni
        self.inversa = np.linalg.inv(self.PV)
        s = np.concatenate(sagoma)
        self.sagoma = [float(s[:, 0].min()), float(s[:, 1].min()), float(s[:, 0].max()), float(s[:, 1].max())]
        # la proiezione a matrice deve dare gli stessi punti di Blender
        prova = np.concatenate(tutte)[::997]
        b = np.array([(lambda v: (v.x * L, (1 - v.y) * A))(world_to_camera_view(sc, cam, Vector(q))) for q in prova])
        assert np.abs(b - self.proietta(prova)).max() < 0.01

    def proietta(self, punti):
        h = np.c_[punti, np.ones(len(punti))] @ self.PV.T
        return np.c_[(h[:, 0] / h[:, 3] + 1) * L / 2, (1 - h[:, 1] / h[:, 3]) * A / 2]

    def sulla_camicia(self, px):
        """Per ogni punto del fotogramma: lì si vede la camicia (o un bottone), non la parete né la gruccia?"""
        px = np.atleast_2d(px)
        ndc = np.c_[px[:, 0] * 2 / L - 1, 1 - px[:, 1] * 2 / A, np.full(len(px), 0.5), np.ones(len(px))]
        w = ndc @ self.inversa.T
        w = w[:, :3] / w[:, 3:]
        out = np.zeros(len(px), bool)
        for i, q in enumerate(w):
            verso = Vector(q) - self.occhio
            out[i] = self.stoffa.ray_cast(self.occhio, verso.normalized(), 100.0)[0] is not None
        return out

    def si_vede(self, punti):
        out = np.zeros(len(punti), bool)
        for i, q in enumerate(punti):
            q = Vector(q)
            verso = q - self.occhio
            dist = verso.length
            colpo = self.ostacoli.ray_cast(self.occhio, verso.normalized(), dist + 0.05)
            out[i] = colpo[0] is None or colpo[3] > dist - TOLLERANZA
        return out


# ------------------------------------------------------------------------------------------------- utilità

def lunghezza(punti, chiuso=False):
    q = np.r_[punti, punti[:1]] if chiuso else punti
    return float(np.linalg.norm(np.diff(q, axis=0), axis=1).sum())


def ricampiona(punti, n):
    d = np.r_[0, np.cumsum(np.linalg.norm(np.diff(punti, axis=0), axis=1))]
    t = np.linspace(0, d[-1], n)
    return np.stack([np.interp(t, d, punti[:, i]) for i in range(punti.shape[1])], axis=1)


def fitta(punti):
    """Infittisce una spezzata in modo che due punti vicini non distino più di PASSO."""
    out = [punti[0]]
    for a, b in zip(punti[:-1], punti[1:]):
        n = max(1, int(math.ceil(np.linalg.norm(b - a) / PASSO)))
        out += list(a + (b - a) * (np.arange(1, n + 1)[:, None] / n))
    return np.array(out)


def semplifica(q, eps=SCARTO):
    """Ramer-Douglas-Peucker: tiene i punti che servono perché la spezzata non si scosti più di eps."""
    if len(q) < 3:
        return q
    tieni = np.zeros(len(q), bool); tieni[0] = tieni[-1] = True
    pila = [(0, len(q) - 1)]
    while pila:
        a, b = pila.pop()
        if b - a < 2:
            continue
        d = q[b] - q[a]
        n = np.linalg.norm(d)
        m = q[a + 1:b] - q[a]
        dist = np.abs(m[:, 0] * d[1] - m[:, 1] * d[0]) / n if n > 1e-9 else np.linalg.norm(m, axis=1)
        i = int(dist.argmax())
        if dist[i] > eps:
            tieni[a + 1 + i] = True
            pila += [(a, a + 1 + i), (a + 1 + i, b)]
    return q[tieni]


def ritaglia_al_bottone(punti, bottone):
    """Una linea che fa il giro e si sovrappone ai capi (colletto, polsino abbottonati): si tiene da dove passa sul
    bottone a dove ci ripassa, l'altro strato. Restituisce il giro chiuso."""
    d = np.linalg.norm(punti - bottone, axis=1)
    lungo = np.r_[0, np.cumsum(np.linalg.norm(np.diff(punti, axis=0), axis=1))]
    meta = np.searchsorted(lungo, lungo[-1] / 2)
    a, b = int(d[:meta].argmin()), int(meta + d[meta:].argmin())
    assert d[a] < 0.015 and d[b] < 0.015, f'il bottone non sta sulla linea ({d[a]:.3f}, {d[b]:.3f} m)'
    return punti[a:b + 1]


# ------------------------------------------------------------------------------------------------- le misure in 3D

def tagli(cam, pezzi, punto, normale):
    """Dove un piano taglia la superficie calcolata dei pezzi: per ogni triangolo tagliato un segmento (a, b) e il
    pezzo a cui appartiene."""
    tri = cam.ev_tri[np.isin(cam.ev_pezzo[cam.ev_tri[:, 0]], pezzi)]
    d = (cam.ev - punto) @ np.asarray(normale, float)
    d[d == 0] = 1e-12
    dt = d[tri]
    taglia = (dt.min(axis=1) < 0) & (dt.max(axis=1) > 0)
    tri, dt = tri[taglia], dt[taglia]
    segmenti = []
    for i, j in ((0, 1), (1, 2), (2, 0)):
        x = dt[:, i] * dt[:, j] < 0
        t = dt[:, i] / (dt[:, i] - dt[:, j])
        q = cam.ev[tri[:, i]] + (cam.ev[tri[:, j]] - cam.ev[tri[:, i]]) * t[:, None]
        segmenti.append(np.where(x[:, None], q, np.nan))
    s = np.stack(segmenti, axis=1)                                 # per triangolo: due punti validi su tre
    ok = ~np.isnan(s[..., 0])
    a = np.array([r[o][0] for r, o in zip(s, ok)]); b = np.array([r[o][1] for r, o in zip(s, ok)])
    return a, b, cam.ev_pezzo[tri[:, 0]]


def sezione(cam, pezzi, punto, normale, metro=False):
    """La sezione della superficie calcolata dei pezzi con un piano: il contorno esterno, chiuso, sul tessuto.
    Restituisce i punti del contorno (nel mondo) e il pezzo di ognuno. Con `metro` il giro è quello di un metro da
    sarta stretto intorno alla stoffa: il contorno convesso, che passa sopra le pieghe (il pezzo è None)."""
    normale = np.asarray(normale, float) / np.linalg.norm(normale)
    e1 = np.cross(normale, [0.0, 0.0, 1.0] if abs(normale[2]) < 0.9 else [1.0, 0.0, 0.0]); e1 /= np.linalg.norm(e1)
    e2 = np.cross(normale, e1)
    a, b, pezzo = tagli(cam, pezzi, punto, normale)
    piano = lambda q: np.c_[(q - punto) @ e1, (q - punto) @ e2]   # noqa: E731
    a2, b2 = piano(a), piano(b)
    # lo strato esterno: si ingrossano i segmenti di 2 mm (chiudono le cuciture, che sono saldate a 2,5 mm) e si
    # prende il bordo esterno della figura; poi ogni suo punto si riporta sul segmento più vicino
    figura = MultiLineString([[tuple(x), tuple(y)] for x, y in zip(a2, b2)]).buffer(0.002, quad_segs=4)
    figura = max(getattr(figura, 'geoms', [figura]), key=lambda g: g.area)
    assert len(figura.interiors) > 0, 'la sezione non fa un giro chiuso'
    if metro:
        guscio = figura.convex_hull.buffer(-0.0015).exterior          # sulla stoffa, non 2 mm fuori
        g = np.array(guscio.coords)
        g = ricampiona(g, int(guscio.length / (PASSO / 2)))[:-1]
        return punto + g[:, :1] * e1 + g[:, 1:] * e2, None
    esterno = np.array(figura.exterior.coords)[:-1]
    esterno = ricampiona(np.r_[esterno, esterno[:1]], int(figura.exterior.length / (PASSO / 2)))[:-1]
    dd = b2 - a2
    lung = np.maximum((dd * dd).sum(1), 1e-18)
    vicini = cKDTree((a2 + b2) / 2)
    _, cand = vicini.query(esterno, k=min(24, len(a2)))
    pa, pd = a2[cand], dd[cand]
    t = np.clip(((esterno[:, None, :] - pa) * pd).sum(-1) / lung[cand], 0, 1)
    proiezione = pa + pd * t[..., None]
    j = np.linalg.norm(proiezione - esterno[:, None, :], axis=2).argmin(axis=1)
    r = np.arange(len(esterno))
    tt = t[r, j][:, None]
    sc = cand[r, j]
    punti = a[sc] + (b[sc] - a[sc]) * tt
    return punti, pezzo[sc]


def sul_fuori(cam, pezzi, p0, p1, fuori):
    """La linea da p0 a p1 portata sullo strato più esterno della stoffa, dalla parte di `fuori`: si taglia con il
    piano che contiene la linea e quella direzione, e per ogni millimetro della linea si prende il punto del taglio
    più in fuori. Serve dove la riga di mezzo del cartamodello entra in una piega (la piega dietro, sotto il carré):
    sulla camicia stesa la piega è stirata e la misura ci passa sopra."""
    asse = p1 - p0
    lungo = float(np.linalg.norm(asse)); asse = asse / lungo
    fuori = np.asarray(fuori, float) - asse * np.dot(fuori, asse); fuori /= np.linalg.norm(fuori)
    a, b, _ = tagli(cam, pezzi, p0, np.cross(asse, fuori))
    sa, sb = (a - p0) @ asse, (b - p0) @ asse
    fa, fb = (a - p0) @ fuori, (b - p0) @ fuori
    out = []
    for s in np.arange(0, lungo + 1e-9, PASSO):
        x = ((sa - s) * (sb - s) <= 0) & (sa != sb)
        if not x.any():
            continue
        t = (s - sa[x]) / (sb[x] - sa[x])
        j = int(np.argmax(fa[x] + t * (fb[x] - fa[x])))
        out.append(a[x][j] + (b[x][j] - a[x][j]) * t[j])
    out = np.array(out)
    salti = np.linalg.norm(np.diff(out, axis=0), axis=1)
    print(f'  sul fuori: {len(out)} punti, salto più grande {salti.max() * 1000:.1f} mm')
    return out


def arco_davanti(punti, pezzo):
    """Del giro del corpo, l'arco del davanti: da una cucitura del fianco all'altra."""
    davanti = np.isin(pezzo, CORPO_DAVANTI)
    n = len(davanti)
    # i tratti di meno di 1 cm (un pezzo che spunta per un attimo) non contano
    passo = np.linalg.norm(np.diff(np.r_[punti, punti[:1]], axis=0), axis=1)
    for _ in range(3):
        cambi = np.nonzero(davanti != np.roll(davanti, 1))[0]
        if len(cambi) <= 2:
            break
        corse = [(cambi[i], cambi[(i + 1) % len(cambi)]) for i in range(len(cambi))]
        for a, b in corse:
            idx = np.arange(a, b if b > a else b + n) % n
            if passo[idx].sum() < 0.01:
                davanti[idx] = ~davanti[idx]
    cambi = np.nonzero(davanti != np.roll(davanti, 1))[0]
    assert len(cambi) == 2, f'il davanti non è un arco solo ({len(cambi)} cambi)'
    a, b = (cambi[0], cambi[1]) if davanti[cambi[0]] else (cambi[1], cambi[0])
    idx = np.arange(a, b if b > a else b + n) % n
    return punti[idx]


def misure_3d(cam):
    """Tutte le linee, nel mondo, nella posa a riposo. Per ognuna: punti, se è chiusa, la vista, i pezzi su cui sta."""
    P = cam.pezzo
    davanti, manica, polsino = P[PEZZI['davanti_' + LATO][0]], P[PEZZI['manica_' + LATO][0]], P[PEZZI['polsino_' + LATO][0]]
    carre, dietro, piede = P[PEZZI['carre'][0]], P[PEZZI['dietro'][0]], P[PEZZI['piede_colletto'][0]]
    segno = 1 if LATO == 'dx' else -1                              # verso l'esterno, in UV, sul davanti
    out = {}

    # punti del cartamodello: collo (punto più alto della spalla, dove arriva il colletto) e spalla (dove la cucitura
    # della spalla incontra la manica), sul davanti e sul carré
    i_collo = int(np.argmax(davanti.uv[davanti.bordo][:, 1]))
    angoli = davanti.angoli()
    verso = [i for i in angoli if i != i_collo and segno * (davanti.uv[davanti.bordo[i]][0] - davanti.uv[davanti.bordo[i_collo]][0]) > 0]
    i_spalla = min(verso, key=lambda i: len(davanti.cammina(i_collo, i)))
    ang_c = carre.angoli()
    lato_x = lambda i: carre.co[carre.bordo[i]][0]                 # noqa: E731
    # sul carré: i due angoli in alto (collo) e i due più in fuori (spalle); "dx" è dalla parte delle x positive
    alti = sorted(ang_c, key=lambda i: -carre.uv[carre.bordo[i]][1])[:2]
    c_collo = max(alti, key=lato_x) if LATO == 'dx' else min(alti, key=lato_x)
    fuori = sorted(ang_c, key=lambda i: carre.uv[carre.bordo[i]][0])
    c_spalle = (fuori[0], fuori[-1])
    c_spalla = max(c_spalle, key=lato_x) if LATO == 'dx' else min(c_spalle, key=lato_x)
    collo = (davanti.co[davanti.bordo[i_collo]] + carre.co[carre.bordo[c_collo]]) / 2
    spalla = (davanti.co[davanti.bordo[i_spalla]] + carre.co[carre.bordo[c_spalla]]) / 2
    for nome, q in (('collo davanti', davanti.co[davanti.bordo[i_collo]]), ('collo carré', carre.co[carre.bordo[c_collo]]),
                    ('spalla davanti', davanti.co[davanti.bordo[i_spalla]]), ('spalla carré', carre.co[carre.bordo[c_spalla]])):
        print(f'  {nome}: {np.round(q, 4)}')
    assert np.linalg.norm(collo - davanti.co[davanti.bordo[i_collo]]) < 0.01 and np.linalg.norm(spalla - davanti.co[davanti.bordo[i_spalla]]) < 0.01

    # spallina: la cucitura della spalla, a metà tra l'orlo del davanti e quello del carré, dal collo alla spalla
    orlo_d = davanti.co[davanti.cammina(i_collo, i_spalla)]
    orlo_c = carre.co[carre.cammina(c_collo, c_spalla)]
    n = int(lunghezza(orlo_d) / PASSO) + 2
    mezzo = (ricampiona(orlo_d, n) + ricampiona(orlo_c, n)) / 2
    out['spallina'] = dict(punti=cam.sulla_stoffa(mezzo, (17, 20, PEZZI['davanti_' + LATO][0], 18)), vista='davanti')

    # lunghezza davanti: dal collo, dritto lungo il filo del davanti (verticale nel cartamodello) fino all'orlo
    top = davanti.uv[davanti.bordo[i_collo]]
    a, b = davanti.taglio(top - [0, 1e-4], [0, -1])
    linea = davanti.linea(top, b)
    out['lunghezza_davanti'] = dict(punti=cam.sulla_stoffa(linea, (davanti.k,)), vista='davanti')

    # spalla (di dietro): dritta sul carré, da un punto spalla all'altro
    s1, s2 = (carre.uv[carre.bordo[i]] for i in c_spalle)
    linea = carre.linea(s1, s2)
    out['spalla'] = dict(punti=cam.sulla_stoffa(linea, (18,)), vista='dietro')

    # lunghezza dietro: dal centro dello scollo dietro (dove si cuce il colletto) giù per il carré e per il dietro,
    # lungo il centro, fino all'orlo
    uc = (s1[0] + s2[0]) / 2
    alto, basso = carre.taglio([uc, carre.uv[carre.bordo][:, 1].mean()], [0, -1])
    tratto1 = carre.linea(basso, alto)[::-1]
    ang3 = sorted(dietro.angoli(), key=lambda i: -dietro.uv[dietro.bordo[i]][1])[:2]
    uc3 = float(np.mean([dietro.uv[dietro.bordo[i]][0] for i in ang3]))
    alto3, basso3 = dietro.taglio([uc3, 0.25], [0, -1])
    tratto2 = dietro.linea(basso3, alto3)[::-1]
    print(f'  carré → dietro: {np.linalg.norm(tratto1[-1] - tratto2[0]) * 1000:.1f} mm di cucitura')
    # sotto il carré, al centro, il dietro ha una piega: la riga di mezzo del cartamodello ci entra dentro. La linea
    # resta sul fuori: dalla cucitura del carré all'orlo, sullo strato più esterno del dietro
    verso_dietro = (cam.perno[:3, :3] @ np.array([0.0, 1.0, 0.0]))          # il dietro della camicia guarda +Y girato
    tratto2 = sul_fuori(cam, (3, 16, 19), tratto2[0], tratto2[-1], verso_dietro)
    out['lunghezza_dietro'] = dict(punti=np.r_[cam.sulla_stoffa(tratto1, (18,)), fitta(np.array([tratto1[-1], tratto2[0]]))[1:-1], tratto2], vista='dietro')

    # manica: dal punto spalla, giù per la piega di sopra della manica (la riga di mezzo del cartamodello, dal punto
    # della testa che si cuce sulla spalla al mezzo del fondo), poi di traverso sul polsino fino al suo bordo
    bm = manica.uv[manica.bordo]
    d = np.linalg.norm(manica.co[manica.bordo] - spalla, axis=1)
    testa = bm[int(d.argmin())]
    print(f'  testa della manica a {d.min() * 100:.1f} cm dal punto spalla')
    ang_m = manica.angoli()
    ascelle = sorted(ang_m, key=lambda i: -bm[i][1])[:2]           # i due angoli in alto: l'ascella, cucita insieme
    fondo = sorted(ang_m, key=lambda i: bm[i][1])
    fondo = [i for i in fondo if bm[i][1] < bm[:, 1].min() + 0.01]
    fondo = (min(fondo, key=lambda i: bm[i][0]), max(fondo, key=lambda i: bm[i][0]))
    u_mezzo = (bm[fondo[0]][0] + bm[fondo[1]][0]) / 2
    _, giu = manica.taglio([u_mezzo, bm[:, 1].mean()], [0, -1])
    linea = manica.linea(testa, giu)
    linea = cam.sulla_stoffa(linea, (manica.k,))
    # il polsino: lungo il suo lato corto, dal bordo cucito alla manica al bordo libero
    bp = polsino.uv[polsino.bordo]
    zp = polsino.co[polsino.bordo][:, 2]
    um = (bp[:, 0].min() + bp[:, 0].max()) / 2
    su_alto = zp[bp[:, 0] > um].mean() > zp[bp[:, 0] < um].mean()          # quale lato corto sta in alto
    d = np.linalg.norm(polsino.co[polsino.bordo] - linea[-1], axis=1)
    lato_alto = (bp[:, 0] > um) == su_alto
    vp = bp[np.where(lato_alto, d, np.inf).argmin()][1]
    da, a = polsino.taglio([um, vp], [1, 0] if not su_alto else [-1, 0])
    tratto_p = cam.sulla_stoffa(polsino.linea(da, a), (polsino.k,))
    print(f'  manica → polsino: {np.linalg.norm(linea[-1] - tratto_p[0]) * 1000:.1f} mm')
    out['lunghezza_manica'] = dict(punti=np.r_[cam.sulla_stoffa(fitta(np.array([spalla, linea[0]])), (17, 20, 24, 21, 25, manica.k, 18, davanti.k))[:-1],
                                                linea, fitta(np.array([linea[-1], tratto_p[0]]))[1:-1], tratto_p], vista='davanti')

    # braccio e avambraccio: giri chiusi di traverso sulla manica
    v_ascella = float(np.mean([bm[i][1] for i in ascelle]))
    v_fondo = float(manica.taglio([u_mezzo, bm[:, 1].mean()], [0, -1])[1][1])
    # l'avambraccio si prende sul cartamodello, 15 cm sopra il polsino. Il braccio no: sulla camicia appesa la manica
    # sotto l'ascella si raccoglie in pieghe, e la riga del cartamodello 10 cm sotto l'ascella cade 3 cm sotto, dove a
    # vederla sembra l'ascella stessa. Si prende 10 cm più giù lungo la manica appesa, come sulla camicia stesa: lungo
    # l'asse della manica (la fila dei centri dei giri) dal giro all'altezza dell'ascella.
    # Il giro è la sezione della manica con il piano perpendicolare alla manica in quel punto (l'asse: tra i centri dei
    # giri 3 cm sopra e sotto), stretto come un metro intorno alla stoffa. Una riga orizzontale del cartamodello
    # seguirebbe le pieghe sotto l'ascella a zig-zag
    def centro_giro(v):
        a, b = manica.taglio([u_mezzo, v], [1, 0])
        return manica.linea(a, b).mean(axis=0)
    vv = np.linspace(v_ascella - 1e-3, v_fondo + 0.01 / manica.scala, 160)
    centri = np.array([centro_giro(v) for v in vv])
    lungo_asse = np.r_[0, np.cumsum(np.linalg.norm(np.diff(centri, axis=0), axis=1))]
    v_braccio = float(np.interp(BRACCIO, lungo_asse, vv))
    print(f'  braccio: {BRACCIO * 100:.0f} cm lungo la manica appesa = {(v_ascella - v_braccio) * manica.scala * 100:.1f} cm di cartamodello')
    for nome, v in (('braccio', v_braccio), ('avambraccio', v_fondo + AVAMBRACCIO / manica.scala)):
        dv = 0.03 / manica.scala
        asse = centro_giro(v + dv) - centro_giro(v - dv)
        giro, _ = sezione(cam, (manica.k,) + SOTTO_MANICA[LATO], centro_giro(v), asse, metro=True)
        a, b = manica.taglio([u_mezzo, v], [1, 0])
        riga = lunghezza(manica.linea(a, b), chiuso=True)          # la larghezza del cartamodello lì: il giro vero
        print(f'  {nome}: giro disegnato {lunghezza(giro, True) * 100:.1f} cm, cartamodello {riga * 100:.1f} cm')
        out[nome] = dict(punti=giro, vista='davanti', chiuso=True, cartamodello=riga)

    # polso: il giro del polsino a metà altezza, da bottone a bottone
    lo, hi = polsino.taglio([um, bp[:, 1].mean()], [0, 1])
    giro = cam.sulla_stoffa(polsino.linea(lo, hi), (polsino.k,))
    vicino = cam.bottoni[np.linalg.norm(cam.bottoni[:, None] - polsino.co[polsino.bordo][None], axis=2).min(axis=1).argmin()]
    out['polso'] = dict(punti=ritaglia_al_bottone(giro, vicino), vista='davanti', chiuso=True)

    # giro collo: il piede del colletto a metà altezza, dal bottone del colletto tutto intorno
    bc = piede.uv[piede.bordo]
    u0, u1 = bc[:, 0].min(), bc[:, 0].max()
    mezzi = []
    for u in np.linspace(u0 + 1e-4, u1 - 1e-4, 600):
        lo, hi = piede.taglio([u, bc[:, 1].mean()], [0, 1])
        mezzi.append((lo + hi) / 2)
    mezzi = np.array(mezzi)
    linea = piede.in_3d(ricampiona(mezzi, int(lunghezza(mezzi) * piede.scala / PASSO) + 2))[0]
    giro = cam.sulla_stoffa(linea, (piede.k,))
    collo_b = cam.bottoni[np.linalg.norm(cam.bottoni[:, None] - piede.co[piede.bordo][None], axis=2).min(axis=1).argmin()]
    out['giro_collo'] = dict(punti=ritaglia_al_bottone(giro, collo_b), vista='davanti', chiuso=True)

    # torace, pancia, bacino: sezioni orizzontali del corpo, l'arco del davanti
    ascella = min(float(cam.co[cam.etichetta == k][:, 2].min()) for k in GIROMANICA)
    davanti_ab = P[PEZZI['abbottonatura'][0]]
    zmin, zmax = davanti_ab.co[davanti_ab.bordo][:, 2].min(), davanti_ab.co[davanti_ab.bordo][:, 2].max()
    xa = np.median(davanti_ab.co[davanti_ab.bordo][:, 0])
    fila = [b for b in cam.bottoni if zmin < b[2] < zmax - 0.01 and abs(b[0] - xa) < 0.02]
    vista_davanti = Vista(cam.p, scena.RIPOSO)
    fila = np.array(sorted((b for b in fila if vista_davanti.si_vede(b[None])[0]), key=lambda b: b[2]))
    assert len(fila) == 6, f'bottoni sul davanti: {len(fila)}, attesi 6'
    print('  bottoni del davanti dal basso, quota:', ' '.join(f'{b[2]:.4f}' for b in fila))
    quote = {'torace': ascella - SOTTO_ASCELLA, 'pancia': float(fila[2][2]), 'bacino': float(fila[0][2])}
    centro_corpo = cam.co[np.isin(cam.etichetta, CORPO_DAVANTI + CORPO_DIETRO)].mean(axis=0)
    for nome, z in quote.items():
        punti, pezzo = sezione(cam, CORPO_DAVANTI + CORPO_DIETRO, np.array([centro_corpo[0], centro_corpo[1], z]), [0, 0, 1])
        out[nome] = dict(punti=arco_davanti(punti, pezzo), vista='davanti', quota=z)
    out['_punti'] = {'collo': collo, 'spalla': spalla, 'ascella_z': ascella, 'bottoni': fila, 'bottone_colletto': collo_b}
    return out, vista_davanti


# ------------------------------------------------------------------------------------------------- dalla 3D al fotogramma

def media_mobile(v, k):
    if k < 2 or len(v) <= k:
        return v
    pad = np.r_[np.full(k // 2, v[0]), v, np.full(k - 1 - k // 2, v[-1])]
    return np.convolve(pad, np.ones(k) / k, mode='valid')


def avanti_in_x(q):
    """Torace, pancia e bacino vanno da un fianco all'altro: dove le pieghe fanno tornare indietro la linea
    proiettata (un dentino di qualche punto), si tengono solo i punti che vanno avanti."""
    verso = 1 if q[-1, 0] >= q[0, 0] else -1
    xs = q[:, 0] * verso
    # si parte dal punto più indietro e si arriva al più avanti: le code che ci tornano sopra non contano
    i0, i1 = int(xs.argmin()), int(xs.argmax())
    tieni = np.zeros(len(q), bool)
    piu = -np.inf
    for i, x in enumerate(xs):
        if i0 <= i <= i1 and x > piu + 1e-6:
            tieni[i] = True
            piu = x
    return tieni


def stacca(vista, q, vede, chiuso):
    """Una linea che corre sul bordo della camicia (la spallina, la manica in alto) avrebbe metà tratteggio sulla
    parete; una che passa sotto la gruccia, l'alone sul legno. Dove la parete o la gruccia sono a meno di STACCO punti
    da una parte sola, il punto si sposta dall'altra, quanto basta. Solo il disegno: le lunghezze restano quelle vere."""
    n = len(q)
    if n < 3:
        return q
    idx = np.arange(n)
    avanti, dietro = (idx + 3) % n if chiuso else np.minimum(idx + 3, n - 1), (idx - 3) % n if chiuso else np.maximum(idx - 3, 0)
    t = q[avanti] - q[dietro]
    t /= np.maximum(np.linalg.norm(t, axis=1, keepdims=True), 1e-9)
    nrm = np.c_[-t[:, 1], t[:, 0]]
    passi = np.arange(0.5, 2 * STACCO + 0.01, 0.5)
    sposta = np.zeros(n)
    da_vedere = np.nonzero(vede)[0]
    if not len(da_vedere):
        return q
    # per ogni punto visibile: quanta camicia c'è da una parte e dall'altra, fino a 2 STACCO
    prove = (q[da_vedere, None, None, :] + np.array([1, -1])[None, :, None, None] * passi[None, None, :, None] * nrm[da_vedere, None, None, :])
    su = vista.sulla_camicia(prove.reshape(-1, 2)).reshape(len(da_vedere), 2, len(passi))
    libero = np.where(su.all(axis=2), 2 * STACCO, passi[np.argmin(su, axis=2)] - 0.5)   # camicia fino al primo buco
    for j, i in enumerate(da_vedere):
        piu, meno = libero[j]
        if piu < STACCO <= meno:
            sposta[i] = -min(STACCO - piu, meno - STACCO)
        elif meno < STACCO <= piu:
            sposta[i] = min(STACCO - meno, piu - STACCO)
    if chiuso:
        sposta = np.convolve(np.r_[sposta[-7:], sposta, sposta[:7]], np.ones(15) / 15, mode='same')[7:-7]
    else:
        sposta = media_mobile(sposta, 15)
    return q + nrm * sposta[:, None]


def senza_punte(punti):
    """Toglie le punte: un vertice dove la linea torna indietro (più di PUNTA gradi) con lati corti. Sono le pieghe
    viste di taglio, che a disegnarle fanno un dentino o un ricciolo."""
    p = [list(x) for x in punti]
    cambiato = True
    while cambiato and len(p) > 2:
        cambiato = False
        for i in range(1, len(p) - 1):
            a, b, c = np.array(p[i - 1]), np.array(p[i]), np.array(p[i + 1])
            u, v = a - b, c - b
            lu, lv = np.linalg.norm(u), np.linalg.norm(v)
            if lu < 1e-6 or lv < 1e-6:
                del p[i]; cambiato = True; break
            angolo = math.degrees(math.acos(np.clip(np.dot(u, v) / (lu * lv), -1, 1)))
            if 180 - angolo > PUNTA and min(lu, lv) < PUNTA_LATO:
                del p[i]; cambiato = True; break
    return p


def tratti(vista, punti, chiuso, nome=''):
    """Proietta, divide in parti visibili e nascoste, semplifica. Restituisce i tratti e le lunghezze in cm."""
    punti = fitta(np.r_[punti, punti[:1]])[:-1] if chiuso else fitta(punti)
    q = vista.proietta(punti)
    vede = vista.si_vede(punti)
    if nome in DRITTE:
        tieni = avanti_in_x(q)
        punti, q, vede = punti[tieni], q[tieni], vede[tieni]
        q = np.c_[q[:, 0], media_mobile(q[:, 1], LISCIA)]
    n = len(q)
    passo3 = np.linalg.norm(np.diff(np.r_[punti, punti[:1]] if chiuso else punti, axis=0), axis=1)

    def corse():
        cambi = [i for i in range(1, n) if vede[i] != vede[i - 1]]
        if chiuso and cambi and vede[0] != vede[-1]:
            cambi = [0] + cambi
        if not cambi:
            return [(0, n)]
        if chiuso:
            return [(cambi[i], cambi[(i + 1) % len(cambi)] + (n if i + 1 == len(cambi) else 0)) for i in range(len(cambi))]
        bordi = [0] + cambi + [n]
        return list(zip(bordi[:-1], bordi[1:]))

    # i tratti troppo corti (meno di CORTO punti del fotogramma) prendono il colore dei vicini, dal più corto
    while True:
        cc = corse()
        if len(cc) < 2:
            break
        lung = [float(np.linalg.norm(np.ptp(q[np.arange(a, b) % n], axis=0))) for a, b in cc]   # quanto è grande a vedersi
        i = int(np.argmin(lung))
        if lung[i] >= CORTO:
            break
        a, b = cc[i]
        vede[np.arange(a, b) % n] = ~vede[a % n]
    cc = corse()
    cm = {'visibile': 0.0, 'nascosto': 0.0}
    for i in range(n if chiuso else n - 1):
        cm['visibile' if vede[i] and vede[(i + 1) % n] else 'nascosto'] += passo3[i] * 100
    # una linea aperta che finisce dietro qualcosa (il torace dietro la manica) può tornare indietro sopra la parte che
    # si vede: quella coda non aggiunge niente al disegno e metterebbe la stanghetta in mezzo alla linea. Non si
    # disegna, e il capo diventa il punto in cui la linea sparisce
    if not chiuso and len(cc) > 1 and vede.any():
        sopra = cKDTree(q[vede])
        for fine in (0, -1):
            a, b = cc[fine]
            if not vede[a] and sopra.query(q[a:b])[0].max() < RIPIEGA:
                cc = cc[1:] if fine == 0 else cc[:-1]
    out = []
    for a, b in cc:
        piu = 1 if len(cc) > 1 and (chiuso or (a, b) != cc[-1]) else 0
        idx = np.arange(a, b + piu) % n                    # ogni tratto finisce dove inizia il prossimo
        if len(cc) == 1 and chiuso:
            idx = np.arange(n)
        pezzo = senza_punte(semplifica(q[idx]))
        out.append({'punti': [[round(float(x), 1), round(float(y), 1)] for x, y in pezzo], 'visibile': bool(vede[a % n]),
                    'chiuso': bool(chiuso and len(cc) == 1)})
    return out, cm, q, vede


def scheda(vista, misura, chiuso, nome=''):
    tt, cm, q, vede = tratti(vista, misura['punti'], chiuso, nome)
    tutti = np.array([p for t in tt for p in t['punti']])
    x0, y0 = tutti.min(axis=0) - MARGINE
    x1, y1 = tutti.max(axis=0) + MARGINE
    s = vista.sagoma
    riquadro = [max(x0, s[0]), max(y0, s[1]), min(x1, s[2]), min(y1, s[3])]
    # il punto per l'etichetta: a metà del tratto visibile più lungo (se non se ne vede niente, del più lungo)
    def lung2(t):
        p = np.array(t['punti']); return np.linalg.norm(np.diff(p, axis=0), axis=1).sum() if len(p) > 1 else 0
    scelti = [t for t in tt if t['visibile']] or tt
    t = max(scelti, key=lung2)
    p = np.array(t['punti'])
    if len(p) > 1:
        d = np.r_[0, np.cumsum(np.linalg.norm(np.diff(p, axis=0), axis=1))]
        centro = [float(np.interp(d[-1] / 2, d, p[:, 0])), float(np.interp(d[-1] / 2, d, p[:, 1]))]
    else:
        centro = p[0].tolist()
    capi = [] if chiuso else [tt[0]['punti'][0], tt[-1]['punti'][-1]]
    r1 = lambda v: round(float(v), 1)  # noqa: E731
    return ({'vista': misura['vista'], 'tratti': tt, 'capi': capi, 'centro': [r1(v) for v in centro],
             'riquadro': [r1(v) for v in riquadro]}, cm)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('blend'); ap.add_argument('uscita')
    ap.add_argument('--controllo', help='file JSON con punti 3D e lunghezze in cm di ogni linea')
    ap.add_argument('--lato', choices=('dx', 'sx'), default=LATO, help='la metà della camicia su cui stanno le linee di un lato solo')
    a = ap.parse_args()
    globals()['LATO'] = a.lato

    p = scena.costruisci(a.blend)
    bpy.context.view_layer.update()
    cam = Camicia(p)
    print('linee in 3D, posa a riposo')
    linee, davanti = misure_3d(cam)
    dietro = Vista(p, scena.RIPOSO + math.pi)
    # di dietro la camicia è la stessa, girata di mezzo giro intorno alla verticale del perno
    giro = dietro.perno @ np.linalg.inv(davanti.perno)

    dati = {'fotogramma': [L, A], 'telefono': TELEFONO,
            'viste': {'davanti': {'perno': 'RIPOSO', 'radianti': round(scena.RIPOSO, 6), 'sagoma': [round(v, 1) for v in davanti.sagoma]},
                      'dietro': {'perno': 'RIPOSO+pi', 'radianti': round(scena.RIPOSO + math.pi, 6), 'sagoma': [round(v, 1) for v in dietro.sagoma]}},
            'misure': {}}
    controllo = {}
    print(f'\n{"misura":18} {"vista":8} {"visibile":>9} {"nascosta":>9} {"totale":>8}  (cm, lungo il tessuto)')
    for nome in MISURE:
        m = linee[nome]
        chiuso = m.get('chiuso', False)
        vista = davanti if m['vista'] == 'davanti' else dietro
        punti = m['punti'] if m['vista'] == 'davanti' else nel_mondo(m['punti'], giro)
        s, cm = scheda(vista, dict(m, punti=punti), chiuso, nome)
        dati['misure'][nome] = s
        tot = cm['visibile'] + cm['nascosto']
        print(f'{nome:18} {m["vista"]:8} {cm["visibile"]:9.1f} {cm["nascosto"]:9.1f} {tot:8.1f}   tratti {len(s["tratti"])}, punti {sum(len(t["punti"]) for t in s["tratti"])}')
        # cm: quanto del disegno si vede e quanto no; cm_tessuto: la linea intera sulla stoffa (torace, pancia e bacino
        # anche nelle code dietro le maniche, che non si disegnano)
        controllo[nome] = {'cm': {k: round(v, 2) for k, v in cm.items()}, 'cm_totale': round(tot, 2), 'chiuso': chiuso,
                           'cm_tessuto': round(lunghezza(m['punti'], chiuso) * 100, 2),
                           'punti_3d_riposo': np.round(m['punti'], 5).tolist()}
        if 'quota' in m:
            controllo[nome]['quota'] = round(m['quota'], 5)
        if 'cartamodello' in m:
            controllo[nome]['cm_cartamodello'] = round(m['cartamodello'] * 100, 2)
    os.makedirs(os.path.dirname(os.path.abspath(a.uscita)), exist_ok=True)
    with open(a.uscita, 'w') as f:
        json.dump(dati, f, ensure_ascii=False, separators=(',', ':'))
        f.write('\n')
    print(f'\n{a.uscita}: {os.path.getsize(a.uscita) // 1024} KB')
    if a.controllo:
        extra = {k: (np.round(v, 5).tolist() if isinstance(v, np.ndarray) else v) for k, v in linee['_punti'].items()}
        with open(a.controllo, 'w') as f:
            json.dump({'misure': controllo, 'punti': extra}, f, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
