"""La camicia del configuratore vista di dietro, e il giro che ce la porta.

Nel configuratore il cliente misura una camicia che gli sta bene, stesa sul tavolo; accanto a ogni misura una "i"
gli mostra sulla camicia dove si prende. Spalla e lunghezza dietro si prendono sul dietro: per quelle la camicia si
gira e la linea si disegna sul dietro. Qui si calcolano le immagini che servono, con la stessa scena delle immagini a
riposo (`camicia/film/scena.py`): stessa camera, stesse luci, stessa parete, stessa esposizione, stesso ripulitore.
La camicia gira intorno alla verticale del gancio (il perno): a riposo sta a RIPOSO, di dietro a RIPOSO + pi greco,
cioè girata dello stesso angolo di prima ma dall'altra parte. L'ombra sulla parete gira con lei, perché si calcola
tutta la scena. Una sola differenza dalla scena delle immagini a riposo: nel file comprato la gruccia buca il tessuto
dietro il collo, e di dietro si vedrebbe il legno; qui il tessuto si scosta di 2 mm (`scosta_dalla_gruccia`). Di
fronte cambia meno di un pixel, dentro il colletto.

Tre comandi. I primi due vogliono il Python con Blender (vedi CLAUDE.md, "Problemi già incontrati"), il terzo basta
python3 con numpy e Pillow, e ffmpeg:

    <venv>/bin/python camicia/guide/retro.py dietro <file .blend comprato> <cartella> [--campioni 96]
        dietro.png (1800 x 1000) e dietro-2x.png (3600 x 2000), l'immagine ferma di dietro, come ferma.png e ferma-2x.png

    <venv>/bin/python camicia/guide/retro.py giro <file .blend comprato> <cartella> [--fotogrammi 30] [--campioni 32]
        [--bordo 0.04 0.68] [--da 1 --a 28] [--intero]
        giro/0001.png … giro/0028.png, i fotogrammi del giro tra le due immagini ferme. Il primo (0000) e l'ultimo
        (0029) non si calcolano: sono ferma.png e dietro.png, così il film parte e arriva identico alle immagini ferme.
        Il giro accelera e frena piano (una curva "smoothstep" sul tempo). Con `--bordo` (fatto di norma) si calcola
        solo la fascia in cui camicia e ombra si muovono: fuori la parete non cambia, e `monta` ci mette l'immagine
        ferma. Con `--intero` si calcola il fotogramma intero (serve per controllare che la giunta non si veda).

    python3 camicia/guide/retro.py monta <cartella> <ferma.png> public/camicia/retro
        dietro.webp, dietro-2x.webp, dietro-telefono.webp, dietro-telefono-2x.webp, giro.mp4 (davanti → dietro),
        ritorno.mp4 (gli stessi fotogrammi al contrario) e retro.json per la pagina. `ferma.png` è l'immagine a riposo
        da cui sono nate le immagini del sito (`camicia/film/produci.py --scena ferma`). I fotogrammi finiti restano in
        <cartella>/montati/, per i controlli. Senza i fotogrammi del giro scrive solo le immagini ferme.

Ogni comando salta ciò che ha già fatto: se si interrompe, si rilancia. I file si scrivono con un nome provvisorio e
poi si rinominano, così non restano immagini a metà.
"""
import argparse
import json
import math
import os
import subprocess
import sys
import time

QUI = os.path.dirname(os.path.abspath(__file__))
FOTOGRAMMI = 30                  # il giro dura un secondo a 30 fotogrammi al secondo
AL_SECONDO = 30
BORDO = (0.04, 0.68)             # la fascia calcolata, in frazioni della larghezza: camicia, gruccia e ombra stanno
                                 # tra il 9 e il 56% in ogni momento del giro (controllato con --intero)
SFUMA = 40                       # pixel in cui la fascia calcolata sfuma nell'immagine ferma, come in film/monta.py
# Come film/monta.py: la fascia verticale del telefono sta intorno alla camicia, al 39,5% della larghezza.
CENTRO_CAMICIA = 0.395
QUALITA = 26                     # di ffmpeg (crf): più basso, più fedele e più pesante. 26 tiene il giro sotto i 600 KB
MARGINE = 0.002                  # quanto il tessuto deve stare fuori dalla gruccia (vedi scosta_dalla_gruccia)


def quanto_girata(k, quanti):
    """Di quanto è girata la camicia al fotogramma k, da 0 (davanti) a 1 (dietro): parte e arriva piano."""
    u = k / (quanti - 1)
    return u * u * (3 - 2 * u)


# ---------------------------------------------------------------------------------------------------- calcolo (Blender)

