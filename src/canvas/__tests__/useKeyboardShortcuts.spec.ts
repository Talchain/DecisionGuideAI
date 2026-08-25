import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
  useKeyboardShortcuts,
  isKeyboardActivationElement,
  isTextEntryElement,
  resolveEffectiveInteractionMode,
  shouldReleaseTextFocusOnCanvasPointerDown,
} from '../useKeyboardShortcuts'
import { useCanvasStore } from '../store'

describe('useKeyboardShortcuts — interaction mode', () => {
  let onModeChange: ReturnType<typeof vi.fn>
  let onSpaceHeld: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onModeChange = vi.fn()
    onSpaceHeld = vi.fn()
  })

  describe('V / H mode shortcuts', () => {
    it('V key sets select mode', () => {
      renderHook(() => useKeyboardShortcuts({ onModeChange }))

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'v' }))
      expect(onModeChange).toHaveBeenCalledWith('select')
    })

    it('H key sets hand mode', () => {
      renderHook(() => useKeyboardShortcuts({ onModeChange }))

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'h' }))
      expect(onModeChange).toHaveBeenCalledWith('hand')
    })

    it('Ctrl+V does not trigger mode change (paste)', () => {
      renderHook(() => useKeyboardShortcuts({ onModeChange }))

      // jsdom reports non-Mac platform, so cmdOrCtrl = ctrlKey
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', ctrlKey: true }))
      expect(onModeChange).not.toHaveBeenCalled()
    })

    it('ignores V/H when typing in an input', () => {
      renderHook(() => useKeyboardShortcuts({ onModeChange }))

      const input = document.createElement('input')
      document.body.appendChild(input)
      input.focus()

      const event = new KeyboardEvent('keydown', { key: 'v', bubbles: true })
      Object.defineProperty(event, 'target', { value: input })
      window.dispatchEvent(event)

      expect(onModeChange).not.toHaveBeenCalled()
      document.body.removeChild(input)
    })
  })

  describe('Spacebar hold-to-pan', () => {
    it('spacebar keydown sets spaceHeld true', () => {
      renderHook(() => useKeyboardShortcuts({ onSpaceHeld }))

      window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))
      expect(onSpaceHeld).toHaveBeenCalledWith(true)
    })

    it('spacebar keyup clears spaceHeld', () => {
      renderHook(() => useKeyboardShortcuts({ onSpaceHeld }))

      window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))
      window.dispatchEvent(new KeyboardEvent('keyup', { key: ' ' }))

      expect(onSpaceHeld).toHaveBeenCalledTimes(2)
      expect(onSpaceHeld).toHaveBeenLastCalledWith(false)
    })

    it('repeated spacebar keydown does not re-trigger', () => {
      renderHook(() => useKeyboardShortcuts({ onSpaceHeld }))

      window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', repeat: true }))
      expect(onSpaceHeld).not.toHaveBeenCalled()
    })

    it('window blur clears spaceHeld (prevents stuck state)', () => {
      renderHook(() => useKeyboardShortcuts({ onSpaceHeld }))

      window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))
      expect(onSpaceHeld).toHaveBeenCalledWith(true)

      window.dispatchEvent(new Event('blur'))
      expect(onSpaceHeld).toHaveBeenLastCalledWith(false)
    })

    it('spacebar is ignored when typing in an input', () => {
      renderHook(() => useKeyboardShortcuts({ onSpaceHeld }))

      const input = document.createElement('input')
      document.body.appendChild(input)
      input.focus()

      const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true })
      Object.defineProperty(event, 'target', { value: input })
      window.dispatchEvent(event)

      expect(onSpaceHeld).not.toHaveBeenCalled()
      document.body.removeChild(input)
    })

    it('leaves Space activation to focused native and semantic controls', () => {
      renderHook(() => useKeyboardShortcuts({ onSpaceHeld }))
      const button = document.createElement('button')
      const label = document.createElement('span')
      button.appendChild(label)
      document.body.appendChild(button)

      const event = new KeyboardEvent('keydown', {
        key: ' ',
        code: 'Space',
        bubbles: true,
        cancelable: true,
      })
      label.dispatchEvent(event)

      expect(event.defaultPrevented).toBe(false)
      expect(onSpaceHeld).not.toHaveBeenCalled()
      document.body.removeChild(button)
    })
  })

  // L-01(b): the reported symptom was "the icon says select but the canvas
  // still pans, and Escape is needed". The pan half of that is a spacebar hold
  // that leaked `true`: macOS does not deliver `keyup` for ordinary keys while
  // Command is down, so a hold interrupted by a modifier never released.
  describe('Spacebar hold — stuck-true leak (L-01b)', () => {
    it('releases a held space when a modifier arrives (macOS swallows the keyup)', () => {
      renderHook(() => useKeyboardShortcuts({ onSpaceHeld }))

      window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))
      expect(onSpaceHeld).toHaveBeenLastCalledWith(true)

      // Cmd goes down mid-hold. The space keyup that follows will never be
      // delivered, so the hold must be released here or it leaks forever.
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Meta', metaKey: true }))
      expect(onSpaceHeld).toHaveBeenLastCalledWith(false)
    })

    it('releases a held space when the modifier itself is released', () => {
      renderHook(() => useKeyboardShortcuts({ onSpaceHeld }))

      window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))
      expect(onSpaceHeld).toHaveBeenLastCalledWith(true)

      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Control' }))
      expect(onSpaceHeld).toHaveBeenLastCalledWith(false)
    })

    it('refuses to start a hold that begins with a modifier already down', () => {
      renderHook(() => useKeyboardShortcuts({ onSpaceHeld }))

      window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', metaKey: true }))
      expect(onSpaceHeld).not.toHaveBeenCalledWith(true)
    })

    it('releases a held space when the document is hidden (tab switch)', () => {
      renderHook(() => useKeyboardShortcuts({ onSpaceHeld }))

      window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))
      expect(onSpaceHeld).toHaveBeenLastCalledWith(true)

      const original = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState')
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
      expect(onSpaceHeld).toHaveBeenLastCalledWith(false)
      if (original) Object.defineProperty(document, 'visibilityState', original)
    })

    it('recognises Space by event.code when key is unavailable', () => {
      renderHook(() => useKeyboardShortcuts({ onSpaceHeld }))

      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }))
      expect(onSpaceHeld).toHaveBeenLastCalledWith(true)
    })

    it('emits only real transitions — repeated releases do not re-fire', () => {
      renderHook(() => useKeyboardShortcuts({ onSpaceHeld }))

      window.dispatchEvent(new Event('blur'))
      window.dispatchEvent(new Event('blur'))
      expect(onSpaceHeld).not.toHaveBeenCalled()

      window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))
      window.dispatchEvent(new KeyboardEvent('keyup', { key: ' ' }))
      window.dispatchEvent(new Event('blur'))
      expect(onSpaceHeld).toHaveBeenCalledTimes(2)
    })
  })

  describe('Cleanup', () => {
    it('removes all event listeners on unmount', () => {
      const { unmount } = renderHook(() =>
        useKeyboardShortcuts({ onModeChange, onSpaceHeld }),
      )

      unmount()

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'v' }))
      window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))
      window.dispatchEvent(new KeyboardEvent('keyup', { key: ' ' }))
      window.dispatchEvent(new Event('blur'))

      expect(onModeChange).not.toHaveBeenCalled()
      expect(onSpaceHeld).not.toHaveBeenCalled()
    })
  })
})

