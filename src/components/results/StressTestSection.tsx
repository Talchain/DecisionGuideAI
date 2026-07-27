/**
 * StressTestSection — Brief 5.8B D4. Replaces the legacy ChallengeSection
 * accordion (whose user-facing title read "Before-you-decide") with a
 * wireframe-aligned T2 stress-test.
 *
 * Subsections (each independently suppressed when empty):
 *   1. Sensitive assumptions — node-based, sourced from `factor_sensitivity`
 *      where `rank_flip_rate >= 0.15`, max 3.
 *   2. Thinking patterns — two deterministic templates from
 *      `stressTestTemplates.ts` (Disconfirmation + Outside view).
 *      Disconfirmation context-line gates on top-driver confidence sourced
 *      from `factor_sensitivity` (the authoritative post-analysis source per
 *      useResultsSectionData.ts:1316-1322), NOT from a per-row triage
 *      `confidence` field that may shadow it.
 *   3. Fragile factors — edge-based; preserves the existing 5.7 D11
 *      alt-winner grouping verbatim by reusing the FragileEdgeGroupCard
 *      exported from ChallengeSection.
 *
 * Header counter sums all three subsections. Preview line uses the top
 * factor by `rank_flip_rate`, with a fallback when none meets the threshold.
 *
 * Module boundary: `stressTestTemplates.ts` is React-free pure functions, so
 * V5's `decision_review` payload (`pre_mortem`, `framing_check`,
 * `key_assumptions`, `scenario_contexts`) can replace them later without
 * touching the StressTestSection structure.
 */

import { memo } from 'react'
import { Accordion } from '@/canvas/components/pre-analysis/primitives/Accordion'
import {
  FragileEdgeGroupCard,
  type ChallengeFragileEdge,
} from './ChallengeSection'
import {
  stripEncodingNotation,
  stripStatusQuoSuffixForDisplay,
} from './utils/cleanFactorLabel'
import { typography } from '../../styles/typography'
import {
  buildDisconfirmationCard,
  buildOutsideViewCard,
} from './utils/stressTestTemplates'
import { SensitivityReferenceCaption } from './SensitivityReferenceCaption'
import { openAskOlumi } from './coaching/askOlumiStore'
import { resolveFactorConfidenceDisplay } from './driverConfidenceDisplayPolicy'
import type { DriverItem } from './types'

const RANK_FLIP_THRESHOLD = 0.15
const MAX_SENSITIVE = 3

export interface StressTestSectionProps {
  /** Drivers (post-analysis) — surfaces sensitive factors and the top driver. */
  drivers: DriverItem[]
  /** Fragile edges (post-analysis) — passthrough to the existing 5.7 D11 grouping. */
  fragileEdges?: ChallengeFragileEdge[]
  /** Wave 2 flag-scoped retirement: when false, the UI-authored Thinking
   * patterns templates do not render (the merged analysis panel's
   * producer-honest surfaces replace locally-authored coaching narrative;
   * V5 decision_review is the eventual owner). Default true — flag-off
   * behaviour is byte-identical. */
  showThinkingPatterns?: boolean
  /**
   * ROADMAP 1.267 — `!DecisionVerdict.hasLeadingOption`, quoted from
   * `useResultsSectionData`, never re-derived here.
   *
   * The two Thinking-pattern cards are UI-AUTHORED and every one of their
   * four strings names a recommendation the producer has withdrawn:
   * "switch your recommendation from X to Y", "does X usually outperform Y",
   * and the two Ask-Olumi prompt drafts. Their only gate was
   * `if (!winnerLabel) return null` in ResultsBody — and `winnerLabel` still
   * resolves on a withheld run, because `recommendedOption` comes from
   * `determineWinnerSelection` (identity), not from the verdict
   * (entitlement). Identity survives withholding by design
   * (decisionVerdict.ts); the RECOMMENDATION does not.
   *
   * REQUIRED, not optional-defaulting-false: an opt-in gate is a gate every
   * future call site can forget. The compiler names every call site instead.
   *
   * Sensitive assumptions and fragile factors are producer data and keep
   * rendering — suppressing the section wholesale would be the
   * over-suppression the ruling forbids.
   *
   * ⚠ AMENDED (this lane): this doc used to end "Scope is deliberately the two
   * authored cards ONLY", and that sentence was read as settling the fragile
   * factors — it did not. It settled their VISIBILITY (they stay) and said
   * nothing about their PROSE, which presupposed a recommendation in five
   * strings inside `FragileEdgeGroupCard`. The card now takes this same
   * boolean; the rows, counts, labels and E-values are unchanged. Suppression
   * scope is still the two authored cards; CLAIM scope is the whole section.
   */
  designationsWithheld: boolean
  /** Recommended option label (winner) — drives template question phrasing. */
  winnerLabel: string
  /** Runner-up option label (alternative) — drives template question phrasing. */
  alternativeLabel: string
  /**
   * PLoT robustness_status for this run — the SAME signal the
   * "Some analysis features unavailable … Robustness" chip uses
   * (resultsSectionData.confidence.robustnessStatus). The empty state may
   * claim "ran clean" ONLY when this is 'computed'; when absent/unavailable
   * the honest copy is "didn't run" (audit §8 P1 — false verdict copy).
   */
  robustnessStatus?: string
  /**
   * True when the engine reported a degraded/approximate pass (analysis_state
   * 'partial', GRAPH_TOO_LARGE critique, …). A degraded pass must not claim
   * the model is "currently consistent".
   */
  analysisDegraded?: boolean
  onFocusNode?: (nodeId: string) => void
  onSendMessage?: (text: string) => void
  expertMode?: boolean
  /**
   * Lane UI-W5 (reference-option disclosure): resolved label of the option
   * the sensitivities / fragile edges were computed against. Null/absent →
   * no caption.
   */
  sensitivityReferenceLabel?: string | null
}

