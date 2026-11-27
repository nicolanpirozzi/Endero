// Pagine /privacy/, /cookie/ e /condizioni-di-vendita/: testo semplice, ben leggibile. Privacy e cookie confermate dal
// consulente di Endero il 2026-11-20; le parti sugli ordini e le condizioni di vendita, scritte il 27, le ha approvate il 27.
// Le parti tra {{nome|…}} compaiono solo se ciò che descrivono è attivo sul sito (vedi la nota in legale.json).
import { t, tConLink } from '../parti/base.mjs';
import { pagina } from '../parti/telaio.mjs';

export default function paginaLegale({ sito, testi: l, quale, percorso = `/${quale}/`, risorse, anteprima }) {
  const p = l[quale];
  // l'informativa dice solo ciò che il sito fa davvero: l'antispam c'è se il build ha la sua chiave, le email
  // dei moduli quando sono attive
  const attivo = { antispam: Boolean(risorse.turnstile), email: Boolean(sito.email_moduli) };
  const solo = (x) => x.replace(/\{\{(\w+)\|([^}]*)\}\}/g, (_, cosa, testo) => {
    if (!(cosa in attivo)) throw new Error(`legale.json: condizione sconosciuta {{${cosa}|…}}`);
    return attivo[cosa] ? testo : '';
  });
  const sezioni = p.sezioni.map((s) => `<section>
      <h2>${t(s.titolo)}</h2>
      ${(s.paragrafi || []).map((x) => `<p>${tConLink(solo(x))}</p>`).join('\n      ')}
      ${s.elenco ? `<ul>${s.elenco.map((x) => `<li>${t(solo(x))}</li>`).join('')}</ul>` : ''}
    </section>`).join('\n    ');
  const corpo = `<main class="legale" id="contenuto" tabindex="-1">
  <header class="legale__testa">
    <h1 class="titolo">${t(p.titolo)}</h1>
    ${l.avviso ? `<p class="legale__avviso">${t(l.avviso)}</p>` : ''}
  </header>
  <div class="legale__testo">
    ${sezioni}
    <p class="legale__data">${t(p.aggiornamento || l.aggiornamento)}</p>
  </div>
</main>`;
  return pagina({ sito, meta: p.meta, percorso, corpo, risorse, anteprima, classe: 'pagina-chiara pagina-legale' });
}
