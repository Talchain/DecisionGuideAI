/**
 * V5 responseParser — additive top-level tolerance tests.
 *
 * v5-canonical-analysis brief PR 1 correction 7: unknown top-level keys
 * must be tolerated and surfaced via a sidecar, while nested schemas
 * remain strict.
 */
import { describe, it, expect } from 'vitest'

import {
  parseV5Response,
  ADDITIVE_EXTENSIONS_KEY,
} from '../responseParser'

function makeResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const minimalKnownPayload = {
  response_version: 2,
  assistant_text: 'hi',
  blocks: [],
  suggested_actions: [],
  insights: [],
  stage_indicator: 'frame',
}

describe('parseV5Response additive top-level tolerance', () => {
  it('parses a minimal payload with no extensions and returns no sidecar', async () => {
    const result = await parseV5Response(makeResponse(minimalKnownPayload))
    expect(result.kind).toBe('response')
    if (result.kind !== 'response') throw new Error('unreachable')
    expect((result.response as Record<string | symbol, unknown>)[ADDITIVE_EXTENSIONS_KEY]).toBeUndefined()
  })

  it('tolerates an unknown top-level key and surfaces it via the sidecar', async () => {
    const payload = {
      ...minimalKnownPayload,
      guidance_items: [{ item_id: 'g1', title: 'be careful' }],
      analysis_freshness: 'fresh',
    }
    const result = await parseV5Response(makeResponse(payload))
    expect(result.kind).toBe('response')
    if (result.kind !== 'response') throw new Error('unreachable')
    const ext = (result.response as Record<string | symbol, unknown>)[ADDITIVE_EXTENSIONS_KEY]
    expect(ext).toBeDefined()
    expect(ext).toMatchObject({
      guidance_items: [{ item_id: 'g1', title: 'be careful' }],
      analysis_freshness: 'fresh',
    })
  })

  it('still fails parse when a NESTED schema is violated (nested strict preserved)', async () => {
    const payload = {
      ...minimalKnownPayload,
      blocks: [{ type: 'text' /* missing content */ }],
    }
    const result = await parseV5Response(makeResponse(payload))
    expect(result.kind).toBe('parse_error')
    if (result.kind !== 'parse_error') throw new Error('unreachable')
    // Phase 3 fix: every parse_error now carries an explicit failure kind so
    // the debug bundle can distinguish a malformed-known block from an
    // unknown-type or non-JSON failure.
    expect(result.parse_failure_kind).toBe('schema_mismatch')
  })

  it('still fails parse when a known top-level field is the wrong type', async () => {
    const payload = {
      ...minimalKnownPayload,
      stage_indicator: 'invalid_stage',
    }
    const result = await parseV5Response(makeResponse(payload))
    expect(result.kind).toBe('parse_error')
    if (result.kind !== 'parse_error') throw new Error('unreachable')
    expect(result.parse_failure_kind).toBe('schema_mismatch')
  })

  it('sidecar is frozen and non-enumerable', async () => {
    const payload = { ...minimalKnownPayload, custom: 1 }
    const result = await parseV5Response(makeResponse(payload))
    if (result.kind !== 'response') throw new Error('unreachable')
    const keys = Object.keys(result.response as Record<string, unknown>)
    // sidecar must not appear in normal key enumeration.
    expect(keys).not.toContain(ADDITIVE_EXTENSIONS_KEY)
    const ext = (result.response as Record<string | symbol, unknown>)[ADDITIVE_EXTENSIONS_KEY]
    expect(Object.isFrozen(ext)).toBe(true)
  })
})
