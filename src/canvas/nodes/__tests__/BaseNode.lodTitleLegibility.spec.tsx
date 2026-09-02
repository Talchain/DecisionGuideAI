/**
 * THE ANCHOR'S "BOOST" MUST NOT BE A SHRINK.
 *
 * ⭐ THE DEFECT, MEASURED IN A REAL BROWSER (1 Sep 2026,
 * `e2e/geometry/zoomLadder.measure.ts`, five committed starter drafts x
 * 1280x800 and 1440x900). After "Show whole model" the goal and decision titles
 * rendered at **4.67px** while every ordinary card rendered **6.23px** — the two
 * cards the product singles out as always-legible were the smallest text on the
 * canvas, and had been since the boost shipped.
 *
 * The cause was one token: the boost was spelled `text-lg`, a PANEL size, so it
 * was the only canvas title not carrying `--canvas-label-scale`. Below the
 * legibility floor that variable is the entire mechanism keeping a label from
 * collapsing with the viewport transform.
 *
 * ⛔ WHY THIS FILE ASSERTS ARITHMETIC AND NOT PIXELS. jsdom has no layout, so a
 * DOM assertion here proves a class is present and proves nothing about size on
 * screen (CLAUDE.md trap 3). `renderedLabelPx` is exported from
 * `utils/zoomLegibility.ts` for exactly this purpose, and the browser probe
 * above is what makes the on-screen claim. What this file guards is the
 * PROPERTY — over the whole zoom band, not over a sample — that the boosted
 * title is never smaller than the ordinary one.
 *
 * ⚠ THE ASSERTIONS BIND BY IDENTITY, NEVER BY A PREDICATE ANOTHER ELEMENT COULD
 * SATISFY (trap 19): the title is located by `data-testid="node-title"` inside
 * the card under test, and the anchor/ordinary distinction is made by NODE TYPE,
 * which is the thing `lodKeepsTitle` actually branches on.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { Crosshair } from 'lucide-react'
import { BaseNode } from '../BaseNode'
import {
  LABEL_LEGIBLE_ZOOM,
  labelCounterScale,
  renderedLabelPx,
} from '../../utils/zoomLegibility'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const makeStoreState = (o: Record<string, unknown> = {}) => ({
  results: { status: 'idle', report: null },
  highlightedNodes: new Set(),
  dimmedNodeIds: new Set(),
  editedSinceRunNodeIds: new Set(),
  analysisHighlight: { source: null, edgeIds: new Set(), nodeIds: new Set() },
  lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
  goalThreshold: null,
  goalConstraints: [],
  hoveredOptionId: null,
  ceeAnalysisReady: null,
  edges: [],
  nodes: [],
  viewMode: 'standard',
  lodActive: true,
  ...o,
})

vi.mock('../../store', () => ({ useCanvasStore: vi.fn((s: any) => s(makeStoreState())) }))
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null, influence: null, influenceProvenance: null, confidence: null,
    inSensitivityAnalysis: false, achievementProbability: null,
    achievementProbabilityIsModelledBasis: null, stabilityPercentage: null,
    winRate: null, isResultsMode: false,
  })),
}))

import { useCanvasStore } from '../../store'

const baseProps = {
  position: { x: 0, y: 0 }, selected: false, isConnectable: true,
  positionAbsoluteX: 0, positionAbsoluteY: 0, dragging: false, zIndex: 0,
}

function renderCard(nodeType: 'decision' | 'goal' | 'factor', state: Record<string, unknown> = {}) {
  vi.mocked(useCanvasStore).mockImplementation((sel: any) => sel(makeStoreState(state) as any))
  return render(
    <ReactFlowProvider>
      <BaseNode
        {...(baseProps as any)}
        id={`${nodeType}-1`}
        nodeType={nodeType}
        icon={Crosshair}
        data={{ label: 'Usage-Based Billing System Approach', type: nodeType }}
      />
    </ReactFlowProvider>,
  )
}

const titleClass = () => screen.getByTestId('node-title').className

/**
 * The declared px a Tailwind canvas/panel class resolves to. Only the two sizes
 * this file is about — deliberately NOT a general parser, because a general one
 * would be a second opinion about the type scale.
 */
const TEXT_LG_PX = 18

describe('the boosted anchor title carries the canvas label scale', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('a decision below the floor uses the canvas nodeTitle token', () => {
    renderCard('decision')
    expect(titleClass()).toContain('--canvas-label-scale')
  })

  it('a goal below the floor uses the canvas nodeTitle token', () => {
    renderCard('goal')
    expect(titleClass()).toContain('--canvas-label-scale')
  })

  /**
   * ⛔ THE REGRESSION PIN, AND IT IS THE LOAD-BEARING ONE. `text-lg` is the
   * exact spelling that caused the shrink. Asserting the presence of the canvas
   * token alone would still pass if someone re-added `text-lg` ALONGSIDE it —
   * and Tailwind's later-wins ordering means the panel size would take over
   * again with the token sitting there looking correct.
   */
  it.each(['decision', 'goal'] as const)(
    'and NOT the panel size that caused the shrink (%s)',
    (nodeType) => {
      renderCard(nodeType)
      expect(titleClass()).not.toMatch(/\btext-lg\b/)
    },
  )

  it('the emphasis survives — weight and colour, which is where the canvas carries it', () => {
    renderCard('decision')
    expect(titleClass()).toContain('font-semibold')
    expect(titleClass()).toContain('text-text-header')
  })

  /**
   * THE OPPOSITE-DIRECTION TWIN (CLAUDE.md trap 22b). A fix that made every
   * title identical would satisfy every assertion above and would DELETE the
   * anchor distinction the product means to have. An ordinary card must still
   * be the ordinary card.
   */
  it('CONTRAST — an ordinary card is still unboosted at the same zoom', () => {
    renderCard('factor')
    const cls = titleClass()
    expect(cls).toContain('--canvas-label-scale')
    expect(cls).toContain('text-text-body')
    expect(cls).not.toContain('font-semibold')
    expect(cls).not.toContain('text-text-header')
  })

  /**
   * CONTRAST ON THE ZOOM AXIS. `lodBoostTitle` is `lodActive && lodKeepsTitle`,
   * so above the floor the anchor takes the ordinary treatment. Without this,
   * every assertion above would also pass on a build that boosted at all zooms
   * — a different product, and one whose card heights nothing has measured.
   */
  it('CONTRAST — above the floor the anchor takes the ordinary treatment', () => {
    renderCard('decision', { lodActive: false })
    expect(titleClass()).toContain('text-text-body')
    expect(titleClass()).not.toContain('font-semibold')
  })
})

