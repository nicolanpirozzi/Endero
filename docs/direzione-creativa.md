# Endero · direzione creativa e specifica di costruzione

Scelte approvate dal proprietario il 14 novembre 2026. È il documento da cui parte la costruzione. **Dal 15 novembre 2026 sera il sito non è più una pagina unica: la struttura che vale è al punto 10, la qualità al punto 11, il configuratore al punto 12.** Dove i punti 3 e 5 dicono altro, vince il punto 10. I testi indicati sono bozze: vanno approvati prima della messa online. Fatti e contatti stanno in `CLAUDE.md` e `docs/ricerca-endero.md`.

## 1. Il riferimento

`https://www.seve.app/pr` (sito Framer). Il proprietario lo vuole "praticamente uguale": stessa struttura, stesse proporzioni, stesso movimento, sezione per sezione. Non si copiano immagini, testi, codice né il carattere, che è a pagamento. Per rivederlo: `node tools/cattura.js https://www.seve.app/pr <cartella> desktop` (e `mobile`).

Anatomia rilevata, dall'alto in basso:

| # | Sezione | Cosa fa |
| --- | --- | --- |
| 1 | Testata | Marchio in alto a sinistra, due pillole in alto a destra, nessun menu. Una pillola fissa in basso a destra resta visibile per tutta la pagina. |
| 2 | Apertura | Video a tutto schermo, 100 % dell'altezza. Titolo centrato su due righe, piccolo (24 px), maiuscolo; sotto una riga da 12 px. |
| 3 | Nastro | Loghi che scorrono in orizzontale su fondo bianco, fascia alta circa 310 px. |
| 4 | Selettore | Pillola grigia in vetro satinato larga circa 650 px con quattro voci; quella attiva è una pillola nera. Resta attaccata in alto mentre si scorre. Su mobile diventa una barra a tutta larghezza con freccia. |
| 5 | Titolo di sezione | Titolo centrato 24 px maiuscolo, paragrafo leggero 14–16 px, larghezza massima circa 650 px. |
| 6 | Griglia di foto | 6 colonne su desktop, 2 su mobile, senza margini né spazi. Foto verticali circa 3:5. Etichetta a pillola in alto a destra su ogni foto. Al passaggio del mouse compare una scheda in vetro con i dettagli. |
| 7 | Foto grande con scheda | Immagine orizzontale con 36 px di margine laterale e una scheda in vetro satinato sovrapposta in basso a sinistra. |
| 8 | Testo e pannello | Testo a sinistra, pannello grigio chiaro arrotondato a destra con un'interfaccia. |
| 9 | Tre riquadri | Tre riquadri affiancati con sfondo sfumato e titolo centrato, su fondo bianco caldo. |
| 10 | Carosello | Tre foto ad altezze diverse, quella centrale più grande con una citazione in vetro; frecce ai lati. |
| 11 | Domande frequenti | Elenco a fisarmonica centrato, largo circa 620 px. |
| 12 | Prezzo | Foto a sinistra per due terzi, a destra titolo, testo, "a partire da", cifra grande e pillola. |
| 13 | Piè di pagina | Fondo pieno scuro, marchio grande a sinistra, due colonne di link a destra, riga legale. |

Tipografia: una sola famiglia larga. Titoli in peso medio, maiuscoli, 24 px con interlinea 1. Testo in peso leggero, 14 px con interlinea 1,6. Etichette 11–12 px maiuscole. Colori: solo nero, bianco, bianco caldo `#FAF9F7`, grigio pannello `#EBEBEB`. Il colore lo portano le fotografie.

Movimento: titoli che entrano parola per parola, nastro continuo, selettore che si aggancia, schede che compaiono al passaggio, dissolvenze morbide. Niente effetti vistosi.

## 2. Come diventa Endero

Il blu del logo prende il posto del nero. Tutto il resto resta come il riferimento.

```css
:root {
  --blu: #0f285e;          /* dal logo: testi, pillole, piè di pagina */
  --blu-fondo: #0a1c45;    /* ombre e profondità sul tessuto */
  --carta: #faf9f7;        /* fondo delle sezioni chiare */
  --bianco: #ffffff;
  --filo: #fbf9f4;         /* cuciture e ricamo */
  --pannello: #eceae5;
  --vetro: rgba(15, 40, 94, 0.35);   /* con backdrop-filter: blur(16px) e bordo bianco al 35 % */
  --raggio-pillola: 999px;
  --raggio-scheda: 24px;
  --raggio-pannello: 12px;
}
```

- **Carattere**: Archivo variabile, con asse della larghezza, ospitato sul sito (nessuna chiamata a Google). Titoli: larghezza 125, peso 500–600, maiuscolo. Testo: larghezza 108–110, peso 300. Verificare la licenza OFL al momento dell'installazione. Numeri tabellari per i prezzi.
- **Logo**: `brand/logo/endero-scritta.svg` in testata, `endero-completo.svg` nel ricamo e nel piè di pagina, `endero-simbolo.svg` per l'icona del sito. Usano `currentColor`.
- **Fotografie**: solo materiale vero di Endero. Finché non arriva, riquadri neutri con scritto quale foto ci va. Mai immagini di repertorio o generate.

## 3. Pagina iniziale, sezione per sezione

> Superata in parte dal punto 10: il su misura, le domande e il prezzo sono passati alla pagina `/camicie-su-misura/`, la storia è diventata "Cultura e artigianato". I pezzi descritti qui restano quelli da usare.

