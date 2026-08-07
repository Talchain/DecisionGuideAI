/**
 * The shared harness for the `reconcileAppliedGraph` suites — R-10.
 *
 * ⚠ WHY THIS EXISTS. `mergeAppliedGraph.validation.spec.ts` re-declared
 * `EXISTING_NODES`, `EXISTING_EDGES` and `seedCanvas` from its SAME-DIRECTORY
 * sibling `mergeAppliedGraph.spec.ts`, including the identical `setState` field
 * set — and the `lastAuthoritativeGraph: null` line in it is a LEAK GUARD whose
 * rationale existed only in the older file. A reader of the newer spec had no way
 * to know why that field was there, and a future edit to the guard would have
 * been applied to one of two seeds.
 *
 * It also SKIPPED the sibling's `counts()` helper, whose docstring states the
 * rule ("every assertion checks ALL SIX exactly — an unasserted counter is how an
 * unintended removal would slip through") and then asserted only 2 of the 6
 * counters on the overlay path. So the duplication was not merely wasteful: the
 * copy was WEAKER than the original in the specific way the original's own
 * comment warned about.
 *
 * ⚠ IT IS A HELPER MODULE, NOT A SPEC IMPORT. Importing the sibling spec directly
 * would execute its `describe`/`beforeEach` inside the importing file — the
 * sibling's whole suite would run twice, under the wrong file name, with its
 * `beforeEach` reseeding the store between the importer's own cases. A shared
 * `__helpers__` module is the only form of "both specs use one definition" that
 * does not have that side effect. (`src/canvas/__tests__/__helpers__/` is the
 * existing precedent for this directory shape.)
 *
 * ⚠ THE SEED IS PARAMETERISED, THE FIELD SET IS NOT. What the two suites genuinely
 * share is the `setState` FIELD SET (including the leak guard) and `counts()`.
 * What they legitimately differ on is DATA — the newer suite needs a
 * canonical-form edge id (`factor-1::goal-1::0`) rather than the older suite's
 * locally-rewritten fallback (`e-0`), and only the older one needs
 * `observedState` on the factor. Forcing one fixture on both would have been the
 * opposite error: the already-diverged copy in `edgeValidationRebuildHops.spec.ts`
 * hard-wired its `graph` and then could not vary nodes or framing.
 */
import { useCanvasStore } from '../../../store'
import type { ReconcileAppliedGraphResult } from '../../mergeAppliedGraph'

/**
 * Fill the counters a case does not mention with 0, so every assertion checks
 * ALL SIX exactly. Deliberately not `objectContaining`: an unasserted counter is
 * how an unintended removal would slip through.
 */
export function counts(
  p: Partial<ReconcileAppliedGraphResult> = {},
): ReconcileAppliedGraphResult {
  return {
    addedNodeCount: 0,
    addedEdgeCount: 0,
    updatedNodeCount: 0,
    updatedEdgeCount: 0,
    removedNodeCount: 0,
    removedEdgeCount: 0,
    ...p,
  }
}

/**
 * Seed the canvas store as though the given graph were already on screen.
 *
 * ⚠ `lastAuthoritativeGraph: null` IS A LEAK GUARD, NOT BOILERPLATE. It means
 * "CEE has acknowledged nothing", which leaves the DELETION path OFF unless a
 * case opts in. Without the reset the field leaks between cases and a later test
 * can delete the seed graph. This is the line whose reason lived in only one of
 * the two copies of this function.
 */
export function seedCanvas(nodes: unknown[], edges: unknown[]): void {
  useCanvasStore.setState({
    currentScenarioId: 'scenario-1',
    nodes: structuredClone(nodes) as never,
    edges: structuredClone(edges) as never,
    ceeAnalysisReady: null,
    lastAuthoritativeGraph: null,
    history: { past: [], future: [] },
  } as never)
}
