import { LANE_MENU_WORDS } from '../../../canvas/contextMenu/laneMenu'
import { NodeShapeIndicator } from '../../../canvas/nodes/NodeShapeIndicator'
import { drawKindOf, QUESTION } from '../../layout'
import { MenuLabel } from '../../look/Menu.tsx'
import { useViewStore } from '../../store'
import type { ViewCard } from '../../client'
import { isDashedCardKind } from '../cards/kind'

const KIND: Readonly<Record<string, string>> = { option: LANE_MENU_WORDS.option, risk: LANE_MENU_WORDS.risk, quantity: LANE_MENU_WORDS.factor, factor: LANE_MENU_WORDS.factor, claim: LANE_MENU_WORDS.claim, goal: 'Aim', limit: 'Limit', assumption: 'Assumption', condition: 'Condition' }

const SHAPE_WORDS = { outcome: 'Outcome', goal: 'Aim', constraint: 'Limit', option: LANE_MENU_WORDS.option, risk: LANE_MENU_WORDS.risk }
export const kindWordsOf = (card: Pick<ViewCard, 'family'>, kind: ReturnType<typeof drawKindOf> = 'factor'): string | null =>
  kind === 'factor' ? KIND[card.family] ?? null : SHAPE_WORDS[kind]
export function CardMenuHeader({ nodeId }: { nodeId: string }): JSX.Element | null {
  const model = useViewStore((s) => s.view?.model)
  if (model == null) return null
  const card = model.cards.find((c) => c.id === nodeId)
  const question = nodeId === QUESTION
  if (!question && card === undefined) return null
  const kind = card === undefined ? 'decision' : drawKindOf(card, model)
  const kindWord = card === undefined || kind === 'decision' ? 'Question' : kindWordsOf(card, kind)
  const heading = card?.heading ?? model.question.text

  return (
    <div data-testid="lane-menu-header" role="presentation">
      <MenuLabel>
        <span className="flex items-start gap-2 break-words">
          <NodeShapeIndicator nodeKind={kind} size={14} dashedOutline={card !== undefined && isDashedCardKind(card)} className="mt-px" />
          {kindWord && <span className="sr-only" data-testid="lane-menu-kind">{kindWord}</span>}
          <span className="min-w-0">{heading}</span>
        </span>
      </MenuLabel>
    </div>
  )
}
