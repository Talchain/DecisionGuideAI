// Front-door fix: the single source of truth for "should this build stub the
// Supabase SDK?".
//
// Extracted from vite.config.ts so it can be unit-tested without importing the
// whole Vite config (which pulls in esbuild and cannot load under jsdom).
// vite.config.ts imports this module — there is no second copy of the rule.
//
// Background: `isPoc` historically did three jobs at once — mint a guest user
// (src/lib/poc.ts `isGuestAuth`), stub @tanstack/react-query, AND alias the
// real Supabase SDK out of the bundle. Staging pins VITE_AUTH_MODE="guest" in
// netlify.toml, so the real auth client was never deployed, and the stub in
// src/stubs/supabase-stub.mjs does not implement signInWithOtp /
// signInWithOAuth — the only two methods src/contexts/AuthContext.tsx calls.
// Sign-in therefore could not work on staging regardless of the requireLogin
// flag. See the FLIP RUNBOOK note on `requireLogin` in src/flags.ts.

/**
 * Is this a PoC / guest-mode build?
 * @param {Record<string, string | undefined>} env
 * @returns {boolean}
 */
export function isPocBuild(env) {
  return env.VITE_POC_ONLY === '1' || env.VITE_AUTH_MODE === 'guest'
}

/**
 * Should the Supabase SDK (`@supabase/supabase-js` AND its internal
 * `@supabase/gotrue-js`) be aliased to the local stubs?
 *
 * Default preserves the historical behaviour exactly: stub on any PoC/guest
 * build. `VITE_STUB_SUPABASE=0` opts out, keeping the REAL client in the
 * bundle so magic-link sign-in works — WITHOUT turning guest mode off, so
 * unauthenticated visitors still get the guest canvas.
 *
 * The two Supabase aliases are always decided together: aliasing gotrue-js to
 * `export default {}` while leaving the real supabase-js in place would break
 * the client, which imports GoTrueClient from it.
 *
 * @param {Record<string, string | undefined>} env
 * @returns {boolean}
 */
export function shouldStubSupabase(env) {
  if (env.VITE_STUB_SUPABASE === '0') return false
  return isPocBuild(env)
}
