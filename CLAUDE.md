# Endero · sito web

Sito nuovo, da zero, per Endero: manifattura campana di camicie e abbigliamento uomo, attiva dal 1996. Quattro parti: storia del brand, vetrina di prodotti, configuratore per camicie su misura, sezione "Diventa rivenditore". Deve essere moderno, interattivo, d'impatto, e posizionarsi bene su Google.

Questo file è la memoria del progetto: si aggiorna con la skill `memoria`.

- Cosa costruire e come: `docs/direzione-creativa.md`. Si parte da lì.
- Film 3D dell'apertura: scena e calcolo in `film/`, lettore in `src/apertura/`, pezzi pronti in `public/film/`, pagina di prova `anteprima/apertura.html` (si apre con un server locale dalla radice del progetto). Approvato dal proprietario il 2026-11-15: non si rifà, si integra nella pagina iniziale. Dettagli al punto 4 della direzione creativa.
- Fatti sul brand e fonti: `docs/ricerca-endero.md`.
- Logo vettoriale: `brand/logo/`.

## Ambito

- Dentro: solo il brand Endero (camicie e abbigliamento uomo): vendita ai privati e sezione "Diventa rivenditore".
- Da costruire più avanti: la sezione "Diventa rivenditore", per chi compra da Endero per rivendere. Il proprietario l'ha chiesta e ha detto di non ragionarci ora (2026-11-14): va prevista nella struttura del sito e nel menu, ma contenuti e funzioni si definiscono con lui quando la riapre. Non c'entra con il brand workwear, che resta fuori.
- In sospeso: il configuratore. Il proprietario ha chiesto di metterlo da parte e pensarci dopo (2026-11-14). Non fare domande né lavoro sul configuratore finché non lo riapre lui. Le decisioni già prese restano valide. Si lavora prima su pagina iniziale, storia e vetrina.
- Fuori: il brand workwear / divise da lavoro del piano marketing. Non va citato né progettato. (proprietario, 2026-11-14)
- Pubblicazione: prima su un link Cloudflare di anteprima, poi sul dominio endero.it.

## Tecnologie

