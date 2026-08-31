/**
 * THE EXCLUSION IS ONLY AS LIVE AS THE FIELD THAT REACHES IT.
 *
 * `deriveDecisionVerdict` drops an option the producer classified `'failed'`.
 * It can only do that if `option_probabilities[id].status` actually arrives —
 * and TWO of its three feeders rebuild that object KEY BY KEY:
 *
 *   · `buildV5VerdictReportLike` (`src/v5/mapV5AnalysisToReport.ts`) — the
 *     V5 analysis block's view, used by `V5AnalysisResultBlock`.
 *   · `deriveRunLeaderVerdict` (`src/canvas/stores/analysisSnapshotFactory.ts`,
 *     module-private, reached through `buildAnalysisSnapshot`) — the Compare
 *     tab's per-run verdict, reshaped from `option_comparison`.
 *
 * A rebuild that does not NAME a field drops it even though it arrived intact
 * on the wire. That is the exact mechanism this repo already paid for once at
 * the V2 mapper, and it is why these tests exist as a separate file from the
 * predicate's own: the predicate can be perfect and the fix still DARK on two
 * of three surfaces, with every test in `decisionVerdict.failedOptions.spec.ts`
 * green — because that file feeds the module directly and never crosses the
 * seam where the field is lost.
 *
 * So these drive the REAL producers with REAL wire shapes into the REAL
 * predicate. A hand-written `DecisionVerdictReportLike` literal would prove
 * nothing about either carrier: it would be a fixture of this file's own
 * authorship, encoding my model of the mapper rather than the mapper.
 */

import { describe, it, expect } from 'vitest'
import { buildV5VerdictReportLike } from '../../v5/mapV5AnalysisToReport'
import { buildAnalysisSnapshot } from '../../canvas/stores/analysisSnapshotFactory'
import type { V2RunResponse } from '../../adapters/plot/v2/types'
import { deriveDecisionVerdict } from '../decisionVerdict'

const REAL = 'opt_real'
const FAILED = 'opt_failed'
const RIVAL = 'opt_rival'

describe('buildV5VerdictReportLike carries the producer status to the verdict', () => {
  /**
   * A V5 analysis block in the shape CEE puts on the wire. `option_comparison`
   * is the only producer array that carries `status`; `win_probabilities` is
   * the sibling id→number map the mapper joins against.
   */
  const block = (failedStatus: string | undefined) => ({
    win_probabilities: { [REAL]: 0.71, [FAILED]: 0 },
    enrichment: {
      option_comparison: [
        { id: REAL, option_label: 'Keep the lease', win_probability: 0.71, status: 'computed' },
        {
          id: FAILED,
          option_label: 'Buy the freehold',
          // ISL emits this pair together: zero finite samples, and PLoT
          // forwards a finite 0 beside the classification.
          win_probability: 0,
          ...(failedStatus !== undefined ? { status: failedStatus } : {}),
        },
      ],
      robustness: {
        recommended_option_id: REAL,
        near_tie: { is_tie: false, top_option_id: REAL, gap: 0.71, threshold: 0.1 },
      },
    },
  })

  it('the status reaches the view — it is not dropped by the key-by-key rebuild', () => {
    // Bound to the FIELD, by option id. This is the assertion that REDs if the
    // pass-through is ever reverted, and it is deliberately separate from the
    // behavioural one below: a behavioural test alone cannot say WHY it failed.
    const view = buildV5VerdictReportLike(block('failed'))
    expect(view.option_probabilities?.[FAILED]?.status).toBe('failed')
    expect(view.option_probabilities?.[REAL]?.status).toBe('computed')
  })

  it('so a run with ONE computed option + ONE failed option authors no leader', () => {
    const v = deriveDecisionVerdict(buildV5VerdictReportLike(block('failed')))
    expect(v.hasLeadingOption).toBe(false)
    expect(v.separation).toBe('unknown')
  })

  it('DISCRIMINATING TWIN — the same block WITHOUT the failed status still leads', () => {
    // Differs from the case above in exactly one wire field. If the exclusion
    // had been bought by suppressing the V5 path generally, this REDs.
    const v = deriveDecisionVerdict(buildV5VerdictReportLike(block(undefined)))
    expect(v.hasLeadingOption).toBe(true)
    expect(v.leaderId).toBe(REAL)
  })

  it('absent in ⇒ absent out: no status key is manufactured for an option without one', () => {
    const view = buildV5VerdictReportLike(block(undefined))
    expect(view.option_probabilities?.[FAILED]).not.toHaveProperty('status')
  })
})

describe('buildAnalysisSnapshot carries the producer status to the run verdict', () => {
  const v2 = (failedStatus: string | undefined): V2RunResponse =>
    ({
      response_hash: 'resp-carrier',
      option_comparison: [
        {
          option_id: REAL,
          option_label: 'Keep the lease',
          confidence_interval: [0, 1],
          win_probability: 0.71,
          status: 'computed',
        },
        {
          option_id: FAILED,
          option_label: 'Buy the freehold',
          confidence_interval: [0, 1],
          win_probability: 0,
          ...(failedStatus !== undefined ? { status: failedStatus } : {}),
        },
      ],
      robustness: {
        recommended_option_id: REAL,
        near_tie: { is_tie: false, top_option_id: REAL, gap: 0.71, threshold: 0.1 },
      },
      factor_sensitivity: [
        {
          node_id: 'fac-rent',
          factor_label: 'Rent growth',
          elasticity: 0.41,
          rank_flip_rate: 0.05,
          attribution_stability: 'stable',
        },
      ],
    }) as unknown as V2RunResponse

  const snapshotFrom = (raw: V2RunResponse) =>
    buildAnalysisSnapshot({
      rawV2Response: raw,
      report: null,
      nodes: null,
      edges: null,
      runNumber: 1,
      events: [],
      previousSnapshotTimestamp: null,
    })

  it('a failed option does not entitle a leader claim on the Compare tab', () => {
    const snap = snapshotFrom(v2('failed'))
    expect(snap.leaderVerdict.hasLeadingOption).toBe(false)
    expect(snap.leaderVerdict.separation).toBe('unknown')
  })

  it('DISCRIMINATING TWIN — the same run WITHOUT the failed status still leads', () => {
    const snap = snapshotFrom(v2(undefined))
    expect(snap.leaderVerdict.hasLeadingOption).toBe(true)
    expect(snap.leaderVerdict.leaderId).toBe(REAL)
  })

  it('DISCRIMINATING TWIN — two genuinely computed options still lead', () => {
    // Proves the suppression is about the STATUS and not about this payload
    // shape, the option count, or the near-tie block.
    const raw = v2(undefined)
    ;(raw.option_comparison as unknown as Array<Record<string, unknown>>)[1] = {
      option_id: RIVAL,
      option_label: 'Buy the freehold',
      confidence_interval: [0, 1],
      win_probability: 0.29,
      status: 'computed',
    }
    const snap = snapshotFrom(raw)
    expect(snap.leaderVerdict.hasLeadingOption).toBe(true)
    expect(snap.leaderVerdict.leaderId).toBe(REAL)
  })
})
