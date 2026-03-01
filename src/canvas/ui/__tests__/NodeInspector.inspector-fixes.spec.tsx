/**
 * NodeInspector — F.4 context label, F.5 no "Show details", F.6 "Clear results" button
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { NodeInspector } from '../NodeInspector'
import { useCanvasStore } from '../../store'

describe('NodeInspector — context label (F.4)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('shows "Decision: {label}" when factor has incoming edge from decision', () => {
    useCanvasStore.setState({
      nodes: [
        { id: 'dec', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Pro Plan Pricing Decision' } },
        { id: 'fac', type: 'factor', position: { x: 100, y: 0 }, data: { label: 'Revenue' } },
      ],
      edges: [
        { id: 'e1', source: 'dec', target: 'fac', data: { weight: 0.5 } },
      ],
      goalThreshold: null,
      confirmedNodeIds: new Set(),
      results: { status: 'idle', report: null },
    })
    render(<NodeInspector nodeId="fac" onClose={() => {}} />)

    expect(screen.getByText(/Decision:/)).toBeDefined()
    expect(screen.getByText('Pro Plan Pricing Decision')).toBeDefined()
  })

  it('shows "Goal: {label}" for context from a goal node', () => {
    useCanvasStore.setState({
      nodes: [
        { id: 'goal', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Revenue Target' } },
        { id: 'fac', type: 'factor', position: { x: 100, y: 0 }, data: { label: 'Revenue' } },
      ],
      edges: [
        { id: 'e1', source: 'goal', target: 'fac', data: { weight: 0.5 } },
      ],
      goalThreshold: null,
      confirmedNodeIds: new Set(),
      results: { status: 'idle', report: null },
    })
    render(<NodeInspector nodeId="fac" onClose={() => {}} />)

    expect(screen.getByText(/Goal:/)).toBeDefined()
    expect(screen.getByText('Revenue Target')).toBeDefined()
  })

  it('shows "Risk: {label}" for context from a risk node', () => {
    useCanvasStore.setState({
      nodes: [
        { id: 'risk', type: 'risk', position: { x: 0, y: 0 }, data: { label: 'Supply Chain Disruption' } },
        { id: 'fac', type: 'factor', position: { x: 100, y: 0 }, data: { label: 'Delivery Time' } },
      ],
      edges: [
        { id: 'e1', source: 'risk', target: 'fac', data: { weight: 0.5 } },
      ],
      goalThreshold: null,
      confirmedNodeIds: new Set(),
      results: { status: 'idle', report: null },
    })
    render(<NodeInspector nodeId="fac" onClose={() => {}} />)

    expect(screen.getByText(/Risk:/)).toBeDefined()
    expect(screen.getByText('Supply Chain Disruption')).toBeDefined()
  })

  it('omits context line when connected nodes are same type', () => {
    useCanvasStore.setState({
      nodes: [
        { id: 'fac1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Factor A' } },
        { id: 'fac2', type: 'factor', position: { x: 100, y: 0 }, data: { label: 'Factor B' } },
      ],
      edges: [
        { id: 'e1', source: 'fac1', target: 'fac2', data: { weight: 0.5 } },
      ],
      goalThreshold: null,
      confirmedNodeIds: new Set(),
      results: { status: 'idle', report: null },
    })
    render(<NodeInspector nodeId="fac2" onClose={() => {}} />)

    expect(screen.queryByText(/Decision:/)).toBeNull()
    expect(screen.queryByText(/Goal:/)).toBeNull()
    expect(screen.queryByText(/Factor:/)).toBeNull()
  })
})

describe('NodeInspector — "Show details" removed (F.5)', () => {
  afterEach(() => {
    cleanup()
  })

  it('does not render "Show details" link anywhere', () => {
    useCanvasStore.setState({
      nodes: [
        { id: 'fac', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Revenue' } },
      ],
      edges: [],
      goalThreshold: null,
      confirmedNodeIds: new Set(),
      results: { status: 'idle', report: null },
    })
    render(<NodeInspector nodeId="fac" onClose={() => {}} />)

    expect(screen.queryByText('Show details')).toBeNull()
  })
})

describe('NodeInspector — "Clear results" button (F.6)', () => {
  afterEach(() => {
    cleanup()
  })

  it('shows secondary button instead of text link when results are active', () => {
    useCanvasStore.setState({
      nodes: [
        { id: 'opt', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option A', kind: 'option', interventions: { fac: 0.5 } } },
        { id: 'fac', type: 'factor', position: { x: 100, y: 0 }, data: { label: 'Factor' } },
      ],
      edges: [],
      goalThreshold: null,
      confirmedNodeIds: new Set(),
      results: { status: 'complete', report: {} },
    })
    render(<NodeInspector nodeId="opt" onClose={() => {}} />)

    // Should show helper text
    expect(screen.getByText('Edits are paused while results are shown.')).toBeDefined()

    // Should show button with data-testid
    const btn = screen.getByTestId('btn-clear-results')
    expect(btn).toBeDefined()
    expect(btn.textContent).toBe('Clear results')
  })
})
