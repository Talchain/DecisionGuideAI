/**
 * Compact coaching lines — the coaching a turn carries is legible as a LIST
 * before it is legible as a wall.
 *
 * ## The defect, measured
 *
 * The panel's coaching content is good and it is buried. On the reported turn
 * the user reads ~150 words of producer narration, then meets three bordered
 * cards each carrying a category chip, a title, a body paragraph, an entity
 * chip and a disclosure — roughly two of which fill a tall narrow panel. The
 * fourth sits behind "Show 1 more".
 *
 * That is today's DRAFT turn. `messageComposition.ts` records the ANALYSIS
 * figure: 8–14 point candidates per turn, of which `MAX_POINTS = 3` are
 * top-level and 5–11 are demoted. So opening the disclosure on a real analysis
 * turn replaces one wall with a bigger one. A CEE lane is currently opening a
 * gate (`post-draft-narrative.ts`) that discards freeform coaching before it
 * reaches the panel on the 9-of-13 turns that are not `ready`, so the count on
 * NON-analysis turns is expected to rise toward the analysis figure too.
 *
 * ⭐ THIS FILE IS THEREFORE WRITTEN AGAINST THE HIGH COUNT, NOT THE SCREENSHOT.
 * The twelve-card arm below is the design case; the three-card arm is the
 * regression case. A spec that only ever built three cards would pass on a
 * mechanism that collapses nothing useful at the counts that actually hurt.
 *
 * ## What the mechanism may and may not do
 *
 * ⚠⚠ THE COMPACT LINE IS PRODUCER COPY, VERBATIM, OR IT DOES NOT RENDER.
 * `block.title` is rendered character-for-character — never summarised,
 * truncated, re-cased or paraphrased. The UI does not sanitise or shorten
 * server copy at the render boundary: doing so makes the wire and the screen
 * disagree, which is a worse defect than the one it hides. The assertions
 * below compare against the producer string in full, so a truncation of any
 * kind fails here.
 *
 * ⚠ FAIL CLOSED. A block with no `title`, or a blank one, renders EXPANDED
 * exactly as today. `v5_evidence` and `v5_exercise` carry no `title` field at
 * all (types.ts), so they are the live instance of this rule, not a
 * hypothetical.
 *
 * ⛔ PINNED BLOCKS NEVER COLLAPSE. `PINNED_BLOCK_TYPES` is graph patches,
 * proposals, held proposals, the analysis result and commentary. The first
 * three carry the user's CONSENT affordance; hiding the thing the user is
 * being asked to agree to behind a summary is a trust regression, not a
 * tidy-up. Pinned membership — not "is it a card" — is the gate.
 *
 * ## Instrument notes
 *
 * Every assertion binds by IDENTITY — the producer's own `block_id` or its own
 * title — never by position in a list or by a count a neighbour could satisfy
 * (trap 19). Each absence assertion has a positive control that fires, because
 * an absence assertion whose matcher is inert passes by testing nothing
 * (trap 13): the flag-off arm below IS that control, and it must show the
 * expanded body the collapsed arms assert is missing.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { InlineBlocks } from '../InlineBlocks'
import { MAX_POINTS } from '../messageComposition'
import type {
  ConversationBlock,
  GraphPatchBlock,
  V5CoachingBlock,
  V5EvidenceBlock,
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
 * The flag is read through the module boundary so the OFF arm can prove the
 * mechanism is genuinely gated rather than merely absent from a fixture.
 */
vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../flags')>()
  return { ...actual, isCompactCoachingLinesEnabled: () => flagState.enabled }
})
const flagState = { enabled: true }

beforeEach(() => { flagState.enabled = true })
afterEach(() => { flagState.enabled = true })

// ── Producer fixtures ───────────────────────────────────────────────────────
// Titles are the real strings from the reported turn, so a truncation defect
// shows up as the sentence the user actually lost.

const ANCHORING_TITLE = 'Anchoring'
const TECHNIQUE_TITLE = 'Give Pro Feature Release Quality a level'
const NARROW_TITLE = 'Narrow framing'

function coaching(
  n: number,
  over: Partial<V5CoachingBlock> = {},
): V5CoachingBlock {
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
    ...over,
  }
}

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

/** Carries NO `title` field at all — the live fail-closed instance. */
function evidence(n: number): V5EvidenceBlock {
  return {
    type: 'v5_evidence',
    block_id: `ev_${n}`,
    // `factor_label` is what this renderer actually puts on screen — checked at
    // V5EvidenceBlock.tsx rather than guessed, so the assertion below binds to
    // rendered output and not to a field the component ignores.
    factor_label: `Evidence factor ${n}`,
    current_confidence: 0.6,
    severity: 'info',
    target_refs: [],
    priority_rank: n,
    freshness: 'fresh',
  } as unknown as V5EvidenceBlock
}

function graphPatch(): GraphPatchBlock {
  return {
    type: 'graph_patch',
    patch_id: 'patch_consent_1',
    summary: 'Add a competitor-response factor',
    status: 'proposed',
    operations: [],
  } as unknown as GraphPatchBlock
}

