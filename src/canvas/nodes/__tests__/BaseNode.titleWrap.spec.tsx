/**
 * BaseNode — node titles must wrap at WORD boundaries, never mid-word.
 *
 * ⚠ The measurements below are a RECORD of build f2b48fc9 (14 Aug 2026), when
 * `NODE_LAYOUT_MIN_W` was 140px and canvas text rendered at its declared size.
 * Both have since changed — the floor now carries the label counter-scale — so
 * read the numbers as history, not as current geometry. `nodeLabelFit.spec.ts`
 * and `e2e/visual/nodeLabelFit.visual.spec.ts` hold the current derivation and
 * the current in-browser measurement.
 *
 * Defect witnessed on deployed staging build f2b48fc9 (14 Aug 2026), in a real
 * browser: when a dense tier compresses cards to NODE_LAYOUT_MIN_W (140px), the
 * title shared its flex row with the shape indicator and the header slot,
 * leaving a 77px measure. `overflow-wrap: break-word` is a LAST-RESORT rule —
 * it splits a word mid-character the moment that word cannot fit the line box —
 * so ordinary words broke mid-word:
 *
 *   "Team Coordination Overhead"  ->  "Team Coordinatio / n Overhead"
 *   "Development Headcount"       ->  "Developme / nt Headcount"
 *
 * Measured in-browser with Range.getClientRects (line-box spans per word):
 * 3 of 16 titles broke mid-word at the compressed width; 0 after this fix.
 *
 * jsdom CANNOT assert layout — it has no line boxes and no text metrics. This
 * spec therefore binds to the CSS RULE CONTRACT that produces word-boundary
 * wrapping, by IDENTITY (`data-testid="node-title"`), never by a value
 * predicate another element could satisfy. The visual witness is the browser
 * screenshot / Range measurement recorded on the PR, not this file.
 */

import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { Target } from 'lucide-react'
import { BaseNode } from '../BaseNode'
import { NODE_LAYOUT_MIN_W, NODE_TITLE_MIN_MEASURE_PX } from '../../utils/nodeLayoutConstants'
import { MAX_LABEL_COUNTER_SCALE } from '../../utils/zoomLegibility'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return {
    ...actual,
    Handle: () => null,
    useUpdateNodeInternals: () => vi.fn(),
  }
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) =>
    selector({
      highlightedNodes: new Set(),
      dimmedNodeIds: new Set(),
      lens: { _dimmedNodeIds: new Set() },
      results: { status: 'idle' },
      goalThreshold: null,
      goalConstraints: [],
      edges: [],
      viewMode: 'expert',
    })
  ),
}))

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null,
    influence: null,
    confidence: null,
    inSensitivityAnalysis: false,
    achievementProbability: null,
    winRate: null,
    isResultsMode: false,
  })),
}))

const baseProps = {
  id: 'node-1',
  selected: false,
  dragging: false,
  zIndex: 0,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  type: 'factor',
  xPos: 0,
  yPos: 0,
  deletable: true,
  selectable: true,
  draggable: true,
}

/** The exact labels Paul reported breaking mid-word on staging f2b48fc9. */
const REPORTED_LABEL = 'Team Coordination Overhead'

/**
 * Render at the compressed card width the layout pipeline actually produces —
 * the only width at which the defect appears.
 *
 * ⚠ IMPORTED, NOT RESTATED (17 Aug 2026). This was the literal `140`, written
 * when that happened to be `NODE_LAYOUT_MIN_W`. The floor now carries the canvas
 * label counter-scale (see `nodeLayoutConstants.ts`), and the literal did not —
 * so this spec, which exists to catch mid-word breaking, was rendering a card
 * the layout no longer produces and asserting a measure BaseNode correctly
 * refuses to give at that width. A test bound to a stale copy of a constant is
 * the mirror defect one level up (CLAUDE.md trap 12).
 */
