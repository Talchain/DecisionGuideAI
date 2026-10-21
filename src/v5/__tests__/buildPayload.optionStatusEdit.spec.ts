/**
 * `option_status_edit` (0.69.0) from the option inspector's control to the wire: the event the control builds, through the
 * real payload builder, parsed by the REAL contract. Each refusal is paired with the nearest accepted case.
 */
import { describe, it, expect } from 'vitest'
import { SystemEventSchema } from '@talchain/schemas/boundary'

import { buildV5Payload } from '../buildPayload'
import { optionStatusToggleEvent } from '../../canvas/domain/optionStatus'

const HASH = 'f3d31f75957c5cb5'
const base = {
  turnId: '11111111-1111-4111-8111-111111111111',
  scenarioId: '22222222-2222-4222-8222-222222222222',
  stage: 'evaluate' as const, turnClass: 'evaluate' as const, mode: 'system' as const,
}
const wire = (systemEvent: ReturnType<typeof optionStatusToggleEvent>) => {
  const r = buildV5Payload({ ...base, systemEvent: systemEvent! } as never)
  return r.ok && r.payload.kind === 'system_event' ? r.payload.event : null
}

describe('option_status_edit: the inspector\'s in/out control on the wire', () => {
  it('⭐ a compared option is taken out (removed), with the status last read; the contract accepts it', () => {
    const event = wire(optionStatusToggleEvent('push', { label: 'Push' }, HASH))
    expect(event).toEqual({ kind: 'option_status_edit', option_node_id: 'push', expected_status: 'feasible', status: 'removed', base_graph_hash: HASH })
    expect(SystemEventSchema.safeParse(event).success).toBe(true)
  })

  it('⭐ a taken-out option (either word) is put back', () => {
    expect(wire(optionStatusToggleEvent('push', { option_status: 'removed' }, HASH))).toMatchObject({ expected_status: 'removed', status: 'feasible' })
    expect(wire(optionStatusToggleEvent('push', { option_status: 'infeasible' }, HASH))).toMatchObject({ expected_status: 'infeasible', status: 'feasible' })
  })

  it('⛔ no saved hash to assert: no control event; a no-op or an unknown status never reaches the wire', () => {
    expect(optionStatusToggleEvent('push', {}, null)).toBeNull()
    expect(optionStatusToggleEvent('push', {}, '')).toBeNull()
    const send = (payload: Record<string, unknown>) => wire({ type: 'option_status_edit', payload })
    expect(send({ option_node_id: 'push', expected_status: 'feasible', status: 'feasible', base_graph_hash: HASH })).toBeNull()
    expect(send({ option_node_id: 'push', expected_status: 'feasible', status: 'gone', base_graph_hash: HASH })).toBeNull()
    expect(send({ option_node_id: 'push', expected_status: 'feasible', status: 'removed', base_graph_hash: HASH })).not.toBeNull()
  })
})
