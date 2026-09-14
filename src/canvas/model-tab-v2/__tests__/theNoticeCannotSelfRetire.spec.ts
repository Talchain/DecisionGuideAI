/**
 * ⭐⭐ A GUARD THAT PROMISED TO RETIRE ITSELF, WHOSE TRIGGER HAS ALREADY FIRED,
 * AND WHICH DID NOT RETIRE.
 *
 * `sectionWriterNotice.ts` documents its own retirement condition:
 *
 *   "⭐ SELF-RETIRING BY CONSTRUCTION … When `modelOptionIntervention` becomes
 *    `server_graph`, options enter that set and this returns empty — the notice
 *    disappears with no one remembering to delete it."
 *
 * DERIVED AT `3b2df4ce`, with a contrast control so neither zero is a blind
 * sweep:
 *
 *   modelOptionIntervention          → 'server_graph'   (the trigger HAS fired)
 *   sectionWriterNotice.ts:12 claims → 'disabled'       (stale by one flip)
 *   options added to editConnectedIds → 0 occurrences
 *   contrast: factors added          → 1 occurrence     (the sweep sees an add)
 *
 * `editConnectedIds` (`ModelTabV2Panel.tsx:444-452`) adds FACTORS, the GOAL
 * (conditionally) and ASSERTABLE EDGES. It has no option branch at all — so
 * options cannot enter that set whatever the authority key says, and the
 * promised mechanism does not exist. The trigger fired and nothing happened.
 *
 * ⚠⚠ AND THE NOTICE'S USER-FACING SENTENCE IS STILL TRUE, WHICH IS WHY THIS IS
 * A GUARD RATHER THAN A COPY FIX — the distinction matters and the honest
 * version is narrower than "the notice is wrong". A `missing-intervention` row
 * has NO intervention, and the detail region's editor changes the MAGNITUDE of
 * an EXISTING one (it renders behind `interventions.length > 0`). So there is
 * still no control on this surface that can add one, and the sentence "that
 * cannot be set from this section" holds.
 *
 * What is false is the ARCHITECTURAL claim about how the notice ends. It will
 * not end when the authority flips — it flipped. It ends when something can ADD
 * an intervention from this section, which nothing can.
 *
 * ⭐ WHY THIS IS WORTH A GUARD AND NOT JUST A CORRECTED COMMENT: the next lane
 * to flip the remaining bit will EXPECT the notice to vanish, on this file's own
 * written promise, and it will not. That is trap 13b — a guard whose
 * discrimination rests on an unstated precondition — applied to a retirement
 * condition rather than to an assertion.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { CANONICAL_EDIT_AUTHORITY } from '../../mutations/mutationAuthority'
import { rowsThisSectionCannotResolve } from '../sectionWriterNotice'
import type { ModelRow } from '../types'

const HERE = dirname(fileURLToPath(import.meta.url))
const NOTICE_SRC = readFileSync(join(HERE, '..', 'sectionWriterNotice.ts'), 'utf8')

/**
 * The source with every ~~struck~~ span removed.
 *
 * ⚠⚠ THIS DISTINCTION IS THE WHOLE INSTRUMENT, AND THE FIRST DRAFT LACKED IT —
 * it matched the bare substring and therefore flagged the file's own WITHDRAWN
 * quotation of the stale claim as if it were still being asserted. This estate
 * requires a corrected claim to be struck and kept, not deleted (a superseded
 * sentence quietly removed is how the next reader loses the correction), so a
 * guard that cannot tell a quotation from a declaration would forbid the honest
 * form of the fix and reward the dishonest one.
 */
const NOTICE_DECLARED = NOTICE_SRC.replace(/~~[\s\S]*?~~/g, '')
const PANEL_SRC = readFileSync(join(HERE, '..', 'ModelTabV2Panel.tsx'), 'utf8')

const optionRow = (id: string): ModelRow => ({
  id,
  kind: 'option',
  group: 'options',
  label: 'Buy the platform',
  primaryValue: null,
  attention: ['missing-intervention'],
  editable: false,
})

