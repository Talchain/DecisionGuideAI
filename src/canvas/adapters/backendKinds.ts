/**
 * Backend Kind Mapping Shim
 *
 * Maps backend node.kind values to UI NodeType enum.
 * Provides safe fallbacks for unknown kinds to prevent runtime crashes.
 *
 * S1-MAP: Single source of truth for backend→UI kind translation
 * S1-UNK: Unknown kinds fallback to 'factor' with warning flag
 */

import type { NodeType } from '../domain/nodes'

/**
 * Backend kind strings that may come from API responses
 * Includes both exact matches and common variants (snake_case, etc.)
 */
type BackendKind = string

/**
 * Mapping table: backend kind → UI NodeType
 * Covers exact matches, snake_case variants, and legacy names
 */
const BACKEND_TO_UI_KIND: Record<string, NodeType> = {
  // Exact matches (canonical)
  'goal': 'goal',
  'decision': 'decision',
  'option': 'option',
  'factor': 'factor',
  'risk': 'risk',
  'outcome': 'outcome',

  // Snake_case variants
  'decision_node': 'decision',
  'outcome_node': 'outcome',
  'goal_node': 'goal',
  'option_node': 'option',
  'factor_node': 'factor',
  'risk_node': 'risk',

  // Legacy/alternative names
  'decision-binary': 'decision',
  'decision-probability': 'decision',
  'outcome-terminal': 'outcome',
  'input-categorical': 'factor',
  'input-continuous': 'factor',
  'transform-lookup': 'factor',

  // Common typos/variations (case-insensitive handled separately)
  'GOAL': 'goal',
  'DECISION': 'decision',
  'OPTION': 'option',
  'FACTOR': 'factor',
  'RISK': 'risk',
  'OUTCOME': 'outcome',
}

/**
 * Default fallback for unknown kinds
 * Factor is chosen as the safest generic node type
 */
const DEFAULT_KIND: NodeType = 'factor'

/**
 * Convert backend kind string to UI NodeType
 * Handles case-insensitive matching and common variants
 *
 * @param kind - Backend kind string (e.g., 'decision_node', 'GOAL', etc.)
 * @returns UI NodeType or DEFAULT_KIND if unknown
 */
export function toUiKind(kind: BackendKind | undefined | null): NodeType {
  if (!kind || typeof kind !== 'string') {
    return DEFAULT_KIND
  }

  // Try exact match first (case-sensitive for performance)
  if (BACKEND_TO_UI_KIND[kind]) {
    return BACKEND_TO_UI_KIND[kind]
  }

  // Try case-insensitive match
  const lowerKind = kind.toLowerCase()
  if (BACKEND_TO_UI_KIND[lowerKind]) {
    return BACKEND_TO_UI_KIND[lowerKind]
  }

  // No match found - return default
  return DEFAULT_KIND
}

/**
 * Check if a backend kind is recognized (not unknown)
 *
 * @param kind - Backend kind string
 * @returns true if kind maps to a known UI type
 */
export function isKnownKind(kind: BackendKind | undefined | null): boolean {
  if (!kind || typeof kind !== 'string') {
    return false
  }

  return (
    BACKEND_TO_UI_KIND[kind] !== undefined ||
    BACKEND_TO_UI_KIND[kind.toLowerCase()] !== undefined
  )
}

/**
 * Backend node structure (minimal required fields)
 */
export interface BackendNode {
  id: string
  label?: string
  kind?: string
  body?: string
  position?: { x: number; y: number }
  prior?: number
  utility?: number
  [key: string]: any // Allow additional fields
}

/**
 * UI node structure with coercion metadata
 */
export interface CoercedNode {
  id: string
  type: NodeType
  position: { x: number; y: number }
  data: {
    label: string
    type: NodeType
    body?: string
    kind?: NodeType
    prior?: number
    utility?: number
    unknownKind?: boolean  // Flag if original kind was unknown
    originalKind?: string  // Preserve original backend kind for debugging
    [key: string]: any
  }
}

/**
 * Coerce a backend node to a UI-compatible node
 * Applies kind mapping and adds metadata for unknown kinds
 *
 * S1-UNK: Sets unknownKind flag when backend kind is not recognized
 *
 * @param backendNode - Raw node from backend API
 * @param index - Optional index for default positioning
 * @returns Coerced node ready for ReactFlow canvas
 */
export function coerceNode(backendNode: BackendNode, index: number = 0): CoercedNode {
  const originalKind = backendNode.kind
  const uiKind = toUiKind(originalKind)
  const wasUnknown = originalKind !== undefined && !isKnownKind(originalKind)

  // Log unknown kinds for monitoring/debugging
  if (wasUnknown) {
    console.warn(
      `[backendKinds] Unknown kind "${originalKind}" for node "${backendNode.id}" mapped to "${uiKind}". ` +
      `This may indicate a new backend node type that needs UI support.`
    )
  }

  // Default position if not provided (grid layout)
  const defaultPosition = {
    x: 200 + (index % 3) * 250,
    y: 100 + Math.floor(index / 3) * 200
  }

  return {
    id: backendNode.id,
    type: uiKind,
    position: backendNode.position || defaultPosition,
    data: {
      label: backendNode.label || backendNode.id,
      type: uiKind,
      kind: uiKind,
      body: backendNode.body,
      prior: backendNode.prior,
      utility: backendNode.utility,
      ...(wasUnknown && {
        unknownKind: true,
        originalKind: originalKind
      })
    }
  }
}

/**
 * Batch coerce multiple backend nodes
 *
 * @param backendNodes - Array of backend nodes
 * @returns Array of coerced UI nodes
 */
export function coerceNodes(backendNodes: BackendNode[]): CoercedNode[] {
  return backendNodes.map((node, index) => coerceNode(node, index))
}

/**
 * Get human-readable description for unknown kind warning
 *
 * @param originalKind - The unknown backend kind string
 * @returns User-friendly warning message
 */
export function getUnknownKindWarning(originalKind: string): string {
  return `Unknown node type "${originalKind}" was mapped to a generic node for safe rendering.`
}
