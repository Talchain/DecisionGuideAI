/**
 * ⭐⭐ THERE IS A COMPLETED RUN ON WHICH EVERY OTHER CARD IS GATED OFF, AND
 * THIS IS THE ONE THAT STILL SPEAKS.
 *
 * ── HOW THE HOLE WAS FOUND (a reachability census, 21 Sep 2026) ────────────
 * Measured against the two real post-result captures. On a run whose leader is
 * WITHHELD — the state Paul has hit in each manual session — the engine's own
 * cards are gated off almost entirely and the producer's coaching blocks are
 * the only coaching the panel has. Take those away too and the section is
 * EMPTY, on a run that completed successfully.
 *
 * Every gate, and why each one closes on the input below:
 *
 *   success-measure  needs NO stated goal target        → target present
 *   phase3           needs producer coaching blocks     → none on this run
 *   flip             needs `!leaderClaimWithheld`       → withheld
 *   robustness       needs level low | very_low         → moderate
 *   commit           needs level high                   → moderate
 *   broaden          needs a narrow-framing bias type   → none
 *   voi              needs `worthInvestigating === true`→ null on 24 of 24
 *                                                         real rows
 *   lehi             needs `confidenceDisplay.show`     → ⛔ FALSE for every
 *                                                         production caller;
 *                                                         `DISPLAY_SAFE_DRIVER_CONFIDENCE`
 *                                                         is `false` and only
 *                                                         test seams pass true
 *                                                         (pinned by
 *                                                         `buildRecommendations.spec.ts` F5b)
 *
 * **Eight cards, zero acts.** The reader finishes an analysis and the panel has
 * nothing for them to do.
 *
 * ── WHY THIS CARD IS THE ANSWER AND NOT A NINTH GATE ───────────────────────
 * `strengthen:next-input` is gated on `analysisComplete` and on the PRODUCER
 * publishing which parameters the comparison is waiting on. It is not gated on
 * the leader claim, the robustness level, the fragile edges, the bias findings
 * or the confidence display policy — so it is reachable on precisely the run
 * where the rest are not. And a withheld run is the run that publishes that
 * field, because it is the producer saying what the comparison is still
 * waiting for.
 *
 * ⚠ THIS FILE IS A REACHABILITY PROOF, NOT A COPY TEST. It asserts WHICH cards
 * fire, never what they say; the wording is owned and guarded elsewhere. A
 * reword must not RED here, and a gate change must.
 */
import { describe, it, expect } from 'vitest'
import { buildRecommendations } from '../buildRecommendations'
import type { StrengthenInputs } from '../strengthenTypes'

/**
 * Two factors, distinct influences well clear of the tie epsilon, and
 * `confidenceDisplay.show: false` — the shape the ruled display policy actually
 * produces, so LEHI stays dark here for the same reason it is dark in
 * production rather than because the fixture dodged it.
 */
const FACTORS = [
  {
    factorId: 'node_pitch',
    label: 'Pitch Quality',
    influence: 0.91,
    confidenceDisplay: { show: false, hiddenReason: 'no_display_safe_source' },
    canFocus: true,
  },
  {
    factorId: 'node_churn',
    label: 'Monthly Churn Rate',
    influence: 0.22,
    confidenceDisplay: { show: false, hiddenReason: 'no_display_safe_source' },
    canFocus: true,
  },
]

/** A completed run on which every gate above is closed. */
const theSilentRun = (extra: Record<string, unknown> = {}): StrengthenInputs =>
  ({
    analysisComplete: true,
    hasStatedGoalTarget: true,
    hasLeadingOption: false,
    robustness: { status: 'computed', level: 'moderate' },
    fragileEdges: [],
    flipThresholds: null,
    factors: FACTORS,
    biasFindingTypes: [],
    phase3Items: [],
    ...extra,
  }) as unknown as StrengthenInputs

describe('the run that offers nothing else', () => {
  /**
   * ⛔ THE HOLE, PINNED. This is not a desirable state and the assertion is not
   * an endorsement of it — it is the precondition that makes the next test mean
   * something. If a future change gives this run an act by some OTHER route,
   * this REDs and someone gets to decide whether that route is honest.
   */
  it('PRECONDITION: without the producer\'s awaiting-parameters, the panel offers NOTHING', () => {
    const recs = buildRecommendations(theSilentRun())
    expect(
      recs.map((r) => r.id),
      'a card fired that this file believes is gated off — re-derive the census before trusting the test below',
    ).toEqual([])
  })

  it('the next-input card fires on exactly that run', () => {
    const recs = buildRecommendations(
      theSilentRun({
        materialParametersAwaitingUserIds: ['node_pitch'],
        analysisIdentityIsCurrent: true,
      }),
    )
    expect(recs.map((r) => r.id)).toEqual(['strengthen:next-input:node_pitch'])
  })

  /**
   * ⛔ FAIL-CLOSED, AND IT IS THE HALF THAT MATTERS ON A TRUST SURFACE. The
   * card names ONE parameter. If the analysis identity is not current, the
   * named parameter may belong to a graph the user has since changed — so the
   * card must vanish rather than point at a stale row.
   */
  it('and vanishes again when the analysis identity is not current', () => {
    const recs = buildRecommendations(
      theSilentRun({
        materialParametersAwaitingUserIds: ['node_pitch'],
        analysisIdentityIsCurrent: false,
      }),
    )
    expect(recs.map((r) => r.id)).toEqual([])
  })

  /**
   * ⛔ AND WHEN THE PRODUCER'S BLOCKING SET DOES NOT CONTAIN THE RANK-1 FACTOR.
   * Naming the second-ranked input as "the one this run turns on" would be the
   * arbitrary row dressed as the answer that `materialParametersAwaitingUser`'s
   * header forbids.
   */
  it('and vanishes when the rank-1 factor is not the one being waited on', () => {
    const recs = buildRecommendations(
      theSilentRun({
        materialParametersAwaitingUserIds: ['node_churn'],
        analysisIdentityIsCurrent: true,
      }),
    )
    expect(recs.map((r) => r.id)).toEqual([])
  })
})
