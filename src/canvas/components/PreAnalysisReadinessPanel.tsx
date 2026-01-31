/**
 * PreAnalysisReadinessPanel - Pre-Analysis Readiness Display v2.1
 *
 * Replaces current validation error display with actionable readiness panel
 * using CEE data. Helps users understand what's blocking analysis and how to fix it.
 *
 * v2.1 Changes:
 * - Issue normalisation layer (NormalisedIssue)
 * - Limiting factor: active issues → lowest score
 * - Fix First: max 3 issues, category → severity sort
 * - Focus precedence: edge-based warnings → edge focus
 * - Controlled CTA labels (never use fix_hint as button text)
 * - Relationship Sources in Details only with natural language
 * - Structure rows: count + View →
 *
 * Data sources:
 * - usePreAnalysisData: Normalised issues from all sources
 * - quality: From useGraphReadiness (overall score, improvements)
 * - analysis_ready: From ceeAnalysisReady store (options, status, goal_node_id)
 * - nodes: For label lookups
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  Loader2,
  X,
  ExternalLink,
  Plus,
  ArrowRight,
  Eye,
} from 'lucide-react'
import { useCanvasStore } from '../store'
import { useShallow } from 'zustand/shallow'
import { usePreRunValidation } from '../hooks/usePreRunValidation'
import { useGraphReadiness } from '../hooks/useGraphReadiness'
import { usePreAnalysisData, type NormalisedIssue, CTA_LABELS } from '../hooks/usePreAnalysisData'
import { focusNodeById, focusEdgeById } from '../utils/focusHelpers'
import { getSeverityDisplay, getSeverityContainerClass, type DraftWarningSeverity } from '../utils/severityMapping'
import { typography } from '../../styles/typography'
import type {
  CEEOptionV3,
  CEEDraftWarning,
  CEEGoalConnectivity,
  CEEModelQualityFactors,
  CEEInterventionHint,
} from '../../adapters/cee/types'
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

/** Phase 1b: Warning dimension mapping */
export type WarningDimension = 'Estimates' | 'Validation' | 'Framing'

const WARNING_DIMENSION_MAP: Record<string, WarningDimension> = {
  // Framing
  SAME_LEVER_OPTIONS: 'Framing',
  MISSING_BASELINE: 'Framing',
  GOAL_NO_BASELINE_VALUE: 'Framing',

  // Validation
  GOAL_CONNECTIVITY_NONE: 'Validation',
  STRENGTH_CLUSTERING: 'Validation',
  EDGE_ORIGIN_DEFAULTED: 'Validation',

  // Estimates
  RANGE_DEGENERATE: 'Estimates',
  NORMALISATION_INPUT_INSUFFICIENT: 'Estimates',
}

/**
 * Phase 1b: Get warning dimension from code
 * Logs warning for unmapped codes and defaults to Validation
 */
function getWarningDimension(code: string | undefined): WarningDimension {
  if (!code) return 'Validation'

  const dimension = WARNING_DIMENSION_MAP[code]
  if (!dimension) {
    // Dev-only warning for unmapped codes
    if (import.meta.env.DEV) {
      console.warn(`Unmapped warning code: ${code}`)
    }
    return 'Validation'  // Default fallback
  }
  return dimension
}

/**
 * Phase 1b: Get edge label with fallback chain
 * label → source→target → "Unnamed relationship"
 */
function getEdgeLabel(edge: { label?: string; source: string; target: string }, nodes: Node[]): string {
  if (edge.label) return String(edge.label)

  const source = nodes.find(n => n.id === edge.source)
  const target = nodes.find(n => n.id === edge.target)

  if (source?.data?.label && target?.data?.label) {
    return `${source.data.label} → ${target.data.label}`
  }

  return 'Unnamed relationship'
}

/** Phase 1b: Severity sort order (blocker first) */
const SEVERITY_ORDER: Record<string, number> = {
  blocker: 0,
  high: 1,
  medium: 2,
  low: 3,
}

/** Quality level thresholds based on percentage (0-100) */
function getQualityLevel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'Strong', color: 'text-mint-700' }
  if (score >= 60) return { label: 'OK', color: 'text-banana-700' }
  return { label: 'Weak', color: 'text-carrot-700' }
}

/**
 * Calculate model quality as min(Structure, Coverage, Validation) × 10
 * Returns percentage (0-100)
 */
function calculateModelQuality(ceeQuality: { structure: number; coverage: number; safety: number } | null): number {
  if (!ceeQuality) return 0
  // Validation (safety) max is 8, normalize to 10 scale first
  const validationNormalized = (ceeQuality.safety / 8) * 10
  return Math.round(Math.min(ceeQuality.structure, ceeQuality.coverage, validationNormalized) * 10)
}

// ============================================================================
// Helper Functions
// ============================================================================

// Note: getLimitingFactor was removed in v2.1.
// Limiting factor logic now lives in usePreAnalysisData hook,
// using issue-first priority (active issues → lowest score).

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
 * Task 2: Blocking Issue Card (legacy - kept for backwards compatibility)
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
 * v2.1 Fix First Card - Uses NormalisedIssue structure
 * - Title: 1-line problem
 * - Why: fix_hint as explanatory text, NOT button
 * - Focus: Shows target label in body, "Focus →" button
 * - Actions: Controlled CTA labels only
 */
