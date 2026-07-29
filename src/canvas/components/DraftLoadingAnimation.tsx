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
 * ⚠ This table is an HONEST INTERIM, not the destination. M1's real cure is
 * server-driven narration: once CEE-2 ships the staged turn route
 * (`POST /orchestrate/v2/turn/stream`), this file should be driven by real
 * GRAPH_READY / COACHING_READY frames and the elapsed-time table deleted
 * outright. Until that route exists the client has nothing real to narrate,
 * and the correct behaviour is to claim less — not to guess more.
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

/** Resolve the current message for a given elapsed time (seconds) */
export function messageForElapsed(elapsedSeconds: number): string {
  // Walk stages in reverse to find the highest threshold that applies
  for (let i = PROGRESSIVE_STAGES.length - 1; i >= 0; i--) {
    if (elapsedSeconds >= PROGRESSIVE_STAGES[i].afterSeconds) {
      return PROGRESSIVE_STAGES[i].message
    }
  }
  return PROGRESSIVE_STAGES[0].message
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
