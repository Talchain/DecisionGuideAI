/**
 * An unrecognised provenance token never reaches a user, on any surface.
 *
 * ── THE DEFECT, WHICH THE CODE ALREADY DESCRIBES IN THE PAST TENSE ─────────
 * `utils.ts:78-83` records that `mapSourceToDisplay`'s old fallback "rendered
 * the RAW WIRE LITERAL to the user" and that the leak "left the estate in what
 * a user pastes into a document". The map was then keyed on the canonical
 * CLASS instead of three literals — a real improvement — and the fallback tail
 * `: source` was left in place. So the leak was narrowed and never closed.
 *
 * `ModelTabBody.tsx:800-804` states it outright, as a reason for NOT adding a
 * second tail: *"`mapSourceToDisplay` already returns the raw token for
 * anything it cannot classify"*. Two comments describing a fix that one line
 * undoes. The classifier's own set is closed and `cee_hypothesis` is
 * deliberately excluded from it, so an unclassifiable source is a REAL state,
 * not a theoretical one.
 *
 * ── WHY `null` AND NOT A PRETTIER TOKEN ───────────────────────────────────
 * Title-casing `cee_hypothesis` into "Cee Hypothesis" is the same defect
 * wearing a hat. The honest answer is that this surface cannot name the source,
 * which is what `null` means here — and both callers already have a branch for
 * an absent label, so nothing has to invent one.
 */
import { describe, expect, it } from 'vitest'
import { mapSourceToDisplay } from '../utils'

describe('a source we cannot classify is not printed', () => {
  it('CONTROL: a source we CAN classify still renders its label', () => {
    // Without this the assertions below could pass by the function returning
    // null for everything, which would silently strip provenance from the pill.
    expect(mapSourceToDisplay('user_confirmed')).toBe('Confirmed by you')
    expect(mapSourceToDisplay('cee_inference')).toBe('AI estimate')
  })

  it('an unclassifiable token returns nothing, rather than itself', () => {
    expect(
      mapSourceToDisplay('cee_hypothesis'),
      'the wire token reached the surface',
    ).toBeNull()
    expect(mapSourceToDisplay('some_future_source_v2')).toBeNull()
  })

  it('DISCRIMINATOR: no return value is ever a snake_case token', () => {
    // Written over a range rather than over the two examples I happened to
    // have. A future producer value is exactly the case the old fallback was
    // silently passing through.
    const probes = [
      'cee_hypothesis',
      'brief_extraction',
      'user_confirmed',
      'cee_inference',
      'panel_write',
      'totally_unknown_thing',
      'x',
      '',
    ]
    for (const p of probes) {
      const out = mapSourceToDisplay(p)
      if (out === null) continue
      expect(out, `"${p}" rendered as a wire token: "${out}"`).not.toMatch(/^[a-z][a-z0-9_]*$/)
    }
  })

  it('an absent source is still absent, not empty string', () => {
    expect(mapSourceToDisplay(undefined)).toBeNull()
    expect(mapSourceToDisplay('')).toBeNull()
  })
})
