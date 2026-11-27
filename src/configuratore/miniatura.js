// La miniatura della camicia per le email dell'ordine (proprietario, 2026-11-27: «possiamo inviare anche una
// miniatura effetto glass con dentro la camicia così come l'ha personalizzata?»; scelte sue: «Vetro blu, parete del
// configuratore», in cima all'email del cliente al posto della foto, e anche nell'email a Endero).
//
// Al momento dell'ordine la pagina fotografa la camicia com'è sullo schermo (vesti.js: tessuto, collo, taschino,
// iniziali) e la mette in una scheda di vetro: fuori il blu della parete con la luce della finestra, dentro la parete
// nitida con la camicia, angoli tondi, un riflesso in alto e il bordo chiaro delle schede del sito; in basso a sinistra
// il logo, e se ci sono le iniziali una lente che le mostra ingrandite (sulla camicia intera sarebbero alte tre punti:
// revisione del 2026-11-27). Nelle email il vetro vero (backdrop-filter) non c'è: l'effetto sta dentro l'immagine.
// Un quadrato JPEG di 1200 punti (600 nell'email, nitido sugli schermi a densità doppia); il Worker accetta solo questa
// misura e al più 250 KB (worker/ordine.mjs, MINIATURA). null se non si può: l'email mette la sua foto di sempre.

import { fotografaCamicia } from './vesti.js';

export const LATO = 1200;
const BORDO = 48;                      // il blu intorno alla scheda
const RAGGIO = 50;
// il ritaglio del fotogramma (1800 x 1000) dentro la scheda: un quadrato stretto intorno alla camicia (che sta fra x 456
// e 956, y 158 e 940), con la luce della finestra a sinistra e la parete in ombra a destra
const RIQUADRO = [256, 80, 900, 900];
// la lente delle iniziali: un cerchio sulla parete a destra, con dentro 46 punti del fotogramma intorno a loro
const LENTE = { raggio: 112, lato: 46 };
// il peso massimo che il Worker accetta è 250 KB: si scende di qualità finché ci sta, con un po' di margine
const QUALITA = [0.84, 0.76, 0.68, 0.6];
const PESO = 235 * 1024;

