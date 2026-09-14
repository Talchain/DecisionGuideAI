/**
 * `buildOptionInterventionEditEvent` — the wire event for one option's effect
 * value on one factor (schemas 0.54.0).
 *
 * ⚠ CORRECTED 2026-09-09 — THE HEADER BELOW WAS TRUE WHEN WRITTEN AND IS NOW
 * FALSE. It is replaced rather than quietly deleted, because a reader who
 * inherited it would conclude this builder is still dark and that arming it is
 * an unreviewed step:
 *
 *   ~~THIS MODULE HAS NO PRODUCTION CALLER YET, ON PURPOSE. `ModelTabBody`
 *   mounts both surfaces with no flag, and the v1 `OptionsSection` renders a
 *   LIVE intervention editor calling `proposeOptionIntervention` directly.~~
 *
 * Both halves went stale on different days. `LEGACY_DETAILED_EDITOR_MOUNTED` is
 * `false`, so the v1 editor is NOT live; and since #1338 this module HAS a
 * production caller — `useModelEditAuthority.proposeOptionIntervention` builds
 * and dispatches it. What is still dark is the AFFORDANCE
 * (`CANONICAL_EDIT_AUTHORITY.modelOptionIntervention` is `'disabled'`), which is
 * a different claim: the carrier is armed, no control offers it yet.
 *
 * Every refusal below is a case that must NEVER reach the wire.
 */
import { describe, it, expect } from 'vitest'

import {
  buildOptionInterventionEditEvent,
  type OptionInterventionEditBuild,
} from '../optionInterventionEdit'

const OPTION = 'option_open_leeds'
const FACTOR = 'factor_capex'
const HASH = '9f2c1b0ae4d37c5a'

function args(over: Partial<Parameters<typeof buildOptionInterventionEditEvent>[0]> = {}) {
  return { optionId: OPTION, factorId: FACTOR, modelValue: 0.6, baseGraphHash: HASH, ...over }
}

/** The payload of a build that must have succeeded — fails loud if it did not. */
function payloadOf(build: OptionInterventionEditBuild): Record<string, unknown> {
  if (!build.ok) throw new Error(`expected a built event, got refusal: ${build.refusal}`)
  return build.event.payload as Record<string, unknown>
}

describe('what it emits', () => {
  it('builds the typed event with ids, the model-scale value and the base hash', () => {
    expect(buildOptionInterventionEditEvent(args())).toEqual({
      ok: true,
      event: {
        type: 'option_intervention_edit',
        payload: {
          option_id: OPTION,
          factor_id: FACTOR,
          value: 0.6,
          base_graph_hash: HASH,
        },
      },
    })
  })

  it('carries FOUR fields and no more — no unit, raw value, provenance or actor', () => {
    // Each of those is a claim the client cannot honestly make, and a field
    // nothing may populate is one a later reader populates anyway.
    expect(Object.keys(payloadOf(buildOptionInterventionEditEvent(args()))).sort()).toEqual(
      ['base_graph_hash', 'factor_id', 'option_id', 'value'].sort(),
    )
  })

  it('accepts both ends of the model scale — 0 and 1 are real values', () => {
    expect(payloadOf(buildOptionInterventionEditEvent(args({ modelValue: 0 }))).value).toBe(0)
    expect(payloadOf(buildOptionInterventionEditEvent(args({ modelValue: 1 }))).value).toBe(1)
  })
})

