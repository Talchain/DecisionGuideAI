/**
 * ValidationChip - Displays probability validation errors
 * Appears bottom-right when nodes have invalid outgoing probabilities
 * Click to focus first invalid node
 */

import { memo, useCallback, useMemo } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useCanvasStore, getNextInvalidNode, getInvalidNodes } from '../store'
import styles from './ValidationChip.module.css'

interface ValidationChipProps {
  onFocusNode?: (_nodeId: string) => void
}

export const ValidationChip = memo(({ onFocusNode }: ValidationChipProps) => {
  // React 18 + Zustand v5: use individual selectors instead of object+shallow
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const touchedNodeIds = useCanvasStore(s => s.touchedNodeIds)

  // Compute invalid nodes in useMemo with stable dependencies
  // Use store-level selector to avoid Node<NodeData> type mismatch
  const invalidNodes = useMemo(() => {
    const state = useCanvasStore.getState()
    return getInvalidNodes(state)
  }, [nodes, edges, touchedNodeIds])

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
  const ariaLabel = `${count} ${count === 1 ? 'node has' : 'nodes have'} invalid probabilities. Click to fix.`

  return (
    <button
      type="button"
      onClick={handleClick}
      className={styles.validationChip}
      aria-label={ariaLabel}
      data-testid="validation-chip"
    >
      <AlertTriangle className={styles.icon} aria-hidden="true" />
      <span className={styles.label}>{label}</span>

      {/* Visually hidden live region for screen readers */}
      <span className={styles.srOnly} aria-live="polite" aria-atomic="true">
        {ariaLabel}
      </span>
    </button>
  )
})

ValidationChip.displayName = 'ValidationChip'
