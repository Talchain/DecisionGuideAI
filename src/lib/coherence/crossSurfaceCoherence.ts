/**
 * THE CROSS-SURFACE COHERENCE GATE — six contradiction pairs.
 *
 * ⚠ WHAT THIS IS, AND WHAT IT IS NOT
 * ----------------------------------
 * It is a DETECTOR, not a fix. It renders nothing, gates no mount, suppresses
 * no field and repairs no payload. It answers exactly one question that no
 * single-surface test can answer:
 *
 *     do two surfaces of THIS turn contradict each other?
 *
 * Every pair below is a case where each surface is INTERNALLY CORRECT while
 * contradicting a sibling. That is why no component-level guard reaches them:
 * a guard is correct at the seam it guards (P1), and this defect lives in the
 * space BETWEEN two seams that never consult one another.
 *
 * WHY IT LIVES HERE AND NOT IN THE SCHEMA
 * ---------------------------------------
 * ⚠ RE-DERIVED at the vendored tip after UI #749 re-vendored 0.47.0. An earlier
 * version of this header said the contract "has ZERO cross-field refinement",
 * derived at 0.46.0 — TRUE THEN, FALSE NOW, and left uncorrected it would have
 * been the estate's characteristic defect (a doctrine sentence kept true by
 * nobody re-measuring it). Re-measured at 0.47.0: `superRefine` occurrences in
 * `dist/boundary/analysis-state.js` = **1**, and CC-A…CC-F are present and
 * enforced by `refineAnalysisStateV1`.
 *
 * WHAT THE SIX CROSS-CHECKS ACTUALLY COVER, read off 0.47.0's own rule list:
 *   CC-A blocked ⇒ blocked_unusable true          CC-B complete_* ⇒ ¬blocked_unusable
 *   CC-C never_run ⇒ ¬usable_for_{prose,chips,followup} ∧ ¬requires_rerun
 *   CC-D blocked_unusable ⇒ ¬usable_for_*         CC-E usable_for_chips ⇒ ¬requires_rerun
 *   CC-F complete_stale ⇒ ¬usable_for_chips
 *
 * Every rule keys on `run_state.kind` and the five booleans, and on NOTHING
 * else. `readiness.status`, `leader_claim`, `robustness` and `contradictions`
 * appear in ZERO rules — asserted, not assumed, in the derivation spec. So of
 * the six pairs here:
 *   · CX3's usability limb IS NOW PARSER-ENFORCED (CC-C). See the limb note.
 *   · CX1, CX2, CX4, CX5 and CX6 are untouched, and still parse cleanly.
 * The contract's remaining DISCLOSED LIMITS still hold: L1 (`permitted:true`
 * beside `withheld_reason` parses) and L3 (`contradictions: []` is the
 * producer's self-report, not evidence). L2 is the limit 0.47.0 closed.
 *
 * The producer still declines to enforce any of it: CEE
 * `src/orchestrator-v5/compose/analysis-state-v1.ts` limit L-D says it "does
 * NOT force the usability booleans to agree with `run_state`". So five of six
 * remain SANCTIONED at both ends of the wire. Detecting them is a third thing —
 * neither a parser rule nor a producer rule — and that is what this module is.
 *
 * ⚠ AND THE CROSS-CHECKS MAKE THE GATE MORE NECESSARY, NOT LESS, FOR THE ONE
 * PAIR THEY CLOSE. When a cross-check fires in production the contradiction
 * does not surface: `responseParser`'s tolerance step QUARANTINES the malformed
 * `analysis_state` and every surface falls back to its legacy derivation with a
 * diagnostic ("the honest failure mode is 'ignore the verdict, fall back to the
 * derivations, record a diagnostic', never 'lose the turn'" —
 * `src/v5/__tests__/responseParser.analysisStateTolerance.spec.ts`). So a
 * CC-C-violating turn becomes an ABSENT VERDICT nobody sees. That is the
 * concrete answer to the frozen adjudication's sub-question 1 ("what is the
 * failure mode when the tripwire fires in production?"): SILENT FALLBACK. This
 * gate reads the payload as the WIRE delivered it, not as the parser approved
 * it, precisely so that class stays visible (`captureAdapter.ts`).
 *
 * EXPRESSIBILITY, STATED PER PAIR (the honest answer to the frozen Codex
 * adjudication's question 9: "is coherence BETWEEN sibling analysis blocks a
 * contract obligation, or is it a producer obligation the contract cannot
 * express?"). Each pair below carries an `expressibility` field with one of:
 *
 *   'analysis_state'  — statable as a cross-check rule INSIDE `AnalysisStateV1`
 *                       (CC-G shaped). The contract could carry it today.
 *   'analysis_state_enforced'
 *                     — statable inside `AnalysisStateV1` AND ALREADY ENFORCED
 *                       there by one of 0.47.0's CC-A…CC-F rules. The gate keeps
 *                       the limb because the parser's refusal is SILENT at the
 *                       consumer (tolerance quarantines and falls back), so
 *                       enforcement removes the visibility, not the defect.
 *   'envelope'        — spans `analysis_state` and a SIBLING BLOCK
 *                       (`enrichment`, `assistant_text`). `AnalysisStateV1` is
 *                       `.strict()` and has no member for either, so the rule
 *                       is NOT expressible inside it. It needs an
 *                       envelope-level obligation or a gate like this one.
 *   'not_on_the_wire' — the fact the rule needs is NOT TRANSMITTED at all.
 *                       No schema change to `AnalysisStateV1`'s current members
 *                       can express it; the producer must first emit the fact.
 *
 * Three of the six are 'envelope' and one is 'not_on_the_wire'. That is the
 * finding, and it is why "add CC-G and freeze" would close two pairs of six.
 *
 * WHAT THIS MODULE MUST NEVER DO
 * ------------------------------
 * Weaken a pair to make a capture pass. A pair that cannot be expressed is
 * reported as inexpressible (see `expressibility`), never narrowed until the
 * corpus goes quiet. And it must not become a CONSUMER of the incoherent
 * members it observes: reading `refused` beside `usable_for_chips` to DETECT
 * the contradiction is not the same as rendering from it, and nothing here
 * returns a value any surface may display.
 *
 * PRODUCER DERIVATION (P7) — every vocabulary below is read from the PRODUCER,
 * never inferred from the captures this gate is pointed at:
 *   · `run_state.kind`            CEE `compose/analysis-state-v1.ts:189-265`
 *                                 (`composeRunState`), and the closed enum is
 *                                 imported at RUN TIME from the contract, not
 *                                 re-typed here.
 *   · `readiness.status`          CEE `src/schemas/analysis-ready.ts:222-228`
 *                                 (`AnalysisReadyStatus`) + the unsupplied
 *                                 sentinel `READINESS_STATUS_UNSUPPLIED`
 *                                 ('unknown', `analysis-state-v1.ts:110`),
 *                                 whose own doc says it is NOT a synonym for
 *                                 blocked.
 *   · actionable blocker CODES    CEE `ACTIONABLE_BLOCKER_TYPES`
 *                                 (`context/canonical-analysis-state.ts:130`)
 *                                 mapped through `blockerIssue`
 *                                 (`orchestrator/tools/analysis-ready-helper.ts:623-651`).
 *                                 `constraint_dropped` → `CONSTRAINT_REVIEW_REQUIRED`
 *                                 is ADVISORY by the producer's own statement
 *                                 and is deliberately EXCLUDED.
 *   · usability booleans          `assembleCanonicalState`
 *                                 (`canonical-analysis-state.ts:505-545`): all
 *                                 five require `hasFact`.
 *   · enrichment field names      derived at run time from the contract's
 *                                 `EnrichmentFlipThresholdSchema` /
 *                                 `EnrichmentConditionalWinnerSchema` shapes.
 */

