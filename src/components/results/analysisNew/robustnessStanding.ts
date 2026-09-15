import { useMemo } from 'react'
import { useCanvasStore } from '../../../canvas/store'
import { readDecisionBriefViewModel } from '../decision-brief/decisionBriefViewModel'

/**
 * ⭐⭐⭐ ONE AUTHORITY ON THIS RUN'S ROBUSTNESS STANDING, BECAUSE TWO SURFACES
 * WERE ANSWERING THE SAME QUESTION INDEPENDENTLY AND COULD CONTRADICT.
 *
 * `ModelHeldUp` renders a POSITIVE claim about the whole model ("Your model
 * held up under testing"). `RobustnessCaveat` renders the producer's NAMED
 * condition under which the ordering reverses. Their gates never mentioned
 * each other, so a run satisfying both put a reassurance and its own
 * counter-example on one screen — measured, not hypothesised, in
 * `theTrustClaimsCannotContradict.spec.tsx`.
 *
 * ⛔ WHY NOT JUST ADD A SIXTH LIMB TO `modelHeldUp`. That is the remedy this
 * component already applied once: its header records adding `isProvisional`
 * to stop it contradicting `AtAGlance`, and the limb is scoped to THAT
 * neighbour. A third neighbour would need a seventh limb nobody thinks to
 * write. Naming the question once, here, is what stops the next one.
 *
 * ⭐ WHICH CLAIM WINS, AND WHY THIS DIRECTION. The caveat is PRODUCER-AUTHORED
 * and SPECIFIC — it names the threshold at which the ordering reverses. The
 * reassurance is generic and derived. Suppressing a reassurance can never
 * fabricate anything; suppressing a caveat would hide a measured condition.
 * When the two collide, the surface keeps the more informative and more
 * cautious statement and stays silent with the other.
 *
 * ⚠ THIS MODULE DECIDES NOTHING ABOUT THE PRODUCER'S DATA. It takes facts the
 * producer already supplied and answers one question about their COMBINATION.
 * It computes no verdict, invents no tone, and reads no store.
 */

/** The producer-supplied facts that bear on whether a run may be called sound. */
export interface RobustnessStandingInputs {
  /** `robustness.display_verdict`, mapped to the glance's tone. */
  verdictTone: 'stable' | 'mixed' | 'sensitive' | null
  /** Did the producer ASSESS evidence on this run at all? */
  evidenceAssessed: boolean
  /** How many evidence gaps it found. */
  gapCount: number
  /** A stale report cannot certify the model it may no longer describe. */
  isStale: boolean
  /** Pre-run there is nothing to have held up. */
  isPreRun: boolean
  /** The producer disclosed the run as PARTIAL — a verdict about a fragment. */
  isProvisional: boolean
  /**
   * The producer sent a `robustness_caveat` on this run AND the surface is
   * entitled to show it (`leaderClaimPermitted`, and it does not merely
   * restate the verdict reason already on screen).
   *
   * ⚠ THE ENTITLEMENT IS PART OF THE FACT, NOT A SEPARATE GATE. A caveat CEE
   * sent but the surface may not show is not on screen, so it cannot be
   * contradicted and must not silence the reassurance — otherwise a withheld
   * run loses BOTH statements and says nothing at all.
   */
  caveatOnScreen: boolean
}

/**
 * May this run be described, in the surface's own voice, as having held up?
 *
 * ⚠ WRITTEN AGAINST THE SPEC, NOT AGAINST THE FAILURE IN HAND (CLAUDE.md trap
 * 13d). The question is "is every producer signal about this run's soundness
 * positive?" — not "is the one pairing we found broken excluded?".
 */
export function mayClaimHeldUp(p: RobustnessStandingInputs): boolean {
  if (p.isPreRun || p.isStale || p.isProvisional) return false
  if (p.verdictTone !== 'stable') return false
  // ⚠ BOTH LIMBS. `gapCount === 0` alone is satisfied by a run that never looked.
  if (!p.evidenceAssessed || p.gapCount !== 0) return false
  // ⭐ THE LIMB THIS MODULE EXISTS FOR: the producer named a condition under
  // which the ordering reverses, and it is on screen. "Held up" is not the
  // honest word for a run carrying its own counter-example.
  if (p.caveatOnScreen) return false
  return true
}

/**
 * Is the producer's robustness caveat ACTUALLY ON SCREEN for this run?
 *
 * ⭐ LIFTED OUT OF `RobustnessCaveat` SO BOTH READERS SHARE ONE ANSWER. The
 * component used to hold these three conditions inline, which is precisely why
 * `ModelHeldUp` could not consult them: the fact existed only inside the render
 * of the other component. A fact that only one surface can see is a fact the
 * other surface will contradict.
 *
 * ⚠ THE THIRD CONDITION IS NOT COSMETIC. A caveat that merely restates the
 * verdict reason already on screen is suppressed as a duplicate — so it is NOT
 * on screen, and must not silence anything.
 */
export function robustnessCaveatOnScreen(
  caveatText: string | null,
  leaderClaimPermitted: boolean,
  verdictReason: string | null,
): boolean {
  if (!leaderClaimPermitted) return false
  if (caveatText === null) return false
  if (duplicatesVerdictReason(caveatText, verdictReason)) return false
  return true
}

/** Same text, ignoring case and surrounding space — not a similarity guess. */
export function duplicatesVerdictReason(text: string, verdictReason: string | null): boolean {
  if (verdictReason === null) return false
  return text.trim().toLowerCase() === verdictReason.trim().toLowerCase()
}

/**
 * ⭐⭐ THE SHARED READ. Both surfaces call this; neither re-decides.
 *
 * ⛔ WHY A HOOK AND NOT A PROP THREADED FROM THE COMPOSITION. Threading would
 * have been tidier, and it would have changed `RobustnessCaveat`'s public
 * contract — which has other mounts and a suite bound to it. The authority
 * that matters is the DERIVATION, not the read site: two call sites of one
 * function cannot disagree, whereas two inline predicates did.
 *
 * ⚠ `results?.` — this tab renders PRE-RUN, where `results` is null, and an
 * unguarded read threw for every case in two suites. Kept verbatim from
 * `RobustnessCaveat`, which learned it the hard way.
 */
export function useRobustnessCaveatOnScreen(
  leaderClaimPermitted: boolean,
  verdictReason: string | null,
): { caveatText: string | null; caveatBasis: string | null; onScreen: boolean } {
  const rawBrief = useCanvasStore(
    (state) =>
      (state.results?.report as { decision_brief?: unknown } | null | undefined)?.decision_brief,
  )
  const brief = useMemo(() => readDecisionBriefViewModel(rawBrief), [rawBrief])
  const caveat = brief?.robustnessCaveat ?? null
  const caveatText = caveat?.text ?? null
  return {
    caveatText,
    caveatBasis: caveat?.basis ?? null,
    onScreen: robustnessCaveatOnScreen(caveatText, leaderClaimPermitted, verdictReason),
  }
}
