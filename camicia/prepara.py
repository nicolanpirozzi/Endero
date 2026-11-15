"""Camicia 3D del configuratore: dal modello del proprietario al file per il browser.

Il proprietario ha fornito un modello già fatto (camicia a maniche lunghe, formato OBJ, 131.000 triangoli,
cartamodello vero con la mappa del tessuto in scala reale) e ha chiesto di partire da quello e migliorarlo.
Il modello originale NON sta nel repository: è materiale comprato, va tenuto fuori finché il repository è pubblico.

    <venv>/bin/python camicia/prepara.py <Shirt OBJ.obj> <cartella di uscita> [--manifesto] [--braccia GRADI]

Cosa fa:
  1. importa il modello in metri e lo centra;
  2. riduce i materiali a tre: tessuto, bottone, filo;
  3. calcola per ogni punto quanta luce d'ambiente riceve (le pieghe, sotto il collo, dentro la camicia)
     e quanto è libero di muoversi quando il puntatore lo sfiora: il visualizzatore li legge dal colore dei vertici;
  4. esporta `camicia.glb`;
  5. con --manifesto calcola anche l'immagine ferma per chi non può vedere il 3D.
Si usa come modulo Python di Blender (vedi CLAUDE.md, "Problemi già incontrati").
"""
import argparse
import math
import os
import sys

import bpy  # per primo: prepara i percorsi degli altri moduli di Blender
import bmesh  # noqa: E402
import numpy as np
from mathutils import Vector  # noqa: E402

TESSUTO = {'Front', 'Back', 'Sleeve_Right', 'Sleeve_Left', 'Shirt_Middle_Boundry', 'Cuffs_Boundry', 'Pockert_Boundry'}
BOTTONE = {'Bottons'}
FILO = {'Bottons_Threads'}


def importa(file_obj):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.wm.obj_import(filepath=file_obj, global_scale=0.01)      # il modello è in centimetri
    sc = bpy.context.scene
    ob = [o for o in sc.objects if o.type == 'MESH'][0]
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    orienta(ob)
    return sc, ob


def orienta(ob):
    """Il modello arriva con zone di facce girate al contrario: nel browser l'interno è più scuro dell'esterno,
    quindi tutte le facce devono guardare fuori. Le normali salvate nel file si buttano e si ricalcolano."""
    me = ob.data
    bm = bmesh.new(); bm.from_mesh(me)
    prima = [f.normal.copy() for f in bm.faces]
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    girate = sum(1 for f, n in zip(bm.faces, prima) if f.normal.dot(n) < 0)
    bm.to_mesh(me); bm.free()
    me.update()
    if me.has_custom_normals:
        bpy.ops.mesh.customdata_custom_splitnormals_clear()
    print('facce girate:', girate, 'su', len(me.polygons))


def abbassa_braccia(ob, gradi):
    """Il modello ha le braccia molto aperte (41 gradi dalla verticale). Le maniche si piegano verso il basso
    attorno al giro manica: sulla cucitura non si muove nulla, a 14 cm dalla cucitura la rotazione è completa,
    in mezzo cresce con dolcezza. Il corpo della camicia non si tocca."""
    if not gradi:
        return
    me = ob.data
    nomi = [m.name for m in me.materials]
    co = np.zeros((len(me.vertices), 3)); me.vertices.foreach_get('co', co.ravel())
    manica = np.zeros(len(me.vertices), bool); corpo = np.zeros(len(me.vertices), bool)
    for p in me.polygons:
        n = nomi[p.material_index]
        v = list(p.vertices)
        if n in ('Sleeve_Right', 'Sleeve_Left', 'Cuffs_Boundry'):
            manica[v] = True
        elif n in ('Front', 'Back', 'Shirt_Middle_Boundry', 'Pockert_Boundry'):
            corpo[v] = True
        elif abs(co[v[0], 0]) > 0.3:                 # bottoni e fili dei polsini
            manica[v] = True
    cucitura = manica & corpo
    manica &= ~cucitura
    from mathutils import kdtree
    a = math.radians(gradi)
    for segno in (1.0, -1.0):
        lato = co[:, 0] * segno > 0
        cuc = np.nonzero(cucitura & lato)[0]
        perno = co[cuc].mean(0)
        albero = kdtree.KDTree(len(cuc))
        for k, i in enumerate(cuc):
            albero.insert(co[i], k)
        albero.balance()
        idx = np.nonzero(manica & lato)[0]
        dist = np.array([albero.find(co[i])[2] for i in idx])
        t = np.clip(dist / 0.14, 0.0, 1.0)
        ang = a * t * t * (3 - 2 * t) * segno          # verso il corpo: il segno cambia da un lato all'altro
        rel = co[idx] - perno
        c, sn = np.cos(ang), np.sin(ang)
        # rotazione attorno all'asse davanti-dietro (Y) passante per il centro del giro manica
        co[idx, 0] = perno[0] + rel[:, 0] * c + rel[:, 2] * sn
        co[idx, 2] = perno[2] - rel[:, 0] * sn + rel[:, 2] * c
    me.vertices.foreach_set('co', co.ravel()); me.update()


