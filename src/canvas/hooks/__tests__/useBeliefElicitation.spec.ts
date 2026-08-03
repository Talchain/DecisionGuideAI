/**
 * `useBeliefElicitation` — the debounce, the minimum phrase, and the
 * STALE-RESPONSE rule (ROADMAP 2.364).
 *
 * WHY THE STALE-RESPONSE TEST EXISTS AT ALL. Two requests can be in flight
 * across two debounce windows, and nothing about `await` makes them land in
 * order. If the FIRST response is allowed to write state after the SECOND has
 * already landed, the surface renders "about 70%" beneath the words "unlikely"
 * — a number attributed to text the user has replaced, which the user has no
 * way to see is wrong. Every request therefore carries a sequence number and
 * only the latest may write. This file drives that race deliberately, with
 * MANUALLY-RESOLVED promises, because a race that resolves in order proves
 * nothing about a race that does not.
 *
 * RED-first at pristine `0c4e2cc3`: the hook does not exist.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

/** One controllable in-flight elicitation per call, in call order. */
const inFlight: Array<{
  input: Record<string, unknown>
  resolve: (value: unknown) => void
  reject: (reason?: unknown) => void
}> = []

vi.mock('../../../adapters/cee/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../adapters/cee/client')>()
  class MockCEEClient extends actual.CEEClient {
    elicitBelief(
      input: Parameters<InstanceType<typeof actual.CEEClient>['elicitBelief']>[0],
    ): ReturnType<InstanceType<typeof actual.CEEClient>['elicitBelief']> {
      return new Promise((resolve, reject) => {
        inFlight.push({
          input: input as unknown as Record<string, unknown>,
          resolve: resolve as (value: unknown) => void,
          reject,
        })
      }) as ReturnType<InstanceType<typeof actual.CEEClient>['elicitBelief']>
    }
  }
  return { ...actual, CEEClient: MockCEEClient }
})

import {
  useBeliefElicitation,
  BELIEF_ELICITATION_DEBOUNCE_MS,
  BELIEF_ELICITATION_ERROR_COPY,
  formatElicitedChance,
} from '../useBeliefElicitation'

const TARGET = { nodeId: 'fac_churn_risk', nodeLabel: 'Churn risk' }

function reply(suggested: number) {
  return {
    suggested_value: suggested,
    confidence: 'high' as const,
    reasoning: 'r',
    needs_clarification: false,
    provenance: 'cee' as const,
  }
}

async function settle(): Promise<void> {
  for (let i = 0; i < 20; i++) await Promise.resolve()
}

beforeEach(() => {
  inFlight.length = 0
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useBeliefElicitation', () => {
  it('does not call CEE until the debounce elapses, then calls it once', async () => {
    const { result } = renderHook(() => useBeliefElicitation(TARGET))

    act(() => {
      result.current.request('pretty')
      result.current.request('pretty likely')
    })
    expect(inFlight).toHaveLength(0)

    await act(async () => {
      vi.advanceTimersByTime(BELIEF_ELICITATION_DEBOUNCE_MS)
      await settle()
    })

    // One call, carrying the LAST text — not two, and not the first.
    expect(inFlight).toHaveLength(1)
    expect(inFlight[0].input.user_expression).toBe('pretty likely')
  })

  it('sends nothing for a phrase shorter than three characters', async () => {
    const { result } = renderHook(() => useBeliefElicitation(TARGET))

    await act(async () => {
      result.current.request('ab')
      vi.advanceTimersByTime(BELIEF_ELICITATION_DEBOUNCE_MS * 2)
      await settle()
    })

    expect(inFlight).toHaveLength(0)
  })

  it('⭐ a LATE first response cannot overwrite the second — the stale-response rule', async () => {
    const { result } = renderHook(() => useBeliefElicitation(TARGET))

    // Request 1: "pretty likely"
    await act(async () => {
      result.current.request('pretty likely')
      vi.advanceTimersByTime(BELIEF_ELICITATION_DEBOUNCE_MS)
      await settle()
    })
    // Request 2: the user corrects themselves.
    await act(async () => {
      result.current.request('actually unlikely')
      vi.advanceTimersByTime(BELIEF_ELICITATION_DEBOUNCE_MS)
      await settle()
    })
    expect(inFlight).toHaveLength(2)

    // The SECOND lands first — the ordinary case for two concurrent requests.
    await act(async () => {
      inFlight[1].resolve(reply(0.15))
      await settle()
    })
    expect(result.current.suggestion?.suggested_value).toBe(0.15)

    // Now the FIRST lands, late. It must be discarded: 0.7 under the words
    // "actually unlikely" is a number the user never asked for.
    await act(async () => {
      inFlight[0].resolve(reply(0.7))
      await settle()
    })
    expect(result.current.suggestion?.suggested_value).toBe(0.15)
    expect(result.current.loading).toBe(false)
  })

  it('a late response cannot repaint after reset() (the accept/close race)', async () => {
    const { result } = renderHook(() => useBeliefElicitation(TARGET))

    await act(async () => {
      result.current.request('pretty likely')
      vi.advanceTimersByTime(BELIEF_ELICITATION_DEBOUNCE_MS)
      await settle()
    })
    act(() => {
      result.current.reset()
    })
    await act(async () => {
      inFlight[0].resolve(reply(0.7))
      await settle()
    })

    expect(result.current.suggestion).toBeNull()
  })

  it('a failure reports honest copy and no suggestion', async () => {
    const { result } = renderHook(() => useBeliefElicitation(TARGET))

    await act(async () => {
      result.current.request('pretty likely')
      vi.advanceTimersByTime(BELIEF_ELICITATION_DEBOUNCE_MS)
      await settle()
    })
    await act(async () => {
      inFlight[0].reject(new Error('boom'))
      await settle()
    })

    expect(result.current.suggestion).toBeNull()
    expect(result.current.error).toBe(BELIEF_ELICITATION_ERROR_COPY)
    expect(result.current.error).toMatch(/Nothing has changed/)
    expect(result.current.loading).toBe(false)
  })
})

describe('formatElicitedChance', () => {
  it('renders a probability as a plain-language chance', () => {
    expect(formatElicitedChance(0.7)).toBe('about 70%')
    expect(formatElicitedChance(0.15)).toBe('about 15%')
    expect(formatElicitedChance(0)).toBe('about 0%')
    expect(formatElicitedChance(1)).toBe('about 100%')
  })
})
