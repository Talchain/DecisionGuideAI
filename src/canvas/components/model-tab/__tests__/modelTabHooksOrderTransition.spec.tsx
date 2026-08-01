/**
 * ROADMAP 2.263 F3 — the 0→N transition must not change the hook count.
 *
 * THE DEFECT, at tip d04c5a9b:
 *
 *   GoalSection.tsx:34      `if (!goalNode) return null`                 ABOVE two useCallbacks (:94, :100)
 *   OptionsSection.tsx:359  `if (optionNodes.length === 0) return null`  ABOVE two useMemos (:362, :378)
 *
 * React counts hooks per mounted instance, so the moment the drafted model
 * arrived the counts went 2→4 and 0→2 — a Rules-of-Hooks violation on the exact
 * transition every first-time tester sits through during the ~42s draft wait.
 *
 * ⚠ SEVERITY, MEASURED RATHER THAN INHERITED. The 2.263 audit predicted React
 * would THROW "Rendered more hooks than during the previous render." It does
 * not, on React 18.3.1 in jsdom: it logs
 *     "Warning: React has detected a change in the order of Hooks called by X."
 * and RECOVERS — the section still renders its content. The reverse (N→0)
 * transition produced no console output at all in the same probe. So this is a
 * real Rules-of-Hooks violation with undefined behaviour on React's own terms,
 * NOT the section-breaking crash the audit described. Both facts are in the PR
 * body; the fix stands, the severity claim was corrected.
 *
 * WHAT THIS SPEC PROVES AND WHAT IT DOES NOT
 * ------------------------------------------
 * It RE-RENDERS THE SAME MOUNTED INSTANCE across the transition — the one thing
 * a fresh `render()` per state can never show, because a remount resets the
 * hook list and the violation disappears.
 *
 * It does NOT prove a crash, because there is no crash to prove. The signal it
 * pins is React's own hooks-order diagnostic; see `HOOKS_ORDER_WARNING` below
 * for why `not.toThrow()` alone was a vacuous assertion here, caught by a
 * mutation check.
 *
 * jsdom cannot prove visibility or layout (trap 3), and nothing here tries to.
 */

import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Node } from '@xyflow/react'
import { GoalSection } from '../GoalSection'
import { OptionsSection } from '../OptionsSection'

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

const mockSetGoalThreshold = vi.fn()
const mockUpdateNode = vi.fn()
const mockGraph: { nodes: unknown[]; edges: unknown[] } = { nodes: [], edges: [] }

vi.mock('../../../store', () => {
  const state = {
    setGoalThresholdAndUpdateNode: (...args: unknown[]) => mockSetGoalThreshold(...args),
    updateNode: (...args: unknown[]) => mockUpdateNode(...args),
  }
  const useCanvasStore = Object.assign(
    vi.fn((selector: (s: unknown) => unknown) => selector(state)),
    { getState: () => ({ ...mockGraph, ...state }) },
  )
  return { useCanvasStore }
})

vi.mock('../../../utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusEdgeById: vi.fn(),
}))

// ⚠ `SectionErrorBoundary` is NOT stubbed to a passthrough here on purpose —
// these render the real wrapper, so the components under test are exercised in
// the shape they actually ship in.

function goalNode(): Node {
  return {
    id: 'g1',
    type: 'goal',
    position: { x: 0, y: 0 },
    data: { label: 'Reach 500 signups', success_threshold: 500 },
  }
}

function optionNode(id: string, label: string): Node {
  return { id, type: 'option', position: { x: 0, y: 0 }, data: { label } }
}

/**
 * ⚠ THE ASSERTION THAT ACTUALLY BITES IS THIS ONE, NOT `not.toThrow()`.
 *
 * The first version of this spec asserted only that the re-render did not throw
 * and that the output still rendered — and it PASSED WITH BOTH DEFECTS RESTORED.
 * A test that passes against the bug is not a test.
 *
 * What React 18.3.1 actually does on this transition, measured here rather than
 * assumed: it emits
 *     "Warning: React has detected a change in the order of Hooks called by X."
 * via `console.error` and RECOVERS — it does not throw, and the section still
 * renders. (The audit for ROADMAP 2.263 predicted a hard
 * "Rendered more hooks than during the previous render." throw; that is not
 * what this environment produces. See the PR body — the defect is real and the
 * warning names it, but the severity claim was overstated.)
 *
 * So the discriminating signal is the WARNING. `HOOKS_ORDER_WARNING` covers the
 * recovered case and the two hard-error strings, because React's recovery is a
 * dev-mode courtesy and not a contract.
 */
