/**
 * F16 — phase-3 card pacing + graph-vocabulary legend (COACHING-REVIEW-UI-BRIEF §3
 * progressive disclosure, ratified renderer target).
 *
 * A single run response can land 10–15 phase-3 blocks (observed live:
 * 5 review_card + 4 coaching + 1 evidence) with no pacing — a card flood.
 * These pins hold the ratified pacing contract at the RENDER layer
 * (InlineBlocks): the store/message keeps ALL blocks; the panel defaults to
 * the top PHASE3_DEFAULT_EXPANDED phase-3 cards expanded, the remainder
 * behind exactly ONE count affordance, order preserved exactly, collapsed
 * count announced to screen readers. A small "What do these terms mean?"
 * affordance offers the graph vocabulary legend near the cards.
 *
 * ⚠ COUNTS UPDATED — ROADMAP 2.211-② (founder ruling, 1 Aug): the
 * default-expanded cap moved 3 → 6. Every count below that used to read 3
 * expanded / 7 collapsed now reads 6 / 4; nothing else about the contract
 * changed and the Show-more affordance is deliberately KEPT. The counts are
 * spelled out literally rather than imported from PHASE3_DEFAULT_EXPANDED
 * on purpose: a pin computed from the constant it is pinning cannot fail
 * when the constant moves (platform trap 12b).
 *
 * Flood pin (mutation check): reverting the grouping renders 4 cards by the
 * legacy per-turn cap instead of 6 → the default-expanded pin goes RED.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { InlineBlocks } from '../InlineBlocks'
import type {
  ConversationBlock,
  FactBlock,
  V5CoachingBlock,
  V5EvidenceBlock,
  V5ReviewCardBlock,
} from '../types'

// Minimal canvas store mock — InlineBlocks reads `nodes` for patch target
// lookup and the V5 target-ref pills read selection actions (same shape as
// InlineBlocks.dsv5.spec.tsx).
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

// ─── Fixture: the observed live flood shape ──────────────────────────────
// 5 review_card + 4 coaching + 1 evidence = 10 phase-3 blocks in one turn.

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

function coaching(n: number): V5CoachingBlock {
  return {
    type: 'v5_coaching',
    block_id: `co_${n}`,
    title: `Coaching card ${n}`,
    body: `Coaching body ${n}`,
    coaching_kind: 'assumption_check',
    source: 'decision_review',
    target_refs: [],
    priority_rank: 10 + n,
    freshness: 'fresh',
  }
}

function evidence(n: number): V5EvidenceBlock {
  return {
    type: 'v5_evidence',
    block_id: `ev_${n}`,
    factor_label: `Evidence factor ${n}`,
    target_refs: [],
    current_confidence: 'low',
    evidence_gap: `Gap ${n}`,
    suggested_technique: `Technique ${n}`,
    impact_if_gathered: `Impact ${n}`,
    priority_rank: 20 + n,
    severity: 'info',
    freshness: 'fresh',
  }
}

/** The a16a0e82-shaped flood: 5 review + 4 coaching + 1 evidence, in order. */
function floodBlocks(): ConversationBlock[] {
  return [
    reviewCard(1),
    reviewCard(2),
    reviewCard(3),
    reviewCard(4),
    reviewCard(5),
    coaching(1),
    coaching(2),
    coaching(3),
    coaching(4),
    evidence(1),
  ]
}

const factBlock: FactBlock = {
  type: 'fact',
  value: '42%',
  label: 'Conversion lift',
  fact_type: 'simple',
}

/** All rendered phase-3 card title texts, in DOM order. */
function renderedCardTitles(container: HTMLElement): string[] {
  return Array.from(
    container.querySelectorAll(
      '[data-testid="v5-review-card-title"], [data-testid="v5-coaching-title"], [data-testid="v5-evidence-title"]',
    ),
  ).map((el) => el.textContent ?? '')
}

// ─── Pins ────────────────────────────────────────────────────────────────

