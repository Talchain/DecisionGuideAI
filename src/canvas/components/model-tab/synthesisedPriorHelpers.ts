/**
 * Helper to extract synthesised prior ranges from CEE pipeline trace repair data.
 *
 * Parses deterministic_repairs in ceePipelineTrace to find synthesised priors.
 * Returns a map from node ID → { rangeMin, rangeMax }.
 */

import type { Node } from '@xyflow/react'
import type { SynthesisedPrior } from './FactorsSection'

export function buildSynthesisedPriorMap(
  ceePipelineTrace: unknown,
  nodes: Node[],
): Map<string, SynthesisedPrior> {
  const map = new Map<string, SynthesisedPrior>()
  if (!ceePipelineTrace || typeof ceePipelineTrace !== 'object') return map

  const trace = ceePipelineTrace as Record<string, unknown>
  const repairSummary = trace.repair_summary ?? trace.repair
  if (!repairSummary || typeof repairSummary !== 'object') return map

  const summary = repairSummary as Record<string, unknown>
  const repairs = summary.deterministic_repairs
  if (!Array.isArray(repairs)) return map

  // Build label→id lookup for matching
  const labelToId = new Map<string, string>()
  for (const n of nodes) {
    const label = String((n.data as Record<string, unknown>)?.label ?? '').toLowerCase()
    if (label) labelToId.set(label, n.id)
  }

  for (const r of repairs) {
    if (!r || typeof r !== 'object') continue
    const repair = r as Record<string, unknown>

    // Structured fields (if CEE provides them)
    if (repair.node_id && repair.synthesised_range && Array.isArray(repair.synthesised_range)) {
      const [min, max] = repair.synthesised_range as number[]
      if (typeof min === 'number' && typeof max === 'number') {
        map.set(String(repair.node_id), { rangeMin: min, rangeMax: max })
        continue
      }
    }

    // Fallback: parse from action text
    const action = typeof repair.action === 'string' ? repair.action : ''
    const match = action.match(/synthesised prior\s*\[([^\]]+)\]/i)
    if (!match) continue
    const parts = match[1].split(',').map(s => parseFloat(s.trim()))
    if (parts.length !== 2 || parts.some(isNaN)) continue

    // Try to match by node_id first, then by quoted label in action text
    let nodeId = repair.node_id ? String(repair.node_id) : undefined
    if (!nodeId) {
      const labelMatch = action.match(/"([^"]+)"/)
      if (labelMatch) {
        nodeId = labelToId.get(labelMatch[1].toLowerCase())
      }
    }
    if (nodeId) {
      map.set(nodeId, { rangeMin: parts[0], rangeMax: parts[1] })
    }
  }

  return map
}
