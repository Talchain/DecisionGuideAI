/**
 * DecisionPanel — baseline detection regression test
 *
 * Verifies the explicit `is_baseline` flag takes precedence over the regex
 * heuristic in the connected-options list. Covers:
 *   - is_baseline: true → badge shown regardless of label
 *   - is_baseline: false → badge hidden even if label matches heuristic
 *   - is_baseline: undefined → regex fallback applies
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { DecisionPanel } from '../panels/DecisionPanel'
import { useCanvasStore } from '../../../store'

function setStoreState(optionNode: Record<string, unknown>) {
  const state = useCanvasStore.getState()
  useCanvasStore.setState({
    ...state,
    nodes: [
      { id: 'dec1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Decision' } },
      { id: 'opt1', type: 'option', position: { x: 100, y: 0 }, data: { label: 'Custom plan', ...optionNode } },
    ],
    edges: [
      { id: 'e1', source: 'dec1', target: 'opt1', data: {} },
    ],
    results: { status: 'none', report: null },
  } as any)
}

const panelProps = {
  nodeId: 'dec1',
  techMode: false,
  onClose: () => {},
  onNavigate: () => {},
}

describe('DecisionPanel — baseline detection', () => {
  beforeEach(() => {
    useCanvasStore.setState(useCanvasStore.getState(), true)
  })

  it('shows Baseline badge when is_baseline is true, regardless of label', () => {
    setStoreState({ label: 'Custom plan', is_baseline: true })
    const { container } = render(<DecisionPanel {...panelProps} />)
    expect(container.textContent).toContain('Baseline')
  })

  it('hides Baseline badge when is_baseline is false, even if label matches heuristic', () => {
    setStoreState({ label: 'Status quo', is_baseline: false })
    const { container } = render(<DecisionPanel {...panelProps} />)
    const badges = container.querySelectorAll('span')
    const baselineBadge = Array.from(badges).find(s => s.textContent?.trim() === 'Baseline')
    expect(baselineBadge).toBeUndefined()
  })

  it('falls back to regex heuristic when is_baseline is undefined', () => {
    setStoreState({ label: 'Status quo' })
    const { container } = render(<DecisionPanel {...panelProps} />)
    expect(container.textContent).toContain('Baseline')
  })

  it('no badge for non-baseline label when is_baseline is undefined', () => {
    setStoreState({ label: 'Aggressive growth' })
    const { container } = render(<DecisionPanel {...panelProps} />)
    const badges = container.querySelectorAll('span')
    const baselineBadge = Array.from(badges).find(s => s.textContent?.trim() === 'Baseline')
    expect(baselineBadge).toBeUndefined()
  })
})
