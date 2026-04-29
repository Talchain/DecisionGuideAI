/**
 * PreAnalysisPanel - Pre-Analysis Results Tab Right Panel (Phase 2)
 *
 * Three-tier hierarchy structure:
 * 1. Header (with tier counts)
 * 2. Success Target section
 * 3. Must address tier
 * 4. Review assumptions tier
 * 5. Optional improvements tier (collapsed by default)
 * 6. Model Snapshot accordion
 * 7. Analysis Settings accordion
 * 8. Sticky Footer (pinned)
 *
 * Scrollable content area between header and sticky footer.
 * All data derives from existing graph state — no new backend endpoints.
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { usePreAnalysisData } from './hooks/usePreAnalysisData'
import { ModelHealthCard } from './ModelHealthCard'
import { SuccessTarget } from './SuccessTarget'
import { BlockersSection } from './BlockersSection'
import { OptionPreview, OPTION_PREVIEW_TITLE } from './OptionPreview'
import { deriveExpertiseGroups } from './hooks/deriveExpertiseGroups'
import { StickyFooter } from './StickyFooter'
import { focusNodeById } from '../../utils/focusHelpers'
import { withObservedStateUpdate } from '../../utils/observedStateHelpers'
import { useCanvasStore } from '../../store'
import { useDraftStore } from '../../stores/draftStore'
import { useRetryDraft } from '../../hooks/useRetryDraft'
import { SOFT_BYPASS_STATUSES } from '../../hooks/usePreRunValidation'
import { useShowToast } from '../../ToastContext'
import { useAnalysisDisplayState } from '../../hooks/useAnalysisDisplayState'
import type { AnalysisDisplayStateView } from '../../utils/deriveAnalysisDisplayState'
import { copyTextToClipboard } from '../../../utils/clipboard'
import { RefreshCw, Copy, Pencil, AlertTriangle, Check, X, Frame, ShieldAlert, Gauge, Anchor, EyeOff, ChevronDown, ChevronRight, Link as LinkIcon, Play, AlertCircle } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { getCausalEdges } from '../../domain/edgeUtils'
import type { EdgeData } from '../../domain/edges'
import { TriageCard } from '@/components/shared/TriageCard'
import type { ScientificEditorProps } from '@/components/shared/ScientificEditor'
import { mapImprovementToTriageCard } from './mapImprovementToTriageCard'
import type { TriageCardItem } from './mapImprovementToTriageCard'
import { filterRedundantBlockers } from './filterRedundantBlockers'
import type { AiDiscussElement } from './buildAiDiscussPrompt'
import { DiscussWithAiButton } from './DiscussWithAiButton'
import {
  pickStartHere,
  BIAS_SEVERITY_SCORE,
  OPTION_QUALITY_SEVERITY,
  type ReviewNextSignal,
  type TriageSignal,
} from './pickStartHere'
import {
  resolveReviewNextCoachingLine,
  getImproveConfidenceCoachingLine,
} from './sectionCoaching'
import { useResolvedSignals } from './useResolvedSignals'
import { usePrefersReducedMotion } from '@/canvas/hooks/usePrefersReducedMotion'
import Tooltip from '@/components/Tooltip'
import { typography } from '@/styles/typography'
import { MissingKnowledgePrompt } from '@/components/shared/MissingKnowledgePrompt'
import { resolveEditorRawValue, resolveCapHintSubtitle } from './utils/resolveEditorRawValue'
import { decisionShapeScore } from './utils/decisionShapeScore'
import { formatValueWithUnit } from '../../utils/formatValueWithUnit'
import { hasFeasibilityWarning } from './utils/hasFeasibilityWarning'
import { SectionErrorBoundary } from '../SectionErrorBoundary'
import { SectionHeader } from '@/components/results/SectionHeader'
// ValidationMetadata / UserAction / ResolvedValue were consumed by the
// removed handleResolveContestedEdge handler (Brief 4 Task 6).

/** AI source provenance labels */
const AI_SOURCES = new Set(['ai', 'cee_inference', 'inferred', 'ai_estimate', 'engine'])

/**
 * Icon + title lookup for CEE bias type strings.
 * Defined at module scope so the biasTriggers useMemo dependency array stays stable.
 *
 * Two key spaces are supported because CEE has two field conventions in flight:
 *   1. Lowercase `type` (existing CEEBiasFinding.type field) — anchoring,
 *      framing, confidence, confirmation, blind_spots
 *   2. Uppercase `code` (newer schema variant — AUTHORITY_BIAS, etc.) — these
 *      need explicit mapping per the brief.
 *
 * Any unrecognised key falls back to BIAS_FALLBACK (EyeOff) per the brief.
 */
const BIAS_TYPE_ICON: Record<string, { icon: typeof Frame; title: string }> = {
  // Lowercase type values (existing field convention)
  framing:      { icon: Frame,     title: 'Narrow framing' },
  anchoring:    { icon: Anchor,    title: 'Anchoring' },
  confidence:   { icon: Gauge,     title: 'Overconfidence' },
  blind_spots:  { icon: EyeOff,    title: 'Blind spots' },
  confirmation: { icon: Frame,     title: 'Confirmation bias' },
  // Uppercase code values (newer schema)
  AUTHORITY_BIAS:    { icon: Anchor, title: 'Authority bias' },
  CONFIRMATION_BIAS: { icon: Gauge,  title: 'Confirmation bias' },
  SUNK_COST:         { icon: Anchor, title: 'Sunk cost' },
  NARROW_FRAMING:    { icon: Frame,  title: 'Narrow framing' },
  STATUS_QUO_BIAS:   { icon: EyeOff, title: 'Status quo bias' },
}

/** Generic fallback for unrecognised bias codes per the brief. */
const BIAS_FALLBACK: { icon: typeof Frame; title: string } = {
  icon: EyeOff,
  title: 'Bias detected',
}

/** Truncate a long bias explanation to 80 chars; the full text remains in the title attribute. */
const BIAS_EXPLANATION_MAX = 80
function truncateExplanation(s: string): string {
  if (s.length <= BIAS_EXPLANATION_MAX) return s
  return s.slice(0, BIAS_EXPLANATION_MAX - 1).trimEnd() + '…'
}

/** Severity rank for sorting CEE findings. Lower = higher priority. */
const BIAS_SEVERITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 }

/**
 * Brief 5.3 Task 5 / 5.7 D5: AUTHORITY_BIAS without a concrete `target_factor_id`
 * is meta-commentary, not an actionable signal. Suppress at the trigger builder
 * so neither the start-here variant nor the Review-next variant ever renders
 * this case. Other bias kinds remain unaffected — they may legitimately fire
 * without a target factor.
 *
 * Exported for unit testing.
 */
export function shouldSuppressBiasFinding(
  finding: { code?: string; type?: string; target_factor_id?: string },
): boolean {
  const code = (finding.code ?? finding.type ?? '').toString().toLowerCase()
  const isAuthority = code === 'authority_bias' || code === 'authoritybias'
  // Trim before existence check so whitespace-only ids (e.g. "   ") are
  // treated as absent. Without this, `normaliseCeeBiasFinding` would still
  // catch the case via its own resolver/trim, but the predicate's contract
  // would disagree with the downstream behaviour.
  const hasTarget = (finding.target_factor_id ?? '').trim().length > 0
  return isAuthority && !hasTarget
}

/**
 * Brief 5.7 D7: AI-estimated improvement items should already carry a confirm
 * action from `usePreAnalysisData` (the cee_inference branch attaches one).
 * Augment defensively — symmetric with the missing-data path — so any item
 * that arrives without an action still renders the Confirm chip plus the
 * inline editor (mapItem attaches editorConfig when action.kind === 'confirm'
 * and focus.id is present).
 *
 * Items already carrying an `action` pass through unchanged. Items lacking a
 * focus.id pass through unchanged (no valid target to confirm against).
 *
 * Exported for unit testing.
 */
export function augmentAiEstimatedItemWithConfirm<
  T extends { action?: unknown; focus?: { id?: string; type?: string; label?: string } | null },
>(item: T): T {
  if (item.action) return item
  if (!item.focus?.id) return item
  return {
    ...item,
    action: { kind: 'confirm' as const, label: 'Confirm', targetId: item.focus.id, targetType: 'node' as const },
  }
}

/**
 * Permissive shape for CEE bias findings. The CEEBiasFinding TypeScript type
 * lags the runtime shape — newer CEE responses include `code`, `explanation`,
 * `category`, and `micro_intervention` fields that are not in the type. We
 * read both old and new field names so the panel works whether or not CEE
 * has migrated.
 */
type RawBiasFinding = {
  id?: string
  type?: string
  code?: string
  category?: string
  severity?: string
  description?: string
  explanation?: string
  citation?: string
  target_factor_id?: string
  interventions?: Array<{ description?: string; [k: string]: unknown }>
  micro_intervention?: { steps?: Array<{ text?: string; [k: string]: unknown }>; [k: string]: unknown }
}

export interface NormalisedBiasTrigger {
  id: string
  icon: typeof Frame
  title: string
  subtitle: string
  fullExplanation: string
  severity: string
  /** First step text from micro_intervention.steps, when present. Enriches the sparkle prompt
   *  with a specific debiasing technique (unified spec §3.3: sparkle only, no text pills). */
  microInterventionStep: string | null
  /** Brief 5.7 D5 follow-up: when the finding carried a `target_factor_id`
   *  AND the id resolved to a graph node, propagate both the id and the
   *  resolved label so the render layer can name the target factor. When the
   *  id is present but does not resolve to any graph node, the trigger is
   *  suppressed (returns null) — a target we cannot name is no better than
   *  the original generic meta-commentary. */
  targetFactorId: string | null
  targetFactorLabel: string | null
}

/**
 * Resolves a CEE bias finding into a render-ready trigger.
 *
 * Brief 5.7 follow-up: takes a `resolveLabel(id) → label | null` resolver so
 * the target_factor_id can be looked up against the live graph. The resolver
 * lives in component scope and reads the current `nodes` array.
 *
 * Suppression rules:
 *   - finding has neither `explanation` nor `description` → null
 *   - finding has a `target_factor_id` BUT the resolver returns null → null
 *     (we cannot honestly name the target, so do not render the card)
 */
