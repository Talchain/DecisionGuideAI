/**
 * Accordion Component
 *
 * Reusable collapsible section for the Results Panel accordion layout.
 * Phase 3 Task 3.1: Provides smooth CSS transitions and full accessibility.
 *
 * Features:
 * - ARIA attributes (aria-expanded, aria-controls, aria-labelledby)
 * - Keyboard navigation via native button (Tab, Enter, Space)
 * - Smooth height-based CSS transitions for expand/collapse
 * - Optional badge count display
 * - Custom header styling support
 */

import { useId, useState, useRef, useEffect, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { typography } from '../../styles/typography'

export interface AccordionProps {
  /** Section title displayed in header */
  title: string
  /** Optional badge count (e.g., number of items) */
  badgeCount?: number
  /** Badge variant for styling */
  badgeVariant?: 'default' | 'warning' | 'critical'
  /** v7.10 T6: Readiness tier label shown as right-aligned pill */
  tierLabel?: string
  /** v7.10 T6: Tier variant for pill colour */
  tierVariant?: 'strong' | 'fair' | 'needs_work'
  /** Whether section starts expanded (uncontrolled mode) */
  defaultExpanded?: boolean
  /** Controlled expansion state - when provided, component becomes controlled */
  isExpanded?: boolean
  /** Callback when expansion state changes (controlled mode) */
  onExpandChange?: (expanded: boolean) => void
  /** Content to render when expanded */
  children: ReactNode
  /** Test ID for testing */
  testId?: string
  /** Additional class for the container */
  className?: string
}

const badgeVariants = {
  default: 'bg-slate-100 text-slate-700',
  warning: 'bg-warning-100 text-warning-700',
  critical: 'bg-danger-100 text-danger-700',
}

const tierVariants = {
  strong: 'bg-panel text-text-header',
  fair: 'bg-panel text-text-header',
  needs_work: 'bg-panel text-text-header',
}

export function Accordion({
  title,
  badgeCount,
  badgeVariant = 'default',
  tierLabel,
  tierVariant,
  defaultExpanded = false,
  isExpanded: controlledExpanded,
  onExpandChange,
  children,
  testId,
  className = '',
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
      // Measure the actual content height
      const height = contentRef.current.scrollHeight
      setContentHeight(height)

      // After transition, remove fixed height to allow dynamic content
      const timer = setTimeout(() => {
        setContentHeight(undefined)
      }, 200) // Match transition duration
      return () => clearTimeout(timer)
    } else {
      // First set current height to enable transition from current state
      if (contentRef.current.scrollHeight > 0) {
        setContentHeight(contentRef.current.scrollHeight)
        // Force reflow, then set to 0
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

  return (
    <section
      className={`border border-sand-200 rounded-lg overflow-hidden ${className}`}
      data-testid={testId}
      aria-labelledby={headingId}
    >
      {/* Header button - accessible trigger */}
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={isExpanded}
        aria-controls={contentId}
        className="w-full px-3 py-2 bg-sand-50 border-b border-sand-200 flex items-center justify-between hover:bg-sand-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-info-500 focus-visible:ring-inset"
      >
        <div className="flex items-center gap-2 flex-1">
          <ChevronRight
            className={`h-4 w-4 text-ink-500 transition-transform duration-200 ${
              isExpanded ? 'rotate-90' : ''
            }`}
            aria-hidden="true"
          />
          <h3
            id={headingId}
            className={`${typography.panelHeader} text-ink-800`}
          >
            {title}
          </h3>
          {badgeCount !== undefined && badgeCount > 0 && (
            <span
              className={`${typography.panelMeta} px-1.5 py-0.5 rounded-full ${badgeVariants[badgeVariant]}`}
            >
              {badgeCount}
            </span>
          )}
          {tierLabel && tierVariant && (
            <span
              className={`${typography.panelMeta} ml-auto px-2 py-0.5 rounded-full ${tierVariants[tierVariant]}`}
              title="Based on the confidence levels of your key factors. Improve by gathering data on low-confidence drivers."
            >
              {tierLabel}
            </span>
          )}
        </div>
      </button>

      {/* Collapsible content with smooth height transition */}
      {/* Issue 2 fix: aria-hidden + inert prevent focus when collapsed */}
      <div
        id={contentId}
        ref={contentRef}
        role="region"
        aria-labelledby={headingId}
        aria-hidden={!isExpanded}
        // @ts-expect-error inert is a valid HTML attribute but not yet in React types
        inert={!isExpanded ? '' : undefined}
        className="transition-[height,opacity] duration-200 ease-in-out overflow-hidden"
        style={{
          height: contentHeight === undefined ? 'auto' : contentHeight,
          opacity: isExpanded ? 1 : 0,
        }}
      >
        {/* Inner wrapper maintains padding regardless of collapsed state */}
        <div className="p-3">
          {children}
        </div>
      </div>
    </section>
  )
}

export default Accordion
