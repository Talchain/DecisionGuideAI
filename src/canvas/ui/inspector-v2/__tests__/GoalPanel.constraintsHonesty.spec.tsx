/**
 * GoalPanel — constraint display-honesty label (UI-SEM-087)
 *
 * Premise (verified at the bytes): on the V5-canonical run path the run is a
 * thin `run_analysis` chip (src/v5/buildPayload.ts) that carries no graph and
 * no goal_constraints — the engine reads its own server-side scenario graph,
 * so a constraint typed into this panel does not shape that run. The V2
 * direct-run path (isV5CanonicalRunPath() === false) DOES send goal_constraints,
 * so the honest note is CONDITIONAL on the live run path, never absolute.
 *
 * DS Canonical State Copy rule: specs pin the RAW literal (not the constant)
 * so a reworded constant cannot silently drift from the promised sentence.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render } from '@testing-library/react'
import { GoalPanel } from '../panels/GoalPanel'
import { useCanvasStore } from '../../../store'
import { isV5CanonicalRunPath } from '../../../../v5/eligibility'

// Override ONLY isV5CanonicalRunPath; importOriginal-spread keeps every other
// export live (per CLAUDE.md trap #12 — never hand-mirror a module's surface).
vi.mock('../../../../v5/eligibility', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../v5/eligibility')>()
  return { ...actual, isV5CanonicalRunPath: vi.fn() }
})

// Raw literal — must match GOAL_CONSTRAINT_COPY.constraintsNotUsedInAnalysis.
const HONEST_LITERAL = 'Saved with your decision — not yet used in the analysis.'

const GOAL_NODE = { id: 'goal1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Test Goal' } }
const ONE_CONSTRAINT = [
  { constraint_id: 'c1', node_id: 'f1', operator: '>=' as const, value: 5, label: 'Churn rate' },
]

function setStore(overrides: Record<string, unknown>) {
  const state = useCanvasStore.getState()
  useCanvasStore.setState({
    ...state,
    nodes: [GOAL_NODE],
    edges: [],
    results: { status: 'idle', report: null },
    goalConstraints: null,
    ...overrides,
  } as any)
}

function renderPanel() {
  return render(
    <GoalPanel nodeId="goal1" techMode={false} onClose={() => {}} onNavigate={() => {}} />
  )
}

describe('GoalPanel — constraint display-honesty label (UI-SEM-087)', () => {
  beforeEach(() => {
    useCanvasStore.setState(useCanvasStore.getState(), true)
    vi.mocked(isV5CanonicalRunPath).mockReset()
  })

  it('renders the honest label on the V5-canonical path when constraints exist (display surface)', () => {
    vi.mocked(isV5CanonicalRunPath).mockReturnValue(true)
    setStore({ goalConstraints: ONE_CONSTRAINT })
    const { getAllByText } = renderPanel()
    // Exactly once — never stacked with the entry-surface note.
    expect(getAllByText(HONEST_LITERAL)).toHaveLength(1)
  })

  it('renders the honest label on the V5-canonical path when no constraints exist yet (entry surface)', () => {
    vi.mocked(isV5CanonicalRunPath).mockReturnValue(true)
    setStore({ goalConstraints: null })
    const { getAllByText } = renderPanel()
    expect(getAllByText(HONEST_LITERAL)).toHaveLength(1)
  })

  it('does NOT render the honest label on the V2 direct-run path (constraints are sent there)', () => {
    vi.mocked(isV5CanonicalRunPath).mockReturnValue(false)
    setStore({ goalConstraints: ONE_CONSTRAINT })
    const { queryByText } = renderPanel()
    expect(queryByText(HONEST_LITERAL)).toBeNull()
  })

  it('does NOT render the honest label in results mode even on the V5-canonical path', () => {
    vi.mocked(isV5CanonicalRunPath).mockReturnValue(true)
    setStore({
      goalConstraints: ONE_CONSTRAINT,
      results: { status: 'complete', report: { option_comparison_status: 'computed', option_comparison: [] } },
    })
    const { queryByText } = renderPanel()
    expect(queryByText(HONEST_LITERAL)).toBeNull()
  })
})
