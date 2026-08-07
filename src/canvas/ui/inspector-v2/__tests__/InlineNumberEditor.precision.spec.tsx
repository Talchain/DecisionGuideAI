/**
 * Codex P1-4 — InlineNumberEditor exact-seed + unchanged-blur no-op.
 *
 * The shared editor used to seed from the ROUNDED display (Math.round(p*100)) and
 * call onSave on EVERY valid blur. So opening a 0.376 probability (shown "38%") and
 * tabbing out committed 0.38 — a passthrough violation that destroyed producer
 * precision and falsely dirtied the graph.
 *
 * Fix (shared component): (a) seed the draft from the EXACT value, (b) skip onSave
 * when the parsed draft equals the seeded exact value, (c) permit fractional input.
 *
 * Verified on BOTH consumers: RiskPanel (×100 percent scale, the precision case)
 * and FactorObservablePanel (raw scale, the unchanged-blur no-op).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { RiskPanel } from '../panels/RiskPanel'
import { FactorObservablePanel } from '../panels/FactorObservablePanel'
import { InlineNumberEditor } from '../shared/InlineNumberEditor'
import { useCanvasStore } from '../../../store'
import { useGuidanceStore } from '../../../stores/guidanceStore'

const panelProps = (nodeId: string) => ({ nodeId, techMode: false, onClose: vi.fn(), onNavigate: vi.fn() })

beforeEach(() => {
  cleanup()
  useGuidanceStore.setState({ guidanceItems: [], _prefillChat: null, _sendMessage: null })
})

// ---------------------------------------------------------------------------
// Component-level unit tests
// ---------------------------------------------------------------------------

describe('InlineNumberEditor — exact seed + no-op blur (component)', () => {
  it('seeds the input from the EXACT value, not a rounded readout', () => {
    render(
      <InlineNumberEditor
        readout="38%"
        placeholder="none"
        value={37.6}
        onSave={vi.fn()}
        displayTestId="d"
        inputTestId="i"
      />,
    )
    fireEvent.click(screen.getByTestId('d'))
    expect((screen.getByTestId('i') as HTMLInputElement).value).toBe('37.6')
  })

  it('does NOT call onSave when the value is blurred unchanged', () => {
    const onSave = vi.fn()
    render(
      <InlineNumberEditor readout="38%" placeholder="none" value={37.6} onSave={onSave} displayTestId="d" inputTestId="i" />,
    )
    fireEvent.click(screen.getByTestId('d'))
    fireEvent.blur(screen.getByTestId('i'))
    expect(onSave).not.toHaveBeenCalled()
  })

  it('calls onSave with the parsed value on a real change', () => {
    const onSave = vi.fn()
    render(
      <InlineNumberEditor readout="38%" placeholder="none" value={37.6} onSave={onSave} displayTestId="d" inputTestId="i" />,
    )
    fireEvent.click(screen.getByTestId('d'))
    fireEvent.change(screen.getByTestId('i'), { target: { value: '40' } })
    fireEvent.blur(screen.getByTestId('i'))
    expect(onSave).toHaveBeenCalledWith(40)
  })

  it('permits fractional input (step defaults to "any")', () => {
    render(
      <InlineNumberEditor readout="38%" placeholder="none" value={37.6} onSave={vi.fn()} displayTestId="d" inputTestId="i" />,
    )
    fireEvent.click(screen.getByTestId('d'))
    expect((screen.getByTestId('i') as HTMLInputElement).getAttribute('step')).toBe('any')
  })

  it('discards a non-numeric commit', () => {
    const onSave = vi.fn()
    render(
      <InlineNumberEditor readout="38%" placeholder="none" value={37.6} onSave={onSave} displayTestId="d" inputTestId="i" />,
    )
    fireEvent.click(screen.getByTestId('d'))
    fireEvent.change(screen.getByTestId('i'), { target: { value: 'abc' } })
    fireEvent.blur(screen.getByTestId('i'))
    expect(onSave).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// RiskPanel (×100 percent scale) — the precision case
// ---------------------------------------------------------------------------

function seedRisk(probability: number) {
  useCanvasStore.setState(useCanvasStore.getState(), true)
  useCanvasStore.setState({
    nodes: [
      { id: 'risk1', type: 'risk', position: { x: 0, y: 0 }, data: { label: 'Churn risk', description: 'x', probability, impact: 'medium' } },
    ],
    edges: [],
    results: { status: 'none', report: null },
    analysisFreshnessDirty: false,
  } as any)
}

describe('RiskPanel — opening + blurring a 0.376 probability preserves precision', () => {
  it('unchanged blur commits nothing (0.376 stays 0.376, not 0.38) and does not dirty', () => {
    seedRisk(0.376)
    const updateSpy = vi.spyOn(useCanvasStore.getState(), 'updateNode')
    render(<RiskPanel {...panelProps('risk1')} />)

    // Display shows the rounded "38%"; the editor seeds the exact 37.6.
    expect(screen.getByTestId('risk-probability-display').textContent).toMatch(/38%/)
    fireEvent.click(screen.getByTestId('risk-probability-display'))
    expect((screen.getByTestId('risk-probability-input') as HTMLInputElement).value).toBe('37.6')
    fireEvent.blur(screen.getByTestId('risk-probability-input'))

    const prob = (useCanvasStore.getState().nodes.find(n => n.id === 'risk1')!.data as any).probability
    expect(prob).toBeCloseTo(0.376, 6) // NOT 0.38 — precision preserved
    expect(updateSpy).not.toHaveBeenCalled() // zero store writes
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(false)
    updateSpy.mockRestore()
  })

  it('a real edit still saves (40 → 0.40)', () => {
    seedRisk(0.376)
    render(<RiskPanel {...panelProps('risk1')} />)
    fireEvent.click(screen.getByTestId('risk-probability-display'))
    fireEvent.change(screen.getByTestId('risk-probability-input'), { target: { value: '40' } })
    fireEvent.blur(screen.getByTestId('risk-probability-input'))
    const prob = (useCanvasStore.getState().nodes.find(n => n.id === 'risk1')!.data as any).probability
    expect(prob).toBeCloseTo(0.4, 6)
  })
})

// ---------------------------------------------------------------------------
// FactorObservablePanel (raw scale) — the unchanged-blur no-op
// ---------------------------------------------------------------------------

function seedFactor(value: number) {
  useCanvasStore.setState(useCanvasStore.getState(), true)
  useCanvasStore.setState({
    nodes: [
      { id: 'factor-1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Market rate', category: 'observable', observedState: { value } } },
    ],
    edges: [],
    results: { status: 'none', report: null },
    analysisFreshnessDirty: false,
  } as any)
}

describe('FactorObservablePanel — unchanged blur is a no-op', () => {
  it('opening + blurring an unchanged value commits nothing', () => {
    seedFactor(0.376)
    const updateSpy = vi.spyOn(useCanvasStore.getState(), 'updateNode')
    render(<FactorObservablePanel {...panelProps('factor-1')} />)

    fireEvent.click(screen.getByTestId('observable-value-display'))
    expect((screen.getByTestId('observable-value-input') as HTMLInputElement).value).toBe('0.376')
    fireEvent.blur(screen.getByTestId('observable-value-input'))

    const val = (useCanvasStore.getState().nodes.find(n => n.id === 'factor-1')!.data as any).observedState.value
    expect(val).toBeCloseTo(0.376, 6)
    expect(updateSpy).not.toHaveBeenCalled()
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(false)
    updateSpy.mockRestore()
  })

  it('a real edit still saves', () => {
    seedFactor(0.376)
    render(<FactorObservablePanel {...panelProps('factor-1')} />)
    fireEvent.click(screen.getByTestId('observable-value-display'))
    fireEvent.change(screen.getByTestId('observable-value-input'), { target: { value: '0.5' } })
    fireEvent.blur(screen.getByTestId('observable-value-input'))
    const val = (useCanvasStore.getState().nodes.find(n => n.id === 'factor-1')!.data as any).observedState.value
    expect(val).toBeCloseTo(0.5, 6)
  })
})
