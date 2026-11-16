"""Un'immagine sola della scena, per farla vedere al proprietario prima di calcolare il film.

    <venv>/bin/python camicia/film/prova.py <file .blend comprato> <uscita.png> [--larga 1800 --alta 1000 --campioni 128]
"""
import argparse
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import scena  # noqa: E402  (importa bpy)
import bpy  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument('blend'); ap.add_argument('uscita')
ap.add_argument('--larga', type=int, default=scena.LARGA); ap.add_argument('--alta', type=int, default=scena.ALTA)
ap.add_argument('--campioni', type=int, default=128); ap.add_argument('--fuori-asse', type=float, default=scena.FUORI_ASSE)
a = ap.parse_args()
pezzi = scena.costruisci(a.blend, a.larga, a.alta, a.campioni, a.fuori_asse)
sc = bpy.context.scene
print('bottoni tolti dal colletto (vertici):', pezzi['bottoni_tolti'], '· centro', tuple(round(v, 3) for v in pezzi['centro']), '· ripulitore', sc.cycles.use_denoising)
sc.render.filepath = os.path.abspath(a.uscita)
t = time.time()
bpy.ops.render.render(write_still=True)
print('calcolata in', round(time.time() - t), 'secondi →', a.uscita)
