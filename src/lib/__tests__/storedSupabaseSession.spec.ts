/**
 * `hasStoredSupabaseSession` — the synchronous "is there anything to wait for?"
 * probe that lets `OptionalAuthProvider` say "I don't know yet".
 *
 * ── TWO OPPOSITE HARMS, SO BOTH DIRECTIONS ARE ASSERTED ───────────────────
 *  · A FALSE `true` puts a guest behind a spinner for a session that is never
 *    coming. Guest is the supported pilot experience, so this is the worse of
 *    the two.
 *  · A FALSE `false` re-opens the defect: a returning owner is shown the
 *    arrival screen for someone who has never signed in.
 * Neither direction is inferred from the other passing.
 *
 * ── THE KEY IS DERIVED, NOT ASSUMED ───────────────────────────────────────
 * Every fixture key below is BUILT with the SDK's own formula rather than
 * typed as a literal, so the fixtures and the probe cannot agree with each
 * other while both disagree with the SDK. Source, read at this tip in
 * `node_modules/@supabase/supabase-js/dist/main/SupabaseClient.js`:
 *
 *     const defaultStorageKey =
 *       `sb-${new URL(this.authUrl).hostname.split('.')[0]}-auth-token`
 *
 * ── STATE-CLASS ───────────────────────────────────────────────────────────
 * Every case starts from a cleared `localStorage` and seeds exactly what it
 * names. No case inherits another's storage.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { hasStoredSupabaseSession } from '../storedSupabaseSession'

/** The SDK's own default-storage-key construction, applied to a project URL. */
function defaultStorageKeyFor(projectUrl: string): string {
  return `sb-${new URL(`${projectUrl}/auth/v1`).hostname.split('.')[0]}-auth-token`
}

const PROJECT_URL = 'https://abcdefghijklmnopqrst.supabase.co'
const KEY = defaultStorageKeyFor(PROJECT_URL)

function session(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    access_token: 'fixture-not-a-real-token',
    refresh_token: 'fixture-not-a-real-refresh-token',
    token_type: 'bearer',
    expires_at: Math.floor(Date.now() / 1000) - 3600,
    user: { id: 'owner', email: 'owner@example.com' },
    ...overrides,
  })
}

describe('hasStoredSupabaseSession', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  // ── PRECONDITION (trap 13b) ────────────────────────────────────────────
  // If the derivation stopped producing a key the probe's pattern matches,
  // every positive case below would fail for the wrong reason and every
  // negative one would pass while proving nothing.
  it('precondition: the derived key has the shape the probe looks for', () => {
    expect(KEY).toBe('sb-abcdefghijklmnopqrst-auth-token')
    expect(KEY).toMatch(/^sb-.+-auth-token$/)
  })

  it('is false for a fresh visitor with empty storage', () => {
    expect(hasStoredSupabaseSession()).toBe(false)
  })

  it('is true when a stored session holds an access token', () => {
    localStorage.setItem(KEY, session())
    expect(hasStoredSupabaseSession()).toBe(true)
  })

  it('is true on a refresh token alone — the expired-access-token case', () => {
    // This is the return-after-an-hour user: the access token is spent, and
    // the only thing that can bring them back is the refresh. Answering
    // `false` here would re-open the exact defect.
    localStorage.setItem(KEY, session({ access_token: '' }))
    expect(hasStoredSupabaseSession()).toBe(true)
  })

  // ── THE DISCRIMINATION THE ANCHORED SUFFIX EXISTS FOR ──────────────────
  it('is false for a PKCE code-verifier left by an abandoned sign-in', () => {
    // gotrue writes `${storageKey}-code-verifier` when a sign-in STARTS. A
    // visitor who clicked "Sign in", changed their mind, and came back has
    // this and no session. An unanchored pattern would match it and put them
    // behind a spinner for a session that cannot arrive.
    localStorage.setItem(`${KEY}-code-verifier`, JSON.stringify('a-verifier'))
    expect(hasStoredSupabaseSession()).toBe(false)
  })

  it('is false for a signed-out entry whose value gotrue cleared', () => {
    localStorage.setItem(KEY, '')
    expect(hasStoredSupabaseSession()).toBe(false)
    localStorage.setItem(KEY, 'null')
    expect(hasStoredSupabaseSession()).toBe(false)
  })

  it('is false for a malformed entry no session can be restored from', () => {
    localStorage.setItem(KEY, '{not json')
    expect(hasStoredSupabaseSession()).toBe(false)
  })

  it('is false for an entry carrying no token of either kind', () => {
    localStorage.setItem(KEY, JSON.stringify({ user: { id: 'owner' } }))
    expect(hasStoredSupabaseSession()).toBe(false)
  })

  it("ignores the app's own unrelated storage keys", () => {
    // A guest genuinely has keys here — the scenario pointer among them. None
    // may be mistaken for a session.
    localStorage.setItem('olumi-canvas-current-scenario-id', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
    localStorage.setItem('feature.requireLogin', '1')
    localStorage.setItem('sb-something-else', session())
    localStorage.setItem('auth-token', session())
    expect(hasStoredSupabaseSession()).toBe(false)
  })

  it('finds the session when other keys sit around it', () => {
    localStorage.setItem('olumi-canvas-current-scenario-id', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
    localStorage.setItem(KEY, session())
    localStorage.setItem('feature.listView', '1')
    expect(hasStoredSupabaseSession()).toBe(true)
  })

  it('answers false rather than throwing when storage is unavailable', () => {
    // Safari private mode, blocked third-party storage, a disabled-storage
    // policy. "I cannot tell" and "there is nothing to wait for" must lead to
    // the same place: the guest path, at full speed.
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('SecurityError: storage is disabled')
      },
    })
    try {
      expect(hasStoredSupabaseSession()).toBe(false)
    } finally {
      if (original) Object.defineProperty(globalThis, 'localStorage', original)
    }
  })

  it('never returns any part of the stored value', () => {
    // The stored session carries bearer tokens. The only output is a boolean,
    // and that is a security property, not a style choice.
    localStorage.setItem(KEY, session())
    expect(typeof hasStoredSupabaseSession()).toBe('boolean')
  })
})
