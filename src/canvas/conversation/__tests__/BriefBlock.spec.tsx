/**
 * Tests for BriefBlock renderer in InlineBlocks
 */

import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { InlineBlocks } from '../InlineBlocks'
import type { BriefBlock } from '../types'

function makeBriefBlock(overrides?: Partial<BriefBlock>): BriefBlock {
  return {
    type: 'brief',
    title: 'Market Entry Decision Brief',
    summary: 'This brief outlines the key considerations for entering the Asia Pacific market. It covers regulatory requirements, competitive landscape, and financial projections for a 3-year horizon.',
    ...overrides,
  }
}

describe('BriefBlock', () => {
  it('renders title', () => {
    render(<InlineBlocks blocks={[makeBriefBlock()]} />)
    expect(screen.getByText('Market Entry Decision Brief')).toBeInTheDocument()
  })

  it('renders summary text', () => {
    render(<InlineBlocks blocks={[makeBriefBlock()]} />)
    expect(screen.getByTestId('brief-summary')).toBeInTheDocument()
    expect(screen.getByTestId('brief-summary').textContent).toContain('This brief outlines')
  })

  it('renders with data-testid block-brief', () => {
    render(<InlineBlocks blocks={[makeBriefBlock()]} />)
    expect(screen.getByTestId('block-brief')).toBeInTheDocument()
  })

  it('shows "Show more" toggle initially', () => {
    render(<InlineBlocks blocks={[makeBriefBlock()]} />)
    expect(screen.getByTestId('brief-expand-toggle')).toBeInTheDocument()
    expect(screen.getByText('Show more')).toBeInTheDocument()
  })

  it('shows "Show less" after clicking expand', () => {
    render(<InlineBlocks blocks={[makeBriefBlock()]} />)
    fireEvent.click(screen.getByTestId('brief-expand-toggle'))
    expect(screen.getByText('Show less')).toBeInTheDocument()
  })

  it('toggles back to "Show more" on second click', () => {
    render(<InlineBlocks blocks={[makeBriefBlock()]} />)
    fireEvent.click(screen.getByTestId('brief-expand-toggle'))
    fireEvent.click(screen.getByTestId('brief-expand-toggle'))
    expect(screen.getByText('Show more')).toBeInTheDocument()
  })

  it('renders "View full brief" link when brief_url provided', () => {
    render(<InlineBlocks blocks={[makeBriefBlock({ brief_url: 'https://example.com/brief' })]} />)
    const link = screen.getByTestId('brief-view-link')
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', 'https://example.com/brief')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('does not render view link when brief_url absent', () => {
    render(<InlineBlocks blocks={[makeBriefBlock({ brief_url: undefined })]} />)
    expect(screen.queryByTestId('brief-view-link')).not.toBeInTheDocument()
  })
})
