/**
 * Accordion - Collapsible section with smooth height transition
 *
 * Extended from existing Accordion component to support:
 * - Right-side content slot (e.g., count, summary text)
 * - ChevronRight (collapsed) / ChevronDown (expanded) from Lucide
 * - Controlled open/close state
 * - Smooth height transition
 *
 * Uses brand design tokens from brand.css.
 */

import { useId, useState, useRef, useEffect, type ReactNode } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { typography } from '@/styles/typography'

interface AccordionProps {
  /** Section title displayed in header */
  title: string
  /** Optional right-side content (e.g., count pill, summary) */
  rightContent?: ReactNode
  /** Whether section starts expanded (uncontrolled mode) */
  defaultExpanded?: boolean
  /** Controlled expansion state */
  isExpanded?: boolean
  /** Callback when expansion state changes */
  onExpandChange?: (expanded: boolean) => void
  /** Content to render when expanded */
  children: ReactNode
  /** Test ID for testing */
  testId?: string
  /** Additional class for the container */
  className?: string
  /** Additional class for the title element (overrides default h3 styling) */
  titleClassName?: string
  /**
   * Brief 5.8A D5: optional preview line rendered BELOW the header row when
   * the accordion is collapsed and HIDDEN when expanded. Used by the T2
   * "Sharpen your thinking" accordion to surface the highest-signal one-
   * liner without forcing the user to expand the section. Indented to align
   * with the title text (past the chevron column).
   */
  previewLine?: ReactNode
}

export function Accordion({
  title,
  rightContent,
  defaultExpanded = false,
  isExpanded: controlledExpanded,
  onExpandChange,
  children,
  testId,
  className = '',
  titleClassName,
  previewLine,
}: AccordionProps) {
  // Support both controlled and uncontrolled modes
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded)
  const isControlled = controlledExpanded !== undefined
  const isExpanded = isControlled ? controlledExpanded : internalExpanded
  const [contentHeight, setContentHeight] = useState<number | undefined>(
    defaultExpanded ? undefined : 0
  )
  const contentRef = useRef<HTMLDivElement>(null)
  const headingId = useId()
  const contentId = useId()

  // Measure content height for smooth transitions
  useEffect(() => {
    if (!contentRef.current) return

    if (isExpanded) {
      const height = contentRef.current.scrollHeight
      setContentHeight(height)

      // After transition, remove fixed height to allow dynamic content
      const timer = setTimeout(() => {
        setContentHeight(undefined)
      }, 200)
      return () => clearTimeout(timer)
    } else {
      if (contentRef.current.scrollHeight > 0) {
        setContentHeight(contentRef.current.scrollHeight)
        requestAnimationFrame(() => {
          setContentHeight(0)
        })
      }
    }
  }, [isExpanded])

  const handleToggle = () => {
    const newExpanded = !isExpanded
    if (isControlled) {
      onExpandChange?.(newExpanded)
    } else {
      setInternalExpanded(newExpanded)
    }
  }

  const ChevronIcon = isExpanded ? ChevronDown : ChevronRight

  return (
    <section
      className={`border border-panel-border rounded-xl overflow-hidden ${className}`}
      data-testid={testId}
      aria-labelledby={headingId}
    >
      {/* Header button */}
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={isExpanded}
        aria-controls={contentId}
        className="w-full px-3 py-3 bg-panel flex items-center justify-between hover:bg-panel-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-inset"
      >
        <div className="flex items-center gap-2">
          <ChevronIcon
            className="h-4 w-4 text-text-light transition-transform"
            aria-hidden="true"
          />
          <h3
            id={headingId}
            className={titleClassName ?? `${typography.panelHeader} text-text-header`}
          >
            {title}
          </h3>
        </div>
        {rightContent && (
          <div className={`${typography.panelMeta} text-text-light`}>
            {rightContent}
          </div>
        )}
      </button>

      {/* Brief 5.8A D5: collapsed-only preview line (hidden when expanded). */}
      {!isExpanded && previewLine && (
        <div
          className={`px-3 pb-2 pl-9 ${typography.panelMeta} text-text-light leading-snug`}
          data-testid="accordion-preview-line"
        >
          {previewLine}
        </div>
      )}

      {/* Collapsible content */}
      <div
        id={contentId}
        ref={contentRef}
        role="region"
        aria-labelledby={headingId}
        aria-hidden={!isExpanded}
        // @ts-expect-error inert is a valid HTML attribute but not yet in React types
        inert={!isExpanded ? '' : undefined}
        className="transition-[height,opacity] duration-200 ease-in-out overflow-hidden border-t border-panel-border"
        style={{
          height: contentHeight === undefined ? 'auto' : contentHeight,
          opacity: isExpanded ? 1 : 0,
          borderTopWidth: isExpanded ? 1 : 0,
        }}
      >
        <div className="p-3">
          {children}
        </div>
      </div>
    </section>
  )
}

export default Accordion
