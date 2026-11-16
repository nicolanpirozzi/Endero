"""La camicia del configuratore come film: i fotogrammi.

Calcola con Cycles i fotogrammi di una scena (la mano che tocca la camicia), mettendo a ogni fotogramma ogni punto della camicia dove
l'ha portato la fisica (`muovi.mjs`). Salta i fotogrammi già fatti: se si interrompe, si rilancia.

    <venv>/bin/python camicia/film/produci.py <file .blend comprato> <cartella di muovi.mjs> <cartella di uscita>
        --scena da-sinistra [--campioni 64] [--bordo 0.06 0.63] [--da 1 --a 95 --ogni 1] [--larga 1800 --alta 900]

Con `--scena ferma` calcola la sola immagine di riposo (`ferma.png`), quella da cui ogni scena parte e a cui torna;
con `--doppia` la calcola anche a grandezza doppia (`ferma-2x.png`), per gli schermi fitti: è l'immagine che si guarda
quasi sempre, e costa un fotogramma solo.

`--bordo` calcola solo una fascia del fotogramma (da-a, in frazioni della larghezza): quella in cui la camicia e la sua
ombra si muovono. Fuori la parete non cambia mai, e `monta.py` ci mette l'immagine di riposo.
"""
import argparse
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import scena  # noqa: E402  (importa bpy)
import bpy  # noqa: E402
import numpy as np  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument('blend'); ap.add_argument('moto'); ap.add_argument('uscita')
ap.add_argument('--scena', default='ferma')
ap.add_argument('--larga', type=int, default=scena.LARGA); ap.add_argument('--alta', type=int, default=scena.ALTA)
ap.add_argument('--campioni', type=int, default=64); ap.add_argument('--fuori-asse', type=float, default=scena.FUORI_ASSE)
ap.add_argument('--bordo', type=float, nargs=2, default=None, metavar=('DA', 'A'), help='calcola solo questa fascia del fotogramma (frazioni della larghezza): fuori la parete non cambia mai')
ap.add_argument('--doppia', action='store_true', help='con --scena ferma: anche ferma-2x.png, a grandezza doppia')
ap.add_argument('--da', type=int, default=0); ap.add_argument('--a', type=int, default=10 ** 6); ap.add_argument('--ogni', type=int, default=1)
a = ap.parse_args()

pezzi = scena.costruisci(a.blend, a.larga, a.alta, a.campioni, a.fuori_asse)
sc = bpy.context.scene
if a.scena == 'ferma':
    for nome, volte in (('ferma.png', 1), ('ferma-2x.png', 2)):
        file = os.path.join(os.path.abspath(a.uscita), nome)
        if os.path.exists(file) or (volte == 2 and not a.doppia):
            continue
        sc.render.resolution_x, sc.render.resolution_y = a.larga * volte, a.alta * volte
        sc.render.filepath = file
        t = time.time()
        bpy.ops.render.render(write_still=True)
        print(f'{nome} in {time.time() - t:.0f} s', flush=True)
    sys.exit(0)

if a.bordo:
    sc.render.use_border = True; sc.render.use_crop_to_border = False
    sc.render.border_min_x, sc.render.border_max_x, sc.render.border_min_y, sc.render.border_max_y = a.bordo[0], a.bordo[1], 0.0, 1.0
    sc.render.film_transparent = True            # fuori dal bordo l'immagine resta vuota: ci va quella di riposo
    sc.render.image_settings.color_mode = 'RGBA'
dati = json.load(open(os.path.join(a.moto, f'scena-{a.scena}.json')))
nc, nb, quanti = dati['camicia'], dati['bottoni'], dati['fotogrammi']
punti = np.memmap(os.path.join(a.moto, f'scena-{a.scena}.f32'), dtype='<f4', mode='r').reshape(quanti, nc + nb, 3)
assert len(pezzi['camicia'].data.vertices) == nc and len(pezzi['bottoni'].data.vertices) == nb, 'il file del movimento non è di questa camicia'


def al_posto(ob, dove, q):
    """Mette i vertici di `ob` nei punti `q` (assi di stoffa.mjs, camicia non girata)."""
    blender = np.stack([q[:, 0], -q[:, 2], q[:, 1], np.ones(len(q))], axis=1)       # da Y in alto a Z in alto
    locali = blender @ np.array(dove.inverted()).T
    ob.data.vertices.foreach_set('co', np.ascontiguousarray(locali[:, :3], dtype=np.float32).ravel())
    ob.data.update()


cartella = os.path.join(os.path.abspath(a.uscita), a.scena)
os.makedirs(cartella, exist_ok=True)
for k in range(a.da, min(a.a, quanti - 1) + 1, a.ogni):
    file = os.path.join(cartella, f'{k:04d}.png')
    if os.path.exists(file):
        continue
    al_posto(pezzi['camicia'], pezzi['a_riposo']['camicia'], np.asarray(punti[k, :nc], dtype=np.float64))
    al_posto(pezzi['bottoni'], pezzi['a_riposo']['bottoni'], np.asarray(punti[k, nc:], dtype=np.float64))
    ang = dati['angoli'][k]
    pezzi['perno'].rotation_euler = (0, 0, ang['giro'])
    pezzi['altalena'].rotation_euler = (ang['fondo'], -ang['lato'], 0)      # di lato: intorno all'asse che viene verso chi guarda
    sc.render.filepath = file
    t = time.time()
    bpy.ops.render.render(write_still=True)
    print(f'{a.scena} {k}/{quanti - 1} in {time.time() - t:.0f} s', flush=True)
