import { useMemo } from 'react'
import { useCanvasStore } from '../../store'
import { useStaleGuard } from '../../ui/inspector-v2/useStaleGuard'

// Stage-aware placeholder per the brief §5.2:
//
//   Empty canvas                  → "Describe your decision..."
//   Graph exists, pre-analysis    → "Ask about this model..."
//   Post-analysis, current        → "Ask about the latest analysis..."
//   Post-analysis, stale          → "Model changed. Ask or rerun analysis..."
//   Node/edge selected            → "Ask about [element label]..."
//
// Selection wins over staleness/analysis state because it represents the
// active user-attention target. Falls back to the broader workflow state.

export function useStageAwarePlaceholder(): string {
  const nodeCount = useCanvasStore(s => s.nodes.length)
  const selection = useCanvasStore(s => s.selection)
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const hasAnalysis = useCanvasStore(
    s => s.results?.status === 'complete' && Boolean(s.results?.hash ?? s.currentScenarioLastResultHash)
  )
  const { isStale } = useStaleGuard()

  const selectedLabel = useMemo(() => {
    const nodeIds = selection?.nodeIds
    const edgeIds = selection?.edgeIds
    if (nodeIds && nodeIds.size > 0) {
      const id = nodeIds.values().next().value as string
      const node = nodes.find(n => n.id === id)
      const data = node?.data as { label?: string } | undefined
      return data?.label?.trim() || null
    }
    if (edgeIds && edgeIds.size > 0) {
      const id = edgeIds.values().next().value as string
      const edge = edges.find(e => e.id === id)
      const data = edge?.data as { label?: string } | undefined
      return data?.label?.trim() || 'edge'
    }
    return null
  }, [selection, nodes, edges])

  if (selectedLabel) return `Ask about ${selectedLabel}…`
  if (nodeCount === 0) {
    return "Describe your decision, the options you're weighing, and what a good outcome looks like."
  }
  if (!hasAnalysis) return 'Ask about this model…'
  if (isStale) return 'Model changed. Ask or rerun analysis…'
  return 'Ask about the latest analysis…'
}
