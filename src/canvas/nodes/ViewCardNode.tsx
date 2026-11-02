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

export type ViewCardData = { card: Card }

const Mark = ({ at, mark }: { at: string; mark: { glyph: string; title: string } | null }) => (
  mark === null ? null : <span title={mark.title} aria-label={mark.title} data-view={`${at}.glyph`}>{mark.glyph}</span>
)

/** One row of an option card, as core wrote it: a chance, a limit, a route, or why there is none yet. */
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
      return <p title={row.title} data-view-row={at}><span data-view={`${at}.aim`}>{row.aim}</span> <span className={typography.nodeValue} data-view={`${at}.value`}>{row.value}</span></p>
    case 'route':
      return <p title={row.title} data-view-row={at}><span data-view={`${at}.glyph`}>{row.glyph}</span> <span data-view={`${at}.aim`}>{row.aim}</span></p>
    case 'none':
      // a core before view-dock serves no `text`: the row says its title, as before (00058 P1)
      return row.text == null
        ? <p data-view-row={at}><span data-view={`${at}.title`}>{row.title}</span></p>
        : <p title={row.title} data-view-row={at}><span data-view={`${at}.text`}>{row.text}</span></p>
  }
}

/** One View card, pure: a test draws it from a golden View. */
export function ViewCard({ card }: ViewCardData) {
  const id = card.id
  return (
    // Core's marks on the card itself (00057 #4): Olumi points at it (`focus`), it is challenged, or core doubts it (dashed).
    <div
      className={`${typography.nodeLabel} rounded-lg border bg-panel p-3 space-y-1 w-64 ${card.doubt ? 'border-dashed' : ''} ${card.challenged ? 'border-[var(--olumi-mark-orange)]' : 'border-border'} ${card.focus ? 'ring-2 ring-info' : ''}`}
      data-view-card={id} data-focus={card.focus || undefined} data-challenged={card.challenged || undefined} data-doubt={card.doubt || undefined}
    >
      <div className="flex items-baseline gap-1">
        <span data-view={`${id}.glyph`}>{card.glyph}</span>
        <span className={typography.nodeTitle} data-view={`${id}.heading`}>{card.heading}</span>
        <Mark at={`${id}.olumi`} mark={card.olumi} />
        <Mark at={`${id}.change`} mark={card.change} />
      </div>
      {card.detail === '' ? null : <p data-view={`${id}.detail`}>{card.detail}</p>}
      {card.status === null ? null : <p data-view={`${id}.status`}>{card.status}</p>}
      {card.reason === null ? null : <p data-view={`${id}.reason`}>{card.reason}</p>}
      {card.figure === null ? null : <p className={typography.nodeValue} title={card.figure.title} data-view={`${id}.figure.text`}>{card.figure.text}</p>}
      {card.bound === null ? null : (
        <p title={card.bound.title}><span data-view={`${id}.bound.text`}>{card.bound.text}</span>
          {card.bound.olumi === null ? null : <> <Mark at={`${id}.bound.olumi`} mark={card.bound.olumi} /></>}</p>
      )}
      {card.premises.map((p, j) => (
        <p key={j} title={p.title}><span data-view={`${id}.premises.${j}.glyph`}>{p.glyph}</span> <span data-view={`${id}.premises.${j}.text`}>{p.text}</span></p>
      ))}
      {card.rows.map((row, i) => <Row key={i} id={id} row={row} i={i} />)}
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
