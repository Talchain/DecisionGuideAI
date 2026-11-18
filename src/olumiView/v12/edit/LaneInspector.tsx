/**
 * THE LANE'S DETAILS PANEL (V12 manual editing): one small floating panel for the card or link the person opened ("Open details" in the
 * right-click menu). It is not a strip and not the legacy inspector (which reads the previous product's node shapes, a View card carries none):
 * it draws core's own words for the item (its heading, figure, whose estimate it is, what the line says) and offers only the edits core takes,
 * each through the one small form (./EditForm.tsx) and so through the real route. Editing works at every level (Simple or the whole model).
 *
 * "Take out of comparison" is NOT offered: core has no route for an option's status or an exclusion (MANUAL-EDITING-MAP, headline 4).
 */
import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { typography } from '../../../styles/typography'
import { cardEditRows, edgeIdOf, linkEditRows } from '../../../canvas/contextMenu/laneMenu'
import { useLaneCtx } from '../../../canvas/contextMenu/useLaneMenu'
import { useShowToast } from '../../../canvas/ToastContext'
import { useCanvasStore } from '../../../canvas/store'
import type { NodeTarget } from '../../../canvas/contextMenu/types'
import type { ViewCard } from '../../client'
import type { FigureRange } from '../contract'
import { FigureInspector } from '../inspect/FigureInspector'
import { useViewStore } from '../../store'
import { writeKeyOf, type EditSpec } from './EditForm'
import { CardWords } from '../../SelectedRename'
import { detailsOf, useLaneInspector } from './inspectorStore'
import { DETAILS_WIDTH, DETAILS_X, DETAILS_Y, anchorOf, freeCanvas, placeBeside } from './placeBeside'

const NOOP = () => undefined
/** The one small form, from the details panel's buttons: it takes the panel's place (one thing open at a time), at the panel's own position (never a fixed corner). */
const openFormHere = (spec: EditSpec): void => {
  const el = document.querySelector<HTMLElement>('[data-testid="lane-inspector"]')
  const x = parseFloat(el?.style.getPropertyValue(DETAILS_X) ?? ''), y = parseFloat(el?.style.getPropertyValue(DETAILS_Y) ?? '')
  const free = freeCanvas()
  useLaneInspector.getState().show({ kind: 'form', spec, anchor: { x: Number.isNaN(x) ? free.left + 8 : x, y: Number.isNaN(y) ? free.top + 8 : y }, busyKey: writeKeyOf(spec) })
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
  const rows = useMemo(() => (card !== null ? cardEditRows(card, ctx) : link !== null ? linkEditRows(link, ctx) : []), [card, link, ctx])
  // BESIDE ITS ITEM, AND IT FOLLOWS (surfaces step 3): placed before paint, then re-placed whenever the item, the panel or the free canvas moves
  // (a pan, a zoom, a relayout), as the hover pop-up is. It never stays behind over a card that has moved on; an item off the free canvas leaves it in the corner.
  const shown = target !== null && (card !== null || link !== null)
  const panel = useRef<HTMLElement>(null)
  const at = target !== null && shown ? `${target.kind}:${target.id}` : ''
  useLayoutEffect(() => {
    if (at === '' || target === null) return
    let raf = 0, last = ''
    const place = () => {
      const el = panel.current
      if (el !== null) {
        const { anchor, own } = anchorOf(target), free = freeCanvas(), box = el.getBoundingClientRect()
        const size = { width: box.width > 0 ? box.width : DETAILS_WIDTH, height: box.height }
        const key = [anchor?.left, anchor?.top, anchor?.right, anchor?.bottom, size.width, size.height, free.left, free.top, free.right, free.bottom].join('|')
        if (key !== last) {
          last = key
          const p = placeBeside(anchor, own, size, free)
          el.style.setProperty(DETAILS_X, `${p.left}px`); el.style.setProperty(DETAILS_Y, `${p.top}px`)
        }
      }
      raf = requestAnimationFrame(place)
    }
    place()
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at])
  if (target === null || (card === null && link === null)) return null
  const title = card !== null ? card.heading : link!.title
  // The card's own ask action (the right-click menu's "Explain"), pointed at this card's canvas node.
  const node = card === null ? undefined : useCanvasStore.getState().nodes.find((n) => n.id === card.id)
  const ask = node === undefined ? null : () => ctx.act.ask({ kind: 'node', nodeId: node.id, nodeType: node.type as NodeTarget['nodeType'], node, screenPos: { x: 0, y: 0 } }, 'explain_element')
  return (
    <aside ref={panel} role="complementary" aria-label="Details" data-testid="lane-inspector" data-kind={target.kind}
      className={`nodrag nopan fixed left-[var(--lane-details-x,76px)] top-[var(--lane-details-y,112px)] z-[60] max-h-[60vh] w-[280px] space-y-2 overflow-y-auto rounded-lg border border-panel-border bg-panel p-3 shadow-2 ${typography.viewPanelBody}`}>
      <div className="flex items-start justify-between gap-2">
        <h2 className={`${typography.viewPanelBody} min-w-0 break-words text-text-header`} data-testid="lane-inspector-title">{title}</h2>
        <button type="button" aria-label="Close details" onClick={() => close()} className="grid h-6 w-6 flex-none cursor-pointer place-items-center rounded-sm text-text-light hover:bg-panel-hover"><X size={14} aria-hidden="true" /></button>
      </div>
      {card === null ? null : (
        <>
          {card.detail === '' ? null : <p className="text-text-body" data-testid="lane-inspector-detail">{card.detail}</p>}
          {card.figure === null ? null : <p className="text-text-body" title={card.figure.title} data-testid="lane-inspector-figure">{card.figure.text}</p>}
          <CardWords id={card.id} ids={{ author: 'lane-inspector-author', basis: 'lane-inspector-basis' }} />
          {card.olumi === null ? null : <p className={`${typography.viewPanelMeta} text-info`} data-testid="lane-inspector-source"><span aria-hidden="true">{card.olumi.glyph} </span>{card.olumi.title}</p>}
          {card.status === null ? null : <p className={`${typography.viewPanelMeta} text-text-light`}>{card.status}</p>}
          <FigureInspector card={card} range={range} onAsk={ask} onClose={() => close()} />
        </>
      )}
      {link === null ? null : (
        <>
          {link.size === undefined ? null : <p className="text-text-body" title={link.size.title} data-testid="lane-inspector-strength">{link.size.text}</p>}
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
    </aside>
  )
}
