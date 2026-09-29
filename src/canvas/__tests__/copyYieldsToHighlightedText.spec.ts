/**
 * ⌘C / Ctrl+C copies HIGHLIGHTED TEXT, not canvas cards.
 *
 * The canvas shortcut handler listens on `window`, so it also received ⌘C when
 * the user had highlighted text in the AI panel. It cancelled the browser's
 * copy and copied the selected cards instead, and the text never reached the
 * clipboard (Paul, 29 Sep 2026: only right-click → Copy worked).
 *
 * Both directions are pinned: highlighted text → the browser copies it; nothing
 * highlighted (or a bare caret) → the canvas copies its cards as before.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useKeyboardShortcuts, hasHighlightedText } from '../useKeyboardShortcuts'
import { useCanvasStore } from '../store'

/** jsdom reports a non-Mac platform, so cmdOrCtrl resolves to ctrlKey. */
function pressCopy(): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true, cancelable: true })
  window.dispatchEvent(event)
  return event
}

function panelMessage(text: string): HTMLElement {
  const p = document.createElement('p')
  p.setAttribute('data-testid', 'ai-panel-message')
  p.textContent = text
  document.body.appendChild(p)
  return p
}

function highlight(el: HTMLElement, start: number, end: number) {
  const range = document.createRange()
  range.setStart(el.firstChild as Text, start)
  range.setEnd(el.firstChild as Text, end)
  const selection = window.getSelection()!
  selection.removeAllRanges()
  selection.addRange(range)
}

describe('Ctrl/Cmd+C copies highlighted text, not canvas cards', () => {
  let copySelected: ReturnType<typeof vi.fn>
  const original = useCanvasStore.getState().copySelected

  beforeEach(() => {
    copySelected = vi.fn()
    useCanvasStore.setState({ copySelected } as never)
    window.getSelection()?.removeAllRanges()
  })

  afterEach(() => {
    window.getSelection()?.removeAllRanges()
    document.body.innerHTML = ''
    useCanvasStore.setState({ copySelected: original } as never)
  })

  it('text highlighted in the AI panel → the browser copies it: no preventDefault, no card copy', () => {
    renderHook(() => useKeyboardShortcuts())
    highlight(panelMessage('Raising the price to £59 keeps MRR above target.'), 0, 20)
    expect(hasHighlightedText()).toBe(true)
    const event = pressCopy()
    expect(event.defaultPrevented).toBe(false)
    expect(copySelected).not.toHaveBeenCalled()
  })

  it('nothing highlighted → the canvas copies its selected cards, as before', () => {
    renderHook(() => useKeyboardShortcuts())
    panelMessage('Raising the price to £59 keeps MRR above target.')
    expect(hasHighlightedText()).toBe(false)
    const event = pressCopy()
    expect(event.defaultPrevented).toBe(true)
    expect(copySelected).toHaveBeenCalledTimes(1)
  })

  it('a bare caret (collapsed selection) is not highlighted text → the canvas copies', () => {
    renderHook(() => useKeyboardShortcuts())
    highlight(panelMessage('Raising the price'), 4, 4)
    expect(hasHighlightedText()).toBe(false)
    const event = pressCopy()
    expect(event.defaultPrevented).toBe(true)
    expect(copySelected).toHaveBeenCalledTimes(1)
  })
})
