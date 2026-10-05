/**
 * ⭐ LAPSE-BOUNDARY (DL ruling on #2525, Codex r1 P1-3; HIGH): a signed-in session that ENDS WITHOUT A SIGN-OUT is an
 * identity boundary too.
 *
 * Sign-out, A→B and A→none in another tab all run `clearUserScopedState`. A lapse runs nothing: a refresh token that
 * fails while the browser is closed is dropped by supabase-js on the next load, and that page booted signed in, so no
 * provider sees an owner change (`AuthContext`'s `lastSignedInUserId` lives in memory only). The page after it is a
 * GUEST's, in a browser still holding the previous account's transcript, run history and every other user-scoped key.
 *
 * So a signed-in page records that this browser was signed in (`markSignedInHere`, from the thin predicate's first
 * true), the boundary's sweep removes that record (`USER_SCOPED_STORAGE_KEYS`), and a boot that finds the record with
 * no stored session runs the boundary BEFORE the app renders (`main.tsx`, inside AppPoC's lazy factory): before any
 * route, restore or `?run=` read.
 *
 * The same person returning after a lapse loses local-only work (run history) exactly as after a sign-out today.
 */
import { hasStoredSupabaseSession } from '../storedSupabaseSession'

/** Written by a signed-in page; removed only by the identity boundary's sweep. */
export const SIGNED_IN_HERE_KEY = 'olumi-signed-in-here.v1'

/** Whether this page has recorded the sign-in since its last identity boundary (the sweep removes the record). */
let markedSinceBoundary = false

/** The thin predicate calls this when a page is signed in. Never throws. */
export function markSignedInHere(): void {
  try {
    if (localStorage.getItem(SIGNED_IN_HERE_KEY) !== '1') localStorage.setItem(SIGNED_IN_HERE_KEY, '1')
    markedSinceBoundary = true
  } catch {
    // Storage refused: the lapse cannot be recognised later, which is today's behaviour, never worse.
  }
}

/** Whether an identity boundary has run on this page (sign-out, A→B, A→none). */
let boundaryOnThisPage = false

/** `clearUserScopedState` calls this: its sweep has removed the record. */
export function noteIdentityBoundary(): void {
  markedSinceBoundary = false
  boundaryOnThisPage = true
}

/**
 * The auth provider calls this when it ADOPTS a real session. After a boundary on this page, that session is a new
 * sign-in the latched thin predicate will never answer for afresh, so it is recorded here (Codex, #2530 r1 P1-2).
 * Only from confirmed adoption, never from "a session is stored": during a sign-out the SDK removes the stored token
 * only after its logout request, and the canvas mirror can outlive its page, so either would re-record the identity
 * that just signed out and turn the next guest's boot into a false lapse (Codex, #2530 r2). No boundary on this page
 * means nothing to do: a first sign-in is recorded by the predicate, and leaves the provider's storage untouched (#2484).
 */
export function recordSignInAfterBoundary(): void {
  if (boundaryOnThisPage && !markedSinceBoundary) markSignedInHere()
}

export function __resetLapseBoundaryForTests(): void {
  markedSinceBoundary = false
  boundaryOnThisPage = false
}

/** Synchronous: this browser was signed in, and the session is gone without the boundary having run. */
export function sessionLapsedHere(): boolean {
  try {
    return localStorage.getItem(SIGNED_IN_HERE_KEY) !== null && !hasStoredSupabaseSession()
  } catch {
    return false
  }
}

/**
 * Before the app renders: a lapse is an identity boundary. Resolves true when it ran. Never rejects, so the app always
 * renders: the boundary loads with the canvas store, and a failure to load it leaves the page exactly as it was before
 * this existed.
 */
export async function runLapseBoundaryIfNeeded(
  loadBoundary: () => Promise<{ clearUserScopedState: () => void }> = () => import('./userScopedState'),
): Promise<boolean> {
  if (!sessionLapsedHere()) return false
  try {
    const { clearUserScopedState } = await loadBoundary()
    // Decided again AFTER the await: another tab may have stored a session meanwhile, and a sweep then would delete a
    // signed-in identity's work (Codex, #2530 r1).
    if (!sessionLapsedHere()) return false
    // Its sweep removes `SIGNED_IN_HERE_KEY` too (`USER_SCOPED_STORAGE_KEYS`), so the next guest boot is not a lapse.
    clearUserScopedState()
  } catch {
    return false
  }
  return true
}
