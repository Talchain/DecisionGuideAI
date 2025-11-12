/**
 * M6: Scenario Comparison Tests
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ScenarioComparison } from '../ScenarioComparison'
import type { Snapshot, ComparisonResult } from '../../snapshots/types'

describe('ScenarioComparison (M6)', () => {
  const snapshotA: Snapshot = {
    id: 's1',
    name: 'Scenario A',
    description: 'Base scenario',
    createdAt: new Date('2025-01-01'),
    nodes: [
      { id: 'n1', data: { label: 'Node 1' }, position: { x: 0, y: 0 } },
      { id: 'n2', data: { label: 'Node 2' }, position: { x: 100, y: 0 } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
    ],
  }

  const snapshotB: Snapshot = {
    id: 's2',
    name: 'Scenario B',
    description: 'Variant scenario',
    createdAt: new Date('2025-01-02'),
    nodes: [
      { id: 'n1', data: { label: 'Node 1 Updated' }, position: { x: 0, y: 0 } },
      { id: 'n3', data: { label: 'Node 3' }, position: { x: 200, y: 0 } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n3' },
      { id: 'e2', source: 'n3', target: 'n1' },
    ],
  }

  const comparison: ComparisonResult = {
    added: {
      nodes: [{ id: 'n3', data: { label: 'Node 3' }, position: { x: 200, y: 0 } }],
      edges: [{ id: 'e2', source: 'n3', target: 'n1' }],
    },
    removed: {
      nodes: [{ id: 'n2', data: { label: 'Node 2' }, position: { x: 100, y: 0 } }],
      edges: [],
    },
    modified: {
      nodes: [{ id: 'n1', data: { label: 'Node 1 Updated' }, position: { x: 0, y: 0 } }],
      edges: [{ id: 'e1', source: 'n1', target: 'n3' }],
    },
    unchanged: {
      nodes: [],
      edges: [],
    },
  }

  it('renders comparison header with scenario names', () => {
    const onExport = vi.fn()
    const onClose = vi.fn()

    render(
      <ScenarioComparison
        snapshotA={snapshotA}
        snapshotB={snapshotB}
        comparison={comparison}
        onExport={onExport}
        onClose={onClose}
      />
    )

    expect(screen.getByText(/scenario a vs scenario b/i)).toBeInTheDocument()
  })

  it('displays stats bar with counts', () => {
    const onExport = vi.fn()
    const onClose = vi.fn()

    render(
      <ScenarioComparison
        snapshotA={snapshotA}
        snapshotB={snapshotB}
        comparison={comparison}
        onExport={onExport}
        onClose={onClose}
      />
    )

    expect(screen.getByText(/2 added/i)).toBeInTheDocument() // 1 node + 1 edge
    expect(screen.getByText(/1 removed/i)).toBeInTheDocument()
    expect(screen.getByText(/2 modified/i)).toBeInTheDocument()
  })

  it('switches between split and changes views', () => {
    const onExport = vi.fn()
    const onClose = vi.fn()

    render(
      <ScenarioComparison
        snapshotA={snapshotA}
        snapshotB={snapshotB}
        comparison={comparison}
        onExport={onExport}
        onClose={onClose}
      />
    )

    const changesButton = screen.getByRole('button', { name: /changes only/i })
    fireEvent.click(changesButton)

    // Should show changes view with added/removed/modified sections
    expect(screen.getByText(/added \(2\)/i)).toBeInTheDocument()
  })

  it('calls onExport when export button is clicked', () => {
    const onExport = vi.fn()
    const onClose = vi.fn()

    render(
      <ScenarioComparison
        snapshotA={snapshotA}
        snapshotB={snapshotB}
        comparison={comparison}
        onExport={onExport}
        onClose={onClose}
      />
    )

    const exportButton = screen.getByRole('button', { name: /export/i })
    fireEvent.click(exportButton)

    expect(onExport).toHaveBeenCalled()
  })

  it('calls onClose when close button is clicked', () => {
    const onExport = vi.fn()
    const onClose = vi.fn()

    render(
      <ScenarioComparison
        snapshotA={snapshotA}
        snapshotB={snapshotB}
        comparison={comparison}
        onExport={onExport}
        onClose={onClose}
      />
    )

    const closeButton = screen.getByTitle('Close comparison')
    fireEvent.click(closeButton)

    expect(onClose).toHaveBeenCalled()
  })

  it('shows added items in changes view', () => {
    const onExport = vi.fn()
    const onClose = vi.fn()

    render(
      <ScenarioComparison
        snapshotA={snapshotA}
        snapshotB={snapshotB}
        comparison={comparison}
        onExport={onExport}
        onClose={onClose}
      />
    )

    const changesButton = screen.getByRole('button', { name: /changes only/i })
    fireEvent.click(changesButton)

    expect(screen.getByText(/\+ Node: Node 3/i)).toBeInTheDocument()
    expect(screen.getByText(/\+ Edge: n3 → n1/i)).toBeInTheDocument()
  })

  it('shows removed items in changes view', () => {
    const onExport = vi.fn()
    const onClose = vi.fn()

    render(
      <ScenarioComparison
        snapshotA={snapshotA}
        snapshotB={snapshotB}
        comparison={comparison}
        onExport={onExport}
        onClose={onClose}
      />
    )

    const changesButton = screen.getByRole('button', { name: /changes only/i })
    fireEvent.click(changesButton)

    expect(screen.getByText(/- Node: Node 2/i)).toBeInTheDocument()
  })
})
