/**
 * absentGraphRetry — THE BOUNDED RE-ASK, proven on the extracted core.
 *
 * Pins the four properties that make this retry safe, without React, so each is
 * provable rather than inferred from a rendered surface:
 *
 *  WINDOW    · a scenario that answers `absent` and then populates is hydrated,
 *              with no reload. This is the defect being fixed.
 *  BOUNDED   · a scenario that NEVER populates TERMINATES. The read COUNT is
 *              asserted, not just the eventual return — a test that only proves
 *              it stops eventually cannot see a schedule that grew a tail.
 *  ALLOW-LIST· ONLY `absent` is re-asked. Every other outcome stops the
 *              schedule on its FIRST answer, pinned BY NAME so a future outcome
 *              cannot join the retry set silently.
 *  HONESTY   · the surface is told `retrying` only while re-asking, and
 *              `exhausted` only when the bound expires. It is told NOTHING on
 *              success, on a terminal answer, or on abort.
 *
 * ⚠ NO FAKE TIMERS. The `wait` seam is injected, so the schedule runs at full
 * speed with the DELAYS OBSERVED rather than elapsed — the pattern
 * `useProvisionalAnalysisDelivery.spec.ts` sets out: a fake-timer harness proves
 * the loop ran; injecting the clock proves WHAT IT ASKED FOR.
 */

import { describe, it, expect } from 'vitest'

import {
  runAbsentGraphRetrySchedule,
  ABSENT_GRAPH_RETRY_DELAYS_MS,
  ABSENT_GRAPH_RETRY_DEADLINE_MS,
  type AbsentGraphRetryStage,
} from '../absentGraphRetry'
import type { HydrationOutcome } from '../serverGraphHydration'

const SCENARIO = 'a6ccf5cf-aab0-4f01-b889-e0d6c072067c'
const OTHER = 'b7ddf6d0-bbc1-4012-c990-f1e7d1830178'

/**
 * ⚠ `hydrate` IS TYPED AS THE SEAM, NOT AS `ReturnType<typeof vi.fn>`.
 * That widens to `Mock<any[], unknown>`, which the narrower inferred mock is not
 * assignable to — the typecheck gate caught it as a genuine new error. Naming
 * the real signature also removes the `as never` this file used to need at the
 * call site, so a drift in `AbsentGraphRetryDeps` reds `tsc` here.
 */
interface Harness {
  readonly waits: number[]
  readonly asked: string[]
  readonly stages: AbsentGraphRetryStage[]
  readonly wait: (ms: number, signal: AbortSignal) => Promise<void>
  readonly hydrate: (scenarioId: string) => Promise<HydrationOutcome>
  readonly onStage: (s: AbsentGraphRetryStage) => void
}

function harness(outcomes: HydrationOutcome[] | HydrationOutcome): Harness {
  const waits: number[] = []
  const asked: string[] = []
  const stages: AbsentGraphRetryStage[] = []
  const queue = Array.isArray(outcomes) ? [...outcomes] : null
  const constant = Array.isArray(outcomes) ? null : outcomes

  const hydrate = async (scenarioId: string): Promise<HydrationOutcome> => {
    asked.push(scenarioId)
    if (constant !== null) return constant
    return queue!.length > 0 ? queue!.shift()! : 'absent'
  }

  return {
    waits,
    asked,
    stages,
    hydrate,
    onStage: (s) => stages.push(s),
    wait: async (ms, signal) => {
      waits.push(ms)
      if (signal.aborted) throw new Error('aborted')
    },
  }
}

function deps(h: Harness, extra: Record<string, unknown> = {}) {
  return {
    scenarioId: SCENARIO,
    userId: null,
    signal: new AbortController().signal,
    hydrate: h.hydrate,
    wait: h.wait,
    onStage: h.onStage,
    ...extra,
  }
}

describe('absentGraphRetry — the schedule itself', () => {
  it('is strictly increasing, and its deadline IS its last delay', () => {
    const d = ABSENT_GRAPH_RETRY_DELAYS_MS
    expect(d.length).toBeGreaterThan(0)
    for (let i = 1; i < d.length; i++) {
      expect(d[i]).toBeGreaterThan(d[i - 1])
    }
    expect(ABSENT_GRAPH_RETRY_DEADLINE_MS).toBe(d[d.length - 1])
  })

  /**
   * BUDGET. CEE's `read` tier is 90 rpm keyed per CLIENT IP and shared with
   * `useProvisionalAnalysisDelivery` and draft recovery. This asserts the spend
   * so a later "just poll every second" fails a test rather than a rate limit.
   */
  it('covers the measured 30–90s write-back window without exceeding 10 reads', () => {
    expect(ABSENT_GRAPH_RETRY_DEADLINE_MS).toBeGreaterThanOrEqual(90_000)
    expect(ABSENT_GRAPH_RETRY_DELAYS_MS.length).toBeLessThanOrEqual(10)
  })
})

