# Endero · sito web

Sito nuovo, da zero, per Endero: manifattura campana di camicie e abbigliamento uomo, attiva dal 1996. Tre parti: storia del brand, vetrina di prodotti, configuratore per camicie su misura. Deve essere moderno, interattivo, d'impatto, e posizionarsi bene su Google.

Questo file è la memoria del progetto: si aggiorna con la skill `memoria`. I fatti sul brand stanno in `docs/ricerca-endero.md`.

## Ambito

- Dentro: solo il brand Endero (B2C, camicie e abbigliamento).
- Fuori: il brand workwear / divise da lavoro del piano marketing. Non va citato né progettato. (proprietario, 2026-11-14)
- Pubblicazione: prima su un link Cloudflare di anteprima, poi sul dominio endero.it.

## Tecnologie

- GSAP per le animazioni, Lenis per lo scorrimento morbido (rotella e dito).
- esbuild per compilare gli script.
- Cloudflare Workers con Wrangler per pubblicare, D1 per i dati del modulo, Turnstile come antispam.
- Playwright con Chromium per anteprime e controlli. È già installato nell'ambiente: non reinstallarlo.

## Metodo di lavoro

1. Prima le anteprime, poi l'ok del proprietario, poi la pubblicazione. Mai pubblicare senza ok esplicito.
2. Rispetto di `prefers-reduced-motion` e funzionamento anche senza JavaScript: l'HTML esce già completo dal build, gli script lo arricchiscono.
3. Revisioni indipendenti con più agenti prima di pubblicare.
4. Ogni pagina si controlla su desktop e su mobile.
5. Strategia con Fable 5.2, parte operativa con Opus 5.5: quando si passa da una all'altra, dirlo al proprietario così cambia modello.

## Skill del progetto

In `.claude/skills/`, versioni fissate in `skills-lock.json`.

- `memoria`: aggiorna questo file con regole, decisioni e problemi.
- `make-interfaces-feel-better`: rifinitura di ombre, bordi, tasti, animazioni. Per i pannelli del configuratore.
- `break-ui`: prova le pagine coi casi peggiori (nomi lunghi, prezzi enormi, nessuna opzione).
- `animate`: costruire un'animazione nuova.
- `review-animations`: revisione delle animazioni. Si attiva solo se la lancia il proprietario con `/review-animations`.
- `mobile-native`: uso comodo dal telefono.

## Regole

- Nei testi del sito entrano solo fatti confermati dal proprietario. Niente date, numeri, indirizzi o storie inventati o presi da directory. Perché: online i dati su Endero sono discordanti e il sito diventa la fonte ufficiale.
- SEO strutturale: una pagina per ogni intento di ricerca, URL in italiano leggibili, un solo H1, title e description unici, dati strutturati, sitemap, reindirizzamenti dai vecchi URL PrestaShop.
- Lingua del sito e del lavoro: italiano.

## Decisioni

- 2026-11-14 · Skill installate nel repository e non nella home. Perché: il container è effimero, solo il repository resta.
- 2026-11-14 · `memoria` scritta da noi. Perché: non esiste una skill pubblica con questo nome e questa funzione.

## Problemi già incontrati

- 2026-11-14 · `enderomoda.com` non risolve. Causa: dominio non attivo o fuori dalla rete consentita. Soluzione: non riprovare, chiedere al proprietario se serve.
- 2026-11-14 · `web.archive.org` e `endero.wheree.com` non si leggono dall'ambiente. Soluzione: usare la ricerca web o chiedere il contenuto al proprietario.
- 2026-11-14 · Instagram non è leggibile senza accesso. Soluzione: farsi dare nome utente e contenuti dal proprietario.

## Domande aperte

Poste al proprietario il 2026-11-14, in attesa di risposta.

- Il configuratore si chiude con una richiesta o con un pagamento online? Serve per: architettura, database, pagine legali.
- La vetrina vende online o rimanda a contatto e WhatsApp? Il negozio PrestaShop attuale si spegne? Serve per: struttura delle pagine prodotto.
- Elenco ufficiale di sede, laboratorio e negozi, con orari, telefono e numero WhatsApp. Serve per: contatti, pagine negozio, local SEO.
- Opzioni del su misura (colli, polsi, vestibilità, dettagli, tessuti), prezzi "a partire da", tempi di consegna. Serve per: configuratore.
- Modi di presa misure al lancio: guidata da casa, camicia campione, appuntamento in negozio. Serve per: ultimo passo del configuratore.
- Chi riceve le richieste e come (email, WhatsApp, CRM). Serve per: Worker del modulo.
- Storia confermata: 1996, fondatore, origine del nome, 1,3 milioni di capi, rientro della produzione in Italia. Serve per: pagina storia.
- Solo uomo o anche donna? Solo italiano o anche inglese? Serve per: struttura e URL.
- Logo vettoriale, colori ufficiali, foto e video disponibili, eventuale nuovo servizio fotografico. Serve per: direzione creativa.
- Dati legali (ragione sociale, partita IVA, sede legale), testi privacy e cookie, ID di GA4 e Meta Pixel. Serve per: footer, banner, tracciamento.
- Account Cloudflare e gestione del dominio endero.it. Serve per: anteprima e messa online.
- Nome utente Instagram e altri profili. Serve per: link e contenuti.
