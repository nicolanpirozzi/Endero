"""Le cartelle colori dei tessuti, dalle foto del telefono a immagini dritte, pulite e misurabili.

    python -I tools/tessuti.py raddrizza <cartella originali> <cartella lavoro> [--rifai] [--solo 04,22]
    python -I tools/tessuti.py tassello  <cartella lavoro> NN x0 y0 x1 y1 [--volte 2] [--uscita file.png]
    python -I tools/tessuti.py ritaglia  <cartella lavoro> NN

Serve Python con numpy, Pillow, scipy e opencv-python-headless. Le foto e tutto ciò che esce da qui (nomi
degli articoli e codici dei tessuti) non entrano nel repository: la cartella di lavoro sta fuori.

RADDRIZZA. Le foto (in ordine di nome, numerate 01, 02...) sono cartelle su un tavolo, di sera, con la luce calda
che cala verso i bordi, a volte capovolte e un po' di sbieco. Per ognuna:
  1. trova il foglio: per ogni lato la retta più esterna lungo la quale si passa dal tavolo alla carta (la carta è
     più azzurra del tavolo beige sotto la stessa luce) o dal tavolo al nero dell'intestazione, che arriva al bordo;
     poi ogni lato si rifinisce sulla foto intera, e gli angoli sono dove i lati si incrociano;
  2. lo porta a un rettangolo largo 2400 punti: l'altezza viene dalla forma vera del foglio, calcolata dalla
     prospettiva. Le cartelle sono tutte dello stesso formato (un po' più lungo di un A4: circa 1,45 contro
     1,414), quindi si usa la mediana delle forme misurate; chi se ne scosta più del 2% tiene la sua ed è segnata
     come sospetta in cartelle.json (o è un formato diverso, o un lato è stato trovato male: va guardata);
  3. lo gira con la fascia nera dell'intestazione in alto;
  4. corregge luce e colore: dai soli punti di carta (chiari, lisci, poco colorati) stima per ogni canale come cade
     la luce sul foglio, una superficie di terzo grado ai minimi quadrati con gli scarti tolti (in due giri: il
     secondo sceglie la carta sull'immagine già corretta una volta), e divide: la carta torna bianco neutro uniforme (CARTA, circa 240) e i campioni prendono la stessa correzione.
     Il conto è fatto in luce lineare, non sui valori sRGB, così i colori scuri non si sporcano.
Scrive <lavoro>/cartelle/NN.png (piena qualità), NN-piccola.jpg (larga 1200) e <lavoro>/cartelle.json.
Se un foglio non si trova da solo (un altro foglio accanto, il foglio tagliato dalla foto) gli angoli si danno a
mano in <lavoro>/angoli.json: { "07": { "angoli": [[x, y], ...4] }, "32": { "angoli": [...], "tagliato": "alto" } },
in punti della foto già girata secondo l'EXIF, in qualunque ordine. Gli angoli dati a mano possono essere
approssimati: ogni lato si cerca vicino a quello dato (con "esatti": true si usano così come sono). Con "tagliato" il lato indicato non è il bordo del foglio ma quello
della foto: lì non si inventa niente, la cartella finisce dove finisce la foto (la sua altezza viene dalla
prospettiva dei tre lati veri e dalla focale stimata sulle altre foto).

TASSELLO. Un pezzo della cartella raddrizzata, ingrandito (di base due volte) con un filo di maschera di contrasto,
per leggere i codici stampati piccoli accanto ai campioni. Coordinate in punti della cartella larga 2400.

RITAGLIA. Legge <lavoro>/riquadri/NN.json, una lista di { "id": "NN-01", "riquadro": [x0, y0, x1, y1] } (il
rettangolo di tessuto pulito, dentro i bordi a zig-zag), e scrive <lavoro>/ritagli/<id>.png alla risoluzione piena,
<lavoro>/riquadri/NN-riquadri.jpg (la cartella larga 1600 con i riquadri disegnati e numerati, per controllarli a
occhio) e <lavoro>/ritagli/NN.json: per ogni ritaglio il colore medio (sRGB e L*a*b*) e quanto è "a disegno"
(scarto quadratico della luminosità L*, e dei tre canali).
"""
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps

Image.MAX_IMAGE_PIXELS = None

LARGHEZZA = 2400               # punti della cartella raddrizzata, sul lato corto
A4 = 297 / 210                 # altezza su larghezza del foglio A4
CARTA = 240                    # valore sRGB a cui torna la carta bianca
FOCALE_PREDEFINITA = 0.69      # focale in frazioni del lato lungo della foto (telefono, obiettivo principale)


# ---------------------------------------------------------------------------------------------- colore e luce

def lineare(v):
    """Da sRGB (0-1) a luce lineare."""
    return np.where(v <= 0.04045, v / 12.92, ((v + 0.055) / 1.055) ** 2.4)


def srgb(v):
    """Da luce lineare a sRGB (0-1)."""
    v = np.clip(v, 0, None)
    return np.where(v <= 0.0031308, v * 12.92, 1.055 * np.power(v, 1 / 2.4) - 0.055)


