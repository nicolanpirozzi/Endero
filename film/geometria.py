"""Geometria del ricamo: da contorni (logo SVG, testo) a punti di ricamo e tubi di filo.

Solo numpy, shapely e fontTools: nessuna dipendenza da Blender, così si prova da solo.
Unità: metri. Il tessuto sta sul piano z = 0, la cucitura corre lungo l'asse Y.
"""
import math
import re

import numpy as np
from shapely import affinity
from shapely.geometry import LineString, MultiPolygon, Polygon
from shapely.ops import unary_union

MM = 0.001


# ---------------------------------------------------------------- contorni

def _cubica(p0, p1, p2, p3, n=10):
    t = np.linspace(0, 1, n + 1)[1:, None]
    return ((1 - t) ** 3) * p0 + 3 * ((1 - t) ** 2) * t * p1 + 3 * (1 - t) * t * t * p2 + (t ** 3) * p3


def contorni_da_svg(d):
    """Legge un attributo `d` con comandi assoluti M, L, C, Z e restituisce i contorni chiusi."""
    tok = re.findall(r"[MLCZ]|-?\d*\.?\d+(?:e-?\d+)?", d)
    contorni, cur, i, cmd = [], [], 0, None
    num = lambda k: np.array([float(tok[k]), float(tok[k + 1])])
    while i < len(tok):
        if tok[i] in "MLCZ":
            cmd = tok[i]
            i += 1
            if cmd == "Z":
                if len(cur) > 2:
                    contorni.append(np.array(cur))
                cur = []
            continue
        if cmd == "M":
            if len(cur) > 2:
                contorni.append(np.array(cur))
            cur = [num(i)]
            i += 2
            cmd = "L"
        elif cmd == "L":
            cur.append(num(i))
            i += 2
        elif cmd == "C":
            pts = _cubica(cur[-1], num(i), num(i + 2), num(i + 4))
            cur.extend(list(pts))
            i += 6
        else:
            raise ValueError("comando SVG non gestito: %r" % cmd)
    if len(cur) > 2:
        contorni.append(np.array(cur))
    return contorni


def pari_dispari(contorni):
    """Unisce i contorni con la regola pari-dispari (come fill-rule=evenodd)."""
    res = None
    for c in sorted(contorni, key=lambda c: -abs(Polygon(c).area)):
        p = Polygon(c).buffer(0)
        res = p if res is None else res.symmetric_difference(p)
    return res


def logo_da_svg(percorso_svg, larghezza, centro=(0.0, 0.0)):
    """Poligoni del logo, larghi `larghezza` metri, centrati in `centro`, con la Y verso l'alto."""
    testo = open(percorso_svg, encoding="utf8").read()
    d = re.search(r' d="([^"]+)"', testo).group(1)
    forma = pari_dispari(contorni_da_svg(d))
    minx, miny, maxx, maxy = forma.bounds
    s = larghezza / (maxx - minx)
    forma = affinity.translate(forma, -(minx + maxx) / 2, -(miny + maxy) / 2)
    forma = affinity.scale(forma, s, -s, origin=(0, 0))
    return affinity.translate(forma, centro[0], centro[1])


