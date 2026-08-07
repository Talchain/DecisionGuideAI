/**
 * Tests for DS v5 §21.2 compliance in InlineBlocks rendering.
 *
 * Covers:
 * - Block type badge dots render for the correct block types (Task 1)
 * - Commentary and unknown types render no dot
 * - add_edge operations resolve source → target labels via node map (Task 2)
 * - elementLabel is suppressed when description already contains it (Task 2)
 * - review_card alert variant renders with the alert class (Task 4 regression guard)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { InlineBlocks } from '../InlineBlocks'
import { adaptCEEBlock, deriveProposalItemFromOperation } from '../useConversation'
import type {
  GraphPatchBlock,
  FactBlock,
  FramingBlock,
  EvidenceBlock,
  BriefBlock,
  ReviewCardBlock,
  CommentaryBlock,
  ModelReceiptBlockType,
} from '../types'
import { isOrchestratorRenderingV2Enabled, isPreAnalysisEnrichedEnabled } from '../../../flags'

// Mock the flag so we can assert ungated behaviour explicitly. isPreAnalysis-
// EnrichedEnabled is added as a bare vi.fn() (no factory return value — vitest
// config has mockReset:true, which wipes factory-level mockReturnValue); the
// model_receipt describe below sets it per-test in a scoped beforeEach.
vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../flags')>()
  return {
    ...actual,
    isOrchestratorRenderingV2Enabled: vi.fn().mockReturnValue(true),
    isPreAnalysisEnrichedEnabled: vi.fn(),
  }
})

// Minimal canvas store mock — InlineBlocks only reads `nodes` for patch target lookup.
vi.mock('../../store', () => {
  const mockState = {
    nodes: [] as Array<{ id: string }>,
    selectNodeWithoutHistory: vi.fn(),
    selectNodes: vi.fn(),
    setShowInspectorPanel: vi.fn(),
    setHighlightedNodes: vi.fn(),
    setHighlightedEdges: vi.fn(),
  }
  return {
    useCanvasStore: Object.assign(
      (selector: (s: unknown) => unknown) => selector(mockState),
      { getState: () => mockState },
    ),
  }
})

// -----------------------------------------------------------------------------
// Task 1 — Block type badge dots
// -----------------------------------------------------------------------------

describe('InlineBlocks — DS v5 §21.2 block type badge dots', () => {
  it('renders a badge dot for GraphPatchBlock (goal)', () => {
    const block: GraphPatchBlock = {
      type: 'graph_patch',
      patch_id: 'p1',
      summary: 'Add factor',
      operations: [{ op: 'add_node', target_id: 'n1', data: { kind: 'factor', label: 'Pricing' } }],
      target_graph_hash: 'h',
    }
    render(<InlineBlocks blocks={[block]} />)
    const dot = screen.getByTestId('block-badge-dot')
    expect(dot).toBeInTheDocument()
    expect(dot.className).toMatch(/blockBadgeDotGoal/)
  })

  it('renders a badge dot for FactBlock (success)', () => {
    const block: FactBlock = {
      type: 'fact',
      value: '42%',
      label: 'Conversion lift',
      fact_type: 'simple',
    }
    render(<InlineBlocks blocks={[block]} />)
    const dot = screen.getByTestId('block-badge-dot')
    expect(dot.className).toMatch(/blockBadgeDotSuccess/)
  })

  it('renders a badge dot for FramingBlock (info)', () => {
    const block: FramingBlock = {
      type: 'framing',
      goal: 'Maximise retention',
      options: ['A', 'B'],
    }
    render(<InlineBlocks blocks={[block]} />)
    const dot = screen.getByTestId('block-badge-dot')
    expect(dot.className).toMatch(/blockBadgeDotInfo/)
  })

  it('renders a badge dot for EvidenceBlock (info)', () => {
    const block: EvidenceBlock = {
      type: 'evidence',
      title: 'Research findings',
      findings: [],
      query: 'churn drivers',
    }
    render(<InlineBlocks blocks={[block]} />)
    const dot = screen.getByTestId('block-badge-dot')
    expect(dot.className).toMatch(/blockBadgeDotInfo/)
  })

  it('renders a badge dot for BriefBlock (success)', () => {
    const block: BriefBlock = {
      type: 'brief',
      title: 'Draft brief',
      summary: 'A summary',
    }
    render(<InlineBlocks blocks={[block]} />)
    const dot = screen.getByTestId('block-badge-dot')
    expect(dot.className).toMatch(/blockBadgeDotSuccess/)
  })

  it('renders a danger badge dot for alert-variant ReviewCardBlock', () => {
    const block: ReviewCardBlock = {
      type: 'review_card',
      variant: 'alert',
      title: 'Should fix: goal missing horizon',
      body: 'Add a time horizon to your goal.',
    }
    render(<InlineBlocks blocks={[block]} />)
    const dot = screen.getByTestId('block-badge-dot')
    expect(dot.className).toMatch(/blockBadgeDotDanger/)
  })

  it('renders an info badge dot for info-variant ReviewCardBlock', () => {
    const block: ReviewCardBlock = {
      type: 'review_card',
      variant: 'info',
      title: 'Coaching: consider scenarios',
      body: 'You could add scenario comparisons.',
    }
    render(<InlineBlocks blocks={[block]} />)
    const dot = screen.getByTestId('block-badge-dot')
    expect(dot.className).toMatch(/blockBadgeDotInfo/)
  })

  it('renders no badge dot for CommentaryBlock (inline per DS v5 §21.2)', () => {
    const block: CommentaryBlock = {
      type: 'commentary',
      text: 'Some inline commentary.',
    }
    render(<InlineBlocks blocks={[block]} />)
    expect(screen.queryByTestId('block-badge-dot')).not.toBeInTheDocument()
  })
})

// -----------------------------------------------------------------------------
// adaptCEEBlock — tone → variant mapping is ungated (DS v5 §16.2)
// -----------------------------------------------------------------------------

describe('adaptCEEBlock — review_card tone mapping is ungated', () => {
  it('tone=challenger always maps to variant=alert, regardless of v2 flag', () => {
    vi.mocked(isOrchestratorRenderingV2Enabled).mockReturnValue(false)
    const raw = {
      block_type: 'review_card',
      block_id: 'rv-off',
      data: { title: 'Risk', description: 'Content', tone: 'challenger' },
    }
    const result = adaptCEEBlock(raw) as ReviewCardBlock
    expect(result.variant).toBe('alert')
    vi.mocked(isOrchestratorRenderingV2Enabled).mockReturnValue(true)
  })

  it('tone=facilitator always maps to variant=info, regardless of v2 flag', () => {
    vi.mocked(isOrchestratorRenderingV2Enabled).mockReturnValue(false)
    const raw = {
      block_type: 'review_card',
      block_id: 'rv-off-2',
      data: { title: 'Tip', description: 'Content', tone: 'facilitator' },
    }
    const result = adaptCEEBlock(raw) as ReviewCardBlock
    expect(result.variant).toBe('info')
    vi.mocked(isOrchestratorRenderingV2Enabled).mockReturnValue(true)
  })

  it('tone overrides an explicit variant field, even when flag is off', () => {
    vi.mocked(isOrchestratorRenderingV2Enabled).mockReturnValue(false)
    const raw = {
      block_type: 'review_card',
      block_id: 'rv-off-3',
      data: {
        title: 'Risk',
        description: 'Content',
        tone: 'challenger',
        variant: 'info', // explicit variant is overridden by tone
      },
    }
    const result = adaptCEEBlock(raw) as ReviewCardBlock
    expect(result.variant).toBe('alert')
    vi.mocked(isOrchestratorRenderingV2Enabled).mockReturnValue(true)
  })
})

// -----------------------------------------------------------------------------
// Task 4 — ReviewCardBlock alert regression guard
// -----------------------------------------------------------------------------

describe('InlineBlocks — ReviewCardBlock alert variant (DS v5 §16.2)', () => {
  it('renders the alert variant with the reviewCardAlert class (top 3px danger border)', () => {
    const block: ReviewCardBlock = {
      type: 'review_card',
      variant: 'alert',
      title: 'Should fix',
      body: 'Goal has no time horizon.',
    }
    render(<InlineBlocks blocks={[block]} />)
    // Find the inner card element — InlineBlocks wraps the renderer in a
    // .blockWithBadge div when a dot is present, so the card is a child.
    const card = screen.getByTestId('block-review-alert')
    expect(card.className).toMatch(/reviewCardAlert/)
  })

  it('renders the info variant with the reviewCardInfo class (left 3px info border)', () => {
    const block: ReviewCardBlock = {
      type: 'review_card',
      variant: 'info',
      title: 'Coaching',
      body: 'Consider scenarios.',
    }
    render(<InlineBlocks blocks={[block]} />)
    const card = screen.getByTestId('block-review-info')
    expect(card.className).toMatch(/reviewCardInfo/)
  })
})

// -----------------------------------------------------------------------------
// Task 2 — Edge operation labels in GraphPatchBlock (deriveProposalItemFromOperation)
// -----------------------------------------------------------------------------

describe('deriveProposalItemFromOperation — edge label resolution (DS v5 §21.2)', () => {
  const nodeLabels = new Map<string, string>([
    ['n-pricing', 'Pricing'],
    ['n-retention', 'Retention'],
  ])

  it('renders add_edge as "Add connection: {from} → {to}" when both labels resolve', () => {
    const item = deriveProposalItemFromOperation(
      { op: 'add_edge', target_id: 'e1', data: { from: 'n-pricing', to: 'n-retention' } },
      nodeLabels,
    )
    expect(item).not.toBeNull()
    expect(item!.description).toBe('Add connection: Pricing → Retention')
    expect(item!.changeLabel).toBe('Add edge')
    // No duplicate elementLabel on edge ops
    expect(item!.elementLabel).toBeUndefined()
  })

  it('supports the source/target field aliases as well as from/to', () => {
    const item = deriveProposalItemFromOperation(
      { op: 'add_edge', target_id: 'e1', data: { source: 'n-pricing', target: 'n-retention' } },
      nodeLabels,
    )
    expect(item!.description).toBe('Add connection: Pricing → Retention')
  })

  it('falls back to the raw id when the node label map is missing an id', () => {
    const item = deriveProposalItemFromOperation(
      { op: 'add_edge', target_id: 'e1', data: { from: 'n-unknown', to: 'n-retention' } },
      nodeLabels,
    )
    expect(item!.description).toBe('Add connection: n-unknown → Retention')
  })

  it('prefers explicit from_label/to_label over canvas store lookup', () => {
    // Simulates CEE adding an edge between two nodes created in the same patch —
    // the canvas store does not yet contain the new nodes, but CEE has emitted
    // the labels alongside the ids.
    const item = deriveProposalItemFromOperation(
      {
        op: 'add_edge',
        target_id: 'e1',
        data: {
          from: 'n-new-a',
          to: 'n-new-b',
          from_label: 'Competitor response',
          to_label: 'Market share',
        },
      },
      nodeLabels, // Does not contain n-new-a / n-new-b
    )
    expect(item!.description).toBe('Add connection: Competitor response → Market share')
  })

  it('accepts source_label/target_label aliases as well as from_label/to_label', () => {
    const item = deriveProposalItemFromOperation(
      {
        op: 'add_edge',
        target_id: 'e1',
        data: {
          source: 'n-x',
          target: 'n-y',
          source_label: 'Pricing power',
          target_label: 'Churn',
        },
      },
      new Map(),
    )
    expect(item!.description).toBe('Add connection: Pricing power → Churn')
  })

  it('prefers explicit label fields even when canvas store has a different label', () => {
    // Defensive: if CEE is more authoritative than the local canvas state
    // (e.g. label was renamed in the patch), the op's label field wins.
    const item = deriveProposalItemFromOperation(
      {
        op: 'update_edge',
        target_id: 'e1',
        data: {
          from: 'n-pricing',
          to: 'n-retention',
          from_label: 'Pricing (updated)',
          to_label: 'Retention (updated)',
        },
      },
      nodeLabels, // has 'Pricing' and 'Retention'
    )
    expect(item!.description).toBe('Update connection: Pricing (updated) → Retention (updated)')
  })

  it('uses Remove / Update verbs for remove_edge / update_edge', () => {
    const remove = deriveProposalItemFromOperation(
      { op: 'remove_edge', target_id: 'e1', data: { from: 'n-pricing', to: 'n-retention' } },
      nodeLabels,
    )
    const update = deriveProposalItemFromOperation(
      { op: 'update_edge', target_id: 'e1', data: { from: 'n-pricing', to: 'n-retention' } },
      nodeLabels,
    )
    expect(remove!.description).toBe('Remove connection: Pricing → Retention')
    expect(update!.description).toBe('Update connection: Pricing → Retention')
  })

  it('suppresses elementLabel on add_node when description already contains it', () => {
    const item = deriveProposalItemFromOperation(
      { op: 'add_node', target_id: 'n1', data: { kind: 'risk', label: 'Retention Risk' } },
    )
    expect(item!.description).toBe('Add Retention Risk')
    // Previously, elementLabel would also be 'Retention Risk' → rendered twice.
    // After the fix, it's suppressed because description.includes(elementLabel).
    expect(item!.elementLabel).toBeUndefined()
  })

  it('falls back to kind when no label is present', () => {
    const item = deriveProposalItemFromOperation(
      { op: 'update_node', target_id: 'n1', data: { kind: 'factor' } },
    )
    expect(item!.description).toBe('Update factor')
    expect(item!.elementLabel).toBeUndefined()
  })
})

// -----------------------------------------------------------------------------
// model_receipt — "no coaching summary = no card" render gate (F1 PR B)
// preAnalysisEnriched is forced on in the flags mock above, so these tests
// exercise the coaching guard, not the flag guard.
// -----------------------------------------------------------------------------

describe('InlineBlocks — model_receipt coaching render gate', () => {
  // Force the pre-analysis flag on for these tests (mockReset wipes the factory
  // value, so set it here, after the per-test reset).
  beforeEach(() => {
    vi.mocked(isPreAnalysisEnrichedEnabled).mockReturnValue(true)
  })

  const base: Omit<ModelReceiptBlockType, 'coachingSummary'> = {
    type: 'model_receipt',
    factorCount: 2,
    edgeCount: 1,
    optionCount: 1,
    goalLabel: 'Profit',
    topInsight: null,
    topEvidenceGap: null,
    readiness: 'ready',
    adjustments: [],
  }

  it('renders the card when coaching summary is present', () => {
    const block: ModelReceiptBlockType = { ...base, coachingSummary: 'Assess team expertise first.' }
    render(<InlineBlocks blocks={[block]} />)
    expect(screen.getByTestId('model-receipt-block')).toBeInTheDocument()
  })

  it('renders no card when coaching summary is missing or blank', () => {
    const missing: ModelReceiptBlockType = { ...base, coachingSummary: null }
    const { rerender } = render(<InlineBlocks blocks={[missing]} />)
    expect(screen.queryByTestId('model-receipt-block')).not.toBeInTheDocument()

    const blank: ModelReceiptBlockType = { ...base, coachingSummary: '   ' }
    rerender(<InlineBlocks blocks={[blank]} />)
    expect(screen.queryByTestId('model-receipt-block')).not.toBeInTheDocument()
  })
})
