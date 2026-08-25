/**
 * ⚠⚠ F1 — A RESTORED VERDICT MUST NEVER LEAVE THE USER WITH LESS THAN NO VERDICT.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DEFECT, AND WHY THE PREVIOUS SUITE COULD NOT SEE IT
 * ═══════════════════════════════════════════════════════════════════════════
 * `bootVerdictRunGate.spec.ts` defined its oracle as
 *
 *     gateObjects(v) = readinessObjectsToRun(null, selectAnalysisReadinessAuthority(v))
 *
 * which is BYTE-IDENTICAL to the guard it was testing. So it bit when the guard
 * was DELETED (mutant M4 proved that) and could never bite on the guard ASKING
 * THE WRONG QUESTION. A guard agreeing with itself (trap 13b) — the oracle was
 * derived from the implementation instead of from the spec the consumer parses.
 *
 * It was wrong in exactly that way. The guard reads `readiness`; this harm
 * travels via `run_state.kind`, which the guard never reads:
 *
 *   `analysisStateSelector.ts:632-633`  wireKind === 'blocked' → forces
 *                                        ceeAnalysisReadyStatus: 'blocked'
 *                                        ⚠ REGARDLESS of readiness.status
 *   `deriveAnalysisDisplayState.ts:106` EXPLICIT_NOT_READY_STATUSES = every
 *                                        ANALYSIS_READY_STATUS except 'ready'
 *   `:79-81`                             those "MUST override a prior populated
 *                                        report"
 *
 * So a contract-valid payload — `run_state.kind: 'blocked'` with a perfectly
 * READY readiness — passed the old guard, restored, and turned the freshness
 * notice into a not-ready/refusal banner over a model that HAS a report.
 * Strictly LESS information than before the restore existed, on the very
 * surface this slice was written to improve.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE ORACLE HERE IS THE CONSUMER, NOT THE GUARD
 * ═══════════════════════════════════════════════════════════════════════════
 * Every assertion below is made against `composeAnalysisState` — the thing the
 * product actually renders from. That is what makes this suite capable of
 * failing when the guard is correct-but-aimed-wrong, which is the failure the
 * previous one was structurally blind to.
 *
 * ⭐ AND THE ASYMMETRY THAT DECIDES THE REMEDY: staleness is MONOTONE. A stale
 * result cannot become current without a new run, and a new run produces a new
 * verdict — so a restored `complete_stale` cannot be falsified by anything the
 * boot merge does. `blocked` and `refused` assert something about
 * ANALYSABILITY, and the boot merge CAN falsify that: it may supply the very
 * values whose absence CEE was refusing over.
 */

import { describe, it, expect, vi } from 'vitest'
import type { AnalysisStateV1 } from '@talchain/schemas/boundary'
import { ANALYSIS_RUN_STATE_KINDS } from '@talchain/schemas/boundary'

import { applyBootAnalysisVerdict } from '../applyScenarioAnalysisRead'
import { composeAnalysisState } from '../../state/analysisStateSelector'

function v(
  runState: AnalysisStateV1['run_state'],
  readiness: { status: string; blockers: readonly unknown[] },
  over: Partial<AnalysisStateV1> = {},
): AnalysisStateV1 {
  return {
    run_state: runState,
    readiness,
    leader_claim: { permitted: false, withheld_reason: 'separation_unavailable' },
    robustness: {},
    usable_for_prose: false,
    usable_for_chips: false,
    usable_for_followup: false,
    requires_rerun: true,
    blocked_unusable: false,
    contradictions: [],
    ...over,
  } as AnalysisStateV1
}

const READY = { status: 'ready', blockers: [] as readonly unknown[] }

/** THE CONSUMER. A booted canvas that HAS a report — the F1 population. */
function display(analysisState: AnalysisStateV1 | null) {
  return composeAnalysisState({
    analysisState,
    freshness: { freshness: 'unknown', freshnessReason: 'hydrated_without_capture' },
    dirty: false,
    source: 'none',
    resultsStatus: 'complete',
    resultsStartedAt: undefined,
    importHold: false,
    hasReport: true,
    ceeAnalysisReadyStatus: 'ready',
    aiPanelV2On: true,
  } as never)
}

