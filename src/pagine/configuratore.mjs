// Pagina /camicie-su-misura/configuratore/. La camicia appesa e il riquadro in vetro (docs/direzione-creativa.md,
// punti 12 e 16). La camicia è l'immagine di Blender divisa in pezzi che si muovono (src/configuratore/leggera.js).
// Dal 2026-11-25 il riquadro è un ordine in cinque passi (proprietario: «Configurazione prodotto, misure, dati
// clienti, dati spedizione e pagamento. Divisi a step in modo chiaro»): Camicia, Misure, Dati, Spedizione, Pagamento.
// Lo script (src/configuratore/scheda.js) ne mostra uno alla volta; senza script i passi si leggono uno sotto l'altro
// e sono un modulo solo, che si invia a /api/ordine. Testi, opzioni e prezzi: contenuti/it/configuratore.json; i
// nomi dei campi sono quelli piatti di src/configuratore/ordine.mjs.
// Guida alle misure (dal 2026-11-21): entrando in un campo di misura la camicia fa uno zoom sul punto in cui si misura,
// con un tratteggio blu (src/configuratore/guida.js, che aggancia i campi `.misura[data-guida]`). Le righe del passo
// Camicia che hanno una parte sulla camicia portano `data-parte` (lo zoom su quella parte).
import { esc, t, tConLink } from '../parti/base.mjs';
import { pagina, briciola } from '../parti/telaio.mjs';
import { datiBase, domande } from '../parti/sezioni.mjs';