const HOOKS_ORDER_WARNING =
  /change in the order of Hooks|Rendered more hooks|Rendered fewer hooks|Rules of Hooks/i

/** React logs the hooks-order warning via console.error. */
let consoleErrors: string[] = []
beforeAll(() => {
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    consoleErrors.push(args.map(String).join(' '))
  })
})
afterEach(() => {
  consoleErrors = []
})

describe('GoalSection — the goal node ARRIVING must not change the hook count', () => {
  it('survives undefined → present on the SAME mounted instance', () => {
    // Mount with no goal — the pre-draft state a tester sits in during the wait.
    const { rerender } = render(<GoalSection goalNode={undefined} />)

    // The draft lands. Same instance, new props. This is the exact transition
    // that used to trip React's hooks-order diagnostic.
    expect(() => rerender(<GoalSection goalNode={goalNode()} />)).not.toThrow()

    // POSITIVE CONTROL: it did not merely survive by rendering nothing.
    expect(screen.getByText('Reach 500 signups')).toBeInTheDocument()
    expect(consoleErrors.join('\n')).not.toMatch(HOOKS_ORDER_WARNING)
  })

  it('survives the REVERSE transition — scenario switch or clear', () => {
    const { rerender } = render(<GoalSection goalNode={goalNode()} />)
    expect(screen.getByText('Reach 500 signups')).toBeInTheDocument()

    expect(() => rerender(<GoalSection goalNode={undefined} />)).not.toThrow()
    expect(screen.queryByText('Reach 500 signups')).toBeNull()
    expect(consoleErrors.join('\n')).not.toMatch(HOOKS_ORDER_WARNING)
  })

  it('survives repeated transitions in both directions', () => {
    const { rerender } = render(<GoalSection goalNode={undefined} />)
    for (let i = 0; i < 3; i++) {
      expect(() => {
        rerender(<GoalSection goalNode={goalNode()} />)
        rerender(<GoalSection goalNode={undefined} />)
      }).not.toThrow()
    }
    expect(consoleErrors.join('\n')).not.toMatch(HOOKS_ORDER_WARNING)
  })
})

describe('OptionsSection — options ARRIVING must not change the hook count', () => {
  it('survives empty → populated on the SAME mounted instance', () => {
    const { rerender } = render(<OptionsSection optionNodes={[]} allNodes={[]} isExpanded />)

    const options = [optionNode('opt-a', 'Option Alpha'), optionNode('opt-b', 'Option Beta')]
    expect(() =>
      rerender(<OptionsSection optionNodes={options} allNodes={options} isExpanded />),
    ).not.toThrow()

    // POSITIVE CONTROL.
    expect(screen.getByText('Option Alpha')).toBeInTheDocument()
    expect(consoleErrors.join('\n')).not.toMatch(HOOKS_ORDER_WARNING)
  })

  it('survives the REVERSE transition', () => {
    const options = [optionNode('opt-a', 'Option Alpha')]
    const { rerender } = render(
      <OptionsSection optionNodes={options} allNodes={options} isExpanded />,
    )
    expect(screen.getByText('Option Alpha')).toBeInTheDocument()

    expect(() =>
      rerender(<OptionsSection optionNodes={[]} allNodes={[]} isExpanded />),
    ).not.toThrow()
    expect(screen.queryByText('Option Alpha')).toBeNull()
    expect(consoleErrors.join('\n')).not.toMatch(HOOKS_ORDER_WARNING)
  })

  it('survives repeated transitions in both directions', () => {
    const options = [optionNode('opt-a', 'Option Alpha')]
    const { rerender } = render(<OptionsSection optionNodes={[]} allNodes={[]} isExpanded />)
    for (let i = 0; i < 3; i++) {
      expect(() => {
        rerender(<OptionsSection optionNodes={options} allNodes={options} isExpanded />)
        rerender(<OptionsSection optionNodes={[]} allNodes={[]} isExpanded />)
      }).not.toThrow()
    }
    expect(consoleErrors.join('\n')).not.toMatch(HOOKS_ORDER_WARNING)
  })
})
