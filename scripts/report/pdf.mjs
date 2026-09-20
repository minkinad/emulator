import { createServer } from 'node:http';
import { readFile, mkdir, copyFile, access } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import './check.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const site = resolve(root, 'website/.vitepress/dist');
await access(resolve(site, 'report/report.html'));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json' };
// Только локальная сборка; порт выбирает ОС, сервер закрывается после экспорта.
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (!url.pathname.startsWith('/emulator/')) { response.writeHead(404).end(); return; }
    const path = resolve(site, decodeURIComponent(url.pathname.slice('/emulator/'.length)));
    if (!path.startsWith(site + sep)) { response.writeHead(403).end(); return; }
    const content = await readFile(path);
    response.writeHead(200, { 'Content-Type': types[extname(path)] ?? 'application/octet-stream' }).end(content);
  } catch { response.writeHead(404).end(); }
});
let browser;
try {
  await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
  const port = server.address().port;
  browser = await chromium.launch(process.env.REPORT_CHROMIUM_PATH ? { executablePath: process.env.REPORT_CHROMIUM_PATH } : {});
  const page = await browser.newPage({ colorScheme: 'light' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  await page.goto(`http://127.0.0.1:${port}/emulator/report/report.html`, { waitUntil: 'networkidle' });
  await page.locator('.report-page .vp-doc h1').waitFor();
  await page.evaluate(async () => {
    document.documentElement.classList.remove('dark');
    await document.fonts.ready;
    // Ссылки PDF должны вести на опубликованные страницы, а не временный сервер.
    for (const link of document.querySelectorAll('a[href]')) {
      const url = new URL(link.href);
      if (url.origin === location.origin && !link.classList.contains('header-anchor')) {
        link.href = `https://minkinad.github.io${url.pathname}${url.search}${url.hash}`;
      }
    }
  });
  if (errors.length) throw new Error(errors.join('\n'));
  const output = resolve(root, 'dist/report/emulator-report.pdf');
  await mkdir(resolve(root, 'dist/report'), { recursive: true });
  await page.pdf({
    path: output, format: 'A4', printBackground: true, preferCSSPageSize: true,
    displayHeaderFooter: true, headerTemplate: '<span></span>',
    footerTemplate: '<div style="width:100%;text-align:center;font:9px Arial;color:#666"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
    margin: { top: '18mm', right: '18mm', bottom: '20mm', left: '18mm' },
    tagged: true, outline: true,
  });
  await mkdir(resolve(site, 'reports'), { recursive: true });
  await copyFile(output, resolve(site, 'reports/emulator-report.pdf'));
  console.log(`PDF без титульного листа: ${output}\nКопия добавлена в артефакт Pages: /emulator/reports/emulator-report.pdf`);
} finally {
  await browser?.close();
  await new Promise(done => server.close(done));
}
