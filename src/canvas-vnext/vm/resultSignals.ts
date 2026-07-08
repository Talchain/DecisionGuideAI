// Narrow signal extraction from useResultsSectionData's outputs.
//
// This module is the SINGLE contract point with the #239-churned results
// types: it type-imports DriverItem/EvidenceGapItem (erased at runtime — no
// module execution, fence-safe) and maps them to the tiny shapes the card
// builders consume. If useResultsSectionData's fields drift, this file (and
// its spec) is where the break surfaces — never the builders.
//
// Honesty rule (UI-SEM-072 family): drivers without a matchedNodeId never
// generate node claims — they are dropped here, fail-closed.

import type { DriverItem, EvidenceGapItem } from '../../components/results/types'

export interface DriverSignal {
  nodeId: string
  influenceRank: number | null
  /** 0–1 producer confidence, when sent. */
  confidence: number | null
  /** A fragile edge backs this driver (switch probability present). */
  canFlipResult: boolean
}

export interface EvidenceGapSignal {
  nodeId: string
}

export function mapDriverSignals(drivers: readonly DriverItem[]): DriverSignal[] {
  const signals: DriverSignal[] = []
  for (const d of drivers) {
    if (!d.matchedNodeId) continue // unmatched ⇒ no node claim, fail-closed
    signals.push({
      nodeId: d.matchedNodeId,
      influenceRank: typeof d.influenceRank === 'number' ? d.influenceRank : null,
      confidence: typeof d.confidence === 'number' ? d.confidence : null,
      canFlipResult: typeof d.fragileEdgeInfo?.switchProbability === 'number',
    })
  }
  return signals
}

export function mapEvidenceGapSignals(gaps: readonly EvidenceGapItem[]): EvidenceGapSignal[] {
  const signals: EvidenceGapSignal[] = []
  for (const g of gaps) {
    const nodeId = g.targetNodeId ?? g.factorId
    if (!nodeId) continue
    signals.push({ nodeId })
  }
  return signals
}
