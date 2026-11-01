import { chromium } from '@playwright/test'
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
const reqs = []
page.on('request', (r) => { if (/bff|orchestrate/.test(r.url())) reqs.push(r.method() + ' ' + r.url().replace('http://127.0.0.1:5173', '')) })
page.on('console', (m) => { if (!/getNodesBounds|DevTools|\[vite\]/.test(m.text())) console.log('CONSOLE', m.type(), m.text().slice(0, 400)) })
await page.goto('http://127.0.0.1:5173/#/canvas?ai=core', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(3000)
// the previous run's scenario id is in the guest's localStorage of THAT context; start fresh and drive the short path
const BRIEF = 'Our team resolves 80 tickets a week. Each specialist adds about 20, somewhere between 10 and 30. Keep current staffing or add one specialist? We need at least 100 tickets a week. Total is today plus the specialists. Our team lead says a new hire may unsettle the team.'
await page.locator('textarea').first().fill(BRIEF); await page.keyboard.press('Enter')
await page.getByRole('button', { name: 'Confirm whole card' }).waitFor({ timeout: 60000 })
if (process.env.PARTIAL) {
  const ticks = page.getByRole('checkbox', { name: /That.s right/ })
  await ticks.nth(0).check(); await ticks.nth(1).check()
  await page.getByRole('button', { name: 'Confirm selected' }).click()
  await page.getByText(/only confirm the whole card/).first().waitFor({ timeout: 30000 })
  await page.waitForTimeout(1500)
}
await page.getByRole('button', { name: 'Confirm whole card' }).click()
await page.getByText(/What the Run found/).first().waitFor({ timeout: 60000 })
await page.waitForTimeout(4000)
const ask = page.locator('textarea').last()
await ask.fill('Add staff absence as a factor.'); await page.keyboard.press('Enter')
await page.getByRole('button', { name: /Looks right/ }).last().waitFor({ timeout: 60000 })
await page.getByRole('button', { name: /Looks right/ }).last().click()
await page.waitForTimeout(6000)
await page.getByText('Analysis', { exact: true }).first().click()
await page.waitForTimeout(6000)
const st = await page.evaluate(async () => {
  const c = await import('/src/canvas/stores/canonicalAnalysisViewStore.ts'); const k = await import('/src/canvas/store.ts')
  const cv = c.useCanonicalAnalysisViewStore.getState(); const ks = k.useCanvasStore.getState()
  return { viewScenario: cv.scenarioId, hasView: cv.view !== null, runId: cv.view?.run?.run_id, viewRunHash: cv.view?.run?.graph_hash_at_run, current: ks.currentScenarioId, lastHash: ks.lastServerGraphHash, hasReport: ks.results?.report != null, resultsKeys: ks.results ? Object.keys(ks.results).slice(0, 8) : null }
})
console.log('STORE', JSON.stringify(st))
const ids = await page.evaluate(() => [...document.querySelectorAll('[data-testid]')].map((e) => e.getAttribute('data-testid')).filter((t) => /outputs|analysis|results|view-only|pre-run/.test(t ?? '')))
console.log('testids:', [...new Set(ids)].join(', '))
console.log(reqs.filter((r) => /graph/.test(r)).length, 'graph reads')
await page.screenshot({ path: '/private/tmp/spike-shots/debug-analysis.png' })
await browser.close()
