/**
 * Tooltip - Accessible tooltip component
 *
 * Features:
 * - Hover-triggered with keyboard support
 * - Positioned above target element
 * - Arrow pointer
 * - Proper ARIA attributes
 */

import { useState, cloneElement, type ReactElement } from 'react'

interface TooltipProps {
  content: string
  children: ReactElement
  position?: 'top' | 'bottom' | 'left' | 'right'
}

export function Tooltip({ content, children, position = 'top' }: TooltipProps) {
  const [show, setShow] = useState(false)

  const handleMouseEnter = () => setShow(true)
  const handleMouseLeave = () => setShow(false)
  const handleFocus = () => setShow(true)
  const handleBlur = () => setShow(false)

  // Clone child and add event handlers + aria-label
  const enhancedChild = cloneElement(children, {
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
    onFocus: handleFocus,
    onBlur: handleBlur,
    'aria-label': content,
    tabIndex: children.props.tabIndex ?? 0,
  })

  const positionStyles = {
    top: {
      bottom: '100%',
      left: '50%',
      transform: 'translateX(-50%)',
      marginBottom: '8px',
    },
    bottom: {
      top: '100%',
      left: '50%',
      transform: 'translateX(-50%)',
      marginTop: '8px',
    },
    left: {
      right: '100%',
      top: '50%',
      transform: 'translateY(-50%)',
      marginRight: '8px',
    },
    right: {
      left: '100%',
      top: '50%',
      transform: 'translateY(-50%)',
      marginLeft: '8px',
    },
  }

  const arrowStyles = {
    top: {
      bottom: '-4px',
      left: '50%',
      transform: 'translateX(-50%) rotate(45deg)',
    },
    bottom: {
      top: '-4px',
      left: '50%',
      transform: 'translateX(-50%) rotate(45deg)',
    },
    left: {
      right: '-4px',
      top: '50%',
      transform: 'translateY(-50%) rotate(45deg)',
    },
    right: {
      left: '-4px',
      top: '50%',
      transform: 'translateY(-50%) rotate(45deg)',
    },
  }

  return (
    <div className="relative inline-block">
      {enhancedChild}

      {show && (
        <div
          role="tooltip"
          className="absolute z-[9000] px-2 py-1 text-xs rounded whitespace-nowrap pointer-events-none"
          style={{
            backgroundColor: 'var(--olumi-bg, #0E1116)',
            color: 'var(--olumi-text, #E8ECF5)',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
            ...positionStyles[position],
          }}
        >
          {content}
          <div
            className="absolute w-2 h-2"
            style={{
              backgroundColor: 'var(--olumi-bg, #0E1116)',
              ...arrowStyles[position],
            }}
          />
        </div>
      )}
    </div>
  )
}
