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

import { useState, useCallback, useMemo } from 'react'
import { usePreAnalysisData } from './hooks/usePreAnalysisData'
import { ModelHealthCard } from './ModelHealthCard'
import { SuccessTarget } from './SuccessTarget'
import { BlockersSection } from './BlockersSection'
import { OptionPreview } from './OptionPreview'
import { YourExpertise } from './expertise'
import { StickyFooter } from './StickyFooter'
import { focusNodeById, focusEdgeById } from '../../utils/focusHelpers'
import { withObservedStateUpdate } from '../../utils/observedStateHelpers'
import { useCanvasStore } from '../../store'
import { useRetryDraft } from '../../hooks/useRetryDraft'
import { SOFT_BYPASS_STATUSES } from '../../hooks/usePreRunValidation'
import { useShowToast } from '../../ToastContext'
import { copyTextToClipboard } from '../../../utils/clipboard'
import { RefreshCw, Copy, Pencil, AlertTriangle, Check, X, Frame, ShieldAlert, Gauge, Anchor, EyeOff, ChevronDown, ChevronRight } from 'lucide-react'
import { TriageCard } from '@/components/shared/TriageCard'
import type { ScientificEditorProps } from '@/components/shared/ScientificEditor'
import { mapImprovementToTriageCard } from './mapImprovementToTriageCard'
import type { TriageCardItem } from './mapImprovementToTriageCard'
import { typography } from '@/styles/typography'
import { MissingKnowledgePrompt } from './MissingKnowledgePrompt'
import { hasFeasibilityWarning } from './utils/hasFeasibilityWarning'
import { SectionErrorBoundary } from '../SectionErrorBoundary'
import type { ValidationMetadata, UserAction, ResolvedValue } from '../../domain/validation'

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

/** AI source provenance labels */
const AI_SOURCES = new Set(['ai', 'cee_inference', 'inferred', 'ai_estimate', 'engine'])

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
}


/**
 * Top status banner — single source of truth for panel state.
 *
 * Strict precedence (first match wins):
 *   1. failed   — analysis failure (lastDraftError or analysis error state)
 *   2. blocked  — Must fix section has items
 *   3. ready_with_recommendations — Review next has items
 *   4. ready    — nothing to flag
 *
 * In failed state, content below is de-emphasised by the parent (opacity 0.6)
 * except the error detail/retry. The banner does not show "Ready" alongside
 * a failure.
 */
type BannerState =
  | { kind: 'failed'; messageDetail: string | null; canRetry: boolean }
  | { kind: 'blocked'; mustFixCount: number }
  | { kind: 'ready_with_recommendations'; reviewNextCount: number }
  | { kind: 'ready' }

function StatusBanner({
  state,
  onRetry,
  isRetrying,
}: {
  state: BannerState
  onRetry?: () => void
  isRetrying?: boolean
}) {
  let dotClass: string
  let text: string
  switch (state.kind) {
    case 'failed':
      dotClass = 'bg-danger'
      // Only mention retry when the retry action is actually available; otherwise
      // direct users to review the error detail rendered below.
      text = state.canRetry
        ? 'Analysis failed. Your model is intact. Retry or review the issue below.'
        : 'Analysis failed. Your model is intact. Review the issue below.'
      break
    case 'blocked':
      dotClass = 'bg-danger'
      text = `Blocked by ${state.mustFixCount} ${state.mustFixCount === 1 ? 'issue' : 'issues'}. Fix before running.`
      break
    case 'ready_with_recommendations':
      dotClass = 'bg-success'
      text = `Ready to run. ${state.reviewNextCount} ${state.reviewNextCount === 1 ? 'check' : 'checks'} would improve results.`
      break
    case 'ready':
      dotClass = 'bg-success'
      text = 'Ready to run.'
      break
  }

  return (
    <div
      className="flex items-start gap-2 px-3 py-2"
      role="status"
      data-testid="pre-analysis-status-banner"
    >
      <span
        className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotClass}`}
        aria-hidden="true"
      />
      <p className={`${typography.panelBody} text-text-body flex-1`}>{text}</p>
      {state.kind === 'failed' && state.canRetry && onRetry && (
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

/** Section header used by Must fix and Review next sections */
function SectionHeader({
  title,
  count,
  tone,
  testId,
}: {
  title: string
  count: number
  tone: 'danger' | 'info' | 'factor'
  testId?: string
}) {
  if (count <= 0) return null
  const borderClass =
    tone === 'danger' ? 'border-danger/30' :
    tone === 'info' ? 'border-info/30' :
    'border-factor/30'
  return (
    <div className="flex items-center gap-2 px-3" data-testid={testId}>
      <p className={`${typography.panelHeader} text-text-header`}>{title}</p>
      <span
        className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full border ${borderClass} ${typography.panelMeta} text-text-body`}
      >
        {count}
      </span>
    </div>
  )
}

