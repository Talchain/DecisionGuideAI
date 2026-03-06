/**
 * Inspector v2 — shared types
 *
 * Editing contract: option interventions vs factor baselines
 *
 * Factor `observed_state.value` = baseline. Owned by factor inspector.
 * Option `interventions[factor_id]` = override. Owned by option inspector.
 * These are independent writes. Neither edits the other's value.
 *
 * Factor inspector shows: baseline (editable) + which options override it (read-only)
 * Option inspector shows: baseline (read-only) + override (editable) + change delta
 *
 * Undo: each write is an independent history entry via pushToHistory()
 */

import type { ReactNode } from 'react'
import type { Node, Edge } from '@xyflow/react'
import type { NodeType, FactorCategory } from '../../domain/nodes'

// ─── Analysis state ────────────────────────────────────────────────
/** Each panel section checks this to determine rendering */
export type AnalysisState = 'none' | 'partial' | 'stale' | 'current'

// ─── Panel props ───────────────────────────────────────────────────
export interface InspectorPanelProps {
  nodeId?: string
  edgeId?: string
  techMode: boolean
  onClose: () => void
  /** Navigate selection to a different node/edge */
  onNavigate: (id: string) => void
}

// ─── Shell props ───────────────────────────────────────────────────
export interface InspectorShellProps {
  /** 3px coloured top bar colour (CSS value) */
  topBarColor: string
  /** Node type for shape indicator */
  nodeKind?: NodeType
  /** Editable label */
  label: string
  onLabelChange?: (value: string) => void
  /** Type pill text (user-facing, from string table) */
  typePill: string
  /** Type pill border colour (CSS class like 'border-goal/30') */
  typePillColor?: string
  /** Confidence badge — optional, not all panels show this */
  confidenceBadge?: ReactNode
  /** Tech detail toggle */
  techMode: boolean
  onTechToggleChange: (v: boolean) => void
  /** Close inspector */
  onClose: () => void
  children: ReactNode
}

// ─── Connection data ───────────────────────────────────────────────
export interface ConnectionData {
  edge: Edge
  node: Node
  nodeKind: NodeType
  label: string
  strength?: { weight: number; direction: 'positive' | 'negative' }
}
