/**
 * Model tab v2 — KEYBOARD NAVIGATION (design §5.2).
 *
 * The honesty property here is the quiet one: with NO write authority wired,
 * every key that would cause a mutation must do NOTHING — not swallow the
 * gesture, not report a success, not consume the event. A keyboard user has no
 * disabled affordance to look at, so a hook that silently absorbed Enter would
 * be telling them the edit was taken.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { editableOrder, nextEditableId, useOutlineKeyboard } from '../useOutlineKeyboard'
import type { OutlineKeyboardHandlers } from '../useOutlineKeyboard'
import type { ModelRow } from '../types'

function row(id: string, editable = true): ModelRow {
  return {
    id,
    kind: 'factor',
    group: 'factors',
    label: `Label ${id}`,
    primaryValue: '1',
    attention: [],
    editable,
  }
}

/** A minimal host so the hook can be driven through real key events. */
function Host({
  rows,
  focusedId,
  handlers,
}: {
  rows: readonly ModelRow[]
  focusedId: string | null
  handlers?: OutlineKeyboardHandlers
}) {
  const { onKeyDown } = useOutlineKeyboard({ rows, focusedId, handlers })
  return <div data-testid="host" tabIndex={0} onKeyDown={onKeyDown} />
}

describe('editableOrder — non-editable rows are skipped, in order', () => {
  it('returns only editable ids, preserving the given order', () => {
    const rows = [row('f3'), row('a1', false), row('f1'), row('a2', false), row('f2')]
    expect(editableOrder(rows)).toEqual(['f3', 'f1', 'f2'])
  })

  it('returns nothing when no row is editable', () => {
    expect(editableOrder([row('a1', false), row('a2', false)])).toEqual([])
  })
})

describe('nextEditableId — movement, and the deliberate refusal to wrap', () => {
  const rows = [row('f1'), row('a1', false), row('f2'), row('f3')]

  it('moves forward past a non-editable row', () => {
    expect(nextEditableId(rows, 'f1', 'forward')).toBe('f2')
  })

  it('moves backward past a non-editable row', () => {
    expect(nextEditableId(rows, 'f2', 'backward')).toBe('f1')
  })

  it('returns null at the END rather than wrapping to the top', () => {
    // Wrapping would silently return the user to the top of a queue they
    // believe they have finished, with nothing to distinguish lap two from lap
    // one. `null` lets the caller hand focus back to the browser.
    expect(nextEditableId(rows, 'f3', 'forward')).toBeNull()
  })

  it('returns null at the START rather than wrapping to the bottom', () => {
    expect(nextEditableId(rows, 'f1', 'backward')).toBeNull()
  })

  it('enters at the first editable row when nothing is focused', () => {
    expect(nextEditableId(rows, null, 'forward')).toBe('f1')
  })

  it('enters at the last editable row when tabbing backward from outside', () => {
    expect(nextEditableId(rows, null, 'backward')).toBe('f3')
  })

  it('treats an unknown id as entering from outside, not as an error', () => {
    expect(nextEditableId(rows, 'not-in-this-outline', 'forward')).toBe('f1')
  })

  it('returns null when there is nothing editable to move to', () => {
    expect(nextEditableId([row('a1', false)], null, 'forward')).toBeNull()
  })
})

