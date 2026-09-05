/**
 * InlineField — input-local editing for the hero fields, with a visible
 * commit contract (no silent failures, no invisible Enter/blur dependency):
 *
 * - Typing performs zero store writes and shows a Save affordance while the
 *   draft differs from the committed value.
 * - Commit on Save click, Enter or blur. `onCommit` returns `true` when
 *   committed, or a hint string when the input cannot be used — the hint
 *   renders under the field and the user's text is kept (never a silent
 *   snap-back).
 * - A successful commit shows a brief saved tick; the committed, formatted
 *   value flows back down from the derivation hook in the same pass.
 * - Escape reverts to the committed value and clears any hint.
 *
 * Commit gating: a commit only happens while user input is pending
 * (`pendingInputRef`). This makes Enter commit exactly once (the follow-up
 * blur no-ops), makes Escape genuinely revert (the blur it triggers cannot
 * commit), and prevents a blur from writing a stale draft over an external
 * update the user never touched. A failed commit keeps the input pending so
 * Save can retry without refocusing.
 */

import { memo, useEffect, useRef, useState, type ReactNode } from 'react'
import { Check } from 'lucide-react'
import Tooltip from '../../../../components/Tooltip'
import { typography } from '../../../../styles/typography'
import { FIELD_FEEDBACK_COPY } from '../constants'
import { PanelIconButton } from '../ui/PanelIconButton'

const SAVED_TICK_MS = 1600

interface InlineFieldProps {
  label: string
  value: string
  placeholder: string
  /** Returns true when committed, or a hint string when input is unusable. */
  onCommit?: (raw: string) => true | string
  /** Render the producer value without offering a browser-only model edit. */
  readOnly?: boolean
  /** Warning-tinted border while the field needs attention. */
  attention?: boolean
  /** Trailing affordances (sparks, attribution). */
  trailing?: ReactNode
  inputId?: string
  ariaLabel: string
}

