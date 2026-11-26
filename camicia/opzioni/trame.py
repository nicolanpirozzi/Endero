"""Il tessuto scelto colora la camicia (proprietario, 2026-11-26): i dati per il browser.

    <venv>/bin/python -I camicia/opzioni/trame.py <cartella di lavoro dei colli> <cartella di lavoro dei tessuti> public/camicia
        [--solo-trame | --solo-tessuti] [--foglio <cartella>]

Dalla cartella di lavoro dei colli servono trama-<collo>.png e trama-taschino.png (`parti.py trama`: per ogni punto di
stoffa, dove sta nel cartamodello) e mappa-italiano.png (`parti.py mappa`: un colore per parte); da quella dei tessuti
(`tools/tessuti.py`) i ritagli dei campioni. Scrive:
  opzioni/trama-base.png, trama-collo-<nome>.png, trama-taschino.png
      la posizione nel cartamodello di ogni punto della camicia ritagliata, e dei riquadri in cui un collo o il
      taschino la cambiano: 16 bit per coordinata, in un'immagine larga il doppio del suo riquadro (a sinistra la prima
      coordinata, a destra la seconda: rosso i bit alti, verde i bassi). Nel blu di sinistra: 255 una posizione vera,
      200 una presa in prestito dal punto di stoffa più vicino, 0 niente.
  opzioni/maschera-base.png, maschera-collo-<nome>.png, maschera-taschino.png
      dove c'è stoffa e di quale zona (corpo, polsini, taschino: per chi vuole un tessuto diverso su una parte), a
      grandezza doppia, come la foto: così i bordi di bottoni, gruccia, polsini e taschino sono netti. Vedi `maschera`.
      Bottoni, gruccia e nastro non sono stoffa e non prendono mai il colore del tessuto.
  stoffe/<id>.webp
      il campione di ogni tessuto reso ripetibile senza giunte (256 x 256), secondo il suo disegno: vedi `ripetibile`.
  opzioni/trame.json
      dove va ogni file e, per ogni tessuto, quanti centimetri di stoffa copre il suo campione e se si ripete a specchio.
Il browser (src/configuratore/tinta.js) moltiplica il colore del tessuto per la luce della camicia bianca calcolata da
Blender: ombre, pieghe e riflessi restano quelli veri.
"""
import argparse
import json
import os

import cv2
import numpy as np

LARGA, ALTA = 1800, 1000
AL_CM = 2400 / 21.0            # punti della cartella raddrizzata per centimetro (il foglio è largo 21 cm)
LATO = 256                     # lato del campione ripetibile
BORDO = 5.6                    # di quanti punti (della maschera, grande il doppio) la stoffa si allarga oltre la sagoma netta: quanto è largo il contorno sfumato della foto
PRESTITO = 4.5                 # entro quanti punti dalla stoffa la trama dà una posizione presa in prestito
GRANA = 6.0                    # una tinta unita tiene solo ciò che è più fine di così (in punti del ritaglio: mezzo millimetro)
BIANCO = 237.0                 # il bianco in pieno sole della camicia calcolata (0,93): un tessuto bianco deve darle quello


def zone(mappa):
    """Dalla mappa delle parti (un colore per parte, fotogramma doppio): 1 sui polsini, 2 sul taschino, 0 altrove."""
    rgb = mappa[..., 2::-1].astype(np.float32) / (65535 if mappa.dtype == np.uint16 else 255)
    vicino = lambda c: np.abs(rgb - np.array(c, np.float32)).sum(-1) < 0.35
    z = np.zeros(rgb.shape[:2], np.uint8)
    z[vicino((0, 0, 1)) | vicino((1, 1, 0))] = 1
    z[vicino((0, 1, 1))] = 2
    return z


