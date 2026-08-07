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
import { memo, useMemo, type ReactElement } from 'react'
import { typography } from '../../styles/typography'
import type { V5AnalysisResultBlock as V5AnalysisResultBlockType } from '../../canvas/conversation/types'
import { readDecisionReviewWireState } from '../decisionReviewAdapter'
import {
  buildV5VerdictReportLike,
  resolveLeaderKeys,
  resolveOptionLabelById,
} from '../mapV5AnalysisToReport'
import { useCanvasNodeLabels, resolveCanvasLabel } from './useCanvasLabels'
import { deriveDecisionVerdict } from '../../lib/decisionVerdict'
import { isRecord } from '../../lib/guards'
import { formatProbabilityWithResolution } from '../../utils/formatPercent'
import { calibrateUncertaintyCopy } from '../../components/results/utils/uncertaintyCalibration'

export interface V5AnalysisResultBlockProps {
  block: V5AnalysisResultBlockType
}

/**
 * ⭐ ROADMAP 2.236 — the Olumi decision-review chips now apply the shared floor.
 *
 * This was `${Math.round(p * 100)}%`, a fourth private percentage rule, and it
 * is what a real-browser walk photographed printing
 * `Phased Hub-and-Spoke Pilot · 0%` for `win_probability = 0.002675` — in the
 * SAME capture where the CEE prose immediately above the chips read "each has
 * less than a 1% chance" (walk-548-pixels.md F5). The chip and the sentence
 * above it now agree.
 */
function formatProbability(p: number): string {
  if (!Number.isFinite(p)) return '—'
  return formatProbabilityWithResolution(p, undefined)
}

/**
 * ROADMAP 2.154 rider — every CEE-authored prose node gets this.
 *
 * `whitespace-pre-wrap`: the model's prose can carry its own newlines and
 * paragraph breaks. Default HTML collapsing silently flattened them into one
 * run-on block, which is a rewrite of the producer's text by omission — the
 * one thing this card promises not to do.
 *
 * `break-words` + `min-w-0`: a single long unbroken token (a URL, an
 * identifier, a long option label) otherwise refuses to wrap and overflows the
 * card in a narrow column. `min-w-0` is required on the flex/grid children for
 * `break-words` to take effect at all.
 *
 * ⚠ Both are emitted CLASSES. jsdom asserts they are present; it does NOT
 * render them, so this lane does not prove the wrapping BEHAVES — that needs
 * the live-browser probe, which is declared undone.
 */
const PROSE_WRAP = 'whitespace-pre-wrap break-words min-w-0'

function finiteNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/**
 * One labelled bullet list of factor strings — `stability_factors` and
 * `fragility_factors` render identically and used to do so as two byte-identical
 * JSX blocks differing only in a title, two test ids and the array.
 *
 * This is the exact duplication class `ClampToggle` was extracted for one PR
 * earlier in the same sprint: two copies where the SECOND copy is what makes a
 * change to the first silently partial. The index-key rationale in particular
 * existed twice, verbatim, so a reader had no way to know whether the two were
 * meant to agree.
 *
 * Renders nothing for an empty list — every field on this card carries its own
 * absence arm and never a placeholder.
 */
function FactorList({
  title,
  factors,
  sectionTestId,
  itemTestId,
}: {
  title: string
  factors: ReadonlyArray<string>
  sectionTestId: string
  itemTestId: string
}): ReactElement | null {
  if (factors.length === 0) return null
  return (
    <div data-testid={sectionTestId}>
      <p className={`${typography.panelMeta} text-text-light font-medium`}>{title}</p>
      <ul className="list-disc pl-4">
        {factors.map((f, i) => (
          <li
            // Index key: the LLM can legitimately repeat a factor string, and
            // this list is display-only — never reordered, filtered or keyed on
            // by anything else.
            key={`${i}-${f}`}
            className={`${typography.panelBody} ${PROSE_WRAP}`}
            data-testid={itemTestId}
          >
            {f}
          </li>
        ))}
      </ul>
    </div>
  )
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
  const robustness = isRecord(enrichment?.robustness) ? enrichment!.robustness : undefined
  const robustnessLevel = typeof robustness?.level === 'string' ? robustness.level : undefined
  const robustnessLabel = typeof robustness?.label === 'string' ? robustness.label : undefined

  const comparisons = Array.isArray(enrichment?.option_comparison)
    ? (enrichment!.option_comparison as unknown[])
    : []
  const entries = comparisons.filter(isRecord) as Array<Record<string, unknown>>
  const headline =
    entries.find((e) => (e.id ?? e.option_id) === leadingOptionId) ?? entries[0]
  const outcome = isRecord(headline?.outcome) ? headline!.outcome : undefined

  return {
    robustnessLevel,
    robustnessLabel,
    p10: finiteNumber(outcome?.p10),
    p90: finiteNumber(outcome?.p90),
  }
}

