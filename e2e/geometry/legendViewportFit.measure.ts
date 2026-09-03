/**
 * THE CANVAS LEGEND FITS THE WINDOW IT OPENS IN — measured in a real browser.
 *
 * ⭐ WHY THIS CANNOT LIVE IN THE VITEST GATE.
 *
 * The defect was pure geometry, and the shipped build had a GREEN jsdom suite
 * throughout. `src/canvas/components/__tests__/CanvasLegendPopover.spec.tsx`
 * asserts the rows are in the document, which they were — all 816px of them,
 * with the top 43px above the top of the window. jsdom returns 0 for every rect
 * and has no layout at all (CLAUDE.md trap 3), so no assertion in that file
 * could have distinguished a panel a reader can read from one they cannot.
 *
 * The register itself said so in writing, and was ignored:
 * `metricVocabulary.ts` — *"THE POPOVER IS WIDER FOR THESE ROWS, AND NOTHING IN
 * jsdom CAN CHECK IT … this is the one claim in this change with no automated
 * witness."* Seven prose rows were then added under that note. This file is that
 * missing witness.
 *
 * ── WHAT WAS MEASURED ON THE DEPLOYED BUILD `bd18bace`, at 1280×800 ─────────
 *
 *     canvas-legend-popover   height 816   y = -43   overflow-y: visible
 *                             scrollHeight === clientHeight  (NOT scrollable)
 *     "How to read this"      y = -30      off-screen
 *     first row, "Question"   y =  -6      off-screen
 *
 * Both were unreachable by any means — no scrollbar, no keyboard, no drag.
 *
 * MECHANISM, both halves (the full derivation is in the component):
 *   1. the panel had NO `max-height`, so 816px of content could not fit 800px
 *      of window at any position; and
 *   2. it is `absolute … bottom-0` inside a `position: fixed; bottom: 12px`
 *      toolbar, so it grows UPWARD off the top with no clamp:
 *      773 − 816 = −43, exactly the y measured.
 *
 * ── THE ASSERTIONS, AND WHY EACH ONE IS NOT THE OTHERS ─────────────────────
 *
 *  · TOP ≥ 0. The claim the brief makes: the panel must never render above the
 *    top of the viewport. Asserted at five window heights, because a panel that
 *    fits at 800 is not evidence about 500 — and shrinking the window is
 *    precisely how a reader reaches the small heights.
 *  · THE HEADING AND THE FIRST ROW ARE ON SCREEN. `top ≥ 0` is a claim about the
 *    BOX. These two elements are what the witness found off-screen, and they are
 *    asserted by identity rather than by "something is visible" — a panel could
 *    satisfy `top ≥ 0` and still clip its heading under a future header.
 *  · IT ACTUALLY SCROLLS. ⭐ THE LOAD-BEARING ONE, and the one a CSS-class check
 *    would fake. `overflow-y: auto` present in the computed style proves nothing
 *    about whether the content is reachable: the shipped panel had a scroll
 *    property too (`visible`), and a container whose `min-height: auto` refuses
 *    to shrink reports `scrollHeight === clientHeight` while overflowing its
 *    parent. So the assertion is on the NUMBERS — `scrollHeight > clientHeight`
 *    where the panel is capped — plus a real scroll that must MOVE the content.
 *  · NOTHING IS LOST. A cap that fits by dropping rows would pass every
 *    assertion above. The row count inside the scroll region is asserted equal
 *    to the count at the tallest uncapped state.
 *
 * ── THE MOUNT PRECONDITION, AND WHY IT IS FIRST ────────────────────────────
 *
 * ⚠ On 2 Sep 2026 a sibling geometry measure in this repo read CLEAN AT EVERY
 * TIP because its fixture never mounted the component under test. Every number
 * it printed was well-formed and every assertion passed, about nothing.
 *
 * So before any geometry is believed, this file asserts the popover is OPEN,
 * ATTACHED, NON-EMPTY, and carries a row it can name (`Weak effect` — a
 * phase-independent row present in every state this file drives). A measurement
 * taken on a closed or empty popover is a hard failure here, never a pass.
 *
 * ⚠ AND IT CARRIES A CONTRAST CONTROL WHOSE EXPECTED ANSWER DIFFERS
 * (CLAUDE.md trap 13e): the same reader is pointed at the popover BEFORE the
 * button is clicked and must report it ABSENT. A probe that returned a
 * plausible-looking box for anything it was asked about would fail there. Both
 * directions, or the "it is mounted" reading is unfalsifiable.
 *
 * ── SCOPE OF THE CLAIM ─────────────────────────────────────────────────────
 *
 * This measures the CANVAS legend popover on `/#/canvas` with one seeded
 * starter, in Chromium, at 1280 width. It says nothing about other popovers,
 * other browsers, or widths where the toolbar itself reflows.
 *
 * ⚠ NOT IN ANY GATE. `e2e/geometry/` is referenced by zero workflows and this
 * file carries no `GATE_TAG`, so it protects DELIBERATE runs only — it is a
 * MEASURE with hard assertions, which is the distinction `canvasGateSet.ts`
 * draws. Whether it should be promoted into the canvas browser gate is a
 * decision for that gate's owner, not this lane's to take: the gate's own notes
 * record that its wall clock has not been re-measured since it reached four arms
 * and that promotion is blocked on a separate precondition. The recommendation,
 * with the cost, is in the PR description.
 *
 * Run it deliberately:
 *     GEOMETRY_PORT=5393 pnpm exec playwright test -c playwright.geometry.config.ts --grep LEGEND
 */