def prepara(file_blend, campioni, larga, alta, ritocca=True):
    sys.path.insert(0, os.path.join(QUI, '..', 'film'))
    import scena  # noqa: E402  (importa bpy)
    import bpy  # noqa: E402
    pezzi = scena.costruisci(file_blend, larga, alta, campioni)
    if ritocca:
        quanti, quanto = scosta_dalla_gruccia(bpy, pezzi)
        print(f'camicia scostata dalla gruccia: {quanti} punti, al massimo {quanto * 1000:.1f} mm', flush=True)
    return scena, bpy, pezzi


def scosta_dalla_gruccia(bpy, pezzi, margine=MARGINE, giri=12):
    """Nel file comprato la gruccia entra nel tessuto di un paio di millimetri, lungo le spalle e dietro il collo.
    Davanti non si vede (sta sotto il colletto); di dietro sì: tra colletto e carré spunta un triangolino di legno. Qui
    i punti della camicia più vicini di `margine` alla superficie della gruccia si scostano fino a quella distanza, e lo
    spostamento si sfuma sui punti intorno (tanti `giri` di media coi vicini), perché non resti uno scalino. Restituisce
    quanti punti si sono mossi di più di un decimo di millimetro e lo spostamento più grande, in metri."""
    import numpy as np
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree
    from scipy.sparse import coo_matrix
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    g = pezzi['gruccia'].evaluated_get(dg)
    me = g.to_mesh()
    albero = BVHTree.FromPolygons([g.matrix_world @ v.co for v in me.vertices], [tuple(f.vertices) for f in me.polygons])
    g.to_mesh_clear()
    camicia = pezzi['camicia']; dati = camicia.data
    n = len(dati.vertices)
    locali = np.empty(n * 3, np.float32); dati.vertices.foreach_get('co', locali)
    locali = locali.reshape(n, 3).astype(np.float64)
    Mw = np.array(camicia.matrix_world)
    mondo = locali @ Mw[:3, :3].T + Mw[:3, 3]
    serve, verso = np.zeros(n), np.zeros((n, 3))
    for i in range(n):
        dove, normale, _, lontano = albero.find_nearest(Vector(mondo[i]), 2 * margine)
        if dove is None:
            continue
        dentro = (Vector(mondo[i]) - dove).dot(normale) < 0       # dalla parte interna della superficie della gruccia
        distanza = -lontano if dentro else lontano
        if distanza < margine:
            serve[i], verso[i] = margine - distanza, normale[:]
    # lo spostamento si sfuma sui vicini (i pezzi del cartamodello non sono cuciti tra loro: ognuno si sfuma da sé),
    # ma ai punti troppo vicini resta almeno quello che serve
    lati = np.empty(len(dati.edges) * 2, np.int32); dati.edges.foreach_get('vertices', lati)
    lati = lati.reshape(-1, 2)
    vicini = coo_matrix((np.ones(2 * len(lati)), (np.r_[lati[:, 0], lati[:, 1]], np.r_[lati[:, 1], lati[:, 0]])), shape=(n, n)).tocsr()
    grado = np.maximum(np.asarray(vicini.sum(axis=1)).ravel(), 1)
    fissi = serve > 0
    sposta = serve[:, None] * verso
    for _ in range(giri):
        sposta = 0.5 * sposta + 0.5 * (vicini @ sposta) / grado[:, None]
        manca = serve[fissi] - (sposta[fissi] * verso[fissi]).sum(axis=1)
        sposta[fissi] += np.clip(manca, 0, None)[:, None] * verso[fissi]
    locali += sposta @ np.linalg.inv(Mw[:3, :3]).T
    dati.vertices.foreach_set('co', np.ascontiguousarray(locali, dtype=np.float32).ravel())
    dati.update()
    bpy.context.view_layer.update()
    misura = np.linalg.norm(sposta, axis=1)
    return int((misura > 1e-4).sum()), float(misura.max())


def gira(scena, bpy, pezzi, t):
    """Mette la camicia (con bottoni, gruccia e nastro, che pendono tutti dal perno) girata della frazione t di mezzo giro."""
    pezzi['perno'].rotation_euler = (0, 0, scena.RIPOSO + math.pi * t)
    bpy.context.view_layer.update()


def calcola(bpy, file):
    """Calcola il fotogramma in `file`, passando da un nome provvisorio."""
    sc = bpy.context.scene
    cartella, nome = os.path.split(file)
    sc.render.filepath = os.path.join(cartella, 'in-corso-' + nome)
    t = time.time()
    bpy.ops.render.render(write_still=True)
    os.replace(sc.render.filepath, file)
    return time.time() - t


