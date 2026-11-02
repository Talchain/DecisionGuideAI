/**
 * THE ONE CANVAS NODE ON THE OLUMI-CORE LANE (decision A): every card of the View's model, whatever its family, drawn by this one
 * component from its View card exactly as core wrote it. Each drawn string carries `data-view`, the path to it (`<card id>.<field>`,
 * as the chances block's), and each mark carries core's hover. A proposed change shows core's mark, whose hover names every field the
 * change moves, before → after (core's changedFields, 00047 #1): a person sees what they would approve on the card it changes.
 */
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { ViewCard } from './client'
import { Row } from './ViewChances'
import { typography } from '../styles/typography'

export type ViewCardData = { card: ViewCard }

const Mark = ({ at, mark }: { at: string; mark: { glyph: string; title: string } }) => (
  <span title={mark.title} aria-label={mark.title} data-view={`${at}.glyph`}>{mark.glyph}</span>
)

/** One View card, pure: a test draws it from a golden View. */
export function ViewCard({ card }: ViewCardData) {
  const id = card.id
  return (
    <div className={`${typography.panelBody} rounded-lg border border-border bg-panel p-3 space-y-1 w-64`} data-view-card={id}>
      <div className="flex items-baseline gap-1">
        <span data-view={`${id}.glyph`}>{card.glyph}</span>
        <span className={typography.panelHeader} data-view={`${id}.heading`}>{card.heading}</span>
        {card.olumi === null ? null : <Mark at={`${id}.olumi`} mark={card.olumi} />}
        {card.change === null ? null : <Mark at={`${id}.change`} mark={card.change} />}
      </div>
      {card.detail === '' ? null : <p data-view={`${id}.detail`}>{card.detail}</p>}
      {card.status === null ? null : <p data-view={`${id}.status`}>{card.status}</p>}
      {card.reason === null ? null : <p data-view={`${id}.reason`}>{card.reason}</p>}
      {card.figure === null ? null : <p className={typography.panelTabular} title={card.figure.title} data-view={`${id}.figure.text`}>{card.figure.text}</p>}
      {card.bound === null ? null : (
        <p title={card.bound.title}><span data-view={`${id}.bound.text`}>{card.bound.text}</span>
          {card.bound.olumi === null ? null : <> <Mark at={`${id}.bound.olumi`} mark={card.bound.olumi} /></>}</p>
      )}
      {card.premises.map((p, j) => (
        <p key={j} title={p.title}><span data-view={`${id}.premises.${j}.glyph`}>{p.glyph}</span> <span data-view={`${id}.premises.${j}.text`}>{p.text}</span></p>
      ))}
      {card.rows.map((row, i) => <Row key={i} card={card} row={row} i={i} />)}
      {card.badge === null ? null : <p title={card.badge.title} aria-label={card.badge.label} data-view={`${id}.badge.text`}>{card.badge.text}</p>}
    </div>
  )
}

/** The React Flow node: the card, with the handles its links attach to. */
export function ViewCardNode({ data }: NodeProps) {
  return (
    <>
      <Handle type="target" position={Position.Left} isConnectable={false} />
      <ViewCard card={(data as ViewCardData).card} />
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </>
  )
}
