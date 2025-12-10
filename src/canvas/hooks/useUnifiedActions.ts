/**
 * useUnifiedActions Hook
 * Merges all action/improvement sources into a single unified list
 *
 * Sources:
 * - Graph readiness improvements (useGraphReadiness)
 * - Validation issues (graphHealth.issues with auto-fix capability)
 * - Critique items (results.report.critique)
 * - Bias findings (runMeta.ceeReview.bias_findings)
 *
 * Returns sorted by priority: critical → high → medium → low
 */

import { useMemo } from 'react'
import { useCanvasStore } from '../store'
import { useGraphReadiness, type GraphImprovement } from './useGraphReadiness'
import { determineFixType } from '../utils/autoFix'

export type ActionPriority = 'critical' | 'high' | 'medium' | 'low'
export type ActionSource = 'readiness' | 'validation' | 'critique' | 'bias'

export interface UnifiedAction {
  id: string
  source: ActionSource
  priority: ActionPriority
  title: string
  description: string
  affectedNodeIds?: string[]
  affectedEdgeIds?: string[]
  /** For validation issues that can be auto-fixed */
  autoFixable?: boolean
  code?: string
  /** Estimated effort in minutes */
  effortMinutes?: number
  /** Expected quality improvement (0-100 scale) */
  qualityImpact?: number
  /** For weight suggestions */
  currentValue?: number
  suggestedValue?: number
  /** Original data for reference */
  _raw: GraphImprovement | ValidationIssueRaw | CritiqueItemRaw | BiasFindingRaw
}

// Raw types for internal use
interface ValidationIssueRaw {
  type: 'validation'
  code?: string
  severity: string
  message: string
  nodeId?: string
  edgeId?: string
  nodeIds?: string[]
  edgeIds?: string[]
  suggestedFix?: { type: string; targetId: string }
}

interface CritiqueItemRaw {
  type: 'critique'
  source?: string
  severity?: string
  message?: string
  code?: string
  edge_id?: string
  node_id?: string
  current_value?: number
  suggested_value?: number
  reason?: string
}

interface BiasFindingRaw {
  type: 'bias'
  code?: string
  severity?: string
  message?: string
  description?: string
  affected_node_ids?: string[]
  micro_intervention?: {
    estimated_minutes?: number
    steps?: string[]
  }
}

/**
 * Map severity strings to ActionPriority
 */
function mapSeverityToPriority(severity: string, source: ActionSource): ActionPriority {
  const upperSeverity = severity?.toUpperCase() || ''

  // Validation severity mapping
  if (source === 'validation') {
    if (upperSeverity === 'ERROR' || upperSeverity === 'BLOCKER') return 'critical'
    if (upperSeverity === 'WARNING') return 'high'
    return 'medium'
  }

  // Critique severity mapping
  if (source === 'critique') {
    if (upperSeverity === 'BLOCKER') return 'critical'
    if (upperSeverity === 'WARNING') return 'high'
    return 'medium'
  }

  // Bias severity mapping
  if (source === 'bias') {
    if (upperSeverity === 'CRITICAL' || upperSeverity === 'HIGH') return 'critical'
    if (upperSeverity === 'MEDIUM' || upperSeverity === 'WARNING') return 'high'
    return 'medium'
  }

  // Readiness improvement priority
  if (source === 'readiness') {
    if (upperSeverity === 'HIGH') return 'high'
    if (upperSeverity === 'MEDIUM') return 'medium'
    return 'low'
  }

  return 'medium'
}

/**
 * Priority sort order (lower = higher priority)
 */
const priorityOrder: Record<ActionPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

export interface UseUnifiedActionsResult {
  /** All actions sorted by priority */
  actions: UnifiedAction[]
  /** Grouped by priority for display */
  grouped: Record<ActionPriority, UnifiedAction[]>
  /** Count of critical/blocking issues */
  criticalCount: number
  /** Count of all actions */
  totalCount: number
  /** Whether analysis is blocked by critical issues */
  hasBlockers: boolean
  /** Loading state from graph readiness */
  loading: boolean
}

