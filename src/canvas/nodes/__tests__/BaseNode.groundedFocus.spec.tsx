/**
 * BaseNode — transient highlight + persistent grounded-focus visual union.
 *
 * This is deliberately a render test. Store-slice assertions and source-text
 * matching can both stay green while BaseNode points at the wrong node. The
 * rendered `ai-highlight-pulse` class is the DOM-level contract; pixel colour
 * and legibility remain browser claims.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'

import { FactorNode } from '../FactorNode'
import { useCanvasStore } from '../../store'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

vi.mock('../../layoutStore', () => ({
  useLayoutStore: vi.fn((selector: (state: { layoutNodeWidth: number | null }) => unknown) =>
    selector({ layoutNodeWidth: null }),
  ),
}))

const GROUNDED = 'factor-grounded'
const TRANSIENT = 'factor-transient'
const DECOY = 'factor-unrelated-decoy'

function nodeProps(id: string) {
  return {
    id,
    type: 'factor',
    position: { x: 0, y: 0 },
    selected: false,
    isConnectable: true,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    dragging: false,
    zIndex: 0,
    data: { label: id },
  }
}

function renderNodes() {
  render(
    <ReactFlowProvider>
      <FactorNode {...(nodeProps(GROUNDED) as never)} />
      <FactorNode {...(nodeProps(TRANSIENT) as never)} />
      <FactorNode {...(nodeProps(DECOY) as never)} />
    </ReactFlowProvider>,
  )
}

function renderedNode(id: string): HTMLElement {
  return screen.getByRole('group', { name: `factor node: ${id}` })
}

function expectEmphasised(id: string, expected: boolean) {
  const className = renderedNode(id).className
  if (expected) {
    expect(className).toContain('ring-info/60')
    expect(className).toContain('ai-highlight-pulse')
  } else {
    expect(className).not.toContain('ring-info/60')
    expect(className).not.toContain('ai-highlight-pulse')
  }
}

beforeEach(() => {
  useCanvasStore.setState({
    highlightedNodes: new Set<string>(),
    groundedFocus: { nodeIds: new Set<string>(), unresolved: null },
  })
})

afterEach(() => {
  cleanup()
  useCanvasStore.setState({
    highlightedNodes: new Set<string>(),
    groundedFocus: { nodeIds: new Set<string>(), unresolved: null },
  })
})

describe('BaseNode — visual union of transient and grounded attention', () => {
  it('renders both channels while leaving an unrelated decoy plain', () => {
    useCanvasStore.getState().setHighlightedNodes([TRANSIENT])
    useCanvasStore.getState().setGroundedFocus({
      nodeIds: [GROUNDED],
      unresolved: 'none',
    })

    renderNodes()

    expectEmphasised(GROUNDED, true)
    expectEmphasised(TRANSIENT, true)
    expectEmphasised(DECOY, false)
  })

  it('binds persistent emphasis to the grounded id, not whichever node renders first', () => {
    useCanvasStore.getState().setGroundedFocus({
      nodeIds: [DECOY],
      unresolved: 'none',
    })

    renderNodes()

    expectEmphasised(GROUNDED, false)
    expectEmphasised(TRANSIENT, false)
    expectEmphasised(DECOY, true)
  })

  it('renders no false grounded emphasis when neither channel names a node', () => {
    renderNodes()

    expectEmphasised(GROUNDED, false)
    expectEmphasised(TRANSIENT, false)
    expectEmphasised(DECOY, false)
  })
})