def lab(rgb):
    """sRGB 0-255 (n x 3) in L*a*b* (D65)."""
    l = lineare(np.asarray(rgb, dtype=np.float64) / 255)
    m = np.array([[0.4124564, 0.3575761, 0.1804375],
                  [0.2126729, 0.7151522, 0.0721750],
                  [0.0193339, 0.1191920, 0.9503041]])
    xyz = l @ m.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > (6 / 29) ** 3, np.cbrt(xyz), xyz / (3 * (6 / 29) ** 2) + 4 / 29)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def termini(x, y, grado):
    """I monomi x^i y^j con i + j <= grado, per la superficie della luce."""
    return np.stack([x ** i * y ** j for i in range(grado + 1) for j in range(grado + 1 - i)], -1)


def punti_di_carta(rgb8):
    """Maschera dei punti di carta su un'immagine piccola: chiari, lisci, poco colorati rispetto al foglio."""
    g = rgb8.astype(np.float32)
    lum = g.mean(-1)
    media = cv2.blur(lum, (7, 7))
    scarto = np.sqrt(np.maximum(cv2.blur(lum * lum, (7, 7)) - media * media, 0))
    # la carta sotto questa luce è il chiaro più diffuso: si parte dai punti più chiari, poi si guarda il colore
    soglia = np.percentile(lum, 55)
    chiari = (lum > soglia) & (scarto < 4)
    # dominante della carta: il rapporto tra i canali, che sul foglio cambia piano; i campioni colorati se ne staccano
    rapp = g / np.maximum(lum[..., None], 1)
    rif = np.median(rapp[chiari], axis=0)
    chiari &= np.abs(rapp - rif).max(-1) < 0.06
    # via il bordo estremo del foglio (ombre e tavolo che sfuggono alla prospettiva)
    b = max(2, round(0.012 * rgb8.shape[1]))
    chiari[:b] = chiari[-b:] = False
    chiari[:, :b] = chiari[:, -b:] = False
    return chiari


def stima_luce(lin, maschera, grado):
    """Per ogni canale, i coefficienti della superficie di luce sui punti di carta (in luce lineare), ai minimi
    quadrati con gli scarti oltre tre volte la deviazione robusta tolti in tre giri."""
    hp, wp = maschera.shape
    ys, xs = np.nonzero(maschera)
    v = lin[ys, xs]
    A = termini(xs / wp * 2 - 1, ys / hp * 2 - 1, grado)
    coeff = []
    for c in range(3):
        t = np.ones(len(xs), bool)
        for _ in range(3):
            k, *_ = np.linalg.lstsq(A[t], v[t, c], rcond=None)
            res = v[:, c] - A @ k
            s = 1.4826 * np.median(np.abs(res[t]))
            t = np.abs(res) < 3 * s + 1e-4
        coeff.append(k)
    return coeff, len(xs)


