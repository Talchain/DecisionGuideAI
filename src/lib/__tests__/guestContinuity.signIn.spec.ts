/**
 * S-G GUEST → ACCOUNT CONTINUITY — the sign-in carries the work the user was ACTUALLY doing (lane SIGNIN-IMPORT, 7 Oct).
 *
 * Spec (Paul, 7 Oct): "Sign-in carries the work the user was actually doing; no stale import, nothing lost."
 *
 * Every row drives the REAL producer (`callV5Turn`, the turn transport every guest turn passes) and the REAL sign-in
 * observation (`handleAuthObservation`), on real localStorage, with only the network stubbed. The rows assert by
 * IDENTITY: which scenario ids the copy route was asked for, and which copy the canvas adopted.
 *
 * R1 is the 7 Oct production case, measured from prod CEE logs: Paul's browser last sent turns on 657e63ef on 28 Sep,
 * viewed it on 5 Oct, and his sign-in on 7 Oct 08:40:57Z copied it (POST …/657e63ef…/copy 08:40:58Z) although he had
 * not worked on it for nine days. (The £200k guest session cb83eaf6 at 07:46Z was the DL's prod smoke runner in its own
 * browser, not Paul's: cut9-PROD-witness-20261007.md.)
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'

const auth = vi.hoisted(() => ({ stored: false }))
vi.mock('../storedSupabaseSession', () => ({ hasStoredSupabaseSession: () => auth.stored }))
vi.mock('../payload-trace-store', () => ({ recordRequestPayload: () => {}, recordResponsePayload: () => {} }))

import { callV5Turn } from '../../v5/v5Adapter'
import { handleAuthObservation } from '../guestCopyOnSignIn'
import { sweepUserScopedStorage } from '../auth/userScopedKeys'
import type { GuestCopyOutcome } from '../../services/guestCopyService'

const POINTER = 'olumi-canvas-current-scenario-id'
const LEGACY_PENDING = 'olumi.pendingGuestCopy.v1'

const SEP28 = '657e63ef-f220-4fd5-9b4b-25e04334b3e4' // Paul's 28 Sep guest decision (prod)
const TODAY = 'cb83eaf6-d743-4a78-b9c0-f6331d7f13c3' // a decision worked on this morning
const EARLIER_TODAY = 'f9747ab2-2e34-4110-b45d-13d8649d237e'
const COPY_OF: Record<string, string> = {
  [SEP28]: 'fa02a890-0000-4000-8000-000000000001',
  [TODAY]: '6582edbc-0000-4000-8000-000000000002',
  [EARLIER_TODAY]: 'a0ca1b01-0000-4000-8000-000000000003',
}

const now = (run: () => void) => run()
let tokenSeq = 0
const freshToken = () => `eyJ.row-${++tokenSeq}.sig`

const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ response_version: 2, assistant_text: 'ok', blocks: [], suggested_actions: [], insights: [], stage_indicator: 'frame' }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as unknown as typeof fetch

/** A guest turn, exactly as the product sends one: the store id + pointer set by the mint, then the transport. */
async function guestTurn(scenarioId: string, at: string, message = 'Help me decide') {
  vi.setSystemTime(new Date(at))
  localStorage.setItem(POINTER, scenarioId)
  await callV5Turn({
    kind: 'message',
    turn_id: crypto.randomUUID(),
    scenario_id: scenarioId,
    message,
    turn_class: 'frame',
    stage: 'frame',
    source: 'composer',
  }, { fetchImpl })
}

function copyRoute() {
  return vi.fn(async (source: string): Promise<GuestCopyOutcome> => ({ kind: 'copied', scenarioId: COPY_OF[source], created: true }))
}

async function signIn(at: string, request: ReturnType<typeof copyRoute>, adopt = vi.fn(async () => true)) {
  vi.setSystemTime(new Date(at))
  await handleAuthObservation('transition', freshToken(), { request, adopt }, now)
  return adopt
}

const requested = (request: ReturnType<typeof copyRoute>) => request.mock.calls.map((call) => call[0])

beforeAll(() => {
  ;(import.meta.env as Record<string, unknown>).VITE_V5_ENDPOINT = 'https://example.test/proxy/v5/turn'
})
afterAll(() => {
  delete (import.meta.env as Record<string, unknown>).VITE_V5_ENDPOINT
})
beforeEach(() => {
  localStorage.clear()
  auth.stored = false
  vi.useFakeTimers({ toFake: ['Date'] })
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('RED rows — sign-in must carry the work the user was doing, never a stale one silently', () => {
  it('R1 (7 Oct prod): the browser last worked on a decision 9 days ago → signing in does NOT copy it silently', async () => {
    await guestTurn(SEP28, '2026-09-28T13:06:28Z', 'personal assistant vs AI assistant')
    const request = copyRoute()

    await signIn('2026-10-07T08:40:57Z', request)

    expect(requested(request)).not.toContain(SEP28)
  })

  it('R1b: a pointer the browser kept from before this build (no turn ever recorded) is never copied silently', async () => {
    localStorage.setItem(POINTER, SEP28)
    const request = copyRoute()

    await signIn('2026-10-07T08:40:57Z', request)

    expect(requested(request)).not.toContain(SEP28)
  })

  it('R2 (the ordering the brief named): an id left pending by an EARLIER sign-in never pre-empts the decision worked on now', async () => {
    localStorage.setItem(LEGACY_PENDING, SEP28) // an earlier sign-in's copy was kept by a 503, then the session lapsed
    await guestTurn(TODAY, '2026-10-07T07:46:31Z')
    const request = copyRoute()

    const adopt = await signIn('2026-10-07T08:40:57Z', request)

    expect(requested(request)).toContain(TODAY)
    expect(adopt).toHaveBeenCalledWith(TODAY, COPY_OF[TODAY], expect.any(Function))
  })

  it('R3: two decisions worked on in one sitting → BOTH reach the account; only the one on screen opens', async () => {
    await guestTurn(EARLIER_TODAY, '2026-10-07T06:40:00Z')
    await guestTurn(TODAY, '2026-10-07T08:30:00Z') // the pointer now names TODAY
    const request = copyRoute()

    const adopt = await signIn('2026-10-07T08:40:57Z', request)

    expect([...requested(request)].sort()).toEqual([EARLIER_TODAY, TODAY].sort())
    expect(adopt).toHaveBeenCalledTimes(1)
    expect(adopt).toHaveBeenCalledWith(TODAY, COPY_OF[TODAY], expect.any(Function))
  })

  it('R4: a session that lapses (no SIGNED_OUT) runs the boundary sweep, which removes ids pending for that account', () => {
    localStorage.setItem(LEGACY_PENDING, SEP28)

    sweepUserScopedStorage()

    expect(localStorage.getItem(LEGACY_PENDING)).toBeNull()
  })
})

describe('controls', () => {
  it('C1: ONE decision worked on minutes before signing in → copied once, and the copy opens', async () => {
    await guestTurn(TODAY, '2026-10-07T08:35:00Z')
    const request = copyRoute()

    const adopt = await signIn('2026-10-07T08:40:57Z', request)

    expect(requested(request)).toEqual([TODAY])
    expect(adopt).toHaveBeenCalledWith(TODAY, COPY_OF[TODAY], expect.any(Function))
  })

  it('C2: no guest decision at all → no copy request', async () => {
    const request = copyRoute()

    const run = handleAuthObservation('transition', freshToken(), { request }, now)

    expect(run).toBeNull()
    expect(request).not.toHaveBeenCalled()
  })
})
