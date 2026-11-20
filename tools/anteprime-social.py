#!/usr/bin/env python3
"""Le immagini di anteprima dei link: quelle che WhatsApp, Facebook, LinkedIn e Google mostrano quando qualcuno
condivide una pagina del sito. Una per pagina, JPEG 1200 x 630, in public/anteprime/.

    python3 -I tools/anteprime-social.py

Le ricava dalle immagini già compresse del sito (public/foto/, public/camicia/): non servono gli originali.
Ogni voce dice da quale file, e quanto in alto sta la fascia che si tiene (0 = in cima, 1 = in fondo): le foto
sono più alte dell'anteprima, e conta che i visi e i capi restino dentro.
La pagina iniziale, la collezione, chi siamo e dove siamo hanno già la loro (manifesto del film, e i file
"-anteprima.jpg" che scrive tools/comprimi-foto.py). L'indirizzo di ogni anteprima sta nei testi della pagina,
alla voce meta.immagine.
"""
import os

from PIL import Image

RADICE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
PUBBLICO = os.path.join(RADICE, 'public')
USCITA = os.path.join(PUBBLICO, 'anteprime')
LARGA, ALTA = 1200, 630

# nome dell'anteprima, immagine di partenza (dentro public/), quanto in alto sta la fascia
ANTEPRIME = [
    ('camicie-su-misura', 'foto/sede/presa-misure-o-2000.avif', 0.35),
    ('configuratore', 'camicia/ferma-2x.webp', 0.5),
    ('diventa-rivenditore', 'foto/sede/negozio-fronte-o-2000.avif', 0.4),
    ('collezione-maglieria', 'foto/collezione/maglieria-dolcevita-trecce-blu-notte-o-2400.avif', 0.3),
    ('collezione-giacche-e-cappotti', 'foto/collezione/giacche-cappotto-cammello-cappello-o-2400.avif', 0.1),
    ('collezione-abiti', 'foto/collezione/abiti-gilet-blu-notte-camicia-bianca-o-2400.avif', 0.3),
    ('collezione-felpe', 'foto/collezione/felpe-grigia-e-a-quadri-v-1400.avif', 0.22),
]


def main():
    os.makedirs(USCITA, exist_ok=True)
    for nome, partenza, alto in ANTEPRIME:
        foto = Image.open(os.path.join(PUBBLICO, partenza)).convert('RGB')
        # la fascia più larga possibile con la forma dell'anteprima
        larga = min(foto.width, round(foto.height * LARGA / ALTA))
        alta = round(larga * ALTA / LARGA)
        x = (foto.width - larga) // 2
        y = round((foto.height - alta) * alto)
        dove = os.path.join(USCITA, nome + '.jpg')
        foto.crop((x, y, x + larga, y + alta)).resize((LARGA, ALTA), Image.LANCZOS).save(dove, quality=84, optimize=True, progressive=True)
        print(f'{nome}.jpg  da {partenza} ({foto.width} x {foto.height})  {os.path.getsize(dove) // 1024} KB')


if __name__ == '__main__':
    main()