interface SensitiveFactor {
  driver: DriverItem
  rankFlipRate: number
}

function selectSensitiveFactors(drivers: DriverItem[]): SensitiveFactor[] {
  return drivers
    .filter(d => typeof d.rankFlipRate === 'number' && d.rankFlipRate >= RANK_FLIP_THRESHOLD)
    .sort((a, b) => (b.rankFlipRate ?? 0) - (a.rankFlipRate ?? 0))
    .slice(0, MAX_SENSITIVE)
    .map(d => ({ driver: d, rankFlipRate: d.rankFlipRate as number }))
}

function PreviewLine({
  topFactorLabel,
}: {
  topFactorLabel: string | null
}) {
  if (topFactorLabel) {
    return (
      <span>
        Key challenge: <span className="text-text-body">{topFactorLabel}</span>{' '}
        dominates. Should its influence be revisited?
      </span>
    )
  }
  return <span>Review your key assumptions</span>
}

function SensitiveAssumptionCard({
  factor,
  index,
  onSendMessage,
}: {
  factor: SensitiveFactor
  index: number
  onSendMessage?: (text: string) => void
}) {
  const cleanLabel = stripEncodingNotation(factor.driver.factorLabel)
  return (
    <div
      className="border border-panel-border rounded-lg px-3 py-2 space-y-1.5"
      data-testid={`stress-test-sensitive-${index}`}
    >
      <span className={`${typography.panelMeta} text-warning`}>Sensitive</span>
      <p className={`${typography.panelBody} text-text-body`}>
        {cleanLabel}. A shift could change the result.
      </p>
      <button
        type="button"
        disabled={!onSendMessage}
        onClick={onSendMessage
          ? () => openAskOlumi({
              context: `${cleanLabel} — a shift could change the result.`,
              draft: `What if ${cleanLabel} changes? Walk me through the impact.`,
              label: 'What if this changes?',
            })
          : undefined}
        className={`${typography.panelMeta} text-info border border-info/30 rounded-full px-2.5 py-1 bg-transparent hover:bg-panel-hover cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-1 disabled:cursor-default disabled:opacity-50`}
        aria-label={`Explore what happens if ${cleanLabel} changes`}
      >
        What if this changes?
      </button>
    </div>
  )
}

function ThinkingPatternCardView({
  card,
  testId,
  onSendMessage,
  promptBuilder,
}: {
  card: { question: string; context?: string; chipLabel: string }
  testId: string
  onSendMessage?: (text: string) => void
  promptBuilder: () => string
}) {
  return (
    <div
      className="border border-panel-border rounded-lg px-3 py-2 space-y-1.5"
      data-testid={testId}
    >
      <p className={`${typography.panelBody} text-text-body`}>{card.question}</p>
      {card.context && (
        <p className={`${typography.panelMeta} text-text-light`}>{card.context}</p>
      )}
      <button
        type="button"
        disabled={!onSendMessage}
        onClick={onSendMessage
          ? () => openAskOlumi({
              context: card.context ? `${card.question} ${card.context}` : card.question,
              draft: promptBuilder(),
              label: card.chipLabel,
            })
          : undefined}
        className={`${typography.panelMeta} text-info border border-info/30 rounded-full px-2.5 py-1 bg-transparent hover:bg-panel-hover cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-1 disabled:cursor-default disabled:opacity-50`}
        aria-label={card.chipLabel}
      >
        {card.chipLabel}
      </button>
    </div>
  )
}

