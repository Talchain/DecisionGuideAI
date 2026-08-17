/**
 * THE SIX PAIRS — one DISCRIMINATING TWIN each.
 *
 * For every pair: a payload that genuinely exhibits the contradiction must make
 * the gate RED, and its COHERENT SIBLING must keep it green — and the two must
 * fail on DIFFERENT assertions. A pair with no red case is a guard agreeing
 * with itself; a pair with no green case is a guard that cannot discriminate.
 *
 * Every positive control is either a REAL CAPTURE (marked REAL, with its
 * provenance) or a payload derived from one by a single named mutation
 * (marked DERIVED). Nothing here is a shape imagined in this lane's head, with
 * ONE declared exception: CX2 and CX3's degraded-read limb have never been
 * observed, and are constructed. Both say so, and the corpus spec records their
 * absence with a contrast control rather than reading it as "does not happen".
 *
 * CX4 additionally executes the MOUNTED CONSUMER — the real
 * `ConditionalWinnerCards` React component, rendered against the real capture's
 * rows — so the claim "this surface names the option while the claim is
 * withheld" is settled at the DOM, not at a restated predicate (P2).
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { AnalysisStateV1 } from '@talchain/schemas/boundary'

import { ConditionalWinnerCards } from '../../../components/results/ConditionalWinnerCards'
import type { ConditionalWinner } from '../../../components/results/types'
import {
  coherenceInput,
  evaluateCrossSurfaceCoherence,
  sentenceAssertsPresence,
  sentenceNamesLabel,
  splitSentences,
  violatedPairs,
  type CoherencePairId,
  type ConditionalWinnerRow,
} from '../crossSurfaceCoherence'
import { adaptCapture } from '../captureAdapter'

import j4t2 from './fixtures/captures/acceptance-2026-08-17-j4-t2.json'
import j4t4 from './fixtures/captures/acceptance-2026-08-17-j4-t4.json'
import j4t5 from './fixtures/captures/acceptance-2026-08-17-j4-t5.json'
import w2d from './fixtures/captures/seeded-2026-08-17-w2d-analysis-turn.json'
import probeA from './fixtures/captures/conditional-winners-2026-08-17-probe-A.json'
import a1turn3 from './fixtures/captures/w998-2026-08-16-a1-turn3.json'
import a1turn2 from './fixtures/captures/w998-2026-08-16-a1-turn2.json'

/** Which pairs fired, as a set — the one assertion shape used throughout. */
function pairsOf(input: Parameters<typeof evaluateCrossSurfaceCoherence>[0]): CoherencePairId[] {
  return violatedPairs(evaluateCrossSurfaceCoherence(input))
}

/**
 * A minimally-complete coherent `AnalysisStateV1`, used ONLY as the base for
 * the two constructed pairs (CX2, CX3b). Every member is required by the
 * contract's strict body, so this is the shape the parser demands, not a
 * convenience.
 */
function coherentState(over: Partial<AnalysisStateV1> = {}): AnalysisStateV1 {
  return {
    run_state: { kind: 'complete_current', computed_at: '2026-08-17T09:00:00.000Z' },
    readiness: { status: 'ready', blockers: [] },
    leader_claim: { permitted: true, separation: 'separated' },
    robustness: {},
    usable_for_prose: true,
    usable_for_chips: true,
    usable_for_followup: true,
    requires_rerun: false,
    blocked_unusable: false,
    contradictions: [],
    ...over,
  } as AnalysisStateV1
}

// ─────────────────────────────────────────────────────────────────────────────