def impacchetta(trama, riquadro, uscita):
    """Ritaglia la trama (16 bit, fotogramma doppio) sul riquadro (punti del fotogramma) e la scrive grande quanto il
    riquadro, in un'immagine larga il doppio: vedi in cima."""
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
    # (un punto a cavallo fra stoffa e ferro è dell'una o dell'altro, mai «niente»: se no la stoffa gli si allargherebbe sopra)
    e_ferro = (blu > 0.3) & (blu <= 0.9)
    ferro = (e_ferro.sum(axis=2) >= 2) & ~stoffa
    # il ferro vero è grande (un bottone, la gruccia): le macchioline sono fessure
    n, etichette, misure, _ = cv2.connectedComponentsWithStats(ferro.astype(np.uint8), connectivity=8)
    ferro = np.isin(etichette, [k for k in range(1, n) if misure[k][cv2.CC_STAT_AREA] >= 14])
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
    # I punti isolati che non vanno d'accordo con nessuno degli otto vicini (un raggio passato da una fessura): prendono
    # la posizione dei vicini, se questi vanno d'accordo fra loro. Sulle cuciture vere ogni punto ha vicini dalla sua
    # parte, e lì non si tocca nulla (una mediana a cavallo di una cucitura darebbe una posizione che non esiste)
    VICINO = 0.02
    for _ in range(2):
        accordo = np.zeros(u.shape, np.int32)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dy or dx:
                    uu2, vv2, ss2 = np.roll(u, (dy, dx), (0, 1)), np.roll(v, (dy, dx), (0, 1)), np.roll(stoffa, (dy, dx), (0, 1))
                    accordo += (ss2 & (np.abs(u - uu2) < VICINO) & (np.abs(v - vv2) < VICINO)).astype(np.int32)
        soli = stoffa & (accordo == 0)
        if not soli.any():
            break
        mu3 = cv2.medianBlur(u.astype(np.float32), 3); mv3 = cv2.medianBlur(v.astype(np.float32), 3)
        # la mediana vale solo se molti vicini le stanno intorno (cioè se sono dalla stessa parte)
        intorno = np.zeros(u.shape, np.int32)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dy or dx:
                    uu2, vv2, ss2 = np.roll(u, (dy, dx), (0, 1)), np.roll(v, (dy, dx), (0, 1)), np.roll(stoffa, (dy, dx), (0, 1))
                    intorno += (ss2 & (np.abs(mu3 - uu2) < VICINO) & (np.abs(mv3 - vv2) < VICINO)).astype(np.int32)
        cambia = soli & (intorno >= 5)
        u = np.where(cambia, mu3, u); v = np.where(cambia, mv3, v)
    u16 = np.clip(np.round(u * 65535), 0, 65535).astype(np.int64); v16 = np.clip(np.round(v * 65535), 0, 65535).astype(np.int64)
    # Intorno alla stoffa (entro PRESTITO punti) ogni punto prende la posizione del punto di stoffa più vicino: la
    # maschera, grande il doppio, decide dove c'è stoffa, e sul suo bordo una posizione deve esserci sempre
    lontano, dove = cv2.distanceTransformWithLabels((~stoffa).astype(np.uint8), cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
    ys, xs = np.nonzero(stoffa)
    if len(ys):
        indice = np.zeros(dove.max() + 1, np.int64); indice[dove[ys, xs]] = np.arange(len(ys))
        bordo = (~stoffa) & (lontano <= PRESTITO)
        by, bx = np.nonzero(bordo)
        vicino = indice[dove[by, bx]]
        u16[by, bx] = u16[ys[vicino], xs[vicino]]; v16[by, bx] = v16[ys[vicino], xs[vicino]]
    else:
        bordo = np.zeros_like(stoffa)
    pieno = stoffa | bordo
    rgb = np.zeros((h, w * 2, 3), np.uint8)
    rgb[:, :w, 0] = np.where(pieno, u16 >> 8, 0); rgb[:, :w, 1] = np.where(pieno, u16 & 255, 0)
    # Sul contorno della camicia la stoffa si vede di taglio e le posizioni calcolate ballano: anche lì (un punto e mezzo
    # dentro la sagoma) si legge il colore medio del tessuto, come sul bordo esterno: un contorno pulito, senza puntini
    dal_vuoto = cv2.distanceTransform((stoffa | ferro).astype(np.uint8), cv2.DIST_L2, 5)
    di_taglio = stoffa & (dal_vuoto <= 1.5)
    rgb[:, :w, 2] = np.where(stoffa & ~di_taglio, 255, np.where(bordo | di_taglio, 200, 0))
    rgb[:, w:, 0] = np.where(pieno, v16 >> 8, 0); rgb[:, w:, 1] = np.where(pieno, v16 & 255, 0)
    cv2.imwrite(uscita, rgb[..., ::-1], [cv2.IMWRITE_PNG_COMPRESSION, 9])
    return os.path.getsize(uscita)


def maschera(trama, zona, riquadro, uscita):
    """La maschera del riquadro, grande il doppio (come la foto della camicia) e larga il doppio di sé: a sinistra dove
    c'è stoffa (rosso), il suo bordo vicino (verde: entro due punti oltre la sagoma netta) e quello lontano (blu: fin
    dove arriva il contorno sfumato della foto ritagliata); a destra le zone (rosso i polsini, verde il taschino)."""
    x0, y0, x1, y1 = riquadro
    h, w = (y1 - y0) * 2, (x1 - x0) * 2
    blu = np.zeros((h, w), np.float32); z = np.zeros((h, w), np.uint8)
    sx0, sy0, sx1, sy1 = max(x0, 0) * 2, max(y0, 0) * 2, min(x1, LARGA) * 2, min(y1, ALTA) * 2
    blu[sy0 - 2 * y0:sy1 - 2 * y0, sx0 - 2 * x0:sx1 - 2 * x0] = trama[sy0:sy1, sx0:sx1, 0].astype(np.float32) / 65535
    z[sy0 - 2 * y0:sy1 - 2 * y0, sx0 - 2 * x0:sx1 - 2 * x0] = zona[sy0:sy1, sx0:sx1]
    # Le fessure fra i pezzi del cartamodello (un raggio ci passa e vede la gruccia o il muro) sono larghe un punto o
    # due: la mediana le chiude, e toglie anche i puntini di stoffa isolati
    stoffa = cv2.medianBlur((blu > 0.9).astype(np.uint8) * 255, 5) > 127
    ferro = (cv2.medianBlur(((blu > 0.3) & (blu <= 0.9)).astype(np.uint8) * 255, 5) > 127) & ~stoffa
    n, etichette, misure, _ = cv2.connectedComponentsWithStats(ferro.astype(np.uint8), connectivity=8)
    ferro = np.isin(etichette, [k for k in range(1, n) if misure[k][cv2.CC_STAT_AREA] >= 56])
    # Il contorno sfumato della foto è più largo della sagoma netta: lì non deve restare un filo bianco. La stoffa si
    # allarga dove fuori non c'è nulla, ma non verso bottoni, gruccia e nastro: il loro contorno resta com'è
    lontano, dove = cv2.distanceTransformWithLabels((~stoffa).astype(np.uint8), cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
    dal_ferro = cv2.distanceTransform((~ferro).astype(np.uint8), cv2.DIST_L2, 5) if ferro.any() else np.full(stoffa.shape, 1e9, np.float32)
    fuori = (~stoffa) & (~ferro) & (lontano <= dal_ferro)
    vicino, piu_in_la = fuori & (lontano <= 2.0), fuori & (lontano > 2.0) & (lontano <= BORDO)
    # le zone, senza macchioline; sul bordo vale quella del punto di stoffa più vicino
    z = cv2.medianBlur(z, 5)
    ys, xs = np.nonzero(stoffa)
    if len(ys):
        indice = np.zeros(dove.max() + 1, np.int64); indice[dove[ys, xs]] = np.arange(len(ys))
        by, bx = np.nonzero(vicino | piu_in_la)
        k = indice[dove[by, bx]]
        z[by, bx] = z[ys[k], xs[k]]
    copre = stoffa | vicino | piu_in_la
    rgb = np.zeros((h, w * 2, 3), np.uint8)
    rgb[:, :w, 0] = stoffa * 255; rgb[:, :w, 1] = vicino * 255; rgb[:, :w, 2] = piu_in_la * 255
    rgb[:, w:, 0] = ((z == 1) & copre) * 255; rgb[:, w:, 1] = ((z == 2) & copre) * 255
    cv2.imwrite(uscita, rgb[..., ::-1], [cv2.IMWRITE_PNG_COMPRESSION, 9])
    return os.path.getsize(uscita)


def autocorrelazione(g):
    """Quanto un'immagine (grigia, a media zero) somiglia a se stessa spostata di (dy, dx), per spostamenti positivi e
    negativi: `ac[dy, dx]` con gli indici negativi di numpy, 1 nell'origine. Normalizzata sulla parte che si
    sovrappone, così gli spostamenti grandi non partono svantaggiati."""
    h, w = g.shape
    F = np.fft.rfft2(g, (2 * h, 2 * w))
    ac = np.fft.irfft2(F * np.conj(F), (2 * h, 2 * w))
    uno = np.fft.rfft2(np.ones_like(g), (2 * h, 2 * w))
    quanti = np.fft.irfft2(uno * np.conj(uno), (2 * h, 2 * w))
    return ac / np.maximum(quanti, 1) / max(float(g.var()), 1e-9)


def cime(riga, minimo=3, quante=5):
    """Gli spostamenti a cui un profilo dell'autocorrelazione torna simile a se stesso: le sue cime vere, dalla più
    vicina. Una cima vera sporge da ciò che ha intorno; le increspature del filo sul fianco di una riga larga no (il
    primo calcolo le prendeva per cime: una riga larga mezzo centimetro finiva con il passo del filo, cioè tinta unita)."""
    from scipy.signal import find_peaks
    riga = np.asarray(riga, np.float64)
    if len(riga) < minimo + 3:
        return []
    dove, come = find_peaks(riga, prominence=0.08)
    buone = [(int(k), float(s)) for k, s in zip(dove, come['prominences']) if k >= minimo and riga[k] > 0.1]
    if not buone:
        return []
    forte = max(s for _, s in buone)
    buone = [(k, s) for k, s in buone if s >= 0.3 * forte]
    # le più sporgenti, in ordine di distanza
    return sorted(k for k, _ in sorted(buone, key=lambda v: -v[1])[:quante])


def affina(ac, dy, dx, limite, soglia=0.25):
    """Il passo vero vicino a (dy, dx), con i decimali e con la sua piccola inclinazione: si segue la cima sui suoi
    multipli finché resta alta (la quinta cima divisa per cinque è più precisa della prima)."""
    def cima(y, x, r):
        meglio, dove = -9.0, (y, x)
        for yy in range(int(round(y)) - r, int(round(y)) + r + 1):
            for xx in range(int(round(x)) - r, int(round(x)) + r + 1):
                if abs(yy) < limite[0] and abs(xx) < limite[1] and ac[yy, xx] > meglio:
                    meglio, dove = ac[yy, xx], (yy, xx)
        return float(meglio), dove
    v = np.array([dy, dx], np.float64)
    _, d = cima(dy, dx, 1)
    v = np.array(d, np.float64)
    for m in range(2, 40):
        if abs(v[0] * m) >= limite[0] * 0.7 or abs(v[1] * m) >= limite[1] * 0.7:
            break
        valore, d = cima(v[0] * m, v[1] * m, 2)
        if valore < soglia:
            break
        v = np.array(d, np.float64) / m
    return v


def cella(im, g, a, b, lato_x, lato_y, al_piu=400):
    """La media di tutte le ripetizioni intere del disegno, che si ripete lungo i vettori `a` e `b` (dy, dx): una
    cella pulita, raddrizzata (a diventa l'orizzontale, b la verticale), che si ripete senza giunte. Con lei, quante
    ripetizioni c'erano e quanto si somigliano fra loro (la correlazione media fra due ripetizioni, misurata su `g`, il
    grigio senza la grana del filo): è la prova che il passo è quello vero. Un passo sbagliato dà ripetizioni che non si
    somigliano, e una media sbiadita."""
    h, w = im.shape[:2]
    s, t = np.meshgrid((np.arange(lato_x) + 0.5) / lato_x, (np.arange(lato_y) + 0.5) / lato_y)
    dove = []
    for jj in range(-60, 60):
        for ii in range(-60, 60):
            # i quattro angoli della ripetizione (ii, jj) stanno nel ritaglio?
            ys = [(ii + p) * a[0] + (jj + q) * b[0] for p in (0, 1) for q in (0, 1)]
            xs = [(ii + p) * a[1] + (jj + q) * b[1] for p in (0, 1) for q in (0, 1)]
            if min(ys) >= 0 and min(xs) >= 0 and max(ys) <= h - 1 and max(xs) <= w - 1:
                dove.append((ii, jj))
    if not dove:
        return None, 0, 0.0, None
    if len(dove) > al_piu:
        dove = [dove[int(k)] for k in np.linspace(0, len(dove) - 1, al_piu)]
    tutto = np.dstack([im, g[..., None]]).astype(np.float32)
    somma = np.zeros((lato_y, lato_x, 4), np.float64)
    varianze = 0.0
    for ii, jj in dove:
        y = ((ii + s) * a[0] + (jj + t) * b[0]).astype(np.float32)
        x = ((ii + s) * a[1] + (jj + t) * b[1]).astype(np.float32)
        pezzo = cv2.remap(tutto, x, y, cv2.INTER_LINEAR)
        somma += pezzo
        varianze += float(pezzo[..., 3].var())
    K = len(dove)
    media = somma / K
    sigma2 = varianze / K
    # Var(media) = sigma² (1 + (K - 1) rho) / K
    rho = (K * float(media[..., 3].var()) / max(sigma2, 1e-9) - 1) / (K - 1) if K > 1 else 0.0
    return media[..., :3].astype(np.float32), K, float(rho), media[..., 3].astype(np.float32)


def motivi_fuori(g, cella_g, a, b):
    """Quanta parte del ritaglio ha qualcosa di forte che la cella ripetuta non spiega: i fiorellini sparsi su un
    vichy, un pois ogni tanto. La cella del fondo si ripete bene e li cancella con la media; se ci sono, il campione va
    fatto in un altro modo (`finestra`). Restituisce la frazione dei punti con un residuo forte quanto mezzo disegno."""
    h, w = g.shape
    y, x = np.mgrid[0:h, 0:w].astype(np.float64)
    M = np.linalg.inv(np.array([[a[0], b[0]], [a[1], b[1]]]))          # da (y, x) a (quante a, quante b)
    s = (M[0, 0] * y + M[0, 1] * x) % 1.0
    t = (M[1, 0] * y + M[1, 1] * x) % 1.0
    th, tw = cella_g.shape[:2]
    grande = np.pad(cella_g, ((0, 1), (0, 1)), mode='wrap')
    rifatto = cv2.remap(grande, (s * tw).astype(np.float32), (t * th).astype(np.float32), cv2.INTER_LINEAR)
    resto = np.abs(cv2.GaussianBlur((g - rifatto).astype(np.float32), (0, 0), 2.0))
    ampiezza = float(np.percentile(g, 99) - np.percentile(g, 1))
    return float((resto > 0.45 * max(ampiezza, 1e-6)).mean())


def finestra(piana, a, b):
    """Un disegno con un fondo che si ripete (quadretti, pois) e sopra qualcosa di più rado: si prende dal ritaglio la
    finestra più grande fatta di un numero intero di ripetizioni del fondo, raddrizzata, e si sciolgono i bordi uno
    nell'altro per un numero intero di ripetizioni: il fondo combacia da sé, i motivi radi sfumano dove il campione
    ricomincia. Restituisce (campione, larghezza e altezza in punti del ritaglio) o None se la finestra è troppo piccola."""
    h, w = piana.shape[:2]
    la, lb = float(np.hypot(*a)), float(np.hypot(*b))
    meglio = None
    for N in range(int(w / la) + 1, 1, -1):
        for M in range(int(h / lb) + 1, 1, -1):
            ys = [p * N * a[0] + q * M * b[0] for p in (0, 1) for q in (0, 1)]
            xs = [p * N * a[1] + q * M * b[1] for p in (0, 1) for q in (0, 1)]
            if max(ys) - min(ys) <= h - 1 and max(xs) - min(xs) <= w - 1 and (meglio is None or N * M > meglio[0] * meglio[1]):
                meglio = (N, M, ys, xs)
    if meglio is None:
        return None
    N, M, ys, xs = meglio
    kx, ky = max(1, int(round(N * 0.18))), max(1, int(round(M * 0.18)))
    if N - kx < 2 or M - ky < 2:
        return None
    oy = -min(ys) + (h - 1 - (max(ys) - min(ys))) / 2
    ox = -min(xs) + (w - 1 - (max(xs) - min(xs))) / 2
    lato_x, lato_y = int(round(N * la)), int(round(M * lb))
    s, t = np.meshgrid((np.arange(lato_x) + 0.5) / lato_x * N, (np.arange(lato_y) + 0.5) / lato_y * M)
    dritta = cv2.remap(piana, (ox + s * a[1] + t * b[1]).astype(np.float32), (oy + s * a[0] + t * b[0]).astype(np.float32), cv2.INTER_LINEAR)
    mx, my = int(round(kx * lato_x / N)), int(round(ky * lato_y / M))
    sfuma = np.linspace(0, 1, mx, dtype=np.float32)[None, :, None]
    c = dritta[:, :lato_x - mx].copy()
    c[:, :mx] = dritta[:, :mx] * sfuma + dritta[:, lato_x - mx:] * (1 - sfuma)
    sfuma = np.linspace(0, 1, my, dtype=np.float32)[:, None, None]
    d = c[:lato_y - my].copy()
    d[:my] = c[:my] * sfuma + c[lato_y - my:] * (1 - sfuma)
    return d, (N - kx) * la, (M - ky) * lb


def senza_giunte(im):
    """Un ritaglio qualunque reso ripetibile senza capovolgere nulla: la fascia in fondo (a destra, in basso) si
    scioglie nell'inizio, così dove il campione ricomincia non c'è uno scalino. Il campione viene più piccolo della fascia."""
    h, w = im.shape[:2]
    m = max(4, min(h, w) // 5)
    t = np.linspace(0, 1, m, dtype=np.float32)[None, :, None]
    b = im[:, :w - m].copy()
    b[:, :m] = im[:, :m] * t + im[:, w - m:] * (1 - t)
    t = t.transpose(1, 0, 2)
    c = b[:h - m].copy()
    c[:m] = b[:m] * t + b[h - m:] * (1 - t)
    return c


def profilo(prof):
    """L'autocorrelazione di un profilo a una dimensione, normalizzata sulla parte che si sovrappone."""
    n = len(prof)
    p = prof - prof.mean()
    return np.correlate(p, p, 'full')[n - 1:] / (max(float(p.var()), 1e-9) * np.arange(n, 0, -1))


def raddrizza(P, G):
    """Le righe di un ritaglio non sono mai dritte del tutto: un grado di pendenza, sulla media di duecento file, basta
    a sbiadire una riga sottile (era il «disegno quasi sparito» dei rigati fini). Si cerca la pendenza con cui il
    profilo medio è più contrastato e si raddrizza l'immagine. Restituisce (colori, grigio, contrasto del profilo)."""
    h, w = G.shape
    ys = (np.arange(h, dtype=np.float32) - (h - 1) / 2)[:, None]
    xs = np.arange(w, dtype=np.float32)[None, :]
    my = np.repeat(np.arange(h, dtype=np.float32)[:, None], w, axis=1)
    G32 = np.ascontiguousarray(G, dtype=np.float32)
    P = np.ascontiguousarray(P, dtype=np.float32)
    margine = int(0.13 * h / 2) + 2
    def contrasto(s):
        prof = cv2.remap(G32, (xs + ys * s).astype(np.float32), my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT).mean(axis=0)
        return float(prof[margine:w - margine].std())
    prove = np.linspace(-0.12, 0.12, 49)
    s0 = float(prove[int(np.argmax([contrasto(s) for s in prove]))])
    fini = np.linspace(s0 - 0.005, s0 + 0.005, 21)
    s = float(fini[int(np.argmax([contrasto(v) for v in fini]))])
    mx = (xs + ys * s).astype(np.float32)
    dritta = cv2.remap(P.astype(np.float32), mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)[:, margine:w - margine]
    grigia = cv2.remap(G32, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)[:, margine:w - margine]
    return dritta, grigia, float(grigia.mean(axis=0).std())


def righe(piana, g):
    """Un tessuto a righe: una sola fila di colori, lunga un passo. Tra i passi possibili si prende il più corto le cui
    ripetizioni si somigliano davvero. Restituisce (fila di colori, passo in punti, quanto si somigliano, verticali) o
    None se non sono righe (c'è qualcosa anche nell'altro verso) o il passo non si trova."""
    dritte = raddrizza(piana, g), raddrizza(piana.transpose(1, 0, 2), g.T)
    verticali = dritte[0][2] >= dritte[1][2]
    P, G, forte = dritte[0 if verticali else 1]
    if forte <= 0.5:
        return None
    # righe vere: nell'altro verso non c'è niente che si veda sulla camicia (altrimenti è un quadro: lo fa `reticolo`)
    altro = float(cv2.GaussianBlur(G.mean(axis=1)[None].astype(np.float32), (0, 0), 3).std())
    if altro >= 5 and altro >= 0.25 * forte:
        return None
    colori = P.mean(axis=0)[None].astype(np.float32)                    # una riga di colori, lunga quanto il ritaglio
    grigio = G.mean(axis=0)
    n = len(grigio)
    ac1 = profilo(grigio)
    finto = np.zeros((1, 2 * n)); finto[0, :n] = ac1; finto = np.concatenate([finto, finto])       # per `affina`: dy sempre 0
    prove = []
    for p0 in cime(ac1[:int(n * 0.72)], minimo=4):
        px = float(affina(finto, 0, p0, (1, n), soglia=0.3)[1])
        if px < 3:
            continue
        K = int((n - 1) / px)
        lato = max(2, int(round(px)))
        x = ((np.arange(lato) + 0.5) / lato)[None, :] * px
        if K >= 2:
            fette = np.stack([cv2.remap(grigio[None].astype(np.float32), (x + k * px).astype(np.float32), np.zeros_like(x, dtype=np.float32), cv2.INTER_LINEAR)[0] for k in range(K)])
            sigma2 = float(fette.var(axis=1).mean())
            rho = (K * float(fette.mean(axis=0).var()) / max(sigma2, 1e-9) - 1) / (K - 1)
        else:
            rho = float(ac1[int(round(px))]) - 0.05                     # una ripetizione sola: quanto il pezzo che avanza somiglia all'inizio
        somma = np.zeros((1, lato, 3))
        for k in range(max(K, 1)):
            somma += cv2.remap(colori, (x + k * px).astype(np.float32), np.zeros_like(x, dtype=np.float32), cv2.INTER_LINEAR)
        prove.append((px, rho, (somma / max(K, 1)).astype(np.float32)))
    if not prove:
        return None
    meglio = max(r for _, r, _ in prove)
    if meglio < 0.6:
        return None
    px, rho, fila = min((v for v in prove if v[1] >= meglio - 0.04), key=lambda v: v[0])
    return fila, px, rho, verticali


def reticolo(piana, g):
    """Un disegno che si ripete in due versi (quadretti, fantasie, armature): la cella più piccola le cui ripetizioni si
    somigliano davvero. I passi possibili si cercano sia nei profili (le linee di un finestrato si vedono lì, anche
    quando nell'immagine intera pesano poco) sia nell'autocorrelazione intera (un pied-de-poule non ha profilo).
    Restituisce (cella, a, b, quanto si somigliano) o None."""
    h, w = g.shape
    ac = autocorrelazione(g)
    def passi(profilo_ac, asse_ac, limite):
        tutti = []
        for k in cime(profilo_ac[:limite], minimo=4, quante=4) + cime(asse_ac[:limite], minimo=4, quante=4):
            if all(abs(k - v) > 2 for v in tutti):
                tutti.append(k)
        return sorted(tutti)[:6]
    px = passi(profilo(g.mean(axis=0)), ac[0, :w], int(w * 0.67))
    py = passi(profilo(g.mean(axis=1)), ac[:h, 0], int(h * 0.67))
    prove = []
    for x0 in px:
        for y0 in py:
            a, b = affina(ac, 0, x0, (h, w)), affina(ac, y0, 0, (h, w))
            la, lb = float(np.hypot(*a)), float(np.hypot(*b))
            if la < 3 or lb < 3:
                continue
            c, K, rho, cg = cella(piana, g, a, b, max(2, int(round(la))), max(2, int(round(lb))))
            if c is not None and K >= 2:
                prove.append((la * lb, rho, c, a, b, cg))
    if not prove:
        return None
    meglio = max(v[1] for v in prove)
    if meglio < 0.5:
        return None
    _, rho, c, a, b, cg = min((v for v in prove if v[1] >= meglio - 0.04), key=lambda v: v[0])
    return c, a, b, rho, cg


def ripetibile(ritaglio, disegno):
    """Un campione che si ripete senza giunte, secondo il suo disegno.

    Righe, quadretti, fantasie e armature che si vedono hanno un passo: lo si cerca (dove l'immagine torna uguale a se
    stessa) e il campione è la media di tutte le ripetizioni del ritaglio, pulita e sempre uguale. Fra i passi possibili
    vince il più corto le cui ripetizioni si somigliano davvero (vedi `cella`): un passo sbagliato di poco dà una media
    sbiadita, e sulla camicia il disegno sparisce.

    Una tinta unita senza un'armatura che si ripete è il suo colore medio più la grana fine del filo: tutto ciò che è
    più largo di un millimetro (macchie di luce della foto, fiammature) si toglie, perché ripetuto ogni due centimetri
    sulla camicia farebbe una quadrettatura.

    Un fondo che si ripete con sopra qualcosa di più rado (un vichy con i fiorellini): la media cancellerebbe i
    fiorellini, quindi si tiene una finestra del ritaglio fatta di ripetizioni intere del fondo (vedi `finestra`).

    Se il passo non si trova (un disegno più grande del ritaglio) resta il ritaglio, con i bordi sciolti l'uno
    nell'altro: mai a specchio, che capovolgerebbe i motivi.

    Restituisce (campione, [cm in larghezza, cm in altezza], a specchio, come è fatto)."""
    im = cv2.imread(ritaglio, cv2.IMREAD_COLOR).astype(np.float32)
    h, w = im.shape[:2]
    media = im.reshape(-1, 3).mean(0)
    grande = lambda a: cv2.resize(a, (LATO, LATO), interpolation=cv2.INTER_AREA if a.shape[0] >= LATO else cv2.INTER_CUBIC)
    # la luce spianata: la foto della cartella non è illuminata uguale dappertutto
    morbida = cv2.GaussianBlur(im, (0, 0), min(h, w) / 2.2)
    piana = im / np.maximum(morbida, 1) * media
    # (senza la grana del filo, che si ripete ogni due o tre punti e confonderebbe la ricerca del passo)
    g = cv2.GaussianBlur(piana.mean(axis=2), (0, 0), 1.5)
    g = g - g.mean()
    if disegno == 'righe':
        r = righe(piana, g)
        if r:
            fila, px, rho, verticali = r
            # (le righe orizzontali del ritaglio si girano: sulla camicia le righe corrono dall'alto in basso)
            return grande(np.repeat(fila, 8, axis=0)), [round(px / AL_CM, 4), 1.0], False, f"righe{'' if verticali else ' (girate)'}, passo {px:.1f} ({rho:.2f})"
    if disegno != 'unito' or g.std() >= 3.0:
        r = reticolo(piana, g)
        if r:
            c, a, b, rho, cg = r
            la, lb = float(np.hypot(*a)), float(np.hypot(*b))
            fuori = motivi_fuori(g, cg, a, b) if disegno != 'unito' else 0.0
            if fuori > 0.004:
                f = finestra(piana, a, b)
                if f:
                    return grande(f[0]), [round(f[1] / AL_CM, 4), round(f[2] / AL_CM, 4)], False, f'fondo {la:.1f} x {lb:.1f} con motivi radi ({fuori * 100:.1f}%)'
            return grande(c), [round(la / AL_CM, 4), round(lb / AL_CM, 4)], False, f'passi {la:.1f} x {lb:.1f} ({rho:.2f})'
    if disegno == 'unito':
        grana = im - cv2.GaussianBlur(im, (0, 0), GRANA)             # solo il dettaglio fine: trama e filo
        lato = min(h, w)
        c = senza_giunte((media + grana)[(h - lato) // 2:(h - lato) // 2 + lato, (w - lato) // 2:(w - lato) // 2 + lato])
        return grande(c), [round(c.shape[1] / AL_CM, 3), round(c.shape[0] / AL_CM, 3)], False, 'unito: colore e grana'
    c = senza_giunte(piana)
    return grande(c), [round(c.shape[1] / AL_CM, 3), round(c.shape[0] / AL_CM, 3)], False, 'bordi sciolti'


def trame(colli_lavoro, uscita):
    """trama-base.png, trama-collo-*.png, trama-taschino.png e i loro riquadri."""
    o = json.load(open(os.path.join(uscita, 'opzioni', 'opzioni.json')))
    leggera = json.load(open(os.path.join(uscita, 'leggera', 'leggera.json')))
    x, y, w, h = leggera['pezzi']['camicia']
    apri = lambda nome: cv2.imread(os.path.join(colli_lavoro, f'trama-{nome}.png'), cv2.IMREAD_UNCHANGED)
    z = zone(cv2.imread(os.path.join(colli_lavoro, 'mappa-italiano.png'), cv2.IMREAD_UNCHANGED))
    senza_tasca = np.where(z == 2, 0, z).astype(np.uint8)
    U = os.path.join(uscita, 'opzioni')
    def scrivi(nome, sorgente, zone_, riquadro):
        r = [int(v) for v in riquadro]
        a = impacchetta(sorgente, r, os.path.join(U, f'trama-{nome}.png'))
        b = maschera(sorgente, zone_, r, os.path.join(U, f'maschera-{nome}.png'))
        print(f'trama-{nome}.png {a // 1024} KB, maschera-{nome}.png {b // 1024} KB')
        return {'file': f'trama-{nome}.png', 'maschera': f'maschera-{nome}.png', 'riquadro': riquadro}
    t = {'base': scrivi('base', apri('italiano'), senza_tasca, [x, y, x + w, y + h]), 'colli': {}}
    for nome, voce in o['colli'].items():
        if voce and voce.get('file'):
            if apri(nome) is None:
                print(f'manca trama-{nome}.png: saltato'); continue
            t['colli'][nome] = scrivi(voce['file'], apri(nome), senza_tasca, voce['riquadro'])
    t['taschino'] = scrivi('taschino', apri('taschino'), z, o['taschino']['riquadro'])
    return t


def tessuti(tessuti_lavoro, uscita, foglio=''):
    """Un campione ripetibile per ogni tessuto di contenuti/it/tessuti.json, in public/camicia/stoffe/."""
    elenco = json.load(open(os.path.join(uscita, '..', '..', 'contenuti', 'it', 'tessuti.json')))['tessuti']
    fatti = []
    for x in elenco:
        tid = x['id']
        ritaglio = os.path.join(tessuti_lavoro, 'ritagli', f'{tid[1:3]}-{tid[3:5]}.png')
        tessera, cm, specchio, come = ripetibile(ritaglio, x['disegno'])
        fatti.append((x, tessera, cm, specchio, come))
    # La carta della cartella colori è stata riportata a bianco, ma un tessuto bianco fotografato è un po' più scuro
    # della carta: senza correzione la camicia bianca diventerebbe grigiolina. Si alza tutto di quanto serve perché i
    # bianchi uniti più chiari diano il bianco della camicia calcolata (lo stesso guadagno per tutti i tessuti)
    chiari = sorted(float(t.mean()) for x, t, *_ in fatti if x['disegno'] == 'unito' and x['colore'] == 'bianco')
    guadagno = min(1.25, max(1.0, BIANCO / np.median(chiari[len(chiari) // 2:]))) if chiari else 1.0
    print(f'{len(chiari)} bianchi uniti; guadagno {guadagno:.3f}')
    os.makedirs(os.path.join(uscita, 'stoffe'), exist_ok=True)
    voci, peso = {}, 0
    for x, tessera, cm, specchio, come in fatti:
        f = os.path.join(uscita, 'stoffe', x['id'] + '.webp')
        cv2.imwrite(f, np.clip(tessera * guadagno, 0, 255).astype(np.uint8), [cv2.IMWRITE_WEBP_QUALITY, 86])
        peso += os.path.getsize(f)
        # [cm in larghezza, cm in altezza, a specchio (1) o ripetuto com'è (0)]
        voci[x['id']] = [cm[0], cm[1], 1 if specchio else 0]
    print(f'{len(voci)} campioni in stoffe/, {peso // 1024} KB in tutto')
    if foglio:
        # per guardarli: accanto a ogni ritaglio, il campione ripetuto tre volte per tre alla stessa scala
        os.makedirs(foglio, exist_ok=True)
        per_foglio, lato = 48, 150
        for k in range(0, len(fatti), per_foglio):
            gruppo = fatti[k:k + per_foglio]
            tela = np.full((((len(gruppo) + 7) // 8) * (lato + 22), 8 * (2 * lato + 14), 3), 255, np.uint8)
            for i, (x, tessera, cm, specchio, come) in enumerate(gruppo):
                r, c = divmod(i, 8)
                ox, oy = c * (2 * lato + 14), r * (lato + 22)
                rit = cv2.imread(os.path.join(tessuti_lavoro, 'ritagli', f"{x['id'][1:3]}-{x['id'][3:5]}.png"))
                cmr = (rit.shape[1] / AL_CM, rit.shape[0] / AL_CM)
                scala = lato / max(cmr)                                  # punti del foglio per centimetro
                tela[oy:oy + int(cmr[1] * scala), ox:ox + int(cmr[0] * scala)] = cv2.resize(rit, (int(cmr[0] * scala), int(cmr[1] * scala)), interpolation=cv2.INTER_AREA)
                t8 = np.clip(tessera * guadagno, 0, 255).astype(np.uint8)
                uno = cv2.resize(t8, (max(2, int(cm[0] * scala)), max(2, int(cm[1] * scala))), interpolation=cv2.INTER_AREA)
                if specchio:
                    uno = np.vstack([np.hstack([uno, uno[:, ::-1]]), np.hstack([uno[::-1], uno[::-1, ::-1]])])
                rip = np.tile(uno, (lato // uno.shape[0] + 1, lato // uno.shape[1] + 1, 1))[:lato, :lato]
                tela[oy:oy + lato, ox + lato + 4:ox + 2 * lato + 4] = rip
                cv2.putText(tela, f"{x['id']} {x['disegno'][:4]} {come[:22]}", (ox, oy + lato + 14), cv2.FONT_HERSHEY_SIMPLEX, 0.36, (0, 0, 0), 1, cv2.LINE_AA)
            cv2.imwrite(os.path.join(foglio, f'foglio-{k // per_foglio + 1:02d}.jpg'), tela, [cv2.IMWRITE_JPEG_QUALITY, 85])
    return voci, guadagno


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('colli_lavoro'); ap.add_argument('tessuti_lavoro'); ap.add_argument('uscita')
    ap.add_argument('--solo-trame', action='store_true'); ap.add_argument('--solo-tessuti', action='store_true')
    ap.add_argument('--foglio', default='')
    a = ap.parse_args()
    file = os.path.join(a.uscita, 'opzioni', 'trame.json')
    t = json.load(open(file)) if os.path.exists(file) else {}
    t.pop('_nota', None)
    # un metro di stoffa nel cartamodello (unità delle coordinate) e nel fotogramma (punti, all'altezza del petto)
    t.update({'al_metro_uv': 1.53, 'al_metro': 828.6})
    if not a.solo_tessuti:
        t.update(trame(a.colli_lavoro, a.uscita))
    if not a.solo_trame:
        t['tessuti'], t['guadagno'] = tessuti(a.tessuti_lavoro, a.uscita, a.foglio)
        t['guadagno'] = round(float(t['guadagno']), 3)
    # la versione: cambia quando cambia uno qualunque dei file (il browser li tiene in memoria a lungo)
    import hashlib
    impronta = hashlib.sha256()
    for cartella, fine in (('opzioni', '.png'), ('stoffe', '.webp')):
        for f in sorted(os.listdir(os.path.join(a.uscita, cartella))):
            if f.endswith(fine):
                impronta.update(f.encode()); impronta.update(open(os.path.join(a.uscita, cartella, f), 'rb').read())
    t['versione'] = impronta.hexdigest()[:10]
    testo = json.dumps(t, ensure_ascii=False, separators=(',', ':'), default=lambda v: v.item())      # i numeri di numpy
    with open(file, 'w') as f:
        f.write(testo + '\n')


if __name__ == '__main__':
    main()
