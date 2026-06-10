/**
 * Signal registry — every panel coaching item as a typed, lifecycle-tracked
 * signal with a pure detection function (presence/count/structure only).
 *
 * Boundary rules enforced by construction and pinned by tests:
 * - Banned signals (baseline-missing, constraints-missing, assumptions-review,
 *   evidence-weak, right-question-as-claim) do not exist here.
 * - No dead-end intents: actions are field focus, list focus, or prefilled
 *   conversation prompts (no action_type is ever attached).
 * - CEE-sourced text renders verbatim and attributed, only when live in
 *   session (ceeOverride present only when the store carries the signal).
 */

import { SIGNAL_COPY, SPARK_PROMPTS } from '../constants'
import type { PanelSignalId, SignalDetection } from '../types'

export interface SignalDetectionInput {
  goalPresent: boolean
  successSet: boolean
  optionCount: number
  riskCount: number
  risksAllOlumi: boolean
  aiEstimatedCount: number
  topUncalibrated: { id: string; label: string } | null
  /** draftCoaching narrow_framing detail, verbatim — null when not live. */
  narrowFramingDetail: string | null
  /** First analysis_ready bias finding explanation, verbatim — null when not live. */
  biasFindingExplanation: string | null
}

export type SignalSurface = 'hero' | 'sharpen'

export interface SignalDef {
  signal_id: PanelSignalId
  surface: SignalSurface
  /** Entity shape channel — stable per signal, used by resolved rows too. */
  entityKind: SignalDetection['entityKind']
  /**
   * Quiet confirmation line rendered when a seen signal stops detecting.
   * Null for signals with no deterministic resolution (CEE-sourced rows
   * disappear when their source clears, e.g. on a new draft — confirming
   * them would fabricate a resolution that never happened).
   */
  resolvedCopy: string | null
  detect: (input: SignalDetectionInput) => SignalDetection | null
}

/** Priority order is the array order: foundational, options, risks, estimates, reflective. */
export const SIGNAL_REGISTRY: ReadonlyArray<SignalDef> = [
  {
    signal_id: 'sig_goal_missing',
    surface: 'hero',
    entityKind: 'goal',
    resolvedCopy: 'Goal set.',
    detect: input =>
      input.goalPresent
        ? null
        : {
            signal_id: 'sig_goal_missing',
            copy: { lead: SIGNAL_COPY.goalMissing.lead, emphasis: SIGNAL_COPY.goalMissing.emphasis },
            rationale: SIGNAL_COPY.goalMissing.rationale,
            entityKind: 'goal',
            action: { type: 'focus_goal_field' },
            spark: SPARK_PROMPTS.pressureTestFrame,
          },
  },
  {
    signal_id: 'sig_success_missing',
    surface: 'hero',
    entityKind: 'goal',
    resolvedCopy: 'Success measure set.',
    detect: input =>
      !input.goalPresent || input.successSet
        ? null
        : {
            signal_id: 'sig_success_missing',
            copy: {
              lead: SIGNAL_COPY.successMissing.lead,
              emphasis: SIGNAL_COPY.successMissing.emphasis,
            },
            rationale: SIGNAL_COPY.successMissing.rationale,
            entityKind: 'goal',
            action: { type: 'focus_success_field' },
            spark: SPARK_PROMPTS.defineSuccess,
          },
  },
  {
    signal_id: 'sig_option_breadth',
    surface: 'sharpen',
    entityKind: 'option',
    resolvedCopy: 'Options widened.',
    detect: input => {
      if (input.optionCount >= 3) return null
      const copy =
        input.optionCount <= 1
          ? SIGNAL_COPY.optionBreadthOne
          : SIGNAL_COPY.optionBreadth(input.optionCount)
      return {
        signal_id: 'sig_option_breadth',
        copy: { lead: copy.lead, emphasis: copy.emphasis },
        // CEE narrow-framing swap-in-place: same row, same signal slot,
        // CEE's own text verbatim with attribution.
        ceeOverride: input.narrowFramingDetail
          ? { text: input.narrowFramingDetail, attribution: { kind: 'olumi' } }
          : undefined,
        rationale: SIGNAL_COPY.optionRationale,
        entityKind: 'option',
        action: {
          type: 'send_prompt',
          label: SPARK_PROMPTS.widenOptions.label,
          prompt: SPARK_PROMPTS.widenOptions.prompt,
        },
        spark: SPARK_PROMPTS.widenOptions,
      }
    },
  },
  {
    signal_id: 'sig_risk_count',
    surface: 'sharpen',
    entityKind: 'risk',
    resolvedCopy: 'Risks captured.',
    detect: input => {
      if (input.riskCount >= 3) return null
      const copy =
        input.riskCount === 0
          ? SIGNAL_COPY.riskNone
          : SIGNAL_COPY.riskCount(input.riskCount, input.risksAllOlumi)
      return {
        signal_id: 'sig_risk_count',
        copy: { lead: copy.lead, emphasis: copy.emphasis },
        rationale: SIGNAL_COPY.riskRationale,
        entityKind: 'risk',
        action: {
          type: 'send_prompt',
          label: SPARK_PROMPTS.preMortem.label,
          prompt: SPARK_PROMPTS.preMortem.prompt,
        },
        spark: SPARK_PROMPTS.preMortem,
      }
    },
  },
  {
    signal_id: 'sig_estimates',
    surface: 'sharpen',
    entityKind: 'factor',
    resolvedCopy: 'Top estimates checked.',
    detect: input => {
      if (input.aiEstimatedCount === 0 || input.topUncalibrated == null) return null
      const copy = SIGNAL_COPY.estimates(input.aiEstimatedCount, input.topUncalibrated.label)
      return {
        signal_id: 'sig_estimates',
        copy: { lead: copy.lead, emphasis: copy.emphasis },
        rationale: SIGNAL_COPY.estimatesRationale,
        entityKind: 'factor',
        action: { type: 'open_estimates', nodeId: input.topUncalibrated.id },
        spark: SPARK_PROMPTS.calibrate,
      }
    },
  },
  {
    signal_id: 'sig_cee_bias',
    surface: 'sharpen',
    entityKind: 'decision',
    resolvedCopy: null,
    detect: input => {
      if (!input.biasFindingExplanation) return null
      return {
        signal_id: 'sig_cee_bias',
        // Render-if-live: CEE's own explanation is the row text, attributed.
        copy: { lead: '', emphasis: '' },
        ceeOverride: { text: input.biasFindingExplanation, attribution: { kind: 'olumi' } },
        rationale: SIGNAL_COPY.ceeBiasRationale,
        entityKind: 'decision',
        action: {
          type: 'send_prompt',
          label: SPARK_PROMPTS.reflectBias.label,
          prompt: SPARK_PROMPTS.reflectBias.prompt,
        },
        spark: SPARK_PROMPTS.reflectBias,
      }
    },
  },
]