describe('useKeyboardShortcuts — shared-model mutation authority', () => {
  beforeEach(() => {
    useCanvasStore.getState().resetCanvas()
  })

  it.each([
    ['duplicateSelected', { key: 'd', ctrlKey: true }],
    ['cutSelected', { key: 'x', ctrlKey: true }],
    ['pasteClipboard', { key: 'v', ctrlKey: true }],
    ['undo', { key: 'z', ctrlKey: true }],
    ['redo', { key: 'y', ctrlKey: true }],
    ['redo', { key: 'z', ctrlKey: true, shiftKey: true }],
  ] as const)('does not execute %s without a receipt-bearing carrier', (method, init) => {
    const spy = vi.spyOn(useCanvasStore.getState(), method)
    renderHook(() => useKeyboardShortcuts())

    window.dispatchEvent(new KeyboardEvent('keydown', init))

    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('resolveEffectiveInteractionMode (L-01a)', () => {
  it('returns the persisted mode when no hold is active', () => {
    expect(resolveEffectiveInteractionMode('select', false)).toBe('select')
    expect(resolveEffectiveInteractionMode('hand', false)).toBe('hand')
  })

  it('overrides to hand while the spacebar hold is active', () => {
    expect(resolveEffectiveInteractionMode('select', true)).toBe('hand')
    expect(resolveEffectiveInteractionMode('hand', true)).toBe('hand')
  })
})

describe('isTextEntryElement', () => {
  it('recognises the three text-entry surfaces', () => {
    expect(isTextEntryElement(document.createElement('input'))).toBe(true)
    expect(isTextEntryElement(document.createElement('textarea'))).toBe(true)
    const ce = document.createElement('div')
    Object.defineProperty(ce, 'isContentEditable', { value: true })
    expect(isTextEntryElement(ce)).toBe(true)
  })

  it('is false for ordinary elements and for nothing', () => {
    expect(isTextEntryElement(document.createElement('button'))).toBe(false)
    expect(isTextEntryElement(document.createElement('div'))).toBe(false)
    expect(isTextEntryElement(null)).toBe(false)
    expect(isTextEntryElement(undefined)).toBe(false)
  })
})

describe('isKeyboardActivationElement', () => {
  it('recognises native activation controls and their descendants', () => {
    const button = document.createElement('button')
    const child = document.createElement('span')
    button.appendChild(child)
    expect(isKeyboardActivationElement(button)).toBe(true)
    expect(isKeyboardActivationElement(child)).toBe(true)

    const link = document.createElement('a')
    link.href = '/analysis'
    expect(isKeyboardActivationElement(link)).toBe(true)
  })

  it('recognises semantic controls without classifying ordinary canvas content', () => {
    const semanticButton = document.createElement('div')
    semanticButton.setAttribute('role', 'button')
    expect(isKeyboardActivationElement(semanticButton)).toBe(true)
    expect(isKeyboardActivationElement(document.createElement('div'))).toBe(false)
    expect(isKeyboardActivationElement(null)).toBe(false)
  })
})

describe('shouldReleaseTextFocusOnCanvasPointerDown (L-01c)', () => {
  const textarea = () => document.createElement('textarea')
  const pane = () => document.createElement('div')

  it('releases composer focus when the user engages the canvas pane', () => {
    expect(shouldReleaseTextFocusOnCanvasPointerDown(pane(), textarea())).toBe(true)
  })

  it('does NOT release when the pointer lands in a text surface (node label editor)', () => {
    expect(shouldReleaseTextFocusOnCanvasPointerDown(textarea(), textarea())).toBe(false)
    expect(shouldReleaseTextFocusOnCanvasPointerDown(document.createElement('input'), textarea())).toBe(false)
  })

  it('does nothing when no text surface holds focus', () => {
    expect(shouldReleaseTextFocusOnCanvasPointerDown(pane(), pane())).toBe(false)
    expect(shouldReleaseTextFocusOnCanvasPointerDown(pane(), null)).toBe(false)
  })
})
