/**
 * DEDUPE REACHES BEHIND "Show N more" — UX gate 2026-08-18 point 4.
 *
 * ## The defect this file pins
 *
 * Witnessed twice on deployed staging (19 + 20 Aug): ZERO duplicate paragraphs
 * in the default collapsed view — a real improvement — and THREE verbatim
 * duplicate pairs once the disclosure is opened.
 *
 * The mechanism, derived at the bytes and NOT a competing-authority problem:
 * `composeMessage` makes one total, disjoint partition and both tiers render
 * through the same `renderEntry`. The escape was the type gate in
 * `InlineBlocks`' suppression walk — it processed only `commentary`, and
 * `commentary` is in `PINNED_BLOCK_TYPES`, so it can NEVER land in `detail`.
 * Every block behind the disclosure was therefore STRUCTURALLY INELIGIBLE for
 * dedupe: the walk included `composition.detail` only to `continue` past all
 * of it.
 *
 * ## Why this file exists rather than an addition to an existing spec
 *
 * The coverage gap was exact and is the primary proof obligation here. At the
 * pristine tip, THREE specs click `block-detail-toggle`
 * (InlineBlocks.composition, BlockFallback, MixedBlocks.integration) and NONE
 * of them counts duplicate text; both dedupe specs (renderAuthority.spec.ts,
 * renderAuthority.bubble.spec.tsx) contain ZERO references to that toggle and
 * are collapsed-only. So a test that rendered only the collapsed view would
 * have passed while this shipped. Every test below opens the disclosure.
 *
 * ## Binding discipline
 *
 * Assertions bind to a block by IDENTITY — `data-citation-target`, which
 * `renderEntry` sets to the block's ORIGINAL index and which survives demotion
 * — never by "some element on the page contains this sentence", which a
 * different block could satisfy (platform trap 19). The shared paragraph is a
 * fixture constant read through an identity-selected element, so improving the
 * copy never rewrites an assertion.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { InlineBlocks } from '../InlineBlocks'
import type {
  ConversationBlock,
  V5CoachingBlock,
  V5EvidenceBlock,
  V5ExerciseBlock,
  V5ExplanationBlock,
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

/**
 * The repeated paragraph. A fixture constant, never an assertion literal — it
 * is always read through an element selected by block identity.
 */
const SHARED = 'The pilot depends on procurement clearing before the end of Q3.'
const DETAIL_ONLY = 'Two of the three suppliers have not yet returned a quote.'

function reviewCard(n: number, body: string): V5ReviewCardBlock {
  return {
    type: 'v5_review_card', block_id: `rc_${n}`, title: `Review card ${n}`,
    body, severity: 'info', card_kind: 'narrative',
    target_refs: [], priority_rank: n, freshness: 'fresh',
  }
}
function coaching(n: number, body: string): V5CoachingBlock {
  return {
    type: 'v5_coaching', block_id: `co_${n}`, title: `Coaching card ${n}`,
    body, coaching_kind: 'assumption_check',
    source: 'decision_review', target_refs: [], priority_rank: 10 + n, freshness: 'fresh',
  }
}
function evidence(n: number, gap: string): V5EvidenceBlock {
  return {
    type: 'v5_evidence', block_id: `ev_${n}`, factor_label: `Evidence factor ${n}`,
    target_refs: [], current_confidence: 'low', evidence_gap: gap,
    suggested_technique: `Technique ${n}`, impact_if_gathered: `Impact ${n}`,
    priority_rank: 20 + n, severity: 'info', freshness: 'fresh',
  }
}
function explanation(narrative: string): V5ExplanationBlock {
  return {
    type: 'v5_explanation', narrative, referenced_option_ids: [],
  } as V5ExplanationBlock
}

