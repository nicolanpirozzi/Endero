"""Camicia 3D del configuratore: dal modello del proprietario ai file per il browser.

Il proprietario ha fornito un modello già fatto (camicia a maniche lunghe, formato OBJ, 131.000 triangoli,
cartamodello vero con la mappa del tessuto in scala reale) e ha chiesto di partire da quello e migliorarlo.
Il modello originale NON sta nel repository: è materiale comprato, va tenuto fuori finché il repository è pubblico.

    <venv>/bin/python camicia/prepara.py <Shirt OBJ.obj> <cartella di uscita> [--braccia GRADI]

Cosa fa, nell'ordine:
  1. importa il modello in metri e riconosce il diritto, il rovescio e i bordini del tessuto;
  2. stacca il taschino (la camicia di base è senza) e ricuce il davanti che gli stava sotto;
  3. abbassa le braccia, stira le grinze del modello, centra, riporta la mappa tra 0 e 1;
  4. calcola la luce con Cycles, lo stesso motore dell'apertura: per il diritto un'immagine (`luce.webp`, stesa
     sulla mappa del cartamodello), per rovescio e bordini un valore per vertice. Ombre vere, luce che rimbalza
     tra le pieghe: il browser non le calcola, le riceve già fatte;
  5. disegna la mappa delle cuciture (`cuciture.webp`): per ogni punto del tessuto, quanto dista dal bordo del
     suo pezzo di cartamodello. Il visualizzatore ci disegna impunture e costure nitide a ogni distanza;
  6. costruisce il telaio (`telaio.json`): una camicia semplificata su cui il browser simula la stoffa al vento;
  7. esporta `camicia.glb` (camicia e taschino) e `camicia.json` con le misure che servono al visualizzatore.
Il file .glb va poi compresso con `camicia/comprimi.mjs`; l'immagine ferma per chi non può vedere il 3D si
fotografa dal 3D stesso con `tools/manifesto-camicia.js`.
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

import luci  # noqa: E402

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


def segna_strati(ob):
    """Segna ogni faccia del tessuto: 1 diritto, -1 rovescio, 0 bordino (la strisciolina che unisce i due strati
    sui bordi liberi). I due strati di un pezzo condividono la mappa del cartamodello ma la percorrono in versi
    opposti: li distingue il segno dell'area del triangolo nella mappa. I bordini nella mappa non hanno quasi area.
    Quale dei due versi sia il diritto si decide pezzo per pezzo: è quello le cui facce guardano più spesso verso
    il vuoto intorno alla camicia. Per i pezzi grandi è sempre lo stesso verso; polsini e abbottonatura, che sono
    ripiegati, possono averlo al contrario."""
    from mathutils.bvhtree import BVHTree
    me = ob.data
    nomi = [m.name for m in me.materials]
    bm = bmesh.new(); bm.from_mesh(me); bm.faces.ensure_lookup_table()
    uvl = bm.loops.layers.uv.active
    strato = bm.faces.layers.int.new('strato')

    def area_mappa(f):
        q = [l[uvl].uv for l in f.loops]
        return 0.5 * sum(q[i].x * q[(i + 1) % len(q)].y - q[(i + 1) % len(q)].x * q[i].y for i in range(len(q)))

    def mappa(f, e):
        return {(round(l[uvl].uv.x, 5), round(l[uvl].uv.y, 5)) for l in f.loops if l.vert in e.verts}

    verso = {}                                            # per faccia: +1, -1, oppure 0 per i bordini
    stoffa = [f for f in bm.faces if nomi[f.material_index] in TESSUTO]
    aree = np.array([area_mappa(f) for f in stoffa])
    rapporto = np.abs(aree) / np.maximum(np.array([f.calc_area() for f in stoffa]), 1e-12)
    soglia = 0.35 * float(np.median(rapporto))
    for f, a, r in zip(stoffa, aree, rapporto):
        verso[f.index] = 0 if r < soglia else (1 if a > 0 else -1)
    # i pezzi: facce dello stesso verso unite da un lato che nella mappa coincide
    pezzo = {}
    pezzi = []
    for f in stoffa:
        if f.index in pezzo or not verso[f.index]:
            continue
        k = len(pezzi); pezzo[f.index] = k; pila = [f]; lista = [f]
        while pila:
            g = pila.pop()
            for e in g.edges:
                for h in e.link_faces:
                    if h.index not in pezzo and verso.get(h.index) == verso[f.index] and mappa(g, e) == mappa(h, e):
                        pezzo[h.index] = k; pila.append(h); lista.append(h)
        pezzi.append(lista)
    albero = BVHTree.FromBMesh(bm)
    rng = np.random.default_rng(1)
    dati = []
    def intorno(n):
        """Una direzione a caso nella mezza sfera davanti alla faccia, più spesso vicino alla perpendicolare."""
        a, b = rng.random(), rng.random() * 2 * math.pi
        t = Vector((1, 0, 0)) if abs(n.x) < 0.9 else Vector((0, 1, 0))
        u = n.cross(t).normalized(); w = n.cross(u)
        r = math.sqrt(a)
        return (u * (r * math.cos(b)) + w * (r * math.sin(b)) + n * math.sqrt(1 - a)).normalized()

    for lista in pezzi:
        prova = [lista[i] for i in rng.choice(len(lista), min(len(lista), 300), replace=False)]
        # quanta parte del cielo vede il pezzo: raggi in tutte le direzioni davanti a ogni faccia
        fuga = sum(1 for f in prova for _ in range(8)
                   if albero.ray_cast(f.calc_center_median() + f.normal * 2e-4, intorno(f.normal), 3.0)[0] is None) / (len(prova) * 8)
        uv = np.array([l[uvl].uv[:] for f in lista for l in f.loops])
        dati.append({'verso': verso[lista[0].index], 'facce': len(lista), 'fuga': fuga, 'centro': (uv.min(0) + uv.max(0)) / 2,
                     'area': float(sum(f.calc_area() for f in lista))})
    # il verso che fa da diritto nell'insieme: quello dei pezzi che guardano fuori, pesati per superficie
    peso = {v: sum(d['area'] * d['fuga'] for d in dati if d['verso'] == v) for v in (1, -1)}
    comune = 1 if peso[1] > peso[-1] else -1
    # ogni pezzo ha il suo gemello dell'altro verso, nello stesso punto della mappa
    diritto = [None] * len(pezzi)
    for i, d in enumerate(dati):
        if diritto[i] is not None:
            continue
        gemelli = [j for j, g in enumerate(dati) if g['verso'] == -d['verso'] and diritto[j] is None
                   and np.abs(g['centro'] - d['centro']).max() < 0.004 and 0.7 < g['facce'] / d['facce'] < 1.4]
        if not gemelli:
            diritto[i] = d['verso'] == comune
            continue
        j = min(gemelli, key=lambda j: np.abs(dati[j]['centro'] - d['centro']).max())
        g = dati[j]
        if abs(d['fuga'] - g['fuga']) < 0.08:             # nessuno dei due guarda fuori più dell'altro: vale la regola comune
            diritto[i] = d['verso'] == comune
        else:
            diritto[i] = d['fuga'] > g['fuga']
        diritto[j] = not diritto[i]
        if diritto[i] != (d['verso'] == comune):
            print('  pezzo al contrario: facce', d['facce'], '· centro nella mappa', d['centro'].round(3), '· vede il cielo', round(d['fuga'], 2), 'contro', round(g['fuga'], 2))
    conta = {1: 0, -1: 0, 0: 0}
    for f in stoffa:
        f[strato] = 0 if not verso[f.index] else (1 if diritto[pezzo[f.index]] else -1)
        conta[f[strato]] += 1
    print('strati: pezzi', len(pezzi), '· diritto', conta[1], '· rovescio', conta[-1], '· bordini', conta[0])
    bm.to_mesh(me); bm.free()
    me.update()


def assottiglia(ob, spessore=0.0006):
    """Nel modello il tessuto è spesso 1,8 mm: sui bordi (collo, polsini, orlo, abbottonatura) si vede, e la camicia
    sembra di tela pesante. Lo strato interno si avvicina al diritto fino a `spessore` (un popeline da camicia è
    sui tre decimi; più sottile di così i due strati si confonderebbero)."""
    me = ob.data
    bm = bmesh.new(); bm.from_mesh(me); bm.normal_update()
    strato = bm.faces.layers.int['strato']
    co = np.array([v.co[:] for v in bm.verts])
    fuori = [v.index for v in bm.verts if any(f[strato] == 1 for f in v.link_faces)]
    from mathutils import kdtree
    albero = kdtree.KDTree(len(fuori))
    for k, i in enumerate(fuori):
        albero.insert(co[i], k)
    albero.balance()
    mossi, distanze = 0, []
    for v in bm.verts:
        dentro = [f for f in v.link_faces if f[strato] == -1]
        if not dentro or any(f[strato] == 1 for f in v.link_faces):
            continue
        n = sum((f.normal * f.calc_area() for f in dentro), Vector())
        if n.length < 1e-12:
            continue
        n.normalize()
        d = albero.find(v.co)[2]                       # quanto dista adesso dal diritto
        distanze.append(d)
        if d > spessore:
            v.co -= n * min(d - spessore, 0.0025)      # la normale dello strato interno guarda dentro la camicia
            mossi += 1
    print('spessore del tessuto: era', round(float(np.median(distanze)) * 1000, 2), 'mm · ora', spessore * 1000, 'mm · punti spostati', mossi)
    bm.to_mesh(me); bm.free()
    me.update()


def misure_per_la_gruccia(ob):
    """Dove sta la gruccia dentro la camicia: la linea delle spalle, sotto la quale passa il legno.
    Restituisce, negli assi del browser, i punti dell'asse del legno da una spalla all'altra, con la sua mezza
    altezza e la mezza larghezza che ci sta (la camicia in alto è stretta). Sotto il collo la linea prosegue l'arco
    delle spalle."""
    me = ob.data
    co = np.zeros((len(me.vertices), 3)); me.vertices.foreach_get('co', co.ravel())
    campioni = []
    for x in np.linspace(-0.21, 0.21, 43):
        if abs(x) < 0.125:                                  # fin qui arrivano le punte del colletto, appoggiate sulle spalle
            continue
        vicini = co[np.abs(co[:, 0] - x) < 0.008]
        campioni.append((x, float(vicini[:, 2].max())))
    campioni = np.array(campioni)
    # l'arco delle spalle: simmetrico, più alto al centro
    base = np.stack([np.ones(len(campioni)), np.abs(campioni[:, 0]), campioni[:, 0] ** 2], axis=1)
    k = np.linalg.lstsq(base, campioni[:, 1], rcond=None)[0]
    punti = []
    for x in np.linspace(-0.2, 0.2, 33):
        lungo = max(abs(x), 0.125)                         # sotto il collo il legno è piatto: resta dentro il colletto
        cresta = float(k[0] + k[1] * lungo + k[2] * lungo * lungo)
        alta = 0.017 - 0.008 * (abs(x) / 0.2) ** 2          # mezza altezza del legno: più sottile verso le punte
        zc = cresta - 0.011 - alta
        fetta = co[(np.abs(co[:, 0] - x) < 0.01) & (np.abs(co[:, 2] - zc) < 0.008)]
        if len(fetta) < 2:
            continue
        y0, y1 = float(fetta[:, 1].min()), float(fetta[:, 1].max())
        punti.append([round(float(x), 4), round(zc, 4), round(-(y0 + y1) / 2, 4), round(alta, 4), round(max(0.003, min(0.0075, (y1 - y0) / 2 - 0.004)), 4)])
    # sotto il collo il davanti è aperto e la fetta non dice dove sta il mezzo: lì il legno prosegue dritto
    ai_lati = [p for p in punti if abs(p[0]) >= 0.125]
    for p in punti:
        if abs(p[0]) < 0.125:
            vicino = min(ai_lati, key=lambda q: abs(abs(q[0]) - 0.125))
            p[2], p[4] = vicino[2], vicino[4]
    print('gruccia: punti', len(punti), '· cresta al centro', round(float(k[0]), 3), '· mezza larghezza minima', min(p[4] for p in punti))
    return punti


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


def _mappa_della_toppa(nuova, uvl, strato, fondo, buona):
    """La mappa di una faccia aggiunta per chiudere una fessura. Sta a cavallo di due pezzi del cartamodello (il
    davanti e il pezzo sotto il taschino), che nella mappa sono lontani: se ogni punto prendesse la mappa dal suo
    pezzo, la faccia si stirerebbe da un capo all'altro. Tutta la toppa prende la mappa di un suo punto solo, sul
    davanti: nella mappa non occupa spazio (così il calcolo della luce non scrive sopra le facce vere) e, larga
    com'è pochi millimetri, prende la luce di quel punto."""
    def cerca(l, sul_fondo):
        return next((m[uvl].uv.copy() for f in l.vert.link_faces if f is not nuova and buona(f) and f[strato] == 1
                     and bool(f[fondo]) == sul_fondo for m in f.loops if m.vert is l.vert), None)
    for sul_fondo in (False, True):
        riferimento = next((t for t in (cerca(l, sul_fondo) for l in nuova.loops) if t is not None), None)
        if riferimento is not None:
            for l in nuova.loops:
                l[uvl].uv = riferimento.copy()
            return


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
    segno_fondo = bm.faces.layers.int.new('fondo')
    strato = bm.faces.layers.int['strato']
    for i in tasca:
        bm.faces[int(i)][segno] = 1
    for i in fondo:
        bm.faces[int(i)][segno_fondo] = 1
    del_fondo = {bm.faces[int(i)] for i in fondo}
    # il taschino si scuce subito dal resto (i punti in comune si sdoppiano): così quello che segue non lo deforma
    bmesh.ops.split(bm, geom=[bm.faces[int(i)] for i in tasca])
    bm.faces.ensure_lookup_table(); bm.verts.ensure_lookup_table()
    zona = lambda v: 0.03 < v.co.x < 0.18 and 1.32 < v.co.z < 1.52 and v.co.y < 0
    camicia = lambda f: not f[segno]
    bm.normal_update()

    # i lembi liberi: lati della camicia che, scucito il taschino, restano con una faccia sola
    liberi = {v for e in bm.edges if zona(e.verts[0]) and zona(e.verts[1]) and e.is_boundary
              and camicia(e.link_faces[0]) for v in e.verts}
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
    uvl = bm.loops.layers.uv.active
    vicino = {}
    for v in liberi:
        altro = not sul_fondo(v)                      # un punto del fondo va verso il davanti, e viceversa
        pos, i, dist = alberi[altro].find(v.co)
        vicino[v] = (gruppi[altro][i], dist)
    # 1 · dove i due lembi quasi si toccano si saldano
    saldati = 0
    for v, (meta, dist) in list(vicino.items()):
        if dist < 0.003 and v.is_valid and meta.is_valid and v is not meta:
            bmesh.ops.pointmerge(bm, verts=[v, meta], merge_co=meta.co)
            saldati += 1
    # 2 · dove restano distanti la fessura si chiude con una striscia di facce nuove, senza spostare nulla
    aggiunte = 0
    for e in [e for e in bm.edges if e.is_valid and e.is_boundary and camicia(e.link_faces[0])]:
        u, v = e.verts
        if u not in vicino or v not in vicino or not (u.is_valid and v.is_valid):
            continue
        (pu, du), (pv, dv) = vicino[u], vicino[v]
        if not (pu.is_valid and pv.is_valid) or max(du, dv) > 0.02:
            continue
        vecchia = next(f for f in e.link_faces if camicia(f))
        giro = [u, v, pv, pu] if pu is not pv else [u, v, pu]
        if len(set(giro)) < 3:
            continue
        try:
            nuova = bm.faces.new(giro)
        except ValueError:                            # la faccia c'è già
            continue
        nuova.normal_update()
        # deve guardare in fuori, cioè in avanti (il petto guarda verso -Y): nel browser una faccia girata
        # dall'altra parte non si disegna, e lascerebbe un puntino scuro
        if nuova.normal.y > 0:
            nuova.normal_flip()
        nuova.material_index = vecchia.material_index
        nuova.smooth = True
        nuova[segno] = 0
        nuova[strato] = 1
        _mappa_della_toppa(nuova, uvl, strato, segno_fondo, lambda f: camicia(f))
        nuova[segno_fondo] = 1
        aggiunte += 1
    print('taschino: punti liberi', len(liberi), '· saldati', saldati, '· facce aggiunte per chiudere le fessure', aggiunte,
          '· lati ancora liberi', sum(1 for e in bm.edges if zona(e.verts[0]) and zona(e.verts[1]) and e.is_boundary and camicia(e.link_faces[0])))

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
    # il verso delle facce non si ricalcola: quello dato all'inizio è giusto, e nel browser una faccia girata
    # diventerebbe un buco (ogni strato si disegna da un lato solo)
    bm.to_mesh(me); bm.free()
    me.update()


