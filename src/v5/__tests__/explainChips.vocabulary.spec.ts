/**
 * V-P0-2 — the explain-chips vocabulary must be ONE vocabulary end-to-end.
 *
 * Live staging evidence (2026-07-13, scenario f0acea23, build 9de778ca):
 * CEE's response offered suggested_actions
 * `[{action_type:'explain_results', label:'Explain the result'}, …]` and the
 * UI rendered only the OTHER chip — the parser rewrote the plural to the
 * singular `explain_result` (an alias written for schemas 0.8.1, whose enum
 * lacked the plural) while the SuggestedChips V5 filter recognises only the
 * plural. Each half was spec-pinned in its own vocabulary; the composed
 * pipeline was broken with both specs green (mock-asserts-mock).
 *
 * schemas 0.15 accepts BOTH forms (`ActionType` enum, 9 members), CEE's
 * backend handler ID is the PLURAL (`useConversation.ts` ACTION_TO_TURN_TYPE
 * documents the singular as "legacy alias"), so the plural is canonical:
 * the parser must pass it through, the filter must accept what the parser
 * emits, and buildPayload's wire allowlist must match the schema enum
 * exactly so a schema-valid action_type is never silently stripped.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { ActionType } from '@talchain/schemas/boundary'

import { parseV5Response } from '../responseParser'
import { buildV5Payload, KNOWN_ACTION_TYPES } from '../buildPayload'
import { V5_ENABLED_ACTIONS } from '../../canvas/conversation/zones/SuggestedChips'

const FIXTURE_PATH = resolve(__dirname, 'fixtures/cee-response-b82c89dd-trimmed.json')

function loadFixture(): Record<string, unknown> {
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as Record<string, unknown>
}

function makeResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('explain-chips vocabulary — parser → filter seam (V-P0-2)', () => {
  it('the parser passes the schema-valid PLURAL through unrewritten', async () => {
    const result = await parseV5Response(makeResponse(loadFixture()))
    if (result.kind !== 'response') throw new Error('expected response')
    expect(result.response.suggested_actions[0].action_type).toBe('explain_results')
  })

  it('the V5 filter accepts what the parser emits (composed pipeline, was broken live)', async () => {
    const result = await parseV5Response(makeResponse(loadFixture()))
    if (result.kind !== 'response') throw new Error('expected response')
    for (const action of result.response.suggested_actions) {
      if (!action.action_type) continue
      expect(
        V5_ENABLED_ACTIONS.has(action.action_type),
        `chip action_type "${action.action_type}" would be HIDDEN by the V5 filter`,
      ).toBe(true)
    }
  })

  it('the filter also accepts the schema-valid SINGULAR legacy alias', () => {
    // Both forms are in the schema enum and ACTION_TO_TURN_TYPE dispatches
    // both to the same 'explain' turn — neither may be silently hidden.
    expect(V5_ENABLED_ACTIONS.has('explain_result')).toBe(true)
    expect(V5_ENABLED_ACTIONS.has('explain_results')).toBe(true)
  })
})

describe('buildPayload wire allowlist — schema parity', () => {
  it('KNOWN_ACTION_TYPES equals the @talchain/schemas ActionType enum EXACTLY (drift = red)', () => {
    expect(new Set(KNOWN_ACTION_TYPES)).toEqual(new Set(ActionType.options))
  })

  it('a schema-valid plural explain_results chip is NOT stripped at the wire', () => {
    const build = buildV5Payload({
      turnId: '00000000-0000-4000-8000-000000000001',
      scenarioId: '00000000-0000-4000-8000-000000000002',
      stage: 'analyse',
      turnClass: 'frame',
      mode: 'user',
      message: 'Explain the result',
      source: 'chip',
      chipMeta: { action_type: 'explain_results' },
    } as never)
    if (!build.ok) throw new Error('payload build failed: ' + JSON.stringify(build))
    const payload = build.payload as { chip?: { action_type?: string } }
    expect(payload.chip?.action_type).toBe('explain_results')
  })
})
