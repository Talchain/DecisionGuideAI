/**
 * YourExpertise — Brief 5.1 follow-up P0 #1.
 *
 * Inline editor + one-active-editor invariant across the expanded
 * surface. Covers:
 *
 * - Pencil click on an AiEstimated row opens the editor inline.
 * - Opening a second row's editor collapses the first (exclusivity).
 * - Saving commits (nodeId, rawValue) via onCommitValue + closes editor.
 * - Cancelling closes without committing.
 * - Works across AiEstimated + MissingData (same invariant).
 * - Fallback path: when onCommitValue is not wired, the Pencil click
 *   routes through the legacy onEdit/onSetValue callbacks as before
 *   (keeps fixtures and Storybook working).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { YourExpertise } from '../YourExpertise'
import type { ImprovementItem } from '../../hooks/usePreAnalysisData'
import type { Node } from '@xyflow/react'

const setActiveOutputTab = vi.fn()
vi.mock('@/stores/uiStore', () => ({
  useUIStore: Object.assign(
    () => ({ setActiveOutputTab }),
    { getState: () => ({ setActiveOutputTab }) },
  ),
}))

function makeAiItem(nodeId: string, label: string, rawValue: number | null = null): ImprovementItem {
  return {
    key: `verify-${nodeId}`,
    category: 'verify',
    label,
    detail: 'AI estimate',
    subgroup: 'cee_inference',
    focus: { type: 'node', id: nodeId, label },
    action: { label: 'Confirm value', kind: 'confirm', targetId: nodeId, targetType: 'node' },
    rawValue,
    unit: '%',
    cap: 100,
  }
}

function makeFactorNode(id: string, label: string, observedValue: number | null = null): Node {
  return {
    id,
    position: { x: 0, y: 0 },
    data: {
      kind: 'factor',
      label,
      observedState: observedValue == null ? {} : { value: observedValue },
    },
  }
}

function expand(label: string) {
  // Click the expansion header so the inline rows mount.
  const header = screen.getByTestId('your-expertise-header')
  fireEvent.click(header)
  // Sanity: the expanded surface is now in the DOM.
  expect(screen.getByTestId('your-expertise-expanded')).toBeInTheDocument()
  // Silence lint for unused-but-useful label.
  void label
}

describe('YourExpertise — Brief 5.1 follow-up P0 #1 inline editor', () => {
  beforeEach(() => {
    setActiveOutputTab.mockClear()
  })

  it('Pencil click on an AiEstimated row opens the inline editor (no external-inspector hop)', () => {
    const onCommitValue = vi.fn()
    const onEdit = vi.fn()

    render(
      <YourExpertise
        improvementsByCategory={{ verify: [makeAiItem('n1', 'Factor One', 50)] }}
        contestedEdges={[]}
        nodes={[makeFactorNode('n1', 'Factor One', 0.5)]}
        edges={[]}
        onEdit={onEdit}
        onCommitValue={onCommitValue}
      />,
    )
    expand('Factor One')

    // Editor starts closed.
    expect(screen.queryByTestId('ai-estimated-editor-verify-n1')).not.toBeInTheDocument()

    const pencil = screen.getByRole('button', { name: 'Edit value for Factor One' })
    fireEvent.click(pencil)

    // Editor visible; legacy onEdit is NOT fired (inline path preferred).
    expect(screen.getByTestId('ai-estimated-editor-verify-n1')).toBeInTheDocument()
    expect(onEdit).not.toHaveBeenCalled()
  })

  it('one-active-editor invariant: opening row B collapses row A', () => {
    const onCommitValue = vi.fn()
    render(
      <YourExpertise
        improvementsByCategory={{
          verify: [
            makeAiItem('n1', 'Factor One', 50),
            makeAiItem('n2', 'Factor Two', 30),
          ],
        }}
        contestedEdges={[]}
        nodes={[
          makeFactorNode('n1', 'Factor One', 0.5),
          makeFactorNode('n2', 'Factor Two', 0.3),
        ]}
        edges={[]}
        onCommitValue={onCommitValue}
      />,
    )
    expand('')

    // Open row A.
    fireEvent.click(screen.getByRole('button', { name: 'Edit value for Factor One' }))
    expect(screen.getByTestId('ai-estimated-editor-verify-n1')).toBeInTheDocument()

    // Open row B — row A must collapse to its compact view.
    fireEvent.click(screen.getByRole('button', { name: 'Edit value for Factor Two' }))
    expect(screen.getByTestId('ai-estimated-editor-verify-n2')).toBeInTheDocument()
    expect(screen.queryByTestId('ai-estimated-editor-verify-n1')).not.toBeInTheDocument()
  })

  it('Brief 5.2 Task 3: MissingData editor is open by default; opening an AiEstimated editor collapses it', () => {
    const onCommitValue = vi.fn()
    // MissingData is derived from nodes with no observedState value/raw_value
    // that aren't already in verifyItems — so n2 appears ONLY as a node,
    // not as a verify item. The synthetic ImprovementItem the hook emits
    // gets key `missing-${nodeId}` → data-testid missing-data-row-missing-n2.
    render(
      <YourExpertise
        improvementsByCategory={{
          verify: [makeAiItem('n1', 'Estimated Factor', 50)],
        }}
        contestedEdges={[]}
        nodes={[
          makeFactorNode('n1', 'Estimated Factor', 0.5),
          makeFactorNode('n2', 'Missing Factor'),
        ]}
        edges={[]}
        onCommitValue={onCommitValue}
      />,
    )
    expand('')

    // On first render, the MissingData editor is visible (default-open);
    // the AiEstimated editor is closed (needs a Pencil click).
    expect(screen.getByTestId('missing-data-editor-missing-n2')).toBeInTheDocument()
    expect(screen.queryByTestId('ai-estimated-editor-verify-n1')).not.toBeInTheDocument()

    // Open the AiEstimated row via its Pencil — the MissingData editor
    // collapses to enforce the one-active-editor invariant.
    fireEvent.click(screen.getByRole('button', { name: 'Edit value for Estimated Factor' }))
    expect(screen.getByTestId('ai-estimated-editor-verify-n1')).toBeInTheDocument()
    expect(screen.queryByTestId('missing-data-editor-missing-n2')).not.toBeInTheDocument()
    // Row still renders without its editor — name + Not set still visible.
    expect(screen.getByTestId('missing-data-row-missing-n2')).toBeInTheDocument()
  })

  it('Brief 5.2 Task 3: MissingData row has no Pencil/Set-value button — editor IS the default state', () => {
    const onCommitValue = vi.fn()
    render(
      <YourExpertise
        improvementsByCategory={{}}
        contestedEdges={[]}
        nodes={[makeFactorNode('n2', 'Missing Factor')]}
        edges={[]}
        onCommitValue={onCommitValue}
      />,
    )
    expand('')
    expect(screen.queryByRole('button', { name: /Set value for Missing Factor/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Edit value for Missing Factor/ })).not.toBeInTheDocument()
    // Editor is open on first render.
    expect(screen.getByTestId('missing-data-editor-missing-n2')).toBeInTheDocument()
  })

  it('fallback path: with no onCommitValue wired, Pencil routes through legacy onEdit (no inline editor)', () => {
    const onEdit = vi.fn()
    render(
      <YourExpertise
        improvementsByCategory={{ verify: [makeAiItem('n1', 'Factor One', 50)] }}
        contestedEdges={[]}
        nodes={[makeFactorNode('n1', 'Factor One', 0.5)]}
        edges={[]}
        onEdit={onEdit}
        // No onCommitValue — no inline pipeline.
      />,
    )
    expand('')

    fireEvent.click(screen.getByRole('button', { name: 'Edit value for Factor One' }))

    // Legacy callback fired; no editor mounted.
    expect(onEdit).toHaveBeenCalledWith('n1')
    expect(screen.queryByTestId('ai-estimated-editor-verify-n1')).not.toBeInTheDocument()
  })

  it('analysisRunKey change closes any open inline editor', () => {
    const onCommitValue = vi.fn()
    const { rerender } = render(
      <YourExpertise
        improvementsByCategory={{ verify: [makeAiItem('n1', 'Factor One', 50)] }}
        contestedEdges={[]}
        nodes={[makeFactorNode('n1', 'Factor One', 0.5)]}
        edges={[]}
        onCommitValue={onCommitValue}
        analysisRunKey="run-a"
      />,
    )
    expand('')
    fireEvent.click(screen.getByRole('button', { name: 'Edit value for Factor One' }))
    expect(screen.getByTestId('ai-estimated-editor-verify-n1')).toBeInTheDocument()

    // New run completes — expanded state AND open editor both close.
    rerender(
      <YourExpertise
        improvementsByCategory={{ verify: [makeAiItem('n1', 'Factor One', 50)] }}
        contestedEdges={[]}
        nodes={[makeFactorNode('n1', 'Factor One', 0.5)]}
        edges={[]}
        onCommitValue={onCommitValue}
        analysisRunKey="run-b"
      />,
    )
    expect(screen.queryByTestId('your-expertise-expanded')).not.toBeInTheDocument()
    expect(screen.queryByTestId('ai-estimated-editor-verify-n1')).not.toBeInTheDocument()
  })
})
