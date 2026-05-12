/**
 * TriageActionCardsBody — extracted from DecisionConfidencePanel.
 *
 * Holds the action-card body of the post-analysis triage panel:
 * - Result checks (target probability bars)
 * - T1 flip-risk callout
 * - Conditional scenarios (when present)
 * - Stability narrative + unified EVPI-ranked triage queue (top 3 + quick-fix 4-6)
 * - Dominant-factor nudge
 * - T1 checks footer (Winner / Robust / Evidence glyphs + MissingKnowledgePrompt)
 *
 * Extraction is an identity refactor — see docs/brief-analysis-hero-v17-implementation.md §3 step 1.
 * The new v17 hero (AnalysisHeroV17) will compose the same body with a different top header.
 *
 * Do not change behaviour here. Behaviour changes belong upstream in
 * DecisionConfidencePanel or downstream in AnalysisHeroV17.
 */

import { useMemo, memo, useState, type ReactNode } from 'react'
import { AlertTriangle, Check, ChevronDown, ChevronRight, X } from 'lucide-react'
import { ConditionalWinnerCards } from './ConditionalWinnerCards'
import { resolveTriageBodyText } from '@/components/shared/resolveTriageBodyText'
import { dedupTriageItems } from './utils/dedupTriageItems'
import { TriageCard } from '@/components/shared/TriageCard'
import type { TriageCardCategory, TriageCardAction } from '@/components/shared/TriageCard'
import type { ScientificEditorProps } from '@/components/shared/ScientificEditor'
import { TargetProbabilityBars } from './TargetProbabilityBars'
import { stripEncodingNotation, cleanFactorLabel } from './utils/cleanFactorLabel'
import { typography } from '@/styles/typography'
import type { ResultsSectionDataReturn } from './useResultsSectionData'
import { MissingKnowledgePrompt } from '@/components/shared/MissingKnowledgePrompt'
import { useCanvasStore } from '@/canvas/store'
import {
  buildStrengthenOverlayMap,
  findStrengthenOverlay,
  type StrengthenOverlay,
} from '@/canvas/components/pre-analysis/utils/applyStrengthenOverlay'

// ── Types ───────────────────────────────────────────────────────────────────

interface TriageActionCardsBodyProps {
  data: ResultsSectionDataReturn
  onFocusNode?: (nodeId: string) => void
  onHoverEnter?: (type: 'node' | 'edge', id: string) => void
  onHoverLeave?: () => void
  /** Handler for setting a factor value via inline editor */
  onSetValue?: (nodeId: string, rawValue: number) => void
  /** Handler for confirming a factor value */
  onConfirm?: (nodeId: string) => void
  /** Lookup: factor node ID → current observed value + unit/cap (for pre-filling triage card editors) */
  nodeValueLookup?: Record<string, { value: number | null; unit: string | null; cap: number | null; displayValue?: string | null }>
  /** Brief 5.8B D2c: handler invoked by the dominant-factor "Research" chip (moved from DriversSection). */
  onSendMessage?: (text: string) => void
  /** Brief 5.8B D2c: AI affordance rendered inside the T1 checks-footer MissingKnowledgePrompt. */
  aiAffordance?: ReactNode
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
  /** Brief 5.8B D2b — passive labels overlaid from CEE strengthen_items.actionType */
  passiveLabels: string[] | undefined
}

function applyOverlayToItem(
  item: MappedActionItem,
  overlay: StrengthenOverlay | null,
): MappedActionItem {
  if (!overlay) return item
  return {
    ...item,
    subtitle: overlay.detail,
    passiveLabels: overlay.actionTypeLabel ? [overlay.actionTypeLabel] : item.passiveLabels,
  }
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
      passiveLabels: undefined,
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
    passiveLabels: undefined,
  }))
}

// ── Section 2: Result checks (Brief 5.8B D2c — flip-risk extracted) ─────────

