"""La camicia del configuratore come film: la scena.

Dal 17 novembre 2026 la camicia non si disegna più in diretta nel browser (bocciata dal proprietario dopo quattro
giri): è una camicia Blender già fatta, comprata da lui ("Hanging Button Shirt 01" di iMeshh), calcolata con Cycles
come l'apertura. Sul sito vanno solo le immagini; il file comprato NON sta nel repository.

Questo modulo apre il file comprato e gli costruisce intorno la scena scelta dal proprietario:
  - bottoni di madreperla chiara al posto di quelli scuri, e via i due bottoni sulle punte del colletto;
  - gruccia di legno (nel file è di plastica nera) con il suo gancio di metallo;
  - nastro blu scuro che sale fuori dall'inquadratura ("non mi piace il bianco");
  - parete blu Endero, luce di una finestra con le sbarre da davanti a destra, ombra della camicia sulla parete.
Si usa da `prova.py` (un'immagine) e da `produci.py` (i fotogrammi del film).
Blender come modulo Python: vedi CLAUDE.md, "Problemi già incontrati".
"""
import math

import bpy  # per primo: prepara i percorsi degli altri moduli di Blender
import bmesh  # noqa: E402
import numpy as np
from mathutils import Matrix, Vector  # noqa: E402

# La camicia nel file: X a destra di chi guarda, davanti verso -Y, Z in alto; il gancio arriva a quota zero circa.
RIPOSO = -0.2                          # la camicia sta appena girata verso sinistra (radianti intorno alla verticale)
FINESTRA = Vector((0.535, -0.765, 0.357)).normalized()     # verso da cui arriva la luce: da destra, da davanti, dall'alto
PARETE = 0.52                          # la parete sta a 52 cm dietro l'asse della camicia
BLU_PARETE = (0.0048, 0.0300, 0.1700)  # il blu di Endero dove batte la luce (#1b3c7e sullo schermo)
BLU_NASTRO = (0.0065, 0.0180, 0.0700)  # il blu scuro del nastro
LARGO_NASTRO = 0.021
# Il fotogramma. Sul computer la pagina ne mostra la fascia larga il doppio dell'altezza (le finestre dei browser sono
# larghe e basse: 1920 x 950, 1440 x 790) e taglia l'8% in alto e il 2% in basso; sul telefono lo mostra intero,
# ritagliato in verticale: lì in alto c'è la testata, e serve aria sopra il gancio.
# La camicia sta a sinistra (al 39,5% della larghezza): a destra resta la parete in ombra, dove la pagina mette il
# riquadro in vetro. Il proprietario l'ha voluta più vicina ("Avvicina un po', troppo lontano"): dal gancio all'orlo
# prende il 78% dell'altezza del fotogramma, cioè l'87% di ciò che si vede sul computer.
LARGA, ALTA, FUORI_ASSE = 1800, 1000, -0.095
CAMICIA_NEL_FOTOGRAMMA = 0.783         # dal punto in cui il nastro regge il gancio all'orlo, in frazione dell'altezza
ORLO_NEL_FOTOGRAMMA = 0.94             # dove sta l'orlo, dall'alto


def apri(file_blend):
    """Apre il file comprato senza eseguire eventuali script che contiene. Restituisce camicia, bottoni, gruccia."""
    bpy.ops.wm.open_mainfile(filepath=file_blend, use_scripts=False)
    ob = {o.name.rsplit('_', 1)[-1]: o for o in bpy.context.scene.objects if o.type == 'MESH'}
    camicia = next(o for o in bpy.context.scene.objects if o.type == 'MESH' and o.parent is None)
    return camicia, ob['Buttons'], ob['Hanger']


def _pezzi(me):
    """I pezzi staccati di una mesh: per ognuno la lista dei suoi vertici."""
    bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
    visti, pezzi = set(), []
    for v in bm.verts:
        if v.index in visti:
            continue
        pila, lista = [v], []
        visti.add(v.index)
        while pila:
            u = pila.pop(); lista.append(u.index)
            for e in u.link_edges:
                w = e.other_vert(u)
                if w.index not in visti:
                    visti.add(w.index); pila.append(w)
        pezzi.append(lista)
    bm.free()
    return pezzi


def _mondo(ob):
    return np.array([(ob.matrix_world @ v.co)[:] for v in ob.data.vertices])