import {
  ANALYSIS_RUN_STATE_KINDS,
  type AnalysisStateV1,
  type AnalysisBlocker,
} from '@talchain/schemas/boundary'

import { ANALYSIS_READY_STATUSES } from '../../adapters/cee/types'

// ─────────────────────────────────────────────────────────────────────────────
// The two withholding predicates — EXPORTED, because they now have an ENFORCER
// ─────────────────────────────────────────────────────────────────────────────
//
// ⚠ THIS MODULE IS A DETECTOR AND STAYS ONE. It reports contradictions; it does
// not act on them, and CX4's own disposition below records that its Compare-tab
// limb is still `NOT YET ENFORCED`. What is exported here are its LEAVES — the
// two predicates over `analysis_state` — so the canvas enforcement built for
// the witnessed leader-designation harm reads the SAME definition this file
// detects on, rather than a second spelling of it (CLAUDE.md trap 12: the
// dominant defect is the hand-maintained mirror). `detectCX4` below now calls
// `producerWithholdsLeaderClaim` rather than restating its test inline, so the
// two cannot drift.
//
// ⭐ TWO PREDICATES, NOT ONE, AND THEY ANSWER DIFFERENT QUESTIONS. Their
// consumers happen to take the same action today — withdraw the leading-option
// designation — and they are still kept apart, because a future relaxation of
// one must not silently relax the other. Fusing two harms under one name is the
// mistake this estate keeps paying for (trap 21).
//
//   Q1  `leader_claim.permitted === false`
//       "the producer REFUSES PERMISSION to name a leading option."
//   Q3  `blocked_unusable === true`
//       "the producer says the analysis it is describing is NOT USABLE."
//
// ⛔ `requires_rerun` IS DELIBERATELY IN NEITHER, and that exclusion is the
// load-bearing one. It means the graph has moved since the run — an ordinary
// edit sets it — so a predicate that admitted it would withdraw the leading
// option every time anybody edits anything: a fix for a lie that buys a gap
// (trap 22b, "suppression too wide"). Staleness already has an owner, the
// freshness slice, and what it says is "stale", not "unnameable".

/**
 * Q1 — has the producer REFUSED PERMISSION to name a leading option?
 *
 * ⚠ STRICT BOOLEAN `false`, never falsiness. The contract declares
 * `leader_claim.permitted` as `z.ZodBoolean` inside a `.strict()` object
 * (`@talchain/schemas` 0.50.0, `dist/boundary/analysis-state.d.ts:450-461`), so
 * anything else on this seam is a producer we cannot READ — and an unreadable
 * producer has said nothing. Absence is an older producer, never a refusal.
 */
export function producerWithholdsLeaderClaim(
  state: Pick<AnalysisStateV1, 'leader_claim'> | null | undefined,
): boolean {
  return state?.leader_claim?.permitted === false
}

/**
 * Q3 — has the producer declared the analysis it is describing UNUSABLE?
 *
 * A different fact from Q1 with a different owner on the producer side, and it
 * arrives on turns where Q1 is silent. Naming a leader out of an analysis its
 * own producer calls unusable is the same harm by another route.
 */
export function producerMarksAnalysisUnusable(
  state: Pick<AnalysisStateV1, 'blocked_unusable'> | null | undefined,
): boolean {
  return state?.blocked_unusable === true
}

// ─────────────────────────────────────────────────────────────────────────────
// Producer vocabularies
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The ONE `readiness.status` that means "this model can be analysed".
 *
 * The contract types `readiness.status` as a free string ON PURPOSE — the
 * vocabulary lives with CEE, and a closed enum in the shared package would be a
 * hand-maintained mirror of a registry it does not own. So this gate names the
 * single POSITIVE value rather than mirroring the negative list: a status CEE
 * adds later is not-ready by default, which fails toward detection rather than
 * toward silence.
 */
export const READINESS_STATUS_READY = 'ready'

/**
 * CEE's sentinel for "no readiness verdict was supplied on this turn"
 * (`analysis-state-v1.ts:110`, `READINESS_STATUS_UNSUPPLIED`). Its own doc:
 * "It is NOT a synonym for `blocked`, and a consumer must not treat it as one."
 *
 * So it is neither ready nor not-ready, and every pair below that keys on
 * not-readiness EXCLUDES it. Treating an absent verdict as a negative verdict
 * is how an absence becomes a fabricated finding.
 */
export const READINESS_STATUS_UNSUPPLIED = 'unknown'