import { test, expect, type Page } from '@playwright/test'
import { openCanvas, preparePage, seedStarterDraft, clearNotifications, waitForVisualQuiescence } from '../visual/harness'

const WIDTH = 1280

/**
 * The window heights the panel must survive.
 *
 * 800 is the witness condition and is not negotiable. The rest go DOWN, because
 * the failure mode is "taller than the space above the button" and every smaller
 * window makes that space smaller. 420 is below any laptop but is where a
 * clamp-by-constant would give itself away.
 */
const HEIGHTS = [800, 700, 600, 500, 420]

/** A row that renders in EVERY phase — the mount precondition names it. */
const PHASE_INDEPENDENT_ROW = 'Weak effect'

interface PanelGeometry {
  readonly present: boolean
  readonly panelTop: number
  readonly panelBottom: number
  readonly panelHeight: number
  readonly viewportHeight: number
  readonly textLength: number
  readonly rowCount: number
  readonly headingTop: number
  readonly headingBottom: number
  readonly firstRowTop: number
  readonly scrollClientHeight: number
  readonly scrollScrollHeight: number
  readonly scrollOverflowY: string
  readonly namedRowPresent: boolean
}

/**
 * One reader, used for the panel AND for the contrast control. Sharing it is the
 * point: a probe that can only report "present" would pass the mount assertion
 * and fail the contrast one.
 */
