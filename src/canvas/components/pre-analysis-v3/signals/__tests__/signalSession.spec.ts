import { describe, it, expect, beforeEach } from 'vitest'
import { deriveSignalViews } from '../deriveSignalViews'
import { useSignalSessionStore } from '../signalSessionStore'
import type { SignalDetectionInput } from '../registry'
import type {
  StructuralAbsence,
  StructuralAbsenceKind,
} from '../../selectors/computeStructuralAbsence'

/**
 * A `StructuralAbsence` fixture whose `actionTargetIds` stays inside the
 * SELECTOR'S OWN OUTPUT DOMAIN (CLAUDE.md trap 16-inverse: a fixture the
 * producer could never emit proves nothing, and a self-authored one silently
 * encodes the author's model of the producer instead of the producer).
 *
 * Derived from `computeStructuralAbsence`:
 *   shared_mechanism   — ALWAYS at least one id. Its gate is
 *                        `targetSets.every(s => s.size > 0)` plus an identical-set
 *                        check, so an empty shared set is unreachable.
 *   no_downside        — one or more risk ids on the risk-node limb, and `[]` on
 *                        the negative-edge-only limb. The common case is used
 *                        here; the empty limb is pinned in the selector's own spec.
 *   no_external_factor — ALWAYS `[]`. The absence is of a node CLASS.
 *
 * These specs are about COPY and ORDERING and read no id, so the value only has
 * to be domain-plausible. Typed rather than cast, so the NEXT required field is a
 * type error here instead of being silently absent.
 */
function absence(kind: StructuralAbsenceKind, optionCount: number): StructuralAbsence {
  const actionTargetIds =
    kind === 'shared_mechanism' ? ['shared_1'] : kind === 'no_downside' ? ['risk_1'] : []
  return { kind, optionCount, actionTargetIds }
}


function input(overrides: Partial<SignalDetectionInput> = {}): SignalDetectionInput {
  return {
    goalPresent: true,
    successSet: true,
    optionCount: 2,
    riskCount: 2,
    risksAllOlumi: true,
    aiEstimatedCount: 6,
    topUncalibrated: { id: 'f1', label: 'Tech lead impact' },
    isSavedExample: false,
    narrowFramingDetail: null,
    biasFindingExplanation: null,
    structuralAbsence: null,
    optionDifferentiation: null,
    ...overrides,
  }
}

