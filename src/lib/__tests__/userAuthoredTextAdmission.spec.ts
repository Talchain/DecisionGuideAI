/**
 * The SINGLE admission for verbatim user prose in a debug bundle.
 *
 * ## Why this file exists
 *
 * `user_actions[].detail.user_text` and
 * `recent_conversation_turns[].user_message` capture the same data class —
 * the user's own words — and shipped for review behind two DIFFERENT
 * gates. A cold review found the consequence: in states where the trace
 * store captures request bodies but the narrower gate is false, the bundle
 * carried the user's verbatim messages under `user_message` WHILE emitting
 * an omission marker beside them. A bundle that says it omitted something
 * it in fact contains is worse than either capture gap, because a reader
 * trusts the marker.
 *
 * ⚠ WHICH STATES, corrected. A second review found that the state named
 * everywhere in the first write-up — `VITE_APP_ENV='production'` plus the
 * `VITE_ENABLE_PAYLOAD_INSPECTION=true` opt-in — CANNOT PRODUCE A BUNDLE:
 * `shouldShowDebugPanel` (`debugPanelVisibility.ts:20-22`) returns false
 * unless `VITE_APP_ENV` is 'staging' or 'development' (or absent, which
 * falls open to 'development'), and `exportDebugBundleAsync` has exactly
 * one non-test caller, inside that panel. Measured over all 20
 * combinations of `DEV` × `VITE_APP_ENV` × opt-in, `panel && storeEnabled
 * && !narrow` is true in exactly three states, none of them that one:
 *
 *   VITE_APP_ENV UNSET         + opt-in          (production's real posture)
 *   VITE_APP_ENV='development' + no opt-in       (needs NO flag at all)
 *   VITE_APP_ENV='development' + opt-in
 *
 * The cases below pin those, because a case pinned to a state no artefact
 * can reach is a guard that cannot fire.
 *
 * It also found that NO test executed either gate — all twelve specs
 * touching the modules `vi.mock` them away — which is how it reached
 * review. Every case below therefore runs the real predicate under a real
 * env state.
 *
 * ## Two obligations, both discharged here
 *
 * 1. OPPOSITE-DIRECTION TWINS. A non-capturing environment must OMIT and
 *    SAY it omitted; a capturing one must CONTAIN and say nothing. One
 *    direction alone is a guard watching one door.
 * 2. THE SUBSET CLAIM, ASSERTED BY EXECUTION. `shouldCaptureUserAuthoredText`
 *    is documented as a union that is never false while the trace-store
 *    gate is true. That is a claim about ANOTHER module's predicate, i.e.
 *    a hand-maintained mirror waiting to drift. The matrix at the bottom
 *    loads the REAL `getPayloadInspectionStatus()` under each env state
 *    and REDs if any state exists where trace capture is enabled and this
 *    admission is false.
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import {
  shouldCaptureUserAuthoredText,
  USER_AUTHORED_TEXT_OMITTED_REASON,
} from '../../utils/payloadRedaction'
import { selectRecentConversationTurns } from '../recentConversationTurns'

/**
 * A single V5 CEE turn whose request body carries user prose AND a
 * secret-shaped substring. Both properties are load-bearing: the prose
 * proves the gate, the secret proves the scrub.
 */
const USER_PROSE = 'Should we acquire the smaller competitor this quarter?'
const TURN_WITH_USER_TEXT = {
  id: 'trace-admission-1',
  service: 'cee',
  endpoint: '/proxy/v5/turn',
  timestamp: 1_757_000_000_000,
  completed: true,
  status: 200,
  request: {
    headers: {},
    body: { kind: 'message', message: USER_PROSE, source: 'composer' },
  },
  response: { body: { assistant_text: 'Acquire leads at 44%.' } },
} as never

/**
 * Stub the env for one matrix entry. `DEV` takes a real boolean — Vitest
 * types `stubEnv` against `ImportMetaEnv`, where `DEV` is `boolean`; the
 * string form the older env-gate spec uses fails the typecheck ratchet.
 */
function stubEnv(env: {
  DEV?: boolean
  VITE_APP_ENV?: string
  VITE_ENABLE_PAYLOAD_INSPECTION?: string
}): void {
  vi.stubEnv('DEV', env.DEV === true)
  vi.stubEnv('VITE_APP_ENV', env.VITE_APP_ENV ?? '')
  vi.stubEnv(
    'VITE_ENABLE_PAYLOAD_INSPECTION',
    env.VITE_ENABLE_PAYLOAD_INSPECTION ?? '',
  )
}

