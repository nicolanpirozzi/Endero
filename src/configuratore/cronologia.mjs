// La cronologia del browser nel configuratore (revisione del 2026-11-26): ogni passo e ogni finestra aperta sono una
// voce, così il tasto Indietro (il gesto, sul telefono) torna al passo di prima o chiude la finestra, e non lascia la
// pagina con l'ordine a metà.
//
// Una finestra che si chiude da sé (un tessuto scelto, «Inizia», Esc) toglie la sua voce con `history.back()`, che
// arriva un attimo dopo: nel frattempo nessun'altra voce si aggiunge (aspetta), e quel ritorno non riguarda nessun
// altro (chi ascolta `popstate` non lo vede). Senza questo, un «Continua» premuto subito dopo aver chiuso una finestra
// faceva tornare indietro di un passo.

let tornando = false;
let scadenza = 0;
const inAttesa = [];
const finito = () => {
  tornando = false;
  clearTimeout(scadenza);
  for (const f of inAttesa.splice(0)) f();
};
// (questo modulo si carica prima che scheda.js e guida.js mettano i loro ascolti: è il primo a sentire `popstate`)
addEventListener('popstate', (e) => {
  if (!tornando) return;
  e.stopImmediatePropagation();
  finito();
});

/** Aggiunge una voce alla cronologia: subito, o appena finito il ritorno in corso. `stato`: un oggetto, o una funzione che lo dà. */
export function voce(stato) {
  const f = () => { try { history.pushState(typeof stato === 'function' ? stato() : stato, ''); } catch { /* si va avanti senza */ } };
  if (tornando) inAttesa.push(f); else f();
}
/** Una finestra si è aperta: una voce in più, che il tasto Indietro consuma chiudendola. */
export const finestraAperta = () => voce(() => ({ ...history.state, finestra: true }));
/** Una finestra si è chiusa: se la sua voce c'è ancora (non l'ha chiusa il tasto Indietro) la si toglie. */
export function finestraChiusa() {
  if (!history.state?.finestra || tornando) return;
  tornando = true;
  // (se il ritorno non arrivasse, dopo un attimo si va avanti lo stesso)
  scadenza = setTimeout(finito, 1000);
  history.back();
}
/** In un ascolto di `popstate`: il tasto Indietro ha consumato la voce della finestra (che quindi va chiusa)? */
export const voceFinestraTolta = () => !history.state?.finestra;
