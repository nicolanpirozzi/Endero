// Pagina del configuratore. La camicia è l'immagine di Blender divisa in tre pezzi (leggera.js): dondola con gruccia e
// nastro quando le si passa sopra, e il suo tessuto ondeggia come un telo (onda.js). Dove il browser non ha
// l'accelerazione grafica il tessuto non ondeggia e la camicia dondola tutta insieme. Senza JavaScript, con il
// movimento ridotto o con il risparmio dati resta l'immagine ferma, e il riquadro delle misure funziona lo stesso.
import { leggera } from './leggera.js';

const palco = document.querySelector('[data-leggera]');
// Per i controlli (tools/prova-leggera.js): ?rigida spegne il tessuto che ondeggia, per provare la camicia che si
// vede dove la scheda grafica non c'è; ?comunque lo accende anche nel browser di prova, che la scheda grafica non l'ha.
const cerca = new URLSearchParams(location.search);
if (palco) leggera(palco, palco.dataset.leggera, palco.dataset.leggeraV, { onda: cerca.has('rigida') ? 0 : 1, comunque: cerca.has('comunque') }).catch((e) => console.error(e));
