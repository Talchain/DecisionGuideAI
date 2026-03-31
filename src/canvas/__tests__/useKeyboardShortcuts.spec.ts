import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useKeyboardShortcuts } from '../useKeyboardShortcuts'

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
