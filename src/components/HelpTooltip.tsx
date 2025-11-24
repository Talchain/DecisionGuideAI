import { Info } from 'lucide-react'
import { typography } from '../styles/typography'

interface HelpTooltipProps {
  term: string
  explanation: string
  citation?: string
  learnMoreUrl?: string
}

/**
 * Phase 2: Contextual help tooltip component (accessibility-enhanced)
 * Provides inline explanations for technical terms
 * - Keyboard accessible (shows on focus)
 * - Screen reader friendly (aria-describedby + aria-live)
 * - Touch accessible (tap to toggle would require state, deferred)
 */
export function HelpTooltip({ term, explanation, citation, learnMoreUrl }: HelpTooltipProps) {
  const tooltipId = `tooltip-${term.replace(/\s+/g, '-').toLowerCase()}`

  return (
    <span className="inline-flex items-center gap-1 group relative">
      <button
        type="button"
        className="underline decoration-dotted hover:text-sky-600 focus:text-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-1 rounded transition-colors"
        aria-describedby={tooltipId}
        aria-label={`Show definition for ${term}`}
      >
        {term}
      </button>
      <Info
        className="w-3 h-3 text-ink-900/40 group-hover:text-sky-600 group-focus-within:text-sky-600 transition-colors"
        aria-hidden="true"
      />

      {/* Tooltip content */}
      <div
        id={tooltipId}
        role="tooltip"
        aria-live="polite"
        aria-atomic="true"
        className="
        absolute bottom-full left-0 mb-2 w-64 p-3
        bg-white border border-sand-200 rounded-lg shadow-lg
        opacity-0 pointer-events-none
        group-hover:opacity-100 group-hover:pointer-events-auto
        group-focus-within:opacity-100 group-focus-within:pointer-events-auto
        transition-opacity duration-200 z-50
      ">
        <p className={`${typography.bodySmall} text-ink-900`}>
          {explanation}
        </p>

        {citation && (
          <p className={`${typography.caption} text-ink-900/60 mt-2`}>
            {citation}
          </p>
        )}

        {learnMoreUrl && (
          <a
            href={learnMoreUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`${typography.caption} text-sky-600 underline block mt-2 hover:text-sky-700`}
          >
            Learn more →
          </a>
        )}

        {/* Arrow */}
        <div className="absolute top-full left-4 -mt-px">
          <div className="w-2 h-2 bg-white border-b border-r border-sand-200 transform rotate-45" />
        </div>
      </div>
    </span>
  )
}
