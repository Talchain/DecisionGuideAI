import type { LucideIcon } from 'lucide-react'
import { edgeValueSource, type EdgeValueSource } from './edgeValueProvenance'
import { VALUE_PROVENANCE_ICON } from './valueProvenanceIcon'
import { VALUE_PROVENANCE_LABEL, type ValueProvenanceKind } from './valueProvenance'
import { isStrengthStated } from './strengthStated'
import { isStrengthAccepted } from './strengthAccepted'
import { edgeSizePhrase } from '../edges/edgeSizePhrase'

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
 * Whose the SIZE is, by the SAME rule as the Model tab's relationship rows (`model-tab-v2/adapters.ts`, gate 5), so the
 * line and the tab never disagree:
 *   - an example figure carries no author mark;
 *   - a strength sized from the user's OWN stated figure reads as their brief (`isStrengthStated`), never as Olumi's
 *     estimate ("A STRENGTH SIZED FROM THE USER'S OWN STATED FIGURE IS NOT 'OLUMI'S ESTIMATE'", strengthStated.ts);
 *   - an Olumi strength the user accepted reads as accepted (`isStrengthAccepted`);
 *   - otherwise the weight's own source.
 */
export function edgeStrengthSourceMark(
  data: Record<string, unknown> | undefined | null,
): EdgeStrengthSourceMark | null {
  if (!data || edgeSizePhrase(data)?.exampleFigure === true) return null
  const source = edgeValueSource(data, 'weight')
  if (source === null) return null
  if (isStrengthStated(data)) return markOfKind(source, 'brief')
  if (source === 'cee' && isStrengthAccepted(data)) return markOfKind(source, 'accepted')
  return EDGE_STRENGTH_SOURCE_MARKS.find(mark => mark.source === source) ?? null
}
