/**
 * EDGE LABEL OVERLAP — a MEASUREMENT instrument, not a gate.
 *
 * Real Chromium, real layout, real fonts. It exists because the two defects it
 * measures are GEOMETRY, and jsdom cannot see geometry at all (CLAUDE.md trap
 * 3): a jsdom render proves the label element exists, never that two of them
 * are painted on top of each other.
 *
 * Founder report, 31 Aug 2026: two persistent edge labels rendered on top of
 * each other near the goal node ("Moderate boo" clipped mid-word under
 * "Moderate drag (uncer…"), and a third floated below the bottom node with no
 * visible line joining it to its edge.
 *
 * ⚠ RUN IT DELIBERATELY, it is not in any gate:
 *   pnpm exec playwright test -c playwright.geometry.config.ts \
 *     e2e/geometry/edgeLabelOverlap.measure.ts
 *
 * WHAT IT MEASURES, and the claim each number supports:
 *  - `labels`      — how many persistent labels rendered. POSITIVE CONTROL: a
 *                    run that renders 0 or 1 label can never observe an
 *                    overlap, so a zero-overlap result from such a cell is
 *                    vacuous and is reported as VACUOUS, not as a pass.
 *  - `overlaps`    — pairs of rendered label boxes whose CLIENT rects
 *                    intersect. This is the painted geometry, not a model of
 *                    it.
 *  - `occluded`    — leader lines (the hairline joining a dodged label to its
 *                    edge) whose segment passes through a node card. React
 *                    Flow paints the node layer ABOVE both the edge SVG and
 *                    the edge-label renderer, so such a leader is invisible
 *                    and its label reads as detached — the second symptom.
 *  - `maxDy`       — the largest vertical dodge applied, in canvas units.
 *
 * Output: one `EDGELBL {...}` line per cell on stdout. No assertions about
 * what the numbers ought to be beyond the vacuity control — this is an
 * instrument for before/after comparison.
 */
import { test } from '@playwright/test'
import {
  openCanvas,
  preparePage,
  seedStarterDraft,
  clearNotifications,
  minimiseFloatingOlumiPanel,
  waitForVisualQuiescence,
  type StarterId,
} from '../visual/harness'

const STARTERS: StarterId[] = [
  'vendor-selection',
  'market-entry',
  'build-vs-buy',
  'headcount-allocation',
  'pricing-model',
]
const VP = { width: 1440, height: 900 }

// The first cell(s) of a run pay Vite's cold dependency-optimise, and on a
// loaded machine that exceeds `openCanvas`'s 30s wait for `.react-flow`. That
// is an instrument failure, not a product finding — and a cell that never
// loads must never be read as "no overlap found" (CLAUDE.md trap 13: an
// absence claim needs an instrument that could have seen a presence). Retry
// rather than let a cold start silently shrink the measured set.
test.describe.configure({ retries: 2 })

/**
 * Seed a minimal robustness report so the fragility signal is REACHABLE.
 * Without it this measure cannot observe the fragility badge in either arm —
 * see the comment at the seeding call below.
 */
const SEED_FRAGILE = process.env.SEED_FRAGILE === '1'