def buchi_del_petto(ob, passo=0.0005):
    """Guarda il petto da davanti con una griglia fitta di raggi, nella zona dove stava il taschino, come lo
    disegna il browser: le facce che guardano in dentro non si vedono (ogni strato si disegna da un lato solo).
    C'è un buco dove la prima faccia che si vede sta molto più indietro della superficie: lì si vedrebbe l'interno
    buio della schiena. Restituisce i punti (x, z, profondità della superficie) dei buchi."""
    from mathutils.bvhtree import BVHTree
    me = ob.data
    albero = BVHTree.FromPolygons([v.co.copy() for v in me.vertices], [tuple(p.vertices) for p in me.polygons])
    normali = [p.normal.y for p in me.polygons]
    trovati = []
    for x in np.arange(0.045, 0.172, passo):
        for z in np.arange(0.045, 0.205, passo):
            y, prima = -0.5, None
            for _ in range(12):
                pos, nor, idx, dist = albero.ray_cast(Vector((x, y, z)), Vector((0, 1, 0)))
                if pos is None:
                    break
                if prima is None:
                    prima = pos.y
                if normali[idx] < 0:                      # guarda verso chi osserva: è questa che si vede
                    if pos.y > prima + 0.006:
                        trovati.append((x, z, prima))
                    break
                y = pos.y + 1e-5
    return np.array(trovati).reshape(-1, 3)


