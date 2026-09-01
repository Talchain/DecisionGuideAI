/**
 * THE METRIC CAPTION COLUMN HAS A FLOOR, AND THE FLOOR NEVER CLIPS IT.
 *
 * WHY THIS EXISTS
 * ---------------
 * `NodeMetricRow` states its own doctrine in its header: "THE BAR IS THE
 * CONSTANT; ONLY THE CAPTION CHANGES", so a reader can compare two cards of
 * different types at a glance. That comparison is the reason numbers are on the
 * graph at all.
 *
 * #1124 fixed a real clip — at `--canvas-label-scale: 2` the caption needed 73px
 * inside a fixed `w-14` (56px) column, so ~17px of "strength" painted on top of
 * the bar beside it — by REMOVING the width. Content-sizing cannot clip, but it
 * also gives up the shared start-x: equal values then render as unequal bar
 * lengths across node types, which is the doctrine above, inverted.
 *
 * A FLOOR (`min-w`) is neither trade. `width = max(56px, content)`:
 *   · content ≥ 56px  → identical to content-sizing, so the clip stays fixed;
 *   · content < 56px  → identical to the old fixed column, so alignment holds.
 *
 * WHAT THIS MEASURES, AND WHY IT NEEDS A BROWSER
 * ----------------------------------------------
 * jsdom has no layout: a class assertion proves the class is present and says
 * nothing about the box (CLAUDE.md trap 3). Both regimes are exercised HERE
 * because both are reachable in the product, at the same card, by the user's own
 * zoom affordance:
 *
 *   `--canvas-label-scale` is `1 / zoom` clamped to [1, 2] (`zoomLegibility.ts`).
 *   At the post-layout auto-fit (zoom 0.50) it is 2 and the caption's content is
 *   WIDER than the floor. Zoom in to 1 and it is 1, and the content is NARROWER.
 *
 * ⚠ THE PRECONDITION IS PINNED IN-TEST, not assumed (CLAUDE.md trap 13b). A
 * floor assertion is vacuous wherever the CONTENT already exceeds the floor, so
 * the content width is measured independently — with a probe span carrying the
 * caption's own resolved font — and asserted to be on the expected side of the
 * floor before the floor is asserted at all. `scrollWidth` cannot serve: under a
 * `min-width` it reports the FLOOR, not the content, so a test built on it would
 * agree with itself.
 *
 * STATE-CLASS: fresh. `build-vs-buy` is seeded into a fresh page; it settles on
 * the narrowest card the starters produce (230px), which is the tightest case
 * the bar has to survive.
 */
import { test, expect } from '@playwright/test'
import {
  preparePage, openCanvas, seedStarterDraft, clearNotifications,
  freezeMotion, waitForVisualQuiescence, VIEWPORTS, type StarterId,
} from './harness'

/** The narrowest card the shipped starters settle on — the tightest case. */
const STARTER: StarterId = 'build-vs-buy'

/**
 * The floor, in CSS px. `3.5rem` at the 16px root — the SAME measure the column
 * carried as `w-14` before #1124, so "aligned as before" is a claim about this
 * exact number rather than about a new one.
 */
const CAPTION_FLOOR_PX = 56

/** Every metric row the shared component renders, named so a row that stops mounting is visible. */
const METRIC_ROW_TEST_IDS = [
  'outcome-strength-row',
  'risk-strength-row',
  'decision-leader-metric-row',
  'factor-influence-row',
  'goal-achievement-metric-row',
] as const

interface RowReading {
  id: string
  cardW: number | null
  rowW: number
  capText: string
  capBoxPx: number
  capScrollPx: number
  capContentPx: number
  barPx: number
}

/**
 * `clientWidth` truncates to an integer and an independently-measured content
 * width does not, so comparing the two directly manufactures a 1px "clip" that
 * is an artefact of the instrument. The CLIP claim therefore uses the element's
 * own `scrollWidth - clientWidth`, exactly as `nodeTextClipping.visual.spec.ts`
 * does, with that spec's own `> 1` tolerance. The probe is used ONLY where
 * `scrollWidth` cannot answer: which SIDE of the floor the content falls on.
 */
const CLIP_TOLERANCE_PX = 1

/** Runs in the page; `page.evaluate` gets no closure, so this is self-contained. */
const readRows = (ids: string[]) => {
  const flow = document.querySelector('.react-flow') as HTMLElement | null
  const labelScale = flow
    ? getComputedStyle(flow).getPropertyValue('--canvas-label-scale').trim()
    : ''

  // The content width has to come from OUTSIDE the box being measured: under a
  // `min-width`, `scrollWidth` reports the floor and would confirm itself.
  const probe = document.createElement('span')
  probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;left:-9999px'
  document.body.appendChild(probe)

  const out: RowReading[] = []
  for (const id of ids) {
    for (const el of Array.from(document.querySelectorAll(`[data-testid="${id}"]`))) {
      const row = el as HTMLElement
      const kids = Array.from(row.children) as HTMLElement[]
      const caption = kids[0]
      const bar = kids[1]
      if (!caption || !bar) continue
      const cs = getComputedStyle(caption)
      probe.style.font = cs.font
      probe.style.fontFamily = cs.fontFamily
      probe.style.fontSize = cs.fontSize
      probe.style.fontWeight = cs.fontWeight
      probe.style.letterSpacing = cs.letterSpacing
      probe.textContent = caption.textContent ?? ''
      const card = row.closest('.react-flow__node') as HTMLElement | null
      out.push({
        id,
        cardW: card ? card.offsetWidth : null,
        rowW: row.clientWidth,
        capText: (caption.textContent ?? '').trim(),
        capBoxPx: caption.clientWidth,
        capScrollPx: caption.scrollWidth,
        capContentPx: Math.round(probe.getBoundingClientRect().width * 100) / 100,
        barPx: bar.clientWidth,
      })
    }
  }
  probe.remove()
  return { labelScale, rows: out }
}

