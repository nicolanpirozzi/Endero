"""Le foto vere di Endero, dal file della macchina fotografica (10-25 MB l'una) ai file leggeri del sito.

    python3 tools/comprimi-foto.py <cartella con gli originali>

Gli originali non stanno nel repository: sono nella cartella "Endero / Foto Contesto" del Drive del proprietario.
Ogni foto esce in due ritagli, perché sul sito riempie riquadri di forma diversa:
  -o   orizzontale, tre di base per due d'altezza: schermi larghi e pagina "Cultura e artigianato"
  -v   verticale, due di base per tre d'altezza: il telefono tenuto in piedi
e ogni ritaglio in più grandezze e in due formati (AVIF, più leggero, e WebP per i browser che non lo leggono).
Scrive in public/foto/artigianato/ anche foto.json, con le grandezze di ogni foto: lo legge il build.

Per aggiungere una foto: una riga in FOTO (nome del file originale, nome sul sito, i due ritagli in punti
dell'originale: sinistra, alto, destra, basso) e l'immagine in contenuti/it/cultura-e-artigianato.json.
"""
import json
import os
import sys

from PIL import Image, ImageOps

Image.MAX_IMAGE_PIXELS = None
RADICE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
USCITA = os.path.join(RADICE, 'public', 'foto', 'artigianato')
LARGHEZZE = {'o': (960, 1600, 2400), 'v': (640, 1080)}
# file originale, nome sul sito, ritaglio orizzontale (3:2), ritaglio verticale (2:3)
FOTO = [
    ('_MAT9454.jpg', 'coppole', (0, 0, 5881, 3921), (457, 0, 3071, 3921)),         # in verticale: l'uomo col gilet
    ('_MAT0232.jpeg', 'cappello', (0, 150, 4000, 2817), (0, 0, 4000, 6000)),        # in orizzontale: dal cappello al papillon
    ('_MAT9270.jpg', 'bottone-e', (0, 1487, 4000, 4154), (0, 0, 4000, 6000)),
    ('_MAT9578.jpeg', 'bottoni-polso', (0, 1850, 4000, 4517), (0, 0, 4000, 6000)),
    ('_MAT9734.jpg', 'ricamo', (0, 1727, 4000, 4394), (0, 0, 4000, 6000)),
    ('_MAT9926.jpg', 'maglia', (0, 2000, 4000, 4667), (0, 0, 4000, 6000)),
]


def main():
    originali = sys.argv[1]
    os.makedirs(USCITA, exist_ok=True)
    indice = {}
    for file, nome, orizzontale, verticale in FOTO:
        foto = ImageOps.exif_transpose(Image.open(os.path.join(originali, file))).convert('RGB')
        indice[nome] = {}
        for verso, riquadro in (('o', orizzontale), ('v', verticale)):
            pezzo = foto.crop(riquadro)
            forma = pezzo.width / pezzo.height
            assert abs(forma - (1.5 if verso == 'o' else 2 / 3)) < 0.01, (nome, verso, forma)
            larghe = [w for w in LARGHEZZE[verso] if w <= pezzo.width]
            for w in larghe:
                piccola = pezzo.resize((w, round(w / forma)), Image.LANCZOS)
                base = os.path.join(USCITA, f'{nome}-{verso}-{w}')
                piccola.save(base + '.avif', quality=58, speed=4)
                piccola.save(base + '.webp', quality=78, method=6)
            indice[nome][verso] = larghe
        # per le anteprime dei link (social, WhatsApp) serve un JPEG 1200 x 630
        if nome == 'coppole':
            s, a, d, b = orizzontale
            alto = round((d - s) * 630 / 1200)
            foto.crop((s, a + round((b - a - alto) * 0.2), d, a + round((b - a - alto) * 0.2) + alto)).resize((1200, 630), Image.LANCZOS).save(
                os.path.join(USCITA, f'{nome}-anteprima.jpg'), quality=84, optimize=True, progressive=True)
        print(nome, indice[nome])
    with open(os.path.join(USCITA, 'foto.json'), 'w') as f:
        json.dump(indice, f, separators=(',', ':'))
    pesi = {n: os.path.getsize(os.path.join(USCITA, n)) for n in sorted(os.listdir(USCITA))}
    for n, p in pesi.items():
        print(f'  {n} {p // 1024} KB')
    print(f'in tutto {sum(pesi.values()) // 1024} KB, {len(pesi)} file')


if __name__ == '__main__':
    main()
