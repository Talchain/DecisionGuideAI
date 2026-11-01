// Quick probe: open the canvas on the core lane, report console errors, screenshot.
import { chromium } from '@playwright/test'
const url = process.argv[2] ?? 'http://127.0.0.1:5173/#/canvas?ai=core'
const out = process.argv[3] ?? '/private/tmp/spike-shots/00-probe.png'
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errs = []
page.on('console', (m) => { if (['error'].includes(m.type())) errs.push(m.text().slice(0, 300)) })
page.on('pageerror', (e) => errs.push('PAGEERROR ' + String(e).slice(0, 300)))
page.on('requestfailed', (r) => errs.push('REQFAIL ' + r.url().slice(0, 120)))
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 })
await page.waitForTimeout(Number(process.env.WAIT ?? 20000))
await page.screenshot({ path: out })
console.log('title:', await page.title())
console.log(errs.slice(0, 15).join('\n'))
await browser.close()
