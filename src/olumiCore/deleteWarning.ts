/**
 * The one sentence core may send after a completed deletion (`aiLogLeft.words`, core 74b3dbca): what is left and who to write to. It
 * already carries the reference to quote, so ONLY the words are kept here, never the reference as a field and never the rest of core's
 * reply (its erase report names the person's scenarios). The page holds it just long enough for the signed-out screen to draw it, and
 * it survives a reload of that screen (sessionStorage) because the person needs the reference to quote.
 *
 * It goes when: the signed-out screen is left, any browser identity is forgotten (signout.ts), a person is read as signed in
 * (me.ts, accounts/Frame.tsx useWho), or the tab closes. No import from the rest of the lane, so any of those can call it.
 */
const KEPT = 'olumi-delete-ai-log-left'
let held: string | undefined

/** Keeps core's sentence (only a non-empty string); anything else keeps nothing. */
export function holdDeleteWarning(words: unknown): void {
  held = typeof words === 'string' && words !== '' ? words : undefined
  try { if (held) sessionStorage.setItem(KEPT, held); else sessionStorage.removeItem(KEPT) } catch { /* blocked storage: it shows once, without surviving a reload */ }
}

/** Core's sentence for the last deletion, or undefined. Read-only: the signed-out screen clears it when it goes. */
export function readDeleteWarning(): string | undefined {
  if (held) return held
  try { const v = sessionStorage.getItem(KEPT); return v ? v : undefined } catch { return undefined }
}

export function clearDeleteWarning(): void {
  held = undefined
  try { sessionStorage.removeItem(KEPT) } catch { /* nothing to clear */ }
}
