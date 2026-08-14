/**
 * F1 (review of #689) — the roster TTL is the R-2 FRESHNESS BOUND, and it was
 * untested.
 *
 * The reviewer's mutant deleting the TTL (`fresh()` reduced to a presence check)
 * **survived 43/43 green**, and it is not an equivalent mutant: with it, a
 * redacted participant's cached REAL NAME would be served for the life of the
 * tab instead of for at most `ROSTER_TTL_MS`. The redaction CORRECTNESS path was
 * already covered — the resolver uses the label it is served, and the only name
 * source is the server — but the BOUND on how long a stale label survives was
 * covered by nothing at all.
 *
 * ⚠ SCOPE, STATED PRECISELY. This file tests the CACHE's freshness contract:
 * after the TTL, a peek reports "nothing known" and a fresh request re-reads the
 * server. It deliberately does NOT assert that an already-mounted panel
 * re-fetches on expiry — that is review finding F3(a), separately rowed, and its
 * current behaviour is to degrade to the truthful unnamed sentence until
 * remount. Testing the cache contract here and claiming the component contract
 * would be the wider claim that trap 20 is about.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const ROUND_ID = 'c3d4e5f6-a7b8-4901-9234-56789abcdef0'
const GRACE_ID = '9f1c7d2e-4b3a-4c11-8e6f-0a2b5c8d7e10'

vi.mock('../../lib/supabase', async (importOriginal) => {
  // importOriginal-spread rather than a hand-listed factory: a `vi.mock` factory
  // REPLACES the module, and a hand list of exports has killed 51 tests in this
  // repo before (CLAUDE.md trap 12).
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    getSessionIdentity: vi.fn(async () => ({ userId: 'owner-1', accessToken: 'tok' })),
  }
})

/**
 * Two DIFFERENT responses in sequence, so a refetch is provable by its CONTENT
 * and not only by a call count. The second is the R-2 case the TTL exists for:
 * the owner has redacted Grace, and CEE now serves the pseudonym.
 */
function rosterResponse(displayName: string) {
  return {
    round_id: ROUND_ID,
    status: 'closed',
    targets: [],
    roster: [{ participant_id: GRACE_ID, display_name: displayName, status: 'active' }],
  }
}

function fetchCount(): number {
  return (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.length
}

describe('roundRosterCache — the TTL freshness bound (R-2)', () => {
  beforeEach(async () => {
    const { __resetRosterCacheForTests } = await import('../roundRosterCache')
    __resetRosterCacheForTests()
    vi.useFakeTimers()
    let call = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        call += 1
        // First read: the real name. Every later read: the pseudonym.
        const body = rosterResponse(call === 1 ? 'Grace' : 'Participant 2')
        return new Response(JSON.stringify(body), { status: 200 })
      }),
    )
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('POSITIVE CONTROL — a warm roster is peekable and cost exactly one request', async () => {
    // Without this, every expiry assertion below could pass because the cache
    // never worked, not because the TTL fired.
    const { ensureRoster, peekRoster } = await import('../roundRosterCache')
    await ensureRoster(ROUND_ID)
    expect(fetchCount()).toBe(1)
    expect(peekRoster(ROUND_ID)).toEqual([
      { participant_id: GRACE_ID, display_name: 'Grace' },
    ])
  })

  it('serves from cache while still fresh — no second request just before expiry', async () => {
    const { ensureRoster, peekRoster, ROSTER_TTL_MS } = await import('../roundRosterCache')
    await ensureRoster(ROUND_ID)
    expect(fetchCount()).toBe(1)

    vi.advanceTimersByTime(ROSTER_TTL_MS - 1)

    expect(peekRoster(ROUND_ID)).toEqual([
      { participant_id: GRACE_ID, display_name: 'Grace' },
    ])
    await ensureRoster(ROUND_ID)
    // The pairing that makes this test discriminate: one instant before expiry
    // the answer is BOTH still peekable AND still free. A TTL set too short
    // fails here; a TTL deleted fails the next test.
    expect(fetchCount()).toBe(1)
  })

  it('⭐ AFTER THE TTL a peek reports NOTHING KNOWN, never a stale name', async () => {
    const { ensureRoster, peekRoster, ROSTER_TTL_MS } = await import('../roundRosterCache')
    await ensureRoster(ROUND_ID)
    expect(peekRoster(ROUND_ID)).not.toBeUndefined()

    vi.advanceTimersByTime(ROSTER_TTL_MS + 1)

    // `undefined` is "nothing known" — which resolves to `roster_unavailable`,
    // whose copy still says the value came from the panel. It is NOT `null`
    // ("this round has no participants") and NOT the stale entry.
    expect(peekRoster(ROUND_ID)).toBeUndefined()
  })

  it('⭐ AFTER THE TTL a fresh request RE-READS THE SERVER and picks up the redaction', async () => {
    const { ensureRoster, peekRoster, ROSTER_TTL_MS } = await import('../roundRosterCache')
    await ensureRoster(ROUND_ID)
    expect(fetchCount()).toBe(1)

    vi.advanceTimersByTime(ROSTER_TTL_MS + 1)
    const refreshed = await ensureRoster(ROUND_ID)

    expect(fetchCount()).toBe(2)
    // Bound by CONTENT, not only by the call count: this is the whole point of
    // the TTL. The name Grace must be gone, replaced by what the server now
    // serves — a cache without expiry would still be answering 'Grace'.
    expect(refreshed).toEqual([
      { participant_id: GRACE_ID, display_name: 'Participant 2' },
    ])
    expect(peekRoster(ROUND_ID)).toEqual([
      { participant_id: GRACE_ID, display_name: 'Participant 2' },
    ])
    expect(JSON.stringify(refreshed)).not.toContain('Grace')
  })

  it('the TTL bounds a FAILED read too, so a signed-out moment is not permanent', async () => {
    // Both arms share the TTL deliberately: a cached failure that outlived a
    // sign-in would leave the surface unable to name anybody for the life of the
    // tab — the same defect as a stale name, pointing the other way.
    const { __resetRosterCacheForTests, ensureRoster, ROSTER_TTL_MS } = await import(
      '../roundRosterCache'
    )
    __resetRosterCacheForTests()
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 403 })))
    expect(await ensureRoster(ROUND_ID)).toBeNull()
    expect(fetchCount()).toBe(1)

    // Still inside the window: the failure is reused, not retried on sight.
    await ensureRoster(ROUND_ID)
    expect(fetchCount()).toBe(1)

    vi.advanceTimersByTime(ROSTER_TTL_MS + 1)
    await ensureRoster(ROUND_ID)
    expect(fetchCount()).toBe(2)
  })
})
