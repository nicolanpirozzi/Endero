"""Le foto vere di Endero, dal file della macchina fotografica (10-25 MB l'una) ai file leggeri del sito.

    python3 tools/comprimi-foto.py artigianato <cartella con gli originali>
    python3 tools/comprimi-foto.py collezione  <cartella con gli originali>
    python3 tools/comprimi-foto.py registro    [cartella con gli originali della collezione]

Gli originali non stanno nel repository: sono sul Drive del proprietario, nelle cartelle "Endero / Foto Contesto"
(artigianato) e "Endero / Foto da caricare" (collezione).

ARTIGIANATO. Ogni foto esce in due ritagli, perché sul sito riempie riquadri di forma diversa:
  -o   orizzontale, tre di base per due d'altezza: schermi larghi e pagina "Chi siamo"
  -v   verticale, due di base per tre d'altezza: il telefono tenuto in piedi
e ogni ritaglio in più grandezze e in due formati (AVIF, più leggero, e WebP per i browser che non lo leggono).
Per aggiungere una foto: una riga in ARTIGIANATO (nome del file originale, nome sul sito, i due ritagli in punti
dell'originale: sinistra, alto, destra, basso) e l'immagine in contenuti/it/chi-siamo.json.

COLLEZIONE. L'elenco sta in contenuti/it/collezione.json, voce "look": per ogni foto il nome nuovo ("file"), il nome
del file com'era ("originale"), il tipo, il testo che la descrive. Le foto sono verticali e restano intere, nella
loro forma (due per tre quelle del servizio, quattro per cinque quelle prese da Instagram): -v in tre grandezze,
AVIF per tutte e WebP fino a 800 punti (chi non legge l'AVIF è raro, e si accontenta). Chi ha anche "orizzontale"
(un riquadro tre per due, in punti dell'originale) esce anche in -o, per le aperture e gli ingressi.
Per aggiungere una foto: una voce in "look", poi questo comando e `registro`.

REGISTRO. Riscrive docs/registro-foto.md: per ogni foto il nome nuovo, da quale file viene, le misure, quanto pesava
e quanto pesa sul sito, e in quali pagine sta. Con la cartella degli originali aggiunge misure e peso di partenza.

In ogni cartella scrive anche foto.json, con le grandezze di ogni foto: lo legge il build.
"""
import json
import os
import sys

from PIL import Image, ImageOps

Image.MAX_IMAGE_PIXELS = None
RADICE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
FOTO = os.path.join(RADICE, 'public', 'foto')
CONTENUTI = os.path.join(RADICE, 'contenuti', 'it')

LARGHEZZE = {'o': (960, 1600, 2400), 'v': (640, 1080)}
# file originale, nome sul sito, ritaglio orizzontale (3:2), ritaglio verticale (2:3)
ARTIGIANATO = [
    ('_MAT9454.jpg', 'coppole', (0, 0, 5881, 3921), (457, 0, 3071, 3921)),         # in verticale: l'uomo col gilet
    ('_MAT0232.jpeg', 'cappello', (0, 150, 4000, 2817), (0, 0, 4000, 6000)),        # in orizzontale: dal cappello al papillon
    ('_MAT9270.jpg', 'bottone-e', (0, 1487, 4000, 4154), (0, 0, 4000, 6000)),
    ('_MAT9578.jpeg', 'bottoni-polso', (0, 1850, 4000, 4517), (0, 0, 4000, 6000)),
    ('_MAT9734.jpg', 'ricamo', (0, 1727, 4000, 4394), (0, 0, 4000, 6000)),
    ('_MAT9926.jpg', 'maglia', (0, 2000, 4000, 4667), (0, 0, 4000, 6000)),
]
# la collezione: le foto intere, in verticale; l'AVIF in tutte le grandezze, il WebP solo nelle prime due
COLLEZIONE = {'v': (400, 800, 1400), 'webp': 800, 'o': (960, 1600, 2400)}


def apri(percorso):
    return ImageOps.exif_transpose(Image.open(percorso)).convert('RGB')


