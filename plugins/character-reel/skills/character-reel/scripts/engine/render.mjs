// node render.mjs <page.html> <out.mp4> [--still <t> <out.jpg>]
// Serves this folder, loads the page in Chrome, seeks frame by frame, pipes JPEGs to ffmpeg.
// Hardened 2026-10-15: loopback-only server, resolved-path containment, any page error or failed project asset
// fails the run, and the browser, server and ffmpeg are always cleaned up.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

// serve the folder above engine/ so pages can read ../episodes/* (override with REEL_ROOT)
const ROOT = process.env.REEL_ROOT ? path.resolve(process.env.REEL_ROOT) : path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const [page_, out, flag, stillT, stillOut] = process.argv.slice(2);
const FPS = 30;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.wav': 'audio/wav' };

const server = http.createServer((req, res) => {
  let file;
  try { file = path.resolve(ROOT, '.' + decodeURIComponent(req.url.split('?')[0])); } catch { res.writeHead(400); return res.end(); }
  const rel = path.relative(ROOT, file);
  if (rel.startsWith('..') || path.isAbsolute(rel) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const errors = [];
let browser, ff;
try {
  browser = await chromium.launch({
    // system Chrome renders the fur shaders on the GPU; set CHROME_PATH, or leave it unset to use Playwright's Chromium
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
    args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  page.on('console', (m) => console.log('[page]', m.text()));
  let failFast; const pageFailed = new Promise((_, rej) => { failFast = rej; });
  page.on('pageerror', (e) => { console.error('[pageerror]', e.message); errors.push(e.message); failFast(new Error(e.message)); });
  // a missing project asset is a broken render; third-party fetches (fonts) are reported but only fatal if the page breaks
  page.on('requestfailed', (r) => { if (r.url().includes(`127.0.0.1:${port}`)) errors.push(`request failed: ${r.url()}`); });
  page.on('response', (r) => { if (r.url().includes(`127.0.0.1:${port}`) && r.status() >= 400 && !r.url().endsWith('favicon.ico')) errors.push(`HTTP ${r.status()}: ${r.url()}`); });
  await page.goto(`http://127.0.0.1:${port}/engine/${page_.replace(/ /g, '%20')}`);
  // a page error before ready (e.g. a missing asset) fails now, not after the 90 s ready timeout
  await Promise.race([page.waitForFunction('window.ready === true', null, { timeout: 90000 }), pageFailed]);
  if (errors.length) throw new Error(errors.join('\n'));

  const grab = async (t) => {
    const b64 = await page.evaluate((t) => { window.seek(t); return document.querySelector('canvas').toDataURL('image/jpeg', 0.95).split(',')[1]; }, t);
    return Buffer.from(b64, 'base64');
  };

  if (flag === '--still') {
    fs.writeFileSync(stillOut, await grab(Number(stillT)));
  } else {
    const duration = await page.evaluate('window.DURATION');
    const frames = Math.round(duration * FPS);
    ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '16', '-preset', 'slow', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const closed = new Promise((r) => ff.on('close', r));
    const t0 = Date.now();
    for (let i = 0; i < frames; i++) {
      if (!ff.stdin.write(await grab(i / FPS))) await new Promise((r) => ff.stdin.once('drain', r));
      if (i % 30 === 0) process.stdout.write(`frame ${i}/${frames}\n`);
    }
    ff.stdin.end();
    const code = await closed; ff = null;
    if (code !== 0) throw new Error(`ffmpeg exited ${code}`);
    console.log(`rendered ${frames} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s -> ${out}`);
  }
  if (errors.length) throw new Error(errors.join('\n'));
} catch (e) {
  console.error('[render failed]', e.message);
  process.exitCode = 1;
} finally {
  if (ff) { ff.kill('SIGKILL'); await new Promise((r) => (ff.exitCode !== null || ff.signalCode ? r() : ff.on('close', r))); }
  if (browser) await browser.close().catch(() => {});
  server.close();
}
