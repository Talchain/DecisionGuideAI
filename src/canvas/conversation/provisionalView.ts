/**
 * ⭐ OLUMI'S PROVISIONAL VIEW, ON THE FACE OF THE REPLY (build train slice C5, #70 5855068711; Paul's ruling
 * 5855324470: "Yes, labelled provisional").
 *
 * When the analysis cannot put an option forward, the Agent may still say what it would do and why, as its
 * PROVISIONAL view, with the one step that would let the analysis confirm it. CEE carries it typed on
 * `_agent.provisional_view` (Runtime 5855331903), never in `blocks` or the leader fields, and also appends it to
 * the reply's prose after the leader gate.
 *
 * ⛔ THIN UI (ChatGPT programme ruling 5855577789, rule 1): the chat renders the TYPED field, verbatim, and never
 * parses or edits the producer's prose. It must not depend on the prose because the Agent route shapes an analysis
 * reply AFTER its post-gate appends (`withAnalysisAnswerShape`, CEE agent-v1-turn.ts), so a view appended at the
 * end lands in `_answer_shape.detail`, behind "Show more" (code-read at CEE 339ed343, #70 5855541127). Keeping the
 * view out of the prose, so it is not said twice, is the producer's contract (#70 5855633777), not a UI strip.
 *
 * ⚠ FAILS CLOSED. No sidecar, or no `view` in it → nothing renders; one is never invented. The heading is the
 * producer's sentence verbatim (`heading`); without it the block carries only the fixed label, never a reason
 * the UI wrote.
 */

import { ADDITIVE_EXTENSIONS_KEY, type OlumiResponseWithExtensions } from '../../v5/responseParser'

export interface ProvisionalView {
  /** What Olumi would do, in its words. Always shown. */
  readonly view: string
  /** Why it thinks so. One press away. */
  readonly reasoning?: string
  /** The one step that would let the analysis confirm (or overturn) it. */
  readonly confirmStep?: string
  /** The producer's label sentence, verbatim ("Provisional view — the analysis can't confirm this yet because …"). */
  readonly heading?: string
  /** The gate's typed reason the analysis cannot confirm it ("because …"). Opens the why, one press away. */
  readonly because?: string
}

/** The fixed label, shown alone when the producer sends no heading sentence. */
export const PROVISIONAL_VIEW_LABEL = 'Provisional view'

const text = (v: unknown): string | undefined => (typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined)

/** A stored or wire value → a view, or `undefined`. A value without a `view` is dropped, never repaired. */
export function readProvisionalView(raw: unknown): ProvisionalView | undefined {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const r = raw as Record<string, unknown>
  const view = text(r.view)
  if (view === undefined) return undefined
  const reasoning = text(r.reasoning)
  // The wire's one spelling (Panel's N3 on #2185): a producer that drifts shows as a missing step, not a quiet alias.
  const confirmStep = text(r.confirm_step)
  const heading = text(r.heading)
  const because = text(r.because)
  return {
    view,
    ...(reasoning ? { reasoning } : {}),
    ...(confirmStep ? { confirmStep } : {}),
    ...(heading ? { heading } : {}),
    ...(because ? { because } : {}),
  }
}

/** `_agent.provisional_view` from the parser's additive sidecar (an undeclared top-level key at the pinned schema). */
export function extractProvisionalViewSidecar(response: unknown): ProvisionalView | undefined {
  const additive = (response as OlumiResponseWithExtensions | null | undefined)?.[ADDITIVE_EXTENSIONS_KEY]
  const agent = (additive as Record<string, unknown> | undefined)?.['_agent']
  if (agent === null || typeof agent !== 'object' || Array.isArray(agent)) return undefined
  return readProvisionalView((agent as Record<string, unknown>).provisional_view)
}

/** The block's first line: the producer's sentence verbatim, or the fixed label alone. */
export function provisionalHeading(pv: ProvisionalView): string {
  return pv.heading ?? PROVISIONAL_VIEW_LABEL
}

/**
 * The typed reason as a line of its own: the producer's words, with only the sentence's case and closing stop set
 * (presentation, not composition: nothing is added, reworded or removed). `undefined` when the wire carries none.
 */
export function provisionalBecauseLine(pv: ProvisionalView): string | undefined {
  const b = pv.because
  if (b === undefined) return undefined
  const cased = b.charAt(0).toUpperCase() + b.slice(1)
  return /[.!?]$/.test(cased) ? cased : `${cased}.`
}
