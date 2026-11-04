/**
 * THE ONE CANVAS NODE ON THE OLUMI-CORE LANE (decision A): every card of the View's model, whatever its family, drawn by this one
 * component from its View card exactly as core wrote it (src/olumiView/canvas.ts puts them on the canvas). Each drawn string carries
 * `data-view`, the path to it (`<card id>.<field>`, as the chances block's), and each mark carries core's hover. A proposed change shows
 * core's mark, whose hover names every field the change moves, before → after (core's changedFields, 00047 #1): a person sees what they
 * would approve on the card it changes. The face is compact (glyph, heading, marks, figure, an option's rows, or what an assumption
 * says); the card's other words open beside it on selection. Links run top to bottom, as the causal graph reads. Text is in the canvas
 * tokens, which carry the zoom counter-scale.
 */
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ChevronDown } from 'lucide-react'
import type { ViewCard as Card, ViewRow } from '../../olumiView/client'
import { typography } from '../../styles/typography'
import { askKindOf, CARD_WIDTH, drawKindOf, type RestsOnItem } from '../../olumiView/layout'
import { NodeShapeIndicator } from './NodeShapeIndicator'
import { useCardNumber, useDriverOf, useRestsOnItem } from '../../olumiView/lens'
import { Activity } from 'lucide-react'
import { NodeQuickActions } from './shared/NodeQuickActions'
import { NodeCoachingMarker } from './shared/NodeCoachingMarker'
import { Badge } from '../../olumiView/Badge'
import { FigureEdit } from '../../olumiView/FigureEdit'

export type ViewCardData = { card: Card }

/**
 * The original card's places, kept as named, empty mount points (DL 4 Nov) for the v10 features the design lead puts back on this shell:
 * each is a `data-slot` element (the outline is the card's own `data-slot-outline`), drawn empty and taking no room.
 */
export const VIEW_CARD_SLOTS = {
  olumiBadge: 'olumi-badge', // the bottom-right corner
  driverBadge: 'driver-badge', // the top-right corner, option cards
  outcomeBand: 'outcome-band', // under status line 2, option cards
  titleMark: 'title-mark', // the title line: Olumi's inline mark, the only blue
  figureSide: 'figure-side', // beside the figure's value line: the what-if Try and the Rests-on glyph
  marks: 'marks', // the bottom marks row
  rail: 'rail', // below the card
} as const
const Slot = ({ name, className = '' }: { name: string; className?: string }) => <span data-slot={name} className={className} />

const Mark = ({ at, mark }: { at: string; mark: { glyph: string; title: string } | null }) => (
  mark === null ? null : <span title={mark.title} aria-label={mark.title} data-view={`${at}.glyph`}>{mark.glyph}</span>
)

/** One row of an option card, as core wrote it: a chance, a limit, or why there is none yet. */
function Row({ id, row, i }: { id: string; row: ViewRow; i: number }) {
  const at = `${id}.rows.${i}`
  switch (row.kind) {
    case 'chance':
      return (
        <p className="flex flex-wrap items-baseline gap-x-1" title={row.title} data-view-row={at}>
          <span data-view={`${at}.aim`}>{row.aim}</span>
          <span className={typography.nodeValue}>{row.approx === '' ? null : <span data-view={`${at}.approx`}>{row.approx}</span>}<span data-view={`${at}.value`}>{row.value}</span></span>
          <Mark at={`${at}.olumi`} mark={row.olumi} />
          <Mark at={`${at}.likely`} mark={row.likely} />
        </p>
      )
    case 'limit':
      return <p title={row.title} data-view-row={at}><span data-view={`${at}.aim`}>{row.aim}</span> <span className={typography.nodeValue} data-view={`${at}.value`}>{row.value}</span> <Mark at={`${at}.olumi`} mark={row.olumi} /></p>
    case 'none':
      // a core before view-dock serves no `text`: the row says its title, as before (00058 P1)
      return row.text == null
        ? <p data-view-row={at}><span data-view={`${at}.title`}>{row.title}</span></p>
        : <p title={row.title} data-view-row={at}><span data-view={`${at}.text`}>{row.text}</span></p>
  }
}

