/**
 * DecisionConfidencePanel — Post-analysis triage panel (mirrors pre-analysis "Decision readiness").
 *
 * Structure (7 sections per brief):
 * 1. Health header — ring ("trust"), result headline, 4 dimension bars
 *    (Structure/Evidence/Coverage/Verified — same labels as pre-analysis)
 * 2. Result checks — target probabilities + condition card (fragility warning)
 * 3. Narrative — 1-line trust summary + "These N items would most improve confidence:"
 * 4. Top 3 action cards — EVOI-ranked, with inline ScientificEditor
 * 5. Quick-fix rows — items 4-6, compact single-line
 * 6. Science nudges — contextual prompts (sensitivity, bias, technique)
 * 7. Footer checks — pass/fail status line
 *
 * Uses shared TriageHealthHeader + TriageCard components.
 */

import { useMemo, memo } from 'react'
import { AlertTriangle, Lightbulb } from 'lucide-react'
import { TriageHealthHeader } from '@/components/shared/TriageHealthHeader'
import type { TriageDimension } from '@/components/shared/TriageHealthHeader'
import type { DecisionHealthRingDimensions } from '@/canvas/components/pre-analysis/DecisionHealthRing'
import { TriageCard } from '@/components/shared/TriageCard'
import type { TriageCardCategory, TriageCardAction } from '@/components/shared/TriageCard'
import type { ScientificEditorProps } from '@/components/shared/ScientificEditor'
import { TargetProbabilityBars } from './TargetProbabilityBars'
import { typography } from '@/styles/typography'
import { evaluativeVar } from '@/styles/evaluative'
import type { ResultsSectionDataReturn } from './useResultsSectionData'

// ── Types ───────────────────────────────────────────────────────────────────

interface DecisionConfidencePanelProps {
  data: ResultsSectionDataReturn
  /** Transition bridge: count of items user verified pre-analysis */
  verifiedCount?: number
  /** Transition bridge: weighted influence fraction user covered */
  influenceCoverage?: number
  onFocusNode?: (nodeId: string) => void
  onHoverEnter?: (type: 'node' | 'edge', id: string) => void
  onHoverLeave?: () => void
  /** Handler for setting a factor value via inline editor */
  onSetValue?: (nodeId: string, rawValue: number) => void
  /** Handler for confirming a factor value */
  onConfirm?: (nodeId: string) => void
  /** Handler for sending a message to the conversation panel */
  onSendMessage?: (text: string) => void
}

// ── Dimension computation (same 4 labels as pre-analysis) ───────────────────

function computePostAnalysisDimensions(data: ResultsSectionDataReturn): {
  ringDimensions: DecisionHealthRingDimensions
  dimensionBars: TriageDimension[]
} {
  const rec = data.recommendation
  const conf = data.confidence

  // Structure: robustness-based — how complete the model is post-analysis
  const structure = rec.recommendationStability ?? 0.5

  // Evidence: from coaching readiness dimensions
  const evidence = rec.coachingReadinessDimensions?.evidence ?? 0.5

  // Coverage: clarity/breadth of the analysis
  const coverage = rec.coachingReadinessDimensions?.clarity ?? (conf.rankingStability ?? 0.5)

  // Verified: user-reviewed fraction (from coaching robustness or ranking stability)
  const verified = rec.coachingReadinessDimensions?.robustness ?? (conf.rankingStability ?? structure)

  const ringDimensions: DecisionHealthRingDimensions = {
    structure,
    evidence,
    coverage,
    verified,
  }

  const dimensionBars: TriageDimension[] = [
    {
      label: 'Structure',
      value: structure,
      tooltip: 'How well-structured and complete the decision model is',
    },
    {
      label: 'Evidence',
      value: evidence,
      tooltip: 'Proportion of model values backed by your data versus AI estimates',
    },
    {
      label: 'Coverage',
      value: coverage,
      tooltip: 'Whether the model captures all key trade-offs, risks, and alternatives',
    },
    {
      label: 'Verified',
      value: verified,
      tooltip: 'Factors and relationships you have personally reviewed or confirmed',
    },
  ]

  return { ringDimensions, dimensionBars }
}

