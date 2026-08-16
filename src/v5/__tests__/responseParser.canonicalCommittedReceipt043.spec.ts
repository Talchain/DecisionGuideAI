/**
 * 0.43 reader-first adoption for canonical committed-graph receipts.
 *
 * The runtime parser needs no new adapter: `draft_graph` is already a declared
 * top-level key and a schema-known block type. These tests prove the vendored
 * reader accepts the additive carriers without weakening strictness, while the
 * separate producer schema enforces completeness and count integrity.
 */
import { describe, expect, it } from 'vitest'
import * as boundaryContracts from '@talchain/schemas/boundary'
import {
  CanonicalCommittedGraphBlockSchema,
  CanonicalCommittedGraphReceiptSchema,
  DraftGraphBlockSchema,
} from '@talchain/schemas/boundary'

import { parseV5Response } from '../responseParser'

const BASE_RESPONSE = {
  response_version: 2,
  assistant_text: 'Committed.',
  blocks: [],
  suggested_actions: [],
  insights: [],
  stage_indicator: 'analyse',
} as const

const LEGACY_RECEIPT = {
  nodes: [{ id: 'legacy-factor' }],
  edges: [],
  node_count: 1,
  edge_count: 0,
} as const

const CANONICAL_RECEIPT = {
  nodes: [
    {
      id: 'fac-cost',
      kind: 'factor',
      factor_type: 'continuous',
      observed_state: { value: 0.4, baseline: 0.3, cap: 1 },
      prior: { distribution: 'normal', range_min: 0, range_max: 1 },
      encoding_map: { low: 0, high: 1 },
    },
    { id: 'goal-value', kind: 'goal', goal_threshold: 0.75 },
  ],
  edges: [
    {
      from: 'fac-cost',
      to: 'goal-value',
      effect_direction: 'negative',
      exists_probability: 0.8,
      strength: { mean: -0.4, std: 0.1 },
    },
  ],
  options: [
    {
      id: 'opt-a',
      status: 'needs_clarification',
      is_baseline: false,
      interventions: {
        'fac-cost': {
          value: 0.62,
          value_type: 'continuous',
          encoding_map: { low: 0, high: 1 },
          target_match: { node_id: 'fac-cost', match_type: 'exact', confidence: 1 },
        },
      },
      raw_interventions: { 'fac-cost': 'high' },
    },
  ],
  goal_node_id: 'goal-value',
  goal_constraints: [
    {
      constraint_id: 'constraint_cost_max',
      node_id: 'fac-cost',
      operator: '<=',
      value: 0.7,
      value_frame: 'level',
      provenance: 'explicit',
      producer_passthrough_probe: 'preserved',
    },
  ],
  node_count: 2,
  edge_count: 1,
} as const

function response(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function parseDraftGraph(draftGraph: unknown) {
  const result = await parseV5Response(
    response({ ...BASE_RESPONSE, draft_graph: draftGraph }),
  )
  expect(result.kind).toBe('response')
  if (result.kind !== 'response') throw new Error('unreachable')
  return result.response.draft_graph as Record<string, unknown>
}

async function parseDraftGraphBlock(block: unknown) {
  const result = await parseV5Response(
    response({ ...BASE_RESPONSE, blocks: [block] }),
  )
  expect(result.kind).toBe('response')
  if (result.kind !== 'response') throw new Error('unreachable')
  return result.response.blocks[0] as unknown as Record<string, unknown>
}

describe('responseParser canonical committed receipt 0.43 reader', () => {
  it('keeps legacy top-level and blocks[] draft graphs byte-shaped and omitted', async () => {
    const topLevel = await parseDraftGraph(LEGACY_RECEIPT)
    const block = await parseDraftGraphBlock({ type: 'draft_graph', ...LEGACY_RECEIPT })

    expect(topLevel).toEqual(LEGACY_RECEIPT)
    expect(block).toEqual({ type: 'draft_graph', ...LEGACY_RECEIPT })
    for (const parsed of [topLevel, block]) {
      expect(Object.prototype.hasOwnProperty.call(parsed, 'options')).toBe(false)
      expect(Object.prototype.hasOwnProperty.call(parsed, 'goal_node_id')).toBe(false)
      expect(Object.prototype.hasOwnProperty.call(parsed, 'goal_constraints')).toBe(false)
    }
  })

  it('preserves the full canonical receipt at both existing transport locations', async () => {
    const topLevel = await parseDraftGraph(CANONICAL_RECEIPT)
    const blockInput = { type: 'draft_graph', ...CANONICAL_RECEIPT }
    const block = await parseDraftGraphBlock(blockInput)

    expect(topLevel).toEqual(CANONICAL_RECEIPT)
    expect(block).toEqual(blockInput)
    expect(topLevel.options).toEqual(CANONICAL_RECEIPT.options)
    expect(topLevel.goal_node_id).toBe('goal-value')
    expect(topLevel.goal_constraints).toEqual(CANONICAL_RECEIPT.goal_constraints)
  })

  it('preserves explicit canonical absence as owned [], null and [] keys', async () => {
    const emptyCanonical = {
      nodes: [],
      edges: [],
      options: [],
      goal_node_id: null,
      goal_constraints: [],
      node_count: 0,
      edge_count: 0,
    }
    const parsed = await parseDraftGraph(emptyCanonical)

    expect(parsed).toEqual(emptyCanonical)
    for (const key of ['options', 'goal_node_id', 'goal_constraints']) {
      expect(Object.prototype.hasOwnProperty.call(parsed, key)).toBe(true)
    }
  })

  it('keeps nested draft_graph strict after the re-vendor', async () => {
    const result = await parseV5Response(
      response({
        ...BASE_RESPONSE,
        draft_graph: { ...CANONICAL_RECEIPT, undeclared_receipt_key: true },
      }),
    )

    expect(result.kind).toBe('parse_error')
    if (result.kind !== 'parse_error') throw new Error('unreachable')
    expect(result.parse_failure_kind).toBe('schema_mismatch')
  })

  it('enforces producer completeness and count integrity without tightening legacy reads', () => {
    expect(CanonicalCommittedGraphReceiptSchema.parse(CANONICAL_RECEIPT)).toEqual(
      CANONICAL_RECEIPT,
    )
    expect(
      CanonicalCommittedGraphBlockSchema.safeParse({
        type: 'draft_graph',
        ...CANONICAL_RECEIPT,
        node_count: 99,
      }).success,
    ).toBe(false)
    expect(
      DraftGraphBlockSchema.safeParse({
        type: 'draft_graph',
        ...LEGACY_RECEIPT,
        node_count: 99,
      }).success,
    ).toBe(true)
  })

  it('exports the 0.43 boundary symbols with an absence-detecting control', () => {
    expect(typeof CanonicalCommittedGraphReceiptSchema.safeParse).toBe('function')
    expect(typeof CanonicalCommittedGraphBlockSchema.safeParse).toBe('function')
    expect('DefinitelyNotARealReceiptSchema_XYZ' in boundaryContracts).toBe(false)
  })
})