/** The block wrapper for an ORIGINAL block index — identity, stable across demotion. */
function blockAt(index: number): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-citation-target="${index + 1}"]`)
}

/** How many RENDERED blocks currently contain `text`. The duplicate counter. */
function blocksContaining(text: string): number[] {
  const out: number[] = []
  document.querySelectorAll<HTMLElement>('[data-citation-target]').forEach((el) => {
    if ((el.textContent ?? '').includes(text)) {
      out.push(Number(el.getAttribute('data-citation-target')) - 1)
    }
  })
  return out
}

function expand(): void {
  fireEvent.click(screen.getByTestId('block-detail-toggle'))
  expect(screen.getByTestId('block-detail-body')).toBeInTheDocument()
}

// ---------------------------------------------------------------------------
// 1. The witnessed defect: duplicates behind the disclosure
// ---------------------------------------------------------------------------

describe('a demoted block does not repeat a paragraph a top-level block already stated', () => {
  /**
   * 0,1,2 are the three top-level points (MAX_POINTS). 3,4,5 are demoted.
   * Blocks 3 and 5 carry byte-identical copies of block 0's body — the live
   * shape, where CEE emits one narrative on several typed channels of one turn.
   */
  const blocks = (): ConversationBlock[] => [
    reviewCard(1, SHARED),
    reviewCard(2, 'Unique review body 2'),
    reviewCard(3, 'Unique review body 3'),
    coaching(1, SHARED),
    coaching(2, 'Unique coaching body 2'),
    coaching(3, SHARED),
  ]

  it('RED-first — expanded, the paragraph is rendered by EXACTLY ONE block', () => {
    render(<InlineBlocks blocks={blocks()} />)
    expand()
    // At the pristine tip this is [0, 3, 5] — the witnessed duplicate pairs.
    expect(blocksContaining(SHARED)).toEqual([0])
  })

  it('RED-first — the demoted repeats specifically (blocks 3 and 5) withhold it', () => {
    render(<InlineBlocks blocks={blocks()} />)
    expand()
    expect(blockAt(3)!.textContent).not.toContain(SHARED)
    expect(blockAt(5)!.textContent).not.toContain(SHARED)
  })

  it('OPPOSITE DIRECTION — the FIRST occurrence is never the one suppressed', () => {
    render(<InlineBlocks blocks={blocks()} />)
    expand()
    // Block 0 stated it first and keeps it. This is the invariant that makes
    // the feature a de-duplicator rather than a censor.
    expect(blockAt(0)!.textContent).toContain(SHARED)
  })

  it('OPPOSITE DIRECTION — per-FIELD, not per-block: the repeats keep their titles', () => {
    render(<InlineBlocks blocks={blocks()} />)
    expand()
    // Suppressing a whole card to remove one repeated paragraph would lose the
    // title, which the user has NOT seen. Fork 1, resolved in favour of fields.
    expect(blockAt(3)!.textContent).toContain('Coaching card 1')
    expect(blockAt(5)!.textContent).toContain('Coaching card 3')
  })

  it('OPPOSITE DIRECTION — a demoted block with unique prose is untouched', () => {
    render(<InlineBlocks blocks={blocks()} />)
    expand()
    expect(blockAt(4)!.textContent).toContain('Unique coaching body 2')
    expect(blockAt(4)!.textContent).toContain('Coaching card 2')
  })
})

// ---------------------------------------------------------------------------
// 2. The first occurrence survives even when EVERY occurrence is demoted
// ---------------------------------------------------------------------------

describe('duplication entirely INSIDE the disclosure', () => {
  const blocks = (): ConversationBlock[] => [
    reviewCard(1, 'Unique review body 1'),
    reviewCard(2, 'Unique review body 2'),
    reviewCard(3, 'Unique review body 3'),
    coaching(1, DETAIL_ONLY),
    coaching(2, DETAIL_ONLY),
  ]

  it('the earlier demoted block keeps it, the later one withholds it', () => {
    render(<InlineBlocks blocks={blocks()} />)
    expand()
    expect(blocksContaining(DETAIL_ONLY)).toEqual([3])
  })

  it('OPPOSITE DIRECTION — nothing is suppressed while the disclosure is CLOSED', () => {
    render(<InlineBlocks blocks={blocks()} />)
    // Collapsed: neither demoted block is in the document at all, so no
    // suppression is observable and the top level is untouched.
    expect(blocksContaining(DETAIL_ONLY)).toEqual([])
    expect(blockAt(0)!.textContent).toContain('Unique review body 1')
  })
})

// ---------------------------------------------------------------------------
// 3. The collapsed view must not regress — it is currently clean
// ---------------------------------------------------------------------------

describe('the collapsed view is unchanged', () => {
  const blocks = (): ConversationBlock[] => [
    reviewCard(1, SHARED),
    reviewCard(2, 'Unique review body 2'),
    reviewCard(3, 'Unique review body 3'),
    coaching(1, SHARED),
  ]

  it('collapsed, the top-level paragraph renders exactly once and in full', () => {
    render(<InlineBlocks blocks={blocks()} />)
    expect(blocksContaining(SHARED)).toEqual([0])
    expect(blockAt(0)!.textContent).toContain(SHARED)
  })

  it('BYTE-PRESERVING DEMOTION — opening the disclosure does not rewrite tier 0', () => {
    render(<InlineBlocks blocks={blocks()} />)
    const before = blockAt(0)!.textContent
    expand()
    // Invariant 1: opening the disclosure REVEALS what was demoted; it must
    // never re-write what was already on screen.
    expect(blockAt(0)!.textContent).toBe(before)
  })
})

// ---------------------------------------------------------------------------
// 4. Multi-field cards: one repeated field, the rest survive
// ---------------------------------------------------------------------------

describe('a multi-field card loses only the field that repeats', () => {
  const blocks = (): ConversationBlock[] => [
    reviewCard(1, SHARED),
    reviewCard(2, 'Unique review body 2'),
    reviewCard(3, 'Unique review body 3'),
    evidence(1, SHARED),
  ]

  it('the repeated field is withheld', () => {
    render(<InlineBlocks blocks={blocks()} />)
    expand()
    expect(blocksContaining(SHARED)).toEqual([0])
  })

  it('OPPOSITE DIRECTION — its sibling fields and label are all still rendered', () => {
    render(<InlineBlocks blocks={blocks()} />)
    expand()
    const card = blockAt(3)!
    // v5_evidence carries three independent paragraphs. Dropping the card to
    // remove one of them would delete two the user has never seen.
    expect(card.textContent).toContain('Evidence factor 1')
    expect(card.textContent).toContain('Technique 1')
    expect(card.textContent).toContain('Impact 1')
  })
})

// ---------------------------------------------------------------------------
// 5. The empty result, handled honestly
// ---------------------------------------------------------------------------

describe('a block whose ONLY content repeats renders nothing, not an empty shell', () => {
  /**
   * `v5_explanation` renders its narrative under a HARD-CODED "Explanation"
   * heading and has nothing else — so a wholly-duplicate narrative would leave
   * a card titled by the UI saying nothing. Block 4 survives, so the
   * disclosure still exists and its count can be checked.
   */
  const blocks = (): ConversationBlock[] => [
    reviewCard(1, SHARED),
    reviewCard(2, 'Unique review body 2'),
    reviewCard(3, 'Unique review body 3'),
    explanation(SHARED),
    coaching(1, DETAIL_ONLY),
  ]

  it('the emptied block is absent from the disclosure', () => {
    render(<InlineBlocks blocks={blocks()} />)
    expand()
    expect(blockAt(3)).toBeNull()
    expect(blocksContaining(SHARED)).toEqual([0])
  })

  it('the disclosure COUNT tells the truth about what it will reveal', () => {
    render(<InlineBlocks blocks={blocks()} />)
    // Two blocks were demoted; only one of them will render anything.
    expect(screen.getByTestId('block-detail-toggle').getAttribute('aria-label'))
      .toBe('Show 1 more supporting item')
    expand()
    expect(blockAt(4)!.textContent).toContain(DETAIL_ONLY)
  })

  it('no affordance at all when EVERY demoted block was emptied', () => {
    render(
      <InlineBlocks
        blocks={[
          reviewCard(1, SHARED),
          reviewCard(2, 'Unique review body 2'),
          reviewCard(3, 'Unique review body 3'),
          explanation(SHARED),
        ]}
      />,
    )
    // Nothing more to show, so nothing promises otherwise.
    expect(screen.queryByTestId('block-detail-toggle')).toBeNull()
    expect(blocksContaining(SHARED)).toEqual([0])
  })

  it('OPPOSITE DIRECTION — the same block with UNIQUE prose is kept and counted', () => {
    render(
      <InlineBlocks
        blocks={[
          reviewCard(1, SHARED),
          reviewCard(2, 'Unique review body 2'),
          reviewCard(3, 'Unique review body 3'),
          explanation(DETAIL_ONLY),
        ]}
      />,
    )
    const toggle = screen.getByTestId('block-detail-toggle')
    expect(toggle.getAttribute('aria-label')).toBe('Show 1 more supporting item')
    expand()
    expect(blockAt(3)!.textContent).toContain(DETAIL_ONLY)
  })
})

// ---------------------------------------------------------------------------
// 5b. v5_exercise — six optional prose fields and NO title of its own
// ---------------------------------------------------------------------------

/**
 * ⚠ Every `v5_exercise` is a lens companion (`isLensCompanionBlock`), so the
 * FIRST one in overflow is promoted into the point set. Two are needed to land
 * one in the disclosure — the composition fact this fixture depends on, stated
 * rather than discovered by a later reader.
 */
describe('v5_exercise, whose prose is all it has', () => {
  function exercise(id: string, fields: Partial<V5ExerciseBlock>): V5ExerciseBlock {
    return {
      type: 'v5_exercise', block_id: id, exercise_kind: 'pre_mortem',
      target_refs: [], freshness: 'fresh', ...fields,
    } as V5ExerciseBlock
  }

  it('loses only the repeated field and keeps the rest of the card', () => {
    render(
      <InlineBlocks
        blocks={[
          reviewCard(1, SHARED),
          reviewCard(2, 'Unique review body 2'),
          reviewCard(3, 'Unique review body 3'),
          exercise('ex_promoted', { failure_scenario: 'A promoted exercise scenario.' }),
          exercise('ex_demoted', { failure_scenario: SHARED, mitigation: DETAIL_ONLY }),
        ]}
      />,
    )
    expand()
    expect(blocksContaining(SHARED)).toEqual([0])
    expect(blockAt(4)!.textContent).toContain(DETAIL_ONLY)
  })

  it('is dropped when its ONLY prose field repeats — it has no title to keep', () => {
    render(
      <InlineBlocks
        blocks={[
          reviewCard(1, SHARED),
          reviewCard(2, 'Unique review body 2'),
          reviewCard(3, 'Unique review body 3'),
          exercise('ex_promoted', { failure_scenario: 'A promoted exercise scenario.' }),
          exercise('ex_demoted', { failure_scenario: SHARED }),
        ]}
      />,
    )
    expand()
    expect(blockAt(4)).toBeNull()
    expect(blocksContaining(SHARED)).toEqual([0])
  })
})

// ---------------------------------------------------------------------------
// 6. Tier 0 (the prose body above the blocks) reaches the disclosure too
// ---------------------------------------------------------------------------

describe('a demoted block does not repeat the turn prose rendered above it', () => {
  const blocks = (): ConversationBlock[] => [
    reviewCard(1, 'Unique review body 1'),
    reviewCard(2, 'Unique review body 2'),
    reviewCard(3, 'Unique review body 3'),
    coaching(1, SHARED),
  ]

  it('withholds a paragraph `alreadyRendered` says the message body showed', () => {
    render(<InlineBlocks blocks={blocks()} alreadyRendered={[SHARED]} />)
    expand()
    expect(blocksContaining(SHARED)).toEqual([])
    expect(blockAt(3)!.textContent).toContain('Coaching card 1')
  })

  it('OPPOSITE DIRECTION — with nothing rendered above, the block keeps it', () => {
    render(<InlineBlocks blocks={blocks()} />)
    expand()
    expect(blocksContaining(SHARED)).toEqual([3])
  })
})
