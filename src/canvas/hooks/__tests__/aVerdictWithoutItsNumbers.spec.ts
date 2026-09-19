/**
 * A VERDICT WITHOUT ITS NUMBERS IS NOT THE ANSWER THE USER IS WAITING FOR.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⛔ WITNESSED — Paul's run, 19 Sep 2026, scenario `2b1a023c`
 * ═══════════════════════════════════════════════════════════════════════════
 * Derived at CEE's request log. The ladder ran CORRECTLY and then stopped at
 * attempt 6 of 17, with 87 seconds of budget unused:
 *
 *   14:31:06.392  run_state = running (started_at)
 *   14:31:15.877  POST /assist/v1/scenarios/2b1a023c/graph   arm + 8s
 *   14:31:22.668  + 14s      14:31:29.611  + 20s
 *   14:31:37.623  + 27s      14:31:46.818  + 35s
 *   14:31:48.309  CEE: auto_run_after_draft  commit_performed=true
 *   14:31:55.721  + 43s    ← LAST READ. Attempt 7 (+51s) never fired.
 *
 * The panel rendered every option with `win_probability_displayed: null` and
 * `rank_source: "withheld"`. The analysis had finished seven seconds earlier.
 *
 * ⚠ INSTRUMENT NOTE. My first log pull returned exactly 200 lines against
 * `limit=200` and hid four of those reads; I reported "two attempts" before
 * catching it. Re-pulled in six narrow windows. A suspiciously round number is
 * a reading about the instrument, not about the world (CLAUDE.md trap 20).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE CAUSE, REPRODUCED AGAINST THE REAL MODULES BEFORE ANY CODE CHANGED
 * ═══════════════════════════════════════════════════════════════════════════
 * `applyScenarioAnalysisRead` returns `{ outcome: 'applied', resultsHydrated:
 * false }` when a verdict lands with NO result block. The schedule LOGGED that
 * field and returned `'delivered'` regardless — reporting delivery of something
 * it had not delivered, and abandoning the rest of its budget.
 *
 * ⭐ Two other candidates were ELIMINATED rather than argued away:
 *   · `withheld` — `graphAcceptedForCanvas` measured TRUE on this canvas shape,
 *     so the divergence guards cannot fire.
 *   · an aborted effect from auth churn — guest identity is "immediately-ready"
 *     (`AuthContext.tsx:233`), so `userId` does not change after mount.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY IT IS SCOPED TO ONE KIND
 * ═══════════════════════════════════════════════════════════════════════════
 * Three of the four terminal kinds ship no result block BY DESIGN, per
 * `applyScenarioAnalysisRead`'s own per-kind header: `complete_stale` ("CEE
 * ships no result block on this verdict"), `blocked` ("no run was attempted"),
 * `refused`. Waiting for numbers on those would burn the whole ladder and end
 * in a false "we gave up" — the opposite defect, so each has its own arm below.
 */

import { describe, it, expect, vi } from 'vitest'
import type { AnalysisStateV1 } from '@talchain/schemas/boundary'

import {
  runProvisionalDeliverySchedule,
  PROVISIONAL_DELIVERY_DELAYS_MS,
} from '../useProvisionalAnalysisDelivery'
import type { ScenarioAnalysisApplyStore } from '../../hydrate/applyScenarioAnalysisRead'

const SCENARIO = '2b1a023c-5cb1-4217-9117-42f25a18e1ae'

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

/** A real analysis block, minimal but enough for `mapV5AnalysisToReport`. */
const RESULT_BLOCK = {
  type: 'analysis_result',
  response_hash: 'hash_real_answer',
  options: [],
  summary: {},
} as unknown

function graphResult(analysisState: AnalysisStateV1 | null, analysisResult: unknown = null) {
  return {
    status: 'graph' as const,
    graph: { nodes: [], edges: [] },
    briefText: null,
    notModelled: null,
    identity: null,
    graphHash: null,
    layoutPresent: false,
    analysisState,
    analysisResult,
    requestId: 'req-1',
  }
}

