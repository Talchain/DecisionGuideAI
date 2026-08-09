/**
 * ROADMAP 2.1003 / audit finding F4 — "fresh analysis becomes unknown on
 * reload".
 *
 * RED-first. At pristine `538677ff`, `deriveRestoredFreshnessAttestation` and
 * `resolveRestoredFreshnessUpdate` do not exist.
 *
 * MEASURED ON DEPLOYED STAGING, 2026-08-09: before reload the rerun was
 * `fresh` / `graph_hash_match` on graph hash `b8a38343926af945`. After reload
 * the SAME graph and the SAME result read "Cannot confirm whether this
 * analysis is current." The stored `ceeAnalysisReady` already contained
 * MATCHING graph hashes; boot restored readiness and never re-ingested the
 * attestation.
 */
import { describe, it, expect } from 'vitest'

import {
  deriveRestoredFreshnessAttestation,
  resolveRestoredFreshnessUpdate,
  RESTORED_ATTESTATION_HASHES_ALIGNED,
} from '../analysisFreshness'

const HYDRATED = { freshness: 'unknown' as const, freshnessReason: 'hydrated_without_capture' }

const ALIGNED = {
  freshness: 'fresh',
  freshness_reason: 'graph_hash_match',
  graph_hash_at_run: 'b8a38343926af945',
  current_graph_hash: 'b8a38343926af945',
  computed_at: '2026-08-09T12:00:00.000Z',
}

describe('deriveRestoredFreshnessAttestation — fail-closed by construction', () => {
  it('⭐ THE MEASURED CASE: aligned hashes + stated fresh => a fresh verdict', () => {
    const out = deriveRestoredFreshnessAttestation(ALIGNED)
    expect(out?.freshness).toBe('fresh')
    expect(out?.graphHashAtRun).toBe('b8a38343926af945')
    expect(out?.currentGraphHash).toBe('b8a38343926af945')
  })

  it('stamps its own provenance — a client re-derivation is NOT CEE stating it', () => {
    // A later reader must be able to tell "CEE said graph_hash_match on this
    // turn" from "we reconstructed this from stored bytes at boot".
    expect(deriveRestoredFreshnessAttestation(ALIGNED)?.freshnessReason)
      .toBe(RESTORED_ATTESTATION_HASHES_ALIGNED)
    expect(deriveRestoredFreshnessAttestation(ALIGNED)?.freshnessReason)
      .not.toBe('graph_hash_match')
  })

  it('MISMATCHED hashes stay unknown — the audit\'s explicit requirement', () => {
    expect(deriveRestoredFreshnessAttestation({ ...ALIGNED, current_graph_hash: '3346784355b3fc7b' }))
      .toBeNull()
  })

  it('never upgrades a stored stale or unknown verdict', () => {
    expect(deriveRestoredFreshnessAttestation({ ...ALIGNED, freshness: 'stale' })).toBeNull()
    expect(deriveRestoredFreshnessAttestation({ ...ALIGNED, freshness: 'unknown' })).toBeNull()
    expect(deriveRestoredFreshnessAttestation({ ...ALIGNED, freshness: 'none' })).toBeNull()
  })

  it('NEVER absence -> fresh: a missing or empty hash stays unknown', () => {
    const { graph_hash_at_run: _a, ...noAtRun } = ALIGNED
    const { current_graph_hash: _b, ...noCurrent } = ALIGNED
    expect(deriveRestoredFreshnessAttestation(noAtRun)).toBeNull()
    expect(deriveRestoredFreshnessAttestation(noCurrent)).toBeNull()
    expect(deriveRestoredFreshnessAttestation({ ...ALIGNED, graph_hash_at_run: '', current_graph_hash: '' }))
      .toBeNull()
    expect(deriveRestoredFreshnessAttestation({ options: [], goal_node_id: 'g' })).toBeNull()
    expect(deriveRestoredFreshnessAttestation(null)).toBeNull()
    expect(deriveRestoredFreshnessAttestation(undefined)).toBeNull()
  })
})

describe('resolveRestoredFreshnessUpdate — only ever unknown -> fresh', () => {
  it('⭐ upgrades the hydration marker when the attestation validates', () => {
    expect(resolveRestoredFreshnessUpdate(HYDRATED, false, ALIGNED)?.freshness).toBe('fresh')
  })

  it('leaves the hydration marker alone when the hashes disagree', () => {
    expect(
      resolveRestoredFreshnessUpdate(HYDRATED, false, { ...ALIGNED, current_graph_hash: '3346784355b3fc7b' }),
    ).toBeNull()
  })

  it('NEVER overwrites a LIVE CEE verdict — only the hydration marker', () => {
    // The discriminating half: same valid attestation, different starting
    // state. If the guard keyed on anything looser than the marker, this
    // would clobber a verdict CEE stated on this session's turn.
    expect(
      resolveRestoredFreshnessUpdate(
        { freshness: 'stale', freshnessReason: 'graph_hash_diverged' },
        false,
        ALIGNED,
      ),
    ).toBeNull()
    expect(
      resolveRestoredFreshnessUpdate(
        { freshness: 'fresh', freshnessReason: 'graph_hash_match' },
        false,
        ALIGNED,
      ),
    ).toBeNull()
    expect(resolveRestoredFreshnessUpdate(null, false, ALIGNED)).toBeNull()
  })

  it('NEVER upgrades when the user has edited since (dirty overlay set)', () => {
    expect(resolveRestoredFreshnessUpdate(HYDRATED, true, ALIGNED)).toBeNull()
  })

  it('is a no-op on a null/garbage payload', () => {
    expect(resolveRestoredFreshnessUpdate(HYDRATED, false, null)).toBeNull()
    expect(resolveRestoredFreshnessUpdate(HYDRATED, false, 'nonsense')).toBeNull()
  })
})
