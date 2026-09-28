/**
 * ⭐⭐ ONE LIMIT, STATED ONCE — side-by-side DIFF pre-run item 7 (28 Sep 2026,
 * `canvas-8ffc-work/sbs3/DIFF.md`; NODE-ANATOMY v3.2 principle 2 "One statement
 * per fact on the whole canvas").
 *
 * The Outcome's limit line was KEPT by a ruling whose premise was "the Goal
 * shows no limit pills without a target". Served `b40d5436`, pricing starter:
 * the Goal HAS a target (`Target: 110%`) and shows the pill
 * `Net Revenue Retention ≥110%`, and the `Net Revenue Retention` outcome still
 * read `Limit ≥ 110%` — the same constraint row, twice, in two formats.
 *
 * Now the Outcome drops a limit line ONLY when the Goal card already shows THAT
 * constraint row (`goalCardShownLimits` — the function the Goal's pill row
 * calls — matched by row identity). Otherwise the line stays:
 *   · a Goal with no target in Standard view shows no pills → the line stays;
 *   · Detailed view lists the Goal's limits inline → the line goes.
 *
 * FIXTURE: the shipped pricing starter's goal, outcome and its one constraint
 * row (`constraint_out_nrr_min`), verbatim. Both cards render from ONE store,
 * so "the Goal shows it" is read off the rendered Goal, not assumed.
 *
 * CLAIM SCOPE (trap 3): jsdom — text and test ids.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})
vi.mock('../../store', () => ({ useCanvasStore: vi.fn() }))
vi.mock('../../layoutStore', () => ({
  useLayoutStore: vi.fn(((s: (x: { layoutNodeWidth: number | null; layoutCardWidths: null }) => unknown) =>
    s({ layoutNodeWidth: null, layoutCardWidths: null })) as unknown as (...a: never[]) => unknown),
}))
vi.mock('../../ui/inspector-v2/useAnalysisResults', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../ui/inspector-v2/useAnalysisResults')>()),
  useHasAnyRealProbability: vi.fn(() => false),
}))
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({ useNodeDisplayMetadata: vi.fn() }))
vi.mock('../../../flags', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  isGraphBadgesEnabled: () => false,
}))

import { useCanvasStore } from '../../store'
import { useNodeDisplayMetadata } from '../../hooks/useNodeDisplayMetadata'
import { GoalNode } from '../GoalNode'
import { OutcomeNode } from '../OutcomeNode'
import { mapDraftNodeToCanvas } from '../../utils/applyDraftResult'
import { goalCardShownLimits, sameConstraintRow } from '../../domain/goalOwnTargetRow'
import pricingStarter from '../../starters/data/pricing-model.draft.json'

type CanvasNode = { id: string; type: string; data: Record<string, unknown> }
const draft = pricingStarter as unknown as { nodes: unknown[]; goal_constraints: Array<Record<string, unknown>> }
const NODES = draft.nodes.map(mapDraftNodeToCanvas) as CanvasNode[]
const GOAL = NODES.find(n => n.type === 'goal')!
const OUTCOME = NODES.find(n => n.id === 'out_nrr')!
/** The starter's one constraint row, verbatim: "net revenue retention above 110%". */
const NRR_LIMIT = draft.goal_constraints.find(c => c.constraint_id === 'constraint_out_nrr_min')!

const META = {
  sensitivityRank: null, influence: null, confidence: null, inSensitivityAnalysis: false,
  achievementProbability: null as number | null, goalFitAvailable: false, stabilityPercentage: null,
  winRate: null, isResultsMode: false, predictedOutcome: null, valueOfInformation: null, voiRank: null,
}

function mockStore(nodes: CanvasNode[], constraints: unknown[], viewMode: 'standard' | 'expert' = 'standard') {
  const state = {
    selectedNodeId: null, hoveredOptionId: null, setHoveredOption: vi.fn(),
    nodes, edges: [], ceeAnalysisReady: null, results: { status: 'idle', report: null },
    highlightedNodes: new Set(), dimmedNodeIds: new Set(), editedSinceRunNodeIds: new Set(),
    analysisHighlight: { source: null, edgeIds: new Set(), nodeIds: new Set() },
    lens: { active: null, _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), _evidenceNodeClass: new Map() },
    goalThreshold: null, goalConstraints: constraints, viewMode, lodRung: 'full', guidanceItems: [],
    analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match' }, analysisFreshnessDirty: false,
  }
  vi.mocked(useCanvasStore).mockImplementation(((sel: (s: unknown) => unknown) => sel(state)) as never)
}

const cardProps = {
  selected: false, dragging: false, zIndex: 0, isConnectable: false, position: { x: 0, y: 0 },
  positionAbsoluteX: 0, positionAbsoluteY: 0, deletable: true, selectable: true, draggable: true,
}

/** Both cards from ONE store: the Goal and the constrained Outcome. */
function renderBoth(goal: CanvasNode, outcome: CanvasNode) {
  const utils = render(
    <ReactFlowProvider>
      <GoalNode {...(cardProps as any)} id={goal.id} type="goal" data={goal.data as never} />
      <OutcomeNode {...(cardProps as any)} id={outcome.id} type="outcome" data={outcome.data as never} />
    </ReactFlowProvider>,
  )
  const goalEl = utils.container.querySelector(`[data-testid^="goal-node-resting-state"]`)
  expect(goalEl, 'PRECONDITION: the Goal card mounted').not.toBeNull()
  return utils.container
}

