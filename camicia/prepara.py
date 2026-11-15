"""Camicia 3D del configuratore: dal modello del proprietario al file per il browser.

Il proprietario ha fornito un modello già fatto (camicia a maniche lunghe, formato OBJ, 131.000 triangoli,
cartamodello vero con la mappa del tessuto in scala reale) e ha chiesto di partire da quello e migliorarlo.
Il modello originale NON sta nel repository: è materiale comprato, va tenuto fuori finché il repository è pubblico.

    <venv>/bin/python camicia/prepara.py <Shirt OBJ.obj> <cartella di uscita> [--braccia GRADI]

Cosa fa:
  1. importa il modello in metri e lo centra;
  2. riduce i materiali a tre: tessuto, bottone, filo;
  3. calcola per ogni punto quanta luce d'ambiente riceve (le pieghe, sotto il collo, dentro la camicia)
     e quanto è libero di muoversi quando il puntatore lo sfiora: il visualizzatore li legge dal colore dei vertici;
  4. stacca il taschino in un pezzo a parte, così il visualizzatore lo può accendere e spegnere;
  5. esporta `camicia.glb`, con dentro la camicia e il taschino;
L'immagine ferma per chi non può vedere il 3D la fa `camicia/manifesto.py`.
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


def facce_taschino(ob):
    """Le facce del taschino. Nel modello il taschino è fatto di tre pezzi di cartamodello cuciti sopra il davanti,
    che sotto resta intero: si riconoscono perché sono le sole isole della mappa che stanno tutte dentro la sua zona."""
    me = ob.data
    nomi = [m.name for m in me.materials]
    bm = bmesh.new(); bm.from_mesh(me); bm.faces.ensure_lookup_table()
    uvl = bm.loops.layers.uv.active

    def mappa(f, e):
        return {(round(l[uvl].uv.x, 5), round(l[uvl].uv.y, 5)) for l in f.loops if l.vert in e.verts}

    stoffa = [nomi[f.material_index] in TESSUTO for f in bm.faces]
    isola = [-1] * len(bm.faces)
    quante = 0
    for f in bm.faces:
        if isola[f.index] != -1 or not stoffa[f.index]:
            continue
        pila = [f]; isola[f.index] = quante
        while pila:
            g = pila.pop()
            for e in g.edges:
                for h in e.link_faces:
                    if isola[h.index] == -1 and stoffa[h.index] and mappa(g, e) == mappa(h, e):
                        isola[h.index] = quante; pila.append(h)
        quante += 1
    isola = np.array(isola)
    cen = np.array([f.calc_center_median()[:] for f in bm.faces])
    bm.free()
    # la zona del taschino, sul petto a sinistra di chi la indossa (misure del modello in metri, prima di centrarlo)
    dentro = (cen[:, 0] > 0.04) & (cen[:, 0] < 0.17) & (cen[:, 2] > 1.35) & (cen[:, 2] < 1.50) & (cen[:, 1] < 0)
    scelte = [k for k in range(quante) if dentro[isola == k].all()]
    # dei due pezzi grandi, quello più interno non è taschino: è il davanti della camicia che gli sta sotto,
    # tagliato come pezzo a parte. Resta sulla camicia: `rattoppa` lo ricuce bene al resto e lo liscia.
    grandi = sorted(scelte, key=lambda k: -int((isola == k).sum()))[:2]      # i due pezzi grandi: taschino e fondo
    fondo = max(grandi, key=lambda k: cen[isola == k][:, 1].mean())
    print('taschino: pezzi nella zona', {k: (int((isola == k).sum()), round(float(cen[isola == k][:, 1].mean()), 4)) for k in scelte}, '· fondo, che resta sulla camicia:', fondo)
    scelte = [k for k in scelte if k != fondo]
    facce = np.nonzero(np.isin(isola, scelte))[0]
    return facce, np.nonzero(isola == fondo)[0]


def rattoppa(ob, tasca, fondo, giri=30):
    """Prepara la camicia a stare senza taschino.
    Sotto il taschino il davanti è un pezzo a parte (il "fondo"), cucito al resto quasi dappertutto: in sette
    tratti corti, agli angoli, la cucitura passava dal taschino, e tolto quello resterebbero fessure scure.
    Qui quei tratti si ricuciono: ogni punto rimasto libero si salda al punto più vicino dell'altro lembo.
    Poi il fondo si liscia, perché porta ancora il segno delle cuciture del taschino.
    Le facce del taschino restano nella mesh, segnate, e si staccano più avanti con `separa`."""
    from mathutils import kdtree
    me = ob.data
    bm = bmesh.new(); bm.from_mesh(me); bm.faces.ensure_lookup_table()
    segno = bm.faces.layers.int.new('taschino')
    for i in tasca:
        bm.faces[int(i)][segno] = 1
    del_fondo = {bm.faces[int(i)] for i in fondo}
    zona = lambda v: 0.03 < v.co.x < 0.18 and 1.32 < v.co.z < 1.52 and v.co.y < 0
    camicia = lambda f: not f[segno]
    bm.normal_update()

    # i lembi liberi: lati che, senza contare il taschino, hanno una faccia sola
    liberi = {v for e in bm.edges if zona(e.verts[0]) and zona(e.verts[1])
              and sum(1 for f in e.link_faces if camicia(f)) == 1 for v in e.verts}
    # i punti a cui saldarli: quelli dello strato di fuori, divisi tra fondo e resto del davanti
    fuori = lambda v: zona(v) and v not in liberi and any(camicia(f) and f.normal.y < -0.5 for f in v.link_faces)
    sul_fondo = lambda v: any(f in del_fondo for f in v.link_faces)
    gruppi = {True: [v for v in bm.verts if fuori(v) and sul_fondo(v)], False: [v for v in bm.verts if fuori(v) and not sul_fondo(v)]}
    alberi = {}
    for k, vv in gruppi.items():
        t = kdtree.KDTree(len(vv))
        for i, v in enumerate(vv):
            t.insert(v.co, i)
        t.balance(); alberi[k] = t
    coppie = []
    for v in liberi:
        altro = not sul_fondo(v)                      # un punto del fondo si salda al davanti, e viceversa
        pos, i, dist = alberi[altro].find(v.co)
        if dist < 0.0075:
            coppie.append((v, gruppi[altro][i], dist))
    for v, meta, _ in coppie:
        if v.is_valid and meta.is_valid and v is not meta:
            v.co = meta.co
            bmesh.ops.pointmerge(bm, verts=[v, meta], merge_co=meta.co)
    print('taschino: punti liberi', len(liberi), '· saldati', len(coppie), '· distanza massima mm', round(max((d for *_, d in coppie), default=0) * 1000, 1))

    # il fondo e due dita di tessuto intorno si lisciano
    bm.verts.ensure_lookup_table(); bm.faces.ensure_lookup_table()
    da_lisciare = {v for f in bm.faces if f in del_fondo and f.is_valid for v in f.verts}
    for _ in range(2):
        da_lisciare |= {e.other_vert(v) for v in da_lisciare for e in v.link_edges if any(camicia(f) for f in e.link_faces)}
    da_lisciare = [v for v in da_lisciare if v.is_valid]
    for _ in range(giri):
        nuove = []
        for v in da_lisciare:
            vic = [e.other_vert(v).co for e in v.link_edges if any(camicia(f) for f in e.link_faces)]
            nuove.append(sum(vic, Vector()) / len(vic) if vic else v.co.copy())
        for v, n in zip(da_lisciare, nuove):
            v.co = v.co.lerp(n, 0.5)
    bmesh.ops.recalc_face_normals(bm, faces=[f for f in bm.faces])
    bm.to_mesh(me); bm.free()
    me.update()


def separa(ob, nome):
    """Stacca in un oggetto nuovo le facce segnate come taschino. Attributi, mappa e materiali restano su entrambi."""
    nuovo = bpy.data.objects.new(nome, ob.data.copy())
    bpy.context.scene.collection.objects.link(nuovo)
    for oggetto, tieni in ((ob, 0), (nuovo, 1)):
        bm = bmesh.new(); bm.from_mesh(oggetto.data)
        segno = bm.faces.layers.int['taschino']
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if f[segno] != tieni], context='FACES')
        bm.faces.layers.int.remove(segno)
        bm.to_mesh(oggetto.data); bm.free()
        oggetto.data.update()
    return nuovo


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
    abbottonatura = gradino(0.012, 0.05, np.abs(co[:, 0]))                   # lungo i bottoni il tessuto non si gonfia: i bottoni non lo seguirebbero
    davanti = np.where(co[:, 1] < 0, abbottonatura, 1.0)
    corpo = np.where(np.abs(co[:, 0]) < 0.22, davanti, 1.0)
    lib = collo * polso * corpo
    lib[tipo_vertice > 0] = 0.0                                               # bottoni e fili seguono senza deformarsi
    return lib


def occlusione(sc, ob, campioni=96, nascosti=()):
    """Luce d'ambiente per vertice, calcolata con Cycles. Restituisce un valore 0..1 per ogni vertice.
    `nascosti`: oggetti che durante il calcolo non devono fare ombra (il taschino, per la camicia senza)."""
    me = ob.data
    for o in sc.objects:
        o.hide_render = o in nascosti
        o.select_set(False)
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


def scrivi_dati(ob, lib, occ, occ_taschino):
    """Rosso: libertà di movimento. Verde: occlusione senza taschino. Blu: occlusione con il taschino.
    Il visualizzatore li legge come attributo `aDati`."""
    me = ob.data
    att = me.color_attributes.new('Dati', 'BYTE_COLOR', 'POINT')
    col = np.ones((len(me.vertices), 4), dtype=np.float32)
    col[:, 0] = lib; col[:, 1] = np.clip(occ, 0, 1); col[:, 2] = np.clip(occ_taschino, 0, 1)
    att.data.foreach_set('color', col.ravel())
    me.color_attributes.active_color = att
    me.color_attributes.render_color_index = me.color_attributes.find('Dati')


def esporta(oggetti, file):
    for o in bpy.context.scene.objects:
        o.hide_render = False
        o.select_set(o in oggetti)
    bpy.context.view_layer.objects.active = oggetti[0]
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
    tasca, fondo_tasca = facce_taschino(ob)
    rattoppa(ob, tasca, fondo_tasca)
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

    # la libertà viaggia con i vertici, così resta giusta anche dopo aver staccato il taschino
    att = me.attributes.new('liberta', 'FLOAT', 'POINT')
    att.data.foreach_set('value', liberta(co0, tipo_vertice).astype(np.float32))
    ob.name = 'camicia'
    taschino = separa(ob, 'taschino')

    def letta(o):
        v = np.zeros(len(o.data.vertices), dtype=np.float32)
        o.data.attributes['liberta'].data.foreach_get('value', v)
        return v

    # tre calcoli: la camicia da sola, la camicia con il taschino addosso, il taschino
    senza = liscia(occlusione(sc, ob, a.campioni, nascosti=(taschino,)), ob)
    con = liscia(occlusione(sc, ob, a.campioni), ob)
    del_taschino = liscia(occlusione(sc, taschino, a.campioni), taschino)
    print('occlusione camicia: media senza taschino', round(float(senza.mean()), 3), 'con', round(float(con.mean()), 3),
          '| vertici che cambiano:', int((np.abs(senza - con) > 0.05).sum()))
    scrivi_dati(ob, letta(ob), senza, con)
    scrivi_dati(taschino, letta(taschino), del_taschino, del_taschino)
    for o in (ob, taschino):
        o.data.attributes.remove(o.data.attributes['liberta'])
        for p in o.data.polygons:
            p.use_smooth = True
    esporta([ob, taschino], os.path.join(a.uscita, 'camicia.glb'))
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(a.uscita, 'camicia.blend'))
    import json
    dati = {'metri_per_uv': round(metri_per_uv, 4), 'vertici': len(ob.data.vertices) + len(taschino.data.vertices),
            'mezzo_ingombro': [round(float(x), 4) for x in (co.max(0) - co.min(0)) / 2]}
    with open(os.path.join(a.uscita, 'camicia.json'), 'w') as f:
        json.dump(dati, f, indent=1)
    print('scritto', os.path.join(a.uscita, 'camicia.glb'), os.path.getsize(os.path.join(a.uscita, 'camicia.glb')), 'byte', dati)


if __name__ == '__main__':
    main()
