/**
 * R8 (roadmap 2.27) — the mapper flip for held_proposal.
 *
 * RED baseline (pre-R8, pinned in mapV5Blocks.holds0150.test.ts): a
 * held_proposal block degraded to v5_unsupported — the deliberate 0.15.0
 * deferral.
 *
 * GREEN (this suite): a held_proposal maps to a self-contained
 * v5_held_proposal card, resolving its confirm_action_id / decline_action_id
 * refs against the response's top-level suggested_actions[]. Fail-closed
 * behaviour (unresolvable confirm) is asserted alongside so the two paths
 * cannot drift.
 */
import { describe, it, expect } from 'vitest'
import { mapV5Block, mapV5Blocks } from '../blocks/mapV5Blocks'
import type { OlumiResponse } from '@talchain/schemas/boundary'

type HeldProposalWire = Extract<OlumiResponse['blocks'][number], { type: 'held_proposal' }>
type ActionWire = OlumiResponse['suggested_actions'][number]

const CONFIRM: ActionWire = {
  id: 'gmh_ab12cd34ef56',
  label: 'Continue with this change',
  message: 'Yes',
}

const DECLINE: ActionWire = {
  id: 'gmh_decline_01',
  label: 'Tell me what to adjust',
  message: 'Actually, let me adjust it first',
}

function heldBlock(overrides: Partial<HeldProposalWire> = {}): HeldProposalWire {
  return {
    type: 'held_proposal',
    proposal_id: 'gmh_ab12cd34ef56',
    summary: 'Add a "regulatory delay" risk feeding into Launch on time',
    mutation_class: 'structural',
    reason_code: 'STRUCTURAL_APPLY_HELD',
    confirm_action_id: CONFIRM.id,
    ...overrides,
  } as HeldProposalWire
}

describe('mapV5Block — held_proposal → v5_held_proposal (R8)', () => {
  it('maps a well-formed block to the card, resolving the confirm ref verbatim', () => {
    const mapped = mapV5Block(heldBlock(), [CONFIRM])
    expect(mapped).toEqual({
      type: 'v5_held_proposal',
      proposal_id: 'gmh_ab12cd34ef56',
      summary: 'Add a "regulatory delay" risk feeding into Launch on time',
      mutation_class: 'structural',
      reason_code: 'STRUCTURAL_APPLY_HELD',
      confirm: { label: 'Continue with this change', message: 'Yes' },
    })
  })

  it('resolves an optional decline ref when present in suggested_actions', () => {
    const mapped = mapV5Block(
      heldBlock({ decline_action_id: DECLINE.id }),
      [CONFIRM, DECLINE],
    )
    expect(mapped).toMatchObject({
      type: 'v5_held_proposal',
      decline: { label: 'Tell me what to adjust', message: 'Actually, let me adjust it first' },
    })
  })

  it('omits decline when decline_action_id is present but unresolvable (local dismiss)', () => {
    const mapped = mapV5Block(
      heldBlock({ decline_action_id: 'gmh_missing' }),
      [CONFIRM],
    )
    expect(mapped).toMatchObject({ type: 'v5_held_proposal' })
    expect(mapped).not.toHaveProperty('decline')
  })

  it('passes an unknown/future reason_code through verbatim (widened, no UI release)', () => {
    const mapped = mapV5Block(
      heldBlock({ reason_code: 'SOME_FUTURE_HELD_CODE' as HeldProposalWire['reason_code'] }),
      [CONFIRM],
    )
    expect(mapped).toMatchObject({ reason_code: 'SOME_FUTURE_HELD_CODE' })
  })

  it('fails closed to the R7 unsupported card when the confirm ref cannot be resolved', () => {
    // Confirm chip is schema-guaranteed present but its ref is not in
    // suggested_actions (drift/corruption) — never crash, never vanish.
    const mapped = mapV5Block(heldBlock(), [])
    expect(mapped).toMatchObject({ type: 'v5_unsupported', blockType: 'held_proposal' })
  })

  it('degrades (never throws) when suggested_actions is null, not just undefined', () => {
    // The `= []` default only covers undefined. A null must not take the whole
    // mapper down via `.find()` — it degrades to the R7 unsupported card.
    const nullActions = null as unknown as undefined
    expect(() => mapV5Blocks([heldBlock()], nullActions)).not.toThrow()
    expect(mapV5Blocks([heldBlock()], nullActions)).toMatchObject([
      { type: 'v5_unsupported', blockType: 'held_proposal' },
    ])
  })

  it('carries only render-relevant fields (wire-only fields are not forwarded)', () => {
    // An unknown future field on the wire block is ignored; the wire-only
    // confirm_action_id ref is consumed (resolved into `confirm`), not echoed.
    const wireWithExtra = { ...heldBlock(), some_future_field: 'ignored' } as unknown as HeldProposalWire
    const mapped = mapV5Block(wireWithExtra, [CONFIRM]) as unknown as Record<string, unknown>
    expect(mapped).not.toHaveProperty('some_future_field')
    expect(mapped).not.toHaveProperty('confirm_action_id')
  })
})
