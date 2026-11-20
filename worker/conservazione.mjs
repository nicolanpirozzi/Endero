// Quanto si tengono le richieste arrivate dai moduli del sito, e come si cancellano.
// L'informativa privacy (contenuti/it/legale.json) promette: «Per 24 mesi dall'ultima richiesta, poi li cancelliamo».
// Quindi una richiesta se ne va quando ha più di 24 mesi e la stessa persona non ne ha mandate di più recenti.
// La stessa persona: stesso telefono o stessa email, confrontati per come li scrive la persona e non per com'è
// scritto (solo le cifre del telefono, senza il prefisso +39; l'email in minuscolo): sono le colonne chiave_telefono
// e chiave_email, che il Worker riempie a ogni richiesta (worker/index.js). Se la durata cambia, cambia qui e
// nell'informativa. Il Worker lo fa ogni notte (scheduled in worker/index.js, [triggers] in wrangler.toml).
//
// Sta in un file a parte perché il file principale del Worker può esportare solo funzioni: Cloudflare prende ogni
// altra cosa esportata per un punto d'ingresso e il Worker non parte (tools/prova-worker.mjs lo controlla).

export const CONSERVAZIONE_MESI = 24;

/** Il telefono come lo si confronta: solo le cifre, e senza il prefisso dell'Italia se c'è (+39, 0039). */
export function chiaveTelefono(telefono) {
  const testo = String(telefono || '').trim();
  const cifre = testo.replace(/\D/g, '');
  return /^(\+|00)\s*39/.test(testo) ? cifre.replace(/^(00)?39/, '') : cifre;
}

/** L'email come la si confronta: senza spazi ai lati, in minuscolo. */
export const chiaveEmail = (email) => String(email || '').trim().toLowerCase();

const LIMITE = `strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-${CONSERVAZIONE_MESI} months')`;
export const DIMENTICA = `DELETE FROM richieste WHERE id IN (
  SELECT r.id FROM richieste r
  WHERE r.creata < ${LIMITE}
    AND NOT (r.chiave_telefono <> '' AND EXISTS (
      SELECT 1 FROM richieste n WHERE n.chiave_telefono = r.chiave_telefono AND n.creata >= ${LIMITE}))
    AND NOT (r.chiave_email <> '' AND EXISTS (
      SELECT 1 FROM richieste n WHERE n.chiave_email = r.chiave_email AND n.creata >= ${LIMITE}))
)`;

/** Cancella le richieste scadute. Restituisce quante. */
export async function dimentica(db) {
  const esito = await db.prepare(DIMENTICA).run();
  const quante = esito.meta?.changes ?? 0;
  console.log('richieste cancellate perché più vecchie di', CONSERVAZIONE_MESI, 'mesi dall\'ultima:', quante);
  return quante;
}
