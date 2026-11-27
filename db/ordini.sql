-- Gli ordini del configuratore di camicie su misura (worker/ordine.mjs). La stessa tabella è in db/schema.sql: qui
-- c'è da sola, da lanciare sul database che esiste già (le richieste dei moduli restano come sono).
--   In locale:  npx wrangler d1 execute endero-sito --local --file db/ordini.sql --config wrangler.sito.toml
--   Online:     npx wrangler d1 execute endero-sito --remote --file db/ordini.sql --config wrangler.sito.toml
--               (solo con l'ok del proprietario, prima di accendere il pagamento)
-- Se si cambia una colonna, si cambia in tutti e due i file (tools/prova-worker.mjs controlla che siano uguali).
--
-- Gli ordini NON entrano nella pulizia dei 24 mesi delle richieste: hanno la loro (worker/conservazione.mjs,
-- pulisciOrdini): quelli mai pagati e quelli di prova vanno via dopo 30 giorni, i pagati restano 10 anni (documenti
-- contabili), come dice l'informativa privacy approvata dal consulente il 2026-11-27.

CREATE TABLE IF NOT EXISTS ordini (
  n          INTEGER PRIMARY KEY AUTOINCREMENT,      -- il contatore che dà il numero leggibile
  id         TEXT    NOT NULL UNIQUE,                -- casuale, 32 cifre esadecimali: è il riferimento che va a Stripe
  numero     TEXT    UNIQUE,                         -- E-2026-000123, quello che si dicono cliente ed Endero
  creato     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  aggiornato TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  stato      TEXT    NOT NULL DEFAULT 'da_pagare' CHECK (stato IN ('da_pagare', 'pagato', 'annullato')),
  ordine     TEXT    NOT NULL,                       -- JSON: l'ordine pulito (src/configuratore/ordine.mjs, ordinePulito)
  email      TEXT    NOT NULL DEFAULT '',            -- l'email scritta nel configuratore
  quantita   INTEGER NOT NULL,
  camicia_centesimi    INTEGER NOT NULL,             -- prezzo di una camicia, rifatto dal Worker
  spedizione_centesimi INTEGER NOT NULL DEFAULT 0,
  totale_centesimi     INTEGER NOT NULL,
  taglia     TEXT    NOT NULL DEFAULT '',            -- JSON: taglia di partenza e variazioni (worker/taglie.mjs); vuoto se non calcolata
  sessione   TEXT    NOT NULL DEFAULT '',            -- la pagina di pagamento di Stripe (cs_…)
  pagamento  TEXT    NOT NULL DEFAULT '',            -- il pagamento di Stripe (pi_…)
  pagato     TEXT,                                   -- quando Stripe ha detto che è pagato
  pagato_centesimi INTEGER,                          -- quanto ha detto Stripe
  email_pagamento  TEXT NOT NULL DEFAULT '',         -- l'email scritta nella pagina di Stripe
  email_inviate    INTEGER NOT NULL DEFAULT 0,       -- 1 quando l'ordine è partito per email (una volta sola)
  paese      TEXT    NOT NULL DEFAULT '',
  -- la miniatura della camicia per le email (src/configuratore/miniatura.js): JPEG in base64, allegato alle email
  -- dell'ordine e tolto appena partite. Sul database già esistente si aggiunge con db/ordini-miniatura.sql
  immagine   TEXT    NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS ordini_per_data ON ordini (creato DESC);
CREATE INDEX IF NOT EXISTS ordini_per_stato ON ordini (stato, creato);
