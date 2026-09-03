/**
 * ⭐ A HALF-FULL BAR MUST NOT BE DRAWN FOR A STRENGTH NOBODY SET.
 *
 * THE DEFECT, WITNESSED ON A REAL USER'S SCREEN (3 Sep 2026). Five cards on one
 * canvas — MRR Growth Rate, Trial-to-Paid Conversion Uplift, Churn Rate
 * Deterioration, Customer Acquisition Cost, Runway Depletion Risk — each read
 * `Strength 50% est.` and each drew a progress bar EXACTLY HALF FULL. That is
 * the no-information default rendered in measurement grammar: the bar length
 * encodes a magnitude on the same scale an option's computed win share uses,
 * and the only qualification was `est.` at 7px.
 *
 * ⛔ THE PREDICATE IS `weightSource === 'user'`, AND IT IS NOT A NEW JUDGEMENT.
 * `selectAssumedStrengthToResolve` (`components/results/strengthElicitation`)
 * already owns "does this strength still need human judgement", and already
 * rules that a CEE-supplied number is ASSUMED — verbatim: *"a CEE numeric
 * estimate does not resolve itself merely because ingestion stamped
 * `weightSource: 'cee'`"*. Minting a second answer here would be this estate's
 * signature defect (CLAUDE.md trap 21). So the same boundary decides the row.
 *
 * ⚠ THE NUMBER IS DEMOTED, NOT DELETED. A producer's assumed figure still
 * reaches the reader — on the row's `title` and its screen-reader phrase, where
 * it is stated as an assumption. What it loses is the bar and the face-value
 * percentage, which are the two elements that claim measurement.
 *
 * ⚠ AND THE ROW STAYS. Deleting it would read as "nothing to see"; the reader
 * needs to know the connection exists and that its strength is an open
 * question. The three cases are pinned as a set below, because a fix that
 * closes a lie by opening a gap is this estate's trap 22b.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { RiskNode } from '../RiskNode'
import { OutcomeNode } from '../OutcomeNode'
import { METRIC_UNSET } from '../shared/metricVocabulary'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const makeStoreState = (overrides: Record<string, unknown> = {}) => ({
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
  lodRung: 'full',
  ...overrides,
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) => selector(makeStoreState())),
}))

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
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
  })),
}))

import { useCanvasStore } from '../../store'

const baseProps = {
  position: { x: 0, y: 0 },
  selected: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
}

/**
 * The bridge edge in three provenance states, in the shapes a PRODUCER actually
 * sends (derived from `lodMetric.riskOutcome.spec.tsx`'s measured fixture, not
 * from the type definition):
 *
 *   'cee'     `strength_mean` present, no explicit stamp — the documented
 *             producer-only fallback, and the state the five witnessed cards
 *             were in.
 *   'user'    an explicit `weightSource: 'user'` stamp, written only by the
 *             strength editor.
 *   'none'    a bare `weight`, which every `DEFAULT_EDGE_DATA` edge carries and
 *             which `resolveEdgeSignedStrengthDisplay` refuses.
 */
const modelWithBridge = (
  nodeId: string,
  kind: string,
  provenance: 'cee' | 'user' | 'none',
  strength = 0.5,
  lodRung: 'full' | 'line' = 'full',
) => ({
  lodRung,
  nodes: [
    { id: nodeId, type: kind, data: { type: kind } },
    { id: 'goal-1', data: { type: 'goal' } },
  ],
  edges: [
    {
      id: 'e1',
      source: nodeId,
      target: 'goal-1',
      data:
        provenance === 'user'
          ? { weight: strength, direction: 'negative', beliefExists: null, weightSource: 'user' }
          : provenance === 'cee'
            ? { strength_mean: strength, direction: 'negative', beliefExists: null }
            : { weight: strength, direction: 'negative', beliefExists: null },
    },
  ],
})

