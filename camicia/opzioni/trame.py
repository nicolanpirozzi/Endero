"""Prova «il tessuto scelto colora la camicia» (proprietario, 2026-11-26: «Sì, prepara una prova»): i dati per il browser.

    <venv>/bin/python -I camicia/opzioni/trame.py <cartella di lavoro dei colli> <cartella di lavoro dei tessuti> public/camicia/opzioni

Dalla cartella di lavoro dei colli servono trama-<collo>.png e trama-taschino.png (`parti.py trama`: per ogni punto di
stoffa, dove sta nel cartamodello); da quella dei tessuti (`tools/tessuti.py`) i ritagli dei campioni. Scrive:
  trama-base.png, trama-collo-<nome>.png, trama-taschino.png
      la posizione nel cartamodello di ogni punto della camicia ritagliata e dei pezzi che le si sovrappongono: 16 bit per coordinata, in un'immagine larga il doppio
      del suo riquadro. Nel blu che cosa c'è: stoffa, ferro (bottoni, gruccia e nastro, che non prendono mai il
      colore del tessuto) o niente.
  tessuto-<id>.webp
      il campione reso ripetibile senza giunte (256 x 256), secondo il suo disegno: vedi `ripetibile`.
  trame.json
      dove va ogni file, quanti centimetri di stoffa copre ogni campione, e i tessuti della prova.
Il browser (src/configuratore/tinta.js) moltiplica il colore del tessuto per la luce della camicia bianca calcolata da
Blender: ombre, pieghe e riflessi restano quelli veri.
"""
import json
import os
import sys

import cv2
import numpy as np

LARGA, ALTA = 1800, 1000
AL_CM = 2400 / 21.0            # punti della cartella raddrizzata per centimetro (il foglio è largo 21 cm)
LATO = 256                     # lato del campione ripetibile
# i tessuti della prova: tinte unite chiare e scure, un lino, righe sottili, bande larghe, quadretti
PROVA = ['t0501', 't0502', 't0515', 't0101', 't0707', 't1801', 't2918', 't2902']


def misures_ok(m):
    """Una macchia di ferro conta se è grande almeno come un bottone piccolo."""
    return m[cv2.CC_STAT_AREA] >= 14


