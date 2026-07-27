/**
 * V5AnalysisResultBlock — renders V5 OlumiResponse.analysis_result.
 *
 * Two render modes:
 *   1. Enrichment contains a valid decision_review → caller routes the
 *      payload to DecisionReviewPanel (not rendered here; this block stays
 *      inline in chat with a summary card).
 *   2. Enrichment missing / malformed → inline summary card with
 *      summary text and win_probabilities as pills.
 *
 * Design tokens (DS v5 §21.2):
 *   - Card frame: bg-panel + rounded-xl + border-panel-border
 *   - Card header: typography.panelHeader (14px semibold)
 *   - Body: typography.panelBody (12px)
 *   - Pills: bg-transparent border-{semantic}/30 text-text-body
 */
import { type ReactElement } from 'react'
import { typography } from '../../styles/typography'
import type { V5AnalysisResultBlock as V5AnalysisResultBlockType } from '../../canvas/conversation/types'
import { extractDecisionReview } from '../decisionReviewAdapter'
import { buildV5VerdictReportLike, resolveLeaderKeys } from '../mapV5AnalysisToReport'
import { deriveDecisionVerdict } from '../../lib/decisionVerdict'
import { calibrateUncertaintyCopy } from '../../components/results/utils/uncertaintyCalibration'

export interface V5AnalysisResultBlockProps {
  block: V5AnalysisResultBlockType
}

function formatProbability(p: number): string {
  if (!Number.isFinite(p)) return '—'
  return `${Math.round(p * 100)}%`
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v)
}

function finiteNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/**
 * Sci-4B: resolve the same two inputs calibrateUncertaintyCopy needs
 * (robustness band + headline option's outcome interval) from the raw,
 * untyped `block.enrichment` passthrough. Mirrors mapV5AnalysisToReport's
 * headline-option resolution (prefer the entry matching leading_option_id,
 * else the first option_comparison entry) — kept local and minimal since
 * this component only needs two numbers, not the full ReportV1 mapping.
 */
function resolveUncertaintyInputs(
  enrichment: Record<string, unknown> | undefined,
  leadingOptionId: string | null,
): { robustnessLevel?: string; robustnessLabel?: string; p10: number | null; p90: number | null } {
  const robustness = isPlainObject(enrichment?.robustness) ? enrichment!.robustness : undefined
  const robustnessLevel = typeof robustness?.level === 'string' ? robustness.level : undefined
  const robustnessLabel = typeof robustness?.label === 'string' ? robustness.label : undefined

  const comparisons = Array.isArray(enrichment?.option_comparison)
    ? (enrichment!.option_comparison as unknown[])
    : []
  const entries = comparisons.filter(isPlainObject) as Array<Record<string, unknown>>
  const headline =
    entries.find((e) => (e.id ?? e.option_id) === leadingOptionId) ?? entries[0]
  const outcome = isPlainObject(headline?.outcome) ? headline!.outcome : undefined

  return {
    robustnessLevel,
    robustnessLabel,
    p10: finiteNumber(outcome?.p10),
    p90: finiteNumber(outcome?.p90),
  }
}

