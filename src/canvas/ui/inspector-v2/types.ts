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

import type React from 'react'
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
  /**
   * ⭐⭐ THE PANEL OWNS ITS OWN AUTHORITY BOUNDARY, AND THE ROUTER HAS NOT
   * WRAPPED IT.
   *
   * Present only for panels in `InspectorRouter`'s `AUTHORITY_OWNING_PANELS`.
   * For every other panel this prop is absent and the Router's outer
   * `<fieldset disabled>` is unchanged.
   *
   * ⛔ IT IS A DUTY, NOT A PERMISSION. A panel receiving `readOnly` must place
   * every control that reaches a mutation behind its own disabled fieldset — it
   * may NEVER read this as licence to enable a write. What it buys is the
   * ability to leave NON-writing controls alive: navigation, disclosure and
   * coaching, which the blanket wrap was disabling for a reason that was never
   * about them.
   */
  readOnly?: boolean
}

// ─── Drag handlers (from InspectorModal) ──────────────────────────
export interface DragHandlers {
  onPointerDown: (e: React.PointerEvent) => void
  onPointerMove: (e: React.PointerEvent) => void
  onPointerUp: (e: React.PointerEvent) => void
  onPointerCancel: (e: React.PointerEvent) => void
  isDragging: boolean
}

// ─── Shell props ───────────────────────────────────────────────────
export interface InspectorShellProps {
  /** Node ID for rationale lookup (optional — edges don't have rationales) */
  nodeId?: string
  /** Editable label */
  label: string
  onLabelChange?: (value: string) => void
  /**
   * The KIND, in words (from the string table). v3.1: a 10px muted label —
   * the shell no longer takes a kind colour, a shape or a confidence badge.
   */
  typePill: string
  /** Tech detail toggle */
  techMode: boolean
  onTechToggleChange: (v: boolean) => void
  /** Close inspector */
  onClose: () => void
  /** Drag handlers from InspectorModal — makes the header draggable */
  dragHandlers?: DragHandlers
  /**
   * R5 quick actions, rendered at the TOP of the panel body above every group.
   * Supplied by InspectorRouter, which knows the element's identity.
   */
  quickActions?: ReactNode
  /**
   * v3.1 `.inspector-note` — the pane's quiet save truth, rendered LAST in the
   * body (after the technical-detail toggle). Supplied by InspectorRouter.
   */
  footerNote?: ReactNode
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