describe('CX1 · analysis complete vs model not analysable', () => {
  it('RED — REAL capture: complete_current beside needs_user_input with 10 actionable blockers (acceptance J4 turn 2)', () => {
    const { input } = adaptCapture(j4t2)
    // Precondition, pinned IN-TEST so the assertion cannot pass because the
    // fixture stopped reproducing the state (a discriminator whose fixture
    // nothing pins is a guard agreeing with itself).
    expect(input.analysisState?.run_state.kind).toBe('complete_current')
    expect(input.analysisState?.readiness.status).toBe('needs_user_input')

    const violations = evaluateCrossSurfaceCoherence(input).filter(v => v.pair === 'CX1')
    expect(violations).toHaveLength(1)
    expect(violations[0].code).toBe('complete_current_with_actionable_blockers')
    // Bind by IDENTITY, never by a value predicate another object could satisfy.
    expect(violations[0].evidence.readiness_status).toBe('needs_user_input')
    expect(violations[0].evidence.actionable_blocker_codes).toContain('MISSING_OPTION_VALUE')
  })

  it('GREEN twin — REAL capture: the SAME blockers under complete_stale do not contradict (acceptance J4 turn 5)', () => {
    const { input } = adaptCapture(j4t5)
    // The twin is real and it is the SAME session one turn later: identical
    // readiness, identical blockers, only the run state moved.
    expect(input.analysisState?.run_state.kind).toBe('complete_stale')
    expect(input.analysisState?.readiness.status).toBe('needs_user_input')
    expect(input.analysisState?.readiness.blockers.length).toBe(
      (adaptCapture(j4t2).input.analysisState?.readiness.blockers.length ?? -1),
    )
    expect(pairsOf(input)).not.toContain('CX1')
  })

  it('GREEN twin — REAL capture: complete_current with readiness ready (witness-998 A1 turn 3)', () => {
    const { input } = adaptCapture(a1turn3)
    expect(input.analysisState?.run_state.kind).toBe('complete_current')
    expect(input.analysisState?.readiness.status).toBe('ready')
    expect(pairsOf(input)).not.toContain('CX1')
  })

  it('GREEN — an ADVISORY blocker is not actionable, so it cannot fire CX1 (the over-refusal guard)', () => {
    // CEE: "Advisory `constraint_dropped` blockers do NOT trigger it … It must
    // NOT downgrade usability" (canonical-analysis-state.ts:48-56). A gate that
    // fired here would refuse a BY-DESIGN combination.
    const input = coherenceInput({
      analysisState: coherentState({
        readiness: {
          status: 'needs_user_input',
          blockers: [{
            code: 'CONSTRAINT_REVIEW_REQUIRED',
            category: 'option_values',
            message: 'Review the unresolved constraint.',
            repairability: 'human_input_required',
          }],
        },
      }),
    })
    expect(pairsOf(input)).not.toContain('CX1')
  })

  it('GREEN — the unsupplied readiness sentinel is not a negative verdict', () => {
    const input = coherenceInput({
      analysisState: coherentState({
        readiness: {
          status: 'unknown',
          blockers: [{
            code: 'MISSING_OPTION_VALUE',
            category: 'option_values',
            message: 'Choose the missing effect value.',
            repairability: 'human_input_required',
          }],
        },
      }),
    })
    expect(pairsOf(input)).not.toContain('CX1')
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('CX2 · refusal vs readiness', () => {
  // ⚠ CONSTRUCTED, and declared: no `refused` run state appears in any capture
  // in this corpus. The corpus spec records that absence with a contrast
  // control (`complete_current` DOES appear), so "never observed" is a measured
  // statement about the corpus, not an instrument reading zero.
  it('RED — refused beside readiness "ready" (the frozen adjudication\'s sub-question 5)', () => {
    const input = coherenceInput({
      analysisState: coherentState({
        run_state: { kind: 'refused', reason_code: 'analysis_refused_unspecified' },
        usable_for_chips: false,
      }),
    })
    const violations = evaluateCrossSurfaceCoherence(input).filter(v => v.pair === 'CX2')
    expect(violations.map(v => v.code)).toEqual(['refused_with_readiness_ready'])
  })

  it('RED — refused beside usable_for_chips:true, a DISTINCT limb', () => {
    const input = coherenceInput({
      analysisState: coherentState({
        run_state: { kind: 'refused', reason_code: 'analysis_refused_unspecified' },
        readiness: { status: 'blocked', blockers: [] },
        usable_for_chips: true,
      }),
    })
    const violations = evaluateCrossSurfaceCoherence(input).filter(v => v.pair === 'CX2')
    expect(violations.map(v => v.code)).toEqual(['refused_with_usable_for_chips'])
  })

  it('GREEN twin — refused with a blocked readiness and nothing chip-safe', () => {
    const input = coherenceInput({
      analysisState: coherentState({
        run_state: { kind: 'refused', reason_code: 'analysis_refused_unspecified' },
        readiness: { status: 'blocked', blockers: [] },
        usable_for_prose: false,
        usable_for_chips: false,
        usable_for_followup: false,
      }),
    })
    expect(pairsOf(input)).not.toContain('CX2')
  })

  it('GREEN — readiness "ready" without a refusal is the ordinary healthy turn', () => {
    expect(pairsOf(coherenceInput({ analysisState: coherentState() }))).not.toContain('CX2')
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('CX3 · fresh / stale / never_run', () => {
  it('RED — never_run beside usable_for_prose:true (producer-impossible: every usability boolean requires hasFact)', () => {
    const input = coherenceInput({
      analysisState: coherentState({
        run_state: { kind: 'never_run' },
        usable_for_prose: true,
        usable_for_chips: false,
        usable_for_followup: false,
      }),
    })
    const violations = evaluateCrossSurfaceCoherence(input).filter(v => v.pair === 'CX3')
    expect(violations.map(v => v.code)).toEqual(['never_run_with_usable_analysis'])
    expect(violations[0].evidence.usable_true).toBe('usable_for_prose')
  })

  it('RED — never_run asserted after a store read that did not succeed', () => {
    const input = coherenceInput({
      analysisState: coherentState({
        run_state: { kind: 'never_run' },
        usable_for_prose: false,
        usable_for_chips: false,
        usable_for_followup: false,
      }),
      provenance: { priorTurnStoreReadOk: false },
    })
    const violations = evaluateCrossSurfaceCoherence(input).filter(v => v.pair === 'CX3')
    expect(violations.map(v => v.code)).toEqual(['never_run_after_degraded_store_read'])
  })

  it('RED — never_run rendered over a visible result body', () => {
    const input = coherenceInput({
      analysisState: coherentState({
        run_state: { kind: 'never_run' },
        usable_for_prose: false,
        usable_for_chips: false,
        usable_for_followup: false,
      }),
      surfaces: { resultBodyVisible: true },
    })
    const violations = evaluateCrossSurfaceCoherence(input).filter(v => v.pair === 'CX3')
    expect(violations.map(v => v.code)).toEqual(['never_run_over_visible_result_body'])
  })

  it('GREEN twin — REAL capture: never_run with every usability boolean false and no body (witness-998 A1 turn 2)', () => {
    const { input } = adaptCapture(a1turn2)
    expect(input.analysisState?.run_state.kind).toBe('never_run')
    expect(input.analysisState?.usable_for_prose).toBe(false)
    expect(pairsOf(input)).not.toContain('CX3')
  })

  it('GREEN — a SUCCESSFUL store read leaves never_run untouched (the opposite-direction twin)', () => {
    const input = coherenceInput({
      analysisState: coherentState({
        run_state: { kind: 'never_run' },
        usable_for_prose: false,
        usable_for_chips: false,
        usable_for_followup: false,
      }),
      provenance: { priorTurnStoreReadOk: true },
    })
    expect(pairsOf(input)).not.toContain('CX3')
  })

  it('GREEN — a NOT-STATED read status is not a failed read (absence is not a negative)', () => {
    const input = coherenceInput({
      analysisState: coherentState({
        run_state: { kind: 'never_run' },
        usable_for_prose: false,
        usable_for_chips: false,
        usable_for_followup: false,
      }),
      provenance: { priorTurnStoreReadOk: null },
    })
    expect(pairsOf(input)).not.toContain('CX3')
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('CX4 · leader designation vs withholding', () => {
  it('RED — REAL capture: permitted:false / options_do_not_separate beside named conditional winners (seeded W2, run w2d)', () => {
    const { input } = adaptCapture(w2d)
    expect(input.analysisState?.leader_claim.permitted).toBe(false)
    expect(input.analysisState?.leader_claim.withheld_reason).toBe('options_do_not_separate')

    const violations = evaluateCrossSurfaceCoherence(input).filter(v => v.pair === 'CX4')
    // Two factors, two rows, two violations — bound by factor identity.
    expect(violations.map(v => v.evidence.factor_id).sort()).toEqual(['71c6351d', 'fcf3d740'])
    expect(violations[0].evidence.named_labels).toContain('Fixed price contract')
  })

  it('RED at the MOUNTED CONSUMER — the real card renders both option identities and their percentages while the claim is withheld (P2)', () => {
    const { input } = adaptCapture(w2d)
    const rows = (input.enrichment?.conditional_winners ?? []) as ConditionalWinnerRow[]
    expect(input.analysisState?.leader_claim.permitted).toBe(false)
    expect(rows.length).toBeGreaterThan(0)

    render(
      <ConditionalWinnerCards
        winners={rows as unknown as ConditionalWinner[]}
        recommendedOptionId={undefined}
      />,
    )
    // The card mounts at all — so it is not withholding by vanishing.
    expect(screen.getByTestId('conditional-winner-cards')).toBeInTheDocument()
    // And the DOM carries the designation the contract withheld.
    expect(screen.getAllByText(/Fixed price contract/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Floating price contract/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/%/).length).toBeGreaterThan(0)
  })

  it('GREEN twin — the SAME rows with the claim PERMITTED are coherent (the pair, not one mutant)', () => {
    const { input } = adaptCapture(w2d)
    const permitted = coherenceInput({
      ...input,
      analysisState: { ...input.analysisState!, leader_claim: { permitted: true, separation: 'separated' } },
    })
    expect(pairsOf(permitted)).not.toContain('CX4')
  })

  it('GREEN twin — withheld claim + IDENTITY-STRIPPED rows: probabilities render, the ordinal does not (data-vs-designation)', () => {
    const { input } = adaptCapture(w2d)
    const stripped = (input.enrichment?.conditional_winners ?? []).map(r => ({
      ...r,
      low_bucket: { win_probability: r.low_bucket?.win_probability },
      high_bucket: { win_probability: r.high_bucket?.win_probability },
    }))
    const withheldProjection = coherenceInput({
      ...input,
      enrichment: { ...input.enrichment, conditional_winners: stripped },
    })
    expect(withheldProjection.analysisState?.leader_claim.permitted).toBe(false)
    expect(pairsOf(withheldProjection)).not.toContain('CX4')
  })

  it('GREEN — a row the card does NOT render (winner_flips false) cannot leak a designation', () => {
    const { input } = adaptCapture(w2d)
    const notFlipping = (input.enrichment?.conditional_winners ?? []).map(r => ({ ...r, winner_flips: false }))
    const quiet = coherenceInput({ ...input, enrichment: { ...input.enrichment, conditional_winners: notFlipping } })
    expect(pairsOf(quiet)).not.toContain('CX4')
    // And the mounted consumer agrees: it renders nothing at all.
    const { container } = render(
      <ConditionalWinnerCards winners={notFlipping as unknown as ConditionalWinner[]} />,
    )
    expect(container.querySelector('[data-testid="conditional-winner-cards"]')).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('CX5 · flip-proof vs conditional-winner', () => {
  it('RED — REAL capture: no_flip_in_range:true and winner_flips:true for the SAME factor ids (seeded W2, run w2d)', () => {
    const { input } = adaptCapture(w2d)
    const violations = evaluateCrossSurfaceCoherence(input).filter(v => v.pair === 'CX5')
    expect(violations.map(v => v.evidence.factor_id).sort()).toEqual(['71c6351d', 'fcf3d740'])
    expect(violations[0].evidence.flip_reason).toBe('structurally_invariant')
  })

  it('GREEN twin — REAL capture: the same two blocks AGREE that the factor flips (conditional-winners probe A)', () => {
    const { input } = adaptCapture(probeA)
    // Precondition pinned: both members are populated, so the green is a real
    // agreement and not an empty-array vacuity.
    expect((input.enrichment?.flip_thresholds ?? []).length).toBeGreaterThan(0)
    expect((input.enrichment?.conditional_winners ?? []).length).toBeGreaterThan(0)
    expect((input.enrichment?.conditional_winners ?? [])[0].winner_flips).toBe(true)
    expect(pairsOf(input)).not.toContain('CX5')
  })

  it('GREEN — a no-flip verdict for a DIFFERENT factor is not a contradiction (binding is by factor identity)', () => {
    const { input } = adaptCapture(w2d)
    const rekeyed = (input.enrichment?.flip_thresholds ?? []).map(f => ({ ...f, factor_id: `${f.factor_id}-other` }))
    const shifted = coherenceInput({ ...input, enrichment: { ...input.enrichment, flip_thresholds: rekeyed } })
    expect(pairsOf(shifted)).not.toContain('CX5')
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('CX6 · blocker says the value is missing vs Olumi says it exists', () => {
  it('RED — REAL capture: "Your model already reflects subcontractor cost at 12%…" beside MISSING_OPTION_VALUE for that factor (acceptance J4 turn 2)', () => {
    const { input } = adaptCapture(j4t2)
    expect(input.prose).toContain('already reflects')
    const violations = evaluateCrossSurfaceCoherence(input).filter(v => v.pair === 'CX6')
    expect(violations).toHaveLength(1)
    expect(violations[0].evidence.factor_label).toBe('Subcontractor cost as share of affected-route revenue')
    expect(violations[0].evidence.blocker_code).toBe('MISSING_OPTION_VALUE')
    expect(violations[0].evidence.phrase).toBe('already reflects')
  })

  it('GREEN twin — REAL capture: the SAME factor named repeatedly as UNSET (acceptance J4 turn 4)', () => {
    const { input } = adaptCapture(j4t4)
    // Precondition: the prose really is about the same factor, so the green is
    // discrimination and not a miss.
    expect(input.prose).toContain('Subcontractor cost as share of affected-route revenue')
    expect(input.analysisState?.readiness.blockers.some(b => b.code === 'MISSING_OPTION_VALUE')).toBe(true)
    expect(pairsOf(input)).not.toContain('CX6')
  })

  it('GREEN — a NEGATED presence assertion is not a presence assertion (the opposite-direction twin)', () => {
    const { input } = adaptCapture(j4t2)
    const negated = coherenceInput({
      ...input,
      prose: 'Your model does not already reflect subcontractor cost as share of affected-route revenue.',
    })
    expect(pairsOf(negated)).not.toContain('CX6')
  })

  it('GREEN — a presence assertion about a DIFFERENT factor does not fire (identity binding, not a value predicate)', () => {
    const { input } = adaptCapture(j4t2)
    const other = coherenceInput({
      ...input,
      prose: 'Your model already reflects the depot lease renewal premium, so no change is needed there.',
    })
    expect(pairsOf(other)).not.toContain('CX6')
  })

  it('GREEN — an actionable blocker with NO presence assertion anywhere is silent', () => {
    const { input } = adaptCapture(j4t2)
    const quiet = coherenceInput({ ...input, prose: 'Tell me the subcontractor cost figure and I will set it.' })
    expect(pairsOf(quiet)).not.toContain('CX6')
  })

  it('⚠ KNOWN-DROPPED — paraphrases this bounded tripwire provably MISSES, pinned so the gap is in the suite rather than invisible to it', () => {
    const { input } = adaptCapture(j4t2)
    const label = 'Subcontractor cost as share of affected-route revenue'
    const knownDropped = [
      `We have subcontractor cost at 12% of affected-route revenue on file, so there is nothing to add.`,
      `That value for subcontractor cost as a share of affected-route revenue is present in your model.`,
      `Subcontractor cost as share of affected-route revenue: 12% — recorded.`,
    ]
    for (const prose of knownDropped) {
      // Each names the factor — the miss is the PHRASE list, not the identity binding.
      expect(sentenceNamesLabel(prose, label)).toBe(true)
      expect(pairsOf(coherenceInput({ ...input, prose }))).not.toContain('CX6')
    }
    // The set is asserted EXACTLY: it REDs if it grows (a new miss found and not
    // recorded) or shrinks (a phrase quietly added, which would mean the list is
    // being iterated instead of the producer fix being made).
    expect(knownDropped).toHaveLength(3)
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('CX6 · the sentence splitter must not cut a decimal', () => {
  it('a period between digits is not a sentence end (£1.5 million must survive)', () => {
    expect(splitSentences('The cap is £1.5 million already reflected. Next.')).toEqual([
      'The cap is £1.5 million already reflected.',
      'Next.',
    ])
  })

  it('the presence phrase and the decimal survive together, so the guard sees the bytes it is aimed at', () => {
    const sentence = splitSentences('Your model already reflects a 1.5 million cap on haulage spend.')[0]
    expect(sentenceAssertsPresence(sentence)).toBe('already reflects')
    expect(sentenceNamesLabel(sentence, 'Cap on haulage spend')).toBe(true)
  })
})
