"""La camicia del configuratore come film: dal calcolo ai file del sito.

Prende i fotogrammi calcolati da `produci.py` e scrive in public/camicia/ ciò che la pagina usa:
  ferma.webp, ferma-2x.webp                        l'immagine a riposo (la seconda a grandezza doppia, se è stata calcolata)
  ferma-telefono.webp, ferma-telefono-2x.webp      la stessa, ritagliata in verticale intorno alla camicia
  da-sinistra.mp4, da-destra.mp4                   le due scene (la mano che tocca la camicia da sinistra e da destra)
  da-sinistra-telefono.mp4, da-destra-telefono.mp4 le stesse, ritagliate in verticale

    python3 camicia/film/monta.py <cartella dei fotogrammi> public/camicia

Se i fotogrammi sono stati calcolati solo in una fascia (`produci.py --bordo`), fuori dalla fascia ci va l'immagine a
riposo: lì la parete non cambia mai. Ogni scena comincia e finisce con l'immagine a riposo, identica: così sul sito
parte e torna senza scalino. Serve ffmpeg.
"""
import glob
import os
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image

SCENE = ('da-sinistra', 'da-destra')
# Il proprietario ha voluto il movimento "molto più lento": il film va a metà della velocità con cui il movimento è
# stato simulato (`muovi.mjs` scrive 24 stati al secondo, qui diventano 12 al secondo: otto secondi per scena).
# I fotogrammi di mezzo non si calcolano con Cycles (sarebbero altre cinque ore): li ricava ffmpeg dal movimento tra
# un fotogramma e il successivo, che a questa lentezza è piccolo.
CALCOLATI_AL_SECONDO = 12
AL_SECONDO = 24
CENTRO_CAMICIA = 0.395           # dove sta la camicia nel fotogramma, in frazione della larghezza: lo stesso numero
                                 # sta in src/configuratore/configuratore.css (--camicia)
QUALITA = 20                     # di ffmpeg (crf): più basso, più fedele e più pesante
SFUMA = 40                       # pixel in cui la fascia calcolata sfuma nell'immagine a riposo


def centro_misurato(immagine):
    """Dove sta davvero la camicia: il centro delle colonne in cui c'è del bianco (la parete è blu)."""
    px = np.asarray(immagine.convert('RGB')).astype(np.int32)
    bianco = (px[:, :, 0] > 150) & (px[:, :, 1] > 150)
    colonne = np.nonzero(bianco.sum(axis=0) > immagine.size[1] * 0.02)[0]
    return (colonne[0] + colonne[-1]) / 2 / immagine.size[0], colonne[0] / immagine.size[0], colonne[-1] / immagine.size[0]