/**
 * THE PROPERTY THE CLASS ASSERTIONS ARE A PROXY FOR, stated over the whole band
 * rather than over the samples above. This is the arithmetic that was false for
 * every zoom the boost applied to.
 */
describe('the boost is never a shrink, at any zoom it can apply to', () => {
  // The domain of `lodBoostTitle`: strictly below the legibility floor, down to
  // the canvas instance minimum (`minZoom={0.1}`).
  const BAND = [0.1, 0.15, 0.2, 0.26, 0.3, 0.35, 0.4, 0.45, 0.49]

  it('the OLD spelling was smaller than an ordinary title at every zoom in the band', () => {
    // The refutation, kept as evidence rather than as prose. `text-lg` carries
    // no counter-scale, so its rendered size is `18 * zoom` flat.
    const worse = BAND.filter((z) => TEXT_LG_PX * z < renderedLabelPx(12, z))
    expect(
      worse,
      'the premise of this fix is that the old boost was smaller everywhere; if this list ' +
        'is not the whole band, the fix is aimed at the wrong thing',
    ).toEqual(BAND)
  })

  /*
   * ⚠ THERE IS DELIBERATELY NO "the new spelling is at least as large" TEST
   * HERE, AND THE ABSENCE IS THE POINT. The first draft of this file had one:
   * `renderedLabelPx(12, z) < renderedLabelPx(12, z)`, filtered to an empty
   * array, asserted empty. It is a tautology — a guard comparing a value with
   * itself and applauding (CLAUDE.md trap 13b) — and it would have passed on a
   * build that reverted this entire fix.
   *
   * The claim "the boosted title now carries the counter-scale" is a claim
   * about the CLASS the component renders, and it is asserted where it can
   * actually fail: the `text-lg` regression pin and the canvas-token assertions
   * in the describe above, each shown to bite by a mutant.
   */

  it('the fix moves the anchor up by exactly the counter-scale it was missing', () => {
    // 4.67 -> 6.23 at the measured zoom, and the ratio is derived rather than
    // typed: `24z / 18z`. Pinned so a change to either size is visible here.
    const z = 0.2595
    expect(Number((TEXT_LG_PX * z).toFixed(2))).toBe(4.67)
    expect(Number(renderedLabelPx(12, z).toFixed(2))).toBe(6.23)
  })

  /**
   * ⚠ THE GAP THIS FIX DOES **NOT** CLOSE, PINNED AS AN EXPLICIT SET SO IT
   * CANNOT BE QUIETLY FORGOTTEN OR QUIETLY WIDENED (CLAUDE.md 22f — the honest
   * way to ship a known gap is a test that REDs if the set grows OR shrinks).
   *
   * `labelCounterScale` is CAPPED at `1 / LABEL_LEGIBLE_ZOOM` = 2, so below the
   * floor every canvas label shrinks linearly with zoom and goes under the DS
   * v5 §2.4 canvas floor of 10px. Measured in the browser at the zoom "Show
   * whole model" parks at: titles 4.67-7.78px, reduced lines 5.71-9.51px,
   * across all five starters and both viewports — every single reading
   * sub-floor. This fix improves the two anchor cards by **+33.0% to +33.3%**
   * (the ratio is exactly 24/18; the readings that come in under it are the
   * starters whose whole-model fit shifted <= 0.25% as the anchors' rendered
   * height changed) and lifts exactly ONE of the twenty readings over the floor
   * — headcount-allocation at 1440x900, 7.78px -> 10.35px. Nineteen remain
   * sub-floor.
   *
   * ⛔ IT IS NOT FIXED HERE BECAUSE THE FIX SPENDS ANOTHER LANE'S MARGIN. Raising
   * the cap grows every card at low zoom, and #1123 ("the row stride reserves
   * the card at its tallest, not at today's zoom") — MERGED `d0fa3821`, 2 Sep
   * 2026 — rests on 45-64px of row slack. Uncapping would spend margin that lane
   * is relying on, and would also reopen #758 (the font grew, the box did not)
   * because `nodeLayoutConstants` sizes geometry for `MAX_LABEL_COUNTER_SCALE`
   * exactly.
   *
   * The premise below is the CAP, which is what would have to change.
   */
  it('KNOWN GAP: the counter-scale still caps at the floor, so low-zoom text is still sub-floor', () => {
    expect(labelCounterScale(0.2595)).toBe(labelCounterScale(LABEL_LEGIBLE_ZOOM))
    expect(renderedLabelPx(12, 0.2595)).toBeLessThan(10)
    // …and the cap is reached AT the floor, which is what makes the whole band
    // below it shrink linearly. If this ever stops holding, the gap has been
    // closed (or moved) and this test must be revisited rather than deleted.
    expect(labelCounterScale(LABEL_LEGIBLE_ZOOM)).toBe(1 / LABEL_LEGIBLE_ZOOM)
  })
})
