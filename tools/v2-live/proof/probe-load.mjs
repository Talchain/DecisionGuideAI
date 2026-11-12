import { chromium } from '/Users/paulslee/olumi-work/worktrees/dgai-build/node_modules/.pnpm/playwright@1.57.0/node_modules/playwright/index.mjs'
const b = await chromium.launch(); const page = await (await b.newContext({ viewport: { width: 2000, height: 1200 } })).newPage()
const errs = []; page.on('pageerror', (e) => errs.push(`${e.message}\n${(e.stack || '').split('\n').slice(0, 3).join(' | ')}`)); page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
await page.goto(process.argv[2], { waitUntil: 'load' }); await page.waitForTimeout(3000)
console.log(JSON.stringify({ ready: await page.evaluate(() => document.body.className), errs: errs.slice(0, 4) }, null, 1)); await b.close()
