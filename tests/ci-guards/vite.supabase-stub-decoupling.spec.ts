/**
 * Front-door guard — the Supabase SDK stub must stay DECOUPLED from PoC mode.
 *
 * Why this test exists
 * --------------------
 * `vite.config.ts` used to alias `@supabase/supabase-js` (and its internal
 * `@supabase/gotrue-js`) to `src/stubs/*.mjs` whenever the build was a
 * PoC/guest build. Staging pins `VITE_AUTH_MODE = "guest"` in `netlify.toml`,
 * so the REAL auth SDK was never in the deployed bundle — and the stub does
 * not implement `signInWithOtp` / `signInWithOAuth`, which are the only two
 * methods `src/contexts/AuthContext.tsx` ever calls. Sign-in could not work,
 * regardless of the `requireLogin` flag. (Verified at the bytes against the
 * live staging bundle at commit 9d839524: zero occurrences of `AuthApiError`,
 * `code_verifier`, `gotrue-js`, `AuthRetryableFetchError`.)
 *
 * `VITE_STUB_SUPABASE=0` keeps the real client in the bundle while leaving
 * guest mode as the default.
 *
 * This imports the SAME module `vite.config.ts` imports — there is no
 * hand-copied second list of the rule to drift out of sync.
 *
 * Mutation check: change `shouldStubSupabase` in
 * scripts/supabase-stub-decision.mjs back to `return isPocBuild(env)` and the
 * opt-out cases below fail.
 */
import { describe, it, expect } from 'vitest'
import { shouldStubSupabase, isPocBuild } from '../../scripts/supabase-stub-decision.mjs'

describe('shouldStubSupabase — front-door decoupling', () => {
  it('guest build, VITE_STUB_SUPABASE unset: stubs — historical behaviour pinned', () => {
    expect(shouldStubSupabase({ VITE_AUTH_MODE: 'guest' })).toBe(true)
  })

  it('VITE_POC_ONLY=1, VITE_STUB_SUPABASE unset: stubs', () => {
    expect(shouldStubSupabase({ VITE_POC_ONLY: '1' })).toBe(true)
  })

  it('guest build + VITE_STUB_SUPABASE=0: does NOT stub — the fix', () => {
    expect(shouldStubSupabase({ VITE_AUTH_MODE: 'guest', VITE_STUB_SUPABASE: '0' })).toBe(false)
  })

  it('VITE_POC_ONLY=1 + VITE_STUB_SUPABASE=0: does NOT stub', () => {
    expect(shouldStubSupabase({ VITE_POC_ONLY: '1', VITE_STUB_SUPABASE: '0' })).toBe(false)
  })

  it('non-PoC build: does not stub regardless', () => {
    expect(shouldStubSupabase({ VITE_AUTH_MODE: 'real', VITE_POC_ONLY: '0' })).toBe(false)
    expect(shouldStubSupabase({})).toBe(false)
  })

  it('only the exact string "0" opts out — no truthiness surprises', () => {
    for (const v of ['1', 'true', 'false', '', 'no', '00']) {
      expect(shouldStubSupabase({ VITE_AUTH_MODE: 'guest', VITE_STUB_SUPABASE: v })).toBe(true)
    }
  })

  it('the opt-out does NOT change guest-mode detection itself', () => {
    // The whole point: guest mode stays on, so unauthenticated visitors keep
    // the guest canvas and the other workstreams' staging QA is unaffected.
    expect(isPocBuild({ VITE_AUTH_MODE: 'guest', VITE_STUB_SUPABASE: '0' })).toBe(true)
    expect(isPocBuild({ VITE_POC_ONLY: '1', VITE_STUB_SUPABASE: '0' })).toBe(true)
  })
})

describe('vite.config wiring — the alias list actually uses the decision', () => {
  it('vite.config.ts imports the shared module and gates BOTH Supabase aliases on it', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    // `import.meta.url` is an http:// URL under jsdom, so resolve from cwd
    // (vitest runs at the repo root) rather than from the module URL.
    const src = readFileSync(resolve(process.cwd(), 'vite.config.ts'), 'utf-8')

    expect(src).toContain("from './scripts/supabase-stub-decision.mjs'")
    expect(src).toContain('shouldStubSupabase(env)')

    // The two Supabase aliases must sit inside the `stubSupabase` block, and
    // react-query must NOT (it stays on the isPoc gate).
    const stubBlock = src.slice(src.indexOf('...(stubSupabase ?'), src.indexOf('...(isPoc ?'))
    expect(stubBlock).toContain('@supabase/supabase-js')
    expect(stubBlock).toContain('@supabase/gotrue-js')
    expect(stubBlock).not.toContain('@tanstack/react-query')
  })
})
