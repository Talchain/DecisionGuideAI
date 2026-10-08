import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CANVAS_LAYER_CLASS } from '../layers'
import { useNodeKeyboardScope } from '../nodes/nodeKeyboardScope'
import { SuccessTargetLine } from '../../components/results/analysisNew/sections/SuccessTargetLine'
import { useGoalTargetFeedback } from '../../components/results/goal-chance-invite/goalTargetFeedback'

interface GoalTargetPopoverProps {
  goalNodeId: string
  anchor: HTMLButtonElement
  onClose: () => void
}

/**
 * SetValuePopover's fixed, body-portalled, outside-press pattern, with the shared target door inside.
 * A canvas OVERLAY, not card chrome (it portals to `document.body`, outside the zoom transform, at screen size, like
 * `hoverCard/NodeHoverCard`), so it lives with the other canvas overlays. It renders `SuccessTargetLine` with
 * `divider={false}`: that component's single-edge hairline belongs to its inspector branch and never draws here.
 */
export function GoalTargetPopover({ goalNodeId, anchor, onClose }: GoalTargetPopoverProps) {
  const { ref, onKeyDownCapture } = useNodeKeyboardScope<HTMLDivElement>()
  const popoverRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ left: 0, top: 0 })
  const feedback = useGoalTargetFeedback()

  useLayoutEffect(() => {
    const place = () => {
      const rect = anchor.getBoundingClientRect()
      const height = popoverRef.current?.getBoundingClientRect().height ?? 0
      setPosition({
        left: Math.max(8, Math.min(rect.left, window.innerWidth - 328)),
        top: Math.max(8, Math.min(rect.bottom + 8, window.innerHeight - height - 8)),
      })
    }
    place()
    const resize = new ResizeObserver(place)
    if (popoverRef.current) resize.observe(popoverRef.current)
    window.addEventListener('resize', place)
    // Also follows the mark while its canvas scroll container moves.
    window.addEventListener('scroll', place, true)
    return () => {
      resize.disconnect()
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [anchor])

  useEffect(() => {
    const outside = (event: MouseEvent) => {
      if (event.target instanceof Node && !popoverRef.current?.contains(event.target) && !anchor.contains(event.target)) onClose()
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      // This Escape belongs to the editor; do not let the canvas clear the node selection as well.
      event.stopPropagation()
      onClose()
      anchor.focus()
    }
    document.addEventListener('mousedown', outside)
    document.addEventListener('keydown', escape, true)
    return () => {
      document.removeEventListener('mousedown', outside)
      document.removeEventListener('keydown', escape, true)
    }
  }, [anchor, onClose])

  return createPortal(
    // The classless scope cannot have its transient .nokey overwritten by React's panel className.
    <div ref={ref} style={{ display: 'contents' }} onKeyDownCapture={onKeyDownCapture}>
      <div
        ref={popoverRef}
        role="dialog"
        aria-label="Set a target"
        className={`nodrag nopan nowheel fixed ${CANVAS_LAYER_CLASS.setValuePopover} w-[320px] max-w-[calc(100vw-16px)] max-h-[calc(100vh-16px)] overflow-auto rounded-md border border-panel-border bg-panel p-3 shadow-2`}
        style={position}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <SuccessTargetLine
          goalNodeId={goalNodeId}
          divider={false}
          variant="reasoning"
          openOnMount
          testId="goal-node-target-editor"
          onCommitOutcome={(outcome) => {
            feedback.onCommitOutcome(outcome)
            if (outcome === 'dispatched' || outcome === 'local_only') onClose()
          }}
          onSendSettled={feedback.onSendSettled}
        />
      </div>
    </div>,
    document.body,
  )
}
