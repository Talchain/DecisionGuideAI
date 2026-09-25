/**
 * A3 — Esc in the rename field must NOT save the half-typed draft.
 *
 * `revert()` calls `setDraft(value)` then `setIsEditing(false)`, both async
 * state updates. The Escape handler then calls `inputRef.current?.blur()`,
 * which fires `onBlur={save}` synchronously — before React has flushed the
 * revert. `save()` reads the still-stale `draft` (the half-typed text) and
 * calls `onSave` with it.
 *
 * Spec: type a new value, press Escape → `onSave` is NOT called and the
 * rendered label is unchanged.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { EditableLabel } from '../EditableLabel'

describe('EditableLabel — Escape cancels without saving', () => {
  it('does not call onSave, and leaves the label unchanged, after Escape', () => {
    const onSave = vi.fn()
    render(<EditableLabel value="Original name" onSave={onSave} />)

    fireEvent.click(screen.getByTestId('inspector-rename-trigger'))
    const input = screen.getByTestId('inspector-rename-input') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Half-typed junk' } })
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByTestId('inspector-rename-trigger')).toHaveTextContent('Original name')
  })
})
