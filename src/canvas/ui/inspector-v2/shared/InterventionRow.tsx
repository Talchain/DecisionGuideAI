/**
 * InterventionRow — Factor link + baseline → editable input + Δ%
 * Used in OptionPanel §6.2: "What this option changes"
 */

import { useState, useCallback, useRef, type KeyboardEvent } from 'react'
import { ArrowRight } from 'lucide-react'
import { NodeShapeIndicator } from '../../../nodes/NodeShapeIndicator'
import { typography } from '../../../../styles/typography'
import {
  classifyInterventionProvenance,
  type ValueProvenanceKind,
} from '../../../domain/valueProvenance'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ⭐⭐ WHO CHOSE THIS TARGET — THE INSPECTOR'S REGISTER (B1-b)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `valueProvenance` owns the KIND and says so in its own header: *"Each surface
 * keeps its own register (the Model tab is terse, the inspector writes
 * sentences) but must be TOTAL over `ValueProvenanceKind` — a
 * `Record<ValueProvenanceKind, …>` makes a missing kind a type error rather than
 * a silent fallback."* This is the Inspector's.
 *
 * ⚠⚠ NOT ONE NEW WORD. Every string below is one this surface ALREADY says
 * through `inspectorStrings`: `getExtractionLabel('brief_extraction')` is "From
 * your brief", `getExtractionLabel('cee_inference')` is "Estimated by Olumi",
 * and `ATTRIBUTED_LABEL` supplies the other four. The spec's T-VOICE asserts
 * that agreement pair by pair against `getExtractionLabel` itself, so this is a
 * DERIVED register rather than a fourth hand-maintained copy of the same concept
 * (CLAUDE.md trap 12). If the Inspector changes its voice, this REDs.
 *
 * ⚠⚠ AND THE REASON IT IS NOT SIMPLY `getExtractionLabel(source)`, WHICH WAS THE
 * FIRST THING THIS LANE TRIED. That function classifies through
 * `classifyValueProvenance` — the NODE `observed_state.source` vocabulary. Two
 * of the three intervention literals are not members of it, so both fall through
 * to its default arm:
 *
 *   · `cee_hypothesis` → "Estimated by Olumi" — right, by accident
 *   · `user_specified` → **"Estimated by Olumi"** — the machine claiming
 *     authorship of a number the user typed, which is the exact inversion this
 *     component exists to prevent
 *
 * The vocabularies overlap on `brief_extraction` ONLY, which is what makes the
 * reuse look harmless (trap 21 — two authorities answering different questions
 * under one field name). `T-VOCAB` pins the inversion so nobody "simplifies"
 * this back to the helper.
 *
 * ⚠ FOUR ARMS ARE UNREACHABLE ON THIS TIP, stated rather than discovered later:
 * `classifyInterventionProvenance` maps the contract's three literals onto
 * `brief`, `ai` and `edited` only. `confirmed`, `assumption`, `human` and
 * `panel` exist here so a future kind lands with COPY instead of a type hole —
 * they are not covered by any render test and must not be claimed as such.
 * `T-REACH` pins the reachable set, so a schemas minor that adds a literal REDs
 * rather than arriving silently on an arm nobody has read since it was typed.
 */
export const INSPECTOR_INTERVENTION_PROVENANCE_LABEL: Record<ValueProvenanceKind, string> = {
  brief: 'From your brief',
  ai: 'Estimated by Olumi',
  edited: 'Set by you',
  confirmed: 'Confirmed by you',
  assumption: 'Your assumption',
  /** No intervention literal reaches this kind today — see T-VOICE. */
  human: 'Set by you',
  panel: 'From your panel',
}

/** Border tint per kind. TEXT is the mark; this only reinforces it. */
const INSPECTOR_INTERVENTION_PROVENANCE_BORDER: Record<ValueProvenanceKind, string> = {
  brief: 'border-info/30',
  ai: 'border-warning/30',
  edited: 'border-success/30',
  confirmed: 'border-success/30',
  assumption: 'border-success/30',
  human: 'border-success/30',
  panel: 'border-info/30',
}

