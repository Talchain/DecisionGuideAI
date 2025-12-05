/**
 * Report Normalizer
 *
 * Normalizes different API response envelope formats into a consistent UI model.
 *
 * Handles variations:
 * - results.{conservative,most_likely,optimistic} (current)
 * - result.summary.{conservative,likely,optimistic} (older)
 * - meta.seed vs model_card.seed
 * - model_card.response_hash vs response_hash
 */

import type { RunResponse } from '../../../types/plot'

export interface NormalizedReport {
  conservative?: number
  mostLikely?: number
  optimistic?: number
  units?: string
  confidence?: number
  explanation?: string
  drivers: Array<{
    label: string
    polarity: 'up' | 'down' | 'neutral'
    strength: 'low' | 'medium' | 'high'
    kind?: 'node' | 'edge'
    node_id?: string
    edge_id?: string
  }>
  seed?: number
  hash?: string
}

/**
 * Normalize API response to consistent UI report model
 */
export function toUiReport(body: RunResponse): NormalizedReport {
  // Extract seed (multiple locations)
  const seed = body?.meta?.seed ?? body?.model_card?.seed

  // Extract hash (multiple locations)
  const hash = body?.model_card?.response_hash ?? body?.response_hash

  // Extract results (multiple envelope formats)
  const results = body?.results ?? body?.result ?? {}
  const summary = results?.summary

  // Conservative: results.conservative or result.summary.conservative
  const conservative = results.conservative ?? summary?.conservative

  // Most likely: results.most_likely, results.likely, or result.summary.likely
  // Note: v1 API uses 'likely', some responses use 'most_likely'
  const mostLikely = results.most_likely ?? results.likely ?? summary?.likely

  // Optimistic: results.optimistic or result.summary.optimistic
  const optimistic = results.optimistic ?? summary?.optimistic

  // Units: results.units or results.summary.units or result.summary.units
  const units = results.units ?? summary?.units

  // Confidence and explanation from top-level fields
  const confidence = body?.confidence
  const explanation = body?.explanation

  // Extract drivers with polarity and strength
  // API v1 sends: { node_id, node_label, contribution, sign }
  // Normalize to: { label, polarity, strength, kind, node_id }
  const rawDrivers = body?.explain_delta?.top_drivers ?? []
  const drivers = rawDrivers.map(d => {
    // Handle both old (impact) and new (contribution + sign) formats
    let impact = d.impact ?? 0
    if (d.contribution !== undefined && d.sign !== undefined) {
      // Convert contribution (0-100) and sign to signed impact (-1 to 1)
      const normalizedContribution = Math.min(d.contribution, 100) / 100
      impact = d.sign === '-' ? -normalizedContribution : normalizedContribution
    }

    // Use node_label (API v1) or label (older format) for display
    const label = d.node_label || d.label || d.node_id || d.edge_id || 'Unknown'

    return {
      label,
      polarity: (impact > 0 ? 'up' : impact < 0 ? 'down' : 'neutral') as 'up' | 'down' | 'neutral',
      strength: (Math.abs(impact) > 0.7 ? 'high' : Math.abs(impact) > 0.3 ? 'medium' : 'low') as 'low' | 'medium' | 'high',
      kind: d.kind ?? 'node',
      node_id: d.node_id,
      edge_id: d.edge_id,
    }
  })

  return {
    conservative,
    mostLikely,
    optimistic,
    units,
    confidence,
    explanation,
    drivers,
    seed,
    hash,
  }
}