describe('InlineBlocks — phase-3 card pacing (F16)', () => {
  it('FLOOD PIN: a 10-block phase-3 flood defaults to exactly 6 expanded cards (2.211-②)', () => {
    const { container } = render(<InlineBlocks blocks={floodBlocks()} />)
    expect(renderedCardTitles(container)).toEqual([
      'Review card 1',
      'Review card 2',
      'Review card 3',
      'Review card 4',
      'Review card 5',
      'Coaching card 1',
    ])
  })

  it('the remainder sits behind exactly ONE count affordance announcing the collapsed count', () => {
    render(<InlineBlocks blocks={floodBlocks()} />)
    const toggles = screen.getAllByRole('button', { name: /show 4 more/i })
    expect(toggles).toHaveLength(1)
    expect(toggles[0]).toHaveAttribute('aria-expanded', 'false')
    // No competing second overflow affordance for the same turn.
    expect(screen.getAllByRole('button', { name: /show \d+ more/i })).toHaveLength(1)
  })

  it('a static sr-only summary carries the collapsed count (no nested live region — review-folds C4)', () => {
    const { container } = render(<InlineBlocks blocks={floodBlocks()} />)
    expect(screen.getByText(/4 more coaching and review cards collapsed/i)).toBeInTheDocument()
    // The toggle's accessible name already carries the count; InlineBlocks
    // must contribute no live region of its own (the old role="status"
    // replayed on unhide and double-announced every toggle).
    expect(container.querySelector('[role="status"]')).toBeNull()
  })

  it('ONE interaction reveals all 10 cards with order preserved exactly', () => {
    const { container } = render(<InlineBlocks blocks={floodBlocks()} />)
    fireEvent.click(screen.getByRole('button', { name: /show 4 more/i }))
    expect(renderedCardTitles(container)).toEqual([
      'Review card 1',
      'Review card 2',
      'Review card 3',
      'Review card 4',
      'Review card 5',
      'Coaching card 1',
      'Coaching card 2',
      'Coaching card 3',
      'Coaching card 4',
      'Evidence factor 1',
    ])
  })

  it('non-phase-3 blocks in the same turn stay visible and do not consume the card budget', () => {
    const { container } = render(
      <InlineBlocks blocks={[factBlock, ...floodBlocks()]} />,
    )
    // The fact block renders alongside the 6 default-expanded cards.
    expect(screen.getByTestId('block-fact')).toBeInTheDocument()
    expect(renderedCardTitles(container)).toEqual([
      'Review card 1',
      'Review card 2',
      'Review card 3',
      'Review card 4',
      'Review card 5',
      'Coaching card 1',
    ])
    expect(screen.getByRole('button', { name: /show 4 more/i })).toBeInTheDocument()
  })

  it('no pacing affordance when the turn carries 3 or fewer phase-3 cards', () => {
    const { container } = render(
      <InlineBlocks blocks={[reviewCard(1), coaching(1), evidence(1)]} />,
    )
    expect(renderedCardTitles(container)).toHaveLength(3)
    expect(screen.queryByRole('button', { name: /show \d+ more/i })).not.toBeInTheDocument()
  })

  // ── ROADMAP 2.211-② boundary pins ───────────────────────────────────────
  // The ruled number is 6, so pin it from BOTH sides at the boundary itself.
  // Both go RED at the old cap of 3: at 3 the 6-card turn paces ("Show 3
  // more") and the 7-card turn reads "Show 4 more", not "Show 1 more".
  // The 3-card case above cannot see the difference between 3 and 6 — it
  // passes under either cap — so these carry the ruling, not that one.

  it('2.211-② BOUNDARY: exactly 6 phase-3 cards render with NO affordance', () => {
    const six: ConversationBlock[] = [
      reviewCard(1), reviewCard(2), reviewCard(3), reviewCard(4), reviewCard(5), coaching(1),
    ]
    const { container } = render(<InlineBlocks blocks={six} />)
    expect(renderedCardTitles(container)).toHaveLength(6)
    expect(screen.queryByRole('button', { name: /show \d+ more/i })).not.toBeInTheDocument()
  })

  it('2.211-② BOUNDARY: the 7th phase-3 card is the first to collapse ("Show 1 more")', () => {
    const seven: ConversationBlock[] = [
      reviewCard(1), reviewCard(2), reviewCard(3), reviewCard(4), reviewCard(5),
      coaching(1), coaching(2),
    ]
    const { container } = render(<InlineBlocks blocks={seven} />)
    expect(renderedCardTitles(container)).toEqual([
      'Review card 1',
      'Review card 2',
      'Review card 3',
      'Review card 4',
      'Review card 5',
      'Coaching card 1',
    ])
    const toggle = screen.getByRole('button', { name: /show 1 more coaching and review card/i })
    expect(toggle).toBeInTheDocument()
    // Singular copy at a collapsed count of exactly 1.
    expect(toggle).toHaveAccessibleName('Show 1 more coaching and review card')
    fireEvent.click(toggle)
    expect(renderedCardTitles(container)).toHaveLength(7)
  })
})

describe('InlineBlocks — graph-vocabulary legend affordance (F16)', () => {
  it('offers "What do these terms mean?" near phase-3 cards and reveals the legend on demand', () => {
    render(<InlineBlocks blocks={floodBlocks()} />)
    const legendToggle = screen.getByRole('button', { name: /what do these terms mean/i })
    expect(legendToggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(legendToggle)
    expect(legendToggle).toHaveAttribute('aria-expanded', 'true')
    // Minimal node/edge vocabulary of the cards' target refs. Every canvas
    // node kind must appear: 'Outcome' was missing while the canvas's own
    // "How to read this" key listed it, so a card pointing at an outcome node
    // referred to vocabulary this primer did not define.
    for (const term of ['Decision', 'Factor', 'Option', 'Outcome', 'Goal', 'Risk', 'Constraint', 'Link']) {
      expect(screen.getByText(term)).toBeInTheDocument()
    }
  })

  it('renders no legend affordance when the turn has no phase-3 cards', () => {
    render(<InlineBlocks blocks={[factBlock]} />)
    expect(
      screen.queryByRole('button', { name: /what do these terms mean/i }),
    ).not.toBeInTheDocument()
  })
})