def testo_in_poligoni(percorso_ttf, testo, altezza_maiuscola, origine=(0.0, 0.0), allinea="sinistra", spaziatura=0.02):
    """Contorni di una scritta. `origine` è la linea di base; `allinea` vale sinistra, destra o centro."""
    from fontTools.pens.basePen import BasePen
    from fontTools.ttLib import TTFont

    font = TTFont(percorso_ttf)
    gs, cmap = font.getGlyphSet(), font.getBestCmap()
    upm = font["head"].unitsPerEm
    scala = altezza_maiuscola / font["OS/2"].sCapHeight

    class Penna(BasePen):
        def __init__(self):
            super().__init__(gs)
            self.contorni, self.cur = [], []

        def _moveTo(self, p):
            self.cur = [np.array(p, float)]

        def _lineTo(self, p):
            self.cur.append(np.array(p, float))

        def _curveToOne(self, a, b, c):
            self.cur.extend(list(_cubica(self.cur[-1], np.array(a, float), np.array(b, float), np.array(c, float), 8)))

        def _qCurveToOne(self, a, b):
            p0, a, b = self.cur[-1], np.array(a, float), np.array(b, float)
            t = np.linspace(0, 1, 9)[1:, None]
            self.cur.extend(list(((1 - t) ** 2) * p0 + 2 * (1 - t) * t * a + t * t * b))

        def _closePath(self):
            if len(self.cur) > 2:
                self.contorni.append(np.array(self.cur))
            self.cur = []

        _endPath = _closePath

    pezzi, x = [], 0.0
    for ch in testo:
        nome = cmap.get(ord(ch))
        if nome is None:
            x += 0.3 * upm
            continue
        penna = Penna()
        gs[nome].draw(penna)
        if penna.contorni:
            area = lambda c: 0.5 * float(np.sum(c[:, 0] * np.roll(c[:, 1], -1) - np.roll(c[:, 0], -1) * c[:, 1]))
            segno = math.copysign(1, area(max(penna.contorni, key=lambda c: abs(area(c)))))
            pieni = [Polygon(c).buffer(0) for c in penna.contorni if math.copysign(1, area(c)) == segno]
            vuoti = [Polygon(c).buffer(0) for c in penna.contorni if math.copysign(1, area(c)) != segno]
            g = unary_union(pieni)
            if vuoti:
                g = g.difference(unary_union(vuoti))
            pezzi.append(affinity.translate(g, x, 0))
        x += gs[nome].width + spaziatura * upm
    forma = unary_union(pezzi)
    forma = affinity.scale(forma, scala, scala, origin=(0, 0))
    larg = (x - spaziatura * upm) * scala
    dx = {"sinistra": 0.0, "destra": -larg, "centro": -larg / 2}[allinea]
    return affinity.translate(forma, origine[0] + dx, origine[1])


def parti(forma):
    """Le parti staccate di una forma, ordinate da sinistra a destra."""
    geoms = list(forma.geoms) if isinstance(forma, MultiPolygon) else [forma]
    return sorted([g for g in geoms if g.area > 1e-10], key=lambda g: g.centroid.x)


# ---------------------------------------------------------------- punti di ricamo

def riempi_tatami(forma, angolo=45.0, passo=0.36 * MM, lmax=4.5 * MM, seme=1):
    """Riempimento a file parallele, spezzate a mattoncino quando sono lunghe.

    Restituisce un array (N, 2, 2): per ogni punto, inizio e fine sul piano, nell'ordine di cucitura.
    """
    rng = np.random.default_rng(seme)
    punti = []
    for poli in parti(forma):
        c = (poli.centroid.x, poli.centroid.y)
        pr = affinity.rotate(poli, -angolo, origin=c)
        minx, miny, maxx, maxy = pr.bounds
        k, y, locali = 0, miny + passo * 0.5, []
        while y < maxy:
            yy = y + rng.normal(0, passo * 0.06)
            inter = LineString([(minx - 1, yy), (maxx + 1, yy)]).intersection(pr)
            segs = []
            for g in getattr(inter, "geoms", [inter]):
                if g.geom_type == "LineString" and g.length > passo * 0.6:
                    xs = sorted([g.coords[0][0], g.coords[-1][0]])
                    segs.append(xs)
            segs.sort()
            riga = []
            for xa, xb in segs:
                sfalso = ((k % 3) / 3.0) * lmax
                tagli = [xa]
                x = math.floor((xa - sfalso) / lmax) * lmax + sfalso + lmax
                while x < xb - lmax * 0.28:
                    if x > xa + lmax * 0.28:
                        tagli.append(x + rng.normal(0, lmax * 0.02))
                    x += lmax
                tagli.append(xb)
                for a, b in zip(tagli[:-1], tagli[1:]):
                    riga.append(((a, yy), (b, yy)))
            if k % 2:
                riga = [(b, a) for a, b in reversed(riga)]
            locali.extend(riga)
            y += passo
            k += 1
        if locali:
            arr = np.array(locali)                      # (n, 2, 2)
            ang = math.radians(angolo)
            ca, sa = math.cos(ang), math.sin(ang)
            d = arr - np.array(c)
            rot = np.stack([d[..., 0] * ca - d[..., 1] * sa, d[..., 0] * sa + d[..., 1] * ca], axis=-1) + np.array(c)
            punti.append(rot)
    return np.concatenate(punti) if punti else np.zeros((0, 2, 2))


