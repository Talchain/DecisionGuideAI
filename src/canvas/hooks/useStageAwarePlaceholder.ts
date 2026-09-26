// ⭐ THE LADDER IS NOT HERE, AND THAT IS THE POINT. `useConversationStage`
// derives the state once and lives in its own module so a spec mocking THIS
// one — roughly twenty-five do, wholesale — does not have to learn the name of
// every other voice that reads the same state. Its header carries the RED that
// put it there.
import { useConversationStage } from './useConversationStage'
import { useCanvasStore } from '../store'
import { useReadinessStore } from '../stores/readinessStore'
import { selectAnalysisReadinessAuthority } from '../state/analysisStateSelector'
import { selectBoundMayRun } from './useAnalysisReady'
import { readinessObjectsToRun } from '../utils/canRunAnalysis'

/** The composer's "rerun" invitation. Said only when the Run gate would accept a run. */
export const PLACEHOLDER_CHANGED_RUNNABLE = 'Model changed. Ask or rerun…'
/**
 * The same moment on a model the Run gate refuses. Served 26 Sep (DL browser
 * `bf-20260926T050741Z`, UI 226cf1e2): after a canvas "+ Add option" the model is
 * blocked (`may_run: false`), Run is disabled, and the composer still said
 * "Ask or rerun…" — an invitation the product would refuse.
 */
export const PLACEHOLDER_CHANGED_BLOCKED = 'Model changed. Ask what it needs before a rerun…'

/**
 * Does the Run gate object right now? The SAME predicate and the SAME three
 * carriers every mounted Run gate reads (`readinessObjectsToRun`: the turn's
 * analysis_state readiness → the revision-bound `may_run` → the legacy side-car),
 * so the composer can never invite a run the Run control refuses.
 */
function useRunGateObjects(): boolean {
  const mayRun = useCanvasStore(selectBoundMayRun)
  const analysisState = useCanvasStore((s) => s.analysisStateV1 ?? null)
  const legacy = useReadinessStore((s) => s.readiness ?? null)
  return readinessObjectsToRun(legacy, selectAnalysisReadinessAuthority(analysisState), mayRun)
}

/**
 * Returns the placeholder text the persistent input strip / floating composer
 * should display, derived from the current canvas + analysis + selection state.
 *
 * Freshness comes from the composed trust semantic (useAnalysisTrust: CEE
 * verdict + local dirty overlay + orphan fold), NOT the legacy graph-hash
 * stale path (deleted 2026-07-16) (_internal.graphHash is never written, so
 * its 'stale' never fired and its 'current' falsely persisted after an edit —
 * the composer would still claim "latest analysis" once the Results surface
 * had moved to cannot-confirm).
 *
 * Priority (highest first):
 *   1. Model changed since the run    → "Model changed. Ask or rerun..."
 *      — or, when the Run gate objects, "Model changed. Ask what it needs
 *        before a rerun…" (never invite a run the gate refuses)
 *      (CEE 'stale' OR a local edit that downgraded a retained 'fresh')
 *      — SUPPRESSED while a higher staleness voice is on screen, see below.
 *   2. Confirmed current analysis     → "Ask about the latest analysis..."
 *   3. Analysis exists, can't confirm → "Ask about this analysis..."
 *      (cannot-confirm / no freshness verdict — never claims "latest")
 *   4. Model exists                   → "Ask about this model..."
 *   5. No model                       → "Describe your decision or challenge..."
 *
 * ── L-17: THE SELECTION BRANCH IS GONE, DELIBERATELY ───────────────────────
 * This hook used to return "Ask about [label]…" whenever one element was
 * selected. That read as a PREPARED SENTENCE the user could send, and it was
 * not one: a placeholder is an attribute, the composer's value stayed empty,
 * and there was no way to submit it. The selection now carries a REAL,
 * submittable control (`SelectionPill`), so the placeholder returns to the
 * neutral prompt and stops impersonating content it never held.
 *
 * ── L-42: ONE STALENESS COMMUNICATION PER TURN VIEW ────────────────────────
 * The applied-edit card's freshness note and the freshness pill both outrank
 * this placeholder. While either is on screen the composer says the neutral
 * thing rather than being the third voice telling the user to re-run.
 * Suppression is limited to the 'changed' branch — the only one that repeats
 * the higher surfaces' claim.
 */
export function useStageAwarePlaceholder(): string {
  const stage = useConversationStage()
  const gateObjects = useRunGateObjects()

  if (stage === 'changed') {
    return gateObjects ? PLACEHOLDER_CHANGED_BLOCKED : PLACEHOLDER_CHANGED_RUNNABLE
  }
  if (stage === 'current') {
    return 'Ask about the latest analysis…'
  }
  // Analysis ran but freshness is cannot-confirm or absent → acknowledge the
  // analysis without claiming it is current.
  if (stage === 'analysed') {
    return 'Ask about this analysis…'
  }
  if (stage === 'modelled') {
    return 'Ask about this model…'
  }
  // ⭐ "OR CHALLENGE" — the empty-canvas line.
  //
  // ⚠ AND IT IS NOT THE FIRST-USE HERO, WHICH AN EARLIER VERSION OF THIS COMMENT
  // CLAIMED. `AIInputBar` resolves `placeholder ?? stagePlaceholder`, so an
  // explicit prop WINS — and `FirstUseComposer` passes its own. This hook feeds
  // the dock's `PersistentInputStrip`; the hero carries its own copy and was
  // fixed there. Proven by execution: the hero's spec passed GREEN asserting the
  // OLD copy while this hook already returned the new line.
  // CEE #1110 (`aa134eac`, live on deployed `c24bfe37`) accepts open strategic
  // challenges, so asking only for a decision steered users away from a
  // capability the product ships. "Decision" stays FIRST: #1110's own
  // regression control is "Should we expand into the US this year?", kept
  // undegraded, and this copy must not cost what that change protected.
  return 'Describe your decision or challenge…'
}

