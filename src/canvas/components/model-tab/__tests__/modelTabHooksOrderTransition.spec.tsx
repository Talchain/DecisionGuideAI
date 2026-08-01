/**
 * ROADMAP 2.263 F3 — the 0→N transition must not throw.
 *
 * THE DEFECT, at tip d04c5a9b:
 *
 *   GoalSection.tsx:34      `if (!goalNode) return null`          ABOVE two useCallbacks (:94, :100)
 *   OptionsSection.tsx:359  `if (optionNodes.length === 0) return null`  ABOVE two useMemos (:362, :378)
 *
 * React counts hooks per mounted instance. The moment the drafted model arrived
 * the counts went 2→4 and 0→2 and React threw
 *   "Rendered more hooks than during the previous render."
 * — i.e. the Goal and Options sections broke at exactly the moment the model
 * first appeared, for any user with the Model tab open during the ~42s draft
 * wait that the product's own honest-wait copy encourages. It fired in reverse
 * (N→0) on scenario switch or clear. A `SectionErrorBoundary` degraded it to a
 * section-shaped hole instead of a white screen, which is why it went unreported.
 *
 * WHAT THIS SPEC PROVES AND WHAT IT DOES NOT
 * ------------------------------------------
 * It RE-RENDERS THE SAME MOUNTED INSTANCE across the transition — that is the
 * whole point, and it is the one thing a fresh `render()` per state can never
 * show, because a remount resets the hook list and the bug disappears. The error
 * boundaries are deliberately NOT stubbed away here: a boundary would swallow
 * the throw and hand us a green test over a broken section.
 *
 * jsdom cannot prove visibility or layout (trap 3). It can prove that a
 * re-render throws, which is exactly the claim.
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
// see the header. It is the real component; if a hooks-order error is thrown it
// is caught and rendered as a fallback, which the assertions below detect.

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

/** React logs the hooks-order error via console.error before the boundary sees it. */
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
    // that used to throw "Rendered more hooks than during the previous render."
    expect(() => rerender(<GoalSection goalNode={goalNode()} />)).not.toThrow()

    // POSITIVE CONTROL: it did not merely survive by rendering nothing.
    expect(screen.getByText('Reach 500 signups')).toBeInTheDocument()
    expect(consoleErrors.join('\n')).not.toMatch(/Rendered more hooks|Rendered fewer hooks/)
  })

  it('survives the REVERSE transition — scenario switch or clear', () => {
    const { rerender } = render(<GoalSection goalNode={goalNode()} />)
    expect(screen.getByText('Reach 500 signups')).toBeInTheDocument()

    expect(() => rerender(<GoalSection goalNode={undefined} />)).not.toThrow()
    expect(screen.queryByText('Reach 500 signups')).toBeNull()
    expect(consoleErrors.join('\n')).not.toMatch(/Rendered more hooks|Rendered fewer hooks/)
  })

  it('survives repeated transitions in both directions', () => {
    const { rerender } = render(<GoalSection goalNode={undefined} />)
    for (let i = 0; i < 3; i++) {
      expect(() => {
        rerender(<GoalSection goalNode={goalNode()} />)
        rerender(<GoalSection goalNode={undefined} />)
      }).not.toThrow()
    }
    expect(consoleErrors.join('\n')).not.toMatch(/Rendered more hooks|Rendered fewer hooks/)
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
    expect(consoleErrors.join('\n')).not.toMatch(/Rendered more hooks|Rendered fewer hooks/)
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
    expect(consoleErrors.join('\n')).not.toMatch(/Rendered more hooks|Rendered fewer hooks/)
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
    expect(consoleErrors.join('\n')).not.toMatch(/Rendered more hooks|Rendered fewer hooks/)
  })
})
