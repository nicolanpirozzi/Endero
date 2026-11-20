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

/**
 * Il telefono come lo si confronta: solo le cifre, con il prefisso internazionale scritto sempre allo stesso modo
 * (00 o +), e senza quello dell'Italia: «(+39) 347 000 1111», «0039 3470001111» e «347-000-1111» sono la stessa
 * persona. Anche un cellulare scritto con 39 davanti e senza + (12 cifre che cominciano con 393).
 */
export function chiaveTelefono(telefono) {
  const s = String(telefono || '').replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '').replace(/^00/, '+');
  if (s.startsWith('+39')) return s.slice(3);
  if (/^393\d{9}$/.test(s)) return s.slice(2);
  return s.replace(/^\+/, '');
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
