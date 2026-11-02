import { memo, useCallback } from 'react'
import { focusByTarget } from '../../utils/focusHelpers'
import { usePresentation, setV10Lit } from '../../../presentation/v10'

// EntityLink renders a clickable entity label that pans/highlights the
// referenced node or edge on the canvas (brief §9.2 click-to-highlight,
// brief §9 step 9 implementation). Used by conversation block renderers
// when isAiPanelV2Enabled() — the FF gating lives at the call site so
// FF-off rendering is byte-identical.
//
// Location: co-located with block renderers under
// src/canvas/conversation/components/ to avoid an awkward conversation/ →
// canvas/components/ dependency direction (per the brief's "minimal
// alternative" guidance when wrapping creates such circularity at the
// folder graph level).

interface EntityLinkProps {
  id: string
  label: string
  /**
   * Entity kind, used by focusByTarget to resolve nodes vs edges. Falls
   * back to 'node' if the caller doesn't know. */
  kind?: 'node' | 'edge' | 'factor' | 'option' | 'goal' | 'risk' | 'outcome'
}

export const EntityLink = memo(function EntityLink({ id, label, kind = 'node' }: EntityLinkProps) {
  const handleClick = useCallback(() => {
    // focusByTarget pans + highlights on the canvas. Reduced-motion is
    // handled inside the focus helper.
    const targetType = kind === 'edge' ? 'edge' : 'node'
    focusByTarget(id, targetType)
  }, [id, kind])

  // v10 (#/canvas2): naming a record in the chat rings its card while hovered or focused. Nothing dims.
  const presentation = usePresentation()
  const lit = presentation === 'v10' && kind !== 'edge'
  const light = useCallback(() => { if (lit) setV10Lit(id) }, [lit, id])
  const unlight = useCallback(() => { if (lit) setV10Lit(null) }, [lit])

  return (
    <button
      type="button"
      onClick={handleClick}
      onMouseEnter={light}
      onMouseLeave={unlight}
      onFocus={light}
      onBlur={unlight}
      className="text-info hover:underline focus:outline-none focus-visible:underline focus-visible:ring-2 focus-visible:ring-info rounded-sm px-0.5 cursor-pointer"
      data-testid={`entity-link-${id}`}
      aria-label={`Highlight ${label} on the canvas`}
    >
      {label}
    </button>
  )
})
