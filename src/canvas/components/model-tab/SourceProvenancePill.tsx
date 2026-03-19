/**
 * SourceProvenancePill — outlined pill showing factor/goal value provenance.
 *
 * Maps:
 *   'brief_extraction' → "From brief"   (info border)
 *   'cee_inference'    → "AI estimate"  (warning border)
 *   'user'             → "User edited"  (success border)
 *   undefined/other    → "Not set"      (default border)
 */

import { typography } from '../../../styles/typography'

interface SourceProvenancePillProps {
  source: string | undefined
  /** Show "Not set" pill even when source is absent; default true */
  showWhenAbsent?: boolean
}

const CONFIG: Record<string, { label: string; border: string }> = {
  brief_extraction: { label: 'From brief', border: 'border-info/30' },
  cee_inference:    { label: 'AI estimate', border: 'border-warning/30' },
  user:             { label: 'User edited', border: 'border-success/30' },
}

const FALLBACK = { label: 'Not set', border: 'border-panel-border' }

export function SourceProvenancePill({ source, showWhenAbsent = true }: SourceProvenancePillProps) {
  const config = source ? (CONFIG[source] ?? FALLBACK) : FALLBACK
  if (!source && !showWhenAbsent) return null

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full bg-transparent border ${config.border} text-text-body ${typography.panelMeta} font-medium`}
      title={source ? `Source: ${source}` : 'No source set'}
    >
      {config.label}
    </span>
  )
}
