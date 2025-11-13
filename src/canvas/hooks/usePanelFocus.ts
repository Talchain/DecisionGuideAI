/**
 * N6: Panel Focus Management Hook
 *
 * Manages focus for accessible panel UX:
 * - Moves focus to panel header when opened
 * - Returns focus to trigger element on ESC/close
 * - Supports keyboard-only operation
 *
 * Usage:
 * ```tsx
 * function MyPanel({ isOpen, onClose, triggerRef }) {
 *   const panelRef = usePanelFocus({ isOpen, onClose, triggerRef })
 *   return (
 *     <div ref={panelRef} role="dialog">
 *       <h2 tabIndex={-1}>Panel Title</h2>
 *       ...
 *     </div>
 *   )
 * }
 * ```
 */

import { useEffect, useRef } from 'react'

interface UsePanelFocusOptions {
  isOpen: boolean
  onClose: () => void
  triggerRef?: React.RefObject<HTMLElement> | HTMLElement | null
  autoFocus?: boolean
}

export function usePanelFocus({
  isOpen,
  onClose,
  triggerRef,
  autoFocus = true
}: UsePanelFocusOptions) {
  const panelRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  // Store previous focus and move focus to panel on open
  useEffect(() => {
    if (isOpen && autoFocus) {
      // Store currently focused element
      previousFocusRef.current = document.activeElement as HTMLElement

      // Move focus to panel header (first focusable element or panel itself)
      if (panelRef.current) {
        const header = panelRef.current.querySelector('h1, h2, h3, [role="heading"]') as HTMLElement
        if (header) {
          // Make header focusable temporarily
          const originalTabIndex = header.getAttribute('tabindex')
          header.setAttribute('tabindex', '-1')
          header.focus()

          // Restore original tabindex after focus
          if (originalTabIndex === null) {
            header.removeAttribute('tabindex')
          } else {
            header.setAttribute('tabindex', originalTabIndex)
          }
        } else {
          // Fallback to first focusable element
          const firstFocusable = panelRef.current.querySelector<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
          firstFocusable?.focus()
        }
      }
    }
  }, [isOpen, autoFocus])

  // Return focus to trigger on close
  useEffect(() => {
    if (!isOpen && previousFocusRef.current) {
      // Determine which element to return focus to
      let focusTarget: HTMLElement | null = null

      if (triggerRef) {
        // Use provided trigger ref
        if ('current' in triggerRef) {
          focusTarget = triggerRef.current
        } else {
          focusTarget = triggerRef as HTMLElement
        }
      } else {
        // Fallback to previous focus
        focusTarget = previousFocusRef.current
      }

      // Return focus
      if (focusTarget && document.body.contains(focusTarget)) {
        focusTarget.focus()
      }

      previousFocusRef.current = null
    }
  }, [isOpen, triggerRef])

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  return panelRef
}
