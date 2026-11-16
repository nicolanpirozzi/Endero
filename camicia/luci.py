"""Lo studio fotografico della camicia: le luci con cui `prepara.py` calcola la luce fissata sul tessuto.
Il carattere è quello dell'apertura: luce morbida da davanti a sinistra, controluce caldo da dietro a destra,
ombre che virano al blu della stanza.

La camicia sta nell'origine, col davanti verso -Y. Le luci sono figlie di un perno: girando il perno girano
tutte insieme, come se la camicia fosse girata sotto di loro.
"""
import bpy
from mathutils import Vector

# posizione (metri), potenza (watt), lato del pannello (metri), colore
LUCI = [
    ('chiave',      (-1.9, -2.6, 1.6), 115, 2.0, (1.00, 0.96, 0.91)),   # la principale: morbida, da davanti a sinistra, un po' dall'alto
    ('schiarita',   ( 2.4, -1.9, 0.2),  13, 2.6, (0.87, 0.91, 1.00)),   # riempie le ombre a destra, fredda
    ('controluce',  ( 1.6,  2.3, 1.3), 125, 1.4, (1.00, 0.93, 0.84)),   # il segno dell'apertura: caldo, da dietro. Poco carico:
                                                                        # girandola, la camicia bianca deve restare bianca
    ('soffitto',    ( 0.0, -0.2, 3.0),  20, 3.0, (1.00, 1.00, 1.00)),
    ('dietro',      (-2.2,  2.0, 0.4),  26, 2.4, (0.86, 0.90, 1.00)),   # perché anche la schiena, girandola, sia leggibile
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
