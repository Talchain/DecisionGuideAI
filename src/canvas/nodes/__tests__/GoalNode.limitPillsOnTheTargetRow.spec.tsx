/**
 * ⭐ THE GOAL'S TARGET ROW CARRIES THE USER-STATED LIMITS AS BOUNDARY PILLS —
 * NODE-ANATOMY v3.2 row "Goal", ED #63 5806207128 / 5806266691 choice 2.
 *
 *   Line 2    `Target: <amount> <mark>` + boundary pill(s) `Churn < 7%`
 *             ("user-stated limits live HERE"; ED: "Target: £20k/month
 *             Churn < 7%"). Missing target: `Target not captured` — ONE pill.
 *   Never     a second pill (in the missing state); the limit repeated on the
 *             constrained Factor (that half is FactorNode.anatomyV32.spec).
 *
 * The limit data already existed on this card — Layer 2 (popover in Standard,
 * inline in Detailed) listed every constraint as a `goal-constraint-badge`. The
 * resting face now carries the same limits, compact, in the contract's
 * `.pill.mini` (neutral hairline, radius 999, 1px 7px), with the full sentence
 * reachable on hover AND keyboard focus AND in the accessible name.
 *
 * ⚠ IDENTITY, NOT A VALUE PREDICATE. Every pill is bound by a test id that
 * carries the goal id and the constraint id, and every absence is paired with
 * a positive control in the same render (the target line, or the no-target
 * chip, is there) — a card that failed to mount cannot pass an absence.
 *
 * CLAIM SCOPE: jsdom — strings, test ids, class tokens and DOM containment.
 * Not pixels; the served witness at 1280×800 is the acceptance.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen, cleanup } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})
vi.mock('../../store', () => ({ useCanvasStore: vi.fn() }))
vi.mock('../../layoutStore', () => ({
  useLayoutStore: vi.fn(((s: (x: { layoutNodeWidth: number | null }) => unknown) =>
    s({ layoutNodeWidth: null })) as unknown as (...a: never[]) => unknown),
}))
vi.mock('../../ui/inspector-v2/useAnalysisResults', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../ui/inspector-v2/useAnalysisResults')>()),
  useHasAnyRealProbability: vi.fn(() => false),
}))
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({ useNodeDisplayMetadata: vi.fn() }))

import { useCanvasStore } from '../../store'
import { useNodeDisplayMetadata } from '../../hooks/useNodeDisplayMetadata'
import { GoalNode, GOAL_STATE_WORD_CLASSES } from '../GoalNode'

const baseProps = {
  selected: false, dragging: false, zIndex: 0, isConnectable: false,
  positionAbsoluteX: 0, positionAbsoluteY: 0, deletable: true, selectable: true, draggable: true,
}

const META = {
  sensitivityRank: null, influence: null, confidence: null, inSensitivityAnalysis: false,
  achievementProbability: null as number | null, goalFitAvailable: false, stabilityPercentage: null,
  winRate: null, isResultsMode: false, predictedOutcome: null, valueOfInformation: null, voiRank: null,
}

const GOAL_ID = 'goal-1'
const CHURN = { id: 'fac_churn', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Monthly churn', type: 'factor' } }
const NRR = { id: 'out_nrr', type: 'outcome', position: { x: 0, y: 0 }, data: { label: 'Net revenue retention', type: 'outcome' } }
/** The reader's own limit, stated in the brief: "keep monthly churn under 7%". */
const CHURN_LIMIT = { id: 'c_churn', node_id: 'fac_churn', operator: '<=', value: 7, unit: '%', provenance: 'explicit' }
const NRR_LIMIT = { id: 'c_nrr', node_id: 'out_nrr', operator: '>=', value: 110, unit: '%', provenance: 'explicit' }

function mockStore(over: Record<string, unknown> = {}) {
  vi.mocked(useCanvasStore).mockImplementation((selector: any) =>
    selector({
      hoveredOptionId: null,
      nodes: [CHURN, NRR],
      edges: [],
      ceeAnalysisReady: null,
      results: { status: 'idle', report: null },
      highlightedNodes: new Set(),
      dimmedNodeIds: new Set(),
      lens: { _dimmedNodeIds: new Set() },
      goalThreshold: null,
      goalConstraints: [CHURN_LIMIT],
      setHoveredOption: vi.fn(),
      viewMode: 'standard',
      analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match' },
      analysisFreshnessDirty: false,
      ...over,
    } as never),
  )
}

const WITH_TARGET = { goal_threshold_raw: '20000', goal_threshold_unit: '£' }

function renderGoal(data: Record<string, unknown>) {
  return render(
    <ReactFlowProvider>
      <GoalNode {...(baseProps as any)} id={GOAL_ID} type="goal" data={{ type: 'goal', label: 'Reach £20k MRR', ...data } as any} />
    </ReactFlowProvider>,
  )
}

const row = () => screen.getByTestId('goal-node-resting-state')
const pill = (constraintId: string) => screen.queryByTestId(`goal-limit-pill-${GOAL_ID}-${constraintId}`)
const allPills = () => screen.queryAllByTestId(new RegExp(`^goal-limit-pill-${GOAL_ID}-`))
const tokens = (el: Element | null): Set<string> => new Set((el?.getAttribute('class') ?? '').split(/\s+/).filter(Boolean))

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useNodeDisplayMetadata).mockReturnValue({ ...META } as never)
})
afterEach(() => cleanup())

