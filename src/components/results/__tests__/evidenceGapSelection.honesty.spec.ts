/**
 * Evidence-gap SELECTION and ORDER — post-EVPI-removal contract.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE IS THE JUSTIFICATION FOR THE PR
 * ─────────────────────────────────────────────────────────────────────────────
 * `evpi_percentage_points` was not only printed to users, it was a SELECTION
 * GATE:
 *
 *     topEvidenceGaps = evidenceGaps.filter(g => (g.evpiPp ?? 0) > 0)
 *                                   .sort((a, b) => b.evpiPp - a.evpiPp)
 *                                   .slice(0, 3)
 *
 * Deleting the number without replacing BOTH halves empties the list rather
 * than merely misordering it — a strictly worse regression than the defect.
 * So the load-bearing assertions here are the NON-EMPTY ones.
 *
 * The number is refuted at the bytes: for staging decision `50b336a6`, PLoT
 * publishes `evpi_percentage_points: 12.3` for *Market Receptivity to Feature*
 * while ISL, in the same response one level away, measures the same factor at
 * `p_win_delta_percentage_points: 0.0` and `factor_evppi: 0.0`. The formula
 * (`voi × winProbSpread × 100`, PLoT `coaching/evidence-gaps.ts:75`) multiplies
 * BY the top-two win-probability gap, inverting decision theory: a foregone
 * conclusion scores high, a coin-flip scores ~0.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE REPLACEMENT
 * ─────────────────────────────────────────────────────────────────────────────
 * SELECTION — the producer's own membership decision; the UI adds no numeric
 * gate. PLoT already selects: non-lever ∧ top-k by ISL `importance_rank` ∧
 * `confidence < 0.7` (`coaching/evidence-gaps.ts`). That is a definition the
 * product can defend in words — "a factor that matters, that we are unsure
 * about" — and it contains no EVPI. The UI's `evpiPp > 0` was a SECOND gate
 * stacked on top of it. It is deleted, not swapped for another number.
 *
 * ORDER — the producer's emission order, with no client-side re-rank and no
 * on-screen claim that the order means value. This is not a downgrade:
 * `evpi_pp = voi × winProbSpread × 100` where `winProbSpread` is a SINGLE
 * PER-RESPONSE SCALAR, so within one response "by evpiPp desc" and "by voi
 * desc" are the SAME ordering — and "by voi desc" is exactly what PLoT emits.
 * Preserving producer order therefore reproduces the previous on-screen order
 * on live data while removing the dependence on the refuted quantity.
 *
 * CLAIM TYPE: these are data-layer assertions on the hook's return value —
 * list membership, length and array order. They are NOT visibility claims.
 * jsdom cannot prove visibility; nothing here pretends to.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useResultsSectionData } from '../useResultsSectionData'
import { useCanvasStore } from '../../../canvas/store'

interface RawGap {
  factor_id: string
  factor_label: string
  voi_score?: number
  confidence?: number
  influence?: number
  suggestion?: string
  evpi_percentage_points?: number
  evpi_method?: string
}

function setStore(gaps: RawGap[]): void {
  useCanvasStore.setState({
    results: { status: 'complete', progress: 100, report: {} } as any,
    runMeta: { m1Coaching: { evidence_gaps: gaps } } as any,
    nodes: [],
    edges: [],
    hasCompletedFirstRun: true,
    rawV2Response: null,
  } as any)
}

function gapsFromHook() {
  const { result } = renderHook(() => useResultsSectionData())
  return {
    all: result.current.confidence.evidenceGaps ?? [],
    top: result.current.confidence.topEvidenceGaps ?? [],
  }
}

/**
 * Verbatim shape of the two staging decisions replayed against live PLoT
 * `1dd45b6a` (which called ISL `3aea011c`). Reproduced from the captured
 * wire payloads, EXCEPT that `evpi_percentage_points` is varied per test.
 */
