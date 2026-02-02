/**
 * usePreAnalysisData - Pre-Analysis Panel Data Hook (M1)
 *
 * Single derivation point for all panel data from graph state.
 * Returns a typed object consumed by every panel section.
 *
 * Four Improvement Categories:
 * - Fix: Structural blockers (missing baseline, fewer than 2 options, disconnected nodes)
 * - Verify: Factors where source === 'cee_inference' (AI-estimated values)
 * - Add evidence: Edges with no evidence metadata
 * - Strengthen: Rule-based structural checks (few options, no constraints, no risks, no negative edges)
 *
 * M2 Merge Point:
 * Includes optional coaching parameter in hook signature. When undefined (M1),
 * returns rule-based data. M2 will pass CEE CoachingPayload here.
 */

import { useMemo } from 'react'
import { useCanvasStore } from '../../../store'
import { useShallow } from 'zustand/shallow'
import type { Node, Edge } from '@xyflow/react'
import type { BiasType } from '../primitives/BiasIcon'
// Import existing readiness hook for canonical canRun/hasBlockers logic
import { usePreAnalysisData as useExistingPreAnalysisData } from '../../../hooks/usePreAnalysisData'

// ============================================================================
// Types
// ============================================================================

/** Improvement category per brief spec */
export type ImprovementCategory = 'fix' | 'verify' | 'add_evidence' | 'strengthen'

/** Action kind for improvement items */
export type ImprovementActionKind = 'confirm' | 'edit' | 'add' | 'assumption' | 'add_baseline'

/** Single improvement item */
export interface ImprovementItem {
  /** Unique key for React rendering */
  key: string
  /** Category for grouping */
  category: ImprovementCategory
  /** Display label */
  label: string
  /** Detail/explanation text */
  detail: string
  /** Optional bias type for BiasIcon */
  bias?: BiasType
  /** Focus target for canvas navigation */
  focus?: {
    type: 'node' | 'edge'
    id: string
    label: string
  }
  /** Action button config */
  action?: {
    label: string
    kind: ImprovementActionKind
    /** Target node/edge ID for the action */
    targetId?: string
    /** Target type (node or edge) */
    targetType?: 'node' | 'edge'
  }
}

/** Evidence quality level */
export type EvidenceQualityLevel = 'high' | 'medium' | 'low'

/** Evidence quality result */
export interface EvidenceQuality {
  level: EvidenceQualityLevel
  ratio: number
}

/** Nodes grouped by kind */
export interface NodesByKind {
  goal: Node[]
  decision: Node[]
  option: Node[]
  factor: Node[]
  risk: Node[]
  outcome: Node[]
}

/** M2 Coaching payload placeholder */
export interface CoachingPayload {
  // M2: Will contain CEE coaching data
  // For now, this is a placeholder type
  headline?: string
  suggestions?: Array<{ label: string; detail: string }>
}

/** Hook return type */
export interface PreAnalysisData {
  /** Improvements grouped by category */
  improvementsByCategory: Record<ImprovementCategory, ImprovementItem[]>
  /** Total count of all improvements */
  totalImprovements: number
  /** Top 3 items, priority order: Fix > Verify > Add evidence > Strengthen */
  topActions: ImprovementItem[]
  /** Evidence quality assessment */
  evidenceQuality: EvidenceQuality
  /** Whether analysis can run (from analysis_ready.status) */
  isReady: boolean
  /** Whether there are any Fix items (blockers) */
  hasBlockers: boolean
  /** Count of blocker issues from canonical readiness logic */
  blockerCount: number
  /** Nodes grouped by kind for Model Snapshot */
  nodesByKind: NodesByKind
  /** Total edge count */
  edgeCount: number
  /** Currently selected goal node */
  goalNode: Node | null
  /** Success threshold value (auto-derived or user-set) */
  successThreshold: number | null
  /** Whether success threshold was auto-derived */
  isThresholdAutoDerived: boolean
}

// ============================================================================
// Constants
// ============================================================================

// Category priority is implicit in iteration order: fix > verify > add_evidence > strengthen

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get node label with fallback
 */
function getNodeLabel(node: Node): string {
  return (node.data as { label?: string })?.label ?? node.id
}

/**
 * Check if a factor has AI-inferred source
 *
 * Canonical source types for observed_state.source (from CEE/adapters):
 * - 'ai' | 'cee_inference' | 'inferred' — AI-estimated values (need user verification)
 * - 'user' — User-confirmed values
 * - 'default' — Default/placeholder values
 *
 * Note: No enum exists in the codebase; ObservedState.source is typed as string.
 * See: src/adapters/cee/types.ts → ObservedState interface
 */
function isAiInferred(node: Node): boolean {
  const data = node.data as { observed_state?: { source?: string }; source?: string }
  const source = data?.observed_state?.source ?? data?.source
  return source === 'ai' || source === 'cee_inference' || source === 'inferred'
}