/**
 * Improve confidence — collapsible accordion (collapsed by default).
 * Shows a "Highest value: ..." summary line above the chevron when applicable.
 */
function ImproveConfidenceAccordion({
  count,
  highestValueLabel,
  children,
}: {
  count: number
  highestValueLabel: string | null
  children: React.ReactNode
}) {
  const [expanded, setExpanded] = useState(false)
  if (count <= 0) return null
  return (
    <div className="space-y-1" data-testid="improve-confidence-section">
      {highestValueLabel && (
        <p className={`${typography.panelMeta} text-info px-3`}>
          Highest value: {highestValueLabel}
        </p>
      )}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between gap-2 px-3 py-1 cursor-pointer hover:bg-panel-hover rounded"
        aria-expanded={expanded}
        data-testid="improve-confidence-toggle"
      >
        <div className="flex items-center gap-2">
          <p className={`${typography.panelHeader} text-text-header`}>Improve confidence</p>
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
}: PreAnalysisPanelProps) {
  // Get all panel data from hook (includes derived progress counts)
  const data = usePreAnalysisData()

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
  const lastDraftError = useCanvasStore(s => s.lastDraftError)

  // CEE analysis ready for feasibility + constraints
  const ceeAnalysisReady = useCanvasStore(s => s.ceeAnalysisReady)

  // Constraint feasibility warning — from CEE model_critiques (shared helper)
  const hasConstraintFeasibilityWarning = useMemo(
    () => hasFeasibilityWarning(ceeAnalysisReady?.model_critiques),
    [ceeAnalysisReady],
  )


  // Phase 2B: One-click fix — "Set value" opens the inspector for a factor (non-destructive)
  const selectNodeWithoutHistory = useCanvasStore(s => s.selectNodeWithoutHistory)
  const selectEdgeWithoutHistory = useCanvasStore(s => s.selectEdgeWithoutHistory)
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

  const handleFocusEdge = useCallback((type: 'node' | 'edge', id: string) => {
    if (type === 'edge') {
      selectEdgeWithoutHistory(id)  // opens edge inspector
      setHighlightedEdges([id])
      focusEdgeById(id)
      setTimeout(() => setHighlightedEdges([]), 3000)
    } else {
      // For nodes, use the node focus handler
      handleFocusNode(id)
    }
  }, [handleFocusNode, selectEdgeWithoutHistory, setHighlightedEdges])

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

  // === CONTESTED EDGE RESOLVE HANDLER (Task 2c) ===
  const handleResolveContestedEdge = useCallback((edgeId: string, action: UserAction, customMean?: number) => {
    const { edges: storeEdges, updateEdge } = useCanvasStore.getState()
    const edge = storeEdges.find(e => e.id === edgeId)
    if (!edge) return
    const edgeData = edge.data as Record<string, unknown>
    const validation = edgeData?.validation as ValidationMetadata | undefined
    if (!validation) return

    let resolvedValue: ResolvedValue | null = null
    const updates: Record<string, unknown> = {
      ...edgeData,
      validation: {
        ...validation,
        user_action: action,
        resolved_by: 'user' as const,
        was_shown: true,
        resolved_value: null as ResolvedValue | null,
      },
    }

    if (action === 'accepted_pass2') {
      resolvedValue = {
        strength_mean: validation.pass2.strength_mean,
        strength_std: validation.pass2.strength_std,
        exists_probability: validation.pass2.exists_probability,
      }
      ;(updates.validation as Record<string, unknown>).resolved_value = resolvedValue
      updates.weight = Math.abs(validation.pass2.strength_mean)
      updates.direction = validation.pass2.strength_mean >= 0 ? 'positive' : 'negative'
    } else if (action === 'overridden' && customMean !== undefined) {
      resolvedValue = { strength_mean: customMean }
      ;(updates.validation as Record<string, unknown>).resolved_value = resolvedValue
      updates.weight = Math.abs(customMean)
      updates.direction = customMean >= 0 ? 'positive' : 'negative'
    } else {
      // accepted_pass1 or dismissed — no value changes
      ;(updates.validation as Record<string, unknown>).resolved_value = null
    }

    updateEdge(edgeId, { data: updates })
  }, [])

  // === SENSITIVITY MAPS (Task 4) ===
  const preAnalysisSensitivity = useCanvasStore(s => s.preAnalysisSensitivity)
  const factorInfluenceMap = useMemo(() => {
    if (!preAnalysisSensitivity?.factor_influence) return undefined
    const entries = Object.entries(preAnalysisSensitivity.factor_influence)
    return entries.length > 0 ? new Map(entries) : undefined
  }, [preAnalysisSensitivity])

  // Composite influence map: VoI takes precedence when available (post-analysis).
  // Passed to YourExpertise for influence bars and triage card sort so they reflect
  // the best available signal: VoI when present, factor_influence (sensitivity) otherwise.
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

  // Confirm action - mark factor source as user_confirmed
  const handleConfirm = useCallback((nodeId: string) => {
    const { nodes, updateNode } = useCanvasStore.getState()
    const node = nodes.find(n => n.id === nodeId)
    if (!node) return

    updateNode(nodeId, {
      data: withObservedStateUpdate(node.data, { source: 'user_confirmed', extractionType: 'explicit' }),
    })
  }, [])

  // Edit action - focus node on canvas for editing
  const handleEdit = useCallback((nodeId: string) => {
    setHighlightedNodes([nodeId])
    focusNodeById(nodeId)
    setTimeout(() => setHighlightedNodes([]), 3000)
  }, [setHighlightedNodes])

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
    updateEdgeData(edgeId, { weight: value, strength_mean: undefined } as any)
  }, [])

  // Focus edge for KeyRelationships (simplified — always edge type)
  const handleFocusEdgeById = useCallback((edgeId: string) => {
    selectEdgeWithoutHistory(edgeId)
    setHighlightedEdges([edgeId])
    focusEdgeById(edgeId)
    setTimeout(() => setHighlightedEdges([]), 3000)
  }, [selectEdgeWithoutHistory, setHighlightedEdges])

  // Add evidence action - store evidence on edge metadata
  const handleAddEvidence = useCallback((edgeId: string, evidence: string) => {
    const { updateEdgeData } = useCanvasStore.getState()

    updateEdgeData(edgeId, {
      evidence: {
        source: evidence,
        added_at: new Date().toISOString(),
      },
    })
  }, [])


  // Action handlers are passed directly to YourExpertise (v6)

  // Don't show panel if canvas is empty AND not loading
  // When loading, show the "Generating..." placeholder via ModelHealthCard
  if (!data.isLoading &&
      data.nodesByKind.goal.length === 0 &&
      data.nodesByKind.option.length === 0 &&
      data.nodesByKind.factor.length === 0) {
    return null
  }

  // === READINESS SCORE (for adaptive footer CTA) ===
  const completeness = data.ceeQuality
    ? (data.ceeQuality.structure ?? 5) / 10
    : (['goal', 'option', 'factor'] as const).filter(k => data.nodesByKind[k].length > 0).length / 3
  const evidence = data.evidenceQuality.ratio
  const balance = data.balanceScore
  const calibration = data.totalReviewableFactorsCount > 0
    ? data.reviewedFactorsCount / data.totalReviewableFactorsCount
    : 0
  const readinessScore = Math.round(
    (clamp01(completeness) + clamp01(evidence) + clamp01(balance) + clamp01(calibration)) / 4 * 100,
  )

  // === TRIAGE CONTENT ===

  // Map improvement items to TriageCard props (diversified top3 + quickFix)
  // Build editorConfig for factor items that need "Set value" inline editing
  type MappedCard = TriageCardItem & { editorConfig?: ScientificEditorProps | null }
  const mapItem = (item: typeof data.triageActions.top3[number]): MappedCard => {
    const influence = item.focus?.type === 'edge'
      ? edgeInfluenceMap?.get(item.focus.id)
      : compositeInfluenceMap?.get(item.focus?.id ?? '')
    const mapped = mapImprovementToTriageCard(item, influence)

    // Attach editorConfig for factor items with set_value action — only when
    // a numeric rawValue exists. Non-numeric values (e.g. qualitative "low")
    // render as coaching text + action buttons instead of an empty number input.
    const targetId = item.action?.targetId
    const numericValue = item.rawValue ?? item.value ?? null
    if (targetId && item.focus?.type === 'node' && numericValue != null && (mapped.action?.kind === 'set_value' || mapped.action?.kind === 'confirm')) {
      return {
        ...mapped,
        editorConfig: {
          kind: 'factor' as const,
          rawValue: numericValue,
          cap: item.cap ?? null,
          unit: item.unit ?? null,
          onSave: (rawValue: number) => handleInlineEditValue(targetId, rawValue, item.cap ?? null),
          onCancel: () => {},
        },
      }
    }
    return mapped
  }
  const triageTop3 = data.triageActions.top3.map(mapItem)
  const triageQuickFix = data.triageActions.quickFix.map(mapItem)
  const triageCards = [...triageTop3, ...triageQuickFix]

  // Icon + title lookup for CEE bias type strings → layer-6 card config
  const BIAS_TYPE_ICON: Record<string, { icon: typeof Frame; title: string }> = {
    framing:     { icon: Frame,     title: 'Narrow framing' },
    anchoring:   { icon: Anchor,    title: 'Anchoring' },
    confidence:  { icon: Gauge,     title: 'Overconfidence' },
    blind_spots: { icon: EyeOff,    title: 'Blind spots' },
    // Map confirmation bias (no direct UI icon) to framing as the closest visual
    confirmation: { icon: Frame,    title: 'Confirmation bias' },
  }

  // Bias trigger cards — CEE findings take precedence when available.
  // Falls back to UI-side deterministic checks when CEE provides no findings.
  // Max 2 cards.
  const biasTriggers = useMemo(() => {
    type BiasTrigger = { id: string; icon: typeof Frame; title: string; subtitle: string; cta: string; ctaAction: string }
    const triggers: BiasTrigger[] = []

    const ceeBiasFindings = ceeAnalysisReady?.bias_findings ?? []

    if (ceeBiasFindings.length > 0) {
      // Sort CEE findings by severity: high → medium → low
      const SEVERITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 }
      const sorted = [...ceeBiasFindings].sort(
        (a, b) => (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9),
      )
      for (const finding of sorted) {
        const config = BIAS_TYPE_ICON[finding.type]
        if (!config) continue
        triggers.push({
          id: `cee_bias_${finding.id}`,
          icon: config.icon,
          title: config.title,
          subtitle: finding.description || `Potential ${finding.type} bias detected.`,
          cta: 'Ask AI',
          ctaAction: `I may have a ${finding.type} bias in my decision model. Can you help me think through it?`,
        })
        if (triggers.length >= 2) break
      }
      if (triggers.length > 0) return triggers
      // If no CEE finding matched a known icon type, fall through to deterministic
    }

    // Deterministic fallback — graph-signal-only checks

    // 1. Narrow framing: fewer than 2 non-baseline options
    const nonBaselineOptions = data.optionPreviews.filter(o => !o.isBaseline)
    if (nonBaselineOptions.length < 2) {
      triggers.push({ id: 'narrow_framing', icon: Frame, title: 'Narrow framing', subtitle: 'Consider structurally different approaches. What would a competitor do?', cta: 'Explore options', ctaAction: 'What other options should I consider?' })
    }

    // 2. Missing risks: 0 or 1 risk nodes
    if (data.nodesByKind.risk.length <= 1) {
      triggers.push({ id: 'missing_risks', icon: ShieldAlert, title: 'Missing risks', subtitle: 'Your model has few risks. Consider what could go wrong with each option.', cta: 'Add risks', ctaAction: 'What risks am I missing?' })
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
          const drivers = os?.uncertainty_drivers as unknown[] | undefined
          if (source && AI_SOURCES.has(source) && (!drivers || drivers.length === 0)) {
            const label = (nd.label as string) ?? topFactorId
            triggers.push({ id: 'overconfidence', icon: Gauge, title: 'Overconfidence', subtitle: `${label} drives most of the outcome but has no supporting evidence. Validate it before relying on it.`, cta: 'Validate', ctaAction: topFactorId })
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
            triggers.push({ id: 'anchoring', icon: Anchor, title: 'Anchoring', subtitle: 'Your options are similar. Try a wider range of approaches.', cta: 'Diversify', ctaAction: 'How could I make my options more different from each other?' })
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

  // Structural blockers — only fire when the data hook says they are real
  // blockers (i.e. CEE has run and reported them). Avoids spurious "Fewer
  // than 2 options" when optionPreviews is empty because CEE has not run yet.
  const noBaselineCheck = !data.isLoading && data.qualityChecks.some(c => c.id === 'no_baseline')
  const fewerThanTwoOptionsCheck = !data.isLoading
    && data.optionPreviews.length > 0
    && data.optionPreviews.length < 2

  // Must fix: critical 'fix' category triage cards (filtered on category from
  // the mapper output) plus enriched blockers. Triage cards are already
  // ordered by priority; cards with category === 'fix' represent blockers.
  const mustFixCardKeys = new Set<string>()
  const mustFixCards: typeof triageCards = []
  for (const c of triageCards) {
    if (c.category === 'fix') {
      mustFixCardKeys.add(c.key)
      mustFixCards.push(c)
    }
  }
  const enrichedBlockerCount = !data.isReady ? data.enrichedBlockers.length : 0
  const structuralCheckCount = (noBaselineCheck ? 1 : 0) + (fewerThanTwoOptionsCheck ? 1 : 0)
  const mustFixCount = mustFixCards.length + enrichedBlockerCount + structuralCheckCount

  // Review next: top-3 triage cards (excluding any in Must fix), bias triggers,
  // and option quality card. The card surfaces when:
  //   - same_levers quality check fires (options too similar), OR
  //   - the model has fewer than 3 options (encourage broader framing).
  // Note: < 2 options is also a Must fix structural blocker, but the Review next
  // card still appears with coaching to explore alternatives.
  const reviewNextTopCards = triageTop3.filter(c => !mustFixCardKeys.has(c.key))
  const showOptionQualityCard = data.optionPreviews.length > 0
    && (data.qualityChecks.some(c => c.id === 'same_levers') || data.optionPreviews.length < 3)
  const reviewNextCount = reviewNextTopCards.length + biasTriggers.length + (showOptionQualityCard ? 1 : 0)

  // Improve confidence: SuccessTarget (always present), remaining (quickFix)
  // triage cards, Your expertise, missing knowledge prompt.
  // The accordion always renders so users can adjust the goal target and review
  // their expertise — even when nothing else is pending.
  const improveConfidenceCards = triageQuickFix.filter(c => !mustFixCardKeys.has(c.key))
  const expertiseHasItems =
    (data.improvementsByCategory.verify?.length ?? 0) > 0
    || (data.improvementsByCategory.add_evidence?.length ?? 0) > 0
    || (data.contestedEdges?.length ?? 0) > 0
  // Count: goal target (always 1) + remaining cards + expertise (when present).
  // The "1" for SuccessTarget keeps the accordion from disappearing in the
  // ready/clean state — users still need to be able to refine the threshold.
  const improveConfidenceCount = 1
    + improveConfidenceCards.length
    + (expertiseHasItems ? 1 : 0)

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

  // Banner state — strict precedence: failed > blocked > recommendations > ready.
  // Loading does not produce a banner; the panel content is hidden by ModelHealthCard.
  const bannerState: BannerState = lastDraftError
    ? { kind: 'failed', messageDetail: lastDraftError.message ?? null, canRetry: canRetryDraft }
    : mustFixCount > 0
      ? { kind: 'blocked', mustFixCount }
      : reviewNextCount > 0
        ? { kind: 'ready_with_recommendations', reviewNextCount }
        : { kind: 'ready' }

  const isFailed = bannerState.kind === 'failed'

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden" data-testid="pre-analysis-panel">
      {/* Scrollable content area */}
      <div className="olumi-scrollbar flex-1 min-h-0 overflow-y-auto py-3 space-y-3">
        {/* Top status banner — strict precedence: failed > blocked > recommendations > ready */}
        <StatusBanner
          state={bannerState}
          onRetry={canRetryDraft ? handleRetryDraft : undefined}
          isRetrying={isRetrying}
        />

        {/* Draft error detail — only renders in failed state, full opacity above the
            de-emphasised content. Sits directly below the banner. */}
        {isFailed && lastDraftError && (
          <div className="px-2">
            <div
              className="rounded-md bg-panel border border-panel-border border-t-[3px] border-t-danger px-3 py-2.5"
              data-testid="draft-error-card"
            >
              <p className={`${typography.panelHeader} text-danger`}>Draft failed</p>
              <p className={`${typography.panelBody} text-text-body mt-0.5`}>{lastDraftError.message}</p>
              {lastDraftError.correlationId && (
                <p className={`${typography.panelMeta} text-text-light mt-0.5 font-mono`}>
                  ID: {lastDraftError.correlationId}
                </p>
              )}
              <div className="flex items-center gap-2 mt-2">
                {lastDraftError.retryable === false ? (
                  <button
                    type="button"
                    onClick={handleEditBrief}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 ${typography.panelMeta} text-info bg-transparent border border-info/40 rounded-full hover:border-success/40 hover:text-success transition-colors`}
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
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 ${typography.panelMeta} text-info bg-transparent border border-info/40 rounded-full hover:border-success/40 hover:text-success disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
                    data-testid="draft-error-retry"
                  >
                    <RefreshCw size={12} className={isRetrying ? 'animate-spin' : ''} />
                    {isRetrying ? 'Retrying…' : 'Retry Draft'}
                  </button>
                ) : null}
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
                >
                  <Copy size={12} />
                  Copy diagnostics
                </button>
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
          </div>
        )}

        {/* Three-bucket content + health row. In failed state, de-emphasise everything
            (health, banners, sections) so only the banner and error detail above stay
            at full opacity. */}
        <div className={`space-y-4 ${isFailed ? 'opacity-60 pointer-events-none' : ''}`}>

          {/* Compressed health row: ring + 4 dimension bars only (no title/headline/coaching).
              Sits inside the de-emphasised wrapper so it dims with the rest of the content
              when the banner is in failed state. */}
          <SectionErrorBoundary section="Model health">
            <div className="px-2">
              <ModelHealthCard
                compact
                completeness={completeness}
                evidence={evidence}
                balance={balance}
                calibration={calibration}
                optionCount={data.optionPreviews.length}
                goalLabel={data.goalNode ? ((data.goalNode.data as { label?: string })?.label ?? null) : null}
                coachingSummary={data.coachingSummary}
                isLoading={data.isLoading}
                hasGoalNode={data.nodesByKind.goal.length > 0}
              />
            </div>
          </SectionErrorBoundary>

          {/* Section 1: Must fix — only when blockers exist.
              Order per brief:
                1. Options need configuration (enriched blockers — surfaced first)
                2. Structural flags ("Fewer than 2 options", "No baseline set")
                3. Critical severity items from triage cards
              No internal subheader from BlockersSection — Must fix owns the header. */}
          {mustFixCount > 0 && (
            <section className="space-y-2" data-testid="section-must-fix">
              <SectionHeader title="Must fix" count={mustFixCount} tone="danger" testId="section-must-fix-header" />

              {/* 1. Enriched blockers (e.g. Options need configuration) */}
              {!data.isReady && data.enrichedBlockers.length > 0 && (
                <SectionErrorBoundary section="Blockers">
                  <BlockersSection
                    blockers={data.enrichedBlockers}
                    informationalBlockers={[]}
                    canRetryDraft={canRetryDraft}
                    isRetrying={isRetrying}
                    lastDraftRetryable={lastDraftError?.retryable}
                    onRetryDraft={handleRetryDraft}
                    onEditBrief={handleEditBrief}
                    hideHeader
                  />
                </SectionErrorBoundary>
              )}

              {/* 2. Structural check rows */}
              {structuralCheckCount > 0 && (
                <div className="space-y-1 px-3">
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
                <div className="flex flex-col gap-1.5 px-1" data-testid="must-fix-cards">
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
              <SectionHeader title="Review next" count={reviewNextCount} tone="info" testId="section-review-next-header" />

              {/* Option similarity / quality card — interventions collapsed per option (v2 brief) */}
              {showOptionQualityCard && data.optionPreviews.length > 0 && (
                <div className="px-2">
                  <OptionPreview
                    options={data.optionPreviews}
                    onFocusNode={handleFocusNode}
                    onHoverEnter={handleHoverElement}
                    onHoverLeave={handleHoverClear}
                    onSendMessage={onSendMessage}
                    hasSameLeversCheck={data.qualityChecks.some(c => c.id === 'same_levers')}
                    collapseInterventionsByDefault
                  />
                </div>
              )}

              {/* Bias trigger cards */}
              {biasTriggers.length > 0 && (
                <div className="space-y-1.5 px-3" data-testid="review-next-nudges">
                  {biasTriggers.map(trigger => {
                    const Icon = trigger.icon
                    return (
                      <div
                        key={trigger.id}
                        className="px-3 py-2.5 border border-warning/30 rounded-lg hover:bg-panel-hover space-y-1"
                      >
                        <div className="flex items-start gap-2">
                          <Icon className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" aria-hidden="true" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className={`${typography.panelHeader} text-text-header`}>{trigger.title}</p>
                              <button
                                type="button"
                                onClick={() => {
                                  if (trigger.id === 'overconfidence') handleFocusNode(trigger.ctaAction)
                                  else onSendMessage?.(trigger.ctaAction)
                                }}
                                className={`${typography.panelMeta} text-info border border-info/30 rounded-full px-2 py-0.5 bg-transparent hover:bg-panel-hover cursor-pointer flex-shrink-0`}
                              >
                                {trigger.cta}
                              </button>
                            </div>
                            <p className={`${typography.panelBody} text-text-light mt-0.5`}>{trigger.subtitle}</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Top 3 triage cards (excluding any in Must fix) */}
              {reviewNextTopCards.length > 0 && (
                <div className="flex flex-col gap-1.5 px-1" data-testid="triage-top-actions">
                  {reviewNextTopCards.map((card, i) => (
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

          {/* Section 3: Improve confidence — collapsed by default */}
          <ImproveConfidenceAccordion
            count={improveConfidenceCount}
            highestValueLabel={highestValueLabel}
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
              <div className="flex flex-col gap-1.5 px-1" data-testid="improve-confidence-cards">
                {improveConfidenceCards.map((card, i) => (
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

            {/* Your expertise — unified section (v6 wireframe) */}
            <SectionErrorBoundary section="Your expertise">
              <YourExpertise
                improvementsByCategory={data.improvementsByCategory}
                contestedEdges={data.contestedEdges}
                nodes={nodes}
                edges={edges}
                factorInfluenceMap={compositeInfluenceMap}
                edgeInfluenceMap={edgeInfluenceMap}
                reviewedCount={data.reviewedFactorsCount}
                allItems={[
                  ...(data.improvementsByCategory.verify ?? []),
                  ...(data.improvementsByCategory.add_evidence ?? []),
                ]}
                onFocusNode={handleFocusNode}
                onFocusEdge={handleFocusEdgeById}
                onConfirm={handleConfirm}
                onEdit={handleEdit}
                onSetValue={handleSetValueForGap}
                onSendMessage={onSendMessage}
                onResolveEdge={handleResolveContestedEdge}
                onUpdateEdgeStrength={handleUpdateEdgeStrength}
                onAddEvidence={handleAddEvidence}
                onHoverEnter={handleHoverElement}
                onHoverLeave={handleHoverClear}
              />
            </SectionErrorBoundary>

            {/* "What's missing?" prompt */}
            <MissingKnowledgePrompt onSendMessage={onSendMessage} />
          </ImproveConfidenceAccordion>

          {/* Minimal graph coaching — pre-run guidance, not blocker */}
          {isMinimalGraph && (
            <div
              className="flex items-start gap-2 px-3 py-2.5 mx-2 bg-panel border border-info/30 rounded-md"
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
