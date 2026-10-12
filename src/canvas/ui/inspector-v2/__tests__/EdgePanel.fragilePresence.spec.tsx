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
 * ⚠ #2747 re-scope 2 round 2 (12 Oct 2026): the Run's switch figure is not shown in C, measured or not; the measured
 * rows are now pins, and each absence assertion carries its own non-vacuity control (the context group, the sentence,
 * or the expanded disclosure) (trap 13). Inspector-v2 is hardcoded ON
 * (InspectorModal USE_INSPECTOR_V2) — this is the live path.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { EdgePanel } from '../panels/EdgePanel'
import { FRAGILE_CUE_SENTENCE } from '../../../edges/connectorCopy'
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
    expect(screen.getByText("If this connection's strength changes, the current model comparison could change")).toBeTruthy()
    expect(screen.queryByText(/% flip risk/)).toBeNull()
    expect(screen.queryByText(/90%/)).toBeNull()
  })

  it('PIN (tech mode): a marginal-only value is never printed under the switch_probability label', () => {
    setStoreWithFragileEdges([
      { edge_id: 'e1', from: 'fac1', to: 'out1', marginal_switch_probability: 0.9 },
    ])
    render(<EdgePanel {...panelProps} techMode={true} />)
    // The disclosure is collapsed by default — expand it, or the absence
    // assertion is vacuous (trap 13): the toggle must read expanded.
    fireEvent.click(screen.getByText('Model detail'))
    expect(screen.getByRole('button', { name: 'Hide model detail' }).getAttribute('aria-expanded')).toBe('true')
    expect(screen.queryByText(/switch_probability:/)).toBeNull()
  })

  // #2747 re-scope 2 round 2 (Codex r1 blocking 4): the Run's switch figure is not shown in C, measured or not. Was
  // "CONTROL: a measured switch_probability still renders its percentage"; its presence half (the context) is kept.
  it('PIN: a measured switch_probability keeps the Sensitive context and its sentence, with no figure and no toggle', () => {
    setStoreWithFragileEdges([
      { edge_id: 'e1', from: 'fac1', to: 'out1', switch_probability: 0.65, marginal_switch_probability: 0.9 },
    ])
    const { container } = render(<EdgePanel {...panelProps} />)
    expect(container.querySelector('[data-panel-group="context"]')).not.toBeNull()
    expect(screen.getByText(FRAGILE_CUE_SENTENCE)).toBeTruthy()
    expect(screen.getByTestId('edge-fragility-context').querySelector('button')).toBeNull()
    expect(screen.queryByText(/% flip risk/)).toBeNull()
    expect(container.textContent ?? '').not.toMatch(/65\s?%|90\s?%/)
  })

  // #2747 re-scope 2 round 2 (Codex r1 blocking 4): the flip-risk tooltip went with the figure. The NO SIZE CLAIM half
  // is kept, on the heading and on every title in the context group.
  it('ONE SENTENCE, NO SIZE CLAIM: the heading makes no size claim, and no title carries a flip-risk figure', () => {
    setStoreWithFragileEdges([
      { edge_id: 'e1', from: 'fac1', to: 'out1', switch_probability: 0.65, marginal_switch_probability: 0.9 },
    ])
    render(<EdgePanel {...panelProps} />)
    const heading = screen.getByText(FRAGILE_CUE_SENTENCE)
    const context = screen.getByTestId('edge-fragility-context')
    const titles = [...context.querySelectorAll('[title]')].map((el) => el.getAttribute('title') ?? '')
    expect(titles.filter((t) => /flip risk|\d+\s?%/.test(t))).toEqual([])
    for (const text of [heading.textContent ?? '', ...titles]) {
      expect(text).not.toMatch(/\b(small|significant(ly)?|large|slight(ly)?|major|minor)\b/i)
    }
  })

  // #2747 re-scope 2 round 2 (Codex r1 blocking 4): was "CONTROL (tech mode): a measured value still prints in the
  // technical disclosure"; the Run's switch figure is not shown in C, in tech mode either.
  it('PIN (tech mode): a measured value prints nothing under the switch_probability label either', () => {
    setStoreWithFragileEdges([
      { edge_id: 'e1', from: 'fac1', to: 'out1', switch_probability: 0.65, marginal_switch_probability: 0.9 },
    ])
    const { container } = render(<EdgePanel {...panelProps} techMode={true} />)
    fireEvent.click(screen.getByText('Model detail'))
    expect(screen.getByRole('button', { name: 'Hide model detail' }).getAttribute('aria-expanded')).toBe('true')
    expect(screen.queryByText(/switch_probability:/)).toBeNull()
    expect(container.textContent ?? '').not.toMatch(/0\.65|65\s?%/)
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
