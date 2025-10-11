// src/routes/PlcLab.tsx
import { useCallback, useEffect, useMemo, useState } from 'react'
import PlcCanvas from '../plc/components/PlcCanvas'
import type { Edge, Node } from '../plc/types'
import { initialHistory, push as pushHistory, undo as undoHistory, redo as redoHistory } from '../plc/state/history'

function readSnap(): boolean {
  try { return localStorage.getItem('plc.snap') === '1' } catch { return false }
}
function writeSnap(v: boolean) { try { localStorage.setItem('plc.snap', v ? '1' : '0') } catch {} }

export default function PlcLab() {
  const enabled = useMemo(() => {
    try {
      const qs = new URLSearchParams(location.search)
      if (qs.get('plc') === '1' || qs.get('dev') === '1' || qs.get('e2e') === '1') return true
      return localStorage.getItem('PLC_ENABLED') === '1'
    } catch { return false }
  }, [])
  const [hist, setHist] = useState(() => initialHistory({ nodes: [] as Node[], edges: [] as Edge[] }))
  const [snap, setSnap] = useState<boolean>(readSnap())
  const [guidesOn, setGuidesOn] = useState<boolean>(() => {
    try { return localStorage.getItem('plc.guides') === '1' } catch { return false }
  })
  const [snapGuide, setSnapGuide] = useState<boolean>(() => {
    try { return localStorage.getItem('plc.snapGuide') === '1' } catch { return true }
  })

  useEffect(() => { writeSnap(snap) }, [snap])
  useEffect(() => { try { localStorage.setItem('plc.guides', guidesOn ? '1' : '0') } catch {} }, [guidesOn])
  useEffect(() => { try { localStorage.setItem('plc.snapGuide', snapGuide ? '1' : '0') } catch {} }, [snapGuide])

  const addNode = useCallback(() => {
    const i = hist.present.nodes.length
    const col = i % 3
    const row = Math.floor(i / 3)
    const n: Node = { id: `n${Date.now()}_${i}` , label: `Node ${i+1}`, x: 100 + col * 200, y: 80 + row * 120 }
    setHist(h => ({ ...h, present: { ...h.present, nodes: [...h.present.nodes, n] } }))
  }, [hist.present.nodes.length])

  const onOp = useCallback((op: any) => {
    if (!op) return
    if (op.type === 'move' || op.type === 'batchMove') {
      setHist(h => pushHistory(h, op))
    } else if (op.type === 'add' && op.payload?.kind === 'node') {
      setHist(h => ({ ...h, present: { ...h.present, nodes: [...h.present.nodes, op.payload.node] } }))
    } else if (op.type === 'connect' && op.payload?.edge) {
      setHist(h => ({ ...h, present: { ...h.present, edges: [...h.present.edges, op.payload.edge] } }))
    } else if (op.type === 'batchRemove' && op.payload?.nodeIds) {
      setHist(h => ({ ...h, present: { ...h.present, nodes: h.present.nodes.filter(n => !op.payload.nodeIds.includes(n.id)) } }))
    }
  }, [])

  const localEdits = useMemo(() => ({ addedNodes: [] as Node[], renamedNodes: {} as Record<string,string>, addedEdges: [] as Edge[] }), [])

  if (!enabled) {
    return (
      <div data-testid="plc-disabled" style={{ padding: 16 }}>
        <h3 style={{ margin: 0 }}>PLC Lab is disabled</h3>
        <p style={{ marginTop: 8 }}>Enable via <code>localStorage.PLC_ENABLED = '1'</code> or add <code>?dev=1</code> to the URL.</p>
      </div>
    )
  }

  return (
    <div data-testid="plc-surface" style={{ padding: 12 }}>
      <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
        <button data-testid="add-node-btn" onClick={addNode}>+ Add Node</button>
        <button
          data-testid="plc-snap-toggle"
          aria-pressed={snap}
          onClick={() => setSnap(s => !s)}
        >{snap ? 'Snap: On' : 'Snap: Off'}</button>
        <button
          data-testid="plc-guides-toggle"
          aria-pressed={guidesOn}
          onClick={() => setGuidesOn(v => !v)}
        >{guidesOn ? 'Guides: On' : 'Guides: Off'}</button>
        <button
          data-testid="plc-guides-snap-toggle"
          aria-pressed={snapGuide}
          onClick={() => setSnapGuide(v => !v)}
          disabled={!guidesOn}
          title={!guidesOn ? 'Enable guides first' : ''}
        >{snapGuide ? 'Snap-to-Guide: On' : 'Snap-to-Guide: Off'}</button>
        <button data-testid="plc-undo-btn" onClick={() => setHist(h => undoHistory(h))} disabled={hist.past.length === 0}>Undo</button>
        <button data-testid="plc-redo-btn" onClick={() => setHist(h => redoHistory(h))} disabled={hist.future.length === 0}>Redo</button>
      </div>
      <PlcCanvas
        nodes={hist.present.nodes}
        edges={hist.present.edges}
        localEdits={localEdits}
        onOp={onOp}
        snap={{ enabled: snap, grid: 10, tol: 6 }}
        guides={{ enabled: guidesOn, tol: 6, snapToGuide: snapGuide }}
      />
    </div>
  )
}