const LIVE_A4B32EE2: RawGap[] = [
  {
    factor_id: 'fac_team_experience',
    factor_label: 'Existing Team Experience Level',
    voi_score: 0.3764947747747747,
    confidence: 0.4398,
    influence: 0.672072072072072,
    suggestion: 'Gather data on "Existing Team Experience Level" to reduce uncertainty',
  },
  {
    factor_id: 'fac_salary_cost',
    factor_label: 'Annual Salary Cost',
    voi_score: 0.24330810810810807,
    confidence: 0.43735,
    influence: 0.4324324324324324,
    suggestion: 'Gather data on "Annual Salary Cost" to reduce uncertainty',
  },
]

const LIVE_50B336A6: RawGap[] = [
  {
    factor_id: 'fac_market_receptivity',
    factor_label: 'Market Receptivity to Feature',
    voi_score: 0.14991999999999997,
    confidence: 0.4378,
    influence: 0.2666666666666666,
    suggestion: 'Gather data on "Market Receptivity to Feature" to reduce uncertainty',
  },
]

function withEvpi(gaps: RawGap[], values: number[]): RawGap[] {
  return gaps.map((g, i) => ({ ...g, evpi_percentage_points: values[i], evpi_method: 'heuristic' }))
}

beforeEach(() => {
  useCanvasStore.setState({
    results: null,
    runMeta: null,
    rawV2Response: null,
    nodes: [],
    edges: [],
    hasCompletedFirstRun: false,
  } as any)
})

describe('evidence-gap selection — the list stays populated without EVPI', () => {
  /**
   * POSITIVE CONTROL (trap 13). Every "still populated" assertion below is
   * worthless unless this harness can be shown to produce a populated list in
   * the first place, AND to produce an EMPTY one when the producer genuinely
   * sends nothing. Both directions are proven here before anything else runs.
   */
  it('POSITIVE CONTROL: the harness discriminates — populated in, populated out; empty in, empty out', () => {
    setStore(withEvpi(LIVE_A4B32EE2, [10.2, 6.6]))
    const present = gapsFromHook()
    expect(present.all).toHaveLength(2)
    expect(present.top).toHaveLength(2)
    expect(present.top.map(g => g.factorId)).toEqual(['fac_team_experience', 'fac_salary_cost'])

    setStore([])
    const absent = gapsFromHook()
    expect(absent.all).toHaveLength(0)
    expect(absent.top).toHaveLength(0)
  })

  /**
   * ⭐ THE TEST THAT MATTERS MOST.
   *
   * `computeEvpiPercentagePoints` (PLoT `lib/evpi-emission.ts`) returns
   * `undefined` when `winProbSpread <= 0` — i.e. on a PERFECT TIE between the
   * top two options, which is the case where information is MOST valuable.
   * PLoT then omits `evpi_percentage_points` entirely, the old UI turned that
   * absence into 0 via `?? 0`, `0 > 0` was false, and EVERY gap was dropped.
   *
   * A user with a genuinely close decision saw NO suggested evidence gaps.
   */
  it('shows every gap when the producer omits evpi_percentage_points entirely (the perfect-tie case)', () => {
    setStore(LIVE_A4B32EE2) // no evpi_percentage_points on either gap
    const { all, top } = gapsFromHook()

    expect(all).toHaveLength(2)
    expect(top).toHaveLength(2)
    expect(top.map(g => g.factorLabel)).toEqual([
      'Existing Team Experience Level',
      'Annual Salary Cost',
    ])
  })

  it('shows a gap the producer scored at exactly 0pp', () => {
    setStore(withEvpi(LIVE_50B336A6, [0]))
    const { top } = gapsFromHook()

    expect(top).toHaveLength(1)
    expect(top[0].factorId).toBe('fac_market_receptivity')
  })

  it('shows a mixed set where only some gaps carry a positive figure', () => {
    setStore([
      { ...LIVE_A4B32EE2[0], evpi_percentage_points: 10.2 },
      { ...LIVE_A4B32EE2[1] }, // absent
      {
        factor_id: 'fac_third',
        factor_label: 'Third Factor',
        voi_score: 0.1,
        confidence: 0.5,
        evpi_percentage_points: 0,
      },
    ])
    const { top } = gapsFromHook()

    expect(top).toHaveLength(3)
    expect(top.map(g => g.factorId)).toEqual([
      'fac_team_experience',
      'fac_salary_cost',
      'fac_third',
    ])
  })

  it('a user who previously saw gaps still sees the same ones — live 50b336a6 replay', () => {
    // Under the old gate this survived (12.3 > 0). It must still survive.
    setStore(withEvpi(LIVE_50B336A6, [12.3]))
    expect(gapsFromHook().top.map(g => g.factorId)).toEqual(['fac_market_receptivity'])
  })
})

