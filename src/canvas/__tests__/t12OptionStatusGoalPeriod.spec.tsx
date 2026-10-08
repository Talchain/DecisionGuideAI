/**
 * ⭐ T12 rows 1–2 (MG F1 spec §3 §1; schemas 0.69.0): the canvas SHOWS an option the user took out and the goal's
 * period / horizon. Paul, 1 Oct: the UI showed 4 options while the engine analysed 3, and he could not remove "carry on
 * as now". Bound by identity: the readers' exports, the cards' testids, and the DL's words (#85 5932328304).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'

import { OptionNode } from '../nodes/OptionNode'
import { optionTakenOut, optionTakenOutLine, OPTION_TAKEN_OUT_COPY } from '../domain/optionStatus'
import { goalPeriodHorizonLine, goalHorizonText, goalPeriodText } from '../domain/goalPeriodHorizon'
import { resolveLodMetricLine } from '../nodes/shared/lodMetricLine'
import { TAKEN_OUT_INFEASIBLE_LABEL, TAKEN_OUT_REMOVED_LABEL } from '../../components/results/utils/notAnalysedCopy'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

vi.mock('../store', () => ({ useCanvasStore: vi.fn() }))

vi.mock('../layoutStore', () => ({
  useLayoutStore: vi.fn(((selector: (s: { layoutNodeWidth: number | null }) => unknown) =>
    selector({ layoutNodeWidth: null })) as unknown as (...args: never[]) => unknown),
}))

import { useCanvasStore } from '../store'

const NODE_ID = 'option-1'
const SIBLING_ID = 'option-2'

const makeStoreState = (report: unknown) => ({
  hoveredOptionId: null,
  nodes: [
    { id: NODE_ID, type: 'option', data: { type: 'option' } },
    { id: SIBLING_ID, type: 'option', data: { type: 'option' } },
  ],
  edges: [],
  ceeAnalysisReady: null,
  results: { status: 'complete', report },
  highlightedNodes: new Set<string>(),
  dimmedNodeIds: new Set<string>(),
  optionNumbering: { [NODE_ID]: 1, [SIBLING_ID]: 2 },
  editedSinceRunNodeIds: new Set<string>(),
  olumiAttention: { nodeIds: [] as string[] },
  analysisHighlight: { source: null, edgeIds: new Set<string>(), nodeIds: new Set<string>() },
  lens: { _dimmedNodeIds: new Set<string>(), _hiddenNodeIds: new Set<string>(), active: 'full' },
  goalThreshold: null,
  goalConstraints: [],
  lodRung: 'full',
  viewMode: 'expert',
  setHoveredOption: vi.fn(),
  selectNodeWithoutHistory: vi.fn(),
})

const baseProps = {
  id: NODE_ID,
  type: 'option',
  position: { x: 0, y: 0 },
  selected: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
  deletable: true,
  selectable: true,
  draggable: true,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('T12 row 1 — the reader: positive equality on the two licensed words only', () => {
  it('infeasible / removed → the DL\'s words; feasible, absent and unknown → nothing', () => {
    expect(OPTION_TAKEN_OUT_COPY).toEqual({ infeasible: 'Taken out: not feasible', removed: 'Taken out' })
    // ONE wording: the card's words ARE the panel's exports (PANEL #2406), by identity.
    expect(OPTION_TAKEN_OUT_COPY.infeasible).toBe(TAKEN_OUT_INFEASIBLE_LABEL)
    expect(OPTION_TAKEN_OUT_COPY.removed).toBe(TAKEN_OUT_REMOVED_LABEL)
    expect(optionTakenOutLine({ option_status: 'infeasible' })).toBe('Taken out: not feasible')
    expect(optionTakenOutLine({ option_status: 'removed' })).toBe('Taken out')
    for (const d of [{ option_status: 'feasible' }, {}, { option_status: 'paused' }, { option_status: 1 }, null, undefined]) {
      expect(optionTakenOut(d), JSON.stringify(d)).toBeNull()
    }
    for (const w of Object.values(OPTION_TAKEN_OUT_COPY)) expect(w).not.toMatch(/compared/i)
  })
})

describe('T12 row 1 — the option card', () => {
  const renderWith = (data: Record<string, unknown>, report: unknown) => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      (selector as (s: unknown) => unknown)(makeStoreState(report)),
    )
    return render(
      <ReactFlowProvider>
        <OptionNode {...baseProps} data={{ label: 'Hire a Tech Lead', type: 'option', ...data }} />
      </ReactFlowProvider>,
    )
  }
  const takenOut = () => screen.queryByTestId(`option-taken-out-${NODE_ID}`)
  const notAnalysed = () => screen.queryByTestId(`option-not-analysed-${NODE_ID}`)
  const leftOut = { option_probabilities: { [SIBLING_ID]: { win_probability: 0.6 } } }

  it('⭐ a removed option, left out of the Run, says "Taken out" — never "Not analysed" or a share', () => {
    renderWith({ option_status: 'removed' }, leftOut)
    expect(takenOut()?.textContent).toBe('Taken out')
    expect(notAnalysed()).toBeNull()
    expect(screen.queryByTestId(`option-win-readout-${NODE_ID}`)).toBeNull()
  })

  it('CONTROL: the same left-out option with no status keeps its "Not analysed" state', () => {
    renderWith({}, leftOut)
    expect(takenOut()).toBeNull()
    expect(notAnalysed()).not.toBeNull()
  })

  it('an infeasible option says why, and stays on the board (the name is still drawn)', () => {
    renderWith({ option_status: 'infeasible' }, leftOut)
    expect(takenOut()?.textContent).toBe('Taken out: not feasible')
    expect(screen.getByText('Hire a Tech Lead')).toBeInTheDocument()
  })

  it('the status is a model fact: it shows before any Run too', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      (selector as (s: unknown) => unknown)({ ...makeStoreState(null), results: { status: 'idle', report: null } }),
    )
    render(
      <ReactFlowProvider>
        <OptionNode {...baseProps} data={{ label: 'Hire a Tech Lead', type: 'option', option_status: 'removed' }} />
      </ReactFlowProvider>,
    )
    expect(takenOut()?.textContent).toBe('Taken out')
  })

  it('the reduced line says the same words, before any share or marker', () => {
    const meta = { isResultsMode: true, winRate: 0.4 } as never
    const at = (facts: Record<string, unknown>) =>
      resolveLodMetricLine({ nodeType: 'option', data: {}, label: 'Hire a Tech Lead', displayMetadata: meta, facts: facts as never })
    expect(at({ optionTakenOutLine: 'Taken out', winSharesWithheld: true })).toBe('Taken out')
    // CONTROL: without the fact the same inputs reach the withheld marker.
    expect(at({ winSharesWithheld: true })).not.toBe('Taken out')
  })
})

describe('T12 row 2 — the goal\'s period and horizon', () => {
  it('renders CEE\'s flat goal_horizon_months when the nested horizon is absent', () => {
    expect(goalHorizonText({ goal_horizon_months: 9 })).toBe('within 9 months')
  })

  it('keeps the nested deadline authoritative over flat months', () => {
    expect(goalHorizonText({
      goal_horizon: { deadline: '2027-03-31' },
      goal_horizon_months: 9,
    })).toBe('by 31 Mar 2027')
  })

  it.each([0, -1, 1.5, '9', 121, Number.POSITIVE_INFINITY])(
    'rejects malformed flat goal_horizon_months %p',
    (goal_horizon_months) => {
      expect(goalHorizonText({ goal_horizon_months })).toBeNull()
    },
  )

  it('uses singular month for a flat one-month horizon', () => {
    expect(goalHorizonText({ goal_horizon_months: 1 })).toBe('within 1 month')
  })

  it('⭐ "per quarter · within 6 months" and "by 31 Mar 2027"; none and absent say nothing', () => {
    expect(goalPeriodHorizonLine({ goal_period: 'quarter', goal_horizon: { months: 6 } })).toBe('per quarter · within 6 months')
    expect(goalPeriodHorizonLine({ goal_horizon: { deadline: '2027-03-31' } })).toBe('by 31 Mar 2027')
    expect(goalHorizonText({ goal_horizon: { months: 1 } })).toBe('within 1 month')
    expect(goalPeriodText({ goal_period: 'none' })).toBeNull()
    expect(goalPeriodHorizonLine({})).toBeNull()
  })

  it('⛔ never parses the unit string for a period, and never renders an unknown or malformed value', () => {
    expect(goalPeriodHorizonLine({ goal_threshold_unit: 'GBP per month' })).toBeNull()
    expect(goalPeriodText({ goal_period: 'fortnight' })).toBeNull()
    expect(goalHorizonText({ goal_horizon: { deadline: '31/03/2027' } })).toBeNull()
    expect(goalHorizonText({ goal_horizon: { deadline: '2027-13-01' } })).toBeNull()
    expect(goalHorizonText({ goal_horizon: { months: 0 } })).toBeNull()
  })
})
