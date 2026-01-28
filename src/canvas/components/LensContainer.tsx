/**
 * LensContainer - Collapsible section for Structure tab lenses
 *
 * Used to organize Structure tab into three lenses:
 * - Causal Logic (default open)
 * - Model Structure (default collapsed)
 * - Improvements (default collapsed)
 */

import { useState, useId, type ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { typography } from '../../styles/typography'

interface LensContainerProps {
  title: string
  defaultOpen: boolean
  children: ReactNode
  testId?: string
}

export function LensContainer({ title, defaultOpen, children, testId }: LensContainerProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const regionId = useId()

  return (
    <div className="border-t border-sand-200 pt-3" data-testid={testId}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full text-left py-1 hover:bg-sand-50 rounded px-1 -mx-1 transition-colors"
        aria-expanded={isOpen}
        aria-controls={regionId}
      >
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-sand-500" aria-hidden="true" />
        ) : (
          <ChevronRight className="w-4 h-4 text-sand-500" aria-hidden="true" />
        )}
        <span className={`${typography.label} font-semibold text-ink-900`}>
          {title}
        </span>
      </button>

      {isOpen && (
        <div id={regionId} className="mt-2 pl-6">
          {children}
        </div>
      )}
    </div>
  )
}
