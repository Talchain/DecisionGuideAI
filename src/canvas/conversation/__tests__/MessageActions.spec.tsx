/**
 * Tests for MessageActions.
 *
 * Verifies:
 * - User messages: Copy only
 * - Assistant messages: Copy + Retry
 * - Click handlers fire correctly
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MessageActions } from '../zones/MessageActions'

describe('MessageActions', () => {
  it('shows only Copy for user messages', () => {
    render(<MessageActions role="user" content="test" />)
    expect(screen.getByLabelText('Copy')).toBeInTheDocument()
    expect(screen.queryByLabelText('Retry')).not.toBeInTheDocument()
  })

  it('shows Copy and Retry for assistant messages', () => {
    render(<MessageActions role="assistant" content="test" onRetry={vi.fn()} />)
    expect(screen.getByLabelText('Copy')).toBeInTheDocument()
    expect(screen.getByLabelText('Retry')).toBeInTheDocument()
  })

  it('does not show Retry for assistant without onRetry', () => {
    render(<MessageActions role="assistant" content="test" />)
    expect(screen.getByLabelText('Copy')).toBeInTheDocument()
    expect(screen.queryByLabelText('Retry')).not.toBeInTheDocument()
  })

  it('calls onRetry when Retry is clicked', () => {
    const onRetry = vi.fn()
    render(<MessageActions role="assistant" content="test" onRetry={onRetry} />)
    fireEvent.click(screen.getByLabelText('Retry'))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('has toolbar role for accessibility', () => {
    render(<MessageActions role="user" content="test" />)
    expect(screen.getByRole('toolbar')).toBeInTheDocument()
  })
})
