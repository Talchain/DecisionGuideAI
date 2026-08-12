/**
 * PR3 follow-on to #670 — THE DIRTY WINDOW, WHERE THE COACHING CARD WENT QUIET.
 *
 * ## The gap #670 left open
 *
 * #670 made the card able to say its advice is out of date, by comparing two
 * CEE-produced hashes: the block's `graph_hash_at_generation` against
 * `analysis_ready.current_graph_hash`. Both are stamped SERVER-SIDE. Neither
 * moves when the user edits the model locally — so between an analysis-affecting
 * local edit and the next turn that carries an `analysis_ready`, the two hashes
 * still agree and the card resolves `current` and says NOTHING, while every
 * neighbouring surface (`V7FreshnessStrip`, `AnalysisFreshnessNotice`,
 * `DecisionConfidencePanel`, `StrengthenContainer`, `ReanalyseBar`) has already
 * downgraded off the local dirty overlay. The card is the one surface still
 * telling the user the advice is about the model they have.
 *
 * The whole #670 spec suite sets `analysisFreshnessDirty: false` — in every
 * single case — so this window was untested as well as unhandled.
 *
 * ## ONE authority, consulted; not a second one invented
 *
 * The dirtiness input is NOT re-derived here. It is
 * `classifyFreshnessForDisplay(analysisFreshness, analysisFreshnessDirty,
 * importPendingServerRegistration)` — byte-for-byte the call `V7FreshnessStrip
 * .tsx:49` makes. Two authorities answering "is the analysis stale?" under one
 * name is this estate's most expensive defect class (CLAUDE.md trap 21), so the
 * card BORROWS the strip's answer rather than computing its own.
 *
 * ⚠ "BYTE-FOR-BYTE" IS EXACT FOR THE STRIP ONLY. `AnalysisFreshnessNotice.tsx:98`
 * and `useAnalysisTrust.ts:94` first apply `resolveTrustEffectiveState(state,
 * orphaned)` — the ORPHAN FOLD, which synthesises `{freshness:'unknown',
 * ORPHANED_RESULT}` when a result is orphaned and the verdict is null or 'none'.
 * The card does not, so there is one reachable cell where they diverge: an
 * ORPHANED result + a 'none'/absent verdict + a matching hash + a dirty overlay
 * gives those two `cannot_confirm` while the card stays SILENT (its hashes agree
 * and the authority it consulted returned 'none', which fills nothing).
 * Deliberately left: silence is the SAFE direction — the card withholds a claim
 * rather than making a false one — and folding orphan-ness into a coaching card
 * would make it answer a third question. Recorded so the divergence is known
 * rather than discovered.
 *
 * ## And the borrowing is GATED, because the two questions are still different
 *
 * `classifyFreshnessForDisplay` answers *"is the ANALYSIS current?"*; the card
 * asks *"is this advice still about the model you have?"*. They come apart: a
 * CEE-STATED `'stale'` verdict with NO local edit means the analysis ran on an
 * older graph while the card was written about the current one — the analysis is
 * stale and the card is fine. So the borrow fires ONLY while the local dirty
 * overlay is set, which is precisely the first-hand client fact "the model moved
 * after the last `analysis_ready`" — the one fact the two CEE hashes cannot see.
 * The opposite-direction twin for every fill case is pinned below (trap 22b).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, within } from '@testing-library/react'

import { InlineBlocks } from '../../../canvas/conversation/InlineBlocks'
import { useCanvasStore } from '../../../canvas/store'
import {
  classifyFreshnessForDisplay,
  type AnalysisFreshnessState,
} from '../../../canvas/store/analysisFreshness'
import { generateGraphHash } from '../../../canvas/utils/graphHash'
import { adaptTypedCoachingBlock } from '../../phase3TypedBlocks'
import { deriveCoachingCurrency } from '../coachingCurrency'
import type { V5CoachingBlock as V5CoachingBlockType } from '../../../canvas/conversation/types'

/** The exact sentence #644 shipped. Reused, never re-authored. */
const CHANGED_SENTENCE =
  'Your model has changed since this was written — it may no longer apply.'

