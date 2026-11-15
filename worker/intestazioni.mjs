// Intestazioni di sicurezza del sito, in un posto solo: il build le scrive in dist/_headers (sito vero),
// il Worker dell'anteprima le aggiunge a ogni pagina.
//
// La Content-Security-Policy ammette un solo script in linea: quello di src/parti/telaio.mjs che mette la classe "js"
// su <html>. Se quello script cambia, il build si ferma e chiede di aggiornare l'impronta qui sotto.
export const IMPRONTA_SCRIPT_IN_LINEA = 'sha256-Du+OJKJSbdUgz5nrHeWWINvez6XKDDU/tyj/5c2uvwo=';

export const CSP = [
  "default-src 'self'",
  // 'wasm-unsafe-eval': il file della camicia 3D si decomprime con un piccolo modulo WebAssembly dentro three.js.
  // Permette solo quello: il codice JavaScript scritto in una stringa resta vietato.
  `script-src 'self' '${IMPRONTA_SCRIPT_IN_LINEA}' 'wasm-unsafe-eval' https://challenges.cloudflare.com`,   // Turnstile, quando ci saranno le chiavi
  "style-src 'self'",
  "style-src-attr 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  'frame-src https://challenges.cloudflare.com',
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

export const INTESTAZIONI = {
  'Content-Security-Policy': CSP,
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};
