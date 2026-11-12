import { chromium } from '/Users/paulslee/olumi-work/worktrees/dgai-build/node_modules/.pnpm/playwright@1.57.0/node_modules/playwright/index.mjs'
const b = await chromium.launch(); const page = await (await b.newContext({ viewport: { width: 2000, height: 1200 } })).newPage()
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('response', (r) => { if (r.url().includes('/api/') || r.status() >= 300) errs.push(`${r.status()} ${new URL(r.url()).pathname}`) })
await page.goto(process.argv[2], { waitUntil: 'load' }); await page.waitForTimeout(2500)
console.log(JSON.stringify({ url: page.url(), live: await page.evaluate(() => ({ sid: window.OlumiLive?.sid, error: window.OlumiLive?.error, keys: Object.keys(window.VIEWS || {}) })), errs: errs.slice(0, 8) }, null, 1)); await b.close()
