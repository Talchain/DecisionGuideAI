/**
 * #670 EXTENSION — THE OTHER THREE HASH-CARRYING CARDS LEARN TO SAY THEIR
 * CONTENT IS OUT OF DATE.
 *
 * ## The witnessed gap this closes
 *
 * #670's own browser witness (`browser-witness-670-2026-08-12/WITNESS.md` §F1)
 * recorded, on a single superseded turn, `graph_hash_at_generation:
 * 535e857ac14881b5` carried by **4 review_card and 2 evidence blocks as well as
 * the 4 coaching blocks** — and in the DOM after the edit, 0 of 4 review cards
 * carried `data-currency` or the staleness sentence. Two "A load-bearing
 * assumption" review cards sat immediately above a coaching card that said it
 * was out of date, with identical content lineage and no notice of their own.
 * Same data, same surface, no sentence.
 *
 * ## The carrier domain (derived, not inherited — trap 22)
 *
 * All four Phase 3 typed block types carry the hash on the live wire:
 * coaching (#670, done), review_card, evidence, AND exercise (live fixtures
 * `live-analysis-turn-T3-20260808T155759Z.json` and
 * `live-analysis-turn-no-critiques-2026-08-08.json`, one hash-bearing exercise
 * each). At schemas 0.39.0 the field is REQUIRED on ReviewCardBlockSchema and
 * EvidenceBlockSchema and optional on CoachingBlockSchema and
 * ExerciseBlockSchema (`dist/boundary/blocks.d.ts:1074/1452/1184/1669`). The
 * adapters still treat it as optional: absence costs the VERDICT
 * (cannot-confirm), never the card — #670's witnessed discriminating control,
 * unchanged here.
 *
 * ## One authority, three new consumers, zero new sentences
 *
 * Every verdict below is `deriveCoachingCurrency` — imported, never copied —
 * fed through the single consumption seam (`useCoachingCurrency`) that also
 * feeds the coaching card, so no surface can drift on HOW the authority is
 * consulted (e.g. silently dropping the import-hold argument). The sentences
 * are #670's exact strings, now exported from `coachingCurrency.ts` rather
 * than duplicated per renderer: a copied sentence map is the same-named-twin
 * defect this estate keeps paying for (trap 12).
 *
 * The producer's verdict always wins where the block speaks for itself
 * (stale / pending / failed); the derivation fills SILENCE only (`fresh`,
 * which is what CEE stamps at emission on every block a user ever reads —
 * wire-measured 13/13 in #670).
 *
 * ## Binding discipline
 *
 * Every fixture is wire-shaped (field-for-field from the T3 capture), adapts
 * through the REAL producer path (`adaptTyped*Block`), mounts through the REAL
 * transcript renderer (`InlineBlocks`), and every assertion binds by IDENTITY
 * (`data-block-id`), never by a value predicate another card could satisfy
 * (trap 19).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, within } from '@testing-library/react'

import { InlineBlocks } from '../../../canvas/conversation/InlineBlocks'
import { useCanvasStore } from '../../../canvas/store'
import {
  classifyFreshnessForDisplay,
  type AnalysisFreshnessState,
} from '../../../canvas/store/analysisFreshness'
import {
  adaptTypedReviewCardBlock,
  adaptTypedEvidenceBlock,
  adaptTypedExerciseBlock,
} from '../../phase3TypedBlocks'
import type { ConversationBlock } from '../../../canvas/conversation/types'

/** The exact sentences #644 shipped and #670 made reachable. Reused, never re-authored. */
const CHANGED_SENTENCE =
  'Your model has changed since this was written — it may no longer apply.'
const PENDING_SENTENCE = 'This is still being written.'

/**
 * CEE-shaped hashes. HASH_AT_GENERATION is the exact hash the #670 browser
 * witness recorded on the superseded turn's review_card and evidence blocks;
 * HASH_AFTER_EDIT is the post-edit hash from the same session's captures.
 */
const HASH_AT_GENERATION = '535e857ac14881b5'
const HASH_AFTER_EDIT = '94eefbc9b712082d'
/** A third CEE-shaped value, for the "analysis ran on an older graph" twin. */
const HASH_AT_RUN = 'a1b2c3d4e5f60718'

