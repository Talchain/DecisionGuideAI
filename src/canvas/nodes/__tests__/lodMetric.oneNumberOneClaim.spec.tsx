/**
 * One datum, one claim — at every zoom level.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE DEFECT
 * ─────────────────────────────────────────────────────────────────────────────
 * At full zoom a factor card says **"Most influential · of 5"**. At the reduced
 * rung the same card said **"Influence 62%"**. One number, two different
 * claims, eight pixels of zoom apart — and the bare percentage is the one that
 * invites the wrong reading (*62% of the answer*), which is not what relative
 * influence measures.
 *
 * ⛔ THE PERCENTAGE IS NOT THE DEFECT. `FactorNode:762,780` renders it too, on
 * the same branch, when the rank is unlicensed — so it is a legitimate
 * fallback. What was wrong was taking that fallback where a rank EXISTED,
 * because the reduced line had no rank arm at all.
 *
 * ⭐ WHY IT COULD NOT SIMPLY BE READ. A rank is licensed by TWO conditions and
 * one of them is a STORE question: `useAnalysisResultsAreCurrent`. A resolver
 * handed only `data` and `displayMetadata` can never answer it — the same
 * shape as an option's change count, and the reason `LodMetricFacts` exists.
 * The pair now lives in `useInfluenceRank`, which both surfaces read.
 *
 * CLAIM SCOPE (trap 3): jsdom proves the STRING, never the pixels it occupies.
 */
import { describe, it, expect } from 'vitest'
import { resolveLodMetricLineDetail } from '../shared/lodMetricLine'
import { influenceRankReadout } from '../../../components/results/influenceScaleCopy'
import { METRIC_NOUN } from '../shared/metricVocabulary'

/** No stated value, so the resolver reaches its influence arm. */
const FACTOR_WITH_ONLY_AN_INFLUENCE_SCORE = {
  label: 'Conversion Rate',
  kind: 'factor',
  category: 'controllable',
  observedState: { source: 'cee_inference' },
}

const metadata = {
  sensitivityRank: 1,
  influence: 0.62,
  influenceProvenance: 'analysis',
  influenceSetSize: 5,
  confidence: null,
  inSensitivityAnalysis: false,
  achievementProbability: null,
  achievementProbabilityIsModelledBasis: null,
  stabilityPercentage: null,
  winRate: null,
  isResultsMode: true,
}

const line = (facts?: Record<string, unknown>) =>
  resolveLodMetricLineDetail({
    nodeType: 'factor',
    data: FACTOR_WITH_ONLY_AN_INFLUENCE_SCORE,
    label: 'Conversion Rate',
    displayMetadata: metadata as never,
    facts: facts as never,
  }).text

describe('the reduced line names the rank the card names', () => {
  it('⭐ says what the card says when a rank is licensed — RED at pristine, where it said "Influence 62%"', () => {
    // The readout is built by its OWNER, not re-typed here, so this asserts
    // agreement with the card rather than agreement with my memory of it.
    const readout = influenceRankReadout(1, 5)
    expect(readout, 'the owner refused to license this fixture — it is vacuous').not.toBeNull()

    const text = line({ influenceRank: readout })
    expect(text).toContain(readout!.caption)
    expect(text).toContain(readout!.setSizeText)
  })

  it('⛔ keeps the DENOMINATOR, because the caption alone is the half a reader cannot check', () => {
    const text = line({ influenceRank: influenceRankReadout(2, 5) })
    expect(text).toContain('of 5')
    // "2nd most influential" without "of 5" is a claim with no scale — the same
    // defect as the bare percentage, wearing the other costume.
    expect(text).not.toBe('2nd most influential')
  })

  it('CONTRAST — falls back to the licensed percentage when NO rank is available', () => {
    const text = line(undefined)
    expect(text).toBe(`${METRIC_NOUN.influence} 62%`)
  })

  it('CONTRAST — a stale run withholds the rank rather than naming the wrong factor', () => {
    // `useInfluenceRank` returns null when the results are not current. The
    // resolver must then behave exactly as if no rank existed: a rank is a
    // comparison ACROSS factors, so a stale one does not merely age — it names
    // a different factor as the leader.
    const text = line({ influenceRank: null })
    expect(text).toBe(`${METRIC_NOUN.influence} 62%`)
  })

  it('PINS THE OWNER’S OWN GUARD — a set of one licenses no rank at either rung', () => {
    expect(influenceRankReadout(1, 1)).toBeNull()
    expect(line({ influenceRank: influenceRankReadout(1, 1) })).toBe(
      `${METRIC_NOUN.influence} 62%`,
    )
  })
})