| # | Dal riferimento | Per Endero |
| --- | --- | --- |
| 0 | (non c'è) | **Apertura "La cucitura"**, vedi punto 4. |
| 1 | Testata | Scritta Endero. Pillole: "Prenota la presa misure", "Collezione". Pillola fissa: "Scrivici su WhatsApp". |
| 2 | Video a tutto schermo | Video vero del laboratorio. Titolo: "Camicie su misura, fatte in Italia". |
| 3 | Nastro di loghi | Nastro di fatti: "Dal 1996 · 1,3 milioni di capi · 2.500 negozi serviti · Sartoria italiana contemporanea". |
| 4 | Selettore | "Su misura · Collezione · Storia · Dove siamo": porta alle sezioni della pagina, ognuna con il link alla pagina completa. |
| 5–6 | Titolo e griglia di foto | "Su misura": dettagli di colli, polsi, tessuti. Etichette "Su misura" / "Pronta". Scheda al passaggio con nome e tessuto. |
| 7 | Foto grande con scheda | Presa misure: scheda in vetro con le voci della scheda misure e invito a prenotare. |
| 8 | Testo e pannello | "Come funziona" in tre passi a sinistra, modulo di prenotazione a destra. |
| 9 | Tre riquadri | Tre ingressi alla collezione, con foto vere al posto delle sfumature. |
| 10 | Carosello | Capitoli della storia con foto. Le citazioni dei clienti entrano solo quando ci sono recensioni vere. |
| 11 | Domande frequenti | Tempi, misure, prezzi, ritiro: domande e risposte da far confermare. |
| 12 | Prezzo | Foto a sinistra, "A partire da € __" a destra. Cifra da confermare. |
| 13 | Piè di pagina | Fondo blu, logo completo grande, link, dati legali, contatti. |

Nel riferimento c'è anche una seconda foto grande con un pannello in vetro a destra ("Create custom reports"). Nella pagina di Endero non c'è: il proprietario ha voluto l'indirizzo solo nel piè di pagina (15 novembre 2026). La voce "Dove siamo" del selettore porta lì; il pezzo con foto e pannello della sede è pronto in `src/parti/sede.mjs` per la pagina `/dove-siamo/`. Domande e prezzo contano come "Su misura" nel selettore.

**Costruita il 15 novembre 2026** (passi 1–4 del punto 7). Testi in `contenuti/it/home.json`, modello in `src/pagine/home.mjs`, stile in `src/stili/sito.css`, comportamenti in `src/sito.js`. Nei file di testo le parti tra `[[ ]]` sono segnaposto: in anteprima si vedono evidenziate in giallo, così il proprietario sa cosa manca. Le foto in arrivo sono riquadri con una trama di tessuto e la descrizione della foto vera che ci andrà.

## 4. Apertura "La cucitura"

Un film 3D realistico, calcolato in anticipo con Blender, che avanza con lo scorrimento. Il proprietario ha bocciato la prima versione disegnata in SVG: non va riproposta. Fotogrammi di riferimento in `docs/img/film/`.

**Idea.** Scorrere è cucire. La pagina è il tessuto blu: scorrendo, la macchina cuce, la cucitura sale e porta con sé la storia di Endero, fino a ricamare il logo.

**Regia, in tre tempi.**

1. *Primo piano.* L'ago e il piedino in acciaio visti da vicino, con la profondità di campo di un obiettivo macro. L'ago fa i primi punti.
2. *Vista dall'alto.* La camera sale e si ferma sopra il tessuto, dal lato di chi cuce: la macchina resta in piedi al centro, il tessuto scorre verso l'alto. A destra e a sinistra della cucitura passano le scritte ricamate (1996, 1,3 MILIONI, 2.500, SARTORIA), ognuna con sotto la sua frase in testo vero: "Inizia la storia di Endero", "di capi prodotti", "negozi serviti", "italiana contemporanea".
3. *Logo.* Finita la cucitura, la macchina si sposta sul logo e lo ricama: prima il simbolo, poi la scritta da sinistra a destra. A logo finito la macchina si ritira verso chi cuce ed esce dal basso dello schermo.

Poi la sezione finisce e la pagina prosegue sul sito.

**Come è fatto.** Per dare la massima fluidità senza pesare, il film è composto da pezzi diversi:

| Pezzo | Cos'è | Come si usa nel sito |
| --- | --- | --- |
| Apertura | 55 fotogrammi interi, dal primo piano alla vista dall'alto | Disegnati uno alla volta su una tela, secondo lo scorrimento |
| Striscia | Una sola immagine lunga del tessuto visto dall'alto, con cucitura e scritte, divisa in 8 fasce | Scorre con una trasformazione CSS: movimento continuo, nessuno scatto |
| Colonna | La fascia centrale dello stesso tessuto, senza cucitura | Copre la cucitura dove l'ago non è ancora passato |
| Macchina | La testa in acciaio da sola, con ombra e trasparenza, nelle 6 fasi del ciclo dell'ago | Sta ferma sopra il tessuto; cambia fase con lo scorrimento |
| Ricamo | 25 immagini della zona del logo, da tessuto nudo a logo finito | Si alternano mentre la macchina si sposta sul logo |

La vista dall'alto è senza prospettiva proprio per questo: il tessuto può scorrere come una semplice immagine. La luce principale è infinitamente lontana, quindi ogni punto del tessuto è illuminato allo stesso modo; la pozza di luce al centro è una sfumatura CSS ferma sullo schermo.

**File.**

- `film/scena.py`: la scena (tessuto con pieghe e grinze, fili modellati capo per capo, ricami a punto raso, acciaio, luci).
- `film/geometria.py`: da logo e testi ai punti di ricamo.
- `film/produci.py`: calcola i pezzi. `film/impacchetta.py`: li trasforma in WebP e scrive `film.json` con le misure.
- `film/manifesto.py`: compone l'immagine ferma del logo ricamato (orizzontale e verticale) dagli stessi pezzi.
- `src/apertura/apertura.js` e `apertura.css`: il lettore. `anteprima/apertura.html`: pagina di prova.
- `tools/filma.js`: registra un video della pagina mentre scorre, su computer o telefono, per farla approvare.
- `public/film/`: i pezzi pronti per il sito.

**Vincoli che non si trattano.**

- *Senza JavaScript o con movimento ridotto*: resta un'immagine ferma del logo ricamato con la storia come testo. Lo script aggiunge `.apertura--viva` e solo allora parte il film.
- *Google*: le frasi della storia sono testo vero dentro la pagina; le cifre ricamate sono ripetute nel testo per i lettori di schermo.
- *Caricamento*: un caricatore con il logo e una cucitura che avanza. Parte appena sono pronti un fotogramma dell'apertura ogni quattro, una fase della macchina e le prime due fasce (circa 2 MB); il resto arriva mentre si guarda e, finché manca un fotogramma, si mostra il più vicino. Chi ha attivato il risparmio dati vede la versione ferma.
- *Uscita rapida*: il link "Salta l'introduzione" c'era ed è stato tolto il 15 novembre 2026 su richiesta del proprietario. Chi usa la tastiera ha sempre "Vai al contenuto", che porta oltre il film.
- *Telefono*: su schermi verticali il fotogramma si adatta all'altezza, il tessuto si sposta di lato per mostrare intera la scritta del capitolo e il logo finale si guarda da più lontano. L'altezza si misura una volta sola: la barra degli indirizzi che compare e scompare non deve far saltare l'immagine.
- *Titolo H1*: non sta nell'apertura ma nella sezione che segue, come nel riferimento.

## 5. Pagine e Google

> Il lavoro SEO del 20 novembre 2026 (pagine di categoria, dati strutturati, mappa con le foto, controllo automatico, cosa manca) è al punto 15. La tabella qui sotto è il progetto del 14 novembre.

| Indirizzo | Titolo H1 (bozza) | Ricerca a cui risponde | Dati strutturati |
| --- | --- | --- | --- |
| `/` | Camicie su misura, fatte in Italia | Endero, camicia su misura | Organization, WebSite, ClothingStore |
| `/camicie-su-misura/` | Camicie su misura a Giugliano, Napoli | camicia su misura, camicia su misura Napoli | Service, FAQPage |
| `/collezione/` | La collezione Endero | camicia uomo cotone, camicione flanella | CollectionPage |
| `/collezione/<nome-capo>/` | Nome del capo | nome del capo | Product |
| `/storia/` | La storia di Endero | Endero camicie, chi siamo | AboutPage |
| `/dove-siamo/` | Dove siamo e contatti | camiceria Giugliano, contatti | ContactPage, ClothingStore |
| `/privacy/`, `/cookie/` | | obbligo di legge | |

- Un H1 per pagina, title e description unici con il nome Endero, indirizzo canonico, immagini di anteprima per i social, `lang="it"`.
- `sitemap.xml`, `robots.txt`, reindirizzamenti 301 dai vecchi indirizzi PrestaShop elencati nel dossier.
- Struttura pronta per `/en/` con `hreflang`: testi in file separati dal codice.
- Product senza offerta finché non c'è il carrello; il prezzo si mostra in pagina.
- Il configuratore vive in `/camicie-su-misura/configuratore/` (riaperto il 15 novembre 2026: punto 12).
- Tutte le pagine della tabella esistono dal 15 novembre 2026, con segnaposto dove mancano foto e testi. Le pagine dei capi nascono da `contenuti/it/prodotti.json` (campi e esempio nel file stesso). I vecchi indirizzi PrestaShop portano alle pagine nuove con `dist/_redirects`.
- "Diventa rivenditore" (`/diventa-rivenditore/`): progettata il 15 novembre 2026, da costruire. Tutto al punto 9.

## 6. Contatti, modulo ed email

- WhatsApp: 333 854 8712, collegamento `https://wa.me/393338548712`.
- Email pubblica: `info@endero.it`. Invii con Resend (chiave come segreto del Worker). Le risposte dei clienti vengono inoltrate alla casella del proprietario, il cui indirizzo sta solo nella configurazione del Worker.
- Tutto questo richiede di modificare i DNS di endero.it, che oggi non si sa chi gestisca. Nelle anteprime il modulo salva su D1 e basta.
- Modulo di contatto e prenotazione: `POST /api/contatto`, verifica Turnstile lato server, salvataggio su D1. Funziona come normale invio di modulo anche senza JavaScript.
- Banner dei consensi pronto; Google Analytics e Meta Pixel si collegano dopo e non partono senza consenso.
- Informativa privacy e cookie (`contenuti/it/legale.json`, `src/pagine/legale.mjs`): bozza nostra, confermata dal consulente di Endero il 2026-11-20. Dati societari, sede legale (Viale del Toro 22) e conservazione (24 mesi dall'ultima richiesta) li ha confermati il proprietario lo stesso giorno, e su sua scelta abbiamo corretto le frasi che non corrispondevano ai moduli veri (campi obbligatori e dati dei rivenditori). L'informativa dice solo ciò che il sito fa: le frasi su antispam ed email compaiono da sole quando sono attivi (`{{antispam|…}}` con `TURNSTILE_SITE_KEY` nel build, `{{email|…}}` con `email_moduli` in `sito.json`). La promessa di cancellare le richieste dopo 24 mesi la mantiene il Worker, ogni notte (`scheduled` in `worker/index.js`, `[triggers]` in `wrangler.toml`): se la durata cambia, cambia lì e nel testo. Dal 27 novembre l'informativa parla anche degli ordini e c'è la pagina delle condizioni di vendita (`/condizioni-di-vendita/`): scritte da noi, approvate dal consulente lo stesso giorno (riferito dal proprietario). Se cambia qualcosa negli ordini (Stripe vero, l'estero, i tempi), si cambia nel testo e si rifà rileggere.

## 7. Architettura e ordine dei lavori

Sito statico a più pagine, generato da un piccolo script Node: pagine e parti comuni in HTML, testi e prodotti in file di dati, nessun framework.

| Dove | Cosa |
| --- | --- |
| `contenuti/it/` | I testi, uno per pagina più `sito.json` per le parti comuni. Per l'inglese si aggiungerà `contenuti/en/`. |
| `src/pagine/`, `src/parti/` | I modelli delle pagine: funzioni che ricevono i testi e restituiscono HTML completo. |
| `src/stili/sito.css`, `src/sito.js` | Stile e comportamenti comuni. L'apertura ha i suoi file in `src/apertura/`. |
| `build/costruisci.mjs` | Genera `dist/`: pagine, script e stili con l'impronta nel nome, `robots.txt`, `sitemap.xml`, `_headers`. |
| `worker/index.js`, `wrangler.toml`, `db/schema.sql` | Il Worker: serve `dist/` e riceve il modulo (`POST /api/contatto`, salvataggio su D1, Turnstile se configurato). |

Comandi: `npm run anteprima` (sito in locale su http://127.0.0.1:8766, modulo spento), `npm run worker` (Worker e D1 in locale su http://127.0.0.1:8787, modulo attivo; la prima volta `npm run db:locale`). Il build normale fa un'anteprima che Google non indicizza; `node build/costruisci.mjs --pubblico` solo per la messa online su endero.it, dopo l'ok del proprietario. Perché: ogni pagina esce completa anche senza JavaScript, il codice HTML è sotto controllo per Google, il peso resta minimo. esbuild compila gli script, con l'apertura in un file caricato a parte. Un Worker serve i file e risponde al modulo.

1. Impalcatura: script di generazione, esbuild, Wrangler, schema D1. *Fatto.*
2. Colori, carattere, testata, pillole, piè di pagina. *Fatto.*
3. Pagina iniziale ferma, senza animazioni, con riquadri segnaposto. Anteprima desktop e mobile al proprietario. *Fatto, approvato dal proprietario il 15 novembre 2026.*
4. Apertura "La cucitura": il film e il lettore sono già fatti (vedi punto 4): va solo inserita nella pagina iniziale e collegata alla testata. *Fatto: a fine film il telo si solleva e scopre il video con il titolo, che resta fermo sotto.*
5. Movimento del resto della pagina con la skill `animate`; poi `make-interfaces-feel-better`, `mobile-native`, `break-ui`. *Fatto il 15 novembre 2026, da far vedere al proprietario:* scorrimento morbido con Lenis (rotella e dito), titoli che entrano parola per parola, testi e foto che salgono, foto grandi che si aprono come un telo, schede in vetro che compaiono dopo la foto, pillola del selettore che scivola, risposte delle domande che si aprono in altezza. Tutto in `src/sito.js` (elenco `COMPARSE`) e in fondo a `src/stili/sito.css`. Con il movimento ridotto niente Lenis né comparse; senza JavaScript tutto è visibile da subito. GSAP non è servito: si userà dove serve una sequenza vera (per esempio il configuratore).
6. Altre pagine, modulo con Worker, D1 e Turnstile, banner dei consensi, file per Google. *Fatto il 15 novembre 2026, tranne il banner dei consensi:* oggi il sito non usa cookie di statistica né pubblicità, il banner serve quando si collegano Google Analytics e Meta Pixel. Turnstile si accende mettendo le chiavi (`TURNSTILE_SITE_KEY` al build, `TURNSTILE_SECRET` sul Worker).
7. Revisione indipendente con più agenti. Solo dopo l'ok del proprietario, pubblicazione sul link Cloudflare.

## 8. Materiali da ricevere

Aggiornato il 19 novembre 2026, dopo le foto della collezione (punto 13), quelle di cultura e artigianato e il secondo giro sulla pagina iniziale (punto 14). Quello che è arrivato sono capi indossati: maglieria, giacche e cappotti, abiti, felpe. Non c'è nessuna foto di camicie da vicino, del laboratorio, della sede o di un negozio: per questo i riquadri qui sotto restano segnaposto ("lascia il segnaposto", proprietario). La pagina iniziale non ne ha più.

- Camicie su misura, dieci riquadri: il sarto al lavoro su una camicia (orizzontale, apertura della pagina); sei foto per i dettagli (colletto in primo piano, camicia indossata, polsino e bottone, un capo della collezione, tessuto da vicino, camicia indossata di spalle); la presa misure in sede (orizzontale) con la foto del capo nella scheda; una camicia su misura indossata (orizzontale) accanto al prezzo.
- Diventa rivenditore, quattro riquadri: capi Endero in un negozio (orizzontale, apertura) e i tre capitoli: la collezione in un negozio (orizzontale), l'etichetta di un cliente cucita su una camicia, una camicia su misura consegnata in negozio.
- Dove siamo: il riquadro con l'indirizzo ha la foto del negozio (19 novembre). Per l'apertura della pagina il proprietario ha una seconda foto del negozio, visto di lato, e per «La presa misure» del su misura una foto del sarto che prende le misure: le ha mandate in chat mentre lavoravamo e i file non si sono salvati, le rimanda. I riquadri le aspettano: basta aggiungere le due righe a `SEDE` in `tools/comprimi-foto.py` e la voce `immagine` nei testi (`dove-siamo.json`, `eroe`; `su-misura.json`, `presa_misure`).
- Nomi, descrizioni e prezzi dei capi della collezione: oggi il lookbook mostra le foto senza schede.
- Un video orizzontale per l'apertura sugli schermi larghi: quello di oggi è girato in verticale e se ne vede una fascia ingrandita (punto 14).
- Orari della sede, prezzo "a partire da", testi delle domande frequenti.

## 9. Diventa rivenditore

> Superato in parte dal punto 14 (19 novembre 2026): le strade sono due, "Rivenditore Endero" e "Conto terzi", con il su misura per i clienti del negozio come servizio in più; in cima alla pagina e in pagina iniziale c'è il pezzo delle due strade al posto dei tre riquadri e della fascia; i capitoli si chiamano `rivenditore-endero`, `conto-terzi`, `su-misura`.

Progetto del 15 novembre 2026, sulle scelte del proprietario (in `CLAUDE.md`, "Diventa rivenditore"). Da costruire con Opus 5.5. Testi in bozza già scritti in `contenuti/it/diventa-rivenditore.json`: la pagina si monta con quelli.

**A chi parla.** Tre persone diverse sotto lo stesso nome: il negoziante che vuole vendere la collezione, il negozio o marchio che vuole camicie con la propria etichetta, il negozio che vuole offrire il su misura senza avere un laboratorio. Può scrivere chiunque; Endero valuta caso per caso. Qui "oltre 2.500 negozi serviti" e "dal 1996" sono l'argomento principale.

**Cosa non c'è, per scelta.** Niente listino, niente ordine minimo, niente condizioni, niente area riservata: Endero manda tutto per email dopo la richiesta. La pagina presenta e raccoglie la richiesta.

**Indirizzo e Google.** Una sola pagina, `/diventa-rivenditore/`, con tre sezioni ancorate. Si dividerà in tre pagine quando ci saranno foto e contenuti veri per ognuna: oggi sarebbero pagine vuote. Solo italiano; l'inglese arriverà con la versione inglese di tutto il sito (proprietario).

| Elemento | Valore |
| --- | --- |
| H1 | Diventa rivenditore Endero |
| H2 | Camicie uomo all'ingrosso · Camicie con il tuo marchio · Su misura per i tuoi clienti · Come funziona · Domande frequenti |
| Ricerche | camicie uomo ingrosso, fornitore camicie per negozi, camicie con il proprio marchio, produzione camicie conto terzi, camicie su misura per negozi |
| Dati strutturati | quelli di base, più tre `Service` con `audience` di tipo `BusinessAudience` e `provider` la sede, più `FAQPage` |

**La pagina, dall'alto in basso.** Tutti pezzi già approvati in `src/parti/sezioni.mjs` e nella pagina a capitoli (ex `/storia/`, ora `/cultura-e-artigianato/`): nessun disegno nuovo.

| # | Pezzo | Contenuto |
| --- | --- | --- |
| 1 | `eroePagina` | Titolo della pagina su foto. |
| 2 | `nastro` | I fatti confermati, come in pagina iniziale. Quando arrivano i loghi dei negozi clienti (`loghi.voci`), il nastro mostra quelli, come nel riferimento: stessa fascia, loghi a un colore alti 20 px. |
| 3 | Tre riquadri (`collezione`) | "Tre modi di lavorare con Endero": ogni riquadro porta alla sua sezione nella pagina. |
| 4 | Tre capitoli (come in `/storia/`) | Foto e testo alternati, con `id` `ingrosso`, `marchio`, `su-misura`. La parola grande è l'etichetta, il titolo è l'H2. Sotto ogni testo il link "Fai richiesta" verso il modulo. |
| 5 | Testo e pannello (`funziona`) | "Come funziona" in tre passi a sinistra, modulo a destra, `id="richiesta"`. |
| 6 | `domande` | Sette domande, tutte con risposte già confermate dalle scelte del proprietario. |
| 7 | Chiusura (come in `/storia/`) | "Parliamone": pillola verso il modulo e pillola WhatsApp. |

Niente sezione prezzo e niente selettore.

**Il modulo.** Tipo `rivenditore`, stesso indirizzo `POST /api/contatto`, stesso aspetto dei moduli esistenti.

| Campo | Nome | Obbligatorio |
| --- | --- | --- |
| Nome e cognome | `nome` | sì |
| Negozio o marchio | `attivita` | no |
| Telefono o WhatsApp | `telefono` | sì |
| Email | `email` | sì: il listino parte per email |
| Città | `citta` | sì |
| Paese | `nazione` | sì, già scritto "Italia" |
| Cosa ti interessa | `interesse` | sì, almeno una: tre caselle |
| Tipo di attività | `tipo_attivita` | no: una scelta tra cinque |
| Partita IVA | `partita_iva` | no |
| Sito o Instagram | `profilo` | no |
| Messaggio | `messaggio` | no |
| Consenso privacy | `privacy` | sì |

- I campi sono descritti nei contenuti (`modulo.campi`): il componente `modulo` va reso capace di disegnare un elenco di campi, così i prossimi moduli non chiedono codice nuovo. I due moduli esistenti non devono cambiare aspetto.
- "Almeno una casella" non si può imporre con il solo HTML: lo controlla lo script prima dell'invio e lo ricontrolla sempre il Worker, che senza JavaScript risponde con la pagina di errore.
- Non chiamare nessun campo `sito_web`: è il nome dell'esca antispam.
- Salvataggio: nuova colonna `dettagli` (testo JSON) nella tabella `richieste`, con i campi propri dei rivenditori; `tipo` vale `rivenditore`. Il Worker accetta solo i nomi previsti, con i limiti di lunghezza della tabella qui sopra, e per questo tipo pretende email, città e almeno un interesse. Nessun database è ancora online: basta aggiornare `db/schema.sql` e ricreare quello locale.
- Conferma: "Ti rispondiamo per email con listino e condizioni". Nessuna promessa sui tempi.
- Quando ci sarà Resend: avviso a `info@endero.it` con oggetto "Nuova richiesta rivenditore".
- Privacy: in `contenuti/it/legale.json`, alla voce "Quali dati raccogliamo", aggiungere: "Se chiedi di diventare rivenditore: nome del negozio o marchio, città, Paese, tipo di attività, partita IVA e sito se li indichi."

**Come ci si arriva** (testi in `richiami`).

- Testata: terzo pulsante "Rivenditori", in vetro come "Collezione", solo su computer (da 810 px in su). Nella pagina dei rivenditori il pulsante chiaro dice "Fai richiesta" e porta al modulo, al posto di "Prenota la presa misure".
- Piè di pagina: "Diventa rivenditore" nella colonna dei link, dopo "Dove siamo". Sul telefono è l'ingresso principale insieme alla fascia.
- Pagina iniziale: una fascia su fondo chiaro caldo tra la porta sul su misura e il piè di pagina, con titolo, una riga e il link. Stesso aspetto del blocco della collezione, senza riquadri. Dal punto 10 ha `id="rivenditori"` ed entra nel selettore.
- `/cultura-e-artigianato/` (ex `/storia/`): link "Diventa rivenditore" accanto a "2.500 negozi serviti".
- `/dove-siamo/`: quarta voce "Rivenditori" nell'elenco dei contatti.
- `sitemap.xml`.

**Controlli prima di mostrarla al proprietario.** Un solo H1; invio del modulo con e senza JavaScript, compreso l'errore "nessun interesse scelto"; riga salvata con `tipo` e `dettagli` giusti; terzo pulsante assente sotto 810 px e testata che non va a capo a 1024 px; nomi di negozio lunghissimi nel modulo; movimento ridotto; larghezza 390 senza scorrimento di lato. Poi video o schermate su computer e telefono, e pubblicazione solo dopo il suo ok.

**Da ricevere.** Loghi dei negozi clienti che danno il permesso (a un colore, SVG o PNG); foto per la testa della pagina, i tre riquadri e i tre capitoli; conferma dei testi.

## 10. Nuova struttura: più pagine, non una pagina unica

> Dal 19 novembre 2026 "Cultura e artigianato" si chiama "Chi siamo": la pagina è `/chi-siamo/` e la sezione della pagina iniziale ha `id="chi-siamo"` (punto 14). Qui sotto restano i nomi di allora.

Deciso dal proprietario il 15 novembre 2026, dopo che il fondatore ha visto l'anteprima ("gli piace e si aspetta un lavoro di alto livello"): la pagina unica era diventata troppo carica. Il su misura e i rivenditori hanno ciascuno la propria pagina; la pagina iniziale mostra i prodotti e, sotto, "Cultura e artigianato". Aspetto, proporzioni e movimento restano quelli del riferimento: cambiano l'ordine e la distribuzione dei pezzi, non i pezzi.

**Le pagine.**

| Indirizzo | Cosa contiene | Ricerca a cui risponde |
| --- | --- | --- |
| `/` | Apertura, eroe, vetrina dei prodotti, cultura e artigianato, porta verso il su misura, fascia rivenditori | Endero, camicie uomo |
| `/collezione/`, `/collezione/<capo>/` | Dal 19 novembre il lookbook con le foto vere (punto 13); le schede dei capi quando arrivano nomi e prezzi | abbigliamento uomo Endero, nome del capo |
| `/camicie-su-misura/` | Tutto il su misura che stava in pagina iniziale: dettagli, presa misure, come funziona con il modulo, prezzo, domande. In cima l'ingresso al configuratore | camicia su misura, camicia su misura Napoli |
| `/camicie-su-misura/configuratore/` | Il configuratore (punto 12) | crea la tua camicia su misura |
| `/cultura-e-artigianato/` | Prende il posto di `/storia/` | Endero camicie, chi siamo |
| `/diventa-rivenditore/` | Punto 9, invariato | camicie uomo ingrosso |
| `/dove-siamo/`, `/privacy/`, `/cookie/` | Come oggi | |

`/storia/` non esiste più: un reindirizzamento 301 la porta a `/cultura-e-artigianato/` (il fondatore ha già visto il vecchio indirizzo).

**Pagina iniziale, dall'alto in basso.**

| # | Pezzo | Contenuto |
| --- | --- | --- |
| 0 | Apertura "La cucitura" | Invariata. È lei a raccontare la storia: i quattro fatti confermati. |
| 1 | Eroe | Video del laboratorio. H1 nuovo, perché la pagina non parla più solo di su misura: "Camicie e abbigliamento uomo". Sotto: "Sartoria italiana contemporanea · Giugliano in Campania". Due pillole piccole sotto il testo: "Vedi la collezione" (alla vetrina) e "Camicia su misura" (alla sua pagina). |
| 2 | Nastro | I fatti, come oggi: serve a chi salta l'apertura. |
| 3 | Selettore | "Collezione · Artigianato · Su misura · Rivenditori · Dove siamo": porta alle sezioni di questa pagina, come oggi. Se a 1024 px cinque voci non stanno, "Dove siamo" esce dal selettore e resta nel piè di pagina. |
| 4 | Vetrina, `id="collezione"` | Titolo e una riga, poi la griglia di foto a 6 colonne (2 sul telefono) che prima mostrava i dettagli del su misura: ora ogni riquadro è un capo di `prodotti.json`, con etichetta della categoria e, al passaggio, la scheda in vetro con nome, tessuto e prezzo. Ogni riquadro porta alla pagina del capo. Fino a 12 capi; se sono di più, i primi 12 e il link "Vedi tutta la collezione". Finché non ci sono capi: 12 riquadri segnaposto come oggi. Sotto, i tre ingressi per categoria (i tre riquadri di oggi). |
| 5 | Cultura e artigianato, `id="artigianato"` | Prende il posto del carosello della storia. Vedi sotto. |
| 6 | Porta sul su misura, `id="su-misura"` | La foto grande con la scheda misure in vetro (pezzo 7 del riferimento), titolo "La camicia su misura", una riga e la pillola "Scopri il su misura" verso `/camicie-su-misura/`. Quando il configuratore sarà completo la pillola diventerà "Crea la tua camicia". |
| 7 | Fascia rivenditori, `id="rivenditori"` | Come al punto 9. |
| 8 | Piè di pagina, `id="dove-siamo"` | Come oggi, con "Cultura e artigianato" al posto di "Storia" e "Diventa rivenditore". |

Escono dalla pagina iniziale: i dettagli del su misura, "Come funziona" con il modulo, le domande, il prezzo. I loro testi passano da `home.json` a `su-misura.json`, così la pagina del su misura non dipende più dai testi della pagina iniziale. Title della pagina iniziale: "Endero · Camicie e abbigliamento uomo dal 1996". Non accostare mai "dal 1996" a "fatto in Italia" nella stessa frase.

**Cultura e artigianato.** Il fondatore non ha foto d'archivio né un racconto da dare, e fatti inventati non se ne scrivono (regola in `CLAUDE.md`): per questo la storia lascia il posto al mestiere, che si può mostrare con le foto di oggi che il proprietario carica. Parole sue: "Cultura ed Artigianato"; sul sito "Cultura e artigianato".

- *In pagina iniziale* è il momento forte dopo l'apertura: una sezione a capitoli che resta ferma sullo schermo mentre si scorre. Una foto a tutta larghezza per capitolo; ogni foto nuova si scopre dal basso sopra la precedente; in basso a sinistra un riquadro in vetro con il titolo del capitolo e due righe. Da tre a cinque capitoli, circa due terzi di schermo di scorrimento ciascuno. Sul telefono funziona allo stesso modo. Con movimento ridotto o senza JavaScript i capitoli stanno uno sotto l'altro, ogni foto sopra il suo testo. In fondo il link "Scopri come lavoriamo" verso la pagina. Dal 2026-11-20 (proprietario: cliccando «Rivenditori» la pagina «deve sfogliare tutte le pagine di Chi siamo e poi andare giù… lo sfogliare è inutile»): uno scorrimento guidato (selettore, menu, collegamenti interni) che attraversa la sezione salta il tratto in cui resta ferma, con le foto immobili; arrivando proprio su «Chi siamo» dal basso la prima foto torna con una scoperta sola, calcolata fotogramma per fotogramma (se intanto si scorre a mano, la foto segue la mano). Scorrendo a mano non cambia nulla. Un doppio clic o un secondo clic durante il salto: quello nuovo chiude quello vecchio, la sezione resta ferma finché uno dei due la tiene, la testata non torna. Dalla tastiera fermano il salto solo i tasti che scorrono. Codice: `salta`, `trattiFermi` e `mestiere` in `src/sito.js`; controllo in `tools/prova-pagine.js`, parte 6, provato anche contro le versioni con i difetti trovati dalle due revisioni del 2026-11-20.
- *I capitoli nascono dalle foto*, non il contrario: prima arrivano le foto, poi si scrive un capitolo per ogni foto buona, descrivendo solo quello che la foto mostra. Finché le foto non ci sono, tre capitoli segnaposto ("Il taglio", "La cucitura", "Le rifiniture") con testo tra `[[ ]]`.
- *La pagina* `/cultura-e-artigianato/` usa gli stessi capitoli nel formato a foto e testo alternati della vecchia `/storia/`, più il nastro dei fatti e il richiamo ai rivenditori sotto "2.500 negozi serviti". H1: "Cultura e artigianato".
- *Le foto vere, dal 18 novembre 2026.* Il proprietario ha mandato sei foto (Drive, cartella "Foto Contesto": uno shooting dei capi indossati e dei dettagli, non il laboratorio). Sono sei capitoli, uno per foto, nella sezione della pagina iniziale; nella pagina la foto delle coppole fa da apertura e gli altri cinque restano capitoli. Titoli e testi sono bozze nostre e dicono solo ciò che la foto mostra in tutti i suoi ritagli. `tools/comprimi-foto.py <cartella degli originali>` le porta da 96 MB in tutto a meno di 0,9 MB per pagina: due ritagli per foto (orizzontale 3:2 per gli schermi larghi, verticale 2:3 per il telefono in piedi), più grandezze, AVIF e WebP, in `public/foto/artigianato/` con `foto.json`. Nelle pagine le scrive `foto()` di `src/parti/base.mjs`, che dove la foto manca lascia il segnaposto; `"fuoco": "alto"` nel JSON tiene la parte alta nei riquadri larghi. Gli originali non stanno nel repository.
- Il carosello esce dalla pagina iniziale; il suo codice resta finché non è certo che non serve altrove.

**Testata e menu.** Con più pagine serve arrivare ovunque da ovunque.

- Computer (da 810 px): scritta Endero a sinistra; a destra tre pulsanti che a riposo sono solo un'icona e al passaggio del mouse (o con il fuoco da tastiera) si aprono nella scritta: gruccia "Scopri la Collezione", vetrina "Diventa un Rivenditore", camicia "Ordina la tua camicia" (quello chiaro). Richiesta del proprietario del 15 novembre sera; è l'unico punto del sito dove un elemento cambia larghezza animandosi.
- "La tua camicia" ha preso il posto di "Prenota la presa misure" e apre una finestra al centro con due strade: "Configura la tua camicia online" (configuratore) e "Prenota per prendere le misure in sede" (modulo della pagina del su misura). Il proprietario aveva scritto "in store": sul sito è "in sede", come negli altri testi. Senza JavaScript il pulsante porta alla pagina del su misura. La testata è uguale in tutte le pagine, anche in quella dei rivenditori.
- Telefono: scritta, pulsante con icona e scritta "La tua camicia" (stessa finestra) e un pulsante "Menu" che apre un pannello a tutto schermo sul blu del piè di pagina con: Collezione, Su misura, Cultura e artigianato, Rivenditori, Dove siamo, e in basso WhatsApp ed email. Senza JavaScript "Menu" è un link normale al piè di pagina, che contiene le stesse voci. Il pannello si chiude con il pulsante, con Esc e scegliendo una voce; mentre è aperto la pagina sotto non scorre e il fuoco della tastiera resta dentro.
- La testata sta sugli stessi margini del contenuto, a ogni larghezza.

**Passaggio da una pagina all'altra.** Dissolvenza breve tra le pagine con le transizioni di pagina del browser (`@view-transition { navigation: auto }`), solo CSS: dove il browser non le conosce il passaggio è quello normale. Niente con movimento ridotto.

**Ordine dei lavori.** 1) testata, menu e piè di pagina; 2) pagina iniziale nuova; 3) pagina del su misura con i testi suoi; 4) cultura e artigianato; 5) diventa rivenditore (punto 9); 6) qualità (punto 11); 7) video e schermate su computer e telefono al proprietario, prima di aggiornare l'anteprima online.

