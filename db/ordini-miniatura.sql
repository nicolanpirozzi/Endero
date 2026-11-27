-- La miniatura della camicia nelle email dell'ordine (2026-11-27, src/configuratore/miniatura.js): una colonna nuova
-- nella tabella degli ordini già esistente. Si lancia una volta sola, prima di pubblicare il Worker che la usa (il
-- Worker regge anche senza: l'ordine parte e l'email mette la foto di sempre):
--   npx wrangler d1 execute endero-sito --remote --config wrangler.sito.toml --file db/ordini-miniatura.sql
ALTER TABLE ordini ADD COLUMN immagine TEXT NOT NULL DEFAULT '';