// piccole icone a tratto, come quelle del sito (src/parti/base.mjs)
const svg = (d, classe = 'icona') => `<svg class="${classe}" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICONA = {
  meno: svg('M3.5 8h9'),
  piu: svg('M3.5 8h9M8 3.5v9'),
  giu: svg('M3.5 6l4.5 4.5L12.5 6'),
  cerca: svg('M7 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM10.6 10.6 14 14'),
  chiudi: svg('M4 4l8 8M12 4l-8 8'),
  spunta: svg('M3.5 8.5l3 3 6-7'),
  filtri: svg('M2.5 4.5h11M4.5 8h7M6.5 11.5h3'),
  aggiungi: svg('M8 3.5v9M3.5 8h9'),
};

const id = (nome) => `campo-${nome}`;
const riga = (nome) => `<p class="campo__errore" id="${id(nome)}-errore" aria-live="polite"></p>`;
const descritto = (nome, altro = '') => ` aria-describedby="${[altro, `${id(nome)}-errore`].filter(Boolean).join(' ')}"`;

/** Il <select> dei tessuti per chi non ha lo script: un gruppo per tipo. */
function elencoTessuti(nome, tessuti, { obbligatorio = false } = {}) {
  const gruppi = (tessuti.categorie || []).map((c) => {
    const voci = tessuti.tessuti.filter((x) => x.categoria === c.id);
    return voci.length ? `<optgroup label="${esc(c.nome)}">${voci.map((x) => `<option value="${esc(x.id)}">${esc(x.nome)}</option>`).join('')}</optgroup>` : '';
  }).join('');
  return `<noscript><span class="tendina"><select name="${esc(nome)}"${obbligatorio ? ' required' : ''}${descritto(nome)}><option value="">—</option>${gruppi}</select>${ICONA.giu}</span></noscript>`;
}

/** Il <select> dei colori del filo per chi non ha lo script. */
function elencoColori(nome, colori) {
  return `<noscript><span class="tendina"><select name="${esc(nome)}"${descritto(nome)}><option value="">—</option>${colori.map((x) => `<option value="${esc(x.id)}">${esc(x.nome)}</option>`).join('')}</select>${ICONA.giu}</span></noscript>`;
}

/**
 * Il tasto che apre la finestra dei tessuti o dei colori (solo con lo script). Il valore sta in un campo nascosto,
 * spento nell'HTML (senza script vale il <select>) e acceso dallo script.
 */
function sceglitore(c, quale, testoNome) {
  const togli = c.togli ? `<button class="scegli__togli" type="button" data-togli hidden>${esc(c.togli)}</button>` : '';
  return `<div class="scegli" data-scegli="${quale}" data-per="${esc(c.per || c.etichetta)}">
          <input type="hidden" name="${esc(c.nome)}" value="" disabled data-valore>
          <button class="scegli__tasto" type="button" id="${id(c.nome)}" data-campo="${esc(c.nome)}" aria-haspopup="dialog" aria-labelledby="${testoNome} ${id(c.nome)}-scelto"${descritto(c.nome)}>
            <span class="scegli__campione" aria-hidden="true">${ICONA.aggiungi}</span>
            <span class="scegli__testo" id="${id(c.nome)}-scelto" data-vuoto="${esc(c.scegli)}">${esc(c.scegli)}</span>
            <span class="scegli__cambia" aria-hidden="true" hidden>${esc(c.cambia)}</span>
          </button>
          ${togli}
        </div>`;
}

/** Due o più pillole a scelta singola (radio). */
function pillole(nome, opzioni, scelta, { classe = '' } = {}) {
  return `<div class="pillole${classe ? ` ${classe}` : ''}">${opzioni.map((o) => `<label class="pillole__voce"><input type="radio" name="${esc(nome)}" value="${esc(o.id)}"${o.id === scelta ? ' checked' : ''}><span>${esc(o.nome)}</span></label>`).join('')}</div>`;
}

/** Una riga del passo Camicia (e i suoi sotto-campi, che compaiono con «Sì» o «Personalizzato»). */
function voceCamicia(c, S, tessuti) {
  // (fino al 2026-11-26 qui c'era `data-parte`: lo zoom sulla parte della camicia mentre la si sceglie; il proprietario lo ha tolto)
  const parte = '';
  const nome = `${id(c.nome)}-nome`;
  if (c.tipo === 'quantita') {
    return `<div class="voce voce--quantita">
        <label class="voce__nome" id="${nome}" for="${id(c.nome)}">${esc(c.etichetta)}</label>
        <div class="contatore">
          <button class="contatore__tasto" type="button" data-quanti="-1" aria-label="${esc(c.meno)}" aria-controls="${id(c.nome)}">${ICONA.meno}</button>
          <input class="contatore__numero" id="${id(c.nome)}" name="${esc(c.nome)}" data-campo="${esc(c.nome)}" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="3" value="${esc(c.predefinita)}" autocomplete="off" required data-min="${esc(c.min)}" data-max="${esc(c.max)}"${descritto(c.nome)}>
          <button class="contatore__tasto" type="button" data-quanti="1" aria-label="${esc(c.piu)}" aria-controls="${id(c.nome)}">${ICONA.piu}</button>
        </div>
        ${riga(c.nome)}
      </div>`;
  }
  if (c.tipo === 'tessuto' || c.tipo === 'colore') {
    const quale = c.tipo === 'tessuto' ? 'tessuto' : 'colore';
    const senza = quale === 'tessuto' ? elencoTessuti(c.nome, tessuti, { obbligatorio: c.nome === 'tessuto' }) : elencoColori(c.nome, S.colori_filo);
    return `<div class="voce voce--sceglitore${c.facoltativo ? ' voce--facoltativa' : ''}"${parte}>
        <span class="voce__nome" id="${nome}">${esc(c.etichetta)}</span>
        ${sceglitore(c, quale, nome)}
        ${senza}
        ${riga(c.nome)}
      </div>`;
  }
  if (c.tipo === 'tendina') {
    return `<div class="voce voce--tendina"${parte}>
        <label class="voce__nome" id="${nome}" for="${id(c.nome)}">${esc(c.etichetta)}</label>
        <span class="tendina"><select id="${id(c.nome)}" name="${esc(c.nome)}" data-campo="${esc(c.nome)}"${descritto(c.nome)}>${c.opzioni.map((o) => `<option value="${esc(o.id)}"${o.id === c.predefinita ? ' selected' : ''}>${esc(o.nome)}</option>`).join('')}</select>${ICONA.giu}</span>
        ${riga(c.nome)}
      </div>`;
  }
  if (c.tipo === 'lettere') {
    return `<div class="voce voce--lettere">
        <label class="voce__nome" id="${nome}" for="${id(c.nome)}">${esc(c.etichetta)}</label>
        <span class="casella-scura casella-scura--lettere"><input id="${id(c.nome)}" name="${esc(c.nome)}" data-campo="${esc(c.nome)}" type="text" maxlength="${esc(c.massimo)}" autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false"${descritto(c.nome, c.aiuto ? `${id(c.nome)}-aiuto` : '')}></span>
        ${c.aiuto ? `<p class="voce__aiuto" id="${id(c.nome)}-aiuto">${t(c.aiuto)}</p>` : ''}
        ${riga(c.nome)}
      </div>`;
  }
  // sì / no, standard / personalizzato, una scelta fra più: radio in un fieldset
  const opzioni = c.tipo === 'sino' ? [{ id: 'no', nome: S.no }, { id: 'si', nome: S.si }]
    : c.tipo === 'standard' ? [{ id: 'standard', nome: S.standard }, { id: 'personalizzato', nome: S.personalizzato }]
      : c.opzioni;
  const scelta = c.tipo === 'sino' ? 'no' : c.tipo === 'standard' ? 'standard' : (c.predefinita || '');
  const quando = c.tipo === 'sino' ? 'si' : 'personalizzato';
  const sotto = c.se_si ? `<div class="voce__sotto" data-se="${esc(c.nome)}" data-se-valore="${quando}">
        ${c.se_si.map((x) => voceCamicia(x, S, tessuti)).join('\n        ')}
      </div>` : '';
  // un'opzione con un avviso (il bottone personalizzato: «Ordine minimo: 100 pezzi.») lo mostra quando è scelta
  const avvisi = (c.opzioni || []).filter((o) => o.avviso).map((o) => `<p class="voce__avviso" data-se="${esc(c.nome)}" data-se-valore="${esc(o.id)}">${t(o.avviso)}</p>`).join('');
  const lunga = c.tipo === 'scelta';
  return `<fieldset class="voce voce--${lunga ? 'scelta' : 'sino'} voce--${esc(c.tipo)}" id="${id(c.nome)}" data-campo="${esc(c.nome)}"${parte}${descritto(c.nome)}>
        <legend class="voce__nome">${esc(c.etichetta)}</legend>
        ${pillole(c.nome, opzioni, scelta, { classe: lunga ? 'pillole--larghe' : 'pillole--due' })}
        ${avvisi}
        ${riga(c.nome)}
        ${sotto}
      </fieldset>`;
}

/** Un campo di misura: lo stesso markup di sempre, che guida.js aggancia (data-guida, data-vista, id). */
function campoMisura(c, s) {
  // la frase su dove si misura non si vede (proprietario, 2026-11-22: «elimina il testo che compare sotto ogni box…
  // Non serve»): resta per chi usa un lettore di schermo, che la sente entrando nel campo
  const dove = c.guida ? `<span class="misura__dove nascosto" id="${id(c.nome)}-dove">${t(c.guida)}</span>` : '';
  const messaggio = s.errore_misura.replace('{min}', c.min).replace('{max}', c.max);
  const guida = c.guida ? ` data-guida="${esc(c.nome)}" data-vista="${esc(c.vista || 'davanti')}"` : '';
  return `<div class="misura"${guida}>
        <label class="misura__nome" for="${id(c.nome)}">${esc(c.etichetta)}</label>
        <span class="misura__casella"><input id="${id(c.nome)}" name="${esc(c.nome)}" data-campo="${esc(c.nome)}" type="text" inputmode="decimal" autocomplete="off" pattern="[0-9]{1,3}([,.][0-9]{1,2})?" maxlength="6" required data-min="${esc(c.min)}" data-max="${esc(c.max)}" data-errore="${esc(messaggio)}"${descritto(c.nome, c.guida ? `${id(c.nome)}-dove` : '')}>${c.unita ? `<span class="misura__unita" aria-hidden="true">${esc(c.unita)}</span>` : ''}</span>
        ${dove}${riga(c.nome)}
      </div>`;
}

/** Un campo di testo scuro (dati e indirizzo): etichetta, casella, aiuto, avviso. */
function campoTesto(c, { obbligatorio = true } = {}) {
  const tipo = c.tipo || 'text';
  const tastiera = c.tastiera ? ` inputmode="${esc(c.tastiera)}"` : tipo === 'tel' ? ' inputmode="tel"' : '';
  const scrittura = tipo === 'email' ? ' autocapitalize="off" spellcheck="false"' : c.nome === 'provincia' ? ' autocapitalize="characters" autocorrect="off" spellcheck="false"' : '';
  const classi = ['misura', `misura--${c.nome}`, c.stretto ? 'misura--stretta' : 'misura--larga'].join(' ');
  return `<div class="${classi}">
        <label class="misura__nome" for="${id(c.nome)}">${esc(c.etichetta)}</label>
        <span class="misura__casella"><input id="${id(c.nome)}" name="${esc(c.nome)}" data-campo="${esc(c.nome)}" type="${esc(tipo)}"${c.completa ? ` autocomplete="${esc(c.completa)}"` : ''} maxlength="${esc(c.massimo)}"${tastiera}${scrittura}${obbligatorio && !c.facoltativo ? ' required' : ''}${descritto(c.nome, c.aiuto ? `${id(c.nome)}-aiuto` : '')}></span>
        ${c.aiuto ? `<p class="voce__aiuto" id="${id(c.nome)}-aiuto">${t(c.aiuto)}</p>` : ''}
        ${riga(c.nome)}
      </div>`;
}

/** I cinque passi, in ordine. Senza script si leggono uno sotto l'altro. */
function passi(S, tessuti, turnstile, prova = false) {
  const P = Object.fromEntries(S.passi.map((p) => [p.id, p]));
  const testa = (p) => `<h2 class="passo__titolo" id="passo-${p.id}-titolo" tabindex="-1">${t(p.titolo)}</h2>${p.testo ? `<p class="passo__testo">${t(p.testo)}</p>` : ''}`;
  const sezione = (p, dentro) => `<section class="passo" id="passo-${p.id}" data-passo="${p.id}" aria-labelledby="passo-${p.id}-titolo">
    ${testa(p)}
    ${dentro}
  </section>`;
  const m = S.misure;
  const g = m.come_misurare;
  const sp = S.spedizione;
  const pg = S.pagamento;
  const pr = S.prezzi;
  const passiMisura = g ? `<ol class="passi-misura">${g.passi.map((x) => `<li class="passi-misura__voce">${t(x)}</li>`).join('')}</ol>` : '';
  return [
    sezione(P.camicia, `<div class="voci">
      ${S.camicia.campi.map((c) => voceCamicia(c, S, tessuti)).join('\n      ')}
    </div>`),
    sezione(P.misure, `${g ? `<button class="collegamento configura__come" type="button" data-apri-passi aria-haspopup="dialog">${esc(g.riapri)}</button>
    <noscript><div class="configura__senza-script">${passiMisura}</div></noscript>` : ''}
    <fieldset class="configura__gruppo configura__gruppo--misure">
      <legend class="nascosto">${t(P.misure.titolo)}</legend>
      <div class="configura__campi">
      ${m.campi.map((c) => campoMisura(c, m)).join('\n      ')}
      </div>
    </fieldset>`),
    sezione(P.dati, `<div class="configura__campi">
      ${S.dati.campi.map((c) => campoTesto(c)).join('\n      ')}
    </div>`),
    sezione(P.spedizione, `<fieldset class="voce voce--modi" id="${id('spedizione')}" data-campo="spedizione"${descritto('spedizione')}>
      <legend class="voce__nome">${t(sp.domanda)}</legend>
      <div class="modi">
        ${sp.opzioni.map((o) => `<label class="modo">
          <input type="radio" name="spedizione" value="${esc(o.id)}">
          <span class="modo__testo"><span class="modo__nome">${t(o.nome)}</span><span class="modo__dettaglio">${t(o.dettaglio)}</span></span>
          <span class="modo__prezzo" data-prezzo-modo="${esc(o.id)}">${o.prezzo ? esc(`${o.prezzo} €`) : esc(sp.gratis)}</span>
        </label>`).join('\n        ')}
      </div>
      <p class="voce__aiuto modi__nota">${t(sp.gratis_nota)}</p>
      ${riga('spedizione')}
    </fieldset>
    <fieldset class="indirizzo" data-se="spedizione" data-se-valore="${sp.opzioni.filter((o) => o.prezzo > 0 || o.giorni).map((o) => esc(o.id)).join(' ')}">
      <legend class="indirizzo__titolo">${t(sp.indirizzo.titolo)}</legend>
      ${sp.indirizzo.nota ? `<p class="voce__aiuto">${t(sp.indirizzo.nota)}</p>` : ''}
      <div class="configura__campi">
      ${sp.indirizzo.campi.map((c) => campoTesto(c, { obbligatorio: false })).join('\n      ')}
      </div>
    </fieldset>`),
    sezione(P.pagamento, `<div class="riepilogo" data-riepilogo></div>
    <div class="conti" data-conti hidden>
      <dl class="conti__righe">
        <div class="conti__riga"><dt>${esc(pg.prezzo)}</dt><dd data-conti-camicia></dd></div>
        <div class="conti__riga"><dt>${esc(pg.quantita)}</dt><dd data-conti-quantita></dd></div>
        <div class="conti__riga"><dt data-conti-consegna>${esc(pr.spedizione)}</dt><dd data-conti-spedizione></dd></div>
        <div class="conti__riga conti__riga--totale"><dt>${esc(pr.totale)}</dt><dd data-conti-totale></dd></div>
      </dl>
    </div>
    <div class="consenso__riga configura__consenso">
      <label class="consenso"><input type="checkbox" name="privacy" value="si" required data-campo="privacy" id="${id('privacy')}"${descritto('privacy')}><span>${tConLink(pg.consenso).replace(/<a href="([^"]+)">/g, '<a href="$1" target="_blank" rel="noopener">')}</span></label>
      ${riga('privacy')}
    </div>
    ${turnstile ? `<div class="cf-turnstile configura__antispam" data-sitekey="${esc(turnstile)}" data-language="it" data-size="flexible" data-theme="dark"></div>` : ''}
    <div class="passo__invia">
      <button class="pillola pillola--chiara pillola--grande" type="submit">${esc(pg.paga)}</button>
    </div>
    <p class="configura__nota-paga${prova ? ' configura__nota-paga--prova' : ''}">${t(prova ? pg.prova.nota : pg.nota)}</p>
    <p class="configura__esito" role="status" aria-live="polite" data-esito></p>`),
  ].join('\n  ');
}

/** La finestra dei tessuti: una sola per tutti i campi «tessuto», con i campioni scritti qui una volta (con 450 tessuti
 *  ogni byte conta: la spunta della scelta la disegna il CSS, il testo per la ricerca lo prepara lo script). */
function finestraTessuti(F, tessuti) {
  const elenco = tessuti.tessuti || [];
  const filtro = (nome, voci, gruppo, { pallini = false } = {}) => `<div class="filtro" role="radiogroup" aria-label="${esc(gruppo)}">
          <span class="filtro__nome" aria-hidden="true">${esc(gruppo)}</span>
          <div class="filtro__voci">
            <label class="chip-scelta"><input type="radio" name="${nome}" value="" checked><span>${esc(F.tutti)}</span></label>
            ${voci.map((v) => `<label class="chip-scelta"><input type="radio" name="${nome}" value="${esc(v.id)}"><span>${pallini ? `<i class="chip-scelta__pallino" style="--tinta: ${esc(v.tinta)}"></i>` : ''}${esc(v.nome)}</span></label>`).join('\n            ')}
          </div>
        </div>`;
  return `<dialog class="finestra finestra--grande finestra--tessuti" id="finestra-tessuti" aria-labelledby="finestra-tessuti-titolo" data-lenis-prevent>
  <form method="dialog" class="vetro finestra__corpo raccolta" data-raccolta="tessuto">
    <div class="raccolta__testa">
      <div>
        <p class="raccolta__per" data-per></p>
        <h2 class="finestra__titolo" id="finestra-tessuti-titolo">${esc(F.titolo)}</h2>
      </div>
      <button class="pillola pillola--vetro finestra__chiudi" value="chiudi" type="submit" aria-label="${esc(F.chiudi)}">${ICONA.chiudi}<span class="finestra__chiudi-testo">${esc(F.chiudi)}</span></button>
    </div>
    <div class="raccolta__cerca">
      <label class="cerca">${ICONA.cerca}<span class="nascosto">${esc(F.cerca)}</span><input type="search" name="cerca" placeholder="${esc(F.cerca)}" autocomplete="off" spellcheck="false" enterkeyhint="search" data-cerca></label>
      <button class="pillola pillola--vetro raccolta__mostra-filtri" type="button" aria-expanded="false" aria-controls="filtri-tessuti" data-mostra-filtri>${ICONA.filtri}<span>${esc(F.filtri)}</span><span class="raccolta__quanti-filtri" data-quanti-filtri hidden></span></button>
    </div>
    <div class="raccolta__filtri" id="filtri-tessuti" data-filtri>
      ${filtro('tipo', tessuti.categorie || [], F.tipo)}
      ${filtro('colore', tessuti.colori || [], F.colore, { pallini: true })}
      ${filtro('disegno', tessuti.disegni || [], F.disegno)}
    </div>
    <div class="raccolta__stato">
      <p class="raccolta__conta" aria-live="polite" data-conta data-molti="${esc(F.contati)}" data-uno="${esc(F.contati_uno)}">${esc(elenco.length === 1 ? F.contati_uno : F.contati.replace('{n}', elenco.length))}</p>
      <button class="collegamento raccolta__azzera" type="button" data-azzera hidden>${esc(F.togli_filtri)}</button>
    </div>
    <div class="raccolta__scorre">
      <div class="raccolta__griglia raccolta__griglia--tessuti" role="listbox" aria-labelledby="finestra-tessuti-titolo" data-griglia>
        ${elenco.map((x) => `<div class="campione" role="option" aria-selected="false" tabindex="-1" data-id="${esc(x.id)}" data-tipo="${esc(x.categoria)}" data-colore="${esc(x.colore)}" data-disegno="${esc(x.disegno)}"><span class="campione__foto"><img src="/camicia/tessuti/${esc(x.id)}.webp" alt="${esc(x.nome)}" width="320" height="214" loading="lazy" decoding="async" draggable="false"></span><span class="campione__nome" aria-hidden="true">${esc(x.nome)}</span></div>`).join('\n        ')}
      </div>
      <p class="raccolta__nessuno" data-nessuno${elenco.length ? ' hidden' : ''}>${esc(F.nessuno)}</p>
    </div>
    <div class="raccolta__piede">
      <p class="raccolta__scelto" data-scelto data-vuoto="${esc(F.nessuno_scelto)}">${esc(F.nessuno_scelto)}</p>
      <button class="pillola pillola--chiara pillola--grande" type="button" data-conferma disabled>${esc(F.conferma)}</button>
    </div>
  </form>
