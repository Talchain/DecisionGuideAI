/**
 * Reasoning tab — "Where these checks come from".
 *
 * The rendering half of `analysisNew/biasGrounding.ts`; the reachability
 * derivation, the payload witnesses and the register rules live in that
 * module's header and are not restated here.
 */

import type { BiasGroundingItem } from '../biasGrounding'

export interface BiasGroundingProps {
  items: readonly BiasGroundingItem[]
  testId?: string
}

export function BiasGrounding(_props: BiasGroundingProps) {
  return null
}
