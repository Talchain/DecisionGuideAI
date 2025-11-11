/**
 * P0-2: Save Status Pill Tests
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SaveStatusPill } from '../SaveStatusPill'

describe('SaveStatusPill (P0-2)', () => {
  it('shows "Saving..." when isSaving is true', () => {
    render(<SaveStatusPill isSaving={true} lastSavedAt={null} />)

    expect(screen.getByTestId('save-status-saving')).toBeInTheDocument()
    expect(screen.getByText('Saving…')).toBeInTheDocument()
  })

  it('shows "Saved just now" when recently saved', () => {
    const recentTime = Date.now() - 5000 // 5 seconds ago

    render(<SaveStatusPill isSaving={false} lastSavedAt={recentTime} />)

    expect(screen.getByTestId('save-status-saved')).toBeInTheDocument()
    expect(screen.getByText(/Saved just now/)).toBeInTheDocument()
  })

  it('shows "Saved Xs ago" for older saves', () => {
    vi.useFakeTimers()
    const oldTime = Date.now() - 30000 // 30 seconds ago

    render(<SaveStatusPill isSaving={false} lastSavedAt={oldTime} />)

    expect(screen.getByText(/Saved 30s ago/)).toBeInTheDocument()

    vi.useRealTimers()
  })

  it('shows "Saved by [user]" when savedBy is provided', () => {
    const recentTime = Date.now() - 5000

    render(<SaveStatusPill isSaving={false} lastSavedAt={recentTime} savedBy="Alice" />)

    expect(screen.getByText(/Saved just now by Alice/)).toBeInTheDocument()
  })

  it('renders nothing when not saving and no lastSavedAt', () => {
    const { container } = render(<SaveStatusPill isSaving={false} lastSavedAt={null} />)

    expect(container.firstChild).toBeNull()
  })

  it('has proper ARIA attributes for accessibility', () => {
    render(<SaveStatusPill isSaving={true} lastSavedAt={null} />)

    const statusElement = screen.getByRole('status')
    expect(statusElement).toHaveAttribute('aria-live', 'polite')
  })
})
