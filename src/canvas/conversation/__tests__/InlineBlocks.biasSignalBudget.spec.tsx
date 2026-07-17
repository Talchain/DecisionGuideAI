/**
 * Review-folds C1 — bias-signal cards are exempt from BOTH visibility
 * budgets (the ratified #356 acceptance: ≤2 bias cards ALWAYS render by
 * default — they carry their own cap in buildDraftBiasSignalBlocks).
 *
 * Two previously-failing regimes, pinned RED-first:
 *   1. FLOOD turn: >3 producer phase-3 cards + 2 bias cards. Bias cards
 *      used to join phase3Indices, land past the default-expanded 3 and
 *      collapse behind "Show N more".
 *   2. BLOCK-RICH turn: ≥4 non-phase-3 blocks + 2 bias cards with pacing
 *      inactive. Bias cards used to join budgetIndices, land past the
 *      legacy per-turn cap (4) and hide behind the overflow toggle.
 *
 * Also pinned: bias cards do not COUNT toward the >3 pacing trigger, so a
 * turn with 3 producer phase-3 cards + 2 bias cards paces nothing.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { InlineBlocks } from '../InlineBlocks'
import type {
  CommentaryBlock,
  ConversationBlock,
  FactBlock,
  FramingBlock,
  V5CoachingBlock,
  V5ReviewCardBlock,
} from '../types'

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

function reviewCard(n: number): V5ReviewCardBlock {
  return {
    type: 'v5_review_card',
    block_id: `rc_${n}`,
    title: `Review card ${n}`,
    body: `Review body ${n}`,
    severity: 'info',
    card_kind: 'narrative',
    target_refs: [],
    priority_rank: n,
    freshness: 'fresh',
  }
}

/** A bridge-built bias card (no priority_rank / freshness — see Conv1). */
function biasCard(n: number): V5CoachingBlock {
  return {
    type: 'v5_coaching',
    block_id: `draft_bias_signal_${n}`,
    title: n === 1 ? 'Status quo bias' : 'Anchoring',
    body: `Grounded bias detail ${n}.`,
    coaching_kind: 'bias_signal',
    source: 'draft_graph',
    target_refs: [],
  }
}

const fact: FactBlock = { type: 'fact', value: '42%', label: 'Lift', fact_type: 'simple' }
const commentary: CommentaryBlock = { type: 'commentary', text: 'Some commentary.' }
const framing: FramingBlock = { type: 'framing', goal: 'A goal', options: [] }

const visibleBiasCards = () => screen.queryAllByTestId('bias-signal-card')

describe('C1 regime 1 — FLOOD turn: producer phase-3 flood + 2 bias cards', () => {
  const blocks: ConversationBlock[] = [
    reviewCard(1),
    reviewCard(2),
    reviewCard(3),
    reviewCard(4),
    biasCard(1),
    biasCard(2),
  ]

  it('both bias cards render by default — never in the collapse tail', () => {
    render(<InlineBlocks blocks={blocks} />)
    expect(visibleBiasCards()).toHaveLength(2)
  })

  it('the pacing affordance counts ONLY the collapsed producer cards (1 here), not the bias cards', () => {
    render(<InlineBlocks blocks={blocks} />)
    expect(screen.getByRole('button', { name: /show 1 more/i })).toBeInTheDocument()
  })

  it('bias cards do not count toward the >3 pacing trigger: 3 producer + 2 bias paces nothing', () => {
    render(
      <InlineBlocks blocks={[reviewCard(1), reviewCard(2), reviewCard(3), biasCard(1), biasCard(2)]} />,
    )
    expect(visibleBiasCards()).toHaveLength(2)
    expect(screen.queryByRole('button', { name: /show \d+ more/i })).not.toBeInTheDocument()
  })
})

describe('C1 regime 2 — BLOCK-RICH turn: >=4 non-phase-3 blocks + 2 bias cards, pacing inactive', () => {
  const blocks: ConversationBlock[] = [
    commentary,
    fact,
    framing,
    { ...fact, label: 'Second fact' },
    biasCard(1),
    biasCard(2),
  ]

  it('both bias cards render by default — never behind "Show N more"', () => {
    render(<InlineBlocks blocks={blocks} />)
    expect(visibleBiasCards()).toHaveLength(2)
  })

  it('the legacy overflow toggle does not count the bias cards (4 non-phase-3 blocks = no overflow)', () => {
    render(<InlineBlocks blocks={blocks} />)
    expect(screen.queryByRole('button', { name: /show \d+ more block/i })).not.toBeInTheDocument()
  })
})