const goalPill = (c: HTMLElement) => c.querySelector<HTMLElement>(`[data-testid="goal-limit-pill-${GOAL.id}-constraint_out_nrr_min"]`)
const outcomeLines = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>('[data-testid="factor-constraint-lines"] > div')].map(e => e.textContent)

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useNodeDisplayMetadata).mockReturnValue({ ...META } as never)
})
afterEach(() => cleanup())

describe('DIFF pre-run item 7 — the Outcome does not repeat a limit the Goal card shows', () => {
  it('pricing: the Goal shows `Net Revenue Retention ≥110%`, so the NRR outcome prints no `Limit ≥ 110%`', () => {
    mockStore(NODES, [NRR_LIMIT])
    const c = renderBoth(GOAL, OUTCOME)
    const pill = goalPill(c)
    expect(pill, 'the Goal states the limit (its target is set)').not.toBeNull()
    expect(pill!.textContent).toBe('Net Revenue Retention ≥110%')
    expect(outcomeLines(c)).toEqual([])
    expect(c.textContent ?? '').not.toContain('Limit ≥ 110%')
  })

  it('CONTROL — a Goal with NO target shows no pills in Standard, so the outcome keeps its line', () => {
    const noTarget: CanvasNode = {
      ...GOAL,
      data: { ...GOAL.data, goal_threshold_raw: undefined, goal_threshold: undefined, success_threshold: undefined },
    }
    mockStore(NODES.map(n => (n.id === GOAL.id ? noTarget : n)), [NRR_LIMIT])
    const c = renderBoth(noTarget, OUTCOME)
    expect(goalPill(c), 'no pill on a Goal with no target').toBeNull()
    expect(outcomeLines(c)).toEqual(['Limit ≥ 110%'])
  })

  it('CONTROL — no Goal on the canvas: the outcome keeps its line', () => {
    mockStore(NODES.filter(n => n.type !== 'goal'), [NRR_LIMIT])
    const utils = render(
      <ReactFlowProvider>
        <OutcomeNode {...(cardProps as any)} id={OUTCOME.id} type="outcome" data={OUTCOME.data as never} />
      </ReactFlowProvider>,
    )
    expect(outcomeLines(utils.container)).toEqual(['Limit ≥ 110%'])
  })

  it('Detailed view: the Goal lists the limit inline (Layer 2), so the outcome does not repeat it there either', () => {
    const noTarget: CanvasNode = {
      ...GOAL,
      data: { ...GOAL.data, goal_threshold_raw: undefined, goal_threshold: undefined, success_threshold: undefined },
    }
    mockStore(NODES.map(n => (n.id === GOAL.id ? noTarget : n)), [NRR_LIMIT], 'expert')
    const c = renderBoth(noTarget, OUTCOME)
    const badges = [...c.querySelectorAll('[data-testid="goal-constraint-badge"]')].map(e => e.textContent)
    expect(badges.length, 'the Goal lists the limit inline in Detailed').toBe(1)
    expect(outcomeLines(c)).toEqual([])
  })
})

describe('the match is by constraint ROW identity, never by what the row prints', () => {
  const a = { constraint_id: 'c_a', node_id: 'out_nrr', operator: '>=', value: 1.1, unit: 'fraction' } as never
  const aClone = { constraint_id: 'c_a', node_id: 'out_nrr', operator: '>=', value: 1.1, unit: 'fraction' } as never
  const bSameText = { constraint_id: 'c_b', node_id: 'out_nrr', operator: '>=', value: 1.1, unit: 'fraction' } as never
  const noIdX = { node_id: 'out_nrr', operator: '>=', value: 1.1 } as never
  const noIdY = { node_id: 'out_nrr', operator: '>=', value: 1.1 } as never

  it('the same object, or the same producer id, is the same row', () => {
    expect(sameConstraintRow(a, a)).toBe(true)
    expect(sameConstraintRow(a, aClone)).toBe(true)
    expect(sameConstraintRow(noIdX, noIdX)).toBe(true)
  })

  it('two rows that print alike are two rows', () => {
    expect(sameConstraintRow(a, bSameText)).toBe(false)
    expect(sameConstraintRow(noIdX, noIdY)).toBe(false)
  })

  it('goalCardShownLimits returns the caller\'s own row objects (a filter, never a copy)', () => {
    const rows = [a, bSameText]
    const shown = goalCardShownLimits(rows, GOAL.id, GOAL.data as never, false)
    expect(shown.length).toBe(2)
    expect(shown[0]).toBe(a)
    expect(shown[1]).toBe(bSameText)
    // No target on a Standard Goal: none shown; Detailed: all shown.
    expect(goalCardShownLimits(rows, GOAL.id, {} as never, false)).toEqual([])
    expect(goalCardShownLimits(rows, GOAL.id, {} as never, true)).toEqual(rows)
  })
})
