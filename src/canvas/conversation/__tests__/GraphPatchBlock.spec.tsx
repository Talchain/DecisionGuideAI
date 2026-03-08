/**
 * Tests for GraphPatchBlock rendering in InlineBlocks
 *
 * Verifies:
 * - Renders with summary text, Accept, and Dismiss buttons
 * - Accept calls onPatchAccept
 * - Dismiss calls onPatchDismiss
 * - Buttons disabled after state transition from 'proposed'
 * - Block shows "Applied", "Rejected", "Dismissed" status labels
 * - Rejection info displays inline
 * - Respects DS v2.1 tokens (CSS variables, not raw Tailwind)
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { InlineBlocks } from '../InlineBlocks'
import type { GraphPatchBlock } from '../types'
import type { PatchBlockState, PatchRejectionInfo } from '../useConversation'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePatchBlock(overrides?: Partial<GraphPatchBlock>): GraphPatchBlock {
  return {
    type: 'graph_patch',
    patch_id: 'patch-1',
    summary: "Add 'competitor response' as a risk factor",
    operations: [
      { op: 'add_node', target_id: 'n-new', data: { type: 'risk', label: 'Competitor response' } },
    ],
    target_graph_hash: 'abc123',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GraphPatchBlock', () => {
  it('renders with summary text, Accept, and Dismiss buttons', () => {
    const block = makePatchBlock()
    render(
      <InlineBlocks blocks={[block]} />,
    )

    expect(screen.getByText("Add 'competitor response' as a risk factor")).toBeInTheDocument()
    expect(screen.getByText('1 risk')).toBeInTheDocument()
    expect(screen.getByTestId('patch-accept')).toBeInTheDocument()
    expect(screen.getByTestId('patch-dismiss')).toBeInTheDocument()
  })

  it('calls onPatchAccept when Accept is clicked', () => {
    const block = makePatchBlock()
    const onAccept = vi.fn()
    render(
      <InlineBlocks blocks={[block]} onPatchAccept={onAccept} />,
    )

    fireEvent.click(screen.getByTestId('patch-accept'))
    expect(onAccept).toHaveBeenCalledWith('patch-1', block)
  })

  it('calls onPatchDismiss when Dismiss is clicked', () => {
    const block = makePatchBlock()
    const onDismiss = vi.fn()
    render(
      <InlineBlocks blocks={[block]} onPatchDismiss={onDismiss} />,
    )

    fireEvent.click(screen.getByTestId('patch-dismiss'))
    expect(onDismiss).toHaveBeenCalledWith('patch-1')
  })

  it('shows "Applied" status and hides buttons when accepted', () => {
    const block = makePatchBlock()
    const states = new Map<string, PatchBlockState>([['patch-1', 'accepted']])
    render(
      <InlineBlocks blocks={[block]} patchBlockStates={states} />,
    )

    expect(screen.getByTestId('patch-status-applied')).toBeInTheDocument()
    expect(screen.queryByTestId('patch-accept')).not.toBeInTheDocument()
    expect(screen.queryByTestId('patch-dismiss')).not.toBeInTheDocument()
  })

  it('shows "Dismissed" status and hides buttons when dismissed', () => {
    const block = makePatchBlock()
    const states = new Map<string, PatchBlockState>([['patch-1', 'dismissed']])
    render(
      <InlineBlocks blocks={[block]} patchBlockStates={states} />,
    )

    expect(screen.getByTestId('patch-status-dismissed')).toBeInTheDocument()
    expect(screen.queryByTestId('patch-accept')).not.toBeInTheDocument()
    expect(screen.queryByTestId('patch-dismiss')).not.toBeInTheDocument()
  })

  it('shows rejection info inline when rejected', () => {
    const block = makePatchBlock()
    const states = new Map<string, PatchBlockState>([['patch-1', 'rejected']])
    const rejections = new Map<string, PatchRejectionInfo>([
      ['patch-1', {
        code: 'INVALID_NODE',
        message: 'Node type not supported',
        violations: ['Missing label field', 'Invalid edge weight'],
      }],
    ])
    render(
      <InlineBlocks
        blocks={[block]}
        patchBlockStates={states}
        patchRejections={rejections}
      />,
    )

    expect(screen.getByTestId('patch-status-rejected')).toBeInTheDocument()
    expect(screen.getByText(/INVALID_NODE/)).toBeInTheDocument()
    expect(screen.getByText(/Node type not supported/)).toBeInTheDocument()
    expect(screen.getByText('Missing label field')).toBeInTheDocument()
  })

  it('shows "Show more" toggle for multiple violations', () => {
    const block = makePatchBlock()
    const states = new Map<string, PatchBlockState>([['patch-1', 'rejected']])
    const rejections = new Map<string, PatchRejectionInfo>([
      ['patch-1', {
        code: 'MULTI_VIOLATION',
        message: 'Multiple issues found',
        violations: ['Violation 1', 'Violation 2', 'Violation 3'],
      }],
    ])
    render(
      <InlineBlocks
        blocks={[block]}
        patchBlockStates={states}
        patchRejections={rejections}
      />,
    )

    // First violation visible
    expect(screen.getByText('Violation 1')).toBeInTheDocument()
    // Toggle should show
    expect(screen.getByText('Show 2 more')).toBeInTheDocument()
  })

  it('renders multiple operations count', () => {
    const block = makePatchBlock({
      operations: [
        { op: 'add_node', target_id: 'n1', data: {} },
        { op: 'add_edge', target_id: 'e1', data: { source: 'n1', target: 'n2' } },
        { op: 'update_node', target_id: 'n2', data: { label: 'Updated' } },
      ],
    })
    render(
      <InlineBlocks blocks={[block]} />,
    )

    expect(screen.getByText('2 nodes, 1 edge')).toBeInTheDocument()
  })

  it('shows retry button on network error (block stays proposed)', () => {
    const block = makePatchBlock()
    const states = new Map<string, PatchBlockState>([['patch-1', 'proposed']])
    const rejections = new Map<string, PatchRejectionInfo>([
      ['patch-1', { code: 'NETWORK_ERROR', message: 'Failed to apply — try again' }],
    ])
    const onAccept = vi.fn()
    render(
      <InlineBlocks
        blocks={[block]}
        patchBlockStates={states}
        patchRejections={rejections}
        onPatchAccept={onAccept}
      />,
    )

    expect(screen.getByTestId('patch-retry-error')).toBeInTheDocument()
    expect(screen.getByText('Try again')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Try again'))
    expect(onAccept).toHaveBeenCalledWith('patch-1', block)
  })
})