const REVIEW_ID = '4440b6a7-f373-567c-8c4b-38f46328b785'
const EVIDENCE_ID = '73e31daf-8a42-5260-9c13-e209b70f70ba'
const EXERCISE_ID = 'c3683223-2330-5431-b911-fe01086f2ecf'
const COACHING_ID = '7e0855c7-d79d-5d16-9fee-19e68ece297d'

/** Wire-shaped raw blocks, field-for-field from live-analysis-turn-T3-20260808T155759Z.json. */
function rawReviewCard(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: 'review_card',
    block_id: REVIEW_ID,
    signal_id: 'review:narrative:27e97e8e072b8bec',
    created_at: '2026-08-08T15:59:37.262Z',
    source_handler: 'decision_review_enricher',
    card_kind: 'narrative',
    title: 'How the analysis reads',
    body: 'Pilot HubSpot with Sales Pod First leads by a substantial 56 percentage points, but the result depends on how user adoption unfolds in practice.',
    severity: 'info',
    target_refs: [],
    priority_rank: 10,
    freshness: 'fresh',
    graph_hash_at_generation: HASH_AT_GENERATION,
    ...overrides,
  }
}

function rawEvidence(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: 'evidence',
    block_id: EVIDENCE_ID,
    factor_label: 'User Adoption Uncertainty',
    current_confidence: 'medium',
    evidence_gap: 'Adoption rates have strong potential to swing the outcome.',
    suggested_technique: 'Survey or interview sales staff to estimate likely adoption.',
    impact_if_gathered: 'Estimate likely adoption before looking at external benchmarks.',
    priority_rank: 1,
    severity: 'info',
    freshness: 'fresh',
    target_refs: [
      { id: 'fac_adoption_risk', label: 'User Adoption Uncertainty', kind: 'factor' },
    ],
    graph_hash_at_generation: HASH_AT_GENERATION,
    ...overrides,
  }
}

function rawExercise(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: 'exercise',
    block_id: EXERCISE_ID,
    signal_id: 'exercise:consider_opposite:27e97e8e072b8bec',
    exercise_kind: 'consider_opposite',
    counter_case:
      'Take the opposite view for a moment: assume the option in front turns out to be the wrong choice.',
    freshness: 'fresh',
    target_refs: [
      { id: 'opt_phased', label: 'Pilot HubSpot with Sales Pod First', kind: 'option' },
    ],
    graph_hash_at_generation: HASH_AT_GENERATION,
    ...overrides,
  }
}

/** Mount through the REAL transcript renderer. */
function mount(blocks: ConversationBlock[]): void {
  render(<InlineBlocks blocks={blocks} />)
}

/** Bind by IDENTITY: the card carrying THIS block_id, never "some card". */
function theCard(blockId: string): HTMLElement {
  const card = document.querySelector(`[data-block-id="${blockId}"]`)
  expect(card, `a card with data-block-id=${blockId} must be mounted by InlineBlocks`).not.toBeNull()
  return card as HTMLElement
}

/** Set the CEE-sourced current graph hash exactly as `analysisFreshness` stores it. */
function setCeeCurrentGraphHash(currentGraphHash: string | undefined): void {
  useCanvasStore.setState({
    analysisFreshness:
      currentGraphHash === undefined
        ? { freshness: 'fresh' }
        : { freshness: 'fresh', currentGraphHash },
    analysisFreshnessDirty: false,
  })
}

/**
 * Install the dirty-window state AND return the shared authority's own reading
 * of it, so every dirty-window case pins its precondition (trap 13b): a fixture
 * that stopped reproducing the state it names fails on the precondition, not
 * passes by accident.
 */
function installDirtyWindow(
  state: AnalysisFreshnessState | null,
  opts: { dirty: boolean } = { dirty: true },
): 'current' | 'changed' | 'cannot_confirm' | 'none' {
  useCanvasStore.setState({
    analysisFreshness: state,
    analysisFreshnessDirty: opts.dirty,
    importPendingServerRegistration: false,
  })
  return classifyFreshnessForDisplay(state, opts.dirty, false)
}