def dietro(a):
    scena, bpy, pezzi = prepara(a.blend, a.campioni, a.larga, a.alta)
    sc = bpy.context.scene
    os.makedirs(a.uscita, exist_ok=True)
    gira(scena, bpy, pezzi, 1.0)
    for nome, volte in (('dietro.png', 1), ('dietro-2x.png', 2)):
        file = os.path.join(os.path.abspath(a.uscita), nome)
        if os.path.exists(file):
            continue
        sc.render.resolution_x, sc.render.resolution_y = a.larga * volte, a.alta * volte
        print(f'{nome} in {calcola(bpy, file):.0f} s', flush=True)


def giro(a):
    scena, bpy, pezzi = prepara(a.blend, a.campioni, a.larga, a.alta)
    sc = bpy.context.scene
    if not a.intero:
        sc.render.use_border = True; sc.render.use_crop_to_border = False
        sc.render.border_min_x, sc.render.border_max_x, sc.render.border_min_y, sc.render.border_max_y = a.bordo[0], a.bordo[1], 0.0, 1.0
        sc.render.film_transparent = True        # fuori dalla fascia l'immagine resta vuota: ci va quella ferma
        sc.render.image_settings.color_mode = 'RGBA'
    cartella = os.path.join(os.path.abspath(a.uscita), 'giro-intero' if a.intero else 'giro')
    os.makedirs(cartella, exist_ok=True)
    ultimo = a.fotogrammi - 2 if a.a is None else min(a.a, a.fotogrammi - 1)
    for k in range(max(a.da, 0), ultimo + 1, a.ogni):
        file = os.path.join(cartella, f'{k:04d}.png')
        if os.path.exists(file):
            continue
        t = quanto_girata(k, a.fotogrammi)
        gira(scena, bpy, pezzi, t)
        print(f'giro {k}/{a.fotogrammi - 1} (t = {t:.4f}, {math.degrees(math.pi * t):.1f}°) in {calcola(bpy, file):.0f} s', flush=True)


# ------------------------------------------------------------------------------------------------ montaggio (senza Blender)

def monta(a):
    from PIL import Image

    entrata, uscita = a.entrata, a.uscita
    os.makedirs(uscita, exist_ok=True)
    ferma = Image.open(a.ferma).convert('RGB')
    L, A = ferma.size
    largo_tel = int(A * 0.75) // 2 * 2
    x_tel = max(0, min(L - largo_tel, int(L * CENTRO_CAMICIA - largo_tel / 2) // 2 * 2))

    # le immagini ferme di dietro, con gli stessi codificatori e la stessa qualità di ferma*.webp (film/monta.py)
    dietro = Image.open(os.path.join(entrata, 'dietro.png')).convert('RGB')
    assert dietro.size == (L, A), f'dietro.png è {dietro.size}, attesa {(L, A)}'
    dietro.save(os.path.join(uscita, 'dietro.webp'), quality=95, method=6)
    dietro.crop((x_tel, 0, x_tel + largo_tel, A)).save(os.path.join(uscita, 'dietro-telefono.webp'), quality=95, method=6)
    doppia = os.path.join(entrata, 'dietro-2x.png')
    if os.path.exists(doppia):
        grande = Image.open(doppia).convert('RGB')
        assert grande.size == (L * 2, A * 2), f'dietro-2x.png è {grande.size}, attesa {(L * 2, A * 2)}'
        grande.save(os.path.join(uscita, 'dietro-2x.webp'), quality=90, method=6)
        grande.crop((x_tel * 2, 0, (x_tel + largo_tel) * 2, A * 2)).save(os.path.join(uscita, 'dietro-telefono-2x.webp'), quality=90, method=6)

    # il giro: primo fotogramma ferma.png, ultimo dietro.png, in mezzo quelli calcolati (nella fascia, sulla parete ferma).
    # Fuori dalla fascia la parete è quasi identica davanti e dietro (al massimo 2 livelli su 255: la luce che la camicia
    # rimanda sulla parete cambia appena girandola): lì si passa piano dall'una all'altra immagine ferma, al passo del giro.
    quanti = a.fotogrammi
    mancano = [k for k in range(1, quanti - 1) if not os.path.exists(os.path.join(entrata, 'giro', f'{k:04d}.png'))]
    if mancano:
        print(f'mancano i fotogrammi del giro {mancano}: per ora solo le immagini ferme (poi rilanciare `retro.py giro` e `monta`)')
    else:
        giro_e_ritorno(entrata, uscita, ferma, dietro, quanti, a.qualita)
    scrivi_json(uscita, L, A, quanti, x_tel, largo_tel)


def giro_e_ritorno(entrata, uscita, ferma, dietro, quanti, qualita):
    import numpy as np
    from PIL import Image

    L, A = ferma.size
    davanti, di_dietro = np.asarray(ferma).astype(np.float32), np.asarray(dietro).astype(np.float32)
    x = np.arange(L, dtype=np.float32)
    lavoro = os.path.join(entrata, 'montati')                # i fotogrammi finiti, tenuti per i controlli
    os.makedirs(lavoro, exist_ok=True)
    def scrivi(k, immagine):
        immagine.save(os.path.join(lavoro, f'{k:04d}.png'), compress_level=1)
    scrivi(0, ferma)
    for k in range(1, quanti - 1):
        im = Image.open(os.path.join(entrata, 'giro', f'{k:04d}.png'))
        if im.mode == 'RGBA':                             # calcolato solo nella fascia: il resto è la parete ferma
            t = quanto_girata(k, quanti)
            base = davanti * (1 - t) + di_dietro * t
            px = np.asarray(im).astype(np.float32)
            alfa = px[:, :, 3:4] / 255
            colonne = np.nonzero(alfa[:, :, 0].max(axis=0) > 0)[0]
            if len(colonne):                              # ai bordi della fascia si sfuma, perché non si veda la giunta
                if colonne[-1] < L - 1:
                    alfa = alfa * np.clip((colonne[-1] - x) / SFUMA, 0, 1)[None, :, None]
                if colonne[0] > 0:
                    alfa = alfa * np.clip((x - colonne[0]) / SFUMA, 0, 1)[None, :, None]
            im = Image.fromarray((px[:, :, :3] * alfa + base * (1 - alfa) + 0.5).astype(np.uint8))
        scrivi(k, im.convert('RGB'))
    scrivi(quanti - 1, dietro)
    # al contrario, per il ritorno
    for k in range(quanti):
        indietro = os.path.join(lavoro, f'r{quanti - 1 - k:04d}.png')
        if os.path.exists(indietro):
            os.remove(indietro)
        os.link(os.path.join(lavoro, f'{k:04d}.png'), indietro)
    codifica = ['-c:v', 'libx264', '-preset', 'veryslow', '-crf', str(qualita), '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart',
                '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'iec61966-2-1', '-color_range', 'tv',
                '-vf', f'scale={L // 2 * 2}:{A // 2 * 2}:out_color_matrix=bt709:out_range=tv']
    for nome, schema in (('giro.mp4', '%04d.png'), ('ritorno.mp4', 'r%04d.png')):
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(AL_SECONDO), '-i', os.path.join(lavoro, schema)]
                       + codifica + [os.path.join(uscita, nome)], check=True)


