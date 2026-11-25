"""Le cartelle colori dei tessuti, dalle foto del telefono a immagini dritte, pulite e misurabili.

    python -I tools/tessuti.py raddrizza <cartella originali> <cartella lavoro> [--rifai] [--solo 04,22]
    python -I tools/tessuti.py tassello  <cartella lavoro> NN x0 y0 x1 y1 [--volte 2] [--uscita file.png]
    python -I tools/tessuti.py ritaglia  <cartella lavoro> NN

Serve Python con numpy, Pillow, scipy e opencv-python-headless. Le foto e tutto ciò che esce da qui (nomi
degli articoli e codici dei tessuti) non entrano nel repository: la cartella di lavoro sta fuori.

RADDRIZZA. Le foto (in ordine di nome, numerate 01, 02...) sono cartelle su un tavolo, di sera, con la luce calda
che cala verso i bordi, a volte capovolte e un po' di sbieco. Per ognuna:
  1. trova il foglio: il pezzo chiaro e poco colorato più grande, i suoi quattro lati come rette (minimi quadrati
     sui punti del contorno) e gli angoli dove si incrociano;
  2. lo porta a un rettangolo largo 2400 punti: l'altezza viene dalla forma vera del foglio, calcolata dalla
     prospettiva (se è un A4 entro il 4% diventa 3394 esatti);
  3. lo gira con la fascia nera dell'intestazione in alto;
  4. corregge luce e colore: dai soli punti di carta (chiari, lisci, poco colorati) stima per ogni canale come cade
     la luce sul foglio, una superficie di terzo grado ai minimi quadrati con gli scarti tolti in tre giri, e
     divide: la carta torna bianco neutro uniforme (CARTA, circa 240) e i campioni prendono la stessa correzione.
     Il conto è fatto in luce lineare, non sui valori sRGB, così i colori scuri non si sporcano.
Scrive <lavoro>/cartelle/NN.png (piena qualità), NN-piccola.jpg (larga 1200) e <lavoro>/cartelle.json.
Se un foglio non si trova da solo (un altro foglio accanto, il foglio tagliato dalla foto) gli angoli si danno a
mano in <lavoro>/angoli.json: { "32": { "angoli": [[x, y], ...4], "tagliato": "alto" } }, in punti della foto
già girata secondo l'EXIF, in qualunque ordine. Con "tagliato" il lato indicato non è il bordo del foglio ma quello
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


def correggi_luce(rgb8, grado=3):
    """Divide per la luce stimata sui punti di carta, per canale e in luce lineare. Restituisce uint8 e i dati."""
    h, w = rgb8.shape[:2]
    passo = 8
    piccola = cv2.resize(rgb8, (w // passo, h // passo), interpolation=cv2.INTER_AREA)
    maschera = punti_di_carta(piccola)
    ys, xs = np.nonzero(maschera)
    lin = lineare(piccola.astype(np.float64) / 255)[ys, xs]
    xn, yn = xs / (w / passo) * 2 - 1, ys / (h / passo) * 2 - 1
    A = termini(xn, yn, grado)
    tieni = np.ones(len(xs), bool)
    coeff = []
    for c in range(3):
        t = tieni.copy()
        for _ in range(3):
            k, *_ = np.linalg.lstsq(A[t], lin[t, c], rcond=None)
            res = lin[:, c] - A @ k
            s = 1.4826 * np.median(np.abs(res[t]))
            t = np.abs(res) < 3 * s + 1e-4
        coeff.append(k)
        tieni &= t
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
    return esce, {'punti_di_carta': int(tieni.sum()), 'grado': grado}


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


def trova_foglio(img):
    """Angoli del foglio nella foto (alto-sx, alto-dx, basso-dx, basso-sx), o None con il motivo."""
    h, w = img.shape[:2]
    s = 1200 / max(h, w)
    sm = cv2.resize(img, (round(w * s), round(h * s)), interpolation=cv2.INTER_AREA)
    sm = cv2.GaussianBlur(sm, (5, 5), 0)
    hsv = cv2.cvtColor(sm, cv2.COLOR_RGB2HSV)
    sat, val = hsv[..., 1].astype(float), hsv[..., 2].astype(float)
    # bianco del foglio contro beige del tavolo: chiaro e poco saturo; la soglia la sceglie Otsu su questa misura
    misura = val - 1.5 * sat
    misura = np.clip((misura - misura.min()) / (np.ptp(misura) + 1e-6) * 255, 0, 255).astype(np.uint8)
    _, bianco = cv2.threshold(misura, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    bianco = cv2.morphologyEx(bianco, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    n, etichette, stat, _ = cv2.connectedComponentsWithStats(bianco)
    if n < 2:
        return None, 'nessun pezzo chiaro'
    k = 1 + np.argmax(stat[1:, cv2.CC_STAT_AREA])
    pezzo = (etichette == k).astype(np.uint8) * 255
    # riempie i buchi (campioni scuri, intestazione nera) per avere la sagoma intera del foglio
    contorni, _ = cv2.findContours(pezzo, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    c = max(contorni, key=cv2.contourArea)
    scafo = cv2.convexHull(c)
    perim = cv2.arcLength(scafo, True)
    quad = None
    for e in np.linspace(0.01, 0.08, 30):
        a = cv2.approxPolyDP(scafo, e * perim, True)
        if len(a) == 4:
            quad = a[:, 0, :].astype(float)
            break
    if quad is None:
        return None, 'sagoma senza quattro lati'
    quad = ordina(quad)
    # rifinitura: ogni lato è la retta dei punti del contorno che gli stanno vicini, lontano dagli angoli
    pts = c[:, 0, :].astype(float)
    rette = []
    for i in range(4):
        p0, p1 = quad[i], quad[(i + 1) % 4]
        d = p1 - p0
        L = np.linalg.norm(d)
        u = d / L
        nrm = np.array([-u[1], u[0]])
        rel = pts - p0
        t = rel @ u
        dist = np.abs(rel @ nrm)
        sel = (t > 0.12 * L) & (t < 0.88 * L) & (dist < 6)
        if sel.sum() < 20:
            return None, 'lato %d con pochi punti' % i
        rette.append(retta(pts[sel]))
    angoli = np.array([incrocio(rette[(i - 1) % 4], rette[i]) for i in range(4)]) / s
    # controlli: dentro la foto, lati non troppo diversi, area ragionevole
    if (angoli < -5).any() or (angoli[:, 0] > w + 5).any() or (angoli[:, 1] > h + 5).any():
        return None, 'angoli fuori dalla foto'
    area = cv2.contourArea(angoli.astype(np.float32))
    if area < 0.12 * w * h:
        return None, 'foglio troppo piccolo'
    lati = [np.linalg.norm(angoli[(i + 1) % 4] - angoli[i]) for i in range(4)]
    rapporto = (lati[1] + lati[3]) / (lati[0] + lati[2])
    if not 1.2 < rapporto < 1.7:
        return None, 'forma non da A4 (%.2f)' % rapporto
    # un lato che corre sul bordo della foto vuol dire foglio tagliato
    vicino = 0.004 * max(w, h)
    for i in range(4):
        p0, p1 = angoli[i], angoli[(i + 1) % 4]
        for asse, lim in ((0, 0), (0, w), (1, 0), (1, h)):
            if abs(p0[asse] - lim) < vicino and abs(p1[asse] - lim) < vicino:
                return None, 'lato sul bordo della foto'
    return angoli, None


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
        voce = a_mano.get(nn)
        if voce:
            angoli, motivo, origine = ordina(voce['angoli']), None, 'a mano'
        else:
            angoli, motivo = trova_foglio(img)
            origine = 'trovati'
        if angoli is None:
            print(nn, nome, 'NON TROVATO:', motivo, '(dare gli angoli a mano in angoli.json)')
            continue
        f, n2, n3 = focale_e_forma(angoli, w, h)
        if f and 0.4 * max(w, h) < f < 1.5 * max(w, h) and not (voce and voce.get('tagliato')):
            focali.append(f / max(w, h))
        trovati[nn] = (nome, angoli, origine, voce or {}, f, n2, n3, (w, h))
    focale = float(np.median(focali)) if len(focali) >= 3 else FOCALE_PREDEFINITA
    for nn, (nome, angoli, origine, voce, f, n2, n3, (w, h)) in trovati.items():
        img = carica(os.path.join(originali, nome))
        fpunti = focale * max(w, h)
        tagliato = voce.get('tagliato')
        if tagliato:
            angoli, forma = rettifica_tagliata(angoli, tagliato, fpunti, w, h)
        else:
            forma = forma_con_focale(n2, n3, fpunti, w, h)
        a4 = not tagliato and abs(forma / A4 - 1) < 0.04
        altezza = round(LARGHEZZA * (A4 if a4 else forma))
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
            'misure': [LARGHEZZA, altezza], 'forma_misurata': round(forma, 4), 'a4': a4,
            'foto': [w, h], 'punti_foto_per_punto': round(float(lato / LARGHEZZA), 3),
            'luce': luce, 'carta': misura_carta(pulita),
        }
        print(nn, nome, origine, 'forma %.3f' % forma, 'capovolta' if capovolta else 'dritta',
              '%dx%d' % (LARGHEZZA, altezza), 'carta', dati[nn]['carta']['media'], '±', dati[nn]['carta']['scarto'])
        json.dump(dict(sorted(dati.items())), open(percorso_json, 'w'), indent=1, ensure_ascii=False)
    print('focale stimata: %.3f del lato lungo (%d foto)' % (focale, len(focali)))


# ---------------------------------------------------------------------------------------------- tassello e ritagli

def apri_cartella(lavoro, nn):
    p = os.path.join(lavoro, 'cartelle', nn + '.png')
    if not os.path.exists(p):
        sys.exit('manca %s: lanciare prima raddrizza' % p)
    return Image.open(p).convert('RGB')


def tassello(lavoro, nn, x0, y0, x1, y1, volte=2.0, uscita=None):
    im = apri_cartella(lavoro, nn)
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
