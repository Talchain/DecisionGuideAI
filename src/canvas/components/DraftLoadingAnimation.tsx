/**
 * DraftLoadingAnimation
 *
 * Time-based loading indicator for AI draft generation. Elapsed wall-clock
 * time is the ONLY input this component has, and the copy now says only what
 * elapsed time licenses.
 *
 * Stages:
 *   0–20 s  "Drafting your decision model…"
 *  20–45 s  "Still drafting your decision model…"
 *  45 s+    "Still drafting — complex decisions can take a while…"
 *
 * ── ROADMAP 1.204 M1-L2: this table used to be a wall-clock fiction ───────
 * It previously claimed internal pipeline phases off a timer ("Mapping
 * factors and causal relationships…" at 15 s, "Assessing options, risks and
 * potential outcomes" at 30 s) and asserted a property of the user's own
 * input ("This is a complex decision") purely because the server was slow. A
 * two-word brief on a slow afternoon was told its decision was complex.
 *
 * None of it was derivable. Verified at CEE `95e1a2f8`: the V5 turn's draft
 * tool (`src/orchestrator/tools/draft-graph.ts:190`) calls
 * `runUnifiedPipeline(...)` WITHOUT the `onStage` emitter — that emitter is
 * passed only by `assist.v1.draft-graph-staged.ts:486`, a route the product
 * path does not call. The client therefore receives ZERO stage signal during
 * a draft, so every phase word here was a guess dressed as knowledge. The
 * measured truth is also not what the old copy implied: on the 28 Jul live
 * probe the graph was finished and validated at ~33 s and the remaining ~20 s
 * was a coaching pass — i.e. at 30–45 s, when the old table said "Assessing
 * options", the options had been settled for over ten seconds.
 *
 * ── The bar, and where it comes from ──────────────────────────────────────
 * This is not new copy doctrine. `AnalysisRunningBanner.NARRATION_STAGES`
 * (the analysis wait) already carries it, reasoned out over two review
 * rounds: no claim of a pipeline stage, count or completion proximity the
 * client cannot know; every line must stay TRUE from its own threshold until
 * the wait ends, including a wait that dies at the timeout. That review also
 * killed the comparative family ("longer than usual", "usually takes about a
 * minute") — the client holds no distribution of past draft durations, so it
 * has no baseline to compare against and must not invent one. The doctrine
 * was never analysis-specific; it had simply only ever been enforced on one
 * surface. `__tests__/narrationHonesty.invariant.spec.ts` now enforces it
 * over BOTH tables, so the two cannot drift apart again.
 *
 * ⚠ AMENDED 29 Jul (ROADMAP 2.122) — CEE-2 LANDED, AND THE TABLE STILL CANNOT
 * BE DELETED. The note here used to say this file "should be driven by real
 * GRAPH_READY / COACHING_READY frames and the elapsed-time table deleted
 * outright" once the streamed turn route existed. That route now exists (#751,
 * `POST /proxy/v5/turn/stream`) and the UI consumes it — and the deletion would
 * be a REGRESSION, for a measured reason:
 *
 *   the wire carries **no PROGRESS frames at all**. Zero observed across three
 *   live runs on deployed staging (`PHASE0-EVIDENCE-2026-07-28/
 *   cee2-live-latency.md` honest note 4 — "the route emits the frame class;
 *   nothing feeds it"; it needs the Anthropic streaming adapter, #745's
 *   inherited LOW and #751's rowed item 5).
 *
 * So between DRAFTING (271 ms) and GRAPH_READY (35.8 s median, 39.9 s on the
 * cold run) the client holds ONE frame and a clock. Deleting this table would
 * convert 36 seconds of honest escalating acknowledgement into 36 seconds of
 * silence. It stays until PROGRESS frames actually arrive — see the 2.122
 * PROGRESS row.
 *
 * What DID change: there is now a second table, `SETTLING_STAGES`, for the
 * window after GRAPH_READY. It is licensed differently and that difference is
 * the point — see its own docstring.
 */

import { useEffect, useState, useRef } from 'react'
import { typography } from '../../styles/typography'

/**
 * Message stages keyed by elapsed-second threshold.
 *
 * Every line must be true by construction of elapsed time alone AND stay
 * true from its threshold until the draft ends — a line that becomes false
 * while it is still on screen is the "progress bar stuck at 95%" defect.
 * Thresholds sit at 0/20/45 s against a measured typical draft of ~53 s
 * (28 Jul live probe), so the user sees the acknowledgement escalate twice
 * during an ordinary wait without any line ever over-promising.
 */
export const PROGRESSIVE_STAGES = [
  { afterSeconds: 0,  message: 'Drafting your decision model…' },
  { afterSeconds: 20, message: 'Still drafting your decision model…' },
  { afterSeconds: 45, message: 'Still drafting — complex decisions can take a while…' },
] as const

