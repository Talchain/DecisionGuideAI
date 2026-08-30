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
 */
import { useState } from 'react'
import { X } from 'lucide-react'
import type { Edge, Node } from '@xyflow/react'
import { useCanvasStore } from '../store'
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
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null
  // Nothing on the canvas — there is no model to characterise.
  if (nodes.length === 0) return null
  // A bundled example already carries its own, stronger disclosure
  // (`StarterProvenanceBanner`). Two notices about the same graph's standing
  // would compete, and the starter one is the more important of the two.
  if (resolveStarterId(nodes) !== null) return null
  if (hasUserJudgedAnyElement(nodes, edges)) return null

  return (
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
}