</dialog>`;
}

/** La finestra dei colori del filo (asola, filato bottone): una griglia di pallini con il nome sotto. */
function finestraColori(F, colori) {
  return `<dialog class="finestra finestra--colori" id="finestra-colori" aria-labelledby="finestra-colori-titolo" data-lenis-prevent>
  <form method="dialog" class="vetro finestra__corpo raccolta" data-raccolta="colore">
    <div class="raccolta__testa">
      <div>
        <p class="raccolta__per" data-per></p>
        <h2 class="finestra__titolo" id="finestra-colori-titolo">${esc(F.titolo)}</h2>
      </div>
      <button class="pillola pillola--vetro finestra__chiudi" value="chiudi" type="submit" aria-label="${esc(F.chiudi)}">${ICONA.chiudi}<span class="finestra__chiudi-testo">${esc(F.chiudi)}</span></button>
    </div>
    <div class="raccolta__scorre">
      <div class="raccolta__griglia raccolta__griglia--colori" role="listbox" aria-labelledby="finestra-colori-titolo" data-griglia>
        ${colori.map((x) => `<div class="tinta" role="option" aria-selected="false" tabindex="-1" data-id="${esc(x.id)}" data-tinta="${esc(x.tinta)}"><span class="tinta__pallino" style="--tinta: ${esc(x.tinta)}">${ICONA.spunta}</span><span class="tinta__nome">${esc(x.nome)}</span></div>`).join('\n        ')}
      </div>
    </div>
    <div class="raccolta__piede">
      <p class="raccolta__scelto" data-scelto data-vuoto="${esc(F.nessuno_scelto)}">${esc(F.nessuno_scelto)}</p>
      <button class="pillola pillola--chiara pillola--grande" type="button" data-conferma disabled>${esc(F.conferma)}</button>
    </div>
  </form>