**Costruita il 15 novembre 2026** da Opus 5.5 (passi 1–6), unita e ricontrollata. Da sapere per chi ci rimette mano:

- I reindirizzamenti stanno in un elenco solo, `worker/reindirizzamenti.mjs`: lo leggono `_redirects`, il Worker dell'anteprima e il server locale.
- Il modulo dei rivenditori salva i suoi campi nella colonna `dettagli`. Il database locale va ricreato (`npm run db:locale` dopo aver cancellato `.wrangler/`): la tabella che esiste già non prende la colonna nuova.
- L'ingresso al configuratore nella pagina del su misura e la pillola "Crea la tua camicia" in pagina iniziale sono pronti ma spenti: `configuratore.attivo` in `contenuti/it/su-misura.json`. Si accendono quando il proprietario approva il configuratore.
- Scelte prese costruendo, da far vedere al proprietario: il nastro è alto 220 px (nel riferimento circa 310) per regolare gli spazi; in "Cultura e artigianato" i fatti stanno in un nastro fermo, con "Diventa rivenditore" sotto "2.500 negozi serviti"; sul telefono la testata dice "Prenota" e non la frase intera, che a 320 px non entra.
- Restano deboli a vedersi, finché mancano le foto: i capitoli di "Cultura e artigianato" sono tre riquadri uguali; molto bianco sopra quella sezione; nella pagina dei rivenditori parola grande e titolo si ripetono ("SU MISURA" e "Su misura per i tuoi clienti").
- `npm run gusto` segnala ancora da 3 a 9 "CORREGGI" per pagina: sono tutte su scelte approvate (testata trasparente e pillola fissa sopra il contenuto, foto a filo, scheda che esce dalla foto sul telefono) o su pagine di solo testo. Vanno aggiunte all'elenco di `tools/gusto.js` solo dopo averle riguardate una per una.

## 11. Qualità: la skill `design-taste-frontend`

Aggiunta dal proprietario il 15 novembre 2026 "per perfezionare la UX/UI". È un kit completo per costruire siti da zero, con regole sue. Alcune vanno contro scelte già approvate dal proprietario e dal fondatore: in quei casi **vince l'approvato** (scelta del proprietario: "tieni l'approvato, aggiungi il meglio").

| Dalla skill si prende | Dalla skill non si prende |
| --- | --- |
| Lo strato di tocco: ogni pulsante, link, scheda e foto cliccabile risponde al puntatore (`references/motion.md`, "The hover layer") | Il divieto di scorrimento morbido, comparse allo scorrimento, apertura con caricatore, nastro, fisarmonica |
| I "momenti": una o due sezioni memorabili per pagina, guidate da foto o da parole (`references/moments.md`) | Foto di repertorio al posto di quelle mancanti (`scripts/photos.mjs`): per Endero solo foto vere |
| Margini uguali, una sola misura per ogni tipo di pulsante, un solo aspetto per i link | Contatti finti (`.example`, indirizzo senza numero civico): Endero pubblica i suoi contatti veri |
| Zone di tocco di almeno 44 px sul telefono, niente scorrimento di lato fino a 320 px | Colori, caratteri e forme "sorteggiati" e il suo `starter.html`: l'aspetto di Endero è deciso |
| Le regole sui testi di `references/copy.md`: titoli che nominano una cosa, pulsanti con verbo e oggetto, ogni fatto detto una volta | Il blocco di fine lavoro (`gate.mjs --start`): non va armato, fermerebbe ogni sessione sulle regole che non valgono |
| I controlli automatici, con `npm run gusto` | |

**Strato di tocco, misure da rispettare.** Solo con mouse (`(hover: hover) and (pointer: fine)`); il fuoco da tastiera mostra lo stesso stato. Pulsante: al passaggio sale di 1 px e il colore fa un passo, alla pressione scende di 1 px e scala a 0,985; 150 ms in entrata, 120 in uscita, 90 alla pressione. Link di testo: una riga sottile che si disegna da sinistra. Foto dentro un link: scala a 1,03 dentro la sua cornice, 600 ms in entrata e 400 in uscita, la cornice non cresce. Scheda cliccabile: sale di 2 px. Niente inclinazioni, bagliori, pulsanti magnetici. Si muovono solo trasformazioni e opacità, mai larghezze, altezze o margini.

**Controlli automatici.** `npm run gusto` genera il sito e passa la pagina iniziale; `node tools/gusto.js /camicie-su-misura/` un'altra pagina. Lo strumento apre la pagina a 1440, 390 e 320 px, toglie da solo le segnalazioni che per Endero non valgono (l'elenco e i motivi sono in testa a `tools/gusto.js`) e stampa il resto. Va usato su ogni pagina prima di mostrarla, insieme ai controlli nostri.

**Difetti veri trovati sulla pagina iniziale del 15 novembre**, da correggere in tutto il sito:

