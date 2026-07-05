/**
 * Wire-shape assertions for the V1 run request (run-path convergence brief).
 *
 * The live audit (2026-07-05) captured a run request whose edges carried ONLY
 * unsigned weights: canvas `beliefExists` never reached the wire because the
 * mapper read `e.data.belief`, and the goal threshold never reached the wire
 * because the extractor read value/baseline_value/target while the goal
 * editor persists `goal_threshold`. These tests pin the fixed behaviour.
 */
import { describe, it, expect } from 'vitest'
import { graphToV1Request } from '../mapper'
import { extractGoalThreshold } from '../../httpV1Adapter'

const graphWith = (edgeData: Record<string, unknown>) => ({
  nodes: [
    { id: 'a', data: { label: 'A', kind: 'factor' } },
    { id: 'b', data: { label: 'B', kind: 'outcome' } },
  ],
  edges: [{ id: 'e-1', source: 'a', target: 'b', data: edgeData }],
})

describe('graphToV1Request — edge belief wire shape', () => {
  it('maps canvas beliefExists onto the wire belief field', () => {
    const req = graphToV1Request(graphWith({ weight: 0.3, beliefExists: 0.85 }) as any, 1337)
    expect(req.graph.edges[0].belief).toBe(0.85)
  })

  it('prefers an explicit belief field over beliefExists', () => {
    const req = graphToV1Request(
      graphWith({ weight: 0.3, belief: 0.6, beliefExists: 0.85 }) as any,
      1337,
    )
    expect(req.graph.edges[0].belief).toBe(0.6)
  })

  it('clamps beliefExists to [0, 1] (UI-SEM-034)', () => {
    const req = graphToV1Request(graphWith({ weight: 0.3, beliefExists: 1.4 }) as any, 1337)
    expect(req.graph.edges[0].belief).toBe(1)
  })

  it('omits belief when neither field is present', () => {
    const req = graphToV1Request(graphWith({ weight: 0.3 }) as any, 1337)
    expect(req.graph.edges[0].belief).toBeUndefined()
  })

  it('still carries the unsigned weight', () => {
    const req = graphToV1Request(graphWith({ weight: 0.3, beliefExists: 0.85 }) as any, 1337)
    expect(req.graph.edges[0].weight).toBe(0.3)
  })
})

describe('extractGoalThreshold — goal target wire shape', () => {
  it('reads the GoalPanel field data.goal_threshold', () => {
    expect(extractGoalThreshold({ id: 'g', data: { kind: 'goal', goal_threshold: 100 } })).toBe(100)
  })

  it('parses a numeric-string goal_threshold_raw', () => {
    expect(extractGoalThreshold({ id: 'g', data: { kind: 'goal', goal_threshold_raw: '100' } })).toBe(100)
  })

  it('falls back to the legacy value/baseline_value/target chain', () => {
    expect(extractGoalThreshold({ id: 'g', data: { kind: 'goal', target: 42 } })).toBe(42)
  })

  it('returns undefined when nothing usable is set', () => {
    expect(extractGoalThreshold({ id: 'g', data: { kind: 'goal' } })).toBeUndefined()
  })

  it('does not treat an empty raw string as zero', () => {
    expect(extractGoalThreshold({ id: 'g', data: { kind: 'goal', goal_threshold_raw: '' } })).toBeUndefined()
  })

  it('ignores non-numeric raw strings', () => {
    expect(extractGoalThreshold({ id: 'g', data: { kind: 'goal', goal_threshold_raw: 'soon' } })).toBeUndefined()
  })
})
