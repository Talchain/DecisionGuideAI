/**
 * THE LANE'S KEY (DL 4 Nov): "How to read this" on the olumi-core lane draws core's own key, `model.key` in the View (the page's KEY as
 * data: each glyph and its words, in the page's order). Nothing is written here: no glyph, no meaning, no order of DGAI's. With no key in
 * the View (no model yet) it draws nothing. Off the lane the legacy `CanvasLegendPopover` stays.
 */
import { useEffect, useRef } from 'react'
import { typography } from '../styles/typography'
import { useViewStore } from './store'

type Props = { open: boolean; onOpenChange: (open: boolean) => void }

export function ViewLegend({ open, onOpenChange }: Props) {
  const key = useViewStore((s) => s.view?.model?.key ?? null)
  const wrap = useRef<HTMLDivElement>(null)
  // Escape or a press outside closes it, as the legacy key does.
  useEffect(() => {
    if (!open) return
    const onPointer = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) onOpenChange(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onOpenChange(false) }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onPointer); document.removeEventListener('keydown', onKey) }
  }, [open, onOpenChange])
  if (!open || key === null || key.length === 0) return null
  return (
    <div ref={wrap} className="relative w-full">
      <div role="dialog" aria-label="How to read this" data-testid="view-legend"
        className="absolute left-full ml-2 bottom-0 w-72 flex flex-col max-h-[calc(100vh-96px)] bg-panel border border-panel-border rounded-lg shadow-3 p-3 z-[1200]">
        <div className={`${typography.viewPanelMeta} text-text-body font-medium mb-2 shrink-0`}>How to read this</div>
        <ul className="min-h-0 overflow-y-auto overscroll-contain grid grid-cols-2 gap-x-3 gap-y-1">
          {key.map((k, i) => (
            <li key={i} className={`${typography.viewPanelBody} text-text-body flex items-baseline gap-1.5`} data-view-key={i}>
              <span className="min-w-6 shrink-0 whitespace-nowrap text-center" aria-hidden="true">{k.glyph}</span><span>{k.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
