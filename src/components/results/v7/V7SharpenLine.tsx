/**
 * V7SharpenLine — the "a few inputs would sharpen these results" line
 * (V7 Lane L4, spec row 2).
 *
 * Passthrough only. Two honest, store-backed parts:
 *   · The brief quote ← the user's own framing goal (`recommendation.goalText`)
 *     — their wording, rendered verbatim in quotes, and ONLY theirs.
 *     ⚠ ROADMAP 2.993: this used to fall back to `goalLabel` when the user had
 *     written no goal, which put OUR generated text inside quotation marks
 *     under "You wrote". `goalLabel` is a derivation, not a quotation
 *     (`useResultsSectionData`: sanitised, sourced from the drafted goal NODE's
 *     label, re-phrased as "the best outcome for X" for short/colliding
 *     labels, and defaulting to the literal "your goal"). Attributing it to
 *     the user is a lie about authorship on the one surface designed to show
 *     them their own words — so the quote now carries its PROVENANCE and the
 *     line refuses to render anything it cannot honestly attribute.
 *   · The inputs to review (≤3 + "and N more") ← `confidence.topEvidenceGaps`
 *     (each carries `factorLabel` + a canvas focus target), the factors whose
 *     evidence is thin enough to be worth confirming.
 * Plus a static, honest model-limit caveat (not a data claim).
 *
 * SKIPPED (honest absence, reported): the prototype also renders a
 * conversation-aware *reframed question* ("Olumi reframed that as: …"). That
 * reinterpretation is model output with no results-store selector, so it is
 * NOT rendered — inventing it would breach the passthrough rule.
 *
 * Gate: the line renders only when there ARE inputs to sharpen
 * (`inputs.length > 0`) — otherwise the "a few inputs would sharpen…" claim
 * would be false, so it renders nothing. COMPLETE borders only (L1 guard).
 */

import { AlertTriangle } from 'lucide-react'
import { typography } from '@/styles/typography'
import { V7_MODEL_LIMIT_CAVEAT } from './v7GuidanceCopy'

export interface V7SharpenInput {
  /** Display label — an evidence-gap factor label. */
  label: string
  /** Canvas focus target, when the gap maps to a node. */
  nodeId?: string
}

/**
 * Where a candidate quote came from. Only `user_brief` may ever be attributed
 * to the user.
 *
 * · `user_brief`    — the framing goal the USER typed. `composeBriefText`
 *                     (`src/hooks/useAsk.ts`) interpolates these exact bytes
 *                     into the brief this app submits, so quoting them back is
 *                     a true statement about what they wrote.
 * · `derived_label` — OUR text (`useResultsSectionData`'s `goalLabel`). Passed
 *                     in with its true provenance so the refusal happens HERE,
 *                     on the live path, where re-attributing it would have to
 *                     be a visible diff in this file.
 */
export type V7BriefQuoteSource = 'user_brief' | 'derived_label'

export interface V7BriefQuote {
  /** The candidate text, verbatim. */
  text: string
  /** Its provenance — the whole point (ROADMAP 2.993). */
  source: V7BriefQuoteSource
}

export interface V7SharpenLineProps {
  /**
   * A candidate quote WITH its provenance. Rendered under "You wrote" only
   * when `source === 'user_brief'`; anything else is our own text and is
   * silently withheld rather than put in the user's mouth.
   */
  briefQuote?: V7BriefQuote | null
  /** Inputs worth confirming — derived from `confidence.topEvidenceGaps`. */
  inputs: V7SharpenInput[]
  /** Focus the matching canvas element for an input. */
  onFocusNode?: (nodeId: string) => void
}

/** How many inputs show before collapsing into "and N more". */
const VISIBLE_INPUTS = 3

export function V7SharpenLine({ briefQuote, inputs, onFocusNode }: V7SharpenLineProps) {
  // Honest absence — nothing to sharpen, so make no claim.
  if (inputs.length === 0) return null

  const shown = inputs.slice(0, VISIBLE_INPUTS)
  const moreCount = inputs.length - shown.length
  // PROVENANCE GATE (ROADMAP 2.993) — "You wrote" is a claim about AUTHORSHIP,
  // so only text whose provenance is the user's own brief may appear under it.
  // A derived label is withheld entirely: saying nothing is honest, saying
  // "you wrote" about our own sentence is not.
  const quote = briefQuote?.source === 'user_brief' ? briefQuote.text.trim() : ''

  return (
    <section
      data-testid="v7-sharpen-line"
      className="rounded-lg border border-panel-border bg-panel px-3 py-2.5"
    >
      <p className={`${typography.panelBody} text-text-header font-semibold`}>
        A few inputs would sharpen these results
      </p>
      {quote && (
        <p className={`${typography.panelBody} text-text-body mt-1`} data-testid="v7-sharpen-quote">
          You wrote: &ldquo;{quote}&rdquo;
        </p>
      )}
      <p className={`${typography.panelMeta} text-text-light mt-1`}>
        {V7_MODEL_LIMIT_CAVEAT} Confirm these before you lean on the result.
      </p>
      <ul className="mt-2 space-y-0.5">
        {shown.map((input, i) => {
          const canFocus = Boolean(input.nodeId && onFocusNode)
          const content = (
            <span className="inline-flex items-start gap-1.5">
              <AlertTriangle className="mt-[1px] h-3 w-3 flex-none text-warning" aria-hidden />
              <span>{input.label}</span>
            </span>
          )
          return (
            <li key={`${input.label}-${i}`} className={`${typography.panelMeta} text-text-body`}>
              {canFocus ? (
                <button
                  type="button"
                  onClick={() => onFocusNode?.(input.nodeId as string)}
                  className="text-left hover:text-text-header"
                >
                  {content}
                </button>
              ) : (
                content
              )}
            </li>
          )
        })}
      </ul>
      {moreCount > 0 && (
        <p className={`${typography.panelMeta} text-text-light mt-1`} data-testid="v7-sharpen-more">
          and {moreCount} more
        </p>
      )}
    </section>
  )
}

export default V7SharpenLine
