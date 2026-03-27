/**
 * DecisionConfidencePanel — Post-analysis triage panel (mirrors pre-analysis "Decision readiness").
 *
 * Structure:
 * 1. Health header — ring ("trust"), result headline, 4 dimension bars
 * 2. Trust summary — 1-line trust oneliner
 * 3. Top 3 action cards — EVOI-ranked, with inline ScientificEditor
 * 4. Quick-fix rows — items 4-6, compact single-line
 * 5. Footer checks — pass/fail status
 *
 * Uses shared TriageHealthHeader + TriageCard components.
 */

import { useMemo, memo } from 'react'
import { AlertTriangle } from 'lucide-react'
import { TriageHealthHeader } from '@/components/shared/TriageHealthHeader'
import type { TriageDimension } from '@/components/shared/TriageHealthHeader'
import type { DecisionHealthRingDimensions } from '@/canvas/components/pre-analysis/DecisionHealthRing'
import { TriageCard } from '@/components/shared/TriageCard'
import type { TriageCardCategory, TriageCardAction } from '@/components/shared/TriageCard'
import { typography } from '@/styles/typography'
import { evaluativeVar } from '@/styles/evaluative'
import type { ResultsSectionDataReturn } from './useResultsSectionData'

// ── Types ───────────────────────────────────────────────────────────────────

interface DecisionConfidencePanelProps {
  data: ResultsSectionDataReturn
  onFocusNode?: (nodeId: string) => void
  onHoverEnter?: (type: 'node' | 'edge', id: string) => void
  onHoverLeave?: () => void
}

// ── Dimension computation ───────────────────────────────────────────────────

function computePostAnalysisDimensions(data: ResultsSectionDataReturn): {
  ringDimensions: DecisionHealthRingDimensions
  dimensionBars: TriageDimension[]
} {
  const rec = data.recommendation
  const conf = data.confidence

  // Robustness: from recommendation stability (0-1)
  const robustness = rec.recommendationStability ?? 0.5

  // Evidence: from coaching readiness dimensions or evidence gap ratio
  const evidence = rec.coachingReadinessDimensions?.evidence ?? 0.5

  // Clarity: from coaching readiness dimensions or ranking stability
  const clarity = rec.coachingReadinessDimensions?.clarity ?? (conf.rankingStability ?? 0.5)

  // Consistency: from robustness level mapping or ranking stability
  const consistency = conf.rankingStability ?? robustness

  const ringDimensions: DecisionHealthRingDimensions = {
    structure: robustness,
    evidence,
    coverage: clarity,
    verified: consistency,
  }

  const dimensionBars: TriageDimension[] = [
    {
      label: 'Robustness',
      value: robustness,
      tooltip: 'How stable is the recommendation across Monte Carlo simulations',
    },
    {
      label: 'Evidence',
      value: evidence,
      tooltip: 'Proportion of model values backed by your data versus AI estimates',
    },
    {
      label: 'Clarity',
      value: clarity,
      tooltip: 'How clearly the winning option separates from alternatives',
    },
    {
      label: 'Consistency',
      value: consistency,
      tooltip: 'Whether the option ranking stays the same across simulated scenarios',
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
}

function mapEvidenceGapsToActions(data: ResultsSectionDataReturn): MappedActionItem[] {
  const gaps = data.confidence.topEvidenceGaps ?? data.confidence.evidenceGaps ?? []
  return gaps.map((gap, i) => ({
    key: `gap-${gap.factorId}-${i}`,
    title: gap.factorLabel,
    detail: gap.suggestion || `This factor has ${gap.confidence}% confidence — improving it could change the recommendation`,
    category: 'add_evidence' as const,
    influence: gap.voi > 0 ? gap.voi : null,
    evoiImpact: gap.evpiPp ?? null,
    action: {
      kind: 'set_value' as const,
      label: 'Set value',
      targetId: gap.targetNodeId ?? gap.factorId,
      targetType: 'node' as const,
    },
    targetNodeId: gap.targetNodeId ?? gap.factorId,
  }))
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
  }))
}

// ── Fragility warning card ──────────────────────────────────────────────────

function FragilityWarning({ data }: { data: ResultsSectionDataReturn }) {
  const fragile = data.confidence.topFragileEdge ?? data.confidence.m1CoachingTopFragileEdge
  if (!fragile) return null

  const switchPct = fragile.switchProbability != null
    ? Math.round(fragile.switchProbability * 100)
    : null

  return (
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
  )
}

// ── Trust summary ───────────────────────────────────────────────────────────

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

// ── Footer checks ───────────────────────────────────────────────────────────

function FooterChecks({ data }: { data: ResultsSectionDataReturn }) {
  const rec = data.recommendation
  const hasWinner = rec.recommendedOption != null
  const isRobust = (rec.recommendationStability ?? 0) >= 0.7

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded border border-panel-border">
      <StatusDot passed={hasWinner} />
      <span className={`${typography.panelMeta} text-text-light`}>
        {hasWinner ? 'Winner identified' : 'No clear winner'}
      </span>
      <span className="text-text-light">·</span>
      <StatusDot passed={isRobust} />
      <span className={`${typography.panelMeta} text-text-light`}>
        {isRobust ? 'Robust result' : 'Sensitive to inputs'}
      </span>
    </div>
  )
}

function StatusDot({ passed }: { passed: boolean }) {
  return (
    <span
      className="w-2 h-2 rounded-full flex-shrink-0"
      style={{ backgroundColor: passed ? 'var(--success)' : 'var(--danger)' }}
    />
  )
}

// ── Main component ──────────────────────────────────────────────────────────

export const DecisionConfidencePanel = memo(function DecisionConfidencePanel({
  data,
  onFocusNode,
  onHoverEnter,
  onHoverLeave,
}: DecisionConfidencePanelProps) {
  const { ringDimensions, dimensionBars } = useMemo(
    () => computePostAnalysisDimensions(data),
    [data],
  )

  // Build headline from coaching data
  const headline = data.recommendation.coachingHeadline
    ?? data.recommendation.coachingDecisionStatement
    ?? (data.recommendation.recommendedOption
      ? `${data.recommendation.recommendedOption.label} is the recommended option`
      : null)

  // Merge and rank action items by EVOI
  const allActions = useMemo(() => {
    const gaps = mapEvidenceGapsToActions(data)
    const next = mapNextActionsToCards(data)
    const merged = [...gaps, ...next]
    // Sort by EVOI impact (descending), then by influence
    merged.sort((a, b) => {
      const aEvoi = a.evoiImpact ?? -1
      const bEvoi = b.evoiImpact ?? -1
      if (aEvoi !== bEvoi) return bEvoi - aEvoi
      return (b.influence ?? 0) - (a.influence ?? 0)
    })
    return merged
  }, [data])

  const top3 = allActions.slice(0, 3)
  const quickFix = allActions.slice(3, 6)

  return (
    <div className="space-y-4 animate-fade-in" data-testid="decision-confidence-panel">
      {/* 1. Health header */}
      <TriageHealthHeader
        title="Decision confidence"
        ringLabel="trust"
        ringDimensions={ringDimensions}
        dimensions={dimensionBars}
        headline={headline}
        testId="confidence-health-header"
      />

      {/* 2. Fragility warning */}
      <FragilityWarning data={data} />

      {/* 3. Trust summary */}
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
              onEdit={onFocusNode}
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

      {/* 7. Footer checks */}
      <FooterChecks data={data} />
    </div>
  )
})

export default DecisionConfidencePanel