interface InterventionRowProps {
  factorId: string
  factorLabel: string
  /** Baseline value in raw units */
  baseline?: number
  /** Current intervention value */
  currentValue: number
  /** CEE-authored display_value for the intervention — rendered verbatim when
   * present, replacing the "Currently: X → editable" numeric formatter. */
  displayValue?: string
  unit?: string
  /**
   * ⭐ THE PRODUCER'S OWN `source` STAMP FOR **THIS INTERVENTION** — the RAW
   * literal (`'cee_hypothesis'`, `'brief_extraction'`, `'user_specified'`),
   * classified HERE by the one authority. Never a pre-classified kind: several
   * literals map to one kind, and an inverse map at the caller would be a second
   * mirror of the classifier.
   *
   * ⚠ UNDEFINED MEANS THE RECORD DOES NOT SAY, and this component then renders
   * NOTHING. Not "Estimated by Olumi", not "From your brief", and not a "Not
   * set" fallback — "Not set" is a claim about the VALUE, and the value is set.
   * A default in any direction is an invented provenance, which is the defect
   * one level up from the one this prop closes.
   */
  provenanceSource?: string
  onChange: (newValue: number) => void
  onNavigate?: () => void
  disabled?: boolean
  techMode?: boolean
  /** Normalised model value (0-1) for tech display */
  normalisedValue?: number
}