def correggi_luce(rgb8, grado=3):
    """Divide per la luce stimata sui punti di carta, per canale e in luce lineare. Restituisce uint8 e i dati.
    Due giri: nel primo i punti di carta si scelgono tra i più chiari, quindi la carta ai bordi, dove la luce cala,
    resta fuori e lì la superficie sbaglia; nel secondo si scelgono sull'immagine già corretta una volta, così
    entra tutta la carta, e la superficie si rifà sui valori di partenza."""
    h, w = rgb8.shape[:2]
    passo = 8
    piccola = cv2.resize(rgb8, (w // passo, h // passo), interpolation=cv2.INTER_AREA)
    lin = lineare(piccola.astype(np.float64) / 255)
    hp, wp = piccola.shape[:2]
    maschera = punti_di_carta(piccola)
    for giro in range(2):
        coeff, quanti = stima_luce(lin, maschera, grado)
        if giro == 0:
            yy, xx = np.mgrid[0:hp, 0:wp]
            T = termini((xx + 0.5) / wp * 2 - 1, (yy + 0.5) / hp * 2 - 1, grado)
            luce = np.stack([np.maximum(T @ k, 1e-3) for k in coeff], -1)
            prima = srgb(lin / luce * lineare(np.array(CARTA / 255)))
            maschera = punti_di_carta(np.clip(np.round(prima * 255), 0, 255).astype(np.uint8))
    # la superficie della luce alla risoluzione piena, calcolata a righe per non tenere tutto in memoria
    obiettivo = lineare(np.array(CARTA / 255))
    esce = np.empty_like(rgb8)
    xg = np.linspace(-1, 1, w, endpoint=False) + 1 / w
    for y0 in range(0, h, 256):
        y1 = min(h, y0 + 256)
        yy = (np.arange(y0, y1) + 0.5) / h * 2 - 1
        X, Y = np.meshgrid(xg, yy)
        T = termini(X, Y, grado)
        blocco = lineare(rgb8[y0:y1].astype(np.float32) / 255)
        for c in range(3):
            luce = np.maximum(T @ coeff[c], 1e-3)
            blocco[..., c] = blocco[..., c] / luce * obiettivo
        esce[y0:y1] = np.clip(np.round(srgb(blocco) * 255), 0, 255).astype(np.uint8)
    return esce, {'punti_di_carta': int(quanti), 'grado': grado}


def misura_carta(rgb8):
    """Media e scarto dei tre canali sulla carta, e la media nei quattro angoli e al centro, per il controllo."""
    h, w = rgb8.shape[:2]
    piccola = cv2.resize(rgb8, (w // 8, h // 8), interpolation=cv2.INTER_AREA)
    m = punti_di_carta(piccola)
    v = piccola[m].astype(float)
    hp, wp = m.shape
    zone = {}
    for nome, (ya, yb, xa, xb) in {'alto-sx': (0, .25, 0, .25), 'alto-dx': (0, .25, .75, 1),
                                   'basso-sx': (.75, 1, 0, .25), 'basso-dx': (.75, 1, .75, 1),
                                   'centro': (.3, .7, .3, .7)}.items():
        z = np.zeros_like(m)
        z[int(ya * hp):int(yb * hp), int(xa * wp):int(xb * wp)] = True
        z &= m
        zone[nome] = [round(float(x), 1) for x in piccola[z].mean(0)] if z.sum() > 20 else None
    return {'media': [round(float(x), 1) for x in v.mean(0)], 'scarto': [round(float(x), 1) for x in v.std(0)],
            'zone': zone, 'punti': int(m.sum())}


# ---------------------------------------------------------------------------------------------- il foglio

def carica(percorso):
    """La foto come array RGB, già girata secondo l'EXIF."""
    with Image.open(percorso) as im:
        return np.asarray(ImageOps.exif_transpose(im).convert('RGB'))


def retta(punti):
    """Retta ax + by + c = 0 (a, b unitari) per i punti, ai minimi quadrati totali."""
    p = np.asarray(punti, float)
    m = p.mean(0)
    _, _, vt = np.linalg.svd(p - m)
    a, b = vt[1]
    return np.array([a, b, -(a * m[0] + b * m[1])])


def incrocio(r1, r2):
    p = np.cross(r1, r2)
    return p[:2] / p[2]


def ordina(angoli):
    """Quattro punti in ordine: alto-sx, alto-dx, basso-dx, basso-sx (nella foto)."""
    p = np.asarray(angoli, float)
    c = p.mean(0)
    a = np.arctan2(p[:, 1] - c[1], p[:, 0] - c[0])
    p = p[np.argsort(a)]                          # da sinistra in senso orario, partendo dall'alto-sx circa
    i = np.argmin(p.sum(1))
    return np.roll(p, -i, axis=0)


def cromia(rgb):
    """Il rapporto blu su rosso, la misura che separa la carta dal tavolo. Sotto la lampada calda il tavolo al centro
    è chiaro quanto la carta ai bordi, quindi la luminosità non basta; ma il tavolo è beige e la carta bianca, così
    la carta resta più azzurra del tavolo che le sta accanto (di qualche centesimo), e sul tavolo il rapporto
    cambia piano, senza gradini."""
    f = rgb.astype(np.float32)
    return f[..., 2] / np.maximum(f[..., 0], 8), f.mean(-1)


# le quattro viste: ogni lato si cerca come se fosse il sinistro, girando le immagini
def in_vista(a, lato):
    return {'sinistra': a, 'destra': a[:, ::-1], 'alto': a.T, 'basso': a.T[:, ::-1]}[lato]


def da_vista(x, y, lato, w, h):
    """Da punti della vista (x verso il centro) a punti dell'immagine."""
    return {'sinistra': (x, y), 'destra': (w - 1 - x, y), 'alto': (y, x), 'basso': (y, h - 1 - x)}[lato]


def a_vista(x, y, lato, w, h):
    return {'sinistra': (x, y), 'destra': (w - 1 - x, y), 'alto': (y, x), 'basso': (h - 1 - y, x)}[lato]


def cerca_bordo(cr, lum, ya, yb, xa=12, xb=None, pendenze=np.linspace(-0.1, 0.1, 41), modo='tutto', quota_nero=0.7):
    """Nella vista (il lato cercato è a sinistra), la retta x = a + p (y - ym) più esterna lungo la quale si passa
    dal tavolo al foglio. Le rette provate partono da ogni colonna tra xa e xb, con le pendenze date; lungo ognuna si
    guardano 120 punti tra ya e yb, e si confronta una finestra appena dentro con una appena fuori. È un bordo se:
      - il colore sale (carta più azzurra del tavolo) di almeno 0,009 in media e in più di metà dei punti, il gradino
        è netto (poco più in là, dentro o fuori, non c'è: il tavolo invece cambia piano, su tratti lunghi) e la luce
        cambia poco (un salto forte di luce è il bordo del tavolo, non del foglio);
      - oppure dal tavolo chiaro si passa al nero: è l'intestazione, che arriva quasi al bordo del foglio.
    In tutti e due i casi fuori dev'esserci il tavolo, non il pavimento scuro. Con modo 'colore' o 'nero' vale solo
    uno dei due; quota_nero è la parte dei punti che devono passare al nero. Restituisce (a, p, ym) o None."""
    H, W = cr.shape
    xb = xb or W // 2
    C = np.concatenate([np.zeros((H, 1), np.float32), np.cumsum(cr, 1)], 1)
    Lc = np.concatenate([np.zeros((H, 1), np.float32), np.cumsum(lum, 1)], 1)
    ys = np.linspace(ya, yb, 120).round().astype(int)
    ym = (ya + yb) / 2
    a = np.arange(max(14, xa - 16), min(W - 26, xb + 16))
    X = a[:, None, None] + pendenze[None, :, None] * (ys[None, None, :] - ym)
    X = np.clip(np.round(X).astype(int), 14, W - 9)
    Y = np.broadcast_to(ys, X.shape)
    passo = (C[Y, X + 7] - C[Y, X + 3]) / 4 - (C[Y, X - 3] - C[Y, X - 13]) / 10
    luce_dentro = (Lc[Y, X + 7] - Lc[Y, X + 3]) / 4
    luce_fuori = (Lc[Y, X - 3] - Lc[Y, X - 13]) / 10
    media = passo.mean(-1)
    quota = (passo > 0.008).mean(-1)
    vicini = np.maximum(np.pad(media, ((15, 0), (0, 0)), 'edge')[:-15], np.pad(media, ((0, 15), (0, 0)), 'edge')[15:])
    lf = np.median(luce_fuori, -1)
    # fuori tutto tavolo: anche il punto più lontano della finestra è chiaro quanto il più vicino
    piatto = np.median(lum[Y, X - 14] / np.maximum(lum[Y, X - 3], 1), -1) > 0.85
    tavolo = (lf > 80) & (lf > 0.6 * np.median(luce_dentro, -1)) & piatto
    # la carta è chiara quanto il tavolo, o poco più: un salto forte di luce è un altro bordo (il tavolo sul muro)
    rapporto = np.median(luce_dentro, -1) / np.maximum(lf, 1)
    colore = ((media > 0.009) & (quota > 0.5) & (media - vicini > 0.6 * media) & tavolo
              & (rapporto > 0.85) & (rapporto < 1.15))
    nero = (lf > 80) & piatto & ((luce_dentro < 0.45 * luce_fuori).mean(-1) > quota_nero)
    if modo == 'colore':
        nero[:] = False
    elif modo == 'nero':
        colore[:] = False
    buone = colore | nero
    buone[(a < xa) | (a >= xb)] = False
    if not buone.any():
        return None
    # la colonna più esterna con una retta buona, poi la retta migliore lì vicino: una retta un po' storta che
    # attraversa il bordo parte più fuori di quella giusta, ma lungo il percorso sale di meno
    i = np.nonzero(buone.any(1))[0][0]
    j = i + 14
    if colore[i:j].any():
        zona = np.where(colore[i:j], media[i:j], -1)
    else:
        # sul nero: la retta dove il salto di luce è più forte in media (fuori tutto tavolo, dentro tutto nero)
        salto_luce = np.mean((luce_fuori - luce_dentro) / np.maximum(luce_fuori, 1), -1)
        zona = np.where(nero[i:j], salto_luce[i:j], -9)
    di, dp = np.unravel_index(np.argmax(zona), zona.shape)
    return float(a[i + di]), float(pendenze[dp]), ym


def trova_foglio(img, partenza=None):
    """Angoli del foglio nella foto (alto-sx, alto-dx, basso-dx, basso-sx), o (angoli o None, motivo).
    Su una copia piccola (lato lungo 1200) si cerca per ogni lato la retta più esterna lungo la quale si passa dal
    tavolo alla carta; un gradino debole in un punto non si vede, ma lungo tutto il lato sì. Poi ogni lato si
    rifinisce sulla foto intera, con un profilo ogni pochi punti e una retta per i punti trovati.
    Con `partenza` (quattro angoli dati a mano, anche approssimati di qualche decina di punti) si salta il primo
    giro: ogni lato si cerca solo vicino a quello dato."""
    h, w = img.shape[:2]
    s = 1200 / max(h, w)
    sm = cv2.resize(img, (round(w * s), round(h * s)), interpolation=cv2.INTER_AREA)
    sm = cv2.GaussianBlur(sm, (0, 0), 1.0)
    cr, lum = cromia(sm)
    hs, ws = cr.shape
    lati = ('sinistra', 'destra', 'alto', 'basso')
    rette = {}
    if partenza is not None:
        q = ordina(partenza) * s
        rette = {'alto': np.cross([*q[0], 1], [*q[1], 1]), 'destra': np.cross([*q[1], 1], [*q[2], 1]),
                 'basso': np.cross([*q[2], 1], [*q[3], 1]), 'sinistra': np.cross([*q[3], 1], [*q[0], 1])}
    # primo giro: ogni lato sul tratto centrale; secondo giro: sul tratto tra gli angoli trovati, vicino al primo
    for giro in range(1 if partenza is not None else 0, 2):
        nuove = {}
        for lato in lati:
            crv, lv = in_vista(cr, lato), in_vista(lum, lato)
            Hv = crv.shape[0]
            if giro == 0:
                ya, yb, xa, xb = 0.15 * Hv, 0.85 * Hv, 12, crv.shape[1] // 2
            else:
                # gli estremi del lato: dove incontra i due lati vicini, un po' rientrati
                ang = angoli_da(rette)
                coppie = {'sinistra': (0, 3), 'destra': (1, 2), 'alto': (0, 1), 'basso': (3, 2)}[lato]
                p0 = a_vista(*ang[coppie[0]], lato, ws, hs)
                p1 = a_vista(*ang[coppie[1]], lato, ws, hs)
                y0, y1 = sorted((p0[1], p1[1]))
                ya, yb = y0 + 0.06 * (y1 - y0), y1 - 0.06 * (y1 - y0)
                xm = (p0[0] + p1[0]) / 2
                xa, xb = int(max(14, xm - 12)), int(xm + 12)
                # l'intestazione nera arriva quasi al bordo del foglio e lo attraversa tutto: se c'è, il bordo è lì
                # o pochi punti più fuori (a volte il tavolo, più in là, ha un suo gradino che inganna)
                testa = cerca_bordo(crv, lv, ya, yb, xa, int(xm + 0.12 * crv.shape[1]), modo='nero', quota_nero=0.85)
                if testa is not None:
                    r = cerca_bordo(crv, lv, ya, yb, int(max(14, testa[0] - 20)), int(testa[0] + 1), modo='colore')
                    r = r or testa
                    nuove[lato] = retta_in_foto(r, lato, ws, hs, Hv)
                    continue
            r = cerca_bordo(crv, lv, ya, yb, xa, xb)
            if r is None:
                return None, 'bordo %s non trovato' % lato
            nuove[lato] = retta_in_foto(r, lato, ws, hs, Hv)
        rette = nuove
    angoli = angoli_da(rette) / s
    angoli = rifinisci(img, angoli)
    if (angoli < -5).any() or (angoli[:, 0] > w + 5).any() or (angoli[:, 1] > h + 5).any():
        return angoli, 'angoli fuori dalla foto'
    area = cv2.contourArea(angoli.astype(np.float32))
    if area < 0.12 * w * h:
        return angoli, 'foglio troppo piccolo'
    lung = [np.linalg.norm(angoli[(i + 1) % 4] - angoli[i]) for i in range(4)]
    rapporto = (lung[1] + lung[3]) / (lung[0] + lung[2])
    if not 1.2 < rapporto < 1.75:
        return angoli, 'forma non da cartella (%.2f)' % rapporto
    return angoli, None


def retta_in_foto(r, lato, ws, hs, Hv):
    """La retta trovata nella vista, riportata sull'immagine (per due suoi punti)."""
    a, p, ym = r
    q0 = da_vista(a + p * (0 - ym), 0, lato, ws, hs)
    q1 = da_vista(a + p * (Hv - ym), Hv, lato, ws, hs)
    return np.cross([*q0, 1.0], [*q1, 1.0])


def angoli_da(rette):
    """Gli incroci delle quattro rette: alto-sx, alto-dx, basso-dx, basso-sx."""
    return np.array([incrocio(rette['sinistra'], rette['alto']), incrocio(rette['alto'], rette['destra']),
                     incrocio(rette['destra'], rette['basso']), incrocio(rette['basso'], rette['sinistra'])])


def rifinisci(img, angoli, mezzo=12, quanti=100):
    """Sulla foto intera: per ogni lato, profili perpendicolari lunghi 2 x mezzo punti; in ognuno il bordo è dove la
    cromia sale più in fretta andando verso il centro; una retta per quei punti (tolti in tre giri quelli lontani).
    La retta nuova si tiene solo se è sostenuta da più di metà dei profili e resta vicina a quella di partenza."""
    f = cv2.GaussianBlur(img, (0, 0), 1.5).astype(np.float32)
    cr = f[..., 2] / np.maximum(f[..., 0], 8)
    centro = angoli.mean(0)
    rette = []
    for i in range(4):
        p0, p1 = angoli[i], angoli[(i + 1) % 4]
        vecchia = np.cross([*p0, 1.0], [*p1, 1.0])
        vecchia = vecchia / np.hypot(vecchia[0], vecchia[1])
        d = (p1 - p0) / np.linalg.norm(p1 - p0)
        nrm = np.array([-d[1], d[0]])
        if np.dot(centro - p0, nrm) < 0:
            nrm = -nrm                                   # verso il centro del foglio
        t = np.linspace(0.05, 0.95, quanti)
        base = p0[None] + t[:, None] * (p1 - p0)[None]
        k = np.arange(-mezzo, mezzo + 1)
        P = base[:, None, :] + k[None, :, None] * nrm[None, None, :]
        prof = cv2.remap(cr, P[..., 0].astype(np.float32), P[..., 1].astype(np.float32), cv2.INTER_LINEAR,
                         borderMode=cv2.BORDER_REPLICATE)
        der = prof[:, 3:] - prof[:, :-3]
        j = np.argmax(der, 1)
        forza = der[np.arange(quanti), j]
        punti = base + (k[j] + 1.5)[:, None] * nrm[None]
        tieni = forza > 0.008
        nuova = None
        if tieni.sum() > quanti / 2:
            for _ in range(3):
                r = retta(punti[tieni])
                dist = np.abs(punti @ r[:2] + r[2])
                tieni = (forza > 0.008) & (dist < max(1.5, 2.5 * np.median(dist[tieni])))
            if tieni.sum() > quanti / 2:
                nuova = retta(punti[tieni])
                scarto = max(abs(np.dot([*q, 1.0], nuova)) for q in (p0, p1))
                if scarto > 0.7 * mezzo:
                    nuova = None
        rette.append(vecchia if nuova is None else nuova)
    # rette[i] è il lato da angolo i a angolo i+1: alto, destra, basso, sinistra
    return np.array([incrocio(rette[3], rette[0]), incrocio(rette[0], rette[1]),
                     incrocio(rette[1], rette[2]), incrocio(rette[2], rette[3])])


def focale_e_forma(angoli, w, h):
    """Focale (punti) e altezza/larghezza vera di un rettangolo visto in prospettiva (Zhang e He, 2007).
    Angoli: alto-sx, alto-dx, basso-dx, basso-sx. La focale è None se il foglio è quasi di fronte."""
    u0, v0 = w / 2, h / 2
    m1, m2, m4, m3 = [np.array([p[0], p[1], 1.0]) for p in angoli]   # m1 alto-sx, m2 alto-dx, m3 basso-sx, m4 basso-dx
    k2 = np.dot(np.cross(m1, m4), m3) / np.dot(np.cross(m2, m4), m3)
    k3 = np.dot(np.cross(m1, m4), m2) / np.dot(np.cross(m3, m4), m2)
    n2, n3 = k2 * m2 - m1, k3 * m3 - m1
    den = n2[2] * n3[2]
    f2 = None
    if abs(den) > 1e-12:
        f2 = -((n2[0] * n3[0] - (n2[0] * n3[2] + n2[2] * n3[0]) * u0 + n2[2] * n3[2] * u0 * u0)
               + (n2[1] * n3[1] - (n2[1] * n3[2] + n2[2] * n3[1]) * v0 + n2[2] * n3[2] * v0 * v0)) / den
    f = float(np.sqrt(f2)) if f2 and f2 > 0 else None
    return f, n2, n3


def forma_con_focale(n2, n3, f, w, h):
    A = np.array([[f, 0, w / 2], [0, f, h / 2], [0, 0, 1.0]])
    Ai = np.linalg.inv(A)
    B = Ai.T @ Ai
    return float(np.sqrt((n3 @ B @ n3) / (n2 @ B @ n2)))       # altezza / larghezza


def rettifica_tagliata(angoli, tagliato, f, w, h):
    """Foglio tagliato da un bordo della foto: tre lati veri e il quarto sul bordo. Con la focale si ricostruisce il
    piano del foglio (punti di fuga dei lati paralleli, direzioni perpendicolari) e se ne misurano i punti.
    Restituisce gli angoli del rettangolo che sta tutto dentro la foto e la sua altezza su larghezza."""
    K = np.array([[f, 0, w / 2], [0, f, h / 2], [0, 0, 1.0]])
    Ki = np.linalg.inv(K)
    tl, tr, br, bl = [np.array([p[0], p[1], 1.0]) for p in angoli]
    # i lati veri: con il taglio in alto (il caso delle foto) sono sinistra, destra e basso; per gli altri si gira
    giro = {'alto': 0, 'destra': 1, 'basso': 2, 'sinistra': 3}[tagliato]
    p = [tl, tr, br, bl]
    p = p[giro:] + p[:giro]                       # ora p[0]-p[1] è il lato tagliato
    a, b, c, d = p                                # a-b tagliato, b-c e d-a i lati paralleli, c-d il lato opposto
    lato1, lato2, fondo = np.cross(b, c), np.cross(d, a), np.cross(c, d)
    fuga = np.cross(lato1, lato2)                 # punto di fuga dei due lati paralleli
    d2 = Ki @ fuga
    d2 /= np.linalg.norm(d2)
    m = K.T @ fondo
    d1 = np.cross(m, d2)
    d1 /= np.linalg.norm(d1)
    X0 = Ki @ d                                    # un punto del piano (profondità arbitraria)
    H = K @ np.column_stack([d1, d2, X0])          # dal piano alla foto
    Hi = np.linalg.inv(H)

    def sul_piano(q):
        r = Hi @ q
        return r[:2] / r[2]

    A, B, C, D = (sul_piano(q) for q in (a, b, c, d))
    # sistema di riferimento sul foglio: origine in d, asse x verso c, asse y verso a (lungo i lati paralleli)
    ux = (C - D) / np.linalg.norm(C - D)
    uy = np.array([-ux[1], ux[0]])
    if np.dot(A - D, uy) < 0:
        uy = -uy
    larg = np.linalg.norm(C - D)
    alt = min(np.dot(A - D, uy), np.dot(B - D, uy))   # fin dove la foto mostra tutta la larghezza
    # ritorno alla foto dei quattro angoli del rettangolo che sta dentro
    def in_foto(x, y):
        q = H @ np.array([*(D + x * ux + y * uy), 1.0])
        return q[:2] / q[2]
    nuovi = [in_foto(0, alt), in_foto(larg, alt), in_foto(larg, 0), in_foto(0, 0)]   # a', b', c, d
    nuovi = nuovi[-giro:] + nuovi[:-giro] if giro else nuovi
    return np.array(nuovi), float(alt / larg)


def intestazione_in_basso(rgb8):
    """Vero se la fascia nera dell'intestazione è sul lato corto in basso."""
    h, w = rgb8.shape[:2]
    lum = rgb8.mean(-1)

    def nero(y0, y1):
        striscia = lum[int(y0 * h):int(y1 * h), int(0.08 * w):int(0.92 * w)]
        return float((striscia < 70).mean(1).max())   # la riga più "piena di nero" della striscia

    return nero(0.85, 1.0) > nero(0.0, 0.15)


def raddrizza(originali, lavoro, rifai=False, solo=None):
    foto = sorted(f for f in os.listdir(originali) if f.lower().endswith(('.jpg', '.jpeg', '.png')))
    os.makedirs(os.path.join(lavoro, 'cartelle'), exist_ok=True)
    percorso_json = os.path.join(lavoro, 'cartelle.json')
    dati = json.load(open(percorso_json)) if os.path.exists(percorso_json) else {}
    p_angoli = os.path.join(lavoro, 'angoli.json')
    a_mano = json.load(open(p_angoli)) if os.path.exists(p_angoli) else {}
    lavori = []
    for i, nome in enumerate(foto, 1):
        nn = '%02d' % i
        if solo and nn not in solo:
            continue
        uscita = os.path.join(lavoro, 'cartelle', nn + '.png')
        if os.path.exists(uscita) and not rifai and nn in dati:
            print(nn, 'già fatta')
            continue
        lavori.append((nn, nome))
    # prima passata: angoli e forma; la focale stimata sulle foto buone serve a quelle tagliate
    trovati, focali = {}, []
    for nn, nome in lavori:
        img = carica(os.path.join(originali, nome))
        h, w = img.shape[:2]
        voce = a_mano.get(nn) or {}
        if voce.get('esatti') or voce.get('tagliato'):
            angoli, motivo, origine = ordina(voce['angoli']), None, 'a mano'
        elif voce:
            # angoli approssimati: si cerca ogni lato lì vicino
            angoli, motivo = trova_foglio(img, np.array(voce['angoli'], float))
            origine = 'a mano, rifiniti'
            if motivo:
                print(nn, 'rifinitura non riuscita (%s): tengo gli angoli dati a mano' % motivo)
                angoli, motivo, origine = ordina(voce['angoli']), None, 'a mano'
        else:
            angoli, motivo = trova_foglio(img)
            origine = 'trovati'
        if motivo:
            print(nn, nome, 'NON TROVATO:', motivo, '(dare gli angoli a mano in angoli.json)')
            continue
        f, n2, n3 = focale_e_forma(angoli, w, h)
        if f and 0.4 * max(w, h) < f < 1.5 * max(w, h) and not voce.get('tagliato'):
            focali.append(f / max(w, h))
        trovati[nn] = (nome, angoli, origine, voce, f, n2, n3, (w, h))
    focale = float(np.median(focali)) if len(focali) >= 3 else FOCALE_PREDEFINITA
    # la forma vera: le cartelle sono tutte dello stesso formato, quindi si prende la mediana delle forme misurate
    # (ognuna sbaglia di poco, la mediana quasi niente); chi se ne scosta più del 2% tiene la sua ed è segnalata
    forme = {nn: forma_con_focale(v[5], v[6], focale * max(v[7]), *v[7])
             for nn, v in trovati.items() if not v[3].get('tagliato')}
    forme_vecchie = [v.get('forma_misurata') for k, v in dati.items() if k not in forme and not v.get('tagliato')]
    tutte = list(forme.values()) + [x for x in forme_vecchie if x]
    mediana = float(np.median(tutte)) if tutte else A4
    for nn, (nome, angoli, origine, voce, f, n2, n3, (w, h)) in trovati.items():
        img = carica(os.path.join(originali, nome))
        fpunti = focale * max(w, h)
        tagliato = voce.get('tagliato')
        sospetta = False
        if tagliato:
            angoli, forma = rettifica_tagliata(angoli, tagliato, fpunti, w, h)
            usata = forma
        else:
            forma = forme[nn]
            sospetta = abs(forma / mediana - 1) > 0.02
            usata = forma if sospetta else mediana
        altezza = round(LARGHEZZA * usata)
        dest = np.float32([[0, 0], [LARGHEZZA, 0], [LARGHEZZA, altezza], [0, altezza]])
        M = cv2.getPerspectiveTransform(np.float32(angoli), dest)
        dritta = cv2.warpPerspective(img, M, (LARGHEZZA, altezza), flags=cv2.INTER_LANCZOS4,
                                     borderMode=cv2.BORDER_REPLICATE)
        capovolta = intestazione_in_basso(dritta)
        if capovolta and tagliato:
            capovolta = False                     # tagliata: la fascia è dalla parte del taglio, in alto
        if capovolta:
            dritta = dritta[::-1, ::-1].copy()
        pulita, luce = correggi_luce(dritta)
        Image.fromarray(pulita).save(os.path.join(lavoro, 'cartelle', nn + '.png'), compress_level=3)
        piccola = Image.fromarray(pulita).resize((1200, round(1200 * altezza / LARGHEZZA)), Image.LANCZOS)
        piccola.save(os.path.join(lavoro, 'cartelle', nn + '-piccola.jpg'), quality=88)
        lato = np.mean([np.linalg.norm(angoli[1] - angoli[0]), np.linalg.norm(angoli[2] - angoli[3])])
        dati[nn] = {
            'file': nome, 'angoli': [[round(float(x), 1), round(float(y), 1)] for x, y in angoli],
            'angoli_da': origine, 'tagliato': tagliato, 'rotazione': 180 if capovolta else 0,
            'misure': [LARGHEZZA, altezza], 'forma_misurata': round(forma, 4), 'forma_usata': round(usata, 4),
            'forma_sospetta': sospetta,
            'foto': [w, h], 'punti_foto_per_punto': round(float(lato / LARGHEZZA), 3),
            'luce': luce, 'carta': misura_carta(pulita),
        }
        print(nn, nome, origine, 'forma %.3f%s' % (forma, ' SOSPETTA' if sospetta else ''), 'capovolta' if capovolta else 'dritta',
              '%dx%d' % (LARGHEZZA, altezza), 'carta', dati[nn]['carta']['media'], '±', dati[nn]['carta']['scarto'])
        json.dump(dict(sorted(dati.items())), open(percorso_json, 'w'), indent=1, ensure_ascii=False)
    print('focale: %.3f del lato lungo (%s); forma delle cartelle (altezza su larghezza): %.4f'
          % (focale, '%d foto' % len(focali) if len(focali) >= 3 else 'predefinita', mediana))


# ---------------------------------------------------------------------------------------------- tassello e ritagli

def apri_cartella(lavoro, nn):
    p = os.path.join(lavoro, 'cartelle', nn + '.png')
    if not os.path.exists(p):
        sys.exit('manca %s: lanciare prima raddrizza' % p)
    return Image.open(p).convert('RGB')


def tassello(lavoro, nn, x0, y0, x1, y1, volte=2.0, uscita=None):
    im = apri_cartella(lavoro, nn)
    x0, y0 = max(0, x0), max(0, y0)
    x1, y1 = min(im.width, x1), min(im.height, y1)
    if x1 <= x0 or y1 <= y0:
        sys.exit('zona vuota: servono x0 < x1 e y0 < y1 dentro la cartella (%d x %d)' % im.size)
    pezzo = im.crop((x0, y0, x1, y1))
    pezzo = pezzo.resize((round((x1 - x0) * volte), round((y1 - y0) * volte)), Image.LANCZOS)
    a = np.asarray(pezzo).astype(np.float32)
    sfocata = cv2.GaussianBlur(a, (0, 0), 1.2 * volte)
    a = np.clip(a + 0.8 * (a - sfocata), 0, 255).astype(np.uint8)   # maschera di contrasto leggera
    if not uscita:
        os.makedirs(os.path.join(lavoro, 'tasselli'), exist_ok=True)
        uscita = os.path.join(lavoro, 'tasselli', '%s-%d-%d-%d-%d.png' % (nn, x0, y0, x1, y1))
    Image.fromarray(a).save(uscita)
    print(os.path.abspath(uscita))


def ritaglia(lavoro, nn):
    im = apri_cartella(lavoro, nn)
    riquadri = json.load(open(os.path.join(lavoro, 'riquadri', nn + '.json')))
    os.makedirs(os.path.join(lavoro, 'ritagli'), exist_ok=True)
    W, H = im.size
    s = 1600 / W
    vista = im.resize((1600, round(H * s)), Image.LANCZOS)
    dis = ImageDraw.Draw(vista)
    try:
        font = ImageFont.truetype('DejaVuSans-Bold.ttf', 22)
    except OSError:
        font = ImageFont.load_default()
    misure = []
    for r in riquadri:
        x0, y0, x1, y1 = [int(round(v)) for v in r['riquadro']]
        x0, y0, x1, y1 = max(0, x0), max(0, y0), min(W, x1), min(H, y1)
        pezzo = im.crop((x0, y0, x1, y1))
        pezzo.save(os.path.join(lavoro, 'ritagli', r['id'] + '.png'))
        a = np.asarray(pezzo).reshape(-1, 3).astype(float)
        L = lab(a)
        media = a.mean(0)
        voce = {'id': r['id'], 'riquadro': [x0, y0, x1, y1], 'misure': [x1 - x0, y1 - y0],
                'rgb': [round(float(v)) for v in media],
                'hex': '#%02x%02x%02x' % tuple(int(round(v)) for v in media),
                'lab': [round(float(v), 1) for v in lab(media[None])[0]],
                'disegno': round(float(L[:, 0].std()), 2),
                'scarto_rgb': [round(float(v), 1) for v in a.std(0)]}
        misure.append(voce)
        dis.rectangle([x0 * s, y0 * s, x1 * s, y1 * s], outline=(255, 0, 140), width=3)
        etichetta = r['id']
        tx, ty = x0 * s + 6, y0 * s + 4
        bb = dis.textbbox((tx, ty), etichetta, font=font)
        dis.rectangle([bb[0] - 3, bb[1] - 2, bb[2] + 3, bb[3] + 2], fill=(255, 0, 140))
        dis.text((tx, ty), etichetta, fill=(255, 255, 255), font=font)
        print(json.dumps(voce, ensure_ascii=False))
    vista.save(os.path.join(lavoro, 'riquadri', nn + '-riquadri.jpg'), quality=88)
    json.dump(misure, open(os.path.join(lavoro, 'ritagli', nn + '.json'), 'w'), indent=1, ensure_ascii=False)


def opzione(args, nome, predefinito=None):
    if nome in args:
        i = args.index(nome)
        v = args[i + 1]
        del args[i:i + 2]
        return v
    return predefinito


def main(argv):
    args = list(argv)
    if not args:
        sys.exit(__doc__)
    comando = args.pop(0)
    if comando == 'raddrizza':
        rifai = '--rifai' in args
        if rifai:
            args.remove('--rifai')
        solo = opzione(args, '--solo')
        raddrizza(args[0], args[1], rifai, set('%02d' % int(x) for x in solo.split(',')) if solo else None)
    elif comando == 'tassello':
        volte = float(opzione(args, '--volte', 2))
        uscita = opzione(args, '--uscita')
        lavoro, nn = args[0], '%02d' % int(args[1])
        x0, y0, x1, y1 = (int(v) for v in args[2:6])
        tassello(lavoro, nn, x0, y0, x1, y1, volte, uscita)
    elif comando == 'ritaglia':
        ritaglia(args[0], '%02d' % int(args[1]))
    else:
        sys.exit(__doc__)


if __name__ == '__main__':
    main(sys.argv[1:])
