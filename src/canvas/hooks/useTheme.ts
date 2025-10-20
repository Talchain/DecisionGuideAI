/**
 * SSR-safe theme hook using useSyncExternalStore
 * Subscribes to system colour scheme preference
 * British English: colour
 */
import { useSyncExternalStore } from 'react'

let mq: MediaQueryList | null = null
if (typeof window !== 'undefined') {
  mq = window.matchMedia('(prefers-color-scheme: dark)')
}

function subscribe(cb: () => void) {
  mq?.addEventListener?.('change', cb)
  return () => mq?.removeEventListener?.('change', cb)
}

function getSnapshot() {
  return mq?.matches ?? false
}

function getServerSnapshot() {
  return false // Default to light on server
}

/**
 * Returns true if dark mode is active
 * SSR-safe: returns false on server, syncs on client
 */
export function useIsDark(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
