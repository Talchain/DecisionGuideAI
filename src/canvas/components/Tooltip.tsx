/**
 * Tooltip - Accessible tooltip component
 *
 * Features:
 * - Hover-triggered with keyboard support
 * - Positioned above target element
 * - Arrow pointer
 * - Proper ARIA attributes (uses aria-describedby to preserve existing labels)
 * - Merges event handlers instead of clobbering
 */

import { useState, cloneElement, useId, useEffect, type ReactElement, type MouseEvent, type FocusEvent, type KeyboardEvent } from 'react'
import { typography } from '../../styles/typography'

interface TooltipProps {
  content: string
  children: ReactElement
  position?: 'top' | 'bottom' | 'left' | 'right'
}

export function Tooltip({ content, children, position = 'top' }: TooltipProps) {
  const [show, setShow] = useState(false)
  const tooltipId = useId()

  // A11y: Dismiss tooltip on Escape key (WCAG 1.4.13 Content on Hover or Focus)
  useEffect(() => {
    if (!show) return

    const handleEscape = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShow(false)
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [show])

  // Preserve and merge existing event handlers
  const originalOnMouseEnter = children.props.onMouseEnter
  const originalOnMouseLeave = children.props.onMouseLeave
  const originalOnFocus = children.props.onFocus
  const originalOnBlur = children.props.onBlur

  const handleMouseEnter = (e: MouseEvent) => {
    setShow(true)
    originalOnMouseEnter?.(e)
  }

  const handleMouseLeave = (e: MouseEvent) => {
    setShow(false)
    originalOnMouseLeave?.(e)
  }

  const handleFocus = (e: FocusEvent) => {
    setShow(true)
    originalOnFocus?.(e)
  }

  const handleBlur = (e: FocusEvent) => {
    setShow(false)
    originalOnBlur?.(e)
  }

  // Clone child with merged handlers and aria-describedby (not aria-label)
  const enhancedChild = cloneElement(children, {
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
    onFocus: handleFocus,
    onBlur: handleBlur,
    'aria-describedby': show ? tooltipId : undefined,
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
          id={tooltipId}
          role="tooltip"
          className={`absolute z-[9000] px-2 py-1 ${typography.caption} rounded whitespace-nowrap pointer-events-none`}
          style={{
            backgroundColor: 'var(--surface-card)',
            color: 'var(--text-primary)',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
            ...positionStyles[position],
          }}
        >
          {content}
          <div
            className="absolute w-2 h-2"
            style={{
              backgroundColor: 'var(--surface-card)',
              ...arrowStyles[position],
            }}
          />
        </div>
      )}
    </div>
  )
}
