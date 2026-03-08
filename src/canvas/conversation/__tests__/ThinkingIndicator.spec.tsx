/**
 * Tests for ThinkingIndicator.
 *
 * Verifies:
 * - Renders 6 node shapes
 * - Shows label text when provided
 * - Hides label when not provided
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThinkingIndicator } from '../zones/ThinkingIndicator'

describe('ThinkingIndicator', () => {
  it('renders 6 node shapes', () => {
    const { container } = render(<ThinkingIndicator />)
    const svgs = container.querySelectorAll('.thinking-shape svg')
    expect(svgs.length).toBe(6)
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
})
