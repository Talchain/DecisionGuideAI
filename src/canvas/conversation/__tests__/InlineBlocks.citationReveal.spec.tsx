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
 *        ⚠ See the note on the C13 describe below: ROADMAP 2.211-② made
 *        that construction unreachable, and the pin was rewritten to say so
 *        rather than left passing for a reason that no longer exists.
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
    // blocks[0] commentary with a citation at index 8 → blocks[7] (rc_7),
    // which sits behind the phase-3 pacing collapse (7 phase-3 cards,
    // default-expanded 6). Fixture resized for ROADMAP 2.211-② (was 5 cards
    // against a cap of 3); same one-card-past-the-cap shape, same assertion.
    const commentary: CommentaryBlock = {
      type: 'commentary',
      text: 'The verdict rests on the last review card. [8]',
      citations: [{ index: 8, source: 'Model review' }],
    }
    const blocks: ConversationBlock[] = [
      commentary,
      ...[1, 2, 3, 4, 5, 6, 7].map(reviewCard),
    ]
    render(<InlineBlocks blocks={blocks} />)
    // The target card is collapsed (not rendered).
    expect(screen.queryByText('Review card 7')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /citation 8/i }))

    // Revealed and scrolled — not a silent no-op.
    expect(screen.getByText('Review card 7')).toBeInTheDocument()
    expect(scrollSpy).toHaveBeenCalled()
  })

  it('a citation targeting a budget-hidden block expands "Show more" and scrolls to it', () => {
    // The 5th block (index 4, citation target 5) hides behind the legacy
    // per-turn budget of 4.
    //
    // ⚠ The hidden block used to be a v5_coaching card. ROADMAP 2.211-②
    // removed phase-3 cards from the legacy budget entirely (they are
    // governed by the pacing group alone), so a phase-3 card can no longer
    // BE budget-hidden — the old fixture would have proved nothing. The
    // target is now a non-phase-3 block, which is what the legacy budget
    // still governs, so this pin keeps testing the reveal path it names.
    const secondBrief: BriefBlock = { type: 'brief', title: 'Second brief', summary: 'More.' }
    const commentary: CommentaryBlock = {
      type: 'commentary',
      text: 'See the second brief. [5]',
      citations: [{ index: 5, source: 'Model brief' }],
    }
    const blocks: ConversationBlock[] = [commentary, fact, framing, brief, secondBrief]
    render(<InlineBlocks blocks={blocks} />)
    expect(screen.queryByText('Second brief')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /citation 5/i }))

    expect(screen.getByText('Second brief')).toBeInTheDocument()
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
    // 7 phase-3 cards against the 2.211-② cap of 6 → rc_7 stays collapsed
    // (was 4 cards against a cap of 3).
    const blocks: ConversationBlock[] = [
      commentary,
      fact,
      ...[1, 2, 3, 4, 5, 6, 7].map(reviewCard),
    ]
    render(<InlineBlocks blocks={blocks} />)
    fireEvent.click(screen.getByRole('button', { name: /citation 2/i }))
    expect(scrollSpy).toHaveBeenCalled()
    // The pacing collapse stays collapsed (rc_7 remains hidden).
    expect(screen.queryByText('Review card 7')).not.toBeInTheDocument()
  })
})

describe('C13 — legend gates on a phase-3 card being CURRENTLY RENDERED', () => {
  /**
   * ⚠ ROADMAP 2.211-② CHANGED WHAT THIS CAN PROVE — recorded, not papered over.
   *
   * The original verifier was [commentary, fact, framing, brief, v5_coaching]:
   * the turn's ONLY phase-3 card sat behind the legacy "Show 1 more" budget,
   * so the legend had to stay away until it was revealed. 2.211-② removed
   * phase-3 cards from the legacy budget, and the pacing group always renders
   * its first PHASE3_DEFAULT_EXPANDED cards — so **a turn that carries a
   * phase-3 card now always renders at least one**, and the "every phase-3
   * card hidden" state is unreachable through either budget.
   *
   * The C13 guard in InlineBlocks is deliberately KEPT (it is still the
   * correct predicate, and it is what makes the reachability argument true
   * rather than accidental), but no fixture can drive it to false while a
   * phase-3 card is present. So this pin now asserts the reachability claim
   * itself — the same construction, opposite expectation — and the live
   * negative case is "no phase-3 cards at all", pinned below and in
   * InlineBlocks.phase3Pacing.spec.tsx. Anything else here would be a test
   * that passes by testing nothing (platform trap 13).
   */
  it('2.211-②: the sole phase-3 card is no longer budget-hidden, so the legend renders at once', () => {
    const commentary: CommentaryBlock = { type: 'commentary', text: 'Some commentary.' }
    const blocks: ConversationBlock[] = [commentary, fact, framing, brief, coaching(1)]
    render(<InlineBlocks blocks={blocks} />)
    // The card is rendered — the legacy budget no longer governs phase-3 cards.
    expect(screen.getByText('Coaching card 1')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /what do these terms mean/i }),
    ).toBeInTheDocument()
    // …and the legacy budget still governs the four non-phase-3 blocks, which
    // fit exactly, so it contributes no overflow toggle of its own.
    expect(screen.queryByRole('button', { name: /more block/i })).not.toBeInTheDocument()
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
    // 8 cards against the 2.211-② default-expanded cap of 6 → 2 collapsed.
    // This fixture was 5 cards while the cap was 3 (same 2-collapsed shape);
    // it was resized, NOT re-expected, so the assertion below is byte-identical
    // to the one this pin has always made.
    const blocks: ConversationBlock[] = [1, 2, 3, 4, 5, 6, 7, 8].map(reviewCard)
    const { container } = render(<InlineBlocks blocks={blocks} />)
    // The sr-only summary text is still present…
    expect(screen.getByText(/2 more coaching and review cards collapsed/i)).toBeInTheDocument()
    // …but InlineBlocks contributes NO live region of its own.
    expect(container.querySelector('[role="status"]')).toBeNull()
    expect(container.querySelector('[aria-live]')).toBeNull()
  })
})
