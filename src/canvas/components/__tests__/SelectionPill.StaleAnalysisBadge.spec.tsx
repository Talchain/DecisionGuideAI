/**
 * SelectionPill + StaleAnalysisBadge — render + Rerun-route verification.
 *
 * Closes verification gap #2 from the integration sign-off:
 *
 *   - Selecting a node shows the SelectionPill above the strip.
 *   - Stale analysis state shows the StaleAnalysisBadge above the strip.
 *   - The Rerun button calls the EXISTING analysis route (`useV2Run`),
 *     not a second analysis path.
 *
 * Both components are pure render-stage primitives — no internal state —
 * so a focused unit test that toggles their hook inputs is sufficient.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

// Mutable hook mocks the tests reconfigure.
const selectionState: { value: { id: string; label: string; kind: 'node' | 'edge' } | null } = { value: null }
const runV2Spy = vi.fn()

vi.mock('../../hooks/useSelectionContext', () => ({
  useSelectionContext: () => selectionState.value,
}))
vi.mock('../../hooks/useV2Run', () => ({
  useV2Run: () => ({ runV2Analysis: runV2Spy }),
}))

import { SelectionPill } from '../SelectionPill'
import { StaleAnalysisBadge } from '../StaleAnalysisBadge'
import { useCanvasStore } from '../../store'

describe('SelectionPill — gap #2', () => {
  it('renders nothing when no element is selected', () => {
    selectionState.value = null
    const { container } = render(<SelectionPill />)
    expect(container.firstChild).toBeNull()
  })

  it('renders "Selected: <label>" when a single node is selected', () => {
    selectionState.value = { id: 'goal-1', label: 'Should I switch jobs?', kind: 'node' }
    render(<SelectionPill />)
    const pill = screen.getByTestId('ai-panel-selection-pill')
    expect(pill).toBeInTheDocument()
    expect(pill).toHaveTextContent('Selected:')
    expect(pill).toHaveTextContent('Should I switch jobs?')
  })

  it('renders "source → target" label when an edge is selected', () => {
    selectionState.value = { id: 'e1', label: 'salary → satisfaction', kind: 'edge' }
    render(<SelectionPill />)
    expect(screen.getByText('salary → satisfaction')).toBeInTheDocument()
  })
})

describe('StaleAnalysisBadge — gap #2 (CEE-derived, single source)', () => {
  // The badge now derives from the CEE freshness verdict + local dirty overlay
  // (resolveDisplayedFreshness), NOT the legacy useStaleGuard graph-hash path.
  beforeEach(() => {
    runV2Spy.mockClear()
    useCanvasStore.setState({ analysisFreshness: null, analysisFreshnessDirty: false })
  })

  it('renders nothing when there is no CEE verdict yet', () => {
    const { container } = render(<StaleAnalysisBadge />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing on a fresh-but-locally-edited verdict (cannot-confirm) — never fabricates stale', () => {
    useCanvasStore.getState().setAnalysisFreshness({ freshness: 'fresh', freshness_reason: 'graph_hash_match' })
    useCanvasStore.getState().markAnalysisFreshnessDirty()
    // displayed = 'unknown' (cannot-confirm), NOT 'stale' → badge stays hidden.
    const { container } = render(<StaleAnalysisBadge />)
    expect(container.firstChild).toBeNull()
  })

  it('renders "Analysis stale · Rerun" only on a genuine CEE stale verdict', () => {
    useCanvasStore.getState().setAnalysisFreshness({ freshness: 'stale', freshness_reason: 'graph_changed' })
    render(<StaleAnalysisBadge />)
    const badge = screen.getByTestId('ai-panel-stale-badge')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveTextContent('Analysis stale')
    expect(badge).toHaveTextContent('Rerun')
    expect(badge).toHaveAttribute('role', 'status')
    expect(badge).toHaveAttribute('aria-live', 'polite')
    // a11y: the compact visible "Rerun" carries the full action name for AT,
    // aligned with the other rerun affordances.
    expect(screen.getByRole('button', { name: 'Rerun analysis' })).toBeInTheDocument()
  })

  it('clicking Rerun invokes the EXISTING useV2Run() runV2Analysis, not a second path', () => {
    useCanvasStore.getState().setAnalysisFreshness({ freshness: 'stale', freshness_reason: 'graph_changed' })
    render(<StaleAnalysisBadge />)
    fireEvent.click(screen.getByTestId('ai-panel-stale-badge-rerun'))
    expect(runV2Spy).toHaveBeenCalledTimes(1)
    // The mocked useV2Run hook is the SAME hook called by OutputsDock and
    // ConversationPanel. The badge holds no alternative analysis route of its
    // own — it is a thin wrapper over the canonical run trigger, so green here
    // proves no second route.
  })
})
