/**
 * THE LANE'S DETAILS PANEL (V12 manual editing): one small floating panel for the card or link the person opened ("Open details" in the
 * right-click menu). It is not a strip and not the legacy inspector (which reads the previous product's node shapes, a View card carries none):
 * it draws core's own words for the item (its heading, figure, whose estimate it is, what the line says) and offers only the edits core takes,
 * each through the one small form (./EditForm.tsx) and so through the real route. Editing works at every level (Simple or the whole model).
 *
 * "Take out of comparison" is NOT offered: core has no route for an option's status or an exclusion (MANUAL-EDITING-MAP, headline 4).
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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
import { LaneEditForm, type EditSpec } from './EditForm'
import { useLaneInspector } from './inspectorStore'

const NOOP = () => undefined

/** `range`: the slot for a figure's range chart (the scale lane's RangeBar); called only for a card whose View carries a numeric range. */
export function LaneInspector({ range }: { range?: (card: ViewCard, r: FigureRange) => ReactNode } = {}): JSX.Element | null {
  const target = useLaneInspector((s) => s.target), close = useLaneInspector((s) => s.close)
  const view = useViewStore((s) => s.view), sid = useViewStore((s) => s.sid)
  const showToast = useShowToast()
  const [form, setForm] = useState<EditSpec | null>(null)
  const ctx = useLaneCtx({ showToast, onClose: NOOP, openForm: setForm })
  // Another scenario, or the item gone from the model: the panel closes rather than show what is not there.
  const model = view?.model ?? null
  const card = target?.kind === 'card' ? model?.cards.find((c) => c.id === target.id) ?? null : null
  const link = target?.kind === 'link' ? model?.links.find((l) => edgeIdOf(l) === target.id) ?? null : null
  const lastSid = useRef(sid)
  useEffect(() => { if (lastSid.current !== sid) { lastSid.current = sid; close() } }, [sid, close])
  useEffect(() => { if (target !== null && card === null && link === null) close() }, [target, card, link, close])
  useEffect(() => {
    if (target === null) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && form === null) close() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [target, form, close])
  const rows = useMemo(() => (card !== null ? cardEditRows(card, ctx) : link !== null ? linkEditRows(link, ctx) : []), [card, link, ctx])
  if (target === null || (card === null && link === null)) return null
  const title = card !== null ? card.heading : link!.title
  // The card's own ask action (the right-click menu's "Explain"), pointed at this card's canvas node.
  const node = card === null ? undefined : useCanvasStore.getState().nodes.find((n) => n.id === card.id)
  const ask = node === undefined ? null : () => ctx.act.ask({ kind: 'node', nodeId: node.id, nodeType: node.type as NodeTarget['nodeType'], node, screenPos: { x: 0, y: 0 } }, 'explain_element')
  return (
    <>
      <aside role="complementary" aria-label="Details" data-testid="lane-inspector" data-kind={target.kind}
        className={`nodrag nopan fixed left-[76px] top-[112px] z-[60] max-h-[60vh] w-[280px] space-y-2 overflow-y-auto rounded-lg border border-panel-border bg-panel p-3 shadow-2 ${typography.viewPanelBody}`}>
        <div className="flex items-start justify-between gap-2">
          <h2 className={`${typography.viewPanelBody} min-w-0 break-words text-text-header`} data-testid="lane-inspector-title">{title}</h2>
          <button type="button" aria-label="Close details" onClick={close} className="grid h-6 w-6 flex-none cursor-pointer place-items-center rounded-sm text-text-light hover:bg-panel-hover"><X size={14} aria-hidden="true" /></button>
        </div>
        {card === null ? null : (
          <>
            {card.detail === '' ? null : <p className="text-text-body" data-testid="lane-inspector-detail">{card.detail}</p>}
            {card.figure === null ? null : <p className="text-text-body" title={card.figure.title} data-testid="lane-inspector-figure">{card.figure.text}</p>}
            {card.olumi === null ? null : <p className={`${typography.viewPanelMeta} text-info`} data-testid="lane-inspector-source"><span aria-hidden="true">{card.olumi.glyph} </span>{card.olumi.title}</p>}
            {card.status === null ? null : <p className={`${typography.viewPanelMeta} text-text-light`}>{card.status}</p>}
            <FigureInspector card={card} range={range} onAsk={ask} onClose={close} />
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
      {form === null ? null : <LaneEditForm spec={form} anchor={{ x: 372, y: 112 }} onClose={() => setForm(null)} />}
    </>
  )
}
