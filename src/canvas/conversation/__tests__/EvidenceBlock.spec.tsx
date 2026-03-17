/**
 * Tests for EvidenceBlockRenderer
 *
 * Verifies:
 * - Full evidence block renders title, findings, source links, confidence
 * - Missing title defaults to "Research findings"
 * - Missing source_url renders no link
 * - Empty/missing findings renders neutral fallback card
 * - Malformed payload renders neutral fallback card
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { InlineBlocks } from '../InlineBlocks'
import { useCanvasStore } from '../../store'
import { useGuidanceStore } from '../../stores/guidanceStore'
import type { ConversationBlock, EvidenceBlock } from '../types'

function makeEvidence(overrides: Partial<EvidenceBlock> = {}): EvidenceBlock {
  return {
    type: 'evidence',
    title: 'Test Research',
    findings: [
      { text: 'Finding one', source_url: 'https://example.com/1', confidence: 0.85 },
      { text: 'Finding two' },
    ],
    query: 'test query',
    ...overrides,
  }
}

describe('EvidenceBlockRenderer', () => {
  it('renders title, findings, source links, and confidence', () => {
    render(<InlineBlocks blocks={[makeEvidence()]} />)

    expect(screen.getByTestId('block-evidence')).toBeInTheDocument()
    expect(screen.getByText('Test Research')).toBeInTheDocument()
    expect(screen.getByText('Finding one')).toBeInTheDocument()
    expect(screen.getByText('Finding two')).toBeInTheDocument()
    expect(screen.getByText('Source')).toBeInTheDocument()
    expect(screen.getByText('85% confidence')).toBeInTheDocument()
    expect(screen.getByText(/test query/)).toBeInTheDocument()
  })

  it('defaults title to "Research findings" when missing', () => {
    render(<InlineBlocks blocks={[makeEvidence({ title: undefined })]} />)

    expect(screen.getByText('Research findings')).toBeInTheDocument()
  })

  it('renders no source link when source_url is missing', () => {
    const block = makeEvidence({
      findings: [{ text: 'No source finding' }],
    })
    render(<InlineBlocks blocks={[block]} />)

    expect(screen.getByText('No source finding')).toBeInTheDocument()
    expect(screen.queryByText('Source')).not.toBeInTheDocument()
  })

  it('renders neutral fallback card when findings array is empty', () => {
    const block = makeEvidence({ findings: [] })
    render(<InlineBlocks blocks={[block]} />)

    expect(screen.getByTestId('block-evidence')).toBeInTheDocument()
    expect(screen.getByText('Research findings available')).toBeInTheDocument()
  })

  it('renders neutral fallback card when findings is malformed', () => {
    // Simulate malformed payload where findings is not an array
    const block = { type: 'evidence', query: 'q', findings: 'broken' } as unknown as ConversationBlock
    render(<InlineBlocks blocks={[block]} />)

    expect(screen.getByTestId('block-evidence')).toBeInTheDocument()
    expect(screen.getByText('Research findings available')).toBeInTheDocument()
  })

  it('renders confidence only when present', () => {
    const block = makeEvidence({
      findings: [{ text: 'A finding', confidence: 0.72 }],
    })
    render(<InlineBlocks blocks={[block]} />)

    expect(screen.getByText('72% confidence')).toBeInTheDocument()
  })

  it('source link opens in new tab', () => {
    render(<InlineBlocks blocks={[makeEvidence()]} />)

    const link = screen.getByText('Source').closest('a')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(link).toHaveAttribute('href', 'https://example.com/1')
  })
})

// ---------------------------------------------------------------------------
// Apply to model button — disabled/enabled states
// ---------------------------------------------------------------------------

describe('Apply to model button', () => {
  const mockSendChip = vi.fn()

  beforeEach(() => {
    mockSendChip.mockReset()
    // Register sendChip so the button renders
    useGuidanceStore.setState({ _sendChip: mockSendChip })
  })

  afterEach(() => {
    // Reset stores
    useGuidanceStore.setState({ _sendChip: null })
    useCanvasStore.setState({ nodes: [] })
  })

  it('renders disabled with tooltip when no graph exists', () => {
    useCanvasStore.setState({ nodes: [] })
    render(<InlineBlocks blocks={[makeEvidence()]} />)

    const btn = screen.getByTestId('apply-to-model-chip')
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('title', 'Generate a model first')
  })

  it('renders enabled without tooltip when graph exists', () => {
    useCanvasStore.setState({ nodes: [{ id: 'n1' }] as any })
    render(<InlineBlocks blocks={[makeEvidence()]} />)

    const btn = screen.getByTestId('apply-to-model-chip')
    expect(btn).not.toBeDisabled()
    expect(btn).not.toHaveAttribute('title')
  })

  it('dispatches sendChip with findings when clicked and graph exists', () => {
    useCanvasStore.setState({ nodes: [{ id: 'n1' }] as any })
    render(<InlineBlocks blocks={[makeEvidence()]} />)

    const btn = screen.getByTestId('apply-to-model-chip')
    fireEvent.click(btn)

    expect(mockSendChip).toHaveBeenCalledTimes(1)
    expect(mockSendChip).toHaveBeenCalledWith(
      'Apply to model',
      expect.stringContaining('Finding one'),
    )
  })

  it('does not dispatch sendChip when clicked and no graph exists', () => {
    useCanvasStore.setState({ nodes: [] })
    render(<InlineBlocks blocks={[makeEvidence()]} />)

    const btn = screen.getByTestId('apply-to-model-chip')
    fireEvent.click(btn)

    expect(mockSendChip).not.toHaveBeenCalled()
  })
})
