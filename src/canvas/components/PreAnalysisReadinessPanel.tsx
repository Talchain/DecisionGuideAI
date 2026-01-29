/**
 * PreAnalysisReadinessPanel - Pre-Analysis Readiness Display
 *
 * Replaces current validation error display with actionable readiness panel
 * using CEE data. Helps users understand what's blocking analysis and how to fix it.
 *
 * Data sources:
 * - quality: From useGraphReadiness (overall score, improvements)
 * - analysis_ready: From ceeAnalysisReady store (options, status, goal_node_id)
 * - validation_warnings: From usePreRunValidation (blockers, warnings)
 * - nodes: For label lookups
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react'
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  Loader2,
  X,
  ExternalLink,
} from 'lucide-react'
import { useCanvasStore } from '../store'
import { useShallow } from 'zustand/shallow'
import { usePreRunValidation, type ValidationBlocker } from '../hooks/usePreRunValidation'
import { useGraphReadiness } from '../hooks/useGraphReadiness'
import { focusNodeById, focusEdgeById } from '../utils/focusHelpers'
import { typography } from '../../styles/typography'
import type { CEEOptionV3 } from '../../adapters/cee/types'
import type { Node } from '@xyflow/react'

// ============================================================================
// Types
// ============================================================================

interface BlockingIssue {
  /** Unique key for deduplication */
  key: string
  /** Human-readable title */
  title: string
  /** Human-readable description with specific values */
  description: string
  /** Affected options by label */
  affectedOptions: string[]
  /** Node ID to focus on canvas */
  focusNodeId?: string
  /** Raw code for debugging */
  code: string
}

interface PreAnalysisReadinessPanelProps {
  /** Callback when user clicks the primary action button */
  onAnalyse: () => void
  /** Whether analysis is currently running */
  isAnalysing?: boolean
  /** Callback when blocker count changes (for parent run gating) */
  onBlockersChange?: (hasBlockers: boolean) => void
  /** Callback when readiness changes (for parent run gating) */
  onCanRunChange?: (canRun: boolean) => void
}

// ============================================================================
// Constants
// ============================================================================

const MAX_VISIBLE_ISSUES = 3

/** Map issue codes to human-readable titles */
const ISSUE_TITLES: Record<string, string> = {
  INTERVENTION_TARGET_NOT_FOUND: 'Options reference missing factor',
  OPTIONS_NEED_MAPPING: 'Options need numeric values',
  EMPTY_INTERVENTIONS: 'Options have no interventions',
  MISSING_GOAL_NODE: 'No goal selected',
  GOAL_NODE_NOT_FOUND: 'Goal node was deleted',
  GOAL_NODE_KIND_MISMATCH: 'Selected node is not a goal',
  ANALYSIS_NOT_READY: 'Graph needs attention',
  needs_encoding: 'Options need numeric values',
  needs_user_mapping: 'Options need configuration',
}

