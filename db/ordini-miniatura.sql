-- La miniatura della camicia nelle email dell'ordine (2026-11-27, src/configuratore/miniatura.js): due colonne nuove
-- nella tabella degli ordini già esistente. Si lancia una volta sola, prima di pubblicare il Worker che le usa (il
-- Worker regge anche senza: l'ordine parte e l'email mette la foto di sempre):
--   npx wrangler d1 execute endero-sito --remote --config wrangler.sito.toml --file db/ordini-miniatura.sql
ALTER TABLE ordini ADD COLUMN immagine TEXT NOT NULL DEFAULT '';
ALTER TABLE ordini ADD COLUMN immagine_chiave TEXT NOT NULL DEFAULT '';
