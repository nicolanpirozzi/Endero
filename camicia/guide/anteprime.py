"""Le immagini di controllo delle linee delle misure: una per misura, e un foglio con tutte.

Servono a controllare `linee.py` a occhio (la linea sta sul tessuto?) e per il questionario del sarto: non vanno sul
sito, dove le linee le disegna la pagina. Per ogni misura: l'immagine ferma (di dietro per spalla e lunghezza dietro),
ritagliata intorno alla camicia, con la linea blu tratteggiata; le parti nascoste più sottili e più chiare; due
stanghette ai capi delle linee aperte.

    python3 camicia/guide/anteprime.py public/camicia/guide.json <ferma-2x.png> <dietro-2x.png> <cartella>

Le immagini ferme sono quelle a grandezza doppia (3600 x 2000) di `film/produci.py --doppia` e di `retro.py dietro`;
se si dà quella a grandezza normale si ingrandisce (va bene solo per controllare). Basta python3 con numpy e Pillow.
"""
import json
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

RITAGLIO = (420, 120, 1040, 960)       # la camicia, nel fotogramma 1800 x 1000
VOLTE = 2                              # le anteprime sono a grandezza doppia
FINE = 3                               # si disegna tre volte più grande e si rimpicciolisce: linee morbide
BLU = (0x2f, 0x6b, 0xff)
VISIBILE = {'largo': 3, 'pieno': 14, 'vuoto': 9, 'alfa': 255}      # in punti dell'anteprima (2x)
NASCOSTO = {'largo': 2, 'pieno': 6, 'vuoto': 7, 'alfa': 120}
STANGHETTA = 18
NOMI = {'giro_collo': 'Giro collo', 'spalla': 'Spalla', 'spallina': 'Spallina', 'torace': 'Torace', 'pancia': 'Pancia',
        'bacino': 'Bacino', 'lunghezza_manica': 'Lunghezza manica', 'braccio': 'Braccio', 'avambraccio': 'Avambraccio',
        'polso': 'Polso', 'lunghezza_davanti': 'Lunghezza davanti', 'lunghezza_dietro': 'Lunghezza dietro'}


def carattere(grande):
    for f in ('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'):
        if os.path.exists(f):
            return ImageFont.truetype(f, grande)
    return ImageFont.load_default()


def fondo(file):
    im = Image.open(file).convert('RGB')
    if im.size[0] != 1800 * VOLTE:
        im = im.resize((1800 * VOLTE, 1000 * VOLTE), Image.LANCZOS)
    x0, y0, x1, y1 = (v * VOLTE for v in RITAGLIO)
    return im.crop((x0, y0, x1, y1))


def nel_ritaglio(p):
    """Da punti del fotogramma a punti del disegno fine."""
    return [((x - RITAGLIO[0]) * VOLTE * FINE, (y - RITAGLIO[1]) * VOLTE * FINE) for x, y in p]


def tratteggia(d, punti, stile, chiuso):
    """Una spezzata tratteggiata: il tratteggio continua da un segmento all'altro."""
    if chiuso:
        punti = punti + punti[:1]
    pieno, vuoto, largo = stile['pieno'] * FINE, stile['vuoto'] * FINE, stile['largo'] * FINE
    colore = BLU + (stile['alfa'],)
    fase, acceso = 0.0, True
    for (ax, ay), (bx, by) in zip(punti[:-1], punti[1:]):
        lungo = math.hypot(bx - ax, by - ay)
        t = 0.0
        while t < lungo:
            resta = (pieno if acceso else vuoto) - fase
            passo = min(resta, lungo - t)
            if acceso:
                p = (ax + (bx - ax) * t / lungo, ay + (by - ay) * t / lungo)
                q = (ax + (bx - ax) * (t + passo) / lungo, ay + (by - ay) * (t + passo) / lungo)
                d.line([p, q], fill=colore, width=int(largo))
                for c in (p, q):                                    # capi tondi
                    d.ellipse([c[0] - largo / 2, c[1] - largo / 2, c[0] + largo / 2, c[1] + largo / 2], fill=colore)
            t += passo
            fase += passo
            if fase >= (pieno if acceso else vuoto) - 1e-9:
                fase, acceso = 0.0, not acceso


def stanghette(d, misura):
    """Ai capi delle linee aperte, una stanghetta di traverso."""
    tt = misura['tratti']
    for capo, (a, b) in zip(misura['capi'], ((tt[0]['punti'][0], tt[0]['punti'][1]), (tt[-1]['punti'][-1], tt[-1]['punti'][-2]))):
        (x, y), (x2, y2) = nel_ritaglio([a, b])
        n = math.hypot(x2 - x, y2 - y) or 1
        nx, ny = -(y2 - y) / n, (x2 - x) / n
        h = STANGHETTA * FINE / 2
        largo = VISIBILE['largo'] * FINE
        d.line([(x - nx * h, y - ny * h), (x + nx * h, y + ny * h)], fill=BLU + (255,), width=int(largo))


def disegna(base, misura):
    w, h = base.size
    sopra = Image.new('RGBA', (w * FINE, h * FINE), (0, 0, 0, 0))
    d = ImageDraw.Draw(sopra)
    for t in sorted(misura['tratti'], key=lambda t: t['visibile']):    # prima le parti nascoste, sotto
        tratteggia(d, nel_ritaglio(t['punti']), VISIBILE if t['visibile'] else NASCOSTO, t['chiuso'])
    if misura['capi']:
        stanghette(d, misura)
    sopra = sopra.resize((w, h), Image.LANCZOS)
    out = base.convert('RGBA')
    out.alpha_composite(sopra)
    return out.convert('RGB')


def main():
    guida, davanti, dietro, cartella = sys.argv[1:5]
    dati = json.load(open(guida))
    os.makedirs(cartella, exist_ok=True)
    basi = {'davanti': fondo(davanti), 'dietro': fondo(dietro)}
    fatte = []
    for nome, m in dati['misure'].items():
        im = disegna(basi[m['vista']], m)
        im.save(os.path.join(cartella, f'{nome}.jpg'), quality=90)
        fatte.append((nome, im))
    # il foglio con tutte: quattro per riga
    col, piccola = 4, 360
    alta = round(piccola * fatte[0][1].size[1] / fatte[0][1].size[0])
    testa = 40
    foglio = Image.new('RGB', (col * piccola + (col + 1) * 12, math.ceil(len(fatte) / col) * (alta + testa + 12) + 12), (246, 244, 239))
    d = ImageDraw.Draw(foglio)
    f = carattere(20)
    for i, (nome, im) in enumerate(fatte):
        x = 12 + (i % col) * (piccola + 12)
        y = 12 + (i // col) * (alta + testa + 12)
        d.text((x + 2, y + 8), NOMI.get(nome, nome) + (' (dietro)' if dati['misure'][nome]['vista'] == 'dietro' else ''), fill=(15, 40, 94), font=f)
        foglio.paste(im.resize((piccola, alta), Image.LANCZOS), (x, y + testa))
    foglio.save(os.path.join(cartella, 'tutte.jpg'), quality=88)
    print(f'{len(fatte)} anteprime e tutte.jpg in {cartella}')


if __name__ == '__main__':
    main()