/**
 * ⭐ R-4 — ONE OPTION-LABEL POLICY FOR src/v5/blocks, AND IT REFUSES RAW IDS.
 *
 * WHAT THIS REPLACED, AND WHY IT WAS A DEFECT AND NOT A STYLE CHOICE. The story
 * headlines used to resolve their label as `optionLabels.get(id) ?? id`, under a
 * comment arguing *"showing the raw id is honest; showing nothing would silently
 * drop a headline the producer paid for"*. The first clause is false and the
 * second is a false dilemma:
 *
 *   · The live payloads' `story_headlines` keys are `opt_status_quo` /
 *     `opt_hubspot` — a direct `RAW_ID_PATTERN` match. So the fallthrough is not
 *     a hypothetical: it prints a wire identifier to the user as copy, in a card
 *     whose own docstring promises no UI-authored copy, exactly when
 *     `option_comparison` misses. And it CAN miss — the wire ships a sibling
 *     `option_comparison_status` field precisely because that array is not
 *     guaranteed.
 *   · Both sibling blocks in this directory already refuse to do it, through
 *     ONE shared policy: `resolveCanvasLabel` returns `null` rather than the id
 *     ("that is the whole point … there is no way to accidentally fall through
 *     to the identifier") and additionally rejects a stored label that is ITSELF
 *     a raw id, because upstream sometimes seeds a node's label from its id.
 *     This card was a THIRD policy in the same folder, and the weakest of the
 *     three.
 *   · Nothing is dropped. The headline still renders; only the unresolvable
 *     LABEL is omitted. That is the `V5ExplanationBlock` rule (omit what cannot
 *     be named) applied where `V5FlipAnalysisBlock`'s reason to keep the row
 *     also holds (the row carries producer content that would be lost with it).
 *     The id survives as the `data-option-id` machine reference, which is the
 *     use CEE's field-coverage allowlist permits and the siblings also keep.
 *
 * THE CANVAS-STORE TIER IS A SECOND, SEPARATE FIX. The old path consulted only
 * the payload, so an option whose label WAS in the canvas store went unlabelled
 * anyway. Both tiers now feed one map and both pass through the null-refusing
 * resolver, so a raw-id-shaped label is rejected whichever tier supplied it.
 *
 * Payload FIRST, canvas store second: the payload's `option_comparison` label is
 * the producer's own naming for the very payload being rendered, and preferring
 * it keeps every currently-labelled headline byte-identical. The store is a
 * fallback, not an override.
 */
function useOptionLabelResolver(
  enrichment: Record<string, unknown> | undefined,
): (optionId: string) => string | null {
  const canvasLabels = useCanvasNodeLabels()
  const merged = useMemo(() => {
    const map = new Map<string, string>(canvasLabels)
    // ⚠ THE POLICY IS APPLIED PER TIER, NOT ONCE AT THE END. This is the A1 fix
    // from the adversarial review of PR #539, and the ordering is the whole point.
    //
    // The first cut merged both tiers with "payload wins" and resolved ONCE
    // afterwards. When the producer seeds `option_label` from the option's own id
    // — the exact upstream behaviour `useCanvasLabels` warns about — that
    // raw-id-shaped payload label OVERWROTE a good store label, and only then was
    // it rejected. Nothing rendered, though an honest label sat in the fallback
    // tier: the fallback was dead precisely when it was needed.
    //
    // So a tier may only WIN with a label that has already survived the policy.
    // `resolveCanvasLabel` is applied to the payload map itself, which reuses the
    // one null-refusing + RAW_ID_PATTERN policy rather than re-implementing half
    // of it here.
    //
    // `resolveOptionLabelById` builds a fresh Map per call, so it is invoked
    // INSIDE the memo and keyed on `enrichment` — calling it outside would make
    // the dependency change on every render and the memo a no-op.
    const payloadLabels = resolveOptionLabelById(enrichment)
    for (const id of payloadLabels.keys()) {
      const honest = resolveCanvasLabel(id, payloadLabels)
      if (honest !== null) map.set(id, honest)
    }
    return map as ReadonlyMap<string, string>
  }, [canvasLabels, enrichment])
  // Applied a final time so there is ONE exit point for the policy. Idempotent by
  // construction: every entry in `merged` already survived it.
  return (optionId: string) => resolveCanvasLabel(optionId, merged)
}

