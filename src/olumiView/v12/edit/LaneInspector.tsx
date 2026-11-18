/**
 * THE LANE'S DETAILS PANEL (V12 manual editing): one small floating panel for the card or link the person opened ("Open details" in the
 * right-click menu). It is not a strip and not the legacy inspector (which reads the previous product's node shapes, a View card carries none):
 * it draws core's own words for the item (its heading, figure, whose estimate it is, what the line says) and offers only the edits core takes,
 * each through the one small form (./EditForm.tsx) and so through the real route. Editing works at every level (Simple or the whole model).
 *
 * "Take out of comparison" is NOT offered: core has no route for an option's status or an exclusion (MANUAL-EDITING-MAP, headline 4).
 */
import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import { isOlumiCoreLane } from '../../../olumiCore/lane'
import { X } from 'lucide-react'
import { typography } from '../../../styles/typography'
import { cardEditRows, edgeIdOf, linkEditRows } from '../../../canvas/contextMenu/laneMenu'
import { useLaneCtx } from '../../../canvas/contextMenu/useLaneMenu'
import { useShowToast } from '../../../canvas/ToastContext'
import { useCanvasStore } from '../../../canvas/store'
import type { NodeTarget } from '../../../canvas/contextMenu/types'
import type { ViewCard } from '../../client'
import type { FigureRange } from '../contract'
import { WhereYouDiffer } from '../../../olumiCore/team/CardDispute'
import { FigureInspector } from '../inspect/FigureInspector'
import { ValueRow } from '../inspect/ValueRow'
import { useViewStore } from '../../store'
import { writeKeyOf, type EditSpec } from './EditForm'
import { CardWords } from '../../SelectedRename'
import { SelectedExplain } from '../../look/SelectedExplain'
import { detailsOf, useLaneInspector } from './inspectorStore'
import { DETAILS_H, DETAILS_X, DETAILS_Y, stayBeside } from './placeBeside'

const NOOP = () => undefined
/**
 * The one small form, from the details panel's buttons: it takes the panel's place (one thing open at a time). On the lane it is placed beside the same
 * card by the same rule as the panel (`beside`: never over the card, inside the free canvas); the older look keeps its fixed anchor, as before.
 */
const openFormHere = (spec: EditSpec): void => {
  const open = useLaneInspector.getState().current
  const beside = isOlumiCoreLane() && open?.kind === 'details' ? open.target : undefined
  useLaneInspector.getState().show({ kind: 'form', spec, anchor: { x: 372, y: 112 }, beside, busyKey: writeKeyOf(spec) })
}

