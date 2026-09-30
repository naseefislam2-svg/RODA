import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const output = resolve('docs/screenshots');
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 }, deviceScaleFactor: 1 });
await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' });
await page.screenshot({ path: resolve(output, 'roda-home.png'), fullPage: true });
const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
await mobile.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' });
await mobile.screenshot({ path: resolve(output, 'roda-mobile.png'), fullPage: true });
await mobile.close();

const results = readFileSync('artifacts/test-output.txt', 'utf8');
await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
html{background:#111611;color:#dce7a5;font-family:Consolas,monospace}body{margin:0;padding:44px}.shell{max-width:1180px;margin:auto;border:1px solid #3e4939;border-radius:12px;overflow:hidden;box-shadow:0 28px 90px #0008}.bar{background:#222a20;color:#f16b39;padding:14px 20px;font:700 13px Arial}.dots{letter-spacing:8px}.title{float:right;color:#a8af9f;letter-spacing:1px}pre{margin:0;padding:28px 32px;background:#141a14;white-space:pre-wrap;font-size:13px;line-height:1.62;min-height:620px}</style></head><body><div class="shell"><div class="bar"><span class="dots">● ● ●</span><span class="title">RODA / VERIFIED CHECKS</span></div><pre></pre></div></body></html>`);
await page.locator('pre').evaluate((node, text) => { node.textContent = text; }, results);
await page.screenshot({ path: resolve(output, 'test-output.png'), fullPage: true });
await browser.close();
