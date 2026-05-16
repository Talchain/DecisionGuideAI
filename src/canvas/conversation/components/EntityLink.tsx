import { memo, useCallback } from 'react'
import { focusByTarget } from '../../utils/focusHelpers'

// EntityLink renders a clickable entity label that pans/highlights the
// referenced node or edge on the canvas (brief §9.2 click-to-highlight,
// brief §9 step 9 implementation). Used by AI panel v2 block renderers
// when isAiPanelV2Enabled() — the FF gating lives at the call site so
// FF-off rendering is byte-identical.
//
// Location: co-located with block renderers under
// src/canvas/conversation/components/ rather than under
// src/canvas/ai-panel-v2/ to avoid an awkward conversation/ → ai-panel-v2/
// dependency direction (per the brief's "minimal alternative" guidance
// when wrapping creates such circularity at the folder graph level).

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

  return (
    <button
      type="button"
      onClick={handleClick}
      className="text-info hover:underline focus:outline-none focus-visible:underline focus-visible:ring-2 focus-visible:ring-info rounded-sm px-0.5 cursor-pointer"
      data-testid={`entity-link-${id}`}
      aria-label={`Highlight ${label} on the canvas`}
    >
      {label}
    </button>
  )
})
