/**
 * The undo GESTURE must be answered, never swallowed — and since Undo S5 it is answered by the SAVED-CHANGE command.
 *
 * Before S4 the canvas had no undo, and ⌘Z/⌘⇧Z/⌘Y were answered with a notice naming Version history. S5 (DL #75
 * 5912949238) removed the temporary `canvasUndoRedo` key: every gesture now runs `runCanvasUndo`, which answers guests,
 * in-flight edits, "nothing to undo" and a stale head itself (`undo/__tests__/undoCommand.spec.ts`).
 *
 * ⚠ EVERY CASE HERE HAS ITS OPPOSITE-DIRECTION TWIN, deliberately. The two harms this guard sits between:
 *   · too NARROW — the gesture stays silent or never reaches the command;
 *   · too WIDE  — the canvas answers keys that are not the gesture, or answers them while the user is typing (a
 *     field's own undo must never restore the saved model).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
  useKeyboardShortcuts,
  isUndoRedoGesture,
} from '../useKeyboardShortcuts'
import {
  __resetPersistenceSessionForTests,
} from '../../lib/persistenceSession'
import { useCanvasStore } from '../store'

// The command is mocked: this file pins that the GESTURE reaches it, in the right direction, exactly once.
const runCanvasUndo = vi.fn(async () => 'done')
vi.mock('../undo/undoCommand', () => ({ runCanvasUndo: (...a: unknown[]) => runCanvasUndo(...(a as [])) }))

/** Captures what actually reached the canvas's toast bridge. */
function captureToasts(): { messages: string[]; dispose: () => void } {
  const messages: string[] = []
  const handler = (e: Event) => {
    const detail = (e as CustomEvent).detail
    if (detail?.message) messages.push(detail.message as string)
  }
  window.addEventListener('topbar:show-toast', handler)
  return { messages, dispose: () => window.removeEventListener('topbar:show-toast', handler) }
}

/** jsdom reports a non-Mac platform, so cmdOrCtrl resolves to ctrlKey. */
function press(key: string, init: KeyboardEventInit = {}, target?: Element) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
  if (target) Object.defineProperty(event, 'target', { value: target })
  window.dispatchEvent(event)
  return event
}

describe('undo gesture reaches the saved-change command (Undo S5)', () => {
  let toasts: ReturnType<typeof captureToasts>

  beforeEach(() => {
    runCanvasUndo.mockClear()
    __resetPersistenceSessionForTests()
    useCanvasStore.setState({ currentScenarioId: null })
    toasts = captureToasts()
  })

  afterEach(() => {
    toasts.dispose()
    __resetPersistenceSessionForTests()
  })

  // ── direction 1: the gesture must REACH the command ─────────────────────

  it('⌘Z runs undo, and the browser default is prevented', () => {
    renderHook(() => useKeyboardShortcuts())
    const e = press('z', { ctrlKey: true })
    expect(runCanvasUndo.mock.calls).toEqual([['undo']])
    expect(e.defaultPrevented).toBe(true)
  })

  it('⌘⇧Z runs redo', () => {
    renderHook(() => useKeyboardShortcuts())
    press('z', { ctrlKey: true, shiftKey: true })
    expect(runCanvasUndo.mock.calls).toEqual([['redo']])
  })

  it('⌘Y (redo, Windows idiom) runs redo', () => {
    renderHook(() => useKeyboardShortcuts())
    press('y', { ctrlKey: true })
    expect(runCanvasUndo.mock.calls).toEqual([['redo']])
  })

  it('uppercase Z (⌘⇧Z on some layouts) runs redo', () => {
    renderHook(() => useKeyboardShortcuts())
    press('Z', { ctrlKey: true, shiftKey: true })
    expect(runCanvasUndo.mock.calls).toEqual([['redo']])
  })

  it('the retired "not available" notice never fires from the gesture any more', () => {
    renderHook(() => useKeyboardShortcuts())
    press('z', { ctrlKey: true })
    expect(toasts.messages).toEqual([])
  })

  // ── direction 2: the OPPOSITE-DIRECTION TWINS ────────────────────────────

  it('TWIN: a bare z is NOT the gesture', () => {
    renderHook(() => useKeyboardShortcuts())
    press('z')
    expect(runCanvasUndo).not.toHaveBeenCalled()
  })

  it('TWIN: a bare y is NOT the gesture', () => {
    renderHook(() => useKeyboardShortcuts())
    press('y')
    expect(runCanvasUndo).not.toHaveBeenCalled()
  })

  it('TWIN: ⌘Z while typing in a textarea is the FIELD\'s undo, never a saved restore', () => {
    renderHook(() => useKeyboardShortcuts())
    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    press('z', { ctrlKey: true }, textarea)
    expect(runCanvasUndo).not.toHaveBeenCalled()
    document.body.removeChild(textarea)
  })

  it('TWIN: ⌘Z while typing in an input is the FIELD\'s undo, never a saved restore', () => {
    renderHook(() => useKeyboardShortcuts())
    const input = document.createElement('input')
    document.body.appendChild(input)
    press('z', { ctrlKey: true }, input)
    expect(runCanvasUndo).not.toHaveBeenCalled()
    document.body.removeChild(input)
  })

  it('TWIN: an unrelated modified key (⌘S) does not run undo', () => {
    renderHook(() => useKeyboardShortcuts())
    press('s', { ctrlKey: true })
    expect(runCanvasUndo).not.toHaveBeenCalled()
  })

  it('TWIN: Delete does not run undo', () => {
    renderHook(() => useKeyboardShortcuts())
    press('Delete')
    expect(runCanvasUndo).not.toHaveBeenCalled()
  })

  it('TWIN: a held ⌘Z (event.repeat) restores ONCE, never a burst of restores', () => {
    renderHook(() => useKeyboardShortcuts())
    press('z', { ctrlKey: true })
    press('z', { ctrlKey: true, repeat: true })
    press('z', { ctrlKey: true, repeat: true })
    expect(runCanvasUndo.mock.calls).toEqual([['undo']])
  })
})

describe('isUndoRedoGesture — the predicate, both directions', () => {
  it('matches the modified undo/redo keys', () => {
    expect(isUndoRedoGesture('z', true)).toBe(true)
    expect(isUndoRedoGesture('Z', true)).toBe(true)
    expect(isUndoRedoGesture('y', true)).toBe(true)
    expect(isUndoRedoGesture('Y', true)).toBe(true)
  })

  it('TWIN: refuses the same keys UNMODIFIED', () => {
    expect(isUndoRedoGesture('z', false)).toBe(false)
    expect(isUndoRedoGesture('y', false)).toBe(false)
  })

  it('TWIN: refuses other modified keys', () => {
    for (const key of ['a', 'c', 'v', 'x', 's', 'd', 'Delete', 'Backspace', 'ArrowUp']) {
      expect(isUndoRedoGesture(key, true)).toBe(false)
    }
  })
})
