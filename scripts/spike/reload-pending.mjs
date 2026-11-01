// Honest edge: reload while a first model is still a PENDING proposal. What comes back from olumi-core through the graph read?
import { chromium } from '@playwright/test'
const BRIEF = 'Our team resolves 80 tickets a week. Each specialist adds about 20, somewhere between 10 and 30. Keep current staffing or add one specialist? We need at least 100 tickets a week. Total is today plus the specialists. Our team lead says a new hire may unsettle the team.'
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://127.0.0.1:5173/#/canvas?ai=core', { waitUntil: 'domcontentloaded' })
await page.locator('textarea').first().fill(BRIEF); await page.keyboard.press('Enter')
await page.getByRole('button', { name: 'Confirm whole card' }).waitFor({ timeout: 60000 })
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForTimeout(10000)
await page.screenshot({ path: '/private/tmp/spike-shots/09-reload-while-pending.png' })
console.log('card back after reload:', await page.getByRole('button', { name: 'Confirm whole card' }).count() > 0)
// "Not now" on the restored card -> olumi-core discard
await page.getByRole('button', { name: 'Not now' }).click()
await page.getByText(/left it as it was/).first().waitFor({ timeout: 30000 }).catch(() => {})
await page.waitForTimeout(1000)
await page.screenshot({ path: '/private/tmp/spike-shots/10-not-now-discard.png' })
console.log('after Not now:', (await page.locator('body').innerText()).match(/Okay, I have left it as it was\.?/)?.[0] ?? '(no discard reply)')
await browser.close()
