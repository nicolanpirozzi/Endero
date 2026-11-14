"""Finitura fotografica dei fotogrammi: alone sulle alte luci, vignettatura, grana.

    python film/finitura.py ingresso.png uscita.jpg [--grana 2.0] [--vignetta 0.16] [--seme 1]

La grana usa un seme: con lo stesso seme due fotogrammi hanno la stessa grana (utile per i fermi immagine),
con semi diversi la grana cambia da un fotogramma all'altro come in una ripresa vera.
"""
import argparse

import numpy as np
from PIL import Image, ImageFilter


def finisci(img, grana=2.0, vignetta=0.16, alone=0.10, seme=1, luce=None):
    """`luce` = (x, y, raggio, forza): una pozza di luce centrata in (x, y), in frazioni dell'immagine.
    Fuori dal raggio l'immagine scurisce fino a `forza`. È ferma sullo schermo: nel sito la stessa
    sfumatura sta sopra il tessuto che scorre."""
    a = np.asarray(img.convert("RGB"), np.float32) / 255.0
    h, w, _ = a.shape
    if luce is not None:
        lx, ly, raggio, forza = luce
        yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
        d = np.hypot((xx / w - lx), (yy / h - ly) * h / w) / raggio
        cade = np.clip((d - 0.35) / 0.9, 0, 1)
        cade = cade * cade * (3 - 2 * cade)
        a = a * (1 - forza * cade)[..., None]
    # alone: le parti più luminose sbordano appena, come attraverso un obiettivo
    lum = a.max(axis=2)
    chiare = np.clip((lum - 0.82) / 0.18, 0, 1)[..., None] * a
    sfoc = np.asarray(Image.fromarray((chiare * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(w / 110)), np.float32) / 255.0
    a = 1 - (1 - a) * (1 - alone * 2.2 * sfoc)
    # vignettatura morbida verso gli angoli
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    r = np.hypot((x - w / 2) / (w / 2), (y - h / 2) / (h / 2)) / np.sqrt(2)
    a *= (1 - vignetta * np.clip(r, 0, 1) ** 2.2)[..., None]
    # grana fine, uguale sui tre canali, più visibile nei mezzi toni
    rng = np.random.default_rng(seme)
    g = rng.normal(0, grana / 255.0, (h, w)).astype(np.float32)
    g = np.asarray(Image.fromarray(((g * 4 + 0.5).clip(0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.55)), np.float32) / 255.0
    g = (g - 0.5) / 4 * 1.6
    peso = 0.45 + 0.55 * (1 - np.abs(a.mean(axis=2) * 2 - 1))
    a = a + (g * peso)[..., None]
    return Image.fromarray((np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("ingresso")
    ap.add_argument("uscita")
    ap.add_argument("--grana", type=float, default=2.0)
    ap.add_argument("--vignetta", type=float, default=0.16)
    ap.add_argument("--seme", type=int, default=1)
    ap.add_argument("--qualita", type=int, default=90)
    ap.add_argument("--luce", default=None, help="x,y,raggio,forza della pozza di luce, es. 0.5,0.64,0.55,0.5")
    a = ap.parse_args()
    luce = tuple(float(v) for v in a.luce.split(",")) if a.luce else None
    out = finisci(Image.open(a.ingresso), a.grana, a.vignetta, seme=a.seme, luce=luce)
    out.save(a.uscita, quality=a.qualita)
