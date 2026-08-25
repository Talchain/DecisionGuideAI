/**
 * ROADMAP 2.1271 — THE BOUNDED DELIVERY SCHEDULE.
 *
 * Pins the three properties that make this delivery honest, on the extracted
 * core (`runProvisionalDeliverySchedule`) rather than through React, so each one
 * is provable rather than inferred from a rendered surface:
 *
 *  H3 · IT IS BOUNDED, AND ON EXPIRY IT INVENTS NOTHING. A `running` claim can
 *       outlive its run (the dispatch throws, the already-analysed guard skips,
 *       a process restarts). So the wait ends — and when it does, ZERO store
 *       writes have happened. It does not synthesise `unknown_degraded` or any
 *       other verdict: those are the producer's words.
 *
 *  H4 · A NON-TERMINAL READ KEEPS IT WAITING AND WRITES NOTHING. This is the
 *       same guard as `applyScenarioAnalysisRead`'s, asserted here at the LOOP
 *       level: a `never_run` read must not settle the schedule either, or the
 *       first mid-run read would end the wait and the result would never arrive.
 *
 *  BUDGET · The read route's limiter is per CLIENT IP and shared with boot
 *       hydration and draft recovery. The schedule's read COUNT is asserted, so
 *       a later "just poll every second" cannot land without failing a test.
 *
 * ⚠ NO FAKE TIMERS. The `wait` seam is injected, so the schedule is exercised at
 * full speed with the DELAYS OBSERVED rather than elapsed. A fake-timer harness
 * would prove the loop ran; injecting the clock proves WHAT IT ASKED FOR.
 */

import { describe, it, expect, vi } from 'vitest'
import type { AnalysisStateV1 } from '@talchain/schemas/boundary'

import {
  runProvisionalDeliverySchedule,
  PROVISIONAL_DELIVERY_DELAYS_MS,
  PROVISIONAL_DELIVERY_DEADLINE_MS,
} from '../useProvisionalAnalysisDelivery'
import type { ScenarioAnalysisApplyStore } from '../../hydrate/applyScenarioAnalysisRead'

const SCENARIO = 'a6ccf5cf-aab0-4f01-b889-e0d6c072067c'

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

function graphResult(analysisState: AnalysisStateV1 | null, analysisResult: unknown = null) {
  return {
    status: 'graph' as const,
    graph: { nodes: [], edges: [] },
    briefText: null,
    notModelled: null,
    identity: null,
    layoutPresent: false,
    analysisState,
    analysisResult,
    requestId: 'req-1',
  }
}

interface Harness {
  readonly store: ScenarioAnalysisApplyStore
  readonly setAnalysisStateV1: ReturnType<typeof vi.fn>
  readonly resultsComplete: ReturnType<typeof vi.fn>
  readonly waits: number[]
  readonly wait: (ms: number, signal: AbortSignal) => Promise<void>
}

function harness(): Harness {
  const waits: number[] = []
  const setAnalysisStateV1 = vi.fn()
  const resultsComplete = vi.fn()
  return {
    store: { setAnalysisStateV1, resultsComplete, currentResultsHash: null },
    setAnalysisStateV1,
    resultsComplete,
    waits,
    wait: async (ms, signal) => {
      waits.push(ms)
      if (signal.aborted) throw new Error('aborted')
    },
  }
}

describe('H3 — the wait is bounded and expiry invents nothing', () => {
  it('stops after the declared schedule and performs ZERO store writes', async () => {
    const h = harness()
    const read = vi.fn(async () => graphResult(verdict({ kind: 'never_run' })))
    const outcome = await runProvisionalDeliverySchedule({
      scenarioId: SCENARIO,
      userId: null,
      // Required, not optional: this schedule re-enters the graph read, so a
      // caller that forgot the token would silently make every re-ask anonymous.
      accessToken: null,
      signal: new AbortController().signal,
      getStore: () => h.store,
      read: read as never,
      wait: h.wait,
    })
    expect(outcome).toBe('deadline')
    // NOTHING was written — not a verdict, not a synthesised degraded state.
    expect(h.setAnalysisStateV1).not.toHaveBeenCalled()
    expect(h.resultsComplete).not.toHaveBeenCalled()
    // BUDGET: exactly one read per declared delay, no more.
    expect(read).toHaveBeenCalledTimes(PROVISIONAL_DELIVERY_DELAYS_MS.length)
  })

  it('the declared schedule is the one it asks for, and it ends at the deadline', async () => {
    const h = harness()
    await runProvisionalDeliverySchedule({
      scenarioId: SCENARIO,
      userId: null,
      accessToken: null,
      signal: new AbortController().signal,
      getStore: () => h.store,
      read: (async () => graphResult(verdict({ kind: 'never_run' }))) as never,
      wait: h.wait,
    })
    // Cumulative sum of the requested gaps must reproduce the declared offsets —
    // DERIVED from the exported constant, never a copied list (trap 12).
    const cumulative: number[] = []
    let total = 0
    for (const gap of h.waits) {
      total += gap
      cumulative.push(total)
    }
    expect(cumulative).toEqual([...PROVISIONAL_DELIVERY_DELAYS_MS])
    expect(total).toBe(PROVISIONAL_DELIVERY_DEADLINE_MS)
    // And the bound is short enough to be a wait rather than a background job.
    expect(PROVISIONAL_DELIVERY_DEADLINE_MS).toBeLessThanOrEqual(90_000)
  })
})