def contorno_a_punti(forma, passo=1.6 * MM, rientro=0.12 * MM):
    """Impuntura lungo il bordo, appena dentro la forma: rende netto il profilo del ricamo."""
    punti = []
    for poli in parti(forma):
        dentro = poli.buffer(-rientro)
        for g in getattr(dentro, "geoms", [dentro]):
            if g.is_empty:
                continue
            for anello in [g.exterior] + list(g.interiors):
                n = max(3, int(anello.length / passo))
                pts = np.array([anello.interpolate(i / n, normalized=True).coords[0] for i in range(n + 1)])
                punti.append(np.stack([pts[:-1], pts[1:]], axis=1))
    return np.concatenate(punti) if punti else np.zeros((0, 2, 2))


def impuntura(y_inizio, y_fine, passo=3.5 * MM, x=0.0):
    """Cucitura dritta lungo Y, da y_inizio verso y_fine (Y decrescente). Restituisce (N, 2, 2)."""
    n = int(round(abs(y_fine - y_inizio) / passo))
    ys = y_inizio - np.arange(n + 1) * passo
    a = np.stack([np.full(n, x), ys[:-1]], axis=1)
    b = np.stack([np.full(n, x), ys[1:]], axis=1)
    return np.stack([a, b], axis=1)


# ---------------------------------------------------------------- dal punto al filo

PROFILO_T = np.array([0.0, 0.06, 0.18, 0.5, 0.82, 0.94, 1.0])


def fili_3d(punti, raggio, quota=None, gonfiore=0.10 * MM, affondo=0.55, seme=2):
    """Trasforma ogni punto (N, 2, 2) in una linea 3D (N, 7, 3): estremi affondati nel tessuto, centro in rilievo."""
    rng = np.random.default_rng(seme)
    n = len(punti)
    t = PROFILO_T[None, :, None]
    p = punti[:, 0:1, :] * (1 - t) + punti[:, 1:2, :] * t                       # (N, 7, 2)
    lung = np.linalg.norm(punti[:, 1] - punti[:, 0], axis=1)                    # (N,)
    arco = np.sin(np.pi * PROFILO_T) ** 0.45                                    # piatto in mezzo, ripido ai capi
    alto = raggio * (1.0 + rng.normal(0, 0.05, n)) + np.minimum(gonfiore, 0.035 * lung)
    z = -raggio * affondo + (alto[:, None] + raggio * affondo) * arco[None, :]
    if quota is not None:
        z = z + quota(p[..., 0], p[..., 1])
    return np.concatenate([p, z[..., None]], axis=-1), lung


def tubi(linee, raggio, lati=6, lung_uv=1.0 * MM):
    """Mesh di tubi lungo linee (N, n, 3). Restituisce vertici, facce quadrate e UV per angolo di faccia."""
    N, n, _ = linee.shape
    tang = np.gradient(linee, axis=1)
    tang /= np.linalg.norm(tang, axis=-1, keepdims=True) + 1e-12
    su = np.zeros_like(tang)
    su[..., 2] = 1.0
    quasi_vert = np.abs(tang[..., 2]) > 0.95
    su[quasi_vert] = np.array([1.0, 0.0, 0.0])
    bino = np.cross(tang, su)
    bino /= np.linalg.norm(bino, axis=-1, keepdims=True) + 1e-12
    norm = np.cross(bino, tang)
    a = np.linspace(0, 2 * np.pi, lati, endpoint=False)
    anelli = linee[:, :, None, :] + raggio * (np.cos(a)[None, None, :, None] * bino[:, :, None, :] + np.sin(a)[None, None, :, None] * norm[:, :, None, :])
    vert = anelli.reshape(-1, 3)
    i = np.arange(N)[:, None, None]
    s = np.arange(n - 1)[None, :, None]
    j = np.arange(lati)[None, None, :]
    j2 = (j + 1) % lati
    base = lambda ss, jj: (i * n + ss) * lati + jj
    facce = np.stack([base(s, j), base(s, j2), base(s + 1, j2), base(s + 1, j)], axis=-1).reshape(-1, 4)
    seg = np.linalg.norm(np.diff(linee, axis=1), axis=-1)
    u = np.concatenate([np.zeros((N, 1)), np.cumsum(seg, axis=1)], axis=1) / lung_uv            # (N, n)
    u0 = np.broadcast_to(u[:, :-1, None], (N, n - 1, lati))
    u1 = np.broadcast_to(u[:, 1:, None], (N, n - 1, lati))
    v0 = np.broadcast_to((j / lati).astype(float), (N, n - 1, lati))
    v1 = np.broadcast_to(((j + 1) / lati).astype(float), (N, n - 1, lati))
    uv = np.stack([np.stack([u0, v0], -1), np.stack([u0, v1], -1), np.stack([u1, v1], -1), np.stack([u1, v0], -1)], axis=-2).reshape(-1, 2)
    return vert, facce, uv


