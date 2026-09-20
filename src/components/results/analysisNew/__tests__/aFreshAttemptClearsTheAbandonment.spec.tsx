/**
 * A FRESH ATTEMPT UNDER THE SAME RUN KEY CLEARS THE ABANDONMENT.
 *
 * ⛔⛔ THE DEFECT, found by an independent seat on #1764, and the irony is the
 * point: **that PR added `attempt` to the delivery record precisely because
 * `run_key` is NOT unique per attempt — and then keyed this consumer on the run
 * key.** The same trap, one layer up, inside its own fix.
 *
 * The sequence, which is the reviewer's own smallest discriminating control:
 *
 *   A arms -> A never settles -> A passes its deadline -> this hook says
 *   "stopped waiting" -> auth identity resolves, so the producer cleans up A and
 *   arms B UNDER THE SAME KEY with a fresh `armed_at`
 *
 * Neither `isRunning` nor `runKey` changes. A consumer keyed on them never
 * restarts and never clears, so the panel goes on announcing an abandoned run
 * while B is actively waiting — the exact false state #1764 exists to remove.
 *
 * ⭐ NO POLL CAN CLOSE THIS. Unbounded, it re-renders the largest component in
 * the app forever; bounded, it is blind to everything after its bound. Both
 * were tried on this PR. The record now publishes its transitions instead.
 */
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import {
  recordDeliveryArmed,
  recordDeliverySettled,
  __resetDeliveryRecordForTest,
} from '../../../../canvas/hooks/provisionalDeliveryRecord'
import { useAnalysisWaitExhausted, PROVISIONAL_DELIVERY_DEADLINE_MS } from '../useAnalysisWaitExhausted'
import { useCanvasStore } from '../../../../canvas/store'

const SCENARIO = 'scenario-attempt'
const STARTED = '2026-09-19T18:56:14.645Z'
const KEY = `${SCENARIO}:${STARTED}`

/** The wire says a run is in flight — the only state this hook acts in. */
function seedRunningWire(): void {
  useCanvasStore.setState({
    currentScenarioId: SCENARIO,
    analysisStateV1: { run_state: { kind: 'running', started_at: STARTED } },
  } as never)
}

beforeEach(() => {
  __resetDeliveryRecordForTest()
  seedRunningWire()
  vi.useRealTimers()
})
afterEach(() => __resetDeliveryRecordForTest())

describe('THE CONTROL — an unchanged attempt still stops normally', () => {
  /**
   * ⭐⭐ Without this, "a fresh attempt clears it" could pass on a hook that
   * never reports exhaustion at all — which would be the original defect, not
   * a fix (CLAUDE.md trap 13).
   */
  it('a settled, undelivered attempt reads as stopped waiting', () => {
    const a = recordDeliveryArmed(KEY)
    const { result } = renderHook(() => useAnalysisWaitExhausted(true))
    expect(result.current, 'still in flight — nothing has settled').toBe(false)

    act(() => {
      recordDeliverySettled(KEY, a, 'deadline')
    })
    expect(result.current, 'the schedule ended without delivering').toBe(true)
  })

  /** And a DELIVERED attempt is never abandonment. */
  it('a delivered attempt never reports stopped waiting', () => {
    const a = recordDeliveryArmed(KEY)
    const { result } = renderHook(() => useAnalysisWaitExhausted(true))
    act(() => {
      recordDeliverySettled(KEY, a, 'delivered')
    })
    expect(result.current).toBe(false)
  })
})