const renderBlocks = (blocks: ConversationBlock[]) =>
  render(<InlineBlocks blocks={blocks} turnId="turn_1" patchBlockStates={new Map()} />)

/** The summary line for one producer block, found by that block's own id. */
const lineFor = (blockId: string) => screen.queryByTestId(`coaching-line-${blockId}`)

describe('the compact line is the producer’s own title, verbatim', () => {
  it('renders one line per coaching block, each carrying its title character-for-character', () => {
    renderBlocks([
      coaching(1, { block_id: 'co_narrow', title: NARROW_TITLE, category: 'should_fix' }),
      coaching(2, { block_id: 'co_tech', title: TECHNIQUE_TITLE, category: 'technique' }),
      coaching(3, { block_id: 'co_anchor', title: ANCHORING_TITLE, category: 'should_fix' }),
    ])

    // Bound by the producer's own block_id, never by index.
    expect(screen.getByTestId('coaching-line-summary-co_narrow')).toHaveTextContent(NARROW_TITLE)
    expect(screen.getByTestId('coaching-line-summary-co_tech')).toHaveTextContent(TECHNIQUE_TITLE)
    expect(screen.getByTestId('coaching-line-summary-co_anchor')).toHaveTextContent(ANCHORING_TITLE)
  })

  /**
   * ⭐ THE TRUNCATION GUARD. The longest real title is 40 characters and is
   * exactly the kind of string a "make it succinct" implementation would clip
   * to an ellipsis. Asserting the WHOLE string is what makes that a failure
   * rather than a style choice.
   */
  it('does not shorten, ellipsise or re-case a long producer title', () => {
    renderBlocks([coaching(1, { block_id: 'co_tech', title: TECHNIQUE_TITLE })])
    // Scoped to the SUMMARY: a closed <details> textContent includes the card
    // body, so checking the whole element would be testing producer prose too.
    const summary = screen.getByTestId('coaching-line-summary-co_tech')
    expect(summary.textContent).toContain(TECHNIQUE_TITLE)
    expect(summary.textContent).not.toContain('…')
    expect(summary.textContent).not.toContain('...')
  })

  it('shows the producer’s category chip when it sent one, and no chip when it did not', () => {
    renderBlocks([
      coaching(1, { block_id: 'co_withcat', category: 'should_fix' }),
      coaching(2, { block_id: 'co_nocat' }),
    ])
    expect(screen.getByTestId('coaching-line-summary-co_withcat')).toHaveTextContent('Should fix')
    // No fabricated tier for a block the producer left uncategorised.
    expect(screen.queryByTestId('coaching-line-category-co_nocat')).toBeNull()
    const uncategorised = screen.getByTestId('coaching-line-summary-co_nocat')
    for (const label of ['Must fix', 'Should fix', 'Could fix', 'Technique']) {
      expect(uncategorised).not.toHaveTextContent(label)
    }
  })
})

describe('collapsed by default, expandable to the full card', () => {
  it('hides the producer’s body until the line is opened, then reveals it', () => {
    renderBlocks([coaching(1, { block_id: 'co_anchor', title: ANCHORING_TITLE, body: 'Both price options are anchored upward from the current £49.' })])

    // ⚠ VISIBILITY, NOT DOM PRESENCE — and the difference is the whole point.
    // A closed native <details> keeps its children in the DOM (and hidden from
    // assistive technology). `toBeInTheDocument` would therefore be GREEN on a
    // mechanism that collapses nothing at all — the vacuous-absence failure.
    // jest-dom's `toBeVisible` understands <details>, so it is the assertion
    // that actually describes what the user sees.
    expect(screen.getByText(/anchored upward from the current/)).not.toBeVisible()

    fireEvent.click(within(lineFor('co_anchor')!).getByText(ANCHORING_TITLE))

    expect(screen.getByText(/anchored upward from the current/)).toBeVisible()
  })

  /**
   * ⭐ Opening ONE line must not open the others. A single shared piece of
   * state would pass every other arm in this file and fail here.
   */
  it('opens only the line the user clicked', () => {
    renderBlocks([
      coaching(1, { block_id: 'co_a', title: 'Alpha', body: 'ALPHA BODY' }),
      coaching(2, { block_id: 'co_b', title: 'Bravo', body: 'BRAVO BODY' }),
    ])
    fireEvent.click(within(lineFor('co_a')!).getByText('Alpha'))
    expect(screen.getByText('ALPHA BODY')).toBeVisible()
    expect(screen.getByText('BRAVO BODY')).not.toBeVisible()
  })

  /**
   * ⚠ KEYBOARD, AND WHY IT IS ASSERTED RATHER THAN ASSUMED. This estate has
   * shipped controls bound only to `onDoubleClick`, where Enter and Space
   * dispatch `click` and never `dblclick` — so the control had no keyboard
   * route at all. A native <summary> element cannot have that defect, and
   * this pins that a native one is what shipped.
   */
  it('the line is a native disclosure — keyboard-operable without a handler', () => {
    renderBlocks([coaching(1, { block_id: 'co_a', title: 'Alpha' })])
    const summary = within(lineFor('co_a')!).getByText('Alpha').closest('summary')
    expect(summary, 'the compact line must be a native <summary>').not.toBeNull()
    expect(summary!.parentElement?.tagName).toBe('DETAILS')
  })
})

