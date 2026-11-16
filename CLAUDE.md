# Endero · sito web

Sito nuovo, da zero, per Endero: manifattura campana di camicie e abbigliamento uomo, attiva dal 1996. Quattro parti: storia del brand, vetrina di prodotti, configuratore per camicie su misura, sezione "Diventa rivenditore". Deve essere moderno, interattivo, d'impatto, e posizionarsi bene su Google.

Questo file è la memoria del progetto: si aggiorna con la skill `memoria`.

- Cosa costruire e come: `docs/direzione-creativa.md`. Si parte da lì: struttura a più pagine al punto 10, qualità al punto 11, configuratore al punto 12.
- Film 3D dell'apertura: scena e calcolo in `film/`, lettore in `src/apertura/`, pezzi pronti in `public/film/`, pagina di prova `anteprima/apertura.html` (si apre con un server locale dalla radice del progetto). Approvato dal proprietario il 2026-11-15: non si rifà, si integra nella pagina iniziale. Dettagli al punto 4 della direzione creativa.
- Camicia del configuratore: è un film calcolato con Blender dalla camicia comprata dal proprietario. Strumenti in `camicia/film/` (scena, telaio, fisica della stoffa, fotogrammi, montaggio), file pronti in `public/camicia/`, lettore in `src/configuratore/`, controllo `tools/prova-camicia.js`. Il file comprato non è nel repository: sta nella cartella "Endero" del Google Drive del proprietario (`Clothing_Hanging_Shirt-Button_01_Blender.zip`). Come si rifà: punto 12 della direzione creativa.
- Fatti sul brand e fonti: `docs/ricerca-endero.md`.
- Logo vettoriale: `brand/logo/`.

## Ambito

- Dentro: solo il brand Endero (camicie e abbigliamento uomo): vendita ai privati e sezione "Diventa rivenditore".
- "Diventa rivenditore", per chi compra da Endero per rivendere: pagina costruita il 2026-11-15 (punto 9 della direzione creativa, testi in `contenuti/it/diventa-rivenditore.json`), da far approvare al proprietario. Non c'entra con il brand workwear, che resta fuori.
- Configuratore: riaperto dal proprietario il 2026-11-15, da costruire a passi; ogni passo si mostra e si approva prima del successivo. Le decisioni del 2026-11-14 restano valide. Opzioni, prezzi e campi da compilare li manda lui: non inventarli e non costruire passi che non ha chiesto.
- Fuori: il brand workwear / divise da lavoro del piano marketing. Non va citato né progettato. (proprietario, 2026-11-14)
- Pubblicazione: prima su un link Cloudflare di anteprima, poi sul dominio endero.it. L'anteprima è online dal 2026-11-15 su `https://endero-anteprima.orange-truth-81a7.workers.dev` (non indicizzabile, moduli che non salvano): il proprietario la manda al fondatore. Dalla sera del 15 mostra la struttura a più pagine e il configuratore. Per aggiornarla: `URL_ANTEPRIMA=<indirizzo> node build/costruisci.mjs && npx wrangler deploy --config wrangler.anteprima.toml`.

## Tecnologie