def tappa_buchi(ob, giri=6):
    """Chiude le fessure rimaste dove era cucito il taschino. Sono larghe da mezzo millimetro a tre: per ognuna
    si stende una piccola toppa tra i punti del diritto che le stanno intorno. La toppa passa per punti che ci
    sono già, quindi prende la loro luce e la loro mappa e non si distingue dal tessuto."""
    me = ob.data
    for giro in range(giri):
        b = buchi_del_petto(ob)
        print('petto: punti da cui si vede attraverso', len(b))
        if not len(b):
            return
        # i buchi vicini fanno una fessura sola
        resto, gruppi = list(range(len(b))), []
        while resto:
            g = [resto.pop()]
            cresce = True
            while cresce:
                cresce = False
                for i in resto[:]:
                    if np.min(np.linalg.norm(b[g, :2] - b[i, :2], axis=1)) < 0.003:
                        g.append(i); resto.remove(i); cresce = True
            gruppi.append(b[g])
        bm = bmesh.new(); bm.from_mesh(me)
        segno_toppa = bm.faces.layers.int.get('toppa') or bm.faces.layers.int.new('toppa')
        bm.verts.ensure_lookup_table(); bm.normal_update()
        uvl = bm.loops.layers.uv.active
        strato = bm.faces.layers.int['strato']
        margine = 0.004 + 0.002 * giro
        for g in gruppi:
            lo, hi = g[:, :2].min(0) - margine, g[:, :2].max(0) + margine
            fondo_y = float(np.median(g[:, 2]))             # la profondità del tessuto in quel punto
            intorno = [v for v in bm.verts if lo[0] <= v.co.x <= hi[0] and lo[1] <= v.co.z <= hi[1]
                       and abs(v.co.y - fondo_y) < 0.006 and v.normal.y < -0.4 and any(f[strato] == 1 for f in v.link_faces)]
            if len(intorno) < 3:
                continue
            # contorno convesso dei punti, visto da davanti
            punti = sorted(intorno, key=lambda v: (v.co.x, v.co.z))
            giro_di = lambda o, a, c: (a.co.x - o.co.x) * (c.co.z - o.co.z) - (a.co.z - o.co.z) * (c.co.x - o.co.x)
            sotto, sopra = [], []
            for v in punti:
                while len(sotto) >= 2 and giro_di(sotto[-2], sotto[-1], v) <= 0:
                    sotto.pop()
                sotto.append(v)
            for v in reversed(punti):
                while len(sopra) >= 2 and giro_di(sopra[-2], sopra[-1], v) <= 0:
                    sopra.pop()
                sopra.append(v)
            contorno = sotto[:-1] + sopra[:-1]
            if len(contorno) < 3:
                continue
            try:
                toppa = bm.faces.new(contorno)
            except ValueError:
                continue
            toppa.normal_update()
            if toppa.normal.y > 0:
                toppa.normal_flip()
            toppa.smooth = True
            toppa[strato] = 1
            vicina = next(f for f in contorno[0].link_faces if f is not toppa and f[strato] == 1)
            toppa.material_index = vicina.material_index
            _mappa_della_toppa(toppa, uvl, strato, bm.faces.layers.int['fondo'], lambda f: True)
            toppa[bm.faces.layers.int['fondo']] = 1
            toppa[segno_toppa] = 1
        bm.to_mesh(me); bm.free()
        me.update()
    print('petto: punti da cui si vede ancora attraverso', len(buchi_del_petto(ob)))


