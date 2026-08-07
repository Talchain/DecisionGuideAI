/**
 * Tests for FeedbackRow component
 *
 * Verifies:
 * - Renders thumbs up and thumbs down buttons
 * - Clicking up calls onFeedback with 'up' and turnId
 * - Clicking down calls onFeedback with 'down' and turnId
 * - After click, both buttons are disabled (prevent double-submit)
 * - Hidden when turnId is undefined
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { FeedbackRow } from '../FeedbackRow'

describe('FeedbackRow', () => {
  it('renders both feedback buttons when turnId is provided', () => {
    const onFeedback = vi.fn()
    render(<FeedbackRow turnId="turn-1" onFeedback={onFeedback} />)

    expect(screen.getByRole('button', { name: 'Helpful' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Not helpful' })).toBeTruthy()
  })

  it('returns null when turnId is undefined', () => {
    const onFeedback = vi.fn()
    const { container } = render(<FeedbackRow turnId={undefined} onFeedback={onFeedback} />)
    expect(container.firstChild).toBeNull()
  })

  it('calls onFeedback with turnId and "up" when thumbs up clicked', () => {
    const onFeedback = vi.fn()
    render(<FeedbackRow turnId="turn-abc" onFeedback={onFeedback} />)

    fireEvent.click(screen.getByRole('button', { name: 'Helpful' }))

    expect(onFeedback).toHaveBeenCalledTimes(1)
    expect(onFeedback).toHaveBeenCalledWith('turn-abc', 'up')
  })

  it('calls onFeedback with turnId and "down" when thumbs down clicked', () => {
    const onFeedback = vi.fn()
    render(<FeedbackRow turnId="turn-xyz" onFeedback={onFeedback} />)

    fireEvent.click(screen.getByRole('button', { name: 'Not helpful' }))

    expect(onFeedback).toHaveBeenCalledTimes(1)
    expect(onFeedback).toHaveBeenCalledWith('turn-xyz', 'down')
  })

  it('disables both buttons after voting', () => {
    const onFeedback = vi.fn()
    render(<FeedbackRow turnId="turn-1" onFeedback={onFeedback} />)

    fireEvent.click(screen.getByRole('button', { name: 'Helpful' }))

    expect(screen.getByRole('button', { name: 'Helpful' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Not helpful' })).toBeDisabled()
  })

  it('does not call onFeedback more than once even if clicked multiple times', () => {
    const onFeedback = vi.fn()
    render(<FeedbackRow turnId="turn-1" onFeedback={onFeedback} />)

    fireEvent.click(screen.getByRole('button', { name: 'Helpful' }))
    // Second click should be a no-op since button is disabled
    fireEvent.click(screen.getByRole('button', { name: 'Helpful' }))

    expect(onFeedback).toHaveBeenCalledTimes(1)
  })

  it('reverts the vote and re-enables the buttons when onFeedback rejects', async () => {
    // The feedback turn failed to reach the server — the user's thumbs action
    // must not vanish silently, so the optimistic vote is rolled back and the
    // buttons re-enable for a retry.
    const onFeedback = vi.fn().mockRejectedValue(new Error('send failed'))
    render(<FeedbackRow turnId="turn-1" onFeedback={onFeedback} />)

    fireEvent.click(screen.getByRole('button', { name: 'Helpful' }))
    // Optimistic disable happens synchronously on click.
    expect(screen.getByRole('button', { name: 'Helpful' })).toBeDisabled()

    // After the rejected send settles, both buttons become clickable again.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Helpful' })).not.toBeDisabled()
    })
    expect(screen.getByRole('button', { name: 'Not helpful' })).not.toBeDisabled()
  })
})
