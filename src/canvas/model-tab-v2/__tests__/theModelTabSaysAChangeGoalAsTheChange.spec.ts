/**
 * ⭐ R1 S4-core (MG 5879952291, CEE `mg/r1-s4-goal-frame` @ `1fbf0c6c`): the Model tab's goal row says a target stated
 * as a change from today as the change — the same words as the goal card (`formatGoalTarget`, CEE's `sayGoalChange`).
 * The node shape is CEE's `admitStatedGoalChange` output: `goal_threshold_frame`, `goal_threshold_raw` (r or c) and the
 * METRIC's `goal_threshold_unit`. Read as a level, the row printed "-0.15 GBP/month".
 */
import { describe, it, expect } from 'vitest'
import type { Node } from '@xyflow/react'
import { toModelRows } from '../adapters'

const GOAL_ID = 'goal_cloud_bill'

function goal(data: Record<string, unknown>): Node {
  return { id: GOAL_ID, type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Cut the monthly cloud bill', type: 'goal', ...data } }
}

function goalRow(node: Node) {
  const row = toModelRows({ nodes: [node], edges: [], goalThreshold: null }).find(r => r.id === GOAL_ID)
  expect(row, 'no goal row').toBeDefined()
  return row!
}

function targetText(node: Node): string | null {
  return goalRow(node).primaryValue
}

describe('the Model tab goal row — a change target', () => {
  it('RED: change_rel −0.15 on GBP/month → "down 15% from today"', () => {
    const text = targetText(goal({ goal_threshold_frame: 'change_rel', goal_threshold_raw: -0.15, goal_threshold_unit: 'GBP/month' }))
    expect(text).toBe('down 15% from today')
  })

  it('RED: change_abs 5000 GBP → "up £5,000 from today"', () => {
    expect(targetText(goal({ goal_threshold_frame: 'change_abs', goal_threshold_raw: 5000, goal_threshold_unit: 'GBP' }))).toBe('up £5,000 from today')
  })

  it('⛔ CONTRAST: a level target on the same unit reads exactly as before (no "from today")', () => {
    const level = targetText(goal({ goal_threshold_raw: 20000, goal_threshold_unit: 'GBP', goal_threshold_frame: 'level' }))
    expect(level).toBe(targetText(goal({ goal_threshold_raw: 20000, goal_threshold_unit: 'GBP' })))
    expect(level).not.toContain('from today')
  })
})

describe('the Model tab goal row — a change target is not edited as a level', () => {
  it('RED: the row is not editable (the editor writes a level; CEE refuses it by name, goal_is_a_change)', () => {
    expect(goalRow(goal({ goal_threshold_frame: 'change_rel', goal_threshold_raw: -0.15, goal_threshold_unit: 'GBP/month' })).editable).toBe(false)
  })

  it('⛔ CONTRAST: a level goal row, and a goal with no target yet, stay editable', () => {
    expect(goalRow(goal({ goal_threshold_raw: 20000, goal_threshold_unit: 'GBP' })).editable).toBe(true)
    expect(goalRow(goal({})).editable).toBe(true)
  })
})

describe('⛔ AIQ 5880974047 — an unread frame on the Model tab row', () => {
  it('RED: no number (not even the store scalar) and not editable', () => {
    const node = goal({ goal_threshold_frame: 'CHANGE_REL', goal_threshold_raw: -0.15, goal_threshold_unit: 'GBP/month' })
    const row = toModelRows({ nodes: [node], edges: [], goalThreshold: -0.15 }).find(r => r.id === GOAL_ID)!
    expect(row.primaryValue).toBeNull()
    expect(row.editable).toBe(false)
  })
})