def salva(pezzo, base, larghezze, webp_fino_a=None):
    """Le grandezze di un ritaglio, in AVIF e (fin dove serve) in WebP. Restituisce le larghezze scritte per formato."""
    forma = pezzo.width / pezzo.height
    larghe = [w for w in larghezze if w <= pezzo.width] or [pezzo.width]
    in_webp = [w for w in larghe if webp_fino_a is None or w <= webp_fino_a]
    for w in larghe:
        piccola = pezzo.resize((w, round(w / forma)), Image.LANCZOS)
        piccola.save(f'{base}-{w}.avif', quality=58, speed=4)
        if w in in_webp:
            piccola.save(f'{base}-{w}.webp', quality=78, method=6)
    return larghe, in_webp


def anteprima(pezzo, dove):
    """Per le anteprime dei link (social, WhatsApp) serve un JPEG 1200 x 630, dalla parte alta del ritaglio orizzontale."""
    alto = round(pezzo.width * 630 / 1200)
    su = round((pezzo.height - alto) * 0.2)
    pezzo.crop((0, su, pezzo.width, su + alto)).resize((1200, 630), Image.LANCZOS).save(dove, quality=84, optimize=True, progressive=True)


def pesi(uscita):
    elenco = {n: os.path.getsize(os.path.join(uscita, n)) for n in sorted(os.listdir(uscita))}
    print(f'in tutto {sum(elenco.values()) / 1e6:.1f} MB, {len(elenco)} file')
    return elenco


def artigianato(originali):
    uscita = os.path.join(FOTO, 'artigianato')
    os.makedirs(uscita, exist_ok=True)
    indice = {}
    for file, nome, orizzontale, verticale in ARTIGIANATO:
        foto = apri(os.path.join(originali, file))
        indice[nome] = {}
        for verso, riquadro in (('o', orizzontale), ('v', verticale)):
            pezzo = foto.crop(riquadro)
            forma = pezzo.width / pezzo.height
            assert abs(forma - (1.5 if verso == 'o' else 2 / 3)) < 0.01, (nome, verso, forma)
            indice[nome][verso], _ = salva(pezzo, os.path.join(uscita, f'{nome}-{verso}'), LARGHEZZE[verso])
        if nome == 'coppole':
            anteprima(foto.crop(orizzontale), os.path.join(uscita, f'{nome}-anteprima.jpg'))
        print(nome, indice[nome])
    with open(os.path.join(uscita, 'foto.json'), 'w') as f:
        json.dump(indice, f, separators=(',', ':'))
    pesi(uscita)


def collezione(originali):
    dati = json.load(open(os.path.join(CONTENUTI, 'collezione.json')))
    uscita = os.path.join(FOTO, 'collezione')
    os.makedirs(uscita, exist_ok=True)
    # si riparte da zero: una foto tolta dall'elenco non deve restare sul sito
    for vecchio in os.listdir(uscita):
        os.remove(os.path.join(uscita, vecchio))
    indice = {}
    apertura = (dati.get('eroe', {}).get('immagine') or {}).get('file')
    for k in dati['look']:
        foto = apri(os.path.join(originali, k['originale']))
        if k.get('ritaglio'):
            foto = foto.crop(k['ritaglio'])
        base = os.path.join(uscita, k['file'])
        v, v_webp = salva(foto, base + '-v', COLLEZIONE['v'], COLLEZIONE['webp'])
        voce = {'v': v, 'vWebp': v_webp, 'forma': round(foto.width / foto.height, 4)}
        if k.get('orizzontale'):
            pezzo = apri(os.path.join(originali, k['originale'])).crop(k['orizzontale'])
            assert abs(pezzo.width / pezzo.height - 1.5) < 0.01, (k['file'], pezzo.size)
            voce['o'], _ = salva(pezzo, base + '-o', COLLEZIONE['o'])
            if k['file'] == apertura:
                anteprima(pezzo, os.path.join(uscita, 'collezione-anteprima.jpg'))
        indice[k['file']] = voce
        print(k['file'], voce)
    with open(os.path.join(uscita, 'foto.json'), 'w') as f:
        json.dump(indice, f, separators=(',', ':'))
    pesi(uscita)


