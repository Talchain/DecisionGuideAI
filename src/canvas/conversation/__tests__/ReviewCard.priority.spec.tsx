/**
 * Tests for ReviewCardBlock priority badge in InlineBlocks
 *
 * Verifies:
 * - Priority badge renders when priority provided (sentence case)
 * - Badge absent when priority not provided
 * - Correct data-testid per priority level
 * - Alert and info variants still work
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { InlineBlocks } from '../InlineBlocks'
import type { ReviewCardBlock } from '../types'

function makeReviewCard(overrides?: Partial<ReviewCardBlock>): ReviewCardBlock {
  return {
    type: 'review_card',
    title: 'High concentration risk',
    body: 'Your model depends heavily on a single factor.',
    variant: 'alert',
    ...overrides,
  }
}

describe('ReviewCardBlock — priority badge', () => {
  it('renders priority badge with sentence case label for critical', () => {
    render(<InlineBlocks blocks={[makeReviewCard({ priority: 'critical' })]} />)
    const badge = screen.getByTestId('priority-badge-critical')
    expect(badge).toBeInTheDocument()
    expect(badge.textContent).toBe('Critical')  // sentence case, never "CRITICAL"
  })

  it('renders priority badge for high', () => {
    render(<InlineBlocks blocks={[makeReviewCard({ priority: 'high' })]} />)
    const badge = screen.getByTestId('priority-badge-high')
    expect(badge.textContent).toBe('High')
  })

  it('renders priority badge for medium', () => {
    render(<InlineBlocks blocks={[makeReviewCard({ priority: 'medium' })]} />)
    const badge = screen.getByTestId('priority-badge-medium')
    expect(badge.textContent).toBe('Medium')
  })

  it('renders priority badge for low', () => {
    render(<InlineBlocks blocks={[makeReviewCard({ priority: 'low' })]} />)
    const badge = screen.getByTestId('priority-badge-low')
    expect(badge.textContent).toBe('Low')
  })

  it('omits badge when priority absent (backward compat)', () => {
    render(<InlineBlocks blocks={[makeReviewCard({ priority: undefined })]} />)
    expect(screen.queryByTestId(/priority-badge/)).not.toBeInTheDocument()
  })

  it('renders info variant (coaching) correctly', () => {
    render(<InlineBlocks blocks={[makeReviewCard({ variant: 'info', priority: 'medium' })]} />)
    expect(screen.getByTestId('block-review-info')).toBeInTheDocument()
    expect(screen.getByTestId('priority-badge-medium')).toBeInTheDocument()
  })

  it('renders alert variant (danger) correctly', () => {
    render(<InlineBlocks blocks={[makeReviewCard({ variant: 'alert', priority: 'critical' })]} />)
    expect(screen.getByTestId('block-review-alert')).toBeInTheDocument()
    expect(screen.getByTestId('priority-badge-critical')).toBeInTheDocument()
  })

  it('title and body still render with or without priority', () => {
    render(<InlineBlocks blocks={[makeReviewCard()]} />)
    expect(screen.getByText('High concentration risk')).toBeInTheDocument()
    expect(screen.getByText('Your model depends heavily on a single factor.')).toBeInTheDocument()
  })
})
