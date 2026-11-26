"""Il taschino, e dove stanno sulla camicia le parti che il configuratore evidenzia (proprietario, 2026-11-25:
«Se il taschino è si deve comparire un taschino anche nel 3d. Si evidenzia la parte nel 3d mentre si seleziona con zoom»).

    <venv>/bin/python camicia/opzioni/parti.py taschino <file .blend comprato> <cartella di lavoro> [--campioni 96] [--volte 4]
    <venv>/bin/python camicia/opzioni/parti.py mappa <file .blend comprato> <cartella di lavoro> [--solo italiano,club]
    <venv>/bin/python camicia/opzioni/parti.py trama <file .blend comprato> <cartella di lavoro>     (prova del tessuto sulla camicia)

`taschino` calcola taschino-<volte>x.png: il riquadro del petto con il taschino (un pezzo di stoffa ritagliato dal
davanti della camicia, quindi con le sue stesse pieghe, appena sollevato) e senza-taschino-<volte>x.png, lo stesso
riquadro senza: `monta.py` ne ricava il pezzo da sovrapporre.
`mappa` non calcola la luce: per ogni collo scrive mappa-<collo>.png, il fotogramma (a grandezza doppia) in cui ogni
parte della camicia ha un colore suo (colletto, listino, polsini, bottoni, taschino…), e punti-<collo>.json con i punti
che servono per le iniziali. Da lì `monta.py` ricava i contorni tratteggiati e i riquadri dello zoom.
"""
import argparse
import json
import math
import os
import sys

QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, QUI)
sys.path.insert(0, os.path.join(QUI, '..', 'film'))
sys.path.insert(0, os.path.join(QUI, '..', 'guide'))
import colli  # noqa: E402

LARGA, ALTA = colli.LARGA, colli.ALTA
RIQUADRO_TASCHINO = (740, 370, 910, 560)       # x0, y0, x1, y1 nel fotogramma: il petto a destra di chi guarda
# Il taschino, in metri nelle coordinate del file (X a destra di chi guarda, Z in alto): sul petto sinistro di chi la
# indossa. Largo 10,5 cm, alto 12,5, con il fondo a punta appena accennata e gli angoli smussati.
TASCHINO = {'centro_x': 0.118, 'cima_z': -0.305, 'largo': 0.105, 'alto': 0.125, 'punta': 0.014, 'smusso': 0.006,
            'sollevato': 0.0014, 'orlo': 0.024, 'orlo_sollevato': 0.0024}
# i colori della mappa (emissione pura): uno per parte
COLORI = {'altro': (0.0, 0.0, 0.0), 'camicia': (0.25, 0.25, 0.25), 'colletto': (1, 0, 0), 'listino': (0, 1, 0), 'polsino_a': (0, 0, 1), 'polsino_b': (1, 1, 0),
          'bottoni': (1, 0, 1), 'taschino': (0, 1, 1), 'cannoncino': (1, 0.5, 0), 'dentro': (0.5, 0, 1)}


def sagoma_taschino():
    from shapely.geometry import Polygon
    t = TASCHINO
    x0, x1 = t['centro_x'] - t['largo'] / 2, t['centro_x'] + t['largo'] / 2
    z1, z0 = t['cima_z'], t['cima_z'] - t['alto']
    p = Polygon([(x0, z1), (x1, z1), (x1, z0 + t['punta']), (t['centro_x'], z0), (x0, z0 + t['punta'])])
    return p.buffer(-t['smusso'], join_style=1).buffer(t['smusso'], join_style=1)


