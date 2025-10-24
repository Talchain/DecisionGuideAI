/**
 * ValidationChip - Displays probability validation errors
 * Appears bottom-right when nodes have invalid outgoing probabilities
 * Click to focus first invalid node
 */

import { memo, useCallback, useMemo } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useCanvasStore, getInvalidNodes, getNextInvalidNode } from '../store'

interface ValidationChipProps {
  onFocusNode?: (nodeId: string) => void
}

export const ValidationChip = memo(({ onFocusNode }: ValidationChipProps) => {
  // Select nodes and edges, compute invalid nodes in useMemo
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)

  const invalidNodes = useMemo(() => {
    return getInvalidNodes({ nodes, edges } as any)
  }, [nodes, edges])

  const handleClick = useCallback(() => {
    const state = useCanvasStore.getState()
    const firstInvalid = getNextInvalidNode(state)

    if (firstInvalid && onFocusNode) {
      onFocusNode(firstInvalid.nodeId)
    }
  }, [onFocusNode])

  if (invalidNodes.length === 0) return null

  const count = invalidNodes.length
  const label = count === 1 ? 'Fix probabilities (1 issue)' : `Fix probabilities (${count} issues)`

  return (
    <button
      onClick={handleClick}
      className="fixed bottom-4 right-4 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2"
      style={{
        backgroundColor: 'var(--olumi-warning)',
        color: '#000',
        zIndex: 1000,
        focusRingColor: 'var(--olumi-warning)'
      }}
      aria-label={`${count} ${count === 1 ? 'node has' : 'nodes have'} invalid probabilities. Click to fix.`}
      role="status"
      data-testid="validation-chip"
    >
      <AlertTriangle className="w-5 h-5" aria-hidden="true" />
      <span className="font-medium text-sm">{label}</span>
    </button>
  )
})

ValidationChip.displayName = 'ValidationChip'
