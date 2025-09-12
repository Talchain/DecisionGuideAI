import React from 'react'
import { useGraph } from '@/sandbox/state/graphStore'
import type { NodeType, Node, Edge } from '@/domain/graph'

export default function Palette({ getEditor: _getEditor, connect }: { getEditor: () => any; connect?: { active: boolean; toggle: () => void } }) {
  const { upsertNode, upsertEdge, graph } = useGraph()

  const addNode = (type: NodeType) => () => {
    const id = `n_${Math.random().toString(36).slice(2, 8)}`
    const title = `${type}`
    const node: Node = { id, type, title, view: {} }
    upsertNode(node)
  }

  return (
    <div className="flex gap-1 bg-white/90 border rounded shadow-sm p-1">
      <button aria-label="Add Problem" title="Problem" data-testid="pal-problem" className="px-2 py-1 text-xs rounded border bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500" onClick={addNode('Problem')}>Problem</button>
      <button aria-label="Add Option" title="Option" data-testid="pal-option" className="px-2 py-1 text-xs rounded border bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500" onClick={addNode('Option')}>Option</button>
      <button aria-label="Add Action" title="Action" data-testid="pal-action" className="px-2 py-1 text-xs rounded border bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500" onClick={addNode('Action')}>Action</button>
      <button aria-label="Add Outcome" title="Outcome" data-testid="pal-outcome" className="px-2 py-1 text-xs rounded border bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500" onClick={addNode('Outcome')}>Outcome</button>
      <button aria-label="Connect" title="Connect (supports)" data-testid="pal-connect" className="px-2 py-1 text-xs rounded border bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500" onClick={() => {
        const ids = Object.keys(graph.nodes)
        if (ids.length < 2) return
        const [from, to] = ids.slice(0, 2)
        const e: Edge = { id: `e_${Math.random().toString(36).slice(2,8)}` , from, to, kind: 'supports' }
        upsertEdge(e)
      }}>Connect</button>
      {connect && (
        <button aria-label="Connect Mode" title="Connect Mode" data-testid="pal-connect-mode" aria-pressed={connect.active} className={`px-2 py-1 text-xs rounded border focus:outline-none focus:ring-2 ${connect.active ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white hover:bg-gray-50'}`} onClick={connect.toggle}>
          Connect Mode
        </button>
      )}
    </div>
  )
}
