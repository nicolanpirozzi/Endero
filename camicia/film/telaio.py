"""La camicia del configuratore come film: ciò che serve alla fisica della stoffa.

Dalla camicia comprata ricava il "telaio": la stessa camicia semplificata a qualche migliaio di punti, su cui
`muovi.mjs` simula il tocco di una mano (con la fisica di `stoffa.mjs`). Scrive anche dove stanno, a riposo,
tutti i punti veri della camicia e dei bottoni: `muovi.mjs` li farà seguire il telaio, fotogramma per fotogramma.

    <venv>/bin/python camicia/film/telaio.py <file .blend comprato> <cartella di uscita>

Nel file la camicia è fatta di 28 pezzi di cartamodello accostati, non cuciti: lungo le cuciture i bordi combaciano
solo in parte (due vertici su cinque coincidono, quattro su cinque stanno entro due millimetri). Per la fisica i
bordi vicini si saldano; ciò che resta lo tengono insieme le "cuciture" di stoffa.mjs (lembi sovrapposti).
Assi di uscita: quelli di stoffa.mjs, cioè X a destra, Y in alto, Z verso chi guarda.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import scena  # noqa: E402  (importa bpy)
import bpy  # noqa: E402
import bmesh  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Vector  # noqa: E402
from mathutils.bvhtree import BVHTree  # noqa: E402
from scipy.spatial import cKDTree  # noqa: E402

FACCE = 9000            # triangoli del telaio


def per_stoffa(q):
    """Dagli assi di Blender (davanti verso -Y, Z in alto) a quelli di stoffa.mjs (Y in alto, davanti verso +Z)."""
    q = np.asarray(q, dtype=np.float64)
    return np.stack([q[:, 0], q[:, 2], -q[:, 1]], axis=1)


def main():
    file_blend, uscita = sys.argv[1], sys.argv[2]
    os.makedirs(uscita, exist_ok=True)
    camicia, bottoni, gruccia = scena.apri(file_blend)
    scena.togli_bottoni_del_colletto(bottoni)
    co = scena._mondo(camicia)
    pezzi = scena._pezzi(camicia.data)
    di_quale = np.zeros(len(co), dtype=np.int32)
    for k, p in enumerate(pezzi):
        di_quale[p] = k

    # --- le zone: maniche (pendono libere), collo e polsini (rigidi), ciò che sta sulla gruccia (appeso)
    parte = np.zeros(len(co), dtype=np.int32); rigido = np.zeros(len(co))
    alto = co[:, 2].max()
    for p in pezzi:
        c = co[p].mean(axis=0); misure = np.ptp(co[p], axis=0)
        if abs(c[0]) > 0.17 and c[2] < alto - 0.17:                 # manica, polsino, fessino del polso
            parte[p] = 1 if c[0] > 0 else 2
            if c[2] < co[:, 2].min() + 0.14 and misure[2] < 0.12:
                rigido[p] = 1.0                                      # il polsino
        elif c[2] > alto - 0.14:                                    # collo, listino, carré
            rigido[p] = 1.0
        elif misure[0] < 0.06 and misure[2] > 0.5:                  # le due liste dell'abbottonatura
            rigido[p] = 0.5
    albero_gruccia = BVHTree.FromPolygons([tuple(v) for v in scena._mondo(gruccia)], [tuple(f.vertices) for f in gruccia.data.polygons])
    dalla_gruccia = np.array([albero_gruccia.find_nearest(Vector(q))[3] for q in co])
    gradino = lambda a, b, x: np.clip((x - a) / (b - a), 0, 1) ** 2 * (3 - 2 * np.clip((x - a) / (b - a), 0, 1))
    # appeso: ciò che tocca la gruccia è fermo; il collo quasi; un palmo più giù il tessuto è libero
    appeso = np.maximum(1 - gradino(0.012, 0.07, dalla_gruccia), 0.93 * gradino(alto - 0.13, alto - 0.07, co[:, 2]))
    # le spalle sporgono oltre la gruccia: lì il tessuto è libero ma tiene la forma, o muovendosi si gonfierebbero
    appeso = np.maximum(appeso, 0.55 * gradino(alto - 0.22, alto - 0.11, co[:, 2]))

    # --- il telaio: i pezzi si saldano lungo i bordi vicini, poi tutto si semplifica
    me = camicia.data.copy()
    bm = bmesh.new(); bm.from_mesh(me)
    bm.transform(camicia.matrix_world)
    bordo = list({v for e in bm.edges if e.is_boundary for v in e.verts})
    bmesh.ops.remove_doubles(bm, verts=bordo, dist=0.0025)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0001)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new('telaio', me); bpy.context.scene.collection.objects.link(ob)
    m = ob.modifiers.new('semplifica', 'DECIMATE'); m.ratio = min(1.0, FACCE / len(me.polygons)); m.use_collapse_triangulate = True
    dg = bpy.context.evaluated_depsgraph_get()
    semplice = bpy.data.meshes.new_from_object(ob.evaluated_get(dg), depsgraph=dg)
    bm = bmesh.new(); bm.from_mesh(semplice); bmesh.ops.triangulate(bm, faces=bm.faces)
    punti = np.array([v.co[:] for v in bm.verts]); tri = np.array([[v.index for v in f.verts] for f in bm.faces])
    liberi = sum(1 for e in bm.edges if e.is_boundary)
    bm.free()
    vicino = cKDTree(co).query(punti)[1]                             # ogni punto del telaio eredita le zone dal vertice vero più vicino
    print('telaio: punti', len(punti), '· triangoli', len(tri), '· lati liberi', liberi,
          '· appesi', int((appeso[vicino] >= 0.9).sum()), '· maniche', int((parte[vicino] > 0).sum()), '· rigidi', int((rigido[vicino] > 0.9).sum()))

    with open(os.path.join(uscita, 'telaio.json'), 'w') as f:
        json.dump({'punti': np.round(per_stoffa(punti), 5).ravel().tolist(), 'triangoli': tri.ravel().tolist(),
                   'appeso': np.round(appeso[vicino], 3).tolist(), 'rigido': np.round(rigido[vicino], 2).tolist(), 'parte': parte[vicino].tolist()}, f, separators=(',', ':'))

    # --- i punti veri: la camicia, e i bottoni pezzo per pezzo (ogni bottone si muove intero)
    co_b = scena._mondo(bottoni)
    gruppo = np.zeros(len(co_b), dtype=np.int32)
    # un bottone è fatto di tre pezzi (il disco e due fili): stanno insieme se i loro centri coincidono
    centri = [co_b[p].mean(axis=0) for p in scena._pezzi(bottoni.data)]
    capi = []
    for k, p in enumerate(scena._pezzi(bottoni.data)):
        g = next((j for j, c in enumerate(capi) if np.linalg.norm(c - centri[k]) < 0.008), None)
        if g is None:
            capi.append(centri[k]); g = len(capi) - 1
        gruppo[p] = g
    per_stoffa(co).astype('<f4').tofile(os.path.join(uscita, 'camicia.f32'))
    per_stoffa(co_b).astype('<f4').tofile(os.path.join(uscita, 'bottoni.f32'))
    gruppo.astype('<i4').tofile(os.path.join(uscita, 'bottoni-gruppi.i32'))
    parte.astype('<i4').tofile(os.path.join(uscita, 'camicia-parte.i32'))
    with open(os.path.join(uscita, 'misure.json'), 'w') as f:
        presa = scena.appiglio(gruccia)
        json.dump({'camicia': len(co), 'bottoni': len(co_b), 'gruppi_di_bottoni': len(capi), 'riposo': scena.RIPOSO,
                   'appiglio': [round(float(v), 5) for v in per_stoffa([presa[:]])[0]], 'ancora': scena.ANCORA}, f)
    print('camicia: vertici', len(co), '· bottoni: vertici', len(co_b), 'in', len(capi), 'bottoni')


if __name__ == '__main__':
    main()