const mountRisk = (state: Record<string, unknown>) => {
  vi.mocked(useCanvasStore).mockImplementation(sel => sel(state as any))
  render(
    <ReactFlowProvider>
      <RiskNode {...(baseProps as any)} type="risk" id="risk-1" data={{ label: 'Runway Depletion Risk', type: 'risk' }} />
    </ReactFlowProvider>,
  )
}

const mountOutcome = (state: Record<string, unknown>) => {
  vi.mocked(useCanvasStore).mockImplementation(sel => sel(state as any))
  render(
    <ReactFlowProvider>
      <OutcomeNode {...(baseProps as any)} type="outcome" id="outcome-1" data={{ label: 'MRR Growth Rate', type: 'outcome' }} />
    </ReactFlowProvider>,
  )
}

/**
 * ⭐ THE BAR, BY IDENTITY. `NodeMetricRow`'s fill is the ONLY element inside the
 * row that carries an inline `width` style, and it is found INSIDE the row's own
 * testid — never by a class another element could also carry, and never by a
 * value predicate (`width: 50%`) that a differently-derived element could
 * satisfy. Returns the fill's declared width, or `null` when no bar was drawn.
 */
const barWidthIn = (testId: string): string | null => {
  const row = screen.queryByTestId(testId)
  if (row === null) return null
  const filled = Array.from(row.querySelectorAll<HTMLElement>('div[style]'))
    .filter(el => el.style.width !== '')
  return filled.length === 0 ? null : filled[filled.length - 1]!.style.width
}

/**
 * ⭐ THE VISIBLE TEXT ONLY, AND THE DISTINCTION IS THE WHOLE POINT OF THE FIX.
 *
 * `textContent` on the row also picks up the screen-reader phrase — which is
 * exactly where the producer's assumed figure was MOVED to. Asserting "no
 * percentage" against the whole row would therefore refuse the demotion this
 * change is built on. `NodeMetricRow` marks every seen element `aria-hidden`
 * and carries the sentence in a separate `sr-only` span, so the two audiences
 * are already separated at the DOM; this reads the seen half.
 */
const seenTextIn = (testId: string): string => {
  const row = screen.queryByTestId(testId)
  if (row === null) return ''
  return Array.from(row.querySelectorAll('[aria-hidden="true"]'))
    .map(el => el.textContent ?? '')
    .join(' ')
}

const lodLine = () => screen.queryByTestId('node-lod-line')?.textContent ?? null

beforeEach(() => { vi.clearAllMocks() })

describe('⛔ the witnessed defect: a bar drawn for a strength nobody set', () => {
  it('a risk whose bridge strength CEE supplied draws NO bar and states no percentage', () => {
    mountRisk(makeStoreState(modelWithBridge('risk-1', 'risk', 'cee', 0.5)))
    screen.getByTestId('risk-strength-row')
    expect(barWidthIn('risk-strength-row')).toBeNull()
    expect(seenTextIn('risk-strength-row')).not.toMatch(/\d+%/)
  })

  it('an outcome does the same, from the same seam', () => {
    mountOutcome(makeStoreState(modelWithBridge('outcome-1', 'outcome', 'cee', 0.5)))
    expect(barWidthIn('outcome-strength-row')).toBeNull()
    expect(seenTextIn('outcome-strength-row')).not.toMatch(/\d+%/)
  })

  it('the row STAYS, and says what is unknown rather than vanishing', () => {
    mountRisk(makeStoreState(modelWithBridge('risk-1', 'risk', 'cee', 0.5)))
    const row = screen.getByTestId('risk-strength-row')
    expect(row.textContent).toContain('Strength')
    expect(row.textContent).toContain(METRIC_UNSET.standalone)
  })

  it('and it names the way out, in words a reader can act on', () => {
    mountRisk(makeStoreState(modelWithBridge('risk-1', 'risk', 'cee', 0.5)))
    const row = screen.getByTestId('risk-strength-row')
    // Both carriers, per `NodeMetricRow`'s two-carrier rule: a `title` is
    // unreachable by keyboard and absent on touch, so the sentence rides the
    // screen-reader phrase independently.
    expect(row.getAttribute('title')).toMatch(/Open the details/)
    expect(row.textContent).toMatch(/Open the details/)
  })

  it('⭐ the producer figure is DEMOTED, not deleted — it is disclosed as an assumption', () => {
    mountRisk(makeStoreState(modelWithBridge('risk-1', 'risk', 'cee', 0.5)))
    const title = screen.getByTestId('risk-strength-row').getAttribute('title') ?? ''
    expect(title).toContain('50%')
    expect(title).toMatch(/assum/i)
  })
})

