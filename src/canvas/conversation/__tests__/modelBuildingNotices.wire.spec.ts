/**
 * The WIRE half of `model_building_notices` — the extractor and the copy
 * authority, pinned against the PUBLISHED schema rather than against a fixture
 * written from this consumer's head (CLAUDE.md trap 22: a corpus drawn from the
 * author's head cannot see the class the author did not imagine).
 *
 * The load-bearing guards here:
 *
 *  · ABSENCE YIELDS NULL. The producer omits the key on a clean draft; a
 *    synthesised zero would put a false omission in front of every user.
 *  · THE PRODUCER'S CROSS-FIELD RULES ARE ENFORCED, NOT RESTATED. Parsing goes
 *    through `ModelBuildingNoticesSchema` itself, so the unique-kinds and
 *    sum-equals-total rules cannot drift from the producer.
 *  · COPY COMPLETENESS IS DERIVED FROM THE ENUM, NOT HAND-LISTED (trap 12 and
 *    12d). The exhaustiveness test iterates `ModelBuildingNoticeKindSchema
 *    .options`, so a seventh member arriving REDs here as well as at typecheck.
 *    Derivation proves agreement; the schema's own enum is the external
 *    reference that makes it also prove completeness.
 */
import { describe, it, expect } from 'vitest'
import { ModelBuildingNoticeKindSchema } from '@talchain/schemas/boundary'
import {
  describeModelBuildingNoticeKind,
  extractModelBuildingNoticesSidecar,
  modelBuildingNoticesSummary,
  toModelBuildingNoticesView,
  MODEL_BUILDING_NOTICES_POINTER,
} from '../modelBuildingNotices'

/** A payload that satisfies BOTH superRefine rules: kinds unique, 2 + 1 === 3. */
const VALID = {
  total_count: 3,
  groups: [
    { kind: 'detail_not_connected', count: 2 },
    { kind: 'relationship_not_used', count: 1 },
  ],
  details_redacted: true,
} as const

describe('extractModelBuildingNoticesSidecar — ⭐ absence never becomes a zero', () => {
  it('returns null when the key is absent (the clean-draft case)', () => {
    expect(extractModelBuildingNoticesSidecar({ assistant_text: 'hi' })).toBeNull()
  })

  it('returns null for null/undefined values and non-object responses', () => {
    expect(extractModelBuildingNoticesSidecar({ model_building_notices: undefined })).toBeNull()
    expect(extractModelBuildingNoticesSidecar({ model_building_notices: null })).toBeNull()
    expect(extractModelBuildingNoticesSidecar(null)).toBeNull()
    expect(extractModelBuildingNoticesSidecar('a string')).toBeNull()
  })

  it('CONTROL: the extractor is not blind — the same shape DOES parse', () => {
    // An absence suite whose probe can never return a value proves nothing
    // (trap 13). This is the positive control for every null above.
    const view = extractModelBuildingNoticesSidecar({ model_building_notices: VALID })
    expect(view).not.toBeNull()
    expect(view?.totalCount).toBe(3)
    expect(view?.rows).toHaveLength(2)
  })
})

describe('extractModelBuildingNoticesSidecar — ⭐ the producer rules are enforced', () => {
  it('rejects a payload whose total_count does not equal the group sum', () => {
    // The superRefine rule. A consumer that accepted this would render a
    // headline quantity the breakdown contradicts.
    expect(
      extractModelBuildingNoticesSidecar({
        model_building_notices: { ...VALID, total_count: 2 },
      }),
    ).toBeNull()
  })

  it('rejects duplicate kinds', () => {
    expect(
      extractModelBuildingNoticesSidecar({
        model_building_notices: {
          total_count: 3,
          groups: [
            { kind: 'other', count: 2 },
            { kind: 'other', count: 1 },
          ],
          details_redacted: true,
        },
      }),
    ).toBeNull()
  })

  it('rejects an unknown kind, an empty group list, and a missing details_redacted', () => {
    expect(
      extractModelBuildingNoticesSidecar({
        model_building_notices: {
          total_count: 1,
          groups: [{ kind: 'not_a_real_kind', count: 1 }],
          details_redacted: true,
        },
      }),
    ).toBeNull()
    expect(
      extractModelBuildingNoticesSidecar({
        model_building_notices: { total_count: 0, groups: [], details_redacted: true },
      }),
    ).toBeNull()
    expect(
      extractModelBuildingNoticesSidecar({
        model_building_notices: { total_count: 3, groups: VALID.groups },
      }),
    ).toBeNull()
  })
})

