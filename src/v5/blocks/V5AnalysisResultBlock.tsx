/**
 * V5AnalysisResultBlock — renders V5 OlumiResponse.analysis_result.
 *
 * Card content:
 *   - Always: summary text, uncertainty calibration copy, win_probabilities
 *     as pills.
 *   - When the turn carries a 0.30 `decision_review` with prose: the five
 *     fields no other wire block delivers — `narrative_summary`,
 *     `story_headlines`, `robustness_explanation`, `readiness_rationale`,
 *     `scenario_contexts` (ROADMAP 2.154). This is where the analysis
 *     EXPLANATION lives, so it renders here beside the summary it explains.
 *   - When the payload on that key is genuinely malformed: a hidden operator
 *     marker, and nothing else changes.
 *
 * ⚠ ROADMAP 2.154 — WHAT THIS CARD USED TO DO. It called
 * `extractDecisionReview`, which validated the retired M1 REST shape, so
 * `review` was `null` on EVERY live turn. Two consequences, both live: the
 * five prose fields above were dropped after CEE had paid a real ~8-9s
 * gpt-4.1 call for them, and the `enrichment-invalid` marker below mounted on
 * every single analysis turn (`review === null && block.enrichment` — and
 * `block.enrichment` is always truthy, it carries 13 keys). The card now asks
 * the adapter WHICH state the wire is in rather than inferring malformed-ness
 * from a null.
 *
 * The prose is CEE-authored and has already passed CEE's own egress gate. It
 * is rendered verbatim — no summarising, truncating, re-ordering or
 * re-wording, and no UI-authored copy is added to it. The only UI-side
 * resolution is option_id → option label, taken from the same payload's
 * `option_comparison` (the chain the pills already use).
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
import { readDecisionReviewWireState } from '../decisionReviewAdapter'
import {
  buildV5VerdictReportLike,
  resolveLeaderKeys,
  resolveOptionLabelById,
} from '../mapV5AnalysisToReport'
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
  // ROADMAP 2.154 — the wire has FOUR states and only ONE of them is an alarm.
  // `absent` (the enricher's soft-fail skips) and `degraded`
  // (`decision_review: null`, CEE's "attempted, degraded at the call site")
  // are both by design; `malformed` is the alarm; `v0_30` is the live shape.
  const reviewState = readDecisionReviewWireState(block.enrichment)
  const review030 = reviewState.kind === 'v0_30' ? reviewState.review : null
  // Gate on hasProse, not on validity: a valid 0.30 review can legitimately
  // carry no prose (the LLM may return empty collections), and an empty
  // section is worse than no section.
  const showProse = review030?.hasProse === true
  const hasReview = reviewState.kind === 'v0_30' || reviewState.kind === 'm1'
  const optionLabels = resolveOptionLabelById(block.enrichment)
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
      data-has-decision-review={hasReview ? 'true' : 'false'}
      data-decision-review-state={reviewState.kind}
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

      {/*
        ROADMAP 2.154 — the five orphaned prose fields. Rendered in the
        producer's own wire order (narrative → per-option headlines →
        robustness → readiness → scenarios); no re-ordering, no re-wording.
        Every field carries its own absence arm, so a partial payload renders
        exactly what it carries and nothing else — never a placeholder.

        The only labels below ("Primary risk", "Stability factors",
        "Fragility factors") name the wire fields they introduce, in sentence
        case. They are structural: two unlabelled string lists would be
        unreadable. No label interprets, summarises or qualifies the model's
        prose.
      */}
      {showProse && review030 && (
        <div
          className="space-y-3 border-t border-panel-border pt-3"
          data-testid="v5-analysis-result-decision-review"
          data-produced-at={review030.produced_at}
        >
          {review030.narrative_summary !== null && (
            <p
              className={typography.panelBody}
              data-testid="v5-analysis-result-narrative-summary"
            >
              {review030.narrative_summary}
            </p>
          )}

          {review030.story_headlines.length > 0 && (
            <ul className="space-y-1" data-testid="v5-analysis-result-story-headlines">
              {review030.story_headlines.map((h) => (
                <li
                  key={h.optionId}
                  className={typography.panelBody}
                  data-testid="v5-analysis-result-story-headline"
                  data-option-id={h.optionId}
                >
                  {/*
                    The label when the payload resolves one for this id, else
                    the raw id. Showing the raw id is honest; showing nothing
                    would silently drop a headline the producer paid for.
                  */}
                  <span className="font-medium text-text-body">
                    {optionLabels.get(h.optionId) ?? h.optionId}
                  </span>
                  <span className="text-text-light"> — </span>
                  <span>{h.headline}</span>
                </li>
              ))}
            </ul>
          )}

          {review030.robustness_explanation !== null && (
            <div
              className="space-y-1"
              data-testid="v5-analysis-result-robustness-explanation"
            >
              {review030.robustness_explanation.summary !== null && (
                <p
                  className={typography.panelBody}
                  data-testid="v5-analysis-result-robustness-summary"
                >
                  {review030.robustness_explanation.summary}
                </p>
              )}
              {review030.robustness_explanation.primary_risk !== null && (
                <p
                  className={`${typography.panelBody} text-text-light`}
                  data-testid="v5-analysis-result-robustness-primary-risk"
                >
                  <span className="font-medium">Primary risk: </span>
                  {review030.robustness_explanation.primary_risk}
                </p>
              )}
              {review030.robustness_explanation.stability_factors.length > 0 && (
                <div data-testid="v5-analysis-result-stability-factors">
                  <p className={`${typography.panelMeta} text-text-light font-medium`}>
                    Stability factors
                  </p>
                  <ul className="list-disc pl-4">
                    {review030.robustness_explanation.stability_factors.map((f, i) => (
                      <li
                        // Index key: the LLM can legitimately repeat a factor
                        // string, and this list is display-only — never
                        // reordered, filtered or keyed on by anything else.
                        key={`${i}-${f}`}
                        className={typography.panelBody}
                        data-testid="v5-analysis-result-stability-factor"
                      >
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {review030.robustness_explanation.fragility_factors.length > 0 && (
                <div data-testid="v5-analysis-result-fragility-factors">
                  <p className={`${typography.panelMeta} text-text-light font-medium`}>
                    Fragility factors
                  </p>
                  <ul className="list-disc pl-4">
                    {review030.robustness_explanation.fragility_factors.map((f, i) => (
                      <li
                        // Index key: the LLM can legitimately repeat a factor
                        // string, and this list is display-only — never
                        // reordered, filtered or keyed on by anything else.
                        key={`${i}-${f}`}
                        className={typography.panelBody}
                        data-testid="v5-analysis-result-fragility-factor"
                      >
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {review030.readiness_rationale !== null && (
            <p
              className={typography.panelBody}
              data-testid="v5-analysis-result-readiness-rationale"
            >
              {review030.readiness_rationale}
            </p>
          )}

          {review030.scenario_contexts.length > 0 && (
            <ul className="space-y-1" data-testid="v5-analysis-result-scenario-contexts">
              {review030.scenario_contexts.map((s) => (
                <li
                  key={s.id}
                  className={`${typography.panelBody} text-text-light`}
                  data-testid="v5-analysis-result-scenario-context"
                  data-scenario-id={s.id}
                >
                  {s.trigger_description !== null && <span>{s.trigger_description}</span>}
                  {s.trigger_description !== null && s.consequence !== null && <span> </span>}
                  {s.consequence !== null && <span>{s.consequence}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {reviewState.kind === 'malformed' && (
        // DEV diagnostic — a record IS present on `enrichment.decision_review`
        // but it matches neither the live 0.30 shape nor the M1 REST shape.
        // Users see only the summary card; operators see this in the DOM.
        //
        // ⚠ This condition used to be `review === null && block.enrichment`,
        // which mounted on EVERY live analysis turn (the adapter validated a
        // retired shape, so `review` was always null, and `block.enrichment`
        // is always truthy). A marker that fires every time is not an alarm,
        // it is noise — and it taught a derivation to conclude the payload was
        // being dropped by the untyped PLoT→CEE seam when it was being dropped
        // right here. It now fires only on genuinely unrecognisable content;
        // `absent` and `degraded` are by-design states and mount nothing.
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