describe('fail closed — a block with no title is never reduced to a blank line', () => {
  it('a block whose title is blank renders expanded, as it does today', () => {
    renderBlocks([coaching(1, { block_id: 'co_blank', title: '   ', body: 'BLANK TITLE BODY' })])
    expect(lineFor('co_blank')).toBeNull()
    expect(screen.getByText('BLANK TITLE BODY')).toBeVisible()
  })

  it('v5_evidence carries no title field at all, so it renders expanded', () => {
    renderBlocks([evidence(1)])
    expect(lineFor('ev_1')).toBeNull()
    expect(screen.getByText(/Evidence factor 1/)).toBeVisible()
  })
})

describe('a consent affordance is never collapsed', () => {
  /**
   * ⛔ The ruling this arm defends: demoting a consent control into a summary
   * hides the thing the user is being asked to agree to. `graph_patch` is
   * pinned, and pinned membership is the gate — not "is it a card".
   */
  it('a graph patch renders in full beside collapsed coaching lines', () => {
    renderBlocks([
      graphPatch(),
      coaching(1, { block_id: 'co_a', title: 'Alpha', body: 'ALPHA BODY' }),
    ])
    expect(lineFor('co_a')).not.toBeNull()
    expect(screen.queryByTestId('coaching-line-patch_consent_1')).toBeNull()
    expect(screen.getByText(/Add a competitor-response factor/)).toBeVisible()
  })
})

describe('the design case — a real analysis turn’s card count', () => {
  /**
   * ⭐⭐ TWELVE CARDS, WHICH IS THE MIDDLE OF THE MEASURED 8–14 RANGE.
   *
   * `MAX_POINTS = 3` stay top-level and nine are demoted behind the existing
   * "Show N more". The point of this arm is that opening that disclosure now
   * reveals nine LINES rather than nine walls — so the demoted tier is
   * collapsed too, not only the top three. An implementation that collapsed
   * only the top-level entries passes every arm above and fails here.
   */
  it('all twelve are lines — the three top-level ones and the nine behind Show more', () => {
    const blocks = Array.from({ length: 12 }, (_, i) =>
      coaching(i, { block_id: `co_${i}`, title: `Point ${i}` }),
    )
    renderBlocks(blocks)

    for (let i = 0; i < MAX_POINTS; i++) {
      expect(lineFor(`co_${i}`), `top-level card ${i} is not a line`).not.toBeNull()
    }

    fireEvent.click(screen.getByTestId('block-detail-toggle'))

    for (let i = MAX_POINTS; i < 12; i++) {
      expect(lineFor(`co_${i}`), `demoted card ${i} is not a line`).not.toBeNull()
    }
    // And every body is still closed — revealing the demoted tier reveals
    // titles, not twelve paragraphs.
    expect(screen.getByText('Coaching body 11')).not.toBeVisible()
  })

  it('the existing top-level cap is untouched — composition is not re-partitioned', () => {
    const blocks = Array.from({ length: 12 }, (_, i) =>
      coaching(i, { block_id: `co_${i}`, title: `Point ${i}` }),
    )
    renderBlocks(blocks)
    // The 4th candidate is demoted, exactly as before this change.
    expect(lineFor('co_3')).toBeNull()
    expect(screen.getByTestId('block-detail-toggle')).toBeInTheDocument()
  })
})

describe('the flag is a real kill switch (and the positive control for every absence above)', () => {
  /**
   * ⭐ THE POSITIVE CONTROL. Every "the body is not in the document" assertion
   * in this file passes trivially if the body never rendered for an unrelated
   * reason. With the flag off the SAME fixture must show the body — so the
   * matcher is proven to see what it claims to be checking for.
   */
  it('flag off ⇒ no lines, and the full card body renders as it does today', () => {
    flagState.enabled = false
    renderBlocks([coaching(1, { block_id: 'co_anchor', title: ANCHORING_TITLE, body: 'ANCHOR BODY' })])
    expect(lineFor('co_anchor')).toBeNull()
    expect(screen.getByText('ANCHOR BODY')).toBeVisible()
    expect(screen.getByText(ANCHORING_TITLE)).toBeVisible()
  })

  it('flag on ⇒ the same fixture collapses — the two arms genuinely differ', () => {
    renderBlocks([coaching(1, { block_id: 'co_anchor', title: ANCHORING_TITLE, body: 'ANCHOR BODY' })])
    expect(lineFor('co_anchor')).not.toBeNull()
    expect(screen.getByText('ANCHOR BODY')).not.toBeVisible()
  })
})

describe('a review card is a line too — the mechanism is not coaching-only', () => {
  it('v5_review_card collapses on its own producer title', () => {
    renderBlocks([reviewCard(1)])
    expect(lineFor('rc_1')).toHaveTextContent('Review card 1')
    expect(screen.getByText('Review body 1')).not.toBeVisible()
  })
})
