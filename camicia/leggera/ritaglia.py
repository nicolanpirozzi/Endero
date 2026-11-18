"""La camicia leggera: l'immagine ferma di Blender divisa in tre pezzi che il browser sovrappone.

    <venv>/bin/python camicia/leggera/ritaglia.py <cartella di lavoro> <ferma.png> <ferma-2x.png> public/camicia/leggera

Nella cartella di lavoro servono le immagini di camicia/viva/scatta.py e di camicia/leggera/ombra.py.

I tre pezzi, dal fondo:
  parete    la parete con la luce della finestra, senza la camicia e senza la sua ombra
  ombra     l'ombra della camicia: il colore della parete senza sole, trasparente dove l'ombra non c'è
  camicia   camicia, gruccia e nastro ritagliati

Fermi e sovrapposti ridanno l'immagine di Blender punto per punto: ciò che il conto "parete + ombra" non spiega
dell'immagine vera (la luce che la camicia rimanda sulla parete, la grana) si aggiunge sia alla parete sia all'ombra,
e la somma torna. Nel browser (src/configuratore/leggera.js) camicia e ombra si spostano appena; il tessuto non si deforma.

Ogni pezzo esce in tre grandezze (1, 1,5 e 2 volte il fotogramma): il browser prende la più vicina allo schermo.
"""
import json
import os
import sys

import bpy
import numpy as np
from PIL import Image
from scipy import ndimage

TAGLIE = (1, 1.5, 2)
ARIA = 110                       # punti (del fotogramma) di parete in più intorno a camicia e ombra: più di quanto possano spostarsi
OLTRE = 16                       # di quanto nastro e ombra proseguono oltre il bordo del fotogramma, per non scoprirlo muovendosi


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


def doppia(x):
    """Una matrice (righe, colonne[, canali]) ingrandita due volte, morbida."""
    return ndimage.zoom(x, (2, 2) + (1,) * (x.ndim - 2), order=3, mode='nearest', grid_mode=True)


def vicino(valori, buoni):
    """Dove `buoni` è falso, il valore del punto buono più vicino."""
    iy, ix = ndimage.distance_transform_edt(~buoni, return_distances=False, return_indices=True)
    return valori[iy, ix]


def otto(x):
    return (np.clip(x, 0, 1) * 255 + 0.5).astype(np.uint8)


def salva(nome, colore, alfa, uscita, qualita):
    """Scrive un pezzo (grande il doppio del fotogramma) nelle tre grandezze. Le trasparenze si rimpiccioliscono col colore moltiplicato."""
    alta, larga = colore.shape[:2]
    pesi = {}
    for t in TAGLIE:
        w, h = round(larga * t / 2), round(alta * t / 2)
        if alfa is None:
            im = Image.fromarray(otto(colore), 'RGB')
            if t != 2:
                im = im.resize((w, h), Image.LANCZOS)
        else:
            if t == 2:
                c, a = colore, alfa
            else:
                pre = np.dstack([colore * alfa[:, :, None], alfa]).astype(np.float32)
                giu = np.dstack([np.asarray(Image.fromarray(pre[:, :, i], 'F').resize((w, h), Image.LANCZOS)) for i in range(4)])
                a = np.clip(giu[:, :, 3], 0, 1)
                c = giu[:, :, :3] / np.maximum(a, 1e-3)[:, :, None]
                c = vicino(c, a > 0.05)                                     # fuori dalla sagoma il colore del bordo, non rumore
            im = Image.fromarray(np.dstack([otto(c), otto(a)]), 'RGBA')
        file = f'{nome}-{str(t).replace(".", "")}.webp'
        im.save(os.path.join(uscita, file), quality=qualita, method=6, exact=alfa is not None, use_sharp_yuv=True)
        pesi[file] = os.path.getsize(os.path.join(uscita, file)) // 1024
    return pesi


