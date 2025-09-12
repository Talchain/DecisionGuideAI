import React from 'react'
import { Tldraw } from '@/whiteboard/tldraw'
import { createDomainMapping } from '@/whiteboard/domainMapping'
import type { Graph } from '@/domain/graph'
import { useGraph } from '@/sandbox/state/graphStore'
import { diffGraphs } from '@/domain/graphDiff'

function keySnap(decisionId: string, snapId: string) { return `dgai:graph:snap:${decisionId}:${snapId}` }

type CompareViewProps = {
  decisionId: string
  left: string // 'current' or snapId
  right: string // 'current' or snapId
  onPick: (left: string, right: string) => void
  onOpened: () => void
  onClose: () => void
}

export default function CompareView({ decisionId, left, right, onPick, onOpened, onClose }: CompareViewProps) {
  const { graph, listSnapshots } = useGraph()
  const [opened, setOpened] = React.useState(false)
  const [selLeft, setSelLeft] = React.useState(left)
  const [selRight, setSelRight] = React.useState(right)

  const loadGraph = React.useCallback((token: string): Graph => {
    if (token === 'current') return graph
    try {
      const raw = localStorage.getItem(keySnap(decisionId, token))
      if (!raw) return { schemaVersion: 1, nodes: {}, edges: {} }
      return JSON.parse(raw)
    } catch { return { schemaVersion: 1, nodes: {}, edges: {} } }
  }, [graph, decisionId])

  const gLeft = loadGraph(opened ? left : selLeft)
  const gRight = loadGraph(opened ? right : selRight)
  const d = diffGraphs(gLeft, gRight)

  return (
    <div className="w-full h-full flex flex-col" data-dg-compare-root>
      <style>{`
        [data-dg-diff="true"] [data-dg-diff-chip="added"]{ color:#065f46; border-color:#10b981; background:#ecfdf5 }
        [data-dg-diff="true"] [data-dg-diff-chip="removed"]{ color:#7f1d1d; border-color:#f87171; background:#fef2f2 }
        [data-dg-diff="true"] [data-dg-diff-chip="changed"]{ color:#92400e; border-color:#f59e0b; background:#fffbeb }
      `}</style>
      <div className="border-b p-2 flex items-center gap-2 text-xs bg-white/90">
        <div className="font-semibold">Compare</div>
        <label className="inline-flex items-center gap-1">Left
          <select className="border rounded px-1 py-0.5" value={selLeft} onChange={(e) => setSelLeft(e.target.value)}>
            <option value="current">Current</option>
            {(listSnapshots() || []).map(s => (<option key={s.id} value={s.id}>{s.name}</option>))}
          </select>
        </label>
        <label className="inline-flex items-center gap-1">Right
          <select className="border rounded px-1 py-0.5" value={selRight} onChange={(e) => setSelRight(e.target.value)}>
            <option value="current">Current</option>
            {(listSnapshots() || []).map(s => (<option key={s.id} value={s.id}>{s.name}</option>))}
          </select>
        </label>
        {!opened && (
          <button className="ml-2 px-2 py-1 border rounded bg-white hover:bg-gray-50" onClick={() => { onPick(selLeft, selRight); setOpened(true); onOpened() }}>Open</button>
        )}
        {opened && (
          <button className="ml-2 px-2 py-1 border rounded bg-white hover:bg-gray-50" onClick={() => { setOpened(false); onClose() }}>Close</button>
        )}
        <div className="ml-auto inline-flex items-center gap-2">
          <span className="px-1.5 py-0.5 border rounded bg-white" title="Added">+ Added</span>
          <span className="px-1.5 py-0.5 border rounded bg-white" title="Removed">– Removed</span>
          <span className="px-1.5 py-0.5 border rounded bg-white" title="Changed">~ Changed</span>
        </div>
      </div>
      <div className="flex-1 grid grid-cols-2 gap-2 p-2">
        {opened ? (
          <>
            <ComparePane
              decisionId={decisionId}
              graph={gLeft}
              nodesAdded={[]}
              nodesRemoved={d.nodes.removed}
              nodesChanged={d.nodes.changed}
              edgesAdded={[]}
              edgesRemoved={d.edges.removed}
              edgesChanged={d.edges.changed}
              label="Left"
            />
            <ComparePane
              decisionId={decisionId}
              graph={gRight}
              nodesAdded={d.nodes.added}
              nodesRemoved={[]}
              nodesChanged={d.nodes.changed}
              edgesAdded={d.edges.added}
              edgesRemoved={[]}
              edgesChanged={d.edges.changed}
              label="Right"
            />
          </>
        ) : (
          <div className="col-span-2 text-center text-xs text-gray-600 p-6">Pick sources and click Open to start comparing.</div>
        )}
      </div>
    </div>
  )
}

