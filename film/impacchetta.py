"""Trasforma i fotogrammi calcolati in file leggeri per il sito.

    python film/impacchetta.py <cartella-dei-render> <cartella-del-sito>

Legge i PNG prodotti da `produci.py` e scrive WebP più `film.json`. Si può rilanciare quando
arrivano nuovi fotogrammi: rifà solo quelli che mancano o sono cambiati.
"""
import json
import os
import sys

import numpy as np
from PIL import Image

MARGINE = 20            # righe in più sopra e sotto ogni fascia (vedi produci.py)
# Ritagli dell'apertura, in pixel del fotogramma quadrato da 1280:
RITAGLI = {
    "largo": (0, 140, 1280, 1140),      # schermi orizzontali: 1280 x 1000, l'ago finisce a 612 px dall'alto
    "alto": (160, 0, 1120, 1280),       # schermi verticali: 960 x 1280
}


def piu_recente(src, dst):
    return not os.path.exists(dst) or os.path.getmtime(src) > os.path.getmtime(dst)


def salva(img, percorso, qualita):
    img.save(percorso, "WEBP", quality=qualita, method=6)


def sfuma_bordi(img, larghezza=36):
    """Rende trasparenti i bordi sinistro e destro, così la colonna si fonde con il tessuto sotto."""
    a = np.asarray(img.convert("RGB"), np.uint8)
    h, w, _ = a.shape
    rampa = np.clip(np.minimum(np.arange(w), w - 1 - np.arange(w)) / float(larghezza), 0, 1)
    rampa = rampa * rampa * (3 - 2 * rampa)
    alfa = np.broadcast_to((rampa * 255).astype(np.uint8)[None, :], (h, w))
    return Image.fromarray(np.dstack([a, alfa]), "RGBA")


def main(src, dst):
    os.makedirs(dst, exist_ok=True)
    dati = json.load(open(os.path.join(src, "film.json"), encoding="utf8"))
    fatti = {"apertura": [], "striscia": [], "colonna": [], "macchina": [], "ricamo": []}

    for i in range(dati["apertura"]["fotogrammi"]):
        p = os.path.join(src, "apertura-%03d.png" % i)
        if not os.path.exists(p):
            continue
        fatti["apertura"].append(i)
        img = None
        for nome, box in RITAGLI.items():
            out = os.path.join(dst, "ap-%s-%03d.webp" % (nome, i))
            if piu_recente(p, out):
                img = img or Image.open(p).convert("RGB")
                lato = img.size[0]
                f = lato / 1280.0
                salva(img.crop(tuple(int(round(v * f)) for v in box)), out, 74)

    for i in range(dati["striscia"]["fasce"]):
        for nome, sigla, q in (("striscia", "str", 80), ("colonna", "col", 82)):
            p = os.path.join(src, "%s-%02d.png" % (nome, i))
            if not os.path.exists(p):
                continue
            fatti[nome].append(i)
            out = os.path.join(dst, "%s-%d.webp" % (sigla, i))
            if piu_recente(p, out):
                img = Image.open(p).convert("RGB")
                img = img.crop((0, MARGINE, img.size[0], img.size[1] - MARGINE))
                salva(sfuma_bordi(img) if nome == "colonna" else img, out, q)

    for j in range(dati["macchina"]["fasi"]):
        p = os.path.join(src, "macchina-%d.png" % j)
        if os.path.exists(p):
            fatti["macchina"].append(j)
            out = os.path.join(dst, "mac-%d.webp" % j)
            if piu_recente(p, out):
                salva(Image.open(p).convert("RGBA"), out, 84)

    for k in range(dati["ricamo"]["passi"]):
        p = os.path.join(src, "ricamo-%02d.png" % k)
        if os.path.exists(p):
            fatti["ricamo"].append(k)
            out = os.path.join(dst, "ric-%02d.webp" % k)
            if piu_recente(p, out):
                salva(Image.open(p).convert("RGB"), out, 80)

    dati["pronti"] = fatti
    dati["ritagli"] = {n: {"x": b[0], "y": b[1], "larghezza": b[2] - b[0], "altezza": b[3] - b[1]} for n, b in RITAGLI.items()}
    json.dump(dati, open(os.path.join(dst, "film.json"), "w", encoding="utf8"), separators=(",", ":"))
    peso = sum(os.path.getsize(os.path.join(dst, f)) for f in os.listdir(dst))
    print("pronti:", {k: len(v) for k, v in fatti.items()}, "| peso totale: %.1f MB" % (peso / 1e6))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
