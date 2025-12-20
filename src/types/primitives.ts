/**
 * Shared Primitives for Phase 1 P0 Implementation
 *
 * Core types used across the UI workstream for model-grounded UX:
 * - ModelAction: Graph edits proposed by CEE or triggered by user
 * - Highlight: Visual emphasis on nodes/edges for coaching
 * - ProvenanceItem: Tracks origin and confidence of information
 *
 * These types form the contract between CEE responses and UI rendering.
 */

// =============================================================================
// Model Action Types
// =============================================================================

/**
 * Operation types for graph modifications
 * Maps to atomic graph edit operations
 */
export type ModelActionOp =
  | 'add_node'
  | 'add_edge'
  | 'update_node'
  | 'update_edge'
  | 'delete_node'
  | 'delete_edge'

/**
 * ModelAction - Represents a proposed graph edit from CEE
 *
 * Used by:
 * - /assist/v1/ask response suggested_actions[]
 * - useModelActionApply hook to apply actions to canvas
 * - One-tap improvement flows
 *
 * @example
 * {
 *   action_id: 'act_001',
 *   op: 'add_node',
 *   payload: { type: 'factor', label: 'Market conditions' },
 *   reason_code: 'MISSING_FACTOR',
 *   label: 'Add missing market factor'
 * }
 */
export interface ModelAction {
  /** Unique identifier for this action (for tracking/analytics) */
  action_id: string

  /** The type of graph operation to perform */
  op: ModelActionOp

  /** Target element ID (required for update/delete operations) */
  target_id?: string

  /** Action-specific data (node/edge properties to set) */
  payload: Record<string, unknown>

  /** Machine-readable reason code for analytics */
  reason_code?: string

  /** Human-readable label for UI display */
  label?: string
}

/**
 * Result of applying a ModelAction
 * Used by useModelActionApply to report success/failure
 */
export interface ModelActionResult {
  success: boolean
  action_id: string
  created_id?: string  // ID of newly created node/edge (for add operations)
  error?: string
}

// =============================================================================
// Highlight Types
// =============================================================================

/**
 * Visual emphasis style for highlights
 * - primary: Main coaching focus (info-500 blue)
 * - secondary: Supporting context (gray-400)
 * - warning: Attention needed (warning-500 amber)
 * - error: Critical issue (error-500 red)
 */
export type HighlightStyle = 'primary' | 'secondary' | 'warning' | 'error'

/**
 * Highlight target type
 * - node: Single or multiple nodes
 * - edge: Single or multiple edges
 * - path: Sequence of connected nodes/edges
 */
export type HighlightType = 'node' | 'edge' | 'path'

/**
 * Highlight - Visual emphasis on canvas elements
 *
 * Used by:
 * - useHighlightDispatch to manage highlight state
 * - HighlightLayer to render visual overlays
 * - CEE coaching responses to focus attention
 *
 * @example
 * {
 *   type: 'node',
 *   ids: ['node_001', 'node_002'],
 *   style: 'warning',
 *   label: 'Missing evidence'
 * }
 */
export interface Highlight {
  /** Type of element(s) to highlight */
  type: HighlightType

  /** Element IDs to highlight */
  ids: string[]

  /** Visual style to apply (defaults to 'primary') */
  style?: HighlightStyle

  /** Optional label shown on highlight overlay */
  label?: string

  /** Optional timeout in ms to auto-clear (0 = persistent) */
  timeout_ms?: number
}

/**
 * HighlightGroup - Collection of related highlights
 * Used for complex multi-element emphasis (e.g., showing a path)
 */
export interface HighlightGroup {
  /** Unique identifier for this group */
  group_id: string

  /** Individual highlights in this group */
  highlights: Highlight[]

  /** Optional shared label for the group */
  label?: string
}

// =============================================================================
// Provenance Types
// =============================================================================

/**
 * Source categories for provenance tracking
 * - brief: User's initial problem statement
 * - graph: Extracted from existing graph structure
 * - market_context: External market/domain data
 * - validator: Graph validation rules
 * - engine: CEE/PLoT analysis engine
 * - user_edit: Direct user modification
 * - document: Uploaded document evidence
 */
export type ProvenanceSource =
  | 'brief'
  | 'graph'
  | 'market_context'
  | 'validator'
  | 'engine'
  | 'user_edit'
  | 'document'

/**
 * Confidence level for provenance items
 * - high: Strong evidence, verified
 * - medium: Reasonable confidence, some uncertainty
 * - low: Weak evidence, needs verification
 */
export type ProvenanceConfidence = 'high' | 'medium' | 'low'

/**
 * ProvenanceItem - Tracks origin and confidence of information
 *
 * Used by:
 * - CEE responses to explain reasoning
 * - Provenance hub to show evidence
 * - Trust indicators in UI
 *
 * @example
 * {
 *   source: 'document',
 *   confidence: 'high',
 *   note: 'Market size from Q3 report, page 12',
 *   references: { node_ids: ['node_001'] }
 * }
 */
export interface ProvenanceItem {
  /** Category of information source */
  source: ProvenanceSource

  /** Confidence level in this information */
  confidence: ProvenanceConfidence

  /** Human-readable explanation */
  note: string

  /** Graph element references */
  references?: {
    node_ids?: string[]
    edge_ids?: string[]
  }

  /** Optional document/citation reference */
  document_id?: string

  /** Optional timestamp (ISO string) */
  timestamp?: string
}

// =============================================================================
// CEE Ask Response Types (for /assist/v1/ask)
// =============================================================================

/**
 * Response from /assist/v1/ask endpoint
 * Single unified structure for all coaching interactions
 */
export interface CEEAskResponse {
  /** Natural language coaching response */
  text: string

  /** Suggested graph actions (optional) */
  suggested_actions?: ModelAction[]

  /** Elements to highlight on canvas (optional) */
  highlights?: Highlight[]

  /** Provenance for response (optional) */
  provenance?: ProvenanceItem[]

  /** Confidence score 0-1 (optional) */
  confidence?: number
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard for ModelAction
 */
export function isModelAction(value: unknown): value is ModelAction {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  return (
    typeof obj.action_id === 'string' &&
    typeof obj.op === 'string' &&
    ['add_node', 'add_edge', 'update_node', 'update_edge', 'delete_node', 'delete_edge'].includes(obj.op as string) &&
    typeof obj.payload === 'object' &&
    obj.payload !== null
  )
}

/**
 * Type guard for Highlight
 */
export function isHighlight(value: unknown): value is Highlight {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  return (
    typeof obj.type === 'string' &&
    ['node', 'edge', 'path'].includes(obj.type as string) &&
    Array.isArray(obj.ids) &&
    obj.ids.every(id => typeof id === 'string')
  )
}

/**
 * Type guard for ProvenanceItem
 */
export function isProvenanceItem(value: unknown): value is ProvenanceItem {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  return (
    typeof obj.source === 'string' &&
    ['brief', 'graph', 'market_context', 'validator', 'engine', 'user_edit', 'document'].includes(obj.source as string) &&
    typeof obj.confidence === 'string' &&
    ['high', 'medium', 'low'].includes(obj.confidence as string) &&
    typeof obj.note === 'string'
  )
}

/**
 * Type guard for CEEAskResponse
 */
export function isCEEAskResponse(value: unknown): value is CEEAskResponse {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  return typeof obj.text === 'string'
}
