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

// ---------------------------------------------------------------------------
// Apply to model — DS v5 §21.4 action-chip contract (class-level regression)
//
// Behavioural tests above do not catch CSS regressions. These assert the
// concrete chip class set so that forbidden tokens (bg-info-light, text-info,
// border-info/40, text-text-muted, font-medium override on panel tokens)
// cannot silently return.
// ---------------------------------------------------------------------------

describe('Apply to model — DS v5 §21.4 action-chip contract', () => {
  beforeEach(() => {
    useGuidanceStore.setState({ _sendChip: vi.fn() })
  })

  afterEach(() => {
    useGuidanceStore.setState({ _sendChip: null })
    useCanvasStore.setState({ nodes: [] })
  })

  it('enabled state matches §21.4 (panelBody, bg-panel, border-panel-border, hover:bg-panel-hover)', () => {
    useCanvasStore.setState({ nodes: [{ id: 'n1' }] as any })
    render(<InlineBlocks blocks={[makeEvidence()]} />)
    const cls = screen.getByTestId('apply-to-model-chip').className

    // §21.4 required classes
    expect(cls).toContain('bg-panel')
    expect(cls).toContain('border-panel-border')
    expect(cls).toContain('hover:bg-panel-hover')
    expect(cls).toContain('rounded-full')
    // panelBody token is `text-xs … leading-relaxed` — assert both to disambiguate from panelMeta
    expect(cls).toContain('text-xs')
    expect(cls).toContain('leading-relaxed')
    // Pill text is neutral
    expect(cls).toContain('text-text-body')
  })

  it('does not regress to legacy/forbidden classes (enabled)', () => {
    useCanvasStore.setState({ nodes: [{ id: 'n1' }] as any })
    render(<InlineBlocks blocks={[makeEvidence()]} />)
    const cls = screen.getByTestId('apply-to-model-chip').className

    // No light-fill on pills (DS rule)
    expect(cls).not.toContain('bg-info-light')
    // No coloured text on pills (DS rule)
    expect(cls).not.toMatch(/\btext-info\b/)
    expect(cls).not.toMatch(/\btext-success\b/)
    expect(cls).not.toMatch(/\btext-danger\b/)
    expect(cls).not.toMatch(/\btext-warning\b/)
    // Wrong border opacity / undefined token. The broader regex catches any
    // info-coloured border opacity, including the /30 variant the first U1
    // commit (2c74a294) shipped before the §21.4 migration. Keep the explicit
    // /40 and /30 checks for documentation alongside the regex.
    expect(cls).not.toContain('border-info/40')
    expect(cls).not.toContain('border-info/30')
    expect(cls).not.toMatch(/\bborder-info\b/)
    expect(cls).not.toContain('hover:border-info')
    expect(cls).not.toContain('text-text-muted')
    // panelMeta size — chip uses panelBody per §21.4
    expect(cls).not.toContain('text-[11px]')
    // No font-weight overrides on panel tokens
    expect(cls).not.toMatch(/\bfont-medium\b/)
    expect(cls).not.toMatch(/\bfont-semibold\b/)
    expect(cls).not.toMatch(/\bfont-bold\b/)
  })

  it('disabled state uses text-text-light and no forbidden tokens', () => {
    useCanvasStore.setState({ nodes: [] })
    render(<InlineBlocks blocks={[makeEvidence()]} />)
    const btn = screen.getByTestId('apply-to-model-chip')
    const cls = btn.className

    expect(btn).toBeDisabled()
    expect(cls).toContain('text-text-light')
    expect(cls).not.toContain('text-text-muted')
    // Disabled state still on the §21.4 surface
    expect(cls).toContain('bg-panel')
    expect(cls).toContain('border-panel-border')
    // Mirror the enabled-state forbidden set so a disabled-only regression
    // is also caught.
    expect(cls).not.toContain('bg-info-light')
    expect(cls).not.toMatch(/\btext-info\b/)
    expect(cls).not.toMatch(/\btext-success\b/)
    expect(cls).not.toMatch(/\btext-danger\b/)
    expect(cls).not.toMatch(/\btext-warning\b/)
    expect(cls).not.toContain('border-info/40')
    expect(cls).not.toContain('border-info/30')
    expect(cls).not.toMatch(/\bborder-info\b/)
    expect(cls).not.toContain('hover:border-info')
    expect(cls).not.toContain('text-[11px]')
    expect(cls).not.toMatch(/\bfont-medium\b/)
    expect(cls).not.toMatch(/\bfont-semibold\b/)
    expect(cls).not.toMatch(/\bfont-bold\b/)
  })
})
