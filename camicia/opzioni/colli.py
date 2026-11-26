"""Gli otto colli del configuratore, sulla camicia comprata (proprietario, 2026-11-25: «Collo: menu a tendina per
selezionare una delle tipologie di colli (Italiano, Francese, Mezzo Francese, Small, Botton Down, Coreano, Diplomatico,
Club)… ogni volta che seleziono anche nel 3d deve cambiare il collo»).

Il colletto del file è una striscia di stoffa ripiegata sul listino: il suo cartamodello sta nelle coordinate UV. Gli
altri colli si ottengono RITAGLIANDO quel cartamodello, come farebbe un sarto con le forbici, senza toccare come la
stoffa cade (che è la parte difficile, ed è già giusta nel file):
  italiano         il colletto del file, com'è (è l'immagine approvata);
  button down      lo stesso, con i due bottoncini sulle punte che il file aveva e che avevamo tolto;
  mezzo francese   il davanti tagliato via di un angolo: le punte si aprono;
  francese         lo stesso, di più: punte larghe;
  diplomatico      restano solo due alette davanti, ripiegate dal listino;
  coreano          niente colletto: resta il listino.
Il taglio segue una forma disegnata nel piano del cartamodello (shapely); la maglia si divide lungo quella linea.

    <venv>/bin/python camicia/opzioni/colli.py <file .blend comprato> <cartella di lavoro> [--solo francese,coreano]
                                               [--campioni 96] [--volte 4] [--rifai]

Scrive nella cartella di lavoro collo-<nome>-<volte>x.png: il riquadro del collo (RIQUADRO, punti del fotogramma
1800 x 1000) calcolato con la stessa scena e la stessa luce dell'immagine ferma. `camicia/opzioni/monta.py` ne fa i
pezzi da sovrapporre. Il Python con Blender: vedi CLAUDE.md, "Problemi già incontrati".
"""
import argparse
import math
import os
import sys

QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(QUI, '..', 'film'))
sys.path.insert(0, os.path.join(QUI, '..', 'guide'))

LARGA, ALTA = 1800, 1000
RIQUADRO = (590, 180, 850, 390)      # x0, y0, x1, y1 nel fotogramma: colletto, listino e l'ombra che fanno sul petto
# (small e club c'erano fino al 2026-11-26, quando il proprietario li ha tolti: «Elimina collo small e collo Club»;
# i loro tagli stanno nella cronologia di git: abbassa 0.017 il primo, abbassa 0.012 e punte tonde 0.021 il secondo)
COLLI = ('italiano', 'button_down', 'mezzo_francese', 'francese', 'diplomatico', 'coreano')
# le misure dei tagli, in metri sul cartamodello (o gradi)
TAGLI = {
    'mezzo_francese': {'apre': 24},
    'francese': {'apre': 46},
    'diplomatico': {'aletta': (0.050, 0.034, 0.85)},     # base lungo il listino, altezza, dove cade la punta lungo la base
}


def cartamodello(camicia, scena, bmesh, np):
    """Il colletto (il pezzo più in alto della camicia) nel piano del suo cartamodello, in metri."""
    me = camicia.data
    co = scena._mondo(camicia)
    foglia = max(scena._pezzi(me), key=lambda p: co[p][:, 2].max())
    dentro = set(foglia)
    bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
    uvl = bm.loops.layers.uv.active
    uv = {}
    for f in bm.faces:
        if f.verts[0].index in dentro:
            for l in f.loops:
                uv[l.vert.index] = (l[uvl].uv.x, l[uvl].uv.y)
    # quanti metri fa un'unità del cartamodello: dal confronto dei lati
    rapporti = []
    for e in bm.edges:
        a, b = e.verts[0].index, e.verts[1].index
        if a in dentro:
            d2 = math.hypot(uv[a][0] - uv[b][0], uv[a][1] - uv[b][1])
            if d2 > 1e-6:
                rapporti.append((e.verts[0].co - e.verts[1].co).length / d2)
    k = float(np.median(rapporti))
    piano = {i: (uv[i][0] * k, uv[i][1] * k) for i in dentro}
    # il bordo, in ordine
    vicini = {}
    for e in bm.edges:
        if e.verts[0].index in dentro and len(e.link_faces) == 1:
            a, b = e.verts[0].index, e.verts[1].index
            vicini.setdefault(a, []).append(b); vicini.setdefault(b, []).append(a)
    primo = next(iter(vicini)); giro = [primo]; prima = None
    while True:
        dopo = [v for v in vicini[giro[-1]] if v != prima]
        prima = giro[-1]
        if not dopo or dopo[0] == primo:
            break
        giro.append(dopo[0])
    bm.free()
    return dentro, piano, giro