def tre_materiali(ob):
    """Riduce i nove materiali del modello a tre e restituisce, per ogni faccia, 0 tessuto, 1 bottone, 2 filo."""
    me = ob.data
    vecchi = [m.name for m in me.materials]
    tipo = np.array([0 if n in TESSUTO else 1 if n in BOTTONE else 2 for n in vecchi])
    idx = np.zeros(len(me.polygons), dtype=np.int32)
    me.polygons.foreach_get('material_index', idx)
    nuovo = tipo[idx]
    me.materials.clear()
    for nome in ('tessuto', 'bottone', 'filo'):
        me.materials.append(bpy.data.materials.new(nome))
    me.polygons.foreach_set('material_index', nuovo.astype(np.int32))
    me.update()
    return nuovo


def centra(ob):
    me = ob.data
    co = np.zeros((len(me.vertices), 3)); me.vertices.foreach_get('co', co.ravel())
    centro = (co.max(0) + co.min(0)) / 2
    centro[0] = 0.0                       # resta simmetrica rispetto all'asse
    co -= centro
    me.vertices.foreach_set('co', co.ravel()); me.update()
    return co, centro


def mappa_in_scala(ob, tipo_faccia):
    """La mappa del modello è il cartamodello in scala, ma occupa quasi tre unità: la riporta tra 0 e 1
    (così il file si comprime meglio) e misura quanti metri di tessuto vale un'unità."""
    me = ob.data
    uv = np.zeros((len(me.loops), 2)); me.uv_layers[0].data.foreach_get('uv', uv.ravel())
    minimo = uv.min(0)
    ampiezza = float((uv.max(0) - minimo).max()) * 1.002
    uv = (uv - minimo) / ampiezza
    me.uv_layers[0].data.foreach_set('uv', uv.ravel())
    co = np.zeros((len(me.vertices), 3)); me.vertices.foreach_get('co', co.ravel())
    rapporti = []
    for p in me.polygons:
        if tipo_faccia[p.index]:
            continue
        li = list(p.loop_indices); v = list(p.vertices)
        for k in range(len(li)):
            l2 = np.linalg.norm(uv[li[k]] - uv[li[(k + 1) % len(li)]])
            if l2 > 1e-7:
                rapporti.append(np.linalg.norm(co[v[k]] - co[v[(k + 1) % len(v)]]) / l2)
    return float(np.median(rapporti))


def liberta(co, tipo_vertice):
    """Quanto ogni punto può muoversi: niente su collo, polsini e bottoni, molto sul corpo e a metà manica."""
    def gradino(a, b, x):
        t = np.clip((x - a) / (b - a), 0.0, 1.0)
        return t * t * (3 - 2 * t)
    z_alto = co[:, 2].max()
    collo = 1.0 - gradino(z_alto - 0.17, z_alto - 0.07, co[:, 2])            # il collo e le spalle tengono la forma
    polso = 1.0 - gradino(0.42, 0.52, np.abs(co[:, 0]))                       # i polsini sono rigidi
    abbottonatura = 0.45 + 0.55 * gradino(0.012, 0.05, np.abs(co[:, 0]))     # il cannoncino è doppio: si muove meno
    davanti = np.where(co[:, 1] < 0, abbottonatura, 1.0)
    corpo = np.where(np.abs(co[:, 0]) < 0.22, davanti, 1.0)
    lib = collo * polso * corpo
    lib[tipo_vertice > 0] = 0.0                                               # bottoni e fili seguono senza deformarsi
    return lib


def occlusione(sc, ob, campioni=96):
    """Luce d'ambiente per vertice, calcolata con Cycles. Restituisce un valore 0..1 per ogni vertice."""
    me = ob.data
    att = me.color_attributes.new('occlusione', 'FLOAT_COLOR', 'POINT')
    me.color_attributes.active_color = att
    me.color_attributes.render_color_index = me.color_attributes.find('occlusione')
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = campioni
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    for m in me.materials:                 # la cottura vuole un materiale a nodi su ogni faccia
        m.use_nodes = True
    sc.render.bake.target = 'VERTEX_COLORS'
    bpy.ops.object.bake(type='AO')
    val = np.zeros(len(me.vertices) * 4, dtype=np.float32)
    att.data.foreach_get('color', val)
    occ = val.reshape(-1, 4)[:, 0].astype(np.float64)
    me.color_attributes.remove(att)
    return occ