def fodera_del_petto(ob, dietro=0.0012):
    """Dove stava il taschino il davanti è fatto di pezzi ricuciti, e lungo il contorno restano forellini più
    sottili di un capello: da fermi quasi non si vedono, ma quando il tessuto si muove si allargano e lasciano
    vedere l'interno, più scuro (i "puntini neri" segnalati dal proprietario). Lì spuntano anche i bordini dei
    pezzi ricuciti, che si tolgono. Dietro quella zona si stende una
    fodera: una copia del diritto, saldata dove lui è scucito, poco più di un millimetro sotto. Ha la stessa mappa,
    quindi la stessa luce, e attraverso un forellino si vede lei: tessuto dello stesso colore.
    È segnata come toppa: non entra nel calcolo della luce e non fa parte del telaio."""
    me = ob.data
    bm = bmesh.new(); bm.from_mesh(me)
    strato = bm.faces.layers.int['strato']
    toppa = bm.faces.layers.int.get('toppa') or bm.faces.layers.int.new('toppa')
    bm.faces.ensure_lookup_table()
    nel_petto = lambda v: 0.02 < v.co.x < 0.20 and 0.02 < v.co.z < 0.23 and v.co.y < 0
    # i bordini dei pezzi ricuciti (le strisce che uniscono diritto e rovescio) qui non servono più, e dove
    # spuntano tra un pezzo e l'altro si vedono: prendono la luce dell'interno, più scura
    bordini = [f for f in bm.faces if f[strato] == 0 and f.material_index == 4 and all(nel_petto(v) for v in f.verts)]
    bmesh.ops.delete(bm, geom=bordini, context='FACES')
    bm.faces.ensure_lookup_table()
    facce = [f for f in bm.faces if f[strato] == 1 and not f[toppa] and all(nel_petto(v) for v in f.verts)]
    copia = [g for g in bmesh.ops.duplicate(bm, geom=facce)['geom'] if isinstance(g, bmesh.types.BMFace)]
    bmesh.ops.remove_doubles(bm, verts=list({v for f in copia for v in f.verts}), dist=0.003)
    copia = [f for f in copia if f.is_valid]
    orli = list({e for f in copia for e in f.edges if e.is_boundary})
    chiuse = bmesh.ops.holes_fill(bm, edges=orli, sides=14)['faces']       # solo i fori piccoli: il contorno resta aperto
    uvl = bm.loops.layers.uv.active
    for f in chiuse:
        vicina = next((g for e in f.edges for g in e.link_faces if g is not f and g in set(copia)), None)
        f[strato] = 1; f.smooth = True
        if vicina is not None:
            f.material_index = vicina.material_index
            for l in f.loops:
                l[uvl].uv = vicina.loops[0][uvl].uv.copy()
    bm.normal_update()
    tutte = [f for f in copia + chiuse if f.is_valid]
    for v in {v for f in tutte for v in f.verts}:
        v.co -= v.normal * dietro
    for f in tutte:
        f[toppa] = 1
    print('fodera del petto: facce', len(tutte), '· fori chiusi', len(chiuse), '· bordini tolti', len(bordini))
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


MATERIALI = ('tessuto', 'rovescio', 'bottone', 'filo', 'bordino')


def parti(ob):
    """Per ogni vertice a quale parte appartiene: 0 corpo, 1 manica dal lato +X, 2 manica dal lato -X.
    Serve al visualizzatore per agganciare ogni punto al telaio giusto (una manica non deve seguire il fianco)."""
    me = ob.data
    nomi = [m.name for m in me.materials]
    co = np.zeros((len(me.vertices), 3)); me.vertices.foreach_get('co', co.ravel())
    parte = np.zeros(len(me.vertices), dtype=np.int32)
    corpo = np.zeros(len(me.vertices), bool)
    for p in me.polygons:
        n = nomi[p.material_index]
        v = list(p.vertices)
        if n in ('Sleeve_Right', 'Sleeve_Left', 'Cuffs_Boundry') or (n not in TESSUTO and abs(co[v[0], 0]) > 0.3):
            parte[v] = 1 if co[v[0], 0] > 0 else 2
        elif n in TESSUTO:
            corpo[v] = True
    parte[corpo] = 0                                  # la cucitura del giro manica sta col corpo
    att = me.attributes.new('parte', 'INT', 'POINT')
    att.data.foreach_set('value', parte)


def quattro_materiali(ob):
    """Dai nove materiali del modello a cinque: tessuto (il diritto), rovescio, bottone, filo, bordino.
    Restituisce il tipo di ogni faccia."""
    me = ob.data
    vecchi = [m.name for m in me.materials]
    idx = np.zeros(len(me.polygons), dtype=np.int32); me.polygons.foreach_get('material_index', idx)
    strato = np.zeros(len(me.polygons), dtype=np.int32); me.attributes['strato'].data.foreach_get('value', strato)
    di_stoffa = np.array([n in TESSUTO for n in vecchi])[idx]
    # i bordini (le strisce che uniscono diritto e rovescio sui bordi liberi) si vedono da fuori: hanno un materiale
    # loro, che il visualizzatore disegna con la luce del diritto e non con quella, più scura, dell'interno
    tipo = np.where(di_stoffa, np.where(strato == 1, 0, np.where(strato == -1, 1, 4)), np.where(np.array([n in BOTTONE for n in vecchi])[idx], 2, 3))
    me.materials.clear()
    for nome in MATERIALI:
        me.materials.append(bpy.data.materials.get(nome) or bpy.data.materials.new(nome))
    me.polygons.foreach_set('material_index', tipo.astype(np.int32))
    me.update()
    return tipo


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
    # conta solo il tessuto: bottoni e fili hanno una mappa loro, lontana, che sprecherebbe metà dell'immagine
    di_stoffa = np.zeros(len(me.loops), bool)
    for p in me.polygons:
        if tipo_faccia[p.index] not in (2, 3):
            di_stoffa[list(p.loop_indices)] = True
    minimo = uv[di_stoffa].min(0)
    ampiezza = float((uv[di_stoffa].max(0) - minimo).max()) * 1.012
    uv = np.clip((uv - minimo) / ampiezza + 0.006, 0.0, 1.0)
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


def _zone(co, alto=None):
    """Le zone della camicia nella posa originale, da 0 a 1: collo e spalle alte, polsini, abbottonatura."""
    def gradino(a, b, x):
        t = np.clip((x - a) / (b - a), 0.0, 1.0)
        return t * t * (3 - 2 * t)
    z_alto = ALTO_DELLA_CAMICIA if alto is None else alto
    appeso = gradino(z_alto - 0.17, z_alto - 0.07, co[:, 2])
    polso = gradino(0.42, 0.52, np.abs(co[:, 0]))
    bottoni = np.where((co[:, 1] < 0) & (np.abs(co[:, 0]) < 0.22), 1.0 - gradino(0.012, 0.05, np.abs(co[:, 0])), 0.0)
    return appeso, polso, bottoni


ALTO_DELLA_CAMICIA = 0.0            # la quota del punto più alto nella posa originale: la scrive `tenuta`


def tenuta(co):
    """Come è tenuto ogni punto, sulla posa originale: `appeso` vale 1 su collo e spalle, da cui la camicia pende,
    e scende a 0 una spanna più sotto; `rigido` vale 1 sui polsini e mezzo lungo l'abbottonatura, che hanno più
    strati e si piegano meno."""
    global ALTO_DELLA_CAMICIA
    ALTO_DELLA_CAMICIA = float(co[:, 2].max())
    appeso, polso, bottoni = _zone(co)
    return appeso, np.maximum(polso, 0.5 * bottoni)