describe('NODE-ANATOMY v3.2 · Goal · target + the user-stated limit on ONE row (ED choice 2)', () => {
  // Contract v3.1 `.pill.mini` (DESIGN-GAP-v31 #23): the pill SHOWS the short
  // form, the operator set against the figure as the contract spells it
  // ("Churn <4%"); the accessible name and tooltip keep the full sentence.
  it('the row reads "Target: £20,000" then the limit pill "Monthly churn ≤7%", in that order', () => {
    mockStore()
    renderGoal(WITH_TARGET)
    const target = screen.getByTestId('goal-target-route')
    const p = pill('c_churn')
    expect(p, 'the limit pill renders on the resting face').not.toBeNull()
    expect(p!.textContent).toBe('Monthly churn ≤7%')
    // The SAME row as the target, after it.
    expect(row().contains(target)).toBe(true)
    expect(row().contains(p!)).toBe(true)
    expect(Boolean(target.compareDocumentPosition(p!) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true)
  })

  it('it is the contract’s neutral .pill.mini — hairline, radius 999, 1px 7px — never a state word or an Info ring', () => {
    mockStore()
    renderGoal(WITH_TARGET)
    const t = tokens(pill('c_churn'))
    for (const cls of ['border', 'border-field/40', 'rounded-full', 'bg-panel', 'text-text-body', 'px-[7px]', 'py-px']) {
      expect(t.has(cls), `missing .pill.mini token "${cls}"`).toBe(true)
    }
    for (const cls of ['border-warning-ink/40', 'border-info', 'text-info', 'bg-warning/10', 'border-dashed']) {
      expect(t.has(cls), `carries non-neutral token "${cls}"`).toBe(false)
    }
    // Not the state-word anatomy of "Target not captured": a boundary is a fact, not a gap.
    expect(GOAL_STATE_WORD_CLASSES.split(/\s+/).every((c) => t.has(c))).toBe(false)
  })

  it('full detail on hover AND keyboard focus AND in the accessible name', async () => {
    mockStore()
    renderGoal(WITH_TARGET)
    const p = pill('c_churn')!
    expect(p.getAttribute('tabindex')).toBe('0')
    expect(p.getAttribute('aria-label')).toBe('Limit you set: Monthly churn ≤ 7%')
    act(() => p.focus())
    expect(document.activeElement).toBe(p)
    const tip = await screen.findByRole('tooltip')
    expect(tip).toHaveTextContent('Limit you set: Monthly churn ≤ 7%')
  })

  it('every stated limit gets its own pill, bound by its constraint id', () => {
    mockStore({ goalConstraints: [CHURN_LIMIT, NRR_LIMIT] })
    renderGoal(WITH_TARGET)
    expect(allPills()).toHaveLength(2)
    expect(pill('c_churn')!.textContent).toBe('Monthly churn ≤7%')
    expect(pill('c_nrr')!.textContent).toBe('Net revenue retention ≥110%')
  })

  it('an inferred limit is not dressed as the reader’s own: its origin rides the pill and its name', () => {
    mockStore({ goalConstraints: [{ ...CHURN_LIMIT, provenance: 'inferred' }] })
    renderGoal(WITH_TARGET)
    const p = pill('c_churn')!
    // ⛔ The short form drops words, never provenance.
    expect(p.textContent).toBe('Monthly churn ≤7% · Inferred limit')
    expect(p.getAttribute('aria-label')).toBe('Limit: Monthly churn ≤ 7% · Inferred limit')
  })

  it('after a run the pill states the boundary only — never the run’s satisfaction figure', () => {
    mockStore({
      results: { status: 'complete', report: { goal_constraints: [{ ...CHURN_LIMIT, probability: 0.62 }] } },
    })
    renderGoal(WITH_TARGET)
    const p = pill('c_churn')!
    expect(p.textContent).toBe('Monthly churn ≤7%')
    expect(p.getAttribute('aria-label')).not.toContain('62')
  })

  it('CONTRAST — no stated limit: the target stands alone, no pill', () => {
    mockStore({ goalConstraints: [] })
    renderGoal(WITH_TARGET)
    expect(screen.getByTestId('goal-target-route').textContent).toBe('Target: £20,000')
    expect(allPills()).toHaveLength(0)
  })
})

describe('NODE-ANATOMY v3.2 · Goal · missing target — ONE pill only', () => {
  it('"Target not captured" is the row’s only pill, even with a stated limit', () => {
    mockStore()
    renderGoal({})
    // Positive control: the missing state IS on the card.
    const chip = screen.getByTestId('goal-node-no-target-chip')
    expect(row().contains(chip)).toBe(true)
    expect(allPills()).toHaveLength(0)
  })
})

describe('NODE-ANATOMY v3.2 · Goal · Detailed states the limits once, in its details list', () => {
  it('Detailed: no resting pill; the Layer 2 constraint list carries the limit (one statement per view)', () => {
    mockStore({ viewMode: 'expert' })
    renderGoal(WITH_TARGET)
    // Positive control: Detailed shows the limit — in the details list.
    expect(screen.getAllByTestId('goal-constraint-badge')).toHaveLength(1)
    expect(allPills()).toHaveLength(0)
  })
})