def togli_bottoni_del_colletto(bottoni):
    """Nel file il colletto è "button-down": due bottoni ne fermano le punte. Il proprietario non li vuole.
    Sono i soli bottoni alti che non stanno sull'asse dell'abbottonatura."""
    co = _mondo(bottoni)
    alto = co[:, 2].max()
    via = [i for p in _pezzi(bottoni.data) for i in p
           if abs(co[p][:, 0].mean()) > 0.015 and co[p][:, 2].mean() > alto - 0.06]
    bm = bmesh.new(); bm.from_mesh(bottoni.data); bm.verts.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[bm.verts[i] for i in via], context='VERTS')
    bm.to_mesh(bottoni.data); bm.free()
    bottoni.data.update()
    return len(via)


def _principled(nome):
    m = bpy.data.materials.new(nome)
    m.use_nodes = True
    return m, m.node_tree.nodes, m.node_tree.links, m.node_tree.nodes['Principled BSDF']


def madreperla():
    """Bottoni di madreperla chiara: bianco perlato, lucido, con un filo di iridescenza."""
    m, N, L, p = _principled('madreperla')
    onda = N.new('ShaderNodeTexNoise'); onda.inputs['Scale'].default_value = 90; onda.inputs['Detail'].default_value = 3
    rampa = N.new('ShaderNodeValToRGB')
    rampa.color_ramp.elements[0].color = (0.80, 0.77, 0.71, 1); rampa.color_ramp.elements[1].color = (0.93, 0.92, 0.88, 1)
    L.new(onda.outputs['Fac'], rampa.inputs['Fac']); L.new(rampa.outputs['Color'], p.inputs['Base Color'])
    p.inputs['Roughness'].default_value = 0.22
    p.inputs['Coat Weight'].default_value = 0.5; p.inputs['Coat Roughness'].default_value = 0.12
    p.inputs['Thin Film Thickness'].default_value = 420; p.inputs['Thin Film IOR'].default_value = 1.5
    return m


def legno():
    """Il legno della gruccia: faggio verniciato, con la venatura che corre lungo il pezzo."""
    m, N, L, p = _principled('legno')
    dove = N.new('ShaderNodeTexCoord'); stira = N.new('ShaderNodeMapping')
    stira.inputs['Scale'].default_value = (1.2, 14.0, 14.0)             # la venatura è lunga lungo X
    fibra = N.new('ShaderNodeTexNoise'); fibra.inputs['Scale'].default_value = 9; fibra.inputs['Detail'].default_value = 6; fibra.inputs['Roughness'].default_value = 0.62
    rampa = N.new('ShaderNodeValToRGB')
    rampa.color_ramp.elements[0].position = 0.32; rampa.color_ramp.elements[0].color = (0.170, 0.075, 0.028, 1)
    rampa.color_ramp.elements[1].position = 0.72; rampa.color_ramp.elements[1].color = (0.420, 0.235, 0.105, 1)
    rilievo = N.new('ShaderNodeBump'); rilievo.inputs['Strength'].default_value = 0.08; rilievo.inputs['Distance'].default_value = 0.002
    L.new(dove.outputs['Object'], stira.inputs['Vector']); L.new(stira.outputs['Vector'], fibra.inputs['Vector'])
    L.new(fibra.outputs['Fac'], rampa.inputs['Fac']); L.new(rampa.outputs['Color'], p.inputs['Base Color'])
    L.new(fibra.outputs['Fac'], rilievo.inputs['Height']); L.new(rilievo.outputs['Normal'], p.inputs['Normal'])
    p.inputs['Roughness'].default_value = 0.34
    p.inputs['Coat Weight'].default_value = 0.35; p.inputs['Coat Roughness'].default_value = 0.2
    return m


def gros_grain():
    """Il nastro: gros-grain blu scuro, con le sue costine fitte di traverso e la peluria che lo stacca dalla parete."""
    m, N, L, p = _principled('nastro')
    dove = N.new('ShaderNodeTexCoord')
    costine = N.new('ShaderNodeTexWave'); costine.wave_type = 'BANDS'; costine.bands_direction = 'Y'
    costine.inputs['Scale'].default_value = 1.0; costine.inputs['Distortion'].default_value = 0.0
    scala = N.new('ShaderNodeMapping'); scala.inputs['Scale'].default_value = (1.0, 760.0, 1.0)      # una costina ogni 1,3 mm
    rilievo = N.new('ShaderNodeBump'); rilievo.inputs['Strength'].default_value = 0.5; rilievo.inputs['Distance'].default_value = 0.0004
    L.new(dove.outputs['UV'], scala.inputs['Vector']); L.new(scala.outputs['Vector'], costine.inputs['Vector'])
    L.new(costine.outputs['Fac'], rilievo.inputs['Height']); L.new(rilievo.outputs['Normal'], p.inputs['Normal'])
    p.inputs['Base Color'].default_value = (*BLU_NASTRO, 1)
    p.inputs['Roughness'].default_value = 0.55
    p.inputs['Sheen Weight'].default_value = 0.6; p.inputs['Sheen Roughness'].default_value = 0.4
    p.inputs['Sheen Tint'].default_value = (0.55, 0.68, 1.0, 1)
    return m


