/**
 * With canvas Undo/Redo CONNECTED (its own key), ⌘Z / ⌘⇧Z / ⌘Y run the
 * saved-change command — and never the store's screen-only history.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

vi.mock('../../mutations/mutationAuthority', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../mutations/mutationAuthority')>()
  return {
    ...actual,
    CANONICAL_EDIT_AUTHORITY: { ...actual.CANONICAL_EDIT_AUTHORITY, canvasUndoRedo: 'server_graph' },
  }
})
const runCanvasUndo = vi.fn(async () => 'done')
vi.mock('../undoCommand', () => ({ runCanvasUndo: (...a: unknown[]) => runCanvasUndo(...(a as [])) }))

import { useKeyboardShortcuts } from '../../useKeyboardShortcuts'
import { useCanvasStore } from '../../store'

beforeEach(() => {
  runCanvasUndo.mockClear()
  useCanvasStore.getState().resetCanvas()
})

describe('undo gestures route to the saved-change command', () => {
  it.each([
    ['undo', { key: 'z', ctrlKey: true }],
    ['redo', { key: 'z', ctrlKey: true, shiftKey: true }],
    ['redo', { key: 'y', ctrlKey: true }],
  ] as const)('%s ← %o', (direction, init) => {
    const local = vi.spyOn(useCanvasStore.getState(), direction)
    renderHook(() => useKeyboardShortcuts())
    window.dispatchEvent(new KeyboardEvent('keydown', init))
    expect(runCanvasUndo).toHaveBeenCalledWith(direction)
    expect(local).not.toHaveBeenCalled()
    local.mockRestore()
  })

  it('a held key (auto-repeat) does not fire a second restore', () => {
    renderHook(() => useKeyboardShortcuts())
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, repeat: true }))
    expect(runCanvasUndo).not.toHaveBeenCalled()
  })

  it('typing in a text field keeps the field’s own undo', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    renderHook(() => useKeyboardShortcuts())
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }))
    expect(runCanvasUndo).not.toHaveBeenCalled()
    input.remove()
  })
})
