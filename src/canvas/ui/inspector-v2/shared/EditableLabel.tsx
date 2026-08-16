/**
 * EditableLabel — inline title editing with blur-save.
 * Enter saves and blurs. Escape reverts and blurs.
 *
 * L-04 — three defects closed here:
 *
 * 1. NO VISIBLE AFFORDANCE. This was a bare `<button>` whose only hint was
 *    `cursor-text`, so nothing on screen said the title could be renamed.
 *    It now carries a persistent pencil cue, a dotted underline, and a real
 *    accessible name ("Rename …").
 *
 * 2. THE DRAG HANDLE SWALLOWED IT. The control lives inside the inspector
 *    header, which is the panel's drag surface. `onPointerDown` is stopped
 *    here so a press on the title starts an edit, not a drag. Scoped to this
 *    control only — the rest of the header still drags.
 *
 * 3. SILENT TRUNCATION. The input allowed 500 characters while the store
 *    setter sliced to 100 and told nobody. There is now ONE limit — the
 *    store's, imported from the setter that enforces it, not re-typed — the
 *    input stops at it, and a counter appears as the user approaches it.
 *
 * `autoEdit` mounts the field already in editing state. That is what makes a
 * canvas double-click land the user in the input (see `renameIntent.ts`).
 */

import { useState, useCallback, useRef, useEffect, type KeyboardEvent } from 'react'
import { Pencil } from 'lucide-react'
import { NODE_LABEL_MAX_LENGTH } from '../useInspectorMutations'

/** Characters remaining at which the counter appears. */
const COUNTER_REVEAL_MARGIN = 20

interface EditableLabelProps {
  value: string
  onSave?: (value: string) => void
  maxLength?: number
  className?: string
  placeholder?: string
  /** Mount directly in editing state (canvas double-click → rename). */
  autoEdit?: boolean
}

export function EditableLabel({
  value,
  onSave,
  maxLength = NODE_LABEL_MAX_LENGTH,
  className = '',
  placeholder = 'Untitled',
  autoEdit = false,
}: EditableLabelProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync external value changes
  useEffect(() => {
    if (!isEditing) setDraft(value)
  }, [value, isEditing])

  // Rename intent: open the editor when asked. Only reacts to the transition
  // INTO true, so clearing the intent does not slam the editor shut under the
  // user's cursor.
  useEffect(() => {
    if (autoEdit && onSave) {
      setIsEditing(true)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [autoEdit, onSave])

  const save = useCallback(() => {
    // The input already caps at `maxLength`; the slice is defensive only, and
    // can no longer discard text the user was allowed to type.
    const trimmed = draft.trim().slice(0, maxLength)
    if (trimmed && trimmed !== value && onSave) {
      onSave(trimmed)
    }
    setIsEditing(false)
  }, [draft, maxLength, value, onSave])

  const revert = useCallback(() => {
    setDraft(value)
    setIsEditing(false)
  }, [value])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      save()
      inputRef.current?.blur()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      revert()
      inputRef.current?.blur()
    }
  }, [save, revert])

  if (!onSave) {
    // Read-only mode — no rename affordance, because there is no rename.
    return (
      <span className={className} title={value}>
        {value || placeholder}
      </span>
    )
  }

  if (!isEditing) {
    return (
      <button
        type="button"
        data-testid="inspector-rename-trigger"
        className={`${className} group cursor-text text-left flex items-center gap-1 w-full min-w-0 hover:bg-panel-hover rounded px-0.5 -mx-0.5 transition-colors`}
        // The header above is the drag surface. Without this, pressing the
        // title starts a panel drag instead of an edit.
        onPointerDown={e => e.stopPropagation()}
        onClick={() => {
          setIsEditing(true)
          requestAnimationFrame(() => inputRef.current?.focus())
        }}
        title={`Rename — ${value || placeholder}`}
        aria-label={`Rename ${value || placeholder}`}
      >
        <span className="truncate border-b border-dashed border-panel-border group-hover:border-info">
          {value || placeholder}
        </span>
        <Pencil
          size={12}
          data-testid="inspector-rename-cue"
          aria-hidden="true"
          className="shrink-0 text-text-light group-hover:text-info transition-colors"
        />
      </button>
    )
  }

  const remaining = maxLength - draft.length

  return (
    <div className="w-full">
      <input
        ref={inputRef}
        type="text"
        data-testid="inspector-rename-input"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onPointerDown={e => e.stopPropagation()}
        onBlur={save}
        onKeyDown={handleKeyDown}
        maxLength={maxLength}
        aria-label="Element name"
        className={`${className} w-full bg-transparent border-b border-info outline-none px-0.5 -mx-0.5`}
        autoFocus
      />
      {remaining <= COUNTER_REVEAL_MARGIN && (
        <span
          data-testid="inspector-rename-counter"
          className="block text-[11px] leading-snug text-text-light mt-0.5"
        >
          {draft.length}/{maxLength} characters
        </span>
      )}
    </div>
  )
}
