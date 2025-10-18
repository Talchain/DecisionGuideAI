// src/modules/focus/useFocusMode.ts
import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'ui:focus'

export function useFocusMode() {
  const [isFocusMode, setIsFocusMode] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored === '1'
    } catch {
      return false
    }
  })

  const toggle = useCallback(() => {
    setIsFocusMode(prev => {
      const next = !prev
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      } catch (e) {
        console.warn('Failed to persist focus mode:', e)
      }
      return next
    })
  }, [])

  // Keyboard shortcut: F
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'f' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement
        // Don't trigger if user is typing in an input
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
          return
        }
        e.preventDefault()
        toggle()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggle])

  return { isFocusMode, toggle }
}