/**
 * The post-GRAPH_READY table (ROADMAP 2.122). Shown only when the client HOLDS
 * a GRAPH_READY frame, i.e. the graph is on the canvas and the turn is still
 * running (live: a ~25 s window, 35.8 s → 60.9 s).
 *
 * ── WHY THIS TABLE IS ALLOWED TO SAY MORE ────────────────────────────────
 * `PROGRESSIVE_STAGES` above is licensed by ELAPSED TIME ALONE, which is why it
 * cannot name a phase. This table is licensed by A FRAME THE CLIENT IS HOLDING:
 *
 *   - "your model is on the canvas" — the client rendered it; it can see it.
 *   - "values are still settling"   — the frame is stamped `status:
 *     "in_progress"`, and the route's contract states that
 *     `graph-data-integrity` refines the numeric values after the transform.
 *     Saying so is reading the frame, not guessing at a pipeline.
 *   - "coaching is still arriving"  — COACHING_READY is a distinct later frame
 *     (live: 59.2 s) which has not arrived.
 *
 * Every rule that governs the elapsed-time table still applies here (no
 * comparative, no duration forecast, no completion-proximity, no claim about
 * the user's decision, no fabricated number) AND one more that is specific to
 * this phase, because this is the phase where a graph is visible and the
 * temptation to say something ABOUT it is highest: **no claim the frame does
 * not license** — no verdict, no leader, no win probability, no freshness, no
 * recommendation. Enforced by `narrationHonesty.invariant.spec.ts`.
 *
 * Thresholds are 0/12 s against the measured ~25 s settling window.
 */
export const SETTLING_STAGES = [
  { afterSeconds: 0, message: 'Your model is on the canvas. Values and coaching are still arriving…' },
  // ⚠ My first draft of this line read "Still finishing the values and
  // coaching…" and the honesty suite REJECTED it on the completion-proximity
  // rule — correctly: "finishing" tells the user the wait is nearly over, and
  // the client has no frame that says so. The guard caught its author.
  { afterSeconds: 12, message: 'Still waiting on the values and coaching…' },
] as const

/**
 * The terminal honest lines for a draft whose values will NOT settle in this
 * session (`draftStreamPhase === 'unsettled'`). Two, because there are two
 * genuinely different causes and one sentence cannot state both truthfully.
 *
 * ── WHY THE OFFER CHANGED (adversarial review F3) ────────────────────────
 * These used to say *"Draft again to get its final numbers"* and shipped a
 * "Draft again" chip wired to `retryLast()`. **The chip could not do it on any
 * auth tier.** `retryLast` re-sends the same message on the same scenario, whose
 * canvas is now non-empty, so it is a BUFFERED turn — and CEE's continuation
 * guard, live-proven to key on the scenario's committed state, DECLINES to
 * re-draft (prose, no `draft_graph`). Each click removed the notice, re-sent,
 * received "already drafted with four options…", and left the gate shut. The
 * Supabase re-fetch branch cannot rescue it either: it additionally requires
 * `stage:analyse` in the applied set, which a decline's prose does not produce.
 *
 * So the copy now promises the action that genuinely works — a NEW draft, on a
 * fresh scenario, which is the only thing that can produce settled numbers once
 * the old scenario has a committed turn — and the chip is wired to a handler that
 * actually does that (`startNewDraft`). No promise the handler cannot keep.
 */
// ⚠ My first wording of BOTH notices ended "…to get the finished model", and the
// honesty suite rejected it on the model-is-finished rule. Third time this guard
// has caught its own author; rewording rather than loosening the rule.
export const UNSETTLED_DRAFT_NOTICE =
  'Your model is on the canvas, but the connection dropped before its values arrived, so they are not final. Start a new draft to get a model with settled values.'

/**
 * The same terminal state, reached because drafting was STOPPED rather than
 * because the connection failed — the Stop button, or the 130 s client timeout
 * (review F1). Worded to be true of both without asserting which: "drafting
 * ended" covers a user stop, a timeout and a preempt, where "you stopped it"
 * would be false for two of the three.
 */
// \u26a0 SAVE-CAVEAT ADDED BY ROADMAP 2.719. The previous wording ("The structure
// is still here \u2014 start a new draft\u2026") was written on #751's premise that the
// server turn always runs to completion and commits; the turn fence inverted
// that on exactly this path (a preempting send's claim made the server refuse
// the draft's commit) and the sentence became the phantom model's cover story
// \u2014 fresh-journey P0 diagnosis \u00a72 R2. The current premise (CEE 2.709): the
// commit is the COMMON case (first-write exemption), it is not knowable from
// this side of the aborted socket, and a refused/failed commit is surfaced by
// the SERVER at the start of the next reply on this conversation (the
// draft-loss notice). The copy states exactly that \u2014 pinned by
// draftLossPremise.spec.ts, governed by narrationHonesty.
export const STOPPED_DRAFT_NOTICE =
  'Drafting ended before your model\u2019s values arrived, so they are not final \u2014 and we can\u2019t confirm from here whether this draft saved. If it didn\u2019t, your next reply in this conversation will say so. The structure is still on the canvas \u2014 start a new draft to get a model with settled values.'