// ── Action item mapping ─────────────────────────────────────────────────────

interface MappedActionItem {
  key: string
  title: string
  detail: string
  category: TriageCardCategory
  influence: number | null
  evoiImpact: number | null
  action: TriageCardAction | undefined
  targetNodeId: string | undefined
  editorConfig: ScientificEditorProps | null
  sourcePill: { label: string; borderClass: string } | null
}

// Source pill mapping based on confidence level
function getSourcePill(confidence: number): { label: string; borderClass: string } {
  if (confidence <= 0) return { label: 'No data', borderClass: 'border-danger/30' }
  if (confidence < 40) return { label: 'AI estimate', borderClass: 'border-info/30' }
  return { label: 'Estimated', borderClass: 'border-warning/30' }
}

function mapEvidenceGapsToActions(
  data: ResultsSectionDataReturn,
  onSetValue?: (nodeId: string, rawValue: number) => void,
): MappedActionItem[] {
  const gaps = data.confidence.topEvidenceGaps ?? data.confidence.evidenceGaps ?? []
  return gaps.map((gap, i) => {
    const targetId = gap.targetNodeId ?? gap.factorId
    return {
      key: `gap-${gap.factorId}-${i}`,
      title: gap.factorLabel,
      detail: gap.suggestion || `This factor has ${gap.confidence}% confidence \u2014 improving it could change the recommendation`,
      category: 'add_evidence' as const,
      influence: gap.voi > 0 ? gap.voi : null,
      evoiImpact: gap.evpiPp ?? null,
      action: {
        kind: 'set_value' as const,
        label: 'Set value',
        targetId,
        targetType: 'node' as const,
      },
      targetNodeId: targetId,
      editorConfig: onSetValue ? {
        kind: 'factor' as const,
        rawValue: null,
        cap: null,
        unit: null,
        onSave: (rawValue: number) => onSetValue(targetId, rawValue),
        onCancel: () => {},
      } : null,
      sourcePill: getSourcePill(gap.confidence),
    }
  })
}

function mapNextActionsToCards(data: ResultsSectionDataReturn): MappedActionItem[] {
  const actions = data.confidence.topNextActions ?? data.confidence.nextActions ?? []
  return actions.map((action, i) => ({
    key: `action-${i}`,
    title: action.action,
    detail: action.rationale,
    category: 'strengthen' as const,
    influence: null,
    evoiImpact: null,
    action: action.targetId ? {
      kind: 'edit' as const,
      label: 'Edit',
      targetId: action.targetId,
      targetType: (action.targetType ?? 'node') as 'node' | 'edge',
    } : undefined,
    targetNodeId: action.targetId,
    editorConfig: null,
    sourcePill: null,
  }))
}

// ── Section 2: Result checks ────────────────────────────────────────────────

function ResultChecks({ data }: { data: ResultsSectionDataReturn }) {
  const rec = data.recommendation
  const fragile = data.confidence.topFragileEdge ?? data.confidence.m1CoachingTopFragileEdge

  const winnerConstraints = rec.recommendedOption?.constraintAnalysis
  const goalThreshold = rec.goalThreshold

  const switchPct = fragile?.switchProbability != null
    ? Math.round(fragile.switchProbability * 100)
    : null

  return (
    <div className="space-y-2">
      {/* Target probabilities */}
      <TargetProbabilityBars
        constraintAnalysis={winnerConstraints}
        goalThreshold={goalThreshold}
      />

      {/* Condition card (fragility warning) */}
      {fragile && (
        <div className="rounded-lg border border-warning/30 bg-panel px-3 py-2.5 space-y-1">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-warning flex-shrink-0" />
            <span className={`${typography.panelHeader} text-text-header`}>Condition</span>
          </div>
          <p className={`${typography.panelBody} text-text-body`}>
            If <strong>{fragile.fromLabel}</strong> changes significantly,{' '}
            <strong>{fragile.alternativeWinnerLabel}</strong> could become the better choice
            {switchPct != null && ` (${switchPct}% probability)`}.
          </p>
        </div>
      )}
    </div>
  )
}

