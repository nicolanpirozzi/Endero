// La miniatura della camicia per le email dell'ordine (proprietario, 2026-11-27: «possiamo inviare anche una
// miniatura effetto glass con dentro la camicia così come l'ha personalizzata?»; scelte sue: «Vetro blu, parete del
// configuratore», in cima all'email del cliente al posto della foto, e anche nell'email a Endero).
//
// Al momento dell'ordine la pagina fotografa la camicia com'è sullo schermo (vesti.js: tessuto, collo, taschino,
// iniziali) e la mette in una scheda di vetro: fuori il blu della parete con la luce della finestra, dentro la parete
// nitida con la camicia, angoli tondi, un riflesso in alto e il bordo chiaro delle schede del sito. Nelle email il vetro vero
// (backdrop-filter) non c'è: l'effetto sta dentro l'immagine, così si vede uguale su Gmail, iPhone e Outlook.
// Un quadrato JPEG di 1200 punti (600 nell'email, nitido sugli schermi a densità doppia); il Worker accetta solo questa
// misura (worker/ordine.mjs, MINIATURA). null se non si può: l'email mette la sua foto di sempre.

import { fotografaCamicia } from './vesti.js';

export const LATO = 1200;
const BORDO = 60;                      // il blu intorno alla scheda
const RAGGIO = 54;
// il ritaglio del fotogramma (1800 x 1000) dentro la scheda: un quadrato con la camicia al centro (gruccia e nastro
// compresi), la luce della finestra a sinistra e la parete in ombra a destra
const RIQUADRO = [206, 0, 1000, 1000];
const QUALITA = 0.84;

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

/**
 * La miniatura com'è la camicia adesso.
 * @returns {Promise<string|null>} un indirizzo «data:image/jpeg;base64,…» di LATO x LATO, o null
 */
export async function miniatura() {
  const dentro = LATO - 2 * BORDO;
  const scena = await fotografaCamicia({ riquadro: RIQUADRO, scala: dentro / RIQUADRO[3] });
  if (!scena) return null;
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
  g.shadowBlur = 70;
  g.shadowOffsetY = 22;
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
  // e in basso un velo appena più scuro, come lo spessore della lastra
  const fondo = g.createLinearGradient(0, BORDO + dentro * 0.7, 0, BORDO + dentro);
  fondo.addColorStop(0, 'rgba(5, 14, 40, 0)');
  fondo.addColorStop(1, 'rgba(5, 14, 40, 0.22)');
  g.fillStyle = fondo;
  g.fillRect(BORDO, BORDO, dentro, dentro);
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
  let foto = '';
  try { foto = tela.toDataURL('image/jpeg', QUALITA); } catch { foto = ''; }
  tela.width = tela.height = 0;
  return foto.startsWith('data:image/jpeg;base64,') ? foto : null;
}

// per i controlli (tools/prova-configuratore.js): ?manuale
if (new URLSearchParams(location.search).has('manuale')) window.__miniatura = miniatura;
