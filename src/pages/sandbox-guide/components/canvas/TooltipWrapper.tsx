/**
 * Tooltip Wrapper Component
 *
 * Generic tooltip wrapper using @floating-ui/react for intelligent positioning.
 * Features:
 * - Configurable delay before showing
 * - Auto-positioning with flip and shift
 * - Can hover tooltip without dismissing
 * - Keyboard accessible (focus triggers tooltip)
 */

import { useState, useRef, useEffect, type ReactNode } from 'react'
import {
  useFloating,
  offset,
  flip,
  shift,
  autoUpdate,
  FloatingPortal,
  useFocus,
  useHover,
  useInteractions,
  type Placement,
} from '@floating-ui/react'

export interface TooltipWrapperProps {
  content: ReactNode
  children: ReactNode
  placement?: Placement
  delay?: number
  enabled?: boolean
}

export function TooltipWrapper({
  content,
  children,
  placement = 'top',
  delay = 300,
  enabled = true,
}: TooltipWrapperProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout>()

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement,
    middleware: [offset(10), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  })

  const hover = useHover(context, {
    delay: {
      open: delay,
      close: 100,
    },
    move: false,
  })

  const focus = useFocus(context)

  const { getReferenceProps, getFloatingProps } = useInteractions([hover, focus])

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  if (!enabled) {
    return <>{children}</>
  }

  return (
    <>
      <div ref={refs.setReference} {...getReferenceProps()}>
        {children}
      </div>

      {isOpen && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            {...getFloatingProps()}
            className="z-50"
          >
            {content}
          </div>
        </FloatingPortal>
      )}
    </>
  )
}