/** CEE-shaped hashes, taken from the 2026-08-12 staging captures. */
const HASH_AT_GENERATION = '0b9ba6ac328d8b50'
const HASH_AFTER_EDIT = '94eefbc9b712082d'
/** A third CEE-shaped value, for the "analysis ran on an older graph" case. */
const HASH_AT_RUN = 'a1b2c3d4e5f60718'

const BLOCK_ID = '7e0855c7-d79d-5d16-9fee-19e68ece297d'

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

/**
 * Install the freshness slice, the dirty overlay and the import hold together —
 * the three inputs the shared authority takes — and RETURN what that authority
 * says about them. Every test below asserts the returned value, so each case
 * PINS ITS OWN PRECONDITION (trap 13b): a fixture that stopped reproducing the
 * state it names would fail on the precondition, not pass by accident.
 */
function installFreshness(
  state: AnalysisFreshnessState | null,
  opts: { dirty: boolean; importHold?: boolean } = { dirty: false },
): 'current' | 'changed' | 'cannot_confirm' | 'none' {
  const importHold = opts.importHold === true
  useCanvasStore.setState({
    analysisFreshness: state,
    analysisFreshnessDirty: opts.dirty,
    importPendingServerRegistration: importHold,
  })
  return classifyFreshnessForDisplay(state, opts.dirty, importHold)
}

beforeEach(() => {
  useCanvasStore.setState({
    analysisFreshness: null,
    analysisFreshnessDirty: false,
    importPendingServerRegistration: false,
    nodes: [],
    edges: [],
  })
})