/**
 * ── THE THREE EARLY-STOP NOTICES ────────────────────────────────────────────
 *
 * Emitted on EVERY explicit user Stop, including one pressed before any
 * streaming message or graph preview exists. That supersedes the "early Stop is
 * silent by design" record in #527's liveproof, and the reason is the P0 this
 * lane closes: a user who stopped early saw an empty composer, assumed nothing
 * had happened, and typed again on the same scenario — while the turn they
 * cancelled was still running and about to commit over the top of the new one
 * (`PHASE0-EVIDENCE-2026-07-28/fix-stop-fence.md`). Silence was the thing that
 * made the corruption reachable.
 *
 * ⚠ THREE STRINGS, NOT ONE, AND THAT IS THE HONESTY. The server now answers a
 *   Stop with what it RECORDED, so the notice can describe the past instead of
 *   predicting the commit. One string would have to cover a turn that was
 *   cancelled in time, a turn that had already been saved, and a Stop we could
 *   not deliver — and any wording true of all three says nothing.
 *
 * ⚠ NONE OF THEM PROMISES AN OUTCOME. "was cancelled before it was saved" is a
 *   statement about a tombstone that exists and a commit that had not happened;
 *   the unconfirmed line says "may still be saved" rather than guessing. No
 *   forecast, no verdict — the same bar as the wait narration, and governed by
 *   the same suite (`narrationHonesty.invariant.spec.ts` derives its manifest
 *   from this module's `*_NOTICE` exports, so these are covered the moment they
 *   exist).
 */
export const EARLY_STOP_NOT_SAVED_NOTICE =
  'You stopped this draft, and it was cancelled before it was saved. Your canvas is unchanged \u2014 start a new draft when you are ready.'

export const EARLY_STOP_ALREADY_SAVED_NOTICE =
  'You stopped this draft, but it had already been saved to your canvas. Start a new draft to replace it.'

export const EARLY_STOP_UNCONFIRMED_NOTICE =
  'You stopped this draft. We could not reach the server to cancel it, so it may still be saved \u2014 reload to see what your canvas holds.'

/**
 * Every narration table this module owns, keyed by name.
 *
 * DERIVED, so the cross-surface honesty suite cannot miss one. The suite used
 * to consume a HAND-LISTED array of tables — which is trap 12: adding a table
 * without also adding it to the list would leave the new copy ungoverned, and
 * the omission would read as green. It now iterates this record instead.
 */
export const NARRATION_TABLES = {
  'DraftLoadingAnimation.PROGRESSIVE_STAGES': PROGRESSIVE_STAGES,
  'DraftLoadingAnimation.SETTLING_STAGES': SETTLING_STAGES,
} as const

function resolveStage(
  stages: readonly { readonly afterSeconds: number; readonly message: string }[],
  elapsedSeconds: number,
): string {
  // Walk stages in reverse to find the highest threshold that applies
  for (let i = stages.length - 1; i >= 0; i--) {
    if (elapsedSeconds >= stages[i].afterSeconds) return stages[i].message
  }
  return stages[0].message
}

/** Resolve the current message for a given elapsed time (seconds) */
export function messageForElapsed(elapsedSeconds: number): string {
  return resolveStage(PROGRESSIVE_STAGES, elapsedSeconds)
}

/**
 * Resolve the post-GRAPH_READY message. `elapsedSeconds` is measured from the
 * moment the graph landed, not from the start of the turn — the client knows
 * when it rendered, and re-using the turn's clock here would put the escalated
 * line up immediately on every draft.
 */
export function messageForSettling(elapsedSeconds: number): string {
  return resolveStage(SETTLING_STAGES, elapsedSeconds)
}

export function DraftLoadingAnimation() {
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef(Date.now())

  useEffect(() => {
    startRef.current = Date.now()
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const message = messageForElapsed(elapsed)

  return (
    <div className="flex flex-col items-center justify-center py-6 px-4" data-testid="draft-loading">
      {/* Status text */}
      <div className="text-center min-h-[48px]">
        <p className={`${typography.body} text-text-body transition-opacity duration-300`}>
          {message}
        </p>
        <p className={`${typography.caption} text-text-light mt-1`}>
          {elapsed < 60
            ? `${elapsed}s elapsed`
            : `${Math.floor(elapsed / 60)}m ${elapsed % 60}s elapsed`}
        </p>
      </div>

      {/* Progress bar */}
      <div className="w-48 h-1.5 bg-panel-border rounded-full mt-4 overflow-hidden">
        <div
          className="h-full rounded-full animate-progress-sweep bg-info"
        />
      </div>
    </div>
  )
}
