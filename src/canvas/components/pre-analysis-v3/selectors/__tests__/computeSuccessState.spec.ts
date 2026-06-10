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
