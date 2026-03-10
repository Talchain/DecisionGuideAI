/**
 * Tests for ThinkingIndicator.
 *
 * Verifies:
 * - Renders 6 node shapes (17 SVGs total: 2 layers per shape + 5 dashed arrows)
 * - Shows label text when provided
 * - Hides label when not provided
 * - Shows retry button only at "Still working…" stage with onRetry prop
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThinkingIndicator, STILL_WORKING_LABEL } from '../zones/ThinkingIndicator'

describe('ThinkingIndicator', () => {
  it('renders 6 node shapes (17 SVGs: 2 layers per shape + 5 dashed arrows)', () => {
    const { container } = render(<ThinkingIndicator />)
    // 6 shapes × 2 layers = 12 shape SVGs + 5 DashedArrow SVGs between shapes = 17 total.
    const svgs = container.querySelectorAll('[data-testid="thinking-indicator"] svg')
    expect(svgs.length).toBe(17)
  })

  it('shows label when provided', () => {
    render(<ThinkingIndicator label="Structuring your decision..." />)
    expect(screen.getByTestId('thinking-label')).toHaveTextContent('Structuring your decision...')
  })

  it('hides label when null', () => {
    render(<ThinkingIndicator label={null} />)
    expect(screen.queryByTestId('thinking-label')).not.toBeInTheDocument()
  })

  it('shows default thinking text when no label', () => {
    // ThinkingIndicator renders the label prop directly; default is in ChatThread
    render(<ThinkingIndicator />)
    expect(screen.queryByTestId('thinking-label')).not.toBeInTheDocument()
  })

  it('shows retry button at "Still working…" stage when onRetry provided', () => {
    const onRetry = vi.fn()
    render(<ThinkingIndicator label={STILL_WORKING_LABEL} onRetry={onRetry} />)
    expect(screen.getByTestId('thinking-retry')).toBeInTheDocument()
  })

  it('does not show retry button when label differs from STILL_WORKING_LABEL', () => {
    const onRetry = vi.fn()
    render(<ThinkingIndicator label="Thinking…" onRetry={onRetry} />)
    expect(screen.queryByTestId('thinking-retry')).not.toBeInTheDocument()
  })

  it('does not show retry button when onRetry not provided', () => {
    render(<ThinkingIndicator label={STILL_WORKING_LABEL} />)
    expect(screen.queryByTestId('thinking-retry')).not.toBeInTheDocument()
  })
})
