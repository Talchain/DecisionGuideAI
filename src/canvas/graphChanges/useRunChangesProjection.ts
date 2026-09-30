/**
 * useRunChangesProjection — puts the Changes view's marks on the canvas while the Compare tab shows a Run pair.
 *
 * It drives the existing `analysisHighlight` projection (source `run_changes`) — the same slice the evidence
 * disclosure uses for drivers and flip risks, so a projection is always one thing at a time and every node/edge
 * already knows how to read it. Mounted by the Compare tab's pair body only: the marks live exactly as long as the
 * comparison is on screen, and unmount clears them (only if they are still ours — another view may own it by then).
 *
 * The graph shape is read by a structural signature (ids, kinds, link ends), never by node position, so a drag
 * does not recompute marks on every frame.
 */
import { useEffect, useMemo } from 'react'
import { useCanvasStore } from '../store'
import { selectWinSharesWithheld } from '../state/winShareGate'
import type { RunDeltaView } from '../../components/results/analysisNew/runDeltaView'
import { buildGraphChangesView, type CurrentGraph, type GraphChangesView } from './graphChangesView'

const nodeSignature = (s: { nodes: ReadonlyArray<{ id: string; type?: string }> }): string =>
  s.nodes.map(n => `${n.id}\u0000${n.type ?? ''}`).join('\u0001')
const edgeSignature = (s: { edges: ReadonlyArray<{ id: string; source: string; target: string }> }): string =>
  s.edges.map(e => `${e.id}\u0000${e.source}\u0000${e.target}`).join('\u0001')

function currentGraph(): CurrentGraph {
  const { nodes, edges } = useCanvasStore.getState()
  return {
    nodes: nodes.map(n => ({ id: n.id, kind: n.type })),
    edges: edges.map(e => ({ id: e.id, source: e.source, target: e.target })),
  }
}

export function useRunChangesProjection(view: RunDeltaView | null): GraphChangesView {
  const nodesSig = useCanvasStore(nodeSignature)
  const edgesSig = useCanvasStore(edgeSignature)
  const winSharesWithheld = useCanvasStore(selectWinSharesWithheld)

  const changes = useMemo(
    () => buildGraphChangesView(view, currentGraph(), winSharesWithheld),
    // The signatures stand for the graph's structure; `currentGraph()` reads it at the same moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [view, nodesSig, edgesSig, winSharesWithheld],
  )

  useEffect(() => {
    const store = useCanvasStore.getState()
    const releaseOurs = () => {
      if (useCanvasStore.getState().analysisHighlight?.source === 'run_changes') useCanvasStore.getState().clearAnalysisHighlight()
    }
    if (changes.empty) {
      releaseOurs()
      return
    }
    store.setRunChangesHighlight({ nodeMarks: changes.nodeMarks, edgeMarks: changes.edgeMarks })
    return releaseOurs
  }, [changes])

  return changes
}
