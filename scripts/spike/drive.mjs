// Drive the real DGAI canvas: brief -> reading card -> (approve) -> reply. Screenshots to /private/tmp/spike-shots/.
import { chromium } from '@playwright/test'
const BRIEF = 'Our team resolves 80 tickets a week. Each specialist adds about 20, somewhere between 10 and 30. Keep current staffing or add one specialist? We need at least 100 tickets a week. Total is today plus the specialists. Our team lead says a new hire may unsettle the team.'
const SHOTS = process.env.SHOTS ?? '/private/tmp/spike-shots'
const step = process.argv[2] ?? 'card'   // card | approve
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errs = []
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 250)) })
page.on('pageerror', (e) => errs.push('PAGEERROR ' + String(e).slice(0, 250)))
await page.goto('http://127.0.0.1:5173/#/canvas?ai=core', { waitUntil: 'domcontentloaded', timeout: 120000 })
const box = page.locator('textarea').first()
await box.waitFor({ timeout: 60000 })
await box.fill(BRIEF)
await page.waitForTimeout(500)
await page.keyboard.press('Enter')
await page.waitForTimeout(Number(process.env.WAIT ?? 15000))
await page.screenshot({ path: `${SHOTS}/01-reading-card.png` })
// expand the folds so every record row is on screen, then capture the card alone
for (const name of [/Also from your brief/, /^9$/]) { const b = page.getByRole('button', { name }).first(); if (await b.count()) await b.click().catch(() => {}) }
await page.waitForTimeout(800)
await page.screenshot({ path: `${SHOTS}/02-reading-card-expanded.png` })
console.log('card text:', (await page.locator('body').innerText()).slice(0, 2500))
if (step === 'approve') {
  await page.getByRole('button', { name: 'Confirm whole card' }).click()
  await page.waitForTimeout(Number(process.env.WAIT ?? 12000))
  await page.screenshot({ path: `${SHOTS}/03-after-approve.png` })
  console.log('AFTER APPROVE:', (await page.locator('body').innerText()).slice(0, 3500))
}
console.log('errors:', errs.slice(0, 12).join('\n'))
await browser.close()
