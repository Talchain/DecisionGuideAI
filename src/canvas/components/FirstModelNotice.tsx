/**
 * FirstModelNotice — say that a generated model is a starting point, while it
 * still is one.
 *
 * ── THE PROBLEM, IN INTERFACE FORM ─────────────────────────────────────────
 * A graph `applyDraftResult` has just written looks exactly like a graph a team
 * spent an afternoon arguing over: same nodes, same strengths, same panels,
 * same confidence. Nothing on the canvas distinguishes "nobody has looked at
 * this yet" from "we agreed this". That asymmetry is an anchor: the first thing
 * a colleague sees reads as a settled position, and settled positions get
 * argued against rather than edited.
 *
 * `StarterProvenanceBanner` already closes the neighbouring case — a BUNDLED
 * EXAMPLE that the canvas would otherwise pass off as a live draft. This closes
 * the other half: a model that genuinely was generated for this user, and that
 * nobody has put their judgement on yet.
 *
 * ── WHAT THE COPY IS ALLOWED TO CLAIM, AND WHY IT IS NARROWER THAN IT LOOKS ──
 * The predicate below proves exactly ONE thing: no node value and no
 * relationship strength on this canvas carries a user-owned provenance marker.
 * It does NOT prove the graph came from Olumi (an imported model reads the same
 * way), and it does NOT prove the user has touched nothing — a renamed node or
 * an added factor carries no provenance stamp of any kind, so this notice
 * cannot see either.
 *
 * So the copy claims the negative it can support ("nothing here carries your
 * judgement yet") and never the positive it cannot ("Olumi wrote this",
 * "you have not edited this"). The failure direction is deliberate: the
 * predicate can only ever UNDER-detect a user's work in ways that leave the
 * notice showing, which is why the dismiss control is not decoration — it is
 * the user's answer to a claim they can see is stale.
 *
 * ── DERIVED, NOT RESTATED ──────────────────────────────────────────────────
 * Three existing authorities answer "has a person judged this element", and
 * this file composes them rather than writing a fourth:
 *
 *   · `isReviewedByUser`  — the canonical node predicate, including the
 *     withdrawal rung and the snake/camel/top-level source chain.
 *   · `isReviewedEdge`    — the pre-analysis strength quick-select marker.
 *   · `edgeValueSource`   — the per-field marker, walked over
 *     `EDGE_PROVENANCED_FIELDS` so a fifth provenanced field is covered the
 *     day it joins the registry rather than the day somebody remembers this
 *     file. `isReviewedEdge` alone is NOT sufficient: the inspector's
 *     `setStrength` stamps `weightSource: 'user'` and writes no
 *     `userReviewedStrength`, so an edge strength set from the inspector is
 *     invisible to that predicate on its own.
 *
 * A FOURTH authority is read, and it answers a DIFFERENT question. The three
 * above all answer "has a person judged this element". `hasCompletedFirstRun`
 * answers "does this model carry computed results", which is the sentence's
 * other expiry condition and one no element-level marker records. They are
 * conjoined, not reconciled — see the comment on the clause itself for why the
 * monotonic flag and not `results.status`.
 *
 * ── WHAT IT DELIBERATELY DOES NOT DO ───────────────────────────────────────
 * It adds no store field. A "model is untouched" flag would have to be written
 * at every ingest site, cleared at every edit chokepoint and restored correctly
 * from the autosave — a hand-maintained mirror whose drift would read as green.
 * The graph is the source of truth for a claim about the graph.
 *
 * The dismissal is a plain component-lifetime boolean, and that is a choice
 * with a stated residue: a reload brings the notice back on a model that is
 * still unjudged. That direction is the safe one — a dismissal persisted
 * against a graph identity would have to decide what a redraft or an applied
 * assistant edit means, and getting that wrong re-shows a notice on a model
 * the team HAS worked on, which is the lie this file exists to avoid.
 *
 * The run-phase clause has a residue in the same safe direction, stated rather
 * than discovered. `useRetryDraft` replaces the graph via `applyDraftResult`
 * and explicitly does NOT call `resetCanvas` ("Do NOT resetCanvas() before the
 * draft succeeds", useRetryDraft.ts), and `applyDraftResult` writes no
 * `hasCompletedFirstRun`. So a graph replaced by that path after an earlier run
 * keeps the flag true and this notice stays silent on a genuinely first model.
 * That is a MISS, not a lie, and it is the direction this file already prefers.
 * The primary redraft path is unaffected — DraftChat calls `resetCanvas()`,
 * which clears the flag. Fixing the retry path means deciding where a
 * graph-replacing producer should clear run state, which is a store-lifecycle
 * question and not this component's to answer.
 */
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useOverlayCell } from './CanvasOverlayBand'
import type { Edge, Node } from '@xyflow/react'
import { useCanvasStore } from '../store'
import { useHasCompletedFirstRun } from '../selectors/results'
import { isReviewedByUser, isReviewedEdge } from './pre-analysis/utils/isReviewedByUser'
import { EDGE_PROVENANCED_FIELDS, edgeValueSource } from '../domain/edgeValueProvenance'
import { resolveStarterId } from '../starters/loadStarter'
import { typography } from '../../styles/typography'

