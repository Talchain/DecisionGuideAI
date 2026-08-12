/**
 * PR3 follow-on — THE COACHING CARD CAN FINALLY TELL YOU ITS ADVICE IS OUT OF DATE.
 *
 * ## The defect this pins (guarantee theatre, this programme's named dominant class)
 *
 * `V5CoachingBlock` has shipped the sentence *"Your model has changed since this was
 * written — it may no longer apply."* since #644. **No execution path could ever
 * reach it.** The sentence is keyed on the producer's `freshness`, and:
 *
 *   - CEE stamps `freshness` at EMISSION time. Wire-measured 2026-08-12 across 13
 *     coaching blocks in 2 scenarios: `freshness` was `'fresh'` on **13/13**. It is
 *     never anything else on a block the user is about to read.
 *   - A rendered transcript block is IMMUTABLE. CEE cannot reach back and
 *     re-stamp a card the user is already looking at.
 *
 * So a user edits the model and keeps acting on coaching written for a model that
 * no longer exists, with nothing on screen saying so. A promise rendered in the
 * product that no code path can satisfy is worse than an absent one.
 *
 * ## What makes the fix possible, and why the comparison is safe
 *
 * CEE already puts BOTH halves on the wire:
 *   - the block's own `graph_hash_at_generation` (9/13 on the wire; preserved
 *     verbatim by the parser sidecar, and `useConversation.ts:4771` says it is kept
 *     "so consumers can read it directly" — until now none did);
 *   - the response's `analysis_ready.current_graph_hash`, parsed into the canvas
 *     store by `analysisFreshness.ts` as `currentGraphHash`.
 *
 * ⚠ THE CATEGORY ERROR THIS DELIBERATELY AVOIDS. `guidanceStore.ts` §2b states it
 * outright: the UI's own `generateGraphHash` is a DIFFERENT algorithm over different
 * inputs, and comparing a CEE hash against a UI hash is meaningless. This module
 * therefore compares **CEE's hash to CEE's hash, and nothing else**. That the two
 * are the same family is not assumed — it is MEASURED: in both captured scenarios
 * the coaching block's `graph_hash_at_generation`, the response's top-level
 * `graph_hash` and `analysis_ready.current_graph_hash` were byte-identical
 * (`0b9ba6ac328d8b50`; `94eefbc9b712082d`). Evidence:
 * `olumi-docs/PHASE0-EVIDENCE-2026-07-28/coaching-surface-2026-08-12/`.
 *
 * ## Render-time, not ingest-time
 *
 * At ingest the two hashes are always equal — that is exactly why the producer can
 * only ever say `fresh`. The comparison must therefore happen at RENDER time, on a
 * store subscription, so a card already on screen starts telling the truth the
 * moment the model moves underneath it. This is the same contract `TargetRefPill`
 * (already inside this very card) documents: "Resolution is render-time, not
 * ingest-time … a pill never points at a guess."
 *
 * ## Three states, and absence is never fresh
 *
 * The verdict reuses the estate's EXISTING vocabulary, `FreshnessDisplaySemantic`
 * ('current' | 'changed' | 'cannot_confirm'), whose own doc-comment states the rule
 * this must obey: "'changed' must never be claimed for a CEE-sourced 'unknown'".
 * A block with no hash, or a store with no CEE hash, is CANNOT-CONFIRM — never
 * silently fresh, never fabricated stale.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'

import { InlineBlocks } from '../../../canvas/conversation/InlineBlocks'
import { useCanvasStore } from '../../../canvas/store'
import { adaptTypedCoachingBlock } from '../../phase3TypedBlocks'
import type { V5CoachingBlock as V5CoachingBlockType } from '../../../canvas/conversation/types'

/** The exact sentence #644 shipped. Reused, never re-authored. */
const CHANGED_SENTENCE =
  'Your model has changed since this was written — it may no longer apply.'

/** CEE-shaped hashes, taken from the 2026-08-12 staging captures. */
const HASH_AT_GENERATION = '0b9ba6ac328d8b50'
const HASH_AFTER_EDIT = '94eefbc9b712082d'

const BLOCK_ID = '7e0855c7-d79d-5d16-9fee-19e68ece297d'

/**
 * A wire-shaped raw coaching block. Field-for-field the shape measured on
 * staging (`wire-leg3-analyse-raw.json`), including `freshness: 'fresh'` —
 * which is the whole point: this is what CEE actually sends.
 */
function rawCoaching(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: 'coaching',
    block_id: BLOCK_ID,
    title: 'An assumption to check',
    body: 'The link from Estimated Delivery Confidence to Build Delivery Failure assumes the current timeline holds.',
    coaching_kind: 'assumption_check',
    source: 'decision_review',
    target_refs: [],
    priority_rank: 101,
    freshness: 'fresh',
    category: 'could_fix',
    priority: 50,
    signal_code: 'ASSUMPTION_CHECK',
    graph_hash_at_generation: HASH_AT_GENERATION,
    ...overrides,
  }
}

/** Adapt through the REAL producer path, then mount through the REAL renderer. */
function renderThroughMountPath(raw: Record<string, unknown>): void {
  const adapted = adaptTypedCoachingBlock(raw)
  expect(adapted, 'fixture must adapt — a null here would make every assertion vacuous').not.toBeNull()
  render(<InlineBlocks blocks={[adapted as V5CoachingBlockType]} />)
}

/** Bind by IDENTITY: the card carrying THIS block_id, never "some card". */
function theCard(): HTMLElement {
  const card = document.querySelector(`[data-block-id="${BLOCK_ID}"]`)
  expect(card, 'the coaching card must be mounted by InlineBlocks case v5_coaching').not.toBeNull()
  return card as HTMLElement
}

