/**
 * InlineEdit — shared click-to-edit component for the model-tab suite.
 * Extracted from ModelTabBody to be reusable across section components.
 */

import {
  useState,
  useCallback,
  useRef,
  type KeyboardEvent,
  type ChangeEvent,
} from 'react'
import { typography } from '../../../styles/typography'

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useInlineEdit(
  savedValue: string,
  onSave: (val: string) => void,
  validate?: (val: string) => boolean,
) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(savedValue)
  const [invalid, setInvalid] = useState(false)

  const startEdit = useCallback(() => {
    setDraft(savedValue)
    setInvalid(false)
    setEditing(true)
  }, [savedValue])

  const commit = useCallback(() => {
    if (validate && !validate(draft)) { setInvalid(true); return }
    setInvalid(false)
    setEditing(false)
    if (draft !== savedValue) onSave(draft)
  }, [draft, savedValue, onSave, validate])

  const cancel = useCallback(() => {
    setDraft(savedValue)
    setInvalid(false)
    setEditing(false)
  }, [savedValue])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') { e.preventDefault(); commit() }
      if (e.key === 'Escape') { e.preventDefault(); cancel() }
    },
    [commit, cancel],
  )

  return { editing, draft, invalid, setDraft, startEdit, commit, cancel, handleKeyDown }
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface InlineEditProps {
  value: string
  displayValue?: string
  placeholder?: string
  onSave: (val: string) => void
  validate?: (val: string) => boolean
  maxWidth?: string
  numeric?: boolean
  prefix?: string
  suffix?: string
  testId?: string
  tooltip?: string
}

export function InlineEdit({
  value,
  displayValue,
  placeholder = '—',
  onSave,
  validate,
  maxWidth = 'max-w-[120px]',
  numeric = false,
  prefix,
  suffix,
  testId,
  tooltip,
}: InlineEditProps) {
  const { editing, draft, invalid, setDraft, startEdit, commit, cancel, handleKeyDown } =
    useInlineEdit(value, onSave, validate)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFocus = useCallback(() => {
    startEdit()
    setTimeout(() => inputRef.current?.select(), 0)
  }, [startEdit])

  if (editing) {
    return (
      <span className="inline-flex items-center gap-0.5">
        {prefix && <span className={`${typography.panelMeta} text-text-light`}>{prefix}</span>}
        <input
          ref={inputRef}
          type={numeric ? 'number' : 'text'}
          value={draft}
          autoFocus
          onChange={(e: ChangeEvent<HTMLInputElement>) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          className={`${maxWidth} ${typography.panelBody} text-text-header px-2 py-0.5 rounded-sm border ${
            invalid ? 'border-danger' : 'border-panel-border hover:border-info/30'
          } bg-panel focus:outline-none focus:ring-1 focus:ring-info/50`}
          data-testid={testId}
        />
        {suffix && <span className={`${typography.panelMeta} text-text-light`}>{suffix}</span>}
      </span>
    )
  }

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={(e) => { e.stopPropagation(); handleFocus() }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleFocus() }}
      className="inline-flex items-center gap-0.5 cursor-pointer rounded-md border border-panel-border bg-panel px-2 py-0.5 hover:border-info transition-colors"
      title={tooltip ?? 'Click to edit'}
      data-testid={testId ? `${testId}-display` : undefined}
    >
      {prefix && <span className={`${typography.panelMeta} text-text-light`}>{prefix}</span>}
      <span className={`${typography.panelBody} ${(displayValue ?? value) ? 'text-text-header' : 'text-text-light'}`}>
        {(displayValue ?? value) || placeholder}
      </span>
      {suffix && <span className={`${typography.panelMeta} text-text-light ml-0.5`}>{suffix}</span>}
    </span>
  )
}
