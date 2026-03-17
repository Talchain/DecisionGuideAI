/**
 * Tests for patch staleness warning (Task 2)
 *
 * Verifies:
 * - Accept with matching hash → proceeds normally
 * - Accept with different hash → shows staleness warning
 * - "Apply anyway" on stale patch → calls accept handler
 * - "Dismiss" on stale patch → calls dismiss handler
 * - Missing graph_hash_at_proposal → accepts normally
 * - graph_hash_at_proposal stored correctly
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { InlineBlocks } from '../InlineBlocks'
import type { GraphPatchBlock } from '../types'
import { useCanvasStore } from '../../store'
import { generateGraphHash } from '../../utils/graphHash'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makePatchBlock(overrides?: Partial<GraphPatchBlock>): GraphPatchBlock {
  return {
    type: 'graph_patch',
    patch_id: 'patch-stale',
    summary: 'Update factor weights',
    operations: [
      { op: 'update_node', target_id: 'n1', data: { weight: 0.8 } },
    ],
    target_graph_hash: 'cee-hash',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Set up a graph so generateGraphHash produces a known hash
  useCanvasStore.setState({
    nodes: [{ id: 'n1', position: { x: 0, y: 0 }, data: { label: 'Test' } }] as any,
    edges: [] as any,
  })
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Patch staleness warning', () => {
  it('accept with matching hash → proceeds normally, no warning', () => {
    // Compute current hash from the store state
    const { nodes, edges } = useCanvasStore.getState()
    const currentHash = generateGraphHash(nodes, edges)

    const block = makePatchBlock({ graph_hash_at_proposal: currentHash })
    const onAccept = vi.fn()

    render(
      <InlineBlocks blocks={[block]} onPatchAccept={onAccept} />,
    )

    fireEvent.click(screen.getByTestId('patch-accept'))

    // No warning shown
    expect(screen.queryByTestId('patch-staleness-warning')).not.toBeInTheDocument()
    // Accept called directly
    expect(onAccept).toHaveBeenCalledWith('patch-stale', block)
  })

  it('accept with different hash → shows staleness warning', () => {
    const block = makePatchBlock({ graph_hash_at_proposal: 'old-hash-from-proposal' })
    const onAccept = vi.fn()

    render(
      <InlineBlocks blocks={[block]} onPatchAccept={onAccept} />,
    )

    fireEvent.click(screen.getByTestId('patch-accept'))

    // Warning shown
    expect(screen.getByTestId('patch-staleness-warning')).toBeInTheDocument()
    expect(screen.getByText(/proposed before your last edit/)).toBeInTheDocument()
    // Accept NOT called yet
    expect(onAccept).not.toHaveBeenCalled()
    // Shows "Apply anyway" and "Dismiss" buttons
    expect(screen.getByTestId('patch-apply-anyway')).toBeInTheDocument()
    expect(screen.getByTestId('patch-dismiss-stale')).toBeInTheDocument()
  })

  it('"Apply anyway" on stale patch → calls accept handler', () => {
    const block = makePatchBlock({ graph_hash_at_proposal: 'old-hash' })
    const onAccept = vi.fn()

    render(
      <InlineBlocks blocks={[block]} onPatchAccept={onAccept} />,
    )

    // Trigger staleness
    fireEvent.click(screen.getByTestId('patch-accept'))
    expect(screen.getByTestId('patch-staleness-warning')).toBeInTheDocument()

    // Click "Apply anyway"
    fireEvent.click(screen.getByTestId('patch-apply-anyway'))
    expect(onAccept).toHaveBeenCalledWith('patch-stale', block)
  })

  it('"Dismiss" on stale patch → calls dismiss handler', () => {
    const block = makePatchBlock({ graph_hash_at_proposal: 'old-hash' })
    const onDismiss = vi.fn()

    render(
      <InlineBlocks blocks={[block]} onPatchDismiss={onDismiss} />,
    )

    // Trigger staleness
    fireEvent.click(screen.getByTestId('patch-accept'))

    // Click "Dismiss"
    fireEvent.click(screen.getByTestId('patch-dismiss-stale'))
    expect(onDismiss).toHaveBeenCalledWith('patch-stale')
  })

  it('missing graph_hash_at_proposal → accepts normally (no warning)', () => {
    const block = makePatchBlock() // no graph_hash_at_proposal
    const onAccept = vi.fn()

    render(
      <InlineBlocks blocks={[block]} onPatchAccept={onAccept} />,
    )

    fireEvent.click(screen.getByTestId('patch-accept'))

    expect(screen.queryByTestId('patch-staleness-warning')).not.toBeInTheDocument()
    expect(onAccept).toHaveBeenCalledWith('patch-stale', block)
  })

  it('graph_hash_at_proposal stored correctly in block type', () => {
    const block = makePatchBlock({ graph_hash_at_proposal: 'stored-hash-123' })
    expect(block.graph_hash_at_proposal).toBe('stored-hash-123')
  })
})
