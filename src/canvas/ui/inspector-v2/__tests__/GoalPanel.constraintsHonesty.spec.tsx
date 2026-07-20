/**
 * GoalPanel — constraint display-honesty label (UI-SEM-087)
 *
 * Premise (RE-SCOPED per the live wire-probe, parallel-briefs/S-AUDIT-2026-07-20
 * probe-s1-s2-claims.md — refuted the original "constraints reach nothing"
 * premise in BOTH directions):
 *   - Authenticated users' panel-entered constraints DO reach analysis (gated
 *     write-through → scenarios.graph → CEE run_analysis reads its own server graph).
 *   - GUESTS' CHAT-entered constraints also reach analysis (CEE add_constraint
 *     handler persists server-side regardless of auth — wire-proven end to end).
 *   - The ONLY dead leg is the GUEST GoalPanel → client-RPC persistence hop:
 *     guest writes are scenario-id/RLS-gated and silently swallowed, so a guest's
 *     PANEL-entered constraint never reaches the server graph.
 *
 * Therefore the honest condition is exactly "this session's writes don't persist"
 * — the canonical isPersistenceActive predicate — NOT the run path. The label
 * shows ONLY for guest/unauthenticated sessions, ONLY pre-analysis, ONLY on the
 * GoalPanel entry/display surfaces.
 *
 * TRUTH TABLE pinned by this spec:
 *   guest  + pre-analysis + constraints present → label (display surface, once)
 *   guest  + pre-analysis + no constraints yet  → label (entry surface, once)
 *   authed + pre-analysis                        → NO label (writes persist)
 *   guest  + results mode                        → NO label (would contradict probs)
 *
 * The guest chat-path surface (composer add_constraint) carries NO label — it is
 * a different component, but the predicate that discriminates it is pinned here:
 * a guest whose constraints reached analysis is still persistence-INACTIVE, so
 * the panel label is honest specifically about the PANEL entry surface, and the
 * copy names chat as the working alternative.
 *
 * DS Canonical State Copy rule: specs pin the RAW literal (not the constant)
 * so a reworded constant cannot silently drift from the promised sentence.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render } from '@testing-library/react'
import { GoalPanel } from '../panels/GoalPanel'
import { useCanvasStore } from '../../../store'
import { useAuth } from '../../../../contexts/AuthContext'

// Drive the REAL gate (GoalPanel → useAuth → shared isPersistenceActive
// predicate) by controlling only the auth context. importOriginal-spread keeps
// every other export live (CLAUDE.md trap #12 — never hand-mirror a module).
vi.mock('../../../../contexts/AuthContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../contexts/AuthContext')>()
  return { ...actual, useAuth: vi.fn() }
})

// Raw literal — must match GOAL_CONSTRAINT_COPY.guestConstraintsNotInAnalysis.
const HONEST_LITERAL =
  "In guest mode, constraints added here aren't included in the analysis — add them in chat instead."

// Auth states routed through the canonical predicate.
const GUEST_AUTH = { authenticated: true, user: { id: 'guest', email: 'guest@poc' } }
const REAL_AUTH = { authenticated: true, user: { id: 'u-123', email: 'real@user.io' } }

const GOAL_NODE = { id: 'goal1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Test Goal' } }
const ONE_CONSTRAINT = [
  { constraint_id: 'c1', node_id: 'f1', operator: '>=' as const, value: 5, label: 'Churn rate' },
]

function setAuth(state: Record<string, unknown>) {
  vi.mocked(useAuth).mockReturnValue(state as unknown as ReturnType<typeof useAuth>)
}

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
    vi.mocked(useAuth).mockReset()
  })

  it('GUEST + pre-analysis + constraints present → label once (display surface)', () => {
    setAuth(GUEST_AUTH)
    setStore({ goalConstraints: ONE_CONSTRAINT })
    const { getAllByText } = renderPanel()
    // Exactly once — never stacked with the entry-surface note.
    expect(getAllByText(HONEST_LITERAL)).toHaveLength(1)
  })

  it('GUEST + pre-analysis + no constraints yet → label once (entry surface)', () => {
    setAuth(GUEST_AUTH)
    setStore({ goalConstraints: null })
    const { getAllByText } = renderPanel()
    expect(getAllByText(HONEST_LITERAL)).toHaveLength(1)
  })

  it('AUTHENTICATED user → NO label (panel writes persist and DO reach analysis)', () => {
    setAuth(REAL_AUTH)
    setStore({ goalConstraints: ONE_CONSTRAINT })
    const { queryByText } = renderPanel()
    expect(queryByText(HONEST_LITERAL)).toBeNull()
  })

  it('GUEST + results mode → NO label (post-analysis probabilities would contradict it)', () => {
    setAuth(GUEST_AUTH)
    setStore({
      goalConstraints: ONE_CONSTRAINT,
      results: { status: 'complete', report: { option_comparison_status: 'computed', option_comparison: [] } },
    })
    const { queryByText } = renderPanel()
    expect(queryByText(HONEST_LITERAL)).toBeNull()
  })
})
