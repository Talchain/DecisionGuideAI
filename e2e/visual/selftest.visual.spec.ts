/**
 * SELF-TEST — the positive control for the whole harness.
 *
 * "An absence/comparison instrument with no positive control" is this
 * programme's single most repeated defect. A visual harness is exactly that
 * shape: it reports "no difference", and the most likely way for it to report
 * no difference forever is for it to have stopped looking. So this file does
 * not assert that the product looks right. It asserts that the INSTRUMENT can
 * tell right from wrong, and it prints the numbers it used.
 *
 * It measures four things against the SAME committed reference:
 *
 *   1. NOISE FLOOR — a fresh capture of the unmodified state. This is
 *      antialiasing, subpixel text rendering and any residual layout jitter.
 *      Must sit well BELOW the tolerance, or the harness cries wolf.
 *   2. PANEL WIDTH +35% — the right-hand dock widened by 35%, which is the
 *      class of regression that shipped past fifteen green PRs and was caught
 *      only by the founder's eyes.
 *   3. STICKY FOOTER OVERLAP — the dock footer translated up over the content
 *      it is supposed to sit below: the other regression of the same wave.
 *   4. HALF-PIXEL NUDGE — a 1px shift of one small control. A deliberately
 *      MARGINAL perturbation, recorded but not asserted in either direction,
 *      so the report says honestly where the instrument's sensitivity actually
 *      lies rather than only showing it the easy cases.
 *
 * Both inputs to every comparison are proven non-empty and dimensionally equal
 * BEFORE the ratio is believed. Two blank images agree perfectly and exit 0.
 *
 * Finally it drives the REAL assertion path (`toHaveScreenshot` with the
 * harness's own options) against a perturbed page and asserts it THROWS —
 * because a measured ratio proves pixelmatch works, not that the harness is
 * wired to fail when it should.
 */

import { test, expect } from '@playwright/test'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { PNG } from 'pngjs'
import pixelmatch from 'pixelmatch'
import {
  MAX_DIFF_PIXEL_RATIO,
  PIXEL_THRESHOLD,
  clearNotifications,
  measureContent,
  openCanvas,
  preparePage,
  referencePath,
  seedStarterDraft,
  waitForVisualQuiescence,
  freezeMotion,
} from './harness'
import { repoRoot } from './repoRoot'

const VP = { width: 1440, height: 900 }
const REFERENCE_NAME = 'fresh-draft--1440x900'
const ARTEFACT_DIR = join(repoRoot(), 'test-results', 'visual-selftest')

/**
 * Margin the tolerance must clear in each direction. A threshold that merely
 * separates the cases is a threshold sitting on a knife edge; these assert it
 * is separated by an order of magnitude, so ordinary drift in either direction
 * does not silently reclassify anything.
 */
const REQUIRED_MARGIN = 10

interface Comparison {
  label: string
  diffRatio: number
  diffPixels: number
  totalPixels: number
}

function compareToReference(actualPng: Buffer, label: string): Comparison {
  const expectedBuf = readFileSync(referencePath(REFERENCE_NAME))

  // BOTH INPUTS NON-EMPTY, BEFORE ANY AGREEMENT IS BELIEVED.
  expect(expectedBuf.byteLength, `reference ${REFERENCE_NAME} is empty`).toBeGreaterThan(8_000)
  expect(actualPng.byteLength, `capture for "${label}" is empty`).toBeGreaterThan(8_000)

  const expectedImg = PNG.sync.read(expectedBuf)
  const actualImg = PNG.sync.read(actualPng)

  expect(
    { w: actualImg.width, h: actualImg.height },
    `capture for "${label}" is a different size from the reference — the ratio would be meaningless`,
  ).toEqual({ w: expectedImg.width, h: expectedImg.height })

  const expContent = measureContent(expectedImg)
  const actContent = measureContent(actualImg)
  expect(expContent.distinctColours, 'reference is near-uniform — it would agree with a blank capture').toBeGreaterThan(40)
  expect(actContent.distinctColours, `capture for "${label}" is near-uniform — the app did not render`).toBeGreaterThan(40)

  const diff = new PNG({ width: expectedImg.width, height: expectedImg.height })
  const diffPixels = pixelmatch(expectedImg.data, actualImg.data, diff.data, expectedImg.width, expectedImg.height, {
    threshold: PIXEL_THRESHOLD,
  })
  const totalPixels = expectedImg.width * expectedImg.height

  mkdirSync(ARTEFACT_DIR, { recursive: true })
  const slug = label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  writeFileSync(join(ARTEFACT_DIR, `${slug}.actual.png`), actualPng)
  writeFileSync(join(ARTEFACT_DIR, `${slug}.diff.png`), PNG.sync.write(diff))
  writeFileSync(join(ARTEFACT_DIR, `${slug}.expected.png`), expectedBuf)

  return { label, diffRatio: diffPixels / totalPixels, diffPixels, totalPixels }
}

