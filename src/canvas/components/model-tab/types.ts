/**
 * Shared types for the model-tab component suite.
 */

import type { Node, Edge } from '@xyflow/react'
import type { MappedRobustness } from '../../../lib/mappers/types'
import type { CritiqueItemV1 } from '../../../adapters/plot/types'
import type { CeeQualityDimensions } from '../../store'

export interface ObservedState {
  value?: number
  raw_value?: number
  baseline?: number
  unit?: string
  source?: string
  cap?: number
  uncertainty_drivers?: string[]
  range_derivation_source?: string
}

/** Factor influence data keyed by node ID — from PLoT enrichment factor_sensitivity */
export type FactorInfluenceMap = Map<string, number>

/** Context provided by "Show full detail" toggle */
export interface DetailContext {
  showDetail: boolean
}

export interface ModelTabProps {
  showDebug: boolean
  hasDiagnostics: boolean
  diagnostics: unknown
  hasTrim: boolean
  effectiveCorrelationId: string | null | undefined
  correlationMismatch: boolean
  correlationIdHeader: string | null | undefined
  nodes: Node[]
  edges: Edge[]
  robustness: MappedRobustness | null
  critique?: CritiqueItemV1[] | null
  /** Factor influence map from PLoT — keyed by node ID, value is 0–1 sensitivity score */
  factorInfluence?: FactorInfluenceMap
  /** Trigger analysis re-run (from OutputsDock handleRunAnalysis) */
  onReanalyse?: () => void
  /** CEE quality dimensions — from ceeQuality store field */
  ceeQuality?: CeeQualityDimensions | null
}
