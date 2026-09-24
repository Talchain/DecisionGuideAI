/**
 * ⭐ THE OPTION CARD'S DIFFERENTIATOR SAYS SOMETHING THE ROWS DON'T, OR NOTHING
 * — NODE-ANATOMY v3.2 row "Option" (ED #63 5806266691: "Keep the rest of v32
 * as stated: ≤2 option change rows + `+N more`; differentiator only when
 * additive").
 *
 *   Line 2    the delta grid, max 2 rows + `+N more`; then ONE differentiator
 *             line, ONLY if it adds something the rows don't — not
 *             "<only row> is the key difference".
 *
 * What "adds" means, derived from the two sentence forms
 * `computeAllDifferentiators` builds:
 *   · it names a change the card does NOT show (it sits behind `+N more`) → adds;
 *   · "<X> is the key difference" where X is one of SEVERAL changes → adds
 *     (it says which one matters);
 *   · "<X> is the key difference" where X is the option's ONLY change → adds
 *     nothing (the one row IS the difference);
 *   · "<X> → <value>" / a direction, where X is a shown row → repeats the row.
 *
 * Supersedes Paul's 10 Sep "both stay" for the REPEATING cases only; where the
 * sentence adds, both still stay.
 *
 * ⚠ IDENTITY: every row and line is bound by a test id carrying the option id
 * (and factor id), and every absence has a positive control in the same render.
 *
 * CLAIM SCOPE: jsdom — test ids and text. Not pixels.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { OptionNode } from '../OptionNode'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const FACTOR_HEAD = {
  id: 'f-head', type: 'factor',
  data: { label: 'Developer headcount', type: 'factor', observedState: { value: 0, unit: 'count' }, unit: 'count' },
}
const FACTOR_COST = { id: 'f-cost', type: 'factor', data: { label: 'Coordination cost', type: 'factor', observedState: { value: 0 } } }
const FACTOR_RISK = { id: 'f-risk', type: 'factor', data: { label: 'Delivery risk', type: 'factor', observedState: { value: 0 } } }
const OPTION_1 = { id: 'option-1', type: 'option', data: { label: 'Hire two developers', type: 'option' } }
const OPTION_2 = { id: 'option-2', type: 'option', data: { label: 'Hire a tech lead', type: 'option' } }
const BASELINE = {
  id: 'option-b', type: 'option',
  data: { label: 'Status quo', type: 'option', is_baseline: true, interventions: {} },
}

let ceeReady: unknown = null

const makeStoreState = () => ({
  hoveredOptionId: null,
  nodes: [FACTOR_HEAD, FACTOR_COST, FACTOR_RISK, OPTION_1, OPTION_2, BASELINE],
  edges: [],
  ceeAnalysisReady: ceeReady,
  results: { status: 'idle' },
  highlightedNodes: new Set(),
  dimmedNodeIds: new Set(),
  lens: { _dimmedNodeIds: new Set() },
  goalThreshold: null,
  goalConstraints: [],
  setHoveredOption: vi.fn(),
  viewMode: 'standard',
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) => selector(makeStoreState())),
}))
vi.mock('../../layoutStore', () => ({
  useLayoutStore: vi.fn(((selector: (s: { layoutNodeWidth: number | null }) => unknown) =>
    selector({ layoutNodeWidth: null })) as unknown as (...args: never[]) => unknown),
}))
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null, influence: null, confidence: null, inSensitivityAnalysis: false,
    achievementProbability: null, stabilityPercentage: null, winRate: null, isResultsMode: false,
    predictedOutcome: null, valueOfInformation: null, voiRank: null,
  })),
}))

import { useCanvasStore } from '../../store'

const baseProps = {
  type: 'option', position: { x: 0, y: 0 }, selected: false, isConnectable: true,
  positionAbsoluteX: 0, positionAbsoluteY: 0, dragging: false, zIndex: 0,
  deletable: true, selectable: true, draggable: true,
}

const renderOption1 = (options: Array<{ id: string; interventions: Record<string, unknown> }>) => {
  ceeReady = { options }
  vi.mocked(useCanvasStore).mockImplementation((selector) => selector(makeStoreState() as any))
  return render(
    <ReactFlowProvider>
      <OptionNode {...baseProps} id="option-1" data={{ label: 'Hire two developers', type: 'option' }} />
    </ReactFlowProvider>,
  )
}

const row = (factorId: string) => screen.queryByTestId(`option-change-row-option-1-${factorId}`)
const differentiator = () => screen.queryByTestId('option-differentiator-option-1')

describe('NODE-ANATOMY v3.2 · Option · the differentiator only when it adds beyond the rows', () => {
  it('ONE change → no "<only row> is the key difference": the row already is the difference', () => {
    renderOption1([
      { id: 'option-1', interventions: { 'f-head': { value: 3, display_value: '3 engineers' } } },
      { id: 'option-2', interventions: { 'f-cost': 5 } },
    ])
    // Positive control: the option's one change IS on the card.
    expect(row('f-head')).not.toBeNull()
    expect(screen.queryByTestId('option-change-more-option-1')).toBeNull()
    expect(differentiator()).toBeNull()
    expect(document.body.textContent).not.toContain('is the key difference')
  })

  it('CONTRAST — TWO changes: "<X> is the key difference" names which shown row matters, so it stays', () => {
    renderOption1([
      { id: 'option-1', interventions: { 'f-head': { value: 6, display_value: '6 engineers' }, 'f-cost': 2 } },
      { id: 'option-2', interventions: { 'f-cost': 2 } },
    ])
    expect(row('f-head')).not.toBeNull()
    expect(row('f-cost')).not.toBeNull()
    expect(differentiator()?.textContent).toBe('Developer headcount is the key difference')
  })

  it('it names a change hidden behind "+N more" → it adds, so it stays', () => {
    // Short values, so the two-row budget binds (a long value drops to ONE row).
    const head = { value: 2, display_value: '2 engineers' }
    const cost = { value: 3, display_value: '£3k' }
    renderOption1([
      { id: 'option-1', interventions: { 'f-head': head, 'f-cost': cost, 'f-risk': { value: 9, display_value: '9 incidents' } } },
      { id: 'option-2', interventions: { 'f-head': head, 'f-cost': cost } },
    ])
    // ≤2 rows + "+1 more": the shared order puts the common changes first.
    expect(row('f-head')).not.toBeNull()
    expect(row('f-cost')).not.toBeNull()
    expect(row('f-risk')).toBeNull()
    expect(screen.getByTestId('option-change-more-option-1').textContent).toBe('+1 more')
    expect(differentiator()?.textContent).toBe('Delivery risk is the key difference')
  })

  it('"<X> → <value>" where X is a SHOWN row repeats the row, so it goes', () => {
    // Both options claim headcount → the shared-factor value form.
    renderOption1([
      { id: 'option-1', interventions: { 'f-head': { value: 6, display_value: '6 engineers' }, 'f-cost': 2 } },
      { id: 'option-2', interventions: { 'f-head': { value: 1, display_value: '1 engineer' }, 'f-cost': 2 } },
    ])
    expect(row('f-head')?.textContent).toContain('6 engineers')
    expect(differentiator()).toBeNull()
    expect(document.body.textContent).not.toContain('Developer headcount → 6 engineers')
  })

  it('≤2 change rows at rest, then "+N more" from the one total', () => {
    const head = { value: 2, display_value: '2 engineers' }
    const cost = { value: 3, display_value: '£3k' }
    renderOption1([
      { id: 'option-1', interventions: { 'f-head': head, 'f-cost': cost, 'f-risk': { value: 9, display_value: '9 incidents' } } },
      { id: 'option-2', interventions: { 'f-head': head, 'f-cost': cost, 'f-risk': { value: 1, display_value: '1 incident' } } },
    ])
    const rows = screen.getAllByTestId(/^option-change-row-option-1-f-/)
    expect(rows).toHaveLength(2)
    expect(screen.getByTestId('option-change-more-option-1').textContent).toBe('+1 more')
  })
})