const fmt = (r: RowReading) =>
  `${r.id} card=${r.cardW} row=${r.rowW} cap="${r.capText}" box=${r.capBoxPx}/${r.capScrollPx} ` +
  `content=${r.capContentPx} bar=${r.barPx}`

test.describe('the metric caption column', () => {
  test(`has a ${CAPTION_FLOOR_PX}px floor and never clips its content — ${STARTER}`, async ({ page }) => {
    await preparePage(page, VIEWPORTS[0])
    await openCanvas(page)
    await seedStarterDraft(page, STARTER)
    await clearNotifications(page)
    await freezeMotion(page)
    await waitForVisualQuiescence(page)

    /* ── REGIME A: the auto-fit zoom, where the caption OUTGROWS the floor.
       This is the regime #1124's clip lived in, and the one the floor must not
       reintroduce. */
    const a = await page.evaluate(readRows, [...METRIC_ROW_TEST_IDS])

    expect(a.rows.length, 'no metric rows mounted — every assertion below would be vacuous')
      .toBeGreaterThanOrEqual(5)
    expect(a.labelScale, 'the auto-fit did not park at the counter-scale cap').toBe('2')

    // PRECONDITION, PINNED: the floor is INERT here only because the content is
    // wider than it. If this flips, the assertion below stops discriminating.
    for (const r of a.rows) {
      expect(
        r.capContentPx,
        `at the auto-fit scale the caption content must EXCEED the floor for this regime to ` +
          `mean anything — ${fmt(r)}`,
      ).toBeGreaterThan(CAPTION_FLOOR_PX)
    }

    // THE CLIP CLAIM. The box is never narrower than the text it holds.
    for (const r of a.rows) {
      expect(
        r.capScrollPx - r.capBoxPx,
        `caption is clipped at the auto-fit scale — ${fmt(r)}`,
      ).toBeLessThanOrEqual(CLIP_TOLERANCE_PX)
    }

    // THE BAR IS THE CONSTANT: it survives the tightest card.
    for (const r of a.rows) {
      expect(r.barPx, `the bar collapsed at the auto-fit scale — ${fmt(r)}`).toBeGreaterThan(0)
    }

    /* ── REGIME B: zoomed in to the counter-scale floor, where the caption is
       NARROWER than the floor. This is the regime the shared start-x lives in,
       and it is reached through the product's own affordance, not by forcing a
       CSS variable to a value the product would never write. */
    const readScale = () =>
      page.evaluate(() =>
        Number(
          getComputedStyle(document.querySelector('.react-flow') as HTMLElement)
            .getPropertyValue('--canvas-label-scale')
            .trim(),
        ),
      )
    const zoomIn = page.getByRole('button', { name: 'Zoom in', exact: true })
    await expect(zoomIn, 'the product has no "Zoom in" affordance — regime B is unreachable')
      .toBeVisible()
    for (let i = 0; i < 8 && (await readScale()) > 1; i++) {
      await zoomIn.click()
      await page.waitForTimeout(250)
    }
    // The counter-scale is written from a React effect; give it a beat to settle
    // rather than racing the last click.
    await page
      .waitForFunction(
        () =>
          Number(
            getComputedStyle(document.querySelector('.react-flow') as HTMLElement)
              .getPropertyValue('--canvas-label-scale')
              .trim(),
          ) === 1,
        undefined,
        { timeout: 10_000 },
      )
      .catch(() => {
        /* the assertion below names the failure with the value it saw */
      })

    const b = await page.evaluate(readRows, [...METRIC_ROW_TEST_IDS])
    expect(b.labelScale, 'never reached counter-scale 1 — regime B did not run').toBe('1')
    expect(b.rows.length, 'no metric rows mounted after zooming').toBeGreaterThanOrEqual(5)

    // PRECONDITION, PINNED: the content is BELOW the floor here, so a box that
    // measures the floor can only have been produced BY the floor.
    for (const r of b.rows) {
      expect(
        r.capContentPx,
        `the caption content must be BELOW the floor for the floor assertion to discriminate — ` +
          `${fmt(r)}`,
      ).toBeLessThan(CAPTION_FLOOR_PX)
    }

    // ⭐ THE CLAIM THIS SPEC EXISTS FOR. Every caption box holds the floor, so
    // captions of different widths still start their bars at the same x.
    const short = b.rows.filter((r) => r.capBoxPx < CAPTION_FLOOR_PX).map(fmt)
    expect(
      short,
      `these caption columns are narrower than the ${CAPTION_FLOOR_PX}px floor, so bars on ` +
        `different node types no longer begin at the same x — the component's own "THE BAR IS ` +
        `THE CONSTANT" doctrine, inverted`,
    ).toEqual([])

    // …the floor is paid for out of slack, not out of the bar…
    for (const r of b.rows) {
      expect(r.barPx, `the floor collapsed the bar — ${fmt(r)}`).toBeGreaterThan(0)
    }

    // …and a floor that is wider than the content must still not clip it.
    for (const r of b.rows) {
      expect(
        r.capScrollPx - r.capBoxPx,
        `caption is clipped at counter-scale 1 — ${fmt(r)}`,
      ).toBeLessThanOrEqual(CLIP_TOLERANCE_PX)
    }

    // eslint-disable-next-line no-console
    console.log(
      `[metric-column] scale 2: ${a.rows.map(fmt).join(' | ')}\n` +
        `[metric-column] scale 1: ${b.rows.map(fmt).join(' | ')}`,
    )
  })
})
