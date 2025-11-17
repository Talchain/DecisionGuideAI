/**
 * S5-STORAGE: Versioned Storage Module
 *
 * Handles versioned persistence to localStorage with:
 * - Schema versioning (canvas.v1)
 * - Automatic migrations
 * - Quota pre-checking
 * - Export fallback when quota exceeded
 */

import type {
  VersionedPayload,
  CanvasPayloadV1,
  CanvasDataV1,
  Migration,
  StorageQuota,
  StorageResult,
  StorageError
} from './types'
import { StorageErrorType } from './types'
import { migrations } from './migrations'

const CURRENT_SCHEMA = 'canvas.v1'
const CURRENT_VERSION = '1.0.0'
const STORAGE_KEY_SCENARIOS = 'olumi-canvas-scenarios-v1'
const STORAGE_KEY_AUTOSAVE = 'olumi-canvas-autosave-v1'

/**
 * Check if localStorage is available
 */
function isLocalStorageAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
  } catch {
    return false
  }
}

/**
 * Get storage quota information
 */
export async function getStorageQuota(): Promise<StorageQuota> {
  if (!isLocalStorageAvailable()) {
    return {
      available: false,
      used: 0,
      total: 0,
      percentage: 100,
      canStore: () => false
    }
  }

  try {
    // Try to get quota from Storage API
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate()
      const used = estimate.usage || 0
      const total = estimate.quota || 5 * 1024 * 1024 // Default 5MB if unknown

      return {
        available: true,
        used,
        total,
        percentage: (used / total) * 100,
        canStore: (size: number) => used + size < total * 0.9 // Keep 10% buffer
      }
    }

    // Fallback: estimate from localStorage
    let used = 0
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) {
        const value = localStorage.getItem(key)
        if (value) {
          used += value.length + key.length
        }
      }
    }

    const total = 5 * 1024 * 1024 // Assume 5MB limit
    return {
      available: true,
      used,
      total,
      percentage: (used / total) * 100,
      canStore: (size: number) => used + size < total * 0.9
    }
  } catch (error) {
    return {
      available: false,
      used: 0,
      total: 0,
      percentage: 100,
      canStore: () => false
    }
  }
}

/**
 * Create versioned payload
 */
export function createVersionedPayload<T>(data: T): VersionedPayload<T> {
  return {
    schema: CURRENT_SCHEMA,
    version: CURRENT_VERSION,
    timestamp: Date.now(),
    data
  }
}

/**
 * Parse and validate versioned payload
 */
function parseVersionedPayload(json: string): StorageResult<VersionedPayload> {
  try {
    const payload = JSON.parse(json)

    // Validate structure
    if (!payload || typeof payload !== 'object') {
      return {
        success: false,
        error: {
          type: StorageErrorType.PARSE_ERROR,
          message: 'Invalid payload structure'
        }
      }
    }

    if (!payload.schema || !payload.version || !payload.data) {
      return {
        success: false,
        error: {
          type: StorageErrorType.PARSE_ERROR,
          message: 'Missing required fields: schema, version, or data'
        }
      }
    }

    return { success: true, data: payload }
  } catch (error) {
    return {
      success: false,
      error: {
        type: StorageErrorType.PARSE_ERROR,
        message: error instanceof Error ? error.message : 'Failed to parse JSON',
        original: error instanceof Error ? error : undefined
      }
    }
  }
}

/**
 * Apply migrations to bring payload to current version
 */
export function migratePayload(
  payload: VersionedPayload
): StorageResult<VersionedPayload> {
  try {
    // Already current version
    if (payload.schema === CURRENT_SCHEMA && payload.version === CURRENT_VERSION) {
      return { success: true, data: payload }
    }

    // Find migration path
    let current = payload
    let migrated = false

    for (const migration of migrations) {
      if (
        current.schema === migration.fromVersion.split('@')[0] &&
        current.version === migration.fromVersion.split('@')[1]
      ) {
        console.info(
          `[versionedStorage] Migrating from ${migration.fromVersion} to ${migration.toVersion}: ${migration.description}`
        )
        current = migration.migrate(current)
        migrated = true
      }
    }

    if (!migrated && (current.schema !== CURRENT_SCHEMA || current.version !== CURRENT_VERSION)) {
      console.warn(
        `[versionedStorage] No migration path found from ${current.schema}@${current.version} to ${CURRENT_SCHEMA}@${CURRENT_VERSION}`
      )
    }

    return { success: true, data: current }
  } catch (error) {
    return {
      success: false,
      error: {
        type: StorageErrorType.MIGRATION_ERROR,
        message: error instanceof Error ? error.message : 'Migration failed',
        original: error instanceof Error ? error : undefined
      }
    }
  }
}

/**
 * Save versioned canvas data
 */
