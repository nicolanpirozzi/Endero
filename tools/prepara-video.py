#!/usr/bin/env python3
"""Prepara i video dell'apertura della pagina iniziale (la sezione con il titolo "Camicie e abbigliamento uomo").

  python3 -I tools/prepara-video.py <cartella con gli originali>

Gli originali stanno sul Drive del proprietario, cartella "Foto da caricare", e non entrano nel repository:

  snapgram.io_download-file-wyfj07vm.mp4   il reel dell'abito gessato blu, verticale: va sui telefoni
  IMG_3394.mov                             i due modelli a tavola, girato in verticale con il telefono:
                                           va su computer e tablet, dove se ne vede la fascia con il tavolo

Scelte del proprietario (2026-11-19): questi due video, "No audio", e per quello del tavolo "migliora colori e luci".
Scelte nostre: al reel si toglie il cartello finale con il logo (il video gira in tondo sotto il titolo, e il logo è
già in testata); il video del tavolo torna all'inizio con una dissolvenza, così il giro non si nota.

Scrive in public/video/: eroe-telefono.mp4, eroe-computer.mp4, eroe-computer-lento.mp4 (lo stesso a metà velocità,
per il confronto con ?video=lento) e, per ognuno dei due, un'immagine ferma in AVIF e WebP (il primo fotogramma
per il tavolo, l'abito intero per il reel).
Serve ffmpeg con zscale (per portare il video del telefono, girato in HDR, ai colori normali) e Pillow con AVIF.
"""
import os
import subprocess
import sys
import tempfile

from PIL import Image

RADICE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
USCITA = os.path.join(RADICE, 'public', 'video')

REEL = 'snapgram.io_download-file-wyfj07vm.mp4'
REEL_FINE = 15.9            # secondi: dopo comincia il cartello sfocato con il logo
REEL_FERMA = 13.4           # secondi: il fotogramma che fa da immagine ferma sui telefoni

TAVOLO = 'IMG_3394.mov'
# Del fotogramma verticale (1080 x 1920) si tiene la parte con i due modelli e il tavolo, tre per quattro: su uno
# schermo largo la pagina ne mostra la fascia centrale, su un tablet in piedi quasi tutta.
TAVOLO_RITAGLIO = 'crop=1080:1440:0:360'
# Dall'HDR dell'iPhone (HLG, BT.2020) ai colori normali, senza bruciare le luci.
DA_HDR = 'zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p'
# "Migliora colori e luci": un po' di contrasto (ombre più profonde, luci più vive), colori appena più pieni,
# ombre un filo più fredde perché il blu dei capi resti blu sotto la luce calda del locale; via la grana del telefono.
COLORI = "hqdn3d=1.2:1.2:3:3,curves=all='0/0 0.25/0.20 0.5/0.50 0.75/0.79 1/1',eq=saturation=1.08,colorbalance=rs=-0.03:bs=0.04:rh=0.02:bh=-0.02"
DISSOLVENZA = 0.5           # secondi in cui la fine del video sfuma nel suo inizio

H264 = ['-c:v', 'libx264', '-preset', 'slow', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
        '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-movflags', '+faststart', '-an']


def ffmpeg(*argomenti):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', *argomenti], check=True)


def durata(file):
    return float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file],
                                check=True, capture_output=True, text=True).stdout.strip())


def ferma(video, nome, secondo=0):
    """Un fotogramma fermo, per chi non vede il video (movimento ridotto, rete lenta) e mentre il video arriva."""
    with tempfile.TemporaryDirectory() as lavoro:
        png = os.path.join(lavoro, 'f.png')
        ffmpeg('-ss', str(secondo), '-i', video, '-frames:v', '1', png)
        im = Image.open(png).convert('RGB')
        im.save(os.path.join(USCITA, nome + '.avif'), quality=58, speed=4)
        im.save(os.path.join(USCITA, nome + '.webp'), quality=80, method=6)
        return im.size


def in_tondo(durata_tutta):
    """Il filtro che fa tornare il video al suo inizio: gli ultimi istanti sfumano nei primi."""
    d = DISSOLVENZA
    return (f'split[a][b];[a]trim=start={d},setpts=PTS-STARTPTS[corpo];[b]trim=end={d},setpts=PTS-STARTPTS[testa];'
            f'[corpo][testa]xfade=transition=fade:duration={d}:offset={durata_tutta - 2 * d:.3f}')


def main(originali):
    os.makedirs(USCITA, exist_ok=True)

    # il reel: già montato e con i suoi colori, si toglie solo l'audio e il cartello finale
    telefono = os.path.join(USCITA, 'eroe-telefono.mp4')
    # sui telefoni conta il peso: con questa qualità il reel scende a 2,6 MB e a occhio non cambia
    ffmpeg('-i', os.path.join(originali, REEL), '-t', str(REEL_FINE), '-vf', 'fps=30', *H264, '-preset', 'veryslow', '-crf', '30', telefono)
    # il primo fotogramma del reel è una mano mossa: per l'immagine ferma si prende l'abito intero, verso la fine
    print('eroe-telefono', ferma(telefono, 'eroe-telefono', REEL_FERMA), f'{os.path.getsize(telefono) / 1e6:.2f} MB', f'{durata(telefono):.1f} s')

    # il tavolo: prima a colori normali e corretto, senza perdita, poi le due velocità
    with tempfile.TemporaryDirectory() as lavoro:
        pulito = os.path.join(lavoro, 'pulito.mkv')
        ffmpeg('-i', os.path.join(originali, TAVOLO), '-vf', f'{TAVOLO_RITAGLIO},{DA_HDR},{COLORI}',
               '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '8', '-pix_fmt', 'yuv420p', '-an', pulito)
        tutta = durata(pulito)
        for nome, tempo, crf in (('eroe-computer', '', '25'), ('eroe-computer-lento', 'setpts=2*PTS,', '26')):
            lunga = tutta * (2 if tempo else 1)
            dove = os.path.join(USCITA, nome + '.mp4')
            # il video è girato a 60 fotogrammi al secondo: a velocità vera se ne tiene uno su due, a metà velocità tutti
            ffmpeg('-i', pulito, '-filter_complex', f'[0:v]{tempo}fps=30000/1001,{in_tondo(lunga)}', *H264, '-crf', crf, dove)
            print(nome, f'{os.path.getsize(dove) / 1e6:.2f} MB', f'{durata(dove):.1f} s')
        print('eroe-computer', ferma(os.path.join(USCITA, 'eroe-computer.mp4'), 'eroe-computer'))


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
