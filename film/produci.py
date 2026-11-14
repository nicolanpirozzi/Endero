"""Calcola i pezzi del film dell'apertura. Ogni comando salta i fotogrammi già presenti, così si può riprendere.

    python film/produci.py apertura --dir <cartella> [--da 0 --a 54]
    python film/produci.py striscia --dir <cartella>
    python film/produci.py colonna  --dir <cartella>
    python film/produci.py macchina --dir <cartella>
    python film/produci.py ricamo   --dir <cartella>
    python film/produci.py dati     --dir <cartella>

I pezzi:
- apertura: la ripresa iniziale, fotogramma per fotogramma. Primo piano sull'ago, poi la camera sale alla vista dall'alto.
- striscia: tutto il tessuto visto dall'alto, con la cucitura finita e le scritte ricamate, a fasce da ricomporre.
- colonna:  la fascia centrale dello stesso tessuto senza cucitura: nel sito copre la cucitura dove l'ago non è ancora passato.
- macchina: la testa in acciaio da sola, con la sua ombra, nelle fasi del ciclo dell'ago. Nel sito sta ferma sopra il tessuto che scorre.
- ricamo:   la zona del logo, da tessuto nudo a logo finito.
- dati:     misure e posizioni che servono al sito per ricomporre tutto.
"""
import argparse
import json
import math
import os
import sys
import time

import bpy  # noqa: F401  (per primo)
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import scena as S  # noqa: E402

TTF = os.path.join(S.QUI, "font", "archivo-largo-700.ttf")
SVG = os.path.join(S.RADICE, "brand", "logo", "endero-completo.svg")

# ------------------------------------------------------------------ misure sullo schermo
PXM = 12000.0                       # pixel per metro nella vista dall'alto (120 px per centimetro)
SIN, COS = math.sin(math.radians(S.ELEV)), math.cos(math.radians(S.ELEV))
STR_LARG = int(S.VISTA_LARG * PXM)  # 1920 px: i 16 cm inquadrati
FASCIA = 1000                       # altezza di una fascia della striscia
MARGINE = 20                        # righe in più sopra e sotto ogni fascia, tolte dopo: evitano le giunte
Y_ALTO = 0.075                      # y del tessuto alla prima riga della striscia
N_FASCE = 7
COLONNA = 0.10                      # mezza larghezza della colonna senza cucitura, in frazione della larghezza

FPC = 6                             # fotogrammi per ogni punto di cucitura
N_AP = 54                           # ultimo fotogramma dell'apertura (da 0 a 54 compresi)
AP_MACRO = 21                       # fino a qui la camera resta in primo piano, poi sale
LATO_AP = 1280                      # fotogrammi quadrati: si ritagliano in orizzontale o in verticale secondo lo schermo
AGO_QUADRO = 0.5875                 # altezza dell'ago nel fotogramma quadrato alla fine della salita

MAC_LARG, MAC_ALT = 960, 1740       # ritaglio della macchina in sovrimpressione
MAC_AGO = (288, 528)                # dove cade la punta dell'ago dentro quel ritaglio
MAC_S = 40.0                        # punto della cucitura in cui si riprende la macchina (tessuto senza scritte vicino)

RIC_LARG, RIC_ALT = 1296, 864       # ritaglio della zona del logo
N_RIC = 24                          # passi del ricamo (da 0 = tessuto nudo a 24 = logo finito)


def riga(y):
    """Riga della striscia a cui cade un punto del tessuto."""
    return (Y_ALTO - y) * PXM * SIN


def colonna_x(x):
    return STR_LARG / 2 + x * PXM


