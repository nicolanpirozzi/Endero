"""Immagine ferma dell'apertura: il logo ricamato, com'è nell'ultimo fotogramma del film.

    python film/manifesto.py <cartella-dei-render> <cartella-del-sito>

È quello che si vede senza JavaScript, con il movimento ridotto e nelle anteprime dei social.
Scrive `manifesto.jpg` (orizzontale) e `manifesto-alto.jpg` (verticale, per i telefoni).
"""
import json
import os
import sys

import numpy as np
from PIL import Image

MARGINE = 20                     # righe in più sopra e sotto ogni fascia (vedi produci.py)
OMBRA = (3, 8, 26)               # lo stesso blu notte della luce nel lettore (apertura.css)
TAGLI = {
    "manifesto.jpg": (1920, 1200, 1920, 1200),          # larghezza e altezza prese dalla striscia, poi misura finale
    "manifesto-alto.jpg": (1300, 1900, 1040, 1520),
}


def tessuto_con_logo(src, dati):
    """Rimette insieme le fasce attorno al logo e ci posa sopra l'ultimo passo del ricamo."""
    st, ric = dati["striscia"], dati["ricamo"]
    intera = Image.new("RGB", (st["larghezza"], st["altezza"]))
    for i in range(st["fasce"]):
        f = Image.open(os.path.join(src, "striscia-%02d.png" % i)).convert("RGB")
        intera.paste(f.crop((0, MARGINE, f.size[0], f.size[1] - MARGINE)), (0, i * st["fascia"]))
    logo = Image.open(os.path.join(src, "ricamo-%02d.png" % (ric["passi"] - 1))).convert("RGB")
    x, riga = ric["x"], ric["riga"]
    resto = riga - int(riga)
    if resto:                    # il ricamo cade a metà pixel: lo si sposta di quel tanto prima di posarlo
        logo = logo.transform(logo.size, Image.AFFINE, (1, 0, 0, 0, 1, -resto), Image.BICUBIC)
        logo = logo.crop((0, 1, logo.size[0], logo.size[1] - 1))
        riga = int(riga) + 1
    intera.paste(logo, (int(round(x)), int(riga)))
    return intera


def luce(img):
    """La pozza di luce del lettore: chiara al centro, blu notte verso i bordi."""
    a = np.asarray(img, np.float32)
    h, w, _ = a.shape
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    r = np.hypot(xx - w / 2, yy - h / 2) / np.hypot(w / 2, h / 2)
    alfa = np.interp(r, [0.0, 0.24, 0.52, 0.86, 1.0], [0.0, 0.0, 0.34, 0.68, 0.74])[..., None]
    return Image.fromarray(np.clip(a * (1 - alfa) + np.array(OMBRA, np.float32) * alfa, 0, 255).astype(np.uint8))


def main(src, dst):
    dati = json.load(open(os.path.join(src, "film.json"), encoding="utf8"))
    intera = tessuto_con_logo(src, dati)
    cx, cy = dati["ricamo"]["centro"]
    for nome, (larg, alt, larg_fin, alt_fin) in TAGLI.items():
        x0, y0 = int(round(cx - larg / 2)), int(round(cy - alt / 2))
        pezzo = intera.crop((x0, y0, x0 + larg, y0 + alt)).resize((larg_fin, alt_fin), Image.LANCZOS)
        luce(pezzo).save(os.path.join(dst, nome), "JPEG", quality=84, optimize=True, progressive=True)
        print(nome, larg_fin, "x", alt_fin, "%.0f kB" % (os.path.getsize(os.path.join(dst, nome)) / 1000))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
