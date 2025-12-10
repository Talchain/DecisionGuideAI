/**
 * Threshold Identification Utility
 *
 * Identifies critical thresholds/tipping points where small input changes
 * cause large outcome shifts. Used for sensitivity analysis display.
 *
 * Sources:
 * 1. Edge function types (threshold, s-curve with steep midpoints)
 * 2. High-sensitivity nodes from conformal predictions
 * 3. CEE suggestions (when available)
 */

import type { Edge, Node } from '@xyflow/react'
import type { ISLConformalPrediction } from '../../adapters/isl/types'

export interface IdentifiedThreshold {
  /** Unique identifier */
  id: string
  /** Type of threshold */
  type: 'edge_function' | 'sensitivity' | 'cee_suggested'
  /** Human-readable label */
  label: string
  /** Description of the threshold effect */
  description: string
  /** The threshold value (0-1 for probabilities, or raw value) */
  thresholdValue: number
  /** What happens below threshold */
  belowEffect: string
  /** What happens above threshold */
  aboveEffect: string
  /** Confidence in this threshold identification */
  confidence: 'high' | 'medium' | 'low'
  /** Source node or edge ID for canvas highlighting */
  sourceId?: string
  /** Source type for focus */
  sourceType?: 'node' | 'edge'
  /** Impact magnitude (how much outcome changes at threshold) */
  impactMagnitude?: 'high' | 'medium' | 'low'
  /** Provenance tracking */
  provenance: 'graph_analysis' | 'sensitivity_analysis' | 'cee'
}

export interface ThresholdIdentificationResult {
  /** All identified thresholds sorted by importance */
  thresholds: IdentifiedThreshold[]
  /** Summary message for empty state */
  summary: string
  /** Whether CEE was used for suggestions */
  ceeEnhanced: boolean
}

/**
 * Identifies thresholds from edge function types
 * Threshold and S-curve functions have explicit tipping points
 */
export function identifyEdgeFunctionThresholds(
  edges: Edge[],
  nodes: Node[]
): IdentifiedThreshold[] {
  const thresholds: IdentifiedThreshold[] = []

  // Build node label map for readable descriptions
  const nodeLabelMap = new Map<string, string>()
  for (const node of nodes) {
    const label = (node.data as { label?: string })?.label || node.id
    nodeLabelMap.set(node.id, label)
  }

  for (const edge of edges) {
    const functionType = (edge.data as { functionType?: string })?.functionType
    const params = (edge.data as { functionParams?: Record<string, number> })?.functionParams

    const sourceLabel = nodeLabelMap.get(edge.source) || edge.source
    const targetLabel = nodeLabelMap.get(edge.target) || edge.target

    if (functionType === 'threshold' && params?.threshold !== undefined) {
      const thresholdPct = Math.round(params.threshold * 100)
      thresholds.push({
        id: `edge-threshold-${edge.id}`,
        type: 'edge_function',
        label: `${sourceLabel} → ${targetLabel}`,
        description: `Step change at ${thresholdPct}% threshold`,
        thresholdValue: params.threshold,
        belowEffect: `No effect on ${targetLabel}`,
        aboveEffect: `Full effect on ${targetLabel}`,
        confidence: 'high',
        sourceId: edge.id,
        sourceType: 'edge',
        impactMagnitude: 'high',
        provenance: 'graph_analysis',
      })
    }

    if (functionType === 's_curve' && params?.midpoint !== undefined) {
      const midpointPct = Math.round(params.midpoint * 100)
      const steepness = params.steepness ?? 5
      const isSharp = steepness > 7

      thresholds.push({
        id: `edge-scurve-${edge.id}`,
        type: 'edge_function',
        label: `${sourceLabel} → ${targetLabel}`,
        description: `S-curve transition around ${midpointPct}%`,
        thresholdValue: params.midpoint,
        belowEffect: `Gradual effect on ${targetLabel}`,
        aboveEffect: `Rapid transition then plateau`,
        confidence: isSharp ? 'high' : 'medium',
        sourceId: edge.id,
        sourceType: 'edge',
        impactMagnitude: isSharp ? 'high' : 'medium',
        provenance: 'graph_analysis',
      })
    }
  }

  return thresholds
}

/**
 * Identifies high-sensitivity nodes from conformal predictions
 * Nodes with narrow confidence intervals are more sensitive to changes
 */
