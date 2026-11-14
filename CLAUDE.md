# Endero · sito web

Sito nuovo, da zero, per Endero: manifattura campana di camicie e abbigliamento uomo, attiva dal 1996. Tre parti: storia del brand, vetrina di prodotti, configuratore per camicie su misura. Deve essere moderno, interattivo, d'impatto, e posizionarsi bene su Google.

Questo file è la memoria del progetto: si aggiorna con la skill `memoria`. I fatti sul brand stanno in `docs/ricerca-endero.md`.

## Ambito

- Dentro: solo il brand Endero (B2C, camicie e abbigliamento).
- In sospeso: il configuratore. Il proprietario ha chiesto di metterlo da parte e pensarci dopo (2026-11-14). Non fare domande né lavoro sul configuratore finché non lo riapre lui. Le decisioni già prese restano valide. Si lavora prima su storia e vetrina.
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
- Della produzione si dice solo "fatto in Italia". Non citare mai la produzione passata all'estero. (proprietario, 2026-11-14)
- Unica sede da pubblicare: Giugliano in Campania, Viale del Toro 22. Gli altri indirizzi che si trovano online (Villaricca, Pomigliano d'Arco, Calvizzano, Avellino, Corso Campano) non vanno citati. (proprietario, 2026-11-14)
- Fatti sulla storia confermati e utilizzabili nei testi: attivi dal 1996; oltre 1,3 milioni di capi prodotti; oltre 2.500 negozi serviti; il nome Endero viene da Ennio De Rosa. (proprietario, 2026-11-14)
- Le domande al proprietario sempre a risposta multipla, con il campo "Altro" per scrivere: usare lo strumento delle domande, mai elenchi di domande aperte in chat. Perché: risponde più in fretta e senza ambiguità. (proprietario, 2026-11-14)

## Decisioni

- 2026-11-14 · Skill installate nel repository e non nella home. Perché: il container è effimero, solo il repository resta.
- 2026-11-14 · `memoria` scritta da noi. Perché: non esiste una skill pubblica con questo nome e questa funzione.
- 2026-11-14 · Il configuratore si chiude con un pagamento online, non con una semplice richiesta. Scelta del proprietario (la proposta iniziale era la richiesta). Conseguenze: sistema di pagamento, ordini salvati su D1, condizioni di vendita, email di conferma.
- 2026-11-14 · Pagamenti con Stripe, importo intero all'ordine. Il sarto verifica le misure prima del taglio e contatta il cliente su WhatsApp se qualcosa non torna. I dati delle carte non passano mai dal sito: pagina di pagamento ospitata da Stripe.
- 2026-11-14 · Gli ordini arrivano a Endero per email e in un pannello ordini riservato sul sito, protetto da accesso. Niente WhatsApp automatico né CRM al lancio.
- 2026-11-14 · Presa misure al lancio in due modi: guidata da casa e appuntamento in negozio. Scartati per ora: camicia campione e taglia standard.
- 2026-11-14 · Chi sceglie la presa misure in negozio prenota soltanto: misure e pagamento avvengono in sede. Stripe serve solo al percorso "guidata da casa".
- 2026-11-14 · Una sola sede aperta al pubblico, quindi una sola pagina "dove siamo" con dati strutturati di attività locale, niente pagine per singolo negozio.
- 2026-11-14 · Tono del sito: manifattura italiana accessibile. Elegante e curato ma concreto, racconta il mestiere, prezzi chiari. Scartati: atelier di lusso (stona con i prezzi) e taglio giovane da moda.
- 2026-11-14 · Il logo resta quello attuale (scritta corsiva con la E ovale). Non esiste il vettoriale: va ridisegnato in SVG partendo dall'immagine più grande che fornisce il proprietario.
- 2026-11-14 · Foto e video professionali esistono già e li carica il proprietario: niente immagini generate o di repertorio nelle pagine definitive.
- 2026-11-14 · Contatti pubblici: WhatsApp aziendale, email e modulo di contatto (Turnstile, messaggi su D1). Il telefono fisso non è stato scelto: interpretazione nostra, non si pubblica.
- 2026-11-14 · Footer legale, informativa privacy e informativa cookie: bozza scritta da noi, da far validare a Endero o al suo consulente prima della messa online.
- 2026-11-14 · Tracciamento: banner dei consensi ed eventi predisposti subito, codici di Google Analytics e Meta Pixel inseriti dopo. Nessuno script di terze parti parte prima del consenso.
- 2026-11-14 · Esiste già un account Cloudflare. La chiave di accesso si chiede con il modulo sicuro delle credenziali quando serve la prima anteprima, mai in chat.
- 2026-11-14 · La collezione parte come vetrina, il carrello arriva in una seconda fase. Le schede prodotto vanno costruite già con prezzo, varianti e taglie come dati, così la vendita si aggiunge senza rifarle.
- 2026-11-14 · Solo uomo. Un solo modello di base nel configuratore.
- 2026-11-14 · Sito in italiano con struttura pronta per l'inglese: testi separati dal codice, URL e `hreflang` predisposti.

## Problemi già incontrati

- 2026-11-14 · `enderomoda.com` non risolve. Causa: dominio non attivo o fuori dalla rete consentita. Soluzione: non riprovare, chiedere al proprietario se serve.
- 2026-11-14 · `web.archive.org` e `endero.wheree.com` non si leggono dall'ambiente. Soluzione: usare la ricerca web o chiedere il contenuto al proprietario.
- 2026-11-14 · Instagram non è leggibile senza accesso. Soluzione: farsi dare nome utente e contenuti dal proprietario.

## Domande aperte

Da chiudere con il proprietario, sempre a risposta multipla.

- Siti di riferimento per stile e struttura: li manda il proprietario. Serve per: direzione creativa.
- Il negozio PrestaShop attuale si spegne al lancio? Serve per: reindirizzamenti.
- Numero WhatsApp aziendale, indirizzo email pubblico e orari della sede di Viale del Toro. Serve per: contatti, local SEO.
- (In sospeso con il configuratore) Opzioni del su misura, prezzi "a partire da", tempi di consegna, email che riceve gli ordini.
- Racconto della storia oltre ai quattro fatti confermati: come è nata, tappe, persone. Serve per: pagina storia.
- Immagine del logo alla massima risoluzione disponibile, foto e video da caricare, descrizioni dei prodotti. Serve per: direzione creativa e vetrina.
- Conferma di ragione sociale, partita IVA e sede legale (quelli nel dossier vengono da directory). Serve per: bozza dei testi legali.
- Chi gestisce il dominio endero.it e i suoi DNS. Serve per: messa online, non per l'anteprima.
- Nome utente Instagram e altri profili. Serve per: link e contenuti.
