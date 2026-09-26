/**
 * Independent review (PR #2046, round 3, 5841162346) — an APPLIED
 * `set_factor_value` IS the receipt. It must not leave the "awaiting receipt"
 * signature behind.
 *
 * THE DEFECT. CEE's `set-factor-value.ts` builds `after` as `{ value, raw_value }`
 * and adds `source` only on a verified panel apply or an approved adoption; its
 * own persisted graph is stamped `appliedProvenance?.source ?? USER_EDIT_SOURCE`
 * (`'user_override'`, `set-factor-value.ts:727` @ bdd43f4a). This apply path
 * withdraws the extraction marker (`extractionType: null`) and spreads `after`,
 * so with no `source` in `after` the OLD AI/brief `source` survives beside a
 * withdrawn marker — exactly `factorValueSourceMark` rule 4, "awaiting receipt".
 * A chat edit Olumi applied, persisted and narrated then read "Your edit — not
 * saved to the model yet" in the inspector Olumi opened on that node.
 *
 * THE RULE. When the block is `applied` and `after` names no `source`, stamp
 * `USER_VALUE_STAMP` (`'user_override'`, the same literal CEE persists) — below
 * the withdrawal, above `...after`, so a `source` CEE does send still wins.
 */
import { describe, it, expect, vi } from 'vitest'
import type { OlumiResponse } from '@talchain/schemas/boundary'
import { applyV5State, type V5ApplicatorStore } from '../applyV5State'
import { factorValueAwaitsReceipt, factorValueSourceMark } from '../../canvas/nodes/shared/valueSourceMark'

function response(after: Record<string, unknown>): OlumiResponse {
  return {
    response_version: 2,
    assistant_text: '',
    blocks: [
      {
        type: 'graph_patch',
        status: 'applied',
        operation: 'set_factor_value',
        target_id: 'fac',
        before: { value: 0.8 },
        after,
      },
    ],
    suggested_actions: [],
    insights: [],
    stage_indicator: 'frame',
  } as unknown as OlumiResponse
}

function run(priorObs: Record<string, unknown>, after: Record<string, unknown>) {
  const node = {
    id: 'fac',
    type: 'factor',
    position: { x: 0, y: 0 },
    data: { label: 'Pricing', observedState: priorObs },
  } as unknown as V5ApplicatorStore['nodes'][number]
  let written: Record<string, unknown> | null = null
  const updateNode = vi.fn((_id: string, patch: { data: Record<string, unknown> }) => {
    written = patch.data
  })
  // The same store surface `applyV5State.test.ts`'s `makeStore` provides.
  const store = {
    setCurrentStage: vi.fn(),
    updateNode,
    updateEdgeData: vi.fn(),
    setRunMeta: vi.fn(),
    setCeeAnalysisReady: vi.fn(),
    setGoalConstraints: vi.fn(),
    backfillGoalThreshold: vi.fn(),
    nodes: [node],
    edges: [],
  } as unknown as V5ApplicatorStore
  applyV5State(response(after), store)
  // The autosave/restore round trip the store actually goes through.
  return JSON.parse(JSON.stringify(written)) as Record<string, unknown>
}

describe('an applied set_factor_value is the receipt — it never reads "not saved"', () => {
  it.each([
    ['a brief value', { value: 0.8, source: 'brief_extraction', extractionType: 'explicit' }],
    ['an Olumi estimate', { value: 0.8, source: 'cee_inference', extractionType: 'inferred' }],
  ])('over %s, with no source in `after`: stamped as the user\'s, not awaiting a receipt', (_label, prior) => {
    const data = run(prior, { value: 0.4, raw_value: 0.4 })
    expect((data.observedState as Record<string, unknown>).source).toBe('user_override')
    expect(factorValueAwaitsReceipt(data)).toBe(false)
    expect(factorValueSourceMark(data)?.kind).toBe('you')
  })

  it('CONTRAST: a `source` CEE does send still wins over the stamp', () => {
    const data = run(
      { value: 0.8, source: 'cee_inference', extractionType: 'inferred' },
      { value: 0.4, source: 'user_confirmed' },
    )
    expect((data.observedState as Record<string, unknown>).source).toBe('user_confirmed')
    expect(factorValueAwaitsReceipt(data)).toBe(false)
  })
})