describe('the dirty window — a local edit the two CEE hashes cannot see', () => {
  it('RED-FIRST: says the model has changed when the hashes still agree but the model has locally moved', () => {
    // The exact window: CEE last said 'fresh' about THIS graph, the card was
    // written about it too, and the user has since made an analysis-affecting
    // edit. Both hashes are server-stamped, so both still read HASH_AT_GENERATION.
    const semantic = installFreshness(
      { freshness: 'fresh', currentGraphHash: HASH_AT_GENERATION },
      { dirty: true },
    )
    expect(semantic, 'precondition: the shared authority must read this state as changed').toBe('changed')

    renderThroughMountPath(rawCoaching())

    expect(theCard()).toHaveAttribute('data-currency', 'changed')
    expect(within(theCard()).getByTestId('v5-coaching-freshness')).toHaveTextContent(CHANGED_SENTENCE)
  })

  it('RED-FIRST: a readiness-only analysis_ready that STILL CARRIES a hash reads as changed, exactly as the strip reads it', () => {
    // Scoped deliberately to this cell. The card does NOT agree with the strip
    // everywhere and must not claim to: where the payload carries no
    // `current_graph_hash` at all, the strip says 'changed' and the card says
    // cannot-confirm, because the card's own question needs a hash to answer and
    // it will not borrow past that. This case is the one where both inputs are
    // present, so agreement is the correct outcome and is asserted directly
    // rather than left to two derivations happening to match.
    const semantic = installFreshness(
      { freshness: 'unknown', freshnessReason: 'payload_carried_no_freshness_verdict', currentGraphHash: HASH_AT_GENERATION },
      { dirty: true },
    )
    expect(semantic, 'precondition: a readiness-only analysis_ready plus a local edit reads as changed').toBe('changed')

    renderThroughMountPath(rawCoaching())

    expect(theCard()).toHaveAttribute('data-currency', 'changed')
  })

  it('OPPOSITE-DIRECTION TWIN: a CEE-stated stale analysis with NO local edit leaves the card alone', () => {
    // The two questions come apart here, and this is the case that forbids
    // consuming the authority's verdict ungated. CEE ran the analysis on
    // HASH_AT_RUN and reports the current graph as HASH_AT_GENERATION — the
    // ANALYSIS is stale, the CARD was written about the model the user has.
    const semantic = installFreshness(
      { freshness: 'stale', graphHashAtRun: HASH_AT_RUN, currentGraphHash: HASH_AT_GENERATION },
      { dirty: false },
    )
    expect(semantic, 'precondition: the authority must say CHANGED here, or this test proves nothing').toBe('changed')

    renderThroughMountPath(rawCoaching())

    // ...and the card must still be silent: its advice IS about the current model.
    expect(theCard()).toHaveAttribute('data-currency', 'current')
    expect(within(theCard()).queryByTestId('v5-coaching-freshness')).toBeNull()
  })

  it('an IMPORT HOLD is never dressed up as "you changed the model" — cannot-confirm, never changed', () => {
    // Interim 2.467: under a hold the dirty overlay is held by the mitigation,
    // not by a user edit, and the identity match is coarse enough to fire on the
    // GENUINE server graph. Asserting "your model has changed" there is a false
    // claim that trains users to ignore the warning that matters.
    const semantic = installFreshness(
      { freshness: 'fresh', currentGraphHash: HASH_AT_GENERATION },
      { dirty: true, importHold: true },
    )
    expect(semantic, 'precondition: the hold must read as cannot-confirm').toBe('cannot_confirm')

    renderThroughMountPath(rawCoaching())

    expect(theCard()).toHaveAttribute('data-currency', 'cannot_confirm')
    expect(within(theCard()).queryByTestId('v5-coaching-freshness')).toBeNull()
    expect(within(theCard()).getByTestId('v5-coaching-currency-detail')).toBeInTheDocument()
  })

  it('the HASH verdict still wins where it speaks — a differing hash is changed, overlay or not', () => {
    installFreshness({ freshness: 'fresh', currentGraphHash: HASH_AFTER_EDIT }, { dirty: true })
    renderThroughMountPath(rawCoaching())
    expect(theCard()).toHaveAttribute('data-currency', 'changed')
  })

  it('the overlay never UPGRADES cannot-confirm — a block with no hash stays unanswerable', () => {
    // 4 of 13 wire-measured blocks carried no graph_hash_at_generation. A local
    // edit proves the MODEL moved; it says nothing about whether this card was
    // written before or after that edit, so the question stays unanswerable.
    const semantic = installFreshness(
      { freshness: 'fresh', currentGraphHash: HASH_AT_GENERATION },
      { dirty: true },
    )
    expect(semantic).toBe('changed')

    const raw = rawCoaching()
    delete raw.graph_hash_at_generation
    renderThroughMountPath(raw)

    expect(theCard()).toHaveAttribute('data-currency', 'cannot_confirm')
    expect(within(theCard()).queryByTestId('v5-coaching-freshness')).toBeNull()
    expect(within(theCard()).getByTestId('v5-coaching-currency-detail')).toBeInTheDocument()
  })

  it('the PRODUCER’s verdict still wins inside the window — a pending card is not overwritten', () => {
    installFreshness({ freshness: 'fresh', currentGraphHash: HASH_AT_GENERATION }, { dirty: true })
    renderThroughMountPath(rawCoaching({ freshness: 'pending' }))

    const notice = within(theCard()).getByTestId('v5-coaching-freshness')
    expect(notice).toHaveTextContent('This is still being written.')
    expect(notice).not.toHaveTextContent(CHANGED_SENTENCE)
  })
})