- Nessuna libreria 3D nel sito: apertura e camicia del configuratore sono film calcolati prima con Blender. three.js è uscito con la camicia in diretta (2026-11-16): non rimetterlo.
- GSAP per le animazioni complesse (tutti i plugin sono gratuiti dal 2025), Lenis per lo scorrimento morbido (rotella e dito, `syncTouch` acceso perché il proprietario l'ha chiesto anche per il dito: da provare sul telefono vero). Comparse e piccoli movimenti con transizioni CSS: non serve una libreria per una dissolvenza.
- esbuild per compilare gli script. Sito in locale: `npm run anteprima` (porta 8766) o `npm run worker` (Worker e D1 locali, porta 8787, modulo attivo). Struttura dei file e comandi al punto 7 della direzione creativa.
- Cloudflare Workers con Wrangler per pubblicare, D1 per i dati del modulo, Turnstile come antispam.
- Playwright con Chromium per anteprime e controlli. È già installato nell'ambiente: non reinstallarlo. `tools/cattura.js` fotografa una pagina a schermate, desktop o mobile; `tools/filma.js` ne registra un video mentre scorre, da mandare al proprietario per l'approvazione. `tools/prova-camicia.js` controlla la camicia del configuratore: mouse, dito, formati di schermo, movimento ridotto.

## Metodo di lavoro

1. Prima le anteprime, poi l'ok del proprietario, poi la pubblicazione. Mai pubblicare senza ok esplicito.
2. Rispetto di `prefers-reduced-motion` e funzionamento anche senza JavaScript: l'HTML esce già completo dal build, gli script lo arricchiscono.
3. Revisioni indipendenti con più agenti prima di pubblicare.
4. Ogni pagina si controlla su desktop e su mobile.
5. Strategia con Fable 5.2, parte operativa con Opus 5.5: quando si passa da una all'altra, dirlo al proprietario così cambia modello. Il 3D (film, camicia) lo fa Fable. Fable può anche mettere Opus al lavoro in parallelo come agente in una copia di lavoro separata, e poi controllare e unire il risultato: così è nata la struttura a più pagine.

## Skill del progetto

In `.claude/skills/`, versioni fissate in `skills-lock.json`.

- `memoria`: aggiorna questo file con regole, decisioni e problemi.
- `make-interfaces-feel-better`: rifinitura di ombre, bordi, tasti, animazioni.
- `break-ui`: prova le pagine coi casi peggiori (nomi lunghi, prezzi enormi, nessuna opzione).
- `animate`: costruire un'animazione nuova.
- `review-animations`: revisione delle animazioni. Si attiva solo se la lancia il proprietario con `/review-animations`.
- `mobile-native`: uso comodo dal telefono.
- `design-taste-frontend`: aggiunta dal proprietario il 2026-11-15 per rifinire UX e UI. Si usa come metro di qualità e per i suoi controlli (`npm run gusto`), non come kit: dove contraddice una scelta approvata vince l'approvato. Cosa si prende e cosa no: punto 11 della direzione creativa. Non armare il suo blocco di fine lavoro (`gate.mjs --start`) e non usare `photos.mjs`, che scarica foto di repertorio.

## Regole

- Le domande al proprietario sempre a risposta multipla, con il campo "Altro" per scrivere: usare lo strumento delle domande, mai elenchi di domande aperte in chat. Perché: risponde più in fretta e senza ambiguità. (proprietario, 2026-11-14)
- Quando affida un lavoro lungo, tutte le domande vanno fatte subito, prima di cominciare. Perché: poi se ne va e non può rispondere ("fammi tutte le domande ora prima di iniziare a lavorare"). (proprietario, 2026-11-15)
- Il movimento lo giudica provandolo dal vivo, non in video: "Voglio provarlo per dirti se va bene o meno". Prima di un calcolo definitivo di ore si mette sull'anteprima una versione di prova a qualità ridotta e si aspetta il suo ok. Quando la domanda è "quanto" (più lento, più ampio), gli si danno due o tre varianti da provare ai loro link e sceglie lui. (proprietario, 2026-11-16)
- Il sito deve essere "praticamente uguale" al riferimento `https://www.seve.app/pr`: stessa struttura, proporzioni e movimento, sezione per sezione. Non si copiano immagini, testi, codice né il carattere. (proprietario, 2026-11-14) Dal 2026-11-15 il sito è a più pagine per sua scelta: del riferimento restano aspetto, proporzioni e movimento dei pezzi, non l'ordine in una pagina unica.
- Nei testi entrano solo fatti confermati dal proprietario. Niente date, numeri, indirizzi, storie o recensioni inventati o presi da directory. Perché: online i dati su Endero sono discordanti e il sito diventa la fonte ufficiale. Vale anche se a chiedere di inventare è il proprietario (2026-11-15, storia e foto d'archivio "in modo credibile"): gli si dice di no e gli si propone cosa mostrare di vero.
- Fatti confermati: attivi dal 1996; oltre 1,3 milioni di capi prodotti; oltre 2.500 negozi serviti; il nome Endero viene da Ennio De Rosa. (proprietario, 2026-11-14)
- Della produzione si dice solo "fatto in Italia". Non citare mai la produzione passata all'estero. (proprietario, 2026-11-14)
- Unica sede da pubblicare: Giugliano in Campania, Viale del Toro 22. Gli altri indirizzi che si trovano online non vanno citati. (proprietario, 2026-11-14)
- Solo foto e video veri di Endero. Niente immagini o video generati con l'AI né di repertorio: il proprietario ha scartato anche il suo video AI. Finché il materiale non arriva, riquadri segnaposto. (proprietario, 2026-11-14)
- Email pubblica `info@endero.it`. L'indirizzo personale della casella del proprietario non va mai nel sito né nel repository: solo nella configurazione del Worker. (proprietario, 2026-11-14)
- SEO strutturale: una pagina per ogni intento di ricerca, indirizzi in italiano leggibili, un solo H1, title e description unici, dati strutturati, sitemap, reindirizzamenti dai vecchi indirizzi PrestaShop.
- Lingua del sito e del lavoro: italiano.

## Decisioni

Sito e aspetto

- 2026-11-14 · Apertura "La cucitura": scorrere è cucire. La cucitura racconta la storia e ricama il logo, poi il telo si solleva sul sito. Si rivede completa a ogni visita. Il link "Salta l'introduzione" c'era ed è stato tolto il 2026-11-15 su richiesta del proprietario ("Elimina"): non rimetterlo; per la tastiera resta "Vai al contenuto". Scartate: versione breve automatica e video con logo in sovrimpressione.
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
- 2026-11-15 · Animazioni della pagina iniziale approvate dal proprietario. In cima all'apertura c'è un invito classico a scorrere, icona e due parole (mouse con rotella sul computer, frecce sul telefono): l'ha chiesto il proprietario perché senza non si capisce che bisogna scorrere. Non toglierlo.
- 2026-11-15 · Pagine interne costruite con i pezzi della pagina iniziale (`src/parti/sezioni.mjs`) e approvate dal proprietario: su misura, collezione, storia (poi sostituita da cultura e artigianato), dove siamo, privacy, cookie. I capi della collezione si aggiungono in `contenuti/it/prodotti.json` e la loro pagina si crea da sola; niente carrello, si chiede su WhatsApp.
- 2026-11-15 · Il fondatore ha visto l'anteprima: "gli piace e si aspetta un lavoro di alto livello". Da qui il sito a più pagine (proprietario: "un solo one-pager diventa un po' complesso"): su misura con configuratore e rivenditori hanno ciascuno la propria pagina. Scartata: pagina unica.
- 2026-11-15 · Pagina iniziale nuova: dopo l'apertura prima i prodotti, poi "Cultura e artigianato" (parole sue: "Cultura ed Artigianato") con foto che carica lui, al posto della storia. Perché: il fondatore non ha foto d'archivio né un racconto. Scartati: prima la storia, storia inventata (risposta nostra: no), sei domande al fondatore.
- 2026-11-15 · Struttura a più pagine costruita e messa sull'anteprima con l'ok del proprietario ("Sì, aggiorna l'anteprima"), sui video della pagina iniziale e le schermate dei rivenditori. Restano da fargli vedere le scelte prese costruendo: punto 10 della direzione creativa.
- 2026-11-15 · Testata (proprietario): i tre pulsanti sono icone che al passaggio del mouse diventano scritta: "Scopri la Collezione", "Diventa un Rivenditore", "Ordina la tua camicia". "La tua camicia" prende il posto di "Prenota la presa misure" e apre una finestra al centro con due strade: "Configura la tua camicia online" e "Prenota per prendere le misure in store". Sul telefono icona con la scritta "La tua camicia", più Menu. Scartati: riquadro sotto il pulsante, rimando alla pagina del su misura, sola icona sul telefono.
- 2026-11-15 · Il selettore delle sezioni va più trasparente (proprietario). Era stato scurito per il contrasto: ora è vetro chiaro con scritte blu sulle sezioni chiare e vetro blu con scritte bianche su quelle scure.
- 2026-11-15 · Scelte nostre fatte di notte, da far vedere al proprietario: "in sede" al posto del suo "in store"; testata uguale in tutte le pagine (in quella dei rivenditori non c'è più "Fai richiesta" in testata); nella pagina del configuratore niente pillola di WhatsApp.
- 2026-11-15 · Uso della skill `design-taste-frontend`: "tieni l'approvato, aggiungi il meglio" (proprietario). Scartati: seguirla fino in fondo togliendo scorrimento morbido, comparse e carosello; confronto in video.
- 2026-11-14 · La collezione parte come vetrina, il carrello arriva dopo. Prodotti come dati (prezzo, varianti, taglie) così la vendita si aggiunge senza rifare le schede.

Contatti, legale, tracciamento

- 2026-11-14 · Contatti pubblici: WhatsApp 333 854 8712, `info@endero.it`, modulo di contatto (Turnstile, messaggi su D1). Il telefono fisso non è stato scelto: interpretazione nostra, non si pubblica.
- 2026-11-14 · Email: invii con Resend, risposte inoltrate alla casella del proprietario. Richiede di modificare i DNS di endero.it; fino ad allora il modulo salva solo su D1.
- 2026-11-14 · Dati legali, informativa privacy e cookie: bozza nostra, da far validare a Endero o al suo consulente prima della messa online.
- 2026-11-14 · Tracciamento: banner dei consensi ed eventi predisposti, codici di Google Analytics e Meta Pixel inseriti dopo. Nessuno script di terze parti parte prima del consenso.
- 2026-11-14 · Esiste già un account Cloudflare. La chiave si chiede con il modulo sicuro delle credenziali quando serve la prima anteprima, mai in chat.
- 2026-11-15 · Sull'account Cloudflare del proprietario ci sono altri suoi progetti: si crea e si tocca solo ciò che si chiama `endero-…`, dopo aver guardato in sola lettura cosa esiste. La chiave data ha solo i permessi sull'account (niente domini, niente D1) e scade il 2026-11-22: per pubblicare dopo ne serve una nuova. (proprietario)
- 2026-11-15 · Il proprietario ha fatto pubblicare l'anteprima prima che finissero due delle tre revisioni, con l'accordo di aggiornarla con le loro correzioni: vale come ok ad aggiornare l'anteprima dopo le correzioni dei revisori, non per le pagine nuove, che si mostrano prima.

Diventa rivenditore

- 2026-11-15 · Cosa offre Endero ai rivenditori: collezione all'ingrosso, camicie con il marchio del cliente, su misura per i clienti del negozio (il negozio prende le misure, Endero cuce). (proprietario)
- 2026-11-15 · Può fare richiesta chiunque: Endero valuta caso per caso. Scartati: solo negozi con partita IVA, negozi e agenti. (proprietario)
- 2026-11-15 · Sul sito solo presentazione e modulo di richiesta; listino e condizioni Endero li manda in privato dopo il contatto. Scartati: area riservata con listino, catalogo PDF dopo l'approvazione. (proprietario)
- 2026-11-15 · Le richieste arrivano come gli altri messaggi del sito: modulo salvato su D1, segnato come rivenditore, e più avanti anche per email a `info@endero.it`. (proprietario)
- 2026-11-15 · Visibilità: terzo pulsante "Rivenditori" in testata su computer, link nel piè di pagina, fascia in pagina iniziale prima del piè di pagina, richiamo nella storia. Scartati: solo piè di pagina, senza pulsante in testata. (proprietario)
- 2026-11-15 · Modulo "completo ma leggero": obbligatori nome, telefono, email, città, Paese e cosa interessa; facoltativi negozio o marchio, tipo di attività, partita IVA, sito o Instagram, messaggio. L'email è obbligatoria perché listino e condizioni partono per email. (proprietario)
- 2026-11-15 · Endero serve rivenditori in Italia e all'estero; i capi si vedono in sede su appuntamento, con foto e catalogo in privato o con un campionario spedito. La pagina resta solo in italiano per ora. (proprietario)
- 2026-11-15 · Nella pagina vanno i loghi dei negozi clienti, che manda il proprietario; finché non arrivano resta il nastro con i fatti. Scartato: solo i numeri. (proprietario)
- 2026-11-15 · Una pagina sola con tre sezioni, non tre pagine: oggi mancano foto e contenuti per riempirle. Scelta nostra; si dividono quando arriva il materiale.

Configuratore (riaperto il 2026-11-15, a passi)

- 2026-11-15 · Passo 1 (parole del proprietario): "il 3D di una camicia sospesa in aria che si muove quando ci passo sopra con il mouse. Accanto una tabella glass con le info che poi ti dirò e che il cliente deve compilare", con un caricamento.
- 2026-11-16 · La camicia 3D in diretta nel browser è stata bocciata dopo quattro giri ("mi sembra finta", "sembra fatta di plastica", "ancora non ci siamo", "Fa schifo il risultato finale"): per la camicia non va riproposta, e nemmeno luci calcolate nel browser, onde ad anello, oscillazioni a molla, onde disegnate nello shader. Il racconto dei giri è al punto 12 della direzione creativa.
- 2026-11-16 · Scelte sue fatte lungo quei giri, che restano valide: movimento "come mossa dal vento quando ci passo con il mouse sopra. Leggera e naturale" ma ampio ("molto: ondeggia tutta"; ha chiesto "di più" tre volte: non tenerlo basso per prudenza); camicia senza taschino; appesa a una gruccia di legno davanti a una parete blu Endero, con la luce di una finestra a sbarre e l'ombra dietro (da un suo screenshot: "mi piacerebbe quella roba lì"); popeline leggero e stirato, niente grinze da ferma. Lezione: un movimento non si giudica dai fotogrammi fermi.
- 2026-11-16 · Strada nuova, parole sue: "trovare un'altra strada: scaricare un blender già bello che fatto". Tra quattro camicie pronte che gli abbiamo cercato ha scelto e comprato "Hanging Button Shirt 01" di iMeshh (Superhive, 5 $); noi la rendiamo come film calcolato con Blender, come l'apertura. Supera il suo "non voglio comprare elementi 3D". Scartati: set da cinque camicie, scansione di una camicia vera, modello da videogioco, film col modello vecchio, camicia vera filmata.
- 2026-11-16 · Richieste sue sulla camicia comprata: "Modifica il colore dei bottoni" (scelta: madreperla chiara), "Elimina i bottoni sul colletto", nastro che regge la gruccia blu scuro ("Non mi piace il bianco"), e "sempre con il movimento quando ci passo col mouse", vista sempre di fronte.
- 2026-11-16 · Movimento del film. Aveva scelto "vento dove passo"; provata dal vivo la versione a folate, l'ha corretta: "il movimento non deve essere proprio il vento: deve essere come se io toccassi con la mano il tessuto in modo leggero, ampio però e morbido. Mi piace, però, che quando muovo sulla camicia si muova anche la gruccia e il cavo". Quindi: una mano che passa sul petto dal lato da cui arriva il mouse, il tessuto cede appena, la camicia dondola e si torce piano con gruccia e nastro. Folate e increspature di vento non vanno riproposte. Sull'inquadratura: "Avvicina un po', troppo lontano" (dal gancio all'orlo ora prende l'87% dell'altezza dello schermo). Provato il tocco, ha chiesto "più lento" e tra tre velocità messe sull'anteprima ha scelto la più lenta ("molto più lento": il film va a metà della velocità simulata, otto secondi per scena); la distanza "va bene così".
- 2026-11-16 · Come è fatto il film (scelte nostre, da fargli vedere): a riposo un'immagine ferma; due scene registrate di otto secondi, "da sinistra" e "da destra", che partono dalla camicia ferma e ci tornano; appena pronta la camicia si muove da sola, una volta; sul telefono vale il tocco, dal lato in cui si tocca. Un tocco nuovo parte solo quando il precedente è quasi finito: in un film il movimento è registrato. Camicia a sinistra, parete in ombra a destra sotto il riquadro in vetro.
- 2026-11-15 · Campi del riquadro: quelli del foglio di carta "Camicie su misura" di Endero, che il proprietario ha fotografato. Si compilano solo le misure (taglia, spalla, spallina, torace, pancia, bacino, lunghezza manica, braccio, avambraccio, polso, lunghezza totale). Tessuto, collo, colori ricamo carré, taschino, asola, bottone, filato bottone, iniziali e note si vedono ma restano spenti: "poi ti dirò cosa fare". Ci sono anche i contrasti (interno collo, interno polso, fintone bottoni, carré) e, del cliente, nome, telefono ed email. La parte amministrativa del foglio (n. ordine, agente, date, prezzo, acconto, saldo) no: la compila Endero. Scartati: campi di testo libero, foglio intero.
- 2026-11-15 · Chi ordina da casa dà solo le misure del corpo. Scartati: misurare una camicia che sta bene, scelta tra i due modi. (proprietario)
- 2026-11-15 · Opzioni (tessuti, colli, polsi, vestibilità) e prezzi li manda il proprietario. Scartati: proposta nostra da correggere, modulo per il fondatore.
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
- 2026-11-14 · Blender si usa come modulo Python, senza interfaccia: `uv venv --python 3.13` e poi `uv pip install bpy numpy pillow shapely fonttools brotli scipy contourpy` (1,1 GB). Solo processore, 4 core: circa 2 minuti per un fotogramma 1440×900, 12 per la luce della camicia (`--riusa` la riprende). In `film/` va importato `bpy` prima di `bmesh`. Due calcoli insieme si rallentano a vicenda e un comando in background dura al massimo 2 ore: i lotti di `film/produci.py` si rilanciano senza perdere nulla, saltano i file già fatti.
- 2026-11-14 · In Blender 5 il nodo Mix ha più prese con lo stesso nome ("A", "B", "Result"): sceglierle per tipo, non per nome (vedi `mescola` in `film/scena.py`). Le immagini generate vanno salvate su disco in EXR e ricaricate, altrimenti restano nere.
- 2026-11-14 · Acciaio che sembra vetro scuro e tessuto velato di grigio. Causa: un solo ambiente per luce e riflessi, e troppa "peluria" (sheen) in controluce. Soluzione già in `film/scena.py`: due ambienti scelti con il nodo percorso della luce, sheen basso.
- 2026-11-14 · La resa dei toni "AgX" ingrigisce i fili bianchi. Soluzione: resa "Standard".
- 2026-11-15 · Sul telefono la testata esce dallo schermo e tutto sembra rimpicciolito. Causa: un elemento che sporge di lato (il carosello) allarga la pagina e il browser si adatta. Soluzione: ritagliare la sezione con `overflow: clip` e controllare che la larghezza della pagina resti 390 su iPhone 14.
- 2026-11-15 · Sul telefono la pillola fissa di WhatsApp copre il pulsante di invio dei moduli, e i link che portano a un modulo lo lasciano sotto la testata. Soluzione: la pillola si fa da parte sopra ogni `[data-modulo]` e sul piè di pagina (`src/sito.js`), e l'ancora sta sul riquadro del modulo (`.pannello`), non sulla sezione. Vale per ogni modulo nuovo, anche quello dei rivenditori.
- 2026-11-15 · `wrangler deploy` con gli assets fallisce con 401 su `workers/assets/upload`. Causa: l'ambiente di lavoro inietta la chiave Cloudflare in ogni richiesta e sostituisce l'autorizzazione temporanea di quel caricamento. Soluzione: l'anteprima usa Workers Sites su KV (`wrangler.anteprima.toml`, `worker/anteprima.js`); con wrangler si passa `CLOUDFLARE_API_TOKEN=proxy-injected` e `CLOUDFLARE_ACCOUNT_ID`. Per la messa online vera servirà pubblicare da un ambiente senza iniezione, o restare su KV.
- 2026-11-15 · Il proprietario non è pratico di Cloudflare: i passi vanno dati uno per uno sui pulsanti che vede (la pagina dei token è cambiata: si sceglie il riquadro "Edit Cloudflare Workers" e si toglie la "Zone policy").
- 2026-11-15 · Il repository GitHub è pubblico, ma contiene il dossier di ricerca con ciò che il proprietario non vuole diffondere (produzione all'estero, altri indirizzi, dati societari da directory). Soluzione: renderlo privato, e lo può fare solo il proprietario dalle impostazioni di GitHub; cancellare le righe non basta, restano nella cronologia. Finché è pubblico non aggiungere altro di riservato.
- 2026-11-16 · La camicia comprata ha una licenza che permette l'uso commerciale e vieta di ridistribuire il file (Superhive, "Royalty Free"). Soluzione: il file non entra mai nel repository (`.gitignore`: `*.blend`), sul sito vanno solo immagini e video; se il container riparte si riscarica dal Drive del proprietario e il film si rifà con i comandi del punto 12.
- 2026-11-15 · Nell'ambiente non c'è nulla per aprire i `.rar`. Soluzione: pacchetto npm `node-unrar-js` in una cartella di lavoro, estraendo in una cartella nuova e vuota.
- 2026-11-16 · Fisica della stoffa: nel file comprato la camicia è fatta di 28 pezzi di cartamodello accostati, non cuciti, e una camicia vera che segue un "telaio" semplificato si strappa se ogni punto ruota con l'osso più vicino. Soluzione, già in `camicia/film/`: i bordi vicini si saldano (2,5 mm), i lembi sovrapposti si cuciono, e ogni punto sta sul punto più vicino di un triangolo del telaio più uno scarto su tre assi. La simulazione dei tessuti di Blender qui impiega 12 minuti a prova e accartoccia: non usarla.
- 2026-11-16 · Un file sopra i 30 MB non si carica in chat, e il connettore di Google Drive ne scarica al massimo 10. Soluzione: il proprietario lo mette su Drive con "chiunque abbia il link", si scarica con `curl -L "https://drive.usercontent.google.com/download?id=<ID>&export=download&confirm=t"`, e poi lui può rimettere il file "con restrizioni".
- 2026-11-16 · La camicia del film tagliata in basso sugli schermi veri. Causa: le finestre dei browser sono larghe e basse (1920×950, 1440×790, 1366×625), non 1440×900. Soluzione: fotogramma 2:1, che la pagina fa scorrere di lato sugli schermi stretti; le prove si fanno a più formati (`tools/prova-camicia.js`), non solo a 1440×900.
- 2026-11-16 · Calcolo del film della camicia: 64 secondi a fotogramma (32 campioni, indistinguibili da 96 dopo la ripulitura; solo la fascia in cui camicia e ombra si muovono, `produci.py --bordo`), tre ore e mezza per le due scene. La versione di prova (900×500, 16 campioni) ne chiede 12 a fotogramma, 40 minuti in tutto: si fa sempre prima quella. Per rallentare un movimento non si ricalcola: i fotogrammi di mezzo li ricava ffmpeg (`minterpolate`, in `monta.py`), e a movimento lento vengono puliti.
- 2026-11-15 · Gli strumenti in `tools/` sono CommonJS: `package.json` non deve avere `"type": "module"`, gli script di build sono `.mjs`.
- 2026-11-14 · Nell'ambiente non c'è `potrace`. Soluzione per vettorializzare: pacchetto npm `potrace` dopo aver ingrandito 12 volte e sfocato l'immagine con Pillow.

## Domande aperte

Da chiudere con il proprietario, sempre a risposta multipla.

- Foto, video, nomi, descrizioni e prezzi dei prodotti, e i nomi dei tre ingressi alla collezione: li carica il proprietario. Elenco di cosa serve in `docs/direzione-creativa.md`, punto 8.
- Chi gestisce il dominio endero.it e i suoi DNS. Serve per: messa online ed email, non per l'anteprima.
- Orari della sede di Viale del Toro. Serve per: pagina dove siamo, dati di attività locale.
- Prezzo "a partire da" e testi delle domande frequenti. Serve per: pagina iniziale e pagina su misura.
- Testi della pagina iniziale, bozze nostre in `contenuti/it/home.json`, da approvare prima della messa online. Serve per: messa online.
- Il proprietario rende privato il repository GitHub? Serve per: non lasciare in pubblico il dossier di ricerca.
- Conferma di ragione sociale, partita IVA e sede legale (quelli nel dossier vengono da directory). Serve per: testi legali.
- Il negozio PrestaShop attuale si spegne al lancio? Serve per: reindirizzamenti.
- Nome utente Instagram e altri profili. Serve per: link nel piè di pagina.
- Prova su un iPhone vero: il sito è stato controllato solo con Chromium, mai con Safari, e lo scorrimento morbido col dito va sentito a mano. Serve per: messa online.
- "Diventa rivenditore": loghi dei negozi clienti che danno il permesso, foto per la pagina, conferma dei testi in bozza. Serve per: completare la pagina dopo la costruzione.
- Foto di oggi per "Cultura e artigianato" e per il sito: il proprietario le carica (il 2026-11-15 ha detto "domani": in chat non erano arrivate). Serve per: scrivere i capitoli, uno per foto.
- Configuratore: cosa fare dei campi spenti del riquadro e quali opzioni e prezzi offrire (lo dice il proprietario), tempi di consegna, email che riceve gli ordini. Le righe d'aiuto delle misure (dagli appunti sul foglio) e i limiti minimi e massimi (nostri) vanno confermati con il sarto. Sul foglio di Endero le misure sono prese sulla camicia ("da sotto il giromanica", "4° bottone dal fondo"), mentre la decisione del 15 novembre dice misure del corpo: da chiarire con lui. Serve per: passi dal 2 in poi.
- Camicia del configuratore come film: il proprietario ha approvato movimento, velocità e distanza sulla versione di prova e ha dato il via al calcolo definitivo con aggiornamento dell'anteprima ("Calcola e aggiorna l'anteprima"). Resta il suo giudizio sulla versione nitida. La pagina della licenza della camicia comprata non parla di immagini e video ricavati dal modello: gliel'abbiamo detto, la rilegge lui. Serve per: messa online del configuratore.
