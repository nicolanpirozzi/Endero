// Pagina del configuratore. La camicia è l'immagine di Blender divisa in tre pezzi (leggera.js): dondola con gruccia e
// nastro quando le si passa sopra, e il suo tessuto ondeggia come un telo (onda.js). Dove il browser non ha
// l'accelerazione grafica il tessuto non ondeggia e la camicia dondola tutta insieme. Senza JavaScript, con il
// movimento ridotto o con il risparmio dati resta l'immagine ferma, e il riquadro funziona lo stesso (un modulo solo).
// Il riquadro in cinque passi (scheda.js); la guida alle misure (guida.js): la finestra dei passi entrando nel passo
// Misure, e entrando in ogni campo di misura lo zoom sulla camicia dove si misura.
import { leggera } from './leggera.js';
import { passi, guida } from './guida.js';
import { vesti } from './vesti.js';
import { scheda } from './scheda.js';

const palco = document.querySelector('.configura__palco');
const form = document.querySelector('form[data-configuratore]');
// Per i controlli (tools/prova-leggera.js): ?rigida spegne il tessuto che ondeggia, per provare la camicia che si
// vede dove la scheda grafica non c'è; ?comunque lo accende anche nel browser di prova, che la scheda grafica non l'ha;
// ?senza-passi non apre da sola la finestra dei passi; ?passo=misure apre il riquadro su quel passo.
const cerca = new URLSearchParams(location.search);
// La finestra «Come prendere le misure» si apre entrando nel passo Misure (la prima volta a ogni caricamento), non
// più all'apertura della pagina. La camicia saluta subito, o, se la pagina si apre proprio sul passo Misure, quando
// quella finestra si chiude: sotto la finestra il saluto non si vedrebbe.
let chiusa = Promise.resolve();
if (form) {
  try { chiusa = scheda(form, { passi }); } catch (e) { console.error(e); }
}
const camicia = palco?.dataset.leggera
  ? leggera(palco, palco.dataset.leggera, palco.dataset.leggeraV, { onda: cerca.has('rigida') ? 0 : 1, comunque: cerca.has('comunque'), aspetta: chiusa }).catch((e) => { console.error(e); })
  : Promise.resolve();
if (palco) guida(palco, camicia);
// ciò che si sceglie nel riquadro si vede sulla camicia: collo, taschino, iniziali (vesti.js ascolta `endero:camicia`)
if (palco) vesti(palco, camicia);
