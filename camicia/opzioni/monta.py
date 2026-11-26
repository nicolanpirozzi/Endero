"""I file del sito per la camicia che cambia: da ciò che calcolano colli.py e parti.py a public/camicia/opzioni/.

    <venv>/bin/python -I camicia/opzioni/monta.py <cartella di lavoro> public/camicia/opzioni

Nella cartella di lavoro servono collo-<nome>-4x.png (colli.py), taschino-4x.png e senza-taschino-4x.png (parti.py
taschino), mappa-<nome>.png e punti-<nome>.json (parti.py mappa). Scrive:
  collo-<nome>-1.webp, -2.webp, -4.webp   il collo da sovrapporre: opaco dove è diverso dalla camicia di base
  taschino-1.webp, -2.webp, -4.webp       (l'«italiano»), trasparente e sfumato intorno;
  opzioni.json                            dove va ogni pezzo, i contorni tratteggiati delle parti e i loro riquadri
                                          per lo zoom, dove si ricamano le iniziali. Punti del fotogramma 1800 x 1000.
Il contratto con la pagina (src/configuratore/vesti.js) è descritto in docs/direzione-creativa.md, punto 16.
"""
import hashlib
import json
import math
import os
import sys

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, QUI)
RIQUADRO_COLLO = (590, 180, 850, 390)          # gli stessi di colli.py e parti.py (qui Blender non si carica)
RIQUADRO_TASCHINO = (740, 370, 910, 560)
COLLI = ('italiano', 'button_down', 'mezzo_francese', 'francese', 'diplomatico', 'coreano')
COLORI = {'colletto': (255, 0, 0), 'listino': (0, 255, 0), 'polsino_a': (0, 0, 255), 'polsino_b': (255, 255, 0),
          'bottoni': (255, 0, 255), 'taschino': (0, 255, 255), 'cannoncino': (255, 128, 0)}
QUALITA = 84
VOLTE = 4
SOGLIA = 7                 # quanto deve cambiare un punto (su 255) per dire che lì il collo è diverso
ALLARGA, SFUMA = 10, 7     # punti (a grandezza quadrupla) di cui il pezzo si allarga oltre la differenza, e la sfumatura


