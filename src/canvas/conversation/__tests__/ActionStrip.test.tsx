/**
 * Tests for ActionStrip component
 *
 * Verifies:
 * - Renders top GuidanceItem title + category when items exist
 * - Shows item count badge when >1 items
 * - Hidden when zero GuidanceItems and no analysis state
 * - Navigation CTA shows correct text per state
 * - State badge shows correct text per state
 * - Long title: container has truncate styling
 * - Clicking top item area calls onNavigate
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ActionStrip } from '../ActionStrip'
import { useGuidanceStore, type GuidanceItem } from '../../stores/guidanceStore'
import { useCanvasStore } from '../../store'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeItem(overrides: Partial<GuidanceItem> = {}): GuidanceItem {
  return {
    item_id: 'g-1',
    signal_code: 'TEST',
    category: 'should_fix',
    source: 'structural',
    title: 'Fix edge strength',
    priority: 50,
    primary_action: { type: 'discuss', prompt: 'Tell me more.' },
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  useGuidanceStore.getState().clearGuidanceItems()
  // Set nodeCount > 0 so we get graph_ready by default
  useCanvasStore.setState({
    nodes: [{ id: 'n1', position: { x: 0, y: 0 }, data: {} }] as any,
    results: { status: 'idle', progress: 0 },
    hasCompletedFirstRun: false,
    analysisFreshness: null,
    analysisFreshnessDirty: false,
  })
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ActionStrip', () => {
  it('renders top GuidanceItem title + category when items exist', () => {
    useGuidanceStore.getState().setGuidanceItems([makeItem()])

    render(
      <ActionStrip
        messages={[]}
        patchBlockStates={new Map()}
      />,
    )

    expect(screen.getByTestId('action-strip')).toBeInTheDocument()
    expect(screen.getByText('Fix edge strength')).toBeInTheDocument()
    expect(screen.getByText('should fix')).toBeInTheDocument()
  })

  it('shows item count badge when >1 items', () => {
    useGuidanceStore.getState().setGuidanceItems([
      makeItem({ item_id: 'a', priority: 10 }),
      makeItem({ item_id: 'b', priority: 20 }),
      makeItem({ item_id: 'c', priority: 30 }),
    ])

    render(
      <ActionStrip
        messages={[]}
        patchBlockStates={new Map()}
      />,
    )

    expect(screen.getByTestId('action-strip-count')).toHaveTextContent('3 items')
  })

  it('hidden when zero GuidanceItems and no analysis state', () => {
    // nodeCount = 0, no messages, no guidance
    useCanvasStore.setState({ nodes: [] as any })

    const { container } = render(
      <ActionStrip
        messages={[]}
        patchBlockStates={new Map()}
      />,
    )

    expect(container.innerHTML).toBe('')
  })

  it('navigation CTA shows "View model issues" in graph_ready state', () => {
    useGuidanceStore.getState().setGuidanceItems([makeItem()])

    render(
      <ActionStrip
        messages={[]}
        patchBlockStates={new Map()}
      />,
    )

    expect(screen.getByTestId('action-strip-cta')).toHaveTextContent('View model issues')
  })

  it('state badge shows "Analysing…" during analysis_running', () => {
    useGuidanceStore.getState().setGuidanceItems([makeItem()])
    useCanvasStore.setState({
      results: { status: 'preparing', progress: 0 },
      hasCompletedFirstRun: false,
    })

    render(
      <ActionStrip
        messages={[]}
        patchBlockStates={new Map()}
      />,
    )

    expect(screen.getByTestId('action-strip-badge')).toHaveTextContent('Analysing\u2026')
  })

  it('state badge shows "Results outdated" when the CEE freshness verdict is stale (changed)', () => {
    useGuidanceStore.getState().setGuidanceItems([makeItem()])
    useCanvasStore.setState({
      results: { status: 'complete', progress: 100 },
      hasCompletedFirstRun: true,
      analysisFreshness: { freshness: 'stale' } as any,
      analysisFreshnessDirty: false,
    })

    render(
      <ActionStrip
        messages={[]}
        patchBlockStates={new Map()}
      />,
    )

    expect(screen.getByTestId('action-strip-badge')).toHaveTextContent('Results outdated')
  })

  it('long title: verify container has truncate className', () => {
    useGuidanceStore.getState().setGuidanceItems([
      makeItem({ title: 'A'.repeat(200) }),
    ])

    render(
      <ActionStrip
        messages={[]}
        patchBlockStates={new Map()}
      />,
    )

    const titleEl = screen.getByText('A'.repeat(200))
    // The CSS module class includes actionStripTitle which applies text-overflow: ellipsis
    expect(titleEl.className).toContain('actionStripTitle')
  })

  it('clicking top item area calls onNavigate with guidance', () => {
    useGuidanceStore.getState().setGuidanceItems([makeItem()])
    const onNavigate = vi.fn()

    render(
      <ActionStrip
        messages={[]}
        patchBlockStates={new Map()}
        onNavigate={onNavigate}
      />,
    )

    fireEvent.click(screen.getByTestId('action-strip-top-item'))
    expect(onNavigate).toHaveBeenCalledWith('guidance')
  })
})
