-- Database D1 "endero": le richieste arrivate dal modulo del sito.
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
