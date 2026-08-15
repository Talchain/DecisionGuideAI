/**
 * Mounted production seam for ui_directive:focus.
 *
 * Drives the real applicator into the real assistant-focus store and renders
 * the real dismissal surface. The discriminating controls prove that user
 * selection remains the sole outbound-grounding authority and that the
 * transient pulse Sets are untouched.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Node } from '@xyflow/react'
import type { OlumiResponse } from '@talchain/schemas/boundary'
import { AssistantFocusChip } from '../../canvas/components/AssistantFocusChip'
import { useCanvasStore } from '../../canvas/store'
import {
  dismissAssistantFocus,
  useAssistantFocusStore,
} from '../../canvas/stores/assistantFocusStore'
import { buildV5Payload } from '../buildPayload'
import { applyV5State, type V5ApplicatorStore } from '../applyV5State'

const USER_NODE = {
  id: 'factor-user',
  type: 'factor',
  position: { x: 0, y: 0 },
  data: { label: 'User selected', type: 'factor' },
  selected: true,
} as Node

const ASSISTANT_NODE = {
  id: 'factor-assistant',
  type: 'factor',
  position: { x: 300, y: 0 },
  data: { label: 'Assistant target', type: 'factor' },
  selected: false,
} as Node

function responseFor(id: string, durationMs = 10_000): OlumiResponse {
  return {
    response_version: 2,
    assistant_text: '',
    blocks: [{
      type: 'ui_directive',
      verb: 'focus',
      targets: [{ id, label: 'Producer label is not the authority', kind: 'factor' }],
      duration_ms: durationMs,
    }],
    suggested_actions: [],
    insights: [],
    stage_indicator: 'frame',
  } as OlumiResponse
}

function apply(response: OlumiResponse) {
  const store = useCanvasStore.getState()
  return applyV5State(response, {
    ...store,
    currentResultsHash: store.results.hash ?? null,
  } as unknown as V5ApplicatorStore)
}

function messagePayload() {
  const result = buildV5Payload({
    turnId: '11111111-1111-4111-8111-111111111111',
    scenarioId: '22222222-2222-4222-8222-222222222222',
    stage: 'frame',
    turnClass: 'clarify',
    mode: 'user',
    message: 'Why does this matter?',
  })
  if (!result.ok) throw new Error(result.reason)
  return result.payload as Extract<typeof result.payload, { kind: 'message' }>
}

beforeEach(() => {
  vi.useFakeTimers()
  dismissAssistantFocus()
  useCanvasStore.setState({
    currentScenarioId: 'scenario-a',
    nodes: [USER_NODE, ASSISTANT_NODE] as never,
    edges: [],
    selection: {
      nodeIds: new Set([USER_NODE.id]),
      edgeIds: new Set<string>(),
      anchorPosition: null,
    },
    highlightedNodes: new Set([USER_NODE.id]),
    highlightedEdges: new Set<string>(),
  })
})

afterEach(() => {
  cleanup()
  dismissAssistantFocus()
  vi.useRealTimers()
})

describe('ui_directive focus — mounted browser surface', () => {
  it('renders a persistent, dismissible focus without changing selection, pulse, or grounding', () => {
    render(<AssistantFocusChip />)
    let result!: ReturnType<typeof apply>
    act(() => {
      result = apply(responseFor(ASSISTANT_NODE.id))
    })

    const chip = screen.getByTestId('assistant-focus-chip')
    expect(chip).toHaveAttribute('data-focus-id', ASSISTANT_NODE.id)
    // Live canvas identity/copy wins over the producer's potentially stale label.
    expect(chip).toHaveTextContent('Olumi focus: Assistant target')
    expect(result.applied).toContain(`ui_directive:focus:${ASSISTANT_NODE.id}`)

    const canvas = useCanvasStore.getState()
    expect([...canvas.selection.nodeIds]).toEqual([USER_NODE.id])
    expect(canvas.nodes.find((node) => node.id === USER_NODE.id)?.selected).toBe(true)
    expect(canvas.nodes.find((node) => node.id === ASSISTANT_NODE.id)?.selected).toBe(false)
    expect([...canvas.highlightedNodes]).toEqual([USER_NODE.id])
    expect(messagePayload().selected_elements).toEqual([
      { id: USER_NODE.id, kind: 'factor', label: 'User selected' },
    ])

    fireEvent.click(screen.getByRole('button', { name: /dismiss olumi focus/i }))
    expect(screen.queryByTestId('assistant-focus-chip')).not.toBeInTheDocument()
    expect(useAssistantFocusStore.getState().target).toBeNull()
    expect([...useCanvasStore.getState().selection.nodeIds]).toEqual([USER_NODE.id])
  })

  it("expires at duration_ms while preserving the user's selection", () => {
    render(<AssistantFocusChip />)
    act(() => {
      apply(responseFor(ASSISTANT_NODE.id, 500))
    })
    expect(screen.getByTestId('assistant-focus-chip')).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(499))
    expect(screen.getByTestId('assistant-focus-chip')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1))
    expect(screen.queryByTestId('assistant-focus-chip')).not.toBeInTheDocument()
    expect([...useCanvasStore.getState().selection.nodeIds]).toEqual([USER_NODE.id])
  })

  it('negative control: an unknown identity renders nothing and records a truthful defer', () => {
    render(<AssistantFocusChip />)
    let result!: ReturnType<typeof apply>
    act(() => {
      result = apply(responseFor('ghost-node'))
    })
    expect(screen.queryByTestId('assistant-focus-chip')).not.toBeInTheDocument()
    expect(useAssistantFocusStore.getState().target).toBeNull()
    expect(result.applied.some((entry) => entry.startsWith('ui_directive:focus'))).toBe(false)
    expect(result.deferred).toEqual(expect.arrayContaining([
      expect.objectContaining({ reason: 'ui_directive_target_not_found', detail: 'ghost-node' }),
    ]))
  })

  it('scenario identity swap clears even when the next graph reuses the same node id', () => {
    render(<AssistantFocusChip />)
    act(() => {
      apply(responseFor(ASSISTANT_NODE.id))
    })
    expect(screen.getByTestId('assistant-focus-chip')).toBeInTheDocument()

    act(() => {
      useCanvasStore.setState({ currentScenarioId: 'scenario-b' })
    })
    expect(screen.queryByTestId('assistant-focus-chip')).not.toBeInTheDocument()
    expect(useAssistantFocusStore.getState().target).toBeNull()
  })

  it('target deletion clears the focus rather than leaving a ghost chip', () => {
    render(<AssistantFocusChip />)
    act(() => {
      apply(responseFor(ASSISTANT_NODE.id))
      useCanvasStore.setState({ nodes: [USER_NODE] as never })
    })
    expect(screen.queryByTestId('assistant-focus-chip')).not.toBeInTheDocument()
    expect(useAssistantFocusStore.getState().target).toBeNull()
  })
})