export function identifySensitivityThresholds(
  predictions: ISLConformalPrediction[],
  nodes: Node[]
): IdentifiedThreshold[] {
  const thresholds: IdentifiedThreshold[] = []

  // Build node label map
  const nodeLabelMap = new Map<string, string>()
  for (const node of nodes) {
    const label = (node.data as { label?: string })?.label || node.id
    nodeLabelMap.set(node.id, label)
  }

  // Sort predictions by sensitivity (narrow interval = high sensitivity)
  const sortedPredictions = [...predictions].sort((a, b) => {
    const widthA = (a.confidence_interval?.upper ?? 1) - (a.confidence_interval?.lower ?? 0)
    const widthB = (b.confidence_interval?.upper ?? 1) - (b.confidence_interval?.lower ?? 0)
    return widthA - widthB // Narrower = more sensitive = higher priority
  })

  // Take top 3 most sensitive nodes
  for (const pred of sortedPredictions.slice(0, 3)) {
    if (!pred.confidence_interval) continue

    const intervalWidth = pred.confidence_interval.upper - pred.confidence_interval.lower
    const midpoint = (pred.confidence_interval.upper + pred.confidence_interval.lower) / 2

    // Only flag as threshold if interval is reasonably narrow (< 30%)
    if (intervalWidth > 0.3) continue

    const nodeLabel = nodeLabelMap.get(pred.node_id) || pred.node_id
    const isVeryNarrow = intervalWidth < 0.15

    thresholds.push({
      id: `sensitivity-${pred.node_id}`,
      type: 'sensitivity',
      label: nodeLabel,
      description: `High sensitivity: small changes have large effects`,
      thresholdValue: midpoint,
      belowEffect: `Below ${Math.round(pred.confidence_interval.lower * 100)}%: lower outcomes`,
      aboveEffect: `Above ${Math.round(pred.confidence_interval.upper * 100)}%: higher outcomes`,
      confidence: pred.calibration_quality === 'excellent' || pred.calibration_quality === 'good'
        ? 'high'
        : pred.calibration_quality === 'fair'
        ? 'medium'
        : 'low',
      sourceId: pred.node_id,
      sourceType: 'node',
      impactMagnitude: isVeryNarrow ? 'high' : 'medium',
      provenance: 'sensitivity_analysis',
    })
  }

  return thresholds
}

/**
 * Merges and deduplicates thresholds from multiple sources
 */
export function mergeThresholds(
  ...sources: IdentifiedThreshold[][]
): IdentifiedThreshold[] {
  const all = sources.flat()

  // Dedupe by sourceId (prefer higher confidence)
  const bySourceId = new Map<string, IdentifiedThreshold>()
  for (const t of all) {
    if (!t.sourceId) {
      bySourceId.set(t.id, t)
      continue
    }
    const existing = bySourceId.get(t.sourceId)
    if (!existing) {
      bySourceId.set(t.sourceId, t)
    } else {
      // Keep higher confidence
      const confOrder = { high: 3, medium: 2, low: 1 }
      if ((confOrder[t.confidence] || 0) > (confOrder[existing.confidence] || 0)) {
        bySourceId.set(t.sourceId, t)
      }
    }
  }

  // Sort by impact magnitude, then confidence
  const result = Array.from(bySourceId.values())
  result.sort((a, b) => {
    const impactOrder = { high: 3, medium: 2, low: 1 }
    const impactDiff = (impactOrder[b.impactMagnitude || 'low'] || 0) -
                       (impactOrder[a.impactMagnitude || 'low'] || 0)
    if (impactDiff !== 0) return impactDiff

    const confOrder = { high: 3, medium: 2, low: 1 }
    return (confOrder[b.confidence] || 0) - (confOrder[a.confidence] || 0)
  })

  return result
}

/**
 * Main function to identify all thresholds from analysis
 */
export function identifyThresholds(
  nodes: Node[],
  edges: Edge[],
  conformalPredictions?: ISLConformalPrediction[]
): ThresholdIdentificationResult {
  const edgeThresholds = identifyEdgeFunctionThresholds(edges, nodes)
  const sensitivityThresholds = conformalPredictions
    ? identifySensitivityThresholds(conformalPredictions, nodes)
    : []

  const thresholds = mergeThresholds(edgeThresholds, sensitivityThresholds)

  // Generate summary
  let summary: string
  if (thresholds.length === 0) {
    summary = 'No critical thresholds identified in the current model'
  } else if (thresholds.length === 1) {
    summary = '1 critical threshold identified'
  } else {
    summary = `${thresholds.length} critical thresholds identified`
  }

  return {
    thresholds,
    summary,
    ceeEnhanced: false,
  }
}

/**
 * Formats threshold value for display
 */
export function formatThresholdValue(value: number, units?: 'percent' | 'currency' | 'count'): string {
  if (units === 'currency') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
  }
  if (units === 'percent' || value <= 1) {
    return `${Math.round(value * 100)}%`
  }
  return value.toLocaleString()
}