/** `range`: the slot for a figure's range chart (the scale lane's RangeBar); called only for a card whose View carries a numeric range. */
export function LaneInspector({ range }: { range?: (card: ViewCard, r: FigureRange) => ReactNode } = {}): JSX.Element | null {
  const target = useLaneInspector(detailsOf), close = useLaneInspector((s) => s.close)
  const view = useViewStore((s) => s.view)
  const showToast = useShowToast()
  const ctx = useLaneCtx({ showToast, onClose: NOOP, openForm: openFormHere })
  // The item gone from the model: the panel closes rather than show what is not there (another scenario closes it in LaneEditingLayer).
  const model = view?.model ?? null
  const card = target?.kind === 'card' ? model?.cards.find((c) => c.id === target.id) ?? null : null
  const link = target?.kind === 'link' ? model?.links.find((l) => edgeIdOf(l) === target.id) ?? null : null
  useEffect(() => { if (target !== null && card === null && link === null) close() }, [target, card, link, close])
  // Surfaces step 5: on the lane the Value row below is the one place a figure, a risk's size or a link's strength is changed, so the panel's buttons
  // for them are not drawn there (the older look keeps them, and its form).
  const lane0 = isOlumiCoreLane()
  const rows = useMemo(() => (card !== null ? cardEditRows(card, ctx) : link !== null ? linkEditRows(link, ctx) : []).filter((r) => !(lane0 && (r.id === 'size' || r.id === 'change-figure'))), [card, link, ctx, lane0])
  // BESIDE ITS ITEM, AND IT FOLLOWS (surfaces step 3; the lane's own, the older look keeps the fixed corner): placed before paint, then re-placed whenever
  // the item, the panel or the free canvas moves (a pan, a zoom, a relayout), as the hover pop-up is. It never stays behind over a card that has moved on;
  // while its item is off the free canvas it stays visible, clamped inside it, as any other surface (Escape closes it).
  const lane = isOlumiCoreLane()
  const shown = target !== null && (card !== null || link !== null)
  const panel = useRef<HTMLElement>(null)
  const at = lane && target !== null && shown ? `${target.kind}:${target.id}` : ''
  useLayoutEffect(() => {
    if (at === '' || target === null) return
    return stayBeside(() => panel.current, target, { x: DETAILS_X, y: DETAILS_Y, h: DETAILS_H })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at])
  if (target === null || (card === null && link === null)) return null
  const title = card !== null ? card.heading : link!.title
  // The card's own ask action (the right-click menu's "Explain"), pointed at this card's canvas node.
  const node = card === null ? undefined : useCanvasStore.getState().nodes.find((n) => n.id === card.id)
  const ask = node === undefined ? null : () => ctx.act.ask({ kind: 'node', nodeId: node.id, nodeType: node.type as NodeTarget['nodeType'], node, screenPos: { x: 0, y: 0 } }, 'explain_element')
  const header = (
    <div className="flex items-start justify-between gap-2">
      <h2 className={`${typography.viewPanelBody} min-w-0 break-words text-text-header`} data-testid="lane-inspector-title">{title}</h2>
      <button type="button" aria-label="Close details" onClick={() => close()} className="grid h-6 w-6 flex-none cursor-pointer place-items-center rounded-sm text-text-light hover:bg-panel-hover"><X size={14} aria-hidden="true" /></button>
    </div>
  )
  const words = (
    <>
      {card === null ? null : (
        <>
          {card.detail === '' ? null : <p className="text-text-body" data-testid="lane-inspector-detail">{card.detail}</p>}
          {card.figure === null ? null : <p className="text-text-body" title={card.figure.title} data-testid="lane-inspector-figure">{card.figure.text}</p>}
          {lane ? <CardWords id={card.id} ids={{ author: 'lane-inspector-author', basis: 'lane-inspector-basis' }} /> : null}
          {/* Surfaces step 4: while these details are open the composer's selection row is the chip alone, so the option's next step (core's headline.add,
              whole) and its explanation (what it changes, what it rests on, the worked steps) are drawn here, by the same components, with the panel's own ids. */}
          {lane && card.family === 'option' && card.headline?.add != null && card.headline.add !== '' ? <p className="m-0 whitespace-pre-wrap break-words text-text-body" data-testid="lane-inspector-add">{card.headline.add}</p> : null}
          {lane && view !== null ? <SelectedExplain view={view} id={card.id} testid="lane-inspector-explain" /> : null}
          {card.olumi === null ? null : <p className={`${typography.viewPanelMeta} text-info`} data-testid="lane-inspector-source"><span aria-hidden="true">{card.olumi.glyph} </span>{card.olumi.title}</p>}
          {card.status === null ? null : <p className={`${typography.viewPanelMeta} text-text-light`}>{card.status}</p>}
          {lane ? <WhereYouDiffer card={card.id} /> : null}
          <FigureInspector card={card} range={range} onAsk={ask} onClose={() => close()} />
        </>
      )}
      {link === null ? null : (
        <>
          {link.size === undefined ? null : <p className="text-text-body" title={link.size.title} data-testid="lane-inspector-strength">{link.size.text}</p>}
          {lane ? <ValueRow key={target.id} item={{ kind: 'link', id: target.id, edit: link.size?.edit ?? null, subject: link.size?.text ?? '' }} /> : null}
          {link.causal?.author == null ? null : <p className={`${typography.viewPanelMeta} text-text-light`} title={link.causal.author.title} data-testid="lane-inspector-source">{link.causal.author.text}</p>}
        </>
      )}
      {rows.length === 0 ? null : (
        <div className="flex flex-wrap gap-1 pt-1" role="group" aria-label="Edit">
          {rows.map((r) => (
            <button key={r.id} type="button" title={r.tooltip} aria-disabled={!r.enabled || undefined} data-testid={`lane-inspector-${r.id}`} onClick={() => { if (r.enabled) r.action() }}
              className={`${typography.viewPanelMeta} min-h-[32px] cursor-pointer rounded-sm border border-panel-border px-2 text-text-body hover:bg-panel-hover aria-disabled:cursor-not-allowed aria-disabled:opacity-50`}>{r.label}</button>
          ))}
        </div>
      )}
    </>
  )
  const frame = `nodrag nopan fixed z-[60] w-[280px] rounded-lg border border-panel-border bg-panel p-3 shadow-2 ${typography.viewPanelBody}`
  // The older look: the fixed corner, one scrolling box, as before. The lane: beside the card, capped to the room there, the body scrolling under a header that stays.
  return lane ? (
    <aside ref={panel} role="complementary" aria-label="Details" data-testid="lane-inspector" data-kind={target.kind}
      className={`${frame} left-[var(--lane-details-x,76px)] top-[var(--lane-details-y,112px)] flex max-h-[min(60vh,var(--lane-details-h,60vh))] flex-col gap-2 overflow-hidden`}>
      {header}
      <div className="min-h-0 space-y-2 overflow-y-auto">{words}</div>
    </aside>
  ) : (
    <aside role="complementary" aria-label="Details" data-testid="lane-inspector" data-kind={target.kind}
      className={`${frame} left-[76px] top-[112px] max-h-[60vh] space-y-2 overflow-y-auto`}>
      {header}
      {words}
    </aside>
  )
}
