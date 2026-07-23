/**
 * InlineNumberEditor — the click-to-edit numeric field shared by the inspector
 * panels. Extracted from the near-verbatim duplicates in FactorObservablePanel
 * (the observed value editor) and RiskPanel (the likelihood editor).
 *
 * Display mode: a full-width, left-aligned button showing the formatted
 * `readout` string, or the italic `placeholder` when there is no value. Click
 * enters edit mode.
 *
 * Edit mode: a number input seeded with `editSeed`; blur OR Enter commits.
 * On a commit that parses to a number the parsed value is handed to `onSave`
 * (the CALLER owns any scale conversion — e.g. percent → 0-1 — and the edit
 * confirmation, so semantic transforms stay tagged at their panel); a
 * non-numeric entry is discarded. Either outcome returns to display mode.
 *
 * Rendering is byte-identical to the two original inline editors — the panels'
 * existing specs pin the testids/markup and stay green.
 */
import { useState, useCallback } from 'react'
import { typography } from '../../../../styles/typography'

interface InlineNumberEditorProps {
  /** Formatted display string when a value exists; `null` renders the placeholder. */
  readout: string | null
  /** Italic copy shown when `readout` is null (e.g. "No value set. Click to enter."). */
  placeholder: string
  /** Seeds the input's editable string when entering edit mode. */
  editSeed: string
  /**
   * Called with the parsed number on a valid commit. The caller applies any
   * scale conversion and edit confirmation (keeping UI-SEM tags at the panel).
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
  step?: number
  ariaLabel?: string
}

export function InlineNumberEditor({
  readout,
  placeholder,
  editSeed,
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
    const parsed = parseFloat(draft)
    if (!isNaN(parsed)) onSave(parsed)
    setIsEditing(false)
  }, [draft, onSave])

  if (!isEditing) {
    return (
      <button
        type="button"
        data-testid={displayTestId}
        className={`${typography.panelHeader} text-xl text-left w-full cursor-text hover:bg-panel-hover rounded px-0.5 -mx-0.5 transition-colors`}
        onClick={() => {
          setDraft(editSeed)
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
      step={step}
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