// ── Section 3: Trust summary ────────────────────────────────────────────────

function TrustSummary({ data, actionCount }: { data: ResultsSectionDataReturn; actionCount: number }) {
  const stability = data.recommendation.recommendationStability
  const stabilityPct = stability != null ? Math.round(stability * 100) : null

  return (
    <div className="space-y-1">
      {stabilityPct != null && (
        <p className={`${typography.panelBody} text-text-body`}>
          Recommendation stability: <strong style={{ color: evaluativeVar(stability!) }}>{stabilityPct}%</strong>
        </p>
      )}
      {actionCount > 0 && (
        <p className={`${typography.panelMeta} text-text-light`}>
          These {actionCount} item{actionCount === 1 ? '' : 's'} would most improve confidence:
        </p>
      )}
    </div>
  )
}

// ── Section 6: Science nudges ───────────────────────────────────────────────

function ScienceNudges({ data }: { data: ResultsSectionDataReturn }) {
  const nudges: { key: string; text: string }[] = []

  // Sensitivity warning: top driver has very high influence
  const topDriver = data.drivers?.drivers?.[0]
  if (topDriver && topDriver.normalisedInfluence > 0.6) {
    nudges.push({
      key: 'sensitivity',
      text: `${topDriver.factorLabel} drives ${Math.round(topDriver.normalisedInfluence * 100)}% of the outcome. Small changes in its value could flip the recommendation.`,
    })
  }

  // Bias flag: any contested edges with high EVOI
  const hasHighEvoiContested = data.drivers?.drivers?.some(
    d => d.hasContestedEdge && d.evpiPercentagePoints != null && d.evpiPercentagePoints > 2,
  )
  if (hasHighEvoiContested) {
    nudges.push({
      key: 'bias',
      text: 'Some contested relationships have high decision impact. Resolving them could substantially change the result.',
    })
  }

  if (nudges.length === 0) return null

  return (
    <div className="space-y-1.5">
      {nudges.map((nudge) => (
        <div
          key={nudge.key}
          className="flex items-start gap-2 px-3 py-2 rounded-lg border border-info/30 bg-panel"
        >
          <Lightbulb size={14} className="text-info flex-shrink-0 mt-0.5" />
          <p className={`${typography.panelMeta} text-text-body`}>{nudge.text}</p>
        </div>
      ))}
    </div>
  )
}

// ── Section 7: Footer checks ────────────────────────────────────────────────

function FooterChecks({ data }: { data: ResultsSectionDataReturn }) {
  const rec = data.recommendation
  const hasWinner = rec.recommendedOption != null
  const isRobust = (rec.recommendationStability ?? 0) >= 0.7
  const hasEvidence = (rec.coachingReadinessDimensions?.evidence ?? 0) >= 0.5

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 rounded border border-panel-border">
      <StatusDot passed={hasWinner} label={hasWinner ? 'Winner identified' : 'No clear winner'} />
      <StatusDot passed={isRobust} label={isRobust ? 'Robust result' : 'Sensitive to inputs'} />
      <StatusDot passed={hasEvidence} label={hasEvidence ? 'Evidence adequate' : 'Evidence gaps remain'} />
    </div>
  )
}

function StatusDot({ passed, label }: { passed: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: passed ? 'var(--success)' : 'var(--danger)' }}
      />
      <span className={`${typography.panelMeta} text-text-light`}>{label}</span>
    </div>
  )
}

// ── Transition bridge banner ────────────────────────────────────────────────