- GSAP per le animazioni complesse (tutti i plugin sono gratuiti dal 2025), Lenis per lo scorrimento morbido (rotella e dito, `syncTouch` acceso perché il proprietario l'ha chiesto anche per il dito: da provare sul telefono vero). Comparse e piccoli movimenti con transizioni CSS: non serve una libreria per una dissolvenza.
- esbuild per compilare gli script. Sito in locale: `npm run anteprima` (porta 8766) o `npm run worker` (Worker e D1 locali, porta 8787, modulo attivo). Struttura dei file e comandi al punto 7 della direzione creativa.
- Cloudflare Workers con Wrangler per pubblicare, D1 per i dati del modulo, Turnstile come antispam.
- Playwright con Chromium per anteprime e controlli. È già installato nell'ambiente: non reinstallarlo. `tools/cattura.js` fotografa una pagina a schermate, desktop o mobile; `tools/filma.js` ne registra un video mentre scorre, da mandare al proprietario per l'approvazione.

## Metodo di lavoro

1. Prima le anteprime, poi l'ok del proprietario, poi la pubblicazione. Mai pubblicare senza ok esplicito.
2. Rispetto di `prefers-reduced-motion` e funzionamento anche senza JavaScript: l'HTML esce già completo dal build, gli script lo arricchiscono.
3. Revisioni indipendenti con più agenti prima di pubblicare.
4. Ogni pagina si controlla su desktop e su mobile.
5. Strategia con Fable 5.2, parte operativa con Opus 5.5: quando si passa da una all'altra, dirlo al proprietario così cambia modello.

## Skill del progetto

In `.claude/skills/`, versioni fissate in `skills-lock.json`.

- `memoria`: aggiorna questo file con regole, decisioni e problemi.
- `make-interfaces-feel-better`: rifinitura di ombre, bordi, tasti, animazioni.
- `break-ui`: prova le pagine coi casi peggiori (nomi lunghi, prezzi enormi, nessuna opzione).
- `animate`: costruire un'animazione nuova.
- `review-animations`: revisione delle animazioni. Si attiva solo se la lancia il proprietario con `/review-animations`.
- `mobile-native`: uso comodo dal telefono.

## Regole

- Le domande al proprietario sempre a risposta multipla, con il campo "Altro" per scrivere: usare lo strumento delle domande, mai elenchi di domande aperte in chat. Perché: risponde più in fretta e senza ambiguità. (proprietario, 2026-11-14)
- Il sito deve essere "praticamente uguale" al riferimento `https://www.seve.app/pr`: stessa struttura, proporzioni e movimento, sezione per sezione. Non si copiano immagini, testi, codice né il carattere. (proprietario, 2026-11-14)
- Nei testi entrano solo fatti confermati dal proprietario. Niente date, numeri, indirizzi, storie o recensioni inventati o presi da directory. Perché: online i dati su Endero sono discordanti e il sito diventa la fonte ufficiale.
- Fatti confermati: attivi dal 1996; oltre 1,3 milioni di capi prodotti; oltre 2.500 negozi serviti; il nome Endero viene da Ennio De Rosa. (proprietario, 2026-11-14)
- Della produzione si dice solo "fatto in Italia". Non citare mai la produzione passata all'estero. (proprietario, 2026-11-14)
- Unica sede da pubblicare: Giugliano in Campania, Viale del Toro 22. Gli altri indirizzi che si trovano online non vanno citati. (proprietario, 2026-11-14)
- Solo foto e video veri di Endero. Niente immagini o video generati con l'AI né di repertorio: il proprietario ha scartato anche il suo video AI. Finché il materiale non arriva, riquadri segnaposto. (proprietario, 2026-11-14)
- Email pubblica `info@endero.it`. L'indirizzo personale della casella del proprietario non va mai nel sito né nel repository: solo nella configurazione del Worker. (proprietario, 2026-11-14)
- SEO strutturale: una pagina per ogni intento di ricerca, indirizzi in italiano leggibili, un solo H1, title e description unici, dati strutturati, sitemap, reindirizzamenti dai vecchi indirizzi PrestaShop.
- Lingua del sito e del lavoro: italiano.

## Decisioni

Sito e aspetto

- 2026-11-14 · Apertura "La cucitura": scorrere è cucire. La cucitura racconta la storia e ricama il logo, poi il telo si solleva sul sito. Si rivede completa a ogni visita, con link per saltarla. Scartate: versione breve automatica e video con logo in sovrimpressione.
- 2026-11-14 · L'apertura è un film 3D realistico calcolato in anticipo con Blender, che avanza con lo scorrimento, preceduto da un caricatore. Il proprietario ha bocciato la versione disegnata in SVG ("non deve essere una cosa fatta in vettoriale e schifosa in 2D"): non riproporla. Scartati anche il 3D calcolato in diretta nel browser e le riprese vere.
- 2026-11-14 · Regia del film: si apre in primo piano sull'ago, poi la camera sale alla vista dall'alto dal lato di chi cuce, con la macchina in piedi al centro e le scritte ricamate a destra e a sinistra della cucitura; alla fine la macchina ricama il logo. Macchina essenziale, solo parti in acciaio.
- 2026-11-15 · Scritte ricamate nel tessuto e frasi sotto, in testo vero: "1996" ("Inizia la storia di Endero"), "1,3" con "MILIONI" sotto ("di capi prodotti"), "2.500" ("negozi serviti"), "SARTORIA" ("italiana contemporanea"). Il proprietario non vuole "M" né "MLN" (potrebbero non essere capiti), ha tolto "in trent'anni" e ha bocciato "ITALIA / Fatto in Italia" ("fa schifo"): non riproporli. "Sartoria italiana contemporanea" è una formula sua, si può usare nei testi del sito.
- 2026-11-15 · Film dell'apertura approvato dal proprietario sui video di computer e telefono. A logo finito la macchina esce dal basso dello schermo, poi la pagina prosegue.
- 2026-11-14 · Blu del tessuto nel film: scelto da noi su mandato del proprietario ("un blu scuro che funziona con la trama e le ombre"). Luce calda in controluce con ombre profonde, ricamo lucido, tessuto con pieghe e grinze.
- 2026-11-14 · Il blu del logo `#0f285e` prende il posto del nero del riferimento: testi, pillole, piè di pagina. Fondo chiaro caldo.
- 2026-11-14 · Carattere: alternativa gratuita a Field Gothic Wide, cioè Archivo variabile con asse della larghezza, ospitato sul sito. Scartato l'acquisto dell'originale.
- 2026-11-14 · Logo: resta quello attuale. Vettoriale ricostruito da noi dall'immagine a 320 px e approvato così; se arriva un originale migliore si sostituisce.
- 2026-11-14 · Tono: manifattura italiana accessibile. Elegante e curato ma concreto, racconta il mestiere, prezzi chiari. Scartati: atelier di lusso e taglio giovane da moda.
- 2026-11-14 · Sito statico a più pagine generato da uno script Node, senza framework. Perché: HTML completo senza JavaScript, controllo del codice per Google, peso minimo.
- 2026-11-14 · Solo uomo. Italiano, con struttura pronta per l'inglese: testi separati dal codice, `hreflang` predisposto.
- 2026-11-14 · Una sola sede, quindi una sola pagina "dove siamo" con dati di attività locale.
- 2026-11-15 · Pagina iniziale approvata dal proprietario sui video ("Approvata, avanti"): struttura come il riferimento, sezione per sezione. Testi in `contenuti/it/`, segnaposto `[[ ]]` evidenziati in giallo in anteprima. Ogni anteprima esce con noindex e robots chiuso; solo `--pubblico` apre a Google.
- 2026-11-15 · Nella pagina iniziale niente sezione "Dove siamo" con foto: l'indirizzo sta solo nel piè di pagina e nella pagina `/dove-siamo/` (proprietario). La voce "Dove siamo" del selettore porta al piè di pagina. Il pezzo con foto e pannello della sede resta in `src/parti/sede.mjs` per quella pagina. Scartato: sezione dopo la storia (proposta nostra).
- 2026-11-15 · I nomi dei tre ingressi alla collezione li decide il proprietario quando manda i prodotti: fino ad allora "Camicie", "Camicioni", "Su misura" restano segnaposto.
- 2026-11-14 · La collezione parte come vetrina, il carrello arriva dopo. Prodotti come dati (prezzo, varianti, taglie) così la vendita si aggiunge senza rifare le schede.

Contatti, legale, tracciamento

- 2026-11-14 · Contatti pubblici: WhatsApp 333 854 8712, `info@endero.it`, modulo di contatto (Turnstile, messaggi su D1). Il telefono fisso non è stato scelto: interpretazione nostra, non si pubblica.
- 2026-11-14 · Email: invii con Resend, risposte inoltrate alla casella del proprietario. Richiede di modificare i DNS di endero.it; fino ad allora il modulo salva solo su D1.
- 2026-11-14 · Dati legali, informativa privacy e cookie: bozza nostra, da far validare a Endero o al suo consulente prima della messa online.
- 2026-11-14 · Tracciamento: banner dei consensi ed eventi predisposti, codici di Google Analytics e Meta Pixel inseriti dopo. Nessuno script di terze parti parte prima del consenso.
- 2026-11-14 · Esiste già un account Cloudflare. La chiave si chiede con il modulo sicuro delle credenziali quando serve la prima anteprima, mai in chat.

Configuratore (in sospeso)

- 2026-11-14 · Si chiude con un pagamento online: Stripe, importo intero all'ordine, pagina di pagamento ospitata da Stripe. Il sarto verifica le misure prima del taglio e scrive al cliente su WhatsApp se qualcosa non torna.
- 2026-11-14 · Presa misure in due modi: guidata da casa (si paga online) e appuntamento in sede (si prenota soltanto, misure e pagamento in sede).
- 2026-11-14 · Ordini a Endero per email e in un pannello riservato sul sito. Niente WhatsApp automatico né CRM al lancio.

Strumenti

- 2026-11-14 · Skill installate nel repository e non nella home. Perché: il container è effimero, solo il repository resta.
- 2026-11-14 · `memoria` scritta da noi. Perché: non esiste una skill pubblica con questo nome e questa funzione.

## Problemi già incontrati

- 2026-11-14 · `enderomoda.com` non risolve. Causa: dominio non attivo o fuori dalla rete consentita. Soluzione: non riprovare, chiedere al proprietario se serve.
- 2026-11-14 · `web.archive.org` e `endero.wheree.com` non si leggono dall'ambiente. Soluzione: usare la ricerca web o chiedere il contenuto al proprietario.
- 2026-11-14 · Instagram non è leggibile senza accesso. Soluzione: farsi dare nome utente e contenuti dal proprietario.
- 2026-11-14 · Il riferimento è un sito Framer che disegna i contenuti allo scorrimento: una schermata unica a pagina intera esce vuota. Soluzione: `tools/cattura.js`, che scorre e fotografa una schermata alla volta.
- 2026-11-14 · Blender si usa come modulo Python, senza interfaccia: `uv venv --python 3.13` e poi `uv pip install bpy numpy pillow shapely fonttools brotli` (1,1 GB). Solo processore, 4 core: circa 2 minuti per un fotogramma 1440×900. In `film/` va importato `bpy` prima di `bmesh`. Due calcoli insieme si rallentano a vicenda e un comando in background dura al massimo 2 ore: i lotti di `film/produci.py` si rilanciano senza perdere nulla, saltano i file già fatti.
- 2026-11-14 · In Blender 5 il nodo Mix ha più prese con lo stesso nome ("A", "B", "Result"): sceglierle per tipo, non per nome (vedi `mescola` in `film/scena.py`). Le immagini generate vanno salvate su disco in EXR e ricaricate, altrimenti restano nere.
- 2026-11-14 · Acciaio che sembra vetro scuro e tessuto velato di grigio. Causa: un solo ambiente per luce e riflessi, e troppa "peluria" (sheen) in controluce. Soluzione già in `film/scena.py`: due ambienti scelti con il nodo percorso della luce, sheen basso.
- 2026-11-14 · La resa dei toni "AgX" ingrigisce i fili bianchi. Soluzione: resa "Standard".
- 2026-11-15 · Sul telefono la testata esce dallo schermo e tutto sembra rimpicciolito. Causa: un elemento che sporge di lato (il carosello) allarga la pagina e il browser si adatta. Soluzione: ritagliare la sezione con `overflow: clip` e controllare che la larghezza della pagina resti 390 su iPhone 14.
- 2026-11-15 · Gli strumenti in `tools/` sono CommonJS: `package.json` non deve avere `"type": "module"`, gli script di build sono `.mjs`.
- 2026-11-14 · Nell'ambiente non c'è `potrace`. Soluzione per vettorializzare: pacchetto npm `potrace` dopo aver ingrandito 12 volte e sfocato l'immagine con Pillow.

## Domande aperte

Da chiudere con il proprietario, sempre a risposta multipla.

- Foto, video, nomi, descrizioni e prezzi dei prodotti, e i nomi dei tre ingressi alla collezione: li carica il proprietario. Elenco di cosa serve in `docs/direzione-creativa.md`, punto 8.
- Chi gestisce il dominio endero.it e i suoi DNS. Serve per: messa online ed email, non per l'anteprima.
- Orari della sede di Viale del Toro. Serve per: pagina dove siamo, dati di attività locale.
- Prezzo "a partire da" e testi delle domande frequenti. Serve per: pagina iniziale e pagina su misura.
- Testi della pagina iniziale, bozze nostre in `contenuti/it/home.json`, da approvare prima della messa online. Serve per: messa online.
- Racconto della storia oltre ai quattro fatti confermati: come è nata, tappe, persone. Serve per: pagina storia.
- Conferma di ragione sociale, partita IVA e sede legale (quelli nel dossier vengono da directory). Serve per: testi legali.
- Il negozio PrestaShop attuale si spegne al lancio? Serve per: reindirizzamenti.
- Nome utente Instagram e altri profili. Serve per: link nel piè di pagina.
- (Da aprire con il proprietario quando lo dice lui) "Diventa rivenditore": cosa offre la sezione, chi può fare richiesta, che dati si chiedono, a chi arrivano le richieste. Serve per: progettare la sezione.
- (In sospeso con il configuratore) Opzioni del su misura, tempi di consegna, email che riceve gli ordini.
