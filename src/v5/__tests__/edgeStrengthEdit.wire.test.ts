/** Contract carriage for the schemas-0.42 canonical relationship writer. */

import { describe, expect, it } from 'vitest'
import { OrchestratorTurnPayloadSchema } from '@talchain/schemas/boundary'

import { serializeSystemEvent } from '../../canvas/conversation/systemEvents'
import { buildV5Payload, type BuildV5PayloadInput } from '../buildPayload'

const baseInput = {
  turnId: '11111111-1111-4111-8111-111111111111',
  scenarioId: '22222222-2222-4222-8222-222222222222',
  stage: 'analyse' as const,
  // System turns do not serialise turn_class, but the shared builder input
  // still carries a valid boundary member.
  turnClass: 'clarify' as const,
  mode: 'system' as const,
}

function build(payload: Record<string, unknown>) {
  const input: BuildV5PayloadInput = {
    ...baseInput,
    systemEvent: { type: 'edge_strength_edit' as const, payload },
  }
  return buildV5Payload(input)
}

describe('edge_strength_edit wire', () => {
  it('survives the send allowlist', () => {
    const result = serializeSystemEvent({
      type: 'edge_strength_edit',
      payload: {
        from: 'fac_demand',
        to: 'goal_profit',
        magnitude: 0.7,
        direction_intent: 'preserve',
        expected: { mean: -0.4, effect_direction: 'negative' },
        intent: 'set',
      },
    })
    expect(result?.event_type).toBe('edge_strength_edit')
  })

  it.each([
    {
      label: 'negative preserve',
      payload: {
        from: 'fac_demand',
        to: 'goal_profit',
        magnitude: 0.7,
        direction_intent: 'preserve',
        expected: { mean: -0.4, effect_direction: 'negative' },
        intent: 'set',
      },
    },
    {
      label: 'explicit positive direction',
      payload: {
        from: 'fac_demand',
        to: 'goal_profit',
        magnitude: 0.6,
        direction_intent: 'positive',
        expected: { mean: -0.4, effect_direction: 'negative' },
        intent: 'set',
      },
    },
    {
      label: 'explicit negative zero',
      payload: {
        from: 'fac_demand',
        to: 'goal_profit',
        magnitude: 0,
        direction_intent: 'negative',
        expected: { mean: 0.4, effect_direction: 'positive' },
        intent: 'set',
      },
    },
    {
      label: 'confirm current',
      payload: {
        from: 'fac_quality',
        to: 'goal_profit',
        magnitude: 0.25,
        direction_intent: 'preserve',
        expected: { mean: 0.25, effect_direction: 'positive' },
        intent: 'confirm_current',
      },
    },
  ])('builds the exact contract shape for $label', ({ payload }) => {
    const result = build(payload)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(() => OrchestratorTurnPayloadSchema.parse(result.payload)).not.toThrow()
    expect(result.payload.kind).toBe('system_event')
    if (result.payload.kind !== 'system_event') return
    expect(result.payload.event).toEqual({ kind: 'edge_strength_edit', ...payload })
    expect(result.payload.event).not.toHaveProperty('strength_std')
    expect(result.payload.event).not.toHaveProperty('exists_probability')
    expect(result.payload.event).not.toHaveProperty('belief')
  })

  it.each([
    ['missing source', {
      to: 'goal_profit', magnitude: 0.5, direction_intent: 'preserve',
      expected: { mean: 0.4, effect_direction: 'positive' }, intent: 'set',
    }],
    ['composite source', {
      from: 'fac→other', to: 'goal_profit', magnitude: 0.5, direction_intent: 'preserve',
      expected: { mean: 0.4, effect_direction: 'positive' }, intent: 'set',
    }],
    ['magnitude above one', {
      from: 'fac', to: 'goal', magnitude: 1.1, direction_intent: 'preserve',
      expected: { mean: 0.4, effect_direction: 'positive' }, intent: 'set',
    }],
    ['incoherent expected sign', {
      from: 'fac', to: 'goal', magnitude: 0.5, direction_intent: 'preserve',
      expected: { mean: -0.4, effect_direction: 'positive' }, intent: 'set',
    }],
    ['confirm changes magnitude', {
      from: 'fac', to: 'goal', magnitude: 0.5, direction_intent: 'preserve',
      expected: { mean: 0.4, effect_direction: 'positive' }, intent: 'confirm_current',
    }],
    ['confirm changes direction', {
      from: 'fac', to: 'goal', magnitude: 0.4, direction_intent: 'negative',
      expected: { mean: 0.4, effect_direction: 'positive' }, intent: 'confirm_current',
    }],
  ])('fails closed for %s', (_label, payload) => {
    expect(build(payload as Record<string, unknown>).ok).toBe(false)
  })
})
