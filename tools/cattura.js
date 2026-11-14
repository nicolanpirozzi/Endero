// Fotografa una pagina a schermate mentre scorre. Uso: node tools/cattura.js <url> <cartella-uscita> <desktop|mobile>
const { chromium, devices } = require('playwright');

(async () => {
  const [url, out, mode] = process.argv.slice(2);
  const browser = await chromium.launch();
  const ctx = await browser.newContext(
    mode === 'mobile'
      ? { ...devices['iPhone 14'] }
      : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }
  );
  const page = await ctx.newPage();
  const failed = [];
  page.on('requestfailed', r => failed.push(r.url().slice(0, 120) + ' :: ' + (r.failure() || {}).errorText));
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(6000);

  const vh = page.viewportSize().height;
  let total = await page.evaluate(() => document.documentElement.scrollHeight);
  let i = 0;
  for (let y = 0; y < total && i < 40; y += Math.round(vh * 0.9), i++) {
    await page.evaluate(v => window.scrollTo(0, v), y);
    await page.waitForTimeout(1300);
    await page.screenshot({ path: `${out}/${mode}-${String(i).padStart(2, '0')}.png` });
    total = await page.evaluate(() => document.documentElement.scrollHeight);
  }

  const info = await page.evaluate(() => {
    const seen = new Map();
    const fonts = new Map();
    const colors = new Map();
    const bgs = new Map();
    for (const el of document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,a,button,span,li')) {
      const t = (el.innerText || '').trim();
      if (!t || el.children.length > 3) continue;
      const cs = getComputedStyle(el);
      const key = `${cs.fontFamily.split(',')[0]} | ${cs.fontWeight} | ${cs.fontSize} | ls ${cs.letterSpacing} | lh ${cs.lineHeight} | ${cs.textTransform}`;
      fonts.set(key, (fonts.get(key) || 0) + 1);
      colors.set(cs.color, (colors.get(cs.color) || 0) + 1);
      if (!seen.has(t) && t.length < 400) seen.set(t, el.tagName);
    }
    for (const el of document.querySelectorAll('body, body *')) {
      const b = getComputedStyle(el).backgroundColor;
      if (b && b !== 'rgba(0, 0, 0, 0)') bgs.set(b, (bgs.get(b) || 0) + 1);
    }
    const top = m => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14);
    return {
      height: document.documentElement.scrollHeight,
      fonts: top(fonts),
      colors: top(colors),
      backgrounds: top(bgs),
      videos: [...document.querySelectorAll('video')].map(v => (v.currentSrc || v.src).slice(0, 110)),
      images: document.querySelectorAll('img').length,
      text: [...seen.entries()].map(([t, tag]) => `${tag}: ${t.replace(/\s+/g, ' ')}`),
    };
  });
  require('fs').writeFileSync(`${out}/${mode}-info.json`, JSON.stringify({ info, failed: failed.slice(0, 20) }, null, 1));
  console.log(mode, 'altezza', info.height, 'schermate', i, 'richieste fallite', failed.length);
  await browser.close();
})().catch(e => { console.error('ERRORE', e.message); process.exit(1); });