/**
 * Get AI-estimated value from node
 */
function getAiEstimatedValue(node: Node): string | null {
  const data = node.data as { observed_state?: { value?: number }; value?: number }
  const value = data?.observed_state?.value ?? data?.value
  if (value === undefined || value === null) return null
  return typeof value === 'number' ? value.toFixed(1) : String(value)
}

/**
 * Check if edge has evidence metadata
 */
function hasEvidence(edge: Edge): boolean {
  const data = edge.data as { evidence?: unknown; sources?: unknown[]; provenance?: string } | undefined
  if (!data) return false
  // Has evidence if: evidence field exists, sources array has items, or provenance is set
  if (data.evidence) return true
  if (Array.isArray(data.sources) && data.sources.length > 0) return true
  if (data.provenance && data.provenance !== 'unknown' && data.provenance !== 'default') return true
  return false
}

/**
 * Check if edge has negative strength
 */
function hasNegativeStrength(edge: Edge): boolean {
  const data = edge.data as { strength?: { mean?: number } } | undefined
  return (data?.strength?.mean ?? 0) < 0
}

// ============================================================================
// Main Hook
// ============================================================================

/**
 * Pre-Analysis Panel data hook
 *
 * @param coaching - Optional M2 coaching payload (undefined in M1)
 */