export const FIRST_MODEL_NOTICE_TESTID = 'first-model-notice'

/**
 * The statement. It names the model's STATUS, not its author — see the header
 * for why authorship is not something this predicate can establish.
 */
export const FIRST_MODEL_NOTICE_COPY =
  'This is a first model, not a conclusion — nothing in it carries your judgement yet.'

/** The invitation. Claims nothing; asks for the one thing that would fix it. */
export const FIRST_MODEL_NOTICE_INVITATION =
  'Change anything that does not match how you see it.'

/**
 * Has a person put their judgement on any element of this graph?
 *
 * Exported so a spec can bind to the predicate by name and drive it with real
 * element shapes, rather than inferring it from what the component rendered.
 */
export function hasUserJudgedAnyElement(
  nodes: readonly Node[],
  edges: readonly Edge[],
): boolean {
  if (nodes.some((n) => isReviewedByUser(n))) return true
  return edges.some(
    (e) =>
      isReviewedEdge(e) ||
      EDGE_PROVENANCED_FIELDS.some(
        (field) =>
          edgeValueSource(e.data as Record<string, unknown> | undefined, field) === 'user',
      ),
  )
}

export function FirstModelNotice() {
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const hasCompletedFirstRun = useHasCompletedFirstRun()
  const [dismissed, setDismissed] = useState(false)

  // ⚠ THESE ARE NOT THE BAND'S QUESTION, AND COLLAPSING THEM INTO IT WOULD BE
  // A DEFECT. `OVERLAY_PRIORITY` answers *"who gets bottom-centre when several
  // components each have something true to say?"*. The conditions below answer
  // *"is this sentence true and appropriate for THIS graph at all?"* — a
  // different question, and the estate's signature defect is aligning two
  // authorities that were never asking the same thing.
  //
  // The starter clause is the one that shows why. If it were deleted in favour
  // of the priority table, the table would still hide this notice while the
  // starter banner is up — but DISMISSING the starter banner would then release
  // the cell and pop this notice in its place, on a bundled example, where its
  // sentence was never the right one. The user would have dismissed a
  // disclosure and been handed a second one. So it stays, and the band's job
  // stays purely spatial.
  const wants =
    !dismissed &&
    // Nothing on the canvas — there is no model to characterise.
    nodes.length > 0 &&
    // A bundled example already carries its own, stronger disclosure
    // (`StarterProvenanceBanner`). Two notices about the same graph's standing
    // would compete, and the starter one is the more important of the two.
    resolveStarterId(nodes) === null &&
    // The sentence's OTHER expiry, and the one no provenance marker can see.
    // `hasUserJudgedAnyElement` below catches a person putting their judgement
    // on an element; this catches the MODEL acquiring computed results, which
    // falsifies "not a conclusion" just as surely. `resultsComplete` writes no
    // `nodes` and no `edges` (store.ts) — a run stamps no element-level
    // provenance of any kind — so the predicate below is structurally unable to
    // notice a completed analysis, and without this clause the notice outlives
    // one, over cards that now carry result bars.
    //
    // ⚠ `hasCompletedFirstRun`, NOT `results.status === 'complete'`. Those
    // answer different questions, and the transient one would re-create the
    // same lie in a narrower window: `resultsStart` moves `status` to
    // 'preparing' when a RERUN begins while DELIBERATELY preserving `report`,
    // `hash` and `drivers` ("Preserve previous results during re-run",
    // store.ts), so a status-based predicate would withdraw this notice at
    // completion and pop it back mid-rerun, on top of results still on screen.
    // `hasCompletedFirstRun` is monotonic across reruns — `resultsStart` does
    // not write it. It is set true by `resultsComplete`, `resultsLoadHistorical`
    // and `resultsHydrateFromSupabase`, and back to false only by
    // `importCanvas`, `resetCanvas` and `reset`.
    !hasCompletedFirstRun &&
    !hasUserJudgedAnyElement(nodes, edges)

  const { granted, target } = useOverlayCell('bottom-centre', FIRST_MODEL_NOTICE_TESTID, wants)

  if (!wants || !granted) return null

  const body = (
    <div
      data-testid={FIRST_MODEL_NOTICE_TESTID}
      role="status"
      className="pointer-events-auto flex max-w-md items-start gap-2 rounded-lg border border-panel-border bg-panel px-3 py-2 shadow-sm"
    >
      <span className={`${typography.caption} text-text-body`}>
        {FIRST_MODEL_NOTICE_COPY}{' '}
        <span className="text-text-light">{FIRST_MODEL_NOTICE_INVITATION}</span>
      </span>
      <button
        type="button"
        data-testid={`${FIRST_MODEL_NOTICE_TESTID}-dismiss`}
        aria-label="Dismiss the first-model notice"
        onClick={() => setDismissed(true)}
        className="flex-none rounded text-text-light hover:text-text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info"
      >
        <X size={12} aria-hidden="true" />
      </button>
    </div>
  )

  return target ? createPortal(body, target) : body
}
