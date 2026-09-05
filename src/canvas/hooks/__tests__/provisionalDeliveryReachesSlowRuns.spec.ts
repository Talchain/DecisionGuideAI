/**
 * THE PROVISIONAL DELIVERY CLIFF — a slow-but-successful run must still arrive.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE HARM
 * ═══════════════════════════════════════════════════════════════════════════
 * `useProvisionalAnalysisDelivery` is mounted unconditionally
 * (`routes/CanvasMVP.tsx:105`, no flag). It arms when a draft turn returns
 * `analysis_state.run_state.kind === 'running'` and then re-reads the scenario
 * on a fixed schedule. Past the last offset it STOPS and writes nothing (H3).
 *
 * The schedule was tuned to the "~20s" run the hook's own header describes. A
 * run that commits AFTER the last offset is therefore never delivered at all —
 * the user waits, nothing appears, and the result only surfaces if they happen
 * to send another turn. To the user that is not "slow"; it is never.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE TWO PROPERTIES PINNED HERE, AND WHY EACH NUMBER IS DERIVED
 * ═══════════════════════════════════════════════════════════════════════════
 * P1 · THE BOUND COVERS THE SERVER'S OWN BOUND.
 *      This client already answers the identical question on the MANUAL path:
 *      `v5/getTimeoutMs.ts` sets `TURN_WAIT_MS` (130s) deliberately above
 *      `SERVER_TURN_DEADLINE_MS` (125s, CEE's `BROWSER_PROXY_TIMEOUT_MS`), on
 *      the stated invariant that **the client must never stop waiting before
 *      the server's own deadline** — because CEE runs a turn to completion and
 *      commits it whether or not the browser is still listening.
 *
 *      The provisional run is the SAME CEE -> PLoT -> ISL computation, merely
 *      scheduled by CEE instead of requested by a click. So a provisional bound
 *      BELOW the manual one abandons a class of runs this same client would
 *      have waited for had the user pressed Run. That is the defect, and the
 *      floor below is the manual path's own constant rather than a new number:
 *      P1 imports `SERVER_TURN_DEADLINE_MS` rather than restating it, so it
 *      tracks the derivation instead of mirroring it (trap 12).
 *
 * P2 · NO DEAD GAP IS WIDER THAN THE FIRST WAIT.
 *      The offsets are ABSOLUTE from arming, so the gap between consecutive
 *      offsets is exactly how long a committed result can sit undelivered. The
 *      schedule's front-loading is deliberate and stays; what P2 forbids is the
 *      gap WIDENING as the schedule runs on, which is what turned the tail into
 *      11s and 13s of silence. `delays[0]` is the ceiling because the hook has
 *      already decided that a first read is not worth taking sooner than that —
 *      so no LATER read has a reason to be lazier than the first.
 *
 * H3 · AND NEITHER OF THOSE MAY BUY ITSELF A LIE.
 *      Raising the bound must not convert "I never saw it commit" into "it did
 *      not commit". H3 is re-pinned here against the PRODUCTION schedule (no
 *      injected `delays`), because the property that matters is the one the
 *      shipped constant produces, not the one a fixture produces.
 *
 * ⚠ NO FAKE TIMERS, and no injected `delays` on the H3 case. The `wait` seam is
 * injected, so the real schedule is exercised at full speed with the delays
 * OBSERVED rather than elapsed.
 */

import { describe, it, expect, vi } from 'vitest'
import type { AnalysisStateV1 } from '@talchain/schemas/boundary'

import {
  runProvisionalDeliverySchedule,
  PROVISIONAL_DELIVERY_DELAYS_MS,
  PROVISIONAL_DELIVERY_DEADLINE_MS,
} from '../useProvisionalAnalysisDelivery'
import { SERVER_TURN_DEADLINE_MS, TURN_WAIT_MS } from '../../../v5/getTimeoutMs'
import type { ScenarioAnalysisApplyStore } from '../../hydrate/applyScenarioAnalysisRead'

const SCENARIO = 'a6ccf5cf-aab0-4f01-b889-e0d6c072067c'

/**
 * CEE's `read` tier, restated from the hook header's own derivation
 * (`cee/config/limits.ts:47-50`, 90 rpm). The limiter is keyed per CLIENT IP,
 * so boot hydration and in-session draft recovery spend the SAME bucket — which
 * is why this schedule may not simply poll fast once it is allowed to poll long.
 */
const CEE_READ_TIER_RPM = 90

/** Gaps between consecutive absolute offsets — the dead time a user sees. */
function gaps(delays: readonly number[]): number[] {
  const out: number[] = []
  let previous = 0
  for (const at of delays) {
    out.push(at - previous)
    previous = at
  }
  return out
}

function verdict(runState: AnalysisStateV1['run_state']): AnalysisStateV1 {
  return {
    run_state: runState,
    readiness: { status: 'ready', blockers: [] },
    leader_claim: { permitted: false, withheld_reason: 'separation_unavailable' },
    robustness: {},
    usable_for_prose: false,
    usable_for_chips: false,
    usable_for_followup: false,
    requires_rerun: false,
    blocked_unusable: false,
    contradictions: [],
  } as AnalysisStateV1
}

