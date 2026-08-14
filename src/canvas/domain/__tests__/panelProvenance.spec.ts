/**
 * `panel_elicited` classification — the attribution that must NOT read as the
 * reader's own work.
 *
 * ── THE DEFECT THIS PINS ──────────────────────────────────────────────────
 * Before 0.40.0 the only way to act on a colleague's revealed estimate was to
 * retype it, which stamped `user_override` and rendered as "User edited". The
 * whole point of the new kind is that a panel value is somebody ELSE's stated
 * belief, so it must never be classified `userOwned` and must never be labelled
 * with first-person copy.
 */

import { describe, expect, it } from 'vitest'

import {
  VALUE_PROVENANCE_SOURCES,
  classifyValueProvenance,
} from '../valueProvenance'

describe('panel_elicited provenance', () => {
  it('classifies as kind "panel"', () => {
    expect(classifyValueProvenance('panel_elicited')?.kind).toBe('panel')
  })

  it('⭐ is NOT userOwned — a colleague’s estimate is not the reader’s own work', () => {
    // The load-bearing assertion. If this flipped, every user-owned surface
    // would start writing first-person copy over somebody else's number — the
    // exact untruth the retype path produced, reintroduced one layer up.
    expect(classifyValueProvenance('panel_elicited')?.userOwned).toBe(false)

    // CONTRAST CONTROL: a genuinely user-owned literal reads true in the same
    // call, so the assertion above is a discrimination and not a probe that
    // returns false for everything.
    expect(classifyValueProvenance('user_override')?.userOwned).toBe(true)
  })

  it('is a DISTINCT kind, not an alias for edited/human', () => {
    const panel = classifyValueProvenance('panel_elicited')?.kind
    expect(panel).not.toBe('edited')
    expect(panel).not.toBe('human')
    expect(panel).not.toBe('confirmed')
  })

  it('appears in the classified-source corpus', () => {
    expect(VALUE_PROVENANCE_SOURCES).toContain('panel_elicited')
  })

  it('an UNKNOWN literal still classifies as null — honest-neutral, never guessed', () => {
    // The contract's instruction for unknown literals, unchanged by the new
    // member: classify unknown/absent as neutral, never guess a class.
    expect(classifyValueProvenance('some_future_source')).toBeNull()
    expect(classifyValueProvenance(undefined)).toBeNull()
  })
})
