/**
 * StressTestSection — Brief 5.8B D4. Replaces ChallengeSection's
 * "Before you decide" accordion with a wireframe-aligned T2 stress-test.
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
import type { DriverItem } from './types'

const RANK_FLIP_THRESHOLD = 0.15
const MAX_SENSITIVE = 3

export interface StressTestSectionProps {
  /** Drivers (post-analysis) — surfaces sensitive factors and the top driver. */
  drivers: DriverItem[]
  /** Fragile edges (post-analysis) — passthrough to the existing 5.7 D11 grouping. */
  fragileEdges?: ChallengeFragileEdge[]
  /** Recommended option label (winner) — drives template question phrasing. */
  winnerLabel: string
  /** Runner-up option label (alternative) — drives template question phrasing. */
  alternativeLabel: string
  onFocusNode?: (nodeId: string) => void
  onSendMessage?: (text: string) => void
  expertMode?: boolean
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
        {cleanLabel}. A shift could change the recommendation.
      </p>
      <button
        type="button"
        disabled={!onSendMessage}
        onClick={onSendMessage
          ? () => onSendMessage(
              `What if ${cleanLabel} changes? Walk me through the impact.`,
            )
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
        onClick={onSendMessage ? () => onSendMessage(promptBuilder()) : undefined}
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
  onFocusNode,
  onSendMessage,
  expertMode,
}: StressTestSectionProps) {
  // ── Sensitive assumptions (node-based) ───────────────────────────────────
  const sensitiveFactors = selectSensitiveFactors(drivers)

  // ── Thinking patterns (deterministic templates) ──────────────────────────
  // Top driver is the highest-influence driver. Confidence pinned to the
  // factor_sensitivity field that flows through DriverItem.confidence —
  // useResultsSectionData maps factor_sensitivity[i].confidence to that
  // field directly (see useResultsSectionData.ts:1526-1527), so reading
  // driver.confidence here matches the brief's authoritative-source rule.
  const topDriver = drivers[0]
  const topDriverLabel = topDriver
    ? stripEncodingNotation(topDriver.factorLabel)
    : 'this factor'
  const topDriverConfidence = topDriver?.confidence

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
  // Thinking patterns always render both deterministic cards when the
  // section opens at all — they're meta-prompts, not data-derived.
  const thinkingPatternsCount = 2
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
              />
            ))}
          </div>
        )}

        {/* ── Whole-accordion empty state (per d4-copy.md §6) ────────── */}
        {totalCount === thinkingPatternsCount && sensitiveCount === 0 && fragileCount === 0 && (
          <p className={`${typography.panelMeta} text-text-light`}>
            No stress-test signals fired. Your model is currently consistent.
          </p>
        )}
      </div>
    </Accordion>
  )
})

export default StressTestSection