export function normaliseCeeBiasFinding(
  raw: RawBiasFinding,
  idx: number,
  resolveLabel: (id: string) => string | null,
): NormalisedBiasTrigger | null {
  // Lookup key: prefer uppercase `code`, fall back to lowercase `type`.
  const lookupKey = raw.code || raw.type || ''
  const config = BIAS_TYPE_ICON[lookupKey] ?? BIAS_FALLBACK

  // Subtitle text: prefer `explanation` (newer schema), fall back to `description`.
  const fullExplanation = (raw.explanation || raw.description || '').trim()
  if (!fullExplanation) return null

  // Resolve the target factor when the finding identifies one. An unresolvable
  // id, or a resolver that returns a blank label, is treated as "no target"
  // and the card is suppressed below — we never want to render targeting copy
  // that points at nothing.
  const rawTargetId = (raw.target_factor_id ?? '').trim()
  const resolvedLabelRaw = rawTargetId ? resolveLabel(rawTargetId) : null
  const targetFactorLabel = resolvedLabelRaw && resolvedLabelRaw.trim()
    ? resolvedLabelRaw.trim()
    : null
  if (rawTargetId && !targetFactorLabel) return null

  // micro_intervention.steps[0].text is the new schema; fall back to first
  // entry in `interventions[].description` (existing schema).
  const microStep =
    raw.micro_intervention?.steps?.[0]?.text
    ?? raw.interventions?.[0]?.description
    ?? null

  // Stable id: prefer raw.id, then the lookup key, then the array index.
  // Parenthesised explicitly because mixing ?? and || in the same expression
  // is a TypeScript syntax error.
  const stableId = raw.id ?? (lookupKey || String(idx))

  // When a resolved target is available, the factor name lives in the
  // subtitle's targeting sentence rather than being folded into the title
  // as well. This mirrors the brief D5 example copy ("Watch for authority
  // bias on [Factor Name]. <reason>") and avoids the visual redundancy of
  // showing the factor name twice in the same card. Title stays as the
  // canonical bias type so sparkle prompts and other consumers see a clean
  // category label rather than a sentence fragment.
  const subtitleBase = truncateExplanation(fullExplanation)
  const subtitle = targetFactorLabel
    ? `Watch for ${config.title.toLowerCase()} on ${targetFactorLabel}. ${subtitleBase}`
    : subtitleBase

  return {
    id: `cee_bias_${stableId}`,
    icon: config.icon,
    title: config.title,
    subtitle,
    fullExplanation,
    severity: raw.severity ?? 'medium',
    microInterventionStep: microStep ?? null,
    targetFactorId: rawTargetId || null,
    targetFactorLabel: targetFactorLabel ?? null,
  }
}