def forma(nome, piano, giro, np):
    """La parte di cartamodello che resta per il collo `nome` (un poligono shapely), o None se resta tutto."""
    from shapely.geometry import LineString, Point, Polygon
    from shapely.ops import unary_union
    if nome not in TAGLI:
        return None
    t = TAGLI[nome]
    P = np.array([piano[i] for i in giro])
    tutto = Polygon(P)
    if not tutto.is_valid:
        tutto = tutto.buffer(0)
    # i quattro angoli: le due punte (in alto ai lati) e i due attacchi sul davanti del collo (in basso ai lati)
    angolo = {'punta_a': int(np.argmin(P[:, 0] - P[:, 1])), 'punta_b': int(np.argmax(P[:, 0] + P[:, 1])),
              'attacco_a': int(np.argmin(P[:, 0] + P[:, 1])), 'attacco_b': int(np.argmax(P[:, 0] - P[:, 1]))}
    n = len(P)

    def tratto(i, j, lungo_le_punte):
        """Il pezzo di bordo tra due angoli: quello che passa (o non passa) per l'altro lato."""
        avanti = [P[(i + s) % n] for s in range((j - i) % n + 1)]
        indietro = [P[(i - s) % n] for s in range((i - j) % n + 1)]
        return LineString(avanti if (len(avanti) > len(indietro)) == lungo_le_punte else indietro)
    # il bordo libero (da punta a punta, il lato lungo) e quello cucito al listino (da attacco ad attacco)
    libero = tratto(angolo['punta_a'], angolo['punta_b'], True)
    cucito = tratto(angolo['attacco_a'], angolo['attacco_b'], True)
    centro = np.array(tutto.centroid.coords[0])
    resta = tutto
    estremi = [(P[angolo['attacco_a']], P[angolo['punta_a']]), (P[angolo['attacco_b']], P[angolo['punta_b']])]
    if 'abbassa' in t:
        resta = resta.difference(libero.buffer(t['abbassa'], cap_style=2, join_style=1))
    if 'tonda' in t:
        r = t['tonda']
        from shapely.ops import nearest_points
        for _, punta in estremi:
            # la punta di adesso (dopo l'abbassamento): la si arrotonda da sola, il resto del bordo non cambia
            qui = Point(nearest_points(resta, Point(punta))[0].coords[0])
            vicino, attorno = qui.buffer(r * 2.2), qui.buffer(r * 4.5)
            tondo = resta.intersection(attorno).buffer(-r, join_style=1).buffer(r, join_style=1)
            resta = unary_union([resta.difference(vicino), tondo.intersection(vicino)])
    if 'apre' in t:
        for attacco, punta in estremi:
            lungo = (punta - attacco) / np.linalg.norm(punta - attacco)
            # da che parte sta il resto del colletto, rispetto al bordo davanti
            verso = 1.0 if (lungo[0] * (centro - attacco)[1] - lungo[1] * (centro - attacco)[0]) < 0 else -1.0
            a = math.radians(t['apre']) * verso
            nuovo = np.array([lungo[0] * math.cos(a) + lungo[1] * math.sin(a), -lungo[0] * math.sin(a) + lungo[1] * math.cos(a)])
            fuori = np.array([nuovo[1], -nuovo[0]]) * verso        # dal bordo nuovo verso la parte tagliata via
            L = 0.5
            via = Polygon([attacco - nuovo * L, attacco + nuovo * L, attacco + nuovo * L - fuori * L, attacco - nuovo * L - fuori * L])
            resta = resta.difference(via)
    if 'aletta' in t:
        base, alta, dove = t['aletta']
        alette = []
        for attacco, punta in estremi:
            s = cucito.project(Point(attacco))
            verso = 1.0 if s < cucito.length / 2 else -1.0
            fine = np.array(cucito.interpolate(s + verso * base).coords[0])
            lungo = (fine - attacco) / np.linalg.norm(fine - attacco)
            su = np.array([-lungo[1], lungo[0]])
            if np.dot(su, punta - attacco) < 0:
                su = -su
            cima = attacco + lungo * base * dove + su * alta
            alette.append(Polygon([attacco - lungo * 0.004, fine, cima]).buffer(0.0015, join_style=1))
        resta = resta.intersection(unary_union(alette))
    return resta


