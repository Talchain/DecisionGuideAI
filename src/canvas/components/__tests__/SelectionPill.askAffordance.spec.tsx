/**
 * L-17 — the selection is a REAL, SUBMITTABLE affordance.
 *
 * What was filed, and reproduced again on 16 Aug at UI `f15bccaf`: selecting a
 * connector produced grey text in two places and no way to act on either — a
 * `Selected: X → Y` pill with no handler, and a composer PLACEHOLDER reading
 * "Ask about X → Y…" with the composer's VALUE empty.
 *
 * These tests bind the two controls to the SAME dispatch, by identity, and
 * carry the opposite-direction twin for the fail-closed path: with no
 * conversation host registered nothing clickable may render, because a dead
 * affordance is the defect being removed.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SelectionPill } from '../SelectionPill'
import { useCanvasStore } from '../../store'
import { useGuidanceStore } from '../../stores/guidanceStore'

const NODE = {
  id: 'fac_dev_headcount',
  type: 'factor',
  position: { x: 0, y: 0 },
  data: { label: 'Raw developer headcount' },
}
const TARGET = {
  id: 'out_productivity',
  type: 'outcome',
  position: { x: 0, y: 0 },
  data: { label: 'Team productivity' },
}
const EDGE = { id: 'e5', source: NODE.id, target: TARGET.id }

function selectNode() {
  useCanvasStore.setState({
    nodes: [NODE, TARGET] as never,
    edges: [EDGE] as never,
    selection: { nodeIds: new Set([NODE.id]), edgeIds: new Set<string>() } as never,
  })
}

function selectEdge() {
  useCanvasStore.setState({
    nodes: [NODE, TARGET] as never,
    edges: [EDGE] as never,
    selection: { nodeIds: new Set<string>(), edgeIds: new Set([EDGE.id]) } as never,
  })
}

beforeEach(() => {
  useCanvasStore.setState({ selection: null } as never)
  useGuidanceStore.setState({ _sendChip: null } as never)
})

describe('with a conversation host registered', () => {
  it('the ASK CHIP dispatches a selection-grounded turn', () => {
    const sendChip = vi.fn()
    useGuidanceStore.setState({ _sendChip: sendChip } as never)
    selectNode()

    render(<SelectionPill />)
    fireEvent.click(screen.getByTestId('selection-ask-chip'))

    expect(sendChip).toHaveBeenCalledTimes(1)
    // Display text and submitted message both say what the control says: the
    // user's own bubble records exactly what the button promised.
    expect(sendChip.mock.calls[0][0]).toBe('Ask about Raw developer headcount')
    expect(sendChip.mock.calls[0][1]).toBe('Ask about Raw developer headcount.')
  })

  it('the PILL ITSELF dispatches the SAME turn — one code path, never two semantics', () => {
    const sendChip = vi.fn()
    useGuidanceStore.setState({ _sendChip: sendChip } as never)
    selectEdge()

    render(<SelectionPill />)
    fireEvent.click(screen.getByTestId('selection-pill-ask'))
    const fromPill = sendChip.mock.calls[0]

    // Re-render so the single-flight guard does not swallow the second click,
    // then take the chip's dispatch and compare.
    sendChip.mockClear()
    render(<SelectionPill />)
    fireEvent.click(screen.getAllByTestId('selection-ask-chip')[1])
    const fromChip = sendChip.mock.calls[0]

    expect(fromChip).toEqual(fromPill)
  })

  it('names an EDGE by its endpoints, exactly as the selection context resolves them', () => {
    const sendChip = vi.fn()
    useGuidanceStore.setState({ _sendChip: sendChip } as never)
    selectEdge()

    render(<SelectionPill />)
    fireEvent.click(screen.getByTestId('selection-ask-chip'))
    expect(sendChip.mock.calls[0][0]).toBe(
      'Ask about Raw developer headcount → Team productivity',
    )
  })

  it('is single-flight — a double click sends once', () => {
    const sendChip = vi.fn()
    useGuidanceStore.setState({ _sendChip: sendChip } as never)
    selectNode()

    render(<SelectionPill />)
    const chip = screen.getByTestId('selection-ask-chip')
    fireEvent.click(chip)
    fireEvent.click(chip)
    expect(sendChip).toHaveBeenCalledTimes(1)
  })
})

describe('fail-closed and empty states', () => {
  it('renders NOTHING when nothing is selected', () => {
    useGuidanceStore.setState({ _sendChip: vi.fn() } as never)
    render(<SelectionPill />)
    expect(screen.queryByTestId('ai-panel-selection-pill')).toBeNull()
  })

  it('renders NO clickable control when no conversation host is registered', () => {
    selectNode()
    render(<SelectionPill />)
    // The label still shows — the user should still see what is selected — but
    // there is no button to press that could not deliver.
    expect(screen.getByTestId('ai-panel-selection-pill').textContent).toContain(
      'Raw developer headcount',
    )
    expect(screen.queryByTestId('selection-ask-chip')).toBeNull()
    expect(screen.queryByTestId('selection-pill-ask')).toBeNull()
    expect(
      screen.getByTestId('ai-panel-selection-pill').getAttribute('data-selection-actionable'),
    ).toBe('false')
  })

  it('renders nothing when MORE than one element is selected (ambiguous target)', () => {
    useGuidanceStore.setState({ _sendChip: vi.fn() } as never)
    useCanvasStore.setState({
      nodes: [NODE, TARGET] as never,
      edges: [EDGE] as never,
      selection: { nodeIds: new Set([NODE.id, TARGET.id]), edgeIds: new Set<string>() } as never,
    })
    render(<SelectionPill />)
    expect(screen.queryByTestId('ai-panel-selection-pill')).toBeNull()
  })
})