def impacchetta(trama, riquadro, uscita):
    """Ritaglia la trama (16 bit, fotogramma doppio) sul riquadro (punti del fotogramma) e la scrive grande quanto il
    riquadro, in un'immagine larga il doppio: a sinistra la prima coordinata (rosso i bit alti, verde i bassi) e nel
    blu che cosa c'è (255 stoffa, 200 bordo, 128 ferro, 0 niente); a destra la seconda coordinata."""
    x0, y0, x1, y1 = riquadro
    h, w = y1 - y0, x1 - x0
    # Per ogni punto del fotogramma la trama calcolata ne ha quattro (è grande il doppio). Tra i pezzi del cartamodello,
    # accostati e non cuciti, restano fessure più strette di un punto: un raggio solo ci passa e vede la gruccia o il
    # rovescio della schiena. Quindi si vota: è stoffa se lo dicono almeno due su quattro, e la posizione è quella del
    # campione più vicino alla mediana dei quattro (un intruso resta fuori).
    q = np.zeros((h, w, 4, 3), np.float64)
    sx0, sy0, sx1, sy1 = max(x0, 0), max(y0, 0), min(x1, LARGA), min(y1, ALTA)
    for k, (dy, dx) in enumerate(((0, 0), (0, 1), (1, 0), (1, 1))):
        q[sy0 - y0:sy1 - y0, sx0 - x0:sx1 - x0, k] = trama[sy0 * 2 + dy:sy1 * 2:2, sx0 * 2 + dx:sx1 * 2:2].astype(np.float64) / 65535
    blu, vv, uu = q[..., 0], q[..., 1], q[..., 2]                      # OpenCV legge in ordine blu, verde, rosso
    e_stoffa = blu > 0.9
    quante = e_stoffa.sum(axis=2)
    stoffa = quante >= 2
    ferro = (((blu > 0.3) & (blu <= 0.9)).sum(axis=2) >= 3) & ~stoffa
    # il ferro vero è grande (un bottone, la gruccia): le macchioline sono fessure
    n, etichette, misure, _ = cv2.connectedComponentsWithStats(ferro.astype(np.uint8), connectivity=8)
    ferro = np.isin(etichette, [k for k in range(1, n) if misures_ok(misure[k])])
    con_nan = lambda a: np.where(e_stoffa, a, np.nan)
    with np.errstate(all='ignore'):
        mu, mv = np.nanmedian(con_nan(uu), axis=2), np.nanmedian(con_nan(vv), axis=2)
    scarto = np.where(e_stoffa, np.abs(uu - mu[..., None]) + np.abs(vv - mv[..., None]), np.inf)
    scelto = np.argmin(scarto, axis=2)[..., None]
    u = np.take_along_axis(uu, scelto, axis=2)[..., 0]; v = np.take_along_axis(vv, scelto, axis=2)[..., 0]
    # dove i quattro campioni sono tutti stoffa e dicono la stessa cosa (lo stesso pezzo, senza intrusi) vale la loro
    # media, che è la posizione al centro del punto: scegliendone uno solo le righe verrebbero seghettate
    concordi = (quante == 4) & (np.where(e_stoffa, scarto, 0).max(axis=2) < 0.0025)
    u = np.where(concordi, uu.mean(axis=2), u); v = np.where(concordi, vv.mean(axis=2), v)
    # i punti isolati che non vanno d'accordo con nessuno dei vicini (un raggio passato da una fessura): prendono la
    # mediana dei vicini. Sulle cuciture vere i vicini discordi sono tanti, e lì non si tocca nulla
    for _ in range(2):
        mu3 = cv2.medianBlur(u.astype(np.float32), 3); mv3 = cv2.medianBlur(v.astype(np.float32), 3)
        fuori = stoffa & ((np.abs(u - mu3) + np.abs(v - mv3)) > 0.003)
        vicini_ok = cv2.blur((stoffa & ~fuori).astype(np.float32), (3, 3)) > 0.6
        cambia = fuori & vicini_ok
        u = np.where(cambia, mu3, u); v = np.where(cambia, mv3, v)
    u16 = np.clip(np.round(u * 65535), 0, 65535).astype(np.int64); v16 = np.clip(np.round(v * 65535), 0, 65535).astype(np.int64)
    # fuori dalla stoffa ogni punto prende la posizione del punto di stoffa più vicino: il contorno sfumato della
    # foto è più largo della sagoma netta della trama, e lì non deve restare un filo bianco (dove la camicia non c'è
    # la foto è trasparente, quindi non si vede nulla). Bottoni, gruccia e nastro restano fuori
    lontano, dove = cv2.distanceTransformWithLabels((~stoffa).astype(np.uint8), cv2.DIST_L2, 3, labelType=cv2.DIST_LABEL_PIXEL)
    ys, xs = np.nonzero(stoffa)
    indice = np.zeros(dove.max() + 1, np.int64); indice[dove[ys, xs]] = np.arange(len(ys))
    bordo = (~stoffa) & (~ferro)
    by, bx = np.nonzero(bordo)
    vicino = indice[dove[by, bx]]
    u16[by, bx] = u16[ys[vicino], xs[vicino]]; v16[by, bx] = v16[ys[vicino], xs[vicino]]
    pieno = stoffa | bordo
    rgb = np.zeros((h, w * 2, 3), np.uint8)
    rgb[:, :w, 0] = np.where(pieno, u16 >> 8, 0); rgb[:, :w, 1] = np.where(pieno, u16 & 255, 0)
    # nel blu: 255 stoffa vista davvero, 200 posizione presa in prestito dal punto di stoffa più vicino (il bordo
    # sfumato della foto), 128 ferro
    rgb[:, :w, 2] = np.where(stoffa, 255, np.where(bordo, 200, np.where(ferro, 128, 0)))
    rgb[:, w:, 0] = np.where(pieno, v16 >> 8, 0); rgb[:, w:, 1] = np.where(pieno, v16 & 255, 0)
    cv2.imwrite(uscita, rgb[..., ::-1], [cv2.IMWRITE_PNG_COMPRESSION, 9])
    return os.path.getsize(uscita)


