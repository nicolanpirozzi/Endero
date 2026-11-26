"""Controlla i campioni ripetibili dei tessuti (public/camicia/stoffe/) contro i ritagli veri delle cartelle colori.

    <venv>/bin/python -I camicia/opzioni/controlla_stoffe.py <cartella di lavoro dei tessuti> public/camicia [--foglio <cartella>]

Per ogni tessuto ricostruisce il ritaglio ripetendo il suo campione (con i centimetri scritti in trame.json) e lo
confronta con il ritaglio vero ALLA SCALA A CUI SI VEDE SULLA CAMICIA (30 punti per centimetro: la camicia ingrandita
due volte), non a quella della cartella: lì un passo sbagliato di poco non si nota, sulla camicia il disegno sparisce.
Dice quali tessuti hanno:
  - il disegno perso (righe o quadretti che nel campione non ci sono più, o sono sbiaditi), anche in un verso solo;
  - un disegno che nel ritaglio non c'è (inventato dalla media);
  - un disegno diverso (il campione ripetuto non somiglia al ritaglio);
  - il colore medio cambiato;
  - una tinta unita con macchie lente, che ripetute fanno una quadrettatura sulla camicia.
Esce con 1 se ce n'è almeno uno. Nato dalla revisione del 2026-11-26: i fogli dei campioni guardati a occhio non
bastavano (righe larghe diventate tinta unita, finestrati senza le righe orizzontali, uniti a quadrettoni).
"""
import argparse
import json
import os
import sys

import cv2
import numpy as np

AL_CM = 2400 / 21.0          # punti del ritaglio per centimetro
SCALA = 30.0                 # punti per centimetro a cui si confronta: la camicia ingrandita due volte


def ricostruito(tessera, cm, specchio, h, w, in_piu=0):
    """Il campione ripetuto sull'area del ritaglio (h x w punti della cartella), più `in_piu` punti per lato."""
    th, tw = tessera.shape[:2]
    y, x = np.mgrid[-in_piu:h + in_piu, -in_piu:w + in_piu].astype(np.float64)
    u = x / AL_CM / cm[0]; v = y / AL_CM / cm[1]
    if specchio:
        u = np.abs(((u + 1) % 2) - 1); v = np.abs(((v + 1) % 2) - 1)
        mx = np.clip(u * tw - 0.5, 0, tw - 1).astype(np.float32); my = np.clip(v * th - 0.5, 0, th - 1).astype(np.float32)
        return cv2.remap(tessera, mx, my, cv2.INTER_LINEAR)
    grande = np.pad(tessera, ((0, 1), (0, 1), (0, 0)), mode='wrap')
    return cv2.remap(grande, ((u % 1.0) * tw).astype(np.float32), ((v % 1.0) * th).astype(np.float32), cv2.INTER_LINEAR)


def piccola(im, fattore):
    """Come si vede sulla camicia: più piccola, con la media dei punti che finiscono in uno."""
    h, w = im.shape[:2]
    return cv2.resize(im, (max(2, int(round(w * fattore))), max(2, int(round(h * fattore)))), interpolation=cv2.INTER_AREA)


def girata(im, gradi):
    """Il ritaglio girato di qualche grado intorno al centro (i bordi presi a specchio)."""
    h, w = im.shape[:2]
    M = cv2.getRotationMatrix2D(((w - 1) / 2, (h - 1) / 2), gradi, 1.0)
    return cv2.warpAffine(im, M, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)


