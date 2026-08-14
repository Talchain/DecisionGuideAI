/**
 * ROADMAP 2.1163 / golden-journey EXT-2 — the analysis-refusal notice slice.
 *
 * CEE PR #942 puts a TYPED analysis refusal on the wire:
 *
 *   analysis_ready: { status: 'blocked', blocked_reason: <specific>, options: [],
 *                     goal_node_id: '', freshness, freshness_reason, computed_at }
 *
 * `blocked_reason` had ZERO readers repo-wide. An honest refusal nobody renders
 * is indistinguishable from a silent failure, so this slice is the reader.
 *
 * ⚠ THE LOAD-BEARING DISTINCTION — TWO `status: 'blocked'` CARRIERS EXIST, and
 * only one of them is a refusal. Derived at the CEE bytes (PR #942 head
 * 2ca6c079), not inferred:
 *
 *   1. REFUSAL   `buildAnalysisRefusalReadiness()`
 *                src/orchestrator/tools/analysis-ready-helper.ts:400-409
 *                -> ALWAYS carries a non-empty `blocked_reason`.
 *   2. LEGACY    `synthesiseFreshnessOnlyAnalysisReady()`
 *                src/orchestrator-v5/compose/analysis-ready-emit.ts:59-61
 *                -> `{ status:'blocked', goal_node_id:'', options:[], bias_findings:[] }`
 *                   and NO `blocked_reason`. It is a freshness carrier emitted on
 *                   legacy/unparseable RELOADS — it says nothing about a refusal.
 *
 * Treating (2) as a refusal would fabricate "this analysis did not run" on every
 * legacy reload. The discriminator is therefore the PRESENCE of a non-empty
 * `blocked_reason`, never `status` alone. Carrier (2) is already pinned by
 * `src/v5/__tests__/applyV5State.blockedAnalysisReady.spec.tsx`.
 *
 * The readiness slice's rejection of this carrier is DELIBERATE and unchanged
 * (applyV5State normaliseV5AnalysisReady rejects empty goal_node_id/options);
 * this slice is a separate, session-local field, never persisted.
 */

import { describe, it, expect } from 'vitest'
import {
  deriveAnalysisRefusalNoticeUpdate,
  describeAnalysisRefusalReason,
  ANALYSIS_REFUSAL_REASON_COPY,
  type AnalysisRefusalNoticeUpdate,
} from '../analysisRefusalNotice'

/** Exact CEE refusal wire shape (buildAnalysisRefusalReadiness + attachComputedAt). */
function refusalPayload(blockedReason: string) {
  return {
    status: 'blocked',
    blocked_reason: blockedReason,
    options: [] as unknown[],
    goal_node_id: '',
    freshness: 'stale',
    freshness_reason: 'graph_changed_since_run',
    computed_at: '2026-08-14T10:00:00.000Z',
  }
}

/** Exact CEE legacy freshness-only carrier (synthesiseFreshnessOnlyAnalysisReady). */
const LEGACY_FRESHNESS_ONLY_CARRIER = {
  status: 'blocked',
  goal_node_id: '',
  options: [] as unknown[],
  bias_findings: [] as unknown[],
  computed_at: '2026-07-07T10:00:00.000Z',
  freshness: 'unknown',
  freshness_reason: 'legacy_fact_missing_hash',
}

function responseWith(analysisReady: unknown, blocks: unknown[] = []) {
  return { analysis_ready: analysisReady, blocks }
}

