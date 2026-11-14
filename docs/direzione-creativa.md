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
| 3 | Nastro di loghi | Nastro di fatti: "Dal 1996 · 1,3 milioni di capi · 2.500 negozi serviti · Fatto in Italia". |
| 4 | Selettore | "Su misura · Collezione · Storia · Dove siamo": porta alle sezioni della pagina, ognuna con il link alla pagina completa. |
| 5–6 | Titolo e griglia di foto | "Su misura": dettagli di colli, polsi, tessuti. Etichette "Su misura" / "Pronta". Scheda al passaggio con nome e tessuto. |
| 7 | Foto grande con scheda | Presa misure: scheda in vetro con le voci della scheda misure e invito a prenotare. |
| 8 | Testo e pannello | "Come funziona" in tre passi a sinistra, modulo di prenotazione a destra. |
| 9 | Tre riquadri | Tre ingressi alla collezione, con foto vere al posto delle sfumature. |
| 10 | Carosello | Capitoli della storia con foto. Le citazioni dei clienti entrano solo quando ci sono recensioni vere. |
| 11 | Domande frequenti | Tempi, misure, prezzi, ritiro: domande e risposte da far confermare. |
| 12 | Prezzo | Foto a sinistra, "A partire da € __" a destra. Cifra da confermare. |
| 13 | Piè di pagina | Fondo blu, logo completo grande, link, dati legali, contatti. |

## 4. Apertura "La cucitura"

Tavola di riferimento: `docs/img/apertura-cucitura.jpg`.

**Idea.** Scorrere è cucire. In una macchina vera l'ago sta fermo ed è il tessuto a muoversi: la pagina è il tessuto blu, l'ago resta a metà schermo, la cucitura bianca avanza con lo scorrimento e racconta la storia fino a ricamare il logo. Poi il telo si solleva e sotto c'è il sito.

**Scelte del proprietario.** Questa variante; si rivede completa a ogni visita; sempre presente il link per saltarla; nessun video generato.

**Sequenza.**

1. *Avvio.* Tessuto blu a tutto schermo con il titolo della pagina. L'ago scende e fa i primi punti da solo in poco più di un secondo. Compare "Scorri per cucire".
2. *Storia.* Sezione alta circa 450 % dello schermo su desktop, 380 % su mobile, a scorrimento normale. La cucitura è un unico tracciato SVG che scende serpeggiando. Capitoli, solo fatti confermati: "1996 · Inizia la storia di Endero", "1,3 milioni · Capi prodotti in trent'anni", "2.500 · Negozi serviti", "Fatto in Italia". I numeri grandi sono testo SVG con contorno tratteggiato, come ricamati.
3. *Logo.* Ultimo tratto con il palco fermo (`position: sticky`) per circa 120 % dello schermo. Il logo ha due strati: un contorno tratteggiato tenue che fa da guida e il riempimento a punto raso, scoperto da sinistra a destra mentre si scorre. L'ago segue il bordo del ricamo.
4. *Uscita.* Il logo rimpicciolisce verso la sua posizione in testata, il telo blu sale con un orlo ondulato e cucito, sotto appare il video della sezione successiva.

**Come si costruisce.**

- L'ago è fisso in verticale a metà schermo e si sposta solo in orizzontale per seguire la cucitura. Tessuto e testi scorrono normalmente: così il testo non si muove di lato e resta leggibile.
- La cucitura si scopre con un ritaglio dall'alto fino all'altezza dell'ago: una sola variabile aggiornata allo scorrimento. Niente calcoli sulla lunghezza del tracciato a ogni fotogramma.
- La posizione orizzontale dell'ago viene da una tabella altezza → ascissa, calcolata una volta all'avvio e a ogni ridimensionamento campionando il tracciato.
- Il su e giù dell'ago è legato alla distanza scorsa, un punto ogni 16 px circa: l'ago scende esattamente dove nasce il punto. Da fermi, l'ago sta fermo.
- Il tracciato si genera dalle posizioni reali dei capitoli, così si adatta a ogni schermo. Su mobile serpeggia poco, al massimo il 22 % della larghezza.
- Si animano solo `transform`, `opacity` e `clip-path`.

**Resa del filo e del tessuto** (ricette già provate nella tavola):