def passo(profilo, minimo=6):
    """Il passo con cui un profilo (medie per colonna o per riga) si ripete, in punti, o 0 se non si ripete: il più
    corto tra gli scarti a cui il profilo torna quasi uguale a se stesso."""
    p = profilo - profilo.mean()
    n = len(p)
    if p.std() < 1.5 or n < minimo * 3:
        return 0
    ac = np.correlate(p, p, 'full')[n - 1:] / (p.var() * np.arange(n, 0, -1))
    cime = [k for k in range(minimo, n // 2) if ac[k] >= ac[k - 1] and ac[k] >= ac[k + 1] and ac[k] > 0.5]
    if not cime:
        return 0
    alta = max(ac[k] for k in cime)
    return next(k for k in cime if ac[k] >= alta - 0.06)


def ripetibile(ritaglio, disegno):
    """Un campione che si ripete senza giunte, secondo il suo disegno: una tinta unita è il suo colore medio più la
    grana fine del tessuto; una riga è il suo passo medio (la media di tutti i passi del campione: pulita, sempre
    uguale); un quadretto la media di tutti i suoi quadretti; una fantasia resta com'è, con la luce spianata."""
    im = cv2.imread(ritaglio, cv2.IMREAD_COLOR).astype(np.float32)
    h, w = im.shape[:2]
    media = im.reshape(-1, 3).mean(0)
    grana = im - cv2.GaussianBlur(im, (0, 0), 7)              # solo il dettaglio fine: trama e filo
    px = passo(im.mean(axis=2).mean(axis=0)) if disegno in ('righe', 'quadretti') else 0
    py = passo(im.mean(axis=2).mean(axis=1)) if disegno == 'quadretti' else 0
    if disegno == 'righe' and px:
        n = w // px
        uno = im[:, :n * px].reshape(h, n, px, 3).mean(axis=(0, 1))          # un passo, mediato su righe e ripetizioni
        tessera = cv2.resize(np.repeat(uno[None], 8, axis=0), (LATO, LATO), interpolation=cv2.INTER_LINEAR)
        return np.clip(tessera, 0, 255).astype(np.uint8), [round(px / AL_CM, 4), 1.0], [False, False], [px, 0]
    if disegno == 'quadretti' and px and py:
        nx, ny = w // px, h // py
        uno = im[:ny * py, :nx * px].reshape(ny, py, nx, px, 3).mean(axis=(0, 2))
        return np.clip(cv2.resize(uno, (LATO, LATO), interpolation=cv2.INTER_CUBIC), 0, 255).astype(np.uint8), [round(px / AL_CM, 4), round(py / AL_CM, 4)], [False, False], [px, py]
    if disegno == 'unito':
        lato = min(h, w)
        g = grana[(h - lato) // 2:(h - lato) // 2 + lato, (w - lato) // 2:(w - lato) // 2 + lato]
        tessera = cv2.resize(media + g, (LATO, LATO), interpolation=cv2.INTER_AREA)
        return np.clip(tessera, 0, 255).astype(np.uint8), [round(lato / AL_CM, 3)] * 2, [True, True], [0, 0]
    morbida = cv2.GaussianBlur(im, (0, 0), min(h, w) / 2.2)
    piana = np.clip(im / np.maximum(morbida, 1) * media, 0, 255)
    return cv2.resize(piana, (LATO, LATO), interpolation=cv2.INTER_AREA).astype(np.uint8), [round(w / AL_CM, 3), round(h / AL_CM, 3)], [True, True], [0, 0]


def main():
    colli_lavoro, tessuti_lavoro, uscita = sys.argv[1], sys.argv[2], sys.argv[3]
    o = json.load(open(os.path.join(uscita, 'opzioni.json')))
    leggera = json.load(open(os.path.join(uscita, '..', 'leggera', 'leggera.json')))
    x, y, w, h = leggera['pezzi']['camicia']
    apri = lambda nome: cv2.imread(os.path.join(colli_lavoro, f'trama-{nome}.png'), cv2.IMREAD_UNCHANGED)
    doppio = lambda r: [int(round(v)) for v in r]
    t = {'_nota': 'Prova del tessuto sulla camicia (camicia/opzioni/trame.py). Riquadri in punti del fotogramma 1800 x 1000; ogni file trama-*.png è grande quanto il suo riquadro, largo il doppio (prima e seconda coordinata, 16 bit).',
         'al_metro_uv': 1.53, 'al_metro': 828.6, 'colli': {}, 'tessuti': {}}
    peso = impacchetta(apri('italiano'), doppio([x, y, x + w, y + h]), os.path.join(uscita, 'trama-base.png'))
    t['base'] = {'file': 'trama-base.png', 'riquadro': [x, y, x + w, y + h]}
    print(f'trama-base.png: {peso // 1024} KB')
    for nome, voce in o['colli'].items():
        if voce and voce.get('file'):
            f = 'trama-' + voce['file'] + '.png'
            if apri(nome) is None:
                print(f'manca trama-{nome}.png: saltato'); continue
            peso = impacchetta(apri(nome), doppio(voce['riquadro']), os.path.join(uscita, f))
            t['colli'][nome] = {'file': f, 'riquadro': voce['riquadro']}
            print(f'{f}: {peso // 1024} KB')
    if apri('taschino') is not None:
        impacchetta(apri('taschino'), doppio(o['taschino']['riquadro']), os.path.join(uscita, 'trama-taschino.png'))
        t['taschino'] = {'file': 'trama-taschino.png', 'riquadro': o['taschino']['riquadro']}
    disegni = {x['id']: x['disegno'] for x in json.load(open(os.path.join(uscita, '..', '..', '..', 'contenuti', 'it', 'tessuti.json')))['tessuti']}
    for tid in PROVA:
        ritaglio = os.path.join(tessuti_lavoro, 'ritagli', f'{tid[1:3]}-{tid[3:5]}.png')
        tessera, cm, specchio, passi = ripetibile(ritaglio, disegni.get(tid, 'fantasia'))
        f = f'tessuto-{tid}.webp'
        cv2.imwrite(os.path.join(uscita, f), tessera, [cv2.IMWRITE_WEBP_QUALITY, 90])
        t['tessuti'][tid] = {'file': f, 'cm': cm, 'specchio': specchio}
        print(f'{f}: {cm[0]} x {cm[1]} cm, passi {passi}, a specchio {specchio}')
    with open(os.path.join(uscita, 'trame.json'), 'w') as f:
        json.dump(t, f, ensure_ascii=False, separators=(',', ':')); f.write('\n')


if __name__ == '__main__':
    main()