function TransitionBridge({ verifiedCount, influenceCoverage }: { verifiedCount?: number; influenceCoverage?: number }) {
  // Only render when user actually verified items pre-analysis
  if (!verifiedCount || verifiedCount <= 0) return null

  const parts: string[] = []
  if (verifiedCount != null && verifiedCount > 0) {
    parts.push(`You verified ${verifiedCount} item${verifiedCount === 1 ? '' : 's'}`)
  }
  if (influenceCoverage != null && influenceCoverage > 0) {
    parts.push(`covering ${Math.round(influenceCoverage * 100)}% of influence`)
  }

  if (parts.length === 0) return null

  return (
    <div className={`px-3 py-2 rounded-md bg-panel-hover ${typography.panelMeta} text-text-light`}>
      {parts.join(', ')}
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

export const DecisionConfidencePanel = memo(function DecisionConfidencePanel({
  data,
  verifiedCount,
  influenceCoverage,
  onFocusNode,
  onHoverEnter,
  onHoverLeave,
  onSetValue,
  onConfirm,
  onSendMessage,
}: DecisionConfidencePanelProps) {
  const { ringDimensions, dimensionBars } = useMemo(
    () => computePostAnalysisDimensions(data),
    [data],
  )

  // Headline from coaching data (confirmed: no decision_review.narrative_summary.winner
  // field exists — using available M1 coaching fields)
  const headline = data.recommendation.coachingHeadline
    ?? data.recommendation.coachingDecisionStatement
    ?? (data.recommendation.recommendedOption
      ? `${data.recommendation.recommendedOption.label} is the recommended option`
      : null)

  // Merge and rank action items by EVOI
  const allActions = useMemo(() => {
    const gaps = mapEvidenceGapsToActions(data, onSetValue)
    const next = mapNextActionsToCards(data)
    const merged = [...gaps, ...next]
    merged.sort((a, b) => {
      const aEvoi = a.evoiImpact ?? -1
      const bEvoi = b.evoiImpact ?? -1
      if (aEvoi !== bEvoi) return bEvoi - aEvoi
      return (b.influence ?? 0) - (a.influence ?? 0)
    })
    return merged
  }, [data, onSetValue])

  const top3 = allActions.slice(0, 3)
  const quickFix = allActions.slice(3, 6)

  return (
    <div className="space-y-4 animate-fade-in" data-testid="decision-confidence-panel">
      {/* Transition bridge */}
      <TransitionBridge verifiedCount={verifiedCount} influenceCoverage={influenceCoverage} />

      {/* 1. Health header — ring shows ISL recommendation_stability directly */}
      <TriageHealthHeader
        title="Decision confidence"
        ringLabel="trust"
        ringDimensions={ringDimensions}
        dimensions={dimensionBars}
        headline={headline}
        overrideScore={data.recommendation.recommendationStability != null
          ? Math.round(data.recommendation.recommendationStability * 100)
          : undefined}
        testId="confidence-health-header"
      />

      {/* 2. Result checks — target probabilities + fragility condition */}
      <ResultChecks data={data} />

      {/* 3. Trust summary + item count */}
      <TrustSummary data={data} actionCount={allActions.length} />

      {/* 4. Top 3 action cards */}
      {top3.length > 0 && (
        <div className="space-y-2">
          {top3.map((item, i) => (
            <TriageCard
              key={item.key}
              cardKey={item.key}
              ordinal={i + 1}
              title={item.title}
              detail={item.detail}
              category={item.category}
              influence={item.influence}
              evoiImpact={item.evoiImpact}
              action={item.action}
              editorConfig={item.editorConfig}
              sourcePill={item.sourcePill}
              onConfirm={onConfirm}
              onEdit={onFocusNode}
              onSendMessage={onSendMessage}
              onHoverEnter={onHoverEnter}
              onHoverLeave={onHoverLeave}
            />
          ))}
        </div>
      )}

      {/* 5. Quick-fix rows (items 4-6) */}
      {quickFix.length > 0 && (
        <div className="space-y-1">
          <p className={`${typography.panelMeta} text-text-light mb-1`}>Also consider</p>
          {quickFix.map((item, i) => (
            <TriageCard
              key={item.key}
              cardKey={item.key}
              ordinal={i + 4}
              title={item.title}
              detail={item.detail}
              category={item.category}
              influence={item.influence}
              evoiImpact={item.evoiImpact}
              variant="compact"
              action={item.action}
              onHoverEnter={onHoverEnter}
              onHoverLeave={onHoverLeave}
            />
          ))}
        </div>
      )}

      {/* 6. Science nudges */}
      <ScienceNudges data={data} />

      {/* 7. Footer checks */}
      <FooterChecks data={data} />
    </div>
  )
})

export default DecisionConfidencePanel