- A 320 px la pagina scorre di lato: testata, blocco del prezzo e piè di pagina escono dallo schermo.
- Sul telefono sono sotto i 44 px: la scritta Endero in testata, "Salta l'introduzione", la pillola di WhatsApp, il pulsante del selettore, i link di testo ("Scopri il su misura", "Leggi la storia"), i link del piè di pagina, la casella del consenso.
- Contrasto sotto 4,5:1: i numeri dei passi (`#6f7e9e` su bianco); il pulsante in vetro "Collezione" quasi non si stacca dal fondo quando sotto c'è una zona scura.
- Il campo del modulo che riceve il fuoco cambia troppo poco (serve 3:1), e i punti dove il fuoco arriva da un link interno non mostrano nulla.
- Sul telefono i margini sinistri sono quattro diversi (20, 26, 29 e 32 px) e la testata sta più fuori del contenuto: un solo margine.
- La pillola blu ha due altezze sul telefono (56 e 67 px) e "Prenota la presa misure" compare tre volte con tre aspetti.
- I link di testo hanno tre aspetti diversi.
- Lo spazio tra le sezioni è irregolare in tre punti (dopo l'apertura, dopo il nastro, prima del piè di pagina).

## 12. Configuratore

Riaperto dal proprietario il 15 novembre 2026, da costruire **a passi**: ogni passo si mostra e si approva prima del successivo. Le decisioni del 14 novembre restano valide (pagamento con Stripe, importo intero all'ordine; ordini per email e in un pannello riservato; il sarto verifica le misure prima del taglio). Chi ordina da casa dà solo le misure, guidate una per una: dal 21 novembre sono **le misure della camicia che gli sta meglio**, stesa su un tavolo, non del corpo (il sarto: «le misure sono quelle della camicia»). Opzioni e prezzi li manda il proprietario.

**Passo 1: la camicia e il riquadro in vetro.** Parole del proprietario (15 novembre): "il 3D di una camicia sospesa in aria che si muove quando ci passo sopra con il mouse. Accanto una tabella glass con le info che poi ti dirò e che il cliente deve compilare. Considera un caricamento". Riferimento di allora: `beat.noomoagency.com`. Indirizzo: `/camicie-su-misura/configuratore/`; la pagina del su misura la annuncia in cima.

- *Il riquadro in vetro* sta a destra (sotto, sul telefono) e contiene i campi del foglio di carta "Camicie su misura" di Endero, descritti in `contenuti/it/configuratore.json`. Si compilano le misure (giro collo, spalla, spallina, torace, pancia, bacino, lunghezza manica, braccio, avambraccio, polso, lunghezza totale davanti e dietro) e i dati del cliente; tessuto, collo, colori ricamo carré, taschino, asola, bottone, filato bottone, iniziali, note e i contrasti si vedono ma sono spenti finché il proprietario non dice cosa farne. Le righe d'aiuto sotto alcune misure vengono dagli appunti a mano sul foglio e sono tra `[[ ]]`; i limiti minimi e massimi sono nostri, larghi, da rivedere con il sarto. "Continua" è spento: il modulo non invia nulla. (Così fino al 25 novembre: dal riquadro a passi, punto 16, «Continua» porta al passo dopo e l'ordine parte dal passo Pagamento.) In questa pagina la pillola fissa di WhatsApp non c'è, perché coprirebbe i campi.

**Come ci si è arrivati: quattro giri di 3D in diretta, bocciati (15-16 novembre).** Serve a non rifare la stessa strada.

1. *Camicia 3D in diretta con three.js*, da un modello comprato dal proprietario: "mi sembra finta, non si muove come mossa dal vento, anche le ombre sono sbagliate e sembra fatta di plastica".
2. *Rifatta*: luce calcolata con Cycles e fissata sul tessuto, tessuto opaco con le cuciture ricostruite dal cartamodello, vento con una fisica vera della stoffa. Aspetto approvato sulla prova, vento chiesto "più deciso".
3. *La scena*: su un suo screenshot (una maglietta appesa davanti a un muro, con l'ombra e la luce di una finestra) ha chiesto la camicia su una gruccia con l'ombra dietro. Scelte sue che restano valide: parete blu Endero, luce di finestra con le sbarre, gruccia di legno. Più: tessuto meno spesso, via i puntini neri.
4. *Stirata e più mossa*: "il tessuto continua ad avere delle pieghe anche quando è fermo", "il movimento che do con il mouse è ancora troppo debole", deve dare "un senso di qualcosa di vero, di reale". Scelte sue che restano valide: popeline leggero e stirato, movimento "molto: ondeggia tutta".
5. *"Non ci siamo. Fa schifo il risultato finale. Direi di trovare un'altra strada: scaricare un blender già bello che fatto"*. Il limite non era un ritocco in più: il modello di partenza era povero, e un disegno in diretta nel browser non arriva alla qualità di un'immagine calcolata, che è ciò a cui lui la paragonava. Tra quattro camicie pronte che gli abbiamo cercato ha scelto quella di iMeshh (5 dollari). Gratis, con una licenza chiara, non c'era nulla di adatto.

Che cosa si è imparato: per la camicia il 3D in diretta non va riproposto; un movimento non si giudica dai fotogrammi fermi; sul movimento ha chiesto "di più" tre volte, non va tenuto basso per prudenza; prima di ore di calcolo gli si mostra un'immagine.

**Il film con la camicia comprata, 16 novembre 2026.** Il proprietario ha comprato "Hanging Button Shirt 01" (iMeshh) e l'ha messa nella cartella "Endero" del suo Google Drive (`Clothing_Hanging_Shirt-Button_01_Blender.zip`, 61 MB: il file Blender, le sue immagini di tessuto e una copia in FBX). Richieste sue: cambiare il colore dei bottoni (scelta: madreperla chiara), togliere i bottoni sulle punte del colletto, nastro blu scuro al posto di quello avorio ("non mi piace il bianco"), e il movimento "quando ci passo col mouse" (scelta: "vento dove passo", una folata dal lato da cui arriva il mouse). Tutto il 3D in diretta è stato tolto dal sito e dal repository (three.js compreso): resta nella cronologia di git.

- *La camicia* nel file è già stirata e appesa: 41.000 vertici in 28 pezzi di cartamodello accostati, spessore del tessuto 0,75 mm, immagini di colore, ruvidità e rilievo a 4096 punti. La grana di piccole grinze del tessuto è stata abbassata al 60% ("popeline leggero e stirato"). Bottoni di madreperla chiara; la gruccia, che nel file è di plastica nera, è di legno; il gancio resta di metallo.
- *La scena* (`camicia/film/scena.py`): parete blu Endero 52 cm dietro la camicia, un sole basso da davanti a destra che passa per una finestra con le sbarre (non si vede: fa solo ombra), una schiarita morbida da sinistra, stanza in penombra azzurra. L'ombra della camicia sulla parete e le fasce di luce sul tessuto sono vere: le calcola Cycles. Il fotogramma è 1800×1000. Sul computer la pagina ne mostra la fascia larga il doppio dell'altezza (tra l'8 e il 98% dall'alto), perché le finestre dei browser sono larghe e basse (1920×950, 1440×790): con un fotogramma più stretto, ritagliato per coprirle, l'orlo della camicia finiva tagliato. L'aria in più sopra il gancio serve al telefono, dove in alto c'è la testata. La camicia sta a sinistra (al 39,5% della larghezza); a destra la parete è in ombra, del blu della pagina, e lì sopra sta il riquadro in vetro. Su richiesta del proprietario ("Avvicina un po', troppo lontano") la camicia è più vicina: dal gancio all'orlo prende l'87% dell'altezza dello schermo del computer.
- *Il movimento* non è la simulazione dei tessuti di Blender (qui accartoccia) ma la fisica che avevamo scritto per il browser (`camicia/film/stoffa.mjs`): `telaio.py` ricava dalla camicia un telaio di 4.500 punti, saldando i pezzi lungo le cuciture; `muovi.mjs` ci simula il movimento e fa seguire al telaio tutti i punti veri e i bottoni. La prima versione erano folate di vento ("vento dove passo", scelta sua). Provata dal vivo, l'ha corretta: "il movimento non deve essere proprio il vento: deve essere come se io toccassi con la mano il tessuto in modo leggero, ampio però e morbido. Mi piace, però, che quando muovo sulla camicia si muova anche la gruccia e il cavo". Ora è una mano: un palmo largo (21 cm di raggio) che attraversa il petto in un secondo, preme il tessuto di due centimetri e mezzo e lo accompagna appena di lato. La camicia è un pendolo appeso al punto in cui il nastro è fissato, 75 cm sopra il gancio: sotto la mano cede verso la parete, dondola di 5 gradi e si torce di 7, con la gruccia e il nastro; maniche e orlo la seguono in ritardo. Con una mano che preme di più (4 cm) o trascina di più il tessuto si accartoccia: non è morbido. Due scene, "da sinistra" e "da destra": ognuna parte dalla camicia ferma e ci ritorna esattamente. Provato il tocco, il proprietario lo ha voluto "più lento" e, tra tre velocità messe sull'anteprima (con un parametro provvisorio nell'indirizzo), ha scelto la più lenta: il film va a metà della velocità con cui il movimento è simulato, otto secondi per scena.
- *I fotogrammi* (`produci.py`): 1800×1000, 95 per scena (12 al secondo del film: quelli di mezzo, per arrivare a 24, li ricava `monta.py` con ffmpeg dal movimento tra un fotogramma e il successivo), 64 secondi l'uno su questo ambiente con 32 campioni, che dopo la ripulitura non si distinguono da 96; si calcola solo la fascia in cui la camicia e la sua ombra si muovono (`--bordo`), perché fuori la parete non cambia mai. Si rilancia senza perdere nulla: salta quelli già fatti. L'immagine a riposo si calcola anche a grandezza doppia (`--doppia`): è quella che si guarda quasi sempre, e sugli schermi fitti (telefoni, portatili Apple) si vede la trama del tessuto.
- *Sul sito* (`monta.py` → `public/camicia/`): l'immagine ferma (anche doppia) e due video per il computer, e gli stessi ritagliati in verticale intorno alla camicia, tre per quattro, per il telefono. Ogni video pesa circa un megabyte, le immagini ferme tra 50 e 120 KB. La pagina mostra l'immagine; `src/configuratore/configuratore.js` fa partire la scena del lato da cui il mouse passa sulla camicia (col dito: una strisciata, o un tocco dal lato in cui si tocca), e una volta da sola appena è pronta. Una scena non si interrompe finché la camicia non è quasi ferma (6,8 secondi), o salterebbe. Senza JavaScript, con il movimento ridotto o con il risparmio dati resta l'immagine ferma.
- *Dove cade la camicia nella pagina* (`configuratore.css`): sugli schermi più stretti del fotogramma, questo scorre a sinistra quanto basta perché la camicia resti in mezzo alla sua colonna (`--camicia`, `--posto`); su quelli più larghi resta a sinistra e a destra sfuma nel blu della parete in ombra, che è il fondo della pagina. Sotto i 960 px la camicia va sopra e il riquadro sotto; sotto i 600 si usano i file verticali e il palco prende la loro forma, così la camicia si vede intera dal gancio all'orlo, sotto la testata. Nelle finestre alte e strette (un tablet o un monitor in verticale) vale la stessa disposizione, o la camicia finirebbe sotto il riquadro. Il controllo di allora (`tools/prova-camicia.js`) è uscito dal sito insieme al film; oggi la disposizione a più formati la controlla `tools/prova-leggera.js`.
- *Come si rifà* (serve il file comprato, che si scarica dal Drive del proprietario):
  `<venv>/bin/python camicia/film/prova.py <file.blend> prova.png` per un'immagine sola;
  `<venv>/bin/python camicia/film/telaio.py <file.blend> <moto>`, poi `node camicia/film/muovi.mjs <moto>`;
  `<venv>/bin/python camicia/film/produci.py <file.blend> <moto> <fotogrammi> --scena ferma --doppia`, poi `--scena da-sinistra --campioni 32 --bordo 0.055 0.64 --da 1 --a 95` e lo stesso per `da-destra` (per una versione di prova: `--larga 900 --alta 500 --campioni 16 --bordo 0.04 0.72`);
  `python3 camicia/film/monta.py <fotogrammi> public/camicia` (dal 18 novembre il sito usa solo le immagini ferme che scrive, non le scene).
- *Licenza*: "Royalty Free" di Superhive, uso commerciale sì, ridistribuire il file no. Sul sito vanno solo immagini e video calcolati; il file comprato non sta nel repository (`.gitignore` esclude ogni `.blend`).

**La camicia in diretta, 17-18 novembre 2026.** Provato il film definitivo, il proprietario lo ha scartato: "la tocco una volta, si muove, si sgrana anche un po' l'immagine. Devo aspettare che si fermi per poterla rimuovere. Io voglio poterla muovere come voglio, quanto voglio, anche continuamente", e lo trova pesante da caricare. Una prima risposta, le stesse immagini messe in fila come pose e scelte dal mouse (`camicia/film/pose.py`, `src/configuratore/libera.js`, `?prova=libera`), l'ha bocciata: tornando indietro col mouse "è come se la camicia andasse in reverse come un film messo all'indietro". Il riferimento è il cappotto di `beat.noomoagency.com`: un modello 3D in diretta (three.js) che segue il mouse. Scelte sue: camicia sempre di fronte, tessuto che cede e ondeggia dove passa il mouse; 3D in diretta, con un'immagine di confronto col film prima di proseguire.

- *L'idea.* Le prime prove di 3D in diretta sembravano finte perché la luce la calcolava il browser. Qui il browser non calcola nessuna luce: la camicia resta di fronte, quindi ciò che si vede di lei è quasi sempre ciò che si vede da ferma. Il browser muove la forma e sopra ci proietta, dalla stessa camera, le immagini calcolate da Cycles. Da ferma è l'immagine di Blender (differenza media: 2 livelli su 255).
- *Ciò che Blender prepara* (`camicia/viva/scatta.py`, un quarto d'ora): la camicia con gruccia e nastro, senza parete, a grandezza doppia, col sole pieno (senza le sbarre della finestra) e col sole spento; la parete da sola, con la luce della finestra e senza sole; il disegno di luce della finestra visto dal sole; le forme (camicia semplificata a 13.600 punti, bottoni, gruccia, nastro) e la camera. `immagini.py` ne fa immagini per il browser (applica l'esposizione del file comprato, +0,74 stop, e fa proseguire il colore della camicia oltre la sua sagoma); `monta.mjs` lega camicia e bottoni al telaio della fisica e scrive tutto in `public/camicia/viva/` (0,8 MB in tutto).
- *Ciò che fa il browser* (`src/configuratore/viva.js`, WebGL2 senza librerie): 1) la fisica della stoffa del film (`camicia/film/stoffa.mjs`): il mouse è una mano che preme e accompagna il tessuto, e la camicia appesa dondola e si torce, a 0,6 del tempo vero; 2) disegna la forma spostata e ci proietta le due immagini della camicia: quanto sole arriva in ogni punto lo dicono le sbarre della finestra, che restano ferme nello spazio; il tessuto che si gira verso la luce si schiarisce rispetto a da fermo; 3) l'ombra sulla parete è la sagoma della camicia vista dal sole, sfumata, che sceglie tra la parete illuminata e quella senza sole. La tela compare quando la camicia si muove; ferma, torna in vista l'immagine di Blender, che è la stessa. Con il movimento ridotto, il risparmio dati o senza WebGL2 resta l'immagine ferma.
- *Le maniche.* Libere come nel film, in diretta si accartocciano e attraversano il fianco (la stoffa non sa di non potersi attraversare): tornano al loro posto con quattro volte la forza del corpo, sotto la mano cedono quasi come il corpo ma non si lasciano portare di lato, e nel disegno stanno davanti al fianco (tranne vicino alla spalla). La mano si misura sul tessuto com'era da fermo, o il tessuto che cede le sfugge. Ogni punto si lega solo a triangoli del telaio che guardano dalla sua stessa parte. Restano una sbavatura sotto l'ascella destra dopo il tocco e bordi a tratti seghettati.
- *Come si prova* nel browser di prova, dove il 3D gira sul processore: `?prova=viva&manuale` (il tempo avanza a comando), Chromium con SwiftShader, schermate via CDP; `&nudo` mostra la sola forma. Mai provata su una scheda grafica vera.
- *Come si rifà*: `<venv>/bin/python camicia/viva/scatta.py <file.blend> <lavoro>`; `<venv>/bin/python camicia/viva/immagini.py <lavoro> <ferma.png del film> public/camicia/viva`; `node camicia/viva/monta.mjs <lavoro> <cartella di telaio.py> public/camicia/viva`.

**La camicia leggera, 18 novembre 2026.** Provata la camicia in diretta, il proprietario l'ha bocciata: "non ci siamo, rendiamoci più semplice. Rendi il movimento molto più leggero, la gruccia si muove. Non far muovere così tanto il tessuto perché sembra finto e poco naturale", e sul suo computer andava a scatti. Ha chiuso con "Ho capito che non sai farlo, è inutile andare avanti. Chiudiamo". Tessuto che si deforma e 3D in diretta non si ripropongono.

- *L'idea.* Il tessuto non si deforma più. L'immagine ferma di Blender è divisa in tre pezzi sovrapposti: la parete con la luce della finestra, l'ombra della camicia, la camicia ritagliata con gruccia e nastro. Fermi, ridanno l'immagine di Blender punto per punto. Passandoci sopra col mouse la camicia segue appena la mano e, quando la mano la lascia, dondola sul nastro e si ferma; l'ombra la segue sulla parete. Si muove tutto d'un pezzo, come una camicia appesa sfiorata con la mano.
- *Ciò che Blender prepara.* Alle immagini di `camicia/viva/scatta.py` si aggiungono due viste della parete a sole pieno, con e senza l'ombra della camicia (`camicia/leggera/ombra.py`, due minuti): dal confronto esce l'ombra anche dove passano le sbarre della finestra e dietro la camicia. `camicia/leggera/ritaglia.py` fa i tre pezzi dall'immagine ferma del film: ciò che il conto "parete più ombra" non spiega dell'immagine vera (la luce che la camicia rimanda sulla parete, la grana) lo aggiunge a tutti e due, così la somma torna esatta; sul bordo della camicia il colore è quello che, sopra la parete, ridà l'immagine vera; il filo scuro di un punto che la ripulitura dal rumore lascia intorno alla camicia va con la camicia, non resta sulla parete. Ogni pezzo esce in tre grandezze (1, 1,5 e 2 volte il fotogramma) e il browser prende la più vicina allo schermo: 90 KB su uno schermo normale, 270 su uno fitto.
- *Ciò che fa il browser* (`src/configuratore/leggera.js`, nessun 3D): tre immagini in un piano che misura in punti del fotogramma; camicia e ombra si spostano con una trasformazione CSS (`matrix3d`) calcolata dalla camera di Blender: la camicia è trattata come un piano che dondola intorno al punto in cui il nastro è fissato (di lato, verso la parete, e girando sul nastro), e l'ombra è lo stesso piano portato sulla parete lungo i raggi del sole. Finché la mano la tocca la camicia la segue con una molla ben smorzata, per una piccola parte della strada della mano; lasciata, è un pendolo che si smorza, a 0,6 del tempo vero. Un clic o un dito appoggiato danno un colpetto. A camicia ferma non si calcola niente. I pezzi compaiono appena caricati e restano in vista. Con il movimento ridotto, il risparmio dati o senza JavaScript resta l'immagine ferma.
- *Quanto si muove* lo ha scelto il proprietario. Provate tre misure ai loro indirizzi (con una passata decisa l'orlo si spostava di circa 1, 2 e 4 centimetri), ha risposto: "Porta a 6 cm. Quando apro configuratore la camicia parte con un movimento". Quindi: 6 cm all'orlo con una passata decisa (i numeri stanno in cima a `leggera.js`: `MANO`, `COLPETTO`, `LIMITE`), e appena i pezzi sono in vista la camicia dondola una volta da sola (`SALUTO`, circa 4 cm), solo se la si sta guardando. Sul suo computer: "Sì, è fluida".
- *Come si prova*: `node tools/prova-leggera.js [indirizzo]` col sito acceso o sull'anteprima (dieci schermi, tra cui un telefono basso e uno di traverso; mouse, dito, tocchi ripetuti, strisciate storte; movimento ridotto, senza JavaScript, fotogrammi al secondo: 146 controlli). `?manuale` fa avanzare il tempo a comando.
- *Dalla revisione indipendente* (18 novembre): sotto i 960 punti la sfumatura in basso è un velo solo sopra immagine ferma e pezzi (`.configura__palco--strati::after`), non una maschera su ciascuno; sui telefoni bassi i pezzi si tagliano dove finisce l'immagine ferma; un tocco fermo dà un colpetto che si vede ma non si somma ai precedenti; strisciando di lato la pagina non scorre (`data-lenis-prevent-touch` finché dura il gesto); se la finestra cresce si caricano pezzi più grandi; i file portano l'impronta della cartella, messa dal build, così chi torna non usa i vecchi. Da guardare su apparecchi veri: Safari e Firefox (un mezzo punto di scarto quando il movimento parte o finisce), memoria sui telefoni modesti.
- *Come si rifà*: `<venv>/bin/python camicia/viva/scatta.py <file.blend> <lavoro>`, `<venv>/bin/python camicia/leggera/ombra.py <file.blend> <lavoro>`, poi `<venv>/bin/python camicia/leggera/ritaglia.py <lavoro> <ferma.png> <ferma-2x.png> public/camicia/leggera` (le due immagini ferme sono quelle di `camicia/film/produci.py --scena ferma --doppia`).

**Il tessuto che ondeggia, 18-19 novembre 2026.** Scelta la camicia leggera, il proprietario ha mandato un riferimento, `https://motion-depth.framer.website`: passando sopra un'immagine, quella ondeggia come un telo di stoffa, con le pieghe in chiaro e scuro. "Oggi la camicia è immobile e si muove solo a destra e sinistra, riesci ad applicare l'animazione che ti ho inviato nel sito template sulla nostra camicia? (Anche più leggero)". Guardato da vicino, quel sito fa una simulazione di stoffa nel browser e la disegna con WebGL, schiarendo e scurendo l'immagine secondo come si gira ogni punto, in modo che da ferma sia l'immagine di partenza.

- *La scelta.* Messe sull'anteprima tre misure ai loro indirizzi, il 19 novembre il proprietario ha scelto "B, di mezzo", e alla domanda sulla fluidità: "Sì, è fluido". Da allora è la camicia normale del configuratore.
- *Com'è fatta da noi* (`src/configuratore/onda.js`, acceso da `leggera.js`). Parete e ombra restano quelle della camicia leggera; la camicia ritagliata non è più un'immagine spostata tutta insieme, ma è stesa su una griglia di 22 per 40 punti che sta sul piano della camicia. In alto, dove c'è la gruccia, la griglia è appesa e segue il dondolio; sotto si libera per gradi ed è stoffa: maglie che tengono la loro lunghezza, una forza che la riporta piatta, e tre cose che la muovono: la gruccia che dondola (il tessuto la segue subito per la gran parte e resta indietro per il resto), l'aria finché il mouse le sta sopra (tre onde lente incrociate, come forza e non come forma), la mano dove passa. Le pieghe prendono più o meno luce secondo il sole della scena di Blender, non una luce inventata, e solo rispetto alla camicia piatta: ferma, è l'immagine di Blender.
- *Quanto pesa.* Un solo disegno di 1.700 triangoli e meno di un millisecondo di conto a fotogramma. La versione bocciata faceva una fisica su 4.500 punti, muoveva 13.600 vertici e ridisegnava l'ombra a ogni fotogramma.
- *Le protezioni.* Dove il browser non ha l'accelerazione grafica la stoffa non parte; se parte ma i fotogrammi arrivano a meno di trenta al secondo, rinuncia da sola: in tutti e due i casi resta la camicia leggera. Con il movimento ridotto non parte niente.
- *Le misure* (in cima a `onda.js`; `forza` 1 è la B scelta, le altre due provate erano 0,6 e 1,6): col mouse sopra il tessuto si scosta dalla camicia rigida di circa un centimetro (0,5 e 3 nelle altre due); con una passata decisa di 2,6 (1,3 e 4).
- *Come si prova*: è dentro `tools/prova-leggera.js` (174 controlli in tutto). Il browser di prova non ha scheda grafica: `?comunque` accende il tessuto anche lì, `?rigida` lo spegne per provare la camicia che si vede dove la scheda grafica manca. Lo stesso controllo verifica che, quando i fotogrammi arrivano lenti, il tessuto rinunci da solo.

**Stato al 19 novembre 2026.** La pagina normale del configuratore, sull'anteprima, è la camicia leggera con il tessuto che ondeggia (6 cm di dondolio, movimento all'apertura, misura B del tessuto); dove la scheda grafica manca o va lenta resta la camicia che dondola tutta insieme. Film, pose e 3D in diretta sono usciti dal sito: lettori, file e controllo (`src/configuratore/viva.js` e `libera.js`, `public/camicia/*.mp4`, `pose/`, `viva/`, `camicia/viva/immagini.py` e `monta.mjs`, `camicia/film/pose.py`, `tools/prova-camicia.js`) stanno nella cronologia di git fino al commit `ec71cd2`. Restano gli strumenti che servono a rifare l'immagine ferma e i tre pezzi: `camicia/film/` (scena, immagine ferma) e `camicia/viva/scatta.py`. Poi: i campi spenti e l'invio dell'ordine. Mai provata con Safari né su un telefono vero.

