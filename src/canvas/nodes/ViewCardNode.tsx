/**
 * THE ONE CANVAS NODE ON THE OLUMI-CORE LANE (decision A): every card of the View's model, whatever its family, drawn by this one
 * component from its View card exactly as core wrote it (src/olumiView/canvas.ts puts them on the canvas). Each drawn string carries
 * `data-view`, the path to it (`<card id>.<field>`, as the chances block's), and each mark carries core's hover. A proposed change shows
 * core's mark, whose hover names every field the change moves, before → after (core's changedFields, 00047 #1): a person sees what they
 * would approve on the card it changes. Text is in the canvas tokens, which carry the zoom counter-scale.
 */
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { ViewCard as Card, ViewRow } from '../../olumiView/client'
import { typography } from '../../styles/typography'
import { askKindOf, CARD_WIDTH } from '../../olumiView/layout'
import { NodeQuickActions } from './shared/NodeQuickActions'
import { NodeCoachingMarker } from './shared/NodeCoachingMarker'
import { Badge } from '../../olumiView/Badge'
import { FigureEdit } from '../../olumiView/FigureEdit'

export type ViewCardData = { card: Card }

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
export function ViewCard({ card, selected = false }: ViewCardData & { selected?: boolean }) {
  const id = card.id
  // A figure card core marks as Olumi's (its ◆, or ◐ for a person's figure Olumi reads as a range) reads at a glance as Olumi's estimate:
  // the figure in Olumi's colour, its hover core's mark, and the way to give yours always shown (core L1/L2: "give yours with ✎").
  const estimate = card.family === 'quantity' && card.olumi !== null && card.figure !== null
  return (
    // Core's marks on the card itself (00057 #4): Olumi points at it (`focus`), it is challenged, or core doubts it (dashed).
    <div
      style={{ width: CARD_WIDTH }}
      className={`group ${typography.nodeLabel} rounded-lg border bg-panel p-3 space-y-1 ${card.doubt ? 'border-dashed' : ''} ${card.challenged ? 'border-[var(--olumi-mark-orange)]' : 'border-border'} ${card.focus ? 'ring-2 ring-info' : ''}`}
      data-view-card={id} data-focus={card.focus || undefined} data-challenged={card.challenged || undefined} data-doubt={card.doubt || undefined}
    >
      <div className="flex items-baseline gap-1">
        <span data-view={`${id}.glyph`}>{card.glyph}</span>
        <span className={typography.nodeTitle} data-view={`${id}.heading`}>{card.heading}</span>
        <Mark at={`${id}.olumi`} mark={card.olumi} />
        <Mark at={`${id}.change`} mark={card.change} />
      </div>
      {/* At most two lines, the whole of core's words on hover (lane C: a first-time person reads the heading and the figure first). */}
      {card.detail === '' ? null : <p className="line-clamp-2" title={card.detail} data-view={`${id}.detail`}>{card.detail}</p>}
      {card.status === null ? null : <p data-view={`${id}.status`}>{card.status}</p>}
      {card.reason === null ? null : <p data-view={`${id}.reason`}>{card.reason}</p>}
      {card.figure === null ? null : (
        <p className={`${typography.nodeValue} ${estimate ? 'text-info' : ''}`} title={estimate ? `${card.figure.title} · ${card.olumi!.title}` : card.figure.title}
          data-olumi={estimate || undefined} data-view={`${id}.figure.text`}>{card.figure.text}</p>
      )}
      {card.figure?.edit ? <FigureEdit id={card.id} edit={card.figure.edit} {...(estimate ? { glyph: '✎', label: 'Give yours' } : {})} quiet={!selected} /> : null}
      {card.bound === null ? null : (
        <p title={card.bound.title}><span data-view={`${id}.bound.text`}>{card.bound.text}</span>
          {card.bound.olumi === null ? null : <> <Mark at={`${id}.bound.olumi`} mark={card.bound.olumi} /></>}</p>
      )}
      {card.premises.map((p, j) => (
        <p key={j} title={p.title}><span data-view={`${id}.premises.${j}.glyph`}>{p.glyph}</span> <span data-view={`${id}.premises.${j}.text`}>{p.text}</span></p>
      ))}
      {card.rows.map((row, i) => <Row key={i} id={id} row={row} i={i} />)}
      {card.badge === null ? null : <p><Badge cardId={id} badge={card.badge} at={id} /></p>}
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
  return (
    <div className="relative">
      <Handle type="target" position={Position.Left} isConnectable={false} />
      <ViewCard card={card} selected={selected === true} />
      <div className="absolute left-3 bottom-2"><NodeCoachingMarker nodeId={id} /></div>
      <NodeQuickActions nodeId={id} nodeType={askKindOf(card.family)} label={card.heading} placement="below" alwaysVisible={selected === true} />
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </div>
  )
}
