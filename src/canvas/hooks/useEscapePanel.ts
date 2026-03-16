/**
 * useEscapePanel — Global Escape key handler for right-panel dismissal
 *
 * Task C: Pressing Escape closes the active right panel (Provenance, AI Clarifier,
 * or collapses OutputsDock). Panels have priority: overlay panels (provenance/clarifier)
 * close first; OutputsDock collapses only when no overlay is active.
 */
import { useEffect } from 'react'
import { useCanvasStore } from '../store'
import { useUIStore } from '../../stores/uiStore'

export function useEscapePanel() {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      // Don't capture Escape when focus is in an input/textarea/contenteditable
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) {
        return
      }

      const activePanel = useUIStore.getState().activeRightPanel

      if (activePanel === 'provenance') {
        e.stopPropagation()
        useCanvasStore.getState().setShowProvenanceHub(false)
      } else if (activePanel === 'clarifier') {
        e.stopPropagation()
        useCanvasStore.getState().setShowAIClarifier(false)
      }
      // OutputsDock handles its own collapse via its internal state
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [])
}
