/**
 * OutcomePanel — option comparison state matrix tests (A.3)
 * Verifies: computed shows cards, failed hides section, pending shows message, empty shows fallback.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { OutcomePanel } from '../panels/OutcomePanel'
import { useCanvasStore } from '../../../store'

function setStoreState(overrides: Record<string, unknown>) {
  const state = useCanvasStore.getState()
  useCanvasStore.setState({
    ...state,
    nodes: [
      { id: 'out1', type: 'outcome', position: { x: 0, y: 0 }, data: { label: 'Revenue' } },
      { id: 'goal1', type: 'goal', position: { x: 200, y: 0 }, data: { label: 'Goal' } },
    ],
    edges: [],
    ...overrides,
  } as any)
}

describe('OutcomePanel — option comparison section', () => {
  beforeEach(() => {
    useCanvasStore.setState(useCanvasStore.getState(), true)
  })

  it('shows option cards when option_comparison_status is computed', () => {
    setStoreState({
      results: {
        status: 'complete',
        report: {
          option_comparison_status: 'computed',
          option_comparison: [
            { option_id: 'o1', option_label: 'Option A', win_probability: 0.65, outcome: { mean: 42 } },
            { option_id: 'o2', option_label: 'Option B', win_probability: 0.35, outcome: { mean: 28 } },
          ],
        },
      },
    })
    const { container } = render(
      <OutcomePanel nodeId="out1" techMode={false} onClose={() => {}} onNavigate={() => {}} />
    )
    const section = container.querySelector('[data-testid="option-comparison-section"]')
    expect(section).not.toBeNull()
    expect(section?.textContent).toContain('Option A')
    expect(section?.textContent).toContain('Option B')
    expect(section?.textContent).toContain('65% win')
  })

  it('hides entire predicted-range block when status is failed', () => {
    setStoreState({
      results: {
        status: 'complete',
        report: {
          option_comparison_status: 'failed',
          option_comparison: [],
        },
      },
    })
    const { container } = render(
      <OutcomePanel nodeId="out1" techMode={false} onClose={() => {}} onNavigate={() => {}} />
    )
    // Section title should not render
    expect(container.textContent).not.toContain('Predicted range by option')
  })

  it('hides entire predicted-range block when status is error', () => {
    setStoreState({
      results: {
        status: 'complete',
        report: {
          option_comparison_status: 'error',
          option_comparison: [],
        },
      },
    })
    const { container } = render(
      <OutcomePanel nodeId="out1" techMode={false} onClose={() => {}} onNavigate={() => {}} />
    )
    expect(container.textContent).not.toContain('Predicted range by option')
  })

  it('shows fallback message when comparisons array is empty', () => {
    setStoreState({
      results: {
        status: 'complete',
        report: {
          option_comparison_status: 'computed',
          option_comparison: [],
        },
      },
    })
    const { container } = render(
      <OutcomePanel nodeId="out1" techMode={false} onClose={() => {}} onNavigate={() => {}} />
    )
    expect(container.textContent).toContain('No per-option predictions available')
  })

  it('shows pre-analysis prompt when not in results mode', () => {
    setStoreState({ results: { status: 'idle', report: null } })
    const { container } = render(
      <OutcomePanel nodeId="out1" techMode={false} onClose={() => {}} onNavigate={() => {}} />
    )
    // StaleGuardBanner shows "Run your first simulation" in pre-analysis mode,
    // wrapping the pre-analysis content
    expect(container.textContent).toContain('Run your first simulation')
  })
})
