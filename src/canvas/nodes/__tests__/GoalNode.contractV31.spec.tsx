/**
 * Canvas visual contract v3.1 — the GOAL card (gaps U3, U4, U8 of
 * `GAPS-vs-contract-v31-20260924.md`, measured on served `24e06704`).
 *
 *   U3 — screenshot A (OpenAI PoC, after a run) read "Chance · Not produced by
 *        this run". v3.1's goal anatomy is the title plus the target row; a
 *        goal probability is shown only when the run produced one. So a run
 *        with no goal chance shows NO Chance row, in any of its three old arms.
 *   U4 — screenshot B (Conventional PoC, before a run) read "Target not
 *        captured" AND "Needs input". One state, once: the card's own
 *        "Target not captured" chip stays, and the corner "Needs input" pill is
 *        withheld while that chip is stating the gap.
 *   U8 — v3.1 point 1: "The separate rail source icons are removed." The goal
 *        rail's brief (FileText) icon goes; the target line keeps its own source
 *        mark, and the label's "From your brief" notice stays reachable in the
 *        card's details (Detailed inline / the hover popover) — stated once,
 *        never zero times.
 *
 * Bound by IDENTITY (test ids, exact copy constants). Each removal has a
 * CONTRAST that must still render, so a change that blanked the card would fail.
 *
 * CLAIM SCOPE: jsdom proves DOM text and attributes only, never layout.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
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
import { GoalNode, GOAL_NO_TARGET_STATE } from '../GoalNode'
import { FactorNode } from '../FactorNode'
import {
  GOAL_LABEL_FROM_BRIEF_COPY,
  GOAL_LABEL_FROM_BRIEF_TESTID,
} from '../../domain/goalLabelProvenance'

const baseProps = {
  selected: false,
  dragging: false,
  zIndex: 0,
  isConnectable: false,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  deletable: true,
  selectable: true,
  draggable: true,
}

const META = {
  sensitivityRank: null,
  influence: null,
  confidence: null,
  inSensitivityAnalysis: false,
  achievementProbability: null as number | null,
  goalFitAvailable: false,
  stabilityPercentage: null,
  winRate: null,
  isResultsMode: false,
  predictedOutcome: null,
  valueOfInformation: null,
  voiRank: null,
}

function mockStore(over: Record<string, unknown> = {}) {
  vi.mocked(useCanvasStore).mockImplementation((selector: any) =>
    selector({
      hoveredOptionId: null,
      nodes: [],
      edges: [],
      ceeAnalysisReady: null,
      results: { status: 'idle', report: null },
      highlightedNodes: new Set(),
      dimmedNodeIds: new Set(),
      lens: { _dimmedNodeIds: new Set() },
      goalThreshold: null,
      goalConstraints: [],
      setHoveredOption: vi.fn(),
      viewMode: 'standard',
      analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match' },
      analysisFreshnessDirty: false,
      ...over,
    } as never),
  )
}

function renderGoal(data: Record<string, unknown>, id = 'goal-1') {
  return render(
    <ReactFlowProvider>
      <GoalNode {...(baseProps as any)} id={id} type="goal" data={{ type: 'goal', label: 'Grow net revenue', ...data } as any} />
    </ReactFlowProvider>,
  )
}

const POST_RUN = { results: { status: 'complete', report: {} } }
const WITH_TARGET = { goal_threshold_raw: '100', goal_threshold_unit: '%' }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useNodeDisplayMetadata).mockReturnValue({ ...META } as never)
})
afterEach(() => cleanup())

describe('U3 — no Chance row when the run produced no goal chance (contract v3.1 goal anatomy)', () => {
  it('a current run with no goal chance: no Chance row and no "Not produced by this run"', () => {
    mockStore(POST_RUN)
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({ ...META, isResultsMode: true } as never)
    const { container } = renderGoal(WITH_TARGET)
    expect(screen.queryByTestId('goal-achievement-unset')).toBeNull()
    expect(screen.queryByTestId('goal-achievement-metric-row')).toBeNull()
    expect(container.textContent ?? '').not.toContain('Not produced by this run')
    expect(container.textContent ?? '').not.toContain('Chance')
  })

  it('the per-option arm ("See each option") is gone too', () => {
    mockStore(POST_RUN)
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({ ...META, isResultsMode: true, goalFitAvailable: true } as never)
    const { container } = renderGoal(WITH_TARGET)
    expect(screen.queryByTestId('goal-achievement-unset')).toBeNull()
    expect(container.textContent ?? '').not.toContain('See each option')
  })

  it('the changed-model arm ("Rerun to update") is gone too', () => {
    mockStore({ ...POST_RUN, analysisFreshness: { freshness: 'stale', freshnessReason: 'graph_changed' }, analysisFreshnessDirty: true })
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({ ...META, isResultsMode: true } as never)
    const { container } = renderGoal(WITH_TARGET)
    expect(screen.queryByTestId('goal-achievement-unset')).toBeNull()
    expect(container.textContent ?? '').not.toContain('Rerun to update')
  })

  it('CONTRAST — a real goal chance still renders its ONE Chance row, and the target line survives', () => {
    mockStore(POST_RUN)
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({ ...META, isResultsMode: true, achievementProbability: 0.34 } as never)
    renderGoal(WITH_TARGET)
    const row = screen.getByTestId('goal-achievement-metric-row')
    expect(row.textContent).toContain('Chance')
    expect(row.textContent).toContain('34%')
    expect(screen.getByTestId('goal-node-resting-state').textContent).toContain('100%')
  })
})

describe('U4 — "Target not captured" once; no second "Needs input" pill on the goal', () => {
  it('before a run with no target: the chip states the gap and the corner pill is withheld', () => {
    mockStore()
    const { container } = renderGoal({})
    const chip = screen.getByTestId('goal-node-no-target-chip')
    expect(chip.textContent).toBe(GOAL_NO_TARGET_STATE)
    expect(screen.queryByTestId('needs-input-pill')).toBeNull()
    expect(container.textContent ?? '').not.toContain('Needs input')
    // The node is still incomplete — only the duplicate words went.
    expect(screen.getByTestId('overlay-missing-threshold-node')).toBeTruthy()
  })

  it('CONTRAST — a factor with no value still carries its "Needs input" pill (the suppression is goal-scoped)', () => {
    const data = { label: 'Hiring rate', type: 'factor', category: 'controllable' }
    mockStore({ nodes: [{ id: 'fac-1', type: 'factor', data }] })
    render(
      <ReactFlowProvider>
        <FactorNode {...(baseProps as any)} id="fac-1" type="factor" data={data as any} />
      </ReactFlowProvider>,
    )
    expect(screen.getByTestId('needs-input-pill').textContent).toContain('Needs input')
  })
})

describe('U8 — no rail source icon on the goal (contract v3.1 pt 1)', () => {
  it('a brief-extracted goal has no rail brief icon button', () => {
    mockStore()
    renderGoal({ provenance: 'from_brief', ...WITH_TARGET })
    expect(screen.queryByRole('button', { name: new RegExp(`^${GOAL_LABEL_FROM_BRIEF_COPY.pill}`) })).toBeNull()
    const own = screen.queryByTestId(GOAL_LABEL_FROM_BRIEF_TESTID)
    expect(own === null || own.tagName !== 'BUTTON').toBe(true)
  })

  it('the target line keeps its own source mark beside the value ("no source" when not user-set)', () => {
    mockStore()
    renderGoal({ provenance: 'from_brief', ...WITH_TARGET })
    const resting = screen.getByTestId('goal-node-resting-state')
    const mark = within(resting).getByTestId('goal-target-source-goal-1')
    expect(mark.getAttribute('data-value-source')).toBe('unknown')
  })

  it('CONTRAST — the label\'s brief notice is still stated once, in the card\'s details (Detailed inline)', () => {
    mockStore({ viewMode: 'expert' })
    renderGoal({ provenance: 'from_brief' })
    const notice = screen.getByTestId(GOAL_LABEL_FROM_BRIEF_TESTID)
    expect(notice.tagName).not.toBe('BUTTON')
    expect(notice.textContent).toBe(GOAL_LABEL_FROM_BRIEF_COPY.notice)
    expect(screen.getAllByTestId(GOAL_LABEL_FROM_BRIEF_TESTID)).toHaveLength(1)
  })

  it('CONTRAST — a user-authored goal label carries no brief notice at all', () => {
    mockStore({ viewMode: 'expert' })
    renderGoal({ provenance: 'user_set' })
    expect(screen.queryByTestId(GOAL_LABEL_FROM_BRIEF_TESTID)).toBeNull()
  })
})
