/**
 * N2: Health Panel Guidance Tests
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { IssuesPanel } from '../../panels/IssuesPanel'
import type { ValidationIssue } from '../../validation/types'

describe('Health Panel Guidance', () => {
  const mockIssues: ValidationIssue[] = [
    {
      id: '1',
      type: 'cycle',
      severity: 'error',
      message: 'Circular dependency detected',
      nodeIds: ['n1', 'n2'],
      suggestedFix: { type: 'remove_edge', edgeId: 'e1' } as any
    },
    {
      id: '2',
      type: 'orphan_node',
      severity: 'warning',
      message: 'Orphaned node found',
      nodeIds: ['n3'],
      suggestedFix: { type: 'remove_node', nodeId: 'n3' } as any
    }
  ]

  it('renders "Why this matters" explainer toggle', () => {
    render(<IssuesPanel issues={mockIssues} onFixIssue={vi.fn()} onClose={vi.fn()} />)

    const explainerButtons = screen.getAllByText('Why this matters')
    expect(explainerButtons.length).toBeGreaterThan(0)
  })

  it('shows explainer content when toggled', () => {
    render(<IssuesPanel issues={mockIssues} onFixIssue={vi.fn()} onClose={vi.fn()} />)

    const explainerButton = screen.getAllByText('Why this matters')[0]
    fireEvent.click(explainerButton)

    expect(screen.getByText(/Circular dependencies/)).toBeInTheDocument()
  })

  it('renders Fix Next button when fixable issues exist', () => {
    render(<IssuesPanel issues={mockIssues} onFixIssue={vi.fn()} onClose={vi.fn()} />)

    expect(screen.getByLabelText('Fix next issue')).toBeInTheDocument()
  })

  it('calls onFixIssue with first issue when Fix Next clicked', () => {
    const onFixIssue = vi.fn()
    render(<IssuesPanel issues={mockIssues} onFixIssue={onFixIssue} onClose={vi.fn()} />)

    const fixNextButton = screen.getByLabelText('Fix next issue')
    fireEvent.click(fixNextButton)

    expect(onFixIssue).toHaveBeenCalledWith(mockIssues[0])
  })

  it('renders Fix All button when multiple fixable issues exist', () => {
    const onFixAll = vi.fn()
    render(
      <IssuesPanel
        issues={mockIssues}
        onFixIssue={vi.fn()}
        onFixAll={onFixAll}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByLabelText('Fix all issues')).toBeInTheDocument()
  })

  it('prioritizes errors over warnings for Fix Next', () => {
    const onFixIssue = vi.fn()
    render(<IssuesPanel issues={mockIssues} onFixIssue={onFixIssue} onClose={vi.fn()} />)

    fireEvent.click(screen.getByLabelText('Fix next issue'))

    // Should fix error (cycle) before warning (orphan)
    expect(onFixIssue).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error' })
    )
  })
})
