/**
 * ValidationChip - Displays probability validation errors
 * Appears bottom-right when nodes have invalid outgoing probabilities
 * Click to focus first invalid node
 */

import { memo, useCallback, useMemo } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useCanvasStore, getNextInvalidNode } from '../store'
import { getInvalidNodes as getInvalidNodesUtil } from '../utils/validateOutgoing'
import styles from './ValidationChip.module.css'

interface ValidationChipProps {
  onFocusNode?: (nodeId: string) => void
}

export const ValidationChip = memo(({ onFocusNode }: ValidationChipProps) => {
  // Select primitive values to avoid infinite loops
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const touchedNodeIds = useCanvasStore(s => s.touchedNodeIds)

  // Compute invalid nodes in useMemo with stable dependencies
  // Call utility directly with properly typed arguments (no 'as any')
  const invalidNodes = useMemo(() => {
    return getInvalidNodesUtil(nodes, edges, touchedNodeIds)
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
