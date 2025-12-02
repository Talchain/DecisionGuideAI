/**
 * M2.4: Diff Viewer Tests
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { DiffViewer } from '../DiffViewer'
import type { DraftResponse } from '../../../adapters/assistants/types'

describe('DiffViewer (M2.4)', () => {
  const mockDraft: DraftResponse = {
    schema: 'draft.v1',
    graph: {
      nodes: [
        { id: 'n1', label: 'Node 1', type: 'decision' },
        { id: 'n2', label: 'Node 2' },
      ],
      edges: [
        { id: 'e1', from: 'n1', to: 'n2', label: 'Edge 1' },
      ],
    },
  }

  it('renders all nodes and edges by default', () => {
    const onApply = vi.fn()
    const onReject = vi.fn()

    render(<DiffViewer draft={mockDraft} onApply={onApply} onReject={onReject} />)

    expect(screen.getByText('Node 1')).toBeInTheDocument()
    expect(screen.getByText('Node 2')).toBeInTheDocument()
    // Edges are rendered using their label when present
    expect(screen.getByText('Edge 1')).toBeInTheDocument()
  })

  it('shows correct counts in section headers', () => {
    const onApply = vi.fn()
    const onReject = vi.fn()

    render(<DiffViewer draft={mockDraft} onApply={onApply} onReject={onReject} />)

    expect(screen.getByText(/2 nodes.*2 selected/i)).toBeInTheDocument()
    expect(screen.getByText(/1 edges.*1 selected/i)).toBeInTheDocument()
  })

  it('allows toggling individual items', () => {
    const onApply = vi.fn()
    const onReject = vi.fn()

    render(<DiffViewer draft={mockDraft} onApply={onApply} onReject={onReject} />)

    const checkboxes = screen.getAllByRole('checkbox')
    const firstCheckbox = checkboxes[0]

    expect(firstCheckbox).toBeChecked()
    fireEvent.click(firstCheckbox)
    expect(firstCheckbox).not.toBeChecked()
  })

  it('select all nodes button checks all node checkboxes', () => {
    const onApply = vi.fn()
    const onReject = vi.fn()

    render(<DiffViewer draft={mockDraft} onApply={onApply} onReject={onReject} />)

    // First deselect one
    const initialCheckboxes = screen.getAllByRole('checkbox')
    fireEvent.click(initialCheckboxes[0])

    // Then click "Select all" in the nodes header
    const nodesHeaderButton = screen.getByText(/2 nodes/i).closest('button') as HTMLElement
    const selectAllButton = within(nodesHeaderButton).getByRole('button', { name: /^select all$/i })
    fireEvent.click(selectAllButton)

    // All node checkboxes should be checked
    const nodeCheckboxes = screen.getAllByRole('checkbox').slice(0, 2) // First 2 are nodes
    nodeCheckboxes.forEach((cb) => {
      expect(cb).toBeChecked()
    })
  })

  it('deselect all nodes button unchecks all node checkboxes', () => {
    const onApply = vi.fn()
    const onReject = vi.fn()

    render(<DiffViewer draft={mockDraft} onApply={onApply} onReject={onReject} />)

    const nodesHeaderButton = screen.getByText(/2 nodes/i).closest('button') as HTMLElement
    const deselectAllButton = within(nodesHeaderButton).getByRole('button', { name: /^deselect all$/i })
    fireEvent.click(deselectAllButton)

    const nodeCheckboxes = screen.getAllByRole('checkbox').slice(0, 2)
    nodeCheckboxes.forEach((cb) => {
      expect(cb).not.toBeChecked()
    })
  })

  it('calls onApply with selected node and edge IDs', () => {
    const onApply = vi.fn()
    const onReject = vi.fn()

    render(<DiffViewer draft={mockDraft} onApply={onApply} onReject={onReject} />)

    const applyButton = screen.getByRole('button', { name: /apply changes/i })
    fireEvent.click(applyButton)

    expect(onApply).toHaveBeenCalledWith(['n1', 'n2'], ['e1'])
  })

  it('calls onApply with only selected items', () => {
    const onApply = vi.fn()
    const onReject = vi.fn()

    render(<DiffViewer draft={mockDraft} onApply={onApply} onReject={onReject} />)

    // Deselect first node
    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0])

    const applyButton = screen.getByRole('button', { name: /apply changes/i })
    fireEvent.click(applyButton)

    expect(onApply).toHaveBeenCalledWith(['n2'], ['e1'])
  })

  it('calls onReject when reject button is clicked', () => {
    const onApply = vi.fn()
    const onReject = vi.fn()

    render(<DiffViewer draft={mockDraft} onApply={onApply} onReject={onReject} />)

    const rejectButton = screen.getByRole('button', { name: /reject/i })
    fireEvent.click(rejectButton)

    expect(onReject).toHaveBeenCalled()
    expect(onApply).not.toHaveBeenCalled()
  })

  it('shows total count in apply button', () => {
    const onApply = vi.fn()
    const onReject = vi.fn()

    render(<DiffViewer draft={mockDraft} onApply={onApply} onReject={onReject} />)

    expect(screen.getByRole('button', { name: /apply changes \(3\)/i })).toBeInTheDocument()
  })

  it('disables apply button when nothing is selected', () => {
    const onApply = vi.fn()
    const onReject = vi.fn()

    render(<DiffViewer draft={mockDraft} onApply={onApply} onReject={onReject} />)

    // Deselect all
    const deselectAllButtons = screen.getAllByRole('button', { name: /deselect all/i })
    deselectAllButtons.forEach((btn) => fireEvent.click(btn))

    const applyButton = screen.getByRole('button', { name: /apply changes \(0\)/i })
    expect(applyButton).toBeDisabled()
  })
})