def main():
    entrata, uscita = sys.argv[1], sys.argv[2]
    os.makedirs(uscita, exist_ok=True)
    ferma = Image.open(os.path.join(entrata, 'ferma.png')).convert('RGB')
    L, A = ferma.size
    centro, da, a = centro_misurato(ferma)
    print(f'la camicia sta tra il {da * 100:.1f} e il {a * 100:.1f}% della larghezza, centro {centro * 100:.2f}%')
    if abs(centro - CENTRO_CAMICIA) > 0.004:
        print(f'  ATTENZIONE: il centro previsto è {CENTRO_CAMICIA * 100:.2f}%: aggiornare CENTRO_CAMICIA qui e --camicia in configuratore.css')
    largo_tel = int(A * 0.75) // 2 * 2
    x_tel = max(0, min(L - largo_tel, int(L * CENTRO_CAMICIA - largo_tel / 2) // 2 * 2))
    ferma.save(os.path.join(uscita, 'ferma.webp'), quality=95, method=6)
    ferma.crop((x_tel, 0, x_tel + largo_tel, A)).save(os.path.join(uscita, 'ferma-telefono.webp'), quality=95, method=6)
    doppia = os.path.join(entrata, 'ferma-2x.png')
    if os.path.exists(doppia):
        grande = Image.open(doppia).convert('RGB')
        assert grande.size == (L * 2, A * 2), f'ferma-2x.png è {grande.size}, attesa {(L * 2, A * 2)}'
        grande.save(os.path.join(uscita, 'ferma-2x.webp'), quality=90, method=6)
        grande.crop((x_tel * 2, 0, (x_tel + largo_tel) * 2, A * 2)).save(os.path.join(uscita, 'ferma-telefono-2x.webp'), quality=90, method=6)
    base = np.asarray(ferma).astype(np.float32)
    for scena in SCENE:
        file = sorted(glob.glob(os.path.join(entrata, scena, '[0-9]*.png')))
        if not file:
            print(scena, ': nessun fotogramma, salto'); continue
        with tempfile.TemporaryDirectory() as lavoro:
            def scrivi(k, immagine):
                immagine.save(os.path.join(lavoro, f'{k:04d}.png'), compress_level=1)
            scrivi(0, ferma)                                     # il primo fotogramma è l'immagine a riposo, tale e quale
            for k, f in enumerate(file[1:], start=1):
                im = Image.open(f)
                if im.mode == 'RGBA':                            # calcolata solo in parte: il resto è la parete a riposo
                    px = np.asarray(im).astype(np.float32)
                    alfa = px[:, :, 3:4] / 255
                    colonne = np.nonzero(alfa[:, :, 0].max(axis=0) > 0)[0]
                    if len(colonne):                             # ai bordi della fascia si sfuma, perché non si veda la giunta
                        x = np.arange(L, dtype=np.float32)
                        if colonne[-1] < L - 1:
                            alfa = alfa * np.clip((colonne[-1] - x) / SFUMA, 0, 1)[None, :, None]
                        if colonne[0] > 0:
                            alfa = alfa * np.clip((x - colonne[0]) / SFUMA, 0, 1)[None, :, None]
                    im = Image.fromarray((px[:, :, :3] * alfa + base * (1 - alfa) + 0.5).astype(np.uint8))
                scrivi(k, im.convert('RGB'))
            # e l'ultimo pure; qualcuno in più, perché ricavando i fotogrammi di mezzo ffmpeg perde gli ultimi
            for k in range(len(file), len(file) + 4):
                scrivi(k, ferma)
            comune = ['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(CALCOLATI_AL_SECONDO), '-i', os.path.join(lavoro, '%04d.png')]
            codifica = ['-c:v', 'libx264', '-preset', 'slow', '-crf', str(QUALITA), '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart',
                        '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'iec61966-2-1', '-color_range', 'tv']
            mezzo = '' if AL_SECONDO == CALCOLATI_AL_SECONDO else f'minterpolate=fps={AL_SECONDO}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,'
            durata = ['-t', f'{len(file) / CALCOLATI_AL_SECONDO + 1 / AL_SECONDO:.4f}']        # fino al primo fotogramma di riposo, compreso
            pari = f'{mezzo}scale={L // 2 * 2}:{A // 2 * 2}:out_color_matrix=bt709:out_range=tv'
            subprocess.run(comune + ['-vf', pari] + durata + codifica + [os.path.join(uscita, f'{scena}.mp4')], check=True)
            subprocess.run(comune + ['-vf', f'{mezzo}crop={largo_tel}:{A // 2 * 2}:{x_tel}:0,scale=out_color_matrix=bt709:out_range=tv'] + durata + codifica + [os.path.join(uscita, f'{scena}-telefono.mp4')], check=True)
        print(scena, ':', len(file) + 1, 'fotogrammi calcolati,', f'{len(file) / CALCOLATI_AL_SECONDO:.1f} secondi →', ', '.join(f'{n} {os.path.getsize(os.path.join(uscita, n)) // 1024} KB' for n in (f'{scena}.mp4', f'{scena}-telefono.mp4')))
    print('immagine a riposo:', L, 'x', A, '· telefono', largo_tel, 'x', A, 'da x =', x_tel)
    print(' · '.join(f'{n} {os.path.getsize(os.path.join(uscita, n)) // 1024} KB' for n in sorted(os.listdir(uscita)) if n.startswith('ferma')))


if __name__ == '__main__':
    main()
