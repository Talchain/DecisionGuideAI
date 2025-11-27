// src/canvas/useKeyboardShortcuts.ts
// Keyboard shortcuts for canvas

import { useEffect } from 'react'
import { useCanvasStore } from './store'

export function useKeyboardShortcuts() {
  // React #185 FIX: Use individual selectors instead of destructuring from useCanvasStore()
  // Calling useCanvasStore() without a selector subscribes to the ENTIRE store,
  // causing re-renders on ANY state change. Actions are stable references, so
  // using selectors avoids the entire-store subscription that causes loops.
  const undo = useCanvasStore(s => s.undo)
  const redo = useCanvasStore(s => s.redo)
  const canUndo = useCanvasStore(s => s.canUndo)
  const canRedo = useCanvasStore(s => s.canRedo)
  const deleteSelected = useCanvasStore(s => s.deleteSelected)
  const duplicateSelected = useCanvasStore(s => s.duplicateSelected)
  const copySelected = useCanvasStore(s => s.copySelected)
  const pasteClipboard = useCanvasStore(s => s.pasteClipboard)
  const cutSelected = useCanvasStore(s => s.cutSelected)
  const selectAll = useCanvasStore(s => s.selectAll)
  const nudgeSelected = useCanvasStore(s => s.nudgeSelected)
  const saveSnapshot = useCanvasStore(s => s.saveSnapshot)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const cmdOrCtrl = isMac ? event.metaKey : event.ctrlKey

      // Ignore if typing in an input
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }

      // Undo: Cmd/Ctrl + Z
      if (cmdOrCtrl && event.key === 'z' && !event.shiftKey && canUndo()) {
        event.preventDefault()
        undo()
        return
      }

      // Redo: Cmd/Ctrl + Shift + Z or Cmd/Ctrl + Y
      if ((cmdOrCtrl && event.key === 'z' && event.shiftKey) || (cmdOrCtrl && event.key === 'y')) {
        if (canRedo()) {
          event.preventDefault()
          redo()
        }
        return
      }

      // Duplicate: Cmd/Ctrl + D
      if (cmdOrCtrl && event.key === 'd') {
        event.preventDefault()
        duplicateSelected()
        return
      }

      // Select All: Cmd/Ctrl + A
      if (cmdOrCtrl && event.key === 'a') {
        event.preventDefault()
        selectAll()
        return
      }

      // Copy: Cmd/Ctrl + C
      if (cmdOrCtrl && event.key === 'c') {
        event.preventDefault()
        copySelected()
        return
      }

      // Cut: Cmd/Ctrl + X
      if (cmdOrCtrl && event.key === 'x') {
        event.preventDefault()
        cutSelected()
        return
      }

      // Paste: Cmd/Ctrl + V
      if (cmdOrCtrl && event.key === 'v') {
        event.preventDefault()
        pasteClipboard()
        return
      }

      // Save Snapshot: Cmd/Ctrl + S
      if (cmdOrCtrl && event.key === 's') {
        event.preventDefault()
        saveSnapshot()
        return
      }

      // Delete: Delete or Backspace
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        deleteSelected()
        return
      }

      // Nudge with arrow keys
      const nudgeAmount = event.shiftKey ? 10 : 1
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        nudgeSelected(-nudgeAmount, 0)
        return
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        nudgeSelected(nudgeAmount, 0)
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        nudgeSelected(0, -nudgeAmount)
        return
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        nudgeSelected(0, nudgeAmount)
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo, canUndo, canRedo, deleteSelected, duplicateSelected, copySelected, pasteClipboard, cutSelected, selectAll, nudgeSelected, saveSnapshot])
}
