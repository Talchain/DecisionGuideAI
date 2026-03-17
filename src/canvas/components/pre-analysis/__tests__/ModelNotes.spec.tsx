/**
 * ModelNotes — component tests.
 * Phase 2B: Pre-analysis enrichment (Task 4c).
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ModelNotes } from '../ModelNotes'

describe('ModelNotes', () => {
  it('hides entirely if zero notes', () => {
    const { container } = render(<ModelNotes notes={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders notes with severity icons and text labels', () => {
    render(
      <ModelNotes
        notes={[
          { message: 'Missing time horizon', severity: 'warning' },
          { message: 'Consider adding constraints', severity: 'info' },
        ]}
      />,
    )

    expect(screen.getByText('Missing time horizon')).toBeInTheDocument()
    expect(screen.getByText('Consider adding constraints')).toBeInTheDocument()
    // Screen reader text for severity
    expect(screen.getByText('Warning:')).toBeInTheDocument()
    expect(screen.getByText('Information:')).toBeInTheDocument()
  })

  it('shows suggested action when available', () => {
    render(
      <ModelNotes
        notes={[
          { message: 'Missing baseline', severity: 'info', suggestedAction: 'Add a status quo option' },
        ]}
      />,
    )

    expect(screen.getByText('Add a status quo option')).toBeInTheDocument()
  })

  it('shows max 3 notes, with expand', () => {
    const notes = [
      { message: 'Note 1', severity: 'info' as const },
      { message: 'Note 2', severity: 'info' as const },
      { message: 'Note 3', severity: 'info' as const },
      { message: 'Note 4', severity: 'warning' as const },
    ]

    render(<ModelNotes notes={notes} />)

    expect(screen.getByText('Note 1')).toBeInTheDocument()
    expect(screen.getByText('Note 2')).toBeInTheDocument()
    expect(screen.getByText('Note 3')).toBeInTheDocument()
    expect(screen.queryByText('Note 4')).not.toBeInTheDocument()
    expect(screen.getByText('and 1 more')).toBeInTheDocument()
  })

  it('expands to show all notes', () => {
    const notes = [
      { message: 'A', severity: 'info' as const },
      { message: 'B', severity: 'info' as const },
      { message: 'C', severity: 'info' as const },
      { message: 'D', severity: 'info' as const },
    ]

    render(<ModelNotes notes={notes} />)

    fireEvent.click(screen.getByText('and 1 more'))
    expect(screen.getByText('D')).toBeInTheDocument()
  })

  it('has accessible section label', () => {
    render(<ModelNotes notes={[{ message: 'Test', severity: 'info' }]} />)
    expect(screen.getByLabelText('Model notes')).toBeInTheDocument()
  })
})
