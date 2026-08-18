/**
 * "What we checked" may not DENY a leading option it has no authority to deny.
 *
 * ── The defect, derived at the DEPLOYED surface ────────────────────────────
 * Driven on staging `c71ea7e0` (guest, one completed run, dock 416px), the
 * Analysis surface said BOTH of these about the same run, three screens apart:
 *
 *   · `checks-winner`             → "No clear leader"
 *   · `results-analysis-footer`   → "Stable ranking — this result held up
 *                                    under the changes we tested"
 *
 * They are not two wordings of one fact. They are two authorities:
 * `recommendation_stability` (the share of sampled scenarios in which the same
 * option came out on top) and `DecisionVerdict.hasLeadingOption` (whether the
 * producer is entitled to name a leader at all). Reconciling their DEFAULTS
 * would be the wrong fix — CLAUDE.md trap 21, two questions under similar
 * names. The fix is that ONE of them was making a claim it is not entitled to.
 *
 * ── Which one, settled at the producer's own bytes ─────────────────────────
 * `src/lib/decisionVerdict.ts` states the contract in its own doc comment:
 *
 *     `false` — surfaces must NOT badge, and MAY say "no clear leading option"
 *               (only when `separation === 'tied'`; `'unknown'` licenses
 *               silence, never a denial)
 *
 * and again at the fall-through arm: *"Fail toward SILENCE, not toward a
 * denial: `unknown` (surfaces make no claim in either direction), never
 * `tied` (which licenses 'no clear leading option' — a second claim we equally
 * have no authority for)."*
 *
 * Every other consumer in the tree honours this by WITHHOLDING (`return null`,
 * no badge) — `OptionNode`, `DecisionNode`, `OptionPanel`, `OptionCards`,
 * `V5AnalysisResultBlock`, `deriveRunPairComparison`. Withholding is correct
 * for `tied` AND `unknown` alike, so none of them had to read `separation`.
 * `T1ChecksFooter` is the ONLY consumer that turns the boolean into an
 * affirmative DENIAL — and it is exactly the consumer for which the two cases
 * differ. It read `hasLeadingOption` alone.
 *
 * ── What this spec pins ────────────────────────────────────────────────────
 * A DISCRIMINATING TRIPLE, not a single case (CLAUDE.md trap 19): the same
 * probe must return three DIFFERENT answers across the three separations, so a
 * blanket change in either direction REDs.
 *
 *   producer signal present, not a tie  → "Has leading option"   (assert)
 *   producer signal present, IS a tie   → "No clear leader"      (deny)
 *   NO producer signal (`unknown`)      → neither                (silence)
 *
 * The third row is the one that was broken. The first two are the controls
 * that stop the fix being "delete the denial", which would lose a true claim.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, renderHook } from '@testing-library/react'
import { useResultsSectionData } from '../useResultsSectionData'
import { ResultsBody } from '../ResultsBody'
import { useCanvasStore } from '../../../canvas/store'
import { mapV2ResponseToReportV1 } from '../../../adapters/plot/v2/responseMapper'
import type { V2RunResponse } from '../../../adapters/plot/v2/types'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const WINNER_ID = 'opt_wholesale'
const RUNNER_UP_ID = 'opt_retail'

/**
 * `nearTie: null` is the case the deployed run hit — the producer sent no
 * near-tie block and no `headline_banded`, so `deriveDecisionVerdict` returns
 * `separation: 'unknown'`, `source: 'none'`. It is NOT a synthetic edge case:
 * CEE withholds exactly this pair on a withheld-constraint turn while the
 * per-option win probabilities keep riding, which is why the module deleted
 * its win-probability fallback in the first place.
 */
type Signal = { isTie: boolean } | null

