/**
 * Single source of truth for fields that are only shown when expertMode === true.
 * Keep this list aligned with the Analysis tab brief §Task 3 — any render site
 * that surfaces one of these names must gate on both `expertMode` AND this check.
 */
export type ExpertField =
  | 'nSamples'
  | 'fragileEdgeCount'
  | 'seed'
  | 'hash'
  | 'graphSize'
  | 'elasticity'
  | 'attributionStability'
  | 'rankFlipRate'
  | 'eValue'
  | 'evpiBasisPoints'

const EXPERT_FIELDS: ReadonlySet<ExpertField> = new Set<ExpertField>([
  'nSamples',
  'fragileEdgeCount',
  'seed',
  'hash',
  'graphSize',
  'elasticity',
  'attributionStability',
  'rankFlipRate',
  'eValue',
  'evpiBasisPoints',
])

export function isExpertField(name: string): name is ExpertField {
  return EXPERT_FIELDS.has(name as ExpertField)
}