def _ritaglio(bm, facce, resta, bmesh, solleva, M):
    """Una copia delle facce, ritagliata sulla forma `resta` (nel piano X-Z del file: `M` porta lì i punti della
    maglia, che nel file è girata) e sollevata di `solleva` metri verso chi guarda."""
    from shapely.geometry import Point
    copia = bmesh.ops.duplicate(bm, geom=facce)['geom']
    vv = [g for g in copia if isinstance(g, bmesh.types.BMVert)]
    bordo = resta.boundary

    def campo(v):
        w = M @ v.co
        p = Point(w.x, w.z)
        d = bordo.distance(p)
        d = d if resta.contains(p) else -d
        return d if abs(d) > 1e-7 else 1e-7
    f = {v: campo(v) for v in vv}
    nuovi = set()
    for e in {e for v in vv for e in v.link_edges}:
        a, b = e.verts
        if a in f and b in f and f[a] * f[b] < 0:
            _, v = bmesh.utils.edge_split(e, a, f[a] / (f[a] - f[b]))
            f[v] = 0.0; nuovi.add(v)
    for faccia in {x for v in nuovi for x in v.link_faces}:
        sul = [v for v in faccia.verts if v in nuovi]
        if len(sul) == 2 and not any(e for e in faccia.edges if sul[0] in e.verts and sul[1] in e.verts):
            bmesh.utils.face_split(faccia, sul[0], sul[1])
    bmesh.ops.delete(bm, geom=[v for v, val in f.items() if val < 0 and v.is_valid], context='VERTS')
    resti = [v for v in f if v.is_valid]
    bm.normal_update()
    R = M.to_3x3(); Ri = R.inverted()
    for v in resti:
        n = (R @ v.normal).normalized()
        if n.y > 0:
            n = -n
        v.co += Ri @ (n * solleva)
    return resti


def metti_taschino(camicia, scena, bmesh, np, riposo):
    """Aggiunge il taschino alla camicia (`riposo`: dove stava la camicia nel file, prima di appenderla).
    Restituisce gli indici dei suoi punti."""
    from shapely.geometry import box
    t = TASCHINO
    me = camicia.data
    M = riposo.copy()
    co = np.array([v.co[:] for v in me.vertices]) @ np.array(M.to_3x3()).T
    # il davanti a destra di chi guarda: il pezzo grande che sta quasi tutto a X positivo, davanti (Y negativo)
    pezzi = [p for p in scena._pezzi(me) if len(p) > 3000 and co[p][:, 0].mean() > 0.05 and co[p][:, 0].max() < 0.25]
    davanti = min(pezzi, key=lambda p: co[p][:, 1].mean())
    dentro = set(davanti)
    forma = sagoma_taschino()
    x0, z0, x1, z1 = forma.bounds
    bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table(); bm.faces.ensure_lookup_table()
    m = 0.02
    facce = [f for f in bm.faces if f.verts[0].index in dentro and all(x0 - m < (M @ v.co).x < x1 + m and z0 - m < (M @ v.co).z < z1 + m for v in f.verts)]
    prima = len(bm.verts)
    tasca = _ritaglio(bm, facce, forma, bmesh, t['sollevato'], M)
    # l'orlo in cima: la stoffa ripiegata, una striscia appena più sollevata
    facce = [f for f in bm.faces if f.verts[0].index in dentro and all(x0 - m < (M @ v.co).x < x1 + m and z1 - t['orlo'] - m < (M @ v.co).z < z1 + m for v in f.verts)]
    orlo = _ritaglio(bm, facce, forma.intersection(box(x0 - 1, z1 - t['orlo'], x1 + 1, z1 + 1)), bmesh, t['orlo_sollevato'], M)
    bm.verts.index_update()
    indici = [v.index for v in tasca + orlo]
    bm.to_mesh(me); bm.free(); me.update()
    print(f'taschino: {len(indici)} punti (la camicia ne aveva {prima})', flush=True)
    return indici