function ComparePane({ decisionId, graph, nodesAdded, nodesRemoved, nodesChanged, edgesAdded, edgesRemoved, edgesChanged, label }: { decisionId: string; graph: Graph; nodesAdded: string[]; nodesRemoved: string[]; nodesChanged: string[]; edgesAdded: string[]; edgesRemoved: string[]; edgesChanged: string[]; label: string }) {
  const rootRef = React.useRef<HTMLDivElement | null>(null)
  const editorRef = React.useRef<any | null>(null)
  const mappingRef = React.useRef<ReturnType<typeof createDomainMapping> | null>(null)

  const onMount = React.useCallback((editor: any) => {
    editorRef.current = editor
    try { editor.updateInstanceState?.({ isReadonly: true }) } catch {}
    mappingRef.current = createDomainMapping({ editor, decisionId, sessionId: 'compare', track: () => {} })
    mappingRef.current.rebuildFromGraph(graph)
  }, [decisionId, graph])

  React.useEffect(() => {
    try { mappingRef.current?.rebuildFromGraph(graph) } catch {}
  }, [graph])

  // Overlay chips positioned via node.view (non-blocking)
  return (
    <div ref={rootRef} className="relative w-full h-full" data-dg-diff="true" aria-label={`Compare Pane ${label}`}>
      <Tldraw onMount={onMount} />
      {/* Non-blocking overlay */}
      <div className="pointer-events-none absolute inset-0">
        {Object.values(graph.nodes).map(n => {
          const pos = { x: n.view?.x ?? 0, y: n.view?.y ?? 0 }
          let chip: 'added' | 'removed' | 'changed' | null = null
          if (nodesAdded.includes(n.id)) chip = 'added'
          else if (nodesRemoved.includes(n.id)) chip = 'removed'
          else if (nodesChanged.includes(n.id)) chip = 'changed'
          if (!chip) return null
          return (
            <span key={n.id} data-dg-diff-chip={chip} className={`absolute text-[10px] px-1.5 py-0.5 rounded border bg-white shadow`} style={{ left: pos.x + 4, top: pos.y + 4 }}>
              {chip === 'added' ? '+' : chip === 'removed' ? '–' : 'Δ'}
            </span>
          )
        })}
        {/* Edge chips at midpoints */}
        {Object.values(graph.edges).map(e => {
          let chip: 'added' | 'removed' | 'changed' | null = null
          if (edgesAdded.includes(e.id)) chip = 'added'
          else if (edgesRemoved.includes(e.id)) chip = 'removed'
          else if (edgesChanged.includes(e.id)) chip = 'changed'
          if (!chip) return null
          const from = graph.nodes[e.from]
          const to = graph.nodes[e.to]
          if (!from || !to) return null
          const fx = (from.view?.x ?? 0) + (from.view?.w ?? 120) / 2
          const fy = (from.view?.y ?? 0) + (from.view?.h ?? 60) / 2
          const tx = (to.view?.x ?? 0) + (to.view?.w ?? 120) / 2
          const ty = (to.view?.y ?? 0) + (to.view?.h ?? 60) / 2
          const mx = (fx + tx) / 2
          const my = (fy + ty) / 2
          return (
            <span key={e.id} data-dg-diff-chip={chip} className={`absolute text-[10px] px-1.5 py-0.5 rounded border bg-white shadow`} style={{ left: mx, top: my }}>
              {chip === 'added' ? '+' : chip === 'removed' ? '–' : '~'}
            </span>
          )
        })}
      </div>
    </div>
  )
}