beforeEach(() => {
  useCanvasStore.setState({
    analysisFreshness: null,
    analysisFreshnessDirty: false,
    importPendingServerRegistration: false,
  })
})

/**
 * The three surfaces share one behaviour contract, asserted per-surface below
 * (not in a loop over anonymous fixtures — each binding names its surface, its
 * adapter, its testid prefix and its block id, so a failure names the card).
 */

describe('review card currency — the model moved underneath the assumption', () => {
  const adapt = (raw: Record<string, unknown>) => {
    const adapted = adaptTypedReviewCardBlock(raw)
    expect(adapted, 'fixture must adapt — a null here would make every assertion vacuous').not.toBeNull()
    return adapted as ConversationBlock
  }

  it('RED-FIRST: says the model has changed when CEE’s current hash differs from the block’s', () => {
    setCeeCurrentGraphHash(HASH_AFTER_EDIT)
    mount([adapt(rawReviewCard())])

    const notice = within(theCard(REVIEW_ID)).getByTestId('v5-review-card-freshness')
    expect(notice).toHaveTextContent(CHANGED_SENTENCE)
    expect(theCard(REVIEW_ID)).toHaveAttribute('data-currency', 'changed')
  })

  it('stays SILENT while the hashes agree — no "still current" noise', () => {
    setCeeCurrentGraphHash(HASH_AT_GENERATION)
    mount([adapt(rawReviewCard())])

    expect(within(theCard(REVIEW_ID)).queryByTestId('v5-review-card-freshness')).toBeNull()
    expect(theCard(REVIEW_ID)).toHaveAttribute('data-currency', 'current')
  })

  it('a hash-less block is CANNOT-CONFIRM — never stale, never silently fresh (the witnessed control)', () => {
    setCeeCurrentGraphHash(HASH_AFTER_EDIT)
    const raw = rawReviewCard()
    delete raw.graph_hash_at_generation
    mount([adapt(raw)])

    expect(theCard(REVIEW_ID)).toHaveAttribute('data-currency', 'cannot_confirm')
    expect(within(theCard(REVIEW_ID)).queryByTestId('v5-review-card-freshness')).toBeNull()
  })

  it('CANNOT-CONFIRM when the store holds no CEE hash — absence is never a change', () => {
    setCeeCurrentGraphHash(undefined)
    mount([adapt(rawReviewCard())])

    expect(theCard(REVIEW_ID)).toHaveAttribute('data-currency', 'cannot_confirm')
    expect(within(theCard(REVIEW_ID)).queryByTestId('v5-review-card-freshness')).toBeNull()
  })

  it('the PRODUCER’s own verdict wins — a pending card is not overwritten by a derived "changed"', () => {
    setCeeCurrentGraphHash(HASH_AFTER_EDIT)
    mount([adapt(rawReviewCard({ freshness: 'pending' }))])

    const notice = within(theCard(REVIEW_ID)).getByTestId('v5-review-card-freshness')
    expect(notice).toHaveTextContent(PENDING_SENTENCE)
    expect(notice).not.toHaveTextContent(CHANGED_SENTENCE)
  })

  it('renders the sentence ONCE when producer and derivation agree it is stale', () => {
    setCeeCurrentGraphHash(HASH_AFTER_EDIT)
    mount([adapt(rawReviewCard({ freshness: 'stale' }))])

    expect(within(theCard(REVIEW_ID)).getAllByTestId('v5-review-card-freshness')).toHaveLength(1)
    expect(within(theCard(REVIEW_ID)).getByTestId('v5-review-card-freshness')).toHaveTextContent(
      CHANGED_SENTENCE,
    )
  })

  it('THE DIRTY WINDOW fills on this surface too: agreeing hashes + a local edit ⇒ changed', () => {
    const semantic = installDirtyWindow(
      { freshness: 'fresh', currentGraphHash: HASH_AT_GENERATION },
      { dirty: true },
    )
    expect(semantic, 'precondition: the shared authority must read this state as changed').toBe('changed')

    mount([adapt(rawReviewCard())])

    expect(theCard(REVIEW_ID)).toHaveAttribute('data-currency', 'changed')
    expect(within(theCard(REVIEW_ID)).getByTestId('v5-review-card-freshness')).toHaveTextContent(
      CHANGED_SENTENCE,
    )
  })

  it('OPPOSITE-DIRECTION TWIN: a CEE-stated stale analysis with NO local edit leaves the card alone', () => {
    const semantic = installDirtyWindow(
      { freshness: 'stale', graphHashAtRun: HASH_AT_RUN, currentGraphHash: HASH_AT_GENERATION },
      { dirty: false },
    )
    expect(semantic, 'precondition: the authority must say CHANGED here, or this test proves nothing').toBe('changed')

    mount([adapt(rawReviewCard())])

    expect(theCard(REVIEW_ID)).toHaveAttribute('data-currency', 'current')
    expect(within(theCard(REVIEW_ID)).queryByTestId('v5-review-card-freshness')).toBeNull()
  })
})

