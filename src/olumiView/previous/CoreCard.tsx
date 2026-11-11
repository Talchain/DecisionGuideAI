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
import { memo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { BaseNode } from '../../canvas/nodes/BaseNode'
import { NODE_REGISTRY, type NodeType } from '../../canvas/domain/nodes'
import { typography } from '../../styles/typography'
import type { ViewCard } from '../client'
import { QUESTION } from '../layout'
import { useViewStore } from '../store'
import { useDriverOf, useRestsOnItem } from '../lens'

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

function CoreCardImpl(props: NodeProps): JSX.Element {
  const id = props.id
  const kind = ((props.data as { kind?: string }).kind ?? 'factor') as NodeType
  const model = useViewStore((s) => s.view?.model ?? null)
  const card = id === QUESTION ? null : model?.cards.find((c) => c.id === id) ?? null
  const headingOf = (option: string): string => model?.cards.find((c) => c.id === option)?.heading ?? ''
  const lead = card === null ? null : leadLineOf(card)
  const olumi = card?.author?.by === 'olumi'
  const proposed = card?.change != null
  const dashed = card?.doubt === true || proposed
  // The lenses mark the cards they are about (RULING 5): the Rests on number, in Olumi's blue where core marks the figure Olumi's; the
  // ring of What would change. Both are core's (lens.ts); null off those lenses.
  const restsOn = useRestsOnItem(id), driverOf = useDriverOf(id)
  return (
    <BaseNode {...props} nodeType={kind} icon={NODE_REGISTRY[kind].icon} incompleteStatedOnCard lodMetric={lead}
      borderClassOverride={dashed ? `border-dashed ${proposed ? 'border-info' : ''}` : undefined}>
      {card === null ? null : (
        <div className={`flex flex-col gap-1 ${driverOf !== null ? 'rounded ring-2 ring-text-header ring-offset-4' : ''}`} data-core-card={id} title={driverOf !== null ? driverOf.map((o) => o.driver!.title).join('\n') : card.figure !== null && card.figure.text === '' && card.figure.title !== '' ? `${card.figure.title} · ${card.detail}` : card.detail} data-driver-of={driverOf === null ? undefined : ''}>
          {restsOn === null ? null : <span className={`inline-flex h-[18px] min-w-[18px] items-center justify-center self-start rounded-full border bg-panel px-1 tabular-nums ${typography.nodeLabel} ${restsOn.olumi ? 'border-info text-info' : 'border-text-light text-text-body'}`} data-rests-on={restsOn.n}>{restsOn.n}</span>}
          {lead === null ? null : <p className={`${typography.nodeValue} ${olumi && card.family !== 'option' ? 'text-info' : 'text-text-header'}`} data-core-lead={id}>{lead}</p>}
          {(card.values?.length ?? 0) > 1 ? card.values!.map((v) => (
            <p key={v.option} className={`${typography.nodeLabel} text-text-body`} data-core-value={`${id}.${v.option}`}>
              <span className="text-text-light">{headingOf(v.option)}</span> {v.text}
            </p>
          )) : null}
          {/* A figure with no value takes no row (DL 10 Nov, as ViewCardNode: core's words for it are `figure.title` and `detail`, the hover). */}
          {olumi ? <p className={`${typography.nodeLabel} text-info`} title={card.author!.title} data-core-author={id}>{card.author!.text}</p> : null}
        </div>
      )}
    </BaseNode>
  )
}
export const CoreCard = memo(CoreCardImpl)
