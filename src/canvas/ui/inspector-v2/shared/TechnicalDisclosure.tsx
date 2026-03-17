/**
 * TechnicalDisclosure — collapsible "Show model detail" section
 * Only visible when tech toggle is on.
 * Chevron + label in text-primary, content indented with left border.
 * Enter/Space toggles. aria-expanded.
 */

import { useState, useCallback, type KeyboardEvent } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { typography } from '../../../../styles/typography'

interface TechnicalDisclosureProps {
  /** Only render when tech toggle is active */
  visible: boolean
  label?: string
  children: React.ReactNode
}

export function TechnicalDisclosure({
  visible,
  label = 'Show model detail',
  children,
}: TechnicalDisclosureProps) {
  const [open, setOpen] = useState(false)

  const toggle = useCallback(() => setOpen(o => !o), [])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggle()
    }
  }, [toggle])

  if (!visible) return null

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={toggle}
        onKeyDown={handleKeyDown}
        aria-expanded={open}
        className={`${typography.panelMeta} bg-transparent border-none cursor-pointer text-info flex items-center gap-1 p-0 hover:underline`}
      >
        {open
          ? <ChevronDown size={12} className="text-info" />
          : <ChevronRight size={12} className="text-info" />
        }
        {open ? 'Hide model detail' : label}
      </button>
      {open && (
        <div className="mt-2 pl-3 border-l border-panel-border">
          <div className={`${typography.panelMeta} text-text-light space-y-1`}>
            {children}
          </div>
        </div>
      )}
    </div>
  )
}
