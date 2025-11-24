import { useCallback, useEffect, useRef, useState } from 'react'

export function useDockState<T>(
  storageKey: string,
  defaultValue: T
): [T, (next: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(() => {
    try {
      if (typeof sessionStorage === 'undefined') {
        return defaultValue
      }
      const raw = sessionStorage.getItem(storageKey)
      if (!raw) {
        return defaultValue
      }
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && typeof defaultValue === 'object') {
        return { ...(defaultValue as any), ...parsed }
      }
      return parsed as T
    } catch {
      return defaultValue
    }
  })

  const prevStateRef = useRef<T>(state)

  useEffect(() => {
    try {
      if (typeof sessionStorage === 'undefined') {
        return
      }
      const prevSerialized = JSON.stringify(prevStateRef.current)
      const nextSerialized = JSON.stringify(state)
      if (prevSerialized === nextSerialized) {
        return
      }

      sessionStorage.setItem(storageKey, nextSerialized)
      prevStateRef.current = state
    } catch {
    }
  }, [storageKey, state])

  const update = useCallback((next: T | ((prev: T) => T)) => {
    setState(prev => (typeof next === 'function' ? (next as (prev: T) => T)(prev) : next))
  }, [])

  return [state, update]
}
