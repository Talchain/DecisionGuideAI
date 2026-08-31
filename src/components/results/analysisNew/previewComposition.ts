/**
 * Which findings the preview shows — and why it is not simply the top three.
 *
 * ⭐⭐ THE PROBLEM THIS SOLVES, MEASURED AT THE BYTES.
 *
 * `buildRecommendations` ranks on a deterministic ladder (its `PRIORITY` table).
 * Read as a list of ranks it looks unremarkable. Read as a list of KINDS OF
 * THINKING it says something the product cannot live with:
 *
 *     successMeasure    0    clarify    complete the model
 *     phase3Base       10-13 clarify    complete the model   (up to 4 slots)
 *     flip            100    evaluate   test it
 *     lehi            110    clarify    complete the model
 *     voi             120    evaluate   test it
 *     robustness      130    challenge  CRITICAL  <- the only one
 *     broaden         140    broaden    CREATIVE  <- the only one
 *     commit          200    commit     close it
 *
 * Four of the eight builders are `clarify`, and they hold every slot at the top.
 * The one critical move and the one creative move rank sixth and seventh. On a
 * real staging run the three visible rows were all "complete the model" and not
 * one of them named a decision-science technique — all three technique-bearing
 * findings sit at ranks five, six and seven.
 *
 * That is not a defect in any single line. It is what a ladder built one
 * trigger at a time converges on, because incompleteness is trivial to detect
 * and weak reasoning is not.
 *
 * ⚠⚠ AND THE ONE MECHANISM THAT COULD HAVE FIXED IT CANNOT REACH THE CRITICAL
 * MOVE. `adaptivePriority` exists precisely to float the relevant kind of help,
 * and it is fed only by `adaptivePriorityFromStage`, whose range is
 * `clarify | broaden | evaluate | commit`. **`challenge` is not in the range.**
 * So `strengthen:robustness` is structurally incapable of being boosted, on any
 * stage, on any run — including the run whose own glance verdict read
 * "Sensitive", which is exactly what that finding is for.
 *
 * ── WHAT THIS DOES, AND THE LINE IT DOES NOT CROSS ──────────────────────────
 *
 * It does NOT re-rank. It does NOT score. It does NOT promote a finding because
 * it carries a technique chip — that would make the chip CREATE importance
 * rather than follow it, which is the tail wagging the dog and was explicitly
 * ruled out.
 *
 * It makes exactly one intervention, and only when the preview would otherwise
 * ask for a single kind of thought: the LAST preview slot is given to the
 * highest-ranked finding of a DIFFERENT kind. Everything else keeps engine
 * order. When the preview already spans two kinds it does nothing at all.
 *
 * The justification is the product's own stated purpose rather than taste. The
 * ladder answers "what is most urgent?"; a reasoning instrument has to answer
 * "what would most improve the reasoning?" — two different questions wearing
 * one ranking (CLAUDE.md trap 21). Urgency ranks completeness first because
 * completeness is measurable. Improvement does not.
 *
 * ⚠ NOTHING IS HIDDEN BY THIS. The displaced finding moves to the FRONT of the
 * tail, which is reachable behind "Show N more". The rule changes which of the
 * findings a reader meets first, never which ones exist.
 */

import type { HelpType, Recommendation } from '../strengthen/strengthenTypes'

export interface PreviewPlan {
  /** The list to render, in the order to render it. */
  ordered: Recommendation[]
  /**
   * Distinct kinds of thinking sitting BELOW the preview, in first-appearance
   * order. Lets the disclosure say what opening it is worth, rather than
   * offering a bare count.
   */
  hiddenKinds: HelpType[]
  /**
   * The id pulled into the preview, or null when nothing was moved. Exposed so
   * a test can bind to the promotion BY IDENTITY rather than inferring it from
   * a position, and so the surface could mark it later if that reads well.
   */
  promotedId: string | null
}

/** Distinct `helpType`s across a list, in first-appearance order. */
function kindsOf(recs: readonly Recommendation[]): HelpType[] {
  const seen: HelpType[] = []
  for (const rec of recs) if (!seen.includes(rec.helpType)) seen.push(rec.helpType)
  return seen
}

/**
 * @param recs      Engine output, already lifecycle-filtered, in engine order.
 * @param previewSize How many rows are shown before "Show N more".
 */
export function planPreview(
  recs: readonly Recommendation[],
  previewSize: number,
): PreviewPlan {
  const ordered = [...recs]

  // Nothing is below the fold, so there is no composition to plan.
  if (previewSize <= 0 || ordered.length <= previewSize) {
    return { ordered, hiddenKinds: [], promotedId: null }
  }

  const head = ordered.slice(0, previewSize)
  const tail = ordered.slice(previewSize)

  // ⚠ ALREADY ASKING FOR MORE THAN ONE KIND OF THOUGHT — leave it alone. The
  // minimal intervention is the defensible one: every swap not made is a place
  // the producer's ranking still speaks for itself.
  if (kindsOf(head).length > 1) {
    return { ordered, hiddenKinds: kindsOf(tail), promotedId: null }
  }

  const headKind = head[0].helpType
  const promoteIndex = tail.findIndex((rec) => rec.helpType !== headKind)

  // Every finding is the same kind. There is no diversity to surface and
  // manufacturing one would mean inventing a distinction the engine did not
  // make.
  if (promoteIndex === -1) {
    return { ordered, hiddenKinds: kindsOf(tail), promotedId: null }
  }

  const [promoted] = tail.splice(promoteIndex, 1)
  // Into the LAST preview slot, not the first: the engine's top-ranked finding
  // keeps the position it earned. The displaced row goes to the front of the
  // tail, so it is the first thing "Show N more" reveals.
  const displaced = head.pop()!
  const nextHead = [...head, promoted]
  const nextTail = [displaced, ...tail]

  return {
    ordered: [...nextHead, ...nextTail],
    hiddenKinds: kindsOf(nextTail),
    promotedId: promoted.id,
  }
}