**La guida alle misure, 21 novembre 2026.** Il sarto ha detto che le misure dei suoi fogli sono quelle della camicia, non del corpo. Scelte del proprietario: chi ordina da casa indossa la camicia che gli sta meglio, la toglie, la abbottona e la stende su un tavolo; entrando nel configuratore si apre ogni volta una finestra in vetro con i passi, e un tasto la riapre; ogni campo ha una «i» che mostra sulla camicia, tratteggiato in blu, dove misurare; per spalla e lunghezza dietro la camicia si gira; sul telefono la «i» apre una finestra sopra il modulo; le frasi le scriviamo noi e le conferma il sarto. Al cliente si dice cosa fare e basta: per esempio non gli si dice che le larghezze le raddoppiamo noi (proprietario: «al Cliente poche informazioni, chiare ed utili»).

- *La finestra dei passi* (`#come-misurare`, `passi()` in `src/configuratore/guida.js`): «Indossa la camicia che ti sta meglio. · Toglila, abbottonala e stendila su un tavolo. · Armati di un metro. · Prendi le misure come indicato per ogni campo.» (il secondo passo è nostro), tasto «Inizia». Si apre a ogni visita (`?senza-passi` no, per le prove); la camicia saluta quando si chiude. Il tasto «Come misurare» sopra le misure la riapre. Senza JavaScript i passi e le frasi stanno nel riquadro, in un `<noscript>`.
- *Le linee* (`public/camicia/guide.json`) non sono disegnate a mano: `camicia/guide/linee.py` le calcola sulla camicia comprata, nella stessa posa e con la stessa camera dell'immagine ferma. I pezzi del modello sono i pezzi del cartamodello e le loro coordinate di tessuto sono il cartamodello steso: una riga dritta lì è la riga che il cliente misura sulla camicia stesa. Collo e polso a metà altezza, da bottone ad asola; spallina sulla cucitura; spalla sul carré da un punto spalla all'altro; lunghezze lungo il filo (davanti) e al centro (dietro, sopra la piega); manica sulla piega di sopra fino al bordo del polsino; torace (1,5 cm sotto le ascelle), pancia (3° bottone dal basso) e bacino (1° bottone) di traverso da un fianco all'altro; braccio (10 cm sotto l'ascella lungo la manica appesa) e avambraccio (15 cm sopra il polsino) come un metro stretto intorno alla manica. Le parti nascoste (dietro una manica, sul retro) sono più sottili e chiare. Per il disegno, non per le misure: torace, pancia e bacino si raddrizzano, le linee sul bordo della camicia si staccano dalla parete e dalla gruccia, le punte delle pieghe viste di taglio si tolgono. Ogni linea ha un riquadro per la finestra del telefono. Controllate da un agente indipendente su una mappa, punto per punto, di cosa c'è sotto ogni pixel; posizioni di braccio e avambraccio da confermare con il sarto.
- *Il retro* (`camicia/guide/retro.py`): la camicia girata di mezzo giro sullo stesso perno, con le luci della scena (`public/camicia/retro/dietro*.webp`), e un secondo di giro (`giro.mp4`, `ritorno.mp4`: il primo fotogramma è l'immagine ferma, l'ultimo quella da dietro). Nel modello comprato la gruccia di legno buca il tessuto dietro il colletto di un paio di millimetri: da dietro si vedeva, e `retro.py` scosta lì la stoffa (al più 4 mm; davanti nessun punto si sposta di più di un millimetro).
- *Il 22 novembre, provata la prima versione* (proprietario: «Provato e non ci siamo ancora»): «Il tratto sulla camicia deve comparire quando clicco nel campo per inserire il valore. Elimina la i. Il tratto deve essere più leggero ed elegante. Quando clicco nel campo oltre a comparire il tratto deve avvenire un elegante zoom in sul punto della camicia in cui è presente il tratto». Scelte sue: sul telefono un riquadro con lo zoom sopra il campo; la frase sotto il campo, piccola; tratteggio sottile senza alone. La «i», il riquadro con nome e frase sotto la riga e la finestra della guida sul telefono non ci sono più.
- *Sul computer* (palco fisso accanto al modulo): entrando in un campo di misura (clic o Tab) la camicia si ferma (`ferma()` in `leggera.js`), i pezzi che si muovono lasciano il posto all'immagine ferma (è la stessa) e tutti i livelli della camicia (immagine ferma, la sua copia a grandezza doppia che resta definita, retro, video del giro, linee) fanno insieme uno zoom di 1,1 secondi sulla zona della linea, centrata nella parte di palco a sinistra del riquadro in vetro (una sola trasformazione, `--zoom` sul palco). Il tratteggio si disegna mentre lo zoom finisce, sempre dello stesso spessore sullo schermo a qualunque ingrandimento, con le parti nascoste più fini e trasparenti e due punti ai capi (misure e colore più sotto). Passando a un'altra misura dello stesso lato lo zoom scivola sulla zona nuova; per spalla e lunghezza dietro prima si torna indietro, la camicia si gira, poi lo zoom. Uscendo dalle misure (o con Esc) lo zoom torna indietro, la camicia si rigira di fronte e risponde di nuovo alla mano. La camicia si gira un giro alla volta verso l'ultima vista chiesta.
- *Le tre misure dello zoom*: `?zoom=a` leggero (al più 1,6 volte, zona di almeno 460 punti del fotogramma), `?zoom=b` di mezzo (2,2 e 340), `?zoom=c` forte (3 e 250). Provate tutte e tre, il proprietario ha scelto la forte («Mi piace forte», 22 novembre), che è quella normale; a e b restano negli indirizzi per confrontarle.
- *La camicia nitida per lo zoom* (`camicia/guide/nitide.py`, `public/camicia/nitide/`): a tre volte l'immagine ferma a grandezza doppia si vede morbida, quindi davanti e dietro si calcolano a grandezza quadrupla, ma solo nel riquadro della camicia (punti 400-1050 per 110-990 del fotogramma): fuori c'è la parete, liscia. La pagina la scarica quando è ferma, la mette sopra l'immagine ferma solo durante lo zoom (con l'origine della trasformazione nell'angolo del fotogramma, così si muove con gli altri livelli) e solo se è già pronta prima che lo zoom parta.
- *La frase* su dove misurare non si vede più (proprietario, 22 novembre: «elimina il testo che compare sotto ogni box ogni volta che ci clicco. Non serve»). Resta nella pagina come testo per i lettori di schermo (`.misura__dove.nascosto`, legata al campo con `aria-describedby`), e resta la base del questionario del sarto.
- *Il tratto*, dopo la prova del 22 («Rendi la linea più visibile, leggermente luminosa e 1.5 più spessa»): 2,25 punti di schermo, trattini di 7 e spazi di 5, blu `#2a63f5` con due aloni di luce blu (un'ombra senza spostamento stretta e una larga), capi di 3,9 punti.
- *Sul telefono e sul tablet* (palco sopra il modulo, la camicia non si vede mentre si scrive): sopra il campo compare un riquadro (`.misura-lente`, largo quanto il modulo, alto al più 240 punti) che si apre sull'insieme della camicia e scivola con uno zoom di 0,75 secondi sulla zona della misura, poi si disegna il tratteggio. Sta sopra le righe di prima senza spostare nulla nel modulo; se finisce sopra il bordo dello schermo (o della parte libera dalla tastiera, `visualViewport`) la pagina scende quanto basta, senza mandare il campo sotto la tastiera. Passando a un'altra misura il riquadro scivola sul campo nuovo.
- *Le frasi* stanno in `contenuti/it/configuratore.json`, campo `guida` di ogni misura, tra `[[ ]]` finché il sarto non le conferma. Il sarto le conferma sullo stesso link del suo questionario («Come si misura la camicia», 14 domande con l'immagine ravvicinata della linea: `camicia/guide/anteprime.py` fa le immagini, la cartella del questionario sta fuori dal repository); le sue 10 risposte di prima restano nell'archivio.
- *Il calcolo della taglia* confronta direttamente con le otto camicie campione, senza agio: torace, pancia, bacino, braccio e avambraccio il cliente li misura in larghezza e `worker/taglie.mjs` li raddoppia per confrontarli con i giri dei fogli.
- *Come si prova*: `node tools/prova-misure.js [indirizzo] [cartella per le schermate]` (la finestra dei passi su sei schermi, compreso il telefono di traverso; ogni campo sul computer, con zoom, tratteggio in vista accanto al riquadro, spessore e frase; Tab, Esc, uscita, campi in fretta; le tre misure dello zoom; la rete lenta; il riquadro sopra il campo su tablet e telefoni; movimento ridotto; senza JavaScript).
- *Come si rifà* (serve il file comprato): `<venv>/bin/python camicia/guide/linee.py <file.blend> public/camicia/guide.json [--controllo <file.json>]` (dieci secondi); `<venv>/bin/python camicia/guide/retro.py dietro <file.blend> <lavoro>`, poi `giro` (40 minuti) e `python3 camicia/guide/retro.py monta <lavoro> <ferma.png> public/camicia/retro`; le immagini per il sarto: `python3 camicia/guide/anteprime.py public/camicia/guide.json <ferma-2x.png> <dietro-2x.png> <cartella>`; la camicia nitida per lo zoom: `<venv>/bin/python camicia/guide/nitide.py <file.blend> <lavoro>` (circa mezz'ora per le due viste), poi `python3 camicia/guide/nitide.py monta <lavoro> public/camicia/nitide`.

**Passi successivi, nell'ordine.** 2) scelta del tessuto, che cambia la camicia; 3) collo, polsi e altre opzioni, con i pezzi che cambiano; 4) le misure (guida fatta il 21 novembre; restano le frasi confermate dal sarto); 5) riepilogo, pagamento con Stripe, ordine a Endero. Ogni passo aspetta l'approvazione del precedente e i dati del proprietario (opzioni, prezzi, tempi di consegna).

**Chi fa cosa.** Scena 3D e preparazione del modello: Fable 5.2, come per il film. Pagina, riquadro, modulo e collegamento al resto del sito: Opus 5.5.


**Logica delle taglie e questionari (dal 18 novembre 2026).** Il proprietario vuole che con l'ordine arrivi in azienda anche la taglia di partenza con le variazioni («Taglia 41 · collo +2 cm · manica −6 cm»). Le regole confermate dal titolare stanno in `CLAUDE.md`; le misure delle otto camicie campione non stanno nel repository.

- *Come si chiede a Endero*: una pagina a passi, una domanda per schermata, con il pezzo del loro foglio accanto a quello che abbiamo capito. La prima (24 domande al titolare) era un artifact di Claude, e chi non ha Claude non poteva salvare: dal 19 novembre i questionari stanno sul Worker `endero-domande` (`domande/worker.js`, `domande/pagina.html`), che si apre con un link lungo e casuale e salva ogni risposta nell'archivio KV.
- *Per chi non è pratico di tecnologia* (richiesta del proprietario, 19 novembre): si apre e c'è già la prima domanda senza risposta; il testo è da 18 px in su e i tasti delle risposte sono alti almeno 56 px, uno sotto l'altro; toccata una risposta si passa da soli alla domanda dopo; il pezzo di foglio non si fa scorrere di lato e non si rimpicciolisce: se è troppo largo va a capo in due o tre strisce, come una riga di testo; alla fine c'è «Fatto, grazie!» e niente da mandare. La prima versione chiedeva all'inizio «Rispondo per Endero» o «Sto solo guardando la pagina»: l'ha tolta. Per guardare senza salvare si aggiunge `?prova` in fondo al link.
- *Tre tipi di schermata*: una proposta da approvare («Sì, va bene» / «No, la cambio», e allora si corregge il testo proposto, già scritto nel riquadro); una domanda con le risposte pronte; un numero da scrivere (i centimetri), con un esempio che fa il conto mentre si scrive, oppure «Dipende: lo spiego io». Il formato delle domande è in testa a `domande/carica.mjs`.
- *Comandi*: `npx wrangler deploy --config wrangler.domande.toml` pubblica il motore; `node domande/carica.mjs <cartella> --base <indirizzo del Worker>` carica domande e ritagli (la cartella sta fuori dal repository, la chiave del link la crea lo script e ricaricando resta la stessa); `node domande/leggi.mjs <link>` legge le risposte; `node tools/prova-domande.js <link>` fa 63 controlli, ma solo su un questionario con `"prova": true`, che poi si toglie dall'archivio.
- *Se la rete cade* la risposta resta in coda sul dispositivo e riparte da sola; la fine dice «puoi chiudere la pagina» solo quando sul server c'è tutto.
- *Il calcolo* (`worker/taglie.mjs`): dal 21 novembre le misure sono della camicia del cliente e non si aggiunge agio; le cinque larghezze (torace, pancia, bacino, braccio, avambraccio) si raddoppiano per avere il giro dei fogli. Poi per ogni taglia si conta quanto dista dalla camicia campione, in taglie e non in centimetri, con peso doppio per collo, spalle e torace; vince la somma più bassa. Le differenze da mezzo centimetro in su diventano variazioni, arrotondate al mezzo. L'ordine è «da verificare» se il cliente sta oltre la prima o l'ultima taglia di più di mezza taglia, se una variazione supera la soglia del sarto, se manca una misura. `perIlReparto` restituisce il testo per l'ordine: la riga, l'eventuale avviso, e sotto le misure scritte dal cliente. `node tools/prova-taglie.mjs` fa 45 controlli su numeri inventati; con il file della configurazione vera (fuori dal repository) controlla anche che ogni camicia campione ritrovi la propria taglia.

## 13. Collezione: il lookbook

Fatto il 19 novembre 2026 con le 46 foto che il proprietario ha messo su Drive nella cartella "Foto da caricare", e messo sull'anteprima con il suo ok ("Aggiornala subito"). Le sue scelte: lookbook diviso per tipo con il filtro in cima, foto che si aprono grandi al tocco, ingressi "Maglieria · Giacche e cappotti · Su misura", segnaposto dove non c'è una foto adatta, nessun video per ora.

**Le foto.** Sono capi indossati, quasi tutti davanti alla stessa parete blu. Quattro tipi: maglieria (20), giacche e cappotti (9), abiti (11), felpe (6). Di 55 file della cartella, 46 sono foto diverse, 5 sono copie identiche di altre, una è la stessa foto esportata due volte, 3 sono video. Le foto prese da Instagram sono larghe 1440 punti: bastano per la griglia e per il telefono, a tutto schermo su un computer grande sono al limite.

**L'ordine.** Dentro ogni tipo le foto vanno per colore, dal blu notte ai colori caldi, alternando figura intera e dettaglio perché due foto quasi uguali non stiano vicine. Otto foto sono "grandi" (occupano quattro riquadri): quelle con la composizione più forte, messe in modo che la griglia non lasci buchi a cinque, quattro e tre colonne. L'ordine è quello dell'elenco `look` in `contenuti/it/collezione.json`: per cambiarlo si spostano le righe.

**I nomi.** Ogni file si chiama tipo, capo, colore: `maglieria-dolcevita-trecce-blu-notte`. La descrizione di ogni foto (il testo per chi non la vede e per Google) dice cosa si vede, non è il nome di un prodotto: i nomi veri dei capi li dà il proprietario. `docs/registro-foto.md` tiene la corrispondenza con i nomi di partenza, i pesi e le pagine in cui ogni foto compare. Su Drive il nome nuovo ce l'hanno 34 foto su 46: le rinomine le ha fermate il proprietario.

**La pagina.** In cima una foto grande, poi il filtro (Tutti, Maglieria, Giacche e cappotti, Abiti, Felpe, ognuno con il suo numero), che resta attaccato in alto mentre si scorre. Le foto stanno in riquadri due per tre: cinque colonne sugli schermi grandi, poi quattro, tre, due sul telefono, quattro sul telefono di traverso. Senza JavaScript i tasti del filtro portano alle quattro parti della pagina e ogni foto è un link alla sua versione grande.

**Il visore.** Toccando una foto si apre a tutto schermo: sotto c'è subito la copia piccola già scaricata e sopra compare quella grande. Si cambia foto con le frecce, la tastiera o il dito; si chiude con il tasto, Esc, un clic fuori dalla foto, il dito verso il basso o Indietro del browser. "Chiedi di questo capo" apre WhatsApp con la descrizione e l'indirizzo della foto. `/collezione/#<nome della foto>` la apre direttamente: lo usano i dodici look della pagina iniziale.

**Due trappole del visore**, trovate dalla revisione indipendente e ora nella prova. Chiudendo, la pagina deve restare sulla foto che si guardava e sul filtro acceso: aprendo si aggiunge una voce alla cronologia e la voce sotto perde l'ancora, così tornando indietro il browser non sposta niente e siamo noi a rimettere indirizzo e posizione. E l'avviso di chiusura di una finestra `<dialog>` arriva un attimo dopo la chiusura: se nel frattempo il visore è stato riaperto, quell'avviso lo richiudeva. Lo stato aperto o chiuso lo tiene lo script, non la finestra.

**Aggiungere una foto.** Si mette l'originale in una cartella con gli altri, si aggiunge una riga a `look` (nome nuovo, file originale, tipo, descrizione; `grande` e il ritaglio `orizzontale` solo se servono), poi:

```
python3 -I tools/comprimi-foto.py collezione <cartella degli originali>
python3 -I tools/comprimi-foto.py registro <cartella degli originali>
node build/costruisci.mjs && node tools/prova-lookbook.js
```

Il primo comando rifà tutta la cartella `public/foto/collezione/` (quattro minuti), quindi servono tutti gli originali, non solo quello nuovo: si riscaricano dal Drive. La prova fa 119 controlli, in locale o sull'anteprima passando il suo indirizzo.

## 14. Pagina iniziale, secondo giro del 19 novembre

Cinque richieste del proprietario dopo aver visto il lookbook sull'anteprima, con le sue risposte alle nostre domande. Controllo: `node tools/prova-pagine.js` (92 controlli, in locale o sull'anteprima) e, per il visore, `tools/prova-lookbook.js`.

**Il video sotto il titolo.** "Nella sezione Camicie e abbigliamento uomo inserisci il video", e poi: "Per PC e tablet utilizza il video IMG_3394. No audio e migliora colori e luci". Quindi due video, senza audio: sui telefoni (fino a 699 punti) il reel dell'abito gessato blu, su tablet e computer i due modelli a tavola. Tutti e due sono girati in verticale: quello del tavolo, sugli schermi larghi, mostra la fascia con i due modelli (la pagina lo ritaglia, tenendo il tavolo al centro), ed è ingrandito di una volta e mezza: un po' di morbidezza si vede. Li prepara `tools/prepara-video.py` in `public/video/`:

- il reel perde l'audio e il cartello finale con il logo (gira in tondo sotto il titolo, e il logo è già in testata): 15,9 secondi, 2,6 MB;
- il video del tavolo è girato in HDR dall'iPhone: si porta ai colori normali, poi un po' di contrasto, colori appena più pieni, ombre un filo più fredde perché il blu dei capi resti blu, via la grana; gli ultimi istanti sfumano nei primi, così il giro non si nota: 6,5 secondi, 1,6 MB;
- c'è anche lo stesso video a metà velocità (è girato a 60 fotogrammi al secondo, quindi resta fluido): si prova con `/?video=lento`. Scelta ancora da fare con il proprietario, dal vivo.

Nella pagina c'è il primo fotogramma, fermo. Il video lo aggiunge lo script quando al telo dell'apertura manca meno di uno schermo per sollevarsi, e solo dopo che l'apertura ha deciso se parte il film (prima è ancora bassa, e il video partirebbe in cima alla pagina); si ferma quando esce dallo schermo. Con il movimento ridotto, con il risparmio dati o senza script resta la foto.

**Le foto della vetrina si aprono in pagina iniziale.** "Quando clicco su una foto in questa sezione, diventa grande ma resto sempre in home." Il visore del lookbook è un pezzo condiviso (`visore` in `src/parti/sezioni.mjs`, lo stesso script): in pagina iniziale sfoglia i dodici look della vetrina. Senza script quei riquadri portano ancora alla foto nella pagina della collezione, ed è quell'indirizzo che il tasto manda su WhatsApp. Il tasto dice "Richiedi disponibilità" (parole sue), anche nella collezione.

**Chi siamo.** "La sezione Artigianato diventa Chi siamo (alla fine in quella sezione parliamo di come lavora Endero e dei suoi valori)." Scelta sua: ovunque. Voce del selettore e del menu, titolo della sezione, titolo e indirizzo della pagina (`/chi-siamo/`, con i vecchi `/cultura-e-artigianato/` e `/storia/` che rimandano). "Cultura e artigianato", parole sue del 15 novembre, resta come riga piccola sopra il titolo (`.occhiello`). Testi in `contenuti/it/chi-siamo.json`; le foto restano in `public/foto/artigianato/`.

**La camicia su misura.** "Ha un'anteprima ancora bozza, rendila definitiva." Scelta sua tra tre: la camicia del configuratore, ferma (scartate: la stessa che dondola, una foto del lookbook). La sezione mostra l'immagine ferma del configuratore e, sul lato in ombra della parete, la scheda in vetro. Fino al 27 novembre elencava le dodici misure; da allora riassume ciò che il configuratore fa scegliere (proprietario: «che fa pensare "che bello, posso personalizzare così tanto la mia camicia!!!"», scelta «B · Riquadri»): quattro riquadri, tessuti (sei campioni veri e «oltre 480»), colli (il colletto disegnato a filo), iniziali (EDR nel corsivo del ricamo, lo stesso carattere del configuratore) e misure (il metro da sarto), e sotto, a pillole, gli altri dettagli. I numeri non sono scritti a mano: il build conta i tessuti di `tessuti.json` (per difetto alla decina), i colli e le misure di `configuratore.json`, e i dettagli sono le sue personalizzazioni; se cambiano lì cambiano qui, e `prova-seo` controlla che coincidano. I riquadri a due a due condividono le righe (subgrid), così numeri e nomi stanno alla stessa altezza; i campioni si misurano sul riquadro (container query) e stanno dentro anche a 320 punti. Fra 810 e 1279 punti le righe piccole sotto i nomi spariscono, perché la scheda resti dentro la foto; sul tablet in piedi i quattro riquadri stanno in fila. Il blocco si chiama `.personalizza`: `.scelte` era già delle caselle dei moduli. Tasto "Crea la tua camicia" e, più piccolo, "Oppure prenota in sede". Sotto gli 810 punti la camicia sta in piedi e la scheda sotto.

**I rivenditori.** "La sezione Rivenditore in Home è troppo piccola, dagli più importanza", con due scelte: "Rivenditore Endero (che quindi rivende i prodotti con il brand Endero in concessione) oppure Rivenditore White Label", per cui voleva una parola italiana. Tra quattro ha scelto "Conto terzi" (scartate: a marchio proprio, con il tuo marchio, marchio privato); il su misura per i clienti del negozio "resta come servizio in più".

- Il pezzo `strade` (titolo grande a sinistra, due schede con la foto a destra) ha preso il posto della fascia in pagina iniziale e dei tre riquadri in cima alla pagina dei rivenditori. Le foto, scelte da noi: l'etichetta Endero cucita in un girocollo per chi vende a marchio Endero, un rever dell'abito gessato, senza marchi in vista, per il conto terzi.
- Nella pagina i capitoli sono tre: le due strade e, con l'etichetta "In più", il su misura. Il "Fai richiesta" di ogni capitolo porta al modulo con la sua voce già segnata. Le voci del modulo: Rivenditore Endero, Produzione conto terzi, Su misura per i miei clienti.
- "In concessione" nei testi non c'è: è un termine con un significato contrattuale preciso, e va confermato prima di scriverlo.

**La foto del negozio e il questionario per Endero** (stessa sera). La prima foto del negozio, arrivata in chat e larga 2000 punti, è nel riquadro con l'indirizzo di «Dove siamo» (`public/foto/sede/`, `tools/comprimi-foto.py sede`): sugli schermi larghi è intera e il pannello ne copre il lato destro, sul telefono è un ritaglio quasi quadrato del centro. Le informazioni che solo Endero può dare (orari, prezzo, tempi e consegna del su misura, vestibilità, email degli ordini, nomi e prezzi dei capi, come lavorano i rivenditori, Instagram, società e partita IVA, consulente per la privacy, sito di oggi, chi gestisce endero.it, foto che mancano) sono in un questionario di 19 domande sul Worker `endero-domande`, una per schermata e sempre con «Non lo so» tra le risposte: nessuno deve restare fermo. Il questionario delle misure resta quello di prima: il sarto ha risposto a 10 domande su 23.

**Dopo la revisione indipendente.** Corretti: il video non si scarica più in cima alla pagina né ricaricando più giù, cambia quando si gira il telefono, ha un tasto per fermarlo (in basso a sinistra) e sui telefoni un velo più fitto e un'immagine ferma nitida (l'abito intero, non il primo fotogramma); chiudendo una foto senza averla cambiata la pagina resta dov'era; la scritta grande «Rivenditore Endero» non si spezza più; sotto i 960 punti il titolo dei rivenditori sale sopra le due schede; la camicia del su misura si ferma a 1600 punti di larghezza; il tasto «Vedi la collezione» porta al titolo, non dietro il selettore. Lasciato com'è, da decidere: nella scheda delle misure la prima voce è ancora «Taglia», che diventerà «Giro collo» insieme al configuratore.

## 15. Farsi trovare su Google

Fatto il 20 novembre 2026, mentre si aspettano le risposte del sarto. Il proprietario ha chiesto di capire «lato SEO, a che punto siamo» e di implementare il resto in autonomia. Le sue scelte: una pagina per ogni categoria della collezione; puntare su tre ricerche (camicie su misura a Napoli e provincia, camicie su misura online, ingrosso e conto terzi per negozi e marchi; non scelta: le categorie di abbigliamento uomo); testi nuovi scritti da noi e messi sull'anteprima; scheda Google e Search Console le gestisce Endero o un suo tecnico.

**Da dove si partiva.** C'erano già: un titolo e una descrizione per pagina, un solo H1, indirizzi canonici in italiano, dati strutturati di base, mappa del sito, robots, quattro reindirizzamenti, pagine complete senza JavaScript, foto leggere. Misurato in locale: la pagina non salta mentre carica (CLS 0) e la prima immagine arriva subito. Mancavano: pagine per le categorie, briciole, immagini di anteprima vere per i social, foto e date nella mappa, i vecchi indirizzi reali del negozio PrestaShop, un controllo automatico.

**Una ricerca, una pagina.**

| Ricerca | Pagina | Titolo per Google |
| --- | --- | --- |
| Endero | `/` | Endero dal 1996 · Camicie su misura e abbigliamento uomo |
| camicie su misura Napoli, Giugliano | `/camicie-su-misura/` | Camicie su misura a Giugliano, Napoli · Endero |
| camicia su misura online | `/camicie-su-misura/configuratore/` | Camicia su misura online · Crea la tua con Endero |
| camicie ingrosso, produzione conto terzi | `/diventa-rivenditore/` | Ingrosso camicie e abbigliamento uomo, conto terzi · Endero |
| maglieria, giacche e cappotti, abiti, felpe uomo | `/collezione/<categoria>/` | per esempio: Maglieria uomo · Collezione Endero, fatta in Italia |
| dove si trova Endero | `/dove-siamo/` | Dove siamo e contatti · Endero, Giugliano in Campania |

**Le pagine di categoria** (`paginaCategoria` in `src/pagine/collezione.mjs`, testi in `collezione.json`, voce `categorie`). In cima niente foto grande: il percorso («Endero / Collezione / Maglieria»), il titolo, due righe, poi la barra del lookbook, qui fatta di link alle altre categorie, e le foto, che si aprono grandi come nella collezione. Nella pagina della collezione i tasti del filtro portano l'indirizzo delle categorie: con gli script il clic filtra sul posto, come approvato; senza script, e per Google, sono link veri. Gli ingressi della pagina iniziale portano alle categorie, e così i dodici look della vetrina (con gli script la foto si apre restando in pagina iniziale; senza, il link porta alla categoria): è da lì che Google trova anche Abiti e Felpe. I testi dicono solo ciò che si vede nelle foto e «fatto in Italia»: niente tessuti o lavorazioni non confermati.

**Quello che Google legge e non si vede.**

- Dati strutturati in ogni pagina (`datiBase` e `datiDiPagina`): Endero come organizzazione, con l'anno 1996; la sede, con indirizzo, telefono, foto e mappa; la pagina stessa; le briciole; i servizi (su misura, su misura online, ingrosso, conto terzi, su misura per i negozi); le domande frequenti; le foto della collezione con la loro descrizione. Orari e profili social si aggiungono da `sito.json` (`orari`, `social`) appena Endero li dà.
- Anteprima per i social: un'immagine 1200 × 630 per pagina (`tools/anteprime-social.py`, `public/anteprime/`), con le misure dichiarate.
- `sitemap.xml`: ogni pagina con la data dell'ultima modifica dei suoi testi e delle sue foto (dal commit di git: serve la cronologia intera) e le sue immagini, con lo stesso indirizzo che hanno nella pagina. Ogni foto ha la sua impronta in fondo all'indirizzo: aggiungendone una, le altre non cambiano indirizzo.
- Icone: `tools/icone.js` fa dal logo l'icona quadrata che Google mostra nei risultati (simbolo bianco su riquadro blu: scelta nostra), il `.ico`, i PNG e il logo in PNG per i dati di organizzazione. Si rilancia solo se cambia il logo.
- Reindirizzamenti (`worker/reindirizzamenti.mjs`): gli indirizzi del vecchio negozio PrestaShop, presi dalla sua mappa rimasta sul dominio, ognuno anche con la barra in fondo, tutte le schede dei capi (`/home/*`), e `/configuratore/`, l'unica altra pagina del sito che oggi risponde su endero.it.

**Il controllo.** `node tools/prova-seo.mjs` costruisce la versione pubblica a parte e fa oltre 500 controlli sui file, come li vedrà Google: titoli e descrizioni unici e della lunghezza giusta, un solo H1, canonici, anteprime, dati strutturati coerenti, link e ancore, immagini con descrizione e misure, mappa, robots, reindirizzamenti. Stampa a parte ciò che blocca la messa online senza essere un difetto: i testi tra `[[ ]]`, gli orari, i social, l'ordine del configuratore. Si lancia prima di ogni aggiornamento dell'anteprima.

**Fuori dal sito.** `docs/endero-su-google.pdf` (sorgente `.html` accanto) è il foglio da dare a chi gestisce scheda Google, Search Console e dominio: i dati di Endero scritti sempre uguali, cosa mettere nella scheda, cosa fare il giorno della messa online.

**Su endero.it oggi c'è un altro sito.** Lo ha trovato la revisione indipendente, e l'abbiamo verificato il 20 novembre: il negozio PrestaShop non c'è più. Dal 15 novembre 2026 sul dominio risponde un sito di una pagina, più un suo configuratore in `/configuratore/`, che non abbiamo fatto noi; pubblica un numero di WhatsApp diverso dal nostro e un profilo Instagram. I vecchi indirizzi del negozio danno già «non trovato». Il proprietario ha deciso lo stesso giorno: «Il nostro lo sostituisce» (quel sito si spegne quando il nostro va online, e il suo `/configuratore/` porta già al nostro); il numero resta il 333 854 8712 («resta com'è»); il profilo Instagram `endero_official` è quello giusto («Sì, è quello») e sta nel piè di pagina e nei dati per Google (`sito.json`, `social`). Il foglio per Google lo dice a chi gestisce il dominio: guardare in Search Console per quali ricerche esce oggi quel sito prima di spegnerlo, e correggere l'altro numero dove compare.

