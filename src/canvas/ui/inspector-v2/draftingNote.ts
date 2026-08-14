/**
 * draftingNote — separates drafter-authored absorption notes from the user's
 * own description.
 *
 * ── THE PRODUCER'S FORMAT, DERIVED AT THE BYTES ──────────────────────────
 * CEE tip `ae0b4af`, `src/cee/transforms/option-rephrase-merge.ts:459-462`:
 *
 *     const alsoDraftedAs = `Also drafted as: ${twin.label}`;
 *     const appendDescription = (existing) =>
 *       existing && existing.trim().length > 0
 *         ? `${existing}\n\n${alsoDraftedAs}`
 *         : alsoDraftedAs;
 *
 * The note is **APPENDED** to any existing description, separated by a BLANK
 * LINE, and stands alone only when the description was empty. The enclosing
 * loop runs **per absorbed twin**, so notes accumulate as a trailing run of
 * `\n\n`-separated lines.
 *
 * ⚠ THE FIRST VERSION OF THIS MODULE CLAIMED CEE *PREFIXES*, AND PARSED WITH
 * `startsWith`. That was wrong, and inert on every option that already had a
 * description — a class reachable on a first draft, where V3 `description` is
 * the drafter's `node.body` (CEE `schema-v3.ts:207`). The corpus it was
 * written against contained only absorbed options with EMPTY descriptions, the
 * single class where "whole string" and "leading prefix" coincide, so every
 * sample agreed with the wrong parser (trap 13d). The producer's join was one
 * grep away and was never read. This header now states what the producer does;
 * re-derive it rather than trusting this paragraph.
 *
 * ── WHAT WE WRITE BACK ───────────────────────────────────────────────────
 * `composeDescription` emits the PRODUCER'S format, never a third one. If the
 * UI invented its own storage shape, the next consumer would have to parse
 * something no producer emits — and the last round of this work did exactly
 * that (`note\nbody`, single newline). That legacy form is tolerated on READ
 * so nothing written by it is stranded, and migrated on the first commit.
 *
 * ── KNOWN LIMIT ──────────────────────────────────────────────────────────
 * A user whose own prose is exactly a line reading `Also drafted as: …` in the
 * trailing position is re-attributed to Olumi. That is inherent to carrying
 * provenance inside a free-text field: nothing in the string distinguishes a
 * drafter's line from a user who typed the same words. The durable fix is a
 * dedicated wire field, which rides the contract wave with
 * `OPTION_REPHRASE_ABSORBED`. Pinned by test rather than left to be
 * rediscovered.
 */

/** The literal the drafter writes, once per absorbed twin. */
export const DRAFTING_NOTE_PREFIX = 'Also drafted as: '

/** The producer's block separator — a blank line. */
const BLOCK_SEPARATOR = '\n\n'

export interface ParsedDescription {
  /**
   * The drafter's notes, VERBATIM from the wire including their prefix, in
   * producer order. Empty when the description carries none. Rendered as-is:
   * the product must not invent copy about what was merged.
   */
  notes: string[]
  /** What remains — the user's own description. */
  body: string
}

/** A note block is a SINGLE line that is exactly one `Also drafted as:` note. */
function isNoteBlock(block: string): boolean {
  const trimmed = block.trim()
  return (
    trimmed.startsWith(DRAFTING_NOTE_PREFIX)
    && trimmed.length > DRAFTING_NOTE_PREFIX.length
    && !trimmed.includes('\n')
  )
}

/**
 * Splits a raw node description into the drafter's notes and the user's body.
 *
 * Notes are the maximal run of TRAILING blank-line-separated blocks that are
 * each a lone `Also drafted as: …` line — which is exactly the set the
 * producer can have appended. Anything earlier is the user's, including a line
 * that merely mentions the phrase mid-paragraph.
 */
export function parseDraftingNotes(raw: string | null | undefined): ParsedDescription {
  const text = typeof raw === 'string' ? raw : ''
  if (!text.trim()) return { notes: [], body: '' }

  const blocks = text.split(BLOCK_SEPARATOR)
  let firstNote = blocks.length
  while (firstNote > 0 && isNoteBlock(blocks[firstNote - 1]!)) firstNote -= 1

  if (firstNote < blocks.length) {
    return {
      notes: blocks.slice(firstNote).map(b => b.trim()),
      body: blocks.slice(0, firstNote).join(BLOCK_SEPARATOR).trim(),
    }
  }

  // Legacy tolerance: the single-newline LEADING form this UI briefly wrote.
  // No producer emits it; migrated to the producer's format on first commit.
  if (text.startsWith(DRAFTING_NOTE_PREFIX)) {
    const breakAt = text.indexOf('\n')
    if (breakAt !== -1) {
      return {
        notes: [text.slice(0, breakAt).trim()],
        body: text.slice(breakAt + 1).trim(),
      }
    }
  }

  return { notes: [], body: text }
}

/**
 * Rebuilds the stored description from the drafter's notes and an edited body,
 * in the PRODUCER's format.
 *
 * This is the half that stops the disclosure being DESTRUCTIBLE: every surface
 * that can edit the description edits only the body and recomposes here, so a
 * user writing their own description can no longer silently erase the record
 * that two of their options were merged.
 */
export function composeDescription(notes: string[], body: string): string {
  const trimmed = body.trim()
  if (notes.length === 0) return trimmed
  const joined = notes.join(BLOCK_SEPARATOR)
  return trimmed ? `${trimmed}${BLOCK_SEPARATOR}${joined}` : joined
}
