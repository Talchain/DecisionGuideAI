// Drive the real DGAI canvas against olumi-core (through the shim): brief -> reading card -> partial tick -> whole approve ->
// coach reply -> typed correction -> second card -> approve -> Analysis tab -> reload. Screenshots land in /private/tmp/spike-shots/.
import { chromium } from '@playwright/test'
const BRIEF = 'Our team resolves 80 tickets a week. Each specialist adds about 20, somewhere between 10 and 30. Keep current staffing or add one specialist? We need at least 100 tickets a week. Total is today plus the specialists. Our team lead says a new hire may unsettle the team.'
const SHOTS = process.env.SHOTS ?? '/private/tmp/spike-shots'
const URL = 'http://127.0.0.1:5173/#/canvas?ai=core'
const stage = process.argv[2] ?? 'journey'
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errs = []
page.on('console', (m) => { if (m.type() === 'error' && !/404 \(Not Found\)/.test(m.text())) errs.push(m.text().slice(0, 250)) })
page.on('pageerror', (e) => errs.push('PAGEERROR ' + String(e).slice(0, 250)))
const shot = (n) => page.screenshot({ path: `${SHOTS}/${n}.png` })
const text = async () => (await page.locator('body').innerText())
const say = (k, v) => console.log(`\n=== ${k}\n${v}`)

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 })
const box = page.locator('textarea').first()
await box.waitFor({ timeout: 60000 })
await box.fill(BRIEF)
await page.keyboard.press('Enter')
await page.getByRole('button', { name: 'Confirm whole card' }).waitFor({ timeout: 60000 })
await page.waitForTimeout(1500)
await shot('01-reading-card')
for (const name of [/Also from your brief/, /^9$/]) { const b = page.getByRole('button', { name }).first(); if (await b.count()) await b.click().catch(() => {}) }
await page.waitForTimeout(600)
await shot('02-reading-card-expanded')
say('CARD', (await text()).split('Your situation as I understood it')[1]?.slice(0, 900) ?? '(no card)')

if (stage !== 'card') {
  // per-item: tick two rows and press "Confirm selected" -> olumi-core has no subset approve
  const ticks = page.getByRole('checkbox', { name: /That.s right/ })
  await ticks.nth(0).check(); await ticks.nth(1).check()
  await page.getByRole('button', { name: 'Confirm selected' }).click()
  await page.getByText(/only confirm the whole card/).first().waitFor({ timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(800)
  await shot('03-confirm-selected-refused')
  say('CONFIRM SELECTED', (await text()).match(/I can only confirm[^\n]*/)?.[0] ?? '(no refusal text)')

  // whole proposal: approve -> olumi-core creates version 1, Run + coach come back
  await page.getByRole('button', { name: 'Confirm whole card' }).click()
  await page.getByText(/What the Run found/).first().waitFor({ timeout: 60000 })
  await page.waitForTimeout(1500)
  await shot('04-after-approve-coach-reply')
  say('AFTER APPROVE', (await text()).split('Here is your situation as I understood it')[1]?.slice(0, 1600) ?? '')

  // a typed correction -> olumi-core POST /messages -> a new proposal (scripted AI adds staff absence)
  const ask = page.locator('textarea').last()
  await ask.fill('Add staff absence as a factor.')
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: /Looks right|Confirm whole card/ }).last().waitFor({ timeout: 60000 })
  await page.waitForTimeout(1500)
  await shot('05-correction-card')
  say('CORRECTION CARD', (await text()).split('Add staff absence as a factor.')[1]?.slice(0, 700) ?? '')
  await page.getByRole('button', { name: /Looks right|Confirm whole card/ }).last().click()
  await page.getByText(/Saved|Gather|gather/).first().waitFor({ timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(2500)
  await shot('06-after-second-approve')
  say('AFTER 2ND APPROVE', (await text()).slice(-1200))

  // the results surface: Analysis tab
  await page.getByText('Analysis', { exact: true }).first().click()
  await page.getByTestId('analysis-view-only-chances').waitFor({ timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(1500)
  await shot('07-analysis-tab')
  say('ANALYSIS TAB', await page.getByTestId('analysis-view-only-chances').innerText().catch(() => '(no view-only chances block)'))

  // reload: does the saved model come back from olumi-core through the graph read?
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(8000)
  await page.getByText('Analysis', { exact: true }).first().click().catch(() => {})
  await page.getByTestId('analysis-view-only-chances').waitFor({ timeout: 30000 }).catch(() => {})
  await shot('08-after-reload')
  say('AFTER RELOAD (saved model + Run read back from olumi-core)', (await page.getByTestId('analysis-view-only-chances').innerText().catch(() => '(no chances block)')).slice(0, 600))
}
say('CONSOLE ERRORS (non-404)', errs.slice(0, 12).join('\n') || 'none')
await browser.close()