</dialog>`;
}

/** La finestra «Come prendere le misure» (guida.js, `passi()`): si apre entrando nel passo Misure. */
function finestraMisure(g) {
  if (!g) return '';
  return `<dialog class="finestra finestra--passi" id="come-misurare" aria-labelledby="come-misurare-titolo" data-lenis-prevent>
  <div class="vetro finestra__corpo">
    <h2 class="finestra__titolo" id="come-misurare-titolo">${t(g.titolo)}</h2>
    <ol class="passi-misura">${g.passi.map((x) => `<li class="passi-misura__voce">${t(x)}</li>`).join('')}</ol>
    <form method="dialog" class="finestra__azioni"><button class="pillola pillola--chiara pillola--grande" value="inizia" autofocus>${esc(g.inizia)}</button></form>
  </div>
</dialog>`;
}

/**
 * @param {object} o.camicia  { stile, script, ferma: { computer, computer2x, telefono, telefono2x }, leggera, leggeraV, … }:
 *   gli indirizzi dell'immagine ferma, la cartella dei tre pezzi che si muovono (se ci sono) e la loro impronta
 * @param {object} o.tessuti  contenuti/it/tessuti.json: categorie, colori, disegni, tessuti
 */
export default function paginaConfiguratore({ sito, testi: c, tessuti = { tessuti: [] }, camicia, risorse, anteprima }) {
  const p = c.palco;
  const S = c.scheda;
  const totale = S.passi.length;
  // dove la guida trova le linee, la camicia da dietro e il giro per arrivarci (se il build li ha trovati)
  const r = camicia.retro || {};
  // per lo zoom sul computer: la camicia a grandezza quadrupla, davanti e dietro, e il suo riquadro nel fotogramma
  const n = camicia.nitide;
  const nitide = n && n.davanti ? ` data-nitida="${esc(n.davanti)}"${n.dietro ? ` data-nitida-dietro="${esc(n.dietro)}"` : ''} data-nitida-riquadro="${esc(n.riquadro.join(' '))}"` : '';
  const datiGuida = camicia.guide
    ? ` data-guide="${esc(camicia.guide)}" data-ferma="${esc(camicia.ferma.computer2x || camicia.ferma.computer)}"${r.dietro ? ` data-dietro="${esc(r.dietro2x || r.dietro)}"` : ''}${r.giro && r.ritorno ? ` data-giro="${esc(r.giro)}" data-ritorno="${esc(r.ritorno)}"` : ''}${nitide}`
    : '';
  // l'immagine ferma c'è sempre, e per gli schermi fitti anche a grandezza doppia, se il file c'è
  const serie = (file, largo, doppio) => `${file} ${largo}w` + (doppio ? `, ${doppio} ${largo * 2}w` : '');
  const pr = S.prezzi;
  const g = S.grazie;
  const corpo = `<main>
