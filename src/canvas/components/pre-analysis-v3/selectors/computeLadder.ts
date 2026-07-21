/**
 * computeLadder — deterministic best-next-step priority ladder (spec §3).
 *
 * Order: foundational gaps first (goal, then success measure — the
 * dependency-correct expression of the spec's success-then-goal pair, since a
 * success measure requires a goal), then the highest-influence uncalibrated
 * estimate, then the readiness gate (CEE explanation mirrored verbatim),
 * then run. Right-question stays an affordance, never a rung.
 */

import { LADDER_COPY } from '../constants'
import type { LadderInput, LadderStep } from '../types'

export function computeLadder(input: LadderInput): LadderStep {
  if (!input.goalPresent) {
    return { kind: 'set_goal', copy: LADDER_COPY.set_goal }
  }
  if (!input.successSet) {
    return { kind: 'set_success', copy: LADDER_COPY.set_success }
  }
  if (input.topUncalibrated) {
    return {
      kind: 'calibrate_top',
      copy: LADDER_COPY.calibrate_top(input.topUncalibrated.label),
      targetFactorId: input.topUncalibrated.id,
    }
  }
  // UI-SEM-091: runnable-via-scaffold. The readiness gate is closed, but CEE
  // (#612) will draft the remaining options on run — so skip the blocker rung,
  // offer the run, and disclose the draft so panel and gate never contradict.
  // Kept as a 'run_first' step: the panel's run handler and the gate already
  // treat that kind as "run now", so no new rung wiring is needed.
  if (input.canRunAnalysis === false && input.willScaffoldOptions === true) {
    return {
      kind: 'run_first',
      copy:
        typeof input.scaffoldOptionCount === 'number'
          ? LADDER_COPY.run_scaffold(input.scaffoldOptionCount)
          : LADDER_COPY.run_scaffold_nocount,
    }
  }
  // Explicit false only — loading/unknown readiness never gates the ladder.
  if (input.canRunAnalysis === false) {
    const explanation = input.readinessExplanation?.trim()
    return {
      kind: 'readiness_blocker',
      // CEE-authored explanation verbatim; the UI adds no judgement.
      copy: explanation && explanation.length > 0 ? explanation : LADDER_COPY.readiness_fallback,
    }
  }
  return { kind: 'run_first', copy: LADDER_COPY.run_first }
}