def controlla(ritaglio, tessera, cm, specchio, disegno, guadagno):
    im = cv2.imread(ritaglio, cv2.IMREAD_COLOR).astype(np.float32)
    h, w = im.shape[:2]
    media = im.reshape(-1, 3).mean(0)
    piana = im / np.maximum(cv2.GaussianBlur(im, (0, 0), min(h, w) / 2.2), 1) * media
    # Il tessuto sulla cartella non è mai dritto del tutto, e il campione sì (è raddrizzato): prima di confrontarli si
    # gira il ritaglio dell'angolo con cui i suoi profili (le righe, le file di un quadretto) sono più netti
    if disegno != 'unito':
        grigio = cv2.GaussianBlur(piana.mean(axis=2), (0, 0), 1.5)
        m = int(0.12 * max(h, w) / 2) + 2
        nitidezza = lambda a: (lambda q: float(q[m:h - m, m:w - m].mean(axis=0).std() + q[m:h - m, m:w - m].mean(axis=1).std()))(girata(grigio, a))
        angoli = np.arange(-7, 7.01, 0.5)
        a0 = float(angoli[int(np.argmax([nitidezza(a) for a in angoli]))])
        fini = np.arange(a0 - 0.4, a0 + 0.41, 0.1)
        angolo = float(fini[int(np.argmax([nitidezza(a) for a in fini]))])
        if abs(angolo) > 0.05:
            piana = girata(piana, angolo)
    t = tessera.astype(np.float32) / guadagno
    # la scala del confronto: quella della camicia, ma mai meno di otto punti per passo (un disegno di un millimetro,
    # rimpicciolito a 30 punti per centimetro, fa un'onda con la griglia dei punti che non c'entra con il tessuto)
    passo_min = min(cm) if disegno != 'righe' else cm[0]
    f = min(1.0, max(SCALA, 8.0 / max(passo_min, 1e-3)) / AL_CM)
    guai, numeri = [], {}
    if disegno != 'unito':
        numeri['angolo'] = round(angolo, 1)
    # il disegno alla scala della camicia
    vero = piccola(piana, f).mean(axis=2)
    # (il campione può cominciare in un altro punto del disegno: lo si cerca spostato fino a un passo intero)
    in_piu = int(min(np.ceil((cm[0] if disegno == 'righe' else max(cm)) * AL_CM), 260))
    rif = piccola(ricostruito(t, cm, specchio, h, w, in_piu), f).mean(axis=2)
    rifatto = ricostruito(t, cm, specchio, h, w)
    centro = piccola(rifatto, f).mean(axis=2)
    # il colore medio (sulla stessa area del ritaglio: un campione di righe larghe, da solo, ha un'altra media)
    dc = float(np.abs(rifatto.reshape(-1, 3).mean(0) - media).max())
    numeri['colore'] = round(dc, 1)
    if dc > 8:
        guai.append(f'colore medio cambiato di {dc:.0f} livelli')
    sv, st = float(vero.std()), float(centro.std())
    numeri['contrasto'] = [round(sv, 1), round(st, 1)]
    if disegno != 'unito':
        if sv >= 2.5 and st < 0.55 * sv:
            guai.append(f'disegno perso (contrasto sulla camicia {sv:.1f} nel ritaglio, {st:.1f} nel campione)')
        if st > 1.8 * sv + 2:
            guai.append(f'disegno che nel ritaglio non c\'è (contrasto {sv:.1f} nel ritaglio, {st:.1f} nel campione)')
        # le linee in un verso solo (un finestrato che perde le righe orizzontali resta contrastato: va guardato per verso)
        for asse, nome in ((0, 'verticali'), (1, 'orizzontali')):
            pv, pt = float(vero.mean(axis=asse).std()), float(centro.mean(axis=asse).std())
            numeri[nome] = [round(pv, 1), round(pt, 1)]
            # (un rigato è fatto di sole righe per scelta: le fiammature del lino, di traverso, non si tengono)
            if pv >= 5 and pt < 0.5 * pv and not (disegno == 'righe' and nome == 'orizzontali'):
                guai.append(f'linee {nome} perse ({pv:.1f} nel ritaglio, {pt:.1f} nel campione)')
        if sv >= 3 and st >= 0.55 * sv:
            a = (vero - vero.mean()).astype(np.float32); b = (rif - rif.mean()).astype(np.float32)
            if b.shape[0] >= a.shape[0] and b.shape[1] >= a.shape[1]:
                quanto = float(cv2.matchTemplate(b, a, cv2.TM_CCOEFF_NORMED).max())
                numeri['somiglia'] = round(quanto, 2)
                if quanto < 0.5:
                    guai.append(f'disegno diverso dal ritaglio (somiglianza {quanto:.2f})')
    else:
        # Una tinta unita: niente che, ripetuto ogni centimetro o due, si veda come una quadrettatura. La grana fine
        # del filo va bene (sulla camicia è un punto); le macchie più larghe di un millimetro e mezzo no, a meno che
        # non siano un'armatura vera che si ripete da sé (un campione piccolo: spigato, oxford).
        macchie = float(cv2.GaussianBlur(rifatto.mean(axis=2), (0, 0), 0.075 * AL_CM).std())
        numeri['macchie'] = round(macchie, 2)
        if min(cm) >= 0.5 and macchie > 1.2:
            guai.append(f'macchie che si ripetono ({macchie:.1f} livelli su un campione di {max(cm):.1f} cm)')
        if min(cm) < 0.5 and sv >= 2.5 and st > 1.6 * sv + 2:
            guai.append(f'armatura più marcata che nel ritaglio (contrasto {sv:.1f} nel ritaglio, {st:.1f} nel campione)')
    return guai, numeri


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('tessuti_lavoro'); ap.add_argument('uscita'); ap.add_argument('--foglio', default='')
    ap.add_argument('--solo', default='', help='solo questi tessuti (id separati da virgole)')
    a = ap.parse_args()
    T = json.load(open(os.path.join(a.uscita, 'opzioni', 'trame.json')))
    elenco = json.load(open(os.path.join(a.uscita, '..', '..', 'contenuti', 'it', 'tessuti.json')))['tessuti']
    solo = set(filter(None, a.solo.split(',')))
    male = []
    for x in elenco:
        tid = x['id']
        if solo and tid not in solo:
            continue
        ritaglio = os.path.join(a.tessuti_lavoro, 'ritagli', f'{tid[1:3]}-{tid[3:5]}.png')
        tessera = cv2.imread(os.path.join(a.uscita, 'stoffe', tid + '.webp'), cv2.IMREAD_COLOR)
        voce = T['tessuti'].get(tid)
        if tessera is None or voce is None or not os.path.exists(ritaglio):
            male.append((x, ['manca il campione, la sua voce in trame.json o il ritaglio'], {})); continue
        guai, numeri = controlla(ritaglio, tessera, voce[:2], bool(voce[2]), x['disegno'], T.get('guadagno', 1.0))
        if guai or solo:
            male.append((x, guai, numeri))
    for x, guai, numeri in male:
        print(f"{x['id']} {x['nome']} [{x['disegno']}] {T['tessuti'].get(x['id'])}: {'; '.join(guai) or 'a posto'} {json.dumps(numeri)}")
    quanti = sum(1 for _, g, _ in male if g)
    print(f"{len(elenco) if not solo else len(male)} tessuti controllati, {quanti} da guardare")
    if a.foglio and male:
        # accanto a ogni ritaglio, il campione ripetuto sulla stessa area; sotto, tutti e due come si vedono sulla camicia
        os.makedirs(a.foglio, exist_ok=True)
        lato, per_foglio = 150, 40
        for k in range(0, len(male), per_foglio):
            gruppo = male[k:k + per_foglio]
            tela = np.full((((len(gruppo) + 4) // 5) * (lato * 2 + 26), 5 * (2 * lato + 16), 3), 255, np.uint8)
            for i, (x, guai, numeri) in enumerate(gruppo):
                tid = x['id']
                rit = cv2.imread(os.path.join(a.tessuti_lavoro, 'ritagli', f'{tid[1:3]}-{tid[3:5]}.png'))
                tessera = cv2.imread(os.path.join(a.uscita, 'stoffe', tid + '.webp'))
                voce = T['tessuti'].get(tid)
                if rit is None or tessera is None or voce is None:
                    continue
                h, w = rit.shape[:2]
                rif = np.clip(ricostruito(tessera.astype(np.float32), voce[:2], bool(voce[2]), h, w), 0, 255).astype(np.uint8)
                r, c = divmod(i, 5)
                ox, oy = c * (2 * lato + 16), r * (lato * 2 + 26)
                s = lato / max(h, w)
                per = lambda im: cv2.resize(im, (int(w * s), int(h * s)), interpolation=cv2.INTER_AREA)
                tela[oy:oy + int(h * s), ox:ox + int(w * s)] = per(rit)
                tela[oy:oy + int(h * s), ox + lato + 4:ox + lato + 4 + int(w * s)] = per(rif)
                # come sulla camicia (30 punti per centimetro, o di più se il passo è piccolo), ingrandito senza sfumare
                passo_min = min(voce[:2]) if x['disegno'] != 'righe' else voce[0]
                f = min(1.0, max(SCALA, 8.0 / max(passo_min, 1e-3)) / AL_CM)
                for j, im in enumerate((rit, rif)):
                    p = piccola(im.astype(np.float32), f)
                    g = cv2.resize(np.clip(p, 0, 255).astype(np.uint8), (int(w * s), int(h * s)), interpolation=cv2.INTER_NEAREST)
                    tela[oy + lato:oy + lato + g.shape[0], ox + j * (lato + 4):ox + j * (lato + 4) + g.shape[1]] = g
                cv2.putText(tela, f"{tid} {x['disegno'][:5]} {(guai[0] if guai else 'a posto')[:34]}", (ox, oy + 2 * lato + 14), cv2.FONT_HERSHEY_SIMPLEX, 0.34, (0, 0, 0), 1, cv2.LINE_AA)
            cv2.imwrite(os.path.join(a.foglio, f'da-guardare-{k // per_foglio + 1:02d}.jpg'), tela, [cv2.IMWRITE_JPEG_QUALITY, 88])
    sys.exit(1 if quanti else 0)


if __name__ == '__main__':
    main()
