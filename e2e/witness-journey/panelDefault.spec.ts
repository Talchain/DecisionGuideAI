import { test, expect } from '@playwright/test'
const EXAMPLE = /Usage-Based Billing System Approach/i
async function pinnedOrigin() {
  const j = (await (await fetch('https://staging--olumi.netlify.app/version.json')).json()) as { commit: string; deploy_url: string }
  return { origin: j.deploy_url, build: j.commit.slice(0, 8) }
}
test('is the honesty channel visible by default', async ({ page }) => {
  const { origin, build } = await pinnedOrigin()
  console.log(`[PANEL] build=${build}`)
  await page.goto(origin, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /continue without an account/i }).click()
  const card = page.getByRole('button', { name: EXAMPLE })
  await card.waitFor({ state: 'visible', timeout: 45_000 }); await card.click()
  await page.waitForTimeout(12_000)

  const restore = page.getByRole('button', { name: /restore olumi/i })
  const restoreCount = await restore.count()
  const restoreVisible = restoreCount > 0 ? await restore.first().isVisible() : false
  // CONTRAST CONTROL: a button we know exists and is visible, so a false
  // "not visible" reading is detectable.
  const fit = page.getByRole('button', { name: /fit to view/i })
  const fitVisible = (await fit.count()) > 0 ? await fit.first().isVisible() : false

  // Is any transcript/message surface rendered at all?
  const surfaces = await page.evaluate(() => {
    const byText = (re: RegExp) => Array.from(document.querySelectorAll('button,[role="button"]'))
      .map((e) => (e.textContent ?? '').replace(/\s+/g, ' ').trim())
      .filter((t) => re.test(t))
    return {
      restoreLike: byText(/restore|open olumi|ask olumi/i).slice(0, 6),
      logRegions: Array.from(document.querySelectorAll('[role="log"],[aria-live]')).length,
      // A synthetic assistant notice would land in a transcript; is one mounted?
      transcriptNodes: document.querySelectorAll('[data-testid*="message"],[class*="transcript"],[class*="Transcript"]').length,
    }
  })
  console.log(`[PANEL] restoreOlumiPresent=${restoreCount > 0} visible=${restoreVisible}  (CONTROL fitToView visible=${fitVisible})`)
  console.log(`[PANEL] surfaces=${JSON.stringify(surfaces)}`)
  expect(fitVisible, 'CONTROL: fit-to-view not visible — the probe cannot see the toolbar at all').toBe(true)
})
