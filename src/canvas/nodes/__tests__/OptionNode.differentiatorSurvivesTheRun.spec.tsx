/**
 * ⭐⭐ RUNNING THE ANALYSIS MUST NOT DELETE THE REASON FROM AN OPTION CARD.
 *
 * WITNESSED, NOT HYPOTHESISED. On deployed `e2016182` with a completed
 * analysis in session, all three option cards rendered their name and an
 * ordinal and nothing else:
 *
 *     "Open a Second Roastery in Leeds | 1"
 *     "Expand the Manchester Site | 2"
 *     "Status Quo — hold current capacity | 3"
 *
 * No differentiator, no "Behind:" line. A ranking with no reasons, handed to
 * the user at the exact moment they are choosing.
 *
 * TWO GATES CAUSED IT, and both are removed:
 *   1. the `differentiator` memo opened `if (isPostAnalysis) return null`
 *   2. the render gate opened `!isPostAnalysis &&`
 *
 * ⚠ WHY THE "Behind:" LINE DOES NOT COVER THE GAP. It names the key factor
 * ("no X added" / "X lower") but renders ONLY for a NON-RECOMMENDED option,
 * and `computeBehindReason` returns null outright when there is no
 * recommended option — exactly what a WITHHELD LEADER produces. That is the
 * captured state above: the leader was withheld, so no card had a Behind
 * line and every card had lost its differentiator. The honest-withholding
 * path stripped every reason at once.
 *
 * ⚠ AND THE SENTENCE IS STRUCTURAL, so nothing here can go stale. It is
 * derived from `nodes` + `ceeAnalysisReady.options[].interventions` — the
 * MODEL, not the result. A run ranks options; it does not change which factor
 * differentiates them.
 *
 * CLAIM SCOPE (CLAUDE.md trap 3): these are jsdom text assertions. They prove
 * PRESENCE and ABSENCE of a sentence in the DOM. They prove nothing about
 * layout, card height or whether the line is visible on screen.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { OptionNode } from '../OptionNode'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

/** Two factors, two non-baseline options, each differing on its own factor. */
const FACTOR_HEAD = { id: 'f-head', type: 'factor', data: { label: 'Developer headcount', type: 'factor' } }
const FACTOR_COST = { id: 'f-cost', type: 'factor', data: { label: 'Coordination cost', type: 'factor' } }
const OPTION_1 = { id: 'option-1', type: 'option', data: { label: 'Hire two developers', type: 'option' } }
const OPTION_2 = { id: 'option-2', type: 'option', data: { label: 'Hire a tech lead', type: 'option' } }

/** The sentence the card must keep. Bound by IDENTITY, not by a substring
 *  another option's sentence could satisfy. */
const EXPECTED = 'Developer headcount is the key difference'

const CEE_READY = {
  options: [
    { id: 'option-1', interventions: { 'f-head': 3 } },
    { id: 'option-2', interventions: { 'f-cost': 5 } },
  ],
}

const makeStoreState = (overrides: Record<string, unknown> = {}) => ({
  hoveredOptionId: null,
  nodes: [FACTOR_HEAD, FACTOR_COST, OPTION_1, OPTION_2],
  edges: [],
  ceeAnalysisReady: CEE_READY,
  // A run that COMPLETED and withheld its leader: a report with no
  // option_comparison, which is what produced the captured state.
  results: { status: 'complete', report: {} },
  highlightedNodes: new Set(),
  dimmedNodeIds: new Set(),
  lens: { _dimmedNodeIds: new Set() },
  goalThreshold: null,
  goalConstraints: [],
  setHoveredOption: vi.fn(),
  viewMode: 'standard',
  ...overrides,
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
    sensitivityRank: null,
    influence: null,
    confidence: null,
    inSensitivityAnalysis: false,
    achievementProbability: null,
    stabilityPercentage: null,
    // Leader withheld: no win rate to show, which is the captured state.
    winRate: null,
    isResultsMode: true,
    predictedOutcome: null,
    valueOfInformation: null,
    voiRank: null,
  })),
}))

import { useCanvasStore } from '../../store'

const baseProps = {
  id: 'option-1',
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

const renderOption = (storeOverrides: Record<string, unknown> = {}, data: Record<string, unknown> = {}) => {
  // Same shape as the sibling `OptionNode.differentiatorRecoverable.spec.tsx`
  // uses. A `never`-typed selector parameter typechecks locally and then fails
  // the repo's ratchet, which is stricter than a bare `pnpm typecheck` run.
  vi.mocked(useCanvasStore).mockImplementation((selector) =>
    selector(makeStoreState(storeOverrides) as any))
  return render(
    <ReactFlowProvider>
      <OptionNode {...baseProps} data={{ label: 'Hire two developers', type: 'option', ...data }} />
    </ReactFlowProvider>
  )
}

describe('OptionNode differentiator — the run must not delete the reason', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('⭐ POST-ANALYSIS with a withheld leader: the card still says which factor differs', () => {
    // THE CAPTURED STATE. Before the fix this rendered a name and an ordinal
    // and nothing else.
    renderOption({ results: { status: 'complete', report: {} } })
    expect(screen.getByText(EXPECTED)).toBeInTheDocument()
  })

  it('⭐ THE TWIN: pre-analysis is UNCHANGED — the same sentence, same card', () => {
    // Held constant so the pair isolates `isPostAnalysis` alone. A mutant that
    // restores either gate REDs the case above and leaves this one GREEN —
    // which is what proves the binding is to the RUN and not to the fixture.
    renderOption({ results: { status: 'idle', report: null } })
    expect(screen.getByText(EXPECTED)).toBeInTheDocument()
  })

  it('the pair actually AGREE — the sentence is the same before and after', () => {
    const { unmount } = renderOption({ results: { status: 'idle', report: null } })
    const before = screen.getByText(EXPECTED).textContent
    unmount()
    renderOption({ results: { status: 'complete', report: {} } })
    const after = screen.getByText(EXPECTED).textContent
    // The point of the fix is CONTINUITY: running the analysis must not change
    // what the card says about the model's own structure.
    expect(after).toBe(before)
  })

  it('the baseline option is still excluded — the fix did not widen that', () => {
    renderOption(
      { results: { status: 'complete', report: {} } },
      { is_baseline: true },
    )
    expect(screen.queryByText(EXPECTED)).toBeNull()
  })

  it('PRECONDITION: the fixture really does produce a differentiator', () => {
    // Without this every assertion above could hold vacuously on a fixture
    // that stopped computing one (CLAUDE.md trap 13b).
    renderOption({ results: { status: 'complete', report: {} } })
    const el = screen.getByText(EXPECTED)
    expect(el.textContent).toContain('is the key difference')
    expect(el.textContent).toContain('Developer headcount')
  })
})