def stira_il_tessuto(camicia, quanto=0.6):
    """Il tessuto del file ha una grana di piccole grinze (una mappa di rilievo). Il proprietario lo vuole "popeline
    leggero e stirato": la grana resta, perché è lei che lo fa sembrare vero, ma più bassa."""
    for mat in camicia.data.materials:
        for n in mat.node_tree.nodes:
            if n.type == 'NORMAL_MAP':
                n.inputs['Strength'].default_value *= quanto


def vesti_la_gruccia(gruccia):
    """La plastica nera diventa legno; il metallo del gancio resta."""
    for i, mat in enumerate(gruccia.data.materials):
        if mat and 'Plastic' in mat.name:
            gruccia.data.materials[i] = legno()


ANCORA = 0.75                         # il nastro è fissato 75 cm sopra il gancio, fuori dall'inquadratura: da lì dondola tutto


def gancio_in_cima(gruccia):
    """Il punto più alto del gancio e il raggio del suo filo di metallo."""
    co = _mondo(gruccia)
    g = co[max(_pezzi(gruccia.data), key=lambda p: co[p][:, 2].max())]      # il pezzo che arriva più in alto
    return g[g[:, 2].argmax()], float(np.ptp(g[:, 1])) / 2


def appiglio(gruccia):
    """Il punto in cui il nastro regge il gancio: sotto il filo, nel suo punto più alto. Da lì gira tutto."""
    cima, spesso = gancio_in_cima(gruccia)
    return Vector((float(cima[0]), float(cima[1]), float(cima[2] - 2 * spesso)))


def nastro(gruccia):
    """Il nastro: scende dall'alto, passa sotto la curva del gancio e risale. Restituisce l'oggetto e il punto del
    gancio a cui è appeso."""
    cima, spesso = gancio_in_cima(gruccia)
    sotto = cima[2] - 2 * spesso                                   # il nastro passa sotto il filo, nel punto più alto
    R = spesso + 0.0012
    via = [(cima[2] + 1.6, -R)]
    for k in range(13):
        a = math.pi * k / 12
        via.append((sotto + spesso - R * math.sin(a) + 0.0, -R * math.cos(a)))
    via += [(cima[2] + 0.035, R), (cima[2] + 0.06, R * 0.4), (cima[2] + 1.6, R * 0.4)]
    me = bpy.data.meshes.new('nastro')
    vert, facce, uv = [], [], []
    lungo = 0.0
    for i, (z, y) in enumerate(via):
        if i:
            lungo += math.hypot(z - via[i - 1][0], y - via[i - 1][1])
        vert += [(cima[0] - LARGO_NASTRO / 2, cima[1] + y, z), (cima[0] + LARGO_NASTRO / 2, cima[1] + y, z)]
        uv += [(0.0, lungo), (1.0, lungo)]
        if i:
            facce.append((2 * i - 2, 2 * i - 1, 2 * i + 1, 2 * i))
    me.from_pydata(vert, [], facce)
    mappa = me.uv_layers.new(name='UVMap')
    for l in me.loops:
        mappa.data[l.index].uv = uv[l.vertex_index]
    for p in me.polygons:
        p.use_smooth = True
    me.materials.append(gros_grain())
    ob = bpy.data.objects.new('nastro', me)
    bpy.context.scene.collection.objects.link(ob)
    m = ob.modifiers.new('spessore', 'SOLIDIFY'); m.thickness = 0.0007
    return ob, appiglio(gruccia)


