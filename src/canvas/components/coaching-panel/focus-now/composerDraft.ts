/**
 * composerDraft — merge a Focus row's prefill prompt into the chat composer draft
 * WITHOUT clobbering unsent user text.
 *
 * The chat composer mirrors its value to canvas-store `draftComposerText` (see
 * useComposerState: debounced write-through + unmount flush), so a message the
 * user typed on the Olumi tab is persisted there even after they switch to the
 * Analysis tab. A Focus action that overwrote `draftComposerText` would silently
 * destroy that unsent draft. So we APPEND with a blank-line separator instead —
 * the user keeps their text and gets the suggested prompt, and can trim either.
 *
 * This is prefill-only: it never sends, and it is the same text whether the
 * composer is mounted (live value) or not (persisted draft a fresh mount reads).
 */

/**
 * @param existing current composer draft (null/undefined/empty when none)
 * @param prompt   the row's UI-authored prefill text
 * @returns the merged composer text: just `prompt` when there is no draft,
 *          otherwise `draft` + blank line + `prompt`. Idempotent: if the draft
 *          already ends with `prompt` (a repeat click), it is returned unchanged
 *          so prompts don't stack.
 */
export function mergeComposerDraft(existing: string | null | undefined, prompt: string): string {
  const base = (existing ?? '').replace(/\s+$/, '')
  if (base.length === 0) return prompt
  if (base.endsWith(prompt)) return base
  return `${base}\n\n${prompt}`
}