function ResultChecks({ data }: { data: ResultsSectionDataReturn }) {
  const rec = data.recommendation
  const winnerConstraints = rec.recommendedOption?.constraintAnalysis
  const goalThreshold = rec.goalThreshold
  return (
    <div className="space-y-2">
      <TargetProbabilityBars
        constraintAnalysis={winnerConstraints}
        goalThreshold={goalThreshold}
      />
    </div>
  )
}

/**
 * T1 flip-risk callout — moved from inside ResultChecks per Brief 5.8B D2c
 * step 1. Copy is preserved verbatim ("LOCKED — placement only"). Renders as
 * an inline `.nudge`-shaped row inside the T1 stack.
 */
function T1FlipRiskCallout({
  data,
  onFocusNode,
}: {
  data: ResultsSectionDataReturn
  onFocusNode?: (nodeId: string) => void
}) {
  const fragile = data.confidence.topFragileEdge ?? data.confidence.m1CoachingTopFragileEdge
  if (!fragile) return null
  const switchPct = fragile.switchProbability != null
    ? Math.round(fragile.switchProbability * 100)
    : null
  return (
    <div
      className="flex items-start gap-2 px-3 py-2 rounded-lg border border-warning/30 bg-panel"
      data-testid="t1-flip-risk-callout"
    >
      <AlertTriangle size={14} className="text-warning flex-shrink-0 mt-0.5" aria-hidden="true" />
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
  )
}

/**
 * T1 dominant-factor nudge — Brief 5.8B D2c step 2 + follow-up polish.
 * Now a true single-line `.nudge` row: warning icon + bolded
 * "Dominant factor:" + truncated detail + inline Validate / Research chips.
 * The full explanation surfaces via the row's `title` tooltip rather than
 * a wrapped paragraph; consumers who need the long form should look at the
 * Drivers section. Locked copy fragments preserved.
 */
function T1DominantNudge({
  data,
  onFocusNode,
  onSendMessage,
}: {
  data: ResultsSectionDataReturn
  onFocusNode?: (nodeId: string) => void
  onSendMessage?: (text: string) => void
}) {
  const drivers = data.drivers
  const topDriver = drivers.topDrivers?.[0] ?? drivers.drivers?.[0]
  const topInfluence = topDriver
    ? (topDriver.influenceScore ?? topDriver.normalisedInfluence ?? 0)
    : 0
  const showNudge = topInfluence >= 0.8
  const rawLabel = drivers.dominantFactorLabel ?? topDriver?.factorLabel ?? ''
  const dominantLabel = cleanFactorLabel(rawLabel).label
  if (!showNudge || !dominantLabel) return null
  const dominantPct = Math.round(Math.min(1, topInfluence) * 100)
  const dominantFocusId = drivers.dominantFactorId
    ?? topDriver?.matchedNodeId
    ?? topDriver?.factorKey
    ?? null
  const explanation = `drives ${dominantPct}% of the outcome.`
  const fullExplanation = `Dominant factor: ${dominantLabel} ${explanation} If your assumptions about this factor are wrong, the recommendation could change.`

  return (
    <div
      className="flex items-center gap-2 px-2.5 py-1.5 border border-panel-border rounded-lg"
      role="status"
      aria-label={`Dominant factor warning. ${fullExplanation}`}
      data-testid="t1-dominant-nudge"
      title={fullExplanation}
    >
      <AlertTriangle size={14} className="text-warning flex-shrink-0" aria-hidden="true" />
      {/* Factor name never truncates; explanation text takes remaining space and clips. */}
      <p className={`${typography.panelMeta} text-text-body min-w-0 flex-1 flex items-baseline gap-1 overflow-hidden`}>
        <span className="whitespace-nowrap"><strong>Dominant factor:</strong></span>
        <span className="font-semibold whitespace-nowrap">{dominantLabel}</span>
        <span className={`truncate min-w-0 flex-1 text-text-light`}>{explanation}</span>
      </p>
      {dominantFocusId && onFocusNode && (
        <button
          type="button"
          onClick={() => onFocusNode(dominantFocusId)}
          className={`flex-shrink-0 px-2 py-0.5 rounded-full ${typography.panelMeta} text-warning border border-warning/30 bg-transparent hover:bg-panel-hover cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-warning`}
          aria-label={`Validate ${dominantLabel} on canvas`}
        >
          Validate
        </button>
      )}
      {onSendMessage && (
        <button
          type="button"
          onClick={() => onSendMessage(`Can you research ${dominantLabel} and suggest a reasonable estimate with sources?`)}
          className={`flex-shrink-0 px-2 py-0.5 rounded-full ${typography.panelMeta} text-warning border border-warning/30 bg-transparent hover:bg-panel-hover cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-warning`}
          aria-label={`Research ${dominantLabel}`}
        >
          Research
        </button>
      )}
    </div>
  )
}

