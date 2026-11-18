"""La camicia del configuratore in diretta nel browser: ciò che Blender prepara.

Il proprietario, provati il film e le pose: vuole "poterla muovere come voglio, quanto voglio, anche continuamente",
come il cappotto di beat.noomoagency.com, e ha scelto: camicia sempre di fronte, tessuto che cede e ondeggia dove
passa il mouse, 3D in diretta. Le prime prove di 3D in diretta le aveva bocciate perché sembravano finte: lì la luce
la calcolava il browser. Qui no. La camicia resta di fronte, quindi ciò che si vede di lei è quasi sempre ciò che si
vede da ferma: il browser muove la forma (src/configuratore/viva.js) e sopra ci proietta, dalla stessa camera, le
immagini calcolate da Cycles. Da ferma è l'immagine di Blender, punto per punto.

    <venv>/bin/python camicia/viva/scatta.py <file .blend comprato> <cartella di lavoro> [--campioni 96]

Scrive nella cartella di lavoro (poi `camicia/viva/monta.mjs` ne fa i file del sito):
  camicia-sole.exr, camicia-ombra.exr   la camicia con gruccia e nastro, senza parete: col sole pieno (senza le sbarre
                                        della finestra) e col sole spento. Il browser mescola le due secondo le sbarre,
                                        che stanno ferme nello spazio mentre la camicia si muove.
  parete-luce.exr, parete-ombra.exr     la parete da sola, con la luce della finestra e senza sole: tra le due sceglie
                                        l'ombra della camicia, che il browser calcola in diretta.
  finestra.exr                          il disegno di luce della finestra, visto dal sole, alla distanza della camicia.
  scena.json                            la camera, il sole, la parete, dove sta ogni cosa (assi di stoffa.mjs).
  *.f32 / *.i32                         le forme: camicia semplificata, bottoni, gruccia, nastro.
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'film'))
import scena  # noqa: E402  (importa bpy)
import bpy  # noqa: E402
import bmesh  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

RITAGLIO = (0.22, 0.57)          # la fascia del fotogramma in cui stanno camicia, gruccia e nastro, da ferme
FACCE = 24000                    # triangoli della camicia nel browser: la forma, non il dettaglio (quello è nelle immagini)
LATO_FINESTRA = 2.6              # metri coperti dal disegno di luce della finestra
# dagli assi di Blender (davanti verso -Y, Z in alto) a quelli di stoffa.mjs (Y in alto, davanti verso +Z), e ritorno
A_STOFFA = Matrix(((1, 0, 0, 0), (0, 0, 1, 0), (0, -1, 0, 0), (0, 0, 0, 1)))
DA_STOFFA = A_STOFFA.inverted()


def per_stoffa(q):
    q = np.asarray(q, dtype=np.float64)
    return np.stack([q[:, 0], q[:, 2], -q[:, 1]], axis=1)


def forma(ob, a_riposo, semplifica=None):
    """Vertici (dove stavano prima che la camicia fosse appesa e girata: lo spazio di stoffa.mjs) e triangoli."""
    dg = bpy.context.evaluated_depsgraph_get()
    me = ob.data.copy()
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free()
    if semplifica:
        tmp = bpy.data.objects.new('tmp', me); bpy.context.scene.collection.objects.link(tmp)
        m = tmp.modifiers.new('semplifica', 'DECIMATE'); m.ratio = min(1.0, semplifica / len(me.polygons))
        dg = bpy.context.evaluated_depsgraph_get()
        me = bpy.data.meshes.new_from_object(tmp.evaluated_get(dg), depsgraph=dg)
        bpy.data.objects.remove(tmp)
        bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.triangulate(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get('co', co)
    co = np.c_[co.reshape(-1, 3), np.ones(len(me.vertices))] @ np.array(a_riposo).T
    tri = np.empty(len(me.polygons) * 3, dtype=np.int32); me.polygons.foreach_get('vertices', tri)
    return per_stoffa(co[:, :3]), tri.reshape(-1, 3)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('blend'); ap.add_argument('uscita')
    ap.add_argument('--campioni', type=int, default=96)
    ap.add_argument('--solo-forme', action='store_true', help='non calcola le immagini')
    a = ap.parse_args()
    os.makedirs(a.uscita, exist_ok=True)
    p = scena.costruisci(a.blend, scena.LARGA, scena.ALTA, a.campioni)
    sc = bpy.context.scene
    assert abs(sc.view_settings.gamma - 1) < 1e-6 and sc.view_settings.view_transform == 'Standard', 'la resa non è più "Standard" senza correzioni: rivedere immagini.py'
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    cam = p['camera']

    # --- dove stavano le cose prima di essere appese al perno e girate: lo spazio in cui lavora la fisica
    prima = p['a_riposo']['camicia'] @ p['camicia'].matrix_world.inverted()        # dal mondo di adesso a quello di prima
    forme = {}
    forme['camicia'] = forma(p['camicia'], p['a_riposo']['camicia'], FACCE)
    forme['bottoni'] = forma(p['bottoni'], p['a_riposo']['bottoni'])
    forme['gruccia'] = forma(p['gruccia'], prima @ p['gruccia'].matrix_world)
    # il nastro ha uno spessore dato da un modificatore: se ne prende la forma finita
    nastro = bpy.data.meshes.new_from_object(p['nastro'].evaluated_get(dg), depsgraph=dg)
    finto = bpy.data.objects.new('nastro-finito', nastro)
    forme['nastro'] = forma(finto, prima @ p['nastro'].matrix_world)
    for nome, (punti, tri) in forme.items():
        punti.astype('<f4').tofile(os.path.join(a.uscita, f'{nome}.f32'))
        tri.astype('<i4').tofile(os.path.join(a.uscita, f'{nome}-tri.i32'))
        print(f'{nome}: {len(punti)} punti, {len(tri)} triangoli')

    # --- la scena, negli assi di stoffa.mjs. Il mondo di Blender è quello "appeso": camicia girata di RIPOSO sul perno.
    proiezione = cam.calc_matrix_camera(dg, x=scena.LARGA, y=scena.ALTA)
    vista = cam.matrix_world.inverted()
    camera = proiezione @ vista @ DA_STOFFA                                          # da stoffa (mondo appeso) allo schermo
    via = scena.FINESTRA
    lato = Vector((0, 0, 1)).cross(via).normalized(); su = via.cross(lato).normalized()
    centro = p['centro']
    gancio = p['perno'].matrix_world.translation                                    # il punto in cui il nastro regge il gancio
    s = lambda v: [round(float(c), 6) for c in per_stoffa([tuple(v)])[0]]
    dati = {
        'fotogramma': [scena.LARGA, scena.ALTA], 'ritaglio': list(RITAGLIO),
        'camera': [[round(float(camera[r][c]), 7) for c in range(4)] for r in range(4)],
        'sole': s(via), 'parete': -scena.PARETE,                                     # la parete è il piano z = parete
        'gancio': s(gancio), 'ancora': scena.ANCORA, 'riposo': scena.RIPOSO,
        # il file comprato ha un'esposizione sua (in stop): Blender la applica alle immagini finite, non agli EXR
        'esposizione': round(float(sc.view_settings.exposure), 5),
        'finestra': {'centro': s(centro), 'lato': s(lato), 'su': s(su), 'metri': LATO_FINESTRA},
    }
    with open(os.path.join(a.uscita, 'scena.json'), 'w') as f:
        json.dump(dati, f)
    print('scena.json scritto · gancio', dati['gancio'], '· sole', dati['sole'])
    if a.solo_forme:
        return

    # --- le immagini, in luce vera (EXR): le riduce a immagini per il browser monta.mjs
    sc.render.image_settings.file_format = 'OPEN_EXR'; sc.render.image_settings.color_depth = '32'
    sc.render.image_settings.color_mode = 'RGBA'
    cose = [p['camicia'], p['bottoni'], p['gruccia'], p['nastro']]

    def scatta(nome, larga, alta, campioni):
        sc.render.resolution_x, sc.render.resolution_y = larga, alta
        sc.cycles.samples = campioni
        sc.render.filepath = os.path.join(os.path.abspath(a.uscita), nome + '.exr')
        if os.path.exists(sc.render.filepath):
            print(nome, 'c\'è già'); return
        bpy.ops.render.render(write_still=True)
        print(nome, 'fatta', flush=True)

    # la parete da sola: con la luce della finestra, e senza sole
    for o in cose:
        o.hide_render = True
    sc.render.film_transparent = False
    scatta('parete-luce', scena.LARGA, scena.ALTA, a.campioni)
    p['sole'].hide_render = True
    scatta('parete-ombra', scena.LARGA, scena.ALTA, a.campioni)
    p['sole'].hide_render = False

    # la camicia da sola (la parete c'è, e rimanda la sua luce, ma la camera non la vede), a grandezza doppia,
    # solo nella fascia in cui sta: col sole pieno, senza le sbarre, e col sole spento
    for o in cose:
        o.hide_render = False
    p['parete'].visible_camera = False
    sc.render.film_transparent = True
    sc.render.use_border = True; sc.render.use_crop_to_border = True
    sc.render.border_min_x, sc.render.border_max_x, sc.render.border_min_y, sc.render.border_max_y = RITAGLIO[0], RITAGLIO[1], 0.0, 1.0
    p['finestra'].hide_render = True
    scatta('camicia-sole', scena.LARGA * 2, scena.ALTA * 2, a.campioni)
    p['sole'].hide_render = True
    scatta('camicia-ombra', scena.LARGA * 2, scena.ALTA * 2, a.campioni)
    p['sole'].hide_render = False; p['finestra'].hide_render = False
    sc.render.use_border = False; p['parete'].visible_camera = True; sc.render.film_transparent = False

    # il disegno di luce della finestra: un foglio bianco di traverso ai raggi, dove sta la camicia, visto dal sole
    for o in cose + [p['parete'], p['schiarita']]:
        o.hide_render = True
    sc.world.node_tree.nodes['Background'].inputs[1].default_value = 0.0
    me = bpy.data.meshes.new('foglio'); L = LATO_FINESTRA
    me.from_pydata([tuple(centro + lato * x + su * y) for x, y in ((-L, -L), (L, -L), (L, L), (-L, L))], [], [(0, 1, 2, 3)])
    bianco = bpy.data.materials.new('bianco'); bianco.use_nodes = True
    bianco.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (1, 1, 1, 1)
    bianco.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 1.0
    bianco.node_tree.nodes['Principled BSDF'].inputs['Specular IOR Level'].default_value = 0.0
    me.materials.append(bianco)
    foglio = bpy.data.objects.new('foglio', me); sc.collection.objects.link(foglio)
    occhio = bpy.data.cameras.new('dal-sole'); occhio.type = 'ORTHO'; occhio.ortho_scale = LATO_FINESTRA
    oc = bpy.data.objects.new('dal-sole', occhio); sc.collection.objects.link(oc)
    oc.location = centro + via * 1.5
    oc.rotation_euler = Matrix((lato, su, via)).transposed().to_euler()              # guarda lungo i raggi, destra = lato, alto = su
    sc.camera = oc
    scatta('finestra', 512, 512, max(64, a.campioni))
    print('fatto')


if __name__ == '__main__':
    main()