describe('evidence block currency — the model moved underneath the evidence gap', () => {
  const adapt = (raw: Record<string, unknown>) => {
    const adapted = adaptTypedEvidenceBlock(raw)
    expect(adapted, 'fixture must adapt — a null here would make every assertion vacuous').not.toBeNull()
    return adapted as ConversationBlock
  }

  it('RED-FIRST: says the model has changed when CEE’s current hash differs from the block’s', () => {
    setCeeCurrentGraphHash(HASH_AFTER_EDIT)
    mount([adapt(rawEvidence())])

    const notice = within(theCard(EVIDENCE_ID)).getByTestId('v5-evidence-freshness')
    expect(notice).toHaveTextContent(CHANGED_SENTENCE)
    expect(theCard(EVIDENCE_ID)).toHaveAttribute('data-currency', 'changed')
  })

  it('stays SILENT while the hashes agree', () => {
    setCeeCurrentGraphHash(HASH_AT_GENERATION)
    mount([adapt(rawEvidence())])

    expect(within(theCard(EVIDENCE_ID)).queryByTestId('v5-evidence-freshness')).toBeNull()
    expect(theCard(EVIDENCE_ID)).toHaveAttribute('data-currency', 'current')
  })

  it('a hash-less block is CANNOT-CONFIRM (the witnessed control)', () => {
    setCeeCurrentGraphHash(HASH_AFTER_EDIT)
    const raw = rawEvidence()
    delete raw.graph_hash_at_generation
    mount([adapt(raw)])

    expect(theCard(EVIDENCE_ID)).toHaveAttribute('data-currency', 'cannot_confirm')
    expect(within(theCard(EVIDENCE_ID)).queryByTestId('v5-evidence-freshness')).toBeNull()
  })

  it('CANNOT-CONFIRM when the store holds no CEE hash', () => {
    setCeeCurrentGraphHash(undefined)
    mount([adapt(rawEvidence())])

    expect(theCard(EVIDENCE_ID)).toHaveAttribute('data-currency', 'cannot_confirm')
    expect(within(theCard(EVIDENCE_ID)).queryByTestId('v5-evidence-freshness')).toBeNull()
  })

  it('the PRODUCER’s own verdict wins — pending is not overwritten by a derived "changed"', () => {
    setCeeCurrentGraphHash(HASH_AFTER_EDIT)
    mount([adapt(rawEvidence({ freshness: 'pending' }))])

    const notice = within(theCard(EVIDENCE_ID)).getByTestId('v5-evidence-freshness')
    expect(notice).toHaveTextContent(PENDING_SENTENCE)
    expect(notice).not.toHaveTextContent(CHANGED_SENTENCE)
  })

  it('renders the sentence ONCE when producer and derivation agree it is stale', () => {
    setCeeCurrentGraphHash(HASH_AFTER_EDIT)
    mount([adapt(rawEvidence({ freshness: 'stale' }))])

    expect(within(theCard(EVIDENCE_ID)).getAllByTestId('v5-evidence-freshness')).toHaveLength(1)
  })

  it('THE DIRTY WINDOW fills on this surface too', () => {
    const semantic = installDirtyWindow(
      { freshness: 'fresh', currentGraphHash: HASH_AT_GENERATION },
      { dirty: true },
    )
    expect(semantic, 'precondition: the shared authority must read this state as changed').toBe('changed')

    mount([adapt(rawEvidence())])

    expect(theCard(EVIDENCE_ID)).toHaveAttribute('data-currency', 'changed')
    expect(within(theCard(EVIDENCE_ID)).getByTestId('v5-evidence-freshness')).toHaveTextContent(
      CHANGED_SENTENCE,
    )
  })
})