def registro(originali=None):
    """docs/registro-foto.md: ogni foto del sito, da dove viene e dove sta."""
    testi = {n: open(os.path.join(CONTENUTI, n)).read() for n in sorted(os.listdir(CONTENUTI)) if n.endswith('.json')}
    pagine = {'home.json': 'pagina iniziale', 'collezione.json': 'collezione', 'chi-siamo.json': 'chi siamo',
              'su-misura.json': 'su misura', 'diventa-rivenditore.json': 'diventa rivenditore', 'dove-siamo.json': 'dove siamo'}

    def dove_sta(nome, di_casa):
        altrove = [pagine.get(n, n) for n, t in testi.items() if n != di_casa and f'"{nome}"' in t]
        return ', '.join([pagine[di_casa]] + altrove)

    def sul_sito(cartella, nome):
        d = os.path.join(FOTO, cartella)
        return sum(os.path.getsize(os.path.join(d, f)) for f in os.listdir(d) if f.startswith(nome + '-') and f[len(nome) + 1] in 'ov')

    def di_partenza(file):
        p = originali and os.path.join(originali, file)
        if not p or not os.path.exists(p):
            return '', ''
        im = apri(p)
        return f'{im.width} × {im.height}', f'{os.path.getsize(p) / 1e6:.1f} MB'

    righe = ['# Registro delle foto', '',
             'Ogni foto del sito: il nome nuovo, il file da cui viene (com\'era sul Drive del proprietario), quanto pesava e quanto pesa',
             'sul sito in tutte le sue grandezze, e le pagine in cui sta. Lo riscrive `python3 tools/comprimi-foto.py registro <originali>`:',
             'non si corregge a mano.', '']
    dati = json.load(open(os.path.join(CONTENUTI, 'collezione.json')))
    nomi = {t['id']: t['nome'] for t in dati['lookbook']['tipi']}
    # su Drive il nome nuovo ce l'hanno solo i file rinominati: gli altri sono rimasti col nome di partenza
    vecchi = set(dati.get('drive', {}).get('nome_vecchio', []))
    righe += ['## Collezione', '', 'Cartella sul Drive: "Foto da caricare". Sul sito: `public/foto/collezione/`.', '']
    if vecchi:
        righe += [f"Su Drive hanno il nome nuovo {len(dati['look']) - len(vecchi)} foto su {len(dati['look'])}: le rinomine le ha fermate il proprietario il 2026-11-19.",
                  'La colonna "Su Drive" dice come si chiama oggi il file nella cartella.', '']
    righe += ['| N. | Nome nuovo | File originale | Su Drive | Tipo | Misure | Pesava | Sul sito | Dove sta |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- |']
    for i, k in enumerate(dati['look']):
        misure, peso = di_partenza(k['originale'])
        su_drive = 'nome di partenza' if k['file'] in vecchi else 'nome nuovo'
        righe.append(f"| {i + 1} | `{k['file']}` | `{k['originale']}` | {su_drive} | {nomi[k['tipo']]} | {misure} | {peso} | {sul_sito('collezione', k['file']) // 1024} KB | {dove_sta(k['file'], 'collezione.json')} |")
    for titolo, voce in (('Doppioni, rimasti su Drive', 'doppioni'), ('Video', 'video')):
        if dati.get('fuori', {}).get(voce):
            righe += ['', f'### {titolo}', '', '| File su Drive | Nome proposto | Sul sito | Nota |', '| --- | --- | --- | --- |']
            righe += [f"| `{d['originale']}` | {'`' + d['proposto'] + '`' if d.get('proposto') else 'da togliere'} | {d.get('sul_sito', 'no')} | {d['nota']} |" for d in dati['fuori'][voce]]
    righe += ['', '## Chi siamo (cultura e artigianato)', '', 'Cartella sul Drive: "Foto Contesto". Sul sito: `public/foto/artigianato/`.', '',
              '| Nome nuovo | File originale | Sul sito | Dove sta |', '| --- | --- | --- | --- |']
    for file, nome, _, _ in ARTIGIANATO:
        righe.append(f"| `{nome}` | `{file}` | {sul_sito('artigianato', nome) // 1024} KB | {dove_sta(nome, 'chi-siamo.json')} |")
    with open(os.path.join(RADICE, 'docs', 'registro-foto.md'), 'w') as f:
        f.write('\n'.join(righe) + '\n')
    print(f"registro scritto: {len(dati['look'])} foto della collezione, {len(ARTIGIANATO)} di cultura e artigianato")


if __name__ == '__main__':
    cosa = sys.argv[1] if len(sys.argv) > 1 else ''
    if cosa == 'artigianato' and len(sys.argv) == 3:
        artigianato(sys.argv[2])
    elif cosa == 'collezione' and len(sys.argv) == 3:
        collezione(sys.argv[2])
    elif cosa == 'registro':
        registro(sys.argv[2] if len(sys.argv) > 2 else None)
    else:
        sys.exit(__doc__)
