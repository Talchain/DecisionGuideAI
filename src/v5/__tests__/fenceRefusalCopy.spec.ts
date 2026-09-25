/**
 * resolveFenceRefusalCopy — the fail-closed fallback, pinned (#559 review
 * amendment 1).
 *
 * The safety core of the fence-copy fix is the fallback direction: a fence
 * category this table does not know must resolve to the GENERIC fence copy
 * (honest "nothing changed"), NEVER to null — null would fall through to
 * `resolveFailureBaseCopy` and silently restore the false staleness banner
 * for exactly the future verdict the prefix gate exists to protect. Before
 * this spec, a `FENCE_REFUSAL_COPY[category] ?? null` mutant survived the
 * entire suite (the live-chain spec only exercises known verdicts); the
 * three assertions below make that mutant RED.
 */

import { describe, it, expect } from 'vitest'
import type { BoundaryError } from '@talchain/schemas/boundary'
import { fenceRefusalCopyForCategory, resolveFenceRefusalCopy } from '../failureTypeRetryability'

function boundary409(details: Record<string, unknown>): BoundaryError {
  return {
    error: 'GRAPH_DIVERGED',
    boundary: 'B1',
    direction: 'egress',
    validator: 'turn_commit',
    details,
    request_id: 'req-fence-unit',
    retryable: false,
  } as BoundaryError
}

const GENERIC_FENCE_COPY =
  "That change couldn't be saved, so nothing in your decision changed. Try it again in a moment."

describe('resolveFenceRefusalCopy — fail-closed fallback (never the staleness banner)', () => {
  it('turn_fence_unavailable (real verdict, no dedicated copy) → the generic fence copy', () => {
    const copy = resolveFenceRefusalCopy(
      boundary409({
        phase: 'commit',
        fence_verdict: 'unavailable',
        conflict_category: 'turn_fence_unavailable',
        recovery_action: 'retry_later',
      }),
    )
    expect(copy).toBe(GENERIC_FENCE_COPY)
  })

  it('an UNKNOWN future turn_fence_ verdict → the generic fence copy, never null', () => {
    const copy = resolveFenceRefusalCopy(
      boundary409({
        phase: 'commit',
        fence_verdict: 'quarantined',
        conflict_category: 'turn_fence_quarantined',
        recovery_action: 'retry_later',
      }),
    )
    // The load-bearing half: null here would fall through to the canonical
    // staleness banner for a write refusal.
    expect(copy).not.toBeNull()
    expect(copy).toBe(GENERIC_FENCE_COPY)
  })

  it('absent or non-string conflict_category → null (non-fence errors keep canonical resolution)', () => {
    expect(resolveFenceRefusalCopy(boundary409({ phase: 'commit' }))).toBeNull()
    expect(
      resolveFenceRefusalCopy(boundary409({ phase: 'commit', conflict_category: 42 })),
    ).toBeNull()
    expect(
      resolveFenceRefusalCopy(
        boundary409({ phase: 'commit', conflict_category: 'analysis_affecting_conflict' }),
      ),
    ).toBeNull()
    expect(resolveFenceRefusalCopy(undefined)).toBeNull()
  })
})

/**
 * ⭐ ONE SOURCE OF THE FENCE SENTENCE, READ FROM A BARE CATEGORY.
 *
 * The optimistic writers (factor value edit, structural delete/rename/add) hold
 * `SystemEventSendError.conflictCategory`, never the envelope. Now that CEE
 * #1868 (`013fae8d`) answers `turn_fence_superseded` / `turn_fence_stopped` on
 * the edit path with a no-write 409, those writers REVERT on them and must say
 * the fence's own cause — so they read the SAME map `resolveFenceRefusalCopy`
 * reads, through this helper, rather than a second copy of the sentences.
 *
 * Bound by IDENTITY: the exact sentence, not a fragment another string could
 * satisfy.
 */
const STOPPED_FENCE_COPY =
  "That change wasn't saved because this turn was stopped. Nothing in your decision changed. Send the change again if you still want it."
const SUPERSEDED_FENCE_COPY =
  "That change wasn't saved because a newer change to this decision got in first. Nothing was overwritten. Check the latest state, then make the edit again if it's still needed."

describe('fenceRefusalCopyForCategory — the per-verdict sentence from a bare category', () => {
  it('turn_fence_stopped → the stop sentence, exactly', () => {
    expect(fenceRefusalCopyForCategory('turn_fence_stopped')).toBe(STOPPED_FENCE_COPY)
  })

  it('turn_fence_superseded → the newer-change sentence, exactly', () => {
    expect(fenceRefusalCopyForCategory('turn_fence_superseded')).toBe(SUPERSEDED_FENCE_COPY)
  })

  it('an unknown fence verdict → the generic fence copy, never null (same fail-closed rule)', () => {
    expect(fenceRefusalCopyForCategory('turn_fence_quarantined')).toBe(GENERIC_FENCE_COPY)
    expect(fenceRefusalCopyForCategory('turn_fence_unclaimed')).toBe(GENERIC_FENCE_COPY)
  })

  it('a non-fence, absent or empty category → null, so the writer keeps its own copy', () => {
    expect(fenceRefusalCopyForCategory('BASE_HASH_DIVERGED')).toBeNull()
    expect(fenceRefusalCopyForCategory('rpc_cas_conflict')).toBeNull()
    expect(fenceRefusalCopyForCategory('stale_base_graph_hash')).toBeNull()
    expect(fenceRefusalCopyForCategory('')).toBeNull()
    expect(fenceRefusalCopyForCategory(undefined)).toBeNull()
    expect(fenceRefusalCopyForCategory(null)).toBeNull()
  })

  it.each(['turn_fence_stopped', 'turn_fence_superseded', 'turn_fence_unclaimed', 'turn_fence_quarantined', 'BASE_HASH_DIVERGED'])(
    'the envelope reader agrees with the category reader for %s — one map, not two',
    category => {
      expect(resolveFenceRefusalCopy(boundary409({ phase: 'commit', conflict_category: category }))).toBe(
        fenceRefusalCopyForCategory(category),
      )
    },
  )
})