describe('deriveAnalysisRefusalNoticeUpdate — the two blocked carriers', () => {
  it('SETS a notice for the typed refusal carrier (blocked + non-empty blocked_reason)', () => {
    const update = deriveAnalysisRefusalNoticeUpdate(
      responseWith(refusalPayload('mixed_scale_unresolved')),
    )

    expect(update).toEqual<AnalysisRefusalNoticeUpdate>({
      kind: 'set',
      notice: {
        blockedReason: 'mixed_scale_unresolved',
        computedAt: '2026-08-14T10:00:00.000Z',
      },
    })
  })

  it('RETAINS (never sets) for the LEGACY freshness-only blocked carrier — no blocked_reason', () => {
    // The opposite-direction twin. A legacy reload is not an analysis refusal;
    // claiming "this analysis did not run" here would be a fabrication.
    const update = deriveAnalysisRefusalNoticeUpdate(
      responseWith(LEGACY_FRESHNESS_ONLY_CARRIER),
    )

    expect(update.kind).toBe('retain')
  })

  it('RETAINS for a blocked carrier whose blocked_reason is whitespace-only or non-string', () => {
    expect(deriveAnalysisRefusalNoticeUpdate(
      responseWith({ ...refusalPayload('x'), blocked_reason: '   ' }),
    ).kind).toBe('retain')
    expect(deriveAnalysisRefusalNoticeUpdate(
      responseWith({ ...refusalPayload('x'), blocked_reason: 42 }),
    ).kind).toBe('retain')
  })

  it('CLEARS on an accepted (non-blocked) analysis_ready — CEE stated readiness', () => {
    const update = deriveAnalysisRefusalNoticeUpdate(
      responseWith({
        status: 'ready',
        goal_node_id: 'goal_1',
        options: [{ id: 'opt_1', interventions: {} }],
        computed_at: '2026-08-14T11:00:00.000Z',
      }),
    )

    expect(update.kind).toBe('clear')
  })

  it('CLEARS on a successful analysis_result block with no analysis_ready key', () => {
    const update = deriveAnalysisRefusalNoticeUpdate(
      responseWith(undefined, [{ type: 'analysis_result' }]),
    )

    expect(update.kind).toBe('clear')
  })

  it('RETAINS on an ordinary conversational turn (no analysis_ready, no analysis_result)', () => {
    // Retention is what makes the notice survive the turns AFTER the refusal.
    expect(deriveAnalysisRefusalNoticeUpdate(
      responseWith(undefined, [{ type: 'coaching' }]),
    ).kind).toBe('retain')
  })

  it('RETAINS on malformed input rather than clearing or fabricating', () => {
    expect(deriveAnalysisRefusalNoticeUpdate(null).kind).toBe('retain')
    expect(deriveAnalysisRefusalNoticeUpdate(undefined).kind).toBe('retain')
    expect(deriveAnalysisRefusalNoticeUpdate('nonsense').kind).toBe('retain')
    expect(deriveAnalysisRefusalNoticeUpdate(responseWith('not-an-object')).kind).toBe('retain')
  })

  it('carries computedAt as null when CEE omitted it (never fabricates a timestamp)', () => {
    const payload = refusalPayload('analysis_engine_busy') as Record<string, unknown>
    delete payload.computed_at
    const update = deriveAnalysisRefusalNoticeUpdate(responseWith(payload))

    expect(update).toEqual<AnalysisRefusalNoticeUpdate>({
      kind: 'set',
      notice: { blockedReason: 'analysis_engine_busy', computedAt: null },
    })
  })
})

