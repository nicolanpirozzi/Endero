---
name: memoria
description: Tiene aggiornato CLAUDE.md con regole, decisioni e problemi già incontrati nel progetto Endero. Da usare quando il proprietario dà una regola o corregge un approccio, quando si prende una decisione che vale per le sessioni future, quando si incontra un problema che potrebbe ripresentarsi, e alla fine di ogni blocco di lavoro prima del commit. Anche quando l'utente dice "ricordati", "segnalo", "da ora in poi", "non rifarlo".
---

# Memoria del progetto

`CLAUDE.md` è l'unica memoria che passa da una sessione all'altra (il container è effimero e il modello può cambiare tra Fable e Opus). Questa skill decide cosa ci entra, dove e in che forma.

## Quando scrivere

Scrivi subito, senza aspettare la fine della sessione, quando succede una di queste cose:

1. **Regola**: il proprietario esprime una preferenza stabile o corregge un approccio ("le foto mai ritagliate", "niente inglese nei titoli").
2. **Decisione**: si sceglie tra alternative e la scelta vincola il lavoro futuro (struttura delle pagine, nomi degli URL, opzioni del configuratore, palette).
3. **Problema**: qualcosa è andato storto o ha fatto perdere tempo e potrebbe ricapitare (un comando che fallisce, un limite dell'ambiente, un bug di un browser).
4. **Domanda chiusa**: una voce di "Domande aperte" riceve risposta: spostala in Decisioni o nel dossier e toglila dall'elenco.

Alla fine di ogni blocco di lavoro, prima del commit, rileggi la conversazione e controlla che niente dei quattro punti sia rimasto fuori.

## Cosa non scrivere

- Stato dei lavori, elenchi di cose fatte, riassunti di commit: quelli stanno in git.
- Piani provvisori e idee non approvate.
- Dettagli che si leggono dal codice (nomi di file, firme di funzioni).
- Fatti sul brand: quelli vanno in `docs/ricerca-endero.md`, con la fonte.
- Segreti: mai chiavi, token o password, nemmeno parziali.

Se non è chiaro che una cosa serva in più sessioni, non scriverla.

## Dove e come

Ogni voce va nella sezione giusta di `CLAUDE.md`, una riga o due, con la data:

| Sezione | Forma della voce |
| --- | --- |
| Regole | `- Regola. Perché: motivo. (chi l'ha chiesta, AAAA-MM-GG)` |
| Decisioni | `- AAAA-MM-GG · Cosa si è deciso. Perché: motivo. Alternativa scartata: quale.` |
| Problemi già incontrati | `- AAAA-MM-GG · Sintomo. Causa: quale. Soluzione: cosa fare.` |
| Domande aperte | `- Domanda. Serve per: cosa blocca.` |

Regole di scrittura:

- Scrivi il **perché**: una regola senza motivo viene applicata male ai casi nuovi.
- Riporta le parole del proprietario quando sono una sua richiesta; se è una tua interpretazione, dillo ("interpretazione:").
- Prima di aggiungere, cerca una voce simile: aggiorna quella invece di duplicare.
- Una voce superata si corregge o si toglie, non si lascia accanto a quella nuova. Se una decisione cambia, riscrivi la riga e annota la data del cambio.
- Non togliere una regola data dal proprietario senza la sua conferma.
- Tieni `CLAUDE.md` sotto le 200 righe: se cresce, accorpa le voci simili e sposta i dettagli lunghi in `docs/`.

## Dopo aver scritto

Dì al proprietario in una riga cosa hai annotato ("Annotato in CLAUDE.md: le anteprime si approvano prima di pubblicare"), così può correggerti subito. Poi includi `CLAUDE.md` nel commit del lavoro a cui si riferisce.