def infittisci(linee, m=28):
    """Ricampiona ogni linea (N, n, 3) con m punti lungo una curva morbida (Catmull-Rom)."""
    N, n, _ = linee.shape
    q = np.concatenate([2 * linee[:, :1] - linee[:, 1:2], linee, 2 * linee[:, -1:] - linee[:, -2:-1]], axis=1)
    u = np.linspace(0, n - 1, m)
    k = np.minimum(np.floor(u).astype(int), n - 2)
    f = (u - k)[None, :, None]
    a, b, c, d = q[:, k], q[:, k + 1], q[:, k + 2], q[:, k + 3]
    return 0.5 * ((2 * b) + (-a + c) * f + (2 * a - 5 * b + 4 * c - d) * f * f + (-a + 3 * b - 3 * c + d) * f ** 3)


def ritorci(linee, raggio, capi=3, passo_elica=1.7 * MM, fase=0.0):
    """Sostituisce ogni filo con `capi` fili più sottili avvolti a elica: il filo ritorto vero.

    Restituisce le linee dei capi (N * capi, n, 3) e il raggio di ogni capo.
    """
    N, n, _ = linee.shape
    tang = np.gradient(linee, axis=1)
    tang /= np.linalg.norm(tang, axis=-1, keepdims=True) + 1e-12
    su = np.zeros_like(tang)
    su[..., 2] = 1.0
    su[np.abs(tang[..., 2]) > 0.95] = np.array([1.0, 0.0, 0.0])
    bino = np.cross(tang, su)
    bino /= np.linalg.norm(bino, axis=-1, keepdims=True) + 1e-12
    norm = np.cross(bino, tang)
    seg = np.linalg.norm(np.diff(linee, axis=1), axis=-1)
    arco = np.concatenate([np.zeros((N, 1)), np.cumsum(seg, axis=1)], axis=1)
    r_capo = raggio * (0.50 if capi == 3 else 0.56)
    r_elica = raggio - r_capo
    fuori = []
    for c in range(capi):
        th = 2 * np.pi * (arco / passo_elica + c / capi) + fase
        fuori.append(linee + r_elica * (np.cos(th)[..., None] * bino + np.sin(th)[..., None] * norm))
    return np.concatenate(fuori, axis=0), r_capo


# ---------------------------------------------------------------- prova a vista

if __name__ == "__main__":
    import sys
    from PIL import Image, ImageDraw

    svg, ttf, out = sys.argv[1:4]
    logo = logo_da_svg(svg, 0.105)
    num = testo_in_poligoni(ttf, "1996", 0.019, origine=(-0.04, -0.07))
    img = Image.new("RGB", (2000, 1500), (15, 40, 94))
    dr = ImageDraw.Draw(img)
    px = lambda p: (1000 + p[0] * 14000, 600 - p[1] * 14000)
    for nome, forma, ang in (("logo", logo, 62.0), ("1996", num, 45.0)):
        pt = riempi_tatami(forma, ang)
        bordo = contorno_a_punti(forma)
        print(nome, "punti di riempimento:", len(pt), "di bordo:", len(bordo), "filo: %.1f m" % float(np.linalg.norm(pt[:, 1] - pt[:, 0], axis=1).sum()))
        for a, b in pt:
            dr.line([px(a), px(b)], fill=(245, 242, 235), width=3)
        for a, b in bordo:
            dr.line([px(a), px(b)], fill=(200, 196, 186), width=2)
    img.save(out)