/**
 * The full `readiness.status` vocabulary CEE can emit, recorded so drift is
 * VISIBLE rather than silent. `AnalysisReadyStatus`
 * (CEE `src/schemas/analysis-ready.ts:220-227`) plus the unsupplied sentinel.
 *
 * ⚠ Still a MIRROR of a producer registry — the shared contract does not export
 * that enum at the 0.48.0 pin, so it cannot be derived from `@talchain/schemas`
 * (measured, with contrast controls; see `ANALYSIS_READY_STATUSES`). What HAS
 * changed is that this module no longer keeps its own second copy: the producer
 * half now comes from the single recorded vocabulary in `adapters/cee/types.ts`,
 * so this list and `usePreRunValidation`'s gate cannot disagree about what CEE
 * can say. It remains NOT load-bearing for any detector — no pair consults it —
 * and exists so `crossSurfaceCoherence.contractDerivation.spec.ts` and the real
 * captures spec RED when a status turns up that is not a member.
 */
export const KNOWN_READINESS_STATUSES: readonly string[] = [
  ...ANALYSIS_READY_STATUSES,
  READINESS_STATUS_UNSUPPLIED,
]

/**
 * Blocker CODES that mean "the user must supply something before this model is
 * analysable".
 *
 * DERIVED, not observed: CEE's `ACTIONABLE_BLOCKER_TYPES` is
 * `{missing_value, ambiguous_value, missing_connection}`
 * (`canonical-analysis-state.ts:130-134`), and `blockerIssue`
 * (`analysis-ready-helper.ts:623-651`) maps those three wire types onto exactly
 * these three contract codes.
 *
 * `CONSTRAINT_REVIEW_REQUIRED` (from wire type `constraint_dropped`) is
 * EXCLUDED because the producer excludes it: "Advisory `constraint_dropped`
 * blockers do NOT trigger it … It must NOT downgrade usability"
 * (`canonical-analysis-state.ts:48-56`). Counting an advisory blocker as
 * actionable would make this gate fire on a BY-DESIGN combination — the
 * over-refusal failure mode the frozen adjudication's sub-question 1 warns
 * about.
 *
 * `UNREACHABLE_CONTROLLABLE_FACTOR` is also excluded: it is minted from the
 * `needs_user_mapping` STATUS branch (`analysis-ready-helper.ts:615-622`), not
 * from an actionable blocker type, so admitting it would widen the predicate
 * past the producer's own definition.
 */
export const ACTIONABLE_BLOCKER_CODES: readonly string[] = [
  'MISSING_OPTION_VALUE',
  'AMBIGUOUS_OPTION_VALUE',
  'MISSING_OPTION_CONNECTION',
]

// ─────────────────────────────────────────────────────────────────────────────
// The gate's input
// ─────────────────────────────────────────────────────────────────────────────

/** One `enrichment.flip_thresholds` row, narrowed to the members a pair reads. */
export interface FlipThresholdRow {
  factor_id?: string
  factor_label?: string
  no_flip_in_range?: boolean
  flip_reason?: string
  flip_value?: number | null
}

/** One `enrichment.conditional_winners` bucket, narrowed likewise. */
export interface ConditionalWinnerBucketRow {
  winner_id?: string
  winner_label?: string
  win_probability?: number
}

/** One `enrichment.conditional_winners` row, narrowed likewise. */
export interface ConditionalWinnerRow {
  factor_id?: string
  factor_label?: string
  split_value?: number
  winner_flips?: boolean
  low_bucket?: ConditionalWinnerBucketRow
  high_bucket?: ConditionalWinnerBucketRow
}

/**
 * Everything one TURN puts in front of one user, as far as coherence is
 * concerned.
 *
 * Deliberately a flat bag of OBSERVED CLAIMS rather than a re-derivation. This
 * module computes no freshness, no readiness, no entitlement and no run
 * outcome — it only compares claims that already exist.
 */
export interface CoherenceInput {
  /** The composed verdict, when the wire carried one. */
  analysisState: AnalysisStateV1 | null
  /** `analysis_result` block enrichment members the pairs read. */
  enrichment: {
    flip_thresholds?: readonly FlipThresholdRow[] | null
    conditional_winners?: readonly ConditionalWinnerRow[] | null
  } | null
  /** The assistant's rendered prose for this turn (`assistant_text`). */
  prose: string | null
  /** What is actually MOUNTED, which no payload field states. */
  surfaces: {
    /**
     * A results body is on screen. Not derivable from `analysis_state`: the
     * body may be a retained prior result the turn did not re-ship.
     */
    resultBodyVisible?: boolean | null
  }
  /**
   * Facts about how this turn's state was OBTAINED.
   *
   * ⚠ NOT ON THE WIRE TODAY. `fetchPriorTurns` swallows a thrown store read and
   * reports success, so a degraded read reaches the wire as the POSITIVE claim
   * `run_state.kind: 'never_run'` with nothing to distinguish it from a
   * genuinely fresh scenario. Every member here is `null` for every real
   * capture, and the pair that reads it says so.
   */
  provenance: {
    /** `false` ⇒ the prior-turn store read failed or degraded this turn. */
    priorTurnStoreReadOk?: boolean | null
  }
}