/** Set the CEE-sourced current graph hash exactly as `analysisFreshness` stores it. */
function setCeeCurrentGraphHash(currentGraphHash: string | undefined): void {
  useCanvasStore.setState({
    analysisFreshness: currentGraphHash === undefined
      ? { freshness: 'fresh' }
      : { freshness: 'fresh', currentGraphHash },
    analysisFreshnessDirty: false,
  })
}

beforeEach(() => {
  useCanvasStore.setState({ analysisFreshness: null, analysisFreshnessDirty: false })
})

describe('coaching card currency — the model moved underneath the advice', () => {
  it('RED-FIRST: says the model has changed when CEE’s current hash differs from the block’s', () => {
    // The user was coached at HASH_AT_GENERATION, then edited; CEE now reports a
    // different current hash. At pristine this sentence is UNFIREABLE.
    setCeeCurrentGraphHash(HASH_AFTER_EDIT)
    renderThroughMountPath(rawCoaching())

    const notice = within(theCard()).getByTestId('v5-coaching-freshness')
    expect(notice).toHaveTextContent(CHANGED_SENTENCE)
    expect(theCard()).toHaveAttribute('data-currency', 'changed')
  })

  it('stays SILENT while the hashes agree — no "still current" noise on every card', () => {
    setCeeCurrentGraphHash(HASH_AT_GENERATION)
    renderThroughMountPath(rawCoaching())

    expect(within(theCard()).queryByTestId('v5-coaching-freshness')).toBeNull()
    expect(theCard()).toHaveAttribute('data-currency', 'current')
  })

  it('THE THIRD STATE: a block with no hash is CANNOT-CONFIRM — never stale, never silently fresh', () => {
    // 4 of 13 wire-measured coaching blocks carried no graph_hash_at_generation.
    setCeeCurrentGraphHash(HASH_AFTER_EDIT)
    const raw = rawCoaching()
    delete raw.graph_hash_at_generation
    renderThroughMountPath(raw)

    expect(theCard()).toHaveAttribute('data-currency', 'cannot_confirm')
    // It must NOT fabricate the change it cannot observe...
    expect(within(theCard()).queryByTestId('v5-coaching-freshness')).toBeNull()
    // ...and must NOT pass silently as current either: it says so in the depth layer.
    expect(within(theCard()).getByTestId('v5-coaching-currency-detail')).toBeInTheDocument()
  })

  it('CANNOT-CONFIRM when the store holds no CEE hash — absence is never a change', () => {
    setCeeCurrentGraphHash(undefined)
    renderThroughMountPath(rawCoaching())

    expect(theCard()).toHaveAttribute('data-currency', 'cannot_confirm')
    expect(within(theCard()).queryByTestId('v5-coaching-freshness')).toBeNull()
    expect(within(theCard()).getByTestId('v5-coaching-currency-detail')).toBeInTheDocument()
  })

  it('never states cannot-confirm once currency IS established', () => {
    setCeeCurrentGraphHash(HASH_AT_GENERATION)
    renderThroughMountPath(rawCoaching())
    expect(within(theCard()).queryByTestId('v5-coaching-currency-detail')).toBeNull()
  })

  it('the PRODUCER’s own verdict wins — a pending card is not overwritten by a derived "changed"', () => {
    // freshness is about GENERATION; currency is about the MODEL. When the
    // producer has said something, it is not ours to overwrite (trap 21: two
    // questions, one channel).
    setCeeCurrentGraphHash(HASH_AFTER_EDIT)
    renderThroughMountPath(rawCoaching({ freshness: 'pending' }))

    const notice = within(theCard()).getByTestId('v5-coaching-freshness')
    expect(notice).toHaveTextContent('This is still being written.')
    expect(notice).not.toHaveTextContent(CHANGED_SENTENCE)
  })

  it('renders the sentence ONCE when producer and derivation agree it is stale', () => {
    setCeeCurrentGraphHash(HASH_AFTER_EDIT)
    renderThroughMountPath(rawCoaching({ freshness: 'stale' }))

    expect(within(theCard()).getAllByTestId('v5-coaching-freshness')).toHaveLength(1)
    expect(within(theCard()).getByTestId('v5-coaching-freshness')).toHaveTextContent(CHANGED_SENTENCE)
  })
})

describe('adaptTypedCoachingBlock — graph_hash_at_generation carry', () => {
  it('carries the producer hash VERBATIM', () => {
    const adapted = adaptTypedCoachingBlock(rawCoaching())
    expect(adapted?.graph_hash_at_generation).toBe(HASH_AT_GENERATION)
  })

  it('OMITS the field when the producer sent none — never invents, never defaults', () => {
    const raw = rawCoaching()
    delete raw.graph_hash_at_generation
    const adapted = adaptTypedCoachingBlock(raw)
    expect(adapted).not.toBeNull()
    expect(adapted && 'graph_hash_at_generation' in adapted).toBe(false)
  })

  it('OMITS a non-string hash rather than coercing it', () => {
    const adapted = adaptTypedCoachingBlock(rawCoaching({ graph_hash_at_generation: 12345 }))
    expect(adapted).not.toBeNull()
    expect(adapted && 'graph_hash_at_generation' in adapted).toBe(false)
  })

  it('a missing hash never costs the CARD — the block still adapts', () => {
    const raw = rawCoaching()
    delete raw.graph_hash_at_generation
    expect(adaptTypedCoachingBlock(raw)).not.toBeNull()
  })
})