def stira(ob, co0, forza=700.0):
    """Stira la camicia. Il modello è stropicciato, soprattutto sulle maniche e sui fianchi, e quelle grinze sono
    nella forma: non cambiano mai, nemmeno quando il tessuto si muove, ed è ciò che la fa sembrare finta (il
    proprietario, 16 novembre 2026: "continua ad avere delle pieghe anche quando è ferma").
    Il diritto del tessuto si liscia tenendo la sua forma d'insieme: spariscono le pieghe più corte di una spanna,
    restano la caduta, le spalle, il giro delle maniche. Collo, polsini, abbottonatura e tutti i bordi non si
    toccano. Poi il rovescio, i bordini, i bottoni e i fili seguono il diritto, ciascuno col suo spostamento.
    `co0` sono i punti nella posa originale, dove le zone si riconoscono dalla posizione."""
    from scipy import sparse
    from scipy.sparse.linalg import splu
    from mathutils import kdtree
    me = ob.data
    n = len(me.vertices)
    co = np.zeros((n, 3)); me.vertices.foreach_get('co', co.ravel())
    strato = np.zeros(len(me.polygons), dtype=np.int32); me.attributes['strato'].data.foreach_get('value', strato)
    # i lati del diritto, e quante facce del diritto li toccano (una sola: è un bordo)
    conta = {}
    for p in me.polygons:
        if strato[p.index] != 1:
            continue
        v = list(p.vertices)
        for k in range(len(v)):
            a, b = v[k], v[(k + 1) % len(v)]
            conta[(min(a, b), max(a, b))] = conta.get((min(a, b), max(a, b)), 0) + 1
    lati = np.array(list(conta.keys())); quante = np.array(list(conta.values()))
    fuori = np.unique(lati)                                   # i vertici del diritto
    posto = -np.ones(n, dtype=np.int64); posto[fuori] = np.arange(len(fuori))
    m = len(fuori)
    a, b = posto[lati[:, 0]], posto[lati[:, 1]]
    vicini = sparse.coo_matrix((np.ones(len(a) * 2), (np.concatenate([a, b]), np.concatenate([b, a]))), shape=(m, m)).tocsr()
    grado = np.asarray(vicini.sum(axis=1)).ravel()
    lap = sparse.diags(1.0 / np.maximum(grado, 1)) @ vicini - sparse.identity(m)        # media dei vicini meno il punto
    # quanto ogni punto è libero di spostarsi: niente sui bordi (e poco lì accanto), su collo e spalle alte, polsini, bottoni
    appeso, polso, bottoni = _zone(co0[fuori])
    libero = (1 - appeso) * (1 - polso) * (1 - bottoni)
    giri = np.full(m, 99); giri[np.unique(posto[lati[quante == 1]])] = 0
    for g in range(1, 7):                                     # a quanti lati dal bordo sta ogni punto
        tocca = (vicini @ (giri < g).astype(float)) > 0
        giri[tocca & (giri == 99)] = g
    libero *= np.clip(giri / 6.0, 0, 1) ** 2
    # la superficie più liscia che resta vicina a quella di partenza: (P + forza·LᵀL) x = P x0, con P grande dove non ci si muove
    peso = 1.0 + 3e4 * (1 - libero) ** 2
    sistema = splu((sparse.diags(peso) + forza * (lap.T @ lap)).tocsc())
    nuova = np.stack([sistema.solve(peso * co[fuori, k]) for k in range(3)], axis=1)
    sposta = nuova - co[fuori]
    # tutti gli altri punti seguono il punto del diritto più vicino; bottoni e fili si spostano interi
    albero = kdtree.KDTree(m)
    for k, i in enumerate(fuori):
        albero.insert(co[i], k)
    albero.balance()
    tutto = np.zeros((n, 3)); tutto[fuori] = sposta
    nomi = [mat.name for mat in me.materials]
    rigidi = np.zeros(n, bool)
    for p in me.polygons:
        if nomi[p.material_index] not in TESSUTO:
            rigidi[list(p.vertices)] = True
    for i in np.nonzero((posto < 0) & ~rigidi)[0]:
        tutto[i] = sposta[albero.find(co[i])[1]]
    # i pezzi rigidi: ognuno (un bottone, un filo) prende lo spostamento del tessuto sotto il suo centro
    capo = np.arange(n)
    def trova(i):
        while capo[i] != i:
            capo[i] = capo[capo[i]]; i = capo[i]
        return i
    for e in me.edges:
        u, w = e.vertices
        if rigidi[u] and rigidi[w]:
            capo[trova(u)] = trova(w)
    gruppi = {}
    for i in np.nonzero(rigidi)[0]:
        gruppi.setdefault(trova(i), []).append(i)
    for lista in gruppi.values():
        tutto[lista] = sposta[albero.find(co[lista].mean(axis=0))[1]]
    me.vertices.foreach_set('co', (co + tutto).ravel()); me.update()
    lungo = np.linalg.norm(sposta, axis=1)
    print('stirata: punti del diritto', m, '· spostamento medio', round(float(lungo.mean()) * 1000, 2), 'mm · massimo', round(float(lungo.max()) * 1000, 1), 'mm · pezzi rigidi', len(gruppi))


def _prepara_cottura(sc, campioni):
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = campioni
    sc.cycles.max_bounces = 6
    sc.cycles.diffuse_bounces = 4
    sc.cycles.use_denoising = False
    k = sc.render.bake
    k.use_pass_direct, k.use_pass_indirect, k.use_pass_color = True, True, False     # solo la luce, senza il colore


def _scegli(sc, ob, visibili):
    for o in sc.objects:
        if o.type == 'MESH':
            o.hide_render = o not in visibili
        o.select_set(o is ob)
    bpy.context.view_layer.objects.active = ob


def _parte_di(ob, nome, tieni):
    """Una copia dell'oggetto con le sole facce scelte (per materiale). Le toppe stese sulle fessure del petto
    restano fuori: sono appoggiate sul tessuto vero e, nel calcolo della luce, gli farebbero ombra."""
    copia = bpy.data.objects.new(nome, ob.data.copy())
    bpy.context.scene.collection.objects.link(copia)
    bm = bmesh.new(); bm.from_mesh(copia.data)
    toppa = bm.faces.layers.int.get('toppa')
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if not tieni(f.material_index) or (toppa and f[toppa])], context='FACES')
    bm.to_mesh(copia.data); bm.free()
    return copia