# ------------------------------------------------------------------ camera che sale
def camera_gru(sc, ym, t):
    """Dal primo piano (t = 0) alla vista dall'alto (t = 1), con una sola camera prospettica.

    Salendo la camera si allontana e stringe il campo: a t = 1 la prospettiva è quasi nulla
    e l'immagine coincide con la vista senza prospettiva usata per il tessuto che scorre.
    """
    cd = bpy.data.cameras.new("gru")
    cam = bpy.data.objects.new("gru", cd)
    sc.collection.objects.link(cam)
    sc.camera = cam
    u = t * t * (3 - 2 * t)
    p0 = Vector((0.072, ym - 0.092, 0.040))
    t0 = Vector((0.0, ym - 0.002, 0.0075))
    e = math.radians(S.ELEV)
    d1 = Vector((0.0, -math.cos(e), math.sin(e)))
    t1 = Vector((0.0, ym - (0.5 - AGO_QUADRO) * S.VISTA_LARG / math.sin(e), 0.0))
    d0 = (p0 - t0).normalized()
    dist0 = (p0 - t0).length
    larg0 = dist0 * 36.0 / 90.0
    direz = d0.slerp(d1, u)
    dist = dist0 * (4.0 / dist0) ** u
    larg = larg0 * (S.VISTA_LARG / larg0) ** u
    mira = t0.lerp(t1, u)
    pos = mira + direz * dist
    S.guarda(cam, pos, mira, (0, 0, 1))
    cd.sensor_width = 36
    cd.lens = 36.0 * dist / larg
    cd.clip_start, cd.clip_end = 0.005, 30
    cd.dof.use_dof = True
    cd.dof.focus_distance = (pos - Vector((0, ym, 0.004))).length
    cd.dof.aperture_fstop = 11.0 * (600.0 / 11.0) ** u      # salendo tutto torna a fuoco
    cd.dof.aperture_blades = 9
    return cam


# ------------------------------------------------------------------ i pezzi
def rendi(sc, percorso):
    sc.render.filepath = percorso
    t0 = time.time()
    bpy.ops.render.render(write_still=True)
    print("FATTO %s in %.0f s" % (os.path.basename(percorso), time.time() - t0), flush=True)


def ritaglio(sc, x0, x1, y0=0.0, y1=1.0):
    sc.render.use_border = True
    sc.render.use_crop_to_border = True
    sc.render.border_min_x, sc.render.border_max_x = x0, x1
    sc.render.border_min_y, sc.render.border_max_y = y0, y1


def apertura(i, percorso, campioni, lato=LATO_AP):
    s = i / FPC
    sc, mat, _ = S.scena_base(lato, lato, campioni, TTF, SVG, punti_cuciti=S.punti_fatti(s), quota_logo=0.0)
    base, zt = S.crea_macchina(s, mat)
    S.crea_filo_ago(s, base, zt, mat["filo"])
    t = 0.0 if i <= AP_MACRO else (i - AP_MACRO) / float(N_AP - AP_MACRO)
    camera_gru(sc, base[1], t)
    rendi(sc, percorso)


def striscia(i, percorso, campioni, senza_cucitura=False):
    sc, _, _ = S.scena_base(STR_LARG, FASCIA + 2 * MARGINE, campioni, TTF, SVG, punti_cuciti=0 if senza_cucitura else None, quota_logo=0.0)
    yc = Y_ALTO - (i * FASCIA + FASCIA / 2) / (PXM * SIN)
    S.camera_alto(sc, yc, ago_a=0.5)
    if senza_cucitura:
        ritaglio(sc, 0.5 - COLONNA, 0.5 + COLONNA)
    rendi(sc, percorso)


def macchina(j, percorso, campioni):
    s = MAC_S + j / FPC
    sc, mat, _ = S.scena_base(STR_LARG, MAC_ALT, campioni, TTF, SVG, punti_cuciti=S.punti_fatti(s), quota_logo=0.0,
                              trasparente=True, cattura_ombre=True, con_fili=False)
    base, zt = S.crea_macchina(s, mat)
    S.crea_filo_ago(s, base, zt, mat["filo"])
    S.camera_alto(sc, base[1], ago_a=MAC_AGO[1] / MAC_ALT)
    x0 = (STR_LARG / 2 - MAC_AGO[0]) / STR_LARG
    ritaglio(sc, x0, x0 + MAC_LARG / STR_LARG)
    rendi(sc, percorso)


def ricamo(k, percorso, campioni):
    sc, _, _ = S.scena_base(STR_LARG, RIC_ALT, campioni, TTF, SVG, punti_cuciti=None, quota_logo=k / N_RIC, bordo_logo=(k == N_RIC))
    S.camera_alto(sc, S.LOGO_Y, ago_a=0.5)
    meta = RIC_LARG / 2 / STR_LARG
    ritaglio(sc, 0.5 - meta, 0.5 + meta)
    rendi(sc, percorso)


