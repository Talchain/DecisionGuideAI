/**
 * `analysis_ready.status` answers "may this run PROCEED?" — it can NEVER
 * answer "did a run FAIL?".
 *
 * WHY THIS SPEC EXISTS (real user bundle, scenario 48a1ce84, 2026-09-21T11:47Z).
 * One debug bundle carried, simultaneously:
 *
 *   pipeline.status              = "success"
 *   pipeline.v5_pipeline_status  = "analysis_failed"     ← the lie
 *   analysis_state.run_state     = { kind: "never_run" }
 *   readiness.status             = "needs_user_input"
 *   freshness                    = "none"
 *   freshness_reason             = "no_successful_run_analysis_fact"
 *
 * No analysis was ever ATTEMPTED — it was correctly withheld pending user
 * input. The user was nonetheless told the model was "unhealthy".
 *
 * ROOT CAUSE — branch 5b of `derivePipelineStatus` read
 * `readyStatus !== undefined && readyStatus !== 'ready'` and returned
 * `analysis_failed`. That predicate treats "not ready to start" as
 * "started and failed". They are different questions under one test —
 * and `CEEAnalysisReady` says so itself, in the docblock of the very
 * field being read: readiness is "a different question from whether the
 * run may PROCEED".
 *
 * THE DOMAIN, from the producer's own exported constant rather than our
 * reading of what the names ought to mean (`adapters/cee/types.ts`):
 *
 *   ready              — may run                      → not this branch
 *   needs_user_mapping — structural issues            → precondition, nothing ran
 *   needs_encoding     — categorical values to encode → precondition, nothing ran
 *   needs_user_input   — user action required         → precondition, nothing ran
 *   blocked            — CEE refused, run PREVENTED   → refusal, nothing ran
 *   unknown            — CEE stated no readiness      → an ABSENCE, not a verdict
 *
 * NOT ONE of the six describes an analysis that ran and failed. So branch
 * 5b must never yield `analysis_failed` for ANY of them. The honest cell
 * is `analysis_not_run` — the same one branch 5-WIRE already returns for
 * the wire kinds `never_run` / `blocked` / `unknown_degraded`, for exactly
 * this reason, in this same file. Nothing is minted here.
 *
 * The domain is DERIVED from `ANALYSIS_READY_STATUSES` and not re-spelled,
 * so a status added to the contract later cannot slip past this guard by
 * being absent from a hand-maintained list.
 */

import { describe, it, expect } from 'vitest'

import { derivePipelineStatus } from '../derivePipelineStatus'
import type { DerivePipelineStatusInputs } from '../derivePipelineStatus'
import {
  ANALYSIS_READY_STATUSES,
  ANALYSIS_READY_STATUS_UNSUPPLIED,
} from '../../adapters/cee/types'
import type { CEEAnalysisReady } from '../../adapters/cee/types'

/** A 200 trace that landed — so branches 1-4 cannot fire. */
function landedTrace(
  overrides?: Partial<DerivePipelineStatusInputs['trace']>,
): DerivePipelineStatusInputs['trace'] {
  return {
    status: 200,
    completed: true,
    error: undefined,
    responseHash: 'hash',
    service: 'cee',
    serviceBuild: 'abc1234',
    ...overrides,
  }
}

function readyWithStatus(status: string): CEEAnalysisReady {
  return {
    options: [],
    goal_node_id: 'g',
    status,
  } as unknown as CEEAnalysisReady
}

/**
 * Every recognised readiness value that is NOT 'ready', derived from the
 * producer's constant plus the unsupplied sentinel.
 */
const NON_READY_STATUSES: readonly string[] = [
  ...ANALYSIS_READY_STATUSES.filter((s) => s !== 'ready'),
  ANALYSIS_READY_STATUS_UNSUPPLIED,
]

