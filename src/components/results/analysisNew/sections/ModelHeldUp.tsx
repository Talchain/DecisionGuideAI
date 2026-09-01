/**
 * ⭐⭐ THE STATE FOR HAVING SUCCEEDED — the panel's missing terminal state.
 *
 * The design critique's sharpest finding: "there is no design for having
 * succeeded." When the model holds up, every section on this panel has nothing
 * to say and the surface goes QUIET at exactly the moment the team should be
 * handed their decision. A panel that is eloquent about problems and mute about
 * resolution teaches its reader that silence means nothing happened.
 *
 * ── WHAT "HELD UP" IS ALLOWED TO MEAN ──────────────────────────────────────
 * A conjunction of PRODUCER facts, never a summary this surface composes:
 *
 *   1. the robustness verdict is `stable` — the producer's own word;
 *   2. evidence WAS assessed (`evidenceAssessed`), so an empty gap list is a
 *      RESULT and not an absence of looking;
 *   3. the gap list is in fact empty;
 *   4. the report is current — a stale run cannot certify a model it may not
 *      describe;
 *   5. the run is not PARTIAL — a verdict computed while required results were
 *      missing is a verdict about a fragment.
 *
 * ⚠⚠ (2) IS THE ONE THAT KEEPS THIS HONEST, AND WITHOUT IT THIS COMPONENT IS
 * THE MOST DANGEROUS THING ON THE PANEL. "Assessed, none found" and "never
 * assessed" both produce an empty array. Congratulating a team on a model whose
 * evidence was never examined is a lie the surface would tell in its most
 * confident voice, at the moment they are most likely to act on it. The panel
 * already refuses this conflation everywhere else ("Evidence not assessed" is
 * stated, not implied); this is the same rule at the top of the ladder.
 *
 * ── WHAT IT REFUSES TO SAY ─────────────────────────────────────────────────
 * Not "your decision is correct", not "this is safe", not a score. The model
 * holding up under testing is a statement about the MODEL, not about the world
 * or the choice — and humans remain the authors. It says what was tested, and
 * hands over the move.
 */
import { CheckCircle2 } from 'lucide-react'
import { typography } from '../../../../styles/typography'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'

export interface ModelHeldUpProps {
  /** The producer's robustness tone. */
  verdictTone: 'stable' | 'mixed' | 'sensitive' | null
  /** Did the producer ASSESS evidence on this run at all? */
  evidenceAssessed: boolean
  /** How many gaps it found. */
  gapCount: number
  /** A stale report cannot certify the model it may no longer describe. */
  isStale: boolean
  /** Pre-run there is nothing to have held up. */
  isPreRun: boolean
  /**
   * The producer disclosed the run as PARTIAL — `status === 'partial'` or a
   * required result key missing (`win_probability`, `expected_outcome`,
   * `robustness_level`).
   *
   * ⚠⚠ THE FIFTH LIMB, AND IT WAS MISSING FROM THE FIRST VERSION OF THIS
   * COMPONENT. Found by independent review, which is the only thing that could
   * have found it: a refusal battery enumerating the limbs the condition HAS is
   * structurally incapable of finding the limb it is MISSING, and six biting
   * mutants said nothing because every one was pointed at the conjunction as
   * written (CLAUDE.md trap 22 — the corpus came from the same head as the
   * predicate and shared its blind spot).
   */
  isProvisional: boolean
  /** Open the decision-recording ask. Absent = no move is offered. */
  onRecord?: () => void
  testId: string
}

/**
 * ⚠ EXPORTED SO THE CONDITION CAN BE TESTED AS A CONDITION. Inlining it in the
 * component makes the four-way conjunction reachable only through a render,
 * which is how one of its limbs quietly stops mattering.
 */
export function modelHeldUp(p: {
  verdictTone: 'stable' | 'mixed' | 'sensitive' | null
  evidenceAssessed: boolean
  gapCount: number
  isStale: boolean
  isPreRun: boolean
  isProvisional: boolean
}): boolean {
  /**
   * ⚠⚠ `isProvisional` IS THE SAME ARGUMENT AS `evidenceAssessed`, ONE LEVEL UP.
   * `robustnessVerdict` is read from `robustness.display_verdict` and is
   * entirely independent of `win_probability` / `expected_outcome`
   * completeness — so a run missing either of those still yields a `stable`
   * tone, passes all four original limbs, and renders "Your model held up"
   * DIRECTLY BENEATH an `AtAGlance` that is simultaneously naming the results
   * which did not come back. The surface would contradict itself in adjacent
   * elements, with the confident sentence second.
   *
   * A `robust` verdict on a run whose required results did not all arrive is a
   * verdict about a FRAGMENT, presented as a verdict about the model.
   */
  if (p.isPreRun || p.isStale || p.isProvisional) return false
  if (p.verdictTone !== 'stable') return false
  // ⚠ ORDER IS NOT LOAD-BEARING HERE, BUT BOTH LIMBS ARE. `gapCount === 0`
  // alone is satisfied by a run that never looked.
  return p.evidenceAssessed && p.gapCount === 0
}

export function ModelHeldUp({
  verdictTone,
  evidenceAssessed,
  gapCount,
  isStale,
  isPreRun,
  isProvisional,
  onRecord,
  testId,
}: ModelHeldUpProps) {
  if (
    !modelHeldUp({ verdictTone, evidenceAssessed, gapCount, isStale, isPreRun, isProvisional })
  )
    return null

  return (
    <section
      className="rounded-lg border border-success/30 bg-success/[0.05] px-3 py-2.5"
      data-testid={testId}
      aria-label={COPY.heldUp.title}
    >
      <div className="flex items-start gap-2">
        <CheckCircle2 className="w-4 h-4 mt-[1px] shrink-0 text-success" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className={`${typography.panelHeader} text-text-header m-0`} data-testid={`${testId}-title`}>
            {COPY.heldUp.title}
          </p>
          {/* ⚠⚠ NO SCOPE SENTENCE HERE, AND THAT IS A CORRECTION. This first
              quoted the producer's `display_verdict_reason` verbatim — which
              the GLANCE, six lines above, already renders. The first-viewport
              census caught it: "the ordering held across the simulated range"
              appeared twice on one surface. Quoting a producer sentence is the
              right instinct and was the wrong place; the panel's whole
              consolidation was about removing restatement, and a success banner
              that re-says the verdict is the restatement wearing good news.
              The scope stays where it already was. */}
          {/* ⚠⚠ THE LIMIT IS STATED IN THE SAME BREATH AS THE GOOD NEWS, not
              behind a disclosure. A model holding up is a statement about the
              MODEL — not about the world, and not about whether the decision is
              right. Humans remain the authors, and this is the one moment the
              surface is most likely to be read as absolution. */}
          <p className={`${typography.panelMeta} text-text-light mt-1 mb-0`} data-testid={`${testId}-limit`}>
            {COPY.heldUp.limit}
          </p>
          {/* Fail-closed: no handler, no move — never a dead affordance. */}
          {onRecord ? (
            <button
              type="button"
              onClick={onRecord}
              className={`${typography.panelMeta} mt-1.5 rounded-full border border-panel-border px-2.5 py-1 hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
              data-testid={`${testId}-record`}
            >
              {COPY.heldUp.record}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  )
}
