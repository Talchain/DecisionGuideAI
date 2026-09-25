/**
 * NodeCoachingMarker — pins for the on-canvas coaching marker that replaced the
 * dead CEE/ISL NodeBadge (23-Jul capability audit G3 + G-item-2).
 *
 * Pins (each RED without the component's corresponding behaviour):
 *  - marker renders IFF a live guidance item names this node (target_object.id)
 *  - unresolvable / non-matching target id → no marker (fail-closed by construction)
 *  - empty store → no marker (no permanently-empty UI; the slot is live, not dead)
 *  - click reaches the inspector open seam (select node + open inspector + setActive)
 *  - a resolved / dismissed item clears the marker
 *  - cap: one marker per node, "+N" count, never badge soup
 *  - colour = state: tone derived from the top item's producer category
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { NodeCoachingMarker } from '../NodeCoachingMarker'
import { useGuidanceStore, guidanceCategoryIcon, type GuidanceItem } from '../../../stores/guidanceStore'
import { useCanvasStore } from '../../../store'
import { NODE_RAIL_REST_TONE_CLASS } from '../nodeCardRailStyles'

function makeItem(overrides: Partial<GuidanceItem> = {}): GuidanceItem {
  return {
    item_id: 'item-1',
    category: 'should_fix',
    source: 'structural',
    title: 'Review this node',
    priority: 50,
    primary_action: { type: 'discuss', prompt: 'Let us discuss.' },
    target_object: { type: 'node', id: 'node-a' },
    ...overrides,
  }
}

beforeEach(() => {
  useGuidanceStore.getState().clearGuidanceItems()
})

// ---------------------------------------------------------------------------
// Presence: renders iff a live item names this node
// ---------------------------------------------------------------------------

describe('NodeCoachingMarker — presence', () => {
  it('renders a marker when a live item targets this node', () => {
    useGuidanceStore.getState().setGuidanceItems([makeItem({ target_object: { type: 'node', id: 'node-a' } })])
    render(<NodeCoachingMarker nodeId="node-a" />)
    expect(screen.getByTestId('node-coaching-marker-node-a')).toBeInTheDocument()
  })

  it('renders NOTHING when no item targets this node (item names a different node)', () => {
    useGuidanceStore.getState().setGuidanceItems([makeItem({ target_object: { type: 'node', id: 'node-b' } })])
    const { container } = render(<NodeCoachingMarker nodeId="node-a" />)
    expect(container.innerHTML).toBe('')
  })

  it('renders NOTHING when the store is empty (no permanently-empty slot)', () => {
    const { container } = render(<NodeCoachingMarker nodeId="node-a" />)
    expect(container.innerHTML).toBe('')
  })

  it('fail-closed: an unresolvable target id surfaces no marker on any real node', () => {
    // Item names a node id that no node carries. Every real node renders its own
    // marker keyed to its OWN id, so a ghost id can never mount one.
    useGuidanceStore.getState().setGuidanceItems([makeItem({ target_object: { type: 'node', id: 'ghost-node' } })])
    const { container } = render(<NodeCoachingMarker nodeId="node-a" />)
    expect(container.innerHTML).toBe('')
  })

  it('ignores items with no target_object', () => {
    useGuidanceStore.getState().setGuidanceItems([makeItem({ target_object: undefined })])
    const { container } = render(<NodeCoachingMarker nodeId="node-a" />)
    expect(container.innerHTML).toBe('')
  })
})

// ---------------------------------------------------------------------------
// Click seam
// ---------------------------------------------------------------------------

describe('NodeCoachingMarker — click reaches the guidance surface', () => {
  it('selects the node, opens the inspector, and activates the item', () => {
    useGuidanceStore
      .getState()
      .setGuidanceItems([makeItem({ item_id: 'the-item', target_object: { type: 'node', id: 'node-a' } })])
    const selectSpy = vi.spyOn(useCanvasStore.getState(), 'selectNodeWithoutHistory')
    // `openNodeInspector` fail-closes on a node that is not on the graph.
    useCanvasStore.setState({ nodes: [{ id: 'node-a', position: { x: 0, y: 0 }, data: {} }] } as never)
    let inspectorOpened = false
    const onOpen = () => { inspectorOpened = true }
    window.addEventListener('olumi:open-full-inspector', onOpen)

    render(<NodeCoachingMarker nodeId="node-a" />)
    fireEvent.click(screen.getByTestId('node-coaching-marker-node-a'))

    expect(selectSpy).toHaveBeenCalledWith('node-a')
    // Was `setShowInspectorPanel(true)` — a store field with zero render
    // consumers, so the old assertion was green while the marker opened
    // nothing. This asserts the event ReactFlowGraph actually listens for.
    expect(inspectorOpened).toBe(true)
    expect(useGuidanceStore.getState().activeGuidanceItemId).toBe('the-item')

    window.removeEventListener('olumi:open-full-inspector', onOpen)
    selectSpy.mockRestore()
  })

  it('activates the highest-severity item when several target the node', () => {
    useGuidanceStore.getState().setGuidanceItems([
      makeItem({ item_id: 'low', category: 'could_fix', target_object: { type: 'node', id: 'node-a' } }),
      makeItem({ item_id: 'high', category: 'must_fix', target_object: { type: 'node', id: 'node-a' } }),
    ])
    render(<NodeCoachingMarker nodeId="node-a" />)
    fireEvent.click(screen.getByTestId('node-coaching-marker-node-a'))
    expect(useGuidanceStore.getState().activeGuidanceItemId).toBe('high')
  })
})

// ---------------------------------------------------------------------------
// Lifecycle: resolved / dismissed item clears the marker
// ---------------------------------------------------------------------------

describe('NodeCoachingMarker — lifecycle', () => {
  it('clears the marker when the targeting item is dismissed', () => {
    useGuidanceStore
      .getState()
      .setGuidanceItems([makeItem({ item_id: 'gone', target_object: { type: 'node', id: 'node-a' } })])
    render(<NodeCoachingMarker nodeId="node-a" />)
    expect(screen.getByTestId('node-coaching-marker-node-a')).toBeInTheDocument()

    act(() => {
      useGuidanceStore.getState().dismissItem('gone')
    })
    expect(screen.queryByTestId('node-coaching-marker-node-a')).not.toBeInTheDocument()
  })

  it('clears the marker when the item is cleared by target id (node edited)', () => {
    useGuidanceStore
      .getState()
      .setGuidanceItems([makeItem({ target_object: { type: 'node', id: 'node-a' } })])
    render(<NodeCoachingMarker nodeId="node-a" />)
    expect(screen.getByTestId('node-coaching-marker-node-a')).toBeInTheDocument()

    act(() => {
      useGuidanceStore.getState().clearItemsByTargetIds(['node-a'])
    })
    expect(screen.queryByTestId('node-coaching-marker-node-a')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Cap: one marker + count, never badge soup
// ---------------------------------------------------------------------------

describe('NodeCoachingMarker — cap (1 + count)', () => {
  it('renders exactly ONE marker even when several items target the node', () => {
    useGuidanceStore.getState().setGuidanceItems([
      makeItem({ item_id: 'a', target_object: { type: 'node', id: 'node-a' } }),
      makeItem({ item_id: 'b', target_object: { type: 'node', id: 'node-a' } }),
      makeItem({ item_id: 'c', target_object: { type: 'node', id: 'node-a' } }),
    ])
    render(<NodeCoachingMarker nodeId="node-a" />)
    expect(screen.getAllByTestId('node-coaching-marker-node-a')).toHaveLength(1)
  })

  it('shows the count when more than one item targets the node', () => {
    useGuidanceStore.getState().setGuidanceItems([
      makeItem({ item_id: 'a', target_object: { type: 'node', id: 'node-a' } }),
      makeItem({ item_id: 'b', target_object: { type: 'node', id: 'node-a' } }),
      makeItem({ item_id: 'c', target_object: { type: 'node', id: 'node-a' } }),
    ])
    render(<NodeCoachingMarker nodeId="node-a" />)
    const marker = screen.getByTestId('node-coaching-marker-node-a')
    expect(marker).toHaveAttribute('data-guidance-count', '3')
    expect(marker.textContent).toContain('3')
  })

  it('shows no count digit for a single item', () => {
    useGuidanceStore.getState().setGuidanceItems([makeItem({ target_object: { type: 'node', id: 'node-a' } })])
    render(<NodeCoachingMarker nodeId="node-a" />)
    const marker = screen.getByTestId('node-coaching-marker-node-a')
    expect(marker).toHaveAttribute('data-guidance-count', '1')
    expect(marker.textContent?.trim()).toBe('')
  })
})

// ---------------------------------------------------------------------------
// Category = SHAPE; the canvas marker's colour is neutral (contract v3.1)
// ---------------------------------------------------------------------------
//
// ⭐ SUPERSEDED BY CONTRACT v3.1 (24 Sep 2026, deltas PILL-07 / PILL-08 / T14(b)).
// This block pinned "colour = state": must_fix / should_fix painted the marker
// Danger (`border-danger/30` + `text-danger`), the rest Info. Contract v3.1 +
// Paul 23 Sep pts 6 and 9: a coaching cue is muted at rest and Info on
// hover/focus; Danger is the risk family's and Info at rest is the attention
// cue's; no warning styling on a coaching cue. The CATEGORY is still carried —
// by the glyph SHAPE (`guidanceCategoryIcon`, the inspector card's own glyph)
// and by `data-guidance-category` — and the inspector card keeps its tone.
// ⛔ UPDATED 25 Sep 2026 (gap 34, Visual Contract §02 `.icon-btn{color:#777B77}`):
// "muted" is now the rail's contract grey, `NODE_RAIL_REST_TONE_CLASS`, not
// `text-text-light` — the design moved the value; the claim (neutral at rest,
// Info on hover) is unchanged.

describe('NodeCoachingMarker — category by shape, colour neutral on the canvas', () => {
  const svgClass = (marker: HTMLElement) => marker.querySelector('svg')?.getAttribute('class') ?? ''
  const glyphOf = (cat: GuidanceItem['category']) => {
    const { Icon } = guidanceCategoryIcon(cat)
    const r = render(<Icon />)
    const name = (r.container.querySelector('svg')?.getAttribute('class') ?? '').split(/\s+/).find((t) => t.startsWith('lucide-'))
    r.unmount()
    return name
  }

  it('must_fix: its category glyph, but no Danger paint — muted at rest, Info on hover', () => {
    useGuidanceStore
      .getState()
      .setGuidanceItems([makeItem({ category: 'must_fix', target_object: { type: 'node', id: 'node-a' } })])
    render(<NodeCoachingMarker nodeId="node-a" />)
    const marker = screen.getByTestId('node-coaching-marker-node-a')
    expect(marker).toHaveAttribute('data-guidance-category', 'must_fix')
    expect(marker.className).not.toContain('danger')
    expect(svgClass(marker)).not.toContain('text-danger')
    expect(marker.className).toContain(NODE_RAIL_REST_TONE_CLASS)
    expect(marker.className).toContain('hover:text-info')
    expect(svgClass(marker)).toContain(glyphOf('must_fix')!)
  })

  it('could_fix: its own (different) category glyph, the same neutral colour', () => {
    useGuidanceStore
      .getState()
      .setGuidanceItems([makeItem({ category: 'could_fix', target_object: { type: 'node', id: 'node-a' } })])
    render(<NodeCoachingMarker nodeId="node-a" />)
    const marker = screen.getByTestId('node-coaching-marker-node-a')
    expect(marker.className).toContain(NODE_RAIL_REST_TONE_CLASS)
    expect(svgClass(marker)).not.toContain('text-info')
    expect(glyphOf('could_fix')).not.toBe(glyphOf('must_fix'))
    expect(svgClass(marker)).toContain(glyphOf('could_fix')!)
  })

  it('an uncategorised item keeps the honest-absence glyph (never an invented severity)', () => {
    useGuidanceStore
      .getState()
      .setGuidanceItems([makeItem({ category: undefined, target_object: { type: 'node', id: 'node-a' } })])
    render(<NodeCoachingMarker nodeId="node-a" />)
    const marker = screen.getByTestId('node-coaching-marker-node-a')
    expect(marker).toHaveAttribute('data-guidance-category', 'uncategorised')
    expect(svgClass(marker)).toContain(glyphOf(undefined)!)
  })

  it('the glyph follows the highest-severity item among several', () => {
    useGuidanceStore.getState().setGuidanceItems([
      makeItem({ item_id: 'low', category: 'could_fix', target_object: { type: 'node', id: 'node-a' } }),
      makeItem({ item_id: 'high', category: 'must_fix', target_object: { type: 'node', id: 'node-a' } }),
    ])
    render(<NodeCoachingMarker nodeId="node-a" />)
    const marker = screen.getByTestId('node-coaching-marker-node-a')
    expect(marker).toHaveAttribute('data-guidance-category', 'must_fix')
    expect(svgClass(marker)).toContain(glyphOf('must_fix')!)
  })
})