async function readPanel(page: Page): Promise<PanelGeometry> {
  return page.evaluate((namedRow) => {
    const panel = document.querySelector('[data-testid="canvas-legend-popover"]') as HTMLElement | null
    if (!panel) {
      return {
        present: false,
        panelTop: NaN, panelBottom: NaN, panelHeight: NaN,
        viewportHeight: window.innerHeight,
        textLength: 0, rowCount: 0,
        headingTop: NaN, headingBottom: NaN, firstRowTop: NaN,
        scrollClientHeight: NaN, scrollScrollHeight: NaN, scrollOverflowY: '',
        namedRowPresent: false,
      }
    }
    const scroll = panel.querySelector('[data-testid="canvas-legend-scroll"]') as HTMLElement | null
    const rect = panel.getBoundingClientRect()

    // The heading is the panel's own label. Found by TEXT, not by position, so
    // reordering the panel cannot silently re-point this at another element.
    const heading = Array.from(panel.querySelectorAll('div')).find(
      (d) => d.textContent?.trim() === 'How to read this',
    ) as HTMLElement | undefined
    const hRect = heading?.getBoundingClientRect()

    // "Rows" = the leaf label lines inside the scroll region, both kinds: the
    // swatch rows (`flex items-center gap-2`) and the prose number rows. Counted
    // as direct children of the group wrappers so a wrapper is not itself a row.
    // ⚠ QUERIED FROM THE SCROLL REGION IF THERE IS ONE, ELSE FROM THE PANEL.
    // This guard must bind to the DEFECT — a panel above the top of the window
    // — not to the markup of its fix. Requiring the scroll container here would
    // make the merge base fail on "your div is missing" instead of on
    // "y = -43", i.e. it would assert the shape of the remedy rather than the
    // absence of the harm, and it would go green for a future fix that solved
    // the geometry a different way.
    const rowRoot: HTMLElement = scroll ?? panel
    const groups = Array.from(rowRoot.querySelectorAll(':scope > div.space-y-1\\.5'))
    const rows = groups.flatMap((g) => Array.from(g.children))
    const firstRow = rows[0] as HTMLElement | undefined

    return {
      present: true,
      panelTop: rect.top,
      panelBottom: rect.bottom,
      panelHeight: rect.height,
      viewportHeight: window.innerHeight,
      textLength: (panel.textContent ?? '').length,
      rowCount: rows.length,
      headingTop: hRect ? hRect.top : NaN,
      headingBottom: hRect ? hRect.bottom : NaN,
      firstRowTop: firstRow ? firstRow.getBoundingClientRect().top : NaN,
      scrollClientHeight: scroll ? scroll.clientHeight : NaN,
      scrollScrollHeight: scroll ? scroll.scrollHeight : NaN,
      scrollOverflowY: scroll ? getComputedStyle(scroll).overflowY : '',
      namedRowPresent: (panel.textContent ?? '').includes(namedRow),
    }
  }, PHASE_INDEPENDENT_ROW)
}

async function openLegend(page: Page): Promise<void> {
  await page.getByTestId('btn-canvas-legend').click()
  await expect(page.getByTestId('canvas-legend-popover')).toBeVisible({ timeout: 10_000 })
}

async function closeLegend(page: Page): Promise<void> {
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('canvas-legend-popover')).toHaveCount(0, { timeout: 10_000 })
}

/**
 * ⭐ THE PRECONDITION. Hard-fails rather than skipping: a geometry number from an
 * unmounted or empty popover is worse than no number, because it reads as a pass.
 */
function assertMounted(g: PanelGeometry, where: string): void {
  expect(g.present, `[${where}] the popover is not in the DOM — nothing was measured`).toBe(true)
  expect(g.textLength, `[${where}] the popover mounted EMPTY — the measurement is void`).toBeGreaterThan(200)
  expect(g.namedRowPresent, `[${where}] the popover does not contain "${PHASE_INDEPENDENT_ROW}"`).toBe(true)
  expect(g.rowCount, `[${where}] no rows were found inside the scroll region`).toBeGreaterThan(10)
  expect(Number.isFinite(g.headingTop), `[${where}] the heading "How to read this" was not found`).toBe(true)
  // ⚠ NO "a scroll container exists" ASSERTION HERE, DELIBERATELY. That is a
  // claim about the fix's markup; the claim this file is for is that the
  // content is REACHABLE, and it is asserted on the numbers in the body
  // (`scrollHeight > clientHeight`, plus a scroll that must MOVE) wherever the
  // panel is actually capped.
}