/**
 * Drive the state the reference was captured from, IN A FRESH BROWSER CONTEXT.
 *
 * ⚠ A FRESH CONTEXT PER PERTURBATION IS LOAD-BEARING, and the first version of
 * this file got it wrong in a way that inflated its own numbers. Re-navigating
 * to `/#/canvas` when already there is a HASH change, not a document load, so
 * injected `addStyleTag` rules SURVIVE it: the "sticky footer overlap"
 * measurement silently included the previous "panel width" perturbation, and
 * the "1px nudge" included both — which is why it reported 3.6030% against the
 * footer's 3.5962% and looked, wrongly, like a 1px shift was a huge signal.
 * Two perturbations that accumulate produce numbers that are individually
 * meaningless and collectively reassuring. Isolate by construction.
 */
async function freshDraftPage(browser: import('@playwright/test').Browser) {
  const context = await browser.newContext({ viewport: VP, deviceScaleFactor: 1 })
  const page = await context.newPage()
  await preparePage(page, VP)
  await openCanvas(page)
  await seedStarterDraft(page, 'build-vs-buy')
  await clearNotifications(page)
  await freezeMotion(page)
  await waitForVisualQuiescence(page)
  return { page, context }
}

const SHOT = { animations: 'disabled', caret: 'hide', scale: 'css' } as const

/**
 * ⚠ NEVER RUNS WHILE BLESSING, and this is a correctness requirement, not tidiness.
 *
 * Under `VISREG_BLESS=1` the config sets `updateSnapshots: 'all'`, so
 * `toHaveScreenshot` OVERWRITES the reference instead of failing. Two things go
 * wrong at once:
 *   1. the "the real assertion path REDS on a perturbed page" test cannot throw,
 *      so it fails — which is how CI first surfaced this;
 *   2. far worse, that test deliberately perturbs the page, so in bless mode it
 *      would WRITE A 35%-WIDENED PANEL AS THE CANONICAL REFERENCE. On the first
 *      CI run it was saved only by alphabetical file ordering — `selftest` runs
 *      before `states`, which then re-blessed over the top. A reference whose
 *      correctness depends on which file sorts first is not a reference.
 * The comparison tests below need references to already exist; blessing is what
 * creates them. The two modes are mutually exclusive by nature, so they are made
 * mutually exclusive by construction.
 */