export function usePreAnalysisData(_coaching?: CoachingPayload): PreAnalysisData {
  // M2 merge point: _coaching parameter will be used when CEE CoachingPayload is available
  // Store selectors
  const nodes = useCanvasStore(useShallow(s => s.nodes))
  const edges = useCanvasStore(useShallow(s => s.edges))
  const ceeAnalysisReady = useCanvasStore(s => s.ceeAnalysisReady)

  // Group nodes by kind
  const nodesByKind = useMemo<NodesByKind>(() => {
    const result: NodesByKind = {
      goal: [],
      decision: [],
      option: [],
      factor: [],
      risk: [],
      outcome: [],
    }

    for (const node of nodes) {
      const kind = node.type as keyof NodesByKind
      if (result[kind]) {
        result[kind].push(node)
      }
    }

    return result
  }, [nodes])

  // Goal node
  const goalNode = useMemo(() => {
    const goalId = ceeAnalysisReady?.goal_node_id
    if (goalId) {
      return nodes.find(n => n.id === goalId) ?? nodesByKind.goal[0] ?? null
    }
    return nodesByKind.goal[0] ?? null
  }, [nodes, ceeAnalysisReady?.goal_node_id, nodesByKind.goal])

  // Build improvements by category
  const improvementsByCategory = useMemo(() => {
    const result: Record<ImprovementCategory, ImprovementItem[]> = {
      fix: [],
      verify: [],
      add_evidence: [],
      strengthen: [],
    }

    // === FIX CATEGORY ===
    // Missing baseline
    const optionNodes = [...nodesByKind.option, ...nodesByKind.decision]
    const hasBaseline = optionNodes.some(n => (n.data as { is_baseline?: boolean })?.is_baseline === true)
    if (!hasBaseline && optionNodes.length >= 2) {
      result.fix.push({
        key: 'missing_baseline',
        category: 'fix',
        label: 'Add baseline',
        detail: 'Compare against doing nothing',
        bias: 'anchoring',
        action: { label: 'Add', kind: 'add_baseline' },
      })
    }

    // Fewer than 2 options
    if (optionNodes.length < 2) {
      result.fix.push({
        key: 'fewer_than_2_options',
        category: 'fix',
        label: 'Add options',
        detail: 'At least 2 required',
        bias: 'framing',
      })
    }

    // Missing goal
    if (nodesByKind.goal.length === 0) {
      result.fix.push({
        key: 'missing_goal',
        category: 'fix',
        label: 'Add goal',
        detail: 'Define what you want to achieve',
      })
    }

    // Disconnected nodes (nodes with no edges)
    const connectedNodeIds = new Set<string>()
    for (const edge of edges) {
      connectedNodeIds.add(edge.source)
      connectedNodeIds.add(edge.target)
    }
    const disconnectedNodes = nodes.filter(n => !connectedNodeIds.has(n.id) && n.type !== 'goal')
    for (const node of disconnectedNodes.slice(0, 3)) {
      result.fix.push({
        key: `disconnected_${node.id}`,
        category: 'fix',
        label: `Connect "${getNodeLabel(node)}"`,
        detail: 'Node has no relationships',
        focus: { type: 'node', id: node.id, label: getNodeLabel(node) },
      })
    }

    // === VERIFY CATEGORY ===
    // Factors with AI-inferred source
    for (const factor of nodesByKind.factor) {
      if (isAiInferred(factor)) {
        const value = getAiEstimatedValue(factor)
        result.verify.push({
          key: `verify_${factor.id}`,
          category: 'verify',
          label: getNodeLabel(factor),
          detail: value ? `AI est: ${value}` : 'AI-estimated value',
          bias: 'confidence',
          focus: { type: 'node', id: factor.id, label: getNodeLabel(factor) },
          action: { label: 'Confirm', kind: 'confirm', targetId: factor.id, targetType: 'node' },
        })
      }
    }

    // === ADD EVIDENCE CATEGORY ===
    // Edges with no evidence metadata
    for (const edge of edges) {
      if (!hasEvidence(edge)) {
        const sourceNode = nodes.find(n => n.id === edge.source)
        const targetNode = nodes.find(n => n.id === edge.target)
        const sourceLabel = sourceNode ? getNodeLabel(sourceNode) : edge.source
        const targetLabel = targetNode ? getNodeLabel(targetNode) : edge.target

        result.add_evidence.push({
          key: `evidence_${edge.id}`,
          category: 'add_evidence',
          label: `${sourceLabel} → ${targetLabel}`,
          detail: 'No evidence',
          focus: { type: 'edge', id: edge.id, label: `${sourceLabel} → ${targetLabel}` },
          action: { label: 'Add', kind: 'add', targetId: edge.id, targetType: 'edge' },
        })
      }
    }

    // === STRENGTHEN CATEGORY ===
    // Only 2 options
    if (optionNodes.length === 2) {
      result.strengthen.push({
        key: 'only_2_options',
        category: 'strengthen',
        label: `Only ${optionNodes.length} options`,
        detail: 'Consider alternatives',
        bias: 'framing',
      })
    }

    // No constraint nodes (using risk as proxy for constraints)
    if (nodesByKind.risk.length === 0) {
      result.strengthen.push({
        key: 'no_risks',
        category: 'strengthen',
        label: 'No risks modelled',
        detail: 'What could go wrong?',
        bias: 'blind_spots',
      })
    }

    // No negative effects modelled
    const hasNegativeEdge = edges.some(hasNegativeStrength)
    if (!hasNegativeEdge && edges.length > 0) {
      result.strengthen.push({
        key: 'no_negative_effects',
        category: 'strengthen',
        label: 'No negative effects modelled',
        detail: 'All relationships are positive',
        bias: 'blind_spots',
      })
    }

    return result
  }, [nodes, edges, nodesByKind])

  // Total improvements
  const totalImprovements = useMemo(() => {
    return Object.values(improvementsByCategory).reduce((sum, items) => sum + items.length, 0)
  }, [improvementsByCategory])

  // Top 3 actions (priority order: Fix > Verify > Add evidence > Strengthen)
  const topActions = useMemo(() => {
    const allItems: ImprovementItem[] = []
    for (const category of ['fix', 'verify', 'add_evidence', 'strengthen'] as ImprovementCategory[]) {
      allItems.push(...improvementsByCategory[category])
    }
    // Already in priority order due to iteration order
    return allItems.slice(0, 3)
  }, [improvementsByCategory])

  // Evidence quality: count factors with confirmed source / total factors
  const evidenceQuality = useMemo<EvidenceQuality>(() => {
    const factors = nodesByKind.factor
    if (factors.length === 0) {
      return { level: 'low', ratio: 0 }
    }

    const confirmedCount = factors.filter(f => !isAiInferred(f)).length
    const ratio = confirmedCount / factors.length

    let level: EvidenceQualityLevel
    if (ratio >= 0.7) {
      level = 'high'
    } else if (ratio >= 0.4) {
      level = 'medium'
    } else {
      level = 'low'
    }

    return { level, ratio }
  }, [nodesByKind.factor])

  // Use existing readiness hook for canonical canRun/hasBlockers logic
  // This ensures we don't create a second source of truth for run-gating
  const existingReadiness = useExistingPreAnalysisData()

  // isReady and hasBlockers come from the existing hook to maintain consistency
  // with the existing PreAnalysisReadinessPanel's run-gating semantics
  const isReady = existingReadiness.canRun
  const hasBlockers = existingReadiness.hasBlockers
  // Blocker count from existing hook for consistent footer display
  const blockerCount = existingReadiness.allIssues.filter(i => i.severity === 'blocker').length

  // Success threshold
  const successThreshold = useMemo(() => {
    // Check goal node for threshold
    if (goalNode) {
      const data = goalNode.data as { success_threshold?: number; threshold?: number }
      return data?.success_threshold ?? data?.threshold ?? null
    }
    return null
  }, [goalNode])

  const isThresholdAutoDerived = useMemo(() => {
    if (goalNode) {
      const data = goalNode.data as { threshold_source?: string }
      return data?.threshold_source === 'auto' || data?.threshold_source === 'derived'
    }
    return false
  }, [goalNode])

  return {
    improvementsByCategory,
    totalImprovements,
    topActions,
    evidenceQuality,
    isReady,
    hasBlockers,
    blockerCount,
    nodesByKind,
    edgeCount: edges.length,
    goalNode,
    successThreshold,
    isThresholdAutoDerived,
  }
}

export default usePreAnalysisData