describe('evidence-gap order — producer order, no client-side re-rank', () => {
  it('preserves producer emission order rather than re-sorting by any score', () => {
    // Producer order here is DELIBERATELY not evpi-descending: if the UI still
    // re-ranked, it would emit [big, mid, small] instead of the emitted order.
    setStore([
      { factor_id: 'g_small', factor_label: 'Small', voi_score: 0.1, evpi_percentage_points: 1 },
      { factor_id: 'g_big', factor_label: 'Big', voi_score: 0.9, evpi_percentage_points: 90 },
      { factor_id: 'g_mid', factor_label: 'Mid', voi_score: 0.5, evpi_percentage_points: 50 },
    ])
    expect(gapsFromHook().top.map(g => g.factorId)).toEqual(['g_small', 'g_big', 'g_mid'])
  })

  it('does not re-rank the full evidenceGaps list either', () => {
    setStore([
      { factor_id: 'g_small', factor_label: 'Small', voi_score: 0.1, evpi_percentage_points: 1 },
      { factor_id: 'g_big', factor_label: 'Big', voi_score: 0.9, evpi_percentage_points: 90 },
    ])
    expect(gapsFromHook().all.map(g => g.factorId)).toEqual(['g_small', 'g_big'])
  })

  it('still caps at three and still dedupes by factor_id', () => {
    setStore([
      { factor_id: 'a', factor_label: 'A', voi_score: 0.5 },
      { factor_id: 'a', factor_label: 'A duplicate', voi_score: 0.4 },
      { factor_id: 'b', factor_label: 'B', voi_score: 0.3 },
      { factor_id: 'c', factor_label: 'C', voi_score: 0.2 },
      { factor_id: 'd', factor_label: 'D', voi_score: 0.1 },
    ])
    const { all, top } = gapsFromHook()

    expect(all.map(g => g.factorId)).toEqual(['a', 'b', 'c', 'd']) // deduped, order kept
    expect(top.map(g => g.factorId)).toEqual(['a', 'b', 'c'])       // capped at 3
  })
})

describe('evidence-gap items carry no EVPI figure', () => {
  it('never exposes evpiPp on a gap item, even when the producer sends one', () => {
    setStore(withEvpi(LIVE_A4B32EE2, [10.2, 6.6]))
    const { all, top } = gapsFromHook()

    for (const gap of [...all, ...top]) {
      expect('evpiPp' in gap, `${gap.factorId} must not carry evpiPp`).toBe(false)
      expect(Object.values(gap)).not.toContain(10.2)
      expect(Object.values(gap)).not.toContain(6.6)
    }
  })

  it('still carries the fields the honest surface needs', () => {
    // Guards against "removal" being implemented by emptying the item.
    setStore(withEvpi(LIVE_A4B32EE2, [10.2, 6.6]))
    const first = gapsFromHook().top[0]

    expect(first.factorId).toBe('fac_team_experience')
    expect(first.factorLabel).toBe('Existing Team Experience Level')
    expect(first.suggestion).toContain('Existing Team Experience Level')
    expect(first.voi).toBeCloseTo(0.3764947747747747, 10)
    // Absence still preserved, not fabricated as 0 (the F6 gate next door).
    expect(first.confidence).toBeCloseTo(0.4398, 10)
  })

  it('preserves absent confidence as null rather than fabricating zero', () => {
    setStore([{ factor_id: 'x', factor_label: 'X', voi_score: 0.2 }])
    expect(gapsFromHook().top[0].confidence).toBeNull()
  })
})