/** Binary pass/fail row for triage check rows — failed rows show optional action link */
function TriageCheckRow({ label, pass, actionLabel, onAction }: {
  label: string
  pass: boolean
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div className="flex items-center gap-2">
      {pass
        ? <Check className="w-3.5 h-3.5 text-success flex-shrink-0" aria-hidden="true" />
        : <X className="w-3.5 h-3.5 text-danger flex-shrink-0" aria-hidden="true" />}
      <span className={`${typography.panelBody} ${pass ? 'text-text-body' : 'text-text-light'} flex-1`}>{label}</span>
      {!pass && actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className={`${typography.panelMeta} text-info hover:underline cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-info rounded`}
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}

interface PreAnalysisPanelProps {
  /** Callback when user clicks the primary action button */
  onAnalyse: () => void
  /** Whether analysis is currently running */
  isAnalysing?: boolean
  /** Shared blocked reason for the Analyse CTA */
  blockedReason?: string
  /** Callback to send a message in the conversation panel */
  onSendMessage?: (text: string) => void
  /**
   * Expert mode toggle from OutputsDock (`</>` button in the tab bar).
   * When true, developer-facing diagnostics (correlation IDs, copy-diagnostics
   * button, raw error payloads) render in the panel. Off by default so the
   * failure state stays user-friendly.
   */
  expertMode?: boolean
}


/**
 * Top status banner — single source of truth for panel state.
 *
 * Two render paths:
 *   1. failed — analysis failure (lastDraftError). Renders unchanged with
 *      retry affordance. This is a separate concern from the canonical
 *      `deriveAnalysisDisplayState` mapping (which models pre-run / done
 *      / stale states) and is preserved here.
 *   2. helper-driven — every other case consumes `useAnalysisDisplayState`
 *      so the headline + icon + colour exactly match the rest of the UI
 *      (InputsDock empty-state, debug bundle, etc.). Bucket counts from
 *      `usePreAnalysisData` (mustFix / reviewNext) flow in as a sub-line
 *      below the headline so the user still sees the specific number of
 *      items to address.
 *
 * In failed state, content below is de-emphasised by the parent (opacity 0.6)
 * except the error detail/retry. The banner does not show "Ready" alongside
 * a failure.
 */
type BannerState =
  | { kind: 'failed'; canRetry: boolean }
  | { kind: 'derived'; mustFixCount: number; reviewNextCount: number }

const HELPER_ICON_MAP = {
  Play,
  Check,
  RefreshCw,
  AlertCircle,
} as const

function bucketSubLine(
  view: AnalysisDisplayStateView,
  mustFixCount: number,
  reviewNextCount: number,
): string | null {
  switch (view.state) {
    case 'not_ready':
      if (mustFixCount === 1) return '1 item to address before analysis'
      if (mustFixCount > 1) return `${mustFixCount} items to address before analysis`
      return null
    case 'ready_to_analyse':
      if (reviewNextCount === 1) return '1 check would improve results.'
      if (reviewNextCount > 1) return `${reviewNextCount} checks would improve results.`
      return null
    case 'complete':
    case 'results_stale':
      return null
  }
}

function StatusBanner({
  state,
  onRetry,
  isRetrying,
}: {
  state: BannerState
  onRetry?: () => void
  isRetrying?: boolean
}) {
  const view = useAnalysisDisplayState()

  if (state.kind === 'failed') {
    const text = state.canRetry
      ? 'Analysis failed. Your model is intact. Retry or review the issue below.'
      : 'Analysis failed. Your model is intact. Review the issue below.'
    return (
      <div
        className="flex items-start gap-2 py-2"
        role="status"
        data-testid="pre-analysis-status-banner"
      >
        <AlertTriangle
          size={16}
          className="mt-0.5 text-danger flex-shrink-0"
          aria-hidden="true"
        />
        <p className={`${typography.panelBody} text-text-body flex-1`}>{text}</p>
        {state.canRetry && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            disabled={isRetrying}
            className={`flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${typography.panelMeta} text-info border border-info/30 bg-transparent hover:bg-panel-hover disabled:opacity-50 cursor-pointer`}
            data-testid="status-banner-retry"
          >
            <RefreshCw size={11} className={isRetrying ? 'animate-spin' : ''} />
            {isRetrying ? 'Retrying' : 'Retry'}
          </button>
        )}
      </div>
    )
  }

  const Icon = HELPER_ICON_MAP[view.iconName]
  const subLine = bucketSubLine(view, state.mustFixCount, state.reviewNextCount)

  return (
    <div
      className="py-2"
      role="status"
      data-testid="pre-analysis-status-banner"
      data-display-state={view.state}
    >
      <div className="flex items-center gap-2">
        <Icon
          size={16}
          className={`${view.textColorClass} flex-shrink-0`}
          aria-hidden="true"
        />
        <p className={`${typography.panelHeader} ${view.textColorClass}`}>
          {view.headline}
        </p>
      </div>
      {subLine && (
        <p className={`${typography.panelBody} text-text-light mt-0.5 ml-6`}>
          {subLine}
        </p>
      )}
    </div>
  )
}

// SectionHeader is imported from @/components/results/SectionHeader (shared component, unified spec §2.1).

/**
 * Improve confidence — collapsible accordion (collapsed by default).
 * Shows a "Highest value: ..." summary line above the chevron when applicable.
 */
function ImproveConfidenceAccordion({
  count,
  highestValueLabel,
  subtitle,
  coachingLine,
  children,
}: {
  count: number
  highestValueLabel: string | null
  /** Scope subtitle rendered below the header row in panelMeta/text-text-light */
  subtitle?: string
  /** P1-3: per-section coaching line; rendered below the header when non-null */
  coachingLine?: string | null
  children: React.ReactNode
}) {
  const [expanded, setExpanded] = useState(false)
  if (count <= 0) return null
  return (
    <div className="space-y-1" data-testid="improve-confidence-section">
      {highestValueLabel && (
        <p className={`${typography.panelMeta} text-info`}>
          Highest value: {highestValueLabel}
        </p>
      )}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between gap-2 py-1 cursor-pointer hover:bg-panel-hover rounded"
        aria-expanded={expanded}
        data-testid="improve-confidence-toggle"
      >
        <div className="flex items-center gap-2">
          <h3 className={`${typography.panelHeader} text-text-header`}>Improve confidence</h3>
          <span
            className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full border border-factor/30 ${typography.panelMeta} text-text-body`}
          >
            {count}
          </span>
        </div>
        {expanded
          ? <ChevronDown className="w-4 h-4 text-text-light" aria-hidden="true" />
          : <ChevronRight className="w-4 h-4 text-text-light" aria-hidden="true" />}
      </button>
      {subtitle && (
        <p className={`${typography.panelMeta} text-text-light`} data-testid="improve-confidence-subtitle">
          {subtitle}
        </p>
      )}
      {coachingLine && (
        <p className={`${typography.panelMeta} text-text-light`} data-testid="improve-confidence-coaching">
          {coachingLine}
        </p>
      )}
      {expanded && (
        <div className="space-y-3" data-testid="improve-confidence-content">
          {children}
        </div>
      )}
    </div>
  )
}

export function PreAnalysisPanel({
  onAnalyse,
  isAnalysing = false,
  blockedReason,
  onSendMessage,
  expertMode = false,
}: PreAnalysisPanelProps) {
  // Get all panel data from hook (includes derived progress counts)
  const data = usePreAnalysisData()

  // P1-8: local toggle for Review next "Show more". Overflow stays inside
  // Review next (does not migrate to Improve confidence); this controls
  // visibility within the section.
  const [reviewNextExpanded, setReviewNextExpanded] = useState(false)

  // P1-5: prefers-reduced-motion flag — used to skip the fade transition on
  // resolved-state rows for users who requested reduced motion.
  const prefersReducedMotion = usePrefersReducedMotion()

  // Task P.3.2: Get node and edge counts for minimal graph coaching
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const isMinimalGraph = (nodes?.length ?? 0) < 3 || (edges?.length ?? 0) < 2

  // Retry draft hook — for re-running CEE when blocked due to LLM omission
  const { retryDraft, canRetry, isRetrying } = useRetryDraft()
  const showToast = useShowToast()

  // Detect retry-eligible state: blocked + CEE status indicates LLM omission
  const ceeStatus = useCanvasStore(s => s.ceeAnalysisReady?.status)
  const canRetryDraft = canRetry && !data.isReady && !!ceeStatus && SOFT_BYPASS_STATUSES.has(ceeStatus)

  // Draft error state for error card
  const lastDraftError = useDraftStore(s => s.lastDraftError)

  // Run error code (e.g. MISSING_INTERVENTIONS from V2 run) — surfaced by
  // OutputsDock's coached-recovery banner. Used to suppress Must fix blockers
  // whose message is already carried by that banner (UI-BUG-2).
  const runErrorCode = useCanvasStore(s => s.results?.error?.code ?? null)

  // CEE analysis ready for feasibility + constraints
  const ceeAnalysisReady = useCanvasStore(s => s.ceeAnalysisReady)

  // Constraint feasibility warning — from CEE model_critiques (shared helper)
  const hasConstraintFeasibilityWarning = useMemo(
    () => hasFeasibilityWarning(ceeAnalysisReady?.model_critiques),
    [ceeAnalysisReady],
  )


  // Phase 2B: One-click fix — "Set value" opens the inspector for a factor (non-destructive)
  const selectNodeWithoutHistory = useCanvasStore(s => s.selectNodeWithoutHistory)
  const handleSetValueForGap = useCallback((factorId: string) => {
    // Note: FIX_CLICKED is also fired in GapRow.handleClick; PreAnalysisPanel is the
    // logical orchestrator so we skip double-firing here.
    // Select the factor node to open inspector — non-destructive, no undo needed
    selectNodeWithoutHistory(factorId)
    focusNodeById(factorId)
  }, [selectNodeWithoutHistory])

  // Retry handler with toast feedback
  const handleRetryDraft = useCallback(async () => {
    const result = await retryDraft()
    if (result.success) {
      showToast('Draft refreshed. Check readiness.', 'success')
    } else {
      showToast(result.error || 'Draft retry failed', 'error')
    }
  }, [retryDraft, showToast])

  // Edit brief handler — opens DraftChat for re-phrasing
  const setShowDraftChat = useCanvasStore(s => s.setShowDraftChat)
  const handleEditBrief = useCallback(() => {
    setShowDraftChat(true)
  }, [setShowDraftChat])

  // Focus handlers - wire to canvas focus helpers
  const setHighlightedNodes = useCanvasStore(s => s.setHighlightedNodes)
  const setHighlightedEdges = useCanvasStore(s => s.setHighlightedEdges)

  const handleFocusNode = useCallback((nodeId: string) => {
    selectNodeWithoutHistory(nodeId)
    setHighlightedNodes([nodeId])
    focusNodeById(nodeId)
    setTimeout(() => setHighlightedNodes([]), 3000)
  }, [setHighlightedNodes, selectNodeWithoutHistory])

  // Hover handlers - highlight graph elements on panel item hover
  const handleHoverElement = useCallback((type: 'node' | 'edge', id: string) => {
    if (type === 'node') {
      setHighlightedNodes([id])
      setHighlightedEdges([])
    } else {
      setHighlightedEdges([id])
      setHighlightedNodes([])
    }
  }, [setHighlightedNodes, setHighlightedEdges])

  const handleHoverClear = useCallback(() => {
    setHighlightedNodes([])
    setHighlightedEdges([])
  }, [setHighlightedNodes, setHighlightedEdges])

  // Goal change handler - update both ceeAnalysisReady AND outcomeNodeId for run pipeline
  const handleGoalChange = useCallback((goalId: string) => {
    const { ceeAnalysisReady, setCeeAnalysisReady, setOutcomeNode } = useCanvasStore.getState()

    // Update outcomeNodeId for run pipeline (useV2Run reads this)
    setOutcomeNode(goalId)

    // Update ceeAnalysisReady for pre-analysis data
    if (ceeAnalysisReady) {
      setCeeAnalysisReady({ ...ceeAnalysisReady, goal_node_id: goalId })
    } else {
      // Create minimal ceeAnalysisReady with the selected goal
      // options: [] is required by type - run pipeline uses outcomeNodeId anyway
      setCeeAnalysisReady({
        status: undefined,
        goal_node_id: goalId,
        options: [],
      })
    }
  }, [])

  // Threshold change handler - update both goal node data AND goalThreshold store field
  const handleThresholdChange = useCallback((value: number | null) => {
    const { setGoalThresholdAndUpdateNode, setGoalThreshold } = useCanvasStore.getState()
    const goalNode = data.goalNode
    if (goalNode) {
      setGoalThresholdAndUpdateNode(goalNode.id, value)
    } else {
      setGoalThreshold(value)
    }
  }, [data.goalNode])

  // Threshold confirm handler - mark threshold as confirmed in goal node
  const handleThresholdConfirm = useCallback(() => {
    const { updateNode } = useCanvasStore.getState()
    const goalNode = data.goalNode

    if (goalNode) {
      updateNode(goalNode.id, {
        data: {
          ...goalNode.data,
          threshold_confirmed: true,
        },
      })
    }
  }, [data.goalNode])

  // Threshold edit handler - clear confirmed status
  const handleThresholdEdit = useCallback(() => {
    const { updateNode } = useCanvasStore.getState()
    const goalNode = data.goalNode

    if (goalNode) {
      updateNode(goalNode.id, {
        data: {
          ...goalNode.data,
          threshold_confirmed: false,
        },
      })
    }
  }, [data.goalNode])

  // Contested-edge resolve handler removed in Brief 4 Task 6 dead-code sweep.

  // === SENSITIVITY MAPS (Task 4) ===
  const preAnalysisSensitivity = useCanvasStore(s => s.preAnalysisSensitivity)
  const factorInfluenceMap = useMemo(() => {
    if (!preAnalysisSensitivity?.factor_influence) return undefined
    const entries = Object.entries(preAnalysisSensitivity.factor_influence)
    return entries.length > 0 ? new Map(entries) : undefined
  }, [preAnalysisSensitivity])

  // Composite influence map: VoI takes precedence when available (post-analysis).
  // Used by expertise triage cards and triage sort so they reflect
  // the best available signal: VoI when present, factor_influence otherwise.
  const compositeInfluenceMap = useMemo(() => {
    if (data.voiMap && data.voiMap.size > 0) return data.voiMap
    return factorInfluenceMap
  }, [data.voiMap, factorInfluenceMap])
  const edgeInfluenceMap = useMemo(() => {
    if (!preAnalysisSensitivity?.edge_influence) return undefined
    const entries = Object.entries(preAnalysisSensitivity.edge_influence)
    return entries.length > 0 ? new Map(entries) : undefined
  }, [preAnalysisSensitivity])

  // Weighted influence reviewed — fraction of total influence covered by user-reviewed factors
  const weightedInfluenceReviewed = useMemo(() => {
    if (!factorInfluenceMap || factorInfluenceMap.size === 0) return undefined
    const reviewedIds = new Set<string>()
    for (const node of nodes) {
      const nd = node.data as Record<string, unknown>
      if (nd.kind !== 'factor' && node.type !== 'factor') continue
      const os = (nd.observedState ?? nd.observed_state) as Record<string, unknown> | undefined
      const source = os?.source as string | undefined
      if (source === 'user_confirmed' || source === 'user_assumption' || source === 'user_override') {
        reviewedIds.add(node.id)
      }
    }
    let reviewedSum = 0
    let totalSum = 0
    for (const [id, influence] of factorInfluenceMap) {
      totalSum += influence
      if (reviewedIds.has(id)) reviewedSum += influence
    }
    return totalSum > 0 ? reviewedSum / totalSum : 0
  }, [factorInfluenceMap, nodes])

  // === INTERACTIVE ACTION HANDLERS ===

  // P1-5: Refs holding the current triage signals + markResolved callback
  // so handleConfirm can look up the signal_id by nodeId and mark resolved
  // without creating a circular declaration (useResolvedSignals is declared
  // later in the function body because it depends on allReviewNextSignals).
  const triageSignalsRef = useRef<TriageSignal[]>([])
  const markResolvedRef = useRef<((e: { signalId: string; label: string; kind: 'confirm' | 'setValue'; undoSnapshot: unknown }) => void) | null>(null)
  const undoResolvedRef = useRef<((signalId: string) => unknown | null) | null>(null)

  // Confirm action - mark factor source as user_confirmed. P1-5: snapshots
  // the previous node.data so useResolvedSignals can hold an undo payload.
  const handleConfirm = useCallback((nodeId: string) => {
    const { nodes, updateNode } = useCanvasStore.getState()
    const node = nodes.find(n => n.id === nodeId)
    if (!node) return

    // Snapshot before mutation so Undo can restore the exact previous state.
    const undoSnapshot = { nodeId, previousData: node.data }

    updateNode(nodeId, {
      data: withObservedStateUpdate(node.data, { source: 'user_confirmed', extractionType: 'explicit' }),
    })

    const match = triageSignalsRef.current.find((s: TriageSignal) => s.focusId === nodeId)
    if (match && markResolvedRef.current) {
      markResolvedRef.current({
        signalId: match.id,
        label: match.card.title,
        kind: 'confirm',
        undoSnapshot,
      })
    }
  }, [])

  // P1-5: Undo a resolved signal — restores the snapshot node.data via
  // updateNode and removes the resolved entry so the original card renders
  // again. No-op when the signal has no snapshot.
  const handleUndoResolved = useCallback((signalId: string) => {
    if (!undoResolvedRef.current) return
    const snapshot = undoResolvedRef.current(signalId) as { nodeId: string; previousData: unknown } | null
    if (!snapshot) return
    const { updateNode } = useCanvasStore.getState()
    updateNode(snapshot.nodeId, { data: snapshot.previousData as Record<string, unknown> })
    // UI-BUG-8: clear draft error so the Analyse button re-enables after undo.
    // The value change that triggered the error has been reverted.
    useDraftStore.getState().setLastDraftError(null)
  }, [])

  // Inline value edit — update factor observed state with user-provided raw value
  const handleInlineEditValue = useCallback((nodeId: string, rawValue: number, cap: number | null) => {
    const { nodes, updateNode } = useCanvasStore.getState()
    const node = nodes.find(n => n.id === nodeId)
    if (!node) return

    const normalised = cap != null && cap > 0 ? rawValue / cap : rawValue
    updateNode(nodeId, {
      data: withObservedStateUpdate(node.data, {
        raw_value: rawValue,
        value: normalised,
        source: 'user_override',
      }),
    })
    // Parametric edit — observed state is read from graph nodes at request build time,
    // not from ceeAnalysisReady. Option intervention mappings remain valid.
  }, [])

  // Edge strength quick-select — update edge weight via canonical updateEdgeData (clamps [0,2])
  const handleUpdateEdgeStrength = useCallback((edgeId: string, value: number) => {
    const { updateEdgeData } = useCanvasStore.getState()
    // Write weight through updateEdgeData (clamped). Clear strength_mean so
    // computeSignedMean falls through to weight + direction (the canvas schema path).
    updateEdgeData(edgeId, { weight: value, strength_mean: undefined })
  }, [])

  // Action handlers passed to TriageCard and expertise triage cards

  // Don't show panel if canvas is empty AND not loading
  // When loading, show the "Generating..." placeholder via ModelHealthCard
  if (!data.isLoading &&
      data.nodesByKind.goal.length === 0 &&
      data.nodesByKind.option.length === 0 &&
      data.nodesByKind.factor.length === 0) {
    return null
  }

  // === READINESS SCORE (for adaptive footer CTA) ===
  // D11: Decision shape — smooth 0–1 score from graph state (replaces completeness heuristic).
  // Constraint node IDs excluded from edge count (structural scaffolding, not causal links).
  const constraintNodeIds = useMemo(
    () => new Set(nodes.filter(n => n.type === 'constraint').map(n => n.id)),
    [nodes],
  )
  const completeness = useMemo(() => decisionShapeScore({
    optionCount: data.nodesByKind.option.length,
    outcomeCount: data.nodesByKind.goal.length + data.nodesByKind.outcome.length,
    factorCount: data.nodesByKind.factor.length,
    edgeCount: edges.filter(e => !constraintNodeIds.has(e.source) && !constraintNodeIds.has(e.target)).length,
  }), [data.nodesByKind, edges, constraintNodeIds])
  const evidence = data.evidenceQuality.ratio
  // D12: "Your contribution" replaces "Coverage" slot. Uses the same non-AI ratio
  // as `evidence` (documented duplication until D13 provides a distinct grounding signal).
  const balance = data.evidenceQuality.ratio
  const calibration = data.totalReviewableFactorsCount > 0
    ? data.reviewedFactorsCount / data.totalReviewableFactorsCount
    : 0
  // readinessScore was previously surfaced in the footer (now driven by
  // bannerState + data.isReady). Removed in v2 panel regroup.

  // === TRIAGE CONTENT ===

  // Map improvement items to TriageCard props (diversified top3 + quickFix)
  // Build editorConfig for factor items that need "Set value" inline editing
  type MappedCard = TriageCardItem & { editorConfig?: ScientificEditorProps | null; aiDiscuss?: AiDiscussElement }
  const mapItem = (item: typeof data.triageActions.top3[number]): MappedCard => {
    const influence = item.focus?.type === 'edge'
      ? edgeInfluenceMap?.get(item.focus.id)
      : compositeInfluenceMap?.get(item.focus?.id ?? '')
    const mapped = mapImprovementToTriageCard(item, influence)

    // P1-2: build the discuss-with-AI element from the item shape so the
    // sparkle button can pre-fill chat with a contextual prompt.
    let aiDiscuss: AiDiscussElement | undefined
    if (item.focus?.type === 'edge') {
      const arrow = item.label.indexOf(' → ')
      if (arrow > 0) {
        aiDiscuss = { kind: 'edge', from: item.label.slice(0, arrow), to: item.label.slice(arrow + 3) }
      }
    } else if (item.focus?.type === 'node') {
      aiDiscuss = { kind: 'factor', label: item.label }
    }

    // Attach editorConfig for every factor item with set_value or confirm action,
    // regardless of whether rawValue/value is present. When both are null (including
    // inferred-zero "Not set" items) rawValue is passed as null so the input renders
    // empty with placeholder text rather than pre-filling with a misleading value.
    //
    // Inferred-zero items: rawValue is 0 in the data but semantically "not set".
    // Using `??` would pass 0 through (0 is not null/undefined). When the item's
    // detail is 'Not set' we force null so the inline editor starts empty.
    const targetId = item.action?.targetId
    // Brief 4 hotfix Task 3: priority chain extracted into resolveEditorRawValue
    // so the brief-extraction cap-fallback is unit-testable in isolation.
    const resolverInput = {
      detail: item.detail,
      rawValue: item.rawValue ?? null,
      cap: item.cap ?? null,
      unit: item.unit ?? null,
      sourceBadge: item.sourceBadge,
    }
    const numericValue = resolveEditorRawValue(resolverInput)
    // Follow-up to the P0 #1 narrowing: when the editor is left empty in the
    // brief-extracted-with-cap case, surface the extracted ceiling as a
    // subtitle hint so the card body doesn't fall back to "$0" via the
    // upstream formatObservedStateDetail. `mapped.subtitle` is overridden
    // only when the predicate fires; other items keep their existing subtitle
    // (CEE hint / deterministic derived context / generic fallback).
    const capHintSubtitle = resolveCapHintSubtitle(resolverInput, formatValueWithUnit)
    const subtitle = capHintSubtitle ?? mapped.subtitle
    if (targetId && item.focus?.type === 'node' && (mapped.action?.kind === 'set_value' || mapped.action?.kind === 'confirm')) {
      return {
        ...mapped,
        subtitle,
        editorConfig: {
          kind: 'factor' as const,
          rawValue: numericValue,
          cap: item.cap ?? null,
          unit: item.unit ?? null,
          onSave: (rawValue: number) => handleInlineEditValue(targetId, rawValue, item.cap ?? null),
          onCancel: () => {},
        },
        aiDiscuss,
      }
    }
    return { ...mapped, aiDiscuss }
  }
  const triageTop3 = data.triageActions.top3.map(mapItem)
  const triageQuickFix = data.triageActions.quickFix.map(mapItem)
  const triageCards = [...triageTop3, ...triageQuickFix]

  // Bias trigger cards — CEE findings take precedence when available.
  // Falls back to UI-side deterministic checks when CEE provides no findings.
  // Max 2 cards. Trigger shape is shared across both paths so the render layer
  // can treat them uniformly. The CEE path includes micro_intervention.steps[0]
  // when present, which enriches the sparkle prompt with a debiasing technique.
  const biasTriggers = useMemo<NormalisedBiasTrigger[]>(() => {
    const triggers: NormalisedBiasTrigger[] = []

    const ceeBiasFindings = (ceeAnalysisReady?.bias_findings ?? []) as RawBiasFinding[]

    // Brief 5.7 D5 follow-up: resolver lookup against the live graph so a
    // CEE-supplied target_factor_id can be turned into a render-ready label.
    // Returns null when the id does not resolve to any node — the trigger is
    // then suppressed in normaliseCeeBiasFinding.
    const resolveLabel = (id: string): string | null => {
      const node = nodes.find(n => n.id === id)
      if (!node) return null
      const label = (node.data as Record<string, unknown>)?.label
      return typeof label === 'string' && label.trim() ? label : null
    }

    if (ceeBiasFindings.length > 0) {
      // Sort CEE findings by severity: high → medium → low (BIAS_SEVERITY_RANK)
      const sorted = [...ceeBiasFindings].sort(
        (a, b) => (BIAS_SEVERITY_RANK[a.severity ?? ''] ?? 9) - (BIAS_SEVERITY_RANK[b.severity ?? ''] ?? 9),
      )
      for (let i = 0; i < sorted.length; i++) {
        const finding = sorted[i]
        if (shouldSuppressBiasFinding(finding)) continue
        const normalised = normaliseCeeBiasFinding(finding, i, resolveLabel)
        if (normalised) triggers.push(normalised)
        if (triggers.length >= 2) break
      }
      if (triggers.length > 0) return triggers
      // If no CEE finding produced a usable trigger, fall through to deterministic
    }

    // Deterministic fallback — graph-signal-only checks. Each check produces
    // a trigger in the shared NormalisedBiasTrigger shape (no micro_intervention,
    // no target factor — these are graph-level signals that do not anchor to
    // a single node).

    const pushDeterministic = (
      id: string,
      icon: typeof Frame,
      title: string,
      explanation: string,
    ) => {
      triggers.push({
        id,
        icon,
        title,
        subtitle: truncateExplanation(explanation),
        fullExplanation: explanation,
        severity: 'medium',
        microInterventionStep: null,
        targetFactorId: null,
        targetFactorLabel: null,
      })
    }

    // 1. Narrow framing: fewer than 2 non-baseline options
    const nonBaselineOptions = data.optionPreviews.filter(o => !o.isBaseline)
    if (nonBaselineOptions.length < 2) {
      pushDeterministic(
        'narrow_framing',
        Frame,
        'Narrow framing',
        'Consider structurally different approaches. What would a competitor do?',
      )
    }

    // 2. Missing risks: 0 or 1 risk nodes
    if (data.nodesByKind.risk.length <= 1) {
      pushDeterministic(
        'missing_risks',
        ShieldAlert,
        'Missing risks',
        'Your model has few risks. Consider what could go wrong with each option.',
      )
    }

    // 3. Overconfidence: top factor by influence is AI-sourced with no uncertainty_drivers
    // Uses compositeInfluenceMap so VoI takes precedence over sensitivity when available.
    if (compositeInfluenceMap && compositeInfluenceMap.size > 0) {
      let topFactorId: string | null = null
      let topInfluence = -1
      for (const [id, inf] of compositeInfluenceMap) {
        if (inf > topInfluence) { topInfluence = inf; topFactorId = id }
      }
      if (topFactorId) {
        const topNode = nodes.find(n => n.id === topFactorId)
        if (topNode) {
          const nd = topNode.data as Record<string, unknown>
          const os = (nd.observedState ?? nd.observed_state) as Record<string, unknown> | undefined
          const source = os?.source as string | undefined
          const rawDrivers = os?.uncertainty_drivers
          const drivers = Array.isArray(rawDrivers) ? rawDrivers : undefined
          if (source && AI_SOURCES.has(source) && (!drivers || drivers.length === 0)) {
            const label = (nd.label as string) ?? topFactorId
            pushDeterministic(
              'overconfidence',
              Gauge,
              'Overconfidence',
              `${label} drives most of the outcome but has no supporting evidence. Validate it before relying on it.`,
            )
          }
        }
      }
    }

    // 4. Anchoring: all non-baseline options affect same factors with narrow intervention spread
    if (data.optionPreviews.length >= 2) {
      const optionMaps: Map<string, number>[] = []
      let allValid = true
      for (const opt of data.optionPreviews.filter(o => !o.isBaseline)) {
        if (!opt.interventions || opt.interventions.length === 0) { allValid = false; break }
        const m = new Map<string, number>()
        for (const iv of opt.interventions) {
          if (iv.factorId && iv.interventionValue != null) m.set(iv.factorId, iv.interventionValue)
        }
        if (m.size === 0) { allValid = false; break }
        optionMaps.push(m)
      }
      if (allValid && optionMaps.length >= 2) {
        const allFactorIds = new Set(optionMaps.flatMap(m => [...m.keys()]))
        const sharedFactors = [...allFactorIds].filter(fId => optionMaps.every(m => m.has(fId)))
        if (sharedFactors.length === allFactorIds.size && sharedFactors.length > 0) {
          let allNarrow = true
          let hasValidFactor = false
          for (const fId of sharedFactors) {
            const fNode = nodes.find(n => n.id === fId)
            if (!fNode) continue
            const fOs = ((fNode.data as Record<string, unknown>).observedState ?? (fNode.data as Record<string, unknown>).observed_state) as Record<string, unknown> | undefined
            const baseline = fOs?.value as number | undefined
            if (baseline == null || baseline === 0) continue
            hasValidFactor = true
            const values = optionMaps.map(m => m.get(fId)).filter((v): v is number => v != null)
            if (values.length < 2) continue
            const spread = Math.max(...values) - Math.min(...values)
            if (spread >= Math.abs(baseline) * 0.2) { allNarrow = false; break }
          }
          if (allNarrow && hasValidFactor) {
            pushDeterministic(
              'anchoring',
              Anchor,
              'Anchoring',
              'Your options are similar. Try a wider range of approaches.',
            )
          }
        }
      }
    }

    return triggers.slice(0, 2)
  }, [ceeAnalysisReady?.bias_findings, data.optionPreviews, data.nodesByKind.risk, compositeInfluenceMap, nodes])

  // === V2 PANEL BUCKETS ===
  // Three-bucket regroup: Must fix → Review next → Improve confidence.
  // Deduplication rule: any item that appears in Must fix is excluded from
  // the other two buckets. Filter on item key (which carries through the
  // mapper unchanged).

  // Must fix: critical 'fix' category triage cards (filtered on category from
  // the mapper output) plus enriched blockers. Triage cards are already
  // ordered by priority; cards with category === 'fix' represent blockers.
  // Dedup key: signal_id (Signal Registry v3 §7) when populated, else item key.
  // signal_id population is deferred — see ImprovementItem.signal_id comment.
  const mustFixCardKeys = new Set<string>()
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mustFixCards is populated via for-loop; stable deps would require memoising triageCards (which is itself spread-composed on every render). Pre-existing pattern; acceptable re-run cost.
  const mustFixCards: typeof triageCards = []
  for (const c of triageCards) {
    if (c.category === 'fix') {
      mustFixCardKeys.add(c.signal_id ?? c.key)
      mustFixCards.push(c)
    }
  }

  // Structural check rows. Two dedup rules:
  //   1. Only fire when CEE has run and the data is real (not empty
  //      optionPreviews from a loading/mock state). Avoids spurious checks.
  //   2. Suppress a structural row when an equivalent fix-category triage
  //      card already covers the issue. e.g. usePreAnalysisData emits a
  //      'fewer_than_2_options' fix card whenever optionNodes.length < 2;
  //      we don't want to render the same blocker twice in Must fix.
  const noBaselineCheck = !data.isLoading && data.qualityChecks.some(c => c.id === 'no_baseline')
  const fewerThanTwoOptionsCheck = !data.isLoading
    && data.optionPreviews.length > 0
    && data.optionPreviews.length < 2
    && !mustFixCardKeys.has('fewer_than_2_options')

  // P0-2: filter blockers that the Draft failed card already covers, so the
  // user does not see "Options need configuration" twice (once in the error
  // card, once in Must fix). Pure render-time transform; does not mutate
  // validation state. Lifted above mustFixCount so the count and the rendered
  // list stay consistent.
  const visibleEnrichedBlockers = useMemo(
    () => filterRedundantBlockers(data.enrichedBlockers, lastDraftError, runErrorCode),
    [data.enrichedBlockers, lastDraftError, runErrorCode],
  )

  const enrichedBlockerCount = !data.isReady ? visibleEnrichedBlockers.length : 0
  const structuralCheckCount = (noBaselineCheck ? 1 : 0) + (fewerThanTwoOptionsCheck ? 1 : 0)
  const mustFixCount = mustFixCards.length + enrichedBlockerCount + structuralCheckCount

  // Review next: top-3 triage cards (excluding any in Must fix), bias triggers,
  // and option quality card. The card surfaces when:
  //   - same_levers quality check fires (options too similar), OR
  //   - the model has fewer than 3 options (encourage broader framing).
  // Note: < 2 options is also a Must fix structural blocker, but the Review next
  // card still appears with coaching to explore alternatives.
  //
  // P1-8: hard budget — max 1 option-quality + 2 bias + 3 triage = 6 visible
  // (plus 1 Start here slot added by P1-4). Anything beyond the budget stays
  // inside Review next as overflow behind a "Show more" toggle. Overflow does
  // NOT migrate to Improve confidence — that would mix semantic ownership.
  const REVIEW_NEXT_TRIAGE_BUDGET = 3
  const REVIEW_NEXT_BIAS_BUDGET = 2
  const reviewNextTriageAll = triageTop3.filter(c => !mustFixCardKeys.has(c.signal_id ?? c.key))
  const showOptionQualityCard = data.optionPreviews.length > 0
    && (data.qualityChecks.some(c => c.id === 'same_levers') || data.optionPreviews.length < 3)

  // P1-4: build the unified signal list across ALL Review next kinds and pick
  // the highest-priority item as "Start here". Re-evaluated on every render so
  // a newly important item promotes automatically when state changes.
  //
  // Scoring:
  //   - triage: VoI > factor_influence > 0 (via TriageCardItem.influence which is
  //     the composite map value). Defaulted when no influence map exists.
  //   - option_quality: 0.9 (intervention overlap via same_levers) else 0.7
  //   - bias: CEE severity or fallback 'medium' (0.65)
  const hasIntervestionOverlap = data.qualityChecks.some(c => c.id === 'same_levers')
  // Keep the ref in sync with the latest signals so handleConfirm sees the
  // current set on its next invocation. Assigned outside useMemo because
  // ref writes during render are safe as long as they don't affect other
  // reads within the same render.
  const triageSignals: TriageSignal[] = reviewNextTriageAll.map((card, idx) => {
    const improvement = data.triageActions.top3[idx]
    const influence = card.influence
    const score = typeof influence === 'number' ? influence : -1
    return {
      kind: 'triage',
      id: `triage:${card.key}`,
      score: score < 0 ? 0.3 : score,
      defaultedScore: score < 0 || !compositeInfluenceMap || compositeInfluenceMap.size === 0,
      focusId: improvement?.focus?.id,
      card,
    }
  })
  const biasSignals: ReviewNextSignal[] = biasTriggers.map(trigger => ({
    kind: 'bias',
    id: `bias:${trigger.id}`,
    score: BIAS_SEVERITY_SCORE[trigger.severity ?? 'medium'] ?? 0.65,
    defaultedScore: false,
    biasType: trigger.title,
    subtitle: trigger.subtitle,
    targetFactorLabel: trigger.targetFactorLabel ?? undefined,
  }))
  const optionQualitySignal: ReviewNextSignal | null = showOptionQualityCard
    ? {
        kind: 'option_quality',
        id: 'option_quality',
        score: hasIntervestionOverlap
          ? OPTION_QUALITY_SEVERITY.intervention_overlap
          : OPTION_QUALITY_SEVERITY.few_options,
        defaultedScore: false,
        optionLabels: data.optionPreviews.map(o => o.label),
        hasInterventionOverlap: hasIntervestionOverlap,
      }
    : null
  const allReviewNextSignals: ReviewNextSignal[] = [
    ...triageSignals,
    ...biasSignals,
    ...(optionQualitySignal ? [optionQualitySignal] : []),
  ]
  // P1-5: keep the triage signals ref in sync so handleConfirm can look up
  // the signal_id for a given nodeId on its next invocation.
  triageSignalsRef.current = triageSignals

  // P1-5: parent-managed resolved state. Hook takes the set of live signal
  // ids so the reaper can remove entries whose underlying signal has been
  // filtered out of the panel (e.g. the triage item disappeared after confirm
  // propagated through the store).
  const liveSignalIds = useMemo(
    () => new Set(allReviewNextSignals.map(s => s.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allReviewNextSignals.map(s => s.id).join('|')],
  )
  const { resolved: resolvedSignals, markResolved, undo: undoResolved } = useResolvedSignals(liveSignalIds)
  // Publish the latest callbacks to the refs used by handleConfirm /
  // handleUndoResolved so those stable callbacks don't need to re-bind.
  markResolvedRef.current = markResolved
  undoResolvedRef.current = undoResolved

  // Dominant factor override (CEE) — falls back to undefined when not present.
  const dominantFactorId =
    (ceeAnalysisReady as { review?: { dominant_factor_low_confidence?: { factor_id?: string } } } | undefined)
      ?.review?.dominant_factor_low_confidence?.factor_id

  const startHereSignal = pickStartHere(allReviewNextSignals, {
    dominantFactorId,
  })
  const pickedKey = startHereSignal ? `${startHereSignal.kind}:${startHereSignal.id}` : null
  const signalCount = allReviewNextSignals.length
  useEffect(() => {
    if (import.meta.env.VITE_DEBUG_PREANALYSIS !== '1') return
    // eslint-disable-next-line no-console
    console.debug('[PreAnalysis] pickStartHere', {
      signalCount,
      mustFixCount,
      picked: pickedKey,
    })
  }, [signalCount, mustFixCount, pickedKey])

  // Exclude startHere from downstream lists by id so the same signal_id never
  // appears twice in Review next (P1-8 invariant). Also exclude resolved
  // signals (P1-5) so the card disappears the instant the user confirms.
  const startHereId = startHereSignal?.id
  const isExcluded = (id: string) => id === startHereId || resolvedSignals.has(id)
  const reviewNextTriageAfterStart = reviewNextTriageAll.filter(c => !isExcluded(`triage:${c.key}`))
  const biasTriggersAfterStart = biasTriggers.filter(t => !isExcluded(`bias:${t.id}`))
  const reviewNextTriageVisible = reviewNextTriageAfterStart.slice(0, REVIEW_NEXT_TRIAGE_BUDGET)
  const reviewNextTriageOverflow = reviewNextTriageAfterStart.slice(REVIEW_NEXT_TRIAGE_BUDGET)
  const reviewNextBiasVisible = biasTriggersAfterStart.slice(0, REVIEW_NEXT_BIAS_BUDGET)
  const reviewNextBiasOverflow = biasTriggersAfterStart.slice(REVIEW_NEXT_BIAS_BUDGET)
  const reviewNextOverflowCount = reviewNextTriageOverflow.length + reviewNextBiasOverflow.length
  // Section badge counts the TRUE total (visible + overflow + Start here) so
  // users see the real number even when overflow is collapsed.
  const reviewNextCount =
    reviewNextTriageAll.length
    + biasTriggers.length
    + (showOptionQualityCard ? 1 : 0)
  // Kept for existing call sites that previously referenced `reviewNextTopCards`.
  const reviewNextTopCards = reviewNextTriageVisible

  // Improve confidence: SuccessTarget (always present), remaining (quickFix)
  // triage cards, Your expertise, missing knowledge prompt.
  // The accordion always renders so users can adjust the goal target and review
  // their expertise — even when nothing else is pending.
  const improveConfidenceCards = triageQuickFix.filter(c => !mustFixCardKeys.has(c.signal_id ?? c.key))

  // D7: AI-estimated and missing-data items that are NOT already in the triage
  // list. Threaded into Improve confidence as TriageCards so they remain
  // accessible after YourExpertise is removed.
  const expertiseTriageCards = useMemo(() => {
    const groups = deriveExpertiseGroups(
      data.improvementsByCategory,
      data.contestedEdges,
      nodes,
      edges,
      compositeInfluenceMap,
      edgeInfluenceMap,
    )
    // Deduplicate: skip items whose focus node ID is already in the triage list
    const existingIds = new Set(
      triageCards
        .filter(c => c.action?.targetId)
        .map(c => c.action!.targetId!),
    )
    const extras: ReturnType<typeof mapItem>[] = []
    for (const item of groups.aiEstimated) {
      if (item.focus?.id && existingIds.has(item.focus.id)) continue
      // Brief 5.7 D7: defensive augmentation. See augmentAiEstimatedItemWithConfirm.
      extras.push(mapItem(augmentAiEstimatedItemWithConfirm(item)))
    }
    for (const item of groups.missingData) {
      if (item.focus?.id && existingIds.has(item.focus.id)) continue
      // Augment synthetic missing-data items with a Set value action so mapItem
      // attaches the inline editor (editorConfig fires on action.kind === 'confirm').
      const augmented = {
        ...item,
        action: { kind: 'confirm' as const, label: 'Set value', targetId: item.focus!.id, targetType: 'node' as const },
      }
      extras.push(mapItem(augmented))
    }
    return extras
  // mapItem is a render-local function; its captured deps (compositeInfluenceMap,
  // edgeInfluenceMap, handleInlineEditValue) are tracked in the array below.
  // Adding mapItem itself would recreate the memo on every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.improvementsByCategory, data.contestedEdges, nodes, edges, compositeInfluenceMap, edgeInfluenceMap, triageCards])

  // Brief 4 hotfix Task 5: the goal target is only an improvement item when
  // the user hasn't confirmed the threshold yet. Once confirmed, drop it from
  // the count so header and subtitle stop over-reporting. Apply the same
  // include-goal rule to the subtitle at the accordion render below.
  const includeGoalAsImprovement = data.isThresholdConfirmed ? 0 : 1
  // D7: expertise items are now threaded into the accordion as triage cards,
  // so they are included in the section count (replaces the prior comment
  // explaining why they were intentionally excluded).
  const improveConfidenceCount = includeGoalAsImprovement
    + improveConfidenceCards.length
    + expertiseTriageCards.length

  // Highest-value summary line above the accordion. Surfaces the most impactful
  // action when it lives inside Improve confidence (so it isn't hidden by the
  // collapse). Two paths:
  //   1. The topmost triage card overall is in the Improve confidence bucket.
  //   2. There are no remaining triage cards anywhere AND the success target is
  //      unset — in that case the goal target itself is the top remaining action.
  const overallTop = triageTop3[0] ?? triageQuickFix[0] ?? null
  const topCardInsideImproveConfidence =
    overallTop && improveConfidenceCards.some(c => c.key === overallTop.key)
  const noTriageCardsAnywhere = triageTop3.length === 0 && triageQuickFix.length === 0
  const goalTargetIsTopAction = noTriageCardsAnywhere && data.successThreshold == null
  const highestValueLabel = topCardInsideImproveConfidence
    ? overallTop.title
    : goalTargetIsTopAction
      ? 'Set success target'
      : null

  // Dynamic headline for the health card. Reads from the same bucket data
  // already computed above so there's no duplicate work. Precedence:
  //   1. CEE-provided coaching_summary (if/when CEE populates it)
  //   2. First Must fix item → "[label]. Address before analysis."
  //      Order matches the rendered Must fix section: enriched blockers first,
  //      then structural rows ("Fewer than 2 options", "No baseline set"),
  //      then critical fix triage cards.
  //   3. First Review next item → subject-specific sentence (see branch
  //      comments). Plural-subject option card gets "Review your options
  //      before running."; singular bias triggers get "[Bias] may be shaping
  //      your choices. …"; singular triage cards get "[Factor] has the
  //      biggest impact. …". Order matches the rendered Review next section.
  //   4. Improve confidence has actionable cards → "Ready to run. [N] checks would improve results."
  //   5. Else → "Ready to run."
  // Returns null while loading (the card shows its own loading state).
  const dynamicHeadline = useMemo<string | null>(() => {
    if (data.isLoading) return null

    // 1. CEE override (always wins when present)
    const ceeSummary = ceeAnalysisReady?.coaching_summary
    if (ceeSummary && ceeSummary.trim().length > 0) return ceeSummary

    // 2. Must fix — match the rendered display order, not the data shape order
    if (mustFixCount > 0) {
      const firstFix =
        // 2a. Enriched blockers (rendered first in the section) — use the
        //     filtered list so the headline doesn't echo a blocker that the
        //     draft-error card already covers (P0-2 dedup).
        (!data.isReady ? visibleEnrichedBlockers[0]?.display?.title : null)
        // 2b. Structural rows (rendered second; "Fewer than 2 options" before "No baseline set")
        ?? (fewerThanTwoOptionsCheck ? 'Fewer than 2 options' : null)
        ?? (noBaselineCheck ? 'No baseline set' : null)
        // 2c. Critical fix triage cards (rendered last)
        ?? mustFixCards[0]?.title
      if (firstFix) return `${firstFix}. Address before analysis.`
      return 'Address before analysis.'
    }

    // 3. Review next — match the rendered display order.
    // Each branch builds a full sentence so grammar stays correct per subject
    // (plural "options" vs singular bias/triage titles) and copy fits the
    // nature of the item ("impact" for factors, "shaping your choices" for
    // biases, "review" for the option set).
    if (reviewNextCount > 0) {
      // 3a. Option quality card (rendered first in the section). Plural
      //     subject — the previous flat template produced the ungrammatical
      //     "Your options has the biggest impact." Now we build a sentence
      //     that works for both reasons the card appears (same_levers check
      //     AND fewer than 3 options), without overclaiming either.
      if (showOptionQualityCard) {
        return `Review ${OPTION_PREVIEW_TITLE.toLowerCase()} before running.`
      }
      // 3b. Bias triggers (rendered second). Biases shape reasoning — they
      //     don't "have impact" on a factor, so the triage phrasing is wrong
      //     here. Singular subject.
      const firstBias = biasTriggers[0]?.title
      if (firstBias) {
        return `${firstBias} may be shaping your choices. Review before running.`
      }
      // 3c. Top triage cards (rendered last). Singular factor/edge subject —
      //     the original "has the biggest impact" phrasing fits.
      const firstTriage = reviewNextTopCards[0]?.title
      if (firstTriage) {
        return `${firstTriage} has the biggest impact. Review before running.`
      }
      return 'Ready to run. Review before continuing.'
    }

    // 4 & 5. Ready states — suppress. The StatusBanner above the panel already
    // communicates "Ready to run" (and the reviewNextCount where applicable).
    // Section count badges on Improve confidence and Review next carry the
    // item counts — echoing them here duplicates the count badge information.
    return null
  }, [
    data.isLoading,
    data.isReady,
    ceeAnalysisReady?.coaching_summary,
    mustFixCount,
    mustFixCards,
    visibleEnrichedBlockers,
    fewerThanTwoOptionsCheck,
    noBaselineCheck,
    reviewNextCount,
    reviewNextTopCards,
    biasTriggers,
    showOptionQualityCard,
  ])

  // Banner state — failure is the only case modelled separately; everything
  // else is derived from `useAnalysisDisplayState` inside the banner. The
  // bucket counts pass through as a sub-line. Loading does not produce a
  // banner; the panel content is hidden by ModelHealthCard.
  const bannerState: BannerState = lastDraftError
    ? { kind: 'failed', canRetry: canRetryDraft }
    : { kind: 'derived', mustFixCount, reviewNextCount }

  const isFailed = bannerState.kind === 'failed'

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden" data-testid="pre-analysis-panel">
      {/* Scrollable content area
          Horizontal padding is owned by the scroll container (px-3 = 12px).
          Children MUST NOT add their own px-* / mx-* wrappers — this keeps
          every card, section header, triage row and accordion flush to the
          same 12px lane. DS v5 §4.1 spacing scale; sticky footer retains
          px-4 per §8.9. */}
      <div className="olumi-scrollbar flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-3">
        {/* Top status banner — strict precedence: failed > blocked > recommendations > ready */}
        <StatusBanner
          state={bannerState}
          onRetry={canRetryDraft ? handleRetryDraft : undefined}
          isRetrying={isRetrying}
        />

        {/* Draft error detail — only renders in failed state, full opacity above the
            de-emphasised content. Sits directly below the banner.
            Expert-mode gating: the correlation ID row is a developer-facing
            detail and is hidden from non-expert users. */}
        {isFailed && lastDraftError && (
          <div
            className="rounded-md bg-panel border border-panel-border border-t-[3px] border-t-danger px-4 py-2.5"
            data-testid="draft-error-card"
          >
            <p className={`${typography.panelHeader} text-danger`}>Draft failed</p>
            <p className={`${typography.panelBody} text-text-body mt-0.5`}>{lastDraftError.message}</p>
            {expertMode && lastDraftError.correlationId && (
              <p className={`${typography.panelMeta} text-text-light mt-0.5 font-mono`} data-testid="draft-error-correlation-id">
                ID: {lastDraftError.correlationId}
              </p>
            )}
            <div className="flex items-center gap-2 mt-2">
              {lastDraftError.retryable === false ? (
                <button
                  type="button"
                  onClick={handleEditBrief}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 ${typography.panelBody} text-info bg-transparent border border-info/40 rounded-full hover:border-success/40 hover:text-success transition-colors`}
                  data-testid="draft-error-edit-brief"
                >
                  <Pencil size={12} />
                  Edit brief
                </button>
              ) : canRetryDraft ? (
                <button
                  type="button"
                  onClick={handleRetryDraft}
                  disabled={isRetrying}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 ${typography.panelBody} text-info bg-transparent border border-info/40 rounded-full hover:border-success/40 hover:text-success disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
                  data-testid="draft-error-retry"
                >
                  <RefreshCw size={12} className={isRetrying ? 'animate-spin' : ''} />
                  {isRetrying ? 'Retrying…' : 'Retry Draft'}
                </button>
              ) : null}
              {expertMode && (
                <button
                  type="button"
                  onClick={() => {
                    const diagnostics = {
                      message: lastDraftError.message,
                      status: lastDraftError.status,
                      correlationId: lastDraftError.correlationId,
                      timestamp: new Date(lastDraftError.timestamp).toISOString(),
                    }
                    copyTextToClipboard(JSON.stringify(diagnostics, null, 2))
                    showToast('Diagnostics copied', 'success')
                  }}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 ${typography.panelMeta} text-text-light bg-panel border border-panel-border rounded-full hover:bg-panel-hover transition-colors`}
                  data-testid="draft-error-copy-diagnostics"
                >
                  <Copy size={12} />
                  Copy diagnostics
                </button>
              )}
            </div>
            {lastDraftError.retryable === false && (
              <div className="mt-2 rounded-md bg-panel border border-panel-border px-2.5 py-2">
                <p className={`${typography.panelMeta} text-text-body mb-1`}>Tips for a clearer brief</p>
                <ul className={`${typography.panelMeta} text-text-light space-y-0.5 list-disc pl-3.5`}>
                  <li>State one clear goal</li>
                  <li>List 2–3 options you're considering</li>
                  <li>Mention key factors that matter to your decision</li>
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Three-bucket content + health row. In failed state, de-emphasise everything
            (health, banners, sections) so only the banner and error detail above stay
            at full opacity. */}
        <div className={`space-y-4 ${isFailed ? 'opacity-60 pointer-events-none' : ''}`}>

          {/* Compressed health row: ring + 4 dimension bars + dynamic headline.
              Sits inside the de-emphasised wrapper so it dims with the rest of
              the content when the banner is in failed state. The dynamicHeadline
              prop carries the bucket-derived coaching line; the static
              "Your expertise makes the analysis more reliable…" fallback was
              deleted in the bias-and-headline brief. */}
          <SectionErrorBoundary section="Model health">
            <ModelHealthCard
              compact
              completeness={completeness}
              evidence={evidence}
              balance={balance}
              calibration={calibration}
              optionCount={data.optionPreviews.length}
              goalLabel={data.goalNode ? ((data.goalNode.data as { label?: string })?.label ?? null) : null}
              coachingSummary={data.coachingSummary}
              dynamicHeadline={dynamicHeadline}
              isLoading={data.isLoading}
              hasGoalNode={data.nodesByKind.goal.length > 0}
            />
          </SectionErrorBoundary>

          {/* Section 1: Must fix — only when blockers exist.
              Order per brief:
                1. Options need configuration (enriched blockers — surfaced first)
                2. Structural flags ("Fewer than 2 options", "No baseline set")
                3. Critical severity items from triage cards
              No internal subheader from BlockersSection — Must fix owns the header. */}
          {mustFixCount > 0 && (
            <section className="space-y-2" data-testid="section-must-fix">
              <SectionHeader title="Must fix" count={mustFixCount} borderClass="border-danger/30" className="" testId="section-must-fix-header" />

              {/* 1. Enriched blockers (e.g. Options need configuration). P0-2:
                  filtered to drop entries that the Draft failed card already covers. */}
              {!data.isReady && visibleEnrichedBlockers.length > 0 && (
                <SectionErrorBoundary section="Blockers">
                  <BlockersSection
                    blockers={visibleEnrichedBlockers}
                    informationalBlockers={[]}
                    canRetryDraft={canRetryDraft}
                    isRetrying={isRetrying}
                    lastDraftRetryable={lastDraftError?.retryable}
                    onRetryDraft={handleRetryDraft}
                    onEditBrief={handleEditBrief}
                    onFocusNode={handleFocusNode}
                    hideHeader
                  />
                </SectionErrorBoundary>
              )}

              {/* 2. Structural check rows */}
              {structuralCheckCount > 0 && (
                <div className="space-y-1">
                  {fewerThanTwoOptionsCheck && (
                    <TriageCheckRow
                      label="Fewer than 2 options"
                      pass={false}
                      actionLabel="Add option"
                      onAction={() => onSendMessage?.('Add another option to compare')}
                    />
                  )}
                  {noBaselineCheck && (
                    <TriageCheckRow
                      label="No baseline set"
                      pass={false}
                      actionLabel="Add baseline"
                      onAction={() => onSendMessage?.('Add a status quo option to compare against')}
                    />
                  )}
                </div>
              )}

              {/* 3. Critical Fix triage cards */}
              {mustFixCards.length > 0 && (
                <div className="flex flex-col gap-2" data-testid="must-fix-cards">
                  {mustFixCards.map((card, i) => (
                    <TriageCard
                      key={card.key}
                      cardKey={card.key}
                      ordinal={i + 1}
                      title={card.title}
                      detail={card.detail}
                      subtitle={card.subtitle}
                      category={card.category}
                      influence={card.influence}
                      action={card.action}
                      editorConfig={card.editorConfig ?? null}
                      sourcePill={card.sourcePill}
                      aiDiscussSlot={card.aiDiscuss ? <DiscussWithAiButton element={card.aiDiscuss} /> : undefined}
                      onConfirm={handleConfirm}
                      onEdit={handleSetValueForGap}
                      onSendMessage={onSendMessage}
                      onUpdateEdgeStrength={handleUpdateEdgeStrength}
                      onHoverEnter={handleHoverElement}
                      onHoverLeave={handleHoverClear}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Informational (non-blocking) blockers — surfaced regardless of bucket */}
          {data.informationalBlockers.length > 0 && (
            <SectionErrorBoundary section="Notes">
              <BlockersSection
                blockers={[]}
                informationalBlockers={data.informationalBlockers}
                canRetryDraft={false}
                isRetrying={false}
                lastDraftRetryable={undefined}
                onRetryDraft={handleRetryDraft}
                onEditBrief={handleEditBrief}
              />
            </SectionErrorBoundary>
          )}

          {/* Section 2: Review next */}
          {reviewNextCount > 0 && (
            <section className="space-y-2" data-testid="section-review-next">
              <SectionHeader title="Review next" subtitle="Highest-impact checks. Resolving these could change your result." count={reviewNextCount} borderClass="border-info/30" className="" testId="section-review-next-header" />

              {/* P1-3: Per-section coaching line derived from the SAME picked
                  Start here signal. Suppressed when redundant with the Start
                  here card, when the signal carries a defaulted score, or
                  when there's no useful copy to render. */}
              {(() => {
                const line = resolveReviewNextCoachingLine(startHereSignal)
                if (!line) return null
                return (
                  <p className={`${typography.panelMeta} text-text-light`} data-testid="review-next-coaching">
                    {line}
                  </p>
                )
              })()}

              {/* P1-5: Resolved-state rows for recently confirmed triage items.
                  Each row renders "✓ {label} confirmed — Undo" and disappears
                  automatically on the next render cycle once the underlying
                  signal has been filtered out of the live list. Fade is
                  disabled when prefers-reduced-motion is set. */}
              {Array.from(resolvedSignals.values()).map(entry => (
                <div
                  key={`resolved-${entry.signalId}`}
                  className={`flex items-center gap-2 px-2 py-1 text-success ${prefersReducedMotion ? '' : 'transition-opacity duration-200'}`}
                  data-testid="resolved-signal-row"
                >
                  <Check className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                  <span className={`${typography.panelMeta} flex-1 truncate`}>
                    {entry.label} confirmed
                  </span>
                  <button
                    type="button"
                    onClick={() => handleUndoResolved(entry.signalId)}
                    className={`${typography.panelMeta} text-info hover:underline`}
                    aria-label={`Undo confirmation of ${entry.label}`}
                    data-testid={`undo-${entry.signalId}`}
                  >
                    Undo
                  </button>
                </div>
              ))}

              {/* P1-4: Start here card — highest-priority signal elevated with
                  a 3px success left border. Delegates rendering to the
                  underlying signal kind. Exclusion from downstream lists is
                  enforced above by signal_id. */}
              {startHereSignal && (
                <div
                  className="border-l-[3px] border-success rounded-[10px]"
                  data-testid="start-here-card"
                >
                  {startHereSignal.kind === 'triage' && (
                    <TriageCard
                      cardKey={startHereSignal.card.key}
                      // Brief 4 hotfix Task 4: Start Here card does not show a
                      // numeric badge — the green 3px left border + "Start here"
                      // framing already signal primacy. Previously `ordinal={0}`
                      // rendered a "0" circle that users read as "nothing".
                      title={startHereSignal.card.title}
                      detail={startHereSignal.card.detail}
                      subtitle={startHereSignal.card.subtitle}
                      category={startHereSignal.card.category}
                      influence={startHereSignal.card.influence}
                      action={startHereSignal.card.action}
                      editorConfig={(startHereSignal.card as { editorConfig?: ScientificEditorProps | null }).editorConfig ?? null}
                      sourcePill={startHereSignal.card.sourcePill}
                      aiDiscussSlot={(() => {
                        const el = (startHereSignal.card as { aiDiscuss?: AiDiscussElement }).aiDiscuss
                        return el ? <DiscussWithAiButton element={el} /> : undefined
                      })()}
                      onConfirm={handleConfirm}
                      onEdit={handleSetValueForGap}
                      onSendMessage={onSendMessage}
                      onUpdateEdgeStrength={handleUpdateEdgeStrength}
                      onHoverEnter={handleHoverElement}
                      onHoverLeave={handleHoverClear}
                    />
                  )}
                  {startHereSignal.kind === 'bias' && (
                    <div className="relative px-4 pr-7 py-2.5 border border-warning/30 rounded-[10px] hover:bg-panel-hover">
                      <p className={`${typography.panelHeader} text-text-header`}>
                        {startHereSignal.biasType}
                      </p>
                      {/* Brief 5.7 D5: propagate the bias trigger's truncated
                          explanation (subtitle) instead of a generic
                          meta-commentary line. Falls through to a non-meta
                          biasType-aware sentence if the trigger had no
                          explanation. AUTHORITY_BIAS without target_factor_id
                          is filtered upstream and never reaches this branch. */}
                      <p className={`${typography.panelMeta} text-text-light mt-0.5`}>
                        {startHereSignal.subtitle ?? `Be aware of ${startHereSignal.biasType.toLowerCase()} as you review.`}
                      </p>
                      <div className="absolute bottom-1 right-1">
                        <DiscussWithAiButton element={{ kind: 'bias', biasType: startHereSignal.biasType }} />
                      </div>
                    </div>
                  )}
                  {/*
                    Note: the `option_quality` kind is deliberately excluded
                    from Start here by pickStartHere.ts:113
                    (`.filter(s => s.kind !== 'option_quality')`), so a
                    render branch for that kind would be unreachable and was
                    removed to prevent dead-path drift. Option-quality
                    concerns are communicated by the OptionPreview card
                    below rather than by a Start here one-liner.
                  */}
                </div>
              )}

              {/* Option similarity / quality card — interventions collapsed per option.
                  The narrow-framing coaching lives inside OptionPreview (see
                  SameLeversCoaching in that file); Start here never surfaces
                  option_quality signals (excluded by pickStartHere). */}
              {showOptionQualityCard && data.optionPreviews.length > 0 && (
                <OptionPreview
                  options={data.optionPreviews}
                  onFocusNode={handleFocusNode}
                  onHoverEnter={handleHoverElement}
                  onHoverLeave={handleHoverClear}
                  onSendMessage={onSendMessage}
                  hasSameLeversCheck={data.qualityChecks.some(c => c.id === 'same_levers')}
                  collapseInterventionsByDefault
                />
              )}

              {/* Bias trigger cards. Each card shows: icon, title, truncated
                  explanation (full text on hover via tooltip), sparkle bottom-right
                  (auto-submits; incorporates micro_intervention when present).
                  No text pills — unified spec §3.3. P1-8: budget capped at 2
                  visible; overflow appears when the user expands Show more. */}
              {(reviewNextExpanded ? biasTriggersAfterStart : reviewNextBiasVisible).length > 0 && (
                <div className="space-y-1.5" data-testid="review-next-nudges">
                  {(reviewNextExpanded ? biasTriggersAfterStart : reviewNextBiasVisible).map(trigger => {
                    const Icon = trigger.icon
                    // Only attach the DS tooltip when the explanation was
                    // actually truncated — otherwise the hover would just
                    // repeat the visible text. truncateExplanation appends
                    // an ellipsis when the source string exceeds 80 chars,
                    // so length divergence is the cheapest reliable signal.
                    const isTruncated = trigger.subtitle !== trigger.fullExplanation
                    const subtitleEl = (
                      <p className={`${typography.panelBody} text-text-light mt-0.5`}>
                        {trigger.subtitle}
                      </p>
                    )
                    return (
                      <div
                        key={trigger.id}
                        className="relative px-4 pr-7 py-2.5 border border-warning/30 rounded-[10px] hover:bg-panel-hover"
                        data-testid={`bias-trigger-${trigger.id}`}
                      >
                        <div className="flex items-start gap-2">
                          <Icon className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" aria-hidden="true" />
                          <div className="flex-1 min-w-0">
                            <p className={`${typography.panelHeader} text-text-header`}>{trigger.title}</p>
                            {isTruncated ? (
                              <Tooltip
                                delay={300}
                                content={trigger.fullExplanation}
                                className="!max-w-[280px]"
                              >
                                {subtitleEl}
                              </Tooltip>
                            ) : (
                              subtitleEl
                            )}
                          </div>
                        </div>
                        {/* Sparkle bottom-right — auto-submits prompt including micro-intervention
                            technique when present (unified spec §3.3: no text pills on bias cards). */}
                        <div className="absolute bottom-1 right-1">
                          <DiscussWithAiButton element={{ kind: 'bias', biasType: trigger.title, microInterventionStep: trigger.microInterventionStep }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Triage cards (excluding any in Must fix). P1-8: budget capped
                  at 3 visible; overflow appears when Show more expanded. */}
              {(() => {
                const visibleTriage = reviewNextExpanded ? reviewNextTriageAfterStart : reviewNextTopCards
                if (visibleTriage.length === 0) return null
                return (
                  <div className="flex flex-col gap-2" data-testid="triage-top-actions">
                    {visibleTriage.map((card, i) => (
                      <TriageCard
                        key={card.key}
                        cardKey={card.key}
                        ordinal={i + 1}
                        badgeColor="bg-info"
                        title={card.title}
                        detail={card.detail}
                        subtitle={card.subtitle}
                        category={card.category}
                        influence={card.influence}
                        action={card.action}
                        editorConfig={card.editorConfig ?? null}
                        sourcePill={card.sourcePill}
                        aiDiscussSlot={card.aiDiscuss ? <DiscussWithAiButton element={card.aiDiscuss} /> : undefined}
                        onConfirm={handleConfirm}
                        onEdit={handleSetValueForGap}
                        onSendMessage={onSendMessage}
                        onUpdateEdgeStrength={handleUpdateEdgeStrength}
                        onHoverEnter={handleHoverElement}
                        onHoverLeave={handleHoverClear}
                      />
                    ))}
                  </div>
                )
              })()}

              {/* P1-8: Show more / Show less toggle — only when overflow exists */}
              {reviewNextOverflowCount > 0 && (
                <button
                  type="button"
                  onClick={() => setReviewNextExpanded(e => !e)}
                  aria-expanded={reviewNextExpanded}
                  className={`${typography.panelMeta} text-info hover:underline self-start`}
                  data-testid="review-next-show-more"
                >
                  {reviewNextExpanded
                    ? 'Show less'
                    : `Show ${reviewNextOverflowCount} more`}
                </button>
              )}

              {/* "See all N relationships in model tab ›" — anchored to the
                  CURRENTLY-VISIBLE Review next edge cards. The gate uses the
                  same `visibleTriage` set the cards above derive from, so if
                  start-here promotion or the collapsed top-3 budget hides every
                  edge item, the link disappears too. The link's contextual
                  anchor is the cards immediately above it; when those cards
                  contain no edge item, the link has nothing to anchor. */}
              {(() => {
                const causalEdgeCount = getCausalEdges(nodes, edges as Edge<EdgeData>[]).length
                if (causalEdgeCount === 0) return null

                // Build a set of edge-targeted verify item keys, then check
                // whether any visible Review next card carries that key.
                const verifyItems = data.improvementsByCategory.verify ?? []
                const edgeItemKeys = new Set(
                  verifyItems.filter(item => item.focus?.type === 'edge').map(item => item.key),
                )
                if (edgeItemKeys.size === 0) return null

                const visibleTriage = reviewNextExpanded ? reviewNextTriageAfterStart : reviewNextTopCards
                const hasVisibleEdgeCard = visibleTriage.some(card => edgeItemKeys.has(card.key))
                if (!hasVisibleEdgeCard) return null

                const handleClick = () => {
                  // Tell ModelTabBody to focus + auto-expand the relationships
                  // section on its next render. Set BEFORE switching tabs so
                  // the Model tab mounts already aware of the request.
                  // ModelTabBody owns the scroll RAF; it has visibility into
                  // when openSection has been applied, which PreAnalysisPanel
                  // does not.
                  useUIStore.getState().requestModelTabSection('relationships')
                  useUIStore.getState().setActiveOutputTab('diagnostics')
                }
                return (
                  <button
                    type="button"
                    onClick={handleClick}
                    className={`${typography.panelMeta} text-info hover:underline self-start inline-flex items-center gap-1 mt-1`}
                    data-testid="preanalysis-see-all-relationships"
                  >
                    <LinkIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    See all {causalEdgeCount} relationships in model tab ›
                  </button>
                )
              })()}
            </section>
          )}

          {/* Section 3: Improve confidence — collapsed by default.
              P1-3: coaching line derived from actionable count. */}
          <ImproveConfidenceAccordion
            count={improveConfidenceCount}
            highestValueLabel={highestValueLabel}
            subtitle="Lower-impact checks. These sharpen the result but are unlikely to change it."
            coachingLine={
              // Brief 4 hotfix Task 5: subtitle must match header pill. Use the
              // same count and render the complete-state message when there
              // are no actionable improvement items left.
              improveConfidenceCount === 0
                ? 'Your model looks well-calibrated.'
                : getImproveConfidenceCoachingLine(improveConfidenceCount)
            }
          >
            {/* Goal target inline edit */}
            <SuccessTarget
              goalNode={data.goalNode}
              goalNodes={data.nodesByKind.goal}
              successThreshold={data.successThreshold}
              isThresholdAutoDerived={data.isThresholdAutoDerived}
              isThresholdConfirmed={data.isThresholdConfirmed}
              thresholdProvenance={data.thresholdProvenance}
              onThresholdChange={handleThresholdChange}
              onThresholdConfirm={handleThresholdConfirm}
              onThresholdEdit={handleThresholdEdit}
              onGoalChange={handleGoalChange}
              goalThresholdRaw={data.goalThresholdRaw}
              goalThresholdUnit={data.goalThresholdUnit}
              thresholdSourceBadge={data.thresholdSourceBadge}
              onFocusNode={handleFocusNode}
              onHoverEnter={(id) => handleHoverElement('node', id)}
              onHoverLeave={handleHoverClear}
              constraintFeasibilityWarning={hasConstraintFeasibilityWarning}
              goalConstraints={ceeAnalysisReady?.goal_constraints}
              onSendMessage={onSendMessage}
            />

            {/* Remaining triage cards (quick fix) — excluding any in Must fix */}
            {improveConfidenceCards.length > 0 && (
              <div className="flex flex-col gap-2" data-testid="improve-confidence-cards">
                {improveConfidenceCards.map((card, i) => (
                  <TriageCard
                    key={card.key}
                    cardKey={card.key}
                    ordinal={i + 1}
                    badgeColor="bg-option"
                    title={card.title}
                    detail={card.detail}
                    subtitle={card.subtitle}
                    category={card.category}
                    influence={card.influence}
                    action={card.action}
                    editorConfig={card.editorConfig ?? null}
                    sourcePill={card.sourcePill}
                    aiDiscussSlot={card.aiDiscuss ? <DiscussWithAiButton element={card.aiDiscuss} /> : undefined}
                    onConfirm={handleConfirm}
                    onEdit={handleSetValueForGap}
                    onSendMessage={onSendMessage}
                    onUpdateEdgeStrength={handleUpdateEdgeStrength}
                    onHoverEnter={handleHoverElement}
                    onHoverLeave={handleHoverClear}
                  />
                ))}
              </div>
            )}

            {/* D7: AI-estimated and missing-data factor cards (threaded from
                former YourExpertise section). Items deduplicated against the
                triage list above. Same action handlers as triage cards. */}
            {expertiseTriageCards.length > 0 && (
              <div className="flex flex-col gap-2" data-testid="expertise-triage-cards">
                {expertiseTriageCards.map((card, i) => (
                  <TriageCard
                    key={card.key}
                    cardKey={card.key}
                    ordinal={improveConfidenceCards.length + i + 1}
                    badgeColor="bg-factor"
                    title={card.title}
                    detail={card.detail}
                    subtitle={card.subtitle}
                    category={card.category}
                    influence={card.influence}
                    action={card.action}
                    editorConfig={card.editorConfig ?? null}
                    sourcePill={card.sourcePill}
                    aiDiscussSlot={card.aiDiscuss ? <DiscussWithAiButton element={card.aiDiscuss} /> : undefined}
                    onConfirm={handleConfirm}
                    onEdit={handleSetValueForGap}
                    onSendMessage={onSendMessage}
                    onUpdateEdgeStrength={handleUpdateEdgeStrength}
                    onHoverEnter={handleHoverElement}
                    onHoverLeave={handleHoverClear}
                  />
                ))}
              </div>
            )}

            {/* "What's missing?" prompt */}
            <MissingKnowledgePrompt
                context="model"
                aiAffordance={<DiscussWithAiButton element={{ kind: 'missing' }} ariaLabel="Tell AI about something missing from the model" />}
              />
          </ImproveConfidenceAccordion>

          {/* Minimal graph coaching — pre-run guidance, not blocker */}
          {isMinimalGraph && (
            <div
              className="flex items-start gap-2 px-4 py-2.5 bg-panel border border-info/30 rounded-md"
              role="status"
              data-testid="minimal-graph-coaching"
            >
              <AlertTriangle className="w-4 h-4 text-info flex-shrink-0 mt-0.5" aria-hidden="true" />
              <p className={`${typography.panelBody} text-info`}>
                Your model needs more detail for a meaningful analysis. Try adding factors that influence your outcome.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 8. Sticky Footer (pinned to bottom)
          v2: status text mirrors top banner — Blocked when Must fix has items
          (covers structural checks + critical Fix cards + enriched blockers),
          Ready otherwise. Disable state stacks both signals so the button is
          disabled whenever the API says !isReady OR Must fix has items.
          The "0/N addressed" meta is removed (redundant with section counts). */}
      <StickyFooter
        isReady={data.isReady && mustFixCount === 0}
        hasBlockers={data.hasBlockers || mustFixCount > 0}
        blockerCount={Math.max(data.blockerCount, mustFixCount)}
        isAnalysing={isAnalysing}
        onAnalyse={onAnalyse}
        blockedReason={blockedReason}
        isLoading={data.isLoading}
        isRetrying={isRetrying}
        evidenceNonAiCount={data.evidenceQuality.nonAiCount}
        evidenceTotalCount={data.evidenceQuality.totalCount}
        weightedInfluenceReviewed={weightedInfluenceReviewed}
      />
    </div>
  )
}

export default PreAnalysisPanel