function V5AnalysisResultBlockImpl({ block }: V5AnalysisResultBlockProps): ReactElement {
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
  const resolveOptionLabel = useOptionLabelResolver(block.enrichment)
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
              className={`${typography.panelBody} ${PROSE_WRAP}`}
              data-testid="v5-analysis-result-narrative-summary"
            >
              {review030.narrative_summary}
            </p>
          )}

          {review030.story_headlines.length > 0 && (
            <ul className="space-y-1" data-testid="v5-analysis-result-story-headlines">
              {review030.story_headlines.map((h) => {
                // R-4: the shared null-refusing policy. `null` means no honest
                // label exists for this id — the label and its separator are
                // then omitted and the producer's headline renders alone. The id
                // never becomes user copy; it stays a machine reference on
                // `data-option-id`. See `useOptionLabelResolver` above.
                const label = resolveOptionLabel(h.optionId)
                return (
                  <li
                    key={h.optionId}
                    className={`${typography.panelBody} ${PROSE_WRAP}`}
                    data-testid="v5-analysis-result-story-headline"
                    data-option-id={h.optionId}
                  >
                    {label !== null && (
                      <>
                        <span className="font-medium text-text-body">{label}</span>
                        <span className="text-text-light"> — </span>
                      </>
                    )}
                    <span>{h.headline}</span>
                  </li>
                )
              })}
            </ul>
          )}

          {review030.robustness_explanation !== null && (
            <div
              className="space-y-1"
              data-testid="v5-analysis-result-robustness-explanation"
            >
              {review030.robustness_explanation.summary !== null && (
                <p
                  className={`${typography.panelBody} ${PROSE_WRAP}`}
                  data-testid="v5-analysis-result-robustness-summary"
                >
                  {review030.robustness_explanation.summary}
                </p>
              )}
              {review030.robustness_explanation.primary_risk !== null && (
                <p
                  className={`${typography.panelBody} text-text-light ${PROSE_WRAP}`}
                  data-testid="v5-analysis-result-robustness-primary-risk"
                >
                  <span className="font-medium">Primary risk: </span>
                  {review030.robustness_explanation.primary_risk}
                </p>
              )}
              <FactorList
                title="Stability factors"
                factors={review030.robustness_explanation.stability_factors}
                sectionTestId="v5-analysis-result-stability-factors"
                itemTestId="v5-analysis-result-stability-factor"
              />
              <FactorList
                title="Fragility factors"
                factors={review030.robustness_explanation.fragility_factors}
                sectionTestId="v5-analysis-result-fragility-factors"
                itemTestId="v5-analysis-result-fragility-factor"
              />
            </div>
          )}

          {review030.readiness_rationale !== null && (
            <p
              className={`${typography.panelBody} ${PROSE_WRAP}`}
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
                  className={`${typography.panelBody} text-text-light ${PROSE_WRAP}`}
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

/**
 * E-1 — memoised on `block`, following the house convention.
 *
 * This card lives in the streamed conversation panel, so it re-renders whenever
 * ANY sibling block or message arrives — roughly ten times on a single analysis
 * turn. Each render re-does the whole render-body projection from the untyped
 * `enrichment` passthrough: the four-state wire classification with its two shape
 * validators, the uncertainty-input walk over `option_comparison`, the verdict
 * derivation, the leader-key resolution and the probability sort. Post-#535 that
 * is roughly an order more work per render than it was before, for a `block` prop
 * that does not change between those renders.
 *
 * `memo` with the default shallow compare is exactly right here: `block` is the
 * one prop, and it is a wire object the panel holds by reference for the life of
 * the turn. The three sibling cards doing comparable derivation
 * (`DecisionConfidencePanel`, `AnalysisHeroV17`, `StressTestSection`) already use
 * this convention, including its `memo(function Name(...))` form so the component
 * keeps its name in React DevTools and in test output.
 */
export const V5AnalysisResultBlock = memo(V5AnalysisResultBlockImpl)
V5AnalysisResultBlock.displayName = 'V5AnalysisResultBlock'

export default V5AnalysisResultBlock
