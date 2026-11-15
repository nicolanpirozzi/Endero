"""Immagine ferma della camicia, per chi non può vedere il 3D (niente WebGL, risparmio dati, JavaScript spento)
e per l'anteprima del link sui social. Stessa camicia, stessa luce del visualizzatore, calcolata con Cycles.

    <venv>/bin/python camicia/manifesto.py <cartella con camicia.blend> [--larghezza 1600] [--campioni 160]
Scrive camicia.webp (fondo trasparente) nella stessa cartella.
"""
import argparse
import math
import os

import bpy
from mathutils import Vector
from PIL import Image


def materiale(nome, colore, ruvido, peluria=0.0, lucido=0.0):
    m = bpy.data.materials.get(nome) or bpy.data.materials.new(nome)
    m.use_nodes = True
    N, L = m.node_tree.nodes, m.node_tree.links
    p = N.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*colore, 1)
    p.inputs['Roughness'].default_value = ruvido
    p.inputs['Sheen Weight'].default_value = peluria
    p.inputs['Coat Weight'].default_value = lucido
    return m


def luce(sc, nome, pos, forza, dim, colore):
    d = bpy.data.lights.new(nome, 'AREA'); d.energy = forza; d.size = dim; d.color = colore
    o = bpy.data.objects.new(nome, d); sc.collection.objects.link(o)
    o.location = pos
    o.rotation_euler = (-Vector(pos)).to_track_quat('-Z', 'Y').to_euler()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('cartella')
    ap.add_argument('--larghezza', type=int, default=1600)
    ap.add_argument('--campioni', type=int, default=160)
    ap.add_argument('--giro', type=float, default=19.5, help='di quanti gradi è girata, come nel visualizzatore a riposo')
    ap.add_argument('--taschino', action='store_true', help='con il taschino (di base è senza)')
    a = ap.parse_args()

    bpy.ops.wm.open_mainfile(filepath=os.path.join(a.cartella, 'camicia.blend'))
    sc = bpy.context.scene
    oggetti = [o for o in sc.objects if o.type == 'MESH']
    materiale('tessuto', (0.90, 0.885, 0.85), 0.8, peluria=0.4)
    materiale('bottone', (0.84, 0.80, 0.72), 0.28, lucido=0.7)
    materiale('filo', (0.90, 0.885, 0.85), 0.9)
    for ob in oggetti:
        for p in ob.data.polygons:
            p.use_smooth = True
        ob.rotation_euler = (0, 0, math.radians(a.giro))
        ob.hide_render = ob.name == 'taschino' and not a.taschino      # di base la camicia è senza taschino

    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = a.campioni
    sc.cycles.use_denoising = True
    sc.render.film_transparent = True
    sc.view_settings.view_transform = 'Standard'
    sc.render.resolution_x, sc.render.resolution_y = a.larghezza, int(a.larghezza * 0.75)
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    # la stanza blu colora le ombre, come nel visualizzatore
    w = bpy.data.worlds.new('mondo'); w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[0].default_value = (0.02, 0.05, 0.16, 1)
    w.node_tree.nodes['Background'].inputs[1].default_value = 0.55
    sc.world = w
    luce(sc, 'chiave', (-1.9, -2.6, 1.6), 95, 2.2, (1.0, 0.96, 0.91))
    luce(sc, 'schiarita', (2.4, -1.9, 0.2), 18, 2.6, (0.87, 0.91, 1.0))
    luce(sc, 'controluce', (1.6, 2.3, 1.3), 150, 1.4, (1.0, 0.85, 0.68))
    luce(sc, 'soffitto', (0.0, -0.2, 3.0), 30, 3.0, (1.0, 1.0, 1.0))

    c = bpy.data.cameras.new('cam'); c.lens = 110
    cam = bpy.data.objects.new('cam', c); sc.collection.objects.link(cam)
    cam.location = (0.0, -4.6, -0.03)
    cam.rotation_euler = (Vector((0, 0, -0.03)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    sc.camera = cam

    png = os.path.join(a.cartella, 'camicia.png')
    sc.render.filepath = png
    bpy.ops.render.render(write_still=True)
    Image.open(png).save(os.path.join(a.cartella, 'camicia.webp'), quality=88, method=6)
    print('scritto', os.path.join(a.cartella, 'camicia.webp'), os.path.getsize(os.path.join(a.cartella, 'camicia.webp')), 'byte')


if __name__ == '__main__':
    main()
