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
import {
  getExtractionLabel,
  getProvenanceLabel,
} from '../../ui/inspector-v2/inspectorStrings'
import { provenanceToPill } from '../../components/pre-analysis/provenanceUtils'

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

  it('⭐ the inspector NEVER credits Olumi with a colleague’s number', () => {
    // THE DEFECT THIS PINS. `getExtractionLabel('panel_elicited')` returned
    // "Estimated by Olumi" — the machine claiming authorship of a named
    // person's estimate — on three unflagged, deployed-mounted inspector
    // panels. The cause was subtle and worth stating: the map was TOTAL over
    // the kind union, so `panel: null` satisfied the compiler; totality bought
    // a type error, not an answer, and the caller fell to its default arm.
    const label = getExtractionLabel('panel_elicited')
    expect(label).not.toBe('Estimated by Olumi')
    expect(label).toBe('From your panel')

    // CONTROL: the default arm still works for a source that genuinely IS
    // Olumi's, so the assertion above is a discrimination and not a function
    // that stopped returning its default for everything.
    expect(getExtractionLabel('cee_inference')).toBe('Estimated by Olumi')
  })

  it('⭐ the inspector never leaks the raw wire literal into user copy', () => {
    // `getProvenanceLabel('panel_elicited')` fell to the same default arm and
    // rendered "Source: panel_elicited" — a wire token shown to a person.
    const label = getProvenanceLabel('panel_elicited')
    expect(label).not.toContain('panel_elicited')
    expect(label).not.toContain('Source:')
    expect(label).toBe('From your panel')
  })

  it('⭐ an applied colleague value is never pilled "Set by you"', () => {
    // CEE stamps `node.provenance = 'user_set'` unconditionally, including for
    // a panel apply, so the node rung alone credits the READER with somebody
    // else's number. `observed_state.source` takes precedence.
    const pill = provenanceToPill('user_set', 'panel_elicited')
    expect(pill?.label).not.toBe('Set by you')
    expect(pill?.label).toBe('From your panel')

    // CONTROL / no-regression: with no source, or an ordinary user source, the
    // node rung is unchanged — every pre-0.40.0 caller behaves as before.
    expect(provenanceToPill('user_set')?.label).toBe('Set by you')
    expect(provenanceToPill('user_set', 'user_override')?.label).toBe('Edited by you')
    expect(provenanceToPill('ai_inferred')?.label).toBe('AI estimate')
  })

  it('an UNKNOWN literal still classifies as null — honest-neutral, never guessed', () => {
    // The contract's instruction for unknown literals, unchanged by the new
    // member: classify unknown/absent as neutral, never guess a class.
    expect(classifyValueProvenance('some_future_source')).toBeNull()
    expect(classifyValueProvenance(undefined)).toBeNull()
  })
})