function makeV2Response(nearTie: Signal): V2RunResponse {
  const outcome = (mean: number) => ({
    mean,
    std: 12,
    p10: mean - 20,
    p50: mean,
    p90: mean + 20,
    n_samples: 1000,
    n_valid_samples: 1000,
    validity_ratio: 1,
  })
  return {
    analysis_status: 'computed',
    option_comparison_status: 'computed',
    robustness_status: 'computed',
    drivers_status: 'computed',
    option_comparison: [
      {
        option_id: WINNER_ID,
        option_label: 'Double Down on Wholesale',
        confidence_interval: [40, 80],
        win_probability: 0.72,
        outcome: outcome(60),
      },
      {
        option_id: RUNNER_UP_ID,
        option_label: 'Open Retail Shop',
        confidence_interval: [20, 60],
        win_probability: 0.2,
        outcome: outcome(40),
      },
    ],
    critiques: [],
    drivers: [],
    edge_sensitivity: [],
    factor_sensitivity: [],
    robustness: {
      fragile_edges: [],
      robust_edges: ['e1'],
      recommended_option_id: WINNER_ID,
      // High enough that "Stable ranking" renders in the footer — the very
      // pairing that made the contradiction visible on the deployed surface.
      recommendation_stability: 0.92,
      ...(nearTie
        ? {
            near_tie: {
              is_tie: nearTie.isTie,
              top_option_id: WINNER_ID,
              second_option_id: RUNNER_UP_ID,
              gap: 0.52,
              threshold: 0.1,
            },
          }
        : {}),
    } as never,
    response_hash: 'h',
    meta: { seed_used: '42', n_samples: 1000, detail_level: 'standard', latency_ms: 100 },
  } as V2RunResponse
}

const OPTION_NODES = [
  {
    id: WINNER_ID,
    type: 'option',
    position: { x: 0, y: 0 },
    data: { kind: 'option', type: 'option', label: 'Double Down on Wholesale' },
  },
  {
    id: RUNNER_UP_ID,
    type: 'option',
    position: { x: 400, y: 0 },
    data: { kind: 'option', type: 'option', label: 'Open Retail Shop' },
  },
]

function setStore(nearTie: Signal): void {
  const v2 = makeV2Response(nearTie)
  useCanvasStore.setState({
    results: { status: 'complete', progress: 100, report: mapV2ResponseToReportV1(v2, { seed: 42 }) },
    runMeta: {},
    nodes: OPTION_NODES,
    edges: [],
    hasCompletedFirstRun: true,
    rawV2Response: v2,
    goalThreshold: null,
    viewMode: 'expert',
  } as never)
}

/**
 * The check as a user reads it — bound to the testid, never to page text —
 * together with the separation the FOOTER'S OWN data carries.
 *
 * PRECONDITION PIN (CLAUDE.md 13b): the separation is read from
 * `useResultsSectionData().recommendation.verdict`, i.e. the identical object
 * `T1ChecksFooter` consumes, so a green result cannot come from a fixture that
 * quietly stopped reproducing the state under test.
 */
function readWinnerCheck(): { label: string; separation: string } {
  const { result } = renderHook(() => useResultsSectionData())
  const separation = result.current.recommendation.verdict?.separation ?? '<no verdict>'
  const { container } = render(
    <ResultsBody
      resultsSectionData={result.current}
      tornadoData={{ rows: [], expectedOutcome: null }}
    />,
  )
  const el = container.querySelector('[data-testid="checks-winner"]')
  if (!el) throw new Error('checks-winner did not render — the probe is blind, not the product silent')
  return { label: (el.textContent ?? '').replace(/\s+/g, ' ').trim(), separation }
}

describe('checks-winner: no denial without authority', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      results: null,
      rawV2Response: null,
      nodes: [],
      edges: [],
      hasCompletedFirstRun: false,
    } as never)
    document.body.innerHTML = ''
  })

  it('producer says NOT a tie → the check ASSERTS a leading option', () => {
    setStore({ isTie: false })
    const { label, separation } = readWinnerCheck()
    expect(separation).toBe('clear')
    expect(label).toBe('Has leading option')
  })

  it('producer says IS a tie → the check DENIES a leading option', () => {
    setStore({ isTie: true })
    const { label, separation } = readWinnerCheck()
    expect(separation).toBe('tied')
    expect(label).toBe('No clear leader')
  })

  it('producer sent NO signal → the check makes NO claim in either direction', () => {
    setStore(null)
    const { label, separation } = readWinnerCheck()
    // Precondition: this really is the no-authority state, not a tie.
    expect(separation).toBe('unknown')

    expect(
      label,
      `"No clear leader" is a DENIAL. decisionVerdict.ts: "'unknown' licenses silence, never a denial." Read: ${label}`,
    ).not.toMatch(/No clear leader/i)
    expect(label).not.toMatch(/Has leading option/i)
  })

  it('the three separations produce three DIFFERENT labels — the probe discriminates', () => {
    setStore({ isTie: false })
    const clear = readWinnerCheck().label
    document.body.innerHTML = ''
    setStore({ isTie: true })
    const tied = readWinnerCheck().label
    document.body.innerHTML = ''
    setStore(null)
    const unknown = readWinnerCheck().label

    expect(new Set([clear, tied, unknown]).size, `clear="${clear}" tied="${tied}" unknown="${unknown}"`).toBe(3)
  })
})