describe('derivePipelineStatus — a run that was never attempted is not a failure', () => {
  // PRECONDITION PIN (trap 13b): if the derived domain ever stops containing
  // the statuses this guard is about, the it.each below would silently shrink
  // to nothing and still pass. Assert the domain itself.
  it('derives a non-ready domain that contains the reported status and the absence sentinel', () => {
    expect(NON_READY_STATUSES.length).toBeGreaterThanOrEqual(5)
    expect(NON_READY_STATUSES).toContain('needs_user_input')
    expect(NON_READY_STATUSES).toContain('needs_user_mapping')
    expect(NON_READY_STATUSES).toContain('needs_encoding')
    expect(NON_READY_STATUSES).toContain('blocked')
    expect(NON_READY_STATUSES).toContain('unknown')
    expect(NON_READY_STATUSES).not.toContain('ready')
  })

  it.each(NON_READY_STATUSES)(
    '200 + analysis turn + readiness "%s" → analysis_not_run, NEVER analysis_failed',
    (status) => {
      const result = derivePipelineStatus({
        trace: landedTrace(),
        isAnalysisTurn: true,
        ceeAnalysisReady: readyWithStatus(status),
        recoverableEnvelope: null,
        payloadCaptureDisabled: false,
      })

      // The load-bearing assertion: nothing failed, because nothing ran.
      expect(result).not.toBe('analysis_failed')
      expect(result).toBe('analysis_not_run')
    },
  )

  it('the reported bundle reproduces: needs_user_input + freshness none → analysis_not_run', () => {
    const result = derivePipelineStatus({
      trace: landedTrace(),
      isAnalysisTurn: true,
      ceeAnalysisReady: {
        options: [],
        goal_node_id: 'g',
        status: 'needs_user_input',
        freshness: 'none',
      } as unknown as CEEAnalysisReady,
      recoverableEnvelope: null,
      payloadCaptureDisabled: false,
    })
    expect(result).toBe('analysis_not_run')
  })
})

/**
 * CONTRAST CONTROL — proving the fix closed the lie WITHOUT swallowing the
 * real signal. `analysis_failed` has an honest producer: branch 3, a 4xx
 * carrying a recoverable envelope whose category says an analysis genuinely
 * ran and failed (CEE throws `cause_kind: 'analysis_failed'` from the
 * run-analysis handler after PLoT returns `analysis_status: 'failed'`).
 *
 * If this block ever goes green-by-vacuity the guard above is meaningless:
 * a change that simply deleted `analysis_failed` from the enum would satisfy
 * the first describe and fail this one.
 */
describe('derivePipelineStatus — the honest analysis_failed path is untouched', () => {
  it('4xx + recoverable envelope category analysis_failed → still analysis_failed', () => {
    const result = derivePipelineStatus({
      trace: landedTrace({ status: 422 }),
      isAnalysisTurn: true,
      ceeAnalysisReady: null,
      recoverableEnvelope: { retryable: true, category: 'analysis_failed' },
      payloadCaptureDisabled: false,
    })
    expect(result).toBe('analysis_failed')
  })

  it('4xx + recoverable envelope category plot_timeout → still analysis_failed', () => {
    const result = derivePipelineStatus({
      trace: landedTrace({ status: 422 }),
      isAnalysisTurn: true,
      ceeAnalysisReady: null,
      recoverableEnvelope: { category: 'plot_timeout' },
      payloadCaptureDisabled: false,
    })
    expect(result).toBe('analysis_failed')
  })
})

describe('derivePipelineStatus — ready and absent readiness are unchanged', () => {
  it('200 + analysis turn + readiness ready → ui_render_success', () => {
    const result = derivePipelineStatus({
      trace: landedTrace(),
      isAnalysisTurn: true,
      ceeAnalysisReady: readyWithStatus('ready'),
      recoverableEnvelope: null,
      payloadCaptureDisabled: false,
    })
    expect(result).toBe('ui_render_success')
  })

  it('200 + analysis turn + analysis_ready absent entirely → analysis_not_run (branch 5a)', () => {
    const result = derivePipelineStatus({
      trace: landedTrace(),
      isAnalysisTurn: true,
      ceeAnalysisReady: null,
      recoverableEnvelope: null,
      payloadCaptureDisabled: false,
    })
    expect(result).toBe('analysis_not_run')
  })
})
