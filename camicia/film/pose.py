"""La camicia del configuratore mossa dal mouse: le pose.

Il proprietario, provato il film: "Io voglio poterla muovere come voglio, quanto voglio, anche continuamente". Un
filmato registrato non lo permette: una volta partito deve arrivare in fondo. Qui gli stessi fotogrammi calcolati con
Cycles diventano una fila di pose, dalla camicia spinta tutta a sinistra, per la camicia ferma, alla camicia spinta
tutta a destra: la pagina sceglie in diretta quale mostrare, secondo il mouse (src/configuratore/libera.js), come
l'apertura sceglie i fotogrammi secondo lo scorrimento.

    python3 camicia/film/pose.py <cartella dei fotogrammi di produci.py> public/camicia/pose [--pose 32]

Le pose di un lato sono il primo secondo della scena di quel lato: la mano che tocca e spinge la camicia, da ferma fino
a dove arriva. Tra un fotogramma calcolato e il successivo ffmpeg ricava quelli di mezzo; poi se ne tengono `--pose`
per lato, a passi uguali di spostamento sullo schermo: così la camicia si muove di poco e sempre uguale da una posa
all'altra, e non si sprecano immagini dove è quasi ferma. Di ogni posa si salva solo il riquadro in cui la camicia e
la sua ombra si muovono, in AVIF e in WebP (per i browser che l'AVIF non lo leggono). Serve ffmpeg.
"""
import argparse
import glob
import hashlib
import json
import os
import subprocess
import tempfile

import numpy as np
from PIL import Image

SPINTA = 25                       # l'ultimo fotogramma della spinta: lì la camicia è al massimo dello spostamento
RIQUADRO = (100, 0, 1150, 1000)   # la parte del fotogramma (1800 x 1000) che cambia: sinistra, alto, destra, basso
TELEFONO = (336, 750)             # il ritaglio verticale del telefono fatto da monta.py: da dove parte, quanto è largo
SFUMA = 40                        # come monta.py: la fascia calcolata sfuma nell'immagine a riposo
DI_MEZZO = 4                      # quante pose candidate per ogni fotogramma calcolato
SCENE = {'s': 'da-sinistra', 'd': 'da-destra'}     # s: la mano arriva da sinistra e spinge verso destra


def composto(file, base, L):
    """Il fotogramma calcolato solo in una fascia, posato sull'immagine a riposo (come in monta.py)."""
    px = np.asarray(Image.open(file)).astype(np.float32)
    if px.shape[2] == 3:
        return px
    alfa = px[:, :, 3:4] / 255
    colonne = np.nonzero(alfa[:, :, 0].max(axis=0) > 0)[0]
    x = np.arange(L, dtype=np.float32)
    if colonne[-1] < L - 1:
        alfa = alfa * np.clip((colonne[-1] - x) / SFUMA, 0, 1)[None, :, None]
    if colonne[0] > 0:
        alfa = alfa * np.clip((x - colonne[0]) / SFUMA, 0, 1)[None, :, None]
    return px[:, :, :3] * alfa + base * (1 - alfa)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('fotogrammi'); ap.add_argument('uscita')
    ap.add_argument('--pose', type=int, default=32, help='quante pose per lato, oltre a quella ferma')
    ap.add_argument('--avif', type=int, default=62); ap.add_argument('--webp', type=int, default=82)
    a = ap.parse_args()
    os.makedirs(a.uscita, exist_ok=True)
    for vecchio in glob.glob(os.path.join(a.uscita, '*')):
        os.remove(vecchio)
    ferma = Image.open(os.path.join(a.fotogrammi, 'ferma.png')).convert('RGB')
    L, A = ferma.size
    base = np.asarray(ferma).astype(np.float32)
    x0, y0, x1, y1 = RIQUADRO
    riposo = ferma.crop(RIQUADRO)

    def salva(immagine, nome):
        immagine.save(os.path.join(a.uscita, nome + '.avif'), quality=a.avif, speed=3)
        immagine.save(os.path.join(a.uscita, nome + '.webp'), quality=a.webp, method=6)

    salva(riposo, 'r')
    for lato, scena in SCENE.items():
        with tempfile.TemporaryDirectory() as lavoro:
            os.makedirs(os.path.join(lavoro, 'e')); os.makedirs(os.path.join(lavoro, 'u'))
            # la spinta: dalla camicia ferma al fotogramma SPINTA; qualche copia dell'ultimo, perché ffmpeg perde la coda
            riposo.save(os.path.join(lavoro, 'e', '0000.png'), compress_level=1)
            ultimo = None
            for k in range(1, SPINTA + 1):
                px = composto(os.path.join(a.fotogrammi, scena, f'{k:04d}.png'), base, L)
                ultimo = Image.fromarray((px + 0.5).astype(np.uint8)).crop(RIQUADRO)
                ultimo.save(os.path.join(lavoro, 'e', f'{k:04d}.png'), compress_level=1)
            for k in range(SPINTA + 1, SPINTA + 5):
                ultimo.save(os.path.join(lavoro, 'e', f'{k:04d}.png'), compress_level=1)
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', '6', '-i', os.path.join(lavoro, 'e', '%04d.png'),
                            '-vf', f'minterpolate=fps={6 * DI_MEZZO}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1',
                            '-frames:v', str(SPINTA * DI_MEZZO + 1), '-start_number', '0', os.path.join(lavoro, 'u', '%04d.png')], check=True)
            candidate = sorted(glob.glob(os.path.join(lavoro, 'u', '*.png')))
            assert len(candidate) == SPINTA * DI_MEZZO + 1, f'{scena}: {len(candidate)} pose candidate, attese {SPINTA * DI_MEZZO + 1}'
            # quanta strada fa la camicia sullo schermo da una candidata alla successiva (differenza media di luce)
            strada = [0.0]
            prima = np.asarray(Image.open(candidate[0]).convert('L')).astype(np.float32)
            for f in candidate[1:]:
                ora = np.asarray(Image.open(f).convert('L')).astype(np.float32)
                strada.append(strada[-1] + float(np.abs(ora - prima).mean()))
                prima = ora
            strada = np.array(strada)
            # le pose: a passi uguali di strada, dall'inizio (la camicia ferma, che è la posa "r") alla fine
            for n in range(1, a.pose + 1):
                k = int(np.argmin(np.abs(strada - strada[-1] * n / a.pose)))
                salva(Image.open(candidate[k]).convert('RGB'), f'{lato}-{n:02d}')
            print(f'{scena}: {a.pose} pose da {len(candidate)} candidate · strada {strada[-1]:.2f}')

    pesi = {est: sum(os.path.getsize(f) for f in glob.glob(os.path.join(a.uscita, '*.' + est))) for est in ('avif', 'webp')}
    impronta = hashlib.sha256()
    for f in sorted(glob.glob(os.path.join(a.uscita, '*.avif'))):
        impronta.update(open(f, 'rb').read())
    with open(os.path.join(a.uscita, 'pose.json'), 'w') as f:
        json.dump({'versione': impronta.hexdigest()[:10], 'pose': a.pose, 'fotogramma': [L, A], 'riquadro': [x0, y0, x1 - x0, y1 - y0],
                   'telefono': list(TELEFONO)}, f)
    print(f'{2 * a.pose + 1} pose di {x1 - x0} x {y1 - y0} → AVIF {pesi["avif"] // 1024} KB, WebP {pesi["webp"] // 1024} KB')


if __name__ == '__main__':
    main()