describe('what must never reach the wire', () => {
  it('⚠ refuses with NO base hash — the reload case, and it says so BY NAME', () => {
    // `lastServerGraphHash` is null after a restore (persistence is read with no
    // CEE turn). Sending an empty or invented hash would be refused by the
    // server as STALE, which reads to a user as "your edit conflicted" when the
    // client never held a base to assert. Refuse, and let the caller disclose.
    //
    // ⭐ `needs_fresh_base`, NOT a bare refusal: this is the ONE case a user can
    // clear, and a caller cannot offer a recovery it cannot tell apart.
    expect(buildOptionInterventionEditEvent(args({ baseGraphHash: null }))).toEqual({
      ok: false,
      refusal: 'needs_fresh_base',
    })
    expect(buildOptionInterventionEditEvent(args({ baseGraphHash: '' }))).toEqual({
      ok: false,
      refusal: 'needs_fresh_base',
    })
  })

  it.each([
    ['below the model scale', -0.01],
    ['above the model scale', 1.01],
    ['a user-unit magnitude', 120000],
    ['a percentage as typed', 60],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
  ] as Array<[string, number]>)('refuses %s — REFUSE, never clamp', (_name, modelValue) => {
    // A clamped 1.5 → 1 sends a number the user never stated and the server
    // persists it as theirs. Same ruling `edgeStrengthEdit` makes for magnitude.
    expect(buildOptionInterventionEditEvent(args({ modelValue }))).toEqual({
      ok: false,
      refusal: 'not_encodable',
    })
  })

  it.each([
    ['empty', ''],
    ['blank', '   '],
    ['leading whitespace', ' factor_capex'],
    ['trailing whitespace', 'factor_capex '],
    ['arrow composite', 'option→factor'],
    ['ascii-arrow composite', 'option->factor'],
  ] as Array<[string, string]>)('refuses an id that is %s, on BOTH halves', (_name, id) => {
    expect(buildOptionInterventionEditEvent(args({ optionId: id }))).toEqual({
      ok: false,
      refusal: 'not_encodable',
    })
    expect(buildOptionInterventionEditEvent(args({ factorId: id }))).toEqual({
      ok: false,
      refusal: 'not_encodable',
    })
  })

  it('refuses an option addressing itself — no such relationship can exist', () => {
    expect(buildOptionInterventionEditEvent(args({ factorId: OPTION }))).toEqual({
      ok: false,
      refusal: 'not_encodable',
    })
  })

  /**
   * ⭐⭐ THE ORDER OF THE GUARDS IS A CONTRACT, AND THIS IS WHERE IT IS PINNED.
   *
   * When BOTH questions fail, the answer must be the one the user cannot fix.
   * The opposite order shipped in an earlier draft of the caller: a number off
   * the model scale on a restored session was reported as `needs_fresh_base`, so
   * the row offered "run a turn to re-sync" — the user runs it, the base
   * refreshes, and the identical number is refused again with a different
   * sentence. A recovery offered for an edit that can never land is worse than
   * no recovery, because it costs a turn to learn nothing.
   */
  describe('when BOTH questions fail, the unfixable one is the answer', () => {
    it.each([
      ['a value off the model scale', 1.4],
      ['NaN', Number.NaN],
    ] as Array<[string, number]>)('%s with no base hash is not_encodable', (_n, modelValue) => {
      expect(buildOptionInterventionEditEvent(args({ modelValue, baseGraphHash: null }))).toEqual({
        ok: false,
        refusal: 'not_encodable',
      })
    })

    it('an unusable id with no base hash is not_encodable', () => {
      expect(
        buildOptionInterventionEditEvent(args({ factorId: '   ', baseGraphHash: null })),
      ).toEqual({ ok: false, refusal: 'not_encodable' })
    })

    it('DISCRIMINATING TWIN: a GOOD input with no base hash is needs_fresh_base', () => {
      // Without this the block above would pass against a builder that had
      // simply forgotten `needs_fresh_base` exists.
      expect(buildOptionInterventionEditEvent(args({ baseGraphHash: null }))).toEqual({
        ok: false,
        refusal: 'needs_fresh_base',
      })
    })
  })

  it('POSITIVE CONTROL: the refusals above are each about their own cause', () => {
    // Without this every assertion in this block would pass against a builder
    // that refused unconditionally.
    expect(buildOptionInterventionEditEvent(args()).ok).toBe(true)
  })
})