function graphResult(analysisState: AnalysisStateV1 | null) {
  return {
    status: 'graph' as const,
    graph: { nodes: [], edges: [] },
    briefText: null,
    notModelled: null,
    identity: null,
    layoutPresent: false,
    analysisState,
    analysisResult: null,
    requestId: 'req-1',
  }
}

describe('P1 — the provisional bound covers the server bound the manual path already covers', () => {
  it('does not stop waiting before CEE`s own deadline for the same computation', () => {
    // The floor is IMPORTED, not restated: if CEE's deadline moves and the
    // manual path re-derives, this pin moves with it rather than going stale.
    expect(PROVISIONAL_DELIVERY_DEADLINE_MS).toBeGreaterThanOrEqual(SERVER_TURN_DEADLINE_MS)
  })

  it('IS this client`s own turn budget for that computation, not merely within it', () => {
    // ⚠ EQUALITY, not a ceiling — and the reason is the finding that put it
    // here. The hook's own comment claims the two constants are EQUAL and that
    // the equality is held "by assertion rather than by this sentence". A
    // `<=` pin does not hold an equality: with it, the last offset could move
    // to 127_000 and every test in this file stayed GREEN while the sentence
    // went false — measured, not supposed. The sentence WAS the mirror it
    // claimed to have escaped (trap 12).
    //
    // Equality is the right predicate, not merely the one that makes the
    // sentence true: the manual and provisional paths are the SAME
    // CEE -> PLoT -> ISL computation waited on by the SAME client, so the
    // budget is one number, not two related ones. The two sides are derived
    // independently — this one from the last schedule offset in the hook, that
    // one from `v5/getTimeoutMs` — so a drift on EITHER side REDs here.
    expect(PROVISIONAL_DELIVERY_DEADLINE_MS).toBe(TURN_WAIT_MS)
  })
})

describe('P2 — the dead gap never widens past the first wait', () => {
  it('no consecutive pair of offsets leaves a longer silence than the opening one', () => {
    const g = gaps(PROVISIONAL_DELIVERY_DELAYS_MS)
    expect(Math.max(...g)).toBeLessThanOrEqual(PROVISIONAL_DELIVERY_DELAYS_MS[0])
  })

  it('the offsets are strictly increasing, so every gap is a real wait', () => {
    // Guards the pin above against being satisfied by a non-monotonic list,
    // where a negative gap would deflate the maximum without shortening
    // anything a user experiences.
    const g = gaps(PROVISIONAL_DELIVERY_DELAYS_MS)
    expect(Math.min(...g)).toBeGreaterThan(0)
  })

  it('spends at most a quarter of the shared per-IP read budget in any 60s window', () => {
    // Being ALLOWED to wait longer is not permission to poll harder. The bucket
    // is shared with boot hydration and draft recovery, so the densest window is
    // what matters, not the total.
    let peak = 0
    for (const start of PROVISIONAL_DELIVERY_DELAYS_MS) {
      const inWindow = PROVISIONAL_DELIVERY_DELAYS_MS.filter(
        (at) => at >= start && at < start + 60_000,
      ).length
      peak = Math.max(peak, inWindow)
    }
    expect(peak).toBeLessThanOrEqual(CEE_READ_TIER_RPM / 4)
  })
})

describe('H3 SURVIVES THE LONGER BOUND — expiry still invents nothing', () => {
  it('runs the PRODUCTION schedule to expiry and performs ZERO store writes', async () => {
    const setAnalysisStateV1 = vi.fn()
    const resultsComplete = vi.fn()
    const store: ScenarioAnalysisApplyStore = {
      setAnalysisStateV1,
      resultsComplete,
      currentResultsHash: null,
    }
    const waits: number[] = []
    // Every read says the run is STILL RUNNING — the exact case the longer
    // bound exists to keep waiting through, and the exact case where inventing
    // a verdict would be the lie.
    const read = vi.fn(async () => graphResult(verdict({ kind: 'running', started_at: 't0' } as never)))

    const outcome = await runProvisionalDeliverySchedule({
      scenarioId: SCENARIO,
      userId: null,
      accessToken: null,
      signal: new AbortController().signal,
      getStore: () => store,
      read: read as never,
      // NO `delays` override — this exercises the SHIPPED constant.
      wait: async (ms) => {
        waits.push(ms)
      },
    })

    expect(outcome).toBe('deadline')
    expect(setAnalysisStateV1).not.toHaveBeenCalled()
    expect(resultsComplete).not.toHaveBeenCalled()
    // It waited the whole declared bound before giving up — not less.
    expect(waits.reduce((a, b) => a + b, 0)).toBe(PROVISIONAL_DELIVERY_DEADLINE_MS)
    expect(read).toHaveBeenCalledTimes(PROVISIONAL_DELIVERY_DELAYS_MS.length)
  })
})
