/**
 * SHARED HARNESS for the admission-gates arms.
 *
 * Extracted because the hero arms had to move: `analysis-hero/__tests__/
 * inertness.spec.ts` enforces that NOTHING outside the hero's own directory
 * imports `buildHeroModel`, and the first version of the admission spec
 * imported it from `results/__tests__/`. The guard is right — the hero is meant
 * to be inert — so the arms moved to the hero's directory and the fixture moved
 * here, rather than the guard being widened to admit a test.
 *
 * One harness, two specs. Duplicating it would have been two fixtures drifting
 * apart, which is the defect the shared reader exists to prevent one layer down.
 */
import { expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useResultsSectionData } from '../../useResultsSectionData'
import { useCanvasStore } from '../../../../canvas/store'
import type { AnalysisAdmissionV1, PermittedAnalysisMode } from '../../../../adapters/cee/types'

export const OPT_HEDGE = 'opt_hedge'
/**
 * The option's user-visible LABEL, exported from the one place it is defined.
 *
 * The hero HEADLINE renders labels, not ids, so an arm asserting on the headline
 * must bind to this. Exporting it — rather than letting a spec spell the string
 * again — keeps the assertion and the fixture from drifting apart: a mirrored
 * literal would go on passing after the fixture changed underneath it.
 */
export const OPT_HEDGE_LABEL = 'Hedge and stage the rollout'
export const OPT_BOLD = 'opt_bold'


const NODES = [
  { id: OPT_HEDGE, type: 'option', position: { x: 0, y: 0 }, data: { kind: 'option', label: OPT_HEDGE_LABEL } },
  { id: OPT_BOLD, type: 'option', position: { x: 0, y: 0 }, data: { kind: 'option', label: 'Go big in one step' } },
  { id: 'goal_1', type: 'goal', position: { x: 0, y: 0 }, data: { kind: 'goal', label: 'Reach £30k MRR' } },
]

export const admission = (mode: PermittedAnalysisMode): AnalysisAdmissionV1 => ({
  permitted_analysis_mode: mode,
  reasons: mode === 'comparative_leader'
    ? []
    : [{ field: 'semantic_quality_sufficient',
         message: 'Every confidence-bearing number in this model was estimated by Olumi, not stated by you.' }],
})

/** `separated: false` ties the arms, so Q2 refuses while Q1 is untouched. */
export function setStore(opts: { separated: boolean; admission?: AnalysisAdmissionV1 }) {
  const mk = (win: number, mean: number) => ({
    confidence: 0.5, win_probability: win, expected: mean,
    outcome: { mean, p10: mean - 0.2, p50: mean, p90: mean + 0.2 },
  })
  useCanvasStore.setState({
    results: {
      status: 'complete', progress: 100,
      report: {
        option_probabilities: opts.separated
          ? { [OPT_HEDGE]: mk(0.78, 0.62), [OPT_BOLD]: mk(0.22, 0.41) }
          : { [OPT_HEDGE]: mk(0.50, 0.50), [OPT_BOLD]: mk(0.50, 0.50) },
        // ⚠ THE PRODUCER SIGNAL IS REQUIRED, AND OMITTING IT MADE EVERY ARM
        // VACUOUS. `deriveDecisionVerdict` deleted its residual "band the win
        // probabilities myself" fallback: with no `near_tie` and no
        // `headline_banded`, the verdict is NO CLAIM however wide the gap. A
        // first draft of this harness set only `option_probabilities`, so Q2
        // was false in EVERY arm and B/C/D would all have "passed" while
        // testing nothing. The precondition assertion in each arm is what
        // caught it — which is exactly why it is there.
        robustness: {
          near_tie: {
            is_tie: !opts.separated,
            top_option_id: OPT_HEDGE,
            second_option_id: OPT_BOLD,
            gap: opts.separated ? 0.56 : 0.0,
            threshold: 0.1,
          },
        },
      },
    } as never,
    runMeta: {} as never,
    nodes: NODES as never,
    edges: [],
    hasCompletedFirstRun: true,
    rawV2Response: null,
    ceeAnalysisReady: (opts.admission
      ? { status: 'ready', options: [], goal_node_id: 'goal_1', analysis_admission: opts.admission }
      : null) as never,
  } as never)
}

export function render() {
  const r = renderHook(() => useResultsSectionData())
  // HARNESS PRECONDITION — the ID-space trap. If the hook built no options, every
  // assertion below is about an empty view model rather than about admission.
  expect(
    r.result.current.recommendation?.allOptions?.length,
    'harness precondition: the hook must build both options, or the ID space did not line up',
  ).toBe(2)
  return r.result.current.recommendation
}

export function resetStore() {
  useCanvasStore.setState({ results: null, nodes: [], edges: [], ceeAnalysisReady: null } as never)
}
