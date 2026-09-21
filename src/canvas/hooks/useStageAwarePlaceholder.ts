import { useCanvasStore, selectResultsStatus } from '../store'
import { useMayStalenessVoiceSpeak } from '../conversation/stalenessVoice'
import { useAnalysisTrust } from './useAnalysisTrust'
// ⚠ THE LEAF, NOT THE COMPONENT. `firstUsePlaceholder.ts` carries no imports of
// its own precisely so a shared string cannot drag a component's dependency
// graph across the dock's import boundary — see its header for the 54-violation
// measurement that put it there.
import { FIRST_USE_PLACEHOLDER } from '../components/firstUsePlaceholder'

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
/**
 * The five states the ladder below distinguishes, named so more than one voice
 * can speak from them.
 *
 * ⭐ THE LADDER IS EXTRACTED BECAUSE TWO SURFACES WERE CONTRADICTING EACH OTHER
 * IN ONE FRAME, and a whole-app screenshot is what caught it. With a model on
 * the canvas and no conversation yet, the Olumi tab's body said
 *
 *     "Describe the decision or challenge you're working through, any options
 *      you're weighing, and what a good outcome looks like."
 *
 * while the composer twenty pixels beneath it said "Ask about this model…" —
 * one invitation to describe a decision that was already drawn on screen, and
 * one that could see it. `OlumiTabBody` gated on `realMessageCount === 0`
 * alone; it had no way to know a model existed, because the only thing that
 * knew lived in this hook and returned a composer-shaped string.
 *
 * So the STATE is derived once and each surface renders its own voice from it.
 * Neither can drift, and adding a state without giving it both voices is a type
 * error.
 */
export type ConversationStage =
  /** Edited since the last run, and no higher staleness voice is already saying so. */
  | 'changed'
  /** A run the producer confirms is current. */
  | 'current'
  /** A run exists but freshness is cannot-confirm or absent — never claim "latest". */
  | 'analysed'
  /** A model on the canvas, nothing run yet. */
  | 'modelled'
  /** Nothing yet. */
  | 'empty'

/**
 * ⚠ ONE LADDER, AND ITS ORDER IS LOAD-BEARING. Do not add a second predicate
 * beside it (CLAUDE.md trap 21): a surface that wants different words wants a
 * different VOICE for the same state, not a different reading of the state.
 */
export function useConversationStage(): ConversationStage {
  const nodeCount = useCanvasStore((s) => s.nodes.length)
  const resultsStatus = useCanvasStore(selectResultsStatus)
  const freshness = useAnalysisTrust().semantic
  const mayNagAboutStaleness = useMayStalenessVoiceSpeak('placeholder')

  if (freshness === 'changed' && mayNagAboutStaleness) return 'changed'
  if (freshness === 'current') return 'current'
  if (resultsStatus === 'complete') return 'analysed'
  if (nodeCount > 0) return 'modelled'
  return 'empty'
}

export function useStageAwarePlaceholder(): string {
  const stage = useConversationStage()

  if (stage === 'changed') {
    return 'Model changed. Ask or rerun…'
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

/**
 * The PANEL voice for the same state — the sentence the Olumi tab shows while
 * the conversation is empty.
 *
 * ⚠ IT IS A SENTENCE, NOT THE COMPOSER'S STRING. "Ask about this model…" is an
 * ellipsis-trailing prompt written to sit inside a text box; as the only thing
 * in an otherwise blank panel it reads as a fragment. Same state, different
 * register — which is exactly why the state is derived once and the words are
 * chosen twice, rather than one surface borrowing the other's copy.
 *
 * ⛔ IT CLAIMS ONLY WHAT THE STAGE ESTABLISHES, and the 'analysed' line is the
 * one that had to be careful: that stage means a run COMPLETED but freshness is
 * cannot-confirm or absent, so it must not say "latest" or "ready" — the same
 * restraint the placeholder ladder already shows at that rung.
 *
 * ⚠ 'changed' DOES NOT BECOME A THIRD STALENESS VOICE. It is reachable only
 * when `useMayStalenessVoiceSpeak` has already permitted the placeholder to
 * mention it (L-42: one staleness communication per turn view); when a higher
 * surface is speaking, the ladder falls through and this says the neutral
 * thing, exactly as the composer does.
 *
 * ⚠ 'empty' RETURNS THE FIRST-USE CONSTANT UNCHANGED. A user who genuinely has
 * nothing on the canvas still gets the sentence the hero and the returning-user
 * spec both bind to; this adds the four cases that were missing, it does not
 * replace the one that was right.
 */
export function useEmptyConversationInvitation(): string {
  const stage = useConversationStage()
  switch (stage) {
    case 'changed':
      return 'Your model has changed since the last analysis. Ask Olumi what that means, or run it again.'
    case 'current':
      return 'Your analysis is ready. Ask Olumi about any part of it, or say what you would like to change.'
    case 'analysed':
      return 'Your analysis is on the Analysis tab. Ask Olumi about any part of it, or say what you would like to change.'
    case 'modelled':
      return 'Your model is on the canvas. Ask Olumi about any part of it, or say what you would like to change.'
    case 'empty':
      return FIRST_USE_PLACEHOLDER
  }
}
