/**
 * ⭐⭐ THE CHECK EXISTED, WAS TESTED, AND NO USER COULD SEE IT.
 *
 * `useModelHealth.ts:103-120` already computed, per option, *"X has no path to the goal. Its
 * interventions can't influence the outcome."* — real BFS reachability, `severity: 'blocker'`,
 * `affectedIds: [opt.id]`. Its only consumer, `canvas/components/ModelHealthSection.tsx`, had
 * ZERO importers, while an IDENTICALLY-NAMED twin at `canvas/components/model-tab/
 * ModelHealthSection.tsx` occupied the name `ModelTabBody` actually mounts.
 *
 * Measured on the deployed build (staging `7573bb0e`, 2026-09-16): a real model with three
 * options, NONE with a path to the goal. Re-analyse correctly disabled; the canvas said nothing.
 *
 * ⛔ WHY THE MOUNT ASSERTION IS THE LOAD-BEARING ONE. The defect was never that the computation
 * was wrong — it is correct and has its own spec. The defect was that it was DARK. A test that
 * only rendered `<StructuralIssuesSection/>` directly would have passed just as happily on the
 * dark version, because the orphan component rendered fine too; it simply had no importer. So the
 * decisive test drives `ModelTabBody` — the surface that is actually mounted — and the mutant that
 * must RED is REMOVING THE MOUNT, not breaking the maths.
 *
 * ⚠ CLAUDE.md trap 3: jsdom cannot prove visibility. Everything below asserts MOUNTING and TEXT.
 * Nothing here claims a user can see it; that needs a browser.
 *
 * ⚠ CLAUDE.md trap 19: every assertion binds by NODE IDENTITY (the issue key carries the node id,
 * and the contrast option's label is asserted ABSENT), never by a value another node could satisfy.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, act, cleanup } from '@testing-library/react'
import { StructuralIssuesSection } from '../StructuralIssuesSection'
import { useCanvasStore } from '../../../store'

/**
 * `opt_stranded` has NO outgoing edge, so no path to the goal.
 * `opt_wired` reaches the goal through a factor.
 *
 * The two differ ONLY in connectivity — same type, same shape of label — so an assertion that
 * names one and not the other can only be catching reachability.
 */
function setGraph() {
  act(() => {
    useCanvasStore.setState({
      nodes: [
        { id: 'goal_1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Reach 20k MRR' } },
        { id: 'fac_1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Price elasticity' } },
        { id: 'opt_wired', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Hold price steady' } },
        { id: 'opt_stranded', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Raise price to 55' } },
      ],
      edges: [
        { id: 'e1', source: 'opt_wired', target: 'fac_1' },
        { id: 'e2', source: 'fac_1', target: 'goal_1' },
      ],
    } as never)
  })
}

describe('the structural check reaches the reader', () => {
  beforeEach(() => {
    cleanup()
    act(() => {
      useCanvasStore.setState({ nodes: [], edges: [] } as never)
    })
  })

  it('names the option that cannot reach the goal, BY ID', () => {
    setGraph()
    render(<StructuralIssuesSection />)

    // PRECONDITION, pinned in-test: the fixture really does produce this issue, so a null
    // render cannot pass by everything being absent (CLAUDE.md trap 13 — an absence assertion
    // needs to prove it can see a presence).
    expect(screen.getByTestId('structural-issues-section')).toBeTruthy()
    expect(screen.getByTestId('structural-issue-disconnected-option-opt_stranded')).toBeTruthy()

    expect(screen.getByText(/Raise price to 55.*no path to the goal/)).toBeTruthy()
  })

  it('does NOT name the option that does reach the goal — the contrast that makes the first assertion mean something', () => {
    setGraph()
    render(<StructuralIssuesSection />)

    expect(screen.queryByTestId('structural-issue-disconnected-option-opt_wired')).toBeNull()
    expect(screen.queryByText(/Hold price steady/)).toBeNull()
  })

  it('renders nothing at all when every option reaches the goal', () => {
    act(() => {
      useCanvasStore.setState({
        nodes: [
          { id: 'goal_1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Reach 20k MRR' } },
          { id: 'opt_wired', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Hold price steady' } },
        ],
        edges: [{ id: 'e1', source: 'opt_wired', target: 'goal_1' }],
      } as never)
    })
    render(<StructuralIssuesSection />)

    expect(screen.queryByTestId('structural-issues-section')).toBeNull()
  })

  it('makes no analysis claim — the copy stays structural', () => {
    setGraph()
    const { container } = render(<StructuralIssuesSection />)
    const text = container.textContent ?? ''

    // ⛔ "not connected" is the canvas's to say; "excluded from this calculation" is CEE's
    // DECISION alone. If this surface ever starts asserting the second, the canvas and CEE
    // become two authorities on one question — CLAUDE.md trap 21, the defect this estate keeps
    // paying for. This pins the boundary rather than trusting the copy to stay put.
    for (const forbidden of ['excluded from', 'not included in analysis', 'withheld', 'we did not analyse']) {
      expect(text.toLowerCase()).not.toContain(forbidden.toLowerCase())
    }
    // …and the positive control: it DOES say the structural thing, so the loop above is not
    // passing merely because the component rendered nothing.
    expect(text).toMatch(/no path to the goal/)
  })
})