**La revisione indipendente** (20 novembre, sulla versione pubblica) non ha trovato nulla che impedisca a Google di leggere il sito, e quindici difetti, corretti lo stesso giorno. I più pesanti: la descrizione della pagina iniziale metteva «dal 1996» e «fatta in Italia» nella stessa frase (ora il controllo lo vieta ovunque); l'icona non era quadrata; i link alle categorie portavano il numero delle foto attaccato al nome («Maglieria20»: ora il numero lo disegna il foglio di stile); Abiti e Felpe non erano raggiungibili dalla pagina iniziale; la pagina del configuratore puntava su «online» senza dirlo mai nel testo (ora lo dice, e sotto il riquadro ha tre domande, bozza nostra); la prima foto delle categorie aspettava a caricarsi; la scheda misure del su misura aveva otto voci con nomi diversi da quelli del configuratore (ora sono le stesse dodici); su un tablet in piedi la pillola del prezzo usciva dalla pagina. E un sospetto, chiuso per prudenza: i testi che compaiono scorrendo partivano nascosti, e chi legge la pagina senza scorrerla (Google la allunga) non li vedeva. Ora si nascondono solo al primo gesto di chi guarda (`comparse()` in `src/sito.js`); per chi scorre non cambia nulla. Restano nascosti per come funzionano i capitoli di «Chi siamo» in pagina iniziale, uno alla volta: gli stessi testi stanno interi in `/chi-siamo/`. Un secondo controllo indipendente, sulle correzioni, ha trovato che tre pagine di categoria sul telefono si armavano da sole (la barra delle categorie scorre da sé per mostrare la voce accesa, e lo si prendeva per un gesto): ora conta solo la pagina che scorre, e `tools/prova-pagine.js` lo controlla su tutte le pagine. Dallo stesso controllo: le briciole sul telefono senza «Endero» (andavano a capo), la domanda del configuratore che non promette più un ordine che la pagina non prende ancora, i capi senza prezzo fuori dai dati di prodotto, la stampa che trova la pagina intera.

