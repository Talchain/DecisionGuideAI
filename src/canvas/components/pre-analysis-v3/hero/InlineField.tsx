/**
 * InlineField — input-local editing for the hero fields.
 *
 * Typing performs zero store writes; the value commits on blur or Enter
 * (only when changed), Escape reverts. The committed value flows back down
 * from the derivation hook, so bars, ladder, pills and footer update in the
 * same pass as the commit.
 */

import { memo, useEffect, useRef, useState, type ReactNode } from 'react'
import { typography } from '../../../../styles/typography'

interface InlineFieldProps {
  label: string
  value: string
  placeholder: string
  onCommit: (raw: string) => void
  /** Warning-tinted border while the field needs attention. */
  attention?: boolean
  /** Trailing affordances (sparks, save). */
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
}: InlineFieldProps) {
  const [draft, setDraft] = useState(value)
  const editingRef = useRef(false)

  // Reflect external commits unless the user is mid-edit.
  useEffect(() => {
    if (!editingRef.current) setDraft(value)
  }, [value])

  const commit = () => {
    editingRef.current = false
    if (draft !== value) onCommit(draft)
    // Re-anchor to the canonical value: a valid commit re-renders with the
    // new prop (the sync effect corrects this), an ignored/invalid commit
    // reverts the input instead of leaving stale text behind.
    setDraft(value)
  }

  return (
    <div className="grid min-h-[30px] grid-cols-[56px_1fr_auto] items-center gap-2">
      <span className={`${typography.panelMeta} text-text-light`}>{label}</span>
      <input
        id={inputId}
        aria-label={ariaLabel}
        className={`${typography.panelBody} h-8 w-full rounded-lg border bg-panel px-2.5 text-text-header outline-none transition-colors placeholder:text-text-light focus:border-info focus:ring-2 focus:ring-info/20 ${
          attention ? 'border-warning/60' : 'border-panel-border'
        }`}
        value={draft}
        placeholder={placeholder}
        onFocus={() => {
          editingRef.current = true
        }}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            commit()
            ;(e.target as HTMLInputElement).blur()
          } else if (e.key === 'Escape') {
            editingRef.current = false
            setDraft(value)
            ;(e.target as HTMLInputElement).blur()
          }
        }}
      />
      {trailing ? <span className="flex items-center gap-0.5">{trailing}</span> : <span />}
    </div>
  )
})
