/**
 * EditableLabel — inline text editing with blur-save
 * Enter saves and blurs. Escape reverts and blurs.
 */

import { useState, useCallback, useRef, useEffect, type KeyboardEvent } from 'react'

interface EditableLabelProps {
  value: string
  onSave?: (value: string) => void
  maxLength?: number
  className?: string
  placeholder?: string
}

export function EditableLabel({
  value,
  onSave,
  maxLength = 100,
  className = '',
  placeholder = 'Untitled',
}: EditableLabelProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync external value changes
  useEffect(() => {
    if (!isEditing) setDraft(value)
  }, [value, isEditing])

  const save = useCallback(() => {
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
    // Read-only mode
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
        className={`${className} cursor-text text-left truncate block w-full hover:bg-panel-hover rounded px-0.5 -mx-0.5 transition-colors`}
        onClick={() => {
          setIsEditing(true)
          // Focus after render
          requestAnimationFrame(() => inputRef.current?.focus())
        }}
        title={value}
      >
        {value || placeholder}
      </button>
    )
  }

  return (
    <input
      ref={inputRef}
      type="text"
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={save}
      onKeyDown={handleKeyDown}
      maxLength={maxLength}
      className={`${className} w-full bg-transparent border-b border-info outline-none px-0.5 -mx-0.5`}
      autoFocus
    />
  )
}
