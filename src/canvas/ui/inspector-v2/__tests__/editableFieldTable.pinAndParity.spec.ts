/**
 * THE CLASSED FIELD-PARITY TABLE — the UI's half of amendment A6. ROADMAP 2.474.
 *
 * ── WHY THIS FILE EXISTS, AND WHAT IT IS FIXING ───────────────────────────────
 *
 * `@talchain/schemas` carries a CLASSED editable-field table (42 rows) naming
 * every graph field the conversational AI may edit and in which class. CEE
 * already derives its referee allowlist from it (`field-safety.ts` →
 * `aiEditableFieldRoots`) and calls `requireEditableFieldTableRevision` at module
 * load so a repo on an older pin fails LOUD instead of silently enforcing a
 * SHORTER allowlist.
 *
 * The UI had NEITHER half. Measured at UI staging `0ac79113` (5 Aug 2026):
 * the repo pinned `@talchain/schemas` 0.34.0, and
 *
 *     tar -tzf vendor/talchain-schemas-0.34.0.tgz | grep -E 'editable|edit-tool'
 *
 * returned NOTHING — that tarball carries neither `editable-fields` nor
 * `edit-tool-ops`. So the table was not merely un-asserted here, it was
 * UNIMPORTABLE; and `requireEditableFieldTableRevision`, the fail-loud guard
 * written for exactly this hazard, was itself absent from the pin. The guard
 * could not guard the repo that could not import it — a guarantee that reads as
 * present and cannot execute. The pin bump to 0.35.0 and this spec are the two
 * halves of the fix: without the spec the pin can silently regress, and without
 * the pin the spec cannot be written at all.
 *
 * ── WHAT EACH ASSERTION IS FOR (and why none of them is vacuous) ──────────────
 *
 *  1. PIN-SKEW GUARD. `requireEditableFieldTableRevision(REQUIRED)` must not
 *     throw. This is the hazard-1 tripwire: a future re-vendor to a pin carrying
 *     an OLDER table REDs here instead of quietly narrowing what the UI believes
 *     the AI may edit.
 *  2. POSITIVE CONTROL for (1) — trap 13. An absence assertion ("it did not
 *     throw") proves nothing unless the harness can SEE a throw, so we require
 *     one revision ABOVE the pin and assert it DOES throw. Without this, (1)
 *     would keep passing if the guard were ever gutted into a no-op.
 *  3. UNION ASSERTION — the half derivation structurally cannot provide
 *     (trap 12d). Deriving a guard from a list proves the copies AGREE; it is
 *     blind to the LIST BEING SHORT. So: every setter `useInspectorMutations`
 *     exposes must appear in the table. A NEW setter added with no row fails
 *     RED here — that is the drift no derived check can see.
 *  4. PRECONDITION PINS. Every assertion above is quantified over a collection.
 *     An emptied collection makes them all pass while testing nothing, so the
 *     collections are asserted non-empty first. A guard whose evidence comes
 *     from itself is the defect class this suite exists to catch.
 *
 * ── SCOPE, STATED HONESTLY ────────────────────────────────────────────────────
 * This spec covers the INSPECTOR setters. The right-hand PANEL's own write sites
 * are a separate corpus and are NOT asserted here yet: the panel's contested-edge
 * resolution writes edge `validation` (`ModelTabBody.tsx:638,:662,:670`), which
 * has no table row at revision 1. That row is the schemas leg of this train; the
 * panel write-site corpus lands with the re-vendor that carries it. Naming the
 * gap here rather than asserting around it — an assertion encoding "validation
 * has no row" would have to be deleted the day the row lands, and a guard you
 * must remember to delete is a mirror.
 */
import { describe, it, expect } from 'vitest'
import {
  EDITABLE_FIELD_TABLE,
  EDITABLE_FIELD_TABLE_REVISION,
  requireEditableFieldTableRevision,
  editableFieldUiSetters,
} from '@talchain/schemas/orchestrator'
import { NODE_SETTER_FIELDS, EDGE_SETTER_FIELDS } from '../useInspectorMutations'

/**
 * The table revision this repo is written against. Bump it in the SAME change
 * as the re-vendor that carries a newer table — never ahead of the pin, which
 * is what makes assertion (1) a real tripwire rather than a wish.
 */
const REQUIRED_EDITABLE_FIELD_TABLE_REVISION = 1

describe('editable-field table — pin-skew guard + inspector parity (A6, UI half)', () => {
  it('PRECONDITION: the collections under test are non-empty', () => {
    // Without this, every quantified assertion below passes on an empty set.
    expect(EDITABLE_FIELD_TABLE.length).toBeGreaterThan(0)
    expect(Object.keys(NODE_SETTER_FIELDS).length).toBeGreaterThan(0)
    expect(Object.keys(EDGE_SETTER_FIELDS).length).toBeGreaterThan(0)
    expect(editableFieldUiSetters().size).toBeGreaterThan(0)
  })

  it('the pinned @talchain/schemas carries at least the required table revision', () => {
    expect(() =>
      requireEditableFieldTableRevision(REQUIRED_EDITABLE_FIELD_TABLE_REVISION),
    ).not.toThrow()
    expect(EDITABLE_FIELD_TABLE_REVISION).toBeGreaterThanOrEqual(
      REQUIRED_EDITABLE_FIELD_TABLE_REVISION,
    )
  })

  it('POSITIVE CONTROL: the pin-skew guard can actually FIRE (trap 13)', () => {
    // If this ever stops throwing, the guard has been gutted and the assertion
    // above is passing by testing nothing.
    expect(() =>
      requireEditableFieldTableRevision(EDITABLE_FIELD_TABLE_REVISION + 1),
    ).toThrow(/older than the required revision/)
  })

  it('every inspector setter is accounted for by a table row (union assertion)', () => {
    const accounted = editableFieldUiSetters()
    const declared = [
      ...Object.keys(NODE_SETTER_FIELDS),
      ...Object.keys(EDGE_SETTER_FIELDS),
    ]
    const unaccounted = [...new Set(declared)].filter((s) => !accounted.has(s)).sort()

    // Named, not just counted: a bare length check would not tell the next lane
    // WHICH setter it added without a row.
    expect(unaccounted).toEqual([])
  })
})