describe('THE DEFECT — a re-arm under the SAME key', () => {
  /**
   * ⛔ THE REVIEWER'S SMALLEST DISCRIMINATING CONTROL, verbatim in shape:
   * expired/unsettled A -> same-key fresh B. Exhaustion must CLEAR and B must
   * be observed.
   */
  it('a fresh attempt under the same key clears the abandonment', () => {
    const a = recordDeliveryArmed(KEY)
    const { result } = renderHook(() => useAnalysisWaitExhausted(true))

    act(() => {
      recordDeliverySettled(KEY, a, 'deadline')
    })
    expect(result.current, 'precondition: A is reported as stopped').toBe(true)

    // Auth identity resolves: the producer tears A down and arms B under the
    // SAME run key. `isRunning` and `runKey` do not change.
    act(() => {
      recordDeliveryArmed(KEY)
    })

    expect(
      result.current,
      'B is actively waiting — the panel must stop announcing an abandoned run',
    ).toBe(false)
  })

  /**
   * ⭐ AND B IS GENUINELY OBSERVED AFTERWARDS, not merely cleared once. A hook
   * that reset and then stopped listening would pass the arm above and still be
   * blind — the defect with one fewer symptom.
   */
  it('and B is still observed: its own settle is reported', () => {
    const a = recordDeliveryArmed(KEY)
    const { result } = renderHook(() => useAnalysisWaitExhausted(true))
    act(() => {
      recordDeliverySettled(KEY, a, 'deadline')
    })
    let b = 0
    act(() => {
      b = recordDeliveryArmed(KEY)
    })
    expect(result.current).toBe(false)

    act(() => {
      recordDeliverySettled(KEY, b, 'withheld')
    })
    expect(result.current, "B's own outcome must reach the surface").toBe(true)
  })

  /**
   * ⭐⭐ AND B GETS ITS OWN DEADLINE FLOOR — the arm that makes the
   * attempt-ownership block load-bearing rather than decorative.
   *
   * ⚠ MEASURED, NOT ASSUMED. Mutating the attempt-ownership block away left
   * every other arm in this file GREEN, because the clearing above comes from
   * re-reading on notification, not from that block. An untested line is
   * theatre, so this is the case that needs it: B arms and never settles, so
   * there is no transition to observe and only a timer can report it. Without
   * the re-arm, A's spent timer is never replaced and B waits for ever.
   */
  it("and B's own deadline still reports, with no settle to observe", () => {
    vi.useFakeTimers()
    try {
      const a = recordDeliveryArmed(KEY)
      const { result } = renderHook(() => useAnalysisWaitExhausted(true))
      act(() => {
        recordDeliverySettled(KEY, a, 'deadline')
      })
      expect(result.current).toBe(true)

      act(() => {
        recordDeliveryArmed(KEY)
      })
      expect(result.current, 'B is waiting again').toBe(false)

      // B never settles. Only its own floor can report it.
      act(() => {
        vi.advanceTimersByTime(PROVISIONAL_DELIVERY_DEADLINE_MS + 2_000)
      })
      expect(
        result.current,
        "B's floor must be armed too — otherwise a re-armed run waits for ever",
      ).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  /**
   * ⭐⭐⭐ THE ARM THAT ACTUALLY DISCRIMINATES THE ATTEMPT-OWNERSHIP RE-ARM, and
   * it took two tries to find — which is the finding.
   *
   * ⚠ My first two attempts at this did NOT bite: mutating the block away left
   * them green, because in both A had already SETTLED and its timer was spent,
   * so the floor was re-armed for B anyway.
   *
   * The case that needs the block is A UNSETTLED when B arms. A's timeout is
   * still live and is set for A's deadline, which is EARLIER than B's. Without
   * dropping it on the attempt change, that stale timer fires first and reports
   * B as abandoned while B is still inside its own budget — a false
   * abandonment, arriving early, which is the very defect this PR exists to
   * remove.
   */
  it('a live timer from an UNSETTLED earlier attempt does not expire the new one', () => {
    vi.useFakeTimers()
    try {
      recordDeliveryArmed(KEY) // A: armed, never settled
      const { result } = renderHook(() => useAnalysisWaitExhausted(true))
      expect(result.current).toBe(false)

      // B arms 30s later, still under the same key. A's floor is still pending.
      act(() => {
        vi.advanceTimersByTime(30_000)
      })
      act(() => {
        recordDeliveryArmed(KEY)
      })

      // Past A's deadline, but B has 30s of its own budget left.
      act(() => {
        vi.advanceTimersByTime(PROVISIONAL_DELIVERY_DEADLINE_MS - 29_000)
      })
      expect(
        result.current,
        "A's spent deadline must not expire B — B is still inside its own budget",
      ).toBe(false)

      // And B's own floor still reports when it genuinely passes.
      act(() => {
        vi.advanceTimersByTime(60_000)
      })
      expect(result.current, "B's own floor must still report").toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  /** ⚠ The two attempts are genuinely distinct — the fixture is not a tautology. */
  it('PRECONDITION: the two attempts share a run key and differ by attempt', () => {
    const a = recordDeliveryArmed(KEY)
    const b = recordDeliveryArmed(KEY)
    expect(b).not.toBe(a)
    expect(PROVISIONAL_DELIVERY_DEADLINE_MS).toBeGreaterThan(60_000)
  })
})
