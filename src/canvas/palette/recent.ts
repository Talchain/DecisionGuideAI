/**
 * Recent Actions Tracking
 *
 * Tracks the last 5 executed palette items for quick re-access.
 * Persisted to sessionStorage (cleared on browser close).
 *
 * **Privacy**: Only stores item IDs and kinds (no user data)
 * **Performance**: Max 5 items with deduplication
 */

import type { PaletteItem, PaletteItemKind } from './indexers'

/**
 * Recent action entry (stored in sessionStorage)
 */
export interface RecentAction {
  id: string
  kind: PaletteItemKind
  label: string
  timestamp: number // For sorting/expiry
}

/**
 * Storage key (scoped to session)
 */
const STORAGE_KEY = 'palette_recent_actions'

/**
 * Max recent items to track
 */
const MAX_RECENT = 5

/**
 * Get recent actions from sessionStorage
 */
export function getRecentActions(): RecentAction[] {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    if (!stored) return []

    const parsed = JSON.parse(stored)
    if (!Array.isArray(parsed)) return []

    // Validate structure
    return parsed
      .filter(
        (item: any) =>
          typeof item.id === 'string' &&
          typeof item.kind === 'string' &&
          typeof item.label === 'string' &&
          typeof item.timestamp === 'number'
      )
      .slice(0, MAX_RECENT) // Enforce max
  } catch (error) {
    console.warn('[Palette] Failed to load recent actions:', error)
    return []
  }
}

/**
 * Add item to recent actions (deduplicates and enforces max)
 */
export function addRecentAction(item: PaletteItem): void {
  try {
    const recent = getRecentActions()

    // Remove existing entry for this ID (deduplication)
    const filtered = recent.filter((r) => r.id !== item.id)

    // Add to front
    const updated: RecentAction[] = [
      {
        id: item.id,
        kind: item.kind,
        label: item.label,
        timestamp: Date.now()
      },
      ...filtered
    ].slice(0, MAX_RECENT)

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch (error) {
    // Never throw - recent tracking is best-effort
    console.warn('[Palette] Failed to save recent action:', error)
  }
}

/**
 * Clear all recent actions
 */
export function clearRecentActions(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.warn('[Palette] Failed to clear recent actions:', error)
  }
}

/**
 * Convert recent actions to PaletteItems for indexing
 */
export function indexRecentActions(): PaletteItem[] {
  const recent = getRecentActions()

  return recent.map((r) => ({
    id: r.id,
    kind: r.kind,
    label: r.label,
    description: 'Recent',
    keywords: ['recent', 'history'],
    metadata: {
      isRecent: true,
      timestamp: r.timestamp
    }
  }))
}