def pezzo(base, nuova, riquadro, nome, uscita):
    """Il pezzo da sovrapporre: `nuova` dove è diversa da `base`. Restituisce il suo riquadro nel fotogramma."""
    a = np.asarray(base.convert('RGB')).astype(np.int16); b = np.asarray(nuova.convert('RGB')).astype(np.int16)
    diversa = ndimage.gaussian_filter(np.abs(a - b).max(axis=2).astype(np.float32), 1.5) > SOGLIA
    diversa = ndimage.binary_opening(diversa, iterations=2)
    if not diversa.any():
        return None
    dove = ndimage.binary_dilation(diversa, iterations=ALLARGA)
    dove = ndimage.binary_fill_holes(dove)
    alfa = ndimage.gaussian_filter(dove.astype(np.float32), SFUMA / 2.5)
    alfa = np.clip((alfa - 0.08) / 0.84, 0, 1)
    # sul bordo del riquadro calcolato il pezzo non può finire di colpo
    bordo = np.ones_like(alfa); m = 14
    rampa = np.linspace(0, 1, m)
    bordo[:m, :] *= rampa[:, None]; bordo[-m:, :] *= rampa[::-1, None]; bordo[:, :m] *= rampa[None, :]; bordo[:, -m:] *= rampa[None, ::-1]
    alfa *= bordo
    ys, xs = np.where(alfa > 0.004)
    # il ritaglio, allineato ai punti del fotogramma (multipli di 4 a grandezza quadrupla)
    x0, y0 = xs.min() // VOLTE * VOLTE, ys.min() // VOLTE * VOLTE
    x1, y1 = -(-(xs.max() + 1) // VOLTE) * VOLTE, -(-(ys.max() + 1) // VOLTE) * VOLTE
    rgba = np.dstack([np.asarray(nuova.convert('RGB')), (alfa * 255).round().astype(np.uint8)])[y0:y1, x0:x1]
    im = Image.fromarray(rgba, 'RGBA')
    for t in (4, 2, 1):
        w, h = (x1 - x0) * t // VOLTE, (y1 - y0) * t // VOLTE
        (im if t == VOLTE else im.resize((w, h), Image.LANCZOS)).save(os.path.join(uscita, f'{nome}-{t}.webp'), 'WEBP', quality=QUALITA, method=6, exact=False)
    rx, ry = riquadro[0], riquadro[1]
    return [rx + x0 // VOLTE, ry + y0 // VOLTE, rx + x1 // VOLTE, ry + y1 // VOLTE]


def maschera(mappa, *nomi):
    """Dove la mappa ha il colore di una di queste parti (a grandezza doppia)."""
    m = np.zeros(mappa.shape[:2], bool)
    for n in nomi:
        c = np.array(COLORI[n])
        m |= (np.abs(mappa.astype(np.int16) - c).sum(axis=2) < 110)
    # sui bordi tra due colori nascono punti sparsi di colori di mezzo: non sono la parte
    return ndimage.binary_opening(m, iterations=2)


def contorno(m, fuori=3.0, liscio=1.6, passo=5.0, chiudi=0):
    """Il contorno della macchia più grande di `m`, appena più largo e liscio: una lista di punti del fotogramma."""
    from contourpy import contour_generator
    from shapely.geometry import Polygon
    etichette, quante = ndimage.label(m)
    if not quante:
        return None
    grande = etichette == (np.argmax(ndimage.sum(m, etichette, range(1, quante + 1))) + 1)
    if chiudi:
        grande = ndimage.binary_closing(np.pad(grande, chiudi * 2), iterations=chiudi * 2)[chiudi * 2:-chiudi * 2, chiudi * 2:-chiudi * 2]
    grande = ndimage.binary_fill_holes(grande)
    campo = ndimage.gaussian_filter(ndimage.binary_dilation(grande, iterations=int(round(fuori * 2))).astype(np.float32), liscio * 2)
    linee = contour_generator(z=campo).lines(0.5)
    if not linee:
        return None
    linea = max(linee, key=len) / 2.0                      # dalla mappa (doppia) al fotogramma
    p = Polygon(linea).simplify(0.35)
    # punti a passo regolare lungo il contorno: la pagina li unisce con una curva morbida
    n = max(12, int(p.exterior.length / passo))
    return [[round(q.x, 1), round(q.y, 1)] for q in (p.exterior.interpolate(i / n, normalized=True) for i in range(n))]


def parte(punti_o_tratti, margine=14):
    tratti = punti_o_tratti if isinstance(punti_o_tratti[0][0], list) else [punti_o_tratti]
    xs = [p[0] for t in tratti for p in t]; ys = [p[1] for t in tratti for p in t]
    return {'vista': 'davanti', 'tratti': [{'punti': t, 'visibile': True, 'chiuso': True} for t in tratti], 'capi': [],
            'riquadro': [round(min(xs) - margine, 1), round(min(ys) - margine, 1), round(max(xs) + margine, 1), round(max(ys) + margine, 1)]}


def cerchio(c, r, n=14):
    return [[round(c[0] + r * math.cos(2 * math.pi * i / n), 1), round(c[1] + r * math.sin(2 * math.pi * i / n), 1)] for i in range(n)]


def ovale(c, gradi, mezzo_largo, mezzo_alto, n=18):
    a = math.radians(gradi); ca, sa = math.cos(a), math.sin(a)
    out = []
    for i in range(n):
        t = 2 * math.pi * i / n
        x, y = mezzo_largo * math.cos(t), mezzo_alto * math.sin(t)
        out.append([round(c[0] + x * ca - y * sa, 1), round(c[1] + x * sa + y * ca, 1)])
    return out


def asse(m, attorno=None, raggio=None):
    """Il centro e la direzione lunga (in gradi, tra -90 e 90) dei punti di `m`, tutti o vicino a `attorno`."""
    ys, xs = np.nonzero(m)
    if attorno is not None:
        vicini = (xs / 2 - attorno[0]) ** 2 + (ys / 2 - attorno[1]) ** 2 < raggio ** 2
        xs, ys = xs[vicini], ys[vicini]
    q = np.stack([xs, ys], 1) / 2.0
    c = q.mean(0)
    _, _, vt = np.linalg.svd(q - c, full_matrices=False)
    g = math.degrees(math.atan2(vt[0][1], vt[0][0]))
    g = g - 180 if g > 90 else g + 180 if g < -90 else g
    return c, g


def orlo(m):
    """La direzione dell'orlo in fondo a `m` (gradi): la retta che passa per il punto più basso di ogni colonna."""
    ys, xs = np.nonzero(m)
    colonne = np.unique(xs)
    colonne = colonne[len(colonne) // 6: -len(colonne) // 6]          # senza gli angoli arrotondati
    fondo = np.array([ys[xs == x].max() for x in colonne])
    a, _ = np.polyfit(colonne, fondo, 1)
    return math.degrees(math.atan(a))


def dentro_vicino(m, a, quanto):
    """Il punto di `m` più «dentro» (lontano dal bordo) tra quelli a meno di `quanto` punti del fotogramma da `a`."""
    d = ndimage.distance_transform_edt(m)
    ys, xs = np.nonzero(m)
    vicini = (xs / 2 - a[0]) ** 2 + (ys / 2 - a[1]) ** 2 < quanto ** 2
    if not vicini.any():
        return None
    i = np.argmax(d[ys[vicini], xs[vicini]])
    return [float(xs[vicini][i] / 2), float(ys[vicini][i] / 2)]


def main():
    lavoro, uscita = sys.argv[1], sys.argv[2]
    os.makedirs(uscita, exist_ok=True)
    apri = lambda nome: Image.open(os.path.join(lavoro, nome))
    o = {'fotogramma': [1800, 1000], 'taglie': [1, 2, 4], 'colli': {}, 'parti': {}, 'iniziali': {}}

    # --- il taschino
    r = pezzo(apri(f'senza-taschino-{VOLTE}x.png'), apri(f'taschino-{VOLTE}x.png'), RIQUADRO_TASCHINO, 'taschino', uscita)
    o['taschino'] = {'file': 'taschino', 'riquadro': r}

    # --- le parti che non cambiano con il collo, dalla mappa della camicia di base (che ha anche il taschino)
    mappa = np.asarray(apri('mappa-italiano.png').convert('RGB'))
    punti = json.load(open(os.path.join(lavoro, 'punti-italiano.json')))
    metro = punti['al_metro']                                  # punti del fotogramma per metro, sul petto
    o['parti']['taschino'] = parte(contorno(maschera(mappa, 'taschino')))
    # i bottoni del davanti: un cerchietto ciascuno; lo zoom va sui primi sotto il collo
    davanti = [b for b in punti['bottoni'] if abs(b[0] - punti['bottoni'][0][0]) < 20]
    bottoni = parte([cerchio(b, metro * 0.0105) for b in davanti])
    tre = davanti[1:4]
    bottoni['riquadro'] = [round(min(b[0] for b in tre) - 70, 1), round(tre[0][1] - 34, 1), round(max(b[0] for b in tre) + 70, 1), round(tre[-1][1] + 34, 1)]
    o['parti']['bottoni'] = bottoni
    # i polsini: quello a sinistra di chi guarda per «polsino» e «interno polso», l'altro per le iniziali
    pa, pb = maschera(mappa, 'polsino_a'), maschera(mappa, 'polsino_b')
    o['parti']['polsino'] = parte(contorno(pa))
    c, _ = asse(pa); g = orlo(pa)
    # l'interno si vede dal fondo del polsino: la fascia più bassa
    ys, xs = np.nonzero(pa)
    lungo = np.array([-math.sin(math.radians(g)), math.cos(math.radians(g))])      # verso il fondo
    quota = (np.stack([xs, ys], 1) / 2.0 - c) @ lungo
    if quota.max() < -quota.min():
        quota = -quota
    fondo = np.zeros_like(pa); fondo[ys[quota > quota.max() * 0.25], xs[quota > quota.max() * 0.25]] = True
    o['parti']['interno_polso'] = parte(contorno(fondo, fuori=2.0))
    o['parti']['interno_polso']['riquadro'] = o['parti']['polsino']['riquadro']
    cb, _ = asse(pb); gb = orlo(pb)
    alta = round(metro * 0.007, 1)                             # lettere alte 7 millimetri
    o['iniziali']['polso'] = {'centro': [round(cb[0], 1), round(cb[1], 1)], 'gradi': round(gb, 1), 'alta': alta}
    o['parti']['iniziali_polso'] = parte(contorno(pb))
    # il lato cuore: sul petto dove sta il taschino, poco sotto l'orlo
    t = maschera(mappa, 'taschino'); ys, xs = np.nonzero(t)
    ct, gt = asse(t[: ys.min() + (ys.max() - ys.min()) // 4])   # la direzione dell'orlo in cima
    cuore = [round(float(xs.mean() / 2), 1), round(float(ys.min() / 2 + (ys.max() - ys.min()) / 2 * 0.36), 1)]
    o['iniziali']['cuore'] = {'centro': cuore, 'gradi': round(gt, 1), 'alta': round(metro * 0.008, 1)}
    o['parti']['iniziali_cuore'] = parte(ovale(cuore, gt, metro * 0.032, metro * 0.017), margine=30)
    # l'interno del collo: il listino che si vede dentro, dietro
    listino = maschera(mappa, 'listino')
    etichette, quante = ndimage.label(listino)
    alto = min(range(1, quante + 1), key=lambda k: ndimage.center_of_mass(listino, etichette, k)[0] if ndimage.sum(listino, etichette, k) > 400 else 1e9)
    o['parti']['interno_collo'] = parte(contorno(etichette == alto, fuori=1.5), margine=40)

    # --- i colli
    base = apri(f'collo-italiano-{VOLTE}x.png')
    for nome in COLLI:
        mappa = np.asarray(apri(f'mappa-{nome}.png').convert('RGB'))
        punti = json.load(open(os.path.join(lavoro, f'punti-{nome}.json')))
        voce = {}
        if nome != 'italiano':
            file = 'collo-' + nome.replace('_', '-')
            voce['file'] = file
            voce['riquadro'] = pezzo(base, apri(f'collo-{nome}-{VOLTE}x.png'), RIQUADRO_COLLO, file, uscita)
        collo = maschera(mappa, 'colletto', 'listino')
        # solo la zona del collo: il listino sotto il primo bottone è coperto dal cannoncino
        voce['parte'] = parte(contorno(collo, chiudi=7), margine=26)
        # le iniziali sul collo: sulla punta a destra di chi guarda (il lato sinistro di chi la indossa); dove il
        # colletto non c'è, o davanti ha solo le alette, sul listino
        bottone = punti['bottoni'][0]
        foglia = maschera(mappa, 'colletto'); foglia[:, : int(bottone[0] * 2)] = False
        if nome in ('coreano', 'diplomatico') or foglia.sum() < 800:
            banda = maschera(mappa, 'listino'); banda[:, : int((bottone[0] + (34 if nome == 'diplomatico' else 14)) * 2)] = False
            banda[: int((bottone[1] - 34) * 2)] = False
            qui = dentro_vicino(banda, [bottone[0] + (58 if nome == 'diplomatico' else 40), bottone[1] - 8], 30)
            _, g = asse(banda, qui, 22)
        else:
            # la falda a destra di chi guarda; le lettere stanno nel mezzo della sua parte davanti, a due o tre
            # centimetri dal bottone del collo, e corrono lungo la falda: dal bottone verso la punta
            etichette, quante = ndimage.label(foglia)
            falda = etichette == (np.argmax(ndimage.sum(foglia, etichette, range(1, quante + 1))) + 1)
            d = ndimage.distance_transform_edt(falda)
            ys, xs = np.nonzero(falda)
            r = np.hypot(xs / 2 - bottone[0], ys / 2 - bottone[1])
            zona = (r > metro * 0.026) & (r < metro * 0.07)
            # meglio all'altezza del bottone o sotto; più su solo se lì la falda è troppo stretta (il francese)
            i = int(np.argmax(np.where(zona, d[ys, xs] - 0.5 * np.maximum(0, (bottone[1] - 4) * 2 - ys), -1e9)))
            qui = [float(xs[i] / 2), float(ys[i] / 2)]
            g = math.degrees(math.atan2(qui[1] - bottone[1], qui[0] - bottone[0]))
            g = g - 180 if g > 90 else g + 180 if g < -90 else g
        voce['iniziali'] = {'centro': [round(qui[0], 1), round(qui[1], 1)], 'gradi': round(g, 1), 'alta': round(metro * 0.0065, 1)}
        voce['parte_iniziali'] = parte(ovale(qui, g, metro * 0.03, metro * 0.016), margine=34)
        o['colli'][nome] = voce
    # i valori di base, per chi non guarda dentro `colli`
    o['parti']['collo'] = o['colli']['italiano']['parte']
    o['iniziali']['collo'] = o['colli']['italiano']['iniziali']
    o['parti']['iniziali_collo'] = o['colli']['italiano']['parte_iniziali']

    # Dal 2026-11-26 nel passo Camicia non ci sono più zoom né contorni (proprietario: «non ci sono zoom e
    # evidenziamenti»): i contorni delle parti restano calcolati qui sopra, ma non vanno più nel file del sito
    o.pop('parti')
    for voce in o['colli'].values():
        voce.pop('parte', None); voce.pop('parte_iniziali', None)

    impronta = hashlib.sha256()
    for f in sorted(os.listdir(uscita)):
        if f.endswith('.webp'):
            impronta.update(f.encode()); impronta.update(open(os.path.join(uscita, f), 'rb').read())
    o['versione'] = impronta.hexdigest()[:10]
    with open(os.path.join(uscita, 'opzioni.json'), 'w') as f:
        json.dump(o, f, ensure_ascii=False, separators=(',', ':'), default=lambda v: v.item())      # i numeri di numpy
        f.write('\n')
    pesi = sum(os.path.getsize(os.path.join(uscita, f)) for f in os.listdir(uscita))
    print(f'{uscita}: {len(os.listdir(uscita))} file, {pesi // 1024} KB; riquadri: ' + ', '.join(f"{k} {v.get('riquadro')}" for k, v in o['colli'].items()))


if __name__ == '__main__':
    main()
