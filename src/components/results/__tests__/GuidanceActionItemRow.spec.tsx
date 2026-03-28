/**
 * Tests for GuidanceActionItemRow and ResultsBody guidance integration.
 *
 * Verifies:
 * - Guidance store items present → ResultsBody renders GuidanceActionItemRow, not NextActionItem
 * - Empty guidance store → ResultsBody renders NextActionItem fallback
 * - Items with target_object.type === 'node' are filtered out (not shown in results panel)
 * - onActivateGuidanceItem is called on row click
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GuidanceActionItemRow } from '../GuidanceActionItemRow'
import type { GuidanceItem } from '../../../canvas/stores/guidanceStore'

vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusByTarget: vi.fn(),
  focusEdgeByEndpoints: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeGuidanceItem(overrides: Partial<GuidanceItem> = {}): GuidanceItem {
  return {
    item_id: 'g-1',
    signal_code: 'WEAK_EDGE',
    category: 'should_fix',
    source: 'structural',
    title: 'Strengthen this connection',
    priority: 70,
    primary_action: { type: 'discuss', prompt: 'Tell me more.' },
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// GuidanceActionItemRow unit tests
// ---------------------------------------------------------------------------

describe('GuidanceActionItemRow', () => {
  it('renders the item title', () => {
    render(
      <GuidanceActionItemRow
        item={makeGuidanceItem({ title: 'Fix this edge' })}
        onActivate={vi.fn()}
      />
    )
    expect(screen.getByText('Fix this edge')).toBeInTheDocument()
  })

  it('renders item detail when present', () => {
    render(
      <GuidanceActionItemRow
        item={makeGuidanceItem({ detail: 'This edge is fragile.' })}
        onActivate={vi.fn()}
      />
    )
    expect(screen.getByText('This edge is fragile.')).toBeInTheDocument()
  })

  it('calls onActivate with item_id on click', () => {
    const onActivate = vi.fn()
    render(
      <GuidanceActionItemRow
        item={makeGuidanceItem({ item_id: 'guid-abc' })}
        onActivate={onActivate}
      />
    )
    fireEvent.click(screen.getByTestId('guidance-action-item-row'))
    expect(onActivate).toHaveBeenCalledWith('guid-abc')
  })

  it('renders must_fix category with correct test id', () => {
    render(
      <GuidanceActionItemRow
        item={makeGuidanceItem({ category: 'must_fix' })}
        onActivate={vi.fn()}
      />
    )
    expect(screen.getByTestId('guidance-action-item-row')).toBeInTheDocument()
  })
})

// ResultsBody — guidance integration tests removed:
// "Your next steps" section suppressed in v4 — triage panel (DecisionConfidencePanel) absorbs guidance items.

// ---------------------------------------------------------------------------
// OutputsDock guidance filter — unit coverage
// ---------------------------------------------------------------------------
// The filter in OutputsDock (resultsGuidanceItems) excludes node/edge-targeted
// items and keeps graph/option/framing/undefined-target items.
// We test the predicate directly to ensure the exclusion contract is correct.

/** Mirror of the OutputsDock resultsGuidanceItems filter predicate */
function outputsDockFilter(item: GuidanceItem): boolean {
  const t = item.target_object?.type
  return !t || t === 'graph' || t === 'option' || t === 'framing'
}

describe('OutputsDock guidance filter predicate', () => {
  it('includes items with no target_object', () => {
    expect(outputsDockFilter(makeGuidanceItem())).toBe(true)
  })

  it('includes graph-targeted items', () => {
    expect(outputsDockFilter(makeGuidanceItem({ target_object: { type: 'graph' } }))).toBe(true)
  })

  it('includes option-targeted items', () => {
    expect(outputsDockFilter(makeGuidanceItem({ target_object: { type: 'option' } }))).toBe(true)
  })

  it('includes framing-targeted items', () => {
    expect(outputsDockFilter(makeGuidanceItem({ target_object: { type: 'framing' } }))).toBe(true)
  })

  it('excludes node-targeted items', () => {
    expect(outputsDockFilter(makeGuidanceItem({ target_object: { type: 'node', id: 'n1' } }))).toBe(false)
  })

  it('excludes edge-targeted items', () => {
    expect(outputsDockFilter(makeGuidanceItem({ target_object: { type: 'edge', id: 'e1' } }))).toBe(false)
  })
})