/** Every contract kind, in a payload that VALIDATES and whose readiness is READY. */
function verdictForKind(kind: string): AnalysisStateV1 {
  const at = '2026-08-25T09:00:00.000Z'
  switch (kind) {
    case 'never_run': return v({ kind: 'never_run' } as never, READY)
    case 'running': return v({ kind: 'running', started_at: at } as never, READY)
    case 'blocked':
      return v({ kind: 'blocked', reason_code: 'no_options', blockers: [] } as never, READY, { blocked_unusable: true })
    case 'refused': return v({ kind: 'refused', reason_code: 'declined_by_policy' } as never, READY)
    case 'complete_current': return v({ kind: 'complete_current', computed_at: at } as never, READY)
    case 'complete_stale': return v({ kind: 'complete_stale', computed_at: at, cause: 'graph_changed' } as never, READY)
    case 'unknown_degraded': return v({ kind: 'unknown_degraded', cause: 'store_unreadable' } as never, READY)
    default: throw new Error(`unmapped kind: ${kind}`)
  }
}

function restores(verdict: AnalysisStateV1): boolean {
  return applyBootAnalysisVerdict({
    analysisState: verdict,
    store: { setAnalysisStateV1: vi.fn() },
  }).outcome === 'restored'
}

describe('PRECONDITIONS — the consumer oracle discriminates', () => {
  it('POSITIVE CONTROL — the no-verdict baseline with a report is NOT not_ready', () => {
    const baseline = display(null)
    expect(baseline.displayState.state).not.toBe('not_ready')
    // Named, so a change to the baseline is visible rather than absorbed.
    expect(baseline.authority).toBe('derived')
  })

  it('CONTRAST — a `blocked` verdict DOES drive the consumer to not_ready, whatever its readiness says', () => {
    // Proves the oracle can see the harm at all. This payload has a READY
    // readiness, so the readiness-only guard is blind to it by construction.
    const blockedWithReadyReadiness = verdictForKind('blocked')
    expect(blockedWithReadyReadiness.readiness.status).toBe('ready')
    expect(display(blockedWithReadyReadiness).displayState.state).toBe('not_ready')
  })
})

describe('⭐ F1 — the invariant, over EVERY contract kind', () => {
  it('⭐⭐ nothing this applier restores may drive the consumer to `not_ready`', () => {
    const baseline = display(null).displayState.state
    const offenders: string[] = []
    let restoredCount = 0

    for (const kind of ANALYSIS_RUN_STATE_KINDS) {
      const verdict = verdictForKind(kind)
      if (!restores(verdict)) continue
      restoredCount += 1
      const after = display(verdict).displayState.state
      if (after === 'not_ready' && baseline !== 'not_ready') offenders.push(kind)
    }

    expect(offenders).toEqual([])
    // ...and the loop is not vacuous: declining EVERYTHING would satisfy the
    // invariant perfectly. A guard too strict to fail is the same defect.
    expect(restoredCount).toBeGreaterThan(0)
  })

  it('⭐ a restored verdict never REMOVES the CTA the user had without it', () => {
    // The reviewer's measured delta included `cta: null`. Losing the action is
    // the same class of harm as the false block, one surface down.
    const baselineCta = display(null).displayState.cta
    for (const kind of ANALYSIS_RUN_STATE_KINDS) {
      const verdict = verdictForKind(kind)
      if (!restores(verdict)) continue
      if (baselineCta !== null) {
        expect({ kind, cta: display(verdict).displayState.cta === null }).toEqual({ kind, cta: false })
      }
    }
  })
})

describe('⭐ BOTH DIRECTIONS — the narrowing must not cost the stated win', () => {
  it('⭐⭐ `complete_stale` still restores and still upgrades the notice', () => {
    const stale = verdictForKind('complete_stale')
    expect(restores(stale)).toBe(true)
    const before = display(null)
    const after = display(stale)
    expect(before.semantic).toBe('cannot_confirm')
    expect(after.semantic).toBe('changed')
    expect(after.authority).toBe('wire')
    expect(after.displayState.state).not.toBe('not_ready')
  })

  it('⭐ and it carries CEE`s CAUSE — a reason the local derivation cannot produce', () => {
    // The understatement worth pinning: the win is not merely a sharper label.
    const stale = verdictForKind('complete_stale')
    expect(restores(stale)).toBe(true)
    const runState = stale.run_state as { kind: string; cause?: string }
    expect(runState.kind).toBe('complete_stale')
    expect(runState.cause).toBe('graph_changed')
    // The derived branch has no such field to offer.
    expect(display(null).wire).toBeNull()
    expect(display(stale).wire?.run_state).toEqual(stale.run_state)
  })

  it('`blocked` and `refused` are DECLINED — they assert analysability the boot merge can falsify', () => {
    // Staleness is monotone and cannot be falsified between the verdict and the
    // boot; analysability is not, because the merge may supply the very values
    // CEE was refusing over. That asymmetry is the whole remedy.
    expect(restores(verdictForKind('blocked'))).toBe(false)
    expect(restores(verdictForKind('refused'))).toBe(false)
  })
})
