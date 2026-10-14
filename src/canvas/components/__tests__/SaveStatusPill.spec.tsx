/**
 * P0-2: Save Status Pill Tests
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SaveStatusPill } from '../SaveStatusPill'

describe('SaveStatusPill (P0-2)', () => {
  it('shows "Saving..." when isSaving is true', () => {
    render(<SaveStatusPill isDirty={false} isSaving={true} lastSavedAt={null} />)

    expect(screen.getByTestId('save-status-saving')).toBeInTheDocument()
    expect(screen.getByText('Saving…')).toBeInTheDocument()
  })

  it('shows "Saved just now" when recently saved', () => {
    const recentTime = Date.now() - 5000 // 5 seconds ago

    render(<SaveStatusPill isDirty={false} isSaving={false} lastSavedAt={recentTime} />)

    expect(screen.getByTestId('save-status-saved')).toBeInTheDocument()
    expect(screen.getByText(/Saved just now/)).toBeInTheDocument()
  })

  it('shows "Saved Xs ago" for older saves', () => {
    vi.useFakeTimers()
    const oldTime = Date.now() - 30000 // 30 seconds ago

    render(<SaveStatusPill isDirty={false} isSaving={false} lastSavedAt={oldTime} />)

    expect(screen.getByText(/Saved 30s ago/)).toBeInTheDocument()

    vi.useRealTimers()
  })

  it('shows "Saved by [user] • [time]" when savedBy is provided', () => {
    const recentTime = Date.now() - 5000

    render(<SaveStatusPill isDirty={false} isSaving={false} lastSavedAt={recentTime} savedBy="Alice" />)

    expect(screen.getByText(/Saved by Alice • just now/)).toBeInTheDocument()
  })

  it('shows neutral unsaved changes without a check, even after an earlier save', () => {
    const { container } = render(<SaveStatusPill isDirty={true} isSaving={false} lastSavedAt={Date.now()} />)
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()
    expect(screen.queryByTestId('save-status-saved')).not.toBeInTheDocument()
    expect(container.querySelector('svg')).toBeNull()
    expect(screen.getByRole('status')).toHaveClass('border-panel-border')
  })

  it('saving takes precedence over dirty', () => {
    render(<SaveStatusPill isDirty={true} isSaving={true} lastSavedAt={Date.now()} />)
    expect(screen.getByText('Saving…')).toBeInTheDocument()
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument()
  })

  it('renders nothing when not saving and no lastSavedAt', () => {
    const { container } = render(<SaveStatusPill isDirty={false} isSaving={false} lastSavedAt={null} />)

    expect(container.firstChild).toBeNull()
  })

  it('has proper ARIA attributes for accessibility', () => {
    render(<SaveStatusPill isDirty={false} isSaving={true} lastSavedAt={null} />)

    const statusElement = screen.getByRole('status')
    expect(statusElement).toHaveAttribute('aria-live', 'polite')
  })
})
