/**
 * Adapters between LayoutPolicy and engine options
 */

import type { LayoutPolicy } from './policy'
import type { LayoutPreset, LayoutSpacing } from './types'

/**
 * Convert policy direction to appropriate preset
 */
export function policyToPreset(policy: LayoutPolicy): LayoutPreset {
  return policy.direction === 'TB' ? 'hierarchy' : 'flow'
}

/**
 * Convert policy spacing to engine spacing level
 */
export function policyToSpacing(policy: LayoutPolicy): LayoutSpacing {
  const px = Math.max(policy.spacing.x, policy.spacing.y)
  if (px < 80) return 'small'
  if (px < 140) return 'medium'
  return 'large'
}
