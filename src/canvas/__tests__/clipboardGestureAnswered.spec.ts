/**
 * The clipboard MUTATION gestures must be answered, never swallowed.
 *
 * `canvasSemanticMutations` is `'disabled'`, so ⌘X and ⌘V are permanently inert
 * on the canvas (`useKeyboardShortcuts.ts`, the `canMutateSharedModel &&`
 * conjunct on each branch) — while ⌘C is NOT gated and really does fill
 * `state.clipboard`. Measured at staging `189d4352`: the copy appears to work,
 * the paste does nothing and says nothing.
 *
 * ⚠ THE TWO KEYS THIS GUARD MUST NOT TOUCH, both measured before it was
 * written, because answering either would be a FALSE notice:
 *
 *   · ⌘C is NOT inert. `if (cmdOrCtrl && event.key === 'c')` carries no
 *     authority conjunct and calls `state.copySelected()`. It does what it
 *     says; a "not available" notice on it would be a lie.
 *   · ⌘D is NOT inert EITHER, and this is the sharp one. `useKeyboardShortcuts`
 *     has a gated-off `duplicateSelected` on ⌘D, but `useCanvasKeyboardShortcuts.ts:201`
 *     ALSO binds ⌘D — ungated — to `onToggleDocuments`, wired live in
 *     `ReactFlowGraph.tsx:1587` (`onToggleDocuments: showDocuments`). Pressing
 *     ⌘D opens the Documents drawer. Announcing "duplicate is unavailable" over
 *     a keystroke that just opened a drawer is the two-handlers-one-gesture
 *     defect, so ⌘D is deliberately OUT of the predicate.
 *
 * ⚠ EVERY CASE HAS ITS OPPOSITE-DIRECTION TWIN. The two harms cannot share one
 * window: too NARROW leaves the gesture silent (the defect); too WIDE starts
 * answering keys that are not the gesture, or answers them while the user is
 * typing, or keeps answering after the authority is granted.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
  useKeyboardShortcuts,
  isClipboardMutationGesture,
} from '../useKeyboardShortcuts'
import { CANVAS_STRUCTURAL_EDIT_NOTICE } from '../mutations/mutationAuthority'

/**
 * Spread the original module rather than hand-listing its exports: a `vi.mock`
 * factory REPLACES the module, and a hand-maintained allowlist goes stale
 * silently (the estate's dominant defect class).
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

describe('clipboard mutation gestures are answered, not swallowed', () => {
  let toasts: ReturnType<typeof captureToasts>

  beforeEach(() => {
    authorityValue.current = 'disabled'
    toasts = captureToasts()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-07T12:00:00Z'))
  })

  afterEach(() => {
    toasts.dispose()
    vi.useRealTimers()
  })

  // ── direction 1: the gesture must be ANSWERED ────────────────────────────

  it('⌘V (paste) emits the notice, bound to the exported copy by identity', () => {
    renderHook(() => useKeyboardShortcuts())
    press('v', { ctrlKey: true })
    expect(toasts.messages).toEqual([CANVAS_STRUCTURAL_EDIT_NOTICE])
  })

  it('⌘X (cut) emits the notice too', () => {
    renderHook(() => useKeyboardShortcuts())
    press('x', { ctrlKey: true })
    expect(toasts.messages).toEqual([CANVAS_STRUCTURAL_EDIT_NOTICE])
  })

  it('uppercase ⌘V is answered (caps-lock layouts)', () => {
    renderHook(() => useKeyboardShortcuts())
    press('V', { ctrlKey: true })
    expect(toasts.messages).toEqual([CANVAS_STRUCTURAL_EDIT_NOTICE])
  })

  it('the notice names Olumi — the writer that actually exists — and NOT the Model tab', () => {
    // Derived, not assumed: `ModelTabV2Panel.tsx:235` builds `editConnectedIds`
    // from `nodeKind(node) === 'factor'` only, and a sweep of `model-tab-v2/`
    // for structural add/delete controls returns ZERO against a firing contrast
    // control (`editConnectedIds`, 16 hits). The Model tab edits factor VALUES;
    // it cannot add, remove or rewire an element. Naming it here would be a
    // plausible-but-wrong destination, which is worse than no reason at all.
    expect(CANVAS_STRUCTURAL_EDIT_NOTICE).toContain('Olumi')
    expect(CANVAS_STRUCTURAL_EDIT_NOTICE).not.toContain('Model tab')
  })

  // ── direction 2: the OPPOSITE-DIRECTION TWINS ────────────────────────────

  it('TWIN: ⌘C must stay silent — copy is NOT gated and really does copy', () => {
    renderHook(() => useKeyboardShortcuts())
    press('c', { ctrlKey: true })
    expect(toasts.messages).toEqual([])
  })

  it('TWIN: ⌘D must stay silent — it opens the Documents drawer, ungated', () => {
    // The case that fails if someone "completes the set" by adding ⌘D. See the
    // header: `useCanvasKeyboardShortcuts.ts:201` owns this key.
    renderHook(() => useKeyboardShortcuts())
    press('d', { ctrlKey: true })
    expect(toasts.messages).toEqual([])
  })

  it('TWIN: a bare v is NOT the gesture (it selects the Select tool) and stays silent', () => {
    renderHook(() => useKeyboardShortcuts())
    press('v')
    expect(toasts.messages).toEqual([])
  })

  it('TWIN: a bare x stays silent', () => {
    renderHook(() => useKeyboardShortcuts())
    press('x')
    expect(toasts.messages).toEqual([])
  })

  it('TWIN: Alt+V (validation cycling) must stay silent', () => {
    renderHook(() => useKeyboardShortcuts())
    press('v', { altKey: true })
    expect(toasts.messages).toEqual([])
  })

  it('TWIN: ⌘V while typing in a textarea must stay silent', () => {
    renderHook(() => useKeyboardShortcuts())
    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    press('v', { ctrlKey: true }, textarea)
    expect(toasts.messages).toEqual([])
    document.body.removeChild(textarea)
  })

  it('TWIN: ⌘X while typing in an input must stay silent', () => {
    renderHook(() => useKeyboardShortcuts())
    const input = document.createElement('input')
    document.body.appendChild(input)
    press('x', { ctrlKey: true }, input)
    expect(toasts.messages).toEqual([])
    document.body.removeChild(input)
  })

  it('TWIN: when the authority IS granted, the notice must NOT fire', () => {
    // The guard retires itself rather than needing a second edit. This is the
    // case that fails if someone "simplifies" the gate away.
    authorityValue.current = 'server_graph'
    renderHook(() => useKeyboardShortcuts())
    press('v', { ctrlKey: true })
    expect(toasts.messages).toEqual([])
  })

  it('TWIN: a held ⌘V (event.repeat) does not stack notices', () => {
    renderHook(() => useKeyboardShortcuts())
    press('v', { ctrlKey: true })
    press('v', { ctrlKey: true, repeat: true })
    press('v', { ctrlKey: true, repeat: true })
    expect(toasts.messages).toEqual([CANVAS_STRUCTURAL_EDIT_NOTICE])
  })

  it('TWIN: a second press inside the quiet window is suppressed, a later one is not', () => {
    renderHook(() => useKeyboardShortcuts())
    press('v', { ctrlKey: true })
    vi.setSystemTime(new Date('2026-09-07T12:00:01Z')) // 1s — inside
    press('x', { ctrlKey: true })
    expect(toasts.messages).toEqual([CANVAS_STRUCTURAL_EDIT_NOTICE])

    vi.setSystemTime(new Date('2026-09-07T12:00:10Z')) // 10s — outside
    press('v', { ctrlKey: true })
    expect(toasts.messages).toEqual([
      CANVAS_STRUCTURAL_EDIT_NOTICE,
      CANVAS_STRUCTURAL_EDIT_NOTICE,
    ])
  })

  it('TWIN: the undo gesture keeps its OWN notice — this guard must not capture ⌘Z', () => {
    // ⌘Z is answered by `isUndoRedoGesture` with the Version-history sentence
    // (#954). If this predicate widened to swallow it, the recovery gesture
    // would start pointing at Olumi instead of at Version history.
    renderHook(() => useKeyboardShortcuts())
    press('z', { ctrlKey: true })
    expect(toasts.messages).not.toContain(CANVAS_STRUCTURAL_EDIT_NOTICE)
    expect(toasts.messages).toHaveLength(1)
  })
})

describe('isClipboardMutationGesture — the predicate, both directions', () => {
  it('matches the modified cut/paste keys', () => {
    expect(isClipboardMutationGesture('x', true, false)).toBe(true)
    expect(isClipboardMutationGesture('X', true, false)).toBe(true)
    expect(isClipboardMutationGesture('v', true, false)).toBe(true)
    expect(isClipboardMutationGesture('V', true, false)).toBe(true)
  })

  it('TWIN: refuses the same keys UNMODIFIED', () => {
    expect(isClipboardMutationGesture('x', false, false)).toBe(false)
    expect(isClipboardMutationGesture('v', false, false)).toBe(false)
  })

  it('TWIN: refuses ⌘C and ⌘D — both are live gestures, not inert ones', () => {
    expect(isClipboardMutationGesture('c', true, false)).toBe(false)
    expect(isClipboardMutationGesture('d', true, false)).toBe(false)
  })

  it('TWIN: refuses the alt-modified form (Alt+V cycles validation errors)', () => {
    expect(isClipboardMutationGesture('v', true, true)).toBe(false)
  })

  it('TWIN: refuses other modified keys, including the undo family', () => {
    for (const key of ['a', 's', 'z', 'y', 'Delete', 'Backspace', 'ArrowUp']) {
      expect(isClipboardMutationGesture(key, true, false)).toBe(false)
    }
  })
})
