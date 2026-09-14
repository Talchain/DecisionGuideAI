/**
 * THE EVIDENCE PATH, PHOTOGRAPHED — the scenario #1484 actually fixed.
 *
 * ⚠ The four `coachingLineLook` captures do NOT exercise this. On the walkA
 * capture all three TOP-LEVEL points are `v5_review_card`; every `v5_evidence`
 * block sits behind "Show N more", which is precisely where the reported
 * screenshot found them rendering as full bordered walls. Photographing the
 * top three and calling it evidence coverage is the same class of error this
 * lane keeps making: labelling a capture by what you expected to be in it.
 */
import { test, expect } from '@playwright/test'
import { openCanvas, preparePage } from '../visual/harness'

/*
 * ⚠ THE SPECIFIER IS PASSED AS AN ARGUMENT, not closed over. `/e2e/…` is a VITE
 * SERVER URL, not a TS module path, so inlining it as a literal makes `tsc` try
 * to resolve it and fail (TS2307). But hoisting it to a module constant is ALSO
 * wrong: `page.evaluate` runs in the BROWSER and captures no Node scope. Passing
 * it in is the only form that satisfies both.
 */
const PROBE = '/e2e/geometry/coachingLineProbe.ts'

const OUT = process.env.SHOT_DIR ?? 'test-results/look'
test.use({ launchOptions: { executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' } })

test('LOOK E — evidence blocks revealed behind "Show more"', async ({ page }) => {
  await preparePage(page, { width: 1440, height: 900 })
  await openCanvas(page)

  const inventory = await page.evaluate(async (probe: string) => {
    const mod = (await import(/* @vite-ignore */ probe)) as {
      measureCoachingDensity: (c: boolean, keep?: boolean) => Promise<unknown>
    }
    await mod.measureCoachingDensity(true, true)
    const host = document.getElementById('measure-host')!
    // Click the real "Show N more" control, by its rendered text.
    const btn = [...host.querySelectorAll('button')].find((b) =>
      /Show \d+ more/.test(b.textContent ?? ''),
    )
    btn?.click()
    await new Promise((r) => setTimeout(r, 500))
    const lines = [...host.querySelectorAll('details[data-testid^="coaching-line-"]')]
    return lines.map((el, i) => {
      const sum = el.querySelector('summary')
      const block = el.querySelector('[data-block-id]') as HTMLElement | null
      return {
        i,
        text: sum?.textContent?.trim().slice(0, 50),
        glyph: sum?.querySelector('svg')?.getAttribute('class'),
        kind: block?.getAttribute('data-testid') ?? null,
        severity: block?.getAttribute('data-severity') ?? null,
      }
    })
  }, PROBE)
  // eslint-disable-next-line no-console
  console.log('EVJSON ' + JSON.stringify(inventory, null, 1))

  await page.locator('#measure-host').screenshot({ path: `${OUT}/E-show-more-expanded.png` })

  // Open the first EVIDENCE line specifically — located by kind, not by index.
  const evIdx = inventory.findIndex((l) => l.kind === 'v5-evidence')
  expect(evIdx, 'the capture must actually contain an evidence block').toBeGreaterThanOrEqual(0)
  await page.evaluate(async (n) => {
    const host = document.getElementById('measure-host')!
    const el = [...host.querySelectorAll('details[data-testid^="coaching-line-"]')][
      n
    ] as HTMLDetailsElement
    el.open = true
    el.scrollIntoView({ block: 'center' })
    await new Promise((r) => setTimeout(r, 400))
  }, evIdx)
  await page.locator('#measure-host').screenshot({ path: `${OUT}/F-evidence-line-open.png` })
})