export const StressTestSection = memo(function StressTestSection({
  drivers,
  fragileEdges,
  winnerLabel,
  alternativeLabel,
  robustnessStatus,
  analysisDegraded,
  onFocusNode,
  onSendMessage,
  expertMode,
  sensitivityReferenceLabel,
  showThinkingPatterns = true,
  designationsWithheld,
}: StressTestSectionProps) {
  // ROADMAP 1.267. ONE derived boolean, used by both the count and the
  // render — the #501 lesson that a designation suppressed in the list but
  // still counted in the header is only half-suppressed.
  const renderThinkingPatterns = showThinkingPatterns && !designationsWithheld
  // ── Sensitive assumptions (node-based) ───────────────────────────────────
  const sensitiveFactors = selectSensitiveFactors(drivers)

  // ── Thinking patterns (deterministic templates) ──────────────────────────
  // Top driver is the highest-influence driver. Its confidence comes from the
  // factor_sensitivity field that flows through DriverItem.confidence
  // (useResultsSectionData maps factor_sensitivity[i].confidence to it), which
  // settles WHICH field — the display policy below settles whether it may be
  // spoken.
  const topDriver = drivers[0]
  const topDriverLabel = topDriver
    ? stripEncodingNotation(topDriver.factorLabel)
    : 'this factor'
  // ⛔ Resolved through THE policy module, not read raw. The comment that used
  // to sit here justified reading `driver.confidence` directly ("matches the
  // brief's authoritative-source rule") — true about WHICH field, silent about
  // whether that field is fit to speak. It is not: the value is the 0.25
  // placeholder, and the card asserted "limited evidence" from it.
  const topDriverConfidence = resolveFactorConfidenceDisplay({
    confidence: topDriver?.confidence,
    isDefaulted: topDriver?.isDefaultedConfidence,
    confidenceProvenance: topDriver?.confidenceProvenance,
  })

  const disconfirmation = buildDisconfirmationCard({
    winnerLabel,
    alternativeLabel,
    topDriverLabel,
    topDriverConfidence,
  })
  const outsideView = buildOutsideViewCard({
    winnerLabel,
    alternativeLabel,
  })

  // ── Fragile factors (edge-based) — verbatim 5.7 D11 alt-winner grouping ──
  const mergedFragileCards = [...(fragileEdges ?? [])]
    .sort((a, b) => {
      const aKey = a.marginal_switch_probability ?? a.switch_probability
      const bKey = b.marginal_switch_probability ?? b.switch_probability
      return bKey - aKey
    })
    .slice(0, 3)
  const fragileByAltWinner = mergedFragileCards.reduce<Record<string, typeof mergedFragileCards>>(
    (acc, card) => {
      const key = card.alternative_winner_label
        ? stripStatusQuoSuffixForDisplay(stripEncodingNotation(card.alternative_winner_label))
        : '__no_alt_winner__'
      if (!acc[key]) acc[key] = []
      acc[key].push(card)
      return acc
    },
    {},
  )
  const fragileGroups = Object.entries(fragileByAltWinner)

  // ── Counts ──────────────────────────────────────────────────────────────
  const sensitiveCount = sensitiveFactors.length
  const fragileCount = mergedFragileCards.length
  // Thinking patterns render both deterministic cards when the section
  // opens at all — they're meta-prompts, not data-derived. Wave 2: the
  // merged-panel flag retires them (showThinkingPatterns false).
  const thinkingPatternsCount = renderThinkingPatterns ? 2 : 0
  const totalCount = sensitiveCount + thinkingPatternsCount + fragileCount

  const topFactorForPreview = sensitiveFactors[0]
    ? stripEncodingNotation(sensitiveFactors[0].driver.factorLabel)
    : null

  return (
    <Accordion
      title="Stress-test your decision"
      defaultExpanded={false}
      testId="accordion-stress-test"
      rightContent={totalCount > 0 ? <span>{totalCount}</span> : undefined}
      previewLine={
        <span data-testid="stress-test-preview">
          <PreviewLine topFactorLabel={topFactorForPreview} />
        </span>
      }
    >
      <div className="space-y-3" data-testid="stress-test-section">
        {/* Lane UI-W5: reference-option disclosure — renders nothing when
            the producer did not disclose a reference option (fail-closed). */}
        <SensitivityReferenceCaption optionLabel={sensitivityReferenceLabel} />

        {/* ── Sensitive assumptions ─────────────────────────────────── */}
        {sensitiveCount > 0 && (
          <div className="space-y-1.5" data-testid="stress-test-sensitive-subsection">
            <h4 className={`${typography.panelHeader} text-text-header`}>
              Sensitive assumptions ({sensitiveCount})
            </h4>
            {sensitiveFactors.map((factor, i) => (
              <SensitiveAssumptionCard
                key={factor.driver.factorKey}
                factor={factor}
                index={i}
                onSendMessage={onSendMessage}
              />
            ))}
          </div>
        )}

        {/* ── Thinking patterns ─────────────────────────────────────── */}
        {renderThinkingPatterns && (
        <div className="space-y-1.5" data-testid="stress-test-thinking-subsection">
          <h4 className={`${typography.panelHeader} text-text-header`}>
            Thinking patterns (2)
          </h4>
          <ThinkingPatternCardView
            card={disconfirmation}
            testId="stress-test-disconfirmation"
            onSendMessage={onSendMessage}
            promptBuilder={() => `Help me steelman the case for ${alternativeLabel} over ${winnerLabel}. What evidence would make me reconsider?`}
          />
          <ThinkingPatternCardView
            card={outsideView}
            testId="stress-test-outside-view"
            onSendMessage={onSendMessage}
            promptBuilder={() => `Research how ${winnerLabel} typically performs versus ${alternativeLabel} for decisions like this one.`}
          />
        </div>
        )}

        {/* ── Fragile factors (5.7 D11 alt-winner grouping verbatim) ── */}
        {fragileCount > 0 && (
          <div className="space-y-1.5" data-testid="stress-test-fragile-subsection">
            <h4 className={`${typography.panelHeader} text-text-header`}>
              Fragile factors ({fragileCount})
            </h4>
            {fragileGroups.map(([altWinnerKey, cards]) => (
              <FragileEdgeGroupCard
                key={`stress-fragile-${altWinnerKey}`}
                altWinnerLabel={altWinnerKey === '__no_alt_winner__' ? null : altWinnerKey}
                edges={cards.map(c => ({ ...c }))}
                onFocusNode={onFocusNode}
                onSendMessage={onSendMessage}
                expertMode={expertMode}
                designationsWithheld={designationsWithheld}
              />
            ))}
          </div>
        )}

        {/* ── Whole-accordion empty state ─────────────────────────────
            Reads "No sensitivity or fragility signals fired" rather than
            the d4-copy.md draft "No stress-test signals fired" — the
            two deterministic Thinking-pattern cards always render, so
            the broader claim would be self-contradictory when they're
            visible. This narrower copy describes only the data-driven
            subsections.

            Audit §8 P1 (verdict honesty): three distinct states —
              1. robustness didn't run  → say so; fragility is UNCHECKED,
                 not clean. Applies when robustnessStatus is anything other
                 than 'computed' (including undefined — no positive signal,
                 no positive claim).
              2. degraded/approximate   → signals fired nowhere, but the pass
                 was approximate; do not claim consistency.
              3. ran clean              → the original claim, now earned. */}
        {/* UI-SEM-068: robustnessStatus→verdict mapping (didn't-run vs clean). */}
        {totalCount === thinkingPatternsCount && sensitiveCount === 0 && fragileCount === 0 && (
          robustnessStatus !== 'computed' ? (
            <p
              className={`${typography.panelMeta} text-text-light`}
              data-testid="stress-test-didnt-run"
            >
              Robustness analysis didn&apos;t run for this pass, so fragility hasn&apos;t been checked.
            </p>
          ) : analysisDegraded ? (
            <p
              className={`${typography.panelMeta} text-text-light`}
              data-testid="stress-test-degraded"
            >
              No sensitivity or fragility signals fired, but this pass ran with approximations — treat the result as provisional.
            </p>
          ) : (
            <p
              className={`${typography.panelMeta} text-text-light`}
              data-testid="stress-test-empty-state"
            >
              No sensitivity or fragility signals fired. Your model is currently consistent.
            </p>
          )
        )}
      </div>
    </Accordion>
  )
})

export default StressTestSection
