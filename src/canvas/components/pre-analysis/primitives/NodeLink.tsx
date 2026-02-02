/**
 * NodeLink - Clickable node reference link
 *
 * Renders node/edge references as #63ADCF (info) coloured text.
 * Click handler is a no-op placeholder for M1 — will navigate to canvas in M2.
 *
 * This is the ONLY coloured text permitted outside Model Snapshot.
 */

import type { ReactNode } from 'react'

interface NodeLinkProps {
  /** Display label for the node/edge */
  children: ReactNode
  /** Node or edge ID for future navigation */
  targetId?: string
  /** Target type for focus behaviour */
  targetType?: 'node' | 'edge'
  /** Click handler - no-op in M1, wired in M2 */
  onClick?: () => void
  /** Additional class names */
  className?: string
}

export function NodeLink({
  children,
  targetId,
  targetType = 'node',
  onClick,
  className = '',
}: NodeLinkProps) {
  const handleClick = () => {
    // M1: No-op placeholder — click-to-focus wired in M2
    onClick?.()
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`text-info hover:underline cursor-pointer transition-colors ${className}`}
      aria-label={targetId ? `Focus on ${targetType}: ${targetId}` : undefined}
    >
      {children}
    </button>
  )
}

export default NodeLink
