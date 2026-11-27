/**
 * THE LANE'S KEY (DL 4 Nov): "How to read this" on the olumi-core lane draws core's own key, `model.key` in the View (the page's KEY as
 * data: each glyph and its words, in the page's order), with link notation shown in the live samples. Off the lane the legacy `CanvasLegendPopover` stays.
 */
import { Hover } from './look/Hover'
import { useEffect, useRef } from 'react'
import { typography } from '../styles/typography'
import { useViewStore } from './store'
import { NodeShapeIndicator } from '../canvas/nodes/NodeShapeIndicator'
import type { NodeType } from '../canvas/domain/nodes'
import { KeyLines, LINK_KEY_IDS } from './v12/bands/KeyPill'

/** A key item that names a card kind is drawn with the card's own marker (the shape on the canvas), by core's item id; core's words stay the
 *  label. Every other item keeps core's glyph (17 Nov: a limit read as a goal; the key now shows the limit's outlined square, the aim's diamond). */
const KIND_MARK: Readonly<Record<string, { kind: NodeType; dashed?: boolean }>> = {
  option: { kind: 'option' }, aim: { kind: 'goal' }, limit: { kind: 'constraint' }, risk: { kind: 'risk' },
  figure: { kind: 'factor' }, worked_out: { kind: 'outcome' }, assumption: { kind: 'factor', dashed: true },
  claim: { kind: 'factor' }, evidence: { kind: 'factor' }, dissent: { kind: 'factor' }, prerequisite: { kind: 'factor' }, outside_model: { kind: 'factor' },
}

type Props = { open: boolean; onOpenChange: (open: boolean) => void }

export function ViewLegend({ open, onOpenChange }: Props) {
  const model = useViewStore((s) => s.view?.model ?? null)
  // The chance rail's band (CoreCard ChanceRail, UI-BRIEF-20261115 §3), in core's own line on what every driver low/high is, said once here
  // where the board's marks are read; only when some option card draws a band.
  const sensitivity = useViewStore((s) => {
    const m = s.view?.model ?? null
    const banded = (m?.cards ?? []).some((c) => c.family === 'option' && c.rows.some((r) => r.kind === 'chance' && (r as { driver?: unknown }).driver != null))
    return banded ? m?.run?.sensitivity ?? null : null
  })
  const wrap = useRef<HTMLDivElement>(null)
  // Escape or a press outside closes it, as the legacy key does.
  useEffect(() => {
    if (!open) return
    const onPointer = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) onOpenChange(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); onOpenChange(false) } }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onPointer); document.removeEventListener('keydown', onKey) }
  }, [open, onOpenChange])
  if (!open || model === null) return null
  return (
    <div ref={wrap} className="relative w-full">
      <div role="dialog" aria-label="How to read this" data-testid="view-legend"
        className="ok-float absolute left-full ml-2 bottom-0 w-72 flex flex-col max-h-[calc(100vh-96px)] z-[1200]">
        <div className={`${typography.viewPanelMeta} text-text-body font-medium shrink-0`}>How to read this</div>
        <div className="min-h-0 overflow-y-auto overscroll-contain">
          <div className="border-b border-panel-border pb-2"><KeyLines /></div>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
            {(model.key ?? []).map((k, i) => LINK_KEY_IDS.has(k.id) ? null : (
              <li key={i} className={`${typography.viewPanelBody} text-text-body flex items-baseline gap-1.5`} data-view-key={i}>
                <span className="min-w-6 shrink-0 whitespace-nowrap text-center" aria-hidden="true" data-key-mark={KIND_MARK[k.id] === undefined ? undefined : KIND_MARK[k.id]!.kind}>
                  {KIND_MARK[k.id] === undefined ? k.glyph : <NodeShapeIndicator nodeKind={KIND_MARK[k.id]!.kind} dashedOutline={KIND_MARK[k.id]!.dashed === true} size={12} className="inline-block align-[-1px]" />}
                </span><span>{k.text}</span>
              </li>
            ))}
          </ul>
        </div>
        {sensitivity === null ? null : (
          <Hover as="p" className={`${typography.viewPanelBody} text-text-body pt-2 border-t border-panel-border flex items-baseline gap-1.5`} words={sensitivity.title} data-view="run.sensitivity.text" data-view-key-rail="">
            <span aria-hidden="true" className="relative inline-block h-2.5 w-6 shrink-0 rounded-sm border-x-[1.5px] border-[rgba(130,120,187,0.55)] bg-[rgba(130,120,187,0.18)]" />
            <span>{sensitivity.text}</span>
          </Hover>
        )}
      </div>
    </div>
  )
}
