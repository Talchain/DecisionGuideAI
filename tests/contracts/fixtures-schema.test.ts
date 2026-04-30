/**
 * Cross-boundary fixture schema validation (UI side).
 *
 * Mirrors olumi-assistants-service/tests/contract/fixtures-schema.test.ts.
 * The 6 shared fixtures in tests/fixtures/cee-responses/ are byte-identical
 * copies of the CEE source. This test parses the V5 turn fixtures against
 * the boundary OlumiResponseSchema; the draft-graph fixtures are validated
 * structurally (the V3 Zod schema is CEE-internal — we assert on the shape
 * the UI adapter actually consumes).
 *
 * Drift fails independently of consumption tests so a fixture-shape change
 * surfaces immediately.
 */
import { describe, it, expect } from 'vitest'
import { OlumiResponseSchema } from '@talchain/schemas/boundary'

import draftWithCoaching from '../fixtures/cee-responses/draft-graph.success.with-coaching-and-provenance.json'
import draftNoCoaching from '../fixtures/cee-responses/draft-graph.success.no-coaching.json'
import draftPartialCoaching from '../fixtures/cee-responses/draft-graph.success.partial-coaching.json'
import v5Stale from '../fixtures/cee-responses/v5-turn.explain-stale.json'
import v5Failure from '../fixtures/cee-responses/v5-turn.failure-with-recovery-chip.json'
import v5Fresh from '../fixtures/cee-responses/v5-turn.explain-fresh.json'

describe('cee-response fixture schemas', () => {
  const v5Fixtures = [
    ['explain-stale', v5Stale],
    ['failure-with-recovery-chip', v5Failure],
    ['explain-fresh', v5Fresh],
  ] as const

  for (const [name, fixture] of v5Fixtures) {
    it(`v5-turn.${name} parses against OlumiResponseSchema`, () => {
      const result = OlumiResponseSchema.safeParse(fixture)
      if (!result.success) {
        // eslint-disable-next-line no-console
        console.error(
          `Schema rejected v5-turn.${name}:`,
          JSON.stringify(result.error.format(), null, 2),
        )
      }
      expect(result.success).toBe(true)
    })
  }

  // V3 schema is CEE-internal; assert on the documented adapter-consumed shape.
  it('draft-graph fixtures expose nodes/edges/options/goal_node_id at root (V3 flat shape)', () => {
    for (const [name, fixture] of [
      ['with-coaching-and-provenance', draftWithCoaching],
      ['no-coaching', draftNoCoaching],
      ['partial-coaching', draftPartialCoaching],
    ] as const) {
      const r = fixture as Record<string, unknown>
      expect(r.schema_version, name).toBe('3.0')
      expect(Array.isArray(r.nodes), name).toBe(true)
      expect(Array.isArray(r.edges), name).toBe(true)
      expect(Array.isArray(r.options), name).toBe(true)
      expect(typeof r.goal_node_id, name).toBe('string')
    }
  })

  it('draft-graph.with-coaching-and-provenance has the documented coaching shape', () => {
    const c = (draftWithCoaching as { coaching: Record<string, unknown> }).coaching
    expect(typeof c.summary).toBe('string')
    expect(Array.isArray(c.strengthen_items)).toBe(true)
    expect(Array.isArray(c.widening_log)).toBe(true)
    expect(Array.isArray(c.bias_signals)).toBe(true)
  })

  it('draft-graph.no-coaching omits coaching entirely', () => {
    const r = draftNoCoaching as Record<string, unknown>
    expect(r).not.toHaveProperty('coaching')
  })

  it('draft-graph.partial-coaching has summary:null + empty array + omitted optional fields', () => {
    const c = (draftPartialCoaching as { coaching: Record<string, unknown> }).coaching
    expect(c.summary).toBeNull()
    expect(c.strengthen_items).toEqual([])
    expect(c).not.toHaveProperty('widening_log')
    expect(c).not.toHaveProperty('bias_signals')
  })
})
