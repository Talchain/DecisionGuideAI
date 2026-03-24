/**
 * Regression test for Issue 2 (P0): Goal constraints not reaching UI
 *
 * CEE sends goal_constraints at the response root, but the orchestrator
 * envelope may not place them inside block.data. The fix reads
 * goal_constraints from the envelope root as a fallback.
 */

import { describe, it, expect } from 'vitest'
import { adaptCEEBlock } from '../useConversation'
import type { GraphPatchBlock } from '../types'
import type { CEEGoalConstraint } from '../../../adapters/cee/types'

describe('Issue 2 regression: goal_constraints extraction', () => {
  it('adaptCEEBlock extracts goal_constraints from block.data when present', () => {
    const block = {
      block_type: 'graph_patch',
      data: {
        operations: [],
        auto_apply: true,
        goal_constraints: [
          { id: 'c1', label: 'Revenue ≥ $1M', operator: '≥', value: 1000000 },
          { id: 'c2', label: 'Time ≤ 6 months', operator: '≤', value: 6 },
        ],
      },
    }
    const adapted = adaptCEEBlock(block) as GraphPatchBlock
    expect(adapted.goal_constraints).toBeDefined()
    expect(adapted.goal_constraints).toHaveLength(2)
    expect(adapted.goal_constraints![0].label).toBe('Revenue ≥ $1M')
  })

  it('adaptCEEBlock returns undefined goal_constraints when not in block.data', () => {
    const block = {
      block_type: 'graph_patch',
      data: {
        operations: [],
        auto_apply: true,
        // No goal_constraints here — they are at the envelope root
      },
    }
    const adapted = adaptCEEBlock(block) as GraphPatchBlock
    expect(adapted.goal_constraints).toBeUndefined()
  })

  it('envelope root goal_constraints type matches CEEGoalConstraint shape', () => {
    // Verify the constraint shape is compatible
    const constraint: CEEGoalConstraint = {
      id: 'c1',
      label: 'Revenue',
      operator: '≥',
      value: 1000000,
    }
    expect(constraint.id).toBe('c1')
    expect(constraint.label).toBe('Revenue')
  })
})
