/**
 * ⛔⛔ THE INTERLOCK THAT ACTUALLY FIRES — and it exists because the one the
 * design relied on DOES NOT.
 *
 * ROADMAP 2.1416 argued this work was safe to leave unowned because
 * *"UI #1540's precondition 2 REDs the moment this ships"*. **It does not.**
 * Precondition 2 is `expect(edgeStrengthEditIsAssertable(drawnEdge)).toBe(false)`
 * — it guards a FLIP OF THE EDIT FENCE. This change deliberately never touches
 * that fence (Codex: *"do not flip the existing edit fence"*); it adds a SEPARATE
 * ADD control. So `edgeStrengthEditIsAssertable` stays `false`, precondition 2
 * stays GREEN, and #1540's whole spec passes unchanged — MEASURED, 41/41 across
 * six files on this branch.
 *
 * ⭐ A guard aimed at the door the change does not use. Same shape as the
 * two-step guard bound to a question mark the product never sends.
 *
 * SO THIS IS THAT GUARD. It binds the drawn-link COPY to the drawn-link
 * CAPABILITY: the moment a person can state a strength themselves, no live
 * string for that population may tell them to delegate it or that it cannot be
 * done. If the ADD control is ever withdrawn, this RED s and the copy is forced
 * back to the table rather than going quietly stale.
 */
import { describe, it, expect } from 'vitest'

import {
  INSPECTOR_EDGE_AWAITING_STATED_STRENGTH_REASON,
  INSPECTOR_EDGE_NO_STRENGTH_BASIS_REASON,
} from '../useInspectorMutations'
import { STRUCTURAL_ADD_EDGE_NEEDS_STRENGTH_NOTICE } from '../../../mutations/structuralAddEdge'
import { INLINE_LABELS } from '../inspectorStrings'

/** "Go and ask the assistant to do it for you." */
const DELEGATES = /ask olumi to (set|add)/i
/** "You cannot do this." */
const DENIES_THE_USER = /you can'?t set|cannot be set|not editable|no way to set/i

describe('a population that CAN act is never told to delegate', () => {
  it('PRECONDITION — the drawn-link control asks the user for the strength itself', () => {
    // If this label stops asking, the capability is gone and every assertion
    // below is vacuous. Pin the precondition in-test, never assume it.
    expect(INLINE_LABELS.strengthQuestionForSave).toMatch(/how strong/i)
  })

  it('the drawn-link reason does NOT delegate to Olumi', () => {
    expect(INSPECTOR_EDGE_AWAITING_STATED_STRENGTH_REASON).not.toMatch(DELEGATES)
  })

  it('and it does not tell the user they cannot set it', () => {
    expect(INSPECTOR_EDGE_AWAITING_STATED_STRENGTH_REASON).not.toMatch(DENIES_THE_USER)
  })

  it('it points at THIS surface, so the reader knows where to act', () => {
    expect(INSPECTOR_EDGE_AWAITING_STATED_STRENGTH_REASON).toMatch(/set its strength here/i)
  })

  it('⭐ and it is a DIFFERENT sentence from the server-held one, which correctly still delegates', () => {
    // The server-held population has no local control and must still be told to
    // ask — two populations, two sentences (trap 21). If these ever converge,
    // one of them has become wrong for its population.
    expect(INSPECTOR_EDGE_NO_STRENGTH_BASIS_REASON).toMatch(DELEGATES)
    expect(INSPECTOR_EDGE_AWAITING_STATED_STRENGTH_REASON).not.toBe(
      INSPECTOR_EDGE_NO_STRENGTH_BASIS_REASON,
    )
  })

  it('⚠ the drawn-link TOAST is left unchanged and must stay compatible — it may name the delegate route, but never deny the direct one', () => {
    // #1540's sentence is NOT false once this ships: everything it says stays
    // true, and re-drafting a string three sessions settled today would be a
    // fourth draft inside a mechanism change. It is deliberately untouched.
    // What this pins is the boundary: it must never start claiming the user
    // cannot do it themselves.
    expect(STRUCTURAL_ADD_EDGE_NEEDS_STRENGTH_NOTICE).not.toMatch(DENIES_THE_USER)
  })
})