def liscia(valori, ob, giri=2):
    """Media con i vicini: toglie il rumore della cottura senza perdere le pieghe."""
    me = ob.data
    lati = np.zeros(len(me.edges) * 2, dtype=np.int32); me.edges.foreach_get('vertices', lati)
    a, b = lati[0::2], lati[1::2]
    n = len(me.vertices)
    conta = np.bincount(a, minlength=n) + np.bincount(b, minlength=n) + 1
    v = valori.copy()
    for _ in range(giri):
        v = (v + np.bincount(a, weights=v[b], minlength=n) + np.bincount(b, weights=v[a], minlength=n)) / conta
    return v


def scrivi_dati(ob, lib, occ):
    """Rosso: libertà di movimento. Verde: occlusione. Il visualizzatore li legge come attributo `aDati`."""
    me = ob.data
    att = me.color_attributes.new('Dati', 'BYTE_COLOR', 'POINT')
    col = np.ones((len(me.vertices), 4), dtype=np.float32)
    col[:, 0] = lib; col[:, 1] = occ; col[:, 2] = 0.0
    att.data.foreach_set('color', col.ravel())
    me.color_attributes.active_color = att
    me.color_attributes.render_color_index = me.color_attributes.find('Dati')


def esporta(ob, file):
    for o in bpy.context.scene.objects:
        o.select_set(o is ob)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.export_scene.gltf(
        filepath=file, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
        export_normals=True, export_texcoords=True, export_materials='EXPORT',
        export_vertex_color='ACTIVE', export_all_vertex_colors=True, export_active_vertex_color_when_no_material=True,
    )


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('obj'); ap.add_argument('uscita')
    ap.add_argument('--campioni', type=int, default=96, help="campioni per la luce d'ambiente")
    ap.add_argument('--braccia', type=float, default=0.0, help='di quanti gradi abbassare le braccia (0: come nel modello)')
    a = ap.parse_args()
    os.makedirs(a.uscita, exist_ok=True)

    sc, ob = importa(a.obj)
    me = ob.data
    # la libertà di movimento si decide sulla posa originale, dove polsini e collo si riconoscono dalla posizione
    co0 = np.zeros((len(me.vertices), 3)); me.vertices.foreach_get('co', co0.ravel())
    co0 -= np.array([0.0, 0.0, (co0[:, 2].max() + co0[:, 2].min()) / 2])
    abbassa_braccia(ob, a.braccia)
    tipo_faccia = tre_materiali(ob)
    co, centro = centra(ob)
    metri_per_uv = mappa_in_scala(ob, tipo_faccia)
    # tipo per vertice: un vertice è di un bottone o di un filo se lo è una delle sue facce
    tipo_vertice = np.zeros(len(me.vertices), dtype=np.int32)
    for p in me.polygons:
        if tipo_faccia[p.index]:
            for v in p.vertices:
                tipo_vertice[v] = tipo_faccia[p.index]
    print('vertici', len(me.vertices), 'triangoli', sum(len(p.vertices) - 2 for p in me.polygons), 'centro tolto', centro.round(3))
    print('ingombro', co.min(0).round(3), co.max(0).round(3))

    lib = liberta(co0, tipo_vertice)
    occ = liscia(occlusione(sc, ob, a.campioni), ob)
    print('occlusione: min', round(float(occ.min()), 3), 'media', round(float(occ.mean()), 3), 'max', round(float(occ.max()), 3))
    scrivi_dati(ob, lib, np.clip(occ, 0, 1))
    for p in me.polygons:
        p.use_smooth = True
    esporta(ob, os.path.join(a.uscita, 'camicia.glb'))
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(a.uscita, 'camicia.blend'))
    import json
    dati = {'metri_per_uv': round(metri_per_uv, 4), 'vertici': len(me.vertices),
            'mezzo_ingombro': [round(float(x), 4) for x in (co.max(0) - co.min(0)) / 2]}
    with open(os.path.join(a.uscita, 'camicia.json'), 'w') as f:
        json.dump(dati, f, indent=1)
    print('scritto', os.path.join(a.uscita, 'camicia.glb'), os.path.getsize(os.path.join(a.uscita, 'camicia.glb')), 'byte', dati)


if __name__ == '__main__':
    main()
