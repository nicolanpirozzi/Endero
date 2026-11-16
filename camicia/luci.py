"""Lo studio fotografico della camicia: le luci con cui `prepara.py` calcola la luce fissata sul tessuto.

La scena del configuratore, dal 16 novembre 2026: la camicia è appesa a una gruccia davanti a una parete blu, e la
luce principale entra da una finestra davanti a destra. È lei che disegna sulla parete l'ombra della camicia e
delle sbarre della finestra (il browser le disegna in diretta, con lo stesso verso scritto qui).

La camicia sta nell'origine, col davanti verso -Y. Le luci sono figlie di un perno: girando il perno girano
tutte insieme, come se la camicia fosse girata sotto di loro.
"""
import math

import bpy
from mathutils import Vector

# Nello spazio di chi guarda la pagina (X a destra, Y in alto, Z verso chi guarda):
RIPOSO = -0.2                          # di quanto la camicia sta girata a riposo (radianti: appena verso sinistra)
FINESTRA = (0.535, 0.357, 0.765)       # verso da cui arriva la luce della finestra: da destra, dall'alto, da davanti


def _nella_camicia(v, giro=RIPOSO):
    """Un verso dello spazio di chi guarda, visto dalla camicia girata di `giro`, negli assi di Blender."""
    c, s = math.cos(-giro), math.sin(-giro)
    x, y, z = v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c
    return (x, -z, y)


_f = _nella_camicia(FINESTRA)
# posizione (metri), potenza (watt), lato del pannello (metri), colore
LUCI = [
    ('chiave',      tuple(3.5 * k for k in _f), 150, 2.0, (1.00, 0.96, 0.91)),   # la finestra: morbida, da davanti a destra
    ('schiarita',   (-2.4, -1.9, 0.2),  13, 2.6, (0.87, 0.91, 1.00)),   # la stanza che rimanda luce da sinistra, fredda
    ('controluce',  (-1.6,  2.3, 1.3),  70, 1.4, (1.00, 0.95, 0.90)),   # quel che torna dalla parete illuminata, dietro a sinistra
    ('soffitto',    ( 0.0, -0.2, 3.0),  20, 3.0, (1.00, 1.00, 1.00)),
    ('dietro',      ( 2.2,  2.0, 0.4),  26, 2.4, (0.86, 0.90, 1.00)),   # perché anche la schiena, girandola, sia leggibile
]
STANZA = ((0.02, 0.05, 0.16), 0.45)      # il blu che colora le ombre

# verso da cui arriva la luce principale, per il visualizzatore (che ha Y in alto e il davanti verso +Z)
_c = Vector(LUCI[0][1]).normalized()
CHIAVE_PER_IL_BROWSER = (round(_c.x, 4), round(_c.z, 4), round(-_c.y, 4))


def studio(sc, giro=0.0):
    """Mette nella scena la stanza e le luci. `giro` (radianti) le gira tutte intorno alla verticale."""
    w = bpy.data.worlds.new('stanza')
    w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[0].default_value = (*STANZA[0], 1)
    w.node_tree.nodes['Background'].inputs[1].default_value = STANZA[1]
    sc.world = w
    perno = bpy.data.objects.new('luci', None)
    sc.collection.objects.link(perno)
    for nome, pos, forza, lato, colore in LUCI:
        d = bpy.data.lights.new(nome, 'AREA')
        d.energy, d.size, d.color = forza, lato, colore
        o = bpy.data.objects.new(nome, d)
        sc.collection.objects.link(o)
        o.parent = perno
        o.location = pos
        o.rotation_euler = (-Vector(pos)).to_track_quat('-Z', 'Y').to_euler()
    perno.rotation_euler = (0, 0, giro)
    return perno
