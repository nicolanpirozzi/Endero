"""I campioni piccoli della scheda del su misura in pagina iniziale (home.json, porta_su_misura.scelte.campioni).

Dal ritaglio di ogni tessuto (public/camicia/tessuti/<id>.webp, 320 x 214) un quadrato al centro, 80 x 80, per i
cerchi da 26 punti della scheda (78 pixel veri sugli schermi a densità tripla; da 1 a 3 KB l'uno invece di 25).
Si rilancia quando cambiano i campioni scelti:

    python3 tools/campioni-scheda.py
"""
import json
from pathlib import Path

from PIL import Image

RADICE = Path(__file__).resolve().parent.parent
LATO = 80

ids = json.loads((RADICE / 'contenuti/it/home.json').read_text(encoding='utf-8'))['porta_su_misura']['scelte']['campioni']
uscita = RADICE / 'public/camicia/tessuti/mini'
uscita.mkdir(exist_ok=True)
for i in ids:
    im = Image.open(RADICE / f'public/camicia/tessuti/{i}.webp').convert('RGB')
    l, a = im.size
    q = min(l, a)
    im = im.crop(((l - q) // 2, (a - q) // 2, (l - q) // 2 + q, (a - q) // 2 + q)).resize((LATO, LATO), Image.LANCZOS)
    im.save(uscita / f'{i}.webp', 'WEBP', quality=82, method=6)
    print(i, (uscita / f'{i}.webp').stat().st_size, 'byte')
# i campioni che non sono più nella scheda si tolgono
for f in uscita.glob('*.webp'):
    if f.stem not in ids:
        f.unlink()