def parete():
    me = bpy.data.meshes.new('parete')
    L = 9.0
    me.from_pydata([(-L, PARETE, -L), (L, PARETE, -L), (L, PARETE, L), (-L, PARETE, L)], [], [(0, 1, 2, 3)])
    m, N, Ln, p = _principled('parete')
    p.inputs['Base Color'].default_value = (*BLU_PARETE, 1)
    p.inputs['Roughness'].default_value = 0.9
    p.inputs['Specular IOR Level'].default_value = 0.2
    # l'intonaco non è mai perfettamente liscio: un rilievo finissimo, che si vede solo dove la luce è radente
    grana = N.new('ShaderNodeTexNoise'); grana.inputs['Scale'].default_value = 260; grana.inputs['Detail'].default_value = 4
    rilievo = N.new('ShaderNodeBump'); rilievo.inputs['Strength'].default_value = 0.06; rilievo.inputs['Distance'].default_value = 0.001
    Ln.new(grana.outputs['Fac'], rilievo.inputs['Height']); Ln.new(rilievo.outputs['Normal'], p.inputs['Normal'])
    me.materials.append(m)
    ob = bpy.data.objects.new('parete', me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def finestra(centro):
    """La finestra: non si vede, fa solo ombra. È un telaio con le sue sbarre messo tra il sole e la scena, di
    traverso ai raggi: la luce che passa disegna i vetri sulla parete e sulla camicia."""
    via = FINESTRA
    lato = Vector((0, 0, 1)).cross(via).normalized()             # verso destra, visto dal sole
    su = via.cross(lato).normalized()
    origine = centro + via * 3.4
    MEZZA_L, MEZZA_A, SBARRA, PASSO_L, PASSO_A, FUORI = 0.74, 0.80, 0.017, 0.247, 0.30, 2.6
    rett = [(-FUORI, -MEZZA_L, -FUORI, FUORI), (MEZZA_L, FUORI, -FUORI, FUORI),          # il muro intorno al vano
            (-MEZZA_L, MEZZA_L, MEZZA_A, FUORI), (-MEZZA_L, MEZZA_L, -FUORI, -MEZZA_A)]
    x = -MEZZA_L + PASSO_L
    while x < MEZZA_L - 0.01:                                      # sbarre verticali; quella di mezzo è il montante
        mezzo = SBARRA * (2.3 if abs(x) < 0.01 else 1) / 2
        rett.append((x - mezzo, x + mezzo, -MEZZA_A, MEZZA_A)); x += PASSO_L
    y = -MEZZA_A + PASSO_A * 0.8
    while y < MEZZA_A - 0.01:
        rett.append((-MEZZA_L, MEZZA_L, y - SBARRA / 2, y + SBARRA / 2)); y += PASSO_A
    vert, facce = [], []
    for a, b, c, d in rett:
        n = len(vert)
        vert += [tuple(origine + lato * px + su * py) for px, py in ((a, c), (b, c), (b, d), (a, d))]
        facce.append((n, n + 1, n + 2, n + 3))
    me = bpy.data.meshes.new('finestra'); me.from_pydata(vert, [], facce)
    nero = bpy.data.materials.new('telaio'); nero.use_nodes = True
    nero.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0, 0, 0, 1)
    me.materials.append(nero)
    ob = bpy.data.objects.new('finestra', me)
    bpy.context.scene.collection.objects.link(ob)
    ob.visible_camera = False; ob.visible_diffuse = False; ob.visible_glossy = False
    return ob


def luci(sc, centro):
    w = bpy.data.worlds.new('stanza'); w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[0].default_value = (0.20, 0.30, 0.62, 1)      # la stanza in penombra, azzurra
    w.node_tree.nodes['Background'].inputs[1].default_value = 0.13
    sc.world = w
    sole = bpy.data.lights.new('finestra', 'SUN')
    sole.energy = 2.45; sole.angle = math.radians(1.3); sole.color = (1.0, 0.955, 0.90)
    o = bpy.data.objects.new('sole', sole); sc.collection.objects.link(o)
    o.rotation_euler = FINESTRA.to_track_quat('Z', 'Y').to_euler()
    # la stanza rimanda luce sulla camicia dal lato in ombra: un pannello grande e morbido, davanti a sinistra
    schiarita = bpy.data.lights.new('schiarita', 'AREA')
    schiarita.energy = 20; schiarita.size = 2.6; schiarita.color = (0.86, 0.91, 1.0)
    s = bpy.data.objects.new('schiarita', schiarita); sc.collection.objects.link(s)
    s.location = centro + Vector((-2.3, -2.6, 0.3))
    s.rotation_euler = (centro - s.location).to_track_quat('-Z', 'Y').to_euler()
    return o, s


def camera(sc, centro, larga, alta, altezza_scena, fuori_asse=0.0):
    """La camera guarda la camicia di fronte, da lontano (poca prospettiva). `fuori_asse` sposta la camicia di lato
    nell'inquadratura (frazione della larghezza: negativa = verso sinistra) senza girare la camera."""
    dati = bpy.data.cameras.new('camera')
    dati.lens = 85; dati.sensor_width = 36
    cam = bpy.data.objects.new('camera', dati); sc.collection.objects.link(cam)
    sc.camera = cam
    sc.render.resolution_x, sc.render.resolution_y = larga, alta
    visto_in_alto = altezza_scena                                  # quanti metri deve coprire l'altezza dell'immagine
    visto_in_largo = visto_in_alto * larga / alta
    lontano = visto_in_largo / (36 / 85) if larga >= alta else visto_in_alto / (36 / 85)
    cam.location = centro + Vector((0, -lontano, 0))
    cam.rotation_euler = (math.pi / 2, 0, 0)
    dati.shift_x = -fuori_asse
    dati.clip_start = 0.5; dati.clip_end = 30
    return cam


