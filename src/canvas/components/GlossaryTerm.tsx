/**
 * GlossaryTerm - Reusable tooltip component for technical terms
 *
 * Provides plain-language explanations for technical terms with:
 * - Keyboard accessible (aria-describedby)
 * - Question mark icon trigger
 * - Clear visual hierarchy
 */

import { HelpCircle } from 'lucide-react'
import { useState, useId } from 'react'

interface GlossaryTermProps {
  term: string
  definition: string
  inline?: boolean
}

export function GlossaryTerm({ term, definition, inline = false }: GlossaryTermProps) {
  const [isHovered, setIsHovered] = useState(false)
  const tooltipId = useId()

  if (inline) {
    // Inline mode: just show term with underline dotted decoration
    return (
      <span
        style={{
          textDecoration: 'underline',
          textDecorationStyle: 'dotted',
          textUnderlineOffset: '2px',
          cursor: 'help',
        }}
        title={definition}
        aria-label={`${term}: ${definition}`}
      >
        {term}
      </span>
    )
  }

  // Icon mode: term + help icon with tooltip
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      setIsHovered(false)
    }
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
        position: 'relative',
      }}
    >
      <span style={{ color: 'var(--olumi-text)', fontWeight: 500 }}>
        {term}
      </span>
      <button
        type="button"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onFocus={() => setIsHovered(true)}
        onBlur={() => setIsHovered(false)}
        onKeyDown={handleKeyDown}
        aria-describedby={isHovered ? tooltipId : undefined}
        style={{
          background: 'none',
          border: 'none',
          padding: '0.125rem',
          cursor: 'help',
          color: 'rgba(232, 236, 245, 0.5)',
          display: 'flex',
          alignItems: 'center',
          borderRadius: '50%',
        }}
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>

      {isHovered && (
        <div
          id={tooltipId}
          role="tooltip"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 0.5rem)',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(20, 20, 30, 0.98)',
            color: 'rgba(232, 236, 245, 0.9)',
            padding: '0.625rem 0.875rem',
            borderRadius: '0.375rem',
            fontSize: '0.8125rem',
            lineHeight: 1.4,
            maxWidth: '16rem',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            border: '1px solid rgba(91, 108, 255, 0.2)',
            zIndex: 100,
            pointerEvents: 'none',
            whiteSpace: 'normal',
          }}
        >
          {definition}
          {/* Arrow */}
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: '6px solid rgba(20, 20, 30, 0.98)',
            }}
          />
        </div>
      )}
    </span>
  )
}
