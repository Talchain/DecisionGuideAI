/**
 * DecisionConfidencePanel — Post-analysis triage panel (mirrors pre-analysis "Decision readiness").
 *
 * Structure (post-analysis triage panel):
 * 1. Health header — ring ("trust"), result headline, 4 dimension bars
 *    (Structure/Evidence/Coverage/Verified — same labels as pre-analysis)
 * 2. Result checks — target probabilities + condition card (fragility warning)
 * 3. Narrative — 1-line trust summary + "These N items would most improve confidence:"
 * 4. Top 3 action cards — EVOI-ranked, with inline ScientificEditor
 * 5. Quick-fix rows — items 4-6, compact single-line
 *
 * Uses shared TriageHealthHeader + TriageCard components.
 */

import { useMemo, memo, useState, type ReactNode } from 'react'
import { AlertTriangle, Check, ChevronDown, ChevronRight, X } from 'lucide-react'
import { TriageHealthHeader } from '@/components/shared/TriageHealthHeader'
import type { DecisionHealthRingDimensions } from '@/components/shared/DecisionHealthRing'
import { HeroQualifier } from './HeroQualifier'
import { evaluativeVar } from '@/styles/evaluative'
import { ConditionalWinnerCards } from './ConditionalWinnerCards'
import { resolveTriageBodyText } from '@/components/shared/resolveTriageBodyText'
import { TriageCard } from '@/components/shared/TriageCard'
import type { TriageCardCategory, TriageCardAction } from '@/components/shared/TriageCard'
import type { ScientificEditorProps } from '@/components/shared/ScientificEditor'
import { TargetProbabilityBars } from './TargetProbabilityBars'
import { stripEncodingNotation, cleanFactorLabel } from './utils/cleanFactorLabel'
import { buildCertaintyCopy } from './utils/certaintyCopy'
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
  /** Show influence/EVOI metrics on triage cards */
  expertMode?: boolean
  /** Lookup: factor node ID → current observed value + unit/cap (for pre-filling triage card editors) */
  nodeValueLookup?: Record<string, { value: number | null; unit: string | null; cap: number | null; displayValue?: string | null }>
  /** Brief 5.8B D2c: handler invoked by the dominant-factor "Research" chip (moved from DriversSection). */
  onSendMessage?: (text: string) => void
  /** Brief 5.8B D2c: AI affordance rendered inside the T1 checks-footer MissingKnowledgePrompt. */
  aiAffordance?: ReactNode
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
 * T1 dominant-factor nudge — Brief 5.8B D2c step 2. Replaces the standalone
 * card that previously lived in DriversSection. Mirrors the pre-analysis
 * `T1BiasNudgeRow` style: inline icon + bolded label + one-line detail +
 * Validate / Research chips. Locked copy from the previous DriversSection
 * render is preserved verbatim.
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
  // Same threshold the legacy DriversSection warning used (≥0.8).
  const showNudge = topInfluence >= 0.8
  const rawLabel = drivers.dominantFactorLabel ?? topDriver?.factorLabel ?? ''
  const dominantLabel = cleanFactorLabel(rawLabel).label
  if (!showNudge || !dominantLabel) return null
  const dominantPct = Math.round(Math.min(1, topInfluence) * 100)
  const dominantFocusId = drivers.dominantFactorId
    ?? topDriver?.matchedNodeId
    ?? topDriver?.factorKey
    ?? null

  return (
    <div
      className="flex items-start gap-2 px-3 py-2 rounded-lg border border-warning/30 bg-panel"
      role="status"
      aria-label="Dominant factor warning"
      data-testid="t1-dominant-nudge"
    >
      <AlertTriangle size={14} className="text-warning flex-shrink-0 mt-0.5" aria-hidden="true" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <p className={`${typography.panelBody} text-text-body`}>
          <strong>Dominant factor:</strong> {dominantLabel} drives {dominantPct}% of the outcome.
          If your assumptions about this factor are wrong, the recommendation could change.
        </p>
        {((dominantFocusId && onFocusNode) || onSendMessage) && (
          <div className="flex items-center gap-1.5">
            {dominantFocusId && onFocusNode && (
              <button
                type="button"
                onClick={() => onFocusNode(dominantFocusId)}
                className={`px-2 py-0.5 rounded-full ${typography.panelMeta} text-warning border border-warning/30 bg-transparent hover:bg-panel-hover cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-warning`}
                aria-label={`Validate ${dominantLabel} on canvas`}
              >
                Validate
              </button>
            )}
            {onSendMessage && (
              <button
                type="button"
                onClick={() => onSendMessage(`Can you research ${dominantLabel} and suggest a reasonable estimate with sources?`)}
                className={`px-2 py-0.5 rounded-full ${typography.panelMeta} text-warning border border-warning/30 bg-transparent hover:bg-panel-hover cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-warning`}
                aria-label={`Research ${dominantLabel}`}
              >
                Research
              </button>
            )}
          </div>
        )}
      </div>
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
    <div className="border-t border-panel-border pt-2" data-testid="t1-checks-footer">
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

// Task 5: FooterChecks removed — redundant with hero ring + dimension bars
// Brief 5.7 D2: standalone structural-signals section (sensitivity + bias
// nudges) removed. Equivalent factor-level signal (factor name + N% drives
// + Validate/Research chips) is carried by the dominant-factor warning in
// DriversSection. Contested-relationships fall through to ContestedRelationships.

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

export const DecisionConfidencePanel = memo(function DecisionConfidencePanel({
  data,
  verifiedCount,
  influenceCoverage,
  onFocusNode,
  onHoverEnter,
  onHoverLeave,
  onSetValue,
  onConfirm,
  expertMode: _expertMode,
  nodeValueLookup,
  onSendMessage,
  aiAffordance,
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
  //
  // Brief 5.2 Task 1: Brief 5.1's caveat guarantee alone wasn't enough —
  // PLoT can still supply "Option A is the clear leader with a 95-point
  // advantage" which rendered verbatim because coachingHeadline won the
  // precedence chain. When the tier is weak (certainty.caveat is present),
  // we now swap in certainty.headline instead so the headline softens with
  // the caveat. winProbabilityGap preserves the numeric lead as "by N
  // points" without the over-confident framing.
  const winProbabilityGap = useMemo(() => {
    const options = data.recommendation.allOptions
    if (!options || options.length < 2) return undefined
    const winner = data.recommendation.recommendedOption
    if (!winner || typeof winner.winProbability !== 'number') return undefined
    const runnerUp = options
      .filter(o => o.id !== winner.id && typeof o.winProbability === 'number')
      .reduce<typeof winner | null>((best, cur) => {
        if (!best) return cur
        return (cur.winProbability ?? 0) > (best.winProbability ?? 0) ? cur : best
      }, null)
    if (!runnerUp || typeof runnerUp.winProbability !== 'number') return undefined
    const gapPct = (winner.winProbability - runnerUp.winProbability) * 100
    return gapPct > 0 ? gapPct : undefined
  }, [data.recommendation.allOptions, data.recommendation.recommendedOption])

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
      winProbabilityGap,
    })
  }, [
    data.recommendation.recommendedOption,
    data.recommendation.coachingReadiness,
    data.recommendation.recommendationStability,
    data.recommendation.analysisStatus,
    data.recommendation.allOptions.length,
    data.confidence.tier.tier,
    winProbabilityGap,
  ])

  // Brief 5.2 follow-up (ChatGPT P0 #1): the earlier gate was too narrow —
  // only caveat-bearing branches suppressed PLoT coaching overrides, which
  // let unstable, partial, single-option, fair-tier, and fallback branches
  // regress to strong "clear leader" language even though certaintyCopy
  // emitted a conservative lede. The `conservative` flag marks every
  // branch except Rule 6 (strong + ready) so coaching overrides are now
  // scoped to the single tier combination where they are genuinely safe.
  const headline = certainty?.conservative
    ? certainty.headline
    : (data.recommendation.coachingHeadline
       ?? data.recommendation.coachingDecisionStatement
       ?? certainty?.headline
       ?? null)

  // Caveat is tier-driven. It attaches whenever buildCertaintyCopy
  // returned one — the decision table only produces a caveat when
  // confidenceTier === 'needs_work' or readiness is weak, so the
  // presence of certainty.caveat is itself the honesty signal.
  const healthHeaderCoaching = certainty?.caveat ?? null

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
    return merged
  }, [data, onSetValue, nodeValueLookup, strengthenOverlayMap])

  const top3 = allActions.slice(0, 3)
  const quickFix = allActions.slice(3, 6)

  // ── D2a hero: readiness dimension bars + qualifier + stability indicator ──
  // The post-analysis bundle supplies a 3-dim readiness set
  // ({evidence, robustness, clarity}) — see useResultsSectionData.ts:1238.
  // The wireframe pictures a 4-dim set ({Structure/Evidence/Coverage/Verified}).
  // Per Paul's directive ("use whatever the data supplies — do not invent
  // dimensions") we render only the 3 keys the response actually provides.
  // The label "Framing" maps to `clarity` because the upstream coaching
  // taxonomy treats clarity-of-framing as the user-facing concept.
  const readinessDimensions = data.recommendation.coachingReadinessDimensions
  const heroDimensions = useMemo(() => {
    if (!readinessDimensions) return undefined
    return [
      { label: 'Evidence', value: readinessDimensions.evidence, tooltip: 'How well-supported your factor estimates are.' },
      { label: 'Robustness', value: readinessDimensions.robustness, tooltip: 'How sensitive the recommendation is to assumption shifts.' },
      { label: 'Framing', value: readinessDimensions.clarity, tooltip: 'How clearly the decision and options are framed.' },
    ]
  }, [readinessDimensions])

  // Stability indicator renders adjacent to the win-probability ring. Suppressed
  // when the field is missing — never emits "Stability: NaN%".
  const stabilityScore = data.recommendation.recommendationStability
  const stabilityIndicator = useMemo(() => {
    if (typeof stabilityScore !== 'number' || !Number.isFinite(stabilityScore)) return null
    const pct = Math.round(stabilityScore * 100)
    return (
      <div className="flex flex-col gap-0.5 w-full" data-testid="hero-stability-indicator">
        <div className="flex items-center justify-between gap-2">
          <span className={`${typography.panelMeta} text-text-light`}>Stability</span>
          <span className={`${typography.panelMeta} text-text-light`}>{pct}%</span>
        </div>
        <div
          className="w-full h-[3px] rounded-sm overflow-hidden"
          style={{ backgroundColor: 'var(--border-default, #EEE6D8)' }}
        >
          <div
            className="h-full rounded-sm"
            style={{ width: `${pct}%`, backgroundColor: evaluativeVar(stabilityScore) }}
          />
        </div>
      </div>
    )
  }, [stabilityScore])

  return (
    <div className="space-y-4 animate-fade-in" data-testid="decision-confidence-panel">
      {/* Transition bridge */}
      <TransitionBridge verifiedCount={verifiedCount} influenceCoverage={influenceCoverage} />

      {/* 1. Health header — ring shows the winner's win probability, with a
          stability indicator below the ring, a qualifier line under the
          headline, and 3 readiness dimension bars (evidence/robustness/framing). */}
      <TriageHealthHeader
        title="Current result"
        ringLabel="%"
        ringDimensions={ringDimensions}
        dimensions={heroDimensions}
        headline={headline}
        coaching={healthHeaderCoaching}
        overrideScore={winProbabilityScore}
        mode="single"
        ringCaption={hasWinProbability ? 'win probability' : undefined}
        secondaryIndicator={stabilityIndicator}
        qualifier={readinessDimensions ? <HeroQualifier dimensions={readinessDimensions} /> : undefined}
        testId="confidence-health-header"
      />

      {/* 2. Result checks — target probabilities only (flip-risk extracted to T1FlipRiskCallout per D2c). */}
      <ResultChecks data={data} />

      {/* 2a. Flip-risk callout — moved out of ResultChecks per D2c step 1.
          LOCKED copy preserved verbatim. Suppresses when no fragile edge. */}
      <T1FlipRiskCallout data={data} onFocusNode={onFocusNode} />

      {/* 2b. Conditional scenarios (Brief 4 Task 10) — between the flip-risk
          callout and the evidence-gap triage cards, per brief. */}
      {data.confidence.conditionalWinners && data.confidence.conditionalWinners.length > 0 && (
        <ConditionalWinnerCards
          winners={data.confidence.conditionalWinners}
          recommendedLabel={data.recommendation.recommendedOption?.label}
          onFocusNode={onFocusNode}
        />
      )}

      {/* 2c. Dominant-factor nudge — moved out of DriversSection per D2c step 2.
          Suppresses when the top driver does not exceed the dominance threshold. */}
      <T1DominantNudge
        data={data}
        onFocusNode={onFocusNode}
        onSendMessage={onSendMessage}
      />

      {/* 3. Stability narrative + unified EVPI-ranked queue (Brief 5.8B D2b).
          The narrative is suppressed when there are no items; the queue
          itself collapses to nothing. Card #1 gets the .ac.em info-bordered
          treatment to anchor user attention. */}
      <StabilityNarrative
        itemCount={top3.length}
        stabilityScore={stabilityScore}
      />

      {top3.length === 0 && data.confidence.topEvidenceGapsEmpty && (
        <div className="rounded-lg border border-panel-border bg-panel px-3 py-2">
          <p className={`${typography.panelBody} text-text-light`}>
            No high-value evidence gaps. Your current uncertainties have minimal impact on the result.
          </p>
        </div>
      )}

      {top3.length > 0 && (
        <div className="flex flex-col gap-1.5" data-testid="unified-triage-queue">
          {top3.map((item, i) => {
            const emphasised = i === 0
            return (
              <div
                key={item.key}
                className={emphasised ? 'rounded-[10px] border border-info/40 bg-info/[0.02]' : ''}
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

      {/* 5. Quick-fix rows (items 4-6) — collapsible "Also consider" */}
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

      {/* 6. T1 checks footer — Brief 5.8B D2c step 3. Compact glyph row
          (Winner / Robust / Evidence gaps) + addressed counter + the shared
          MissingKnowledgePrompt. Replaces the standalone bottom-of-panel
          MissingKnowledgePrompt that ResultsBody used to render. */}
      <T1ChecksFooter data={data} aiAffordance={aiAffordance} />
    </div>
  )
})

export default DecisionConfidencePanel