def taschino(a):
    import retro
    for nome, con in (('senza-taschino', False), ('taschino', True)):
        file = os.path.join(os.path.abspath(a.uscita), f'{nome}-{a.volte}x.png')
        if os.path.exists(file) and not a.rifai:
            print(f'{file}: già fatto', flush=True)
            continue
        import scena
        import bpy
        import bmesh
        import numpy as np
        pezzi = scena.costruisci(a.blend, LARGA * a.volte, ALTA * a.volte, a.campioni)
        if con:
            metti_taschino(pezzi['camicia'], scena, bmesh, np, pezzi['a_riposo']['camicia'])
            bpy.context.view_layer.update()
        colli.inquadra(bpy, RIQUADRO_TASCHINO)
        print(f'{nome}-{a.volte}x.png in {retro.calcola(bpy, file):.0f} s', flush=True)
        bpy.ops.wm.read_factory_settings(use_empty=True)


def _emissione(bpy, nome, colore):
    m = bpy.data.materials.new('mappa-' + nome); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    e = nt.nodes.new('ShaderNodeEmission'); e.inputs['Color'].default_value = (*colore, 1); e.inputs['Strength'].default_value = 1
    u = nt.nodes.new('ShaderNodeOutputMaterial'); nt.links.new(e.outputs[0], u.inputs['Surface'])
    return m


def _nel_fotogramma(bpy, punto):
    from bpy_extras.object_utils import world_to_camera_view
    sc = bpy.context.scene
    q = world_to_camera_view(sc, sc.camera, punto)
    return [round(q.x * LARGA, 2), round((1 - q.y) * ALTA, 2)]


