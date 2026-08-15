/** Actual node render: assistant focus is a static overlay, not selection/pulse. */
import { act, cleanup, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { Circle } from 'lucide-react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BaseNode } from '../BaseNode'
import { useCanvasStore } from '../../store'
import {
  activateAssistantFocus,
  dismissAssistantFocus,
} from '../../stores/assistantFocusStore'
import {
  __resetAppliedEditPulseForTests,
  PULSE_COALESCE_MS,
  PULSE_DURATION_MS,
  pulseAppliedTargets,
} from '../../utils/appliedEditPulse'

const props = {
  id: 'factor-focus',
  type: 'factor',
  position: { x: 0, y: 0 },
  selected: true,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
  data: { label: 'Demand', type: 'factor', observed_state: { value: 4 } },
}

beforeEach(() => {
  vi.useFakeTimers()
  __resetAppliedEditPulseForTests()
  dismissAssistantFocus()
  useCanvasStore.setState({
    nodes: [props] as never,
    edges: [],
    highlightedNodes: new Set<string>(),
    dimmedNodeIds: new Set<string>(),
  })
})

afterEach(() => {
  cleanup()
  __resetAppliedEditPulseForTests()
  dismissAssistantFocus()
  vi.useRealTimers()
})

describe('BaseNode — assistant focus render', () => {
  it('adds and removes its own halo while the selected prop remains user-owned', () => {
    render(
      <ReactFlowProvider>
        <BaseNode {...(props as any)} nodeType="factor" icon={Circle} />
      </ReactFlowProvider>,
    )
    const node = screen.getByRole('group', { name: /factor node: demand/i })
    expect(node).not.toHaveAttribute('data-assistant-focused')

    act(() => {
      activateAssistantFocus({ id: props.id, kind: 'node', label: 'Demand' })
    })
    expect(node).toHaveAttribute('data-assistant-focused', 'true')
    expect(screen.getByTestId(`assistant-focus-node-halo-${props.id}`)).toBeInTheDocument()
    // Selection styling still comes only from the selected prop.
    expect(node.className).toContain('ring-factor/50')

    act(() => dismissAssistantFocus())
    expect(node).not.toHaveAttribute('data-assistant-focused')
    expect(node.className).toContain('ring-factor/50')
  })

  it('discriminating identity: a different node id does not receive the halo', () => {
    act(() => {
      activateAssistantFocus({ id: 'factor-other', kind: 'node', label: 'Other' })
    })
    render(
      <ReactFlowProvider>
        <BaseNode {...(props as any)} nodeType="factor" icon={Circle} />
      </ReactFlowProvider>,
    )
    expect(screen.getByRole('group', { name: /factor node: demand/i }))
      .not.toHaveAttribute('data-assistant-focused')
  })

  it('remains visibly focused after the production 2s edit pulse has ended', () => {
    render(
      <ReactFlowProvider>
        <BaseNode {...(props as any)} selected={false} nodeType="factor" icon={Circle} />
      </ReactFlowProvider>,
    )
    const node = screen.getByRole('group', { name: /factor node: demand/i })

    act(() => {
      pulseAppliedTargets({ nodeIds: [props.id] })
      vi.advanceTimersByTime(PULSE_COALESCE_MS)
    })
    expect(node.className).toContain('ai-highlight-pulse')

    act(() => {
      activateAssistantFocus({ id: props.id, kind: 'node', label: 'Demand' })
    })
    expect(node).toHaveAttribute('data-assistant-focused', 'true')

    act(() => vi.advanceTimersByTime(PULSE_DURATION_MS))
    expect(node.className).not.toContain('ai-highlight-pulse')
    expect(node).toHaveAttribute('data-assistant-focused', 'true')
    expect(screen.getByTestId(`assistant-focus-node-halo-${props.id}`)).toBeInTheDocument()
  })
})
