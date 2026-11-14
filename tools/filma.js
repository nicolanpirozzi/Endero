// Registra un video di una pagina mentre scorre dall'inizio alla fine, per farla approvare.
//
//   node tools/filma.js <url> <video.mp4> <desktop|mobile> [secondi di scorrimento, 22]
//
// Il video non dipende dalla velocità del computer: il tempo della pagina è finto e avanza di un
// fotogramma alla volta (30 al secondo), poi i fotogrammi si montano con ffmpeg. Così le animazioni
// legate allo scorrimento si vedono come su un dispositivo vero, anche se la macchina è occupata.
const { chromium, devices } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const FPS = 30;
const PASSO = 1000 / FPS;
const ATTESA_INIZIO = 2.2;      // secondi fermi in cima (caricatore e prima immagine)
const ATTESA_FINE = 1.2;        // secondi fermi in fondo

// partenza e arrivo morbidi, velocità costante in mezzo
function percorso(u, bordo = 0.08) {
  const v = 1 / (1 - bordo);
  if (u < bordo) return (v * u * u) / (2 * bordo);
  if (u > 1 - bordo) return 1 - (v * (1 - u) * (1 - u)) / (2 * bordo);
  return v * (u - bordo / 2);
}

(async () => {
  const [url, uscita, modo = 'desktop', secondi = '22'] = process.argv.slice(2);
  if (!url || !uscita) throw new Error('uso: node tools/filma.js <url> <video.mp4> <desktop|mobile> [secondi]');
  const durata = Number(secondi);
  const cartella = fs.mkdtempSync(path.join(os.tmpdir(), 'filma-'));
  const browser = await chromium.launch();
  const contesto = await browser.newContext(modo === 'mobile'
    ? { ...devices['iPhone 14'] }
    : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const pagina = await contesto.newPage();
  const errori = [];
  pagina.on('pageerror', (e) => errori.push(e.message.slice(0, 200)));
  await pagina.clock.install({ time: new Date('2026-01-01T10:00:00') });
  await pagina.clock.pauseAt(new Date('2026-01-01T10:00:01'));      // da qui il tempo avanza solo con `runFor`
  // transizioni e animazioni CSS ferme: le porta avanti `fotogramma`, un passo alla volta
  const cdp = await contesto.newCDPSession(pagina);
  await cdp.send('Animation.enable');
  await cdp.send('Animation.setPlaybackRate', { playbackRate: 0 });
  await pagina.goto(url, { waitUntil: 'domcontentloaded' });

  let n = 0;
  async function fotogramma(y) {
    await pagina.evaluate(([y, dt]) => {
      if (y !== null) window.scrollTo(0, y);
      // anche le transizioni CSS seguono il tempo finto
      for (const a of document.getAnimations()) {
        if (a.playState === 'finished') continue;
        a.tempoFinto = (a.tempoFinto || 0) + dt;
        const fine = a.effect.getComputedTiming().endTime;
        if (a.tempoFinto >= fine) a.finish(); else a.currentTime = a.tempoFinto;
      }
    }, [y, PASSO]);
    await pagina.clock.runFor(PASSO);
    await pagina.screenshot({ path: path.join(cartella, `f-${String(n++).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 94 });
  }

  for (let i = 0; i < ATTESA_INIZIO * FPS; i++) await fotogramma(null);
  const fondo = await pagina.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const totale = Math.round(durata * FPS);
  for (let i = 1; i <= totale; i++) await fotogramma(Math.round(fondo * percorso(i / totale) * 10) / 10);
  for (let i = 0; i < ATTESA_FINE * FPS; i++) await fotogramma(null);
  await browser.close();

  const larghezza = modo === 'mobile' ? 780 : 1920;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(cartella, 'f-%05d.jpg'),
    '-vf', `scale=${larghezza}:-2:flags=lanczos`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', uscita]);
  fs.rmSync(cartella, { recursive: true, force: true });
  console.log(`${uscita}: ${n} fotogrammi, ${(n / FPS).toFixed(1)} s, ${(fs.statSync(uscita).size / 1e6).toFixed(1)} MB`);
  if (errori.length) console.log('ERRORI:', errori.slice(0, 5));
})().catch((e) => { console.error('FALLITO', e.message); process.exit(1); });
