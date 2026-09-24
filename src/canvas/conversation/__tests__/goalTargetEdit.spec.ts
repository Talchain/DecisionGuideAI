/**
 * `buildGoalTargetEditEvent` — the client-side builder for the typed goal
 * target write CEE has not shipped a reader for yet (see `goalTargetEdit.ts`'s
 * header). Mirrors `optionInterventionEdit.spec.ts`'s shape: every refusal
 * below is a case that must NEVER reach the wire, and each has its
 * opposite-direction twin so a guard too wide (drops a legitimate target) and
 * a guard too narrow (lets a malformed one through) are both caught.
 */
import { describe, it, expect } from 'vitest'

import { buildGoalTargetEditEvent, type GoalTargetEditBuild } from '../goalTargetEdit'

const GOAL = 'goal_reduce_churn'
const HASH = '9f2c1b0ae4d37c5a'

function args(over: Partial<Parameters<typeof buildGoalTargetEditEvent>[0]> = {}) {
  return {
    goalNodeId: GOAL,
    constraintType: 'at_least' as const,
    rawValue: 12,
    unit: 'months',
    baseGraphHash: HASH,
    ...over,
  }
}

/** The payload of a build that must have succeeded — fails loud if it did not. */
function payloadOf(build: GoalTargetEditBuild): Record<string, unknown> {
  if (!build.ok) throw new Error(`expected a built event, got refusal: ${build.refusal}`)
  return build.event.payload as Record<string, unknown>
}

describe('what it emits', () => {
  it('builds the typed event with the goal id, direction, magnitude, unit and base hash', () => {
    expect(buildGoalTargetEditEvent(args())).toEqual({
      ok: true,
      event: {
        type: 'goal_target_edit',
        payload: {
          goal_node_id: GOAL,
          constraint_type: 'at_least',
          raw_value: 12,
          unit: 'months',
          base_graph_hash: HASH,
        },
      },
    })
  })

  it('carries FIVE fields and no more — identity-bound, no extra keys', () => {
    // cap, goal_threshold, frame and provenance are the server's to derive —
    // a field the client cannot honestly populate is one a later reader
    // populates anyway.
    expect(Object.keys(payloadOf(buildGoalTargetEditEvent(args()))).sort()).toEqual(
      ['base_graph_hash', 'constraint_type', 'goal_node_id', 'raw_value', 'unit'].sort(),
    )
  })

  it('trims the unit before it reaches the wire', () => {
    expect(payloadOf(buildGoalTargetEditEvent(args({ unit: '  months  ' }))).unit).toBe('months')
  })

  it('both directions are first-class', () => {
    expect(payloadOf(buildGoalTargetEditEvent(args({ constraintType: 'at_least', rawValue: 1 }))))
      .toMatchObject({ constraint_type: 'at_least' })
    expect(payloadOf(buildGoalTargetEditEvent(args({ constraintType: 'at_most', rawValue: 1 }))))
      .toMatchObject({ constraint_type: 'at_most' })
  })
})

describe('the zero rule — Codex amendment 5821693599', () => {
  it('ACCEPTS raw_value 0 for at_most — a real, sayable ceiling', () => {
    const built = buildGoalTargetEditEvent(args({ constraintType: 'at_most', rawValue: 0 }))
    expect(built.ok).toBe(true)
    expect(payloadOf(built)).toMatchObject({ constraint_type: 'at_most', raw_value: 0 })
  })

  it('REFUSES raw_value 0 for at_least — "at least 0" asserts nothing', () => {
    expect(buildGoalTargetEditEvent(args({ constraintType: 'at_least', rawValue: 0 }))).toEqual({
      ok: false,
      refusal: 'not_encodable',
    })
  })

  it('DISCRIMINATING TWIN: at_least accepts a value just above zero', () => {
    // Without this the block above would pass against a builder that refused
    // every at_least value, not just zero.
    expect(buildGoalTargetEditEvent(args({ constraintType: 'at_least', rawValue: 0.01 })).ok).toBe(
      true,
    )
  })
})

describe('what must never reach the wire', () => {
  it('⚠ refuses with NO base hash — the reload case, and it says so BY NAME', () => {
    expect(buildGoalTargetEditEvent(args({ baseGraphHash: null }))).toEqual({
      ok: false,
      refusal: 'needs_fresh_base',
    })
    expect(buildGoalTargetEditEvent(args({ baseGraphHash: '' }))).toEqual({
      ok: false,
      refusal: 'needs_fresh_base',
    })
  })

  it.each([
    ['negative', -0.01],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['-Infinity', Number.NEGATIVE_INFINITY],
  ] as Array<[string, number]>)('refuses %s raw_value — REFUSE, never clamp or coerce', (_n, rawValue) => {
    expect(buildGoalTargetEditEvent(args({ rawValue }))).toEqual({
      ok: false,
      refusal: 'not_encodable',
    })
  })

  it('refuses an unrecognised constraint_type', () => {
    expect(
      buildGoalTargetEditEvent(args({ constraintType: 'exactly' as never })),
    ).toEqual({ ok: false, refusal: 'not_encodable' })
  })

  it.each([
    ['empty', ''],
    ['blank', '   '],
  ] as Array<[string, string]>)('refuses a %s unit', (_name, unit) => {
    expect(buildGoalTargetEditEvent(args({ unit }))).toEqual({ ok: false, refusal: 'not_encodable' })
  })

  it.each([
    ['empty', ''],
    ['blank', '   '],
    ['leading whitespace', ' goal_reduce_churn'],
    ['trailing whitespace', 'goal_reduce_churn '],
    ['arrow composite', 'goal→target'],
    ['ascii-arrow composite', 'goal->target'],
  ] as Array<[string, string]>)('refuses a goal id that is %s', (_name, id) => {
    expect(buildGoalTargetEditEvent(args({ goalNodeId: id }))).toEqual({
      ok: false,
      refusal: 'not_encodable',
    })
  })

  /**
   * ⭐⭐ THE ORDER OF THE GUARDS IS A CONTRACT, AND THIS IS WHERE IT IS PINNED —
   * same ruling `optionInterventionEdit.spec.ts` pins for its own builder.
   */
  describe('when BOTH questions fail, the unfixable one is the answer', () => {
    it('an unusable id with no base hash is not_encodable', () => {
      expect(
        buildGoalTargetEditEvent(args({ goalNodeId: '   ', baseGraphHash: null })),
      ).toEqual({ ok: false, refusal: 'not_encodable' })
    })

    it('a zero at_least value with no base hash is not_encodable', () => {
      expect(
        buildGoalTargetEditEvent(
          args({ constraintType: 'at_least', rawValue: 0, baseGraphHash: null }),
        ),
      ).toEqual({ ok: false, refusal: 'not_encodable' })
    })

    it('DISCRIMINATING TWIN: a GOOD input with no base hash is needs_fresh_base', () => {
      expect(buildGoalTargetEditEvent(args({ baseGraphHash: null }))).toEqual({
        ok: false,
        refusal: 'needs_fresh_base',
      })
    })
  })

  it('POSITIVE CONTROL: the refusals above are each about their own cause', () => {
    expect(buildGoalTargetEditEvent(args()).ok).toBe(true)
  })
})