describe('exercise card currency — the model moved underneath the exercise', () => {
  const adapt = (raw: Record<string, unknown>) => {
    const adapted = adaptTypedExerciseBlock(raw)
    expect(adapted, 'fixture must adapt — a null here would make every assertion vacuous').not.toBeNull()
    return adapted as ConversationBlock
  }

  it('RED-FIRST: says the model has changed when CEE’s current hash differs from the block’s', () => {
    setCeeCurrentGraphHash(HASH_AFTER_EDIT)
    mount([adapt(rawExercise())])

    const notice = within(theCard(EXERCISE_ID)).getByTestId('v5-exercise-freshness')
    expect(notice).toHaveTextContent(CHANGED_SENTENCE)
    expect(theCard(EXERCISE_ID)).toHaveAttribute('data-currency', 'changed')
  })

  it('stays SILENT while the hashes agree', () => {
    setCeeCurrentGraphHash(HASH_AT_GENERATION)
    mount([adapt(rawExercise())])

    expect(within(theCard(EXERCISE_ID)).queryByTestId('v5-exercise-freshness')).toBeNull()
    expect(theCard(EXERCISE_ID)).toHaveAttribute('data-currency', 'current')
  })

  it('a hash-less block is CANNOT-CONFIRM (the witnessed control)', () => {
    setCeeCurrentGraphHash(HASH_AFTER_EDIT)
    const raw = rawExercise()
    delete raw.graph_hash_at_generation
    mount([adapt(raw)])

    expect(theCard(EXERCISE_ID)).toHaveAttribute('data-currency', 'cannot_confirm')
    expect(within(theCard(EXERCISE_ID)).queryByTestId('v5-exercise-freshness')).toBeNull()
  })

  it('the PRODUCER’s own verdict wins — pending is not overwritten by a derived "changed"', () => {
    setCeeCurrentGraphHash(HASH_AFTER_EDIT)
    mount([adapt(rawExercise({ freshness: 'pending' }))])

    const notice = within(theCard(EXERCISE_ID)).getByTestId('v5-exercise-freshness')
    expect(notice).toHaveTextContent(PENDING_SENTENCE)
    expect(notice).not.toHaveTextContent(CHANGED_SENTENCE)
  })

  it('THE DIRTY WINDOW fills on this surface too', () => {
    const semantic = installDirtyWindow(
      { freshness: 'fresh', currentGraphHash: HASH_AT_GENERATION },
      { dirty: true },
    )
    expect(semantic, 'precondition: the shared authority must read this state as changed').toBe('changed')

    mount([adapt(rawExercise())])

    expect(theCard(EXERCISE_ID)).toHaveAttribute('data-currency', 'changed')
    expect(within(theCard(EXERCISE_ID)).getByTestId('v5-exercise-freshness')).toHaveTextContent(
      CHANGED_SENTENCE,
    )
  })
})

