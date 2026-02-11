/**
 * GraphLink — Shared clickable element that focuses a node or edge on the canvas.
 *
 * Renders as a <button> for semantic correctness and built-in keyboard support.
 * Falls back to plain <span> when targetId is missing (with dev warning).
 *
 * Used across: HeroSection, TippingPoints, DriversSection, ConfidenceSection, TornadoChart.
 */

import { useCallback, type ReactNode, type RefObject } from 'react'
import { focusByTarget, type FocusTargetType } from '../../canvas/utils/focusHelpers'

export interface GraphLinkProps {
  /** Node ID to focus (convenience — sets targetType='node') */
  nodeId?: string
  /** Edge ID to focus (convenience — sets targetType='edge') */
  edgeId?: string
  /** Display text when children not provided */
  label?: string
  /** Rich content (takes precedence over label) */
  children?: ReactNode
  /** Optional callback; falls back to focusByTarget singleton */
  onFocus?: (id: string) => void
  /** Additional CSS classes (for typography overrides) */
  className?: string
  /** Ref to an element that should flash when this link is clicked (Phase 2.3 cross-highlight) */
  flashTargetRef?: RefObject<HTMLElement | null>
}

export function GraphLink({
  nodeId,
  edgeId,
  label,
  children,
  onFocus,
  className = '',
  flashTargetRef,
}: GraphLinkProps) {
  const targetId = nodeId ?? edgeId
  const targetType: FocusTargetType = edgeId ? 'edge' : 'node'

  const handleClick = useCallback(() => {
    if (!targetId) return
    if (onFocus) {
      onFocus(targetId)
    } else {
      focusByTarget(targetId, targetType)
    }
    // Cross-highlight: flash the target element if ref provided
    if (flashTargetRef?.current) {
      const el = flashTargetRef.current
      el.classList.remove('cflash')
      // Force reflow so re-adding the class restarts the animation
      void el.offsetWidth
      el.classList.add('cflash')
    }
  }, [targetId, targetType, onFocus, flashTargetRef])

  const displayContent = children ?? label

  if (!targetId) {
    if (import.meta.env.DEV) {
      console.warn(`GraphLink fallback: no targetId for "${label}"`)
    }
    return <span className={className}>{displayContent}</span>
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`text-info hover:text-info-hover hover:underline cursor-pointer focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-1 rounded ${className}`}
      aria-label={`Focus on ${label ?? 'element'} in model`}
      title={label}
    >
      {displayContent}
    </button>
  )
}

export default GraphLink
