/**
 * SPIKE (UI restore, 11 Nov 2026; Paul: "having the previous UI but plugged into the alpha data model"). A CORE CARD ON THE PREVIOUS
 * PRODUCT'S CARD FRAME. The frame is the previous product's own (`BaseNode`: its box, kind mark, title, level-of-detail line, corner marks,
 * selection and handles). The BODY is core's View card, core's words verbatim: the previous cards' own bodies (FactorNode, OptionNode,
 * GoalNode, DecisionNode) read the previous data model and say things about it ("Needs input · Value not set yet", "No changes specified")
 * that are not true of a core model, so they are not mounted on this lane.
 *
 * Rulings applied here (output/ui-restore-20261111/RULINGS.md): an empty slot is silent unless core sends its own words for the gap; an
 * option's headline is core's chance of meeting the goal, verbatim; an outcome shows each option's worked-out value once; an aim or limit
 * shows its bound; only Olumi's cards say who they are from, in Olumi's blue; dashes mean core doubts it or it is proposed.
 * Nothing here formats, rounds, orders or works out a value.
 */
import { memo, useMemo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { BaseNode } from '../../canvas/nodes/BaseNode'
import { NODE_REGISTRY, type NodeType } from '../../canvas/domain/nodes'
import { typography } from '../../styles/typography'
import type { ViewCard } from '../client'
import { CARD_WIDTH, drawKindOf, QUESTION } from '../layout'
import { useViewStore } from '../store'
import { useDriverOf, useRestsOnItem } from '../lens'
import { optionBands, ViewDriverBadge, ViewOptionBand, ViewValuesBand } from '../v10'
import { CardEvidenceMarks, CardViewChips, CardViewInitials, OptionMarkLine } from '../RevealMarks'
import { StrategyChips } from '../strategy/StrategyChips'

/** The one line beneath the name when zoomed out, and the body's lead line: core's own words for this card, the first it sends of these. */
export function leadLineOf(card: ViewCard): string | null {
  if (card.family === 'option') {
    // RULING 7: the chance of meeting the goal, core's words. Where core withholds it, core's own first line saying so, never a blank and
    // never a figure of the UI's.
    if (card.headline != null) return card.headline.text
    const first = card.rows[0]
    return first !== undefined && first.kind === 'none' ? first.text : null
  }
  const perOption = (card.values?.length ?? 0) > 1
  if (card.figure !== null && card.figure.text !== '' && !perOption) return card.figure.text
  if (card.bound != null) return card.bound.text
  if (perOption) return null
  return card.face?.line?.text ?? null
}

/** The one line beneath the name on the zoomed-out face: the lead line, or for a figure worked out per option core's own line of them all
 *  (the reduced face shows less of it, and the notice says so). */
export function farLineOf(card: ViewCard): string | null {
  return leadLineOf(card) ?? (card.figure !== null && card.figure.text !== '' ? card.figure.text : null)
}

/** The hover that goes with `leadLineOf`: core's own title for the same thing (the goal, conditions and precision behind a chance; the bound's and
 *  the figure's own), verbatim. Null where core sends none. */
export function leadTitleOf(card: ViewCard): string | null {
  if (card.family === 'option') return card.headline != null && card.headline.title !== '' ? card.headline.title : null
  const perOption = (card.values?.length ?? 0) > 1
  if (card.figure !== null && card.figure.text !== '' && !perOption) return card.figure.title !== '' ? card.figure.title : null
  if (card.bound != null) return card.bound.title !== '' ? card.bound.title : null
  return null
}

function CoreCardImpl(props: NodeProps): JSX.Element {
  const id = props.id
  const model = useViewStore((s) => s.view?.model ?? null)
  // The card is the one the node carries (canvas.ts drawViewCanvas: core's own card, never a copy), else the View's: one snapshot with the node.
  const carried = (props.data as { card?: ViewCard }).card
  const card = id === QUESTION ? null : carried ?? model?.cards.find((c) => c.id === id) ?? null
  // On the lane's own canvas the node carries core's card or question (canvas.ts drawViewCanvas), no kind: the kind is the one the board
  // draws it as (layout.ts drawKindOf), the name core's heading or question, and the width the one the lane's layout placed it at.
  const hosted = (props.data as { kind?: string }).kind === undefined
  const kind = ((props.data as { kind?: string }).kind ?? (id === QUESTION ? 'decision' : card !== null && model !== null ? drawKindOf(card, model) : 'factor')) as NodeType
  const width = (props.data as { width?: number }).width
  const label = id === QUESTION ? model?.question.text ?? '' : card?.heading ?? ''
  const data = useMemo(() => (hosted ? { ...props.data, label, kind, type: kind, core: true } : props.data), [hosted, props.data, label, kind])
  const headingOf = (option: string): string => model?.cards.find((c) => c.id === option)?.heading ?? ''
  const lead = card === null ? null : leadLineOf(card)
  const olumi = card?.author?.by === 'olumi'
  const proposed = card?.change != null
  const dashed = card?.doubt === true || proposed
  // The lenses mark the cards they are about (RULING 5): the Rests on number, in Olumi's blue where core marks the figure Olumi's; the
  // ring of What would change. Both are core's (lens.ts); null off those lenses.
  const restsOn = useRestsOnItem(id), driverOf = useDriverOf(id)
  // An option's outcome band, every option on one axis: cards and aim from the ONE model read above (inventory G21b: never two stores).
  const band = useMemo(() => (card?.family === 'option' && model !== null ? optionBands(model.cards, model.aim ?? null).get(id) ?? null : null), [card, model, id])
  return (
    <BaseNode {...props} data={data} maxWidth={hosted ? (id === QUESTION ? width : CARD_WIDTH) : undefined} nodeType={kind} icon={NODE_REGISTRY[kind].icon} incompleteStatedOnCard lodMetric={card === null ? null : farLineOf(card)} cornerSlot={card !== null && card.driver != null ? <ViewDriverBadge card={card} /> : undefined}
      borderClassOverride={dashed ? `border-dashed ${proposed ? 'border-info' : ''}` : undefined}>
      {card === null ? null : (
        <div className={`flex flex-col gap-1 ${driverOf !== null ? 'rounded ring-2 ring-text-header ring-offset-4' : ''}`} data-core-card={id} title={driverOf !== null ? driverOf.map((o) => o.driver!.title).join('\n') : card.figure !== null && card.figure.text === '' && card.figure.title !== '' ? `${card.figure.title} · ${card.detail}` : !olumi && card.author != null && card.author.title !== '' ? `${card.detail}\n${card.author.title}` : card.detail} data-driver-of={driverOf === null ? undefined : ''}>
          {restsOn === null ? null : <span className={`inline-flex h-[18px] min-w-[18px] items-center justify-center self-start rounded-full border bg-panel px-1 tabular-nums ${typography.nodeLabel} ${restsOn.olumi ? 'border-info text-info' : 'border-text-light text-text-body'}`} data-rests-on={restsOn.n}>{restsOn.n}</span>}
          {lead === null ? null : <p className={`${typography.nodeValue} ${olumi && card.family !== 'option' ? 'text-info' : 'text-text-header'}`} data-core-lead={id} title={card === null ? undefined : leadTitleOf(card) ?? undefined}>{lead}</p>}
          {(card.values?.length ?? 0) > 1 ? card.values!.map((v) => (
            <p key={v.option} className={`${typography.nodeLabel} text-text-body`} data-core-value={`${id}.${v.option}`}>
              <span className="text-text-light">{headingOf(v.option)}</span> {v.text}
            </p>
          )) : null}
          {card.family === 'option' ? <>{band === null ? null : <ViewOptionBand id={id} band={band} />}<OptionMarkLine card={id} /></> : <ViewValuesBand card={card} />}
          {/* The team's revealed views, its evidence and core's strategy mark on the card they are about (./RevealMarks, ./strategy). */}
          <span className="flex flex-wrap items-center gap-1 empty:hidden"><CardViewInitials card={id} /><CardEvidenceMarks card={id} /><CardViewChips card={id} /><StrategyChips card={id} /></span>
          {/* A figure with no value takes no row (DL 10 Nov, as ViewCardNode: core's words for it are `figure.title` and `detail`, the hover). */}
          {olumi ? <p className={`${typography.nodeLabel} text-info`} title={card.author!.title} data-core-author={id}>{card.author!.text}</p> : null}
        </div>
      )}
    </BaseNode>
  )
}
export const CoreCard = memo(CoreCardImpl)