export async function saveCanvasData(
  data: CanvasDataV1
): Promise<StorageResult<void>> {
  if (!isLocalStorageAvailable()) {
    return {
      success: false,
      error: {
        type: StorageErrorType.UNAVAILABLE,
        message: 'localStorage is not available'
      }
    }
  }

  try {
    const payload = createVersionedPayload(data)
    const json = JSON.stringify(payload)

    // Check quota before saving
    const quota = await getStorageQuota()
    const payloadSize = new Blob([json]).size

    if (!quota.canStore(payloadSize)) {
      console.warn(
        `[versionedStorage] Quota exceeded: ${quota.percentage.toFixed(1)}% used. Payload size: ${(payloadSize / 1024).toFixed(2)} KB`
      )
      return {
        success: false,
        error: {
          type: StorageErrorType.QUOTA_EXCEEDED,
          message: `Storage quota exceeded (${quota.percentage.toFixed(1)}% used). Please export your data.`
        }
      }
    }

    localStorage.setItem(STORAGE_KEY_SCENARIOS, json)
    return { success: true, data: undefined }
  } catch (error) {
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      return {
        success: false,
        error: {
          type: StorageErrorType.QUOTA_EXCEEDED,
          message: 'Storage quota exceeded. Please export your data.',
          original: error
        }
      }
    }

    return {
      success: false,
      error: {
        type: StorageErrorType.UNKNOWN,
        message: error instanceof Error ? error.message : 'Failed to save data',
        original: error instanceof Error ? error : undefined
      }
    }
  }
}

/**
 * Load and migrate canvas data
 */
export function loadCanvasData(): StorageResult<CanvasDataV1> {
  if (!isLocalStorageAvailable()) {
    return {
      success: false,
      error: {
        type: StorageErrorType.UNAVAILABLE,
        message: 'localStorage is not available'
      }
    }
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY_SCENARIOS)

    if (!stored) {
      // Not an error - just no data yet
      return {
        success: true,
        data: { scenarios: [] }
      }
    }

    // Parse payload
    const parseResult = parseVersionedPayload(stored)
    if (!parseResult.success) {
      return parseResult as StorageResult<CanvasDataV1>
    }

    // Migrate to current version
    const migrateResult = migratePayload(parseResult.data)
    if (!migrateResult.success) {
      return migrateResult as StorageResult<CanvasDataV1>
    }

    const payload = migrateResult.data as CanvasPayloadV1
    return { success: true, data: payload.data }
  } catch (error) {
    return {
      success: false,
      error: {
        type: StorageErrorType.UNKNOWN,
        message: error instanceof Error ? error.message : 'Failed to load data',
        original: error instanceof Error ? error : undefined
      }
    }
  }
}

/**
 * Save autosave data
 */
export async function saveAutosave(
  nodes: any[],
  edges: any[]
): Promise<StorageResult<void>> {
  if (!isLocalStorageAvailable()) {
    return {
      success: false,
      error: {
        type: StorageErrorType.UNAVAILABLE,
        message: 'localStorage is not available'
      }
    }
  }

  try {
    const payload = createVersionedPayload({
      graph: { nodes, edges },
      timestamp: Date.now()
    })
    const json = JSON.stringify(payload)

    // Quick quota check (don't block autosave)
    const quota = await getStorageQuota()
    if (quota.percentage > 95) {
      console.warn('[versionedStorage] Autosave skipped: quota nearly full')
      return {
        success: false,
        error: {
          type: StorageErrorType.QUOTA_EXCEEDED,
          message: 'Autosave skipped: storage quota nearly full'
        }
      }
    }

    localStorage.setItem(STORAGE_KEY_AUTOSAVE, json)
    return { success: true, data: undefined }
  } catch (error) {
    // Don't throw on autosave failures
    console.warn('[versionedStorage] Autosave failed:', error)
    return {
      success: false,
      error: {
        type: StorageErrorType.UNKNOWN,
        message: 'Autosave failed',
        original: error instanceof Error ? error : undefined
      }
    }
  }
}

/**
 * Load autosave data
 */
export function loadAutosave(): StorageResult<{ nodes: any[]; edges: any[]; timestamp: number } | null> {
  if (!isLocalStorageAvailable()) {
    return { success: true, data: null }
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY_AUTOSAVE)
    if (!stored) {
      return { success: true, data: null }
    }

    const parseResult = parseVersionedPayload(stored)
    if (!parseResult.success) {
      console.warn('[versionedStorage] Failed to parse autosave, ignoring')
      return { success: true, data: null }
    }

    const payload = parseResult.data as VersionedPayload<{
      graph: { nodes: any[]; edges: any[] }
      timestamp: number
    }>

    return {
      success: true,
      data: {
        nodes: payload.data.graph.nodes,
        edges: payload.data.graph.edges,
        timestamp: payload.data.timestamp
      }
    }
  } catch (error) {
    console.warn('[versionedStorage] Failed to load autosave, ignoring')
    return { success: true, data: null }
  }
}

/**
 * Clear autosave
 */
export function clearAutosave(): void {
  if (!isLocalStorageAvailable()) return

  try {
    localStorage.removeItem(STORAGE_KEY_AUTOSAVE)
  } catch (error) {
    console.warn('[versionedStorage] Failed to clear autosave:', error)
  }
}

/**
 * Export data as downloadable JSON (fallback when quota exceeded)
 */
export function exportAsFile(data: CanvasDataV1, filename = 'canvas-export.json'): void {
  const payload = createVersionedPayload(data)
  const json = JSON.stringify(payload, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()

  URL.revokeObjectURL(url)
}