function FixFirstCard({
  issue,
  onFocusNode,
  onFocusEdge,
  onAction,
}: {
  issue: NormalisedIssue
  onFocusNode: (nodeId: string) => void
  onFocusEdge: (edgeId: string) => void
  onAction: (action: { key: string; kind: string }) => void
}) {
  // v2.1: Use central severity display mapping
  const display = getSeverityDisplay(issue.severity as DraftWarningSeverity)

  const handleFocus = useCallback(() => {
    if (!issue.focus) return
    if (issue.focus.type === 'edge') {
      onFocusEdge(issue.focus.id)
    } else {
      onFocusNode(issue.focus.id)
    }
  }, [issue.focus, onFocusNode, onFocusEdge])

  return (
    <div className={`p-3 rounded-lg border ${display.bg} ${display.border}`}>
      <div className="flex items-start gap-3">
        <AlertTriangle className={`h-4 w-4 flex-shrink-0 mt-0.5 ${display.icon}`} aria-hidden="true" />
        <div className="flex-1 min-w-0">
          {/* Title: 1-line problem */}
          <p className={`${typography.body} font-medium ${display.text}`}>
            {issue.title}
          </p>
          {/* Why: fix_hint as explanatory text */}
          <p className={`${typography.caption} text-ink-600 mt-1`}>
            {issue.why}
          </p>
          {/* Focus target label (if present) */}
          {issue.focus && (
            <p className={`${typography.caption} text-ink-500 mt-1`}>
              {issue.focus.type === 'edge' ? 'Relationship' : 'Node'}: {issue.focus.label}
            </p>
          )}
        </div>
        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Focus button shown separately with just "Focus →" */}
          {issue.focus && (
            <button
              type="button"
              onClick={handleFocus}
              className={`${typography.caption} flex items-center gap-1 px-2 py-1 rounded text-sky-600 hover:bg-sky-50 transition-colors`}
            >
              {CTA_LABELS.focus}
            </button>
          )}
          {/* Other actions (non-focus) */}
          {issue.actions
            .filter(a => a.kind !== 'focus')
            .map(action => (
              <button
                key={action.key}
                type="button"
                onClick={() => onAction(action)}
                className={`${typography.caption} flex items-center gap-1 px-2 py-1 rounded text-sky-600 hover:bg-sky-50 transition-colors`}
              >
                {action.label}
              </button>
            ))}
        </div>
      </div>
    </div>
  )
}

/** Dimension tooltips explaining each metric (based on CEE scoring logic) */
const DIMENSION_TOOLTIPS: Record<string, string> = {
  Structure: 'Graph connectivity — more factors and connections improve this score',
  Coverage: 'Model comprehensiveness — 2-6 options with risks and outcomes scores highest',
  Validation: 'Validation health — fewer issues means higher score',
}

/** Coaching hints for dimensions scoring below threshold */
const DIMENSION_COACHING: Record<string, string> = {
  Structure: 'Add more factors and connect isolated nodes',
  Coverage: 'Add alternative options (2-6 optimal), include risk and outcome nodes',
  Validation: 'Review validation issues in the canvas',
}

/** Coaching thresholds per dimension (Validation max is 8, others max is 10) */
const DIMENSION_THRESHOLDS: Record<string, number> = {
  Structure: 9,
  Coverage: 9,
  Validation: 8, // Validation max is 8, so 8 = optimal
}

/**
 * Compact dimension display with severity icons
 * - ✓ (mint-500): score ≥ 8
 * - ⚠ (sun-500): score 5-7
 * - ✗ (carrot-500): score < 5
 */
function DimensionRow({
  label,
  score,
  warningCount = 0,
  onViewWarnings,
}: {
  label: string
  score: number
  warningCount?: number
  onViewWarnings?: () => void
}) {
  const max = label === 'Validation' ? 8 : 10
  const tooltip = DIMENSION_TOOLTIPS[label] || label

  // Icon thresholds: ✓ ≥8, ⚠ 5-7, ✗ <5
  let Icon = CheckCircle
  let iconColor = 'text-mint-500'
  if (score < 5) {
    Icon = X
    iconColor = 'text-carrot-500'
  } else if (score < 8) {
    Icon = AlertTriangle
    iconColor = 'text-banana-500'
  }

  return (
    <div className="flex items-center gap-3 py-1">
      <Icon className={`h-4 w-4 ${iconColor} flex-shrink-0`} aria-hidden="true" />
      <span
        className={`${typography.caption} text-ink-700 flex-1 cursor-help`}
        title={tooltip}
      >
        {label}
      </span>
      <span className={`${typography.caption} text-ink-500`}>
        {score}/{max}
      </span>
      {warningCount > 0 && onViewWarnings && (
        <>
          <span className={`${typography.caption} text-ink-400`}>
            — {warningCount} warning{warningCount !== 1 ? 's' : ''}
          </span>
          <button
            type="button"
            onClick={onViewWarnings}
            className={`${typography.caption} text-sky-600 hover:text-sky-700 flex items-center gap-1`}
          >
            View
            <ArrowRight className="h-3 w-3" />
          </button>
        </>
      )}
    </div>
  )
}

/**
 * Phase 1b Task 3: Extended Warning Card
 * Displays a warning from CEE with message, fix hint, and Focus CTA
 */
