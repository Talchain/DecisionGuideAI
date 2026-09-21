/**
 * Zooming out must not make a number look more certain than it is.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE DEFECT — measured in Paul's manual test, 21 Sep, screenshot 7
 * ─────────────────────────────────────────────────────────────────────────────
 * At the reduced rung the cards read `0.4`, `£30,000`, `0.2`. At full zoom the
 * same cards read `0.4 est.` — **the figure survives and its provenance does
 * not.** The further out you zoom, the more authoritative Olumi's own guess
 * looks, which is the opposite of what a reduced view should cost you.
 *
 * ⭐ NOTHING NEW IS INVENTED, WHICH IS THIS LANE'S RECURRING SHAPE. The mark,
 * its meaning, its hover sentence and its glossary row all shipped long ago.
 * `FactorNode:199` gates it; `CanvasLegendPopover:929` re-types that gate to
 * decide whether the glossary may promise a marker, and says in its own comment
 * that it is copying this line. The reduced line — which IS the whole card
 * below the legibility floor — had no copy at all. One owner, three readers.
 *
 * ⛔ THE MARK NAMES A FACTOR'S OWN VALUE AND NOTHING ELSE (trap 21). The factor
 * arm of the resolver has three branches and only the first states that value;
 * the others state an INFLUENCE SCORE and a PRIOR RANGE. Marking those would
 * point the disclosure at the wrong number, which is worse than the omission
 * being fixed — so the arm that produces the string decides the mark, and the
 * last test here pins that.
 *
 * CLAIM SCOPE (trap 3): jsdom proves PRESENCE and STRUCTURE, never pixels. The
 * `shrink-0` assertion is a claim about the class the element carries, which is
 * what makes the layout claim checkable at all.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { FactorNode } from '../FactorNode'
import { UNCONFIRMED_ESTIMATE_TOKEN } from '../../domain/vocabulary'
import { resolveLodMetricLineDetail } from '../shared/lodMetricLine'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

let storeState: Record<string, unknown> = {}

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector: (s: unknown) => unknown) => selector(storeState)),
}))

let displayMetadata: Record<string, unknown> = {}

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => displayMetadata),
}))

const NODE_ID = 'fac_conversion_rate'

const baseMetadata = {
  sensitivityRank: null,
  influence: null,
  influenceProvenance: null,
  confidence: null,
  inSensitivityAnalysis: false,
  achievementProbability: null,
  achievementProbabilityIsModelledBasis: null,
  stabilityPercentage: null,
  winRate: null,
  isResultsMode: false,
}

/** `lodRung: 'line'` IS the reduced rung — the same field the card reads. */
const makeStore = (nodeData: Record<string, unknown>) => ({
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
  nodes: [{ id: NODE_ID, type: 'factor', data: nodeData }],
  viewMode: 'standard',
  lodRung: 'line',
})

const baseProps = {
  id: NODE_ID,
  type: 'factor',
  position: { x: 0, y: 0 },
  selected: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
}

/**
 * ⚠ THE FIXTURE IS THE MEASURED WIRE SHAPE, NOT THE ONE I FIRST WROTE. A bare
 * `{ value: 0.4 }` with no unit and no `display_value` produces NO display text
 * at all — correctly, because nothing anchors the scale — so a spec built from
 * the type definition asserts against a card showing nothing. Measured on the
 * deployed board: `unit` 0 of 8 factors, `display_value` 7 of 8. The cards that
 * print a figure at all are printing CEE's own authored string.
 *
 * A factor whose value Olumi filled in — the marked case.
 */
const INFERRED = {
  label: 'Conversion Rate',
  kind: 'factor',
  category: 'controllable',
  display_value: '0.4',
  observedState: { value: 0.4, source: 'cee_inference', extractionType: 'inferred' },
}

/** The same factor after a human typed the number — the contrast. */
const USER_STATED = {
  label: 'Conversion Rate',
  kind: 'factor',
  category: 'controllable',
  display_value: '0.4',
  observedState: { value: 0.4, source: 'user_override' },
}

const renderAtLineRung = (nodeData: Record<string, unknown>) => {
  storeState = makeStore(nodeData)
  return render(
    <ReactFlowProvider>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <FactorNode {...(baseProps as any)} data={nodeData as any} />
    </ReactFlowProvider>,
  )
}

describe('the est. mark survives the zoom that hides the card body', () => {
  beforeEach(() => {
    displayMetadata = { ...baseMetadata }
  })

  it('⭐ marks an inferred value at the reduced rung — RED at pristine, where only the number showed', () => {
    renderAtLineRung(INFERRED)
    expect(screen.getByTestId('node-lod-line').textContent).toContain('0.4')
    expect(screen.getByTestId('node-lod-estimate-mark').textContent?.trim()).toBe(
      UNCONFIRMED_ESTIMATE_TOKEN,
    )
  })

  it('CONTRAST — a value the reader typed is never marked, so the mark is not simply always on', () => {
    renderAtLineRung(USER_STATED)
    expect(screen.getByTestId('node-lod-line').textContent).toContain('0.4')
    expect(screen.queryByTestId('node-lod-estimate-mark')).toBeNull()
  })

  it('⛔ the mark is OUTSIDE the truncating element, so an ellipsis eats the number and never the disclosure', () => {
    renderAtLineRung(INFERRED)
    const line = screen.getByTestId('node-lod-line')
    const mark = screen.getByTestId('node-lod-estimate-mark')
    // Putting the token in the STRING would make it the first thing truncated —
    // the number surviving and the disclosure vanishing, which is the defect
    // this file closes, rebuilt by its own fix.
    expect(line.textContent).not.toContain(UNCONFIRMED_ESTIMATE_TOKEN)
    expect(line.className).toContain('truncate')
    expect(mark.className).toContain('shrink-0')
    expect(mark.className).not.toContain('truncate')
    expect(line.contains(mark)).toBe(false)
  })
})

describe('the mark names the factor’s own value and no other number', () => {
  const influenceOnly = {
    label: 'Conversion Rate',
    kind: 'factor',
    category: 'controllable',
    // No value at all — the resolver falls through to the influence arm, which
    // states a DIFFERENT object. `extractionType` is still 'inferred'.
    observedState: { source: 'cee_inference', extractionType: 'inferred' },
  }

  it('withholds the mark where the line states an influence score, not a value', () => {
    const detail = resolveLodMetricLineDetail({
      nodeType: 'factor',
      data: influenceOnly,
      label: 'Conversion Rate',
      displayMetadata: {
        ...baseMetadata,
        influence: 0.62,
        influenceProvenance: 'analysis',
      } as never,
    })
    expect(detail.text, 'the influence arm produced no line — fixture is vacuous').toContain('62%')
    expect(detail.unconfirmedEstimate).toBe(false)
  })

  it('PINS THE PRECONDITION — where the mark IS set, the line is the stated value itself (trap 13b)', () => {
    const detail = resolveLodMetricLineDetail({
      nodeType: 'factor',
      data: INFERRED,
      label: 'Conversion Rate',
      // An influence score is ALSO available here. If the arms were ever
      // reordered, the line would become the influence score while the mark
      // stayed set — the wrong-object failure this asserts cannot happen.
      displayMetadata: {
        ...baseMetadata,
        influence: 0.62,
        influenceProvenance: 'analysis',
      } as never,
    })
    expect(detail.unconfirmedEstimate).toBe(true)
    expect(detail.text).toContain('0.4')
    expect(detail.text).not.toContain('62%')
  })
})