describe('deriveSignalViews — lifecycle', () => {
  beforeEach(() => {
    useSignalSessionStore.getState().reset()
  })

  it('live detections render and report newly seen ids', () => {
    const derived = deriveSignalViews(input(), {})
    expect(derived.sharpen.map(v => v.detection.signal_id)).toEqual([
      'sig_option_breadth',
      'sig_risk_count',
      'sig_estimates',
    ])
    expect(derived.sharpen.every(v => v.status === 'live')).toBe(true)
    expect(derived.newlySeen).toEqual(['sig_option_breadth', 'sig_risk_count', 'sig_estimates'])
  })

  it('a seen signal whose detection clears becomes a quiet confirmation, keeping its shape', () => {
    const seen = { sig_estimates: { firstSeenAt: 1 } }
    const derived = deriveSignalViews(input({ topUncalibrated: null }), seen)
    const resolved = derived.sharpen.find(v => v.detection.signal_id === 'sig_estimates')!
    expect(resolved.status).toBe('resolved')
    expect(resolved.detection.copy.lead).toBe('Top estimates checked.')
    expect(resolved.detection.entityKind).toBe('factor')
    expect(resolved.detection.action).toBeUndefined()
  })

  it('a never-seen signal that does not detect is absent (no phantom confirmations)', () => {
    const derived = deriveSignalViews(input({ topUncalibrated: null }), {})
    expect(derived.sharpen.map(v => v.detection.signal_id)).not.toContain('sig_estimates')
  })

  it('returns the full priority-ordered list; CEE rows hold their slot, never jump the queue', () => {
    const derived = deriveSignalViews(
      input({ biasFindingExplanation: 'A reflective check.' }),
      {},
    )
    // The visible cap lives in SharpenSection (SHARPEN_DEFAULT_VISIBLE); the
    // deriver orders deterministically with CEE enrichment last.
    expect(derived.sharpen.map(v => v.detection.signal_id)).toEqual([
      'sig_option_breadth',
      'sig_risk_count',
      'sig_estimates',
      'sig_cee_bias',
    ])
  })

  it('puts a live structural gap ahead of lower-value count signals', () => {
    const derived = deriveSignalViews(
      input({ structuralAbsence: absence('shared_mechanism', 2) }),
      {},
    )
    expect(derived.sharpen.map(v => v.detection.signal_id)).toEqual([
      'sig_structural_absence',
      'sig_option_breadth',
      'sig_risk_count',
      'sig_estimates',
    ])
  })

  it('ordering is stable when a deterministic signal clears', () => {
    const derived = deriveSignalViews(
      input({ optionCount: 3, biasFindingExplanation: 'A reflective check.' }),
      {},
    )
    expect(derived.sharpen.map(v => v.detection.signal_id)).toEqual([
      'sig_risk_count',
      'sig_estimates',
      'sig_cee_bias',
    ])
  })

  it('live rows come before resolved confirmations (a quiet check never displaces an actionable signal)', () => {
    // option_breadth was seen and has resolved (3 options); risk + estimates are live.
    const seen = { sig_option_breadth: { firstSeenAt: 1 } }
    const derived = deriveSignalViews(input({ optionCount: 3 }), seen)
    expect(derived.sharpen.map(v => `${v.detection.signal_id}:${v.status}`)).toEqual([
      'sig_risk_count:live',
      'sig_estimates:live',
      'sig_option_breadth:resolved',
    ])
  })

  it('hero-surface signals never occupy sharpen rows', () => {
    const derived = deriveSignalViews(input({ goalPresent: false, successSet: false }), {})
    expect(derived.hero.map(v => v.detection.signal_id)).toEqual(['sig_goal_missing'])
    expect(derived.sharpen.map(v => v.detection.signal_id)).not.toContain('sig_goal_missing')
  })

  it('a vanished CEE bias row leaves no confirmation behind', () => {
    const seen = { sig_cee_bias: { firstSeenAt: 1 } }
    const derived = deriveSignalViews(input(), seen)
    expect(derived.sharpen.map(v => v.detection.signal_id)).not.toContain('sig_cee_bias')
  })
})

describe('signalSessionStore — ledger', () => {
  beforeEach(() => {
    useSignalSessionStore.getState().reset()
  })

  it('markSeen records first-seen once and ignores repeats', () => {
    const store = useSignalSessionStore
    store.getState().markSeen(['sig_estimates'], 100)
    store.getState().markSeen(['sig_estimates'], 200)
    expect(store.getState().seen.sig_estimates).toEqual({ firstSeenAt: 100 })
  })

  it('markSeen with no unseen ids does not change state identity', () => {
    const store = useSignalSessionStore
    store.getState().markSeen(['sig_estimates'], 100)
    const before = store.getState().seen
    store.getState().markSeen(['sig_estimates'], 300)
    expect(store.getState().seen).toBe(before)
  })

  it('reset clears the ledger (scenario change semantics)', () => {
    const store = useSignalSessionStore
    store.getState().markSeen(['sig_estimates', 'sig_risk_count'], 100)
    store.getState().reset()
    expect(store.getState().seen).toEqual({})
  })

  it('ensureScenario clears the ledger on a scenario mismatch, keeps it on a match', () => {
    const store = useSignalSessionStore
    store.getState().ensureScenario('scenario-a')
    store.getState().markSeen(['sig_estimates'], 100)
    store.getState().ensureScenario('scenario-a')
    expect(store.getState().seen.sig_estimates).toEqual({ firstSeenAt: 100 })
    // A different scenario — even after an unmounted switch — starts clean.
    store.getState().ensureScenario('scenario-b')
    expect(store.getState().seen).toEqual({})
  })
})