def taglia(camicia, dentro, piano, resta, bmesh, np):
    """Ritaglia il colletto lungo il bordo di `resta`: divide i lati che lo attraversano e toglie ciò che sta fuori."""
    from shapely.geometry import Point
    me = camicia.data
    bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
    bordo = resta.boundary

    def campo(i):
        p = Point(piano[i])
        d = bordo.distance(p)
        v = d if resta.contains(p) else -d
        return v if abs(v) > 1e-7 else 1e-7
    f = {bm.verts[i]: campo(i) for i in dentro}
    # 1 · un punto nuovo dove ogni lato attraversa il taglio
    nuovi = set()
    for e in [e for e in bm.edges if e.verts[0] in f and e.verts[1] in f]:
        a, b = e.verts
        if f[a] * f[b] < 0:
            _, v = bmesh.utils.edge_split(e, a, f[a] / (f[a] - f[b]))
            f[v] = 0.0; nuovi.add(v)
    # 2 · ogni faccia attraversata si divide in due lungo il taglio
    for faccia in [x for x in bm.faces if sum(1 for v in x.verts if v in nuovi) >= 2 and any(f.get(v, 1) < 0 for v in x.verts)]:
        sul = [v for v in faccia.verts if v in nuovi]
        if len(sul) == 2 and not any(e for e in faccia.edges if sul[0] in e.verts and sul[1] in e.verts):
            bmesh.utils.face_split(faccia, sul[0], sul[1])
    # 3 · via ciò che sta fuori
    via = [v for v, val in f.items() if val < 0 and v.is_valid]
    bmesh.ops.delete(bm, geom=via, context='VERTS')
    # i ritagli minuscoli rimasti staccati dal resto (una scheggia di stoffa sospesa in aria, che fa pure ombra)
    visti, schegge = set(), []
    for v in [v for v in f if v.is_valid]:
        if v in visti:
            continue
        pila, isola = [v], []
        visti.add(v)
        while pila:
            u = pila.pop(); isola.append(u)
            for e in u.link_edges:
                w = e.other_vert(u)
                if w not in visti:
                    visti.add(w); pila.append(w)
        if len(isola) < 14:
            schegge += isola
    if schegge:
        bmesh.ops.delete(bm, geom=schegge, context='VERTS')
        print(f'  tolte {len(schegge)} punte di schegge rimaste staccate', flush=True)
    resti = len([v for v in f if v.is_valid])
    bm.to_mesh(me); bm.free(); me.update()
    return len(via), resti


def prepara(nome, a):
    """La scena dell'immagine ferma con il collo `nome`. Restituisce (scena, bpy, pezzi)."""
    import scena
    import bpy
    import bmesh
    import numpy as np
    if nome == 'button_down':
        scena.togli_bottoni_del_colletto = lambda bottoni: 0      # il file li ha: per questo collo restano
    pezzi = scena.costruisci(a.blend, LARGA * a.volte, ALTA * a.volte, a.campioni)
    camicia = pezzi['camicia']
    dentro, piano, giro = cartamodello(camicia, scena, bmesh, np)
    if nome == 'coreano':
        bm = bmesh.new(); bm.from_mesh(camicia.data); bm.verts.ensure_lookup_table()
        bmesh.ops.delete(bm, geom=[bm.verts[i] for i in dentro], context='VERTS')
        bm.to_mesh(camicia.data); bm.free(); camicia.data.update()
        print(f'{nome}: tolto il colletto ({len(dentro)} punti)', flush=True)
    else:
        resta = forma(nome, piano, giro, np)
        if resta is not None:
            tolti, rimasti = taglia(camicia, dentro, piano, resta, bmesh, np)
            print(f'{nome}: tagliati via {tolti} punti, ne restano {rimasti}', flush=True)
    bpy.context.view_layer.update()
    return scena, bpy, pezzi


def inquadra(bpy, riquadro):
    sc = bpy.context.scene
    x0, y0, x1, y1 = riquadro
    sc.render.use_border = True
    sc.render.use_crop_to_border = True
    sc.render.border_min_x, sc.render.border_max_x = x0 / LARGA, x1 / LARGA
    sc.render.border_min_y, sc.render.border_max_y = 1 - y1 / ALTA, 1 - y0 / ALTA     # in Blender y va in su


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('blend'); ap.add_argument('uscita')
    ap.add_argument('--solo', default='')
    ap.add_argument('--campioni', type=int, default=96)
    ap.add_argument('--volte', type=int, default=4)
    ap.add_argument('--rifai', action='store_true')
    a = ap.parse_args()
    a.blend = os.path.abspath(a.blend)
    os.makedirs(a.uscita, exist_ok=True)
    import retro
    quali = [x for x in a.solo.split(',') if x] or COLLI
    for nome in quali:
        file = os.path.join(os.path.abspath(a.uscita), f'collo-{nome}-{a.volte}x.png')
        if os.path.exists(file) and not a.rifai:
            print(f'{file}: già fatto', flush=True)
            continue
        import importlib
        import scena
        importlib.reload(scena)                 # il collo button down cambia una funzione: ogni collo riparte pulito
        _, bpy, _ = prepara(nome, a)
        inquadra(bpy, RIQUADRO)
        print(f'collo-{nome}-{a.volte}x.png in {retro.calcola(bpy, file):.0f} s', flush=True)
        bpy.ops.wm.read_factory_settings(use_empty=True)


if __name__ == '__main__':
    main()