/**
 * T1 checks footer — Brief 5.8B D2c step 3. Compact row at the bottom of the
 * T1 stack: ✓/✗ Winner · ✓/✗ Robust · ✓/✗ Evidence gaps + addressed counter
 * + the shared `MissingKnowledgePrompt`. Each glyph + label uses panelMeta
 * (10px text-light) for visual demotion below the queue.
 */
function T1ChecksFooter({
  data,
  aiAffordance,
}: {
  data: ResultsSectionDataReturn
  aiAffordance?: ReactNode
}) {
  const hasWinner = !!data.recommendation.recommendedOption
  const stability = data.recommendation.recommendationStability
  const robustOk = typeof stability === 'number' && Number.isFinite(stability) && stability >= 0.85
  const robustKnown = typeof stability === 'number' && Number.isFinite(stability)
  const gaps = data.confidence.topEvidenceGaps ?? data.confidence.evidenceGaps ?? []
  const evidenceWeak = gaps.some(g => typeof g.confidence === 'number' && g.confidence < 50)
  const evidenceKnown = gaps.length > 0
  const addressed = gaps.filter(g => typeof g.confidence === 'number' && g.confidence >= 50).length
  const total = gaps.length

  return (
    <div className="border-t border-panel-border pt-3" data-testid="t1-checks-footer">
      <div className={`flex items-center flex-wrap gap-x-3 gap-y-1 ${typography.panelMeta} text-text-light`}>
        <ChecksGlyph
          ok={hasWinner}
          okLabel="Winner"
          notOkLabel="No winner"
          dataTestid="checks-winner"
        />
        <ChecksGlyph
          ok={robustOk}
          okLabel="Robust"
          notOkLabel={robustKnown ? 'Sensitive' : 'Robustness unknown'}
          dataTestid="checks-robust"
        />
        <ChecksGlyph
          ok={!evidenceWeak && evidenceKnown}
          okLabel="Evidence covered"
          notOkLabel={evidenceKnown ? 'Evidence gaps' : 'Evidence unknown'}
          dataTestid="checks-evidence"
        />
        {total > 0 && (
          <span className="ml-auto" data-testid="checks-addressed">
            {addressed}/{total} addressed
          </span>
        )}
      </div>
      <MissingKnowledgePrompt context="results" aiAffordance={aiAffordance} />
    </div>
  )
}

function ChecksGlyph({
  ok,
  okLabel,
  notOkLabel,
  dataTestid,
}: {
  ok: boolean
  okLabel: string
  notOkLabel: string
  dataTestid: string
}) {
  const Icon = ok ? Check : X
  const colour = ok ? 'text-success' : 'text-danger'
  return (
    <span className="inline-flex items-center gap-1" data-testid={dataTestid}>
      <Icon size={12} className={`${colour} flex-shrink-0`} aria-hidden="true" />
      <span>{ok ? okLabel : notOkLabel}</span>
    </span>
  )
}

// ── Section 3: Stability narrative (Brief 5.8B D2b) ─────────────────────────

/**
 * Stability narrative — a single line above the unified triage queue. Mirrors
 * the pre-analysis 5.8A pattern (narrative bridge above T1 cards). Suppressed
 * when there are no triage items to introduce. Stability percent suffix is
 * dropped when recommendation_stability is null/NaN.
 */
