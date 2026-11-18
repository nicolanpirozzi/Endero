"""La camicia leggera: l'ombra della camicia sulla parete, come pezzo a sé.

Il proprietario, provata la camicia in diretta (camicia/viva/): "rendiamoci più semplice. Rendi il movimento molto più
leggero, la gruccia si muove. Non far muovere così tanto il tessuto perché sembra finto e poco naturale", e sul suo
computer andava a scatti. Qui il tessuto non si deforma più: la camicia è l'immagine di Blender ritagliata, che dondola
appena, tutta insieme, con gruccia e nastro. Perché dondoli davvero serve la sua ombra staccata dalla parete, e la
parete che c'è dietro: le calcola questo script. Le immagini con e senza la luce della finestra ci sono già
(camicia/viva/scatta.py); qui si aggiungono due viste della parete col sole pieno, senza le sbarre:

    <venv>/bin/python camicia/leggera/ombra.py <file .blend comprato> <cartella di lavoro di scatta.py> [--campioni 96]

  parete-piena.exr     la parete da sola, tutta al sole
  parete-sagoma.exr    la parete al sole con l'ombra della camicia (la camicia c'è, ma la camera non la vede)

Dal confronto tra le due esce l'ombra anche dove passano le sbarre e dietro la camicia (camicia/leggera/ritaglia.py).
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'film'))
import scena  # noqa: E402  (importa bpy)
import bpy  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('blend'); ap.add_argument('uscita')
    ap.add_argument('--campioni', type=int, default=96)
    a = ap.parse_args()
    p = scena.costruisci(a.blend, scena.LARGA, scena.ALTA, a.campioni)
    sc = bpy.context.scene
    sc.render.image_settings.file_format = 'OPEN_EXR'; sc.render.image_settings.color_depth = '32'
    sc.render.image_settings.color_mode = 'RGBA'
    sc.render.resolution_x, sc.render.resolution_y = scena.LARGA, scena.ALTA
    sc.render.film_transparent = False
    cose = [p['camicia'], p['bottoni'], p['gruccia'], p['nastro']]
    p['finestra'].hide_render = True                                   # niente sbarre: sole pieno su tutta la parete

    def scatta(nome):
        sc.render.filepath = os.path.join(os.path.abspath(a.uscita), nome + '.exr')
        if os.path.exists(sc.render.filepath):
            print(nome, 'c\'è già'); return
        bpy.ops.render.render(write_still=True)
        print(nome, 'fatta', flush=True)

    for o in cose:
        o.visible_camera = False
    scatta('parete-sagoma')
    for o in cose:
        o.hide_render = True
    scatta('parete-piena')
    print('fatto')


if __name__ == '__main__':
    main()
