/**
 * Vision spec §3 (23 Oct, PR G): "Since the last run" moves off the canvas foot and onto the cards it is about. Each card a
 * rerun's input rows land on carries a small pencil, just above its top-right corner; hovering it gives that card's change,
 * pressing it opens the run's ONE summary (`RunChangesSummary`, now a popover beside the pencil) with every row, Moved, Why,
 * Still uncertain and Open in Compare. A link row marks its target card ("A link into this changed"). Rows with nothing on
 * the canvas stay as lines in that popover; when no row lands on a card, no pencil is drawn and the strip stays.
 *
 * ⛔ No new truth: the rows are `useDisplayedRunDeltaView`'s (the strip's and Compare's one reader), placed by
 * `canvasLinkOfRow` (ids only). Render-only, in SCREEN space over the pane (a `<ReactFlow>` child, outside the transform,
 * so the pencil keeps one size at every zoom): never in `nodes`/`edges`.
 */
import { memo, useEffect, useMemo } from 'react'
import { useNodes, useStore } from '@xyflow/react'
import { Pencil } from 'lucide-react'
import { create } from 'zustand'

import { useCanvasStore } from '../store'
import { useDisplayedRunDeltaView } from '../../components/results/analysisNew/displayedRunDeltaView'
import { inputRowText } from '../../components/results/analysisNew/sections/WhatsChanged'
import { RUN_CHANGES_SUMMARY_COPY } from './runChangesSummaryLines'
import { canvasLinkOfRow } from './rowCanvasLink'

export const RUN_CHANGE_PENCIL_TESTID = 'run-change-pencil'
export const RUN_CHANGE_PENCIL_COPY = {
  linkInto: 'A link into this changed',
  open: 'Show what changed since the last run',
} as const

interface PencilState {
  /** How many cards carry a pencil now. 0 = the strip keeps the canvas foot. */
  readonly drawn: number
  /** The pressed pencil's screen box while the summary is open beside it; null = closed. */
  readonly anchor: { readonly left: number; readonly top: number; readonly bottom: number } | null
  setDrawn: (n: number) => void
  open: (anchor: { left: number; top: number; bottom: number }) => void
  close: () => void
}

export const useRunChangePencilStore = create<PencilState>((set) => ({
  drawn: 0,
  anchor: null,
  setDrawn: (drawn) => set(drawn === 0 ? { drawn, anchor: null } : { drawn }),
  open: (anchor) => set({ anchor }),
  close: () => set({ anchor: null }),
}))

/** Each card's change lines, keyed by node id: a node row on its card; a link row on the link's target card. */
export function pencilLinesByCard(
  rows: ReadonlyArray<Parameters<typeof canvasLinkOfRow>[0]>,
  edges: ReadonlyArray<{ id: string; target: string }>,
): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const row of rows) {
    const t = canvasLinkOfRow(row)?.target
    const cardId = t?.kind === 'node' ? t.id : t?.kind === 'edge' ? edges.find((e) => e.id === t.id)?.target : undefined
    if (cardId === undefined) continue
    const text = t?.kind === 'edge' ? `${RUN_CHANGE_PENCIL_COPY.linkInto}: ${inputRowText(row)}` : inputRowText(row)
    out.set(cardId, [...(out.get(cardId) ?? []), text])
  }
  return out
}

export const RunChangePencilLayer = memo(function RunChangePencilLayer() {
  const responseHash = useCanvasStore((s) => s.results?.hash ?? null)
  const edges = useCanvasStore((s) => s.edges)
  const view = useDisplayedRunDeltaView(responseHash)
  const nodes = useNodes()
  const [tx, ty, zoom] = useStore((s) => s.transform)
  const setDrawn = useRunChangePencilStore((s) => s.setDrawn)
  const open = useRunChangePencilStore((s) => s.open)
  const byCard = useMemo(
    () => pencilLinesByCard(view?.inputs?.rows ?? [], edges),
    // `nodes` re-places the rows when cards come and go (canvasLinkOfRow reads the store's graph).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [view, edges, nodes],
  )
  const marks = nodes.filter((n) => byCard.has(n.id))
  useEffect(() => setDrawn(marks.length), [marks.length, setDrawn])
  useEffect(() => () => setDrawn(0), [setDrawn])
  if (marks.length === 0) return null
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 5 }}>
      {marks.map((n) => {
        const lines = byCard.get(n.id)!.join(' · ')
        const w = n.measured?.width ?? n.width ?? 0
        return (
          <button
            key={n.id}
            type="button"
            data-testid={`${RUN_CHANGE_PENCIL_TESTID}-${n.id}`}
            title={`${RUN_CHANGES_SUMMARY_COPY.title}: ${lines}`}
            aria-label={`${RUN_CHANGES_SUMMARY_COPY.title}: ${lines}. ${RUN_CHANGE_PENCIL_COPY.open}`}
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect()
              open({ left: r.left, top: r.top, bottom: r.bottom })
            }}
            className="nodrag nopan absolute flex items-center justify-center rounded-full border border-panel-border bg-panel text-text-body shadow-1 hover:text-text-header focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info"
            style={{
              left: (n.position.x + w) * zoom + tx,
              top: n.position.y * zoom + ty,
              transform: 'translate(-100%, calc(-100% - 4px))',
              width: 20,
              height: 20,
              pointerEvents: 'auto',
            }}
          >
            <Pencil aria-hidden="true" style={{ width: '60%', height: '60%' }} />
          </button>
        )
      })}
    </div>
  )
})
