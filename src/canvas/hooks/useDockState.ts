import { useCallback, useRef, useSyncExternalStore } from 'react'

type Listener = () => void

interface DockStateEntry<T> {
  value: T
  listeners: Set<Listener>
}

/**
 * One in-memory authority per persisted dock key.
 *
 * `sessionStorage` remains the reload boundary, but it is deliberately NOT the
 * live coordination channel. Multiple mounted consumers of the same dock key
 * subscribe to this entry, so an open/close transition is observed in the same
 * React update instead of waiting for an unrelated render and re-reading
 * storage.
 */
const dockStateEntries = new Map<string, DockStateEntry<unknown>>()

function readInitialState<T>(storageKey: string, defaultValue: T): T {
  try {
    if (typeof sessionStorage === 'undefined') return defaultValue
    const raw = sessionStorage.getItem(storageKey)
    if (!raw) return defaultValue
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && typeof defaultValue === 'object') {
      return { ...(defaultValue as object), ...(parsed as object) } as T
    }
    return parsed as T
  } catch {
    return defaultValue
  }
}

function entryFor<T>(storageKey: string, defaultValue: T): DockStateEntry<T> {
  let entry = dockStateEntries.get(storageKey) as DockStateEntry<T> | undefined
  if (!entry) {
    entry = { value: readInitialState(storageKey, defaultValue), listeners: new Set() }
    dockStateEntries.set(storageKey, entry as DockStateEntry<unknown>)
  } else if (entry.listeners.size === 0) {
    // A fresh mount after the previous owner unmounted must honour a storage
    // reset/rehydration (load-bearing for scenario reloads and test isolation).
    entry.value = readInitialState(storageKey, defaultValue)
  }
  return entry
}

function persist<T>(storageKey: string, value: T): void {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(storageKey, JSON.stringify(value))
    }
  } catch {
    // Private mode/quota errors do not make the subscribed in-memory state
    // unusable; they only remove reload persistence.
  }
}

export function useDockState<T>(
  storageKey: string,
  defaultValue: T
): [T, (next: T | ((prev: T) => T)) => void] {
  const entryRef = useRef<{ storageKey: string; entry: DockStateEntry<T> } | null>(null)
  if (entryRef.current?.storageKey !== storageKey) {
    entryRef.current = { storageKey, entry: entryFor(storageKey, defaultValue) }
  }
  const entry = entryRef.current.entry

  const subscribe = useCallback((listener: Listener) => {
    entry.listeners.add(listener)
    return () => entry.listeners.delete(listener)
  }, [entry])
  const getSnapshot = useCallback(() => entry.value, [entry])
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  const update = useCallback((next: T | ((prev: T) => T)) => {
    const previous = entry.value
    const value = typeof next === 'function'
      ? (next as (prev: T) => T)(previous)
      : next
    if (Object.is(previous, value)) return
    entry.value = value
    persist(storageKey, value)
    for (const listener of entry.listeners) listener()
  }, [entry, storageKey])

  return [state, update]
}
