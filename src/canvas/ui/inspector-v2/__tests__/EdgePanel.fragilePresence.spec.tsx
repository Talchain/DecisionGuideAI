/**
 * EdgePanel fragile-edge percentage — switch_probability presence pins
 * (marginal-quantity honesty batch; same class as #543).
 *
 * Contract (vendored @talchain/schemas 0.30.0): switch_probability ABSENT
 * means NOT COMPUTED; marginal_switch_probability is a DIFFERENT Monte Carlo,
 * never a fallback. The "NN% flip risk" line and the tech-mode
 * "switch_probability: 0.NN" disclosure must render ONLY a measured value —
 * a marginal-only fragile edge keeps its Sensitive-assumption context (the
 * matching tier deliberately keeps marginal eligibility) but shows no number.
 * Both render sites already presence-branch on `!== null`; the defect was the
 * shared accessor (getFragileEdgeSwitchProbability) coalescing the marginal.
 *
 * Controls prove a measured value still renders in the same harness, so the
 * absence assertions are not vacuous (trap 13). Inspector-v2 is hardcoded ON
 * (InspectorModal USE_INSPECTOR_V2) — this is the live path.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { EdgePanel } from '../panels/EdgePanel'
import { useCanvasStore } from '../../../store'
import { useGuidanceStore } from '../../../stores/guidanceStore'

function setStoreWithFragileEdges(fragileEdges: Array<Record<string, unknown>>) {
  const state = useCanvasStore.getState()
  useCanvasStore.setState({
    ...state,
    nodes: [
      { id: 'fac1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Marketing budget' } },
      { id: 'out1', type: 'outcome', position: { x: 100, y: 0 }, data: { label: 'Revenue' } },
    ],
    edges: [
      { id: 'e1', source: 'fac1', target: 'out1', data: { weight: 0.35, direction: 'positive', beliefExists: 0.82, strengthStd: 0.15 } },
    ],
    results: {
      status: 'complete',
      report: { robustness: { fragile_edges: fragileEdges } },
    },
  } as never)
}

const panelProps = {
  edgeId: 'e1',
  techMode: false,
  onClose: vi.fn(),
  onNavigate: vi.fn(),
}

beforeEach(() => {
  useCanvasStore.setState(useCanvasStore.getState(), true)
  useGuidanceStore.setState({ guidanceItems: [], _prefillChat: null, _sendMessage: null })
})

describe('EdgePanel — flip-risk percentage presence-branches on measured switch_probability', () => {
  it('PIN: a marginal-only fragile edge keeps its Sensitive context but renders NO "% flip risk"', () => {
    setStoreWithFragileEdges([
      { edge_id: 'e1', from: 'fac1', to: 'out1', marginal_switch_probability: 0.9 },
    ])
    const { container } = render(<EdgePanel {...panelProps} />)
    // The context group survives (marginal-matched fragility is visibility,
    // not a displayed quantity) — only the number is absent.
    expect(container.querySelector('[data-panel-group="context"]')).not.toBeNull()
    expect(screen.getByText('Sensitive assumption')).toBeTruthy()
    expect(screen.queryByText(/% flip risk/)).toBeNull()
    expect(screen.queryByText(/90%/)).toBeNull()
  })

  it('PIN (tech mode): a marginal-only value is never printed under the switch_probability label', () => {
    setStoreWithFragileEdges([
      { edge_id: 'e1', from: 'fac1', to: 'out1', marginal_switch_probability: 0.9 },
    ])
    render(<EdgePanel {...panelProps} techMode={true} />)
    // The disclosure is collapsed by default — expand it, or the absence
    // assertion is vacuous (trap 13; the measured CONTROL below proves the
    // same expanded harness CAN see the line).
    fireEvent.click(screen.getByText('Model detail'))
    expect(screen.queryByText(/switch_probability:/)).toBeNull()
  })

  it('CONTROL: a measured switch_probability still renders its percentage (never displaced by marginal)', () => {
    setStoreWithFragileEdges([
      { edge_id: 'e1', from: 'fac1', to: 'out1', switch_probability: 0.65, marginal_switch_probability: 0.9 },
    ])
    render(<EdgePanel {...panelProps} />)
    expect(screen.getByText('65% flip risk')).toBeTruthy()
    expect(screen.queryByText(/90%/)).toBeNull()
  })

  it('CONTROL (tech mode): a measured value still prints in the technical disclosure', () => {
    setStoreWithFragileEdges([
      { edge_id: 'e1', from: 'fac1', to: 'out1', switch_probability: 0.65, marginal_switch_probability: 0.9 },
    ])
    render(<EdgePanel {...panelProps} techMode={true} />)
    fireEvent.click(screen.getByText('Model detail'))
    expect(screen.getByText(/switch_probability: 0\.65/)).toBeTruthy()
  })

  it('CONTROL: a measured 0 is a measurement — below the fragility floor, never resurrected by marginal', () => {
    setStoreWithFragileEdges([
      { edge_id: 'e1', from: 'fac1', to: 'out1', switch_probability: 0, marginal_switch_probability: 0.9 },
    ])
    const { container } = render(<EdgePanel {...panelProps} />)
    // The matching tier coalesces and sees 0 (a measurement) — not fragile,
    // no context group, and certainly no marginal-derived number.
    expect(container.querySelector('[data-panel-group="context"]')).toBeNull()
    expect(screen.queryByText(/% flip risk/)).toBeNull()
  })
})
