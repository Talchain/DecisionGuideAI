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
import type { DecisionHealthRingDimensions } from '@/canvas/components/pre-analysis/DecisionHealthRing'
import { ConditionalWinnerCards } from './ConditionalWinnerCards'
import { resolveTriageBodyText } from '@/components/shared/resolveTriageBodyText'
import { TriageCard } from '@/components/shared/TriageCard'
import type { TriageCardCategory, TriageCardAction } from '@/components/shared/TriageCard'
import type { ScientificEditorProps } from '@/components/shared/ScientificEditor'
import { TargetProbabilityBars } from './TargetProbabilityBars'
import { stripEncodingNotation } from './utils/cleanFactorLabel'
import { buildCertaintyCopy } from './utils/certaintyCopy'
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
  nodeValueLookup?: Record<string, { value: number | null; unit: string | null; cap: number | null; displayValue?: string | null }>
}

// Post-analysis uses a single-value ring (winner's win probability).
// The 4-dimension composite (Structure/Evidence/Coverage/Verified) is a
// pre-analysis readiness concept; conflating it with post-analysis trust
// misled users into reading the percentage as win probability.
// See Brief 4 Task 1 + UI-Data_Audit "hero disambiguation".

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
  nodeValueLookup?: Record<string, { value: number | null; unit: string | null; cap: number | null; displayValue?: string | null }>,
): MappedActionItem[] {
  const gaps = data.confidence.topEvidenceGaps ?? data.confidence.evidenceGaps ?? []
  return gaps.map((gap, i) => {
    const targetId = gap.targetNodeId ?? gap.factorId
    const nodeMeta = nodeValueLookup?.[targetId] ?? nodeValueLookup?.[gap.factorId] ?? null
    const currentValue = nodeMeta?.value ?? null
    const currentUnit = nodeMeta?.unit ?? null
    const currentCap = nodeMeta?.cap ?? null
    // Post-analysis body precedence (coaching → generic fallback) goes
    // through the shared resolver so pre- and post-analysis agree.
    const { text: detail } = resolveTriageBodyText({
      coaching: gap.suggestion,
      generic: `This factor has ${gap.confidence}% confidence. Improving it could change the recommendation.`,
    })
    return {
      key: `gap-${gap.factorId}-${i}`,
      title: gap.factorLabel,
      detail,
      subtitle: undefined,
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

/**
 * Evidence-section header.
 *
 * - `countLine`: "Top N by evidence value" — the original render.
 * - `subtitle`: scope copy that always renders alongside the count so users
 *   can reconcile this section with "What's driving this" (Brief 5.1 Task 2).
 * - `bridge`: symmetric descriptive line that renders iff the top driver
 *   identity and the top evidence-gap identity differ. No implication that
 *   one section is more important — only a scope distinction.
 */
function TrustSummary({
  actionCount,
  topDriverIdentity,
  topEvidenceGapIdentity,
}: {
  actionCount: number
  topDriverIdentity: string | null
  topEvidenceGapIdentity: string | null
}) {
  if (actionCount === 0) return null

  const showBridge =
    topDriverIdentity != null
    && topEvidenceGapIdentity != null
    && topDriverIdentity !== topEvidenceGapIdentity

  return (
    <div className="flex flex-col gap-0.5" data-testid="trust-summary">
      <p className={`${typography.panelMeta} text-text-light`}>
        Top {actionCount} by evidence value
      </p>
      <p className={`${typography.panelMeta} text-text-light`} data-testid="evidence-scope-subtitle">
        Factors where new information would most reduce uncertainty
      </p>
      {showBridge && (
        <p
          className={`${typography.panelMeta} text-text-light`}
          data-testid="drivers-evidence-bridge"
        >
          Your strongest driver and your top evidence gap are different factors.
          The driver is what currently moves the result; the evidence gap is where you do not yet know enough.
        </p>
      )}
    </div>
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
          <div className="flex items-start justify-between gap-2">
            <p className={`${typography.panelBody} font-semibold text-text-header truncate`} title={nudge.title}>{nudge.title}</p>
            {((nudge.targetNodeId && onFocusNode) || (onSendMessage && nudge.targetLabel)) && (
              <div className="flex items-center gap-1 flex-shrink-0">
                {nudge.targetNodeId && onFocusNode && (
                  <button
                    type="button"
                    onClick={() => onFocusNode(nudge.targetNodeId!)}
                    className={`px-2 py-0.5 rounded-full ${typography.panelMeta} text-info border border-info/30 bg-transparent hover:bg-panel-hover cursor-pointer`}
                  >
                    Validate
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
            )}
          </div>
        </div>
      </div>
      <p className={`${typography.panelMeta} text-text-light pl-[22px]`}>{nudge.text}</p>
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
  // Post-analysis ring shows winner's win probability directly. The readiness
  // composite (Structure/Evidence/Coverage/Verified) is pre-analysis-only.
  const winProbability = data.recommendation.recommendedOption?.winProbability
  const hasWinProbability = typeof winProbability === 'number' && Number.isFinite(winProbability)
  const winProbabilityScore = hasWinProbability ? Math.round(winProbability! * 100) : null

  // ringDimensions is required by the DecisionHealthRing prop contract even
  // in 'single' mode (it's used for the composite fallback / a11y label).
  // Pass the win-probability value across so any aria-label computation is
  // consistent with the score shown.
  const ringDimensions: DecisionHealthRingDimensions = {
    structure: hasWinProbability ? winProbability! : 0,
    evidence: hasWinProbability ? winProbability! : 0,
    coverage: hasWinProbability ? winProbability! : 0,
    verified: hasWinProbability ? winProbability! : 0,
  }

  // Headline from coaching data, with a tier-calibrated fallback so the
  // panel doesn't claim "is the leading option" when evidence is weak.
  // Brief 5.1 Task 4: certaintyCopy is the single source for both the
  // fallback headline AND the tier-driven caveat. Coaching sources are
  // allowed to override the headline wording (they went through the
  // coaching pipeline), but the caveat is derived purely from tier
  // fields — if evidence is weak the caveat renders regardless of
  // whatever headline text is in play. That closes the loophole where
  // an upstream "clear leading option" string could mask a
  // needs_work / needs_evidence bundle.
  const certainty = useMemo(() => {
    const winner = data.recommendation.recommendedOption
    if (!winner) return null
    return buildCertaintyCopy({
      winnerLabel: winner.label,
      confidenceTier: data.confidence.tier.tier,
      coachingReadiness: data.recommendation.coachingReadiness,
      recommendationStability: data.recommendation.recommendationStability,
      analysisStatus: data.recommendation.analysisStatus,
      optionCount: data.recommendation.allOptions.length,
    })
  }, [
    data.recommendation.recommendedOption,
    data.recommendation.coachingReadiness,
    data.recommendation.recommendationStability,
    data.recommendation.analysisStatus,
    data.recommendation.allOptions.length,
    data.confidence.tier.tier,
  ])

  const headline = data.recommendation.coachingHeadline
    ?? data.recommendation.coachingDecisionStatement
    ?? certainty?.headline
    ?? null

  // Caveat is tier-driven. It attaches whenever buildCertaintyCopy
  // returned one — the decision table only produces a caveat when
  // confidenceTier === 'needs_work' or readiness is weak, so the
  // presence of certainty.caveat is itself the honesty signal.
  const healthHeaderCoaching = certainty?.caveat ?? null

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

  // Brief 5.1 Task 2: canonical factor identity for the driver / evidence
  // bridge copy. Mirrors the existing DriversSection pattern — see preflight
  // findings §2. Null when either section is empty.
  const topDriverIdentity = useMemo(() => {
    const top = data.drivers.topDrivers?.[0]
    if (!top) return null
    return top.matchedNodeId ?? top.factorKey ?? null
  }, [data.drivers.topDrivers])

  const topEvidenceGapIdentity = useMemo(() => {
    const top = data.confidence.topEvidenceGaps?.[0]
    if (!top) return null
    return top.targetNodeId ?? top.factorId ?? null
  }, [data.confidence.topEvidenceGaps])

  // Task 4: science nudges integrated into triage card stack (after "Show N more")
  const scienceNudges = useMemo(() => buildScienceNudges(data), [data])

  return (
    <div className="space-y-4 animate-fade-in" data-testid="decision-confidence-panel">
      {/* Transition bridge */}
      <TransitionBridge verifiedCount={verifiedCount} influenceCoverage={influenceCoverage} />

      {/* 1. Health header — ring shows the winner's win probability. */}
      <TriageHealthHeader
        title="Current result"
        ringLabel="%"
        ringDimensions={ringDimensions}
        headline={headline}
        coaching={healthHeaderCoaching}
        overrideScore={winProbabilityScore}
        mode="single"
        ringCaption={hasWinProbability ? 'win probability' : undefined}
        testId="confidence-health-header"
      />

      {/* 2. Result checks — target probabilities + fragility condition */}
      <ResultChecks data={data} onFocusNode={onFocusNode} />

      {/* 2b. Conditional scenarios (Brief 4 Task 10) — between the flip-risk
          callout and the evidence-gap triage cards, per brief. */}
      {data.confidence.conditionalWinners && data.confidence.conditionalWinners.length > 0 && (
        <ConditionalWinnerCards
          winners={data.confidence.conditionalWinners}
          recommendedLabel={data.recommendation.recommendedOption?.label}
          onFocusNode={onFocusNode}
        />
      )}

      {/* 3. Trust summary + item count + scope subtitle + bridge to drivers */}
      <TrustSummary
        actionCount={top3.length}
        topDriverIdentity={topDriverIdentity}
        topEvidenceGapIdentity={topEvidenceGapIdentity}
      />

      {/* Empty state when all evidence gaps had zero impact (Brief 4 Task 9). */}
      {top3.length === 0 && data.confidence.topEvidenceGapsEmpty && (
        <div className="rounded-lg border border-panel-border bg-panel px-3 py-2">
          <p className={`${typography.panelBody} text-text-light`}>
            No high-value evidence gaps. Your current uncertainties have minimal impact on the result.
          </p>
        </div>
      )}

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