/**
 * The one REACHABLE env state in which no path may carry user prose: a
 * production-mode build with `VITE_APP_ENV` unset and no opt-in. Of the 20
 * combinations, this is the only one where the debug panel can mount (so a
 * bundle exists at all) and the admission is false.
 *
 * '' models an absent key faithfully for every predicate involved:
 * `'' || 'development'` === `undefined || 'development'` for the panel, and
 * the trace store disables on both ('' → `empty_app_env_capture_disabled`,
 * absent → `missing_app_env_capture_disabled`). It previously read
 * `VITE_APP_ENV: 'production'` — where the panel cannot mount at all.
 */
const NON_CAPTURING = {
  DEV: false,
  VITE_APP_ENV: '',
  VITE_ENABLE_PAYLOAD_INSPECTION: '',
} as const

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

// ===========================================================================
// The predicate itself — executed, not mocked
// ===========================================================================

describe('shouldCaptureUserAuthoredText — the gate is executed', () => {
  it('is FALSE in the one reachable non-capturing state (app env unset, no opt-in)', () => {
    stubEnv(NON_CAPTURING)
    expect(shouldCaptureUserAuthoredText()).toBe(false)
  })

  it('is FALSE with an explicit VITE_APP_ENV=production and no opt-in', () => {
    // Predicate-level only: no bundle can be produced in this state (the
    // panel refuses to mount), so it pins the gate, not a reachable lie.
    stubEnv({
      DEV: false,
      VITE_APP_ENV: 'production',
      VITE_ENABLE_PAYLOAD_INSPECTION: '',
    })
    expect(shouldCaptureUserAuthoredText()).toBe(false)
  })

  it('is TRUE under the Vite dev server', () => {
    stubEnv({ DEV: true })
    expect(shouldCaptureUserAuthoredText()).toBe(true)
  })

  it('is TRUE when VITE_APP_ENV is staging', () => {
    stubEnv({ DEV: false, VITE_APP_ENV: 'staging' })
    expect(shouldCaptureUserAuthoredText()).toBe(true)
  })

  it('is TRUE with VITE_APP_ENV unset and the payload-inspection opt-in', () => {
    // REACHABLE STATE 1 of the three. Production's real `VITE_APP_ENV`
    // posture is unset, the panel therefore mounts, and the opt-in enables
    // the trace store — so the admission must be true here, or the bundle
    // would deny holding prose it holds.
    stubEnv({
      DEV: false,
      VITE_APP_ENV: '',
      VITE_ENABLE_PAYLOAD_INSPECTION: 'true',
    })
    expect(shouldCaptureUserAuthoredText()).toBe(true)
  })

  it('is TRUE when VITE_APP_ENV is development, with NO opt-in', () => {
    // REACHABLE STATE 2, and the one the first write-up missed: the
    // exposure needs no opt-in flag at all. `app_env_development_enabled`
    // turns the trace store on while the narrow gate stays false.
    stubEnv({
      DEV: false,
      VITE_APP_ENV: 'development',
      VITE_ENABLE_PAYLOAD_INSPECTION: '',
    })
    expect(shouldCaptureUserAuthoredText()).toBe(true)
  })

  it('is TRUE when VITE_APP_ENV is development AND the opt-in is set', () => {
    // REACHABLE STATE 3.
    stubEnv({
      DEV: false,
      VITE_APP_ENV: 'development',
      VITE_ENABLE_PAYLOAD_INSPECTION: 'true',
    })
    expect(shouldCaptureUserAuthoredText()).toBe(true)
  })
})

// ===========================================================================
// user_message — the twins
// ===========================================================================

describe('recent_conversation_turns.user_message honours the one admission', () => {
  it('CONTAINS the user prose and claims no omission in a capturing environment', () => {
    stubEnv({ DEV: true })
    const result = selectRecentConversationTurns([TURN_WITH_USER_TEXT])

    const turn = result.turns.find((t) => t.trace_id === 'trace-admission-1')
    expect(turn).toBeDefined()
    expect(turn!.user_message).toBe(USER_PROSE)
    expect(turn!.has_user_message).toBe(true)
    expect(result.user_authored_count).toBe(1)
    // The opposite-direction assertion: nothing may claim an omission.
    expect(result).not.toHaveProperty('user_message_omitted_reason')
  })

  it('OMITS the user prose and SAYS SO in a non-capturing environment', () => {
    stubEnv(NON_CAPTURING)
    const result = selectRecentConversationTurns([TURN_WITH_USER_TEXT])

    const turn = result.turns.find((t) => t.trace_id === 'trace-admission-1')
    expect(turn).toBeDefined()
    // The turn is still captured — this withholds one field, it does not
    // hide the turn.
    expect(turn!.assistant_text).toBe('Acquire leads at 44%.')
    expect(turn!.user_message).toBeNull()
    expect(turn!.has_user_message).toBe(false)
    expect(result.user_authored_count).toBe(0)
    expect(result.user_message_omitted_reason).toBe(
      USER_AUTHORED_TEXT_OMITTED_REASON,
    )
  })

  it('keeps user_message_source, which is an enum and not user prose', () => {
    stubEnv(NON_CAPTURING)
    const result = selectRecentConversationTurns([TURN_WITH_USER_TEXT])
    // Binds by identity to the turn that carried it.
    expect(
      result.turns.find((t) => t.trace_id === 'trace-admission-1')!
        .user_message_source,
    ).toBe('composer')
  })

  it('runs the shared secrets pass over user_message, not just a passthrough', () => {
    // The doc for this field used to claim the value arrived
    // "already-scrubbed". It did not: the trace store scrubs string
    // RESPONSE bodies only. Rather than weaken the claim, the code was
    // changed to make it true — and this is the case that proves it.
    stubEnv({ DEV: true })
    const result = selectRecentConversationTurns([
      {
        ...(TURN_WITH_USER_TEXT as unknown as Record<string, unknown>),
        id: 'trace-admission-secret',
        request: {
          headers: {},
          body: {
            kind: 'message',
            message: 'try api_key=sk-live-abc123 for the run',
            source: 'composer',
          },
        },
      } as never,
    ])

    const text = result.turns.find(
      (t) => t.trace_id === 'trace-admission-secret',
    )!.user_message
    expect(text).toBe('try api_key=[REDACTED] for the run')
  })
})