/** A convenience constructor so callers cannot forget a member. */
export function coherenceInput(partial: Partial<CoherenceInput>): CoherenceInput {
  return {
    analysisState: partial.analysisState ?? null,
    enrichment: partial.enrichment ?? null,
    prose: partial.prose ?? null,
    surfaces: partial.surfaces ?? {},
    provenance: partial.provenance ?? {},
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// The gate's output
// ─────────────────────────────────────────────────────────────────────────────

export const COHERENCE_PAIR_IDS = ['CX1', 'CX2', 'CX3', 'CX4', 'CX5', 'CX6'] as const
export type CoherencePairId = (typeof COHERENCE_PAIR_IDS)[number]

/** Where a rule forbidding this pair COULD live, or already does. See the header. */
export type CoherenceExpressibility =
  | 'analysis_state'
  | 'analysis_state_enforced'
  | 'envelope'
  | 'not_on_the_wire'

export interface CoherencePair {
  readonly id: CoherencePairId
  /** Stable machine name — what a report cites. */
  readonly name: string
  /** The claim one surface makes. */
  readonly claimA: string
  /** The claim its sibling makes, which cannot hold at the same time. */
  readonly claimB: string
  readonly expressibility: CoherenceExpressibility
}

export interface CoherenceViolation {
  readonly pair: CoherencePairId
  /** Sub-code — one pair may have several distinguishable limbs. */
  readonly code: string
  /** What contradicts what, in one line, for a report. */
  readonly detail: string
  /**
   * The identities the violation binds to (factor ids, option ids, statuses).
   * Assertions in the suite bind to THESE, never to a value predicate another
   * object could satisfy.
   */
  readonly evidence: Readonly<Record<string, string>>
}

/**
 * WHAT THE GATE DOES WHEN A PAIR FIRES — the disposition, decided per pair.
 *
 * ⚠ D7. Until now every pair's answer was the same one: NOTHING. The module
 * header is honest that it "renders nothing, gates no mount, suppresses no
 * field", and that was the right constraint while the pairs were being
 * established — but a detector nobody acts on is instrumentation, not a
 * guarantee, and five of six pairs remained sanctioned at both ends of the
 * wire. This map is the answer to "what SHOULD it do", stated per pair and in
 * code rather than in a document, so a pair cannot acquire a detector without
 * someone deciding what the detection is for.
 *
 * ⚠⚠ AND THE RULING THAT MATTERS MOST: NOT EVERY PAIR SHOULD BE MADE TO AGREE.
 * Forcing two authorities that answer DIFFERENT QUESTIONS into agreement is a
 * defect in its own right (the leader-claim seam cost this estate exactly that,
 * twice, a day apart). Where the two surfaces are answering different
 * questions, the disposition is `name_apart` and the correct engineering
 * response is to distinguish the concepts, NOT to reconcile the defaults.
 */
export type CoherenceDisposition =
  /**
   * The two members answer the SAME question and disagree. One of them is
   * wrong, we cannot know which, and the consumer must decline the claim.
   * Suppression here is not over-suppression: nothing is withheld that the
   * producer coherently stated.
   */
  | 'suppress_at_consumer'
  /**
   * The two members answer DIFFERENT questions. There is no contradiction to
   * fix; the fix is vocabulary. Making these agree would destroy information.
   */
  | 'name_apart'
  /**
   * A genuine contradiction the consumer cannot act on, because the fact that
   * would settle it is not transmitted, or because acting would mean rewriting
   * producer prose. Reported; not enforced.
   */
  | 'report_only'

export const COHERENCE_DISPOSITIONS: Readonly<Record<CoherencePairId, {
  readonly disposition: CoherenceDisposition
  readonly rationale: string
  /** Where the disposition is CARRIED OUT, or '' when it is not yet. */
  readonly enforcedAt: string
}>> = {
  CX1: {
    disposition: 'name_apart',
    rationale:
      'DIFFERENT QUESTIONS. `complete_current` is about the RUN THAT HAPPENED — '
      + 'this result reflects the model as it stood. `readiness` is about the NEXT '
      + 'run — the model as it stands NOW cannot be analysed. A model that was '
      + 'analysed and has SINCE acquired a blocker satisfies both, truthfully. '
      + 'Forcing agreement would delete a legitimate and common state.',
    enforcedAt: '',
  },
  CX2: {
    disposition: 'suppress_at_consumer',
    rationale:
      'SAME QUESTION: did this turn produce an analysis? `refused` says no; '
      + '`usable_for_chips` says yes and chip-safe. Consuming a refused turn for '
      + 'chips is the harm. NOT YET ENFORCED — the chip path is another lane\'s '
      + 'surface this wave (see the collision note in the PR).',
    enforcedAt: '',
  },
  CX3: {
    disposition: 'report_only',
    rationale:
      'The pair\'s weakest limb is `not_on_the_wire`: the fact that would settle '
      + 'whether a run occurred is not transmitted. A consumer cannot act on a '
      + 'fact it does not have, and guessing would mint one.',
    enforcedAt: '',
  },
  CX4: {
    disposition: 'suppress_at_consumer',
    rationale:
      'SAME QUESTION: may this turn name a leading option? `leader_claim.permitted: '
      + 'false` says no; a conditional-winner row names one anyway. The action is to '
      + 'strip the NAME, never the row — the producer\'s own withheld-claim projection '
      + 'strips exactly the identity members and forwards the factor-level science, so '
      + 'the consumer applies the withholding the producer failed to apply. '
      + 'NOT YET ENFORCED in the Compare tab: `leader_claim` rides `analysis_state`, a '
      + 'SIBLING of the enrichment block the snapshot factory receives, so the fact is '
      + 'not in scope at that seam. Threading it there is a plumbing change, rowed.',
    enforcedAt: '',
  },
  CX5: {
    disposition: 'suppress_at_consumer',
    rationale:
      'SAME QUESTION — BUT ONLY UNDER ONE OF THE TWO REASONS THE BOOLEAN '
      + 'COLLAPSES, and the pair\'s disposition is its ENFORCED limb. Under '
      + '`structurally_invariant` the per-option slopes are identical, so the '
      + 'per-sample winner is independent of the factor and `winner_flips` is a '
      + 'sampling artefact: same question, one instrument provably unable to '
      + 'discriminate, suppress. Under `no_effect_within_bounds` the slopes '
      + 'genuinely differ and only the MEAN-configuration crossing sits outside '
      + 'the domain, so a sampled bucket disagreement can be real: DIFFERENT '
      + 'questions, `name_apart`, and suppressing it would withhold a finding ISL '
      + 'computed. Per-limb dispositions in `CX5_LIMB_DISPOSITION`.',
    enforcedAt:
      'src/canvas/stores/analysisSnapshotFactory.ts (`collectNoFlipFactorIds`) and '
      + 'src/components/results/useResultsSectionData.ts (`confidence.'
      + 'conditionalWinners`) — BOTH via `components/results/utils/'
      + 'flipReasonVocabulary.collectStructurallyProvenNoFlipIds`, joined on the '
      + 'factor id. ⚠ THE STRUCTURAL LIMB ONLY: the `no_effect_within_bounds` limb '
      + 'is reported and deliberately NOT enforced. Pinned by '
      + '`analysisSnapshotFactory.scienceAttestation.spec.ts`, '
      + '`analysisSnapshotFactory.flipReasonNarrowing.spec.ts` and '
      + '`useResultsSectionData.winnerFlipContradiction.spec.ts`, each carrying '
      + 'both directions.',
  },
  CX6: {
    disposition: 'report_only',
    rationale:
      'A genuine contradiction, but acting on it means rewriting assistant prose '
      + 'at the consumer. That is a producer obligation; a consumer that edits a '
      + 'sentence to match a blocker is inventing an utterance.',
    enforcedAt: '',
  },
}

export const COHERENCE_PAIRS: Readonly<Record<CoherencePairId, CoherencePair>> = {
  CX1: {
    id: 'CX1',
    name: 'analysis_complete_vs_model_not_analysable',
    claimA: 'run_state.complete_current — this result reflects the CURRENT model',
    claimB: 'readiness — the CURRENT model cannot be analysed (actionable blockers)',
    // Both members live inside `AnalysisStateV1`, so a CC-rule could state it.
    expressibility: 'analysis_state',
  },
  CX2: {
    id: 'CX2',
    name: 'refused_vs_readiness',
    claimA: 'run_state.refused — this turn declined to analyse',
    claimB: 'readiness.ready / usable_for_chips — the analysis is ready and chip-safe',
    expressibility: 'analysis_state',
  },
  CX3: {
    id: 'CX3',
    name: 'never_run_vs_evidence_of_a_run',
    claimA: 'run_state.never_run — this scenario has never been analysed',
    claimB: 'usability booleans / a visible result body / a degraded store read',
    // Limbs (a) is analysis_state; (b) is not_on_the_wire; (c) is envelope.
    // The pair takes its WEAKEST limb, because the pair is only as expressible
    // as its hardest member — see `limbExpressibility` below for the split.
    expressibility: 'not_on_the_wire',
  },
  CX4: {
    id: 'CX4',
    name: 'leader_withheld_vs_leader_designated',
    claimA: 'leader_claim.permitted:false — no leading option may be named',
    claimB: 'conditional_winners — a rendered row names the leading option per bucket',
    expressibility: 'envelope',
  },
  CX5: {
    id: 'CX5',
    name: 'flip_proof_vs_conditional_winner',
    claimA: 'flip_thresholds.no_flip_in_range:true — this factor cannot flip the winner',
    claimB: 'conditional_winners.winner_flips:true — this same factor flips the winner',
    expressibility: 'envelope',
  },
  CX6: {
    id: 'CX6',
    name: 'value_claimed_present_vs_blocker_says_missing',
    claimA: 'assistant prose — the model already reflects this value',
    claimB: 'readiness.blockers — that value is missing for this option/factor',
    expressibility: 'envelope',
  },
}

/**
 * CX3's three limbs do not share an expressibility, and collapsing them would
 * hide the only interesting fact about the pair. The pair's own field carries
 * the weakest limb; this map carries the truth per limb.
 *
 * ⚠ `never_run_with_usable_analysis` is `'analysis_state_enforced'` as of the
 * 0.47.0 re-vendor: CC-C now REFUSES it at the parser. The limb is kept anyway,
 * and not as belt-and-braces — the parser's refusal is what makes the
 * contradiction invisible (tolerance quarantines the verdict and every surface
 * falls back), so this limb is the only thing that still SAYS SO. It is the one
 * pair in the set that has moved a rung, and the movement is the proof that a
 * CC-shaped rule can close a pair — which is the load-bearing input for the
 * freeze decision on the other five.
 */
export const CX3_LIMB_EXPRESSIBILITY: Readonly<Record<string, CoherenceExpressibility>> = {
  never_run_with_usable_analysis: 'analysis_state_enforced',
  never_run_after_degraded_store_read: 'not_on_the_wire',
  never_run_over_visible_result_body: 'envelope',
}

/**
 * CX5's two limbs do not share a disposition, and the pair-level field carries
 * only the enforced one. Same precedent as `CX3_LIMB_EXPRESSIBILITY` above, and
 * the same reason: collapsing them hides the only interesting fact about the
 * pair.
 *
 * The split is forced by the PRODUCER. PLoT stamps one boolean,
 * `no_flip_in_range: true`, from a SET of two reasons
 * (`integrations/isl/adapters/factor-flip-values.ts:304` over `NO_EFFECT_REASONS`,
 * `lib/flip-threshold-status.ts:75-78`), and the two are epistemically different
 * objects — so a consumer keyed on the boolean is keyed on their union and
 * necessarily gets one of the limbs wrong.
 *
 * ⚠ TWO OPPOSITE HARMS, TWO DISPOSITIONS (trap 22b). Enforcing both limbs
 * withholds a finding ISL computed; enforcing neither leaves a falsehood on the
 * screen. They are not two ends of one tunable window.
 */
export const CX5_LIMB_DISPOSITION: Readonly<Record<string, CoherenceDisposition>> = {
  /**
   * Slopes IDENTICAL (spread <= 1e-9). The per-sample winner is independent of
   * the factor, so the median-split buckets behind `winner_flips` are two
   * random halves of ONE sequence. Same question, one instrument unable to
   * discriminate: SUPPRESS.
   *
   * ⚠ "topological in the graph, so it holds under every sampled edge draw" is
   * WITHDRAWN. ISL computes a NUMERICAL spread against `1e-9` at ONE
   * configuration — the same MEAN configuration that disqualifies the limb
   * below. The sample-invariance rests on a MECHANISM (options are alternative
   * values of one decision node, so every option severs the same paths and the
   * per-option slopes are the same algebraic expression), which does not cover
   * slopes that merely coincide at the mean via different path products.
   * Canonical derivation: `components/results/utils/flipReasonVocabulary.ts`.
   * Disposition unchanged.
   */
  structurally_invariant_with_winner_flips: 'suppress_at_consumer',
  /**
   * Slopes GENUINELY DIFFER; only the crossing lies outside the domain at the
   * MEAN edge configuration. Sampled draws move the crossing, so a bucket
   * disagreement can be a real finding about the sampled distribution. The two
   * members answer different questions and the residual tension is in the
   * PRODUCER'S COPY ("within the tested range…"), which is CEE's to split on
   * the reason — not a consumer suppression. Reported, never enforced here.
   */
  no_effect_within_bounds_with_winner_flips: 'name_apart',
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared readers — deliberately tolerant, because a gate that throws on a
// malformed payload stops detecting exactly when detection matters most (P1:
// the seam one past the guard is where the defect lives).
// ─────────────────────────────────────────────────────────────────────────────

function blockersOf(state: AnalysisStateV1 | null): readonly AnalysisBlocker[] {
  const raw = state?.readiness?.blockers
  return Array.isArray(raw) ? raw : []
}

function actionableBlockers(state: AnalysisStateV1 | null): readonly AnalysisBlocker[] {
  return blockersOf(state).filter(
    b => typeof b?.code === 'string' && ACTIONABLE_BLOCKER_CODES.includes(b.code),
  )
}

/**
 * "This status asserts the model is NOT analysable."
 *
 * `ready` is the one positive value; the unsupplied sentinel is neither. An
 * absent status is neither, too — an absence is not a negative verdict.
 */
export function assertsNotAnalysable(status: unknown): boolean {
  if (typeof status !== 'string' || status.length === 0) return false
  if (status === READINESS_STATUS_READY) return false
  if (status === READINESS_STATUS_UNSUPPLIED) return false
  return true
}

/**
 * The rows `ConditionalWinnerCards` ACTUALLY renders.
 *
 * Byte-for-byte the component's own filter — `ConditionalWinnerCards.tsx:85-89`:
 * `winners.filter(w => w.winner_flips === true && Number.isFinite(w.split_value))`,
 * then `if (flipping.length === 0) return null`. Restated rather than imported
 * so this module stays free of React; the pairs spec RENDERS the real component
 * against the same rows and asserts the DOM agrees, so the restatement cannot
 * drift silently (P2).
 */
export function renderedConditionalWinnerRows(
  rows: readonly ConditionalWinnerRow[] | null | undefined,
): readonly ConditionalWinnerRow[] {
  if (!Array.isArray(rows)) return []
  return rows.filter(r => r?.winner_flips === true && Number.isFinite(r?.split_value))
}

/**
 * Does this row put an OPTION IDENTITY on screen?
 *
 * The data-vs-designation doctrine is the discriminator, not a blanket ban:
 * withholding a leader claim drops the DESIGNATION and KEEPS the DATA. A bucket
 * carrying only `win_probability` renders "Above: 65%" — data, permitted. A
 * bucket carrying `winner_label` renders "Above: Floating price contract (50%)"
 * — a designation of which option leads in that bucket, which is exactly what a
 * withheld claim forbids. `ConditionalWinnerCards.tsx:154-165` (`sideText`) is
 * the function that makes that choice; `:184-186` names the alt winner in the
 * directional sentence.
 */
export function rowNamesAnOption(row: ConditionalWinnerRow): boolean {
  const buckets = [row.low_bucket, row.high_bucket]
  return buckets.some(b => typeof b?.winner_label === 'string' && b.winner_label.length > 0)
}

// ─────────────────────────────────────────────────────────────────────────────
// CX6's lexical limb — bounded on purpose, and its bound is DECLARED
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Phrases that assert a value is ALREADY IN THE MODEL.
 *
 * ⚠ THIS IS A BOUNDED LEXICAL TRIPWIRE, NOT A DERIVED PREDICATE, AND THE
 * DIFFERENCE IS THE POINT (P7). Every other vocabulary in this file was read
 * off the producer. This one CANNOT be: the sentence is generated by a language
 * model, so there is no instruction, schema or normaliser that fixes its
 * wording — a sweep of CEE for the witnessed phrasing returns ONE hit, in an
 * unrelated comment (`compose/lens-selector.ts:390`). A predicate over an
 * unbounded phrasing space cannot be complete, and four rounds of "one more
 * rule" on exactly this kind of predicate is a documented failure in this
 * estate.
 *
 * So the honest shape is: a SHORT list, a pinned KNOWN-DROPPED set in the spec
 * (paraphrases this gate provably misses), and a plain statement that the
 * structural fix belongs to the PRODUCER — the standing brief's P5 requires
 * that a claim contradicting the same payload's blockers be made IMPOSSIBLE,
 * not merely detected. This limb is a tripwire under that fix, not a substitute
 * for it.
 *
 * The list is drawn from sentences the product ACTUALLY EMITTED (the J4
 * capture), not from phrasings imagined here.
 */
export const PRESENCE_ASSERTION_PHRASES: readonly string[] = [
  'already reflects',
  'already reflected',
  'already anchors',
  'already captured',
  'already set to',
  'already in the model',
  'already modelled',
  'no change is needed',
]

/**
 * Words that flip a presence assertion into its opposite when they sit
 * immediately before it ("does not already reflect", "not yet captured").
 *
 * ONE rule, with its opposite-direction twin pinned in the spec. It is not
 * extended when a new construction is found: a new construction is recorded in
 * the KNOWN-DROPPED set instead. Two reversals on one natural-language
 * predicate is the signal that no further punctuation rule will settle it.
 */
const NEGATION_LOOKBEHIND = /\b(?:no|not|never|without|isn't|doesn't|does\s+not|is\s+not|has\s+not|hasn't)\b[^.!?]{0,24}$/i

const STOPWORDS: ReadonlySet<string> = new Set([
  'a', 'an', 'and', 'as', 'at', 'by', 'for', 'from', 'in', 'of', 'on', 'or', 'per',
  'the', 'to', 'with', 'share', 'total',
])

/**
 * Split prose into sentences WITHOUT cutting decimals.
 *
 * The estate has shipped a guard that could not fire because its window was cut
 * at the first `[.!?]` — which is also the decimal point — so `£1.5 million`
 * became `1` before the guard ever looked. A period flanked by digits is not a
 * sentence end here.
 */
export function splitSentences(text: string): string[] {
  const parts: string[] = []
  let start = 0
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (ch !== '.' && ch !== '!' && ch !== '?' && ch !== '\n') continue
    if (ch === '.') {
      const prev = text[i - 1]
      const next = text[i + 1]
      if (prev !== undefined && next !== undefined && /\d/.test(prev) && /\d/.test(next)) continue
    }
    const slice = text.slice(start, i + 1).trim()
    if (slice.length > 0) parts.push(slice)
    start = i + 1
  }
  const tail = text.slice(start).trim()
  if (tail.length > 0) parts.push(tail)
  return parts
}

function contentTokens(label: string): string[] {
  return label
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(t => t.length > 2 && !STOPWORDS.has(t))
}

/**
 * The share of a label's content tokens a sentence must carry before the
 * sentence counts as being ABOUT that label.
 *
 * Identity binding, not a value predicate: the point is that the sentence names
 * THIS factor, not that it names some factor. 0.7 is high enough that a
 * sentence about a different factor sharing one or two generic words cannot
 * satisfy it, and low enough to survive the paraphrase the product actually
 * emits ("subcontractor cost at 12% of affected-route revenue" carries 5 of the
 * 6 content tokens of "Subcontractor cost as share of affected-route revenue").
 */
export const FACTOR_IDENTITY_TOKEN_SHARE = 0.7

export function sentenceNamesLabel(sentence: string, label: string): boolean {
  const tokens = contentTokens(label)
  if (tokens.length === 0) return false
  const haystack = sentence.toLowerCase()
  const present = tokens.filter(t => haystack.includes(t)).length
  return present / tokens.length >= FACTOR_IDENTITY_TOKEN_SHARE
}

/** Does this sentence assert (un-negated) that a value is already present? */
export function sentenceAssertsPresence(sentence: string): string | null {
  const lower = sentence.toLowerCase()
  for (const phrase of PRESENCE_ASSERTION_PHRASES) {
    const at = lower.indexOf(phrase)
    if (at === -1) continue
    if (NEGATION_LOOKBEHIND.test(lower.slice(0, at))) continue
    return phrase
  }
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// The six detectors
// ─────────────────────────────────────────────────────────────────────────────

function detectCX1(input: CoherenceInput, out: CoherenceViolation[]): void {
  const state = input.analysisState
  if (state === null) return
  if (state.run_state?.kind !== 'complete_current') return
  const status = state.readiness?.status
  if (!assertsNotAnalysable(status)) return
  const blocking = actionableBlockers(state)
  if (blocking.length === 0) return
  out.push({
    pair: 'CX1',
    code: 'complete_current_with_actionable_blockers',
    detail:
      `run_state 'complete_current' claims the result reflects the CURRENT model, ` +
      `while readiness '${String(status)}' plus ${blocking.length} actionable blocker(s) ` +
      `claims the current model cannot be analysed. The results surface says the ` +
      `analysis is current; the pre-analysis footer renders "Not ready for analysis yet".`,
    evidence: {
      run_state_kind: 'complete_current',
      readiness_status: String(status),
      actionable_blocker_codes: blocking.map(b => b.code).join(','),
      first_blocker_option_id: blocking[0]?.option_id ?? '',
      first_blocker_factor_id: blocking[0]?.factor_id ?? '',
    },
  })
}

function detectCX2(input: CoherenceInput, out: CoherenceViolation[]): void {
  const state = input.analysisState
  if (state === null) return
  if (state.run_state?.kind !== 'refused') return
  const status = state.readiness?.status
  if (status === READINESS_STATUS_READY) {
    out.push({
      pair: 'CX2',
      code: 'refused_with_readiness_ready',
      detail:
        `run_state 'refused' says this turn declined to analyse, while readiness ` +
        `reports '${READINESS_STATUS_READY}' on the same payload.`,
      evidence: { run_state_kind: 'refused', readiness_status: String(status) },
    })
  }
  if (state.usable_for_chips === true) {
    out.push({
      pair: 'CX2',
      code: 'refused_with_usable_for_chips',
      detail:
        `run_state 'refused' says this turn declined to analyse, while ` +
        `usable_for_chips:true invites result-exploration chips off it. The producer ` +
        `computes usable_for_chips as hasFact && fresh && !blockedUnusable && ` +
        `!trustDowngrade, and the refusal branch returns BEFORE the status check, so ` +
        `this pair is emittable rather than impossible.`,
      evidence: {
        run_state_kind: 'refused',
        usable_for_chips: 'true',
        reason_code: String(state.run_state.reason_code ?? ''),
      },
    })
  }
}

function detectCX3(input: CoherenceInput, out: CoherenceViolation[]): void {
  const state = input.analysisState
  if (state === null) return
  if (state.run_state?.kind !== 'never_run') return

  const usable: string[] = []
  if (state.usable_for_prose === true) usable.push('usable_for_prose')
  if (state.usable_for_chips === true) usable.push('usable_for_chips')
  if (state.usable_for_followup === true) usable.push('usable_for_followup')
  if (usable.length > 0) {
    out.push({
      pair: 'CX3',
      code: 'never_run_with_usable_analysis',
      detail:
        `run_state 'never_run' claims this scenario has never been analysed, while ` +
        `${usable.join(' + ')} claims an analysis exists to use. The producer derives ` +
        `every usability boolean from hasFact, so this combination is not merely ` +
        `contradictory — it is producer-impossible, and its appearance means a ` +
        `producer invariant broke.`,
      evidence: { run_state_kind: 'never_run', usable_true: usable.join(',') },
    })
  }

  if (input.provenance.priorTurnStoreReadOk === false) {
    out.push({
      pair: 'CX3',
      code: 'never_run_after_degraded_store_read',
      detail:
        `run_state 'never_run' is a POSITIVE historical claim ("this scenario has ` +
        `never been analysed"), asserted after a store read that did not succeed. The ` +
        `honest state for an unreadable store is unknown_degraded/store_unreadable.`,
      evidence: { run_state_kind: 'never_run', prior_turn_store_read_ok: 'false' },
    })
  }

  if (input.surfaces.resultBodyVisible === true) {
    out.push({
      pair: 'CX3',
      code: 'never_run_over_visible_result_body',
      detail:
        `run_state 'never_run' claims this scenario has never been analysed, while a ` +
        `result body is mounted beneath it.`,
      evidence: { run_state_kind: 'never_run', result_body_visible: 'true' },
    })
  }
}

function detectCX4(input: CoherenceInput, out: CoherenceViolation[]): void {
  const state = input.analysisState
  if (state === null) return
  // ONE definition of "the producer withheld", shared with the canvas
  // enforcement. Restating `permitted !== false` inline here is what would let
  // the detector and the enforcer drift.
  if (!producerWithholdsLeaderClaim(state)) return
  const rows = renderedConditionalWinnerRows(input.enrichment?.conditional_winners)
  const naming = rows.filter(rowNamesAnOption)
  if (naming.length === 0) return
  for (const row of naming) {
    const labels = [row.low_bucket?.winner_label, row.high_bucket?.winner_label]
      .filter((l): l is string => typeof l === 'string' && l.length > 0)
    out.push({
      pair: 'CX4',
      code: 'withheld_leader_claim_with_named_conditional_winner',
      detail:
        `leader_claim.permitted:false` +
        `${state.leader_claim.withheld_reason ? ` (${state.leader_claim.withheld_reason})` : ''}` +
        ` withholds the leading-option designation, while the conditional-winner row ` +
        `for factor '${row.factor_id ?? 'unknown'}' renders option identities ` +
        `(${labels.join(' / ')}) as the winner of each bucket.`,
      evidence: {
        factor_id: String(row.factor_id ?? ''),
        withheld_reason: String(state.leader_claim.withheld_reason ?? ''),
        low_winner_id: String(row.low_bucket?.winner_id ?? ''),
        high_winner_id: String(row.high_bucket?.winner_id ?? ''),
        named_labels: labels.join('|'),
      },
    })
  }
}

function detectCX5(input: CoherenceInput, out: CoherenceViolation[]): void {
  const flips = input.enrichment?.flip_thresholds
  const winners = input.enrichment?.conditional_winners
  if (!Array.isArray(flips) || !Array.isArray(winners)) return
  const noFlipByFactor = new Map<string, FlipThresholdRow>()
  for (const f of flips) {
    if (typeof f?.factor_id === 'string' && f.no_flip_in_range === true) {
      noFlipByFactor.set(f.factor_id, f)
    }
  }
  if (noFlipByFactor.size === 0) return
  for (const w of winners) {
    if (w?.winner_flips !== true) continue
    if (typeof w.factor_id !== 'string') continue
    const f = noFlipByFactor.get(w.factor_id)
    if (f === undefined) continue
    // ⚠ D7b — ONE CODE PER LIMB. Detection is unchanged (the boolean still
    // finds every pair), but the two reasons behind it get different
    // dispositions (`CX5_LIMB_DISPOSITION`), so lumping them under one code
    // would report a deliberate KEEP as if it were the enforced contradiction —
    // and make the pair's `enforcedAt` claim false for half its findings.
    const limb =
      f.flip_reason === 'structurally_invariant'
        ? 'structurally_invariant_with_winner_flips'
        : f.flip_reason === 'no_effect_within_bounds'
          ? 'no_effect_within_bounds_with_winner_flips'
          : 'no_flip_in_range_with_winner_flips'
    out.push({
      pair: 'CX5',
      code: limb,
      detail:
        `For factor '${w.factor_id}', flip_thresholds reports no_flip_in_range:true ` +
        `(reason '${f.flip_reason ?? 'unstated'}') while conditional_winners reports ` +
        `winner_flips:true for the same factor. Both render on the Analysis tab.` +
        (limb === 'no_effect_within_bounds_with_winner_flips'
          ? ` REPORTED, NOT ENFORCED: the slopes genuinely differ and only the` +
            ` mean-configuration crossing lies outside the domain, so the sampled` +
            ` bucket disagreement can be real. The residual tension is in the` +
            ` producer's "within the tested range" copy.`
          : ''),
      evidence: {
        factor_id: w.factor_id,
        factor_label: String(w.factor_label ?? f.factor_label ?? ''),
        flip_reason: String(f.flip_reason ?? ''),
        winner_flips: 'true',
        no_flip_in_range: 'true',
      },
    })
  }
}

function detectCX6(input: CoherenceInput, out: CoherenceViolation[]): void {
  const prose = input.prose
  if (typeof prose !== 'string' || prose.length === 0) return
  const blocking = actionableBlockers(input.analysisState)
  if (blocking.length === 0) return
  const sentences = splitSentences(prose)
  // One violation per (factor) at most — the same sentence naming a factor that
  // carries several blockers is ONE contradiction, not N.
  const reported = new Set<string>()
  for (const blocker of blocking) {
    const label = blocker.factor_label
    if (typeof label !== 'string' || label.length === 0) continue
    const key = blocker.factor_id ?? label
    if (reported.has(key)) continue
    for (const sentence of sentences) {
      const phrase = sentenceAssertsPresence(sentence)
      if (phrase === null) continue
      if (!sentenceNamesLabel(sentence, label)) continue
      reported.add(key)
      out.push({
        pair: 'CX6',
        code: 'presence_claimed_while_blocker_says_missing',
        detail:
          `The reply asserts "${phrase}" about "${label}", while the same payload's ` +
          `blocker ${blocker.code} says that value is missing` +
          `${blocker.option_label ? ` for "${blocker.option_label}"` : ''}.`,
        evidence: {
          factor_id: String(blocker.factor_id ?? ''),
          factor_label: label,
          option_id: String(blocker.option_id ?? ''),
          blocker_code: blocker.code,
          phrase,
          sentence: sentence.slice(0, 200),
        },
      })
      break
    }
  }
}

/**
 * Every pair, in id order. Written as an exhaustive `Record` so adding an id to
 * `COHERENCE_PAIR_IDS` without writing its detector is a TYPE ERROR rather than
 * a pair that silently never fires.
 */
const DETECTORS: Readonly<
  Record<CoherencePairId, (input: CoherenceInput, out: CoherenceViolation[]) => void>
> = {
  CX1: detectCX1,
  CX2: detectCX2,
  CX3: detectCX3,
  CX4: detectCX4,
  CX5: detectCX5,
  CX6: detectCX6,
}

/**
 * Run every pair against one turn.
 *
 * Returns EVERY violation found, never the first — a turn that contradicts
 * itself twice is a different finding from one that does so once, and stopping
 * early would hide the second.
 */
export function evaluateCrossSurfaceCoherence(input: CoherenceInput): CoherenceViolation[] {
  const out: CoherenceViolation[] = []
  for (const id of COHERENCE_PAIR_IDS) DETECTORS[id](input, out)
  return out
}

/** The set of pairs violated, for a compact per-capture verdict. */
export function violatedPairs(violations: readonly CoherenceViolation[]): CoherencePairId[] {
  const seen = new Set<CoherencePairId>()
  for (const v of violations) seen.add(v.pair)
  return COHERENCE_PAIR_IDS.filter(id => seen.has(id))
}

/**
 * Re-exported so the derivation spec can assert this module's assumptions
 * against the CONTRACT rather than against a copy of it.
 */
export const CONTRACT_RUN_STATE_KINDS = ANALYSIS_RUN_STATE_KINDS
