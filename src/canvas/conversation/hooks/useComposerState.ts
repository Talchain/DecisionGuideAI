/**
 * useComposerState — textarea state, auto-grow, and keyboard handling.
 *
 * Enter sends (when content + not disabled), Shift+Enter inserts newline,
 * Escape collapses the panel. The textarea auto-grows with content up to
 * a configurable max height (default 35% of panel).
 *
 * Persistence: the composer value is mirrored to canvas store
 * `draftComposerText` so it survives panel collapse/reopen. Mounts initialise
 * from the store; subsequent edits write through with a 300 ms debounce; the
 * unmount cleanup flushes immediately so a fast collapse can't lose the last
 * 300 ms of typing. The store field is scoped to the current scenario —
 * `loadScenario` and `importCanvas` clear it so a draft for one decision
 * can't bleed into another.
 */

import { useRef, useState, useCallback, useEffect } from 'react'
import { useCanvasStore } from '../../store'

interface UseComposerStateOpts {
  onSend: (text: string) => void
  onCollapse: () => void
  disabled?: boolean
  maxHeightPercent?: number
}

interface UseComposerStateReturn {
  value: string
  setValue: (v: string) => void
  textareaRef: React.RefObject<HTMLTextAreaElement>
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  handleChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  canSend: boolean
  reset: () => void
  replaceText: (text: string) => void
}

const STORE_WRITE_DEBOUNCE_MS = 300

/** Persist composer text to the canvas store, normalising empty → null. */
function writeDraftToStore(value: string): void {
  if (typeof useCanvasStore.setState === 'function') {
    useCanvasStore.setState({ draftComposerText: value || null })
  }
}

export function useComposerState({
  onSend,
  onCollapse,
  disabled = false,
  maxHeightPercent = 35,
}: UseComposerStateOpts): UseComposerStateReturn {
  // Mount-time read uses getState() (not a hook selector) so a store change
  // mid-typing doesn't re-trigger the initialiser and reset the textarea.
  const [value, setValueRaw] = useState(
    () => useCanvasStore.getState().draftComposerText ?? '',
  )
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Mirror of the latest value so the unmount cleanup can flush without
  // depending on the (potentially stale) closure value at effect creation.
  const latestValueRef = useRef(value)

  // Watch for scenario switches: when the active scenario changes, the composer
  // draft is no longer relevant (it belonged to the old decision). loadScenario
  // already clears `draftComposerText` in the store, but the local React state
  // outlives the store write, so we explicitly reset both here. Without this,
  // the user could see their draft for one decision appear in another.
  const scenarioId = useCanvasStore((s) => s.currentScenarioId)
  const lastScenarioRef = useRef(scenarioId)
  useEffect(() => {
    if (scenarioId !== lastScenarioRef.current) {
      lastScenarioRef.current = scenarioId
      setValueRaw('')
      latestValueRef.current = ''
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
      writeDraftToStore('')
    }
  }, [scenarioId])

  const canSend = value.trim().length > 0 && !disabled

  // Auto-grow on value change — caps at maxHeightPercent of viewport
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const maxHeight = Math.floor(window.innerHeight * (maxHeightPercent / 100))
    const newHeight = Math.min(el.scrollHeight, maxHeight)
    el.style.height = `${newHeight}px`
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }, [value, maxHeightPercent])

  /**
   * Schedule a debounced write to the store. Cancels any pending write so
   * only the most recent typing is persisted. Also keeps `latestValueRef`
   * in sync so the unmount flush has the right value.
   */
  const scheduleStoreWrite = useCallback((next: string) => {
    latestValueRef.current = next
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    debounceTimerRef.current = setTimeout(() => {
      writeDraftToStore(next)
      debounceTimerRef.current = null
    }, STORE_WRITE_DEBOUNCE_MS)
  }, [])

  // Wrap setValue so every mutation goes through the persistence pipeline.
  // External callers using setValue directly (rare) still benefit.
  const setValue = useCallback((next: string) => {
    setValueRaw(next)
    scheduleStoreWrite(next)
  }, [scheduleStoreWrite])

  // Cleanup on unmount: flush any pending debounced write immediately so
  // a quick panel collapse doesn't drop the last keystrokes. Only runs on
  // unmount (empty deps) — running per-value would defeat the debounce.
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
      writeDraftToStore(latestValueRef.current)
    }
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        if (canSend) {
          onSend(value.trim())
          setValueRaw('')
          // Clear the persisted draft synchronously on send — debouncing
          // here would let the just-sent text reappear on the next mount.
          if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current)
            debounceTimerRef.current = null
          }
          latestValueRef.current = ''
          writeDraftToStore('')
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        onCollapse()
      }
    },
    [canSend, value, onSend, onCollapse],
  )

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const next = e.target.value
      setValueRaw(next)
      scheduleStoreWrite(next)
    },
    [scheduleStoreWrite],
  )

  const reset = useCallback(() => {
    setValueRaw('')
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    latestValueRef.current = ''
    writeDraftToStore('')
  }, [])

  /** Replace input content (used by Guide dropdown). Focuses and places cursor at end. */
  const replaceText = useCallback((text: string) => {
    setValueRaw(text)
    scheduleStoreWrite(text)
    requestAnimationFrame(() => {
      const el = textareaRef.current
      if (el) {
        el.focus()
        el.setSelectionRange(text.length, text.length)
      }
    })
  }, [scheduleStoreWrite])

  return { value, setValue, textareaRef, handleKeyDown, handleChange, canSend, reset, replaceText }
}