export function V5AnalysisResultBlock({ block }: V5AnalysisResultBlockProps): ReactElement {
  const review = extractDecisionReview(block.enrichment)
  const hasProbs =
    block.win_probabilities && Object.keys(block.win_probabilities).length > 0

  // Sci-4B: verbal uncertainty calibration — same tiers/copy as the results
  // panel headline (DecisionConfidencePanel), read from this block's raw
  // enrichment passthrough. Honest-render: null when the wire carries no
  // robustness signal at all.
  const uncertaintyInputs = resolveUncertaintyInputs(block.enrichment, block.leading_option_id)
  const uncertaintyCopy = calibrateUncertaintyCopy(uncertaintyInputs)

  // ROADMAP 1.267 — WHO leads and WHETHER anyone does are different questions.
  //
  // The leader treatment below (first position, `data-leader`, the heavier
  // border) was gated ONLY on `resolveLeaderKeys` returning a non-empty set,
  // which happens exactly when `leading_option_id` is a non-empty string. That
  // covers the WITHHELD turn — CEE nulls the field — but it is NOT equivalent
  // to the shared verdict, and the gap is a live producer state, not a
  // hypothetical: on a NEAR-TIE run PLoT sends `near_tie.is_tie: true` (or a
  // `very_close` band) WITH a `leading_option_id`, so `hasLeadingOption` is
  // false while the implicit gate stays open and this card crowned an option
  // the producer had just called too close to call.
  //
  // So the verdict is wired in explicitly rather than pinned as equivalent.
  // `deriveDecisionVerdict` is the one module entitled to answer WHETHER; it
  // is quoted, never re-derived, and `resolveLeaderKeys` keeps answering WHO.
  const verdict = deriveDecisionVerdict(buildV5VerdictReportLike(block))
  const leaderKeys = verdict.hasLeadingOption
    ? resolveLeaderKeys(block.enrichment, block.leading_option_id)
    : new Set<string>()

  // Sort so the leading option appears first and the rest descending by prob.
  //
  // The probability-descending tail is DATA ordering over a set the producer
  // itself ranks, and it stays on a withheld run — the pills carry their own
  // numbers, so the order restates a fact already on screen rather than
  // designating a winner. What goes is the leader-first hoist, which promotes
  // ONE option above its own number. With `leaderKeys` empty the `aLeads`
  // branch is inert by construction; it is left in place because the sort is
  // one comparator for both states.
  const sortedProbs = hasProbs
    ? Object.entries(block.win_probabilities as Record<string, number>).sort(
        ([keyA, pA], [keyB, pB]) => {
          const aLeads = leaderKeys.has(keyA)
          const bLeads = leaderKeys.has(keyB)
          if (aLeads !== bLeads) return aLeads ? -1 : 1
          return pB - pA
        },
      )
    : []

  return (
    <div
      data-testid="v5-analysis-result"
      data-has-decision-review={review ? 'true' : 'false'}
      className="rounded-xl border border-panel-border bg-panel p-4 space-y-3"
    >
      <h3
        className={typography.panelHeader}
        data-testid="v5-analysis-result-heading"
      >
        Analysis result
      </h3>
      <p className={typography.panelBody} data-testid="v5-analysis-result-summary">
        {block.summary}
      </p>

      {uncertaintyCopy && (
        <p
          className={`${typography.panelMeta} text-text-light`}
          data-testid="v5-analysis-result-uncertainty-copy"
        >
          {uncertaintyCopy.text}
        </p>
      )}

      {hasProbs && (
        <div
          className="flex flex-wrap gap-2"
          role="list"
          aria-label="Option win probabilities"
          data-testid="v5-analysis-result-probabilities"
        >
          {/*
            `optionKey` is the win_probabilities KEY — an option LABEL on real
            staging payloads, an option_id on some paths. It is the human string
            we render, so it is NOT renamed to optionId: the previous name is
            what disguised the identity-space mismatch fixed here.
          */}
          {sortedProbs.map(([optionKey, prob]) => {
            const isLeader = leaderKeys.has(optionKey)
            return (
              <span
                key={optionKey}
                role="listitem"
                className={[
                  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5',
                  'bg-transparent text-text-body',
                  isLeader ? 'border border-option/50' : 'border border-option/30',
                  typography.panelMeta,
                ].join(' ')}
                data-leader={isLeader ? 'true' : 'false'}
              >
                <span className="font-medium">{optionKey}</span>
                <span className="text-text-light">·</span>
                <span>{formatProbability(prob)}</span>
              </span>
            )
          })}
        </div>
      )}

      {review === null && block.enrichment && (
        // DEV diagnostic — enrichment present but decision_review malformed.
        // Users see only the summary card; operators see this in the DOM.
        <div
          className="hidden"
          data-testid="v5-analysis-result-enrichment-invalid"
          aria-hidden="true"
        />
      )}
    </div>
  )
}

export default V5AnalysisResultBlock
