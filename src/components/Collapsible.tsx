import { useId, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { typography } from '../styles/typography'

interface CollapsibleProps {
  title: ReactNode
  description?: ReactNode
  defaultOpen?: boolean
  className?: string
  bodyClassName?: string
  children: ReactNode
}

export function Collapsible({
  title,
  description,
  defaultOpen = true,
  className = '',
  bodyClassName = '',
  children,
}: CollapsibleProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const contentId = useId()

  const Icon = isOpen ? ChevronUp : ChevronDown

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        aria-expanded={isOpen}
        aria-controls={contentId}
        className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-paper-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-info-500"
      >
        <div className="flex-1 text-left space-y-0.5">
          <div className={`${typography.label} text-ink-900 uppercase tracking-wide`}>
            {title}
          </div>
          {description && (
            <div className={`${typography.code} text-ink-900/70`}>
              {description}
            </div>
          )}
        </div>
        <Icon className="w-4 h-4 text-ink-900/70 flex-shrink-0" aria-hidden="true" />
      </button>
      {isOpen && (
        <div
          id={contentId}
          className={bodyClassName}
        >
          {children}
        </div>
      )}
    </div>
  )
}
