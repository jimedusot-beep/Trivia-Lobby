// Manual historical evidence capture, intentionally outside the CI browser suite.
// Start the guest server first. Requires a full checkout containing the pinned revision.
import { execFileSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';
const revision = '55414cd7d3f8cc903897f5d40f3d0e914aea579b';
const files = ['game-catalog.js', 'game-catalog.css', 'lobby-theme.css'];
const source = new Map(files.map(file => [file, execFileSync('git', ['show', `${revision}:examples/party-engine/public/${file}`], {encoding:'utf8'})]));
const browser = await chromium.launch(process.env.CHROMIUM_EXECUTABLE_PATH ? {
  executablePath: process.env.CHROMIUM_EXECUTABLE_PATH,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
} : {});
try {
  const page = await browser.newPage({viewport:{width:1920,height:1080}});
  for (const [file,body] of source) await page.route(`**/${file}`, route => route.fulfill({body,contentType:file.endsWith('.js')?'text/javascript':'text/css'}));
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:4317');
  await page.locator('.pick-game-card').first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.locator('#pick-games').scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0,document.querySelector('#pick-games').offsetTop-20));
  await mkdir('test-results',{recursive:true});
  await page.screenshot({path:'test-results/gx2-catalog-before.png',scale:'css'});
} finally { await browser.close(); }