Non fatto, e perché: le coordinate della sede nei dati (non le abbiamo confermate: valgono quelle della scheda Google); le briciole in vista nelle pagine interne che non sono categorie (cambierebbero pagine approvate: restano nei dati); l'area servita del su misura online (la consegna è ancora da confermare). Quando arriverà il primo capo con nome e prezzo, la vetrina della pagina iniziale mostrerà i capi al posto dei look e il controllo avviserà che Abiti e Felpe non sono più collegate da lì: andrà aggiunto un link.

**Cosa resta, in ordine di peso.**

1. Le risposte di Endero: orari, prezzo e tempi del su misura, società e partita IVA, profili social. Finché mancano, il sito ha testi «da confermare» in vista.
2. Il configuratore che invia davvero l'ordine: la pagina che punta su «camicia su misura online» oggi non vende.
3. Una guida «Come prendere le misure per una camicia», con le spiegazioni che il sarto sta confermando: è la pagina che più può portare visite a chi vuole ordinare da casa.
4. Più testo nelle pagine della collezione, quando arrivano nomi, descrizioni e prezzi dei capi: oggi reggono sulle foto.
5. Il film dell'apertura pesa 10 MB anche sul telefono. È una scelta approvata e in prova la pagina resta veloce a comparire, ma su una rete lenta il caricamento dura: se dopo la messa online i dati di Google lo segnalano, serve una versione più leggera per il telefono.
6. La pagina dei rivenditori divisa in due (ingrosso, conto terzi) quando ci saranno contenuti per riempirle.
7. La versione inglese, già predisposta nella struttura.

## 16. Configuratore a passi (dal 25 novembre 2026)

Parole del proprietario (25 novembre, sera): «Dividi così la configurazione a step: Configurazione prodotto, misure, dati clienti, dati spedizione e pagamento. Divisi a step in modo chiaro», con l'elenco delle opzioni, dei prezzi e della spedizione. Qui c'è come si costruisce; ciò che abbiamo interpretato è segnato **(da confermare)**.

**I cinque passi.** Camicia · Misure · Dati · Spedizione · Pagamento, nel riquadro in vetro accanto alla camicia. Uno alla volta, con in cima «Passo 2 di 5» e i nomi dei passi; «Continua» controlla solo il passo in cui si è e porta il primo campo sbagliato in vista, «Indietro» non perde nulla; i passi già fatti si riaprono dal loro nome. Ciò che si è scritto resta se si ricarica la pagina (sessionStorage, mai i dati oltre la scheda del browser). Senza script i cinque passi si leggono uno sotto l'altro, come un modulo solo. Testi, opzioni e prezzi: `contenuti/it/configuratore.json`. Regole (cosa manca, quanto costa): `src/configuratore/ordine.mjs`, le stesse in pagina e nel Worker.

**Passo Camicia**, nell'ordine dato da lui:

| Campo | Come si sceglie | Sulla camicia |
| --- | --- | --- |
| Quantità | per prima, parte da 1 | |
| Tessuto | una finestra con i campioni (filtri per tipo, colore, disegno, ricerca per nome) | la camicia prende il tessuto scelto |
| Collo | menu a tendina: Italiano, Francese, Mezzo francese, Button down, Coreano, Diplomatico (Small e Club tolti il 26 novembre: «Elimina collo small e collo Club») | il collo cambia |
| Taschino | sì / no; se sì, il suo tessuto dalla stessa finestra | compare il taschino, nel suo tessuto |
| Asola colorata | sì / no; se sì, un colore da una griglia | |
| Bottone | Tinta su tinta, Contrasto, Personalizzato («Ordine minimo: 100 pezzi») | |
| Filato bottone | un colore dalla griglia (facoltativo) | «Non cambia 3d» |
| Iniziali | sì / no; se sì posizione (polso, collo, lato cuore), al più 3 lettere e il colore del filo (i 21 colori del filo; dal 27 novembre, «Lo sceglie il cliente») | le lettere compaiono nel punto scelto, ricamate con il filo scelto (blu Endero finché non si sceglie) |
| Interno collo, Interno polso | standard / personalizzato; se personalizzato, il suo tessuto | non cambiano («così semplifichiamo») |
| Polsino | standard / personalizzato; se personalizzato, il suo tessuto | i polsini prendono il loro tessuto («Polsino invece sì cambia tessuto nel 3d») |

Nel passo Camicia non ci sono zoom né contorni delle parti (26 novembre: «quando sono nella sezione CAMICIA, non ci sono zoom e evidenziamenti»; il 25 li aveva chiesti, per un giorno ci sono stati). Quando una scelta fa aspettare (la prima volta che si sceglie un tessuto si scarica la mappa della camicia) compare una rotella, parole sue: «ruota caricamento come filo che cuce con scritto sotto "Dacci un minuto, stiamo cucendo le ultime parti"»; se il cambio è svelto (meno di un terzo di secondo) non compare. «Colori ricamo carré» è tolto («Elimina per ora»). Note, fintone bottoni e carré, che stavano nel foglio di carta, restano fuori («Sì, tolti tutti e tre», 26 novembre). «Asola» in pagina si chiama «Asola colorata» **(da confermare)**. La griglia dei colori del filo (21 colori) è nostra **(da confermare)**. Bottone personalizzato sotto i 100 pezzi: «Continua» si ferma con l'avviso (scelta sua, 26 novembre).

**Tessuti.** Le 32 foto della cartella Drive «Tessuto» sono cartelle colori: circa 450 campioni. Ogni campione è un tessuto: ritaglio in `public/camicia/tessuti/<id>.webp`, elenco in `contenuti/it/tessuti.json` con il nome inventato da noi («tipologia tessuto + nome colore», parole sue), tipo, colore e disegno per i filtri. Il nome vero (articolo e codice della cartella colori) non sta nel repository né nel sito: sta nella configurazione riservata su Cloudflare (archivio KV `endero-domande`, voce `riservato/tessuti`) e compare solo nell'email dell'ordine «ad Endero e ad Ennio». Strumento: `tools/tessuti.py`.

**La camicia che cambia** (`src/configuratore/vesti.js` e `tinta.js`, file in `public/camicia/opzioni/` e `public/camicia/stoffe/`, calcolati con `camicia/opzioni/`). Il riquadro avvisa a ogni scelta con `endero:camicia` (`{ collo, taschino, iniziali, tessuto, taschino_tessuto, polsino_tessuto }`). Senza tessuto la camicia è quella bianca, e collo e taschino sono ritagli calcolati con Blender sulla stessa scena, sovrapposti (stessa luce: non si vedono giunte). Con un tessuto la camicia si compone tutta insieme, con il suo collo e il suo taschino, e si tinge in un colpo: una tela sola, su tutti i livelli (l'immagine ferma, la camicia che dondola, il tessuto che ondeggia). Le iniziali sono lettere disegnate nel punto scelto. Come funziona la tinta, e come si rifà, è scritto più sotto.

**Prezzo** (parole sue): 90 euro la camicia base, 100 con una personalizzazione, 120 con tre, 150 con tutte. Le personalizzazioni sono otto: taschino, asola colorata, bottone non tinta su tinta, filato bottone, iniziali, interno collo, interno polso, polsino **(da confermare)**; con due si paga 100, da tre a sette 120 (confermato dal proprietario il 26 novembre). Il prezzo si vede mentre si configura e lo rifà il Worker.

**Spedizione** (parole sue): ritiro in laboratorio, oppure spedizione in 7 giorni lavorativi a 15 euro, oppure in 5 giorni lavorativi a 30 euro; gratis sopra i 200 euro di spesa. Nel suo messaggio gli importi erano scambiati: il 26 novembre ha confermato «Sono invertiti». Gratis da 200 euro compresi, e il ritiro è in Viale del Toro 22 (confermati il 26 novembre). Indirizzo solo in Italia, con CAP e sigla della provincia **(da confermare)**.

**Pagamento e ordine.** Riepilogo, consenso all'informativa, «Vai al pagamento». Decisioni del 14 novembre: Stripe, importo intero, pagina di pagamento di Stripe. Il Worker (`worker/ordine.mjs`) ricontrolla tutto, rifà il prezzo, calcola la taglia (`worker/taglie.mjs`), salva l'ordine e apre il pagamento; a pagamento fatto manda l'ordine per email a Endero e a Ennio (con il nome vero di ogni tessuto) e la conferma al cliente. Finché non ci sono le chiavi di Stripe il pagamento è spento e la pagina lo dice. Prima di accenderlo: informativa privacy aggiornata e riletta dal consulente (punto 6), indirizzo email di Ennio nei segreti del Worker.

**Pagamento di prova** (27 novembre; proprietario: «per stripe crea solo una demo poi lo collegheremo ora mi va bene fare un test fake. Hai il mio ok su tutto. Pubblicaaaa»; scelta sua: «Per tutti, scritto chiaro»). Con `PAGAMENTO_PROVA = "1"` nelle variabili del Worker (`wrangler.sito.toml`) e senza la chiave di Stripe, l'ordine si salva come quello vero (prezzo rifatto, taglia, numero) e al posto della pagina di Stripe si apre una pagina nostra, `/api/pagamento-prova` («Pagamento di prova: non ti addebitiamo nulla e la camicia non viene cucita»), con numero, totale, «Completa il pagamento di prova» e «Annulla». Il tasto segna l'ordine pagato (`pagamento = 'prova'`) e manda le due email, a Endero e al cliente, con «[PROVA]» in oggetto e una fascia gialla in cima; un gettone casuale lega la pagina all'ordine, e premere di nuovo non manda nulla. Anche un pagamento fatto con le chiavi di prova di Stripe (`livemode` falso) arriverà segnato PROVA. Il build con `PAGAMENTO_PROVA=1` mette l'avviso al passo Pagamento (in un riquadro, non in piccolo) e la frase di prova nel grazie. Ogni notte gli ordini di prova, quelli mai pagati e quelli annullati più vecchi di 30 giorni si cancellano (`pulisciOrdini` in `worker/conservazione.mjs`); quelli pagati davvero restano. Quando arrivano le chiavi: si mettono `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET`, si toglie `PAGAMENTO_PROVA` da Worker e build, e il pagamento vero prende il posto da sé. Il consenso al passo Pagamento ora è «Accetto le condizioni di vendita e ho letto l'informativa privacy». Controlli: `tools/prova-worker.mjs` (il giro intero della prova, le email PROVA, la pulizia).

**Misure.** Come al punto 12. La finestra «Come prendere le misure» si apre entrando nel passo delle misure, non più all'apertura della pagina **(da confermare)**. Dal 26 novembre, mentre la guida è aperta (zoom e tratteggio su una misura) la camicia è quella bianca di riferimento, con il collo, il taschino e le iniziali scelti, e si fa più trasparente, parole sue: «ok zoom, ok tratteggi ma la camicia è più trasparente… così i tratteggi si vedono meglio». Sopra di lei si stende un velo, che è la parete senza la camicia (il pezzo `parete` di `leggera.js`): sul palco (`.configura__velo`) e nel riquadro del telefono. Il tessuto scelto lì non si vede: il giro che la mostra di spalle è un filmato della camicia bianca, e tinta davanti e bianca dietro non starebbero insieme. Quanto velo: provate tre misure (30, 45 e 60%), il 27 ha scelto la più trasparente («C · Molto trasparente»): 60%. E la camicia bianca durante le misure «va bene bianca».

**Com'è fatto e come si rifà** (notte tra il 25 e il 26 novembre).

*I colli.* Il colletto della camicia comprata è una striscia di stoffa: il suo cartamodello sta nelle coordinate UV del file. Gli altri colli si ottengono ritagliando quel cartamodello (`camicia/opzioni/colli.py`), come farebbe un sarto con le forbici, senza toccare come la stoffa cade: mezzo francese e francese tolgono un angolo sul davanti (24 e 46 gradi), diplomatico lascia due alette, coreano toglie il colletto e lascia il listino, button down rimette i due bottoncini che il file aveva. L'italiano è il colletto del file, cioè l'immagine già approvata. Ogni collo si calcola con la stessa scena e la stessa luce dell'immagine ferma, solo nel riquadro del collo, a grandezza quadrupla (4 minuti l'uno); `monta.py` tiene di ogni calcolo solo i punti diversi dalla camicia di base, con i bordi sfumati: sovrapposto, non si vedono giunte. I colli sono sei: Small e Club (il colletto abbassato tutto intorno, e abbassato con le punte tonde) il proprietario li ha tolti il 26 novembre; i loro tagli stanno nella cronologia di git.

*Il taschino* (`camicia/opzioni/parti.py taschino`) è un pezzo del davanti della camicia ritagliato a forma di taschino e sollevato di un millimetro e mezzo, con l'orlo in cima: ha le stesse pieghe della stoffa sotto. Sta sul petto sinistro di chi la indossa.

