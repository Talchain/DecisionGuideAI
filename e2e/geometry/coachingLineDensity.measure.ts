/**
 * COACHING-LINE DENSITY — a MEASUREMENT instrument, not a gate.
 *
 * #1450 claimed the turn's coaching "reads as a list, not a wall". That is a
 * claim about RENDERED GEOMETRY, and the jsdom specs behind it can only make
 * mount/trigger/count claims — `toBeVisible()` in jsdom reads style, not
 * layout. This file is where the geometry claim is actually settled, per the
 * convention `threadAutoScroll.measure.ts` states: every visibility claim in a
 * PR body comes from here.
 *
 * Both arms render the SAME dated live capture through the SAME components at
 * the SAME dock width. The only difference is the flag, so the flag-off arm is
 * the positive control: if the two arms report the same geometry, this
 * instrument is measuring nothing and its numbers are worthless.
 *
 * Run deliberately (it is in no gate):
 *   pnpm exec playwright test -c playwright.geometry.config.ts \
 *     e2e/geometry/coachingLineDensity.measure.ts
 *
 * Output: one `COACHJSON {...}` line per arm on stdout.
 */
import { test } from '@playwright/test'
import { openCanvas, preparePage } from '../visual/harness'

const VP = { width: 1440, height: 900 }

for (const arm of [
  { name: 'flag OFF — full cards (today, and the positive control)', compact: false },
  { name: 'flag ON — compact lines (#1450)', compact: true },
]) {
  test(`COACH density — ${arm.name}`, async ({ page }, _testInfo) => {
    await preparePage(page, VP)
    await openCanvas(page)

    const out = await page.evaluate(async (compact) => {
      const path = '/e2e/geometry/coachingLineProbe.ts'
      const mod = (await import(/* @vite-ignore */ path)) as {
        measureCoachingDensity: (c: boolean) => Promise<unknown>
      }
      return mod.measureCoachingDensity(compact)
    }, arm.compact)

    // eslint-disable-next-line no-console
    console.log(`COACHJSON ${JSON.stringify({ compact: arm.compact, ...(out as object) })}`)
  })
}

/**
 * THE PHOTOGRAPH. `getComputedStyle(summary, '::-webkit-details-marker')`
 * reported a marker on all three lines, and that reading cannot be trusted:
 * the pseudo is legacy, modern Chromium draws `::marker`, and a query for a
 * pseudo-element the engine does not implement answers about the element. The
 * only honest way to know whether a disclosure triangle is drawn is to look.
 *
 * Also the on-screen witness for #1450 generally — jsdom cannot supply one.
 */
test('COACH photo — collapsed, and one line opened', async ({ page }, testInfo) => {
  await preparePage(page, VP)
  await openCanvas(page)

  await page.evaluate(async () => {
    const path = '/e2e/geometry/coachingLineProbe.ts'
    const mod = (await import(/* @vite-ignore */ path)) as {
      measureCoachingDensity: (c: boolean, keep: boolean) => Promise<unknown>
    }
    await mod.measureCoachingDensity(true, true)
  })

  const host = page.locator('#measure-host')
  await host.screenshot({ path: testInfo.outputPath('coaching-lines-collapsed.png') })

  await page.evaluate(async () => {
    const path = '/e2e/geometry/coachingLineProbe.ts'
    const mod = (await import(/* @vite-ignore */ path)) as { openLine: (n: number) => Promise<boolean> }
    await mod.openLine(1)
  })
  await host.screenshot({ path: testInfo.outputPath('coaching-lines-one-open.png') })

  // eslint-disable-next-line no-console
  console.log(`COACHPHOTO ${testInfo.outputPath('coaching-lines-collapsed.png')}`)
  // eslint-disable-next-line no-console
  console.log(`COACHPHOTO ${testInfo.outputPath('coaching-lines-one-open.png')}`)
})