<section class="configura" id="contenuto" tabindex="-1">
  <div class="configura__palco"${camicia.leggera ? ` data-leggera="${esc(camicia.leggera)}" data-leggera-v="${esc(camicia.leggeraV)}"` : ''}${datiGuida}${camicia.opzioni ? ` data-opzioni="${esc(camicia.opzioni)}"` : ''}${camicia.trame ? ` data-trame="${esc(camicia.trame)}"` : ''} data-cucitura="${esc(S.camicia.caricamento)}">
    <picture>
      <source media="(max-width: 599px)" srcset="${esc(serie(camicia.ferma.telefono, 750, camicia.ferma.telefono2x))}" sizes="100vw" width="750" height="1000">
      <img class="configura__ferma" src="${esc(camicia.ferma.computer)}" srcset="${esc(serie(camicia.ferma.computer, 1800, camicia.ferma.computer2x))}" sizes="(max-width: 959px) 112vh, max(180vh, 90vw)" width="1800" height="1000" alt="${esc(p.alt)}" fetchpriority="high" draggable="false">
    </picture>
    <p class="configura__invito" aria-hidden="true"><svg viewBox="0 0 26 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" focusable="false"><path d="M6 3 2 7l4 4M20 3l4 4-4 4M2 7h22"/></svg><span class="configura__invito-mouse">${esc(p.invito)}</span><span class="configura__invito-dito">${esc(p.invito_dito)}</span></p>
  </div>
  <form class="vetro configura__scheda" action="/api/ordine" method="post" aria-labelledby="configura-titolo" data-modulo data-configuratore>
    <h1 class="titolo configura__titolo" id="configura-titolo">${t(S.titolo)}</h1>
    <nav class="tappe" aria-label="${esc(S.navigazione)}">
      <p class="tappe__conta" data-conta data-testo="${esc(S.passo)}">${esc(S.passo.replace('{n}', 1).replace('{tot}', totale))}</p>
      <ol class="tappe__elenco">
        ${S.passi.map((x, i) => `<li class="tappe__voce"><a class="tappe__tasto" href="#passo-${esc(x.id)}" data-vai="${esc(x.id)}"><span class="tappe__barra" aria-hidden="true"></span><span class="tappe__nome"><span class="nascosto">${i + 1}. </span>${esc(x.nome)}</span></a></li>`).join('\n        ')}
      </ol>
    </nav>
    <div class="modulo__esca" aria-hidden="true"><label>Non compilare<input type="text" name="sito_web" tabindex="-1" autocomplete="off"></label></div>
    <div class="configura__passi" data-passi>
  ${passi(S, tessuti, risorse.turnstile, risorse.pagamentoProva)}
    </div>
    <div class="configura__grazie" data-grazie hidden>
      <span class="configura__grazie-segno" aria-hidden="true">${ICONA.spunta}</span>
      <h2 class="passo__titolo" tabindex="-1">${t(g.titolo)}</h2>
      <p class="passo__testo${risorse.pagamentoProva ? ' configura__grazie-prova' : ''}">${t(risorse.pagamentoProva ? S.pagamento.prova.grazie : g.testo)}</p>
      <a class="pillola pillola--chiara pillola--grande" href="${esc(g.link.href)}">${esc(g.link.testo)}</a>
    </div>
    <div class="configura__fondo" data-fondo>
      <p class="conto" data-conto>
        <span class="conto__camicia"><span data-conto-camicia>${esc(`${pr.base} €`)}</span> ${esc(pr.a_camicia)}</span>
        <span class="conto__totale"><span class="conto__etichetta">${esc(pr.totale)}</span> <strong data-conto-totale>${esc(`${pr.base} €`)}</strong></span>
      </p>
      <div class="configura__tasti">
        <button class="pillola pillola--vetro configura__indietro" type="button" data-indietro title="${esc(S.indietro)}" hidden>${ICONA.giu.replace('class="icona"', 'class="icona icona--indietro"')}<span>${esc(S.indietro)}</span></button>
        <button class="pillola pillola--chiara pillola--grande configura__avanti" type="submit" data-avanti data-continua="${esc(S.avanti)}" data-paga="${esc(S.pagamento.paga)}" data-attesa="${esc(S.pagamento.attesa)}">${esc(S.avanti)}</button>
      </div>
    </div>
  </form>
