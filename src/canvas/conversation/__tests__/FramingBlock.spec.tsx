/**
 * Tests for FramingBlock renderer in InlineBlocks
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { InlineBlocks } from '../InlineBlocks'
import type { FramingBlock } from '../types'

function makeFramingBlock(overrides?: Partial<FramingBlock>): FramingBlock {
  return {
    type: 'framing',
    goal: 'Decide which market to enter first',
    options: ['Asia Pacific', 'Europe', 'North America'],
    constraints: ['Budget < $5M', 'Launch within 12 months'],
    key_risks: ['Regulatory changes', 'Currency risk'],
    ...overrides,
  }
}

describe('FramingBlock', () => {
  it('renders goal text', () => {
    render(<InlineBlocks blocks={[makeFramingBlock()]} />)
    expect(screen.getByText('Decide which market to enter first')).toBeInTheDocument()
  })

  it('renders options as pills', () => {
    render(<InlineBlocks blocks={[makeFramingBlock()]} />)
    expect(screen.getByText('Asia Pacific')).toBeInTheDocument()
    expect(screen.getByText('Europe')).toBeInTheDocument()
    expect(screen.getByText('North America')).toBeInTheDocument()
  })

  it('renders constraints when present', () => {
    render(<InlineBlocks blocks={[makeFramingBlock()]} />)
    expect(screen.getByText('Budget < $5M')).toBeInTheDocument()
    expect(screen.getByText('Launch within 12 months')).toBeInTheDocument()
  })

  it('renders key_risks when present', () => {
    render(<InlineBlocks blocks={[makeFramingBlock()]} />)
    expect(screen.getByText('Regulatory changes')).toBeInTheDocument()
    expect(screen.getByText('Currency risk')).toBeInTheDocument()
  })

  it('omits constraints section when absent', () => {
    render(<InlineBlocks blocks={[makeFramingBlock({ constraints: undefined })]} />)
    expect(screen.queryByText('Budget < $5M')).not.toBeInTheDocument()
  })

  it('omits key_risks section when absent', () => {
    render(<InlineBlocks blocks={[makeFramingBlock({ key_risks: undefined })]} />)
    expect(screen.queryByText('Regulatory changes')).not.toBeInTheDocument()
  })

  it('renders with data-testid block-framing', () => {
    render(<InlineBlocks blocks={[makeFramingBlock()]} />)
    expect(screen.getByTestId('block-framing')).toBeInTheDocument()
  })

  it('renders correctly with empty options array', () => {
    render(<InlineBlocks blocks={[makeFramingBlock({ options: [] })]} />)
    // Should render without crashing
    expect(screen.getByTestId('block-framing')).toBeInTheDocument()
  })
})
