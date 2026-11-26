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


def primo_passo(riga, minimo=7, soglia=0.3):
    """Lungo un profilo dell'autocorrelazione, il primo spostamento a cui l'immagine torna simile a se stessa: la prima
    cima alta almeno l'85% della più alta. 0 se non ce n'è."""
    n = len(riga)
    cime = [k for k in range(minimo, n - 1) if riga[k] >= riga[k - 1] and riga[k] >= riga[k + 1] and riga[k] > soglia]
    if not cime:
        return 0
    alta = max(riga[k] for k in cime)
    return next(k for k in cime if riga[k] >= 0.85 * alta)


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
    _, d = cima(dy, dx, 2)
    v = np.array(d, np.float64)
    for m in range(2, 40):
        if abs(v[0] * m) >= limite[0] * 0.7 or abs(v[1] * m) >= limite[1] * 0.7:
            break
        valore, d = cima(v[0] * m, v[1] * m, 2)
        if valore < soglia:
            break
        v = np.array(d, np.float64) / m
    return v


def cella(im, a, b, lato_x, lato_y):
    """La media di tutte le ripetizioni intere del disegno, che si ripete lungo i vettori `a` e `b` (dy, dx): una
    cella pulita, raddrizzata (a diventa l'orizzontale, b la verticale), che si ripete senza giunte."""
    h, w = im.shape[:2]
    s, t = np.meshgrid((np.arange(lato_x) + 0.5) / lato_x, (np.arange(lato_y) + 0.5) / lato_y)
    somma = np.zeros((lato_y, lato_x, 3), np.float64)
    quante = 0
    for jj in range(-40, 40):
        for ii in range(-40, 40):
            y = (ii + s) * a[0] + (jj + t) * b[0]
            x = (ii + s) * a[1] + (jj + t) * b[1]
            if y.min() < 0 or x.min() < 0 or y.max() > h - 1 or x.max() > w - 1:
                continue
            somma += cv2.remap(im, x.astype(np.float32), y.astype(np.float32), cv2.INTER_LINEAR)
            quante += 1
    return (somma / quante).astype(np.float32) if quante else None


def somiglia(im, tessera, a, b):
    """Quanto il ritaglio ricostruito ripetendo la cella somiglia al ritaglio vero (correlazione, da -1 a 1)."""
    h, w = im.shape[:2]
    y, x = np.mgrid[0:h, 0:w].astype(np.float64)
    M = np.linalg.inv(np.array([[a[0], b[0]], [a[1], b[1]]]))          # da (y, x) a (quante a, quante b)
    s = (M[0, 0] * y + M[0, 1] * x) % 1.0
    t = (M[1, 0] * y + M[1, 1] * x) % 1.0
    th, tw = tessera.shape[:2]
    grande = np.pad(tessera, ((0, 1), (0, 1), (0, 0)), mode='wrap')
    rifatto = cv2.remap(grande, (s * tw).astype(np.float32), (t * th).astype(np.float32), cv2.INTER_LINEAR)
    g1 = cv2.GaussianBlur(im.mean(axis=2), (0, 0), 1.5); g2 = cv2.GaussianBlur(rifatto.mean(axis=2), (0, 0), 1.5)
    g1 = g1 - g1.mean(); g2 = g2 - g2.mean()
    return float((g1 * g2).sum() / max(1e-9, np.sqrt((g1 * g1).sum() * (g2 * g2).sum())))


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


def ripetibile(ritaglio, disegno):
    """Un campione che si ripete senza giunte, secondo il suo disegno. Una tinta unita è il suo colore medio più la
    grana fine del tessuto (ripetuta a specchio: non ha un verso). Righe, quadretti e fantasie hanno un passo: lo si
    cerca (dove l'immagine torna uguale a se stessa) e il campione è la media di tutte le ripetizioni del ritaglio,
    pulita e sempre uguale; poi si controlla che ripetendola il ritaglio torni com'era. Se il passo non si trova (un
    disegno più grande del ritaglio) resta il ritaglio, con i bordi sciolti l'uno nell'altro: mai a specchio, che
    capovolgerebbe i motivi. Restituisce (campione, [cm in larghezza, cm in altezza], a specchio, come è fatto)."""
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
    # Una tinta unita liscia: il colore medio e la grana fine, a specchio. Una tinta unita con un'armatura che si vede
    # (spina di pesce, diagonale, piqué) a specchio farebbe dei rombi: va trattata come un disegno, con il suo passo
    if disegno == 'unito' and g.std() < 3.0:
        grana = im - cv2.GaussianBlur(im, (0, 0), 7)              # solo il dettaglio fine: trama e filo
        lato = min(h, w)
        gr = grana[(h - lato) // 2:(h - lato) // 2 + lato, (w - lato) // 2:(w - lato) // 2 + lato]
        return grande(media + gr), [round(lato / AL_CM, 3)] * 2, True, 'unito'
    if disegno == 'righe':
        # righe: il profilo medio (per colonna se sono verticali) è più pulito dell'immagine
        per_colonna, per_riga = g.mean(axis=0), g.mean(axis=1)
        verticali = per_colonna.std() >= per_riga.std()
        prof = per_colonna if verticali else per_riga
        if prof.std() > 0.5:
            n = len(prof)
            ac1 = np.correlate(prof, prof, 'full')[n - 1:] / (prof.var() * np.arange(n, 0, -1))
            p0 = primo_passo(ac1[:n * 2 // 3], minimo=5, soglia=0.4)
            if p0:
                # (le righe orizzontali del ritaglio si girano: sulla camicia le righe corrono dall'alto in basso)
                colori = (piana if verticali else piana.transpose(1, 0, 2)).mean(axis=0)[None].astype(np.float32)       # una riga di colori
                finto = np.zeros((1, 2 * n)); finto[0, :n] = ac1; finto = np.concatenate([finto, finto])               # per `affina`: dy sempre 0
                px = affina(finto, 0, p0, (1, n), soglia=0.35)[1]
                lato = max(2, int(round(px)))
                x = ((np.arange(lato) + 0.5) / lato)[None, :] * px
                somma, quante = np.zeros((1, lato, 3)), 0
                for k in range(int((n - 1) / px)):
                    somma += cv2.remap(colori, (x + k * px).astype(np.float32), np.zeros_like(x, dtype=np.float32), cv2.INTER_LINEAR); quante += 1
                if quante:
                    return grande(np.repeat((somma / quante).astype(np.float32), 8, axis=0)), [round(px / AL_CM, 4), 1.0], False, f"righe{'' if verticali else ' (girate)'}, passo {px:.1f}"
    ac = autocorrelazione(g)
    soglia = 0.3
    px, py = primo_passo(ac[0, :w * 2 // 3], soglia=soglia), primo_passo(ac[:h * 2 // 3, 0], soglia=soglia)
    if px and py:
        a, b = affina(ac, 0, px, (h, w)), affina(ac, py, 0, (h, w))
        la, lb = float(np.hypot(*a)), float(np.hypot(*b))
        c = cella(piana, a, b, max(2, int(round(la))), max(2, int(round(lb))))
        if c is not None:
            quanto = somiglia(piana, c, a, b)
            if quanto >= 0.78:
                return grande(c), [round(la / AL_CM, 4), round(lb / AL_CM, 4)], False, f'passi {la:.1f} x {lb:.1f} ({quanto:.2f})'
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
