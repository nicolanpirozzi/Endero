// Registra un video della camicia 3D del configuratore: riposo, mouse che la sfiora, trascinamento per girarla.
//   node tools/filma-camicia.js http://127.0.0.1:8766/camicie-su-misura/configuratore/ <cartella> [computer|telefono]
// Nell'ambiente di lavoro il 3D gira sul processore: il tempo avanza a mano, un fotogramma alla volta
// (la pagina si apre con ?manuale), e poi ffmpeg monta il video. Serve il sito in locale: `npm run anteprima`.
const { chromium, devices } = require('playwright');
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
(async () => {
  const [indirizzo, out, modo = 'computer'] = process.argv.slice(2);
  if (!indirizzo || !out) { console.error('uso: node tools/filma-camicia.js <indirizzo della pagina> <cartella> [computer|telefono]'); process.exit(2); }
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const tel = modo === 'telefono';
  const ctx = await b.newContext(tel ? { ...devices['iPhone 14'], deviceScaleFactor: 2 } : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('errore:', e.message.slice(0, 200)));
  await p.goto(indirizzo + (indirizzo.includes('?') ? '&' : '?') + 'manuale', { waitUntil: 'load' });
  await p.waitForFunction(() => document.querySelector('[data-camicia]')?.dataset.stato === 'viva' && window.__camicia, null, { timeout: 120000 });
  await p.waitForTimeout(800);
  const cdp = await ctx.newCDPSession(p);
  const dir = path.join(out, 'fot-' + modo); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const r = await p.evaluate(() => { const q = document.querySelector('.camicia__tela').getBoundingClientRect(); return { x: q.left, y: q.top, w: q.width, h: q.height }; });
  const fps = 30; let n = 0;
  const liscio = (t) => t * t * (3 - 2 * t);
  const scatta = async () => { const s = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 88 }); fs.writeFileSync(path.join(dir, String(n++).padStart(4, '0') + '.jpg'), Buffer.from(s.data, 'base64')); };
  const avanza = () => p.evaluate((dt) => window.__camicia.avanza(dt), 1 / fps);
  const tocco = (tipo, x, y) => cdp.send('Input.dispatchTouchEvent', { type: tipo, touchPoints: tipo === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  // punto della tela in frazioni (0..1) -> pixel della pagina
  const px = (fx, fy) => [r.x + r.w * fx, r.y + r.h * fy];
  const scena = async (secondi, gesto) => { const tot = Math.round(secondi * fps); for (let i = 0; i < tot; i++) { if (gesto) await gesto(i / (tot - 1), i, tot); await avanza(); await scatta(); } };

  await scena(1.6);
  if (!tel) {
    // il mouse entra da sinistra, attraversa il petto, torna indietro più in basso ed esce
    await scena(1.5, async (t) => { const [x, y] = px(0.12 + 0.72 * liscio(t), 0.40 - 0.05 * Math.sin(t * 3.14)); await p.mouse.move(x, y); });
    await scena(0.5);
    await scena(1.3, async (t) => { const [x, y] = px(0.84 - 0.6 * liscio(t), 0.56 + 0.06 * Math.sin(t * 3.14)); await p.mouse.move(x, y); });
    await scena(1.4, async (t, i) => { if (i === 0) await p.mouse.move(...px(0.5, 1.2)); });
    // la afferra e la gira fino a vederla da dietro
    await p.mouse.move(...px(0.4, 0.5)); await p.mouse.down();
    await scena(1.8, async (t) => { await p.mouse.move(...px(0.4 + 0.38 * liscio(t), 0.5 - 0.03 * Math.sin(t * 3.14))); });
    await p.mouse.up();
    await scena(1.6);
    await p.mouse.move(...px(0.7, 0.5)); await p.mouse.down();
    await scena(1.4, async (t) => { await p.mouse.move(...px(0.7 - 0.36 * liscio(t), 0.5)); });
    await p.mouse.up();
    await scena(1.6);
  } else {
    // col dito: un tocco, poi la gira e la riporta
    let [x0, y0] = px(0.3, 0.5);
    await tocco('touchStart', x0, y0);
    await scena(1.6, async (t) => { const [x, y] = px(0.3 + 0.5 * liscio(t), 0.5); await tocco('touchMove', x, y); });
    await tocco('touchEnd');
    await scena(1.5);
    [x0, y0] = px(0.8, 0.45);
    await tocco('touchStart', x0, y0);
    await scena(1.4, async (t) => { const [x, y] = px(0.8 - 0.48 * liscio(t), 0.45); await tocco('touchMove', x, y); });
    await tocco('touchEnd');
    await scena(1.8);
  }
  await b.close();
  const video = path.join(out, `camicia-${modo}.mp4`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(dir, '%04d.jpg'), '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', video]);
  console.log('fotogrammi', n, '→', video, Math.round(fs.statSync(video).size / 1024), 'KB');
})().catch(e => { console.error('FALLITO', e.message); process.exit(1); });
