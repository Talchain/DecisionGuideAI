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

import { useMemo, memo, useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight, Lightbulb } from 'lucide-react'
import { TriageHealthHeader } from '@/components/shared/TriageHealthHeader'
import type { TriageDimension } from '@/components/shared/TriageHealthHeader'
import type { DecisionHealthRingDimensions } from '@/canvas/components/pre-analysis/DecisionHealthRing'
import { TriageCard } from '@/components/shared/TriageCard'
import type { TriageCardCategory, TriageCardAction } from '@/components/shared/TriageCard'
import type { ScientificEditorProps } from '@/components/shared/ScientificEditor'
import { TargetProbabilityBars } from './TargetProbabilityBars'
import { stripEncodingNotation } from './utils/cleanFactorLabel'
import { typography } from '@/styles/typography'
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
  /** Show influence/EVOI metrics on triage cards */
  expertMode?: boolean
  /** Lookup: factor node ID → current observed value + unit/cap (for pre-filling triage card editors) */
  nodeValueLookup?: Record<string, { value: number | null; unit: string | null; cap: number | null }>
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
  subtitle: string | undefined
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
  nodeValueLookup?: Record<string, { value: number | null; unit: string | null; cap: number | null }>,
): MappedActionItem[] {
  const gaps = data.confidence.topEvidenceGaps ?? data.confidence.evidenceGaps ?? []
  return gaps.map((gap, i) => {
    const targetId = gap.targetNodeId ?? gap.factorId
    const nodeMeta = nodeValueLookup?.[targetId] ?? nodeValueLookup?.[gap.factorId] ?? null
    const currentValue = nodeMeta?.value ?? null
    const currentUnit = nodeMeta?.unit ?? null
    const currentCap = nodeMeta?.cap ?? null
    // Post-analysis cards: no subtitle — detail line shows contextual suggestion
    const subtitle = undefined
    return {
      key: `gap-${gap.factorId}-${i}`,
      title: gap.factorLabel,
      detail: gap.suggestion || `This factor has ${gap.confidence}% confidence \u2014 improving it could change the recommendation`,
      subtitle,
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
        rawValue: currentValue,
        cap: currentCap,
        unit: currentUnit,
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
    subtitle: undefined,
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

function ResultChecks({ data, onFocusNode }: { data: ResultsSectionDataReturn; onFocusNode?: (nodeId: string) => void }) {
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

      {/* Fragility warning — inline, no separate heading */}
      {fragile && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg border border-warning/30 bg-panel">
          <AlertTriangle size={14} className="text-warning flex-shrink-0 mt-0.5" />
          <p className={`${typography.panelBody} text-text-body`}>
            If <strong>{fragile.fromLabel}</strong> shifts,{' '}
            <strong>{fragile.alternativeWinnerLabel}</strong> could overtake
            {switchPct != null && ` (${switchPct}% probability)`}.
            {onFocusNode && fragile.fromId && (
              <>
                {' '}
                <button
                  type="button"
                  onClick={() => onFocusNode(fragile.fromId)}
                  className="text-info hover:underline cursor-pointer"
                >
                  Validate {stripEncodingNotation(fragile.fromLabel)}
                </button>
              </>
            )}
          </p>
        </div>
      )}
    </div>
  )
}

// ── Section 3: Trust summary ────────────────────────────────────────────────

function TrustSummary({ actionCount }: { actionCount: number }) {
  if (actionCount === 0) return null
  return (
    <p className={`${typography.panelMeta} text-text-light`}>
      Top {actionCount} by evidence value
    </p>
  )
}

// ── Section 6: Science nudge cards ─────────────────────────────────────────

interface ScienceNudge {
  key: string
  title: string
  text: string
  targetNodeId?: string
  targetLabel?: string
}

function buildScienceNudges(data: ResultsSectionDataReturn): ScienceNudge[] {
  const nudges: ScienceNudge[] = []

  // Sensitivity warning: top driver has very high influence
  const topDriver = data.drivers?.drivers?.[0]
  if (topDriver && topDriver.normalisedInfluence > 0.6) {
    nudges.push({
      key: 'sensitivity',
      title: stripEncodingNotation(topDriver.factorLabel),
      text: `Drives ${Math.round(topDriver.normalisedInfluence * 100)}% of the outcome. Small changes could flip the result.`,
      targetNodeId: topDriver.matchedNodeId ?? topDriver.factorKey,
      targetLabel: stripEncodingNotation(topDriver.factorLabel),
    })
  }

  // Bias flag: any contested edges with high EVOI
  const hasHighEvoiContested = data.drivers?.drivers?.some(
    d => d.hasContestedEdge && d.evpiPercentagePoints != null && d.evpiPercentagePoints > 2,
  )
  if (hasHighEvoiContested) {
    nudges.push({
      key: 'bias',
      title: 'Contested relationships',
      text: 'Some contested relationships have high decision impact. Resolving them could substantially change the result.',
    })
  }

  return nudges
}

/** Science nudge card — same format as triage card, lightbulb icon, with CTAs */
function ScienceNudgeCard({
  nudge,
  onFocusNode,
  onSendMessage,
}: {
  nudge: ScienceNudge
  onFocusNode?: (nodeId: string) => void
  onSendMessage?: (text: string) => void
}) {
  return (
    <div className="flex flex-col p-2.5 rounded-[10px] border border-info/30 bg-panel hover:bg-panel-hover">
      <div className="flex items-start gap-2 mb-0.5">
        <Lightbulb size={14} className="text-info flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className={`${typography.panelBody} font-semibold text-text-header truncate`} title={nudge.title}>{nudge.title}</p>
        </div>
      </div>
      <p className={`${typography.panelMeta} text-text-light pl-[22px]`}>{nudge.text}</p>
      <div className="flex items-center gap-1 mt-1.5 pl-[22px]">
        {nudge.targetNodeId && onFocusNode && (
          <button
            type="button"
            onClick={() => onFocusNode(nudge.targetNodeId!)}
            className={`px-2 py-0.5 rounded-full ${typography.panelMeta} text-info border border-info/30 bg-transparent hover:bg-panel-hover cursor-pointer`}
          >
            Validate this factor
          </button>
        )}
        {onSendMessage && nudge.targetLabel && (
          <button
            type="button"
            onClick={() => onSendMessage(`Can you research ${nudge.targetLabel} and suggest a reasonable estimate with sources?`)}
            className={`px-2 py-0.5 rounded-full ${typography.panelMeta} text-info border border-info/30 bg-transparent hover:bg-panel-hover cursor-pointer`}
          >
            Research
          </button>
        )}
      </div>
    </div>
  )
}

// Task 5: FooterChecks removed — redundant with hero ring + dimension bars

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

// ── Section 5: Also Consider disclosure ────────────────────────────────────

function AlsoConsiderDisclosure({
  items,
  startOrdinal,
  onHoverEnter,
  onHoverLeave,
  onSendMessage,
  onConfirm,
  onEdit,
}: {
  items: MappedActionItem[]
  startOrdinal: number
  onHoverEnter?: (type: 'node' | 'edge', id: string) => void
  onHoverLeave?: () => void
  onSendMessage?: (text: string) => void
  onConfirm?: (nodeId: string) => void
  onEdit?: (nodeId: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className={`flex items-center gap-1 ${typography.panelMeta} text-text-light hover:text-text-body cursor-pointer`}
      >
        {expanded
          ? <><ChevronDown className="w-3 h-3" aria-hidden="true" /> Show fewer</>
          : <><ChevronRight className="w-3 h-3" aria-hidden="true" /> Show {items.length} more</>}
      </button>
      {expanded && (
        <div className="flex flex-col gap-1.5 mt-1.5">
          {items.map((item, i) => (
            <TriageCard
              key={item.key}
              cardKey={item.key}
              ordinal={startOrdinal + i}
              title={item.title}
              detail={item.detail}
              subtitle={item.subtitle}
              category={item.category}
              influence={item.influence}
              evoiImpact={item.evoiImpact}
              action={item.action}
              editorConfig={item.editorConfig}
              sourcePill={item.sourcePill}
              onConfirm={onConfirm}
              onEdit={onEdit}
              onHoverEnter={onHoverEnter}
              onHoverLeave={onHoverLeave}
              onSendMessage={onSendMessage}
            />
          ))}
        </div>
      )}
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
  expertMode,
  nodeValueLookup,
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
    const gaps = mapEvidenceGapsToActions(data, onSetValue, nodeValueLookup)
    const next = mapNextActionsToCards(data)
    const merged = [...gaps, ...next]
    merged.sort((a, b) => {
      const aEvoi = a.evoiImpact ?? -1
      const bEvoi = b.evoiImpact ?? -1
      if (aEvoi !== bEvoi) return bEvoi - aEvoi
      return (b.influence ?? 0) - (a.influence ?? 0)
    })
    return merged
  }, [data, onSetValue, nodeValueLookup])

  const top3 = allActions.slice(0, 3)
  const quickFix = allActions.slice(3, 6)

  // Task 4: science nudges integrated into triage card stack (after "Show N more")
  const scienceNudges = useMemo(() => buildScienceNudges(data), [data])

  return (
    <div className="space-y-4 animate-fade-in" data-testid="decision-confidence-panel">
      {/* Transition bridge */}
      <TransitionBridge verifiedCount={verifiedCount} influenceCoverage={influenceCoverage} />

      {/* 1. Health header — ring shows ISL recommendation_stability directly */}
      <TriageHealthHeader
        title="Current recommendation"
        ringLabel="%"
        ringDimensions={ringDimensions}
        dimensions={dimensionBars}
        headline={headline}
        overrideScore={data.recommendation.recommendationStability != null
          ? Math.round(data.recommendation.recommendationStability * 100)
          : undefined}
        testId="confidence-health-header"
      />

      {/* 2. Result checks — target probabilities + fragility condition */}
      <ResultChecks data={data} onFocusNode={onFocusNode} />

      {/* 3. Trust summary + item count */}
      <TrustSummary actionCount={top3.length} />

      {/* 4. Top 3 action cards */}
      {top3.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {top3.map((item, i) => (
            <TriageCard
              key={item.key}
              cardKey={item.key}
              ordinal={i + 1}
              title={item.title}
              detail={item.detail}
              subtitle={item.subtitle}
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

      {/* 5. Quick-fix rows (items 4-6) — collapsible "Also consider" */}
      {quickFix.length > 0 && (
        <AlsoConsiderDisclosure
          items={quickFix}
          startOrdinal={4}
          onHoverEnter={onHoverEnter}
          onHoverLeave={onHoverLeave}
          onSendMessage={onSendMessage}
          onConfirm={onConfirm}
          onEdit={onFocusNode}
        />
      )}

      {/* 6. Science nudge cards — in triage area after "Show N more" (Task 4) */}
      {scienceNudges.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {scienceNudges.map((nudge) => (
            <ScienceNudgeCard
              key={nudge.key}
              nudge={nudge}
              onFocusNode={onFocusNode}
              onSendMessage={onSendMessage}
            />
          ))}
        </div>
      )}

      {/* Task 5: Footer checks removed — hero ring + dimension bars communicate the same info */}
    </div>
  )
})

export default DecisionConfidencePanel