describe('deriveCoachingCurrency — the gate, at the unit', () => {
  it('with no local-edit reading at all, the hash comparison is unchanged', () => {
    expect(deriveCoachingCurrency(HASH_AT_GENERATION, HASH_AT_GENERATION)).toBe('current')
    expect(deriveCoachingCurrency(HASH_AT_GENERATION, HASH_AFTER_EDIT)).toBe('changed')
    expect(deriveCoachingCurrency(undefined, HASH_AFTER_EDIT)).toBe('cannot_confirm')
  })

  it('the gate is the DIRTY OVERLAY, not the verdict — a clean overlay borrows nothing', () => {
    expect(
      deriveCoachingCurrency(HASH_AT_GENERATION, HASH_AT_GENERATION, {
        dirty: false,
        displaySemantic: 'changed',
      }),
    ).toBe('current')
  })

  it('a borrowed verdict of "none" fills nothing — silence is not evidence', () => {
    expect(
      deriveCoachingCurrency(HASH_AT_GENERATION, HASH_AT_GENERATION, {
        dirty: true,
        displaySemantic: 'none',
      }),
    ).toBe('current')
  })

  it('fills the silence with changed, and with cannot-confirm, exactly as the authority read it', () => {
    expect(
      deriveCoachingCurrency(HASH_AT_GENERATION, HASH_AT_GENERATION, {
        dirty: true,
        displaySemantic: 'changed',
      }),
    ).toBe('changed')
    expect(
      deriveCoachingCurrency(HASH_AT_GENERATION, HASH_AT_GENERATION, {
        dirty: true,
        displaySemantic: 'cannot_confirm',
      }),
    ).toBe('cannot_confirm')
  })
})

/**
 * THE PROVENANCE PIN — the discriminating pair the module header used to claim
 * "the mutant kit pins it".
 *
 * `coachingCurrency.ts` warned that the one way to break the comparison is to
 * pass a UI-side `generateGraphHash` as either argument, and asserted that a
 * mutant kit held that mutant. No such kit exists in this repository — a mutant
 * kit is run in a throwaway worktree and leaves nothing behind, so the claim was
 * unverifiable by construction (CLAUDE.md trap 12: a mirror nobody derives).
 * These two cases are the executable form of the same guarantee, and they pin
 * DIFFERENT halves of it — measured, not assumed:
 *
 *   - the STORE-hash case REDs when the component stops reading the store hash,
 *     and stays GREEN under the UI-hash substitution (the substituted value also
 *     differs from the block's, so both yield `changed` and the single-arm
 *     assertion cannot discriminate). It pins that the store hash is READ.
 *   - the CANVAS-GRAPH case is the one that catches the SUBSTITUTION, alongside
 *     `stays SILENT while the hashes agree` in the sibling #670 spec.
 *
 * Naming which member catches what is the point (trap 19): "it is a pair, so it
 * must bind" is the kind of claim that reads as rigour and was never measured.
 */
describe('the current hash is CEE-sourced — a UI hash is not what is read', () => {
  it('moving the STORE’s CEE hash flips the verdict', () => {
    installFreshness({ freshness: 'fresh', currentGraphHash: HASH_AFTER_EDIT }, { dirty: false })
    renderThroughMountPath(rawCoaching())
    expect(theCard()).toHaveAttribute('data-currency', 'changed')
  })

  it('moving the CANVAS GRAPH does not — the UI’s own hash is a different algorithm', () => {
    const nodes = [
      { id: 'n1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Delivery risk' } },
      { id: 'n2', type: 'factor', position: { x: 10, y: 10 }, data: { label: 'Timeline' } },
    ]
    const edges = [{ id: 'e1', source: 'n1', target: 'n2', data: { weight: 0.4 } }]

    // The precondition that makes this discriminating: the UI-side hash of this
    // graph must NOT equal the CEE hash the card is comparing against, so a
    // substitution would visibly change the verdict.
    const uiHash = generateGraphHash(nodes as never, edges as never)
    expect(uiHash, 'precondition: the UI hash must differ, or a substitution would be invisible').not.toBe(
      HASH_AT_GENERATION,
    )

    installFreshness({ freshness: 'fresh', currentGraphHash: HASH_AT_GENERATION }, { dirty: false })
    useCanvasStore.setState({ nodes: nodes as never, edges: edges as never })

    renderThroughMountPath(rawCoaching())
    expect(theCard()).toHaveAttribute('data-currency', 'current')
  })
})