describe('describeAnalysisRefusalReason — mapped vocabulary derived from the CEE producer', () => {
  /**
   * Vocabulary derived at the CEE bytes, NOT from our own reading (trap 13c):
   *   blockedReasonForHandlerFailure() (handler-errors.ts:196-202) returns
   *   `details.reason_code` when present, else `cause_kind`.
   * Scope is `run_analysis` ONLY (ANALYSE_HANDLER_ID, handler-errors.ts:173).
   */
  const CAUSE_KINDS_REACHABLE_FROM_RUN_ANALYSIS = [
    // (cause_kinds run_analysis throws) INTERSECT RECOVERABLE_HANDLER_CAUSES
    'args_validation_failed',
    'analysis_not_ready',
    'options_not_configured',
    'analysis_engine_busy',
    'analysis_blocked',
  ] as const

  const REASON_CODES_REACHABLE_FROM_RUN_ANALYSIS = [
    // scale block (plot-intervention-scale.ts:808-833, run-analysis.ts:541/612)
    'mixed_scale_unresolved',
    'baseline_scale_unresolved',
    'scale_postcondition_violated',
    // ReadinessReasonCode (analysis-ready-core.ts:53-66) via run-analysis.ts:313
    'NO_CAP_UNRECOVERABLE',
    'UNIT_MISMATCH',
    'OPTION_INTERVENTION_UNRESOLVABLE',
    'OPTIONS_NOT_CONFIGURED',
    'SCHEMA_INVALID',
    'NO_GRAPH',
    'INTERNAL_ERROR',
    // StructuralViolationCode (graph-structure-validator.ts:22-32)
    'ORPHAN_NODE',
    'NO_PATH_TO_GOAL',
    'CYCLE_DETECTED',
    'NODE_LIMIT_EXCEEDED',
    'EDGE_LIMIT_EXCEEDED',
    'NO_GOAL',
    'NO_DECISION',
    'FEWER_THAN_TWO_OPTIONS',
    'OPTION_NO_FACTOR_EDGES',
    'OPTION_NOT_LINKED_TO_DECISION',
  ] as const

  it.each(CAUSE_KINDS_REACHABLE_FROM_RUN_ANALYSIS)(
    'maps the reachable cause_kind %s to specific copy',
    (code) => {
      const copy = describeAnalysisRefusalReason(code)
      expect(copy).toBeTypeOf('string')
      expect((copy as string).length).toBeGreaterThan(0)
    },
  )

  it.each(REASON_CODES_REACHABLE_FROM_RUN_ANALYSIS)(
    'maps the reachable reason_code %s to specific copy',
    (code) => {
      const copy = describeAnalysisRefusalReason(code)
      expect(copy).toBeTypeOf('string')
      expect((copy as string).length).toBeGreaterThan(0)
    },
  )

  /**
   * ⚠ CORRECTED PREMISE, and the correction is load-bearing.
   *
   * The lane brief listed `parameter_invalid_at_execute` as an example
   * blocked_reason. It is in RECOVERABLE_HANDLER_CAUSES but `run_analysis`
   * NEVER throws it — the D1 mutation handlers do (set_factor_value /
   * add_constraint / adjust_edge_strength). CEE turn-executor.ts:8684-8697
   * documents this BY NAME as the defect an adversarial review caught: a
   * failed CONSTRAINT EDIT emitting `blocked_reason:
   * 'parameter_invalid_at_execute'` was "a false claim that the ANALYSIS is
   * blocked", and the ANALYSE_HANDLER_ID gate was added to remove it.
   *
   * Mapping these to specific ANALYSIS copy here would re-assert exactly the
   * claim #942 deleted, one layer up. They stay UNMAPPED on purpose.
   */
  const D1_CAUSES_NOT_REACHABLE_ON_THIS_CARRIER = [
    'parameter_invalid_at_execute',
    'entity_not_found_in_graph',
    'entity_kind_mismatch_at_execute',
    'precondition_unmet_at_execute',
  ] as const

  it.each(D1_CAUSES_NOT_REACHABLE_ON_THIS_CARRIER)(
    'leaves the D1 mutation cause %s UNMAPPED (never fabricates analysis-specific copy)',
    (code) => {
      expect(describeAnalysisRefusalReason(code)).toBeNull()
      expect(ANALYSIS_REFUSAL_REASON_COPY).not.toHaveProperty(code)
    },
  )

  it('returns null for an unknown code rather than a fabricated specific', () => {
    expect(describeAnalysisRefusalReason('a_brand_new_cee_code')).toBeNull()
    expect(describeAnalysisRefusalReason('')).toBeNull()
  })

  it('matches producer tokens EXACTLY — no case-folding onto a specific meaning', () => {
    // The producer emits both SCREAMING_SNAKE (ReadinessReasonCode) and
    // lower_snake (cause_kind / scale reason_code). Case-folding would let an
    // unknown variant inherit a specific sentence it was never entitled to.
    expect(describeAnalysisRefusalReason('NO_GRAPH')).toBeTypeOf('string')
    expect(describeAnalysisRefusalReason('no_graph')).toBeNull()
    expect(describeAnalysisRefusalReason('MIXED_SCALE_UNRESOLVED')).toBeNull()
    expect(describeAnalysisRefusalReason('mixed_scale_unresolved')).toBeTypeOf('string')
  })

  it('never instructs a control this surface does not render', () => {
    // #684 review, D2: copy may name a LOCATION or a model fact, never a button
    // the notice does not offer. CEE owns the recovery chip, in the chat.
    for (const copy of Object.values(ANALYSIS_REFUSAL_REASON_COPY)) {
      expect(copy).not.toMatch(/\bclick\b|\bpress\b|\btap\b|\bbutton\b/i)
    }
  })

  it('avoids amber "proceed with care" vocabulary (row 2.1127 is correcting that family)', () => {
    for (const copy of Object.values(ANALYSIS_REFUSAL_REASON_COPY)) {
      expect(copy).not.toMatch(/proceed with care|use caution|treat .* with care/i)
    }
  })
})