describe('⭐ THE DISCRIMINATING PAIR — the row reads the PROVENANCE, not the number', () => {
  /*
   * Same node, same 0.5, three provenances. If the bar were unconditional all
   * three would draw one; if it were removed outright none would. One of each is
   * the only result that shows `weightSource` is being read — and the
   * user-stated arm is the opposite-direction twin (trap 22b): a fix for a lie
   * must not be able to delete a figure that was already honest.
   */
  it('a strength the USER set keeps its bar and its percentage — unchanged', () => {
    mountRisk(makeStoreState(modelWithBridge('risk-1', 'risk', 'user', 0.5)))
    expect(barWidthIn('risk-strength-row')).toBe('max(4px, 50%)')
    expect(screen.getByTestId('risk-strength-row').textContent).toContain('50%')
  })

  it('a strength the user set at a DIFFERENT magnitude draws a DIFFERENT bar', () => {
    // Binds the bar to the value rather than to the mere fact of being stated.
    mountRisk(makeStoreState(modelWithBridge('risk-1', 'risk', 'user', 0.8)))
    expect(barWidthIn('risk-strength-row')).toBe('max(4px, 80%)')
  })

  it('a bridge edge carrying NO stated strength at all still gets the row', () => {
    // Previously this rendered NOTHING — the provenance gate withheld and the
    // card fell silent, which reads as "nothing to see". The connection exists.
    mountRisk(makeStoreState(modelWithBridge('risk-1', 'risk', 'none', 0.5)))
    const row = screen.getByTestId('risk-strength-row')
    expect(row.textContent).toContain(METRIC_UNSET.standalone)
    expect(barWidthIn('risk-strength-row')).toBeNull()
    // ⚠ AND IT MUST NOT CLAIM AN ASSUMPTION NOBODY MADE. Nothing supplied a
    // figure here, so the disclosure may not invent one.
    expect(row.getAttribute('title') ?? '').not.toMatch(/\d+%/)
  })

  it('CONTRAST CONTROL — no bridge edge, no row: absence of a connection is not an unknown strength', () => {
    mountRisk(makeStoreState({ nodes: [{ id: 'risk-1', type: 'risk', data: { type: 'risk' } }], edges: [] }))
    expect(screen.queryByTestId('risk-strength-row')).toBeNull()
  })
})

describe('the reduced line below the legibility floor says the same true thing', () => {
  it('states the unknown rather than a half-full-bar percentage', () => {
    mountRisk(makeStoreState(modelWithBridge('risk-1', 'risk', 'cee', 0.5, 'line')))
    expect(lodLine()).toBe(`Strength ${METRIC_UNSET.inline}`)
  })

  it('and still states a percentage the user set themselves', () => {
    mountRisk(makeStoreState(modelWithBridge('risk-1', 'risk', 'user', 0.5, 'line')))
    expect(lodLine()).toBe('Strength 50%')
  })

  it('an outcome behaves identically at the same rung', () => {
    mountOutcome(makeStoreState(modelWithBridge('outcome-1', 'outcome', 'cee', 0.7, 'line')))
    expect(lodLine()).toBe(`Strength ${METRIC_UNSET.inline}`)
  })
})