def dati(percorso):
    """Scrive le misure che servono al sito per rimettere insieme i pezzi."""
    pl = S.punti_logo(S.poligoni_logo(SVG))
    aghi = []
    for k in range(N_RIC + 1):
        nl = int(round(len(pl) * k / N_RIC))
        p = pl[max(0, nl - 1)][1] if nl > 0 else pl[0][0]
        aghi.append([round(colonna_x(float(p[0])), 1), round(riga(float(p[1])), 1)])
    capitoli = []
    for cap in S.CAPITOLI:
        alt_tot = sum(a for _, a in cap["righe"]) + S.INTERLINEA * (len(cap["righe"]) - 1)
        capitoli.append({
            "lato": cap["lato"], "testi": [t for t, _ in cap["righe"]],
            "x": round(colonna_x((-1 if cap["lato"] == "sx" else 1) * S.MARGINE_TESTI), 1),
            "riga_base": round(riga(cap["y"]), 1),                               # linea di base della prima riga
            "riga_sotto": round(riga(cap["y"]) + (alt_tot - cap["righe"][0][1]) * PXM, 1),  # fondo dell'ultima riga
            "altezza_prima": round(cap["righe"][0][1] * PXM, 1),
        })
    n_punti = int(round(abs(S.FINE_CUCITURA) / S.PASSO))
    d = {
        "px_per_cm": PXM / 100.0,
        "striscia": {"larghezza": STR_LARG, "fascia": FASCIA, "fasce": N_FASCE, "altezza": FASCIA * N_FASCE,
                     "colonna_x": round(STR_LARG * (0.5 - COLONNA)), "colonna_larghezza": round(STR_LARG * 2 * COLONNA)},
        "cucitura": {"x": STR_LARG / 2, "riga_inizio": round(riga(0.0), 1), "passo": round(S.PASSO * PXM * SIN, 3), "punti": n_punti,
                     "riga_fine": round(riga(-S.PASSO * n_punti), 1)},
        "apertura": {"fotogrammi": N_AP + 1, "per_punto": FPC, "lato": LATO_AP, "ago_y": AGO_QUADRO, "cm_inquadrati": S.VISTA_LARG * 100, "s_fine": N_AP / FPC},
        "macchina": {"fasi": FPC, "larghezza": MAC_LARG, "altezza": MAC_ALT, "ago": list(MAC_AGO)},
        "ricamo": {"passi": N_RIC + 1, "larghezza": RIC_LARG, "altezza": RIC_ALT,
                   "x": STR_LARG / 2 - RIC_LARG / 2, "riga": round(riga(S.LOGO_Y) - RIC_ALT / 2, 1), "ago": aghi,
                   "centro": [STR_LARG / 2, round(riga(S.LOGO_Y), 1)]},
        "capitoli": capitoli,
    }
    with open(percorso, "w", encoding="utf8") as f:
        json.dump(d, f, indent=1)
    print("scritto", percorso)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("cosa", choices=["apertura", "striscia", "colonna", "macchina", "ricamo", "dati"])
    ap.add_argument("--dir", required=True)
    ap.add_argument("--da", type=int, default=None)
    ap.add_argument("--a", type=int, default=None)
    ap.add_argument("--campioni", type=int, default=None)
    ap.add_argument("--lato", type=int, default=LATO_AP, help="solo per le prove dell'apertura")
    a = ap.parse_args()
    os.makedirs(a.dir, exist_ok=True)
    if a.cosa == "dati":
        dati(os.path.join(a.dir, "film.json"))
        sys.exit(0)
    piani = {
        "apertura": (range(0, N_AP + 1), "apertura-%03d.png", 56, lambda i, p, c: apertura(i, p, c, a.lato)),
        "striscia": (range(0, N_FASCE), "striscia-%02d.png", 48, lambda i, p, c: striscia(i, p, c)),
        "colonna": (range(0, N_FASCE), "colonna-%02d.png", 48, lambda i, p, c: striscia(i, p, c, senza_cucitura=True)),
        "macchina": (range(0, FPC), "macchina-%d.png", 72, macchina),
        "ricamo": (range(0, N_RIC + 1), "ricamo-%02d.png", 48, ricamo),
    }
    indici, nome, campioni, fai = piani[a.cosa]
    campioni = a.campioni or campioni
    for i in indici:
        if (a.da is not None and i < a.da) or (a.a is not None and i > a.a):
            continue
        percorso = os.path.join(a.dir, nome % i)
        if os.path.exists(percorso):
            continue
        fai(i, percorso, campioni)