def mappa(a):
    """Per ogni collo: il fotogramma con un colore per parte, e i punti per le iniziali."""
    import importlib
    import retro
    quali = [x for x in a.solo.split(',') if x] or colli.COLLI
    for nome in quali:
        file = os.path.join(os.path.abspath(a.uscita), f'mappa-{nome}.png')
        if os.path.exists(file) and not a.rifai:
            print(f'{file}: già fatto', flush=True)
            continue
        import scena
        importlib.reload(scena)
        a.volte, a.campioni = 2, 1
        _, bpy, pezzi = colli.prepara(nome, a)
        import bmesh
        import numpy as np
        from mathutils import Vector
        camicia = pezzi['camicia']
        me = camicia.data
        riposo = pezzi['a_riposo']['camicia']
        tasca = set(metti_taschino(camicia, scena, bmesh, np, riposo)) if nome == 'italiano' else set()
        co = np.array([v.co[:] for v in me.vertices]) @ np.array(riposo.to_3x3()).T      # dove stanno nel file: X a destra, Z in alto
        isole = scena._pezzi(me)
        # dove sta ogni pezzo nel cartamodello: la media delle UV dei suoi punti
        uvl = me.uv_layers.active.data
        somma = np.zeros((len(me.vertices), 2)); quante = np.zeros(len(me.vertices))
        for l in me.loops:
            somma[l.vertex_index] += uvl[l.index].uv[:]; quante[l.vertex_index] += 1
        uv_punto = somma / np.maximum(quante, 1)[:, None]
        uv_medio = {p[0]: uv_punto[p].mean(0) for p in isole}
        # chi è chi, dalla posizione nel file: colletto il più alto (se c'è ancora), poi il listino; polsini in fondo alle maniche
        def tipo(p):
            q = co[p]
            if tasca and p[0] in tasca:
                return 'taschino'
            # colletto e listino si riconoscono dal posto che hanno nel cartamodello (le UV): un colletto ritagliato può
            # essere in più pezzi (le alette del diplomatico), ma nel cartamodello resta dov'era
            u, v = uv_medio[p[0]]
            if 0.24 < u < 0.60 and 0.915 < v < 0.972:
                return 'colletto'
            if 0.24 < u < 0.60 and 0.850 < v < 0.892:
                return 'listino'
            if 400 < len(p) < 700 and q[:, 2].max() < -0.75 and q[:, 2].min() > -0.87 and abs(q[:, 0]).min() > 0.19:
                return 'polsino_a' if q[:, 0].mean() < 0 else 'polsino_b'
            if 700 < len(p) < 900 and abs(q[:, 0]).max() < 0.03:
                return 'cannoncino'
            return 'camicia'

        nomi = list(COLORI)
        me.materials.clear()
        for k in nomi:
            me.materials.append(_emissione(bpy, k, COLORI[k]))
        di_chi = {}
        for p in isole:
            k = tipo(p)
            for i in p:
                di_chi[i] = nomi.index(k)
        for f in me.polygons:
            f.material_index = di_chi[f.vertices[0]]
        # il rovescio della stoffa (l'interno del collo e dei polsini) con un colore suo: si vede dove la camicia è aperta
        for o, k in ((pezzi['bottoni'], 'bottoni'),):
            o.data.materials.clear(); o.data.materials.append(_emissione(bpy, k, COLORI[k]))
        for o in (pezzi['gruccia'], pezzi['nastro'], pezzi['parete']):
            o.data.materials.clear(); o.data.materials.append(_emissione(bpy, 'altro', COLORI['altro']))
        for o in bpy.context.scene.objects:
            if o.type == 'LIGHT' or o == pezzi.get('finestra'):
                o.hide_render = True
        sc = bpy.context.scene
        sc.world.use_nodes = True
        for n in sc.world.node_tree.nodes:
            if n.type == 'BACKGROUND':
                n.inputs['Strength'].default_value = 0
        sc.cycles.samples = 4; sc.cycles.use_denoising = False
        sc.cycles.pixel_filter_type = 'BOX'; sc.cycles.filter_width = 0.01
        sc.view_settings.view_transform = 'Raw'; sc.view_settings.look = 'None'
        sc.view_settings.exposure = 0; sc.view_settings.gamma = 1
        sc.render.use_border = False
        print(f'mappa-{nome}.png in {retro.calcola(bpy, file):.0f} s', flush=True)
        # i punti per le iniziali e per lo zoom, nel fotogramma
        bpy.context.view_layer.update()
        mw = camicia.matrix_world
        Ri = riposo.to_3x3().inverted()
        punti = {}
        for k in ('polsino_a', 'polsino_b', 'colletto', 'listino', 'taschino'):
            idx = [i for i, t in di_chi.items() if nomi[t] == k]
            if idx:
                q = co[idx]
                punti[k] = {'centro': _nel_fotogramma(bpy, mw @ (Ri @ Vector(q.mean(0)))),
                            'basso': _nel_fotogramma(bpy, mw @ (Ri @ Vector(q[q[:, 2].argmin()]))), 'alto': _nel_fotogramma(bpy, mw @ (Ri @ Vector(q[q[:, 2].argmax()])))}
        bw = pezzi['bottoni'].matrix_world
        bco = np.array([v.co[:] for v in pezzi['bottoni'].data.vertices])
        punti['bottoni'] = sorted((_nel_fotogramma(bpy, bw @ Vector(bco[p].mean(0))) for p in scena._pezzi(pezzi['bottoni'].data) if len(p) > 300), key=lambda q: q[1])
        # un metro, in punti del fotogramma, all'altezza del petto
        c = Vector((0.1, -0.05, -0.35))
        punti['al_metro'] = round(abs(_nel_fotogramma(bpy, mw @ (Ri @ (c + Vector((0.1, 0, 0)))))[0] - _nel_fotogramma(bpy, mw @ (Ri @ c))[0]) * 10, 1)
        with open(os.path.join(a.uscita, f'punti-{nome}.json'), 'w') as f:
            json.dump(punti, f, indent=1)
        bpy.ops.wm.read_factory_settings(use_empty=True)