function runWith(reads: ReturnType<typeof graphResult>[]) {
  const setAnalysisStateV1 = vi.fn()
  const resultsComplete = vi.fn()
  const store: ScenarioAnalysisApplyStore = {
    setAnalysisStateV1,
    resultsComplete,
    currentResultsHash: null,
  }
  let i = 0
  const read = vi.fn(async () => reads[Math.min(i++, reads.length - 1)])
  const waits: number[] = []
  return {
    store,
    read,
    resultsComplete,
    setAnalysisStateV1,
    waits,
    outcome: runProvisionalDeliverySchedule({
      scenarioId: SCENARIO,
      userId: null,
      accessToken: null,
      signal: new AbortController().signal,
      getStore: () => store,
      read: read as never,
      wait: async (ms: number) => {
        waits.push(ms)
      },
    }),
  }
}

const CURRENT_NO_NUMBERS = graphResult(verdict({ kind: 'complete_current' } as never), null)
const CURRENT_WITH_NUMBERS = graphResult(
  verdict({ kind: 'complete_current' } as never),
  RESULT_BLOCK,
)

describe('THE CONTROL — a real answer still settles the schedule at once', () => {
  /**
   * ⭐⭐ Without this arm, "it keeps polling" could pass on a schedule that has
   * simply stopped settling at all — which would be a worse defect wearing the
   * fix's clothes (CLAUDE.md trap 13).
   */
  it('a complete_current verdict WITH its result block delivers on the first read', async () => {
    const h = runWith([CURRENT_WITH_NUMBERS])
    await expect(h.outcome).resolves.toBe('delivered')
    expect(h.read).toHaveBeenCalledTimes(1)
    expect(h.resultsComplete).toHaveBeenCalledTimes(1)
  })
})

describe('THE DEFECT — a verdict with no numbers must not end the wait', () => {
  /**
   * ⭐⭐⭐ THE ARM THAT REPRODUCES PAUL'S RUN. Before the fix this resolved
   * `delivered` after ONE read, which is exactly what the CEE log shows: the
   * ladder stopping mid-budget having shown the user nothing.
   */
  it('keeps the remaining budget instead of reporting a delivery it did not make', async () => {
    const h = runWith([CURRENT_NO_NUMBERS])
    await expect(h.outcome).resolves.toBe('deadline')
    // It spent the WHOLE ladder, not one attempt.
    expect(h.read).toHaveBeenCalledTimes(PROVISIONAL_DELIVERY_DELAYS_MS.length)
    // And it never claimed to have hydrated a report.
    expect(h.resultsComplete).not.toHaveBeenCalled()
  })

  /**
   * ⭐⭐ AND THE NUMBERS ARRIVING LATE ARE ACTUALLY DELIVERED — the whole point.
   * The witnessed run had the result committed BETWEEN two reads, so this is
   * the shape that was silently lost.
   */
  it('a later read carrying the numbers is delivered, after the empty ones', async () => {
    const h = runWith([CURRENT_NO_NUMBERS, CURRENT_NO_NUMBERS, CURRENT_WITH_NUMBERS])
    await expect(h.outcome).resolves.toBe('delivered')
    expect(h.read).toHaveBeenCalledTimes(3)
    expect(h.resultsComplete).toHaveBeenCalledTimes(1)
  })
})

describe('THE OPPOSITE-DIRECTION TWINS — kinds that ship no numbers by design', () => {
  /**
   * ⚠ Each of these legitimately carries no result block. Waiting on them would
   * burn the whole ladder and end in a false "we gave up" — the inverse defect,
   * and the reason the fix names ONE kind rather than keying on
   * `resultsHydrated` alone (CLAUDE.md trap 22b: one predicate, two harms).
   */
  for (const kind of ['complete_stale', 'blocked', 'refused'] as const) {
    it(`${kind} settles immediately, with no result block`, async () => {
      const h = runWith([graphResult(verdict({ kind } as never), null)])
      await expect(h.outcome).resolves.toBe('delivered')
      expect(h.read).toHaveBeenCalledTimes(1)
    })
  }
})
