/**
 * ROADMAP 2.129 (b) — the pure half: the rejection predicate and the queue merge.
 *
 * The rejection signal is an ABSENCE (CEE's refusal reply carries `blocks: []`,
 * not a `graph_patch` with `status: 'rejected'`), and an absence-based rule has
 * a dangerous failure direction: a FALSE "not applied" reverts a value the
 * server ACCEPTED, which is worse than the bug being fixed. So the predicate is
 * asserted here in BOTH directions, with the fail-safe cases named explicitly —
 * they are the ones no live capture would ever have shown us.
 */

import { describe, it, expect } from 'vitest'
import {
  captureOptimisticFactorEdit,
  mergeOptimisticFactorEdit,
  responseAppliedFactorEdit,
} from '../optimisticFactorEdit'

const TARGET = 'fac_delivery_time'

describe('responseAppliedFactorEdit — did the server apply MY edit?', () => {
  it('the captured REFUSAL reads as not-applied', () => {
    expect(
      responseAppliedFactorEdit(
        { assistant_text: "…exceeds the factor's cap of 6 months. I haven't changed anything.", blocks: [] },
        TARGET,
      ),
    ).toBe(false)
  })

  it('the captured APPLIED receipt reads as applied (block-level target_id)', () => {
    expect(
      responseAppliedFactorEdit(
        {
          blocks: [
            { type: 'graph_patch', status: 'applied', operation: 'set_factor_value', target_id: TARGET },
          ],
        },
        TARGET,
      ),
    ).toBe(true)
  })

  it('reads the operations[] shape too — both exist in the contract', () => {
    expect(
      responseAppliedFactorEdit(
        { blocks: [{ type: 'graph_patch', status: 'applied', operations: [{ target_id: TARGET }] }] },
        TARGET,
      ),
    ).toBe(true)
  })

  it('a patch applied to a DIFFERENT factor does not vouch for mine', () => {
    expect(
      responseAppliedFactorEdit(
        { blocks: [{ type: 'graph_patch', status: 'applied', target_id: 'fac_other' }] },
        TARGET,
      ),
    ).toBe(false)
  })

  it('an explicitly non-applied patch for my target reads as not-applied', () => {
    for (const status of ['rejected', 'proposed', 'dismissed', 'failed']) {
      expect(
        responseAppliedFactorEdit(
          { blocks: [{ type: 'graph_patch', status, target_id: TARGET }] },
          TARGET,
        ),
        status,
      ).toBe(false)
    }
  })

  // ── fail-safe direction: when in doubt, DO NOT revert ──

  it('an UNKNOWN status counts as applied — never revert over a receipt we cannot classify', () => {
    expect(
      responseAppliedFactorEdit(
        { blocks: [{ type: 'graph_patch', status: 'partially_reconciled', target_id: TARGET }] },
        TARGET,
      ),
    ).toBe(true)
  })

  it('an applied patch naming NO target counts as applied — it may well be mine', () => {
    expect(
      responseAppliedFactorEdit({ blocks: [{ type: 'graph_patch', status: 'applied' }] }, TARGET),
    ).toBe(true)
  })

  it('an unattributable edit (no target id) never triggers a revert', () => {
    expect(responseAppliedFactorEdit({ blocks: [] }, '')).toBe(true)
  })

  it('a malformed reply reads as not-applied — nothing there claims a mutation', () => {
    expect(responseAppliedFactorEdit(null, TARGET)).toBe(false)
    expect(responseAppliedFactorEdit({}, TARGET)).toBe(false)
    expect(responseAppliedFactorEdit({ blocks: 'nope' }, TARGET)).toBe(false)
  })
})

describe('mergeOptimisticFactorEdit — two queued edits to one factor', () => {
  const nodeData = { observedState: { value: 0.5, raw_value: 3, source: 'cee_inference' }, display_value: '3 months' }

  it('keeps the ORIGINAL pre-edit state and adopts the NEW value being sent', () => {
    // 3 → 25, then 25 → 30, both still undispatched. The server has seen
    // neither, so it still holds 3: a refusal of 30 must restore 3.
    const first = captureOptimisticFactorEdit('fac_a', 25 / 6, nodeData)!
    const secondData = { observedState: { value: 25 / 6, raw_value: 25, source: 'user' }, display_value: undefined }
    const second = captureOptimisticFactorEdit('fac_a', 30 / 6, secondData)!

    const merged = mergeOptimisticFactorEdit(first, second)!
    expect(merged.sentValue).toBe(30 / 6)
    expect((merged.prevObservedState as Record<string, unknown>).raw_value).toBe(3)
    expect((merged.prevObservedState as Record<string, unknown>).source).toBe('cee_inference')
    expect(merged.prevDisplayValue).toBe('3 months')
  })

  it('a different target replaces rather than merges', () => {
    const a = captureOptimisticFactorEdit('fac_a', 1, nodeData)!
    const b = captureOptimisticFactorEdit('fac_b', 2, nodeData)!
    expect(mergeOptimisticFactorEdit(a, b)).toBe(b)
  })

  it('tolerates either side being absent', () => {
    const a = captureOptimisticFactorEdit('fac_a', 1, nodeData)!
    expect(mergeOptimisticFactorEdit(undefined, a)).toBe(a)
    expect(mergeOptimisticFactorEdit(a, undefined)).toBe(a)
    expect(mergeOptimisticFactorEdit(undefined, undefined)).toBeUndefined()
  })
})

describe('captureOptimisticFactorEdit — fails closed', () => {
  it('returns null for an unencodable edit rather than a half-snapshot', () => {
    expect(captureOptimisticFactorEdit('', 1, {})).toBeNull()
    expect(captureOptimisticFactorEdit('fac_a', NaN, {})).toBeNull()
    expect(captureOptimisticFactorEdit('fac_a', Infinity, {})).toBeNull()
  })

  it('reads the snake_case observed state too', () => {
    const snap = captureOptimisticFactorEdit('fac_a', 1, { observed_state: { value: 0.2 } })!
    expect((snap.prevObservedState as Record<string, unknown>).value).toBe(0.2)
  })
})