def trama(a):
    """Per ogni collo (e per la camicia con il taschino): trama-<nome>.png (16 bit), il fotogramma a grandezza doppia in cui
    ogni punto di stoffa porta scritto dove sta nel cartamodello (rosso e verde: le coordinate UV; blu 1 sulla stoffa,
    0,5 su bottoni, gruccia e nastro, 0 altrove). Serve a vestire la camicia del tessuto scelto: le righe seguono il
    verso di ogni pezzo (maniche, colletto, polsini), come su una camicia vera. `monta.py` ne fa i file del sito."""
    import importlib
    import retro
    quali = [x for x in a.solo.split(',') if x] or list(colli.COLLI) + ['taschino']
    for nome in quali:
        file = os.path.join(os.path.abspath(a.uscita), f'trama-{nome}.png')
        if os.path.exists(file) and not a.rifai:
            print(f'{file}: già fatto', flush=True)
            continue
        import scena
        importlib.reload(scena)
        a.volte, a.campioni = 2, 1
        _, bpy, pezzi = colli.prepara('italiano' if nome == 'taschino' else nome, a)
        import bmesh
        import numpy as np
        camicia = pezzi['camicia']
        if nome == 'taschino':
            metti_taschino(camicia, scena, bmesh, np, pezzi['a_riposo']['camicia'])
        # la stoffa: emette le sue coordinate nel cartamodello, più 1 nel blu
        m = bpy.data.materials.new('trama'); m.use_nodes = True
        nt = m.node_tree; nt.nodes.clear()
        uv = nt.nodes.new('ShaderNodeUVMap')
        piu = nt.nodes.new('ShaderNodeVectorMath'); piu.operation = 'ADD'; piu.inputs[1].default_value = (0, 0, 1)
        e = nt.nodes.new('ShaderNodeEmission'); u = nt.nodes.new('ShaderNodeOutputMaterial')
        nt.links.new(uv.outputs['UV'], piu.inputs[0]); nt.links.new(piu.outputs['Vector'], e.inputs['Color']); nt.links.new(e.outputs[0], u.inputs['Surface'])
        camicia.data.materials.clear(); camicia.data.materials.append(m)
        for f in camicia.data.polygons:
            f.material_index = 0
        for o in (pezzi['bottoni'], pezzi['gruccia'], pezzi['nastro']):
            o.data.materials.clear(); o.data.materials.append(_emissione(bpy, 'ferro', (0, 0, 0.5)))
        pezzi['parete'].data.materials.clear(); pezzi['parete'].data.materials.append(_emissione(bpy, 'altro', (0, 0, 0)))
        for o in bpy.context.scene.objects:
            if o.type == 'LIGHT' or o == pezzi.get('finestra'):
                o.hide_render = True
        sc = bpy.context.scene
        sc.world.use_nodes = True
        for n in sc.world.node_tree.nodes:
            if n.type == 'BACKGROUND':
                n.inputs['Strength'].default_value = 0
        sc.cycles.samples = 1; sc.cycles.use_denoising = False
        sc.cycles.pixel_filter_type = 'BOX'; sc.cycles.filter_width = 0.01
        sc.view_settings.view_transform = 'Raw'; sc.view_settings.look = 'None'
        sc.view_settings.exposure = 0; sc.view_settings.gamma = 1
        sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGB'; sc.render.image_settings.color_depth = '16'
        sc.render.dither_intensity = 0            # niente rumore aggiunto: qui i colori sono posizioni
        sc.render.use_border = False
        print(f'trama-{nome}.png in {retro.calcola(bpy, file):.0f} s', flush=True)
        bpy.ops.wm.read_factory_settings(use_empty=True)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('comando', choices=('taschino', 'mappa', 'trama'))
    ap.add_argument('blend'); ap.add_argument('uscita')
    ap.add_argument('--solo', default='')
    ap.add_argument('--campioni', type=int, default=96)
    ap.add_argument('--volte', type=int, default=4)
    ap.add_argument('--rifai', action='store_true')
    a = ap.parse_args()
    a.blend = os.path.abspath(a.blend)
    os.makedirs(a.uscita, exist_ok=True)
    {'taschino': taschino, 'mappa': mappa, 'trama': trama}[a.comando](a)


if __name__ == '__main__':
    main()
