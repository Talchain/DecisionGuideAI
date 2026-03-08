/**
 * Tests for EmptyState.
 *
 * Verifies:
 * - Renders heading text
 * - Renders 6 node shapes
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EmptyState } from '../zones/EmptyState'

describe('EmptyState', () => {
  it('renders heading text', () => {
    render(<EmptyState />)
    expect(screen.getByText('What are you deciding?')).toBeInTheDocument()
  })

  it('renders 6 node shapes', () => {
    const { container } = render(<EmptyState />)
    const shapes = container.querySelectorAll('.empty-state-shape')
    expect(shapes.length).toBe(6)
  })

  it('has correct test id', () => {
    render(<EmptyState />)
    expect(screen.getByTestId('empty-state')).toBeInTheDocument()
  })
})