for (const id of STARTERS) {
  test(`EDGELBL ${id} @${VP.width}x${VP.height}`, async ({ page }) => {
    await preparePage(page, VP)
    await openCanvas(page)
    await seedStarterDraft(page, id)
    await clearNotifications(page)
    await minimiseFloatingOlumiPanel(page)

    // Persistent edge labels require a COMPLETED run (edgeLabelVisibility:
    // `isResultsMode`). Starters are seeded pre-run, so flip the one field the
    // policy reads. No report is attached, so `topStrengthIds` takes its
    // documented PRE-analysis branch (rank by |strength.mean|, provenance
    // gated) — the same branch a real user sees the moment a run completes on
    // a graph whose strengths came from the draft.
    // ⚠⚠ THE MEASURE COULD NOT SEE THE FRAGILITY SIGNAL AT ALL UNTIL THIS KNOB.
    // Flipping `results.status` with NO REPORT attached leaves
    // `report.robustness.fragile_edges` empty, so `isFragileEdge` is false for
    // every edge and the badge NEVER renders — an instrument that reports
    // "0 fragility badges, 0 overlaps" whatever the code does (CLAUDE.md trap
    // 13: an absence claim needs an instrument that could have seen a
    // presence). SEED_FRAGILE=1 attaches a minimal robustness report so the
    // signal is reachable and the before/after comparison is meaningful.
    const applied = await page.evaluate((seedFragile: boolean) => {
      const w = window as unknown as {
        useCanvasStore: {
          getState: () => {
            results: Record<string, unknown>
            edges: Array<{ id: string }>
          }
          setState: (p: Record<string, unknown>) => void
        }
      }
      const state = w.useCanvasStore.getState()
      const prev = state.results
      const next: Record<string, unknown> = { ...prev, status: 'complete', progress: 100 }
      if (seedFragile) {
        // The first few causal edges, marked with a MEASURED switch
        // probability (absent would mean "not computed" and would render the
        // honest-absence copy instead of a percentage).
        next.report = {
          robustness: {
            fragile_edges: state.edges.slice(0, 3).map((e) => ({
              edge_id: e.id,
              switch_probability: 0.49,
            })),
          },
        }
      }
      w.useCanvasStore.setState({ results: next })
      return w.useCanvasStore.getState().results.status
    }, SEED_FRAGILE)
    if (applied !== 'complete') throw new Error(`results.status never became complete (got ${applied})`)

    await waitForVisualQuiescence(page)
    await page.waitForTimeout(400)

    const m = await page.evaluate(() => {
      const labels = [
        ...document.querySelectorAll('[data-testid="edge-influence-label"]'),
      ] as HTMLElement[]
      const texts = labels.map((el) => {
        const span = el.querySelector('[data-testid="edge-influence-label-text"]') as HTMLElement | null
        return {
          shown: (span?.textContent ?? '').trim(),
          full: el.getAttribute('aria-label') ?? '',
          // A span whose scroll width exceeds its client width is ellipsised
          // (or clipped). Reported so a "clipped mid-word" claim is measured,
          // not inferred from a screenshot.
          clipped: span ? span.scrollWidth > span.clientWidth + 1 : false,
          w: el.getBoundingClientRect().width,
          h: el.getBoundingClientRect().height,
        }
      })
      // Canvas zoom, so client px can be converted to the graph units the
      // resolver works in. Without it a rendered size cannot be compared with
      // LABEL_HALF_WIDTH / LABEL_HALF_HEIGHT at all.
      const vpEl = document.querySelector('.react-flow__viewport') as HTMLElement | null
      const tr = vpEl ? getComputedStyle(vpEl).transform : 'none'
      let zoom = NaN
      if (tr && tr !== 'none') {
        const p = tr.match(/matrix\(([^)]+)\)/)
        if (p) zoom = parseFloat(p[1].split(',')[0])
      }
      const rects = labels.map((el) => el.getBoundingClientRect())

      // THE DECISIVE METRIC for the original bug this resolver exists to fix:
      // a label whose PAINTED rect intersects a node card is partly hidden,
      // because the node layer paints on top. Measured against the rendered
      // card elements, not against the store rects the resolver models.
      const cardEls = [...document.querySelectorAll('.react-flow__node[data-id]')] as HTMLElement[]
      const cardRects = cardEls.map((el) => el.getBoundingClientRect())
      let cardOverlaps = 0
      let worstCardOverlapPx = 0
      for (const lr of rects) {
        for (const cr of cardRects) {
          const ix = Math.min(lr.right, cr.right) - Math.max(lr.left, cr.left)
          const iy = Math.min(lr.bottom, cr.bottom) - Math.max(lr.top, cr.top)
          if (ix > 0 && iy > 0) {
            cardOverlaps++
            worstCardOverlapPx = Math.max(worstCardOverlapPx, Math.min(ix, iy))
          }
        }
      }

      let overlaps = 0
      let worstLabelOverlapPx = 0
      const overlapPairs: Array<{ a: number; b: number; ix: number; iy: number }> = []
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i]
          const b = rects[j]
          const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left)
          const iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
          if (ix > 0 && iy > 0) {
            overlaps++
            // The SMALLER dimension is how deep the two boxes actually
            // interpenetrate — a 44×2 clip and a 44×20 clip are very
            // different harms and a bare count cannot tell them apart.
            worstLabelOverlapPx = Math.max(worstLabelOverlapPx, Math.min(ix, iy))
            overlapPairs.push({ a: i, b: j, ix: Math.round(ix), iy: Math.round(iy) })
          }
        }
      }

      // Leader lines: canvas-coordinate segments. Occluded when the segment
      // crosses any node card (nodes paint above them).
      const store = (
        window as unknown as {
          useCanvasStore: {
            getState: () => { nodes: Array<{ id: string; position: { x: number; y: number }; measured?: { width?: number; height?: number }; width?: number; height?: number }> }
          }
        }
      ).useCanvasStore.getState()
      const dims = new Map<string, { w: number; h: number }>()
      for (const el of [...document.querySelectorAll('.react-flow__node[data-id]')] as HTMLElement[]) {
        dims.set(el.dataset.id!, { w: el.offsetWidth, h: el.offsetHeight })
      }
      const cards = store.nodes.map((n) => {
        const d = dims.get(n.id)
        return {
          x: n.position.x,
          y: n.position.y,
          w: d?.w ?? n.measured?.width ?? n.width ?? 200,
          h: d?.h ?? n.measured?.height ?? n.height ?? 80,
        }
      })
      const segHitsRect = (
        x1: number, y1: number, x2: number, y2: number,
        r: { x: number; y: number; w: number; h: number },
      ) => {
        // Sample the segment; sufficient for an occlusion count and immune to
        // the degenerate-slope cases an analytic clip has to special-case.
        for (let t = 0; t <= 1.0001; t += 0.02) {
          const x = x1 + (x2 - x1) * t
          const y = y1 + (y2 - y1) * t
          if (x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h) return true
        }
        return false
      }
      // THE POLARITY GLYPH and THE FRAGILITY ROW. The glyph is counted so its
      // demotion is measured rather than asserted, and `glyphLabelOverlaps`
      // is the specific harm it caused: a 16px bold chip painted at
      // (targetX-18, targetY-18) sitting on top of a placed label.
      const glyphEls = [
        ...document.querySelectorAll('[aria-label^="Effect direction:"]'),
      ] as HTMLElement[]
      const glyphRects = glyphEls.map((el) => el.getBoundingClientRect())
      let glyphLabelOverlaps = 0
      let worstGlyphOverlapPx = 0
      for (const gr of glyphRects) {
        for (const lr of rects) {
          const ix = Math.min(gr.right, lr.right) - Math.max(gr.left, lr.left)
          const iy = Math.min(gr.bottom, lr.bottom) - Math.max(gr.top, lr.top)
          if (ix > 0 && iy > 0) {
            glyphLabelOverlaps++
            worstGlyphOverlapPx = Math.max(worstGlyphOverlapPx, Math.min(ix, iy))
          }
        }
      }
      // Apparent size of the glyph, so the size ruling is a measurement.
      const glyphPx = glyphEls.length
        ? Math.round(parseFloat(getComputedStyle(glyphEls[0]).fontSize) * 10) / 10
        : null
      const fragileTagEls = [
        ...document.querySelectorAll('[data-testid="edge-fragile-tag"]'),
      ] as HTMLElement[]
      // A fragility row OUTSIDE a placed chip is the defect this closes: the
      // old badge was a free-floating sibling, so it had no chip ancestor.
      const strandedFragileTags = fragileTagEls.filter(
        (el) => !el.closest('[data-testid="edge-influence-label"]'),
      ).length

      const leaders = [...document.querySelectorAll('[data-testid="edge-label-leader"]')] as unknown as SVGLineElement[]
      let occluded = 0
      let maxDy = 0
      const leaderDetail: Array<{ len: number; occluded: boolean }> = []
      for (const l of leaders) {
        const x1 = Number(l.getAttribute('x1'))
        const y1 = Number(l.getAttribute('y1'))
        const x2 = Number(l.getAttribute('x2'))
        const y2 = Number(l.getAttribute('y2'))
        const hit = cards.some((c) => segHitsRect(x1, y1, x2, y2, c))
        if (hit) occluded++
        maxDy = Math.max(maxDy, Math.abs(y2 - y1))
        leaderDetail.push({ len: Math.round(Math.hypot(x2 - x1, y2 - y1)), occluded: hit })
      }

      return {
        zoom: Math.round(zoom * 1000) / 1000,
        // The rendered box in GRAPH units — directly comparable with the
        // 160×22 the resolver clears for.
        boxCanvas: rects.length
          ? { w: Math.round((rects[0].width / zoom) * 10) / 10, h: Math.round((rects[0].height / zoom) * 10) / 10 }
          : null,
        labels: labels.length,
        cardOverlaps,
        worstCardOverlapPx: Math.round(worstCardOverlapPx),
        overlaps,
        worstLabelOverlapPx: Math.round(worstLabelOverlapPx),
        overlapPairs,
        glyphs: glyphEls.length,
        glyphPx,
        glyphLabelOverlaps,
        worstGlyphOverlapPx: Math.round(worstGlyphOverlapPx),
        fragileTags: fragileTagEls.length,
        strandedFragileTags,
        occluded,
        leaders: leaders.length,
        leaderDetail,
        maxDy: Math.round(maxDy),
        texts,
      }
    })

    const vacuous = m.labels < 2
    // eslint-disable-next-line no-console
    console.log(`EDGELBL ${JSON.stringify({ starter: id, vacuous, ...m })}`)
  })
}
