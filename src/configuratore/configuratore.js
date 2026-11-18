// Pagina del configuratore. La camicia è l'immagine di Blender divisa in tre pezzi, che dondola con gruccia e nastro
// quando le si passa sopra (leggera.js). Senza JavaScript, con il movimento ridotto o con il risparmio dati resta
// l'immagine ferma, e il riquadro delle misure funziona lo stesso.
import { leggera } from './leggera.js';

const palco = document.querySelector('[data-leggera]');
if (palco) leggera(palco, palco.dataset.leggera, palco.dataset.leggeraV).catch((e) => console.error(e));
