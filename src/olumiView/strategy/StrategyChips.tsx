/**
 * Strategy lane, slice 1: core's one mark for a card the revealed qualitative views speak to, drawn as the same chip the V11 reveal draws
 * (RevealMarks.tsx CardViewChips, core-mark branch: the people's initials and core's short sentence, below the card on its outgoing links).
 * Mounted beside CardViewChips in the card's rail portal (v10.tsx, one portal, by agreement with the V11 build, 7 Nov); null when the reveal
 * already marks the card or the View has no `strategy`. Selecting it opens the first person's view in the dock, as the reveal's chip does.
 * When it is the card's only rail, the links the team's explanations differ on (TM-04, CardDiffers.tsx) sit in it too: never a second rail.
 */
import { typography } from '../../styles/typography'
import { CARD_WIDTH } from '../layout'
import { openView } from '../RevealMarks'
import { marksOn, revealOf, useReveal } from '../reveal'
import { useViewStore } from '../store'
import { peopleOf, strategyMarkOn } from './strategy'
import { DifferChip, railLayout, useLinkDiffers } from '../../olumiCore/team/CardDiffers'

const initial = (by: string) => by.slice(0, 1).toUpperCase()
const CHIPS_WIDTH = Math.max(CARD_WIDTH, 380)

export function StrategyChips({ card }: { card: string }): JSX.Element | null {
  const view = useViewStore((s) => s.view)
  const selected = useReveal((s) => s.selected)
  const differs = useLinkDiffers(card)
  const mark = strategyMarkOn(view, card)
  if (mark === null) return null
  const hostsDiffers = marksOn(revealOf(view), card).cardChips.length === 0
  const people = peopleOf(view, mark), on = selected !== null && mark.views.includes(selected)
  // A rail that holds a doubted link is the card's width and wraps to a second row (CardDiffers.tsx railLayout).
  const { wrap, style } = railLayout(hostsDiffers && differs.length > 0, CHIPS_WIDTH)
  return (
    <div className={`nodrag mt-1 flex flex-row ${wrap} justify-center gap-1.5`} style={style} data-testid={`strategy-chips-${card}`}>
      <button type="button" aria-pressed={on} aria-label={mark.text} title={mark.text} data-strategy-chip={mark.views[0]} data-strategy-kind={mark.kind}
        onClick={(e) => { e.stopPropagation(); openView(mark.views[0]!, card) }}
        className={`pointer-events-auto inline-flex h-6 max-w-full cursor-pointer items-center gap-1.5 rounded-full border border-panel-border bg-panel pl-0.5 pr-2.5 ${typography.viewLabel} text-text-header shadow-1 transition-shadow duration-fast hover:shadow-2 ${on ? 'shadow-2' : ''}`}>
        <span aria-hidden="true" className="inline-flex flex-none">
          {people.map((p, i) => <span key={`${p.view}:${p.by}`} className={`inline-grid h-[18px] w-[18px] place-items-center rounded-full border border-panel-border bg-canvas text-text-body ${i > 0 ? '-ml-1.5' : ''}`}>{initial(p.by)}</span>)}
        </span>
        <span className="truncate" data-strategy-chip-text="">{mark.text}</span>
      </button>
      {hostsDiffers ? differs.map((d) => <DifferChip key={d.record} d={d} card={card} />) : null}
    </div>
  )
}