// ===========================================================================
// The subset claim — asserted by execution against the real trace-store gate
// ===========================================================================

describe('the admission is never false while payload-trace capture is enabled', () => {
  /**
   * Load the REAL trace-store gate under the stubbed env. The store
   * resolves its gate once at module load, so each entry needs a reset
   * and a fresh dynamic import — the pattern
   * `payload-trace-store.envGate.spec.ts` established.
   */
  async function traceCaptureEnabled(): Promise<boolean> {
    const mod = await import('../payload-trace-store')
    return mod.getPayloadInspectionStatus().enabled
  }

  // Every state the trace-store gate distinguishes, plus the two states
  // only `shouldCaptureDetailedPayload` reaches. A row whose expectation
  // is UNIFORM across the matrix would prove nothing (an instrument that
  // answers the same for every input is reporting on itself), so the
  // matrix deliberately contains both enabled and disabled entries and
  // the control below asserts it contains both.
  const matrix: Array<{
    label: string
    env: Parameters<typeof stubEnv>[0]
  }> = [
    { label: 'vite dev server', env: { DEV: true } },
    { label: 'app env staging', env: { DEV: false, VITE_APP_ENV: 'staging' } },
    {
      label: 'app env development',
      env: { DEV: false, VITE_APP_ENV: 'development' },
    },
    {
      label: 'app env UNSET with the explicit inspection opt-in',
      // The reachable state an opt-in actually meets in a deployed build:
      // the store enables via `explicit_debug_flag_enabled` while the
      // narrow gate is false, and the panel still mounts. Absent from the
      // first version of this matrix, which is why the exposure went
      // under-described.
      env: { DEV: false, VITE_APP_ENV: '', VITE_ENABLE_PAYLOAD_INSPECTION: 'true' },
    },
    {
      label: 'explicit app env production with the inspection opt-in',
      env: {
        DEV: false,
        VITE_APP_ENV: 'production',
        VITE_ENABLE_PAYLOAD_INSPECTION: 'true',
      },
    },
    {
      label: 'explicit app env production, no opt-in',
      env: { DEV: false, VITE_APP_ENV: 'production' },
    },
    { label: 'app env unset, no opt-in', env: { DEV: false } },
    {
      label: 'unknown app env',
      env: { DEV: false, VITE_APP_ENV: 'qa-sandbox' },
    },
  ]

  it.each(matrix)(
    'trace capture enabled implies user-text admission — $label',
    async ({ env }) => {
      stubEnv(env)
      const captureEnabled = await traceCaptureEnabled()
      if (captureEnabled) {
        // The load-bearing implication. If this ever REDs, the
        // trace-store gate has widened past the admission and a bundle
        // can once again deny holding prose it holds.
        expect(shouldCaptureUserAuthoredText()).toBe(true)
      } else {
        // Nothing to prove in this direction — the admission is allowed
        // to be wider than the store's gate. Recorded so the case is not
        // silently vacuous.
        expect(captureEnabled).toBe(false)
      }
    },
  )

  it('CONTROL: the matrix actually exercises both sides of the implication', async () => {
    // Without this, every row above could be taking the vacuous branch
    // and the suite would be green while asserting nothing.
    const results: boolean[] = []
    for (const { env } of matrix) {
      vi.resetModules()
      vi.unstubAllEnvs()
      stubEnv(env)
      results.push(await traceCaptureEnabled())
    }
    expect(results.filter(Boolean).length).toBeGreaterThan(0)
    expect(results.filter((r) => !r).length).toBeGreaterThan(0)
  })
})