/** One View card, pure: a test draws it from a golden View. */
export function ViewCard({ card, selected = false, restsOn = null, driverOf = null, number = null }: ViewCardData & { selected?: boolean; restsOn?: RestsOnItem | null; driverOf?: readonly Card[] | null; number?: string | null }) {
  const id = card.id
  // A figure card core marks as Olumi's (its ◆, or ◐ for a person's figure Olumi reads as a range) reads at a glance as Olumi's estimate:
  // the figure in Olumi's colour, its hover core's mark, and the way to give yours always shown (core L1/L2: "give yours with ✎").
  const estimate = card.family === 'quantity' && card.olumi !== null && card.figure !== null
  // A card with no figure and no rows (an assumption, a condition) says what it holds in its reason: that stays on the face, one line
  // and whole on hover (DL 4 Nov). Any other card's reason opens with its other words.
  const says = card.figure === null && card.rows.length === 0 && card.reason !== null
  const more = card.status !== null || (card.reason !== null && !says) || card.bound !== null || card.premises.length > 0
  return (
    // Core's marks on the card itself (00057 #4): Olumi points at it (`focus`), it is challenged, or core doubts it (dashed).
    <div
      style={{ width: CARD_WIDTH }}
      className={`group relative ${typography.nodeLabel} rounded-md border bg-panel px-3 pb-3 pt-3.5 space-y-1 shadow-sm ${card.doubt ? 'border-dashed' : ''} ${card.challenged ? 'border-[var(--olumi-mark-orange)]' : 'border-border'} ${card.focus ? 'ring-2 ring-info' : driverOf !== null ? 'ring-[3px] ring-text-header' : ''}`}
      data-view-card={id} data-focus={card.focus || undefined} data-challenged={card.challenged || undefined} data-doubt={card.doubt || undefined}
      data-slot-outline="next-step"
    >
      {restsOn === null ? null : (
        // The Rests on lens: this card's number, in Olumi's blue when core marks it Olumi's (one to check or set), its hover core's mark.
        <span className={`absolute -left-2 -top-2 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full border bg-panel px-1 tabular-nums ${typography.nodeLabel} ${restsOn.olumi ? 'border-info text-info' : 'border-border text-text-body'}`}
          title={restsOn.olumi && card.olumi ? card.olumi.title : undefined} data-rests-on={restsOn.n} data-rests-on-olumi={restsOn.olumi || undefined}>{restsOn.n}</span>
      )}
      {driverOf === null ? null : (
        // What would change: a figure an option's chance moves most with, how many options it moves, and core's driver words on hover.
        <span className={`absolute -right-2 -top-2 inline-flex h-[20px] items-center gap-0.5 rounded-full border border-text-header bg-panel px-1.5 tabular-nums text-text-header ${typography.nodeLabel}`}
          title={driverOf.map((o) => o.driver!.title).join('\n')} data-driver-of={driverOf.map((o) => o.id).join(' ')}>
          <Activity aria-hidden="true" className="h-3 w-3" />{driverOf.length}
        </span>
      )}
      {/* The original canvas's connector glyph: the card's kind as its shape, on the top edge where its links arrive. */}
      <span className="absolute -top-[10px] left-1/2 -translate-x-1/2 leading-none" aria-hidden="true">
        <NodeShapeIndicator nodeKind={drawKindOf(card)} size={18} stroke="var(--bg-panel, #fff)" strokeWidth={0.6} />
      </span>
      <div className="flex items-baseline gap-1">
        <span className="sr-only" data-view={`${id}.glyph`}>{card.glyph}</span>
        {number === null ? null : <span className="text-text-light font-normal" data-card-number={number}>{number}</span>}
        {/* Core's detail ("… · quantity · Theirs: …") is its page's hover text, not a line: on the heading, whole (DL 4 Nov, Paul's rule). */}
        <span className={`${typography.nodeTitle} font-semibold text-text-header`} title={card.detail === '' ? undefined : card.detail} data-view={`${id}.heading`}>{card.heading}</span>
        <Mark at={`${id}.olumi`} mark={card.olumi} />
        <Mark at={`${id}.change`} mark={card.change} />
        <Slot name={VIEW_CARD_SLOTS.titleMark} className="empty:hidden" />
      </div>
      {card.family === 'option' ? <Slot name={VIEW_CARD_SLOTS.driverBadge} className="absolute right-1 top-1 empty:hidden" />
        // The original's ⌄ on a card with more to say: a press selects the card, which opens its other words beside it.
        : more ? <ChevronDown aria-hidden="true" data-more-cue="" className="absolute right-1.5 top-2 h-3.5 w-3.5 text-text-light" /> : null}
      {says ? <p className="line-clamp-1" title={card.reason!} data-view={`${id}.reason`}>{card.reason}</p> : null}
      {card.figure === null ? null : (
        <div className="flex items-baseline gap-1">
          <p className={`${typography.nodeValue} ${estimate ? 'text-info' : ''}`} title={estimate ? `${card.figure.title} · ${card.olumi!.title}` : card.figure.title}
            data-olumi={estimate || undefined} data-view={`${id}.figure.text`}>{card.figure.text}</p>
          <Slot name={VIEW_CARD_SLOTS.figureSide} className="empty:hidden" />
        </div>
      )}
      {card.figure?.edit ? <FigureEdit id={card.id} edit={card.figure.edit} {...(estimate ? { glyph: '✎', label: 'Give yours' } : {})} quiet={!selected} /> : null}
      {card.rows.map((row, i) => (
        <span key={i} className="contents">
          <Row id={id} row={row} i={i} />
          {card.family === 'option' && i === Math.min(1, card.rows.length - 1) ? <Slot name={VIEW_CARD_SLOTS.outcomeBand} className="block empty:hidden" /> : null}
        </span>
      ))}
      {card.badge === null ? null : <p><Badge cardId={id} badge={card.badge} at={id} /></p>}
      <Slot name={VIEW_CARD_SLOTS.marks} className="flex gap-1 empty:hidden" />
      <Slot name={VIEW_CARD_SLOTS.olumiBadge} className="absolute bottom-1 right-1 empty:hidden" />
      {more ? (
        // The card's other words (its status, reason, bound and premises), every one core's, beside the card while it is selected: the
        // face stays compact so the causal graph reads (Paul 4 Nov), and opening them never changes the card's drawn height.
        <div hidden={!selected} className={`absolute left-full top-0 z-10 ml-2 space-y-1 rounded-lg border border-border bg-panel p-3 shadow-sm ${typography.nodeLabel}`}
          style={{ width: CARD_WIDTH }} data-view-more={id}>
          {card.status === null ? null : <p data-view={`${id}.status`}>{card.status}</p>}
          {card.reason === null || says ? null : <p data-view={`${id}.reason`}>{card.reason}</p>}
          {card.bound === null ? null : (
            <p title={card.bound.title}><span data-view={`${id}.bound.text`}>{card.bound.text}</span>
              {card.bound.olumi === null ? null : <> <Mark at={`${id}.bound.olumi`} mark={card.bound.olumi} /></>}</p>
          )}
          {card.premises.map((p, j) => (
            // One line each, cut with an ellipsis, the glyph first and the whole on hover, as core's page draws a premise (.premise: nowrap,
            // ellipsis): a premise shared by several options otherwise repeated in full on each card (DL 4 Nov).
            <p key={j} title={p.title} className="truncate" data-premise-row={`${id}.${j}`}><span data-view={`${id}.premises.${j}.glyph`}>{p.glyph}</span> <span data-view={`${id}.premises.${j}.text`}>{p.text}</span></p>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/**
 * The React Flow node: the card, with the handles its links attach to, and the Olumi controls every canvas card carries (review 00063
 * #3): Ask Olumi and Challenge (which on this lane reach core: a challenge on core's own challenge route for this card, through the
 * Olumi tab, src/olumiView/ViewChat.tsx), and the card's coaching marker.
 */
export function ViewCardNode({ id, data, selected }: NodeProps) {
  const { card } = data as ViewCardData
  const restsOn = useRestsOnItem(id)
  const driverOf = useDriverOf(id)
  const number = useCardNumber(id)
  return (
    <div className="relative">
      <Handle type="target" position={Position.Top} isConnectable={false} className="!opacity-0" />
      <ViewCard card={card} selected={selected === true} restsOn={restsOn} driverOf={driverOf} number={number} />
      <div className="absolute left-3 bottom-2"><NodeCoachingMarker nodeId={id} /></div>
      <NodeQuickActions nodeId={id} nodeType={askKindOf(card.family)} label={card.heading} placement="below" alwaysVisible={selected === true} />
      <Slot name={VIEW_CARD_SLOTS.rail} className="absolute left-0 top-full empty:hidden" />
      <Handle type="source" position={Position.Bottom} isConnectable={false} className="!opacity-0" />
    </div>
  )
}
