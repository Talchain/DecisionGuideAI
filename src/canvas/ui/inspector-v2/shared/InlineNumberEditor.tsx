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
 *
 * ⭐⭐ `min` / `max` ARE ENFORCED ON COMMIT, AND UNTIL NOW THEY WERE NOT.
 *
 * They were accepted as props, painted onto the DOM element, and ignored. HTML
 * `min`/`max` on a number input constrain the STEPPER and set `:invalid`; they
 * do not stop a TYPED value, and nothing here called `checkValidity()`. The
 * whole guard was `if (isNaN(parsed)) return`.
 *
 * So `RiskPanel`'s likelihood field — which declares `min={0} max={100}`
 * (`panels/RiskPanel.tsx:139-140`) against a bound this repo's own field
 * register states as the contract ("A risk's likelihood [0,1]",
 * `canvas/domain/analyticalNodeFields.ts:184`) — accepted a typed `150`, and
 * `setProbability` then SILENTLY CLAMPED it to `1`
 * (`useInspectorMutations.ts:459-460`). The model held 100% while the person
 * believed they had said 150%, and nothing on screen said otherwise.
 *
 * The bound is still the CALLER'S declaration, never this component's opinion:
 * `FactorObservablePanel` declares none (`panels/FactorObservablePanel.tsx:317-326`)
 * because no bound is known for an arbitrary observed magnitude, and it is
 * unchanged — everything commits there, exactly as before.
 *
 * ⭐ AND A REFUSAL NOW SAYS WHY. Previously an unusable entry ran
 * `setIsEditing(false)` FIRST and then returned, so the field snapped back to
 * its old readout and the typed number vanished with no explanation. A silent
 * discard and a silent clamp are the same defect wearing different clothes.
 * The predicate and the copy are `AdvancedField`'s, shared through
 * `numericFieldAdmission` rather than re-typed — the two shared editors in this
 * directory were answering one question two ways.
 */
import { useState, useCallback, useMemo } from 'react'
import { typography } from '../../../../styles/typography'
import { admitNumericField } from './numericFieldAdmission'

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
  const [refusal, setRefusal] = useState<string | null>(null)

  const bounds = useMemo(
    () => ({ ...(min != null ? { min } : {}), ...(max != null ? { max } : {}) }),
    [min, max],
  )

  const handleSave = useCallback(() => {
    // ⚠ THE NO-OP IS ANSWERED FIRST, AND THE ORDER IS THE CONTRACT.
    //
    // A blur that changed nothing is not a claim about the value's
    // admissibility — the reader merely looked at the field. Checking bounds
    // first would put an error on a value the PRODUCER stored, which the person
    // did not type and cannot correct from here. It must close silently, as it
    // always has (Codex P1-4: committing the seeded value would round-trip it
    // through the caller's scale conversion, corrupting precision and falsely
    // dirtying the graph).
    //
    // `draft` is compared to the seed via the same parse used below, so a
    // "10.0" typed over a seeded 10 is still a no-op.
    const parsedDraft = parseFloat(draft)
    if (value != null && parsedDraft === value) {
      setIsEditing(false)
      setRefusal(null)
      return
    }

    // ⚠ AN EMPTY ENTRY IS "NO CHANGE", NOT AN ERROR — and this is deliberate
    // rather than inherited. The element is `type="number"`, which rewrites
    // everything it will not accept to `''`, so a cleared field and a
    // nonsense entry are INDISTINGUISHABLE by the time this runs. Erroring
    // would fire on someone who clicked in and clicked straight out, and no
    // single message could be true of both cases. Closing silently is exactly
    // today's behaviour for this input.
    if (draft.trim() === '') {
      setIsEditing(false)
      setRefusal(null)
      return
    }

    const admission = admitNumericField(draft, bounds)
    if (!admission.ok) {
      // STAY IN THE FIELD. The typed text is preserved and the reason is
      // rendered beneath it — the person can correct the number they meant
      // rather than watch it disappear.
      setRefusal(admission.reason)
      return
    }

    setIsEditing(false)
    setRefusal(null)
    onSave(admission.value)
  }, [draft, onSave, value, bounds])

  if (!isEditing) {
    return (
      <button
        type="button"
        data-testid={displayTestId}
        className={`${typography.panelHeader} text-xl text-left w-full cursor-text hover:bg-panel-hover rounded px-0.5 -mx-0.5 transition-colors`}
        onClick={() => {
          // Seed from the EXACT value, never a rounded display string.
          setDraft(value != null ? String(value) : '')
          setRefusal(null)
          setIsEditing(true)
        }}
        title={title}
      >
        {readout != null
          ? readout
          : <span className={`${typography.panelMeta} text-text-light italic`}>{placeholder}</span>
        }
      </button>
    )
  }

  return (
    <div>
      <input
        type="number"
        min={min}
        max={max}
        step={step ?? 'any'}
        data-testid={inputTestId}
        value={draft}
        autoFocus
        aria-label={ariaLabel}
        // Typing clears a standing refusal: it described the PREVIOUS entry, and
        // a message that outlives its condition is the same class of untruth as
        // one that never appears.
        onChange={e => { setDraft(e.target.value); if (refusal) setRefusal(null) }}
        onBlur={handleSave}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
        aria-invalid={refusal != null}
        aria-describedby={refusal != null ? `${inputTestId}-refusal` : undefined}
        className={`${typography.panelHeader} text-xl w-full bg-transparent border-b ${refusal ? 'border-danger' : 'border-panel-border'} focus:border-primary outline-none py-0.5 transition-colors`}
      />
      {refusal && (
        // `role="alert"` because the message appears in response to the
        // person's own commit and must reach a screen reader that has moved on
        // from the field — the same reason `aria-describedby` alone is not
        // enough here.
        <p
          id={`${inputTestId}-refusal`}
          role="alert"
          data-testid={`${inputTestId}-refusal`}
          className={`${typography.panelMeta} text-danger mt-0.5`}
        >
          {refusal}
        </p>
      )}
    </div>
  )
}