/** Quality level thresholds (score is 1-10 from brief, but we receive 0-100) */
function getQualityLevel(score: number): { label: string; color: string } {
  // Convert 0-100 to 1-10 scale
  const score10 = Math.round(score / 10)
  if (score10 >= 9) return { label: 'Strong', color: 'text-mint-700' }
  if (score10 >= 7) return { label: 'Good', color: 'text-sky-700' }
  if (score10 >= 5) return { label: 'Fair', color: 'text-banana-700' }
  return { label: 'Needs Work', color: 'text-carrot-700' }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert ID to human-readable label.
 * Looks up node by ID, falls back to title-cased ID with "Missing:" prefix.
 */
function getHumanLabel(id: string, nodes: Node[]): string {
  const node = nodes.find((n) => n.id === id)
  if (node) {
    return (node.data as { label?: string })?.label || id
  }
  // Node doesn't exist - show as missing
  const titleCased = id
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
  return `Missing: ${titleCased}`
}

/**
 * Get option label by ID from ceeAnalysisReady options or nodes
 */
function getOptionLabel(
  optionId: string,
  ceeOptions: CEEOptionV3[] | undefined,
  nodes: Node[]
): string {
  // Check CEE options first
  const ceeOption = ceeOptions?.find((o) => o.id === optionId)
  if (ceeOption?.label) return ceeOption.label

  // Fallback to node lookup
  return getHumanLabel(optionId, nodes)
}

/**
 * Aggregate blocking issues from validation blockers and CEE analysis_ready options
 */
function aggregateBlockingIssues(
  validationBlockers: ValidationBlocker[],
  ceeOptions: CEEOptionV3[] | undefined,
  nodes: Node[]
): BlockingIssue[] {
  const issues: BlockingIssue[] = []
  const seenKeys = new Set<string>()

  // 1. Process validation blockers
  for (const blocker of validationBlockers) {
    // Create composite key: {code}:{affected_node_id}
    const affectedIds = blocker.affectedIds || []
    const nodeId = blocker.action?.nodeId || affectedIds[0]
    const key = `${blocker.code}:${nodeId || 'global'}`

    if (seenKeys.has(key)) continue
    seenKeys.add(key)

    // Build human-readable description
    let description = blocker.message
    let title = ISSUE_TITLES[blocker.code] || blocker.code

    // Enhance description for specific codes
    if (blocker.code === 'INTERVENTION_TARGET_NOT_FOUND' && nodeId) {
      const humanLabel = getHumanLabel(nodeId, nodes)
      description = `Your options target "${humanLabel}" but this factor doesn't exist in your model.`
    } else if (blocker.code === 'OPTIONS_NEED_MAPPING') {
      description = `${affectedIds.length} option(s) need intervention values configured.`
    } else if (blocker.code === 'EMPTY_INTERVENTIONS') {
      description = `${affectedIds.length} option(s) have no intervention values set.`
    }

    // Get affected options by label
    const affectedOptions = affectedIds.map((id) =>
      getOptionLabel(id, ceeOptions, nodes)
    )

    issues.push({
      key,
      title,
      description,
      affectedOptions,
      focusNodeId: nodeId,
      code: blocker.code,
    })
  }

  // 2. Process CEE analysis_ready options with status !== 'ready'
  if (ceeOptions) {
    for (const option of ceeOptions) {
      if (option.status === 'ready') continue

      const key = `${option.status}:${option.id}`
      if (seenKeys.has(key)) continue
      seenKeys.add(key)

      const title = ISSUE_TITLES[option.status] || 'Option needs attention'

      // Build description based on status
      let description = ''
      if (option.status === 'needs_encoding' && option.unresolved_targets?.length) {
        const rawValues = option.unresolved_targets.join(', ')
        description = `These text values need converting: ${rawValues}`
      } else if (option.status === 'needs_user_mapping') {
        description = option.user_questions?.[0] || 'This option needs configuration.'
      } else {
        description = 'This option is not ready for analysis.'
      }

      issues.push({
        key,
        title,
        description,
        affectedOptions: [option.label],
        focusNodeId: option.id,
        code: option.status,
      })
    }
  }

  return issues
}

/**
 * Extract percentage from explanation string (for coaching)
 */
function extractPercentage(text: string): string | null {
  const match = text.match(/(\d+)%/)
  return match ? match[1] : null
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Task 1: Stateful Analyze Button
 */
function AnalyzeButton({
  totalBlockers,
  isReady,
  isAnalysing,
  onClick,
}: {
  totalBlockers: number
  isReady: boolean
  isAnalysing: boolean
  onClick: () => void
}) {
  const isDisabled = !isReady || isAnalysing

  // Determine button state
  let label: string
  let style: string

  if (isAnalysing) {
    label = 'Analysing...'
    style = 'bg-sky-500 text-white cursor-wait'
  } else if (totalBlockers > 0) {
    label = `Fix ${totalBlockers} Issue${totalBlockers !== 1 ? 's' : ''} First`
    style = 'bg-sand-200 text-sand-600 cursor-not-allowed'
  } else {
    label = 'Analyse Now'
    style = 'bg-sky-500 hover:bg-sky-600 text-white'
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      className={`${typography.body} font-medium px-4 py-2.5 rounded-lg transition-colors flex items-center gap-2 ${style}`}
      aria-label={isDisabled ? (isAnalysing ? 'Analysis in progress' : 'Fix issues before analysing') : 'Run analysis'}
    >
      {isAnalysing && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {label}
    </button>
  )
}

/**
 * Task 2: Blocking Issue Card
 */
function BlockingIssueCard({
  issue,
  onFocus,
}: {
  issue: BlockingIssue
  onFocus: () => void
}) {
  return (
    <div className="p-3 bg-carrot-50 border border-carrot-200 rounded-lg">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-4 w-4 text-carrot-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className={`${typography.body} font-medium text-carrot-800`}>
            {issue.title}
          </p>
          <p className={`${typography.caption} text-carrot-700 mt-1`}>
            {issue.description}
          </p>
          {issue.affectedOptions.length > 0 && (
            <p className={`${typography.caption} text-carrot-600 mt-1`}>
              Affects: {issue.affectedOptions.join(', ')}
            </p>
          )}
        </div>
        {issue.focusNodeId && (
          <button
            type="button"
            onClick={onFocus}
            className={`${typography.caption} flex items-center gap-1 px-2 py-1 rounded text-sky-600 hover:bg-sky-50 transition-colors flex-shrink-0`}
            aria-label="Focus on canvas"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Focus on canvas
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Task 3: Quality Score Bar
 */
function QualityBar({
  label,
  score,
  maxScore = 10,
}: {
  label: string
  score: number
  maxScore?: number
}) {
  const percent = Math.round((score / maxScore) * 100)
  const barColor =
    score >= 7 ? 'bg-mint-500' : score >= 5 ? 'bg-banana-500' : 'bg-carrot-500'

  return (
    <div className="flex items-center gap-3">
      <span className={`${typography.caption} text-ink-600 w-20`}>{label}</span>
      <div className="flex-1 h-2 bg-sand-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} transition-all`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className={`${typography.caption} text-ink-500 w-10 text-right`}>
        {score}/10
      </span>
    </div>
  )
}

/**
 * Task 4: Ready State Option Chip
 * When all options are configured, omit individual checkmarks (Task 6)
 */
function OptionChip({ label, showCheckmark = true }: { label: string; showCheckmark?: boolean }) {
  const displayLabel = label.length > 15 ? `${label.slice(0, 14)}...` : label

  return (
    <span
      className={`${typography.caption} inline-flex items-center gap-1 px-2 py-1 bg-mint-100 text-mint-700 rounded`}
      title={label}
    >
      {showCheckmark && <CheckCircle className="h-3 w-3" />}
      {displayLabel}
    </span>
  )
}

/**
 * Task 5: Coaching Card
 */
function CoachingCard({
  id,
  title,
  description,
  percentage,
  onFocus,
  onDismiss,
}: {
  id: string
  title: string
  description: string
  percentage: string | null
  onFocus?: () => void
  onDismiss: () => void
}) {
  return (
    <div className="p-3 bg-sky-50 border border-sky-200 rounded-lg">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className={`${typography.body} font-medium text-sky-800`}>
            {title}
          </p>
          <p className={`${typography.caption} text-sky-700 mt-1`}>
            {percentage ? description.replace(/\d+%/, `${percentage}%`) : description}
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {onFocus && (
            <button
              type="button"
              onClick={onFocus}
              className={`${typography.caption} px-2 py-1 rounded text-sky-600 hover:bg-sky-100 transition-colors`}
            >
              Show
            </button>
          )}
          <button
            type="button"
            onClick={onDismiss}
            className="p-1 text-sky-400 hover:text-sky-600 transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function PreAnalysisReadinessPanel({
  onAnalyse,
  isAnalysing = false,
  onBlockersChange,
  onCanRunChange,
}: PreAnalysisReadinessPanelProps) {
  // Session-only dismissed coaching IDs
  const [dismissedCoachingIds, setDismissedCoachingIds] = useState<Set<string>>(new Set())
  // Quality breakdown collapsed state
  const [isBreakdownOpen, setIsBreakdownOpen] = useState(false)
  // Coaching accordion state - null means "use auto behavior", boolean means "user explicitly set"
  const [coachingUserOverride, setCoachingUserOverride] = useState<boolean | null>(null)
  // Track previous blocker count to detect transitions
  const [prevBlockerCount, setPrevBlockerCount] = useState<number | null>(null)

  // Store data
  const nodes = useCanvasStore(useShallow((s) => s.nodes))
  const ceeAnalysisReady = useCanvasStore((s) => s.ceeAnalysisReady)
  const setHighlightedNodes = useCanvasStore((s) => s.setHighlightedNodes)

  // Validation and readiness hooks
  const preRunValidation = usePreRunValidation()
  const { readiness, loading: readinessLoading } = useGraphReadiness()

  // Aggregate blocking issues
  const blockingIssues = useMemo(() => {
    return aggregateBlockingIssues(
      preRunValidation.blockers,
      ceeAnalysisReady?.options,
      nodes
    )
  }, [preRunValidation.blockers, ceeAnalysisReady?.options, nodes])

  // Total count for button (not capped)
  const totalBlockers = blockingIssues.length

  // Visible issues (max 3)
  const visibleIssues = blockingIssues.slice(0, MAX_VISIBLE_ISSUES)
  const hiddenIssueCount = Math.max(0, totalBlockers - MAX_VISIBLE_ISSUES)

  // Check if analysis is ready (Issue 1 & 2 fix: include totalBlockers and readiness.can_run_analysis)
  const graphCanRun = readinessLoading ? true : (readiness?.can_run_analysis ?? true)
  const isReady =
    preRunValidation.canRun &&
    totalBlockers === 0 &&
    graphCanRun &&
    (ceeAnalysisReady?.status === 'ready' || ceeAnalysisReady?.status === undefined)

  // Notify parent of blocker state changes
  useEffect(() => {
    onBlockersChange?.(totalBlockers > 0)
  }, [totalBlockers, onBlockersChange])

  // Notify parent of readiness changes
  useEffect(() => {
    onCanRunChange?.(graphCanRun)
  }, [graphCanRun, onCanRunChange])

  // Quality data
  const qualityScore = readiness?.readiness_score ?? 0
  const qualityLevel = getQualityLevel(qualityScore)

  // Summary line data
  const nodeCount = nodes.length
  const edgeCount = useCanvasStore((s) => s.edges.length)
  const optionCount = ceeAnalysisReady?.options?.length ?? nodes.filter((n) => n.type === 'option' || n.type === 'decision').length

  // Ready options for chips
  const readyOptions = useMemo(() => {
    if (!ceeAnalysisReady?.options) {
      // Fallback to canvas option nodes
      return nodes
        .filter((n) => n.type === 'option' || n.type === 'decision')
        .map((n) => ({ label: (n.data as { label?: string })?.label || n.id }))
    }
    return ceeAnalysisReady.options
      .filter((o) => o.status === 'ready')
      .map((o) => ({ label: o.label }))
  }, [ceeAnalysisReady?.options, nodes])

  // Coaching suggestions (from readiness improvements)
  const coachingSuggestions = useMemo(() => {
    if (!readiness?.improvements) return []
    return readiness.improvements
      .filter((imp) => !dismissedCoachingIds.has(imp.action))
      .map((imp) => ({
        id: imp.action,
        title: imp.category === 'completeness' ? 'Refine influence weights' : imp.action,
        description: imp.current_gap || `Improving this could add ${imp.quality_impact} points to quality.`,
        percentage: extractPercentage(imp.current_gap || ''),
        affectedNodes: imp.affected_nodes,
      }))
  }, [readiness?.improvements, dismissedCoachingIds])

  // Auto-expand coaching when blockers transition to 0, but allow user toggle (Issue 3 fix)
  useEffect(() => {
    // When blockers go from > 0 to 0, auto-expand (if user hasn't explicitly set a preference)
    if (prevBlockerCount !== null && prevBlockerCount > 0 && totalBlockers === 0) {
      if (coachingUserOverride === null) {
        setCoachingUserOverride(true)
      }
    }
    setPrevBlockerCount(totalBlockers)
  }, [totalBlockers, prevBlockerCount, coachingUserOverride])

  // Effective coaching open state: use user override if set, otherwise default to open when no blockers
  const effectiveCoachingOpen = coachingUserOverride !== null
    ? coachingUserOverride
    : totalBlockers === 0

  // Focus handlers
  const handleFocusNode = useCallback(
    (nodeId: string) => {
      setHighlightedNodes([nodeId])
      focusNodeById(nodeId)
      setTimeout(() => setHighlightedNodes([]), 3000)
    },
    [setHighlightedNodes]
  )

  const handleDismissCoaching = useCallback((id: string) => {
    setDismissedCoachingIds((prev) => new Set([...prev, id]))
  }, [])

  // Don't show panel if canvas is empty
  if (nodes.length === 0) {
    return null
  }

  // Determine which view to show
  const hasBlockingIssues = totalBlockers > 0 || (ceeAnalysisReady?.status && ceeAnalysisReady.status !== 'ready')

  return (
    <div className="space-y-4" data-testid="pre-analysis-readiness-panel">
      {/* Task 3: Quality Header - renamed to Model Readiness */}
      <div className="p-4 bg-paper-50 border border-sand-200 rounded-xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={`${typography.caption} text-ink-500`}>Model Readiness:</span>
            <span className={`${typography.body} font-semibold ${qualityLevel.color}`}>
              {qualityLevel.label}
            </span>
            <span className={`${typography.caption} text-ink-500`}>
              ({qualityScore}%)
            </span>
            <button
              type="button"
              className="text-ink-400 hover:text-ink-600 transition-colors"
              title="Estimates whether your model is ready to analyse, not which option will win."
              aria-label="Help: Estimates whether your model is ready to analyse, not which option will win."
            >
              <HelpCircle className="h-3.5 w-3.5" />
            </button>
            {readinessLoading && (
              <Loader2 className="h-3.5 w-3.5 text-sand-400 animate-spin" aria-hidden="true" />
            )}
          </div>
          {/* Task 1: Analyze Button */}
          <AnalyzeButton
            totalBlockers={totalBlockers}
            isReady={isReady}
            isAnalysing={isAnalysing}
            onClick={onAnalyse}
          />
        </div>

        {/* Collapsible quality breakdown */}
        <button
          type="button"
          onClick={() => setIsBreakdownOpen(!isBreakdownOpen)}
          className="flex items-center gap-1 text-sky-600 hover:text-sky-700 transition-colors"
          aria-expanded={isBreakdownOpen}
          aria-controls="quality-breakdown-content"
        >
          {isBreakdownOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <span className={typography.caption}>Estimated breakdown</span>
        </button>

        {isBreakdownOpen && (
          <div id="quality-breakdown-content" className="mt-3 space-y-2">
            {/* Node/edge/option count - demoted to breakdown */}
            <p className={`${typography.caption} text-ink-500 mb-2`}>
              {nodeCount} nodes · {edgeCount} edges · {optionCount} options
            </p>
            {/* Context line */}
            <p className={`${typography.caption} text-ink-400 italic mb-2`}>Based on graph structure before simulation</p>
            <QualityBar label="Structure" score={Math.round(qualityScore / 10)} />
            <QualityBar label="Coverage" score={Math.round((qualityScore * 0.9) / 10)} />
            <QualityBar label="Causality" score={Math.round((qualityScore * 0.85) / 10)} />
            <QualityBar label="Safety" score={Math.round((qualityScore * 0.95) / 10)} />
          </div>
        )}
      </div>

      {/* Task 2: Blocking Issues Section */}
      {hasBlockingIssues && (
        <div className="space-y-2">
          <h3 className={`${typography.label} text-carrot-700`}>
            Issues to fix ({totalBlockers})
          </h3>
          {visibleIssues.map((issue) => (
            <BlockingIssueCard
              key={issue.key}
              issue={issue}
              onFocus={() => issue.focusNodeId && handleFocusNode(issue.focusNodeId)}
            />
          ))}
          {hiddenIssueCount > 0 && (
            <p className={`${typography.caption} text-ink-500`}>
              {hiddenIssueCount} more issue{hiddenIssueCount !== 1 ? 's' : ''} not shown
            </p>
          )}
        </div>
      )}

      {/* Task 4: Ready State Display */}
      {/* Task 6: When all options ready, remove individual checkmarks from chips */}
      {!hasBlockingIssues && (
        <div className="p-4 bg-mint-50 border border-mint-200 rounded-xl">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="h-5 w-5 text-mint-600" aria-hidden="true" />
            <span className={`${typography.body} font-medium text-mint-800`}>
              Ready to analyse
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {readyOptions.map((option) => (
              <OptionChip key={option.label} label={option.label} showCheckmark={false} />
            ))}
          </div>
          <p className={`${typography.caption} text-mint-700 mt-2`}>
            All {readyOptions.length} options configured
          </p>
        </div>
      )}

      {/* Task 5: Coaching Section */}
      {coachingSuggestions.length > 0 && (
        <div className="border border-sand-200 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setCoachingUserOverride(!effectiveCoachingOpen)}
            className="w-full flex items-center justify-between px-4 py-3 bg-sand-50 hover:bg-sand-100 transition-colors"
            aria-expanded={effectiveCoachingOpen}
            aria-controls="coaching-suggestions-content"
          >
            <span className={`${typography.body} font-medium text-ink-700`}>
              Coaching Suggestions ({coachingSuggestions.length})
            </span>
            {effectiveCoachingOpen ? (
              <ChevronDown className="h-4 w-4 text-ink-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-ink-400" />
            )}
          </button>
          {effectiveCoachingOpen && (
            <div id="coaching-suggestions-content" className="p-3 space-y-2">
              {coachingSuggestions.map((suggestion) => (
                <CoachingCard
                  key={suggestion.id}
                  id={suggestion.id}
                  title={suggestion.title}
                  description={suggestion.description}
                  percentage={suggestion.percentage}
                  onFocus={
                    suggestion.affectedNodes?.[0]
                      ? () => handleFocusNode(suggestion.affectedNodes![0])
                      : undefined
                  }
                  onDismiss={() => handleDismissCoaching(suggestion.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default PreAnalysisReadinessPanel
