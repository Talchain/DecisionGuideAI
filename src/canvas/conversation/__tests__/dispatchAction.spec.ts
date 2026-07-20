/**
 * dispatchAction — unified pill routing tests
 *
 * Tests:
 * 1. ACTION_TO_TURN_TYPE deterministic mapping against expected values
 *
 * The former T2 (extractBaseRateChipSet) and T3 (BASE_RATE_VALUES) blocks were
 * removed with the dead V4 base-rate-chip chain. T3 additionally asserted a
 * locally-declared literal against itself and never imported the module it
 * claimed to cover, so it could not have failed.
 */

import { describe, it, expect } from 'vitest'
import { ACTION_TO_TURN_TYPE } from '../useConversation'

// ---------------------------------------------------------------------------
// T1 — ACTION_TO_TURN_TYPE deterministic mapping
// ---------------------------------------------------------------------------

describe('ACTION_TO_TURN_TYPE mapping', () => {
  const expectedMappings: Record<string, string> = {
    run_analysis: 'run_analysis',
    explain_result: 'explain',
    // Phase 2b of the V5 completion plan (2026-05-13): backend handler ID
    // is the PLURAL `explain_results`. Singular kept as legacy alias
    // because chip-generator's prompt chips used it as a discriminator.
    // Both must map identically to 'explain' so the deterministic
    // chip-click bypass fires regardless of which alias the chip carries.
    explain_results: 'explain',
    compare_options: 'explain',
    what_would_flip: 'explain',
    challenge_assumption: 'conversation',
    set_factor_value: 'conversation',
    add_factor: 'conversation',
    add_option: 'conversation',
    add_constraint: 'conversation',
    adjust_edge_strength: 'conversation',
    remove_factor: 'conversation',
    set_goal_target: 'conversation',
    run_premortem: 'explain',
    draft_graph: 'explicit_generate',
  }

  it.each(Object.entries(expectedMappings))(
    '%s → %s',
    (actionType, expectedTurnType) => {
      expect(ACTION_TO_TURN_TYPE[actionType]).toBe(expectedTurnType)
    },
  )

  it('returns undefined for unknown action types (fallback to conversation happens at call site)', () => {
    expect(ACTION_TO_TURN_TYPE['nonexistent_action']).toBeUndefined()
  })

  it('contains all expected action types', () => {
    expect(Object.keys(ACTION_TO_TURN_TYPE).sort()).toEqual(
      Object.keys(expectedMappings).sort(),
    )
  })
})
