/**
 * Graph Preflight Validator
 *
 * Client-side validation before sending graph to /v1/run or /v1/validate.
 * Uses limitsManager for dynamic constraint checking.
 *
 * Validates:
 * - Node/edge counts against limits
 * - Label/body length constraints
 * - Required fields (node IDs, edge source/target)
 * - Weight ranges
 *
 * Returns user-friendly violation messages with field references.
 */

import { limitsManager } from '../../adapters/plot/v1/limitsManager'
import type { UiGraph } from '../../types/plot'

/**
 * Validation violation with field reference for UI focus
 */
export interface ValidationViolation {
  code: 'LIMIT_EXCEEDED' | 'BAD_INPUT' | 'MISSING_FIELD'
  message: string
  field: string
  max?: number
  current?: number
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean
  violations: ValidationViolation[]
}

/**
 * Validate graph against limits and structural constraints
 *
 * @param graph - UI graph to validate
 * @returns Validation result with violations (empty if valid)
 */
export function validateGraph(graph: UiGraph): ValidationResult {
  const violations: ValidationViolation[] = []
  const limits = limitsManager.getLimits()

  // 1. Check node count
  if (graph.nodes.length > limits.nodes.max) {
    violations.push({
      code: 'LIMIT_EXCEEDED',
      message: `Graph has too many nodes. Limit: ${limits.nodes.max}, current: ${graph.nodes.length}.`,
      field: 'nodes',
      max: limits.nodes.max,
      current: graph.nodes.length,
    })
  }

  // 2. Check edge count
  if (graph.edges.length > limits.edges.max) {
    violations.push({
      code: 'LIMIT_EXCEEDED',
      message: `Graph has too many edges. Limit: ${limits.edges.max}, current: ${graph.edges.length}.`,
      field: 'edges',
      max: limits.edges.max,
      current: graph.edges.length,
    })
  }

  // 3. Validate nodes
  graph.nodes.forEach((node, idx) => {
    // Check ID exists
    if (!node.id || node.id.trim() === '') {
      violations.push({
        code: 'MISSING_FIELD',
        message: `Node at position ${idx + 1} is missing an ID.`,
        field: `nodes[${idx}].id`,
      })
    }

    // Check label length
    const label = node.label ?? node.data?.label
    if (label && label.length > limits.label.max) {
      violations.push({
        code: 'LIMIT_EXCEEDED',
        message: `Node "${node.id}" label is too long. Limit: ${limits.label.max} characters, current: ${label.length}.`,
        field: `nodes[${idx}].label`,
        max: limits.label.max,
        current: label.length,
      })
    }

    // Check body length
    const body = node.data?.body
    if (body && body.length > limits.body.max) {
      violations.push({
        code: 'LIMIT_EXCEEDED',
        message: `Node "${node.id}" description is too long. Limit: ${limits.body.max} characters, current: ${body.length}.`,
        field: `nodes[${idx}].body`,
        max: limits.body.max,
        current: body.length,
      })
    }
  })

  // 4. Validate edges
  graph.edges.forEach((edge, idx) => {
    // Check source exists
    if (!edge.source || edge.source.trim() === '') {
      violations.push({
        code: 'MISSING_FIELD',
        message: `Edge at position ${idx + 1} is missing a source node.`,
        field: `edges[${idx}].source`,
      })
    }

    // Check target exists
    if (!edge.target || edge.target.trim() === '') {
      violations.push({
        code: 'MISSING_FIELD',
        message: `Edge at position ${idx + 1} is missing a target node.`,
        field: `edges[${idx}].target`,
      })
    }

    // Check weight range (if present)
    const weight = edge.data?.weight
    if (weight != null) {
      if (!Number.isFinite(weight)) {
        violations.push({
          code: 'BAD_INPUT',
          message: `Edge "${edge.source} → ${edge.target}" has invalid weight (must be a finite number).`,
          field: `edges[${idx}].weight`,
        })
      } else if (Math.abs(weight) > 100) {
        // Allow ±1 or ±100 range (will be normalized by mapper)
        violations.push({
          code: 'BAD_INPUT',
          message: `Edge "${edge.source} → ${edge.target}" weight out of range (${weight}). Must be between -100 and 100.`,
          field: `edges[${idx}].weight`,
        })
      }
    }
  })

  return {
    valid: violations.length === 0,
    violations,
  }
}

/**
 * Quick check: does graph pass basic limits?
 * Useful for enabling/disabling run buttons without full validation.
 */
export function isWithinLimits(nodeCount: number, edgeCount: number): boolean {
  const limits = limitsManager.getLimits()
  return nodeCount <= limits.nodes.max && edgeCount <= limits.edges.max
}

/**
 * Get current limits (for displaying in UI)
 */
export function getCurrentLimits() {
  return limitsManager.getLimits()
}
