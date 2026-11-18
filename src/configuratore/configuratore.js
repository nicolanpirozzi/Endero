// Pagina del configuratore. La camicia è l'immagine di Blender divisa in tre pezzi, che dondola con gruccia e nastro
// quando le si passa sopra (leggera.js). Senza JavaScript, con il movimento ridotto o con il risparmio dati resta
// l'immagine ferma, e il riquadro delle misure funziona lo stesso.
import { leggera } from './leggera.js';

const palco = document.querySelector('[data-leggera]');
// PROVA (2026-11-18): con ?prova=onda il tessuto ondeggia come un telo (onda.js), come nel sito che il proprietario
// ha mandato per riferimento; "onda-a" è più lieve, "onda-c" più mossa. Senza, la pagina è quella approvata.
const cerca = new URLSearchParams(location.search), prova = cerca.get('prova') || '';
const onda = prova.startsWith('onda') ? ({ 'onda-a': 0.6, 'onda-c': 1.6 }[prova] || 1) : 0;
if (palco) leggera(palco, palco.dataset.leggera, palco.dataset.leggeraV, { onda, comunque: cerca.has('comunque') }).catch((e) => console.error(e));
