/**
 * The board: every node drawn at the width the layout gives it, measured, then placed by the ONE pure layout (./layout.ts, the look-proof's
 * geometry ported and tested against its own output). Positions and sizes are geometry data on the element; nothing else is styled here.
 */
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { View } from '../olumiView/client'
import { boardNodesOf, layoutBoard, type BoardLayout, type BoardViewport, type LastLine } from './layout'
import { AimSlot, CardNode, NoteNode, QuestionNode, Relayout } from './Cards'

const viewportNow = (board: HTMLElement | null): BoardViewport => ({
  w: window.innerWidth, h: window.innerHeight, scale: window.devicePixelRatio,
  ...(board ? { board: { w: board.clientWidth, h: board.clientHeight } } : {}),
})

/** Where the question's heading ends: its last line box, relative to the question node (the question's leader starts there). */
function lastLineOf(node: HTMLElement | null): LastLine | null {
  const h1 = node?.querySelector('h1')
  if (!node || !h1) return null
  const r = document.createRange(); r.selectNodeContents(h1)
  const rects = r.getClientRects(), last = rects[rects.length - 1], box = node.getBoundingClientRect()
  return last ? { right: last.right - box.left, top: last.top - box.top, height: last.height } : null
}

export function Board({ v, selected, flashing, onEdit }: { v: View; selected: string | null; flashing: string | null; onEdit: (id: string) => void }) {
  const board = useRef<HTMLElement | null>(null), stage = useRef<HTMLDivElement | null>(null)
  const [vp, setVp] = useState<BoardViewport>(() => viewportNow(null))
  const [geom, setGeom] = useState<BoardLayout | null>(null)
  const nodes = boardNodesOf(v, vp)
  const cards = new Map((v.model?.cards ?? []).map((c) => [c.id, c]))
  const allProposed = (v.model?.cards ?? []).length > 0 && (v.model?.cards ?? []).every((c) => c.change != null)

  const measure = useCallback(() => {
    const el = stage.current
    if (!el) return
    const next = viewportNow(board.current)
    const heights = new Map<string, number>()
    el.querySelectorAll<HTMLElement>(':scope > .node').forEach((n) => { const id = n.getAttribute('data-id'); if (id) heights.set(id, n.offsetHeight) })
    const q = el.querySelector<HTMLElement>(':scope > .nx-question')
    setVp((p) => (p.w === next.w && p.h === next.h && p.scale === next.scale && p.board?.w === next.board?.w && p.board?.h === next.board?.h ? p : next))
    setGeom(layoutBoard(v, heights, next, { questionLastLine: lastLineOf(q) }))
  }, [v])
  // Measured after every draw of the View, and again once the fonts have loaded and when the window changes.
  useLayoutEffect(() => { measure() }, [measure])
  useLayoutEffect(() => {
    void document.fonts?.ready.then(() => measure())
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [measure])

  const at = new Map((geom?.nodes ?? []).map((n) => [n.id, n]))
  const place = (id: string, w: number) => { const g = at.get(id); return g ? { left: g.x, top: g.y, width: g.w } : { left: 0, top: 0, width: w, visibility: 'hidden' as const } }
  const state = (id: string) => `${selected === id ? ' sel' : ''}${flashing === id ? ' flash' : ''}`
  const sw = geom?.stage.w, sh = geom?.stage.h
  return (
    <main className="nx-board" ref={board} data-testid="next-board">
      <Relayout.Provider value={measure}>
        <div className={`nx-stage${geom && !geom.wide ? ' compact' : ''}`} ref={stage} style={sw === undefined ? undefined : { width: sw, height: sh }}>
          <svg className="nx-wires" xmlns="http://www.w3.org/2000/svg" width={sw} height={sh}>
            <g>{(geom?.wires ?? []).map((w) => <g key={w.i}><path d={w.d} className={w.cls} data-from={w.from} data-to={w.to} /><path d={w.d} className="hit"><title>{(v.model?.links[w.i] as { title?: string } | undefined)?.title ?? ''}</title></path></g>)}</g>
            <g>{(geom?.wires ?? []).flatMap((w) => w.markers.map((m, j) => {
              const k = `${w.i}:${j}`
              if (m.kind === 'dot') return <circle key={k} cx={m.cx} cy={m.cy} r={m.r} className="dot" />
              if (m.kind === 'head') return <path key={k} d={m.d} className={m.cls} />
              if (m.kind === 'chip') return <g key={k} className="chip"><circle cx={m.cx} cy={m.cy} r={m.r} /><path d={m.d} /><title>{(v.model?.links[w.i]?.causal as { text?: string } | null | undefined)?.text ?? ''}</title></g>
              return <g key={k} className="wmark"><path d={m.d} /></g>
            }))}</g>
          </svg>
          {nodes.map((n) => {
            const style = place(n.id, n.w), extra = state(n.id)
            if (n.kind === 'question') return <QuestionNode key={n.id} v={v} style={style} extra={extra} />
            if (n.kind === 'aimslot') return <AimSlot key={n.id} v={v} style={style} />
            const c = cards.get(n.id)
            if (!c) return null
            return n.kind === 'note' ? <NoteNode key={n.id} v={v} c={c} style={style} extra={extra} /> : <CardNode key={n.id} v={v} c={c} allProposed={allProposed} onEdit={onEdit} style={style} extra={extra} />
          })}
        </div>
      </Relayout.Provider>
    </main>
  )
}
