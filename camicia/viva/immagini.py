"""La camicia in diretta: dalle immagini in luce vera di `scatta.py` (EXR) a quelle che il browser sa leggere.

    <venv>/bin/python camicia/viva/immagini.py <cartella di lavoro di scatta.py> <immagine ferma del film (ferma.png)> public/camicia/viva

Scrive nella cartella del sito:
  sole.webp, ombra.webp        la camicia col sole pieno e col sole spento, a grandezza doppia. Il colore prosegue un po'
                               oltre la sagoma (vedi `allarga`), e la sagoma, allargata, sta nel quarto canale.
                               I valori sono luce vera divisa per un numero fisso (`scala`, in immagini.json), perché
                               il sole pieno sul bianco supera il bianco dello schermo; il browser li rimoltiplica.
  parete-luce.webp, parete-ombra.webp   la parete da sola, nel riquadro in cui la camicia e la sua ombra si muovono.
  finestra.png                 il disegno di luce della finestra: quanto sole passa, da 0 a 1.
  immagini.json                le misure, e quanto è scura l'ombra della camicia sulla parete (misurata sull'immagine
                               ferma del film, così in diretta l'ombra è la stessa).
"""
import json
import os
import sys

import bpy
import numpy as np
from PIL import Image
from scipy import ndimage

RIQUADRO = (100, 1150)           # la parte del fotogramma (in pixel, su 1800) coperta dalla tela nel browser
OLTRE = 14                       # di quanti punti il colore della camicia prosegue oltre la sua sagoma (vedi `allarga`)


def allarga(colore, alfa):
    """Il colore vero (non moltiplicato per la sagoma), fatto proseguire oltre il bordo della camicia.

    Nel browser la camicia si muove: una manica che gira mostra la striscia di tessuto che da ferma stava proprio sul
    bordo, dove nell'immagine la camicia finisce e comincia il vuoto. Lì il tessuto deve avere il colore del tessuto
    accanto, non un buco: ogni punto fuori dalla sagoma prende il colore del punto della camicia più vicino."""
    dentro = alfa > 0.6
    vero = colore / np.maximum(alfa, 1e-4)[:, :, None]
    lontano, (iy, ix) = ndimage.distance_transform_edt(~dentro, return_indices=True)
    pieno = vero[iy, ix]
    sagoma = np.clip(1.0 - (lontano - OLTRE) / 4.0, 0, 1)           # piena fino a OLTRE punti dal bordo, poi sfuma
    return pieno, sagoma


def leggi(file):
    """Un EXR come matrice [riga dall'alto][colonna][rosso, verde, blu, alfa], in luce vera."""
    im = bpy.data.images.load(file)
    w, h = im.size
    px = np.empty(w * h * 4, dtype=np.float32)
    im.pixels.foreach_get(px)
    bpy.data.images.remove(im)
    return px.reshape(h, w, 4)[::-1].copy()


def schermo(x):
    """Da luce vera (0-1) al valore dello schermo (la curva sRGB, che è la resa "Standard" di Blender)."""
    x = np.clip(x, 0, 1)
    return np.where(x <= 0.0031308, 12.92 * x, 1.055 * np.power(x, 1 / 2.4) - 0.055)


def luce(v):
    v = v.astype(np.float32) / 255
    return np.where(v <= 0.04045, v / 12.92, np.power((v + 0.055) / 1.055, 2.4))


def otto(x):
    return (np.clip(x, 0, 1) * 255 + 0.5).astype(np.uint8)


def main():
    lavoro, ferma, uscita = sys.argv[1], sys.argv[2], sys.argv[3]
    os.makedirs(uscita, exist_ok=True)
    scena = json.load(open(os.path.join(lavoro, 'scena.json')))
    L, A = scena['fotogramma']
    # l'esposizione della scena (in stop): Blender la applica alle immagini finite, qui va applicata alla luce vera
    esposta = 2.0 ** scena['esposizione']
    sole, ombra = leggi(os.path.join(lavoro, 'camicia-sole.exr')), leggi(os.path.join(lavoro, 'camicia-ombra.exr'))
    assert sole.shape == ombra.shape
    sole[:, :, :3] *= esposta; ombra[:, :, :3] *= esposta
    # il numero fisso: poco sopra il valore più alto del sole pieno, così non si spreca nulla e nulla si taglia
    alfa = np.clip(sole[:, :, 3], 0, 1)
    pieno, sagoma = allarga(sole[:, :, :3], alfa)
    spento, _ = allarga(ombra[:, :, :3], alfa)
    scala = float(np.ceil(np.percentile(pieno[alfa > 0.6], 99.99) * 20) / 20)
    rgba = np.dstack([otto(schermo(pieno / scala)), otto(sagoma)])
    Image.fromarray(rgba, 'RGBA').save(os.path.join(uscita, 'sole.webp'), quality=92, method=6, exact=True)
    Image.fromarray(otto(schermo(spento / scala)), 'RGB').save(os.path.join(uscita, 'ombra.webp'), quality=92, method=6)

    x0, x1 = RIQUADRO
    pareti = {}
    for nome in ('parete-luce', 'parete-ombra'):
        p = leggi(os.path.join(lavoro, nome + '.exr'))[:, :, :3] * esposta
        assert p.shape[:2] == (A, L), p.shape
        pareti[nome] = p
        Image.fromarray(otto(schermo(p[:, x0:x1])), 'RGB').save(os.path.join(uscita, nome + '.webp'), quality=92, method=6)

    fin = leggi(os.path.join(lavoro, 'finestra.exr'))[:, :, :3].mean(axis=2)
    passa_tutto = float(np.percentile(fin, 99.5))                    # dove nessuna sbarra fa ombra
    Image.fromarray(otto(fin / passa_tutto), 'L').save(os.path.join(uscita, 'finestra.png'), optimize=True)

    # quanto è scura l'ombra della camicia: dove nel film la parete è in ombra piena, quanta della differenza tra
    # "parete illuminata" e "parete senza sole" si vede. Si misura dove l'ombra è più fonda (il cuore dell'ombra).
    film = luce(np.asarray(Image.open(ferma).convert('RGB')))
    luce_p, ombra_p = pareti['parete-luce'], pareti['parete-ombra']
    spazio = (luce_p - ombra_p).mean(axis=2)
    quanta = ((luce_p - film).mean(axis=2) / np.maximum(spazio, 1e-4))
    zona = (spazio > 0.02) & (np.arange(L)[None, :] > x0) & (np.arange(L)[None, :] < L * 0.30)        # a sinistra della camicia
    fonda = float(np.percentile(quanta[zona], 97))
    print(f'sole pieno fino a {np.percentile(pieno[alfa > 0.6], 99.99):.2f} → scala {scala} · finestra piena {passa_tutto:.3f} · ombra della camicia {fonda:.3f}')
    with open(os.path.join(uscita, 'immagini.json'), 'w') as f:
        json.dump({'scala': scala, 'camicia': [sole.shape[1], sole.shape[0]], 'ritaglio': scena['ritaglio'], 'riquadro': [x0, 0, x1 - x0, A],
                   'ombra': round(min(1.0, max(0.5, fonda)), 3)}, f)
    for n in sorted(os.listdir(uscita)):
        print(f'  {n} {os.path.getsize(os.path.join(uscita, n)) // 1024} KB')


if __name__ == '__main__':
    main()
