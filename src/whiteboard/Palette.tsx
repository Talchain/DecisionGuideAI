import React from 'react'
import { useGraph } from '@/sandbox/state/graphStore'
import { useFlags } from '@/lib/flags'
import { useToast } from '@/components/ui/use-toast'
import { draftScenario } from '@/sandbox/ai/draft'
import type { NodeType, Node, Edge } from '@/domain/graph'

export default function Palette({ getEditor: _getEditor, connect }: { getEditor: () => any; connect?: { active: boolean; toggle: () => void } }) {
  const { upsertNode, upsertEdge, graph, applyDraft, undoLastDraft } = useGraph()
  const flags = useFlags()
  const { toast } = useToast()
  const [draftOpen, setDraftOpen] = React.useState(false)
  const [prompt, setPrompt] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [showUndoDraft, setShowUndoDraft] = React.useState(false)

  const addNode = (type: NodeType) => () => {
    const id = `n_${Math.random().toString(36).slice(2, 8)}`
    const title = `${type}`
    const node: Node = { id, type, title, view: {} }
    upsertNode(node)
  }

  return (
    <div className="flex gap-1 bg-white/90 border rounded shadow-sm p-1 relative">
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
      {flags.sandboxAIDraft && (
        <button aria-label="Draft with AI" title="Draft with AI" data-testid="pal-ai-draft" className="px-2 py-1 text-xs rounded border bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500" onClick={() => setDraftOpen(v => !v)}>Draft with AI</button>
      )}
      {draftOpen && (
        <div className="absolute top-[110%] left-0 z-[1001] w-72 bg-white border rounded shadow p-2">
          <div className="text-xs font-semibold mb-1">AI Draft Scenario</div>
          <textarea aria-label="Draft prompt" className="w-full text-xs border rounded px-2 py-1 mb-1" rows={4} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe what to draft..." />
          <div className="text-[10px] text-gray-600 mb-2">Generates ~4–8 nodes and ~4–10 links. Tagged as AI-generated.</div>
          <div className="flex items-center gap-2">
            <button disabled={busy} className="px-2 py-1 text-xs rounded border bg-white hover:bg-gray-50 disabled:opacity-50" onClick={async () => {
              setBusy(true)
              try {
                const draft = draftScenario({ prompt })
                const res = applyDraft(draft)
                if ((res as any)?.ok) {
                  const { bbox, added } = res as any
                  try {
                    const ed = _getEditor?.()
                    if (ed?.zoomToBounds) ed.zoomToBounds({ x: bbox.x, y: bbox.y, w: bbox.w, h: bbox.h })
                    else if (ed?.zoomToFit) ed.zoomToFit()
                  } catch {}
                  toast({ title: `Draft added (${added.nodes.length} nodes, ${added.edges.length} links).` })
                  setShowUndoDraft(true)
                }
              } finally { setBusy(false); setDraftOpen(false) }
            }}>Draft</button>
            <button className="px-2 py-1 text-xs rounded border bg-white hover:bg-gray-50" onClick={() => setDraftOpen(false)}>Cancel</button>
          </div>
        </div>
      )}
      {showUndoDraft && (
        <div className="absolute top-[110%] left-80 z-[1001] bg-white border rounded shadow p-2 text-xs flex items-center gap-2">
          <span>Draft added. Undo?</span>
          <button data-testid="pal-ai-draft-undo" className="px-2 py-0.5 rounded border bg-white hover:bg-gray-50" onClick={() => { try { undoLastDraft() } finally { setShowUndoDraft(false) } }}>Undo</button>
          <button className="px-2 py-0.5 rounded border bg-white hover:bg-gray-50" onClick={() => setShowUndoDraft(false)}>Dismiss</button>
        </div>
      )}
    </div>
  )
}
