"""Le immagini di controllo delle linee delle misure: una per misura, e un foglio con tutte.

Servono a controllare `linee.py` a occhio (la linea sta sul tessuto?) e per il questionario del sarto: non vanno sul
sito, dove le linee le disegna la pagina. Per ogni misura: l'immagine ferma (di dietro per spalla e lunghezza dietro),
ritagliata intorno alla camicia (<nome>.jpg) e intorno alla linea (<nome>-zona.jpg, per il questionario), con la linea blu tratteggiata; le parti nascoste più sottili e più chiare; due
punti ai capi delle linee aperte. Linee spesse, con l'alone bianco come sulla pagina: nel questionario l'immagine
si guarda piccola, sul telefono.

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
MINIMO, ATTORNO = 420, 1.3             # la zona intorno alla linea: almeno 420 punti, un terzo più della linea
VOLTE = 2                              # le anteprime sono a grandezza doppia
FINE = 3                               # si disegna tre volte più grande e si rimpicciolisce: linee morbide
BLU = (0x3d, 0x7b, 0xff)                # il blu delle linee sulla pagina (--linea)
# In punti dell'anteprima (2x). Spesse: nel questionario l'immagine si vede larga 600 punti o meno, sul telefono
VISIBILE = {'largo': 9, 'pieno': 28, 'vuoto': 17, 'alfa': 255}
NASCOSTO = {'largo': 5, 'pieno': 12, 'vuoto': 13, 'alfa': 140}
ALONE = 9                               # l'alone bianco sotto le parti visibili, come sulla pagina: si vedono anche sul blu
CAPO = 12                               # il raggio del punto ai capi delle linee aperte
NOMI = {'giro_collo': 'Giro collo', 'spalla': 'Spalla', 'spallina': 'Spallina', 'torace': 'Torace', 'pancia': 'Pancia',
        'bacino': 'Bacino', 'lunghezza_manica': 'Lunghezza manica', 'braccio': 'Braccio', 'avambraccio': 'Avambraccio',
        'polso': 'Polso', 'lunghezza_davanti': 'Lunghezza davanti', 'lunghezza_dietro': 'Lunghezza dietro'}


def carattere(grande):
    for f in ('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'):
        if os.path.exists(f):
            return ImageFont.truetype(f, grande)
    return ImageFont.load_default()


def fondo(file):
    """L'immagine ferma intera, a grandezza doppia."""
    im = Image.open(file).convert('RGB')
    if im.size[0] != 1800 * VOLTE:
        im = im.resize((1800 * VOLTE, 1000 * VOLTE), Image.LANCZOS)
    return im


def zona(riquadro):
    """La zona intorno alla linea, come nella finestra del sito (guida.js, inquadra), un po' più larga: si vede dove
    sta sulla camicia anche una linea piccola come il polso."""
    x0, y0, x1, y1 = riquadro
    w, h = x1 - x0, y1 - y0
    if h > w:
        h = max(h * ATTORNO, MINIMO); w = max(w, h * 0.75)
    else:
        w = max(w * ATTORNO, MINIMO); h = max(h, w * 0.75)
    w, h = min(w, 1800), min(h, 1000)
    x = min(max((x0 + x1) / 2 - w / 2, 0), 1800 - w)
    y = min(max((y0 + y1) / 2 - h / 2, 0), 1000 - h)
    return (round(x), round(y), round(x + w), round(y + h))


RIQ = RITAGLIO                          # il riquadro che si sta disegnando (fotogramma)


def nel_ritaglio(p):
    """Da punti del fotogramma a punti del disegno fine."""
    return [((x - RIQ[0]) * VOLTE * FINE, (y - RIQ[1]) * VOLTE * FINE) for x, y in p]


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


def alone(d, punti, chiuso):
    if chiuso:
        punti = punti + punti[:1]
    largo = (VISIBILE['largo'] + ALONE) * FINE
    colore = (255, 255, 255, 150)
    d.line(punti, fill=colore, width=int(largo), joint='curve')
    for c in (punti[0], punti[-1]):
        d.ellipse([c[0] - largo / 2, c[1] - largo / 2, c[0] + largo / 2, c[1] + largo / 2], fill=colore)


def capi(d, misura):
    """Ai capi delle linee aperte, un punto blu con il bordo bianco (come sulla pagina)."""
    for x, y in nel_ritaglio(misura['capi']):
        r, b = CAPO * FINE, 3 * FINE
        d.ellipse([x - r - b, y - r - b, x + r + b, y + r + b], fill=(255, 255, 255, 255))
        d.ellipse([x - r, y - r, x + r, y + r], fill=BLU + (255,))


def disegna(intera, misura, riquadro):
    global RIQ
    RIQ = riquadro
    base = intera.crop(tuple(v * VOLTE for v in riquadro))
    w, h = base.size
    sopra = Image.new('RGBA', (w * FINE, h * FINE), (0, 0, 0, 0))
    d = ImageDraw.Draw(sopra)
    # l'alone ha la sua immagine: le sue parti, sovrapposte, non si sommano
    velo = Image.new('RGBA', sopra.size, (0, 0, 0, 0))
    dv = ImageDraw.Draw(velo)
    for t in misura['tratti']:
        if t['visibile']:
            alone(dv, nel_ritaglio(t['punti']), t['chiuso'])
    sopra.alpha_composite(velo)
    for t in sorted(misura['tratti'], key=lambda t: t['visibile']):    # prima le parti nascoste, sotto
        tratteggia(d, nel_ritaglio(t['punti']), VISIBILE if t['visibile'] else NASCOSTO, t['chiuso'])
    if misura['capi']:
        capi(d, misura)
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
        im = disegna(basi[m['vista']], m, RITAGLIO)
        im.save(os.path.join(cartella, f'{nome}.jpg'), quality=90)
        disegna(basi[m['vista']], m, zona(m['riquadro'])).save(os.path.join(cartella, f'{nome}-zona.jpg'), quality=90)
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