describe('the witnessed scene — review cards and a coaching card on one superseded turn', () => {
  it('every hash-bearing card on the turn tells the same truth after the model moves', async () => {
    // The exact A1-03 scene: review cards above a coaching card, one content
    // lineage. After the edit, ALL of them must carry the sentence — not just
    // the coaching card.
    const { adaptTypedCoachingBlock } = await import('../../phase3TypedBlocks')
    const coaching = adaptTypedCoachingBlock({
      type: 'coaching',
      block_id: COACHING_ID,
      title: 'An assumption to check',
      body: 'The link assumes the current timeline holds.',
      coaching_kind: 'assumption_check',
      source: 'decision_review',
      target_refs: [],
      priority_rank: 101,
      freshness: 'fresh',
      graph_hash_at_generation: HASH_AT_GENERATION,
    })
    expect(coaching).not.toBeNull()
    const review = adaptTypedReviewCardBlock(rawReviewCard())
    expect(review).not.toBeNull()

    setCeeCurrentGraphHash(HASH_AFTER_EDIT)
    mount([review as ConversationBlock, coaching as ConversationBlock])

    expect(theCard(REVIEW_ID)).toHaveAttribute('data-currency', 'changed')
    expect(theCard(COACHING_ID)).toHaveAttribute('data-currency', 'changed')
    expect(within(theCard(REVIEW_ID)).getByTestId('v5-review-card-freshness')).toHaveTextContent(
      CHANGED_SENTENCE,
    )
    expect(within(theCard(COACHING_ID)).getByTestId('v5-coaching-freshness')).toHaveTextContent(
      CHANGED_SENTENCE,
    )
  })
})

describe('adapter carry — graph_hash_at_generation rides verbatim or not at all', () => {
  it('adaptTypedReviewCardBlock carries the producer hash VERBATIM', () => {
    const adapted = adaptTypedReviewCardBlock(rawReviewCard())
    expect(adapted?.graph_hash_at_generation).toBe(HASH_AT_GENERATION)
  })

  it('adaptTypedReviewCardBlock OMITS the field when the producer sent none — never invents', () => {
    const raw = rawReviewCard()
    delete raw.graph_hash_at_generation
    const adapted = adaptTypedReviewCardBlock(raw)
    expect(adapted).not.toBeNull()
    expect(adapted && 'graph_hash_at_generation' in adapted).toBe(false)
  })

  it('adaptTypedReviewCardBlock OMITS a non-string hash rather than coercing it', () => {
    const adapted = adaptTypedReviewCardBlock(rawReviewCard({ graph_hash_at_generation: 12345 }))
    expect(adapted).not.toBeNull()
    expect(adapted && 'graph_hash_at_generation' in adapted).toBe(false)
  })

  it('a missing hash never costs the review CARD — the block still adapts', () => {
    const raw = rawReviewCard()
    delete raw.graph_hash_at_generation
    expect(adaptTypedReviewCardBlock(raw)).not.toBeNull()
  })

  it('adaptTypedEvidenceBlock carries the producer hash VERBATIM', () => {
    const adapted = adaptTypedEvidenceBlock(rawEvidence())
    expect(adapted?.graph_hash_at_generation).toBe(HASH_AT_GENERATION)
  })

  it('adaptTypedEvidenceBlock OMITS the field when the producer sent none', () => {
    const raw = rawEvidence()
    delete raw.graph_hash_at_generation
    const adapted = adaptTypedEvidenceBlock(raw)
    expect(adapted).not.toBeNull()
    expect(adapted && 'graph_hash_at_generation' in adapted).toBe(false)
  })

  it('adaptTypedEvidenceBlock OMITS a non-string hash rather than coercing it', () => {
    const adapted = adaptTypedEvidenceBlock(rawEvidence({ graph_hash_at_generation: 12345 }))
    expect(adapted).not.toBeNull()
    expect(adapted && 'graph_hash_at_generation' in adapted).toBe(false)
  })

  it('adaptTypedExerciseBlock carries the producer hash VERBATIM', () => {
    const adapted = adaptTypedExerciseBlock(rawExercise())
    expect(adapted?.graph_hash_at_generation).toBe(HASH_AT_GENERATION)
  })

  it('adaptTypedExerciseBlock OMITS the field when the producer sent none', () => {
    const raw = rawExercise()
    delete raw.graph_hash_at_generation
    const adapted = adaptTypedExerciseBlock(raw)
    expect(adapted).not.toBeNull()
    expect(adapted && 'graph_hash_at_generation' in adapted).toBe(false)
  })

  it('adaptTypedExerciseBlock OMITS a non-string hash rather than coercing it', () => {
    const adapted = adaptTypedExerciseBlock(rawExercise({ graph_hash_at_generation: 12345 }))
    expect(adapted).not.toBeNull()
    expect(adapted && 'graph_hash_at_generation' in adapted).toBe(false)
  })
})