/** Un rettangolo con gli angoli tondi, come tracciato. */
function tondo(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** Il logo Endero, bianco: il disegno è già nella pagina (il simbolo #endero-completo, 207,8 x 119,3). */
function logo(g, x, y, larga) {
  const d = document.querySelector('#endero-completo path')?.getAttribute('d');
  if (!d || typeof Path2D !== 'function') return;
  const s = larga / 207.8;
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.fillStyle = 'rgba(251, 249, 244, 0.92)';
  g.fill(new Path2D(d), 'evenodd');
  g.restore();
}

/**
 * La miniatura della camicia della scelta `scelta` (lo stesso avviso `endero:camicia` che va alla camicia).
 * @returns {Promise<string|null>} un indirizzo «data:image/jpeg;base64,…» di LATO x LATO, o null
 */
export async function miniatura(scelta) {
  const dentro = LATO - 2 * BORDO;
  const s = dentro / RIQUADRO[2];
  const lenteScala = (2 * LENTE.raggio) / LENTE.lato;
  const foto = await fotografaCamicia({ riquadro: RIQUADRO, scala: s, scelta, lente: { lato: LENTE.lato, scala: lenteScala } });
  if (!foto) return null;
  const { scena, lente, iniziali } = foto;
  const tela = document.createElement('canvas');
  tela.width = tela.height = LATO;
  const g = tela.getContext('2d');
  if (!g) return null;
  g.imageSmoothingQuality = 'high';

  // fuori: il blu della parete, con la luce morbida della finestra dal lato sinistro in alto (come nel configuratore)
  const fondoBlu = g.createLinearGradient(0, 0, LATO, LATO);
  fondoBlu.addColorStop(0, '#163a80');
  fondoBlu.addColorStop(0.55, '#0c2259');
  fondoBlu.addColorStop(1, '#061336');
  g.fillStyle = fondoBlu;
  g.fillRect(0, 0, LATO, LATO);
  const luce = g.createRadialGradient(LATO * 0.18, LATO * 0.12, 0, LATO * 0.18, LATO * 0.12, LATO * 0.75);
  luce.addColorStop(0, 'rgba(120, 160, 235, 0.32)');
  luce.addColorStop(1, 'rgba(120, 160, 235, 0)');
  g.fillStyle = luce;
  g.fillRect(0, 0, LATO, LATO);

  // la scheda: un'ombra morbida sotto, poi la parete nitida con la camicia dentro gli angoli tondi
  g.save();
  g.shadowColor = 'rgba(2, 8, 26, 0.5)';
  g.shadowBlur = 60;
  g.shadowOffsetY = 18;
  tondo(g, BORDO, BORDO, dentro, dentro, RAGGIO);
  g.fillStyle = '#0a1b45';
  g.fill();
  g.restore();
  g.save();
  tondo(g, BORDO, BORDO, dentro, dentro, RAGGIO);
  g.clip();
  g.drawImage(scena, BORDO, BORDO, dentro, dentro);
  // il vetro: un riflesso chiaro dall'angolo in alto a sinistra, che si perde prima del centro
  const riflesso = g.createLinearGradient(BORDO, BORDO, BORDO + dentro * 0.62, BORDO + dentro * 0.62);
  riflesso.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
  riflesso.addColorStop(0.45, 'rgba(255, 255, 255, 0.04)');
  riflesso.addColorStop(1, 'rgba(255, 255, 255, 0)');
  g.fillStyle = riflesso;
  g.fillRect(BORDO, BORDO, dentro, dentro);
  // e in basso un velo appena più scuro, come lo spessore della lastra (lì sta anche il logo)
  const velo = g.createLinearGradient(0, BORDO + dentro * 0.66, 0, BORDO + dentro);
  velo.addColorStop(0, 'rgba(5, 14, 40, 0)');
  velo.addColorStop(1, 'rgba(5, 14, 40, 0.34)');
  g.fillStyle = velo;
  g.fillRect(BORDO, BORDO, dentro, dentro);
  // il logo in basso a sinistra, sulla parete in ombra accanto alla camicia
  logo(g, BORDO + 44, BORDO + dentro - 44 - 150 * (119.3 / 207.8), 150);

  // la lente delle iniziali: un cerchio di vetro sulla parete a destra, con un filo che porta al punto
  if (lente && iniziali) {
    // (sulla parete a destra della manica, a due terzi d'altezza: non copre il polsino, che può avere un suo tessuto)
    const cx = BORDO + dentro - 16 - LENTE.raggio, cy = BORDO + dentro * 0.62;
    const px = BORDO + (iniziali[0] - RIQUADRO[0]) * s, py = BORDO + (iniziali[1] - RIQUADRO[1]) * s;
    const a = Math.atan2(py - cy, px - cx);
    g.save();
    g.strokeStyle = 'rgba(251, 249, 244, 0.7)';
    g.lineWidth = 2;
    g.setLineDash([6, 6]);
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * (LENTE.raggio + 6), cy + Math.sin(a) * (LENTE.raggio + 6));
    g.lineTo(px - Math.cos(a) * 14, py - Math.sin(a) * 14);
    g.stroke();
    g.setLineDash([]);
    g.beginPath();
    g.arc(px, py, 12, 0, Math.PI * 2);
    g.stroke();
    g.restore();
    g.save();
    g.shadowColor = 'rgba(2, 8, 26, 0.55)';
    g.shadowBlur = 34;
    g.shadowOffsetY = 10;
    g.beginPath();
    g.arc(cx, cy, LENTE.raggio, 0, Math.PI * 2);
    g.fillStyle = '#0a1b45';
    g.fill();
    g.restore();
    g.save();
    g.beginPath();
    g.arc(cx, cy, LENTE.raggio, 0, Math.PI * 2);
    g.clip();
    g.drawImage(lente, cx - LENTE.raggio, cy - LENTE.raggio, LENTE.raggio * 2, LENTE.raggio * 2);
    const lucida = g.createLinearGradient(cx - LENTE.raggio, cy - LENTE.raggio, cx, cy);
    lucida.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
    lucida.addColorStop(1, 'rgba(255, 255, 255, 0)');
    g.fillStyle = lucida;
    g.fillRect(cx - LENTE.raggio, cy - LENTE.raggio, LENTE.raggio * 2, LENTE.raggio * 2);
    g.restore();
    g.lineWidth = 3;
    g.strokeStyle = 'rgba(251, 249, 244, 0.85)';
    g.beginPath();
    g.arc(cx, cy, LENTE.raggio - 1.5, 0, Math.PI * 2);
    g.stroke();
    lente.width = lente.height = 0;
  }
  g.restore();

  // il bordo chiaro delle schede in vetro del sito, e un filo più tenue appena dentro
  g.lineWidth = 2.5;
  g.strokeStyle = 'rgba(255, 255, 255, 0.36)';
  tondo(g, BORDO + 1.25, BORDO + 1.25, dentro - 2.5, dentro - 2.5, RAGGIO - 1.25);
  g.stroke();
  g.lineWidth = 1.5;
  g.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  tondo(g, BORDO + 9, BORDO + 9, dentro - 18, dentro - 18, RAGGIO - 9);
  g.stroke();

  scena.width = scena.height = 0;
  let uscita = null;
  try {
    for (const q of QUALITA) {
      const u = tela.toDataURL('image/jpeg', q);
      if (!u.startsWith('data:image/jpeg;base64,')) break;
      if ((u.length - 23) * 0.75 <= PESO) { uscita = u; break; }
    }
  } catch { uscita = null; }
  tela.width = tela.height = 0;
  return uscita;
}

// per i controlli (tools/prova-configuratore.js, tools/anteprima-email.mjs): ?manuale
if (new URLSearchParams(location.search).has('manuale')) window.__miniatura = miniatura;
