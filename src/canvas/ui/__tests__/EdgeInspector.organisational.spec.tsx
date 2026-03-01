/**
 * EdgeInspector — F.1 organisational edge gate + F.3 dynamic target label
 */
import { describe, it, expect, vi, beforeEach, afterEach, type ReactNode } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { EdgeInspector } from '../EdgeInspector'
import { useCanvasStore } from '../../store'
import { ToastProvider } from '../../ToastContext'

/** Wrap component in required providers */
function renderWithProviders(ui: React.ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>)
}

describe('EdgeInspector — organisational edge gate (F.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  function setStoreWith(sourceType: string, targetType: string = 'goal') {
    useCanvasStore.setState({
      nodes: [
        { id: 'src', type: sourceType, position: { x: 0, y: 0 }, data: { label: 'Source Node' } },
        { id: 'tgt', type: targetType, position: { x: 100, y: 0 }, data: { label: 'Revenue Growth' } },
      ],
      edges: [
        {
          id: 'e1',
          source: 'src',
          target: 'tgt',
          data: { weight: 0.5, direction: 'positive', belief: 0.7 },
        },
      ],
      confirmedNodeIds: new Set(),
      results: { status: 'idle', report: null },
      runMeta: { ceeReview: null },
    })
  }

  it('source kind "decision" → shows organisational notice, no sliders', () => {
    setStoreWith('decision', 'option')
    renderWithProviders(<EdgeInspector edgeId="e1" onClose={() => {}} />)

    expect(screen.getByTestId('organisational-edge-notice')).toBeDefined()
    expect(screen.getByText('Organisational link')).toBeDefined()
    expect(screen.getByText(/does not affect analysis/)).toBeDefined()

    // No assumptions section (no sliders)
    expect(screen.queryByText('Effect on target')).toBeNull()
    expect(screen.queryByLabelText('Confidence')).toBeNull()
  })

  it('source kind "option" → shows organisational notice', () => {
    setStoreWith('option', 'factor')
    renderWithProviders(<EdgeInspector edgeId="e1" onClose={() => {}} />)

    expect(screen.getByTestId('organisational-edge-notice')).toBeDefined()
    expect(screen.queryByText('Effect on target')).toBeNull()
  })

  it('source kind "factor" → shows causal controls (sliders visible)', () => {
    setStoreWith('factor', 'goal')
    renderWithProviders(<EdgeInspector edgeId="e1" onClose={() => {}} />)

    expect(screen.queryByTestId('organisational-edge-notice')).toBeNull()
    // Assumptions accordion should contain sliders
    expect(screen.getByText('ASSUMPTIONS')).toBeDefined()
  })
})

describe('EdgeInspector — dynamic target label (F.3)', () => {
  afterEach(() => {
    cleanup()
  })

  function setStoreWithLabel(targetLabel: string) {
    useCanvasStore.setState({
      nodes: [
        { id: 'src', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Price' } },
        { id: 'tgt', type: 'goal', position: { x: 100, y: 0 }, data: { label: targetLabel } },
      ],
      edges: [
        {
          id: 'e1',
          source: 'src',
          target: 'tgt',
          data: { weight: 0.5, direction: 'positive', belief: 0.7 },
        },
      ],
      confirmedNodeIds: new Set(),
      results: { status: 'idle', report: null },
      runMeta: { ceeReview: null },
    })
  }

  it('shows "Helps {label}" with actual target name', () => {
    setStoreWithLabel('Revenue Growth')
    renderWithProviders(<EdgeInspector edgeId="e1" onClose={() => {}} />)

    // Target label appears in Source→Target row AND direction line
    const matches = screen.getAllByText('Revenue Growth')
    expect(matches.length).toBeGreaterThanOrEqual(2)
    // "Helps " appears in direction line; may also appear in coaching text
    const helpsMatches = screen.getAllByText(/Helps/)
    expect(helpsMatches.length).toBeGreaterThanOrEqual(1)
  })

  it('long label renders with CSS truncation (no string mutation)', () => {
    const longLabel = 'This is a very long target node label that should be truncated with CSS ellipsis'
    setStoreWithLabel(longLabel)
    renderWithProviders(<EdgeInspector edgeId="e1" onClose={() => {}} />)

    // The full label should be present in the DOM (title attribute for tooltip)
    const truncatedSpan = screen.getByTitle(longLabel)
    expect(truncatedSpan).toBeDefined()
    // The stored text is not mutated
    expect(truncatedSpan.textContent).toBe(longLabel)
  })
})