function ExtendedWarningCard({
  warning,
  nodes,
  onFocusNode,
  onFocusEdge,
}: {
  warning: CEEDraftWarning
  nodes: Node[]
  onFocusNode: (nodeId: string) => void
  onFocusEdge: (edgeId: string) => void
}) {
  // v2.1: Use central severity display mapping
  const display = getSeverityDisplay((warning.severity ?? 'low') as DraftWarningSeverity)

  // Get affected labels
  const affectedNodeLabels = warning.affected_node_ids
    .map(id => nodes.find(n => n.id === id)?.data?.label ?? id)
    .slice(0, 3)

  // Determine focus target (prefer nodes, fallback to edges)
  const hasFocusableNode = warning.affected_node_ids.length > 0
  const hasFocusableEdge = warning.affected_edge_ids.length > 0

  return (
    <div className={`p-3 rounded-lg border ${display.bg} ${display.border}`}>
      <div className="flex items-start gap-3">
        <AlertTriangle className={`h-4 w-4 flex-shrink-0 mt-0.5 ${display.caption}`} />
        <div className="flex-1 min-w-0">
          <p className={`${typography.body} ${display.caption}`}>
            {warning.message}
          </p>
          {warning.fix_hint && (
            <p className={`${typography.caption} text-ink-600 mt-1`}>
              {warning.fix_hint}
            </p>
          )}
          {affectedNodeLabels.length > 0 && (
            <p className={`${typography.caption} text-ink-500 mt-1`}>
              Affects: {affectedNodeLabels.join(', ')}
              {warning.affected_node_ids.length > 3 && ` +${warning.affected_node_ids.length - 3} more`}
            </p>
          )}
        </div>
        {(hasFocusableNode || hasFocusableEdge) && (
          <button
            type="button"
            onClick={() => {
              if (hasFocusableNode) {
                onFocusNode(warning.affected_node_ids[0])
              } else if (hasFocusableEdge) {
                onFocusEdge(warning.affected_edge_ids[0])
              }
            }}
            className={`${typography.caption} flex items-center gap-1 px-2 py-1 rounded text-sky-600 hover:bg-sky-50 transition-colors flex-shrink-0`}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Focus
          </button>
        )}
      </div>
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
 * Phase 1b Task 5: Goal Connectivity Badge
 * Shows connectivity status: full (green), partial (amber), none (red/blocker)
 */
function GoalConnectivityBadge({
  connectivity,
  nodes,
  edges,
  onFocusNode,
  onFocusEdge,
}: {
  connectivity: CEEGoalConnectivity
  nodes: Node[]
  edges: Array<{ id: string; label?: string; source: string; target: string }>
  onFocusNode: (nodeId: string) => void
  onFocusEdge: (edgeId: string) => void
}) {
  const statusConfig = {
    full: { label: 'All connected', color: 'bg-mint-100 text-mint-700', icon: CheckCircle },
    partial: { label: 'Weak paths', color: 'bg-banana-100 text-banana-700', icon: AlertTriangle },
    none: { label: 'Blocked', color: 'bg-carrot-100 text-carrot-700', icon: X },
  }
  const config = statusConfig[connectivity.status]
  const Icon = config.icon

  // Get disconnected option labels
  const disconnectedLabels = connectivity.disconnected_options
    .map(id => nodes.find(n => n.id === id)?.data?.label ?? id)
    .slice(0, 3)

  // Get weak path info
  const weakPaths = connectivity.weak_paths?.slice(0, 2) ?? []

  if (connectivity.status === 'full') {
    return (
      <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded ${config.color}`}>
        <Icon className="h-3.5 w-3.5" />
        <span className={typography.caption}>{config.label}</span>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded ${config.color}`}>
        <Icon className="h-3.5 w-3.5" />
        <span className={typography.caption}>{config.label}</span>
      </div>

      {/* Disconnected options */}
      {disconnectedLabels.length > 0 && (
        <div className="pl-4">
          <p className={`${typography.caption} text-ink-500`}>
            Disconnected: {disconnectedLabels.join(', ')}
            {connectivity.disconnected_options.length > 3 && ` +${connectivity.disconnected_options.length - 3} more`}
          </p>
          {connectivity.disconnected_options[0] && (
            <button
              type="button"
              onClick={() => onFocusNode(connectivity.disconnected_options[0])}
              className={`${typography.caption} text-sky-600 hover:text-sky-700 mt-1`}
            >
              Focus first disconnected
            </button>
          )}
        </div>
      )}

      {/* Weak paths */}
      {weakPaths.length > 0 && (
        <div className="pl-4 space-y-1">
          {weakPaths.map((path) => {
            const optionLabel = nodes.find(n => n.id === path.option_id)?.data?.label ?? path.option_id
            const reasonLabel = path.reason === 'low_strength' ? 'weak influence'
              : path.reason === 'low_confidence' ? 'uncertain'
              : 'indirect'
            const firstEdge = edges.find(e => path.weak_edge_ids?.includes(e.id))
            const edgeLabel = firstEdge ? getEdgeLabel(firstEdge, nodes) : null

            return (
              <div key={path.option_id} className="flex items-center gap-2">
                <span className={`${typography.caption} text-ink-600`}>
                  {optionLabel}: {reasonLabel}
                  {edgeLabel && ` (${edgeLabel})`}
                </span>
                {firstEdge && (
                  <button
                    type="button"
                    onClick={() => onFocusEdge(firstEdge.id)}
                    className={`${typography.caption} text-sky-600 hover:text-sky-700`}
                  >
                    Focus
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
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

/**
 * Structure row item with focus button
 */
interface StructureItem {
  id: string
  label: string
  flag?: 'ai-inferred' | 'default-value'
  isBaseline?: boolean
}

/**
 * v2.1 Structure row component - shows count + View → instead of inline lists
 * Task 4: Don't mix lists inside rows. Use count + individual focus.
 *
 * Collapsed: "Options: 2 configured [View →]"
 * Expanded:  "▾ Options (2)" with individual items below
 */
function StructureRow({
  rowLabel,
  items,
  emptyMessage,
  onFocus,
  onAdd,
  addLabel,
}: {
  rowLabel: string
  items: StructureItem[]
  emptyMessage?: string
  onFocus: (id: string) => void
  onAdd?: () => void
  addLabel?: string
}) {
  const [expanded, setExpanded] = useState(false)

  // Count warnings for badge
  const warningCount = items.filter(i => i.flag).length

  // Sort: baseline first for options, then flagged, then alphabetical
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      if (a.isBaseline && !b.isBaseline) return -1
      if (!a.isBaseline && b.isBaseline) return 1
      if (a.flag && !b.flag) return -1
      if (!a.flag && b.flag) return 1
      return a.label.localeCompare(b.label)
    })
  }, [items])

  // Empty state
  if (items.length === 0) {
    return (
      <div className="flex items-center gap-4 py-1.5">
        <span className={`${typography.caption} text-ink-500 w-20 flex-shrink-0`}>{rowLabel}</span>
        <div className="flex-1 flex items-center gap-2">
          <span className={`${typography.caption} text-ink-400 italic`}>{emptyMessage || 'None'}</span>
          {onAdd && (
            <button
              type="button"
              onClick={onAdd}
              className={`${typography.caption} text-sky-600 hover:text-sky-700 flex items-center gap-1`}
            >
              <Plus className="h-3 w-3" />
              {addLabel || 'Add'}
            </button>
          )}
        </div>
      </div>
    )
  }

  // Collapsed view: count + View →
  if (!expanded) {
    return (
      <div className="flex items-center gap-4 py-1.5">
        <span className={`${typography.caption} text-ink-500 w-20 flex-shrink-0`}>{rowLabel}</span>
        <div className="flex-1 flex items-center gap-2">
          <span className={`${typography.caption} text-ink-700`}>
            {items.length} configured
          </span>
          {warningCount > 0 && (
            <span className={`${typography.caption} inline-flex items-center gap-1 px-1.5 py-0.5 bg-banana-100 text-banana-700 rounded`}>
              <AlertTriangle className="h-3 w-3" />
              {warningCount}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className={`${typography.caption} text-sky-600 hover:text-sky-700 flex items-center gap-1`}
        >
          {CTA_LABELS.view}
        </button>
      </div>
    )
  }

  // Expanded view: collapsible header + individual items
  return (
    <div className="py-1">
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setExpanded(false)}
        className="flex items-center gap-2 w-full text-left py-1"
      >
        <ChevronDown className="h-3 w-3 text-ink-400" />
        <span className={`${typography.caption} text-ink-500`}>
          {rowLabel} ({items.length})
        </span>
        {warningCount > 0 && (
          <span className={`${typography.caption} inline-flex items-center gap-1 px-1.5 py-0.5 bg-banana-100 text-banana-700 rounded`}>
            <AlertTriangle className="h-3 w-3" />
            {warningCount}
          </span>
        )}
      </button>
      {/* Individual items */}
      <div className="pl-5 space-y-1 mt-1">
        {sortedItems.map((item) => (
          <div key={item.id} className="flex items-center gap-2 group py-0.5">
            {item.flag && (
              <AlertTriangle className="h-3 w-3 text-banana-500 flex-shrink-0" />
            )}
            <span className={`${typography.caption} text-ink-900 flex-1`}>
              {item.label}
              {item.isBaseline && (
                <span className="text-mint-600 ml-1">(baseline)</span>
              )}
              {item.flag === 'ai-inferred' && (
                <span className="text-banana-600 ml-1">(AI-inferred)</span>
              )}
              {item.flag === 'default-value' && (
                <span className="text-banana-600 ml-1">(default value)</span>
              )}
            </span>
            <button
              type="button"
              onClick={() => onFocus(item.id)}
              className="opacity-0 group-hover:opacity-100 text-sky-500 hover:text-sky-600 transition-opacity"
              aria-label={`Focus on ${item.label}`}
            >
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Decision structure list showing goal, decision, options, factors, risks, outcomes
 */
function StructureList({
  nodes,
  onFocus,
  onAddRisk,
}: {
  nodes: Node[]
  onFocus: (nodeId: string) => void
  onAddRisk: () => void
}) {
  // Group nodes by type
  const grouped = useMemo(() => {
    const goals: StructureItem[] = []
    const decisions: StructureItem[] = []
    const options: StructureItem[] = []
    const factors: StructureItem[] = []
    const risks: StructureItem[] = []
    const outcomes: StructureItem[] = []

    for (const node of nodes) {
      const label = (node.data as any)?.label || node.id
      const observedState = (node.data as any)?.observed_state
      let flag: 'ai-inferred' | 'default-value' | undefined
      if (observedState?.source === 'ai') flag = 'ai-inferred'
      else if (observedState?.source === 'default') flag = 'default-value'

      const item: StructureItem = { id: node.id, label, flag }

      switch (node.type) {
        case 'goal':
          goals.push(item)
          break
        case 'decision':
          decisions.push(item)
          break
        case 'option':
          // Check if baseline (first option or marked as baseline)
          options.push({ ...item, isBaseline: (node.data as any)?.is_baseline })
          break
        case 'factor':
          factors.push(item)
          break
        case 'risk':
          risks.push(item)
          break
        case 'outcome':
          outcomes.push(item)
          break
      }
    }

    return { goals, decisions, options, factors, risks, outcomes }
  }, [nodes])

  return (
    <div className="p-4 bg-paper-50 border border-sand-200 rounded-xl space-y-1">
      <StructureRow
        rowLabel="Goal"
        items={grouped.goals}
        emptyMessage="No goal selected"
        onFocus={onFocus}
      />
      {grouped.decisions.length > 0 && (
        <StructureRow
          rowLabel="Decision"
          items={grouped.decisions}
          onFocus={onFocus}
        />
      )}
      <StructureRow
        rowLabel="Options"
        items={grouped.options}
        emptyMessage="No options configured"
        onFocus={onFocus}
      />
      <StructureRow
        rowLabel="Factors"
        items={grouped.factors}
        onFocus={onFocus}
      />
      <StructureRow
        rowLabel="Risks"
        items={grouped.risks}
        emptyMessage="None modelled"
        onFocus={onFocus}
        onAdd={onAddRisk}
        addLabel="Add risk"
      />
      <StructureRow
        rowLabel="Outcomes"
        items={grouped.outcomes}
        emptyMessage="None modelled"
        onFocus={onFocus}
      />
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
  // Quality breakdown collapsed state (now includes Details accordion)
  const [isBreakdownOpen, setIsBreakdownOpen] = useState(false)
  // Coaching accordion state - null means "use auto behavior", boolean means "user explicitly set"
  const [coachingUserOverride, setCoachingUserOverride] = useState<boolean | null>(null)
  // Track previous blocker count to detect transitions
  const [prevBlockerCount, setPrevBlockerCount] = useState<number | null>(null)
  // Track highlight timeout to prevent race conditions
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Store data
  const nodes = useCanvasStore(useShallow((s) => s.nodes))
  const ceeAnalysisReady = useCanvasStore((s) => s.ceeAnalysisReady)
  const ceeQuality = useCanvasStore((s) => s.ceeQuality)
  const setHighlightedNodes = useCanvasStore((s) => s.setHighlightedNodes)

  // Phase 1b: Extended CEE data selectors
  const ceeExtendedWarnings = useCanvasStore((s) => s.ceeExtendedWarnings)
  const ceeGoalConnectivity = useCanvasStore((s) => s.ceeGoalConnectivity)
  const ceeModelQualityFactors = useCanvasStore((s) => s.ceeModelQualityFactors)
  const ceeInterventionHints = useCanvasStore((s) => s.ceeInterventionHints)

  // Phase 1b: Edges for goal connectivity weak paths
  const edges = useCanvasStore(useShallow((s) => s.edges))

  // Validation and readiness hooks
  const preRunValidation = usePreRunValidation()
  const { readiness, loading: readinessLoading } = useGraphReadiness()

  // v2.1: Use normalised issue data from the new hook
  const preAnalysisData = usePreAnalysisData()

  // Legacy: Aggregate blocking issues (kept for backwards compatibility)
  const blockingIssues = useMemo(() => {
    return aggregateBlockingIssues(
      preRunValidation.blockers,
      ceeAnalysisReady?.options,
      nodes
    )
  }, [preRunValidation.blockers, ceeAnalysisReady?.options, nodes])

  // v2.1: Use normalised issue count for blockers
  const totalBlockers = preAnalysisData.allIssues.filter(i => i.severity === 'blocker' || i.severity === 'high').length

  // v2.1: Fix First issues (top 3 sorted by priority)
  const fixFirstIssues = preAnalysisData.fixFirstIssues
  const remainingIssueCount = preAnalysisData.remainingCount

  // Phase 1b: CEE blocker detection
  // Only 'blocker' severity or goal_connectivity.status === 'none' disables Analyse
  const hasCeeBlocker = useMemo(() => {
    if (ceeGoalConnectivity?.status === 'none') return true
    if (ceeExtendedWarnings?.some(w => w.severity === 'blocker')) return true
    return false
  }, [ceeGoalConnectivity, ceeExtendedWarnings])

  // v2.1: Use normalised canRun from hook
  const graphCanRun = readinessLoading ? true : (readiness?.can_run_analysis ?? true)
  const isReady = preAnalysisData.canRun

  // Notify parent of blocker state changes (Phase 1b: include CEE blockers)
  useEffect(() => {
    onBlockersChange?.(preAnalysisData.hasBlockers)
  }, [preAnalysisData.hasBlockers, onBlockersChange])

  // Notify parent of readiness changes
  useEffect(() => {
    onCanRunChange?.(graphCanRun)
  }, [graphCanRun, onCanRunChange])

  // Model quality: min(Structure, Coverage, Validation) × 10
  const qualityScore = calculateModelQuality(ceeQuality)
  const qualityLevel = getQualityLevel(qualityScore)

  // v2.1: Use new limiting factor logic (active issues → lowest score)
  const limitingFactorInfo = preAnalysisData.limitingFactor

  // Blocked reason precedence:
  // 1. ceeAnalysisReady.reason if present
  // 2. First blocker message
  // 3. Fallback text
  const blockedReason = useMemo(() => {
    if (isReady) return null
    if ((ceeAnalysisReady as any)?.reason) return (ceeAnalysisReady as any).reason
    if (blockingIssues.length > 0) return blockingIssues[0].title
    if (!graphCanRun) return 'Graph needs attention'
    return 'Resolve issues below to analyse'
  }, [isReady, ceeAnalysisReady, blockingIssues, graphCanRun])

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

  // Phase 1b: Group warnings by dimension for user-facing display
  // Task 5: Filter out EDGE_ORIGIN_DEFAULTED (observability-level, not user-facing)
  const warningsByDimension = useMemo(() => {
    const grouped: Record<WarningDimension, CEEDraftWarning[]> = {
      Estimates: [],
      Validation: [],
      Framing: [],
    }
    if (!ceeExtendedWarnings) return grouped

    // Filter out observability-level warnings that shouldn't be shown to users
    const userFacingWarnings = ceeExtendedWarnings.filter(
      w => w.code !== 'EDGE_ORIGIN_DEFAULTED'
    )

    // Sort warnings by severity (blocker first) then group by dimension
    const sorted = [...userFacingWarnings].sort(
      (a, b) => (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3)
    )
    for (const warning of sorted) {
      const dimension = getWarningDimension(warning.code)
      grouped[dimension].push(warning)
    }
    return grouped
  }, [ceeExtendedWarnings])

  // Phase 1b Task 6: Same lever detection
  // Detect when ≥2 options target the same factor (pulling same lever)
  // Issue 4 fix: Only consider ready options with non-empty interventions
  // Task 2 fix: Warn if ≥2 options share ≥1 factor (not just when ALL options share)
  const sameLeverInfo = useMemo(() => {
    if (!ceeAnalysisReady?.options) return null

    // Filter to ready options with at least one intervention
    const validOptions = ceeAnalysisReady.options.filter(
      o => o.status === 'ready' && Object.keys(o.interventions || {}).length > 0
    )

    if (validOptions.length < 2) return null

    // Count how many options target each factor
    const targetCounts: Record<string, { optionLabels: string[]; factorId: string }> = {}

    for (const option of validOptions) {
      const targets = Object.keys(option.interventions || {})
      for (const targetId of targets) {
        if (!targetCounts[targetId]) {
          targetCounts[targetId] = { optionLabels: [], factorId: targetId }
        }
        targetCounts[targetId].optionLabels.push(option.label)
      }
    }

    // Find factors targeted by ≥2 options (shared lever)
    const sameLeverFactors = Object.entries(targetCounts)
      .filter(([, info]) => info.optionLabels.length >= 2)
      .map(([factorId, info]) => {
        const factorNode = nodes.find(n => n.id === factorId)
        const hint = ceeInterventionHints?.[factorId]
        return {
          factorId,
          factorLabel: factorNode?.data?.label ?? factorId,
          optionCount: info.optionLabels.length,
          optionLabels: info.optionLabels,
          unit: hint?.unit,
          factorType: hint?.factor_type,
        }
      })

    return sameLeverFactors.length > 0 ? sameLeverFactors : null
  }, [ceeAnalysisReady?.options, nodes, ceeInterventionHints])

  // Phase 1b Task 9: Baseline detection enhancement
  // Detect which option is the baseline and show warning if none
  // Task 3 fix: UI node state is source of truth, CEE is fallback
  const baselineInfo = useMemo(() => {
    // Check options for baseline flag (UI source of truth)
    const optionNodes = nodes.filter(n => n.type === 'option' || n.type === 'decision')
    const baselineOption = optionNodes.find(n => (n.data as any)?.is_baseline === true)
    const uiBaseline = baselineOption !== undefined

    // CEE fallback
    const ceeBaseline = ceeModelQualityFactors?.has_baseline_option ?? false

    // DEV-only: warn if sources disagree
    if (import.meta.env.DEV && uiBaseline !== ceeBaseline) {
      console.warn('Baseline detection mismatch: UI says', uiBaseline, ', CEE says', ceeBaseline)
    }

    // UI takes precedence, CEE is fallback
    const hasBaseline = uiBaseline || ceeBaseline

    // Need at least 2 options for baseline to be meaningful
    const needsBaseline = optionNodes.length >= 2

    return {
      hasBaseline,
      baselineLabel: baselineOption ? (baselineOption.data as any)?.label ?? baselineOption.id : null,
      needsBaseline,
      optionCount: optionNodes.length,
    }
  }, [nodes, ceeModelQualityFactors])

  // Phase 1b Task 8: Edge provenance summary
  // Opportunity fix: Separate "unknown" from explicit "default"
  const edgeProvenanceStats = useMemo(() => {
    if (edges.length === 0) return null

    const stats = {
      total: edges.length,
      userSet: 0,
      ceeRecommended: 0,
      defaulted: 0,
      unknown: 0,
    }

    for (const edge of edges) {
      const data = edge.data as { formProvenance?: string; provenance?: string } | undefined
      const provenance = data?.formProvenance ?? data?.provenance

      if (provenance === 'user_selected' || provenance === 'user') {
        stats.userSet++
      } else if (provenance === 'cee_recommended' || provenance === 'ai' || provenance === 'inferred') {
        stats.ceeRecommended++
      } else if (provenance === 'default') {
        stats.defaulted++
      } else {
        // No provenance set = unknown (likely legacy edges)
        stats.unknown++
      }
    }

    return stats
  }, [edges])

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
      // Clear any existing highlight timeout to prevent race conditions
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current)
      }
      setHighlightedNodes([nodeId])
      focusNodeById(nodeId)
      highlightTimeoutRef.current = setTimeout(() => setHighlightedNodes([]), 3000)
    },
    [setHighlightedNodes]
  )

  // Phase 1b: Edge focus handler
  const handleFocusEdge = useCallback(
    (edgeId: string) => {
      // Clear any existing highlight timeout
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current)
      }
      focusEdgeById(edgeId)
    },
    []
  )

  /**
   * v2.1 Task 5: Precedence-aware focus handler
   * Handles focus based on NormalisedIssue focus target
   * - Edge focus: highlight edge, pan to midpoint, open inspector
   * - Node focus: select node, pan to center, open inspector
   */
  const handleIssueFocus = useCallback(
    (focus: NormalisedIssue['focus']) => {
      if (!focus) return

      if (focus.type === 'edge') {
        // Edge focus: highlight edge, pan to midpoint
        focusEdgeById(focus.id)
        // Open inspector for edge if available
        const { setInspectorOpen } = useCanvasStore.getState()
        setInspectorOpen(true)
      } else {
        // Node focus: select node, pan to center
        if (highlightTimeoutRef.current) {
          clearTimeout(highlightTimeoutRef.current)
        }
        setHighlightedNodes([focus.id])
        focusNodeById(focus.id)
        // Open inspector for node
        const { setSelectedNodeId, setInspectorOpen } = useCanvasStore.getState()
        setSelectedNodeId(focus.id)
        setInspectorOpen(true)
        highlightTimeoutRef.current = setTimeout(() => setHighlightedNodes([]), 3000)
      }
    },
    [setHighlightedNodes]
  )

  /**
   * v2.1: Handle actions from FixFirstCard
   */
  const handleIssueAction = useCallback(
    (action: { key: string; kind: string }) => {
      const { setInspectorOpen, setSelectedNodeId } = useCanvasStore.getState()
      switch (action.key) {
        case 'mark_baseline':
          // Navigate to options view or inspector
          setInspectorOpen(true)
          break
        case 'add_option':
          // Could trigger add option flow
          setInspectorOpen(true)
          break
        default:
          // Generic navigation
          setInspectorOpen(true)
      }
    },
    []
  )

  const handleDismissCoaching = useCallback((id: string) => {
    setDismissedCoachingIds((prev) => new Set([...prev, id]))
  }, [])

  // Handle adding a new risk node
  const handleAddRisk = useCallback(() => {
    const { addNode, setSelectedNodeId, setInspectorOpen } = useCanvasStore.getState()
    // Find goal node to position near it
    const goalNode = nodes.find(n => n.type === 'goal')
    const position = goalNode
      ? { x: goalNode.position.x + 250, y: goalNode.position.y }
      : { x: 400, y: 200 }

    const newNodeId = `risk_${Date.now()}`
    addNode({
      id: newNodeId,
      type: 'risk',
      position,
      data: { label: 'New risk', type: 'risk' },
    })
    // Select the new node and open inspector
    setTimeout(() => {
      setSelectedNodeId(newNodeId)
      setInspectorOpen(true)
    }, 50)
  }, [nodes])

  // Don't show panel if canvas is empty
  if (nodes.length === 0) {
    return null
  }

  // Determine which view to show
  const hasBlockingIssues = totalBlockers > 0 || (ceeAnalysisReady?.status && ceeAnalysisReady.status !== 'ready')

  // Scroll to readiness checks section and expand it
  const handleReviewClick = useCallback(() => {
    setIsBreakdownOpen(true)
    // Small delay to allow expansion before scrolling
    setTimeout(() => {
      document.getElementById('readiness-checks')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }, [])

  return (
    <div className="space-y-4" data-testid="pre-analysis-readiness-panel">
      {/* Two-line header */}
      <div className="p-4 bg-paper-50 border border-sand-200 rounded-xl">
        {/* Line 1: Can analyse status + Analyse button */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className={`${typography.caption} text-ink-500`}>Can analyse:</span>
            {isReady ? (
              <span className={`${typography.body} font-medium text-mint-700 flex items-center gap-1`}>
                <CheckCircle className="h-4 w-4" aria-hidden="true" />
                Ready
              </span>
            ) : (
              <span className={`${typography.body} font-medium text-carrot-700 flex items-center gap-1`}>
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                Blocked: {blockedReason}
              </span>
            )}
            {readinessLoading && (
              <Loader2 className="h-3.5 w-3.5 text-sand-400 animate-spin" aria-hidden="true" />
            )}
          </div>
          <AnalyzeButton
            totalBlockers={totalBlockers}
            isReady={isReady}
            isAnalysing={isAnalysing}
            onClick={onAnalyse}
          />
        </div>

        {/* Line 2: Model quality + limiting factor + Review link */}
        {/* v2.1: Limiting factor uses new logic - active issues first, then lowest score */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`${typography.caption} text-ink-500`}>Model quality:</span>
            <span className={`${typography.body} font-semibold ${qualityLevel.color}`}>
              {qualityLevel.label}
            </span>
            <span className={`${typography.caption} text-ink-500`}>
              ({qualityScore}%)
            </span>
            {qualityScore < 100 && (
              <span className={`${typography.caption} ${limitingFactorInfo.hasActiveIssues ? 'text-carrot-600' : 'text-ink-500'}`}>
                — {limitingFactorInfo.label}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleReviewClick}
            className={`${typography.caption} text-sky-600 hover:text-sky-700 transition-colors flex items-center gap-1`}
          >
            Review
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Structure List - Decision model overview */}
      <StructureList
        nodes={nodes}
        onFocus={handleFocusNode}
        onAddRisk={handleAddRisk}
      />

      {/* Phase 1b Task 5: Goal Connectivity Status */}
      {ceeGoalConnectivity && (
        <div className="px-4 py-3 border border-sand-200 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <span className={`${typography.label} text-ink-600`}>Goal Connectivity</span>
          </div>
          <GoalConnectivityBadge
            connectivity={ceeGoalConnectivity}
            nodes={nodes}
            edges={edges}
            onFocusNode={handleFocusNode}
            onFocusEdge={handleFocusEdge}
          />
        </div>
      )}

      {/* Phase 1b Task 7: Model Quality Factors */}
      {ceeModelQualityFactors && (
        <div className="px-4 py-3 border border-sand-200 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <span className={`${typography.label} text-ink-600`}>Model Confidence</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {/* Estimate Confidence */}
            <div className="flex items-center gap-2">
              <span className={`${typography.caption} text-ink-500`}>Estimates:</span>
              <span className={`${typography.caption} font-medium ${
                ceeModelQualityFactors.estimate_confidence >= 0.7 ? 'text-mint-700' :
                ceeModelQualityFactors.estimate_confidence >= 0.4 ? 'text-banana-700' : 'text-carrot-700'
              }`}>
                {Math.round(ceeModelQualityFactors.estimate_confidence * 100)}%
              </span>
            </div>
            {/* Strength Variation */}
            <div className="flex items-center gap-2">
              <span className={`${typography.caption} text-ink-500`}>Variation:</span>
              <span className={`${typography.caption} font-medium ${
                ceeModelQualityFactors.strength_variation <= 0.3 ? 'text-mint-700' :
                ceeModelQualityFactors.strength_variation <= 0.6 ? 'text-banana-700' : 'text-carrot-700'
              }`}>
                {ceeModelQualityFactors.strength_variation <= 0.3 ? 'Low' :
                 ceeModelQualityFactors.strength_variation <= 0.6 ? 'Moderate' : 'High'}
              </span>
            </div>
            {/* Range Coverage */}
            <div className="flex items-center gap-2">
              <span className={`${typography.caption} text-ink-500`}>Range coverage:</span>
              <span className={`${typography.caption} font-medium ${
                ceeModelQualityFactors.range_confidence_coverage >= 0.7 ? 'text-mint-700' :
                ceeModelQualityFactors.range_confidence_coverage >= 0.4 ? 'text-banana-700' : 'text-carrot-700'
              }`}>
                {Math.round(ceeModelQualityFactors.range_confidence_coverage * 100)}%
              </span>
            </div>
            {/* Baseline Option */}
            <div className="flex items-center gap-2">
              <span className={`${typography.caption} text-ink-500`}>Baseline:</span>
              <span className={`${typography.caption} font-medium ${
                ceeModelQualityFactors.has_baseline_option ? 'text-mint-700' : 'text-banana-700'
              }`}>
                {ceeModelQualityFactors.has_baseline_option ? 'Yes' : 'No'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* v2.1: Relationship Sources moved to Details accordion - see below */}

      {/* Readiness Checks Section (collapsible) - now includes Details */}
      <div id="readiness-checks" className="border border-sand-200 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setIsBreakdownOpen(!isBreakdownOpen)}
          className="w-full flex items-center justify-between px-4 py-3 bg-sand-50 hover:bg-sand-100 transition-colors"
          aria-expanded={isBreakdownOpen}
          aria-controls="quality-breakdown-content"
        >
          <span className={`${typography.body} font-medium text-ink-700`}>Readiness Checks</span>
          {isBreakdownOpen ? (
            <ChevronDown className="h-4 w-4 text-ink-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-ink-400" />
          )}
        </button>

        {isBreakdownOpen && (
          <div id="quality-breakdown-content" className="p-4 space-y-1 border-t border-sand-200">
            {/* Compact dimension display with severity icons */}
            {/* Phase 1b: Add warning counts from extended warnings per dimension */}
            <DimensionRow
              label="Structure"
              score={ceeQuality?.structure ?? Math.round(qualityScore / 10)}
              warningCount={warningsByDimension.Framing.length}
              onViewWarnings={warningsByDimension.Framing.length > 0 ? () => {
                // Focus on first affected node from Framing warnings
                const firstWarning = warningsByDimension.Framing[0]
                if (firstWarning?.affected_node_ids?.[0]) {
                  handleFocusNode(firstWarning.affected_node_ids[0])
                }
              } : undefined}
            />
            <DimensionRow
              label="Coverage"
              score={ceeQuality?.coverage ?? Math.round(qualityScore / 10)}
              warningCount={warningsByDimension.Estimates.length}
              onViewWarnings={warningsByDimension.Estimates.length > 0 ? () => {
                // Focus on first affected node from Estimates warnings
                const firstWarning = warningsByDimension.Estimates[0]
                if (firstWarning?.affected_node_ids?.[0]) {
                  handleFocusNode(firstWarning.affected_node_ids[0])
                }
              } : undefined}
            />
            <DimensionRow
              label="Validation"
              score={ceeQuality?.safety ?? Math.round(qualityScore / 10)}
              warningCount={totalBlockers + warningsByDimension.Validation.length}
              onViewWarnings={(totalBlockers > 0 || warningsByDimension.Validation.length > 0) ? () => {
                // Focus on first blocking issue or validation warning
                if (blockingIssues[0]?.focusNodeId) {
                  handleFocusNode(blockingIssues[0].focusNodeId)
                } else if (warningsByDimension.Validation[0]?.affected_node_ids?.[0]) {
                  handleFocusNode(warningsByDimension.Validation[0].affected_node_ids[0])
                }
              } : undefined}
            />

            {/* v2.1 Task 3: Relationship Sources - natural language in Details only */}
            {preAnalysisData.edgeProvenance && preAnalysisData.edgeProvenance.totalCount > 0 && (
              <div className="flex items-center gap-3 py-2 mt-2 pt-3 border-t border-sand-100">
                <span className={`${typography.caption} text-ink-500`}>Provenance</span>
                <span
                  className={`${typography.caption} text-ink-700 cursor-help`}
                  title="These links were generated without recorded provenance. You can still analyse; add provenance where it matters."
                >
                  Recorded for {preAnalysisData.edgeProvenance.attributedCount} of {preAnalysisData.edgeProvenance.totalCount} relationships
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* v2.1 Task 2: Fix First Section - Top 3 issues sorted by category → severity */}
      {fixFirstIssues.length > 0 && (
        <div className="space-y-2">
          <h3 className={`${typography.label} text-carrot-700`}>
            Fix First ({fixFirstIssues.length}{remainingIssueCount > 0 ? ` of ${fixFirstIssues.length + remainingIssueCount}` : ''})
          </h3>
          {fixFirstIssues.map((issue) => (
            <FixFirstCard
              key={issue.key}
              issue={issue}
              onFocusNode={handleFocusNode}
              onFocusEdge={handleFocusEdge}
              onAction={handleIssueAction}
            />
          ))}
          {remainingIssueCount > 0 && (
            <p className={`${typography.caption} text-ink-500`}>
              {remainingIssueCount} more issue{remainingIssueCount !== 1 ? 's' : ''} — review in Details
            </p>
          )}
        </div>
      )}

      {/* Phase 1b Task 3: Extended Validation Warnings Section */}
      {/* Show warnings grouped by dimension when CEE provides extended_warnings */}
      {/* Note: Show warnings even when there's a CEE blocker - users need to see all issues */}
      {ceeExtendedWarnings && ceeExtendedWarnings.length > 0 && (
        <div className="space-y-4">
          {/* Estimates dimension warnings */}
          {warningsByDimension.Estimates.length > 0 && (
            <div className="space-y-2">
              <h3 className={`${typography.label} text-banana-700`}>
                Estimates ({warningsByDimension.Estimates.length})
              </h3>
              {warningsByDimension.Estimates.slice(0, 3).map((warning) => (
                <ExtendedWarningCard
                  key={warning.id}
                  warning={warning}
                  nodes={nodes}
                  onFocusNode={handleFocusNode}
                  onFocusEdge={handleFocusEdge}
                />
              ))}
              {warningsByDimension.Estimates.length > 3 && (
                <p className={`${typography.caption} text-ink-500`}>
                  +{warningsByDimension.Estimates.length - 3} more
                </p>
              )}
            </div>
          )}

          {/* Validation dimension warnings (non-blocker only) */}
          {warningsByDimension.Validation.filter(w => w.severity !== 'blocker').length > 0 && (
            <div className="space-y-2">
              <h3 className={`${typography.label} text-banana-700`}>
                Validation ({warningsByDimension.Validation.filter(w => w.severity !== 'blocker').length})
              </h3>
              {warningsByDimension.Validation.filter(w => w.severity !== 'blocker').slice(0, 3).map((warning) => (
                <ExtendedWarningCard
                  key={warning.id}
                  warning={warning}
                  nodes={nodes}
                  onFocusNode={handleFocusNode}
                  onFocusEdge={handleFocusEdge}
                />
              ))}
              {warningsByDimension.Validation.filter(w => w.severity !== 'blocker').length > 3 && (
                <p className={`${typography.caption} text-ink-500`}>
                  +{warningsByDimension.Validation.filter(w => w.severity !== 'blocker').length - 3} more
                </p>
              )}
            </div>
          )}

          {/* Framing dimension warnings */}
          {warningsByDimension.Framing.length > 0 && (
            <div className="space-y-2">
              <h3 className={`${typography.label} text-banana-700`}>
                Framing ({warningsByDimension.Framing.length})
              </h3>
              {warningsByDimension.Framing.slice(0, 3).map((warning) => (
                <ExtendedWarningCard
                  key={warning.id}
                  warning={warning}
                  nodes={nodes}
                  onFocusNode={handleFocusNode}
                  onFocusEdge={handleFocusEdge}
                />
              ))}
              {warningsByDimension.Framing.length > 3 && (
                <p className={`${typography.caption} text-ink-500`}>
                  +{warningsByDimension.Framing.length - 3} more
                </p>
              )}
            </div>
          )}

        </div>
      )}

      {/* Phase 1b Task 6: Same lever detection (client-side enhancement) */}
      {/* Renders independently of CEE warnings - purely client-side detection */}
      {sameLeverInfo && sameLeverInfo.length > 0 && warningsByDimension.Framing.length === 0 && (
        <div className="space-y-2">
          <h3 className={`${typography.label} text-banana-700`}>
            Framing (same lever)
          </h3>
          <div className="p-3 bg-banana-50 border border-banana-200 rounded-lg">
            <div className="flex items-start gap-3">
              <HelpCircle className="h-4 w-4 text-banana-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className={`${typography.body} text-banana-700`}>
                  Multiple options target the same factor{sameLeverInfo.length > 1 ? 's' : ''}
                </p>
                {sameLeverInfo.map((f) => (
                  <p key={f.factorId} className={`${typography.caption} text-banana-600 mt-1`}>
                    <span className="font-medium">{f.factorLabel}</span>
                    {f.unit && ` (${f.unit})`}
                    {': '}
                    {f.optionLabels.join(', ')}
                  </p>
                ))}
                <p className={`${typography.caption} text-ink-600 mt-1`}>
                  Consider adding alternatives that affect different factors for a more meaningful comparison.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Phase 1b Task 9: Baseline detection enhancement */}
      {/* Renders independently of CEE warnings - purely client-side detection */}
      {baselineInfo.needsBaseline && !baselineInfo.hasBaseline && !ceeExtendedWarnings?.some(w => w.code === 'MISSING_BASELINE') && (
        <div className="space-y-2">
          <h3 className={`${typography.label} text-banana-700`}>
            Framing (no baseline)
          </h3>
          <div className="p-3 bg-banana-50 border border-banana-200 rounded-lg">
            <div className="flex items-start gap-3">
              <HelpCircle className="h-4 w-4 text-banana-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className={`${typography.body} text-banana-700`}>
                  No baseline option identified
                </p>
                <p className={`${typography.caption} text-ink-600 mt-1`}>
                  Consider marking one option as your &quot;do nothing&quot; or &quot;status quo&quot; baseline.
                  This helps compare alternatives against a reference point.
                </p>
              </div>
            </div>
          </div>
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
