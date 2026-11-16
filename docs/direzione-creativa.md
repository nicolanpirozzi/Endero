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

- Video del laboratorio per l'apertura del sito: 10–20 secondi, orizzontale, più un taglio verticale per il telefono.
- Dodici foto verticali di dettagli e capi per la griglia, una foto orizzontale grande, tre foto per gli ingressi alla collezione, foto per la storia.
- Foto, nomi, descrizioni e prezzi dei prodotti della collezione.
- Orari della sede, prezzo "a partire da", testi delle domande frequenti.

## 9. Diventa rivenditore

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

Deciso dal proprietario il 15 novembre 2026, dopo che il fondatore ha visto l'anteprima ("gli piace e si aspetta un lavoro di alto livello"): la pagina unica era diventata troppo carica. Il su misura e i rivenditori hanno ciascuno la propria pagina; la pagina iniziale mostra i prodotti e, sotto, "Cultura e artigianato". Aspetto, proporzioni e movimento restano quelli del riferimento: cambiano l'ordine e la distribuzione dei pezzi, non i pezzi.

**Le pagine.**

| Indirizzo | Cosa contiene | Ricerca a cui risponde |
| --- | --- | --- |
| `/` | Apertura, eroe, vetrina dei prodotti, cultura e artigianato, porta verso il su misura, fascia rivenditori | Endero, camicie uomo |
| `/collezione/`, `/collezione/<capo>/` | Come oggi | camicia uomo, nome del capo |
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

- *In pagina iniziale* è il momento forte dopo l'apertura: una sezione a capitoli che resta ferma sullo schermo mentre si scorre. Una foto a tutta larghezza per capitolo; ogni foto nuova si scopre dal basso sopra la precedente; in basso a sinistra un riquadro in vetro con il titolo del capitolo e due righe. Da tre a cinque capitoli, circa due terzi di schermo di scorrimento ciascuno. Sul telefono funziona allo stesso modo. Con movimento ridotto o senza JavaScript i capitoli stanno uno sotto l'altro, ogni foto sopra il suo testo. In fondo il link "Scopri come lavoriamo" verso la pagina.
- *I capitoli nascono dalle foto*, non il contrario: prima arrivano le foto, poi si scrive un capitolo per ogni foto buona, descrivendo solo quello che la foto mostra. Finché le foto non ci sono, tre capitoli segnaposto ("Il taglio", "La cucitura", "Le rifiniture") con testo tra `[[ ]]`.
- *La pagina* `/cultura-e-artigianato/` usa gli stessi capitoli nel formato a foto e testo alternati della vecchia `/storia/`, più il nastro dei fatti e il richiamo ai rivenditori sotto "2.500 negozi serviti". H1: "Cultura e artigianato".
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

