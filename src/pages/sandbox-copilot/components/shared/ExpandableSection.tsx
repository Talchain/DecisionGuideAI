/**
 * ExpandableSection - Collapsible section for progressive disclosure
 *
 * Critical for keeping panel content focused (max 7 items visible)
 */

import { useState } from 'react'

export interface ExpandableSectionProps {
  title: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
  className?: string
}

export function ExpandableSection({
  title,
  children,
  defaultOpen = false,
  className = '',
}: ExpandableSectionProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className={`border-t border-storm-100 ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-storm-50 transition-colors"
        aria-expanded={isOpen}
        aria-controls="expandable-content"
      >
        <div className="flex-1">{title}</div>
        <svg
          className={`w-5 h-5 text-storm-600 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div
          id="expandable-content"
          className="px-4 pb-4"
          role="region"
          aria-live="polite"
        >
          {children}
        </div>
      )}
    </div>
  )
}