function renderTitle(label: string = REPORTED_LABEL) {
  const { container } = render(
    <BaseNode
      {...baseProps}
      data={{ label }}
      nodeType="factor"
      icon={Target}
      maxWidth={NODE_LAYOUT_MIN_W}
    />
  )
  const title = container.querySelector('[data-testid="node-title"]') as HTMLElement | null
  expect(title, 'node-title must exist — bind by testid, not by class').toBeTruthy()
  return { container, title: title as HTMLElement }
}

describe('BaseNode — titles wrap at word boundaries (never mid-word)', () => {
  it('reserves a minimum title measure wide enough for an ordinary word', () => {
    const { title } = renderTitle()
    const wrapper = title.parentElement as HTMLElement

    // The title's flex wrapper must carry a real minimum measure. Without it
    // (`min-w-0`), the wrapper collapses to 77px inside a 140px card and
    // break-word splits "Coordination" mid-word.
    expect(wrapper.style.minWidth).toBe(`${NODE_TITLE_MIN_MEASURE_PX}px`)
    // The floor must hold an ordinary word at the size the text is ACTUALLY
    // rendered at. `>= 96` was the bound while canvas text rendered at its
    // declared 13px; it is now counter-scaled, so the bound has to scale too or
    // it certifies a measure half the size it needs to be — which is exactly how
    // #758 passed this file. Derivation and evidence: `nodeLabelFit.spec.ts`.
    //
    // ⚠ AND IT HAS TO TRACK THE DECLARED SIZE TOO (1 Sep 2026, title 13px →
    // 12px). This is the THIRD guard in this repo pinned to a 13px measurement
    // — the other two are in `nodeLabelFit.spec.ts` — and all three went red on
    // the type change, which is the system working: a font size is not a style
    // tweak here, it is a geometry input, and every bound derived from it has
    // to be re-derived out loud. `96` is the pre-#758 hand-set figure that
    // `nodeLabelFit.spec.ts` records as UNDER-derived (the measured value was
    // 97.77); it is scaled rather than corrected, because this assertion's job
    // is a conservative LOWER bound and raising it here would be a second,
    // quieter change riding along with the first.
    const ORDINARY_WORD_PX_AT_12 = 96 * (12 / 13)
    expect(NODE_TITLE_MIN_MEASURE_PX).toBeGreaterThanOrEqual(
      ORDINARY_WORD_PX_AT_12 * MAX_LABEL_COUNTER_SCALE,
    )
  })

  it('does not let the title shrink to zero (min-w-0 must not govern the title)', () => {
    const { title } = renderTitle()
    const wrapper = title.parentElement as HTMLElement

    // `min-w-0` is precisely the rule that permits a sub-word measure.
    expect(wrapper.className).not.toContain('min-w-0')
    expect(wrapper.style.minWidth).not.toBe('0px')
    expect(wrapper.style.minWidth).not.toBe('')
  })

  it('lets the header row wrap so the header slot yields instead of the title', () => {
    const { title } = renderTitle()
    const row = title.parentElement?.parentElement as HTMLElement

    // With a minimum title measure but a non-wrapping row, the shape indicator
    // and header slot would overflow the card instead of moving below.
    expect(row.style.flexWrap).toBe('wrap')
    expect(row.style.display).toBe('flex')
  })

  it('keeps break-words so a genuinely unbreakable token still wraps', () => {
    // break-word must REMAIN: a single 40-char token with no spaces has no word
    // boundary to wrap at, and must break rather than overflow the card.
    const { title } = renderTitle('Supercalifragilisticexpialidociousness')
    expect(title.className).toContain('break-words')
  })

  it('applies the contract to the exact label reported on staging f2b48fc9', () => {
    const { title } = renderTitle(REPORTED_LABEL)
    const wrapper = title.parentElement as HTMLElement

    expect(title.textContent).toBe(REPORTED_LABEL)
    // Bind the regression to the reported string by identity.
    expect(wrapper.style.minWidth).toBe(`${NODE_TITLE_MIN_MEASURE_PX}px`)
  })
})
