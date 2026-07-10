/**
 * 0.15.0 re-vendor pin: the two new wave block kinds are KNOWN and
 * deliberately deferred — they must degrade to v5_unsupported (the R7
 * honest fallback), not crash the mapper and not silently drop. R8 (held
 * proposal card) and R4 (ui_directive dispatcher) replace these paths.
 */
import { describe, it, expect } from 'vitest'
import { mapV5Block } from '../blocks/mapV5Blocks'

describe('mapV5Blocks — 0.15.0 kinds deferred to v5_unsupported', () => {
  it('held_proposal degrades to the unsupported wrapper', () => {
    const mapped = mapV5Block({
      type: 'held_proposal',
      proposal_id: 'p1',
      summary: 'Held: structural change awaiting confirmation',
      mutation_class: 'structural',
      reason_code: 'STRUCTURAL_APPLY_HELD',
      confirm_action_id: 'a1',
    } as never)
    expect(mapped).toMatchObject({ type: 'v5_unsupported', blockType: 'held_proposal' })
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