describe('describeModelBuildingNoticeKind — ⭐ derived completeness + no leaked codes', () => {
  it('every kind the SCHEMA declares has a human phrasing', () => {
    // Derived from the published enum, never a hand-kept list. A seventh member
    // fails here as well as at typecheck.
    const kinds = ModelBuildingNoticeKindSchema.options
    expect(kinds.length).toBeGreaterThan(0)
    for (const kind of kinds) {
      const described = describeModelBuildingNoticeKind(kind)
      expect(described, `no phrasing for kind: ${kind}`).toBeTruthy()
      // The phrasing must not BE the code, nor contain it.
      expect(described).not.toContain(kind)
      expect(described).not.toMatch(/_/)
    }
  })

  it('an unknown kind gets null, never a fallback to its code', () => {
    expect(describeModelBuildingNoticeKind('some_future_kind')).toBeNull()
    expect(describeModelBuildingNoticeKind('')).toBeNull()
  })

  it('lookup is EXACT, never case-folded', () => {
    // Folding case would let an unrecognised variant inherit a phrasing it was
    // never entitled to — the same rule as the refusal-notice map.
    expect(describeModelBuildingNoticeKind('DETAIL_NOT_CONNECTED')).toBeNull()
  })

  it('does not inherit phrasings from Object.prototype', () => {
    expect(describeModelBuildingNoticeKind('toString')).toBeNull()
    expect(describeModelBuildingNoticeKind('constructor')).toBeNull()
  })
})

describe('modelBuildingNotices copy — ⭐ user-facing strings stay human', () => {
  it('the summary agrees in number and never prints a code', () => {
    expect(modelBuildingNoticesSummary(1)).toContain('1 thing from your brief')
    expect(modelBuildingNoticesSummary(1)).not.toContain('1 things')
    expect(modelBuildingNoticesSummary(4)).toContain('4 things')
  })

  it('the pointer names a conversational action, not a control this notice renders', () => {
    // #684 review D2: naming a button the notice does not render is a promise
    // the surface cannot keep.
    expect(MODEL_BUILDING_NOTICES_POINTER).toMatch(/tell olumi/i)
    expect(MODEL_BUILDING_NOTICES_POINTER).not.toMatch(/click|button|below|press/i)
  })

  it('preserves the producer total and the producer row order on a fully nameable payload', () => {
    const view = extractModelBuildingNoticesSidecar({ model_building_notices: VALID })
    expect(view?.totalCount).toBe(3)
    expect(view?.rows.map((r) => r.kind)).toEqual([
      'detail_not_connected',
      'relationship_not_used',
    ])
  })
})

/**
 * ⭐ THE UNNAMEABLE-KIND BRANCH, AND WHY IT NEEDS ITS OWN ENTRY POINT.
 *
 * A mutant that made `toModelBuildingNoticesView` render unnameable kinds as
 * the string "unknown" SURVIVED the first version of this suite. The survivor
 * was not equivalent — it exposed a real hole, and the hole was in a test whose
 * NAME claimed the drop while its FIXTURE contained only nameable kinds, so it
 * could never observe one (CLAUDE.md trap 19: an assertion that passes on the
 * wrong object).
 *
 * The branch is unreachable through `extractModelBuildingNoticesSidecar` BY
 * CONSTRUCTION — the schema's kind enum is closed, so an unknown kind fails
 * `safeParse` and never reaches the shaper. It is defensive against a future
 * schema bump that widens the enum before this UI adds a phrasing for the new
 * member. That is a real, reachable future state, so the branch stays and is
 * exercised HERE, at the shaper, which is the only entry point that can reach
 * it. The cast is deliberate and is the point of the test.
 */
describe('toModelBuildingNoticesView — ⭐ the unnameable-kind drop', () => {
  it('drops an unnameable kind from rows while preserving the PRODUCER total', () => {
    const view = toModelBuildingNoticesView({
      total_count: 5,
      groups: [
        { kind: 'detail_not_connected', count: 2 },
        // A member this UI has no phrasing for — the future-enum case.
        { kind: 'a_kind_added_after_this_ui' as never, count: 3 },
      ],
      details_redacted: true,
    })
    // The row is gone...
    expect(view.rows.map((r) => r.kind)).toEqual(['detail_not_connected'])
    // ...and NOTHING renders its code under any substitute label.
    expect(view.rows.every((r) => !r.description.includes('_'))).toBe(true)
    expect(view.rows.map((r) => r.description)).not.toContain('unknown')
    // ...while the headline stays the producer's number, not a re-derived one.
    // Shrinking this to 2 would misreport the producer; that is the divergence
    // the renderer is written to keep honest.
    expect(view.totalCount).toBe(5)
  })

  it('yields zero rows when NO kind is nameable, leaving the renderer nothing to claim', () => {
    const view = toModelBuildingNoticesView({
      total_count: 4,
      groups: [{ kind: 'another_future_kind' as never, count: 4 }],
      details_redacted: true,
    })
    expect(view.rows).toHaveLength(0)
    expect(view.totalCount).toBe(4)
  })
})
