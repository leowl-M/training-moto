// Dopo npm run build: node tests/deployment.cjs [percorso-di-playwright]
// Serve la vera build senza riscritture o trasformazioni, come un hosting statico.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require(process.argv[2] || 'playwright');
const root = process.env.MOTO_SITE_DIR ? path.resolve(process.env.MOTO_SITE_DIR) : path.resolve(__dirname, '../dist');
const output = path.join(__dirname, 'tmp');
fs.mkdirSync(output, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const prefixes = ['/', '/training-moto/'];

(async () => {
  assert.ok(fs.existsSync(path.join(root, 'index.html')), 'Esegui npm run build prima del test');
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    let relative = decodeURIComponent(url.pathname);
    if (relative.startsWith('/training-moto/')) relative = relative.slice('/training-moto/'.length);
    else relative = relative.slice(1);
    if (!relative || relative.endsWith('/')) relative += 'index.html';
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404); res.end('Not found'); return;
    }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const origin = `http://127.0.0.1:${server.address().port}`;
    for (const prefix of prefixes) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
      const errors = [], failedAssets = [], localAssets = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('response', response => {
        if (response.url().startsWith(origin) && /\.(js|css)(?:\?|$)/.test(response.url())) {
          localAssets.push(response.url());
          if (!response.ok()) failedAssets.push(`${response.status()} ${response.url()}`);
        }
      });
      page.on('requestfailed', request => {
        if (request.url().startsWith(origin)) failedAssets.push(request.url());
      });
      await page.goto(origin + prefix, { waitUntil: 'domcontentloaded' });
      await page.locator('#tl .tl-track').first().waitFor();
      assert.equal(await page.evaluate(() => typeof window.__moto), 'undefined', 'È la build di produzione');
      assert.ok(localAssets.some(url => url.endsWith('.js')) && localAssets.some(url => url.endsWith('.css')));
      assert.ok(localAssets.every(url => url.startsWith(origin + prefix + 'assets/')),
        'JavaScript e CSS vengono caricati dal percorso del sito');
      assert.ok(await page.evaluate(() => {
        const canvas = document.querySelector('#cv'), data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        for (let i = 3; i < data.length; i += 4) if (data[i] > 0) return true;
        return false;
      }), 'Anteprima renderizzata');
      const tracks = await page.locator('#tl .tl-track').count();
      await page.locator('#tlAdd').click();
      assert.equal(await page.locator('#tl .tl-track').count(), tracks + 1);
      await page.locator('#bUndo').click();
      assert.equal(await page.locator('#tl .tl-track').count(), tracks);
      await page.locator('#lTabs [data-l="fx"]').click();
      await page.locator('#q').fill('scacchiera');
      await page.locator('.tile[data-id="checker"]:visible').click();
      await page.locator('#bHelp').click();
      await page.locator('#helpClose').waitFor({ state: 'visible' });
      await page.keyboard.press('Escape');
      await page.locator('#helpClose').waitFor({ state: 'hidden' });
      await page.locator('#tc').click();
      await page.locator('#tc input').fill('0:01:15');
      await page.locator('#tc input').press('Enter');
      await page.waitForFunction(() => {
        const canvas = document.querySelector('#cv'), data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        let lightPixels = 0;
        for (let i = 0; i < data.length; i += 4) if (data[i] > 180 && data[i + 1] > 180 && data[i + 2] > 180 && data[i + 3]) lightPixels++;
        return lightPixels > 100;
      });
      const download = page.waitForEvent('download');
      await page.locator('#bExport').click();
      await page.locator('#expMenu [data-x="frame"]').click();
      const png = await download;
      assert.ok(png.suggestedFilename().endsWith('.png'));
      assert.equal(fs.readFileSync(await png.path()).subarray(1, 4).toString(), 'PNG');
      // Controlla anche il worker prodotto da Vite senza scaricare il modello Whisper.
      const workerFile = fs.readdirSync(path.join(root, 'assets')).find(file => /^worker-.*\.js$/.test(file));
      assert.ok(workerFile, 'Worker di trascrizione presente nella build');
      const worker = await page.request.get(origin + prefix + 'assets/' + workerFile);
      assert.equal(worker.status(), 200);
      await page.screenshot({ path: path.join(output, prefix === '/' ? 'production-root.png' : 'production-github-pages.png'), fullPage: true });
      assert.deepEqual(failedAssets, []);
      assert.deepEqual(errors, []);
      await page.close();
      console.log(`PASS production ${prefix}: asset, rendering, livelli, annulla, effetti, tastiera, PNG e worker`);
    }
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