*Iniziali e mappa delle parti* (`parti.py mappa`, poi `monta.py`). Per ogni collo si calcola una mappa in cui ogni parte ha un colore suo (colletto, listino, polsini, bottoni, taschino); da lì vengono i punti in cui si ricamano le iniziali (lettere alte 7 millimetri): sul polsino sinistro di chi la indossa, sul petto dove sta il taschino, sulla falda del colletto accanto al bottone (sul listino per coreano e diplomatico: `colli[id].iniziali` in `opzioni.json`), e le zone di polsini e taschino per chi li vuole di un altro tessuto. I contorni tratteggiati delle parti, che servivano allo zoom nel passo Camicia, si calcolano ancora ma dal 26 novembre non vanno più nel file del sito. Il carattere delle iniziali: il proprietario le voleva «in un font più elegante»; fra tre provati il 27 novembre (il corsivo di Cormorant Garamond, le maiuscole romane di Cinzel, il corsivo inglese di Petit Formal Script) ha scelto il corsivo inglese: Petit Formal Script, licenza OFL (`public/font/licenze.txt`), ospitato sul sito con le sole maiuscole (12 KB). Gli altri due sono usciti dal sito. Il colore del filo lo sceglie il cliente (campo «Colore del filo» sotto le iniziali, gli stessi 21 colori di asola e filato bottone, obbligatorio come il colore dell'asola); finché non lo sceglie, sulla camicia il ricamo è blu Endero. Va nell'ordine (`iniziali.colore`), nel riepilogo del passo Pagamento e nelle email («NP · Lato cuore · filo bianco»). Non cambia il prezzo: è parte della personalizzazione «Iniziali» (confermato dal proprietario il 27: «Non cambia»).

```
PY=<venv con Blender>/bin/python; B=<file .blend comprato>; L=<cartella di lavoro>
$PY camicia/opzioni/colli.py $B $L                # i sei colli, circa 30 minuti (--solo coreano --rifai per uno)
$PY camicia/opzioni/parti.py taschino $B $L       # il petto con e senza taschino, 10 minuti
$PY camicia/opzioni/parti.py mappa $B $L          # le mappe delle parti, 2 minuti per collo
$PY -I camicia/opzioni/monta.py $L public/camicia/opzioni
$PY camicia/opzioni/parti.py trama $B $L          # dove sta nel cartamodello ogni punto della camicia: un minuto per collo, più il taschino
$PY -I camicia/opzioni/trame.py $L <cartella di lavoro dei tessuti> public/camicia [--foglio <cartella>]
$PY -I camicia/opzioni/controlla_stoffe.py <cartella di lavoro dei tessuti> public/camicia [--foglio <cartella>]   # i campioni contro i ritagli veri
node tools/prova-vesti.js                         # con il sito in locale sulla porta 8781
```

Limiti noti: vista da dietro (misure di spalla e lunghezza dietro) la camicia mostra sempre il colletto di base ed è bianca; l'ombra sulla parete non cambia con il collo (non si nota).

*Il tessuto che colora la camicia* (26 novembre). Prima una prova con otto tessuti, a un indirizzo a parte; il proprietario l'ha provata («mi piace che ogni volta che cambio il tessuto cambia») e ha chiesto di togliere gli errori che si vedevano nello zoom, di dare al taschino e al polsino il loro tessuto e di non far cambiare interno collo e interno polso. Ora vale per tutti i 483 tessuti, nella pagina normale.

Come funziona. La camicia del sito è l'immagine di una camicia bianca: la sua luce è già quella giusta. Con Blender si calcola una volta, per ogni punto della camicia, dove sta quel punto nel cartamodello (`parti.py trama`); `trame.py` ne fa due cose per il browser: la *trama* (`trama-*.png`, la posizione a 16 bit, grande quanto il fotogramma) e la *maschera* (`maschera-*.png`, grande il doppio come la foto: dove c'è stoffa, dove bottoni e gruccia, e le zone di polsini e taschino). Ogni collo e il taschino hanno la loro trama e la loro maschera, solo nel loro riquadro. Nel browser (`tinta.js`) la scheda grafica compone la trama della camicia com'è adesso (quella di base con sopra i riquadri del collo e del taschino scelti), poi per ogni punto legge il colore del tessuto nel punto del cartamodello e lo moltiplica per la luce della camicia bianca: le righe seguono il verso di ogni pezzo, ombre e pieghe restano quelle di Blender. Sui contorni, lungo le cuciture e sui risvolti stretti (ritagli del cartamodello larghi tre o quattro punti, ognuno con il suo verso) la posizione calcolata non è affidabile: lì ogni punto prende quella del punto buono più vicino del pezzo grande accanto (`impacchetta` in `trame.py`), e il campione si legge appena sfocato, così le righe arrivano fino al bordo e i microdisegni non fanno puntini. Una volta per cambio di scelta, mai a ogni fotogramma; dove la scheda grafica non c'è, la camicia resta bianca. Il campione di ogni tessuto (`public/camicia/stoffe/<id>.webp`, 256 punti di lato, 2,1 MB in tutto: se ne scarica uno per tessuto scelto) si ripete senza giunte, e come lo fa `trame.py` dipende dal disegno. *Righe*: il ritaglio si raddrizza (le righe della cartella non sono mai dritte del tutto, e un grado di pendenza basta a sbiadire una riga sottile), poi il campione è una fila di colori lunga un passo. *Quadretti, fantasie e armature che si vedono*: la cella che si ripete, media di tutte le sue ripetizioni nel ritaglio. In tutti e due i casi il passo è il più corto fra quelli le cui ripetizioni si somigliano davvero fra loro (`cella`, `righe`): un passo sbagliato dà una media sbiadita. *Un fondo con sopra qualcosa di più rado* (un vichy con i fiorellini): la media cancellerebbe i fiorellini, quindi si tiene una finestra del ritaglio fatta di ripetizioni intere del fondo, con i bordi sciolti (`finestra`). *Tinte unite*: il colore medio più la grana fine del filo; tutto ciò che è più largo di mezzo millimetro (macchie di luce della foto, fiammature del lino) si toglie, perché ripetuto ogni due centimetri farebbe una quadrettatura sulla camicia. *Se il passo non si trova* (un disegno più grande del ritaglio) resta il ritaglio con i bordi sciolti l'uno nell'altro, mai a specchio (capovolgerebbe i motivi: nella prova i cavallini finivano a testa in giù).

`controlla_stoffe.py` confronta ogni campione, ripetuto, con il ritaglio vero alla scala a cui si vede sulla camicia, e dice quali vanno guardati (disegno perso, anche in un verso solo; disegno diverso; colore cambiato; tinte unite con macchie che si ripetono); con `--foglio` ne fa i fogli da guardare. Va lanciato ogni volta che si rifanno i campioni: dei 21 che oggi segnala, guardati uno per uno, nessuno è un errore (jacquard bianchi su bianco, lini dalle fiammature forti, due microquadretti più fini della misura del controllo).

Ciò che la prova ha insegnato, per non rifarlo: i pezzi tinti separatamente (colli e taschino a grandezza quadrupla sopra una camicia a grandezza doppia) avevano una grana diversa e si vedevano come «una parte senza tessuto»: la camicia si tinge tutta insieme. I puntini lungo cuciture e contorni venivano dalle strisce di stoffa viste di taglio, dove il disegno non si può leggere nitido: lì (e dove un punto non ha vicini sulla sua stessa stoffa) si legge il colore medio del tessuto. I bordi a scalini di bottoni, gruccia e polsini venivano dalla mappa a metà grandezza: per questo c'è la maschera a grandezza piena, che pesa 24 KB. Le immagini fatte da uno script devono essere tele o indirizzi «data:», non «blob:» (la regola di sicurezza delle pagine li rifiuta).

Ciò che ha trovato la revisione indipendente del 26 (fermata dal limite d'uso dopo 85 passi: i suoi appunti li abbiamo recuperati dalle prove che aveva lasciato), tutto corretto e messo nei controlli. *I campioni*: guardati a occhio sui fogli sembravano giusti, ma 140 tinte unite portavano le macchie di luce della foto e sulla camicia facevano una quadrettatura; una ventina di rigati e quadretti avevano perso il disegno (una riga larga mezzo centimetro finita con il passo del filo, cioè tinta unita; finestrati senza le righe orizzontali; righe sottili sbiadite dalla pendenza del ritaglio; un vichy senza i suoi fiorellini). Da qui il calcolo nuovo e `controlla_stoffe.py`. *La tinta nel browser* (`tinta.js`, `vesti.js`): se la scheda grafica si riprendeva il contesto (un telefono in secondo piano) la camicia restava per sempre del tessuto di prima: ora la macchina che tinge si rifà; dove la scheda grafica non basta si apriva un contesto a ogni scelta, fino a far perdere il suo al tessuto che ondeggia: ora si prova una volta sola e lo si rilascia; un file che non arrivava mai lasciava la rotella accesa per sempre, anche sopra la camicia già tinta: ora ogni file ha venti secondi e la rotella segue solo l'ultima scelta; un campione che manca lasciava sulla camicia il tessuto di prima sotto il nome di quello nuovo: ora la camicia torna bianca e riprova da sola due volte.

La revisione nel browser (un revisore, 134 passi, questa volta fino in fondo: scriveva le segnalazioni in un file man mano) ha provato 26 tessuti sul computer e 10 sul telefono, i sei colli, taschino, polsini, iniziali, la rotella, i cambi veloci, il movimento, il passo Misure. Tre segnalazioni, tutte corrette e messe nei controlli; il resto a posto (il colore della camicia corrisponde al quadratino cliccato, scarto fra 1 e 7; nessun lampo fra una tinta e l'altra; nessuno zoom nel passo Camicia). *Fascia di colore medio*: sui rigati contrastati, lungo cuciture e contorni si leggeva il colore medio del tessuto (un profilo rosa attorno a una camicia a righe rosse); ora il disegno arriva al bordo (vedi sopra). Due strade provate e scartate, per non rifarle: proseguire la posizione oltre il bordo con il passo del punto vicino (marmorizzato: vicino al contorno la stoffa gira e il passo cambia da un punto all'altro) e tingere i risvolti stretti ciascuno con il suo verso (stesso effetto). *Parete tinta*: con i colli coreano e diplomatico, più piccoli, il pezzo del collo dipinge la parete dove il colletto di base non c'è più, e la tinta la prendeva per camicia (una riga quasi nera lungo le spalle); ora la parete si riconosce dal suo blu pieno e non si tinge. *Campi di spalle nel passo Misure*: entrando la tinta spariva di colpo, uscendo restavano due secondi di camicia bianca piena e la tinta tornava di colpo; ora la tinta si scioglie prima del giro, il velo resta finché la camicia non è tornata di fronte, e solo allora velo e tinta si scambiano in dissolvenza (`data-guida-bianca` in `guida.js`). Ciò che il revisore non ha potuto provare, e resta da provare su apparecchi veri: la fluidità e quanto fa aspettare una scelta (il browser di prova disegna con il processore), il dito sul tessuto che ondeggia, gli altri 450 tessuti uno per uno.

Limiti: di spalle la camicia resta bianca (e durante la guida alle misure è sempre bianca: vedi «Misure»); il lino perde le fiammature (resta colore e grana); i caratteri delle iniziali hanno le lettere dell'alfabeto latino con gli accenti più comuni: una Š o una Ł escono in un altro carattere; i disegni piccoli (quadretti da due millimetri, motivi da un centimetro) a figura intera diventano una tinta o una grana, come dal vero a quella distanza; interno collo e interno polso non si vedono, per scelta sua.

*I tessuti* (`tools/tessuti.py`, lavoro fuori dal repository). Le 32 foto sono state raddrizzate e riportate a carta bianca (`raddrizza`), poi per ogni cartella un agente ha trovato i campioni e letto i codici, e un secondo agente li ha riletti da capo senza guardare la prima lettura: 502 campioni, 3 codici rimasti incerti (segnati nel registro). 19 bianchi delle due cartelle «bianche» sono gli stessi di altre cartelle e compaiono una volta sola: 483 tessuti in 13 categorie. I nomi inventati non contengono parole dei nomi veri. Il registro per Endero (PDF, 77 pagine: per ogni campione il nome sul sito, l'articolo e il codice letti, la posizione nella cartella) si manda al proprietario e non sta nel repository; i nomi veri sono nell'archivio KV `endero-domande`, voce `riservato/tessuti`, caricati il 26 novembre.

**Revisione indipendente e ciò che resta prima di accendere il pagamento** (26 novembre). La revisione a cinque (testi e regole, ordine nel Worker, passi su computer, passi su telefono, camicia) si è fermata a metà per il limite d'uso: le prime due sono arrivate e le loro correzioni principali sono dentro (note interne fuori dagli script pubblici; i 43 tessuti con nylon non più chiamati «cotone»; l'email dell'ordine a Endero senza «Rispondi a» del cliente; il pagamento acceso solo con tutte le chiavi; il ritiro nel riepilogo; i filtri dei tessuti sul telefono). Restano, segnalati e non ancora fatti, tutti da chiudere prima di accendere Stripe:

- **Condizioni di vendita e informativa sugli ordini**: fatte il 27 (scelte del proprietario: «Scrivi tu una bozza», «Aggiungi tu gli ordini») e approvate dal consulente lo stesso giorno, senza più giallo. Valgono come confermati: prezzi IVA inclusa; misure sbagliate, camicia modificata o rifatta a pagamento con il costo detto prima; i giorni si contano dalla conferma delle misure del sarto; per ora solo Italia; 10 anni per gli ordini pagati e 30 giorni per quelli mai pagati o di prova (la pulizia c'è); Stripe titolare autonomo; il corriere.
- **Email dell'ordine che non parte**: se Resend non risponde mentre arriva l'avviso di Stripe, l'ordine pagato può restare senza email e nessuno se ne accorge. Servono: un tempo massimo sulle richieste, due segni distinti («mandata a Endero», «mandata al cliente»), un nuovo tentativo ogni notte, e ogni notte chiedere a Stripe degli ordini rimasti «da pagare».
- **Pagamenti di prova**: fatto il 27 (vedi «Pagamento di prova»): PROVA in oggetto e in cima, sia per il pagamento di prova nostro sia per le chiavi di prova di Stripe (`livemode`).
- **Antispam obbligatorio** sull'ordine quando il pagamento è acceso, e un limite di frequenza su `/api/ordine` dal pannello di Cloudflare.
- **Senza JavaScript** l'ordine non può partire sul sito vero (l'antispam vuole lo script): la pagina deve dirlo, con WhatsApp e presa misure in sede come alternative.
- **Taglie**: una tabella riservata con `passo` a zero dà «+NaN cm»: `leggiConfigurazione` deve rifiutarla.
- **Testi**: la pagina del su misura dice ancora «prezzo da confermare» e cita la vestibilità; sotto il configuratore mancano le domande su prezzo, pagamento e consegna; nell'email «Filato bottone: Nessuna».
- **Webhook di Stripe**: indirizzo `https://endero.men/api/stripe` (senza www), eventi `checkout.session.completed` e `checkout.session.async_payment_succeeded`.

**Revisione, seconda metà** (26 novembre, ripresa su richiesta del proprietario: «Riprendila subito tutta»). Sono arrivate le due dimensioni dei passi, su computer e su telefono: 27 segnalazioni, senza il secondo agente che le verifica (il limite d'uso è scattato di nuovo): le abbiamo rilette e riprodotte noi. Corrette:

- *Da Camicia a Misure la pagina non risaliva*: la finestra «Come prendere le misure» fermava lo scorrimento appena partito e, chiusa, si vedevano le domande frequenti. Ora la pagina si sposta in un colpo prima che la finestra si apra (`vai()` in `scheda.js`). Le prove non lo vedevano perché giravano con il movimento ridotto e `?senza-passi`: ora c'è un giro con il movimento normale.
- *Zoom sulle parti, sul telefono*: il riquadro sopra la riga toccata faceva saltare la pagina fino a 200 punti e copriva le righe prima. Corretto con un riquadro fermo sullo schermo, e poi tolto del tutto lo stesso giorno: il proprietario non vuole zoom né evidenze nel passo Camicia. Nel passo Misure il riquadro resta sopra la casella.
- *Invio nelle caselle* non fa più «Continua» (sul telefono chiude la tastiera o passa alla casella dopo). *Indietro del browser* torna al passo di prima e chiude le finestre aperte, non lascia più la pagina.
- *«Vai al pagamento»*: l'esito (errore, pagamento non attivo, annullato) si porta in vista sopra la barra; il tasto resta spento mentre la pagina di Stripe si apre (prima ogni clic in più mandava un altro ordine); l'indirizzo di ritorno accettato è solo Stripe o questo sito.
- *Finestra dei tessuti*: un doppio clic sul tasto che la apre non sceglie più un tessuto a caso; Invio su un filtro non la chiude; la ricerca trova anche le parole dei filtri («tinta unita», «azzurri»); per un altro campo riparte da tutti i tessuti; dopo un filtro l'elenco torna in cima; sui portatili bassi e sul telefono di traverso i filtri stanno dietro il tasto «Filtri»; i 21 colori del filo si vedono tutti.
- *Provincia*: chi scriveva «Roma» si ritrovava «RO» (Rovigo). Ora il campo riconosce anche il nome e lo cambia nella sigla (`provincia()` in `ordine.mjs`, vale anche nel Worker).
- I campi che compaiono con «Sì» o «Personalizzato» non nascono più dietro la barra con i tasti; dai nomi dei passi in cima non si salta oltre un passo sbagliato; con lo zoom sul computer il vetro del riquadro si fa più coprente (le scritte erano a 2,3 a 1 sulla camicia bianca); la barra del prezzo sta su una riga anche a 360 punti; niente rettangolo grigio al tocco; «1,5» nella quantità non diventa più 15; l'informativa si apre in un'altra scheda.

Restano, segnalate e non fatte (nessuna blocca un ordine): gli avvisi per i lettori di schermo (`aria-invalid` messo anche su gruppi e tasti, troppe righe che parlano insieme, il «grazie» non letto al ritorno da Stripe); senza JavaScript il prezzo non si vede; il telefono di traverso (all'apertura si vede solo la camicia) e i 320 punti di larghezza; gli angoli tondi della barra quando è attaccata al fondo; sul telefono la sfocatura del vetro, che costa lavoro alla scheda grafica senza effetto visibile; i telefoni vecchi senza `showModal` (iPhone prima del 15.4), dove il tessuto non si può scegliere; un 503 vero a pagamento acceso direbbe «pagamento non ancora attivo». Da provare su un iPhone vero: il riquadro fermo con la tastiera aperta nelle iniziali.

La quinta dimensione, **la camicia che cambia con le scelte**, è stata rivista la sera del 26 e la notte dopo, sulla versione nuova (il tessuto che colora la camicia): prima il codice, poi il browser. Cosa hanno trovato e cosa è stato corretto è scritto sopra, in «Il tessuto che colora la camicia».

