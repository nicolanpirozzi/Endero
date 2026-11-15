# Endero · direzione creativa e specifica di costruzione

Scelte approvate dal proprietario il 14 novembre 2026. È il documento da cui parte la costruzione. I testi indicati sono bozze: vanno approvati prima della messa online. Fatti e contatti stanno in `CLAUDE.md` e `docs/ricerca-endero.md`.

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
- *Uscita rapida*: "Salta l'introduzione" è un link vero a un'ancora, in basso a sinistra.
- *Telefono*: su schermi verticali il fotogramma si adatta all'altezza, il tessuto si sposta di lato per mostrare intera la scritta del capitolo e il logo finale si guarda da più lontano. L'altezza si misura una volta sola: la barra degli indirizzi che compare e scompare non deve far saltare l'immagine.
- *Titolo H1*: non sta nell'apertura ma nella sezione che segue, come nel riferimento.

## 5. Pagine e Google

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
- Il configuratore, quando si riapre, vive in `/camicie-su-misura/configuratore/`.
- "Diventa rivenditore" (chi compra da Endero per rivendere): sezione chiesta dal proprietario il 14 novembre 2026, ancora da definire con lui. Indirizzo previsto `/diventa-rivenditore/`; il menu e il piè di pagina devono lasciarle il posto. Finché non è definita non si costruisce e non compare nel sito.

## 6. Contatti, modulo ed email

- WhatsApp: 333 854 8712, collegamento `https://wa.me/393338548712`.
- Email pubblica: `info@endero.it`. Invii con Resend (chiave come segreto del Worker). Le risposte dei clienti vengono inoltrate alla casella del proprietario, il cui indirizzo sta solo nella configurazione del Worker.
- Tutto questo richiede di modificare i DNS di endero.it, che oggi non si sa chi gestisca. Nelle anteprime il modulo salva su D1 e basta.
- Modulo di contatto e prenotazione: `POST /api/contatto`, verifica Turnstile lato server, salvataggio su D1. Funziona come normale invio di modulo anche senza JavaScript.
- Banner dei consensi pronto; Google Analytics e Meta Pixel si collegano dopo e non partono senza consenso.

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
6. Altre pagine, modulo con Worker, D1 e Turnstile, banner dei consensi, file per Google.
7. Revisione indipendente con più agenti. Solo dopo l'ok del proprietario, pubblicazione sul link Cloudflare.

## 8. Materiali da ricevere

- Video del laboratorio per l'apertura del sito: 10–20 secondi, orizzontale, più un taglio verticale per il telefono.
- Dodici foto verticali di dettagli e capi per la griglia, una foto orizzontale grande, tre foto per gli ingressi alla collezione, foto per la storia.
- Foto, nomi, descrizioni e prezzi dei prodotti della collezione.
- Orari della sede, prezzo "a partire da", testi delle domande frequenti.
