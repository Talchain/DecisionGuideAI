/**
 * SourceProvenancePill — outlined pill showing factor/goal value provenance.
 *
 * Maps (by CLASS, not by literal — see below):
 *   brief      → "From brief"        (info border)
 *   ai         → "AI estimate"       (warning border)
 *   confirmed  → "Confirmed by you"  (success border)
 *   edited     → "User edited"       (success border)
 *   assumption → "Your assumption"   (success border)
 *   unknown    → "Not set"           (default border)
 *
 * ⭐ ROADMAP 2.638 S2 — WHAT THIS USED TO DO, AND WHY IT MATTERED.
 * The map was keyed on three literals. `user_confirmed` and `user_override` —
 * the two stamps the pre-analysis drill-in and the OutputsDock actually write,
 * and the ones the Model tab is most likely to be looking at — missed the map
 * and fell to the FALLBACK, so a value the user had explicitly confirmed
 * rendered **"Not set"** on a live, unflagged surface. The pill was not merely
 * silent about the confirmation; it asserted its opposite.
 *
 * Keying on the canonical CLASS instead means a new source literal is labelled
 * the moment it is classified once, rather than in each of the surfaces that
 * happen to render it (CLAUDE.md trap 12). The record is TOTAL over
 * `ValueProvenanceKind`, so a new kind is a type error here.
 *
 * "Confirmed by you" is a STATUS. Confirming does not change the analysis
 * today — the compute half is S4 — and this copy must not suggest it does.
 */

import { typography } from '../../../styles/typography'
import { classifyValueProvenance, type ValueProvenanceKind } from '../../domain/valueProvenance'

interface SourceProvenancePillProps {
  source: string | undefined
  /** Show "Not set" pill even when source is absent; default true */
  showWhenAbsent?: boolean
}

const CONFIG: Record<ValueProvenanceKind, { label: string; border: string }> = {
  brief:      { label: 'From brief', border: 'border-info/30' },
  ai:         { label: 'AI estimate', border: 'border-warning/30' },
  confirmed:  { label: 'Confirmed by you', border: 'border-success/30' },
  edited:     { label: 'User edited', border: 'border-success/30' },
  assumption: { label: 'Your assumption', border: 'border-success/30' },
  human:      { label: 'Set by you', border: 'border-success/30' },
}

const FALLBACK = { label: 'Not set', border: 'border-panel-border' }

export function SourceProvenancePill({ source, showWhenAbsent = true }: SourceProvenancePillProps) {
  const cls = classifyValueProvenance(source)
  const config = cls ? CONFIG[cls.kind] : FALLBACK
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
