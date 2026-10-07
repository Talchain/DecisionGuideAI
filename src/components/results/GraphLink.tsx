/**
 * GraphLink — Shared clickable element that focuses a node or edge on the canvas.
 *
 * Renders as a <button> for semantic correctness and built-in keyboard support.
 * Falls back to plain <span> when targetId is missing (with dev warning).
 *
 * Used across: DriversSection, ConfidenceSection, TornadoChart, ChallengeSection.
 */

import { useCallback, type ReactNode, type RefObject } from 'react'
import { focusByTarget, focusEdgeByEndpoints, type FocusTargetType } from '../../canvas/utils/focusHelpers'
import { openLinkInspector } from '../../canvas/utils/openEdgeStrengthEditor'

/** V14: Edge reference by endpoints — looks up real ReactFlow edge ID at click time */
export interface EdgeRef {
  fromId: string
  toId: string
}

export interface GraphLinkProps {
  /** Node ID to focus (convenience — sets targetType='node') */
  nodeId?: string
  /** Edge ID to focus (convenience — sets targetType='edge') */
  edgeId?: string
  /** V14: Edge reference by endpoints — looks up real edge ID from canvas store */
  edgeRef?: EdgeRef
  /** Open the live endpoint-matched link's full inspector instead of only focusing. */
  opensInspector?: boolean
  /** V14: Fallback node ID when edge focus fails (used with edgeRef) */
  fallbackNodeId?: string
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
  /**
   * `'box'` (default, every existing caller) is a `<button>`, which HTML's button layout always makes an atomic
   * inline-block: a long label fills its line and the words after it drop below. `'inline'` is for a link INSIDE a
   * sentence (Compare's "not shown" line, 7 Oct staging witness: its commas stood alone on their own lines). It is the
   * `NodeValueEditor` 'inline' resting flow: a `<span role="button" tabIndex={0}>` with the same classes, name, title and
   * click, and Enter / Space acting as a native button would, so its words wrap with the sentence.
   */
  flow?: 'box' | 'inline'
}

export function GraphLink({
  nodeId,
  edgeId,
  edgeRef,
  opensInspector,
  fallbackNodeId,
  label,
  children,
  onFocus,
  className = '',
  flashTargetRef,
  flow = 'box',
}: GraphLinkProps) {
  const targetId = nodeId ?? edgeId ?? edgeRef?.fromId
  const targetType: FocusTargetType = (edgeId || edgeRef) ? 'edge' : 'node'

  const handleClick = useCallback(() => {
    if (!targetId && !edgeRef) return

    if (onFocus) {
      onFocus(targetId!)
    } else if (edgeRef) {
      // V14: Look up real edge by source+target endpoints, fallback to node
      if (!opensInspector || !openLinkInspector(edgeRef.fromId, edgeRef.toId)) {
        focusEdgeByEndpoints(edgeRef.fromId, edgeRef.toId, fallbackNodeId ?? edgeRef.fromId)
      }
    } else {
      focusByTarget(targetId!, targetType)
    }
    // Cross-highlight: flash the target element if ref provided
    if (flashTargetRef?.current) {
      const el = flashTargetRef.current
      el.classList.remove('cflash')
      // Force reflow so re-adding the class restarts the animation
      void el.offsetWidth
      el.classList.add('cflash')
    }
  }, [targetId, targetType, onFocus, edgeRef, opensInspector, fallbackNodeId, flashTargetRef])

  const displayContent = children ?? label

  if (!targetId) {
    if (import.meta.env.DEV) {
      console.warn(`GraphLink fallback: no targetId for "${label}"`)
    }
    return <span className={className}>{displayContent}</span>
  }

  const classes = `text-info hover:text-info-hover hover:underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-2 rounded ${className}`
  // ⚠ `??` GUARDS NULLISH, NOT EMPTY. Callers pass `label={x ?? ''}` (e.g.
  // `compare-tab/DotProgression.tsx` for a runner-up with no label), and an
  // empty string sails past `??` — producing the announced text
  // "Focus on  in model", with a doubled space and no subject. Screen
  // readers get a control that names nothing. Trimmed-empty falls back too.
  const ariaLabel = `Focus on ${label?.trim() ? label : 'element'} in model`

  if (flow === 'inline') {
    return (
      <span
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return
          e.preventDefault()
          handleClick()
        }}
        className={`whitespace-normal ${classes}`}
        aria-label={ariaLabel}
        title={label}
      >
        {displayContent}
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={classes}
      aria-label={ariaLabel}
      title={label}
    >
      {displayContent}
    </button>
  )
}

export default GraphLink
