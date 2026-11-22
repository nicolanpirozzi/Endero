"""La camicia a grandezza quadrupla, per lo zoom della guida alle misure (proprietario, 2026-11-22: «Mi piace forte»).

Entrando in un campo di misura il configuratore ingrandisce la camicia fino a tre volte (src/configuratore/guida.js).
L'immagine ferma a grandezza doppia, così ingrandita, sugli schermi fitti si vede morbida. Qui si calcola la stessa
immagine a grandezza quadrupla, ma solo nel riquadro della camicia (RIQUADRO, in punti del fotogramma 1800 x 1000):
fuori c'è la parete, liscia, che resta quella dell'immagine ferma. Davanti com'è nel film (camicia/film/scena.py, a
riposo); dietro com'è il retro (camicia/guide/retro.py, girata di mezzo giro e scostata dalla gruccia).

    <venv>/bin/python camicia/guide/nitide.py <file .blend comprato> <cartella di lavoro> [--campioni 96] [--volte 4]
    python3 camicia/guide/nitide.py monta <cartella di lavoro> public/camicia/nitide

Il primo calcola davanti-4x.png e dietro-4x.png (circa un quarto d'ora l'uno; salta quelli già fatti), il secondo ne
fa le WebP per il sito e nitide.json con il riquadro. Il Python con Blender: vedi CLAUDE.md, "Problemi già incontrati".
"""
import argparse
import json
import os
import sys

QUI = os.path.dirname(os.path.abspath(__file__))
RIQUADRO = (400, 110, 1050, 990)        # x0, y0, x1, y1 nel fotogramma: le due sagome (davanti e dietro) con 40 punti di margine
LARGA, ALTA = 1800, 1000
QUALITA = 86


def calcola(a):
    sys.path.insert(0, QUI)
    import retro  # noqa: E402  (prepara la scena del film e importa bpy)
    os.makedirs(a.uscita, exist_ok=True)
    for nome, girata in (('davanti', 0.0), ('dietro', 1.0)):
        file = os.path.join(os.path.abspath(a.uscita), f'{nome}-{a.volte}x.png')
        if os.path.exists(file):
            print(f'{file}: già fatto', flush=True)
            continue
        # davanti com'è nell'immagine ferma (senza ritocchi); dietro com'è il retro, scostato dalla gruccia
        scena, bpy, pezzi = retro.prepara(a.blend, a.campioni, LARGA * a.volte, ALTA * a.volte, ritocca=girata > 0)
        retro.gira(scena, bpy, pezzi, girata)
        sc = bpy.context.scene
        x0, y0, x1, y1 = RIQUADRO
        sc.render.use_border = True
        sc.render.use_crop_to_border = True
        sc.render.border_min_x, sc.render.border_max_x = x0 / LARGA, x1 / LARGA
        sc.render.border_min_y, sc.render.border_max_y = 1 - y1 / ALTA, 1 - y0 / ALTA     # in Blender y va in su
        print(f'{nome}-{a.volte}x.png in {retro.calcola(bpy, file):.0f} s', flush=True)
        bpy.ops.wm.read_factory_settings(use_empty=True)


def monta(a):
    from PIL import Image
    os.makedirs(a.uscita, exist_ok=True)
    fatte = {}
    for nome in ('davanti', 'dietro'):
        sorgente = next((os.path.join(a.lavoro, f) for f in sorted(os.listdir(a.lavoro)) if f.startswith(nome + '-') and f.endswith('x.png')), None)
        if not sorgente:
            continue
        im = Image.open(sorgente).convert('RGB')
        destinazione = os.path.join(a.uscita, f'{nome}.webp')
        im.save(destinazione, 'WEBP', quality=QUALITA, method=6)
        fatte[nome] = f'{nome}.webp'
        print(f'{destinazione}: {im.size[0]} x {im.size[1]}, {os.path.getsize(destinazione) // 1024} KB')
    with open(os.path.join(a.uscita, 'nitide.json'), 'w') as f:
        json.dump({'fotogramma': [LARGA, ALTA], 'riquadro': list(RIQUADRO), 'file': fatte}, f)
        f.write('\n')


def main():
    if len(sys.argv) > 1 and sys.argv[1] == 'monta':
        ap = argparse.ArgumentParser(description='le WebP per il sito')
        ap.add_argument('comando'); ap.add_argument('lavoro'); ap.add_argument('uscita')
        monta(ap.parse_args())
        return
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('blend'); ap.add_argument('uscita')
    ap.add_argument('--campioni', type=int, default=96)
    ap.add_argument('--volte', type=int, default=4)
    calcola(ap.parse_args())


if __name__ == '__main__':
    main()
