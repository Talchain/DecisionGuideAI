/**
 * InlineNumberEditor — the click-to-edit numeric field shared by the inspector
 * panels. Extracted from the near-verbatim duplicates in FactorObservablePanel
 * (the observed value editor) and RiskPanel (the likelihood editor).
 *
 * Display mode: a full-width, left-aligned button showing the formatted
 * `readout` string, or the italic `placeholder` when there is no value. Click
 * enters edit mode.
 *
 * Edit mode: a number input seeded with the EXACT current `value` (Codex P1-4);
 * blur OR Enter commits. On commit the parsed number is handed to `onSave` (the
 * CALLER owns any scale conversion — e.g. percent → 0-1 — and the edit
 * confirmation, so semantic transforms stay tagged at their panel).
 *
 * PRECISION / NO-OP (Codex P1-4): the draft is seeded from the UNROUNDED `value`,
 * never from a rounded display string, and a commit whose parsed draft EQUALS the
 * seeded exact `value` is a NO-OP (onSave is not called). This fixes a passthrough
 * violation where opening a 0.376 probability (displayed "38%") and tabbing out
 * committed 0.38 — destroying producer precision and falsely marking the graph
 * dirty. Display formatting stays separate: `readout` may still be rounded.
 * Fractional input is permitted (step defaults to "any").
 */
import { useState, useCallback } from 'react'
import { typography } from '../../../../styles/typography'

interface InlineNumberEditorProps {
  /** Formatted display string when a value exists; `null` renders the placeholder. */
  readout: string | null
  /** Italic copy shown when `readout` is null (e.g. "No value set. Click to enter."). */
  placeholder: string
  /**
   * The EXACT current value in the editor's own scale (percent for RiskPanel, raw
   * for FactorObservablePanel). Seeds the input unrounded and is the no-op
   * baseline: a commit that parses to this exact value does not call `onSave`.
   * `null` means "no current value" — the input seeds empty.
   */
  value: number | null
  /**
   * Called with the parsed number on a valid commit that DIFFERS from `value`.
   * The caller applies any scale conversion and edit confirmation (keeping
   * UI-SEM tags at the panel).
   */
  onSave: (parsed: number) => void
  /** data-testid for the display button. */
  displayTestId: string
  /** data-testid for the number input. */
  inputTestId: string
  /** Title on the display button. */
  title?: string
  /** Optional numeric input constraints + aria-label (e.g. risk's 0–100 %). */
  min?: number
  max?: number
  /** Input step. Defaults to "any" so fractional producer values are editable. */
  step?: number | 'any'
  ariaLabel?: string
}

export function InlineNumberEditor({
  readout,
  placeholder,
  value,
  onSave,
  displayTestId,
  inputTestId,
  title,
  min,
  max,
  step,
  ariaLabel,
}: InlineNumberEditorProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState<string>('')

  const handleSave = useCallback(() => {
    setIsEditing(false)
    const parsed = parseFloat(draft)
    // Non-numeric entry is discarded.
    if (isNaN(parsed)) return
    // No-op blur (Codex P1-4): the parsed draft equals the seeded exact value, so
    // nothing changed — do NOT call onSave (which would round-trip through the
    // caller's scale conversion, corrupting precision and falsely dirtying).
    if (value != null && parsed === value) return
    onSave(parsed)
  }, [draft, onSave, value])

  if (!isEditing) {
    return (
      <button
        type="button"
        data-testid={displayTestId}
        className={`${typography.panelHeader} text-xl text-left w-full cursor-text hover:bg-panel-hover rounded px-0.5 -mx-0.5 transition-colors`}
        onClick={() => {
          // Seed from the EXACT value, never a rounded display string.
          setDraft(value != null ? String(value) : '')
          setIsEditing(true)
        }}
        title={title}
      >
        {readout != null
          ? readout
          : <span className={`${typography.panelMeta} text-text-light italic font-normal text-sm`}>{placeholder}</span>
        }
      </button>
    )
  }

  return (
    <input
      type="number"
      min={min}
      max={max}
      step={step ?? 'any'}
      data-testid={inputTestId}
      value={draft}
      autoFocus
      aria-label={ariaLabel}
      onChange={e => setDraft(e.target.value)}
      onBlur={handleSave}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
      className={`${typography.panelHeader} text-xl w-full bg-transparent border-b border-panel-border focus:border-primary outline-none py-0.5 transition-colors`}
    />
  )
}
