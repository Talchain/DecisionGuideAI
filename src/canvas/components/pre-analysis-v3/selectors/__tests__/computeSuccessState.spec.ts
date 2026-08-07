import { describe, it, expect } from 'vitest'
import type { Node } from '@xyflow/react'
import { computeSuccessState } from '../computeSuccessState'

function goalNode(data: Record<string, unknown>): Node {
  return {
    id: 'g1',
    type: 'goal',
    position: { x: 0, y: 0 },
    data: { kind: 'goal', label: 'Increase delivery output by 20%', ...data },
  } as Node
}

describe('computeSuccessState — value-scale guard on the success measure', () => {
  it('user-set measure wins and is attributed to the person', () => {
    const s = computeSuccessState(
      goalNode({ threshold_source: 'user', success_threshold: 25, goal_threshold_unit: '%' }),
      null,
      { kind: 'person', displayName: 'Paul' },
    )
    expect(s.isSet).toBe(true)
    expect(s.displayText).toBe('25%')
    expect(s.rawValue).toBe(25)
    expect(s.attribution).toEqual({ kind: 'person', displayName: 'Paul' })
  })

  it('CEE raw + unit displays on the display scale, attributed to Olumi (staging goal-node shape)', () => {
    const s = computeSuccessState(
      goalNode({
        goal_threshold: 0.8,
        goal_threshold_raw: 20,
        goal_threshold_unit: '%',
        goal_threshold_cap: 25,
      }),
      null,
      null,
    )
    expect(s.isSet).toBe(true)
    expect(s.displayText).toBe('20%')
    expect(s.attribution).toEqual({ kind: 'olumi' })
    expect(s.scaleAmbiguous).toBe(false)
  })

  it('normalised-only threshold degrades to unset and flags the ambiguity', () => {
    const s = computeSuccessState(goalNode({ goal_threshold: 0.8 }), null, null)
    expect(s.isSet).toBe(false)
    expect(s.displayText).toBeNull()
    expect(s.scaleAmbiguous).toBe(true)
  })

  it('analysis_ready raw + unit is used when the goal node lacks them', () => {
    const s = computeSuccessState(
      goalNode({}),
      { goal_threshold_raw: 150000, goal_threshold_unit: '£' },
      null,
    )
    expect(s.isSet).toBe(true)
    expect(s.displayText).toBe('£150,000')
  })

  it('no goal node means unset, not ambiguous', () => {
    const s = computeSuccessState(null, { goal_threshold: 0.8 }, null)
    expect(s.isSet).toBe(false)
    expect(s.scaleAmbiguous).toBe(false)
  })
})

describe('computeSuccessState — explicit-provenance targets are user-set, not Olumi estimates (lane 35 fix 2)', () => {
  // CEE stores goal constraints with provenance 'explicit' when the USER
  // stated the target in their own brief (CEE schemas/assist.ts:
  // explicit | inferred | proxy). Labelling that number "Olumi estimate"
  // misattributes the user's own target to Olumi.
  const CEE_DERIVED_GOAL = {
    goal_threshold: 0.8,
    goal_threshold_raw: 20,
    goal_threshold_unit: '%',
    goal_threshold_cap: 25,
  }

  it('an explicit-provenance constraint matching the displayed value attributes to the user', () => {
    const s = computeSuccessState(goalNode(CEE_DERIVED_GOAL), null, null, [
      { id: 'c1', label: 'Delivery output up 20%', operator: '>=', value: 20, provenance: 'explicit' },
    ])
    expect(s.isSet).toBe(true)
    expect(s.displayText).toBe('20%')
    expect(s.attribution).toEqual({ kind: 'person', displayName: 'You' })
  })

  it('a named current user is credited when available', () => {
    const s = computeSuccessState(goalNode(CEE_DERIVED_GOAL), null, { kind: 'person', displayName: 'Paul' }, [
      { id: 'c1', label: 'Delivery output up 20%', operator: '>=', value: 20, provenance: 'explicit' },
    ])
    expect(s.attribution).toEqual({ kind: 'person', displayName: 'Paul' })
  })

  it('inferred provenance keeps the Olumi attribution', () => {
    const s = computeSuccessState(goalNode(CEE_DERIVED_GOAL), null, null, [
      { id: 'c1', label: 'Delivery output up 20%', operator: '>=', value: 20, provenance: 'inferred' },
    ])
    expect(s.attribution).toEqual({ kind: 'olumi' })
  })

  it('no provenance field keeps the Olumi attribution (defaulted values stay Olumi)', () => {
    const s = computeSuccessState(goalNode(CEE_DERIVED_GOAL), null, null, [
      { id: 'c1', label: 'Delivery output up 20%', operator: '>=', value: 20 },
    ])
    expect(s.attribution).toEqual({ kind: 'olumi' })
  })

  it('an explicit constraint whose value differs from the displayed value never claims user-set (fail-closed)', () => {
    // The displayed 20 is NOT the user's stated 15 — claiming "your target"
    // would misattribute in the other direction.
    const s = computeSuccessState(goalNode(CEE_DERIVED_GOAL), null, null, [
      { id: 'c1', label: 'Churn under 15%', operator: '<=', value: 15, provenance: 'explicit' },
    ])
    expect(s.attribution).toEqual({ kind: 'olumi' })
  })

  it('malformed constraint entries are ignored without crashing', () => {
    const s = computeSuccessState(goalNode(CEE_DERIVED_GOAL), null, null, [
      null,
      42,
      'explicit',
      { provenance: 'explicit' },
    ] as unknown[])
    expect(s.attribution).toEqual({ kind: 'olumi' })
  })

  it('the user-typed branch still wins over constraints entirely', () => {
    const s = computeSuccessState(
      goalNode({ threshold_source: 'user', success_threshold: 25, goal_threshold_unit: '%' }),
      null,
      null,
      [{ id: 'c1', label: 'x', operator: '>=', value: 20, provenance: 'inferred' }],
    )
    expect(s.displayText).toBe('25%')
    expect(s.attribution).toEqual({ kind: 'person', displayName: 'You' })
  })
})
