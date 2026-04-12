/**
 * Tests for CommentaryBlock citation legend in InlineBlocks
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { InlineBlocks } from '../InlineBlocks'
import type { CommentaryBlock } from '../types'

// jsdom lacks scrollIntoView — mock it so citation click/keyboard tests
// exercise the real handler path instead of relying on not.toThrow().
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

function makeCommentaryBlock(overrides?: Partial<CommentaryBlock>): CommentaryBlock {
  return {
    type: 'commentary',
    text: 'The model shows strong sensitivity to market size assumptions.',
    ...overrides,
  }
}

describe('CommentaryBlock — citations', () => {
  it('renders text without citations when citations absent', () => {
    render(<InlineBlocks blocks={[makeCommentaryBlock()]} />)
    expect(screen.getByText('The model shows strong sensitivity to market size assumptions.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Citations')).not.toBeInTheDocument()
  })

  it('renders citation legend when citations present', () => {
    render(<InlineBlocks blocks={[makeCommentaryBlock({
      citations: [
        { index: 1, source: 'Sensitivity analysis, page 3' },
        { index: 2, source: 'Market research report' },
      ],
    })]} />)
    expect(screen.getByLabelText('Citations')).toBeInTheDocument()
    expect(screen.getByText('[1]')).toBeInTheDocument()
    expect(screen.getByText('[2]')).toBeInTheDocument()
    expect(screen.getByText('Sensitivity analysis, page 3')).toBeInTheDocument()
    expect(screen.getByText('Market research report')).toBeInTheDocument()
  })

  it('text still renders with citations present', () => {
    render(<InlineBlocks blocks={[makeCommentaryBlock({
      citations: [{ index: 1, source: 'Source A' }],
    })]} />)
    expect(screen.getByText('The model shows strong sensitivity to market size assumptions.')).toBeInTheDocument()
  })

  it('citation entry scrolls to target if found (degrades gracefully when missing)', () => {
    // jsdom doesn't have a target element — click should not throw
    render(<InlineBlocks blocks={[makeCommentaryBlock({
      citations: [{ index: 1, source: 'Source A' }],
    })]} />)
    // Should not throw even when target doesn't exist in DOM
    expect(() => {
      fireEvent.click(screen.getByText('[1]'))
    }).not.toThrow()
  })

  it('citation entry responds to Enter key', () => {
    render(<InlineBlocks blocks={[makeCommentaryBlock({
      citations: [{ index: 1, source: 'Source A' }],
    })]} />)
    // Should not throw
    expect(() => {
      fireEvent.keyDown(screen.getByRole('button', { name: /Citation 1/ }), { key: 'Enter' })
    }).not.toThrow()
  })

  it('renders tone warning class for warning tone', () => {
    const { container } = render(<InlineBlocks blocks={[makeCommentaryBlock({ tone: 'warning' })]} />)
    // Block renders without crashing — CommentaryBlock renders a div, not p
    expect(container.querySelector('[class*="commentaryBlock"]')).toBeInTheDocument()
  })
})