describe('useOutlineKeyboard — keys reach the handlers the host supplied', () => {
  const rows = [row('f1'), row('a1', false), row('f2')]

  it('Tab moves to the next editable row BY ID', () => {
    const onMoveTo = vi.fn()
    render(<Host rows={rows} focusedId="f1" handlers={{ onMoveTo }} />)
    fireEvent.keyDown(screen.getByTestId('host'), { key: 'Tab' })
    expect(onMoveTo).toHaveBeenCalledWith('f2')
  })

  it('Shift+Tab moves backward', () => {
    const onMoveTo = vi.fn()
    render(<Host rows={rows} focusedId="f2" handlers={{ onMoveTo }} />)
    fireEvent.keyDown(screen.getByTestId('host'), { key: 'Tab', shiftKey: true })
    expect(onMoveTo).toHaveBeenCalledWith('f1')
  })

  it('Enter states an intent for the FOCUSED row', () => {
    const onStateIntent = vi.fn()
    render(<Host rows={rows} focusedId="f2" handlers={{ onStateIntent }} />)
    fireEvent.keyDown(screen.getByTestId('host'), { key: 'Enter' })
    expect(onStateIntent).toHaveBeenCalledWith('f2')
  })

  it('⌘/Ctrl+Enter confirms a proposal and does NOT also state a new intent', () => {
    const onConfirmProposal = vi.fn()
    const onStateIntent = vi.fn()
    render(
      <Host rows={rows} focusedId="f1" handlers={{ onConfirmProposal, onStateIntent }} />,
    )
    fireEvent.keyDown(screen.getByTestId('host'), { key: 'Enter', metaKey: true })
    expect(onConfirmProposal).toHaveBeenCalledWith('f1')
    // The two must not both fire: confirming a standing proposal and opening a
    // fresh edit on the same value are different acts.
    expect(onStateIntent).not.toHaveBeenCalled()
  })

  it('Escape cancels on the focused row', () => {
    const onCancel = vi.fn()
    render(<Host rows={rows} focusedId="f1" handlers={{ onCancel }} />)
    fireEvent.keyDown(screen.getByTestId('host'), { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledWith('f1')
  })

  it('does nothing when no row is focused', () => {
    const onStateIntent = vi.fn()
    render(<Host rows={rows} focusedId={null} handlers={{ onStateIntent }} />)
    fireEvent.keyDown(screen.getByTestId('host'), { key: 'Enter' })
    expect(onStateIntent).not.toHaveBeenCalled()
  })
})

describe('⭐ useOutlineKeyboard — with NO write authority, mutating keys do nothing', () => {
  const rows = [row('f1'), row('f2')]

  it('Enter does not consume the event when no handler exists', () => {
    render(<Host rows={rows} focusedId="f1" />)
    // `fireEvent` returns false when the event was cancelled. Not cancelling is
    // the observable difference between "nothing is wired" and "the hook
    // swallowed your keystroke" — and the user can only perceive the latter as
    // the edit having been accepted.
    const notCancelled = fireEvent.keyDown(screen.getByTestId('host'), { key: 'Enter' })
    expect(notCancelled).toBe(true)
  })

  it('⌘+Enter does not consume the event when no handler exists', () => {
    render(<Host rows={rows} focusedId="f1" />)
    expect(
      fireEvent.keyDown(screen.getByTestId('host'), { key: 'Enter', metaKey: true }),
    ).toBe(true)
  })

  it('Escape does not consume the event when no handler exists', () => {
    render(<Host rows={rows} focusedId="f1" />)
    expect(fireEvent.keyDown(screen.getByTestId('host'), { key: 'Escape' })).toBe(true)
  })

  it('POSITIVE CONTROL: the same keys ARE consumed once handlers are supplied', () => {
    // Proves the three assertions above measure the missing handler, and not a
    // hook that never cancels anything.
    render(
      <Host
        rows={rows}
        focusedId="f1"
        handlers={{ onStateIntent: vi.fn(), onCancel: vi.fn() }}
      />,
    )
    expect(fireEvent.keyDown(screen.getByTestId('host'), { key: 'Enter' })).toBe(false)
    expect(fireEvent.keyDown(screen.getByTestId('host'), { key: 'Escape' })).toBe(false)
  })

  it('navigation still works with no write authority — moving is not mutating', () => {
    const onMoveTo = vi.fn()
    render(<Host rows={rows} focusedId="f1" handlers={{ onMoveTo }} />)
    fireEvent.keyDown(screen.getByTestId('host'), { key: 'Tab' })
    expect(onMoveTo).toHaveBeenCalledWith('f2')
  })
})
