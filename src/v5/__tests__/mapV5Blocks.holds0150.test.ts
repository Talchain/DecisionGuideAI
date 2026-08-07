/**
 * 0.15.0 re-vendor pin, updated for R8.
 *
 * ui_directive remains KNOWN-and-deferred (R4's lane) — SILENTLY skipped per
 * its schema-specified degrade (advisory polish, never content).
 *
 * held_proposal is NO LONGER deferred: R8 renders the card. It still degrades
 * to the R7 v5_unsupported fallback when its confirm ref cannot be resolved
 * from suggested_actions — the fail-closed path pinned below. The GREEN card
 * mapping lives in mapV5Blocks.heldProposal.test.ts.
 */
import { describe, it, expect } from 'vitest'
import { mapV5Block } from '../blocks/mapV5Blocks'

describe('mapV5Blocks — 0.15.0 kinds', () => {
  it('held_proposal fails closed to the unsupported wrapper when the confirm ref is unresolvable', () => {
    const mapped = mapV5Block(
      {
        type: 'held_proposal',
        proposal_id: 'p1',
        summary: 'Held: structural change awaiting confirmation',
        mutation_class: 'structural',
        reason_code: 'STRUCTURAL_APPLY_HELD',
        confirm_action_id: 'a1',
      } as never,
      [], // no suggested_actions → confirm 'a1' cannot resolve
    )
    expect(mapped).toMatchObject({ type: 'v5_unsupported', blockType: 'held_proposal' })
  })

  it('held_proposal renders the card when the confirm ref resolves', () => {
    const mapped = mapV5Block(
      {
        type: 'held_proposal',
        proposal_id: 'p1',
        summary: 'Held: structural change awaiting confirmation',
        mutation_class: 'structural',
        reason_code: 'STRUCTURAL_APPLY_HELD',
        confirm_action_id: 'a1',
      } as never,
      [{ id: 'a1', label: 'Continue with this change', message: 'Yes' }],
    )
    expect(mapped).toMatchObject({ type: 'v5_held_proposal' })
  })

  it('ui_directive is SILENTLY skipped (the schema-specified degrade: advisory polish, never content)', () => {
    const mapped = mapV5Block({
      type: 'ui_directive',
      verb: 'highlight',
      targets: [{ id: 'n1', label: 'Factor', kind: 'factor' }],
    } as never)
    expect(mapped).toBeNull()
  })
})