describe('the notice cannot self-retire the way it says it will', () => {
  it('POSITIVE CONTROL: both sources really loaded', () => {
    // Every assertion below is a claim about file contents. An empty read would
    // make a `not.toContain` pass vacuously — two empty strings agree perfectly.
    expect(NOTICE_SRC.length).toBeGreaterThan(500)
    expect(PANEL_SRC.length).toBeGreaterThan(500)
    // Bound to the module's EXPORTED SYMBOLS, not to a prose phrase. The first
    // draft asserted the phrase "SELF-RETIRING BY CONSTRUCTION" — which the fix
    // legitimately removes, so the control REDed on a correct change. A control
    // that forbids the repair is worse than no control.
    expect(NOTICE_SRC).toContain('rowsThisSectionCannotResolve')
    expect(PANEL_SRC).toContain('editConnectedIds')
    // And the stripper must not have eaten the file: a `~~`-removal bug would
    // empty NOTICE_DECLARED and make the declaration check below vacuous.
    expect(NOTICE_DECLARED.length).toBeGreaterThan(500)
  })

  it('⭐ the notice may not state an authority value the table contradicts', () => {
    // DERIVED: the expected string is read from the table at run time, so this
    // cannot go stale the way the prose it polices did.
    // ⚠ WIDENED TO `string` DELIBERATELY. `CANONICAL_EDIT_AUTHORITY` is `as
    // const`, so TypeScript narrows this to the literal `'server_graph'` and
    // rejects the filter below as a comparison with no overlap (TS2367). That
    // narrowing is exactly what makes the guard useful — but the guard must keep
    // READING the value rather than restating it, so that flipping the key
    // changes what this forbids instead of turning it into a compile error
    // somebody deletes.
    const actual: string = CANONICAL_EDIT_AUTHORITY.modelOptionIntervention
    const contradicted = ['disabled', 'local_presentation'].filter(v => v !== actual)

    for (const wrong of contradicted) {
      expect(
        NOTICE_DECLARED.includes(`modelOptionIntervention: '${wrong}'`),
        `sectionWriterNotice.ts states modelOptionIntervention is '${wrong}', but the ` +
          `authority table says '${actual}'. Correct the prose, or the next reader ` +
          `inherits a derivation chain that no longer holds. (Striking the old ` +
          `line with ~~…~~ satisfies this — a withdrawn claim is not a claim.)`,
      ).toBe(false)
    }
  })

  it('⚠ the stated trigger HAS fired', () => {
    // The notice's retirement condition, quoted: "When `modelOptionIntervention`
    // becomes `server_graph`". It has.
    expect(CANONICAL_EDIT_AUTHORITY.modelOptionIntervention).toBe('server_graph')
  })

  it('⚠ and options still cannot enter `editConnectedIds`, so nothing retired', () => {
    // The mechanism the promise depends on does not exist in the panel.
    expect(PANEL_SRC).not.toContain("nodeKind(node) === 'option'")
    // CONTRAST CONTROL: the same sweep DOES see the factor branch, so the
    // absence above is a property of the code and not of the matcher.
    expect(PANEL_SRC).toContain("nodeKind(node) === 'factor'")
  })

  it('⭐ so the notice still fires for a blocked option — pinned as the real behaviour', () => {
    // Built the way the panel builds it: factors and edges only, never options.
    const editConnectedIds: ReadonlySet<string> = new Set(['fac_a', 'e_1'])
    const blocked = rowsThisSectionCannotResolve([optionRow('opt_a')], editConnectedIds)

    expect(blocked).toEqual(['opt_a'])
  })

  it('CONTRAST CONTROL: it DOES retire for a row the section can resolve', () => {
    // Proves the case above is discriminating — the function is capable of
    // returning empty, so the non-empty result is about options specifically.
    const editConnectedIds: ReadonlySet<string> = new Set(['opt_a'])
    expect(rowsThisSectionCannotResolve([optionRow('opt_a')], editConnectedIds)).toEqual([])
  })
})
