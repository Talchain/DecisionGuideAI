import { describe, expect, it } from 'vitest'
import { modelVersionMutationReceiptFixture } from '../../test/fixtures/modelVersionMutationReceipt'
import { parseV5Response } from '../responseParser'

const BASE = {
  response_version: 2,
  assistant_text: 'Committed.',
  blocks: [],
  suggested_actions: [],
  insights: [],
  stage_indicator: 'analyse',
}

function response(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('OlumiResponse model_version_receipt boundary', () => {
  it('preserves the exact optional receipt on the strict typed response surface', async () => {
    const parsed = await parseV5Response(
      response({
        ...BASE,
        model_version_receipt: modelVersionMutationReceiptFixture,
      }),
    )
    expect(parsed.kind).toBe('response')
    if (parsed.kind !== 'response') throw new Error('unreachable')
    expect(parsed.response.model_version_receipt).toEqual(
      modelVersionMutationReceiptFixture,
    )
  })

  it.each([
    ['an omitted required event id', (() => {
      const { event_id: _event, ...receipt } = modelVersionMutationReceiptFixture
      return receipt
    })()],
    [
      'an uncontracted freshness claim',
      { ...modelVersionMutationReceiptFixture, freshness: 'fresh' },
    ],
  ])('fails the whole boundary for %s', async (_name, receipt) => {
    const parsed = await parseV5Response(response({ ...BASE, model_version_receipt: receipt }))
    expect(parsed.kind).toBe('parse_error')
    if (parsed.kind !== 'parse_error') throw new Error('unreachable')
    expect(parsed.parse_failure_kind).toBe('schema_mismatch')
  })
})