test.describe('visual harness self-test — proves the instrument can fail', () => {
  test.skip(
    process.env.VISREG_BLESS === '1',
    'VISREG_BLESS=1: skipped by design. In bless mode toHaveScreenshot overwrites rather than ' +
      'compares, so these tests cannot assert a failure — and the perturbation tests would write ' +
      'a deliberately-broken image as the reference. Run `pnpm visual` (no bless) to exercise them.',
  )

  test('tolerance separates antialiasing noise from a real regression, by an order of magnitude', async ({ browser }) => {
    const results: Comparison[] = []

    // The panel-width perturbation is DERIVED from the dock's live width, not
    // hardcoded. It was hardcoded at 378px when the dock was 280px; the 416px
    // restore (#754/#755) would have silently turned "+35%" into "-9%" — a
    // perturbation that shrinks instead of widening, still producing a large
    // diff, so the assertion would have passed while measuring the wrong thing.
    const dockWidth = await (async () => {
      const { page, context } = await freshDraftPage(browser)
      try {
        const box = await page.locator('[data-testid="outputs-dock"]').first().boundingBox()
        expect(box, 'outputs-dock has no box — cannot derive the perturbation').not.toBeNull()
        return Math.round(box!.width)
      } finally {
        await context.close()
      }
    })()
    const widened = Math.round(dockWidth * 1.35)
    // eslint-disable-next-line no-console
    console.log(`[visreg self-test] dock is ${dockWidth}px; +35% perturbation widens it to ${widened}px`)
    expect(widened, 'the +35% perturbation must WIDEN the dock, not shrink it').toBeGreaterThan(dockWidth)

    // Each perturbation gets its own context, so none can contaminate the next.
    const cases: Array<{ label: string; css?: string }> = [
      // 1. NOISE FLOOR — unmodified.
      { label: 'noise floor (unmodified)' },
      // 2. PANEL WIDTH +35% — width derived above from the live dock. This is
      //    the regression class of the 15-PR wave.
      {
        label: 'panel width +35 percent',
        css: `[data-testid="outputs-dock"] { width: ${widened}px !important; max-width: ${widened}px !important; }`,
      },
      // 3. STICKY FOOTER OVERLAP — footer lifted over the content beneath it.
      {
        label: 'sticky footer overlap',
        css: '[data-testid="pre-analysis-v3-footer"] { position: relative !important; z-index: 60 !important; transform: translateY(-72px) !important; }',
      },
      // 4. MARGINAL — a 1px nudge of one small control. Recorded, not asserted:
      //    it tells the reader where sensitivity actually sits.
      { label: 'marginal 1px control nudge', css: '[data-testid="layout-density-toggle"] { transform: translateY(1px) !important; }' },
    ]

    for (const c of cases) {
      const { page, context } = await freshDraftPage(browser)
      try {
        if (c.css) {
          await page.addStyleTag({ content: c.css })
          await waitForVisualQuiescence(page)
        }
        results.push(compareToReference(await page.screenshot(SHOT), c.label))
      } finally {
        await context.close()
      }
    }

    const table = results
      .map((r) => `  ${r.label.padEnd(30)} ${(r.diffRatio * 100).toFixed(4).padStart(9)}%  (${r.diffPixels}/${r.totalPixels} px)`)
      .join('\n')
    // eslint-disable-next-line no-console
    console.log(
      `\n[visreg self-test] tolerance maxDiffPixelRatio = ${MAX_DIFF_PIXEL_RATIO} (${(MAX_DIFF_PIXEL_RATIO * 100).toFixed(2)}%)\n${table}\n`,
    )
    mkdirSync(ARTEFACT_DIR, { recursive: true })
    writeFileSync(
      join(ARTEFACT_DIR, 'selftest-report.txt'),
      `maxDiffPixelRatio = ${MAX_DIFF_PIXEL_RATIO}\npixel threshold  = ${PIXEL_THRESHOLD}\n\n${table}\n`,
      'utf8',
    )

    const [noise, panelWidth, footerOverlap] = results

    // The noise floor must be an order of magnitude UNDER the tolerance,
    // otherwise ordinary rendering variation will start reddening the gate and
    // the harness gets muted.
    expect(
      noise.diffRatio,
      `noise floor ${noise.diffRatio} is not comfortably below the tolerance ${MAX_DIFF_PIXEL_RATIO}; ` +
        `the harness would produce false positives and be switched off`,
    ).toBeLessThan(MAX_DIFF_PIXEL_RATIO / REQUIRED_MARGIN)

    // Both real regressions must be an order of magnitude OVER it.
    expect(
      panelWidth.diffRatio,
      `a 35% panel-width change produced only ${panelWidth.diffRatio} difference — the tolerance is too slack to bite`,
    ).toBeGreaterThan(MAX_DIFF_PIXEL_RATIO * REQUIRED_MARGIN)
    expect(
      footerOverlap.diffRatio,
      `an overlapping sticky footer produced only ${footerOverlap.diffRatio} difference — the tolerance is too slack to bite`,
    ).toBeGreaterThan(MAX_DIFF_PIXEL_RATIO * REQUIRED_MARGIN)
  })

  test('the real assertion path REDS on a perturbed page', async ({ browser }) => {
    // The measurement above proves pixelmatch discriminates. It does NOT prove
    // that captureState's own comparison is wired to fail. This does.
    const { page, context } = await freshDraftPage(browser)
    const box = await page.locator('[data-testid="outputs-dock"]').first().boundingBox()
    const widened = Math.round((box?.width ?? 416) * 1.35)
    await page.addStyleTag({
      content: `[data-testid="outputs-dock"] { width: ${widened}px !important; max-width: ${widened}px !important; }`,
    })
    await waitForVisualQuiescence(page)

    let threw: Error | null = null
    try {
      await expect(page).toHaveScreenshot(`${REFERENCE_NAME}.png`, {
        maxDiffPixelRatio: MAX_DIFF_PIXEL_RATIO,
        threshold: PIXEL_THRESHOLD,
        animations: 'disabled',
        caret: 'hide',
        scale: 'css',
        timeout: 8_000,
      })
    } catch (e) {
      threw = e as Error
    }

    expect(
      threw,
      'the harness compared a 35%-widened panel against the reference and PASSED. ' +
        'It is not an instrument; it is a green light. Do not merge.',
    ).not.toBeNull()
    expect(String(threw?.message)).toMatch(/screenshot comparison failed|ratio|pixels/i)
    await context.close()
  })

  test('a missing reference is a hard failure, never a silent bless', async () => {
    const { assertReferenceIsSubstantive } = await import('./harness')
    expect(
      () => assertReferenceIsSubstantive('this-reference-does-not-exist', { width: 1440, height: 900 }),
      'a missing reference did not throw — the harness would write and bless whatever it happened to render',
    ).toThrow(/NO REFERENCE/)
  })

  test('a blank reference is rejected as non-substantive', async () => {
    const { assertReferenceIsSubstantive } = await import('./harness')
    // Write a blank PNG of the right dimensions into the reference tree under a
    // name nothing else uses, and prove the guard refuses it. This is the exact
    // failure the guard exists for: an all-white reference agrees with an
    // all-white capture and the comparison exits 0 forever.
    const blank = new PNG({ width: 1440, height: 900 })
    blank.data.fill(255)
    const name = '__selftest-blank'
    const p = referencePath(name)
    mkdirSync(join(p, '..'), { recursive: true })
    writeFileSync(p, PNG.sync.write(blank))
    try {
      expect(
        () => assertReferenceIsSubstantive(name, { width: 1440, height: 900 }),
        'a blank reference was accepted — the harness could agree with a blank capture and never fail',
      ).toThrow(/near-uniform|one single colour|quantised colours|too small to be a screenshot/)
    } finally {
      const { unlinkSync } = await import('node:fs')
      unlinkSync(p)
    }
  })

  test('a large but near-uniform reference is rejected by the non-modal-pixel guard', async () => {
    const { assertReferenceIsSubstantive } = await import('./harness')
    // Byte size and colour count can BOTH look healthy while the image is
    // blank: high-entropy noise in a 3px strip inflates the PNG past the size
    // floor and past the colour floor, yet 99.7% of the image is one colour.
    // Two guards that fail differently are not redundant — this case slips
    // past the other two and is caught only by the non-modal fraction.
    const img = new PNG({ width: 1440, height: 900 })
    img.data.fill(255)
    for (let i = 0; i < 1440 * 3 * 4; i += 4) {
      img.data[i] = Math.floor(Math.random() * 256)
      img.data[i + 1] = Math.floor(Math.random() * 256)
      img.data[i + 2] = Math.floor(Math.random() * 256)
      img.data[i + 3] = 255
    }
    const name = '__selftest-nearly-uniform'
    const p = referencePath(name)
    mkdirSync(join(p, '..'), { recursive: true })
    writeFileSync(p, PNG.sync.write(img))
    try {
      const { statSync } = await import('node:fs')
      // Positive control on the CASE ITSELF: if this fixture did not clear the
      // byte floor, the test would pass for the wrong reason and prove nothing
      // about the non-modal guard.
      expect(statSync(p).size, 'fixture must clear the byte floor or it tests the wrong guard').toBeGreaterThan(8_000)
      expect(
        () => assertReferenceIsSubstantive(name, { width: 1440, height: 900 }),
        'a 99.7%-uniform reference was accepted — the non-modal guard is not biting',
      ).toThrow(/one single colour/)
    } finally {
      const { unlinkSync } = await import('node:fs')
      unlinkSync(p)
    }
  })
})