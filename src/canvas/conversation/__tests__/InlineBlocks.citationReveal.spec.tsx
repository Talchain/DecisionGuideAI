/**
 * Review-folds C11 + C13 + C4 — citation reveal, honest legend gating and
 * the un-nested live region (all pinned RED-first against the F16 pacing
 * renderer).
 *
 *   C11: a citation click whose [data-citation-target] sits behind the
 *        pacing/budget collapse used to hit `if (!target) return` — a
 *        silent no-op. Now it reveals the collapsed content, flushes the
 *        commit synchronously and scrolls; it fails silent only when
 *        the target is STILL missing.
 *   C13: the graph-vocabulary legend used to gate on phase3Count > 0 — it
 *        rendered for a turn whose ONLY phase-3 card was hidden behind the
 *        legacy "Show 1 more" budget (a legend for invisible cards). It
 *        now gates on at least one phase-3 card CURRENTLY RENDERED.
 *   C4:  the pacing count span was role="status" nested inside the block
 *        container — a live region that replayed on unhide and
 *        double-announced with the toggle's accessible name. The sr-only
 *        text stays; the live-region role goes.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { InlineBlocks } from '../InlineBlocks'
import type {
  BriefBlock,
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

const fact: FactBlock = { type: 'fact', value: '42%', label: 'Lift', fact_type: 'simple' }
const framing: FramingBlock = { type: 'framing', goal: 'A goal', options: [] }
const brief: BriefBlock = { type: 'brief', title: 'A brief', summary: 'Summary.' }

let scrollSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  scrollSpy = vi.fn()
  Element.prototype.scrollIntoView = scrollSpy as unknown as typeof Element.prototype.scrollIntoView
  // No rAF mock needed: the handler reveals via flushSync and re-queries
  // synchronously (/simplify item 6), so every assertion below is
  // synchronous — no waitFor, no macrotask flush.
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('C11 — citation to collapsed content reveals and scrolls', () => {
  it('a citation targeting a pacing-collapsed phase-3 card expands the collapse and scrolls to it', () => {
    // blocks[0] commentary with a citation at index 6 → blocks[5] (rc_5),
    // which sits behind the phase-3 pacing collapse (5 phase-3 cards,
    // default-expanded 3).
    const commentary: CommentaryBlock = {
      type: 'commentary',
      text: 'The verdict rests on the last review card. [6]',
      citations: [{ index: 6, source: 'Model review' }],
    }
    const blocks: ConversationBlock[] = [
      commentary,
      reviewCard(1),
      reviewCard(2),
      reviewCard(3),
      reviewCard(4),
      reviewCard(5),
    ]
    render(<InlineBlocks blocks={blocks} />)
    // The target card is collapsed (not rendered).
    expect(screen.queryByText('Review card 5')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /citation 6/i }))

    // Revealed and scrolled — not a silent no-op.
    expect(screen.getByText('Review card 5')).toBeInTheDocument()
    expect(scrollSpy).toHaveBeenCalled()
  })

  it('a citation targeting a budget-hidden block expands "Show more" and scrolls to it', () => {
    // Pacing inactive (1 phase-3 card); the 5th block (index 4, citation
    // target 5) hides behind the legacy per-turn budget of 4.
    const commentary: CommentaryBlock = {
      type: 'commentary',
      text: 'See the coaching card. [5]',
      citations: [{ index: 5, source: 'Model coaching' }],
    }
    const blocks: ConversationBlock[] = [commentary, fact, framing, brief, coaching(1)]
    render(<InlineBlocks blocks={blocks} />)
    expect(screen.queryByText('Coaching card 1')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /citation 5/i }))

    expect(screen.getByText('Coaching card 1')).toBeInTheDocument()
    expect(scrollSpy).toHaveBeenCalled()
  })

  it('a citation whose target is genuinely missing stays a silent no-op (no crash, nothing revealed)', () => {
    const commentary: CommentaryBlock = {
      type: 'commentary',
      text: 'Dangling citation. [9]',
      citations: [{ index: 9, source: 'Nowhere' }],
    }
    render(<InlineBlocks blocks={[commentary, fact]} />)
    fireEvent.click(screen.getByRole('button', { name: /citation 9/i }))
    // The reveal + retry are synchronous, so the negative is safe to assert
    // immediately — no macrotask flush to wait on.
    expect(scrollSpy).not.toHaveBeenCalled()
  })

  it('a citation to a visible block scrolls immediately without touching any collapse state', () => {
    const commentary: CommentaryBlock = {
      type: 'commentary',
      text: 'See the fact. [2]',
      citations: [{ index: 2, source: 'Lift' }],
    }
    const blocks: ConversationBlock[] = [
      commentary,
      fact,
      reviewCard(1),
      reviewCard(2),
      reviewCard(3),
      reviewCard(4),
    ]
    render(<InlineBlocks blocks={blocks} />)
    fireEvent.click(screen.getByRole('button', { name: /citation 2/i }))
    expect(scrollSpy).toHaveBeenCalled()
    // The pacing collapse stays collapsed (rc_4 remains hidden).
    expect(screen.queryByText('Review card 4')).not.toBeInTheDocument()
  })
})

describe('C13 — legend gates on a phase-3 card being CURRENTLY RENDERED', () => {
  it('verifier construction: [commentary, fact, framing, brief, v5_coaching] → no legend until "Show 1 more"', () => {
    const commentary: CommentaryBlock = { type: 'commentary', text: 'Some commentary.' }
    const blocks: ConversationBlock[] = [commentary, fact, framing, brief, coaching(1)]
    render(<InlineBlocks blocks={blocks} />)
    // The only phase-3 card is hidden behind the legacy budget — a legend
    // for invisible cards must not render.
    expect(screen.queryByText('Coaching card 1')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /what do these terms mean/i }),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /show 1 more/i }))

    expect(screen.getByText('Coaching card 1')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /what do these terms mean/i }),
    ).toBeInTheDocument()
  })

  it('legend renders alongside default-expanded phase-3 cards (unchanged happy path)', () => {
    render(<InlineBlocks blocks={[reviewCard(1)]} />)
    expect(
      screen.getByRole('button', { name: /what do these terms mean/i }),
    ).toBeInTheDocument()
  })
})

describe('C4 — the pacing count is static sr-only text, not a nested live region', () => {
  it('renders the collapsed-count text without role="status" (the toggle name already carries the count)', () => {
    const blocks: ConversationBlock[] = [1, 2, 3, 4, 5].map(reviewCard)
    const { container } = render(<InlineBlocks blocks={blocks} />)
    // The sr-only summary text is still present…
    expect(screen.getByText(/2 more coaching and review cards collapsed/i)).toBeInTheDocument()
    // …but InlineBlocks contributes NO live region of its own.
    expect(container.querySelector('[role="status"]')).toBeNull()
    expect(container.querySelector('[aria-live]')).toBeNull()
  })
})