def prepara_resa(sc, campioni=128):
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = campioni
    sc.cycles.use_adaptive_sampling = True; sc.cycles.adaptive_threshold = 0.02
    sc.cycles.max_bounces = 6; sc.cycles.diffuse_bounces = 3; sc.cycles.glossy_bounces = 3
    sc.cycles.caustics_reflective = False; sc.cycles.caustics_refractive = False
    try:
        sc.cycles.use_denoising = True; sc.cycles.denoiser = 'OPENIMAGEDENOISE'
    except Exception:                                              # questo Blender è senza il ripulitore: più campioni
        sc.cycles.use_denoising = False
    sc.view_settings.view_transform = 'Standard'                   # "AgX" ingrigisce il bianco (vedi CLAUDE.md)
    sc.view_settings.look = 'None'
    sc.render.film_transparent = False
    sc.render.image_settings.file_format = 'PNG'
    sc.render.use_persistent_data = True


def costruisci(file_blend, larga=LARGA, alta=ALTA, campioni=128, fuori_asse=FUORI_ASSE):
    """Apre la camicia comprata e monta tutta la scena. Restituisce un dizionario con i pezzi."""
    camicia, bottoni, gruccia = apri(file_blend)
    sc = bpy.context.scene
    tolti = togli_bottoni_del_colletto(bottoni)
    # dove stanno camicia e bottoni prima di appenderli al perno: serve a `produci.py` per muoverne i punti
    a_riposo = {'camicia': camicia.matrix_world.copy(), 'bottoni': bottoni.matrix_world.copy()}
    bottoni.data.materials.clear(); bottoni.data.materials.append(madreperla())
    vesti_la_gruccia(gruccia)
    stira_il_tessuto(camicia)
    striscia, appiglio_gancio = nastro(gruccia)
    # tutto pende dal punto in cui il nastro regge il gancio: girando e dondolando quel perno, si muove tutto
    # (l'altalena è il punto, più in alto, in cui il nastro è fissato: il perno gira, l'altalena dondola)
    altalena = bpy.data.objects.new('altalena', None); sc.collection.objects.link(altalena)
    altalena.location = appiglio_gancio + Vector((0, 0, ANCORA))
    perno = bpy.data.objects.new('perno', None); sc.collection.objects.link(perno)
    perno.parent = altalena; perno.location = (0, 0, -ANCORA)
    bpy.context.view_layer.update()
    for o in (camicia, striscia):
        mondo = o.matrix_world.copy(); o.parent = perno; o.matrix_parent_inverse = perno.matrix_world.inverted(); o.matrix_world = mondo
    perno.rotation_euler = (0, 0, RIPOSO)
    bpy.context.view_layer.update()
    co = _mondo(camicia)
    basso, alto = float(co[:, 2].min()), float(appiglio_gancio.z)
    centro = Vector((0.0, 0.0, (basso + alto) / 2 + 0.035))
    # dove cade sulla parete l'ombra del centro della camicia: lì intorno batte la luce della finestra
    cade = centro - FINESTRA * (PARETE / -FINESTRA.y)
    muro = parete(); vano = finestra(Vector((cade.x + 0.05, PARETE, cade.z + 0.16)))
    sole, schiarita = luci(sc, centro)
    # l'inquadratura: quanto è alto il fotogramma, in metri, e dove guarda la camera
    visto = (alto - basso) / CAMICIA_NEL_FOTOGRAMMA
    mira = Vector((0.0, 0.0, basso + visto * (ORLO_NEL_FOTOGRAMMA - 0.5)))
    cam = camera(sc, mira, larga, alta, visto, fuori_asse)
    prepara_resa(sc, campioni)
    return {'camicia': camicia, 'bottoni': bottoni, 'gruccia': gruccia, 'nastro': striscia, 'perno': perno, 'altalena': altalena, 'parete': muro,
            'finestra': vano, 'sole': sole, 'schiarita': schiarita, 'camera': cam, 'centro': centro, 'bottoni_tolti': tolti, 'a_riposo': a_riposo}