```html
<!-- trama del tessuto: righe diagonali tenui + grana -->
<pattern id="twill" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(38)">
  <line x1="0" y1="0" x2="0" y2="5" stroke="#fff" stroke-opacity="0.045" stroke-width="2"/>
</pattern>
<filter id="trama"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7"/>
  <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.10 0"/></filter>
<!-- cucitura: tratteggio a estremi tondi, con ombra corta che la solleva dal tessuto -->
<path stroke="#fbf9f4" stroke-width="2.6" stroke-linecap="round" stroke-dasharray="9 6.5" fill="none" filter="url(#rilievo)"/>
<filter id="rilievo"><feDropShadow dx="0" dy="1.2" stdDeviation="0.7" flood-color="#030a1f" flood-opacity="0.75"/></filter>
<!-- punto raso del logo: righe fitte inclinate, ritagliate sulla forma del marchio -->
<pattern id="raso" width="2.2" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-58)">
  <rect width="2.2" height="6" fill="#f6f3ec"/><line x1="0.4" y1="0" x2="0.4" y2="6" stroke="#c9c3b6" stroke-width="0.55"/>
</pattern>
```

Su mobile i filtri SVG costano: sostituire l'ombra con un secondo tratto scuro sfalsato e la grana con un'immagine piccola ripetuta. L'ago della tavola è provvisorio: va ridisegnato con più cura (barra, morsetto, ago con cruna, piedino).

**Vincoli che non si trattano.**

- *Senza JavaScript*: la sezione mostra tessuto blu, cucitura completa, capitoli come testo in colonna e logo già ricamato. È lo stato di base del CSS; lo script aggiunge una classe e solo allora attiva lo scorrimento animato.
- *Movimento ridotto*: lo stesso stato fermo, con sole dissolvenze.
- *Google*: il titolo H1 della pagina sta qui dentro, in testo vero, e i capitoli sono un elenco ordinato. Grafica e ago hanno `aria-hidden`.
- *Velocità*: SVG in pagina, nessuna immagine. Il primo contenuto visibile è il titolo su fondo blu. GSAP e ScrollTrigger si caricano dopo il primo disegno. Il video della sezione dopo ha `preload="none"` e un'immagine di copertina, e parte a caricarsi a metà apertura.
- *Uscita rapida*: "Salta l'introduzione" è un link vero a un'ancora, primo elemento raggiungibile con la tastiera.
- *Mobile*: altezze in `svh`, `position: sticky` invece dei blocchi di ScrollTrigger, per evitare i salti della barra degli indirizzi. Provare su un telefono vero.

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

## 6. Contatti, modulo ed email

- WhatsApp: 333 854 8712, collegamento `https://wa.me/393338548712`.
- Email pubblica: `info@endero.it`. Invii con Resend (chiave come segreto del Worker). Le risposte dei clienti vengono inoltrate alla casella del proprietario, il cui indirizzo sta solo nella configurazione del Worker.
- Tutto questo richiede di modificare i DNS di endero.it, che oggi non si sa chi gestisca. Nelle anteprime il modulo salva su D1 e basta.
- Modulo di contatto e prenotazione: `POST /api/contatto`, verifica Turnstile lato server, salvataggio su D1. Funziona come normale invio di modulo anche senza JavaScript.
- Banner dei consensi pronto; Google Analytics e Meta Pixel si collegano dopo e non partono senza consenso.

## 7. Architettura e ordine dei lavori

Sito statico a più pagine, generato da un piccolo script Node: pagine e parti comuni in HTML, testi e prodotti in file di dati, nessun framework. Perché: ogni pagina esce completa anche senza JavaScript, il codice HTML è sotto controllo per Google, il peso resta minimo. esbuild compila gli script, con l'apertura in un file caricato a parte. Un Worker serve i file e risponde al modulo.

1. Impalcatura: script di generazione, esbuild, Wrangler, schema D1.
2. Colori, carattere, testata, pillole, piè di pagina.
3. Pagina iniziale ferma, senza animazioni, con riquadri segnaposto. Anteprima desktop e mobile al proprietario.
4. Apertura "La cucitura": prima lo stato fermo, poi lo scorrimento.
5. Movimento del resto della pagina con la skill `animate`; poi `make-interfaces-feel-better`, `mobile-native`, `break-ui`.
6. Altre pagine, modulo con Worker, D1 e Turnstile, banner dei consensi, file per Google.
7. Revisione indipendente con più agenti. Solo dopo l'ok del proprietario, pubblicazione sul link Cloudflare.

## 8. Materiali da ricevere

- Video del laboratorio per l'apertura del sito: 10–20 secondi, orizzontale, più un taglio verticale per il telefono.
- Dodici foto verticali di dettagli e capi per la griglia, una foto orizzontale grande, tre foto per gli ingressi alla collezione, foto per la storia.
- Foto, nomi, descrizioni e prezzi dei prodotti della collezione.
- Orari della sede, prezzo "a partire da", testi delle domande frequenti.
