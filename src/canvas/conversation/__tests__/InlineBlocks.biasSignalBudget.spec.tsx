/**
 * Review-folds C1 — bias-signal cards are exempt from BOTH visibility
 * budgets (the ratified #356 acceptance: ≤2 bias cards ALWAYS render by
 * default — they carry their own cap in buildDraftBiasSignalBlocks).
 *
 * Two previously-failing regimes, pinned RED-first:
 *   1. FLOOD turn: more producer phase-3 cards than the default-expanded
 *      cap, + 2 bias cards. Bias cards used to join phase3Indices, land
 *      past the cap and collapse behind "Show N more".
 *   2. BLOCK-RICH turn: ≥4 non-phase-3 blocks + 2 bias cards with pacing
 *      inactive. Bias cards used to join budgetIndices, land past the
 *      legacy per-turn cap (4) and hide behind the overflow toggle.
 *
 * Also pinned: bias cards do not COUNT toward the pacing trigger, so a turn
 * with exactly cap-many producer phase-3 cards + 2 bias cards paces nothing.
 *
 * ⚠ FIXTURES RESIZED — ROADMAP 2.211-② (founder ruling, 1 Aug) moved
 * PHASE3_DEFAULT_EXPANDED 3 → 6. Each fixture below was grown so it still
 * straddles the cap; the ASSERTIONS are unchanged in kind. Two of them had
 * to grow or they would have kept passing for the wrong reason — a turn of
 * 3 producer + 2 bias cards is under a cap of 6 whether or not bias cards
 * are exempt, so that pin would have gone vacuous (platform trap 12b) while
 * still reading green. Sizes are literal, never derived from the constant.
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

/**
 * A PRODUCER-typed bias card (carries priority_rank + freshness, unlike the
 * UI bridge's). It matches isBiasSignalCoachingBlock exactly as the bridge's
 * does — which is precisely why the cap had to become structural.
 */
function producerBiasCard(n: number): V5CoachingBlock {
  return {
    type: 'v5_coaching',
    block_id: `producer_bias_${n}`,
    title: `Producer bias signal ${n}`,
    body: `Producer-authored bias detail ${n}.`,
    coaching_kind: 'bias_signal',
    source: 'engine',
    target_refs: [],
    priority_rank: n,
    freshness: 'fresh',
  }
}

const fact: FactBlock = { type: 'fact', value: '42%', label: 'Lift', fact_type: 'simple' }
const commentary: CommentaryBlock = { type: 'commentary', text: 'Some commentary.' }
const framing: FramingBlock = { type: 'framing', goal: 'A goal', options: [] }

const visibleBiasCards = () => screen.queryAllByTestId('bias-signal-card')

describe('C1 regime 1 — FLOOD turn: producer phase-3 flood + 2 bias cards', () => {
  // 7 producer cards against the cap of 6 → exactly 1 collapsed.
  const blocks: ConversationBlock[] = [
    ...[1, 2, 3, 4, 5, 6, 7].map(reviewCard),
    biasCard(1),
    biasCard(2),
  ]

  it('both bias cards render by default — never in the collapse tail', () => {
    render(<InlineBlocks blocks={blocks} />)
    expect(visibleBiasCards()).toHaveLength(2)
  })

  it('the pacing affordance counts ONLY the collapsed producer cards (1 here), not the bias cards', () => {
    render(<InlineBlocks blocks={blocks} />)
    // Discriminating: were the 2 bias cards counted, 9 cards over a cap of 6
    // would read "Show 3 more".
    expect(screen.getByRole('button', { name: /show 1 more/i })).toBeInTheDocument()
  })

  it('bias cards do not count toward the pacing trigger: 6 producer + 2 bias paces nothing', () => {
    render(
      <InlineBlocks blocks={[...[1, 2, 3, 4, 5, 6].map(reviewCard), biasCard(1), biasCard(2)]} />,
    )
    expect(visibleBiasCards()).toHaveLength(2)
    // Discriminating at the cap: 6 exempt-excluded cards do not pace, but 8
    // counted ones would. This fixture was 3 producer cards while the cap was
    // 3; left at 3 it would sit under a cap of 6 either way and prove nothing.
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

/**
 * /simplify item 5 — the ONE deliberate behaviour change.
 *
 * The C1 exemption keyed on block KIND, but the ≤2 cap it cited lived only
 * in the UI bridge (DRAFT_BIAS_SIGNAL_CARD_CAP). The bridge deliberately
 * stands down when CEE emits real bias coaching — and producer blocks match
 * the same predicate — so producer bias cards were exempt from BOTH budgets
 * and capped by NOTHING. Written RED-first: before the fix all 13 rendered
 * uncollapsed with no affordance at all.
 *
 * No behaviour change on today's live path: the bridge already caps at 2, so
 * a turn never carries more than 2 bias cards in production.
 */
describe('/simplify item 5 — the cap is STRUCTURAL: producer bias floods are budgeted', () => {
  const thirteen: ConversationBlock[] = Array.from({ length: 13 }, (_, i) => producerBiasCard(i + 1))

  it('13 producer bias blocks → only the first 2 are budget-exempt', () => {
    render(<InlineBlocks blocks={thirteen} />)
    // 2 exempt + the 6 the phase-3 pacing budget defaults to expanded (2.211-②).
    expect(visibleBiasCards()).toHaveLength(8)
  })

  it('the remaining 5 fall through to the normal pacing path, behind ONE affordance', () => {
    render(<InlineBlocks blocks={thirteen} />)
    expect(screen.getByRole('button', { name: /show 5 more coaching and review card/i }))
      .toBeInTheDocument()
  })

  it('revealing the affordance shows all 13 — nothing is dropped, only paced', async () => {
    const { default: userEvent } = await import('@testing-library/user-event')
    render(<InlineBlocks blocks={thirteen} />)
    await userEvent.click(screen.getByRole('button', { name: /show 5 more coaching and review card/i }))
    expect(visibleBiasCards()).toHaveLength(13)
  })

  it('the exemption is capped, not disabled: 2 bias cards still always render', () => {
    render(<InlineBlocks blocks={[producerBiasCard(1), producerBiasCard(2)]} />)
    expect(visibleBiasCards()).toHaveLength(2)
    expect(screen.queryByRole('button', { name: /show \d+ more/i })).not.toBeInTheDocument()
  })
})