describe('absentGraphRetry — WINDOW: the scenario that populates late', () => {
  it('re-asks and returns "hydrated" when a graph arrives on a later attempt', async () => {
    const h = harness(['absent', 'absent', 'merged'])
    const outcome = await runAbsentGraphRetrySchedule(deps(h))

    expect(outcome).toBe('hydrated')
    // IDENTITY: every re-ask was for THIS scenario, never a bare count.
    expect(h.asked).toEqual([SCENARIO, SCENARIO, SCENARIO])
  })

  it('accepts "unchanged" as a graph — the server answered, there was nothing to apply', async () => {
    const h = harness(['absent', 'unchanged'])
    expect(await runAbsentGraphRetrySchedule(deps(h))).toBe('hydrated')
    expect(h.asked).toHaveLength(2)
  })

  it('SAYS NOTHING to the surface beyond "retrying" when it succeeds', async () => {
    const h = harness(['absent', 'merged'])
    await runAbsentGraphRetrySchedule(deps(h))
    expect(h.stages).toEqual(['retrying'])
  })

  it('asks for the delays the schedule declares, in order', async () => {
    const h = harness('absent')
    await runAbsentGraphRetrySchedule(deps(h))

    // Observed gaps must reconstruct the declared absolute schedule.
    const absolute: number[] = []
    h.waits.reduce((acc, gap) => {
      const next = acc + gap
      absolute.push(next)
      return next
    }, 0)
    expect(absolute).toEqual([...ABSENT_GRAPH_RETRY_DELAYS_MS])
  })
})

describe('absentGraphRetry — BOUNDED: the scenario that never populates', () => {
  it('TERMINATES with "exhausted" after exactly the declared number of reads', async () => {
    const h = harness('absent')
    const outcome = await runAbsentGraphRetrySchedule(deps(h))

    expect(outcome).toBe('exhausted')
    expect(h.asked).toHaveLength(ABSENT_GRAPH_RETRY_DELAYS_MS.length)
    expect(h.asked.every((id) => id === SCENARIO)).toBe(true)
  })

  it('reports "retrying" then "exhausted", in that order and nothing else', async () => {
    const h = harness('absent')
    await runAbsentGraphRetrySchedule(deps(h))
    expect(h.stages).toEqual(['retrying', 'exhausted'])
  })
})

describe('absentGraphRetry — ALLOW-LIST: only `absent` is ever re-asked', () => {
  /**
   * The both-directions guard. Each stable outcome stops the schedule on its
   * FIRST answer. Pinned by NAME rather than by "anything that is not absent",
   * so adding an outcome to `HydrationOutcome` forces a deliberate decision.
   *
   * `notReadable` is the 404 and is the one the brief singles out: it must
   * behave byte-identically to before this change.
   */
  it.each<HydrationOutcome>([
    'notReadable',
    'refused',
    'unusable',
    'unavailable',
    'mergeRefused',
    'skipped',
  ])('stops on %s after ONE re-ask and returns "terminal"', async (outcome) => {
    const h = harness(outcome)
    const result = await runAbsentGraphRetrySchedule(deps(h))

    expect(result).toBe('terminal')
    // ONE read, not the full schedule — the answer was settled, not "not yet".
    expect(h.asked).toEqual([SCENARIO])
    // And it tells the surface nothing terminal — silence, exactly as today.
    expect(h.stages).toEqual(['retrying'])
  })

  /**
   * The CONTRAST that makes the table above mean something. Run in the same
   * suite with the same harness, `absent` consumes the WHOLE schedule — so a
   * "stops after one read" result is a property of the outcome under test, not
   * of a harness that stopped early for its own reasons.
   */
  it('CONTRAST — `absent` alone consumes the whole schedule', async () => {
    const h = harness('absent')
    const result = await runAbsentGraphRetrySchedule(deps(h))

    expect(result).toBe('exhausted')
    expect(h.asked.length).toBe(ABSENT_GRAPH_RETRY_DELAYS_MS.length)
    expect(h.asked.length).toBeGreaterThan(1)
  })
})

describe('absentGraphRetry — abort', () => {
  it('returns "aborted" and sets NO stage when the signal is already aborted', async () => {
    const h = harness('absent')
    const c = new AbortController()
    c.abort()

    const outcome = await runAbsentGraphRetrySchedule(deps(h, { signal: c.signal }))

    expect(outcome).toBe('aborted')
    expect(h.stages).toEqual([])
    expect(h.asked).toEqual([])
  })

  it('stops mid-schedule when the signal aborts, and never reports "exhausted"', async () => {
    const h = harness('absent')
    const c = new AbortController()
    const wait = async (ms: number, signal: AbortSignal) => {
      h.waits.push(ms)
      if (h.waits.length === 3) c.abort()
      if (signal.aborted) throw new Error('aborted')
    }

    const outcome = await runAbsentGraphRetrySchedule(
      deps(h, { signal: c.signal, wait }),
    )

    expect(outcome).toBe('aborted')
    expect(h.stages).toEqual(['retrying'])
    expect(h.asked.length).toBeLessThan(ABSENT_GRAPH_RETRY_DELAYS_MS.length)
  })
})

describe('absentGraphRetry — identity', () => {
  /**
   * The discriminating half of the identity binding: the schedule re-asks for
   * the scenario it was GIVEN. A mutant that re-asks a hardcoded different id
   * satisfies every bare call-count assertion and fails this one.
   */
  it('re-asks the scenario it was given, never another', async () => {
    const h = harness('absent')
    await runAbsentGraphRetrySchedule(deps(h, { scenarioId: OTHER }))
    expect(h.asked.every((id) => id === OTHER)).toBe(true)
    expect(h.asked).not.toContain(SCENARIO)
  })
})