def cuoci_luce(sc, camicia, taschino, lato=2048, campioni=256):
    """La luce che arriva sul diritto del tessuto, calcolata con Cycles e scritta in un'immagine stesa sulla mappa
    del cartamodello. Dentro ci sono le ombre vere (il colletto sulle spalle, le maniche sui fianchi, ogni piega)
    e la luce che rimbalza da un lembo all'altro. Restituisce l'immagine come matrice (righe dall'alto, lineare).
    Il diritto si calcola da solo, su una copia: il resto della camicia è presente e fa ombra, ma non si calcola."""
    import time
    _prepara_cottura(sc, campioni)
    luce = bpy.data.images.new('luce', lato, lato, alpha=False, float_buffer=True)
    for nome in MATERIALI:
        m = bpy.data.materials[nome]
        m.use_nodes = True
        N = m.node_tree.nodes
        p = N.get('Principled BSDF')
        p.inputs['Base Color'].default_value = (1, 1, 1, 1)
        p.inputs['Roughness'].default_value = 1.0
        if nome == 'tessuto':
            n = N.new('ShaderNodeTexImage')
            n.image = luce
            N.active = n
    sc.render.bake.target = 'IMAGE_TEXTURES'
    sc.render.bake.margin = max(4, lato // 200)
    copie = {}
    for ob in (camicia, taschino):
        copie[ob] = (_parte_di(ob, ob.name + ' diritto', lambda i: i == 0), _parte_di(ob, ob.name + ' resto', lambda i: i != 0))
    t = time.time()
    sc.render.bake.use_clear = True
    _scegli(sc, copie[camicia][0], visibili=copie[camicia])            # la camicia di base: senza l'ombra del taschino
    bpy.ops.object.bake(type='DIFFUSE')
    sc.render.bake.use_clear = False
    _scegli(sc, copie[taschino][0], visibili=copie[camicia] + copie[taschino])      # il taschino, con la camicia sotto
    bpy.ops.object.bake(type='DIFFUSE')
    print('luce calcolata in', round(time.time() - t), 'secondi')
    px = np.zeros(lato * lato * 4, dtype=np.float32)
    luce.pixels.foreach_get(px)
    for coppia in copie.values():
        for o in coppia:
            dati = o.data
            bpy.data.objects.remove(o); bpy.data.meshes.remove(dati)
    return px.reshape(lato, lato, 4)[::-1, :, :3].copy()


def pulisci(immagine, raggio=1.0):
    """Toglie la grana del calcolo dall'immagine della luce con una sfocatura di un punto o poco più, fatta solo
    tra punti coperti dal tessuto: il nero di fuori non entra nei bordi dei pezzi."""
    from scipy import ndimage
    coperti = (immagine.max(axis=2) > 1e-4).astype(np.float32)
    peso = np.maximum(ndimage.gaussian_filter(coperti, raggio), 1e-6)
    fuori = np.stack([ndimage.gaussian_filter(immagine[:, :, k] * coperti, raggio) / peso for k in range(3)], axis=2)
    # fuori dai pezzi, il colore del punto coperto più vicino: rimpicciolendo l'immagine il nero non entra nei bordi
    vicino = ndimage.distance_transform_edt(coperti == 0, return_distances=False, return_indices=True)
    return fuori[vicino[0], vicino[1]].astype(np.float32), coperti > 0


def luce_dei_vertici(sc, ob, campioni=128, nascosti=()):
    """La stessa luce, ma un valore per vertice: basta per il rovescio e i bordini, che si vedono poco."""
    me = ob.data
    _prepara_cottura(sc, campioni)
    for nome in MATERIALI:
        bpy.data.materials[nome].use_nodes = True
    _scegli(sc, ob, visibili=[o for o in sc.objects if o.type == 'MESH' and o not in nascosti])
    att = me.color_attributes.new('luce', 'FLOAT_COLOR', 'POINT')
    me.color_attributes.active_color = att
    me.color_attributes.render_color_index = me.color_attributes.find('luce')
    sc.render.bake.target = 'VERTEX_COLORS'
    bpy.ops.object.bake(type='DIFFUSE')
    val = np.zeros(len(me.vertices) * 4, dtype=np.float32)
    att.data.foreach_get('color', val)
    me.color_attributes.remove(att)
    return val.reshape(-1, 4)[:, :3].astype(np.float64)


def luce_per_orientamento(ob, luce):
    """Quanta luce riceve una superficie libera in funzione di dove guarda: nove numeri per colore (armoniche
    sferiche del secondo ordine), ricavati dalla luce calcolata sui vertici del diritto. Al visualizzatore serve
    per le pieghe che si muovono: la luce fissata vale per la posa di riposo, e quando il vento gira un lembo
    verso la luce principale quel lembo deve schiarirsi. I punti in ombra non contano: tirerebbero giù la stima."""
    me = ob.data
    n = np.zeros((len(me.vertices), 3)); me.vertices.foreach_get('normal', n.ravel())
    del_diritto = np.zeros(len(me.vertices), bool)
    for p in me.polygons:
        if p.material_index == 0:
            del_diritto[list(p.vertices)] = True
    x, y, z = n[del_diritto, 0], n[del_diritto, 2], -n[del_diritto, 1]      # assi del browser: Y in alto, davanti verso +Z
    base = np.stack([np.ones_like(x), y, z, x, x * y, y * z, 3 * z * z - 1, x * z, x * x - y * y], axis=1)
    valori = luce[del_diritto]
    peso = np.ones(len(x))
    for _ in range(6):
        coeff = np.linalg.lstsq(base * peso[:, None], valori * peso[:, None], rcond=None)[0]
        scarto = (valori - base @ coeff).mean(axis=1)
        peso = np.where(scarto < 0, 0.25, 1.0)             # chi sta sotto la stima è in ombra: pesa un quarto
    return coeff


def liscia(valori, ob, giri=2):
    """Media con i vicini: toglie il rumore del calcolo senza perdere le pieghe. Vale per una o più colonne."""
    me = ob.data
    lati = np.zeros(len(me.edges) * 2, dtype=np.int32); me.edges.foreach_get('vertices', lati)
    a, b = lati[0::2], lati[1::2]
    n = len(me.vertices)
    conta = (np.bincount(a, minlength=n) + np.bincount(b, minlength=n) + 1).astype(float)
    v = np.array(valori, dtype=float).reshape(n, -1)
    for _ in range(giri):
        somma = v.copy()
        for k in range(v.shape[1]):
            somma[:, k] += np.bincount(a, weights=v[b, k], minlength=n) + np.bincount(b, weights=v[a, k], minlength=n)
        v = somma / conta[:, None]
    return v.reshape(np.shape(valori))


def scrivi_dati(ob, luce, scala):
    """Il colore dei vertici, che il visualizzatore legge come `aDati`.
    Rosso, verde, blu: la luce sul vertice (radice quadrata, perché nei toni scuri otto bit non bastano).
    Alfa: la parte (0 corpo, 0,5 manica +X, 1 manica -X)."""
    me = ob.data
    parte = np.zeros(len(me.vertices), dtype=np.int32); me.attributes['parte'].data.foreach_get('value', parte)
    col = np.ones((len(me.vertices), 4), dtype=np.float32)
    col[:, :3] = np.sqrt(np.clip(luce * scala, 0, 1))
    col[:, 3] = parte / 2.0
    att = me.color_attributes.new('Dati', 'FLOAT_COLOR', 'POINT')
    att.data.foreach_set('color', col.ravel())
    me.color_attributes.active_color = att
    me.color_attributes.render_color_index = me.color_attributes.find('Dati')


def mappa_cuciture(oggetti, metri_per_uv, lato=2048, portata=0.016, passo=0.0028):
    """La mappa delle cuciture, stesa sul cartamodello come quella della luce. Per ogni punto del tessuto:
    rosso, quanto dista dal bordo del suo pezzo (0 sul bordo, 255 a `portata` metri o più): il visualizzatore ci
    disegna il solco della costura sul bordo e l'impuntura a distanza fissa; verde e blu, a che punto si è del
    passo dell'impuntura lungo il bordo (coseno e seno, che si interpolano senza salti): servono a staccare un
    punto dall'altro. Il pezzo che stava sotto il taschino e il foro che lo ospita non sono bordi veri."""
    import contourpy
    from PIL import Image, ImageDraw
    from scipy import ndimage
    from scipy.spatial import cKDTree
    pieno = Image.new('L', (lato, lato), 0); d = ImageDraw.Draw(pieno)
    del_fondo = Image.new('L', (lato, lato), 0); df = ImageDraw.Draw(del_fondo)
    for ob in oggetti:
        me = ob.data
        uv = np.zeros((len(me.loops), 2)); me.uv_layers[0].data.foreach_get('uv', uv.ravel())
        strato = np.zeros(len(me.polygons), dtype=np.int32); me.attributes['strato'].data.foreach_get('value', strato)
        fondo = np.zeros(len(me.polygons), dtype=np.int32); me.attributes['fondo'].data.foreach_get('value', fondo)
        for p in me.polygons:
            if strato[p.index] != 1:
                continue
            pt = [(uv[i][0] * lato - 0.5, (1 - uv[i][1]) * lato - 0.5) for i in p.loop_indices]
            (df if fondo[p.index] else d).polygon(pt, fill=255, outline=255)
    toppa = np.asarray(del_fondo) > 0
    # il foro lasciato nel davanti dal pezzo sotto il taschino si richiude: i fori interni di un pezzo non sono bordi
    pezzi = ndimage.binary_fill_holes(np.asarray(pieno) > 0)
    morbido = ndimage.gaussian_filter(pezzi.astype(np.float32), 1.0)
    metro = metri_per_uv / lato                          # metri per punto dell'immagine
    # i bordi dei pezzi come linee, con la loro lunghezza: lungo ognuna corre il passo dell'impuntura
    punti, fase = [], []
    for linea in contourpy.contour_generator(z=morbido).lines(0.5):
        tratti = np.linalg.norm(np.diff(linea, axis=0), axis=1)
        lungo = np.concatenate([[0], np.cumsum(tratti)]) * metro
        if lungo[-1] < 0.01:
            continue
        chiusa = np.allclose(linea[0], linea[-1])
        giri = max(1, round(lungo[-1] / passo)) if chiusa else lungo[-1] / passo      # su un bordo chiuso un numero intero di punti
        s_fitto = np.arange(0, lungo[-1], metro * 0.3)
        punti.append(np.stack([np.interp(s_fitto, lungo, linea[:, 0]), np.interp(s_fitto, lungo, linea[:, 1])], axis=1))
        fase.append(2 * np.pi * giri * s_fitto / lungo[-1])
    punti, fase = np.concatenate(punti), np.concatenate(fase)
    albero = cKDTree(punti)
    grezza = ndimage.distance_transform_edt(pezzi) * metro
    fascia = np.nonzero(pezzi & (grezza < portata + 3 * metro))
    dist, quale = albero.query(np.stack([fascia[1], fascia[0]], axis=1).astype(float), workers=-1)
    r = np.where(pezzi, 1.0, 0.0); g = np.full(pezzi.shape, 0.5); b = np.full(pezzi.shape, 0.5)
    r[fascia] = np.clip(dist * metro / portata, 0, 1)
    g[fascia] = 0.5 + 0.5 * np.cos(fase[quale]); b[fascia] = 0.5 + 0.5 * np.sin(fase[quale])
    senza = ndimage.binary_dilation(toppa, iterations=6) & ~pezzi | toppa          # sul pezzo sotto il taschino nessuna cucitura
    r[senza] = 1.0; g[senza] = 0.5; b[senza] = 0.5
    # la zona dove stava il taschino: il pezzo di sotto e due dita intorno al foro che lo ospita
    foro = pezzi & ~(np.asarray(pieno) > 0)
    petto = ndimage.binary_dilation(toppa | foro, iterations=int(0.014 / metro))
    return Image.fromarray((np.stack([r, g, b], axis=2) * 255 + 0.5).astype(np.uint8)), petto


def ripara_petto(immagine, petto):
    """Dove stava il taschino il tessuto è fatto di più pezzi sovrapposti per qualche millimetro, e i lembi di sotto
    nel calcolo restano in ombra: dove spuntano lasciano segnetti scuri, che col vento lampeggiano. In quella zona
    il petto è liscio: la luce si ricostruisce dai soli punti in piena luce, sfumati tra loro. I segni spariscono
    qualunque sia la loro grandezza, e la sfumatura del petto resta."""
    from scipy import ndimage
    righe, colonne = np.nonzero(petto)
    r0, r1, c0, c1 = max(righe.min() - 40, 0), righe.max() + 40, max(colonne.min() - 40, 0), colonne.max() + 40
    zona = immagine[r0:r1, c0:c1]
    chiaro = zona.mean(axis=2)
    intorno = ndimage.gaussian_filter(ndimage.maximum_filter(chiaro, size=41), 8.0)
    buoni = (chiaro > 0.86 * intorno).astype(np.float32)             # i punti in piena luce
    peso = np.maximum(ndimage.gaussian_filter(buoni, 9.0), 1e-4)
    liscia = np.stack([ndimage.gaussian_filter(zona[:, :, k] * buoni, 9.0) / peso for k in range(3)], axis=2)
    sfuma = ndimage.gaussian_filter(petto[r0:r1, c0:c1].astype(np.float32), 3.0)[:, :, None]
    esce = immagine.copy()
    esce[r0:r1, c0:c1] = zona * (1 - sfuma) + liscia * sfuma
    return esce.astype(np.float32)


def telaio(camicia, facce=7200):
    """Il telaio: una camicia semplificata, fatta col solo diritto, su cui il browser simula la stoffa.
    Ogni punto della camicia vera si aggancia poi al triangolo di telaio più vicino e lo segue.
    Restituisce punti, triangoli, la tenuta di ogni punto (appeso, rigido: vedi `tenuta`) e la sua parte."""
    from mathutils import kdtree
    me = camicia.data.copy()
    ob = bpy.data.objects.new('telaio', me)
    bpy.context.scene.collection.objects.link(ob)
    bm = bmesh.new(); bm.from_mesh(me)
    strato = bm.faces.layers.int['strato']
    # nel telaio il petto dev'essere un pezzo solo: via il pezzo che stava sotto il taschino con tutte le sue toppe,
    # e il foro che lascia nel davanti si chiude con tessuto nuovo, a maglie regolari
    fondo = bm.faces.layers.int['fondo']
    toppa = bm.faces.layers.int.get('toppa')
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f[strato] != 1 or f[fondo] or (toppa and f[toppa])], context='FACES')
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0012)
    nel_petto = lambda v: 0.03 < v.co.x < 0.19 and 0.03 < v.co.z < 0.22 and v.co.y < 0
    bordo = [e for e in bm.edges if e.is_boundary and nel_petto(e.verts[0]) and nel_petto(e.verts[1])]
    nuove = bmesh.ops.holes_fill(bm, edges=bordo, sides=0)['faces']
    nuove = bmesh.ops.triangulate(bm, faces=nuove, ngon_method='BEAUTY')['faces']
    dentro = {e for f in nuove for e in f.edges} - set(bordo)
    bmesh.ops.subdivide_edges(bm, edges=[e for e in dentro if e.calc_length() > 0.02], cuts=2, use_grid_fill=True)
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 3])
    print('telaio: foro del petto chiuso con', len(nuove), 'triangoli · lati liberi rimasti nella zona',
          sum(1 for e in bm.edges if e.is_boundary and nel_petto(e.verts[0]) and nel_petto(e.verts[1])))
    bm.to_mesh(me); bm.free()
    m = ob.modifiers.new('semplifica', 'DECIMATE')
    m.ratio = min(1.0, facce / max(sum(len(p.vertices) - 2 for p in me.polygons), 1))
    m.use_collapse_triangulate = True
    dg = bpy.context.evaluated_depsgraph_get()
    semplice = bpy.data.meshes.new_from_object(ob.evaluated_get(dg), depsgraph=dg)
    bm = bmesh.new(); bm.from_mesh(semplice)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    punti = np.array([v.co[:] for v in bm.verts])
    tri = np.array([[v.index for v in f.verts] for f in bm.faces])
    bm.free()
    # fermezza e parte: dal vertice più vicino della camicia vera
    orig = camicia.data
    co = np.zeros((len(orig.vertices), 3)); orig.vertices.foreach_get('co', co.ravel())
    appeso = np.zeros(len(orig.vertices), dtype=np.float32); orig.attributes['appeso'].data.foreach_get('value', appeso)
    rigido = np.zeros(len(orig.vertices), dtype=np.float32); orig.attributes['rigido'].data.foreach_get('value', rigido)
    parte = np.zeros(len(orig.vertices), dtype=np.int32); orig.attributes['parte'].data.foreach_get('value', parte)
    albero = kdtree.KDTree(len(co))
    for i, c in enumerate(co):
        albero.insert(c, i)
    albero.balance()
    vicino = np.array([albero.find(q)[1] for q in punti])
    bpy.data.objects.remove(ob); bpy.data.meshes.remove(me); bpy.data.meshes.remove(semplice)
    return punti, tri, appeso[vicino], rigido[vicino], parte[vicino]


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
    ap.add_argument('--campioni', type=int, default=256, help='campioni di Cycles per la luce')
    ap.add_argument('--lato', type=int, default=2048, help="lato in punti dell'immagine della luce")
    ap.add_argument('--braccia', type=float, default=0.0, help='di quanti gradi abbassare le braccia (0: come nel modello)')
    ap.add_argument('--stropicciata', action='store_true', help='lascia le grinze del modello (di base la camicia si stira)')
    ap.add_argument('--riusa', action='store_true', help='se nella cartella di uscita c\'è già la luce calcolata (luce-cruda.npy) non la ricalcola')
    a = ap.parse_args()
    os.makedirs(a.uscita, exist_ok=True)
    import json
    from PIL import Image

    sc, ob = importa(a.obj)
    me = ob.data
    segna_strati(ob)
    assottiglia(ob)
    tasca, fondo_tasca = facce_taschino(ob)
    rattoppa(ob, tasca, fondo_tasca)
    # fermezza e parti si decidono sulla posa originale, dove polsini, collo e maniche si riconoscono dalla posizione
    co0 = np.zeros((len(me.vertices), 3)); me.vertices.foreach_get('co', co0.ravel())
    co0 -= np.array([0.0, 0.0, (co0[:, 2].max() + co0[:, 2].min()) / 2])
    parti(ob)
    abbassa_braccia(ob, a.braccia)
    tenuta(co0)                      # fissa la quota del collo per riconoscere le zone
    if not a.stropicciata:
        stira(ob, co0)
    tipo_faccia = quattro_materiali(ob)
    co, centro = centra(ob)
    metri_per_uv = mappa_in_scala(ob, tipo_faccia)
    print('vertici', len(me.vertices), 'triangoli', sum(len(p.vertices) - 2 for p in me.polygons), 'centro tolto', centro.round(3))
    for nome, valori in zip(('appeso', 'rigido'), tenuta(co0)):
        me.attributes.new(nome, 'FLOAT', 'POINT').data.foreach_set('value', valori.astype(np.float32))
    ob.name = 'camicia'
    taschino = separa(ob, 'taschino')
    tappa_buchi(ob)
    fodera_del_petto(ob)
    for o in (ob, taschino):
        for p in o.data.polygons:
            p.use_smooth = True

    # la luce: lo studio dell'apertura, calcolato una volta per tutte
    luci.studio(sc)
    cruda = os.path.join(a.uscita, 'luce-cruda.npy')         # il calcolo dura dieci minuti: si tiene da parte
    if a.riusa and os.path.exists(cruda):
        immagine = np.load(cruda).astype(np.float32)
    else:
        immagine = cuoci_luce(sc, ob, taschino, a.lato, a.campioni)
        np.save(cruda, immagine.astype(np.float16))
    cuciture, petto = mappa_cuciture([ob, taschino], metri_per_uv, a.lato)
    cuciture.save(os.path.join(a.uscita, 'cuciture.webp'), lossless=True, method=6)      # senza perdita: sono misure, non un'immagine
    immagine, coperti = pulisci(immagine)
    immagine = ripara_petto(immagine, petto)
    scala = 0.97 / float(np.percentile(immagine[coperti], 99.9))     # il punto più chiaro appena sotto il bianco
    print('luce: punti coperti %.1f%%' % (100 * coperti.mean()), '· media', round(float(immagine[coperti].mean()), 3),
          '· 99,9%', round(float(np.percentile(immagine[coperti], 99.9)), 3), '· scala', round(scala, 3))
    srgb = np.clip(immagine * scala, 0, 1)
    srgb = np.where(srgb <= 0.0031308, srgb * 12.92, 1.055 * srgb ** (1 / 2.4) - 0.055)
    Image.fromarray((srgb * 255 + 0.5).astype(np.uint8)).save(os.path.join(a.uscita, 'luce.webp'), quality=93, method=6)
    sui_vertici = liscia(luce_dei_vertici(sc, ob, nascosti=(taschino,)), ob)
    sfera = luce_per_orientamento(ob, sui_vertici)
    scrivi_dati(ob, sui_vertici, scala)
    scrivi_dati(taschino, liscia(luce_dei_vertici(sc, taschino), taschino), scala)


    punti, tri, appeso, rigido, parte = telaio(ob)
    # il browser ha Y in alto e il davanti verso +Z
    nel_browser = lambda q: np.stack([q[:, 0], q[:, 2], -q[:, 1]], axis=1)
    with open(os.path.join(a.uscita, 'telaio.json'), 'w') as f:
        json.dump({'punti': np.round(nel_browser(punti), 4).ravel().tolist(), 'triangoli': tri.ravel().tolist(),
                   'appeso': np.round(appeso, 2).tolist(), 'rigido': np.round(rigido, 2).tolist(), 'parte': parte.tolist()},
                  f, separators=(',', ':'))
    print('telaio: punti', len(punti), 'triangoli', len(tri))

    for o in (ob, taschino):
        for nome in ('appeso', 'rigido', 'parte', 'strato', 'fondo', 'toppa'):
            if nome in o.data.attributes:
                o.data.attributes.remove(o.data.attributes[nome])
    esporta([ob, taschino], os.path.join(a.uscita, 'camicia.glb'))
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(a.uscita, 'camicia.blend'))
    dati = {'metri_per_uv': round(metri_per_uv, 4), 'luce_scala': round(scala, 4), 'luce_media': round(float(immagine[coperti].mean()), 4),
            'cuciture_portata': 0.016, 'cuciture_passo': 0.0028,
            'luce_sfera': np.round(sfera, 4).tolist(),
            'vertici': len(ob.data.vertices) + len(taschino.data.vertices),
            'mezzo_ingombro': [round(float(x), 4) for x in (co.max(0) - co.min(0)) / 2],
            'riposo': luci.RIPOSO, 'finestra': list(luci.FINESTRA), 'luce_chiave': list(luci.CHIAVE_PER_IL_BROWSER),
            'gruccia': misure_per_la_gruccia(ob)}
    with open(os.path.join(a.uscita, 'camicia.json'), 'w') as f:
        json.dump(dati, f, indent=1)
    print('scritto', os.path.join(a.uscita, 'camicia.glb'), os.path.getsize(os.path.join(a.uscita, 'camicia.glb')), 'byte', dati)


if __name__ == '__main__':
    main()
