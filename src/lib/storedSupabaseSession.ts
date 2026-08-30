/**
 * "Should this page expect a Supabase session?" — answered SYNCHRONOUSLY, on
 * the first render, before any promise resolves.
 *
 * ── WHY THIS EXISTS ───────────────────────────────────────────────────────
 * `supabase.auth.getSession()` is async, and for a returning user whose access
 * token has expired it is a NETWORK ROUND-TRIP (gotrue refreshes before it
 * answers). Until it settles the app has no idea whether it is serving a guest
 * or an owner. `OptionalAuthProvider` used to resolve that ambiguity by
 * guessing "guest", which is right for most visitors and wrong — visibly,
 * alarmingly wrong — for the one who signed in yesterday: they got the
 * arrival screen for anyone who has never signed in, on top of work they could
 * not see.
 *
 * The provider cannot say "I don't know yet" unless something tells it whether
 * there is anything to wait FOR. That is this module's whole job, and the
 * answer must be available in the same tick as the first render or it is
 * useless.
 *
 * ── WHY IT IS SAFE FOR A GUEST (the constraint that shapes the design) ────
 * Guest is the supported pilot experience: a colleague opens the link and uses
 * the product without signing in. They must pay NOTHING for this — no probe to
 * await, no spinner, no gate. So this is a plain `localStorage` read with no
 * network, no async, and no session validation: with no stored key it answers
 * `false` immediately and the guest path is byte-for-byte what it was.
 *
 * ── THE KEY, DERIVED RATHER THAN ASSUMED ─────────────────────────────────
 * `src/lib/supabase.ts` passes no `storageKey`, so the SDK's default applies.
 * `@supabase/supabase-js` builds it at `dist/main/SupabaseClient.js`:
 *
 *     // default storage key uses the supabase project ref as a namespace
 *     const defaultStorageKey =
 *       `sb-${new URL(this.authUrl).hostname.split('.')[0]}-auth-token`
 *
 * and `@supabase/gotrue-js` writes the session there as plain JSON
 * (`lib/helpers.js`: `storage.setItem(key, JSON.stringify(data))`).
 *
 * This DISCOVERS the key by pattern rather than recomputing that formula from
 * `VITE_SUPABASE_URL`. Recomputing would be a second copy of the SDK's rule
 * living in our tree — a hand-maintained mirror that goes silently wrong the
 * day the project ref, the URL shape or the formula changes, and goes wrong in
 * the direction of a FALSE "no session", which is exactly the defect being
 * fixed. Discovery cannot drift that way.
 *
 * ── TWO INDEPENDENT GUARDS, AND WHICH ONE ACTUALLY DOES THE WORK ─────────
 * ⚠ AN EARLIER VERSION OF THIS COMMENT CLAIMED THE `$` ANCHOR WAS WHAT KEPT A
 * PKCE CODE-VERIFIER OUT, AND A MUTANT REFUTED IT. gotrue writes
 * `${storageKey}-code-verifier` when a sign-in STARTS, so a visitor who began
 * signing in and changed their mind has that key and no session — and treating
 * it as a session would put a guest behind a spinner for something that is
 * never coming. But un-anchoring the pattern in a throwaway worktree left the
 * whole suite GREEN (mutant M5, 17/17): gotrue stores the verifier as
 * `JSON.stringify(<string>)`, so it is excluded by the VALUE check below —
 * `typeof parsed !== 'object'` — and the anchor never gets a chance to matter.
 *
 * So, stated accurately: the VALUE check is the discriminator for the case we
 * actually ship, and the anchor is defence in depth — it binds to the exact
 * key rather than to anything merely beginning with it. Both are kept, because
 * they fail independently and a guard that agrees with its neighbour is not a
 * second guard. The spec now pins each ON ITS OWN, so neither can quietly stop
 * discriminating behind the other.
 *
 * The durable lesson, recorded because it cost a mutant to find: a rationale
 * written into a comment is a CLAIM about the code, and an unmeasured claim
 * about your own guard is exactly as wrong as an unmeasured claim about the
 * product.
 *
 * ── WHAT THIS DELIBERATELY DOES NOT DO ────────────────────────────────────
 * It does not decide whether the session is VALID, current, or refreshable —
 * only `getSession()` can, and this runs before it. A `true` here is a claim
 * about one thing: this browser has previously held a session for this app, so
 * "guest" is not yet a safe answer. Every caller must still resolve the real
 * answer asynchronously and must bound how long it waits.
 *
 * ── SECURITY ──────────────────────────────────────────────────────────────
 * The stored value contains bearer tokens. Nothing here returns, logs, stores
 * or otherwise surfaces any part of it: the only output is a boolean. Do not
 * change that.
 */

/**
 * Matches the SDK's default auth-token key and nothing else.
 * Anchored at BOTH ends — see the `-code-verifier` note above.
 */
const SUPABASE_AUTH_TOKEN_KEY = /^sb-.+-auth-token$/

/**
 * Does this browser hold a stored Supabase session for this app?
 *
 * Synchronous, network-free, and total: any storage that is missing, blocked
 * (Safari private mode, third-party-cookie blocking, a disabled-storage
 * policy) or throwing answers `false`, because "I cannot tell" and "there is
 * nothing to wait for" must lead to the same place — the guest path, at full
 * speed. Failing the other way would put every visitor with blocked storage
 * behind a spinner for a session that cannot exist.
 */
export function hasStoredSupabaseSession(): boolean {
  try {
    const storage = globalThis.localStorage
    if (!storage) return false

    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i)
      if (!key || !SUPABASE_AUTH_TOKEN_KEY.test(key)) continue

      const raw = storage.getItem(key)
      if (!raw) continue

      // Presence of the key is not enough to expect a session: gotrue clears
      // the value on sign-out and can leave an empty or half-written entry
      // behind. Require something that could actually BE a session — a token
      // to present, or a token to refresh with.
      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      } catch {
        // Unparseable means no session can be restored from it, so the honest
        // answer is the fast one. (A malformed entry cannot yield a session,
        // so this cannot hide a signed-in user from themselves.)
        continue
      }

      if (!parsed || typeof parsed !== 'object') continue
      const candidate = parsed as { access_token?: unknown; refresh_token?: unknown }
      if (
        typeof candidate.access_token === 'string' && candidate.access_token.length > 0
      ) return true
      if (
        typeof candidate.refresh_token === 'string' && candidate.refresh_token.length > 0
      ) return true
    }

    return false
  } catch {
    return false
  }
}