export const InlineField = memo(function InlineField({
  label,
  value,
  placeholder,
  onCommit,
  attention = false,
  trailing,
  inputId,
  ariaLabel,
  readOnly = false,
}: InlineFieldProps) {
  const [draft, setDraft] = useState(value)
  const [hint, setHint] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState(false)
  /** True while the user has typed something not yet committed or reverted. */
  const pendingInputRef = useRef(false)
  const focusedRef = useRef(false)
  const savedTimerRef = useRef<number | null>(null)

  // Reflect external commits unless the user has pending input.
  useEffect(() => {
    if (!pendingInputRef.current) setDraft(value)
  }, [value])

  useEffect(
    () => () => {
      if (savedTimerRef.current !== null) window.clearTimeout(savedTimerRef.current)
    },
    [],
  )

  const dirty = draft !== value

  const commit = () => {
    // Only user-typed input commits: Enter's follow-up blur, Escape's blur,
    // and blurs after an external update all no-op here.
    if (!pendingInputRef.current) return
    if (draft === value) {
      pendingInputRef.current = false
      setHint(null)
      return
    }
    if (!onCommit) return
    const result = onCommit(draft)
    if (result === true) {
      pendingInputRef.current = false
      setHint(null)
      setJustSaved(true)
      if (savedTimerRef.current !== null) window.clearTimeout(savedTimerRef.current)
      savedTimerRef.current = window.setTimeout(() => setJustSaved(false), SAVED_TICK_MS)
      // The committed value flows back via the value prop; re-anchor to it.
      setDraft(value)
    } else {
      // Keep the user's text (and the pending flag, so Save can retry) and
      // explain — never silently snap back.
      setHint(result)
    }
  }

  const revert = () => {
    pendingInputRef.current = false
    setDraft(value)
    setHint(null)
  }

  const hintId = inputId ? `${inputId}-hint` : undefined

  if (readOnly) {
    return (
      <div className="grid min-h-8 grid-cols-[56px_1fr_auto] items-center gap-2">
        <span className={`${typography.panelMeta} text-text-light`}>{label}</span>
        {/* ⭐ THIS READ `truncate`, AND THE FIELD IT TRUNCATES IS A VALUE.
            `HeroSection` passes `hero.success.displayText`, which
            `selectors/computeSuccessState.ts` builds with `formatWithUnit` — a
            number and its unit — so `£2,500,000 ARR` ellipsised mid-magnitude.
            Worse than the edge badge for recovery: there was no `title`, and
            `role="textbox"` without `tabIndex` is not focusable, so the full
            number had no hover, keyboard OR touch route. The editable branch
            below uses a real `<input>`, which scrolls and is caret-recoverable
            — but this branch is the one that ships: `readOnly` is
            `!GOAL_SUCCESS_EDIT_CONNECTED`, and `mutationAuthority.ts` declares
            `goalSuccessTarget: 'disabled'`, so `hasServerGraphAuthority` is
            false and the truncating branch is unconditional today.

            The remedy is the one `nodes/OptionNode.tsx` already ratified for a
            value that will not fit: the value "keeps as many lines as it needs".
            `min-h-8` is a FLOOR, so wrapping costs a taller row and never a
            wrong magnitude. `break-words` bounds the one case wrapping cannot
            reach — a single unbroken token wider than the column. */}
        <span
          id={inputId}
          role="textbox"
          aria-label={ariaLabel}
          aria-readonly="true"
          className={`${typography.panelBody} min-w-0 break-words px-2 text-text-header ${value ? '' : 'text-text-light'}`}
        >
          {value || placeholder}
        </span>
        <span className="flex items-center gap-1">{trailing}</span>
      </div>
    )
  }

  return (
    <div>
      <div className="grid min-h-8 grid-cols-[56px_1fr_auto] items-center gap-2">
        <span className={`${typography.panelMeta} text-text-light`}>{label}</span>
        <input
          id={inputId}
          aria-label={ariaLabel}
          aria-invalid={hint ? true : undefined}
          aria-describedby={hint ? hintId : undefined}
          className={`${typography.panelBody} h-8 w-full rounded-lg border bg-panel px-2 text-text-header outline-none transition-colors placeholder:text-text-light focus:border-info focus:ring-2 focus:ring-info/20 ${
            hint ? 'border-warning/60' : attention ? 'border-warning/60' : 'border-panel-border'
          }`}
          value={draft}
          placeholder={placeholder}
          onFocus={() => {
            focusedRef.current = true
          }}
          onChange={e => {
            pendingInputRef.current = true
            setDraft(e.target.value)
            if (hint) setHint(null)
          }}
          onBlur={() => {
            focusedRef.current = false
            commit()
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              commit()
              ;(e.target as HTMLInputElement).blur()
            } else if (e.key === 'Escape') {
              revert()
              ;(e.target as HTMLInputElement).blur()
            }
          }}
        />
        <span className="flex items-center gap-1">
          {dirty && !justSaved && (
            <Tooltip content={`Save (or press Enter)`} delay={300}>
              <PanelIconButton
                variant="go"
                aria-label={`Save ${label.toLowerCase()}`}
                // onMouseDown so the save wins over the input's blur-commit
                // ordering and reads the live draft.
                onMouseDown={e => e.preventDefault()}
                onClick={commit}
              >
                <Check className="h-3.5 w-3.5" aria-hidden />
              </PanelIconButton>
            </Tooltip>
          )}
          {justSaved && (
            <span
              className={`${typography.panelMeta} inline-flex items-center gap-1 text-success`}
              role="status"
            >
              <Check className="h-3.5 w-3.5" aria-hidden />
              {FIELD_FEEDBACK_COPY.saved}
            </span>
          )}
          {trailing}
        </span>
      </div>
      {hint && (
        <p id={hintId} className={`${typography.panelMeta} ml-16 mt-1 text-warning`} role="status">
          {hint}
        </p>
      )}
    </div>
  )
})
