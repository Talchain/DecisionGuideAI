/**
 * Pins the receipt -> explain-diff request mapping, and the REFUSAL semantics of
 * the response parser.
 *
 * WHY THIS FILE EXISTS. CEE types `patch.updates` as `z.array(z.any())`. A wrong
 * mapping is therefore accepted silently — no schema error, no red anywhere —
 * and surfaces only as a vague explanation that reads like a bad model day. The
 * permissive schema is exactly where this drifts, so the shape is asserted here
 * rather than left implicit inside a component.
 */
import { describe, it, expect } from 'vitest'
import {
  buildExplainDiffRequest,
  parseExplainDiffResponse,
} from '../explainDiffRequest'
import type { V5GraphPatchBlock } from '../../../canvas/conversation/types'

const receipt = (over: Partial<V5GraphPatchBlock> = {}): V5GraphPatchBlock => ({
  type: 'v5_graph_patch',
  status: 'applied',
  operation: 'set_factor_value',
  target_id: 'factor_7',
  before: { value: 0.2 },
  after: { value: 0.45 },
  ...over,
})

describe('buildExplainDiffRequest', () => {
  it('maps the receipt into updates[], never adds[]', () => {
    const req = buildExplainDiffRequest(receipt())

    // The load-bearing claim: every V5 operation modifies something that already
    // exists, so it is an UPDATE. If this ever lands in `adds`, CEE's change gate
    // still counts it and the explanation silently describes the wrong kind of
    // change.
    expect(req.patch.updates).toHaveLength(1)
    expect(req.patch.adds.nodes).toEqual([])
    expect(req.patch.adds.edges).toEqual([])
    expect(req.patch.removes).toEqual([])
  })

  it('carries the identity and the before/after the card is showing', () => {
    const req = buildExplainDiffRequest(receipt())

    // Bound by IDENTITY (target_id), not by a value predicate another entry
    // could satisfy — this is the field CEE hands the model as the thing to
    // explain, and the field it sorts rationales by.
    expect(req.patch.updates[0]).toEqual({
      target_id: 'factor_7',
      operation: 'set_factor_value',
      before: { value: 0.2 },
      after: { value: 0.45 },
    })
  })

  it.each([
    'set_factor_value',
    'add_constraint',
    'adjust_edge_strength',
  ] as const)('maps operation %s into updates (whole operation domain)', (operation) => {
    // The complete operation union from types.ts — not a sample. A new operation
    // added upstream fails to typecheck here rather than silently mis-mapping.
    const req = buildExplainDiffRequest(receipt({ operation }))
    expect(req.patch.updates[0].operation).toBe(operation)
    expect(req.patch.adds.nodes).toEqual([])
  })

  it('includes graph_summary when known and OMITS the key entirely when not', () => {
    const withSummary = buildExplainDiffRequest(receipt(), { node_count: 6, edge_count: 5 })
    expect(withSummary.graph_summary).toEqual({ node_count: 6, edge_count: 5 })

    // Omitted, not sent as undefined/zeros: the input schema is `.strict()` and
    // zeros would be a fabricated fact about the user's model.
    const without = buildExplainDiffRequest(receipt())
    expect('graph_summary' in without).toBe(false)
  })

  it('never sends a brief (optional upstream, but minimum-length gated)', () => {
    expect('brief' in buildExplainDiffRequest(receipt())).toBe(false)
  })

  it('tolerates null before/after without inventing values', () => {
    const req = buildExplainDiffRequest(receipt({ before: null, after: null }))
    expect(req.patch.updates[0].before).toBeNull()
    expect(req.patch.updates[0].after).toBeNull()
  })
})

describe('parseExplainDiffResponse — refuses rather than repairs', () => {
  it('returns the server rationales when genuinely present', () => {
    const out = parseExplainDiffResponse({
      rationales: [{ target: 'factor_7', why: 'Raised to match the stated Q3 uplift.' }],
    })
    expect(out).toHaveLength(1)
    expect(out?.[0].why).toBe('Raised to match the stated Q3 uplift.')
  })

  it('preserves provenance_source when the server supplies it', () => {
    const out = parseExplainDiffResponse({
      rationales: [{ target: 'f1', why: 'because', provenance_source: 'user_brief' }],
    })
    expect(out?.[0].provenance_source).toBe('user_brief')
  })

  /**
   * ⚠ THE REGRESSION THIS FILE EXISTS FOR.
   *
   * The shipped-dark version read `data.explanation` — a key this route has never
   * returned — and rendered "No explanation available" on undefined. That is a
   * FALSE FAILURE REPORT at the exact moment the server answered in full.
   *
   * The fix is not a better fallback string. It is that an unrecognised body
   * yields null, and null means the caller must SAY it could not get an answer —
   * with no placeholder that could be mistaken for one.
   */
  it.each([
    ['the legacy shape that was never real', { explanation: 'a plausible sentence' }],
    ['rationales absent', {}],
    ['rationales not an array', { rationales: 'nope' }],
    ['empty rationales', { rationales: [] }],
    ['entries missing why', { rationales: [{ target: 'f1' }] }],
    ['entries missing target', { rationales: [{ why: 'because' }] }],
    ['blank why', { rationales: [{ target: 'f1', why: '   ' }] }],
    ['null body', null],
    ['a string body (the SPA catch-all signature)', '<!DOCTYPE html>'],
  ])('returns null for %s', (_label, body) => {
    expect(parseExplainDiffResponse(body)).toBeNull()
  })

  it('keeps only usable entries when a response is partly malformed', () => {
    const out = parseExplainDiffResponse({
      rationales: [
        { target: 'f1', why: 'a real reason' },
        { target: 'f2' },
        'garbage',
      ],
    })
    // Server text is preserved; junk is dropped. Nothing is invented to fill it.
    expect(out).toHaveLength(1)
    expect(out?.[0].target).toBe('f1')
  })
})