</section>
${finestraMisure(S.misure.come_misurare)}
${finestraTessuti(S.finestra_tessuti, tessuti)}
${finestraColori(S.finestra_colori, S.colori_filo)}
${c.domande ? `<div class="corpo configura__sotto">
  ${domande(c.domande, { gruppo: '' })}
</div>` : ''}
</main>`;
  return pagina({
    sito, meta: c.meta, percorso: '/camicie-su-misura/configuratore/', corpo, anteprima,
    risorse: { ...risorse, css: [...risorse.css, camicia.stile], js: [...risorse.js, camicia.script] },
    dati: [
      ...datiBase(sito, c.meta),
      {
        '@context': 'https://schema.org', '@type': 'Service', '@id': `${sito.dominio}/camicie-su-misura/configuratore/#servizio`,
        name: c.meta.servizio, serviceType: c.meta.servizio, description: c.meta.descrizione,
        url: `${sito.dominio}/camicie-su-misura/configuratore/`, provider: { '@id': `${sito.dominio}/#sede` },
      },
      // le domande sotto il riquadro, anche per Google
      ...(c.domande ? [{
        '@context': 'https://schema.org', '@type': 'FAQPage',
        mainEntity: c.domande.voci.map((v) => ({ '@type': 'Question', name: v.domanda, acceptedAnswer: { '@type': 'Answer', text: v.risposta } })),
      }] : []),
    ],
    classe: 'pagina-configuratore',
    briciole: [briciola(sito, '/camicie-su-misura/'), briciola(sito, '/camicie-su-misura/configuratore/', c.meta.briciola)],
  });
}
