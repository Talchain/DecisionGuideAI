import React from 'react'
import { useFlags } from '@/lib/flags'
import { useGraph } from '@/sandbox/state/graphStore'
import type { Edge, EdgeKind, KrImpact, Node } from '@/domain/graph'

function useDebounced<T extends (...args: any[]) => void>(fn: T, wait = 300) {
  const t = React.useRef<number | null>(null)
  return React.useCallback((...args: Parameters<T>) => {
    if (t.current) window.clearTimeout(t.current)
    t.current = window.setTimeout(() => fn(...args), wait) as unknown as number
  }, [fn, wait])
}

export const InspectorPanel: React.FC = () => {
  const flags = useFlags()
  const { graph, selectedNodeId, selectedEdgeId, updateNodeFields, upsertEdge, setSelectedNode, setSelectedEdge } = useGraph()
  const [open, setOpen] = React.useState(true)

  if (!flags.sandboxMapping) return null

  const node: Node | undefined = selectedNodeId ? graph.nodes[selectedNodeId] : undefined
  const edge: Edge | undefined = selectedEdgeId ? graph.edges[selectedEdgeId] : undefined

  const debouncedUpdate = useDebounced(updateNodeFields, 300)

  return (
    <section aria-label="Inspector" role="region" className="border-t p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">Inspector</h3>
        <button className="text-xs underline" onClick={() => setOpen(v => !v)} aria-expanded={open} aria-controls="inspector-panel">{open ? 'Hide' : 'Show'}</button>
      </div>
      <div id="inspector-panel" className={open ? '' : 'hidden'}>
        {!node && !edge && (
          <div className="text-xs text-gray-500">No selection.</div>
        )}
        {node && (
          <div className="space-y-2">
            <div className="text-xs text-gray-600">Node: <span className="font-medium">{node.type}</span> ({node.id})</div>
            <label className="block text-xs mb-1">Title
              <input className="mt-0.5 w-full text-xs border rounded px-2 py-1" value={node.title} onChange={(e) => debouncedUpdate(node.id, { title: e.target.value })} />
            </label>
            <label className="block text-xs mb-1">Notes
              <textarea className="mt-0.5 w-full text-xs border rounded px-2 py-1" value={node.notes || ''} onChange={(e) => debouncedUpdate(node.id, { notes: e.target.value })} />
            </label>
            <div className="mt-2">
              <div className="text-xs font-medium mb-1">KR Impacts</div>
              <KRTable node={node} onChange={(next) => debouncedUpdate(node.id, { krImpacts: next })} />
            </div>
            <div className="flex gap-2">
              <button className="px-2 py-1 text-xs rounded border bg-white hover:bg-gray-50" onClick={() => setSelectedNode(null)}>Clear selection</button>
            </div>
          </div>
        )}
        {!node && edge && (
          <div className="space-y-2">
            <div className="text-xs text-gray-600">Edge: <span className="font-medium">{edge.id}</span></div>
            <label className="block text-xs mb-1">Kind
              <select className="mt-0.5 w-full text-xs border rounded px-2 py-1" value={edge.kind} onChange={(e) => upsertEdge({ ...edge, kind: e.target.value as EdgeKind })}>
                <option value="supports">supports</option>
                <option value="causes">causes</option>
                <option value="mitigates">mitigates</option>
                <option value="impactsKR">impactsKR</option>
              </select>
            </label>
            <label className="block text-xs mb-1">Notes
              <textarea className="mt-0.5 w-full text-xs border rounded px-2 py-1" value={edge.notes || ''} onChange={(e) => upsertEdge({ ...edge, notes: e.target.value })} />
            </label>
            <div className="flex gap-2">
              <button className="px-2 py-1 text-xs rounded border bg-white hover:bg-gray-50" onClick={() => setSelectedEdge(null)}>Clear selection</button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function KRTable({ node, onChange }: { node: Node; onChange: (next: KrImpact[]) => void }) {
  const list = node.krImpacts || []
  const updateAt = (idx: number, patch: Partial<KrImpact>) => {
    const next = list.map((k, i) => i === idx ? { ...k, ...patch } : k)
    onChange(next)
  }
  const add = () => onChange([ ...list, { krId: 'kr', deltaP50: 0, confidence: 0 } ])
  const remove = (idx: number) => onChange(list.filter((_, i) => i !== idx))

  return (
    <div className="space-y-2">
      {list.map((k, i) => (
        <div key={i} className="grid grid-cols-[1fr_120px_120px_40px] gap-2 items-center">
          <input aria-label={`KR ${i+1} id`} className="text-xs border rounded px-2 py-1" value={k.krId} onChange={(e) => updateAt(i, { krId: e.target.value })} />
          <label className="text-[10px] text-gray-600">Δ P50
            <input aria-label={`KR ${i+1} delta`} type="range" min={-1} max={1} step={0.1} className="w-full" value={k.deltaP50} onChange={(e) => updateAt(i, { deltaP50: Number(e.target.value) })} />
          </label>
          <label className="text-[10px] text-gray-600">Confidence
            <input aria-label={`KR ${i+1} confidence`} type="range" min={0} max={1} step={0.1} className="w-full" value={k.confidence} onChange={(e) => updateAt(i, { confidence: Number(e.target.value) })} />
          </label>
          <button aria-label="Remove KR" className="px-2 py-1 text-xs rounded border bg-white hover:bg-gray-50" onClick={() => remove(i)}>×</button>
        </div>
      ))}
      <button className="px-2 py-1 text-xs rounded border bg-white hover:bg-gray-50" onClick={add}>Add KR</button>
    </div>
  )
}

export default InspectorPanel