export function useUnifiedActions(): UseUnifiedActionsResult {
  // Get graph readiness
  const { readiness, loading } = useGraphReadiness()

  // Get store state
  const graphHealth = useCanvasStore((s) => s.graphHealth)
  const results = useCanvasStore((s) => s.results)
  const runMeta = useCanvasStore((s) => s.runMeta)

  const actions = useMemo(() => {
    const items: UnifiedAction[] = []

    // 1. Graph Readiness Improvements
    if (readiness?.improvements) {
      for (const imp of readiness.improvements) {
        items.push({
          id: `readiness-${imp.category}-${imp.action.slice(0, 20)}`,
          source: 'readiness',
          priority: mapSeverityToPriority(imp.priority, 'readiness'),
          title: imp.action,
          description: imp.current_gap || `Improve ${imp.category}`,
          affectedNodeIds: imp.affected_nodes,
          affectedEdgeIds: imp.affected_edges,
          effortMinutes: imp.effort_minutes,
          qualityImpact: imp.quality_impact,
          _raw: imp,
        })
      }
    }

    // 2. Validation Issues from graphHealth
    if (graphHealth?.issues) {
      for (const issue of graphHealth.issues) {
        const code = issue.code?.toUpperCase() || issue.type?.toUpperCase()
        const canAutoFix = !!(issue.suggestedFix && code && determineFixType(code))

        const raw: ValidationIssueRaw = {
          type: 'validation',
          code: issue.code,
          severity: issue.severity,
          message: issue.message,
          nodeId: issue.nodeId,
          edgeId: issue.edgeId,
          nodeIds: issue.nodeIds,
          edgeIds: issue.edgeIds,
          suggestedFix: issue.suggestedFix,
        }

        items.push({
          id: `validation-${issue.code || 'unknown'}-${issue.nodeId || issue.edgeId || 'global'}`,
          source: 'validation',
          priority: mapSeverityToPriority(issue.severity, 'validation'),
          title: formatValidationTitle(issue.code || issue.type),
          description: issue.message || 'A validation issue was detected',
          affectedNodeIds: issue.nodeId ? [issue.nodeId] : issue.nodeIds,
          affectedEdgeIds: issue.edgeId ? [issue.edgeId] : issue.edgeIds,
          autoFixable: canAutoFix,
          code,
          _raw: raw,
        })
      }
    }

    // 3. Critique Items from results.report.run (v1.2 CanonicalRun format)
    // Note: report.critique is string[] (legacy), report.run.critique is CritiqueItemV1[]
    const critique = results?.report?.run?.critique
    if (critique && Array.isArray(critique)) {
      for (const c of critique) {
        // Skip auto-applied items
        if (c.message?.includes('auto-applied')) continue

        const raw: CritiqueItemRaw = {
          type: 'critique',
          source: c.source,
          severity: c.severity,
          message: c.message,
          code: c.code,
          edge_id: c.edge_id,
          node_id: c.node_id,
          current_value: c.current_value,
          suggested_value: c.suggested_value,
          reason: c.reason,
        }

        items.push({
          id: `critique-${c.edge_id || c.node_id || c.code || 'unknown'}`,
          source: 'critique',
          priority: mapSeverityToPriority(c.severity || 'INFO', 'critique'),
          title: c.source === 'cee' ? 'Refine influence weight' : 'Review this area',
          description: c.message || 'Consider reviewing this connection',
          affectedNodeIds: c.node_id ? [c.node_id] : undefined,
          affectedEdgeIds: c.edge_id ? [c.edge_id] : undefined,
          currentValue: c.current_value,
          suggestedValue: c.suggested_value,
          _raw: raw,
        })
      }
    }

    // 4. Bias Findings from CEE review
    const biasFindings = runMeta?.ceeReview?.bias_findings
    if (biasFindings && Array.isArray(biasFindings)) {
      for (const bias of biasFindings) {
        const raw: BiasFindingRaw = {
          type: 'bias',
          code: bias.code,
          severity: bias.severity,
          message: bias.message,
          description: bias.description,
          affected_node_ids: bias.affected_node_ids,
          micro_intervention: bias.micro_intervention,
        }

        items.push({
          id: `bias-${bias.code || bias.type || 'unknown'}`,
          source: 'bias',
          priority: mapSeverityToPriority(bias.severity || 'info', 'bias'),
          title: formatBiasTitle(bias.code || bias.type),
          description: bias.message || bias.description || 'A potential bias was detected',
          affectedNodeIds: bias.affected_node_ids,
          effortMinutes: bias.micro_intervention?.estimated_minutes,
          _raw: raw,
        })
      }
    }

    // Sort by priority
    return items.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
  }, [readiness, graphHealth, results, runMeta])

  // Group by priority
  const grouped = useMemo(() => {
    const result: Record<ActionPriority, UnifiedAction[]> = {
      critical: [],
      high: [],
      medium: [],
      low: [],
    }

    for (const action of actions) {
      result[action.priority].push(action)
    }

    return result
  }, [actions])

  const criticalCount = grouped.critical.length
  const totalCount = actions.length
  const hasBlockers = criticalCount > 0

  return {
    actions,
    grouped,
    criticalCount,
    totalCount,
    hasBlockers,
    loading,
  }
}

/**
 * Format validation code to human-readable title
 */
function formatValidationTitle(code: string | undefined): string {
  if (!code) return 'Validation issue'

  const titles: Record<string, string> = {
    'PROBABILITY_SUM': 'Probability sum must equal 100%',
    'PROBABILITY_ERROR': 'Probability sum must equal 100%',
    'BELIEF_OUT_OF_RANGE': 'Belief value out of range',
    'ORPHAN_NODE': 'Disconnected node found',
    'ORPHAN': 'Disconnected node found',
    'DANGLING_EDGE': 'Edge references missing node',
    'DANGLING': 'Edge references missing node',
    'CYCLE_DETECTED': 'Circular dependency detected',
    'CYCLE': 'Circular dependency detected',
    'SELF_LOOP': 'Node connects to itself',
    'MISSING_OUTCOME': 'No outcome node defined',
    'NO_OUTCOME_NODE': 'No outcome node defined',
    'MISSING_DECISION': 'No decision node found',
    'MISSING_GOAL': 'No goal node defined',
    'MISSING_LABEL': 'Node or edge missing label',
    'NO_RISK': 'No risk factors identified',
    'NO_FACTOR': 'No influencing factors added',
    'DUPLICATE_EDGE': 'Duplicate connection found',
    'DUPLICATE': 'Duplicate connection found',
    'DECISION_AFTER_OUTCOME': 'Decision placed after outcome',
    'UNBALANCED_FACTORS': 'Unbalanced factor weights',
    'MISSING_EVIDENCE': 'Claim needs supporting evidence',
  }

  const upperCode = code.toUpperCase()
  return titles[upperCode] || code.replace(/_/g, ' ')
}

/**
 * Format bias code to human-readable title
 */
function formatBiasTitle(code: string | undefined): string {
  if (!code) return 'Cognitive bias detected'
  return code.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
