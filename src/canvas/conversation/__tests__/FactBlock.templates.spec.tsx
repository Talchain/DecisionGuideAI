/**
 * Tests for FactBlock template renderers in InlineBlocks
 *
 * Verifies:
 * - simple backward-compat (label/value/source)
 * - option_comparison: horizontal bars per fact entry
 * - sensitivity: bars per fact entry
 * - robustness: 3-segment indicator
 * - constraint: probability + pass/fail badge
 * - lineage n_samples shown
 * - unknown fact_type falls back to simple rendering
 * - non-numeric values in bar templates rendered as text (no crash)
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { InlineBlocks } from '../InlineBlocks'
import type { FactBlock } from '../types'

function makeFactBlock(overrides?: Partial<FactBlock>): FactBlock {
  return {
    type: 'fact',
    label: 'Win probability',
    value: '0.72',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Simple (backward compat)
// ---------------------------------------------------------------------------

describe('FactBlock — simple (backward compat)', () => {
  it('renders label and value', () => {
    render(<InlineBlocks blocks={[makeFactBlock({ value: '72%', label: 'Win probability' })]} />)
    expect(screen.getByText('72%')).toBeInTheDocument()
    expect(screen.getByText('Win probability')).toBeInTheDocument()
  })

  it('renders source when provided', () => {
    render(<InlineBlocks blocks={[makeFactBlock({ source: 'PLoT v3' })]} />)
    expect(screen.getByText('PLoT v3')).toBeInTheDocument()
  })

  it('renders without source', () => {
    render(<InlineBlocks blocks={[makeFactBlock({ source: undefined })]} />)
    // Should not throw — block-fact renders
    expect(screen.getByTestId('block-fact')).toBeInTheDocument()
  })

  it('renders with data-testid block-fact', () => {
    render(<InlineBlocks blocks={[makeFactBlock()]} />)
    expect(screen.getByTestId('block-fact')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// option_comparison template
// ---------------------------------------------------------------------------

describe('FactBlock — option_comparison template', () => {
  const block = makeFactBlock({
    label: 'Win probabilities',
    value: '',
    fact_type: 'option_comparison',
    facts: [
      { label: 'Asia Pacific', value: 0.72 },
      { label: 'Europe', value: 0.55 },
      { label: 'North America', value: 0.41 },
    ],
  })

  it('renders bar rows for each fact entry', () => {
    render(<InlineBlocks blocks={[block]} />)
    expect(screen.getByTestId('fact-bars')).toBeInTheDocument()
    expect(screen.getByTestId('fact-bar-row-0')).toBeInTheDocument()
    expect(screen.getByTestId('fact-bar-row-1')).toBeInTheDocument()
    expect(screen.getByTestId('fact-bar-row-2')).toBeInTheDocument()
  })

  it('renders fact entry labels', () => {
    render(<InlineBlocks blocks={[block]} />)
    expect(screen.getByText('Asia Pacific')).toBeInTheDocument()
    expect(screen.getByText('Europe')).toBeInTheDocument()
    expect(screen.getByText('North America')).toBeInTheDocument()
  })

  it('shows lineage n_samples when present', () => {
    render(<InlineBlocks blocks={[{
      ...block,
      lineage: { n_samples: 10000 },
    }]} />)
    expect(screen.getByTestId('fact-lineage')).toBeInTheDocument()
    expect(screen.getByText(/10,000 simulations/)).toBeInTheDocument()
  })

  it('handles string percentage values without crashing', () => {
    render(<InlineBlocks blocks={[makeFactBlock({
      fact_type: 'option_comparison',
      facts: [
        { label: 'Option A', value: '45%' },
        { label: 'N/A', value: 'N/A' },
      ],
    })]} />)
    // Non-numeric values render as text labels, not bars
    expect(screen.getByTestId('fact-bars')).toBeInTheDocument()
    // 'N/A' appears in multiple spans (label, track, value) when non-numeric
    expect(screen.getAllByText('N/A').length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// sensitivity template
// ---------------------------------------------------------------------------

describe('FactBlock — sensitivity template', () => {
  it('renders bar rows for each sensitivity entry', () => {
    render(<InlineBlocks blocks={[makeFactBlock({
      label: 'Top factors',
      value: '',
      fact_type: 'sensitivity',
      facts: [
        { label: 'Market size', value: 0.8 },
        { label: 'Competition', value: 0.5 },
      ],
    })]} />)
    expect(screen.getByTestId('fact-bars')).toBeInTheDocument()
    expect(screen.getByText('Market size')).toBeInTheDocument()
    expect(screen.getByText('Competition')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// robustness template
// ---------------------------------------------------------------------------

describe('FactBlock — robustness template', () => {
  it('renders 3 segments for robust level', () => {
    render(<InlineBlocks blocks={[makeFactBlock({
      label: 'Robustness',
      value: 'robust',
      fact_type: 'robustness',
    })]} />)
    expect(screen.getByTestId('fact-robustness')).toBeInTheDocument()
    expect(screen.getByTestId('robustness-seg-1')).toBeInTheDocument()
    expect(screen.getByTestId('robustness-seg-2')).toBeInTheDocument()
    expect(screen.getByTestId('robustness-seg-3')).toBeInTheDocument()
  })

  it('shows "Robust" label for robust/high value', () => {
    render(<InlineBlocks blocks={[makeFactBlock({ value: 'robust', fact_type: 'robustness' })]} />)
    expect(screen.getByText('Robust')).toBeInTheDocument()
  })

  it('shows "Moderate" label for moderate/medium value', () => {
    render(<InlineBlocks blocks={[makeFactBlock({ value: 'moderate', fact_type: 'robustness' })]} />)
    expect(screen.getByText('Moderate')).toBeInTheDocument()
  })

  it('shows "Sensitive" label for fragile/low value', () => {
    render(<InlineBlocks blocks={[makeFactBlock({ value: 'fragile', fact_type: 'robustness' })]} />)
    expect(screen.getByText('Sensitive')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// constraint template
// ---------------------------------------------------------------------------

describe('FactBlock — constraint template', () => {
  it('shows Pass badge when probability >= 0.5', () => {
    render(<InlineBlocks blocks={[makeFactBlock({
      label: 'Budget constraint',
      value: '0.78',
      fact_type: 'constraint',
    })]} />)
    expect(screen.getByTestId('constraint-pass')).toBeInTheDocument()
    expect(screen.queryByTestId('constraint-fail')).not.toBeInTheDocument()
  })

  it('shows Fail badge when probability < 0.5', () => {
    render(<InlineBlocks blocks={[makeFactBlock({
      label: 'Timeline constraint',
      value: '0.3',
      fact_type: 'constraint',
    })]} />)
    expect(screen.getByTestId('constraint-fail')).toBeInTheDocument()
    expect(screen.queryByTestId('constraint-pass')).not.toBeInTheDocument()
  })

  it('shows Pass badge for value "pass"', () => {
    render(<InlineBlocks blocks={[makeFactBlock({ value: 'pass', fact_type: 'constraint' })]} />)
    expect(screen.getByTestId('constraint-pass')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Unknown fact_type
// ---------------------------------------------------------------------------

describe('FactBlock — unknown fact_type', () => {
  it('falls back to simple rendering without crashing', () => {
    render(<InlineBlocks blocks={[makeFactBlock({
      value: '42',
      label: 'Some metric',
      fact_type: 'future_unknown_type' as any,
    })]} />)
    expect(screen.getByTestId('block-fact')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('Some metric')).toBeInTheDocument()
  })
})
