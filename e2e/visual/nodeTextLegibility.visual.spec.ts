/**
 * Canvas node text must be READABLE at the zoom the product picks for the user.
 *
 * WHY THIS IS A BROWSER TEST. jsdom has no layout and no viewport transform, so
 * a passing DOM assertion proves a class is present and proves nothing about
 * the size of a glyph on screen (CLAUDE.md trap 3). The sibling census
 * (`src/canvas/__tests__/canvasTextCounterScale.census.spec.ts`) proves
 * every declared size is routed through a counter-scaled token; only this spec
 * can prove what that renders to. Neither replaces the other.
 *
 * WHAT IT MEASURES. Canvas label text is DOM inside React Flow's viewport
 * transform, which scales glyphs, so `rendered = computed x zoom`. The
 * counter-scale (`--canvas-label-scale`, see `src/canvas/utils/zoomLegibility.ts`)
 * inflates `computed` by `1/zoom` across the legible band so that `rendered`
 * equals the DECLARED size. A raw `text-[10px]` or an inline `fontSize` cannot
 * see that variable and therefore renders at `declared x zoom`.
 *
 * MEASURED AT THE TIP THIS SPEC LANDED ON (Chromium, 3 starters x 2 laptop
 * viewports, hermetic harness, at the POST-LAYOUT AUTO-FIT zoom of 0.5000):
 *   node title  declared 13px -> 13.00px rendered  (was already correct)
 *   edge pill   declared 10px ->  5.00px rendered  BEFORE this lane
 *   edge pill   declared 10px -> 10.00px rendered  AFTER
 * 17-21 such pills were on screen per starter.
 *
 * STATE-CLASS: fresh. Each starter is seeded into a fresh page and left at the
 * zoom the AUTO-FIT chooses — the only zoom the product picks FOR the user, and
 * therefore the only one it owes legibility at. The toolbar's "fit to view" is
 * an explicit user gesture and is unfloored by design.
 */
import { test, expect } from '@playwright/test'
import { VIEWPORTS, clearNotifications, openCanvas, preparePage, seedStarterDraft } from './harness'

/** Every starter the product ships — the corpus, from outside this file. */
const STARTERS = ['build-vs-buy', 'market-entry', 'vendor-selection'] as const

/**
 * Design System v5 §2.4: "Panel and canvas contexts use 10-12px for information
 * density, always via tokens, never raw classes." 10px is the floor, and §2.3
 * fixes the canvas scale at 13/11/10.
 */
const MIN_CANVAS_PX = 10

/**
 * `CanvasLabelScaleSync` quantises the counter-scale to two decimals
 * (`SCALE_QUANTUM = 100`) so a pinch gesture does not rewrite the DOM every
 * frame. That quantisation is deliberate and documented as "NOT a legibility
 * parameter", but it does mean a counter-scaled 10px label can land a hair
 * under 10px at a zoom whose reciprocal is not exact: measured 9.99px at zoom
 * 0.5776 (scale 1/0.5776 = 1.7313, written as 1.73).
 *
 * The bound is `declared x halfQuantum x zoom` = `13 x 0.005 x 1` < 0.07px, so
 * 0.1px is a derived allowance rather than a number chosen to make a red go
 * away. It is far below the ~1px at which a rendering difference is visible,
 * and it is NOT wide enough to hide the defect this spec exists for — that one
 * was a factor of TWO (5.0px against a declared 10px), not a hundredth.
 */
const QUANTISATION_TOLERANCE_PX = 0.1

/**
 * Text inside the node card that is knowingly NOT counter-scaled, pinned EXACTLY
 * — the same set as `KNOWN_FIXED` in the census, and pinned here too because a
 * gap recorded in the suite is honest while a gap invisible to it is how this
 * defect shipped in the first place. Each declares a size outside the DS v5
 * §2.3 canvas scale, so fixing it is a visual-design ruling, not a mechanical
 * substitution.
 *
 * ⚠ KEYED ON THE **DECLARED** SIZE, NOT THE RENDERED ONE. The first version of
 * this pin listed rendered sizes ('7px', '12px'), which are only those values at
 * a zoom of exactly 0.50 — it passed at 1280x800 and failed the moment a starter
 * settled at 0.5776. A control pinned to a quantity that moves is a control with
 * an expiry date nobody wrote down (CLAUDE.md trap 12b). Declared size is
 * zoom-invariant: a FIXED element's computed size IS its declared size, because
 * it never sees `--canvas-label-scale`.
 */
const KNOWN_FIXED_DECLARED_PX = [7, 12, 18] as const