function StabilityNarrative({
  itemCount,
  stabilityScore,
}: {
  itemCount: number
  stabilityScore: number | undefined
}) {
  if (itemCount === 0) return null
  const stabilityPct =
    typeof stabilityScore === 'number' && Number.isFinite(stabilityScore)
      ? Math.round(stabilityScore * 100)
      : null
  const lede = stabilityPct != null
    ? `Stability: ${stabilityPct}%. These items would most improve confidence:`
    : 'These items would most improve confidence:'
  return (
    <div className="flex flex-col gap-0.5" data-testid="stability-narrative">
      <p className={`${typography.panelBody} text-text-body`}>{lede}</p>
      <p className={`${typography.panelMeta} text-text-light`}>Ranked by evidence value</p>
    </div>
  )
}

// ── Section 5: Also Consider disclosure ────────────────────────────────────

function AlsoConsiderDisclosure({
  items,
  startOrdinal,
  onHoverEnter,
  onHoverLeave,
  onConfirm,
  onEdit,
}: {
  items: MappedActionItem[]
  startOrdinal: number
  onHoverEnter?: (type: 'node' | 'edge', id: string) => void
  onHoverLeave?: () => void
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
        <div className="flex flex-col gap-1 mt-1.5" data-testid="also-consider-rows">
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
              variant="compact"
              editorConfig={item.editorConfig}
              sourcePill={item.sourcePill}
              passiveLabels={item.passiveLabels}
              onConfirm={onConfirm}
              onEdit={onEdit}
              onHoverEnter={onHoverEnter}
              onHoverLeave={onHoverLeave}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

export const TriageActionCardsBody = memo(function TriageActionCardsBody({
  data,
  onFocusNode,
  onHoverEnter,
  onHoverLeave,
  onSetValue,
  onConfirm,
  nodeValueLookup,
  onSendMessage,
  aiAffordance,
}: TriageActionCardsBodyProps) {
  // Brief 5.8B D2b — strengthen overlay map. CEE coaching.strengthen_items
  // (sourced from the canvas store; persisted across pre→post analysis) are
  // matched against post-analysis triage card titles via normalised exact
  // match (case-insensitive trim). Reuses the pre-analysis utility verbatim
  // so the matching contract stays in lockstep.
  const draftCoachingStrengthenItems = useCanvasStore(s => s.draftCoaching?.strengthenItems ?? null)
  const strengthenOverlayMap = useMemo(
    () => buildStrengthenOverlayMap(draftCoachingStrengthenItems),
    [draftCoachingStrengthenItems],
  )

  // Brief 5.8B D2b — single EVPI-ranked queue. The earlier split (evidence
  // gaps under one header, next actions under another) is gone. Top 3 render
  // as one stack with the first item visually emphasised; remainder roll
  // under "Also consider".
  const allActions = useMemo(() => {
    const gaps = mapEvidenceGapsToActions(data, onSetValue, nodeValueLookup)
    const next = mapNextActionsToCards(data)
    const merged = [...gaps, ...next].map(item =>
      applyOverlayToItem(item, findStrengthenOverlay(item, strengthenOverlayMap)),
    )
    merged.sort((a, b) => {
      const aEvoi = a.evoiImpact ?? -1
      const bEvoi = b.evoiImpact ?? -1
      if (aEvoi !== bEvoi) return bEvoi - aEvoi
      return (b.influence ?? 0) - (a.influence ?? 0)
    })
    // Dedup by canonical factor identity (targetNodeId) after sort so the
    // highest-ranked occurrence survives. See `dedupTriageItems` for the rule
    // (targetNodeId first, normalised-title fallback).
    return dedupTriageItems(merged)
  }, [data, onSetValue, nodeValueLookup, strengthenOverlayMap])

  const top3 = allActions.slice(0, 3)
  const quickFix = allActions.slice(3, 6)

  // Result-checks slot gate: must mirror BOTH null-return paths in
  // TargetProbabilityBars — (1) no constraints array AND (2) no constraint
  // carries a numeric `prob_satisfied`. Otherwise a bundle with shaped-but-
  // empty constraints would still emit an empty bordered slot.
  // See TargetProbabilityBars.tsx:26-32.
  const hasResultChecks = (
    data.recommendation.recommendedOption?.constraintAnalysis?.constraints
      ?.some(c => typeof c.prob_satisfied === 'number')
  ) ?? false

  const stabilityScore = data.recommendation.recommendationStability

  return (
    <>
      {/* 2. Result checks — target probabilities only. Gate the divider on
          the same condition TargetProbabilityBars uses (constraint data
          present) so sparse states don't emit an empty bordered slot. */}
      {hasResultChecks && (
        <div className="border-t border-panel-border pt-3" data-testid="t1-result-checks-slot">
          <ResultChecks data={data} />
        </div>
      )}

      {/* 2a. Flip-risk callout (moved out of ResultChecks per D2c step 1). */}
      {(data.confidence.topFragileEdge || data.confidence.m1CoachingTopFragileEdge) && (
        <div className="border-t border-panel-border pt-3">
          <T1FlipRiskCallout data={data} onFocusNode={onFocusNode} />
        </div>
      )}

      {/* 2b. Conditional scenarios (Brief 4 Task 10) — between flip-risk and queue. */}
      {data.confidence.conditionalWinners && data.confidence.conditionalWinners.length > 0 && (
        <div className="border-t border-panel-border pt-3">
          <ConditionalWinnerCards
            winners={data.confidence.conditionalWinners}
            recommendedLabel={data.recommendation.recommendedOption?.label}
            onFocusNode={onFocusNode}
          />
        </div>
      )}

      {/* 3. Stability narrative + unified EVPI-ranked queue.
          Card #1 gets the .ac.em info-bordered treatment. */}
      {(top3.length > 0 || data.confidence.topEvidenceGapsEmpty) && (
        <div className="border-t border-panel-border pt-3 space-y-2">
          <StabilityNarrative
            itemCount={top3.length}
            stabilityScore={stabilityScore}
          />

          {top3.length === 0 && data.confidence.topEvidenceGapsEmpty && (
            <p className={`${typography.panelBody} text-text-light`}>
              No high-value evidence gaps. Your current uncertainties have minimal impact on the result.
            </p>
          )}

          {top3.length > 0 && (
            <div className="flex flex-col gap-1.5" data-testid="unified-triage-queue">
              {top3.map((item, i) => {
                const emphasised = i === 0
                return (
                  <div
                    key={item.key}
                    className={emphasised ? 'rounded-[10px] border border-info/50 border-l-[3px] border-l-info bg-info/[0.02]' : ''}
                    data-testid={emphasised ? 'unified-triage-emphasised' : undefined}
                  >
                    <TriageCard
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
                      passiveLabels={item.passiveLabels}
                      onConfirm={onConfirm}
                      onEdit={onFocusNode}
                      onHoverEnter={onHoverEnter}
                      onHoverLeave={onHoverLeave}
                    />
                  </div>
                )
              })}
            </div>
          )}

          {quickFix.length > 0 && (
            <AlsoConsiderDisclosure
              items={quickFix}
              startOrdinal={4}
              onHoverEnter={onHoverEnter}
              onHoverLeave={onHoverLeave}
              onConfirm={onConfirm}
              onEdit={onFocusNode}
            />
          )}
        </div>
      )}

      {/* 3a. Dominant-factor nudge — Brief 5.8B D2c step 2 placement: AFTER
          the triage queue (corrects an earlier ordering bug surfaced by
          external review). Suppresses when top influence < 0.8. */}
      <T1DominantNudge
        data={data}
        onFocusNode={onFocusNode}
        onSendMessage={onSendMessage}
      />

      {/* 4. T1 checks footer — Brief 5.8B D2c step 3. */}
      <T1ChecksFooter data={data} aiAffordance={aiAffordance} />
    </>
  )
})

export default TriageActionCardsBody
