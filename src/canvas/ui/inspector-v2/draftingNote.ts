/**
 * draftingNote — separates a drafter-authored absorption note from the user's
 * own description.
 *
 * ── WHY THIS EXISTS (ROADMAP 2.1204) ─────────────────────────────────────
 * When CEE's drafter absorbs a rephrase-twin option, it prefixes the surviving
 * option's `description` with `"Also drafted as: <absorbed label>"`. That note
 * is the only user-reachable trace of the merge, and ruling R2 requires the
 * user be able to SEE the absorption happened.
 *
 * It arrived rendered — but rendered INSIDE the option's editable description
 * textarea, where it reads as the user's own prose and is destroyed the moment
 * they type their own. This module makes the two separable so the panel can
 * attribute the note and still hand the user an empty description field.
 *
 * ── BOUND TO THE KNOWN PREFIX ONLY ───────────────────────────────────────
 * A census of every JSON capture in `closing-witness-20260814/driver/` found
 * option descriptions carrying ONLY this note (12 occurrences, one distinct
 * value, zero carrying anything else). That says what the corpus contained,
 * never what the field admits (trap 12d) — a user can type a description and
 * CEE may emit other content — so the split is anchored to the literal prefix
 * and everything else is treated as the user's, never guessed at.
 */

/** The literal the drafter writes. Matched at the START of the description. */
export const DRAFTING_NOTE_PREFIX = 'Also drafted as: '

export interface ParsedDescription {
  /**
   * The drafter's note, VERBATIM from the wire including its prefix, or null
   * when the description carries none. Rendered as-is: the product must not
   * invent copy about what was merged.
   */
  note: string | null
  /** What remains after the note — the user's own description. */
  body: string
}

/**
 * Splits a raw node description into the drafter's note and the user's body.
 *
 * Only a description that BEGINS with the prefix carries a note, and only its
 * first line is the note — a later line that happens to mention the phrase is
 * the user's prose and stays theirs.
 */
export function parseDraftingNote(raw: string | null | undefined): ParsedDescription {
  const text = typeof raw === 'string' ? raw : ''
  if (!text.startsWith(DRAFTING_NOTE_PREFIX)) return { note: null, body: text }

  const breakAt = text.indexOf('\n')
  if (breakAt === -1) return { note: text, body: '' }

  return {
    note: text.slice(0, breakAt),
    body: text.slice(breakAt + 1).replace(/^\n+/, ''),
  }
}

/**
 * Rebuilds the stored description from a note and an edited body.
 *
 * This is the half that stops the disclosure being DESTRUCTIBLE: the panel
 * edits only the body, and every commit re-attaches the note, so a user
 * writing their own description can no longer silently erase the record that
 * two of their options were merged.
 */
export function composeDescription(note: string | null, body: string): string {
  const trimmed = body.trim()
  if (!note) return trimmed
  return trimmed ? `${note}\n${trimmed}` : note
}