def scrivi_json(uscita, L, A, quanti, x_tel, largo_tel):
    file = {'dietro': 'dietro.webp', 'dietro-2x': 'dietro-2x.webp', 'dietro-telefono': 'dietro-telefono.webp',
            'dietro-telefono-2x': 'dietro-telefono-2x.webp', 'giro': 'giro.mp4', 'ritorno': 'ritorno.mp4'}
    file = {k: v for k, v in file.items() if os.path.exists(os.path.join(uscita, v))}
    dati = {'fotogramma': [L, A], 'fotogrammi': quanti, 'durata': round(quanti / AL_SECONDO, 4), 'al_secondo': AL_SECONDO,
            'telefono': {'x': x_tel, 'largo': largo_tel}, 'file': file}
    with open(os.path.join(uscita, 'retro.json'), 'w') as f:
        json.dump(dati, f, separators=(',', ':'))
    print(' · '.join(f'{n} {os.path.getsize(os.path.join(uscita, n)) // 1024} KB' for n in sorted(os.listdir(uscita))))


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    sotto = ap.add_subparsers(dest='cosa', required=True)
    for nome in ('dietro', 'giro'):
        p = sotto.add_parser(nome)
        p.add_argument('blend'); p.add_argument('uscita')
        p.add_argument('--larga', type=int, default=1800); p.add_argument('--alta', type=int, default=1000)
        p.add_argument('--campioni', type=int, default=96 if nome == 'dietro' else 32)
        if nome == 'giro':
            p.add_argument('--fotogrammi', type=int, default=FOTOGRAMMI)
            p.add_argument('--bordo', type=float, nargs=2, default=BORDO, metavar=('DA', 'A'))
            p.add_argument('--intero', action='store_true', help='calcola il fotogramma intero, per controllare la giunta')
            p.add_argument('--da', type=int, default=1); p.add_argument('--a', type=int, default=None, help='di norma il penultimo')
            p.add_argument('--ogni', type=int, default=1)
    p = sotto.add_parser('monta')
    p.add_argument('entrata'); p.add_argument('ferma'); p.add_argument('uscita')
    p.add_argument('--fotogrammi', type=int, default=FOTOGRAMMI); p.add_argument('--qualita', type=int, default=QUALITA)
    a = ap.parse_args()
    {'dietro': dietro, 'giro': giro, 'monta': monta}[a.cosa](a)


if __name__ == '__main__':
    main()
