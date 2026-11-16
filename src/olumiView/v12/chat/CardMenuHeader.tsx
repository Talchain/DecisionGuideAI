/**
 * The right-click card menu's header (V12 RC): the card's kind, and a "Proposed" chip when Olumi proposed the card. Read from the View card
 * (`family`, `author`/`olumi`). The kind words are the lane menu's own chrome words for the kinds the menu already names (a driver is a Factor) and a few plain nouns for the rest; a kind it does not
 * name (a reason card, a left-out record) shows only its chip, if any. Drawn by CanvasContextMenu on the lane (mount patch in the report).
 */
import { LANE_MENU_WORDS } from '../../../canvas/contextMenu/laneMenu'
import { typography } from '../../../styles/typography'
import { useViewStore } from '../../store'
import type { ViewCard } from '../../client'

export const PROPOSED = 'Proposed'
const KIND: Readonly<Record<string, string>> = { option: LANE_MENU_WORDS.option, risk: LANE_MENU_WORDS.risk, quantity: LANE_MENU_WORDS.factor, factor: LANE_MENU_WORDS.factor, claim: LANE_MENU_WORDS.claim, goal: 'Aim', limit: 'Limit', assumption: 'Assumption', condition: 'Condition' }

export const kindWordsOf = (card: Pick<ViewCard, 'family'>): string | null => KIND[card.family] ?? null
/** Olumi proposed it: the card's author is Olumi's (or, where core names no author, it wears Olumi's mark). */
export const proposedByOlumi = (card: Pick<ViewCard, 'author' | 'olumi'>): boolean => (card.author == null ? card.olumi != null : card.author.by === 'olumi')

export function CardMenuHeader({ nodeId }: { nodeId: string }): JSX.Element | null {
  const card = useViewStore((s) => s.view?.model?.cards.find((c) => c.id === nodeId) ?? null)
  if (card === null) return null
  const kind = kindWordsOf(card), proposed = proposedByOlumi(card)
  if (kind === null && !proposed) return null
  return (
    <div className={`${typography.viewPanelMeta} mx-2 mb-1 flex items-center gap-2 border-b border-panel-border pb-1.5 text-text-light`} data-testid="lane-menu-header" role="presentation">
      {kind === null ? null : <span className="font-medium text-text-body" data-testid="lane-menu-kind">{kind}</span>}
      {proposed ? <span className="rounded-full border border-info px-1.5 text-info" data-testid="lane-menu-proposed">{PROPOSED}</span> : null}
    </div>
  )
}
