// La camicia che cambia con le scelte del riquadro (proprietario, 2026-11-25): collo, taschino, iniziali.
// SEGNAPOSTO: per ora non fa nulla. Il contratto con il riquadro (docs/direzione-creativa.md, punto 16):
//   document.dispatchEvent(new CustomEvent('endero:camicia', { detail: { collo: 'francese', taschino: true,
//     iniziali: { posizione: 'polso' | 'collo' | 'cuore', lettere: 'NP' } | null } }))
// a ogni cambio di scelta; i file stanno in public/camicia/opzioni/ (palco.dataset.opzioni).

/**
 * @param {HTMLElement} palco    il palco della camicia
 * @param {Promise} camicia      quella di leggera(): { ferma, riparti } o niente
 */
export function vesti(palco, camicia) {
  void palco; void camicia;
}