def main():
    lavoro, ferma1, ferma2, uscita = sys.argv[1:5]
    os.makedirs(uscita, exist_ok=True)
    scena = json.load(open(os.path.join(lavoro, 'scena.json')))
    L, A = scena['fotogramma']
    esposta = 2.0 ** scena['esposizione']       # Blender la applica alle immagini finite, non agli EXR
    parete = {n: leggi(os.path.join(lavoro, f'parete-{n}.exr'))[:, :, :3] * esposta for n in ('luce', 'ombra', 'piena', 'sagoma')}

    # --- quanta ombra della camicia c'è in ogni punto della parete (0-1): dal confronto, a sole pieno, tra la parete
    #     con la camicia e la parete da sola. Vale anche dove passano le sbarre e dietro la camicia.
    sole = (parete['piena'] - parete['ombra']).mean(axis=2)
    quanta = np.clip((parete['piena'] - parete['sagoma']).mean(axis=2) / np.maximum(sole, 1e-4), 0, 1)
    # Si muove solo l'ombra del sole, che ha il bordo netto. La camicia toglie alla parete anche un po' della luce
    # diffusa della stanza: un alone largo e tenue, che resta fermo nella parete (lo raccoglie il `resto`, più sotto).
    cuore = quanta > 0.4
    quanta = quanta * np.clip(1 - (ndimage.distance_transform_edt(~cuore) - 10) / 14, 0, 1)
    quanta = np.where(quanta < 0.012, 0, quanta)                              # sotto l'uno per cento è grana, non ombra
    # il browser mescola i valori dello schermo, non la luce vera: l'ombra va detta nella sua lingua
    luce_s, ombra_s = schermo(parete['luce']), schermo(parete['ombra'])
    vera_s = schermo(parete['luce'] * (1 - quanta[:, :, None]) + parete['ombra'] * quanta[:, :, None])
    spazio = (luce_s - ombra_s).mean(axis=2)
    velo = np.clip((luce_s - vera_s).mean(axis=2) / np.maximum(spazio, 1e-4), 0, 1)
    fido = np.clip((spazio - 0.01) / 0.05, 0, 1)                              # dentro l'ombra delle sbarre il conto non regge: vale `quanta`
    velo = np.where(quanta > 0, fido * velo + (1 - fido) * quanta, 0)

    # --- la sagoma di camicia, gruccia e nastro, grande il doppio, e l'immagine vera
    x0, x1 = (round(f * L * 2) for f in scena['ritaglio'])
    sagoma = np.zeros((A * 2, L * 2), dtype=np.float32)
    sagoma[:, x0:x1] = np.clip(leggi(os.path.join(lavoro, 'camicia-sole.exr'))[:, :, 3], 0, 1)
    vera = np.asarray(Image.open(ferma2).convert('RGB'), dtype=np.float32) / 255
    assert vera.shape[:2] == (A * 2, L * 2), vera.shape
    # Parete di sicuro: a tre punti dalla sagoma. Più vicino, nell'immagine vera c'è un filo scuro intorno alla camicia
    # (lo lascia la ripulitura dal rumore): deve muoversi con la camicia, non restare disegnato sulla parete.
    fuori = ndimage.binary_erosion(sagoma < 0.004, iterations=3, border_value=1)
    dentro = sagoma > 0.996                                                  # camicia di sicuro

    # --- parete e ombra al doppio; ciò che il conto non spiega dell'immagine vera va in tutte e due
    luce2, ombra2, velo2 = doppia(luce_s), doppia(ombra_s), np.clip(doppia(velo), 0, 1)
    velo2 = np.where(doppia(quanta) < 0.006, 0, velo2)                        # ingrandendo, niente frange oltre il bordo
    conto = luce2 * (1 - velo2[:, :, None]) + ombra2 * velo2[:, :, None]
    resto = np.where(fuori[:, :, None], vera - conto, 0)
    # dietro la camicia l'immagine vera non dice niente: il resto prosegue da fuori e si spegne allontanandosi dal bordo
    lontano = ndimage.distance_transform_edt(~fuori)
    resto = vicino(resto, fuori) * np.exp(-lontano / 40.0)[:, :, None]
    print(f'il conto di parete e ombra sbaglia in media di {np.abs(resto[fuori]).mean() * 255:.2f} livelli su 255, al più {np.abs(resto[fuori]).max() * 255:.1f}')
    parete2 = np.clip(luce2 + resto, 0, 1)
    scura2 = np.clip(ombra2 + resto, 0, 1)
    sotto = parete2 * (1 - velo2[:, :, None]) + scura2 * velo2[:, :, None]   # ciò che sta dietro la camicia, da ferma

    # --- la camicia: dentro è l'immagine vera. Sul bordo la trasparenza è quella di Blender (quanta camicia c'è nel
    #     punto) e il colore è quello che, sopra la parete, ridà l'immagine vera. Blender mescola la luce vera e il
    #     browser i valori dello schermo: dove per questo servirebbe un colore che non esiste (più chiaro del bianco,
    #     più scuro del nero) la trasparenza cresce di quel poco che basta a farlo esistere.
    d = vera - sotto
    serve = np.where(d > 0, d / np.maximum(1 - sotto, 1e-3), -d / np.maximum(sotto, 1e-3)).max(axis=2)
    alfa = np.clip(np.maximum(sagoma, serve), 0, 1)
    alfa = np.where(dentro, 1, np.where(fuori | (alfa < 0.02), 0, alfa)).astype(np.float32)
    colore = np.clip(sotto + d / np.maximum(alfa, 1e-3)[:, :, None], 0, 1)
    colore = np.where(dentro[:, :, None], vera, colore)
    colore = vicino(colore, alfa > 0.5)                                      # fuori dalla sagoma prosegue il colore del bordo
    colore = np.where((alfa > 0)[:, :, None] & ~(alfa > 0.5)[:, :, None], np.clip(sotto + d / np.maximum(alfa, 1e-3)[:, :, None], 0, 1), colore)
    torna = colore * alfa[:, :, None] + sotto * (1 - alfa[:, :, None])
    scarto = np.abs(torna - vera).max(axis=2) * 255
    print(f'i tre pezzi sovrapposti e l\'immagine vera differiscono in media di {scarto.mean():.3f} livelli, al più {scarto.max():.1f}; '
          f'{int((scarto > 3).sum())} punti oltre 3 livelli, {int((scarto > 12).sum())} oltre 12')

    # --- i riquadri (in punti del fotogramma): camicia e ombra dove ci sono, la parete intorno a tutte e due
    def riquadro(c, aria):
        ys, xs = np.nonzero(c)
        return [int(v) for v in (max(0, xs.min() // 2 - aria), max(0, ys.min() // 2 - aria), min(L, xs.max() // 2 + 1 + aria), min(A, ys.max() // 2 + 1 + aria))]
    rc, ro = riquadro(alfa > 0, 4), riquadro(velo2 > 0, 8)
    rp = [max(0, min(rc[0], ro[0]) - ARIA), 0, min(L, max(rc[2], ro[2]) + ARIA), A]

    def pezzo(m, r, sopra=0, sotto_=0):
        """Il ritaglio di una matrice al doppio; in alto e in basso può proseguire oltre il fotogramma ripetendo l'ultima riga."""
        t = m[r[1] * 2:r[3] * 2, r[0] * 2:r[2] * 2]
        riempi = ((sopra * 2, sotto_ * 2), (0, 0)) + ((0, 0),) * (m.ndim - 2)
        return np.pad(t, riempi, mode='edge')
    su = OLTRE if rc[1] == 0 else 0                # il nastro sale oltre il bordo
    giu = OLTRE if ro[3] == A else 0               # l'ombra scende oltre il bordo
    pesi = {}
    pesi.update(salva('parete', pezzo(parete2, rp), None, uscita, 92))
    pesi.update(salva('ombra', pezzo(scura2, ro, 0, giu), pezzo(velo2, ro, 0, giu), uscita, 92))
    pesi.update(salva('camicia', pezzo(colore, rc, su, 0), pezzo(alfa, rc, su, 0), uscita, 93))

    # --- dove toccare: la sagoma in piccolo (una casella ogni dieci punti del fotogramma). Per ogni riga, da che
    #     casella a che casella c'è la camicia
    griglia = np.asarray(Image.fromarray(otto(sagoma), 'L').resize((L // 10, A // 10), Image.BOX)) > 96
    righe = [[int(np.argmax(r)), int(len(r) - np.argmax(r[::-1]))] if r.any() else [0, 0] for r in griglia]
    dati = {
        'versione': int(os.path.getmtime(ferma2)) % 100000, 'fotogramma': [L, A], 'taglie': list(TAGLIE),
        # x, y, larghezza, altezza di ogni pezzo, in punti del fotogramma (dove sta da fermo)
        'pezzi': {'parete': [rp[0], rp[1], rp[2] - rp[0], rp[3] - rp[1]],
                  'ombra': [ro[0], ro[1], ro[2] - ro[0], ro[3] - ro[1] + giu],
                  'camicia': [rc[0], rc[1] - su, rc[2] - rc[0], rc[3] - rc[1] + su]},
        'camera': scena['camera'], 'sole': scena['sole'], 'parete': scena['parete'], 'gancio': scena['gancio'], 'ancora': scena['ancora'],
        'sagoma': {'passo': 10, 'righe': righe},
    }
    with open(os.path.join(uscita, 'leggera.json'), 'w') as f:
        json.dump(dati, f, separators=(',', ':'))
    print('pezzi:', dati['pezzi'])
    for n, k in sorted(pesi.items()):
        print(f'  {n} {k} KB')


if __name__ == '__main__':
    main()
