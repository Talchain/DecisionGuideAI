/**
 * COACHING-LINE LOOK — photographs, not numbers.
 *
 * ⚠ WHY THIS EXISTS. Every visual claim in the #1450/#1474/#1484 lane was made
 * from getBoundingClientRect and jsdom class assertions. NOTHING in this repo
 * had ever LOOKED at a rendered assistant turn: `e2e/visual/` contains zero
 * occurrences of assistant/coaching/v5_evidence/review_card, so the visual
 * suite cannot reach this surface at all. Both defects in that lane were caught
 * by a human's screenshot rather than by CI.
 *
 * This captures the same real ChatThread the density probe mounts — real
 * components, real stylesheet, dated live capture, real 416px dock — as IMAGES,
 * so layout and tone can be adjudicated by eye instead of inferred.
 *
 * ⚠ THESE ARE NOT PIXEL REFERENCES AND MUST NEVER BE PROMOTED TO ANY. The
 * pinned Playwright build ships no browser in this image, so they launch the
 * installed 1194 chrome by path — a different renderer build, and
 * `playwright.visual.config.ts` records a measured 6.157% divergence from a
 * single font substitution.
 *
 * Run deliberately (in no gate; asserts nothing):
 *   pnpm exec playwright test -c playwright.geometry.config.ts \
 *     e2e/geometry/coachingLineLook.measure.ts
 */
import { test, type Page } from '@playwright/test'
import { openCanvas, preparePage } from '../visual/harness'

const VP = { width: 1440, height: 900 }
const OUT = process.env.SHOT_DIR ?? 'test-results/look'

/*
 * ⚠ THE SPECIFIER IS PASSED AS AN ARGUMENT, not closed over. `/e2e/…` is a VITE
 * SERVER URL, not a TS module path, so inlining it as a literal makes `tsc` try
 * to resolve it and fail (TS2307) — the typecheck ratchet caught exactly that.
 * But hoisting it to a module constant is ALSO wrong and was the first fix I
 * tried: `page.evaluate` runs in the BROWSER and captures no Node scope, so the
 * constant is undefined there and every cell fails at runtime. Passing it in is
 * the only form that satisfies both.
 */
const PROBE = '/e2e/geometry/coachingLineProbe.ts'

const mount = (page: Page, compact: boolean) =>
  page.evaluate(
    async ([probe, c]) => {
      const mod = (await import(/* @vite-ignore */ probe as string)) as {
        measureCoachingDensity: (c: boolean, keep?: boolean) => Promise<unknown>
      }
      return mod.measureCoachingDensity(c as boolean, true)
    },
    [PROBE, compact] as const,
  )

const open = (page: Page, n: number) =>
  page.evaluate(
    async ([probe, i]) => {
      const mod = (await import(/* @vite-ignore */ probe as string)) as {
        openLine: (n: number) => Promise<boolean>
      }
      return mod.openLine(i as number)
    },
    [PROBE, n] as const,
  )

const shoot = (page: Page, name: string) =>
  page.locator('#measure-host').screenshot({ path: `${OUT}/${name}.png` })

test.use({
  launchOptions: { executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' },
})

test('LOOK A — flag OFF: full bordered cards (the control, i.e. before)', async ({ page }) => {
  await preparePage(page, VP)
  await openCanvas(page)
  await mount(page, false)
  await shoot(page, 'A-flag-off-cards')
})

test('LOOK B — flag ON: collapsed compact lines (shipped)', async ({ page }) => {
  await preparePage(page, VP)
  await openCanvas(page)
  await mount(page, true)
  await shoot(page, 'B-flag-on-collapsed')
})

test('LOOK C — flag ON: first line expanded, body revealed in place', async ({ page }) => {
  await preparePage(page, VP)
  await openCanvas(page)
  await mount(page, true)
  await open(page, 0)
  await shoot(page, 'C-first-line-open')
})

/*
 * ⚠ NOT "the evidence family" — an earlier revision of this file called it that
 * and was wrong. On the walkA capture ALL THREE top-level points are
 * `v5_review_card`; every `v5_evidence` block sits behind "Show N more". Naming
 * a capture for what you expected to be in it is the same error as quoting a
 * count you have not run. The evidence path is photographed in
 * `evidenceLook.measure.ts`, which locates the block BY KIND.
 */
test('LOOK D — flag ON: third line expanded (still a review card, see note)', async ({ page }) => {
  await preparePage(page, VP)
  await openCanvas(page)
  await mount(page, true)
  await open(page, 2)
  await shoot(page, 'D-third-line-open')
})