Riaperto dal proprietario il 15 novembre 2026, da costruire **a passi**: ogni passo si mostra e si approva prima del successivo. Le decisioni del 14 novembre restano valide (pagamento con Stripe, importo intero all'ordine; ordini per email e in un pannello riservato; il sarto verifica le misure prima del taglio). Novità: chi ordina da casa dà **solo le misure del corpo**, guidate una per una. Opzioni e prezzi li manda il proprietario.

**Passo 1: la camicia sospesa e il riquadro in vetro.** Parole del proprietario: "il 3D di una camicia sospesa in aria che si muove quando ci passo sopra con il mouse. Accanto una tabella glass con le info che poi ti dirò e che il cliente deve compilare. Considera un caricamento". Riferimento per il 3D: `beat.noomoagency.com`, dove un capo d'abbigliamento galleggia nel buio, come indossato da un corpo invisibile, e si gira piano seguendo il puntatore.

- *Indirizzo*: `/camicie-su-misura/configuratore/`. La pagina del su misura la annuncia in cima.
- *La scena* (dal 16 novembre 2026): la camicia è appesa a una gruccia di legno con il gancio di metallo e un nastro avorio che sale fuori dall'inquadratura, davanti a una parete del blu di Endero. Sulla parete batte la luce di una finestra, con l'ombra delle sbarre, e dentro quella luce cade l'ombra della camicia, in basso a sinistra; la stessa luce a fasce passa, più leggera, sul tessuto. L'ha chiesta il proprietario su una sua immagine di riferimento (una maglietta nera appesa davanti a un muro grigio). Prima era "sospesa in aria", con un'ombra a terra: tolta.
- *Il 3D è in diretta nel browser*, con three.js: è la prima volta nel progetto. Per l'apertura il 3D in diretta era stato scartato e resta scartato lì; qui serve perché la camicia deve rispondere al puntatore e, dal passo 2, cambiare tessuto.
- *La camicia* parte da un modello già fatto, caricato dal proprietario il 15 novembre 2026 ("credo sia troppo complicato partire da zero, parti da questo già fatto e miglioralo"): camicia a maniche lunghe con taschino, 139.000 triangoli, bottoni e fili modellati. Avevamo cominciato a modellarla noi con Blender (busto invisibile e caduta del tessuto): abbandonato. Il modello è materiale comprato: l'originale non sta nel repository, e nemmeno il file pronto per il browser finché il repository è pubblico (vedi `CLAUDE.md`).
- *Cosa ha di buono il modello*: la sua mappa è il cartamodello vero, in scala (un'unità vale 2,754 m di tessuto, scritto in `public/camicia/camicia.json`), con il filo nel verso giusto su ogni pezzo. Dal passo 2 basta stendere l'immagine di un tessuto ripetuta e righe e quadretti cadono come su una camicia cucita. Il tessuto ha due strati, diritto e rovescio, a 1,8 mm.
- *Cosa abbiamo migliorato*: braccia abbassate di 20 gradi (nel modello erano molto aperte: il proprietario ha scelto la posa più bassa sul confronto del 15 novembre), piegando le maniche attorno alla cucitura del giro manica; facce girate rimesse a posto; taschino staccato; bottoni color madreperla; peso da 11,9 MB a 1,2 MB. Luce, tessuto e movimento sono stati rifatti il 16 novembre: vedi sotto.
- *Come si rifà* (serve il file originale `Shirt OBJ.obj`, che ha il proprietario): `<venv>/bin/python camicia/prepara.py <Shirt OBJ.obj> <cartella> --braccia 30` (dieci minuti: calcola la luce; con `--riusa` non la ricalcola se in quella cartella c'è già), poi `node camicia/comprimi.mjs <cartella>/camicia.glb public/camicia/camicia.glb`, poi si copiano in `public/camicia/` anche `camicia.json`, `telaio.json`, `luce.webp` e `cuciture.webp`. Per ultima l'immagine ferma, fotografata dal 3D con il sito acceso in locale: `node tools/manifesto-camicia.js http://127.0.0.1:8766/camicie-su-misura/configuratore/ public/camicia/camicia.webp`. Nel venv di Blender servono anche `scipy` e `contourpy`.
- *Come si muove*: come mossa dal vento, con una fisica vera della stoffa (vedi sotto). A riposo un respiro appena visibile; quando il puntatore le passa sopra nasce lì una folata che corre nel verso del gesto, increspa il tessuto (sul petto fino a 4 cm con un gesto deciso) e si spegne da sola in un secondo e mezzo; toccata, cede appena sotto il dito; girandola, il tessuto resta un poco indietro. Bottoni e fili seguono la stoffa senza deformarsi. Con movimento ridotto sta ferma e si gira solo trascinandola. Bocciate dal proprietario: le onde ad anello e l'oscillazione a molla (15 novembre, "non è naturale") e le onde disegnate nello shader (16 novembre, "non si muove come mossa dal vento").
- *Il taschino*: la camicia di base è senza. Nel modello il taschino è fatto di tre pezzi; due si staccano in un oggetto a parte dentro lo stesso file (`taschino`, spento di base: `imposta({ taschino: true })` lo accende), il terzo è il davanti che gli sta sotto e resta sulla camicia. Dove era cucito restavano fessure: `camicia/prepara.py` le chiude e controlla il petto "come lo disegna il browser" (`buchi_del_petto`): deve dare zero.
- *Il riquadro in vetro* sta a destra (sotto, sul telefono) e contiene i campi del foglio di carta "Camicie su misura" di Endero, descritti in `contenuti/it/configuratore.json`. Si compilano le misure (taglia, spalla, spallina, torace, pancia, bacino, lunghezza manica, braccio, avambraccio, polso, lunghezza totale davanti e dietro) e i dati del cliente; tessuto, collo, colori ricamo carré, taschino, asola, bottone, filato bottone, iniziali, note e i contrasti si vedono ma sono spenti finché il proprietario non dice cosa farne. Le righe d'aiuto sotto alcune misure vengono dagli appunti a mano sul foglio e sono tra `[[ ]]`; i limiti minimi e massimi sono nostri, larghi, da rivedere con il sarto. "Continua" è spento: il modulo non invia nulla. In questa pagina la pillola fissa di WhatsApp non c'è, perché coprirebbe i campi.
- *Caricamento*: stesso caricatore dell'apertura (logo, cucitura che avanza, percentuale). Motore 3D e file della camicia si scaricano solo in questa pagina. Peso da non superare: 2,5 MB in tutto prima di vedere la camicia. Oggi: motore 600 KB (160 KB compresso in rete), modello 1,2 MB, luce 200 KB, cuciture 290 KB, telaio 180 KB (50 KB compresso): 1,9 MB.
- *Se il 3D non può partire* (browser senza WebGL, risparmio dati, JavaScript spento): un'immagine ferma della stessa camicia, fotografata dal 3D stesso (`tools/manifesto-camicia.js`) e messa nello stesso posto, e il riquadro funziona lo stesso.
- *Controlli prima di mostrarlo*: 60 fotogrammi al secondo su un portatile normale e fluido su un telefono di fascia media; nessuna richiesta di rete prima che la pagina sia visibile oltre al necessario; tastiera e lettore di schermo arrivano al riquadro senza passare dal 3D; larghezza 390 e 320 senza scorrimento di lato.

**La camicia rifatta, 16 novembre 2026.** Il proprietario ha bocciato la seconda camicia: "mi sembra finta, non si muove come mossa dal vento, anche le ombre sono sbagliate e sembra fatta di plastica". Non vuole comprare elementi 3D e non ha le immagini del modello. Tra tre strade (rifare bene il 3D dal vivo, film calcolato prima come l'apertura, camicia vera filmata) ha scelto la prima, con una prova da vedere prima di andare avanti; se non convince si passa al film. Che cosa è cambiato:

- *La luce non si calcola più nel browser.* `camicia/prepara.py` la calcola con Cycles, lo stesso motore dell'apertura, nello studio di `camicia/luci.py` (luce principale morbida da davanti a sinistra, controluce caldo, stanza blu), e la scrive in un'immagine stesa sul cartamodello (`luce.webp`, 2048 punti di lato, un punto ogni 0,85 mm di tessuto). Dentro ci sono le ombre vere (il collo sulle spalle, le maniche sui fianchi, ogni piega) e la luce che rimbalza tra i lembi. Il rovescio, che si vede dal collo e dai polsini, ha la luce sui vertici più quella che attraversa il cotone da fuori: l'interno di una camicia bianca non è buio.
- *Il tessuto è opaco.* Nessun riflesso: colore per luce, più la peluria che si schiarisce di taglio. La trama è un'irregolarità finissima lungo ordito e trama, che sparisce da sola quando è più piccola di un punto dello schermo.
- *Le cuciture sono ricostruite dal cartamodello*, perché le immagini del modello non ci sono. `cuciture.webp` dice, per ogni punto del tessuto, quanto dista dal bordo del suo pezzo e a che punto si è del passo dell'impuntura lungo quel bordo: lo shader ci disegna il solco della costura sul bordo e l'impuntura a 5,5 mm, con i punti staccati e il tessuto che si arriccia appena tra l'uno e l'altro. Quale lato di ogni pezzo sia il diritto si decide pezzo per pezzo (polsini e listino del collo sono ripiegati, e ce l'hanno al contrario).
- *Il vento è fisica.* `src/configuratore/stoffa.js` simula a ogni fotogramma il "telaio" (`telaio.json`): la stessa camicia semplificata a 2.900 punti. I fili non si allungano, il tessuto schiacciato cede in una grinza, tra un triangolo e l'altro ricorda la sua forma, collo e spalle sono appesi, i lembi sovrapposti (abbottonatura, collo, polsini) sono cuciti tra loro. L'aria spinge ogni lembo solo per la parte che lo investe di piatto e lo frena quando si muove: per questo le pieghe nascono e si spengono senza rimbalzi. La camicia vera segue il telaio: ogni suo punto sta sopra un punto di un triangolo del telaio, a pochi millimetri, e ci resta. I numeri del tessuto stanno in `TESSUTO`, in cima al file; `node tools/prova-stoffa.mjs <telaio.json> curve.csv` li prova senza browser e scrive le curve di spostamento.
- *La luce segue le pieghe.* La luce fissata vale per la posa di riposo. `prepara.py` ricava anche quanta luce riceve una superficie libera in funzione di dove guarda (nove numeri per colore, in `camicia.json`): quando il vento gira un lembo verso la luce principale, lo shader lo schiarisce in proporzione.
- *Difetti del modello chiusi strada facendo*: i forellini lungo le cuciture (il rovescio fa da fodera al diritto, con la sua stessa luce); i segnetti scuri dove stava il taschino (lì la luce si ripulisce, e nel telaio il petto è un pezzo solo); il controluce troppo carico, che di schiena faceva sembrare crema la camicia bianca.

**La scena con gruccia, parete e ombra, 16 novembre 2026 (sera).** Provata dal vivo la camicia rifatta, il proprietario ha chiesto tre cose: tessuto meno spesso, via i puntini neri che compaiono muovendola, e la scena della sua immagine di riferimento (camicia su una gruccia, ombra sulla parete dietro). Scelte sue: parete blu Endero, gruccia di legno con nastro avorio, luce di finestra con le sbarre. Come è fatta:

- *Tessuto più sottile.* Nel modello i due strati stavano a 1,9 mm: sui bordi (collo, polsini, orlo) si vedeva e la camicia sembrava di tela pesante. `prepara.py` avvicina lo strato interno al diritto fino a 0,6 mm (`assottiglia`); il rilievo delle costure è stato alleggerito.
- *Puntini neri.* Nel browser di prova non compaiono, nemmeno senza levigatura dei bordi (`?grezzo`): su una scheda grafica vera nascono da calcoli che danno un valore non valido, cioè nero. Ora nessuna normale si calcola dividendo per zero (`unita`, `unitaF`), la correzione della luce si spegne dove le normali non sono affidabili (i bordini tra diritto e rovescio) e non scende sotto il 45%, e dove stava il taschino la luce si ricostruisce dai soli punti in piena luce (`ripara_petto`).
- *La parete e l'ombra* stanno in `src/configuratore/scena.js`. La luce della finestra è un fascio di raggi paralleli (verso scritto in `camicia/luci.py`, lo stesso con cui Cycles calcola la luce sul tessuto): ogni punto della camicia si schiaccia sulla parete lungo il suo raggio, in un'immagine di 512 punti che poi si sfuma. L'ombra segue il vento e la rotazione senza mappe d'ombra né luci calcolate nel browser. Le sbarre sono una funzione sola, usata dalla parete e dal tessuto.
- *La luce resta ferma nella stanza.* Girando la camicia, la luce fissata girerebbe con lei: lo shader la corregge con la stessa funzione usata per le pieghe (quanta luce riceve una superficie che guarda da quella parte), così il lato che si volta verso la finestra si schiarisce e l'altro si spegne.
- *La gruccia* si costruisce nel browser dalle misure delle spalle che `prepara.py` scrive in `camicia.json`: il legno passa sotto le spalle e resta dentro il colletto, il gancio ne esce, il nastro gli passa sotto e si torce quando la camicia gira. Collo e spalle erano già "appesi" nella fisica: ora si vede a cosa.
- *Posa*: maniche più basse (26 gradi invece di 20, perché una camicia appesa le lascia cadere) e camicia appena girata verso sinistra, con la finestra davanti a destra: la luce la prende di lato come nella versione approvata, e l'ombra cade a sinistra, dove sul computer c'è spazio. Trascinarla in verticale non la inclina più: è appesa.
- *La tela* sul computer è larga quanto la pagina: la parete fa da sfondo anche al riquadro, che così è vetro davvero; la camicia resta nella sua colonna. Sul telefono la parete sfuma in basso nel blu della pagina.
- *L'immagine ferma* è la camicia con gruccia e nastro, senza parete (fondo trasparente).

**Stirata, e molto più mossa, 17 novembre 2026.** Provata la scena, il proprietario: "ancora non ci siamo… il tessuto continua ad avere delle pieghe anche quando è fermo… il movimento che do con il mouse è ancora troppo debole… quello che mi deve dare è un senso di qualcosa di vero, di reale". Scelte sue: via le grinze di maniche e fianchi (le fasce di luce della finestra sul petto restano); movimento "molto: ondeggia tutta"; tessuto popeline leggero e stirato. Che cosa è cambiato:

- *La camicia è stirata.* Le grinze erano nella forma del modello, che è stato modellato stropicciato: fisse nella forma e nella luce, non cambiavano nemmeno quando il tessuto si muoveva. `prepara.py` ora le liscia (`stira`): cerca la superficie più liscia che resta vicina a quella di partenza, così spariscono le pieghe più corte di una spanna e restano la caduta, le spalle, il giro delle maniche. Collo, polsini, abbottonatura e bordi non si toccano; rovescio, bottoni e fili seguono il diritto. Le pieghe ora nascono solo dal movimento. Con `--stropicciata` si riottiene il modello com'era.
- *Il movimento è molto più ampio.* Un passaggio deciso del mouse sposta il tessuto di una decina di centimetri su petto e fianchi (prima meno di quattro), le maniche pendono libere e dondolano, e tutta la camicia è un pendolo: appesa al punto in cui il nastro è fissato (fuori dall'inquadratura) oscilla di lato e avanti-indietro, una volta ogni due secondi circa, e si torce sul nastro se il vento la prende di lato. Torna ferma piano. Anche trascinandola dondola e prende vento: sul telefono è il solo modo di muoverla. I numeri stanno in `TESSUTO` (`stoffa.js`) e nel `pendolo` (`camicia3d.js`).
- *Il telaio è più fitto* (4.000 punti invece di 2.900): con pieghe così ampie, quello di prima le avrebbe fatte a spigoli.
- *Popeline*: trama più fine e più discreta, tessuto più cedevole nella fisica.
- *I puntini neri erano i bordini.* Dove stava il taschino spuntavano tra un pezzo e l'altro le strisce che uniscono diritto e rovescio, che prendevano la luce più scura dell'interno; col movimento si scoprivano di più. Lì sono stati tolti, dietro c'è una fodera di tessuto (`fodera_del_petto`), e nel resto della camicia i bordini hanno un materiale loro (`bordino`) con la luce del diritto.
- *Maniche* a 30 gradi (appesa, le lascia cadere quasi dritte).

**Stato al 16 novembre 2026.** Fatti: `src/configuratore/camicia3d.js` (disegno, legatura al telaio, gesti), `stoffa.js` (fisica), `configuratore.js` (decide se il 3D può partire, caricamento, riserva), `configuratore.css` (palco, riquadro, telefono), immagine ferma, `tools/filma-camicia.js` per i video di prova. La pagina è nel sito (`src/pagine/configuratore.mjs`, testi in `contenuti/it/configuratore.json`); ci si arriva dalla testata ("La tua camicia"), dalla pagina del su misura e dalla pillola "Crea la tua camicia" in pagina iniziale. Il proprietario ha visto la prova (confronto prima/dopo e video): l'aspetto è approvato ("Sì, così va bene"), il vento lo ha chiesto "più deciso" (folate più forti e un po' più larghe: sul petto quasi 4 cm di spostamento invece di 2) e la camicia rifatta è sull'anteprima con il suo ok. Da fare: la sua conferma sul vento provato dal vivo; cosa fare dei campi spenti; l'invio dell'ordine. Mai provata su un telefono vero: lì vanno sentiti il vento sotto il dito e la fluidità (la fisica dimezza i conti da sola se il telefono è lento).

**Passi successivi, nell'ordine.** 2) scelta del tessuto, che cambia la camicia; 3) collo, polsi e altre opzioni, con i pezzi che cambiano; 4) misure del corpo guidate; 5) riepilogo, pagamento con Stripe, ordine a Endero. Ogni passo aspetta l'approvazione del precedente e i dati del proprietario (opzioni, prezzi, tempi di consegna).

**Chi fa cosa.** Scena 3D e preparazione del modello: Fable 5.2, come per il film. Pagina, riquadro, modulo e collegamento al resto del sito: Opus 5.5.

