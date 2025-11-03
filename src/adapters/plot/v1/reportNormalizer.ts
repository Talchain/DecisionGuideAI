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
import { getRunIdFromResponse } from './getRunId'

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

  // Extract hash (single source of truth - handles fallback)
  const hash = getRunIdFromResponse(body)

  // Extract results (multiple envelope formats)
  const results = body?.results ?? body?.result ?? {}
  const summary = results?.summary

  // Helper: extract number from value that might be {outcome: number} or just number
  const extractValue = (val: any): number | undefined => {
    if (typeof val === 'number') return val
    if (val && typeof val.outcome === 'number') return val.outcome
    return undefined
  }

  // Conservative: results.conservative.outcome or results.conservative or summary.conservative or summary.p10
  const conservative = extractValue(results.conservative) ?? summary?.conservative ?? summary?.p10

  // Most likely: results.most_likely.outcome or results.likely or summary.likely or summary.p50
  // Note: v1 API uses 'likely', some responses use 'most_likely'
  const mostLikely = extractValue(results.most_likely) ?? extractValue(results.likely) ?? summary?.likely ?? summary?.p50

  // Optimistic: results.optimistic.outcome or results.optimistic or summary.optimistic or summary.p90
  const optimistic = extractValue(results.optimistic) ?? summary?.optimistic ?? summary?.p90

  // Units: results.units or summary.units
  const units = results.units ?? summary?.units

  // Confidence and explanation from top-level fields
  const confidence = body?.confidence
  const explanation = body?.explanation

  // Extract drivers with polarity and strength
  const rawDrivers = body?.explain_delta?.top_drivers ?? []
  const drivers = rawDrivers.map(d => {
    const impact = d.impact ?? 0

    return {
      label: d.label || d.node_id || d.edge_id || 'Unknown',
      polarity: (impact > 0 ? 'up' : impact < 0 ? 'down' : 'neutral') as 'up' | 'down' | 'neutral',
      strength: (Math.abs(impact) > 0.7 ? 'high' : Math.abs(impact) > 0.3 ? 'medium' : 'low') as 'low' | 'medium' | 'high',
      kind: d.kind,
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