/** Runs in the page; `page.evaluate` gets no closure, so this is self-contained. */
const readNodeText = () => {
  const flow = document.querySelector('.react-flow') as HTMLElement
  const vp = document.querySelector('.react-flow__viewport') as HTMLElement
  const zoom = new DOMMatrixReadOnly(getComputedStyle(vp).transform).a
  const labelScale = getComputedStyle(flow).getPropertyValue('--canvas-label-scale').trim()

  const readings: Array<{ computedPx: number; renderedPx: number; text: string }> = []
  for (const node of Array.from(document.querySelectorAll('.react-flow__node'))) {
    for (const el of Array.from(node.querySelectorAll('*'))) {
      // Only elements that own visible text of their own.
      const own = Array.from(el.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent ?? '')
        .join('')
        .trim()
      if (!own) continue
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden' || cs.display === 'none') continue
      if ((el as HTMLElement).closest('.sr-only')) continue
      const computed = parseFloat(cs.fontSize)
      // `computed` already carries the counter-scale (the tokens are
      // `calc(Npx * var(--canvas-label-scale))`), so this is what the user sees.
      // A counter-scaled element has `computed = declared x labelScale`; a fixed
      // one has `computed = declared`. So the computed size IS the declared size
      // for exactly the elements this pin is about.
      readings.push({ computedPx: +computed.toFixed(2),
                      renderedPx: +(computed * zoom).toFixed(2), text: own.slice(0, 40) })
    }
  }
  return { zoom: +zoom.toFixed(4), labelScale, nodeCount: document.querySelectorAll('.react-flow__node').length, readings }
}

for (const viewport of VIEWPORTS) {
  for (const starter of STARTERS) {
    test(`node text is legible at the auto-fit zoom — ${starter} @ ${viewport.name}`, async ({ page }) => {
      await preparePage(page, viewport)
      await openCanvas(page)
      const seeded = await seedStarterDraft(page, starter)
      await clearNotifications(page)
      // Let the post-layout auto-fit's camera animation finish.
      await page.waitForTimeout(2000)

      const { zoom, labelScale, nodeCount, readings } = await page.evaluate(readNodeText)

      // ── Preconditions, pinned in-test (trap 13b: a guard must pin its own
      // precondition, or a silent seeding failure passes every assertion).
      expect(seeded.nodeCount, 'starter seeded no nodes').toBeGreaterThan(10)
      expect(nodeCount, 'no nodes rendered').toBeGreaterThan(10)
      expect(readings.length, 'no node text measured — the sweep is blind').toBeGreaterThan(20)
      expect(zoom, 'auto-fit parked below the legibility floor').toBeGreaterThanOrEqual(0.5)
      expect(Number(labelScale), 'the counter-scale variable is not on the React Flow root')
        .toBeGreaterThan(0)

      // ── CONTRAST CONTROL. The sweep must be shown to DISCRIMINATE: at a zoom
      // below 1 a counter-scaled element and a fixed one differ, and if every
      // reading came back identical the assertion below would pass for the
      // wrong reason (trap 20 — uniformity is evidence about the instrument).
      if (zoom < 1) {
        const rendered = new Set(readings.map((r) => r.renderedPx))
        expect(rendered.size, 'every reading identical — the sweep is not discriminating')
          .toBeGreaterThan(1)
      }

      // ── THE CLAIM. Every glyph the user sees inside a node card is at or above
      // the DS v5 §2.4 canvas floor, except the pinned set.
      const below = readings.filter((r) => r.renderedPx < MIN_CANVAS_PX - QUANTISATION_TOLERANCE_PX)
      const unexplained = below.filter(
        (r) => !(KNOWN_FIXED_DECLARED_PX as readonly number[]).includes(r.computedPx),
      )
      expect(
        unexplained.map((r) => `${r.computedPx}px declared -> ${r.renderedPx}px rendered  "${r.text}"`),
        `text rendering under ${MIN_CANVAS_PX}px at zoom ${zoom} that is NOT in the pinned set`,
      ).toEqual([])

      // ── The node title is the headline claim: it renders at its DECLARED size.
      const titles = await page.evaluate(() => {
        const vp = document.querySelector('.react-flow__viewport') as HTMLElement
        const z = new DOMMatrixReadOnly(getComputedStyle(vp).transform).a
        return Array.from(document.querySelectorAll('[data-testid="node-title"]'))
          .map((t) => +(parseFloat(getComputedStyle(t).fontSize) * z).toFixed(2))
      })
      expect(titles.length).toBeGreaterThan(10)
      for (const t of titles) expect(t, 'node title not rendering at its declared 13px').toBeCloseTo(13, 0)

      // ⭐ THE REGRESSION THIS LANE CLOSED, bound BY IDENTITY rather than by a
      // value predicate another element could satisfy (CLAUDE.md trap 19): the
      // strength pills EdgePills renders on each node card. They declared 10px
      // as a raw `text-[10px]` and therefore rendered at `10 x zoom`.
      const strengthPills = await page.evaluate(() => {
        const vp = document.querySelector('.react-flow__viewport') as HTMLElement
        const z = new DOMMatrixReadOnly(getComputedStyle(vp).transform).a
        return Array.from(document.querySelectorAll('.react-flow__node span'))
          .filter((el) => /^[\u2191\u2193]?\s*\d+%$/.test((el.textContent ?? '').trim()))
          .map((el) => +(parseFloat(getComputedStyle(el).fontSize) * z).toFixed(2))
      })
      expect(strengthPills.length, 'no strength pills on screen — this claim is untested here')
        .toBeGreaterThan(5)
      for (const p of strengthPills) {
        expect(p, 'strength pill is not rendering at its declared 10px — the counter-scale is not reaching it')
          .toBeGreaterThanOrEqual(MIN_CANVAS_PX - QUANTISATION_TOLERANCE_PX)
      }
    })
  }
}
