// Foto grande con il pannello della sede a destra. Il proprietario l'ha tolta dalla pagina iniziale (2026-11-15):
// sta nella pagina /dove-siamo/, con i testi di contenuti/it/dove-siamo.json e, dal 2026-11-19, la foto vera del negozio
// (public/foto/sede/); senza la foto resta il segnaposto.
import { esc, t, attesa, foto, icona } from './base.mjs';

function intesta(d) {
  return `<header class="intesta">
      <h2 class="titolo">${t(d.titolo)}</h2>
      ${d.testo ? `<p class="testo">${t(d.testo)}</p>` : ''}
    </header>`;
}

export function sedeConFoto(d, sito, { id = 'sede' } = {}) {
  const c = sito.contatti;
  const p = d.pannello;
  return `<section class="sezione" id="${esc(id)}">
    ${intesta(d)}
    <div class="grande grande--pannello">
      ${foto(d.immagine, sito.foto?.sede, { sizes: '(max-width: 809px) 100vw, calc(100vw - 72px)' }) || attesa({ nota: d.foto, tono: 'scuro', etichetta: sito.foto_in_arrivo })}
      <div class="vetro pannello-sede">
        <div class="vetro__testa">
          <h3 class="vetro__titolo">${esc(p.titolo)}</h3>
          <a class="chip chip--chiaro" href="${esc(c.mappa)}" target="_blank" rel="noopener">${esc(p.indicazioni)}${icona.freccia}</a>
        </div>
        <address class="pannello-sede__indirizzo">
          <span class="pannello-sede__via">${esc(c.via)}</span>
          <span>${esc(`${c.cap} ${c.citta} (${c.provincia})`)}</span>
        </address>
        <div class="pannello-sede__righe">
          <div><h4 class="vetro__sezione">${esc(p.orari_titolo)}</h4><p>${t(p.orari)}</p></div>
          <div><h4 class="vetro__sezione">${esc(p.contatti_titolo)}</h4>
            <p><a href="${esc(c.whatsapp_link)}" target="_blank" rel="noopener">WhatsApp ${esc(c.whatsapp)}</a></p>
            <p><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></p>
          </div>
        </div>
      </div>
    </div>
  </section>`;
}

