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
 * That is today's DRAFT turn. Analysis turns carry more: `phase3Pacing.ts`
 * records the phase-3 card counts on ONE walk's analysis turns as
 * `8, 8, 8, 11, 13, 14`. Of those, `MAX_POINTS = 3` are top-level and the rest
 * are demoted, so opening the disclosure on a real analysis turn replaces one
 * wall with a bigger one.
 *
 * ⚠ THAT IS n=6 — ONE CAPTURE, ONE PIPELINE VERSION. It is the only primary
 * record of the figure in this repo (`messageComposition.ts` quotes the same
 * six numbers; it is not a second measurement), it claims no distribution and
 * no upper bound, and a turn outside 8–14 contradicts nothing. It is cited
 * here only to justify building the twelve-card arm below — nothing in the
 * mechanism or in these assertions is tuned to the number.
 *
 * ⛔ An earlier revision of this header also cited "9 of 13 measured live turns"
 * for a CEE-lane gate on non-`ready` turns. WITHDRAWN — retracted by its own
 * author the same day as having no committed artefact. The counts above are a
 * separate, committed observation and are unaffected by that withdrawal.
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
 * ⚠ FAIL CLOSED. A block with no usable label, or a blank one, renders
 * EXPANDED exactly as today. `v5_exercise` is the live instance: it carries no
 * `title` field and no other label, so it cannot be reduced to a line.
 *
 * ⛔ `v5_evidence` IS NOT AN INSTANCE OF THIS RULE ANY MORE, and this header
 * said it was. It carries no `title` either, but it resolves through
 * `evidenceBlockTitle` — the card's own contract-§1.3 answer — so it collapses
 * like everything else. The arm below was corrected when that shipped; this
 * paragraph was not, and a header that contradicts its own arms is how the
 * next reader learns the wrong rule.
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
function evidence(n: number, over: Partial<Record<string, unknown>> = {}): V5EvidenceBlock {
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
    ...over,
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

  /**
   * ⛔ THIS ARM PINNED THE DEFECT, AND IS CORRECTED RATHER THAN DELETED.
   *
   * It read "v5_evidence carries no title field at all, so it renders
   * expanded" and passed for exactly the reason the feature was broken:
   * evidence blocks carry `factor_label`, not `title`, so they were the one
   * point-candidate family that could never collapse. Witnessed on deployed
   * staging — a turn whose coaching blocks were compact lines while two
   * evidence blocks rendered as full bordered walls above "Show 11 more", so
   * the list looked like it worked on one reply and not the next.
   *
   * A spec can encode a defect as an expectation, and this one did. What the
   * rule is actually FOR is that no block is ever reduced to a BLANK line;
   * that is pinned below, on a block carrying neither field.
   */
  it('v5_evidence collapses on its producer `factor_label`', () => {
    renderBlocks([evidence(1)])
    const line = lineFor('ev_1')
    expect(line, 'evidence must collapse like every other point candidate').not.toBeNull()
    expect(within(line!).getByText('Evidence factor 1')).toBeVisible()
  })

  it('a block carrying neither title nor factor_label still renders expanded', () => {
    renderBlocks([
      evidence(2, { block_id: 'ev_nolabel', factor_label: '   ', evidence_gap: 'NO LABEL BODY' }),
    ])
    expect(lineFor('ev_nolabel'), 'nothing usable to title a line with').toBeNull()
    expect(screen.getByText(/NO LABEL BODY/)).toBeVisible()
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
   * ⭐⭐ TWELVE CARDS, WHICH SITS INSIDE THE OBSERVED 8–14 SPREAD (n=6).
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

/**
 * ⚠ THIS BLOCK EXISTS BECAUSE A REVIEWER PROVED IT WAS MISSING, and the PR body
 * had claimed the opposite. The claim was "the glyph ... is pinned by a test".
 * It was pinned on the CARD — `evidenceSeverityGlyph.spec.tsx` asserts 13 glyph
 * classes, every one of them through `render(<V5EvidenceBlock …>)`. Nothing
 * asserted the glyph the collapsed LINE draws, so deleting the `isEvidence ?`
 * ternary at `CoachingLine.tsx` would have silently given every evidence line
 * the review card's `Lightbulb` — #1450 returning by a different door — with a
 * green suite.
 *
 * ⭐ THE DISCRIMINATOR IS SAME-SEVERITY, DIFFERENT-FAMILY, not a literal glyph
 * name. Both fixtures below are `severity: 'info'`, so the ONLY thing that can
 * make their glyphs differ is the block-type branch. An assertion that merely
 * checked "evidence draws Search" would still pass if the branch were replaced
 * by something that happened to return Search for everything; the paired
 * negative on each side is what makes the mutation observable.
 *
 * ⛔ ALL svgs in the summary are collected, not `querySelector('svg')`. That
 * returns the FIRST svg only, so a negative assertion written against it can
 * only fire after the positive one already has — a mistake made once in this
 * lane already (`evidenceSeverityGlyph.spec.tsx`, corrected there).
 */
const glyphClassesIn = (blockId: string): string =>
  Array.from(
    screen.getByTestId(`coaching-line-summary-${blockId}`).querySelectorAll('svg'),
  )
    .map((svg) => svg.getAttribute('class') ?? '')
    .join(' ')

describe('the collapsed LINE draws its own family’s glyph, not the other family’s', () => {
  it('an info evidence line draws Search — the magnifying glass, never the review card’s Lightbulb', () => {
    renderBlocks([evidence(1)])
    const classes = glyphClassesIn('ev_1')
    expect(classes, 'evidence is something to go and look at').toContain('lucide-search')
    expect(classes, 'a Lightbulb here is #1450 returning on the line').not.toContain(
      'lucide-lightbulb',
    )
  })

  it('an info review-card line draws Lightbulb — the contrast control at the SAME severity', () => {
    renderBlocks([reviewCard(1)])
    const classes = glyphClassesIn('rc_1')
    expect(classes, 'a review card at info is an idea to consider').toContain('lucide-lightbulb')
    expect(classes, 'the magnifying glass belongs to the evidence family').not.toContain(
      'lucide-search',
    )
  })

  it.each(['warning', 'critical'] as const)(
    'a %s evidence line escalates to AlertTriangle, as the card does',
    (severity) => {
      renderBlocks([evidence(9, { block_id: `ev_${severity}`, severity })])
      const classes = glyphClassesIn(`ev_${severity}`)
      expect(classes).toContain('lucide-alert-triangle')
      expect(classes, 'escalation must not fall back to the info glyph').not.toContain(
        'lucide-search',
      )
    },
  )
})
