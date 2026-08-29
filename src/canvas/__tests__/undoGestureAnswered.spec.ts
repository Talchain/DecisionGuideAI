/**
 * The undo GESTURE must be answered, never swallowed.
 *
 * `canvasSemanticMutations` is `'disabled'`, so ⌘Z/⌘⇧Z/⌘Y are permanently
 * inert on the canvas while Delete/Backspace is not. Measured on the deployed
 * build `daf6537a`: pressing ⌘Z with `store.canUndo() === true` changed no
 * state and produced no message at all.
 *
 * ⚠ EVERY CASE HERE HAS ITS OPPOSITE-DIRECTION TWIN, deliberately. The two
 * harms this guard sits between cannot share one window:
 *   · too NARROW — the gesture stays silent (the defect being fixed);
 *   · too WIDE  — the canvas starts answering keys that are not the gesture,
 *     or answers them while the user is typing, or keeps announcing
 *     "unavailable" after undo becomes available.
 * A corpus pointing only in the first direction would go green on a fix that
 * opened the second, which is how this estate has previously traded one
 * silent failure for another.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
  useKeyboardShortcuts,
  isUndoRedoGesture,
  CANVAS_UNDO_LOCAL_ONLY_NOTICE,
} from '../useKeyboardShortcuts'

/**
 * Spread the original module rather than hand-listing its exports: a
 * `vi.mock` factory REPLACES the module, and a hand-maintained allowlist of
 * exports goes stale silently (the estate's dominant defect class).
 */
const authorityValue = { current: 'disabled' as string }
vi.mock('../mutations/mutationAuthority', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../mutations/mutationAuthority')>()
  return {
    ...actual,
    get CANONICAL_EDIT_AUTHORITY() {
      return { ...actual.CANONICAL_EDIT_AUTHORITY, canvasSemanticMutations: authorityValue.current }
    },
  }
})

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
  const event = new KeyboardEvent('keydown', { key, bubbles: true, ...init })
  if (target) Object.defineProperty(event, 'target', { value: target })
  window.dispatchEvent(event)
}

describe('undo gesture is answered, not swallowed', () => {
  let toasts: ReturnType<typeof captureToasts>

  beforeEach(() => {
    authorityValue.current = 'disabled'
    toasts = captureToasts()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-29T12:00:00Z'))
  })

  afterEach(() => {
    toasts.dispose()
    vi.useRealTimers()
  })

  // ── direction 1: the gesture must be ANSWERED ────────────────────────────

  it('⌘Z emits the notice, bound to the exported copy by identity', () => {
    renderHook(() => useKeyboardShortcuts())
    press('z', { ctrlKey: true })
    // Identity, not a substring predicate another message could satisfy.
    expect(toasts.messages).toEqual([CANVAS_UNDO_LOCAL_ONLY_NOTICE])
  })

  it('the notice names Version history — the recovery that actually exists', () => {
    // Pins the ROUTE, so a future edit cannot quietly reduce this to a bare
    // "not available" dead end. `ServerVersionsSection` renders under this name.
    //
    // ⚠ THE CASES IN THIS FILE ALL RUN AS THE DEFAULT READER — guest, no
    // scenario id — which is why they expect the LOCAL-ONLY notice. Which
    // sentence each reader class gets is pinned in
    // `undoNoticeReaderClass.spec.ts`; this file pins that the gesture is
    // ANSWERED at all, and stays deliberately about that one question.
    expect(CANVAS_UNDO_LOCAL_ONLY_NOTICE).toContain('Version history')
  })

  it('⌘⇧Z (redo) is answered too', () => {
    renderHook(() => useKeyboardShortcuts())
    press('z', { ctrlKey: true, shiftKey: true })
    expect(toasts.messages).toEqual([CANVAS_UNDO_LOCAL_ONLY_NOTICE])
  })

  it('⌘Y (redo, Windows idiom) is answered too', () => {
    renderHook(() => useKeyboardShortcuts())
    press('y', { ctrlKey: true })
    expect(toasts.messages).toEqual([CANVAS_UNDO_LOCAL_ONLY_NOTICE])
  })

  it('uppercase Z (⌘⇧Z on some layouts) is answered', () => {
    renderHook(() => useKeyboardShortcuts())
    press('Z', { ctrlKey: true, shiftKey: true })
    expect(toasts.messages).toEqual([CANVAS_UNDO_LOCAL_ONLY_NOTICE])
  })

  // ── direction 2: the OPPOSITE-DIRECTION TWINS ────────────────────────────

  it('TWIN: a bare z is NOT the gesture and must stay silent', () => {
    renderHook(() => useKeyboardShortcuts())
    press('z')
    expect(toasts.messages).toEqual([])
  })

  it('TWIN: a bare y must stay silent', () => {
    renderHook(() => useKeyboardShortcuts())
    press('y')
    expect(toasts.messages).toEqual([])
  })

  it('TWIN: ⌘Z while typing in a textarea must stay silent', () => {
    renderHook(() => useKeyboardShortcuts())
    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    press('z', { ctrlKey: true }, textarea)
    expect(toasts.messages).toEqual([])
    document.body.removeChild(textarea)
  })

  it('TWIN: ⌘Z while typing in an input must stay silent', () => {
    renderHook(() => useKeyboardShortcuts())
    const input = document.createElement('input')
    document.body.appendChild(input)
    press('z', { ctrlKey: true }, input)
    expect(toasts.messages).toEqual([])
    document.body.removeChild(input)
  })

  it('TWIN: an unrelated modified key (⌘S) must not emit the notice', () => {
    renderHook(() => useKeyboardShortcuts())
    press('s', { ctrlKey: true })
    expect(toasts.messages).toEqual([])
  })

  it('TWIN: Delete must not emit the undo notice', () => {
    renderHook(() => useKeyboardShortcuts())
    press('Delete')
    expect(toasts.messages).toEqual([])
  })

  it('TWIN: when the authority IS granted, the notice must NOT fire', () => {
    // The guard must retire itself rather than needing a second edit. This is
    // the case that fails if someone "simplifies" the gate away.
    authorityValue.current = 'server_graph'
    renderHook(() => useKeyboardShortcuts())
    press('z', { ctrlKey: true })
    expect(toasts.messages).toEqual([])
  })

  it('TWIN: a held ⌘Z (event.repeat) does not stack notices', () => {
    renderHook(() => useKeyboardShortcuts())
    press('z', { ctrlKey: true })
    press('z', { ctrlKey: true, repeat: true })
    press('z', { ctrlKey: true, repeat: true })
    expect(toasts.messages).toEqual([CANVAS_UNDO_LOCAL_ONLY_NOTICE])
  })

  it('TWIN: a second press inside the quiet window is suppressed, and a later one is not', () => {
    renderHook(() => useKeyboardShortcuts())
    press('z', { ctrlKey: true })
    vi.setSystemTime(new Date('2026-08-29T12:00:01Z')) // 1s — inside the window
    press('z', { ctrlKey: true })
    expect(toasts.messages).toEqual([CANVAS_UNDO_LOCAL_ONLY_NOTICE])

    vi.setSystemTime(new Date('2026-08-29T12:00:10Z')) // 10s — outside it
    press('z', { ctrlKey: true })
    expect(toasts.messages).toEqual([
      CANVAS_UNDO_LOCAL_ONLY_NOTICE,
      CANVAS_UNDO_LOCAL_ONLY_NOTICE,
    ])
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
