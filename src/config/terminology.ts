/**
 * Terminology Configuration
 *
 * Maps technical terms to user-friendly labels for Phase 1A.2 dual terminology.
 * Preserves technical terms in tooltips for transparency and learning.
 */

export interface TerminologyMapping {
  userLabel: string // Simple, user-friendly label
  technicalTerm: string // Original technical term
  description: string // Short explanation for tooltips
}

/**
 * Edge property terminology mappings
 */
export const EDGE_TERMINOLOGY: Record<string, TerminologyMapping> = {
  belief: {
    userLabel: 'Confidence',
    technicalTerm: 'Belief (epistemic uncertainty)',
    description: 'How certain you are about this relationship',
  },
  weight: {
    userLabel: 'Influence',
    technicalTerm: 'Weight',
    description: 'How strongly this factor affects the outcome',
  },
  provenance: {
    userLabel: 'Source',
    technicalTerm: 'Provenance',
    description: 'Where this information came from',
  },
}

/**
 * Node property terminology mappings (for future use)
 */
export const NODE_TERMINOLOGY: Record<string, TerminologyMapping> = {
  // Reserved for future node-level terminology changes
}

/**
 * Get user-friendly label for a technical term
 */
export function getUserLabel(technicalKey: string): string {
  return EDGE_TERMINOLOGY[technicalKey]?.userLabel ?? technicalKey
}

/**
 * Get technical term for a user-friendly key
 */
export function getTechnicalTerm(technicalKey: string): string {
  return EDGE_TERMINOLOGY[technicalKey]?.technicalTerm ?? technicalKey
}

/**
 * Get description for a technical term
 */
export function getDescription(technicalKey: string): string {
  return EDGE_TERMINOLOGY[technicalKey]?.description ?? ''
}