test.describe('LEGEND fits its viewport', () => {
  test('the panel, its heading and its first row are on screen at every window height — and it scrolls', async ({ page }) => {
    await preparePage(page, { width: WIDTH, height: HEIGHTS[0] })
    await openCanvas(page)
    const seeded = await seedStarterDraft(page, 'vendor-selection')
    // `applyDraftResult` no-ops on an empty payload rather than throwing, so
    // "it ran" is not evidence it seeded anything.
    expect(seeded.nodeCount, 'the starter seeded no nodes — the canvas under measurement is empty').toBeGreaterThan(0)
    await clearNotifications(page)
    await waitForVisualQuiescence(page)

    // ── CONTRAST CONTROL, before anything is opened ────────────────────────
    // Expected answer DIFFERS from every reading below. Without it, "the panel
    // is mounted" is a claim this probe could not have contradicted.
    const closed = await readPanel(page)
    expect(closed.present, 'the reader reported a legend popover BEFORE the button was clicked — it cannot discriminate').toBe(false)

    const report: Record<string, PanelGeometry> = {}

    for (const height of HEIGHTS) {
      await page.setViewportSize({ width: WIDTH, height })
      await openLegend(page)
      // The cap is measured from the wrapper's rect on open and on resize; give
      // the layout a frame to settle before reading it back.
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))

      const g = await readPanel(page)
      const at = `${WIDTH}x${height}`
      // ⚠ LOG BEFORE ASSERTING. A run that REDs is the run whose numbers matter
      // most — at the merge base this line is what prints `y=-43`, and an
      // assertion that fires first would take the evidence with it.
      console.log(
        `[LEGEND] ${at}: panel y=${g.panelTop.toFixed(0)}..${g.panelBottom.toFixed(0)} h=${g.panelHeight.toFixed(0)} ` +
          `heading y=${g.headingTop.toFixed(0)} firstRow y=${g.firstRowTop.toFixed(0)} ` +
          `scroll ${g.scrollClientHeight}/${g.scrollScrollHeight} (${g.scrollOverflowY || 'no scroll container'}) rows=${g.rowCount}`,
      )
      assertMounted(g, at)
      report[at] = g

      // ⭐ THE BRIEF'S CLAIM. At base this read -43 at 1280x800.
      expect(g.panelTop, `[${at}] the panel renders ABOVE the top of the viewport (y=${g.panelTop})`).toBeGreaterThanOrEqual(0)
      expect(g.panelBottom, `[${at}] the panel extends below the bottom of the viewport`).toBeLessThanOrEqual(g.viewportHeight + 1)

      // The two elements the witness found off-screen, by identity.
      expect(g.headingTop, `[${at}] the heading "How to read this" is off-screen (y=${g.headingTop})`).toBeGreaterThanOrEqual(0)
      expect(g.headingBottom, `[${at}] the heading is clipped at the top of the window`).toBeLessThanOrEqual(g.viewportHeight)
      expect(g.firstRowTop, `[${at}] the first legend row is off-screen (y=${g.firstRowTop})`).toBeGreaterThanOrEqual(0)

      // The panel cannot be taller than the window it is in.
      expect(g.panelHeight, `[${at}] the panel is taller than the viewport`).toBeLessThanOrEqual(g.viewportHeight)

      // ⭐ IT ACTUALLY SCROLLS — asserted on the numbers, not on a class name.
      // Where the content does not fit, the scroll container must report real
      // overflow AND a real scroll must move it.
      if (g.scrollScrollHeight > g.scrollClientHeight) {
        expect(g.scrollOverflowY, `[${at}] the panel overflows but its container is not scrollable`).toMatch(/auto|scroll/)
        const moved = await page.evaluate(() => {
          const s = document.querySelector('[data-testid="canvas-legend-scroll"]') as HTMLElement
          const before = s.scrollTop
          s.scrollTop = s.scrollHeight
          const after = s.scrollTop
          s.scrollTop = before
          return after - before
        })
        expect(moved, `[${at}] the container reports overflow but will not scroll`).toBeGreaterThan(0)
      }

      await closeLegend(page)
    }

    // ⭐ NOTHING WAS LOST TO MAKE IT FIT. A cap that dropped rows would satisfy
    // every assertion above. The row count must be identical at every height —
    // the panel scrolls, it does not shed content.
    const counts = HEIGHTS.map((h) => report[`${WIDTH}x${h}`].rowCount)
    expect(new Set(counts).size, `row counts differ across heights: ${JSON.stringify(counts)} — the panel is dropping rows to fit`).toBe(1)

    // ⭐ AND AT LEAST ONE HEIGHT MUST GENUINELY OVERFLOW, or every scroll
    // assertion above was skipped and this test proved only that a short panel
    // fits (CLAUDE.md trap 13 — an absence probe needs a presence).
    const overflowed = HEIGHTS.filter((h) => {
      const g = report[`${WIDTH}x${h}`]
      return g.scrollScrollHeight > g.scrollClientHeight
    })
    expect(overflowed.length, 'the panel never overflowed at ANY height — the scroll assertions never ran').toBeGreaterThan(0)

    console.log(`[LEGEND] overflowed at: ${overflowed.join(', ') || 'none'}; rows constant at ${counts[0]}`)
  })

  /**
   * ⭐ THE TALLEST STATE THE PANEL HAS.
   *
   * The pre-run key withholds five number rows (they describe post-run
   * markings — see the component). So the arm above, at its default phase,
   * measures a SHORTER panel than a reader with a completed analysis sees, and
   * a fit proven pre-run is not evidence about post-run. This arm drives the
   * status the cards themselves key off — `results.status === 'complete'` — and
   * re-measures at the witness viewport.
   *
   * ⚠ It asserts the phase actually took, by row count: setting a store field
   * that some later refactor renames would otherwise leave this arm measuring
   * the pre-run panel again while reporting about the post-run one.
   */
  test('post-run, with every number row showing, it still fits 1280x800', async ({ page }) => {
    await preparePage(page, { width: WIDTH, height: 800 })
    await openCanvas(page)
    const seeded = await seedStarterDraft(page, 'vendor-selection')
    expect(seeded.nodeCount).toBeGreaterThan(0)
    await clearNotifications(page)
    await waitForVisualQuiescence(page)

    await openLegend(page)
    const pre = await readPanel(page)
    assertMounted(pre, 'pre-run 1280x800')
    await closeLegend(page)

    await page.evaluate(() => {
      const w = window as unknown as { useCanvasStore: { setState: (p: unknown) => void } }
      w.useCanvasStore.setState({ results: { status: 'complete', progress: 100 } })
    })
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))

    await openLegend(page)
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    const post = await readPanel(page)
    assertMounted(post, 'post-run 1280x800')

    // The phase took: the post-run key carries strictly more rows.
    expect(post.rowCount, `the phase did not take — pre=${pre.rowCount} post=${post.rowCount}`).toBeGreaterThan(pre.rowCount)

    expect(post.panelTop, `post-run the panel renders above the top of the viewport (y=${post.panelTop})`).toBeGreaterThanOrEqual(0)
    expect(post.headingTop, `post-run the heading is off-screen (y=${post.headingTop})`).toBeGreaterThanOrEqual(0)
    expect(post.firstRowTop, `post-run the first row is off-screen (y=${post.firstRowTop})`).toBeGreaterThanOrEqual(0)
    expect(post.panelHeight).toBeLessThanOrEqual(post.viewportHeight)

    // This is the state that overflows 800px — the one the deployed build got
    // wrong. Assert the overflow EXISTS (so the scroll claim is not vacuous)
    // and that it is reachable.
    expect(post.scrollScrollHeight, 'the post-run panel did not overflow 800px — re-derive this arm').toBeGreaterThan(post.scrollClientHeight)
    expect(post.scrollOverflowY).toMatch(/auto|scroll/)

    console.log(
      `[LEGEND post-run] panel y=${post.panelTop.toFixed(0)}..${post.panelBottom.toFixed(0)} h=${post.panelHeight.toFixed(0)} ` +
        `rows ${pre.rowCount}->${post.rowCount} scroll ${post.scrollClientHeight}/${post.scrollScrollHeight}`,
    )
  })
})
