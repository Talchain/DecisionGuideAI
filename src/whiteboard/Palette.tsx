import React from 'react'
import { useGraph } from '@/sandbox/state/graphStore'
import type { NodeType, Node } from '@/domain/graph'

export default function Palette({ getEditor }: { getEditor: () => any }) {
  const { upsertNode } = useGraph()

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
      {/* Connect mode will be added in commit 2 */}
    </div>
  )
}
