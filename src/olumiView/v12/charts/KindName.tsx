import { NodeShapeIndicator } from '../../../canvas/nodes/NodeShapeIndicator'
import { typography } from '../../../styles/typography'
import type { ViewCard, ViewModel } from '../../client'
import { drawKindOf } from '../../layout'

export function KindName({ card, model, letter, name, view }: {
  card?: ViewCard
  model: ViewModel
  letter?: string
  name: string
  view: string
}) {
  return (
    <span className={`ok-loop-kind ${typography.viewPanelHeading}`}>
      <NodeShapeIndicator nodeKind={card ? drawKindOf(card, model) : 'factor'} />
      <span>{letter ? `${letter} · ` : null}<span data-view={view}>{name}</span></span>
    </span>
  )
}
