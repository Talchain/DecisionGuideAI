/**
 * ⭐⭐ AN OBSERVATION ABOUT CONNECTORS — NOT A CALCULATION CLAIM.
 *
 * `useModelHealth.ts:103-120` computes per-option reachability and describes it as
 * *"X has no path to the goal. **Its interventions can't influence the outcome.**"* with
 * `severity: 'blocker'`. The first version of this surface rendered that VERBATIM.
 *
 * ⛔ THAT WAS WRONG, and Codex blocked it. The reachability **starts at `option.id` and follows
 * CONNECTORS ONLY**. An option can legitimately act through canonical pins / interventions with no
 * connector drawn — so the verbatim version called a VALID status-quo model failed. A false claim
 * about a correct model is worse than the silence it replaced.
 *
 * ⛔⛔ AND MY FIRST BOUNDARY TEST WAS A GUARD AGREEING WITH ITSELF. It asserted a list of forbidden
 * phrases I had invented ('excluded from', 'withheld', 'not included in analysis', 'we did not
 * analyse'). **The sentence that actually breached the boundary was not in my list.** So the
 * boundary test below no longer uses a wordlist: it DERIVES the hook's own description for the same
 * node and asserts the surface does not render it. The check now fails if the hook's vocabulary
 * changes, which a hand-written list never could.
 *
 * ⚠ CLAUDE.md trap 3 — jsdom cannot prove visibility. MOUNTING and TEXT only.
 * ⚠ CLAUDE.md trap 19 — every assertion binds by NODE IDENTITY.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, act, cleanup, renderHook, fireEvent } from '@testing-library/react'

const focusNodeById = vi.fn()
vi.mock('../../../utils/focusHelpers', () => ({
  focusNodeById: (id: string) => focusNodeById(id),
  focusEdgeById: vi.fn(),
}))

import { StructuralIssuesSection } from '../StructuralIssuesSection'
import { useCanvasStore } from '../../../store'
import { useModelHealth } from '../../../hooks/useModelHealth'

const GOAL = { id: 'goal_1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Reach 20k MRR' } }
const FACTOR = { id: 'fac_1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Price elasticity' } }
const WIRED = { id: 'opt_wired', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Hold price steady' } }
const STRANDED = { id: 'opt_stranded', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Raise price to 55' } }

function setState(partial: Record<string, unknown>) {
  act(() => {
    useCanvasStore.setState(partial as never)
  })
}

/** `opt_wired` reaches the goal through a factor; `opt_stranded` has no connector at all. */
function setGraph(extra: Record<string, unknown> = {}) {
  setState({
    nodes: [GOAL, FACTOR, WIRED, STRANDED],
    edges: [
      { id: 'e1', source: 'opt_wired', target: 'fac_1' },
      { id: 'e2', source: 'fac_1', target: 'goal_1' },
    ],
    ...extra,
  })
}

beforeEach(() => {
  cleanup()
  focusNodeById.mockClear()
  setState({ nodes: [], edges: [], results: { status: 'idle' }, ceeAnalysisReady: null })
})

describe('the connector observation reaches the reader', () => {
  it('names the option with no connector path, BY ID, and not the one that has one', () => {
    setGraph()
    render(<StructuralIssuesSection />)

    // Precondition pinned in-test, so a null render cannot pass by everything being absent.
    expect(screen.getByTestId('structural-issues-section')).toBeTruthy()
    expect(screen.getByTestId('structural-issue-disconnected-option-opt_stranded')).toBeTruthy()
    expect(screen.getByText('Raise price to 55')).toBeTruthy()

    // The discriminating half: the two options differ ONLY in connectivity.
    expect(screen.queryByTestId('structural-issue-disconnected-option-opt_wired')).toBeNull()
    expect(screen.queryByText('Hold price steady')).toBeNull()
  })

  it('⭐ THE CASE THAT MADE THE FIRST VERSION FALSE: an option with pins but no connector is reported NEUTRALLY, never as a failure', () => {
    // A status-quo option carrying canonical pins / interventions and NO connector. The
    // reachability behind this surface cannot see those pins, so the ONLY honest thing it may say
    // is that no connector path is shown. If this surface ever asserts influence, analysis
    // validity, or severity, this test is what should stop it.
    setState({
      nodes: [
        GOAL,
        FACTOR,
        {
          id: 'opt_pinned',
          type: 'option',
          position: { x: 0, y: 0 },
          data: { label: 'Hold everything as it is', interventions: { fac_1: 0.4 }, isBaseline: true },
        },
      ],
      edges: [{ id: 'e2', source: 'fac_1', target: 'goal_1' }],
    })
    const { container } = render(<StructuralIssuesSection />)
    const text = (container.textContent ?? '').toLowerCase()

    expect(screen.getByTestId('structural-issue-disconnected-option-opt_pinned')).toBeTruthy()

    // ⛔ DERIVED, not a wordlist I invented — that is the mistake this replaces. Take the hook's
    // OWN description for this node and require the surface not to render it.
    const { result } = renderHook(() => useModelHealth())
    const hookDescription = result.current.find(i => i.key === 'disconnected-option-opt_pinned')?.description
    expect(hookDescription, 'precondition: the hook really does describe this node').toBeTruthy()
    expect(hookDescription!.toLowerCase()).toContain("can't influence the outcome")
    expect(container.textContent).not.toContain(hookDescription)

    // …and the surface does say the observable thing, so the assertion above is not passing
    // merely because nothing rendered.
    expect(text).toContain('no connector path shown')
    expect(text).toContain('not an analysis result')
  })

  it('a legitimate baseline with no connectors gets the same neutral treatment, not a verdict', () => {
    setState({
      nodes: [GOAL, { id: 'opt_base', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Do nothing', isBaseline: true } }],
      edges: [],
    })
    const { container } = render(<StructuralIssuesSection />)
    const text = (container.textContent ?? '').toLowerCase()

    expect(screen.getByTestId('structural-issue-disconnected-option-opt_base')).toBeTruthy()
    expect(text).toContain('not an analysis result')
    // No severity vocabulary reaches the reader.
    for (const banned of ['blocker', 'error', 'invalid', 'failed']) {
      expect(text).not.toContain(banned)
    }
  })

  it('a restored, stale run does not change the observation — it is about the graph, not the run', () => {
    // The state measured on deployed staging: a complete-but-stale report, ceeAnalysisReady
    // cleared. The connector fact is derived from the live graph, so it holds regardless.
    setGraph({ results: { status: 'complete' }, ceeAnalysisReady: null, hasCompletedFirstRun: true })
    render(<StructuralIssuesSection />)

    expect(screen.getByTestId('structural-issue-disconnected-option-opt_stranded')).toBeTruthy()
  })

  it('renders nothing when every option has a connector path', () => {
    setState({
      nodes: [GOAL, WIRED],
      edges: [{ id: 'e1', source: 'opt_wired', target: 'goal_1' }],
    })
    render(<StructuralIssuesSection />)

    expect(screen.queryByTestId('structural-issues-section')).toBeNull()
  })

  it('offers a mounted ACTION to the node, not just a warning', () => {
    setGraph()
    render(<StructuralIssuesSection />)

    fireEvent.click(screen.getByTestId('structural-issue-show-opt_stranded'))
    expect(focusNodeById).toHaveBeenCalledWith('opt_stranded')
  })
})
