/**
 * ReadinessPill — brief readiness indicator for the action strip area.
 *
 * Shows low/ok/strong readiness state with a click-to-open popover detailing
 * which structural components have been detected. Renders only during the
 * framing stage (gated by caller via isFramingStage).
 *
 * Props receive RealtimeSignals from the debounced detection engine.
 * Snippet extraction is done on-demand by the popover, not stored on the
 * interface.
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { CheckCircle, Info } from 'lucide-react'
import type { RealtimeSignals } from '../../signals/realtime-signals'
import {
  extractAlternativeSnippet,
  extractOutcomeSnippet,
  extractBaselineSnippet,
  extractConstraintRiskSnippet,
} from '../../signals/realtime-signals'

// ---------------------------------------------------------------------------
// Styling per readiness level
// ---------------------------------------------------------------------------

const READINESS_STYLES: Record<RealtimeSignals['readiness'], { label: string; textClass: string }> = {
  low:    { label: 'Low',    textClass: 'text-text-light' },
  ok:     { label: 'OK',     textClass: 'text-text-body' },
  strong: { label: 'Strong', textClass: 'text-success' },
}

// ---------------------------------------------------------------------------
// Popover row config
// ---------------------------------------------------------------------------

interface PopoverRow {
  key: string
  detected: boolean
  presentLabel: string
  missingLabel: string
  snippet: string | null
}

function buildRows(signals: RealtimeSignals, briefText: string): PopoverRow[] {
  return [
    {
      key: 'alternative',
      detected: signals.has_alternative,
      presentLabel: extractAlternativeSnippet(briefText) ?? 'Alternatives detected',
      missingLabel: 'No alternative spotted yet',
      snippet: null,
    },
    {
      key: 'outcome',
      detected: signals.has_measurable_outcome,
      presentLabel: extractOutcomeSnippet(briefText) ?? 'Measurable outcome detected',
      missingLabel: 'No success metric detected',
      snippet: null,
    },
    {
      key: 'baseline',
      detected: signals.has_baseline,
      presentLabel: extractBaselineSnippet(briefText) ?? 'Baseline detected',
      missingLabel: 'No baseline detected',
      snippet: null,
    },
    {
      key: 'constraint_risk',
      detected: signals.has_constraint_or_risk,
      presentLabel: extractConstraintRiskSnippet(briefText) ?? 'Constraint or risk detected',
      missingLabel: 'No constraint or risk mentioned',
      snippet: null,
    },
  ]
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ReadinessPillProps {
  signals: RealtimeSignals
  briefText: string
}

export function ReadinessPill({ signals, briefText }: ReadinessPillProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const { label, textClass } = READINESS_STYLES[signals.readiness]

  const toggle = useCallback(() => setOpen(prev => !prev), [])

  // Dismiss on click outside or Escape
  useEffect(() => {
    if (!open) return

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  const rows = buildRows(signals, briefText)

  return (
    <div ref={containerRef} className="relative inline-flex">
      <button
        type="button"
        onClick={toggle}
        className={`
          inline-flex items-center rounded-full font-medium
          px-2 py-0.5 text-xs
          bg-panel ${textClass}
          transition-opacity duration-200
          hover:opacity-80
        `}
        aria-expanded={open}
        aria-haspopup="true"
        data-testid="readiness-pill"
      >
        {label}
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-1 z-[9000] bg-panel rounded-lg py-2 px-3 min-w-[240px]"
          style={{ boxShadow: 'var(--shadow-2, 0 4px 12px rgba(0,0,0,0.08))' }}
          role="status"
          aria-label="Brief readiness details"
          data-testid="readiness-popover"
        >
          {rows.map(row => (
            <div key={row.key} className="flex items-start gap-2 py-1">
              {row.detected ? (
                <CheckCircle className="w-3.5 h-3.5 text-success flex-shrink-0 mt-0.5" aria-hidden="true" />
              ) : (
                <Info className="w-3.5 h-3.5 text-text-light flex-shrink-0 mt-0.5" aria-hidden="true" />
              )}
              <span className={`text-xs ${row.detected ? 'text-text-body' : 'text-text-light'}`}>
                {row.detected ? row.presentLabel : row.missingLabel}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
