import type { LucideIcon } from 'lucide-react'
import { edgeValueSource, type EdgeValueSource } from './edgeValueProvenance'
import { VALUE_PROVENANCE_ICON } from './valueProvenanceIcon'
import { VALUE_PROVENANCE_LABEL, type ValueProvenanceKind } from './valueProvenance'
import { edgeProvenanceMark } from './edgeProvenance'

/**
 * The source mark for a set relationship strength.  The edge provenance
 * reader remains the authority: neither the strength value nor its band is
 * allowed to imply an author.
 */
const EDGE_SOURCE_KIND: Readonly<Record<EdgeValueSource, ValueProvenanceKind>> = Object.freeze({
  template: 'brief',
  cee: 'ai',
  user: 'human',
})

export interface EdgeStrengthSourceMark {
  readonly source: EdgeValueSource
  readonly kind: ValueProvenanceKind
  readonly label: string
  readonly Icon: LucideIcon
}

export const EDGE_STRENGTH_SOURCE_MARKS: readonly EdgeStrengthSourceMark[] =
  (['template', 'cee', 'user'] as const).map((source) => {
    const kind = EDGE_SOURCE_KIND[source]
    return { source, kind, label: VALUE_PROVENANCE_LABEL[kind], Icon: VALUE_PROVENANCE_ICON[kind] }
  })

const markOfKind = (source: EdgeValueSource, kind: ValueProvenanceKind): EdgeStrengthSourceMark =>
  ({ source, kind, label: VALUE_PROVENANCE_LABEL[kind], Icon: VALUE_PROVENANCE_ICON[kind] })

/**
 * The source mark for a link's strength: the ONE edge provenance classifier's mark (`edgeProvenance.ts`, data layer
 * Phase 1). It never maps a source itself, so the icon, the inspector chip and the Model tab cannot disagree. `source`
 * stays the weight's own source (the DOM binding `data-edge-source-icon`); kind, label and icon follow the class.
 */
export function edgeStrengthSourceMark(
  data: Record<string, unknown> | undefined | null,
): EdgeStrengthSourceMark | null {
  const kind = edgeProvenanceMark(data)
  const source = data ? edgeValueSource(data, 'weight') : null
  if (kind === null || source === null) return null
  return markOfKind(source, kind)
}
