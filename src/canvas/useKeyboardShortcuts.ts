// src/canvas/useKeyboardShortcuts.ts
// Keyboard shortcuts for canvas

import { useEffect, useCallback, useRef } from 'react'
import { useCanvasStore } from './store'

interface KeyboardShortcutOptions {
  /** Callback to set interaction mode (select/hand) for V/H shortcuts */
  onModeChange?: (mode: 'select' | 'hand') => void
}

export function useKeyboardShortcuts(options?: KeyboardShortcutOptions) {
  // Use ref to avoid recreating the handler when options change
  const optionsRef = useRef(options)
  optionsRef.current = options
  // Fix: Use getState() inside handler to avoid dependency array issues.
  // Previously, all 12 action functions were in the dependency array, but
  // Zustand selectors return new function references on every render,
  // causing the effect to re-run and triggering render storms.
  // Using getState() inside the handler ensures we always get fresh state
  // without needing to list actions as dependencies.

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const cmdOrCtrl = isMac ? event.metaKey : event.ctrlKey

      // Ignore if typing in an input
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }

      // Get fresh state for each keydown - avoids stale closure issues
      const state = useCanvasStore.getState()

      // Undo: Cmd/Ctrl + Z
      if (cmdOrCtrl && event.key === 'z' && !event.shiftKey && state.canUndo()) {
        event.preventDefault()
        state.undo()
        return
      }

      // Redo: Cmd/Ctrl + Shift + Z or Cmd/Ctrl + Y
      if ((cmdOrCtrl && event.key === 'z' && event.shiftKey) || (cmdOrCtrl && event.key === 'y')) {
        if (state.canRedo()) {
          event.preventDefault()
          state.redo()
        }
        return
      }

      // Duplicate: Cmd/Ctrl + D
      if (cmdOrCtrl && event.key === 'd') {
        event.preventDefault()
        state.duplicateSelected()
        return
      }

      // Select All: Cmd/Ctrl + A
      if (cmdOrCtrl && event.key === 'a') {
        event.preventDefault()
        state.selectAll()
        return
      }

      // Copy: Cmd/Ctrl + C
      if (cmdOrCtrl && event.key === 'c') {
        event.preventDefault()
        state.copySelected()
        return
      }

      // Cut: Cmd/Ctrl + X
      if (cmdOrCtrl && event.key === 'x') {
        event.preventDefault()
        state.cutSelected()
        return
      }

      // Paste: Cmd/Ctrl + V
      if (cmdOrCtrl && event.key === 'v') {
        event.preventDefault()
        state.pasteClipboard()
        return
      }

      // Save Snapshot: Cmd/Ctrl + S
      if (cmdOrCtrl && event.key === 's') {
        event.preventDefault()
        state.saveSnapshot()
        return
      }

      // Delete: Delete or Backspace
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        state.deleteSelected()
        return
      }

      // V for Select mode (like Figma)
      if ((event.key === 'v' || event.key === 'V') && !cmdOrCtrl) {
        optionsRef.current?.onModeChange?.('select')
        return
      }

      // H for Hand/Pan mode (like Figma)
      if ((event.key === 'h' || event.key === 'H') && !cmdOrCtrl) {
        optionsRef.current?.onModeChange?.('hand')
        return
      }

      // Nudge with arrow keys
      const nudgeAmount = event.shiftKey ? 10 : 1
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        state.nudgeSelected(-nudgeAmount, 0)
        return
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        state.nudgeSelected(nudgeAmount, 0)
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        state.nudgeSelected(0, -nudgeAmount)
        return
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        state.nudgeSelected(0, nudgeAmount)
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, []) // Empty deps - handler always gets fresh state via getState()
}
