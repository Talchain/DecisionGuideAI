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
 *
 * ── Run-4 judge (DL 12 Oct, the class) ─────────────────────────────────────
 * The assert row ("one option was supported by more runs than any other") was
 * a leader claim from a win share, and the silence row's words ("…: not
 * assessed") went with it. Both are removed and nothing replaces them: in those
 * states the row is NOT DRAWN. The triple is now
 *
 *   producer signal present, not a tie, shares apart → row absent
 *   producer signal present, IS a tie                → "no option … clearly more runs" (deny)
 *   NO producer signal (`unknown`)                   → row absent           (silence)
 *   permitted leader, shares within 10 pts           → "similar shares of runs"
 *
 * The tie denial is still the only denial, and absence is always read beside a
 * contrast control (the footer and its robustness row rendered in the same
 * render), so "absent" cannot come from a blind probe.
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
/** The two options' shares of runs (`win_probability`). Default: a 52-pt gap. */
type Shares = readonly [winner: number, runnerUp: number]

function makeV2Response(nearTie: Signal, shares: Shares = [0.72, 0.2]): V2RunResponse {
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
        win_probability: shares[0],
        outcome: outcome(60),
      },
      {
        option_id: RUNNER_UP_ID,
        option_label: 'Open Retail Shop',
        confidence_interval: [20, 60],
        win_probability: shares[1],
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
              gap: shares[0] - shares[1],
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

function setStore(nearTie: Signal, shares?: Shares): void {
  const v2 = makeV2Response(nearTie, shares)
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
type WinnerProbe = {
  /** The row's text, or `null` when the row is not drawn (the two states the Run-4 judge removed). */
  label: string | null
  /** The whole "What we checked" footer's text — for negatives that must hold whether or not the row is drawn. */
  footerText: string
  separation: string
  gapPp: number | null
  permitted: boolean | undefined
}

function probeWinnerCheck(): WinnerProbe {
  const { result } = renderHook(() => useResultsSectionData())
  const separation = result.current.recommendation.verdict?.separation ?? '<no verdict>'
  const gapPp = result.current.recommendation.verdict?.gapPp ?? null
  const permitted = result.current.recommendation.leaderDesignationPermitted
  const { container } = render(
    <ResultsBody
      resultsSectionData={result.current}
      tornadoData={{ rows: [], expectedOutcome: null }}
    />,
  )
  // CONTRAST CONTROL: the footer and its robustness row render in this same render, so a missing leader row is the
  // product's absence, not a blind probe.
  const footer = container.querySelector('[data-testid="t1-checks-footer"]')
  if (!footer) throw new Error('t1-checks-footer did not render — the probe is blind, not the product silent')
  if (!footer.querySelector('[data-testid="checks-robust"]')) {
    throw new Error('checks-robust did not render — the contrast control is blind')
  }
  const el = footer.querySelector('[data-testid="checks-winner"]')
  return {
    label: el ? (el.textContent ?? '').replace(/\s+/g, ' ').trim() : null,
    footerText: (footer.textContent ?? '').replace(/\s+/g, ' ').trim(),
    separation,
    gapPp,
    permitted,
  }
}

/** For the states where the row MUST render: a missing row is a blind probe, never a pass. */
function readWinnerCheck(): Omit<WinnerProbe, 'label'> & { label: string } {
  const probe = probeWinnerCheck()
  if (probe.label == null) throw new Error('checks-winner did not render — the probe is blind, not the product silent')
  return { ...probe, label: probe.label }
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

  it('producer says NOT a tie, shares apart → the leader row is NOT DRAWN (no leader claim from a win share)', () => {
    setStore({ isTie: false })
    const { label, footerText, separation, permitted } = probeWinnerCheck()
    expect(separation).toBe('clear')
    expect(permitted).toBe(true)
    // Run-4 judge (DL 12 Oct, the class): "one option was supported by more runs than any other" is removed; nothing
    // replaces it.
    expect(label).toBeNull()
    expect(footerText).not.toMatch(/more runs than any other/i)
    // J4 (Acceptance cut-4 prod; DL #87): a win-share leader is a share of runs, never a chance — no "most likely".
    expect(footerText).not.toMatch(/most likely|\bchance\b/i)
    // …and no denial either: the producer said NOT a tie.
    expect(footerText).not.toMatch(/no option was supported by clearly more runs/i)
  })

  /**
   * ⭐ J4 — THE NEAR TIE (Acceptance cut-4 prod: a permitted leader 4.4 pts ahead; DL ruling 6 Oct). "Supported by
   * more runs than any other" is true at any gap, so it is a crown on a near tie. Within 10 pts of the next run share
   * the row says the shares were similar, and names no ranking.
   */
  it('J4: a PERMITTED leader only 4 pts ahead in run share → similar shares, no comparative', () => {
    setStore({ isTie: false }, [0.47, 0.43])
    const { label, separation, gapPp, permitted } = readWinnerCheck()
    // PRECONDITION: a permitted leader (the producer said not a tie) at a 4-pt gap — the state J4 witnessed.
    expect(permitted).toBe(true)
    expect(separation).toBe('slight')
    expect(gapPp).toBe(4)
    expect(label).toBe('In this model, the options were supported by similar shares of runs')
    expect(label).not.toMatch(/more runs than any other|most likely|chance|\b(best|lead\w*|ahead|winner)\b/i)
  })

  it('J4 boundary: exactly 10 pts apart → not similar shares (the producer\u2019s own near-tie line), so the row is not drawn', () => {
    setStore({ isTie: false }, [0.55, 0.45])
    const { label, footerText, gapPp, permitted } = probeWinnerCheck()
    expect(permitted).toBe(true)
    expect(gapPp).toBe(10)
    // Run-4 judge (DL 12 Oct, the class): the comparative that stood here is removed; nothing replaces it. The boundary
    // stays pinned: a 10-pt gap is NOT "similar shares" (that label here would draw the row → RED).
    expect(label).toBeNull()
    expect(footerText).not.toMatch(/more runs than any other|similar shares of runs/i)
  })

  it('producer says IS a tie → the check DENIES a leading option', () => {
    setStore({ isTie: true })
    const { label, separation } = readWinnerCheck()
    expect(separation).toBe('tied')
    expect(label).toBe('In this model, no option was supported by clearly more runs than the others')
  })

  it('producer sent NO signal → the check makes NO claim in either direction', () => {
    setStore(null)
    const { label, footerText, separation } = probeWinnerCheck()
    // Precondition: this really is the no-authority state, not a tie.
    expect(separation).toBe('unknown')

    // Run-4 judge (DL 12 Oct, the class): the "…: not assessed" row is removed; nothing replaces it. Silence is now the
    // row's absence.
    expect(label).toBeNull()
    expect(
      footerText,
      `"No clear leader" is a DENIAL. decisionVerdict.ts: "'unknown' licenses silence, never a denial." Read: ${footerText}`,
    ).not.toMatch(/no option was supported by clearly more runs|no option is clearly most likely/i)
    expect(footerText).not.toMatch(/one option was supported by more runs than any other/i)
  })

  it('the separations produce DIFFERENT outcomes — the probe discriminates (tie denies, unknown is silent)', () => {
    setStore({ isTie: false })
    const clear = probeWinnerCheck().label
    document.body.innerHTML = ''
    setStore({ isTie: true })
    const tied = probeWinnerCheck().label
    document.body.innerHTML = ''
    setStore(null)
    const unknown = probeWinnerCheck().label
    document.body.innerHTML = ''
    setStore({ isTie: false }, [0.47, 0.43])
    const similar = probeWinnerCheck().label

    // Run-4 judge (DL 12 Oct, the class): the clear-leader and undetermined rows are removed; nothing replaces them.
    // The tie denial and the similar-shares fact still render, and differ, so a blanket change in either direction REDs.
    expect({ clear, tied, unknown, similar }).toEqual({
      clear: null,
      tied: 'In this model, no option was supported by clearly more runs than the others',
      unknown: null,
      similar: 'In this model, the options were supported by similar shares of runs',
    })
  })
})
