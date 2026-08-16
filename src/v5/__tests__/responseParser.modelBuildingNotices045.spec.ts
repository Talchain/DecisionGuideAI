/**
 * Schemas 0.45 reader-first adoption: the only accepted notice carrier is the
 * strict optional OlumiResponse root field. Malformed or detail-bearing values
 * fail the whole response parse; absence remains genuine legacy absence.
 */
import { describe, expect, it } from 'vitest'
import {
  CanonicalCommittedGraphReceiptSchema,
  DraftGraphBlockSchema,
  ModelBuildingNoticesSchema,
} from '@talchain/schemas/boundary'

import { parseV5Response } from '../responseParser'

const BASE_RESPONSE = {
  response_version: 2,
  assistant_text: 'A first model is ready.',
  blocks: [],
  suggested_actions: [],
  insights: [],
  stage_indicator: 'frame',
} as const

const VALID_NOTICES = {
  total_count: 4,
  groups: [
    { kind: 'detail_not_connected', count: 1 },
    { kind: 'relationship_not_used', count: 3 },
  ],
  details_redacted: true,
} as const

function response(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('parseV5Response — model-building notices 0.45', () => {
  it('preserves the valid declared top-level carrier on the strict response', async () => {
    expect(ModelBuildingNoticesSchema.parse(VALID_NOTICES)).toEqual(VALID_NOTICES)

    const result = await parseV5Response(
      response({ ...BASE_RESPONSE, model_building_notices: VALID_NOTICES }),
    )

    expect(result.kind).toBe('response')
    if (result.kind !== 'response') throw new Error('unreachable')
    expect(result.response.model_building_notices).toEqual(VALID_NOTICES)
  })

  it('keeps legacy absence as own-key absence', async () => {
    const result = await parseV5Response(response(BASE_RESPONSE))

    expect(result.kind).toBe('response')
    if (result.kind !== 'response') throw new Error('unreachable')
    expect(Object.prototype.hasOwnProperty.call(result.response, 'model_building_notices')).toBe(false)
  })

  it.each([
    ['false redaction attestation', { ...VALID_NOTICES, details_redacted: false }],
    ['zero total', { ...VALID_NOTICES, total_count: 0 }],
    ['group sum mismatch', { ...VALID_NOTICES, total_count: 5 }],
    [
      'duplicate kind',
      {
        total_count: 2,
        groups: [
          { kind: 'detail_not_connected', count: 1 },
          { kind: 'detail_not_connected', count: 1 },
        ],
        details_redacted: true,
      },
    ],
    [
      'unknown kind',
      {
        total_count: 1,
        groups: [{ kind: 'producer_invented_kind', count: 1 }],
        details_redacted: true,
      },
    ],
    [
      'detail-bearing group',
      {
        total_count: 1,
        groups: [{
          kind: 'detail_not_connected',
          count: 1,
          label: 'Commercial margin',
          value: '£250,000',
          raw_reason: 'because the user said so',
          node_id: 'fac_margin',
        }],
        details_redacted: true,
      },
    ],
    [
      'detail-bearing root',
      {
        ...VALID_NOTICES,
        raw_reasons: ['sensitive source text'],
      },
    ],
  ])('fails the whole response closed for %s', async (_label, notices) => {
    const result = await parseV5Response(
      response({ ...BASE_RESPONSE, model_building_notices: notices }),
    )

    expect(result.kind).toBe('parse_error')
    if (result.kind !== 'parse_error') throw new Error('unreachable')
    expect(result.parse_failure_kind).toBe('schema_mismatch')
  })

  it('cannot enter either governed graph carrier', () => {
    const graphShape = {
      nodes: [],
      edges: [],
      node_count: 0,
      edge_count: 0,
      model_building_notices: VALID_NOTICES,
    }

    expect(DraftGraphBlockSchema.safeParse({ type: 'draft_graph', ...graphShape }).success).toBe(false)
    expect(
      CanonicalCommittedGraphReceiptSchema.safeParse({
        ...graphShape,
        options: [],
        goal_node_id: null,
        goal_constraints: [],
      }).success,
    ).toBe(false)
  })
})