describe('H4 — a non-terminal read keeps waiting; a terminal one settles', () => {
  it('DELIVERS on the first read that carries a terminal verdict, and stops there', async () => {
    const h = harness()
    const answers = [
      graphResult(verdict({ kind: 'never_run' })),
      graphResult(verdict({ kind: 'never_run' })),
      graphResult(
        verdict({ kind: 'complete_current', computed_at: '2026-08-17T09:15:50.000Z' }),
      ),
    ]
    let call = 0
    const read = vi.fn(async () => answers[Math.min(call++, answers.length - 1)]!)
    const outcome = await runProvisionalDeliverySchedule({
      scenarioId: SCENARIO,
      userId: null,
      accessToken: null,
      signal: new AbortController().signal,
      getStore: () => h.store,
      read: read as never,
      wait: h.wait,
    })
    expect(outcome).toBe('delivered')
    // It STOPPED — three reads, not seven. A loop that keeps polling after the
    // answer arrives is a budget leak and a re-write risk.
    expect(read).toHaveBeenCalledTimes(3)
    expect(h.setAnalysisStateV1).toHaveBeenCalledTimes(1)
    expect(h.setAnalysisStateV1.mock.calls[0]![0]).toEqual(
      expect.objectContaining({
        run_state: { kind: 'complete_current', computed_at: '2026-08-17T09:15:50.000Z' },
      }),
    )
  })

  it('an unreadable read (404 / 503) does NOT settle it and touches nothing', async () => {
    // A 404 on this route means NOT READABLE — absent ∪ not-yours ∪
    // oracle-unresolvable — and never deletion. Concluding from it would end the
    // wait on a transient answer.
    const h = harness()
    const read = vi.fn(async () => ({ status: 'notReadable' as const }))
    const outcome = await runProvisionalDeliverySchedule({
      scenarioId: SCENARIO,
      userId: null,
      accessToken: null,
      signal: new AbortController().signal,
      getStore: () => h.store,
      read: read as never,
      wait: h.wait,
    })
    expect(outcome).toBe('deadline')
    expect(read).toHaveBeenCalledTimes(PROVISIONAL_DELIVERY_DELAYS_MS.length)
    expect(h.setAnalysisStateV1).not.toHaveBeenCalled()
  })

  it('a verdict CEE could not state (`analysisState: null`) does not settle it either', async () => {
    const h = harness()
    const read = vi.fn(async () => graphResult(null))
    const outcome = await runProvisionalDeliverySchedule({
      scenarioId: SCENARIO,
      userId: null,
      accessToken: null,
      signal: new AbortController().signal,
      getStore: () => h.store,
      read: read as never,
      wait: h.wait,
    })
    expect(outcome).toBe('deadline')
    expect(h.setAnalysisStateV1).not.toHaveBeenCalled()
  })
})

describe('it yields immediately on abort', () => {
  it('an already-aborted signal performs no read at all', async () => {
    const h = harness()
    const controller = new AbortController()
    controller.abort()
    const read = vi.fn(async () => graphResult(null))
    const outcome = await runProvisionalDeliverySchedule({
      scenarioId: SCENARIO,
      userId: null,
      accessToken: null,
      signal: controller.signal,
      getStore: () => h.store,
      read: read as never,
      wait: h.wait,
    })
    expect(outcome).toBe('aborted')
    expect(read).not.toHaveBeenCalled()
  })

  it('aborting mid-schedule stops the loop and writes nothing', async () => {
    const h = harness()
    const controller = new AbortController()
    let call = 0
    const read = vi.fn(async () => {
      call += 1
      if (call === 2) controller.abort()
      return graphResult(verdict({ kind: 'never_run' }))
    })
    const outcome = await runProvisionalDeliverySchedule({
      scenarioId: SCENARIO,
      userId: null,
      accessToken: null,
      signal: controller.signal,
      getStore: () => h.store,
      read: read as never,
      wait: h.wait,
    })
    expect(outcome).toBe('aborted')
    expect(read).toHaveBeenCalledTimes(2)
    expect(h.setAnalysisStateV1).not.toHaveBeenCalled()
  })
})

describe('the store is read LAZILY, per attempt', () => {
  it('re-reads the store on every attempt so a late dedupe sees the current hash', async () => {
    // The wait is up to a minute long. A store snapshot taken at arming time
    // would compare a stale `currentResultsHash` against the answer, and could
    // re-write a result the user is already looking at.
    const h = harness()
    const getStore = vi.fn(() => h.store)
    await runProvisionalDeliverySchedule({
      scenarioId: SCENARIO,
      userId: null,
      accessToken: null,
      signal: new AbortController().signal,
      getStore,
      read: (async () => graphResult(verdict({ kind: 'never_run' }))) as never,
      wait: h.wait,
    })
    expect(getStore).toHaveBeenCalledTimes(PROVISIONAL_DELIVERY_DELAYS_MS.length)
  })
})