export function InterventionRow({
  factorId,
  factorLabel,
  baseline,
  currentValue,
  displayValue,
  unit = '',
  provenanceSource,
  onChange,
  onNavigate,
  disabled = false,
  techMode = false,
  normalisedValue,
}: InterventionRowProps) {
  const [draft, setDraft] = useState(String(currentValue))
  const inputRef = useRef<HTMLInputElement>(null)

  const handleBlur = useCallback(() => {
    const parsed = parseFloat(draft)
    if (!isNaN(parsed) && parsed !== currentValue) {
      onChange(parsed)
    } else {
      setDraft(String(currentValue))
    }
  }, [draft, currentValue, onChange])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      inputRef.current?.blur()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setDraft(String(currentValue))
      inputRef.current?.blur()
    }
  }, [currentValue])

  // Change delta
  const delta = baseline != null && baseline !== 0
    ? ((currentValue - baseline) / Math.abs(baseline)) * 100
    : null
  const deltaSign = delta != null ? (delta > 0 ? '\u2191' : delta < 0 ? '\u2193' : '') : ''
  const deltaColor = delta != null ? (delta > 0 ? 'text-success' : delta < 0 ? 'text-danger' : 'text-text-light') : ''

  const formatValue = (v: number) => {
    if (unit === '\u00A3' || unit === '$' || unit === '\u20AC') {
      return `${unit}${v.toLocaleString()}`
    }
    return unit ? `${v.toLocaleString()} ${unit}` : v.toLocaleString()
  }

  // F.6 passthrough: when CEE provides display_value, it IS the canonical
  // default-mode user-facing text. Raw numeric baseline/delta/editable input
  // only surface in tech mode to preserve editability for operators. This
  // also satisfies the Brief 4 constraint "InterventionRow reading
  // intervention.value directly when intervention.display_value is present".
  const hasDisplayValue = !!displayValue
  const showNumericSurface = !hasDisplayValue || techMode

  /**
   * ⚠ CLASSIFIED ONCE, OUTSIDE BOTH VALUE BRANCHES. The mark must not hang off
   * `showNumericSurface` or off `hasDisplayValue`: CEE writes a `display_value`
   * for some interventions and not others, and a mark on either branch alone
   * would vanish on exactly the rows the producer had written prose for. `null`
   * is the honest answer for an unknown or absent stamp and renders nothing.
   */
  const provenance = classifyInterventionProvenance(provenanceSource)

  return (
    <div
      data-testid={`inspector-intervention-${factorId}`}
      className="bg-panel border border-panel-border rounded-lg p-2.5 mb-1.5"
    >
      {/* Factor label + change indicator (delta hidden when displayValue is primary) */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-1.5">
          <NodeShapeIndicator nodeKind="factor" size={14} />
          <button
            type="button"
            onClick={onNavigate}
            className={`${typography.panelBody} text-text-body hover:text-info transition-colors truncate ${onNavigate ? 'cursor-pointer hover:underline' : ''}`}
            disabled={!onNavigate}
          >
            {factorLabel}
          </button>
        </div>
        {delta != null && showNumericSurface && (
          <span
            className={`${typography.panelMeta} ${deltaColor}`}
            title="Change vs baseline"
            aria-label={`${Math.abs(delta).toFixed(0)}% change vs baseline`}
          >
            {deltaSign} {Math.abs(delta).toFixed(0)}%
          </span>
        )}
      </div>

      {/* CEE-authored display_value — canonical default-mode text when present */}
      {hasDisplayValue && (
        <div className={`${typography.panelBody} text-text-body mt-1 ${techMode ? 'italic text-text-light' : ''}`}>
          {displayValue}
        </div>
      )}

      {/* Baseline → editable input (default mode when no displayValue, or always in techMode) */}
      {showNumericSurface && (
        <div className="flex items-center gap-2 mt-2">
          <div className="flex-1">
            <div className={`${typography.panelMeta} text-text-light`}>
              Currently: {baseline != null ? formatValue(baseline) : 'N/A'}
            </div>
          </div>
          <ArrowRight size={10} className="text-text-light flex-shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            className={`${typography.panelBody} w-[110px] px-2 py-1 border rounded-lg text-center bg-panel ${
              disabled ? 'border-panel-border text-text-light' : 'border-info'
            }`}
          />
        </div>
      )}

      {/*
        ⭐ WHO CHOSE THIS NUMBER — IN THE SAME GLANCE AS THE NUMBER.

        ⚠⚠ THE DEFECT THIS CLOSES, ON THE SURFACE IT WAS WITNESSED ON (B1-b).
        UI #827 closed it on the Model tab; the Inspector — reached by
        double-clicking a node on the canvas, arguably before anyone opens the
        Model tab — still dropped `source` at `OptionPanel`'s destructure, so
        this row received no provenance and rendered the number bare. On the
        witnessed draw that meant a target CEE had invented (raw 22,500, no
        unit, `value_confidence: low`, CEE's own reasoning saying *"this amount
        is not stated in the brief"*) sitting in the same control, the same
        typography and with no badge, tooltip or unit beside the user's own
        £45,000. **The only difference between them was the digits.**

        ⚠ INLINE, NOT BEHIND A HOVER AND NOT IN A DISCLOSURE. A mark a user has
        to go and look for arrives after they have already believed the number.
        This costs no extra interaction — it is beneath the figure it qualifies,
        on both value branches.

        ⚠ TEXT, NOT COLOUR ALONE. The border tint reinforces a sentence that is
        already readable; it never carries the meaning by itself.

        ⚠ NO STAMP ⇒ NOTHING RENDERS. Unknown stays unknown.
      */}
      {provenance !== null && (
        <div className="mt-1.5">
          <span
            data-testid={`inspector-intervention-${factorId}-provenance`}
            className={`inline-flex items-center px-2 py-0.5 rounded-full bg-transparent border ${INSPECTOR_INTERVENTION_PROVENANCE_BORDER[provenance.kind]} text-text-body ${typography.panelMeta}`}
          >
            {INSPECTOR_INTERVENTION_PROVENANCE_LABEL[provenance.kind]}
          </span>
        </div>
      )}

      {/* Tech mode: normalised value */}
      {techMode && normalisedValue != null && (
        <div className={`${typography.panelMeta} text-text-light mt-1`}>
          System: model value: {normalisedValue.toFixed(2)}
        </div>
      )}
    </div>
  )
}
