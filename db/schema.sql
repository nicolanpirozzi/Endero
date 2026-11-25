-- Database D1 "endero": le richieste arrivate dal modulo del sito e gli ordini del configuratore.
-- In locale:  npm run db:locale
-- Online:     npx wrangler d1 execute endero --remote --file db/schema.sql   (solo dopo l'ok alla pubblicazione)

CREATE TABLE IF NOT EXISTS richieste (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  creata     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  tipo       TEXT    NOT NULL DEFAULT 'contatto',   -- presa-misure, contatto, rivenditore
  nome       TEXT    NOT NULL,
  telefono   TEXT    NOT NULL,
  email      TEXT    NOT NULL DEFAULT '',
  giorno     TEXT    NOT NULL DEFAULT '',            -- giorno preferito, AAAA-MM-GG
  fascia     TEXT    NOT NULL DEFAULT '',
  messaggio  TEXT    NOT NULL DEFAULT '',
  dettagli   TEXT    NOT NULL DEFAULT '',            -- JSON con i campi propri di un tipo (rivenditore: attività, città, interessi…)
  pagina     TEXT    NOT NULL DEFAULT '',            -- da quale pagina è partita
  paese      TEXT    NOT NULL DEFAULT '',
  gestita    INTEGER NOT NULL DEFAULT 0,             -- 1 quando Endero ha ricontattato la persona
  -- telefono ed email come si confrontano (worker/conservazione.mjs): servono a cancellare le richieste
  -- 24 mesi dopo l'ultima della stessa persona, come promette l'informativa privacy
  chiave_telefono TEXT NOT NULL DEFAULT '',
  chiave_email    TEXT NOT NULL DEFAULT ''
);
-- Un database locale fatto prima del 2026-11-20 non ha le due colonne chiave: si cancella e si rifà con db:locale.

CREATE INDEX IF NOT EXISTS richieste_per_data ON richieste (creata DESC);
CREATE INDEX IF NOT EXISTS richieste_per_telefono ON richieste (chiave_telefono, creata);
CREATE INDEX IF NOT EXISTS richieste_per_email ON richieste (chiave_email, creata);

-- Gli ordini del configuratore (worker/ordine.mjs): la stessa tabella di db/ordini.sql, che si lancia da sola sul
-- database che esiste già. Non entrano nella pulizia dei 24 mesi: sono documenti contabili (quanto tenerli lo dice
-- il consulente).
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
  paese      TEXT    NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS ordini_per_data ON ordini (creato DESC);
CREATE INDEX IF NOT EXISTS ordini_per_stato ON ordini (stato, creato);
