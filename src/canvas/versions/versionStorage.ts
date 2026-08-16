/**
 * Version persistence — localStorage, guest-working, size-bounded.
 * British English: visualisation, colour, initialise.
 *
 * WORKS FOR GUESTS BY CONSTRUCTION
 * --------------------------------
 * There is no identity check anywhere in this module, and that is the point.
 * The nearest comparable surface — the compare tab's history — hydrates through
 * `compare-tab/useCompareHistoryHydration.ts:79`, which early-returns on a
 * missing `userId`; staging serves sessions as guest, so that surface is
 * permanently empty for the people actually testing the product. The server
 * alternative cannot help: `v5_handler_facts` is RLS-scoped to `auth.uid()`, so
 * guest rows are invisible to it by construction.
 *
 * So versions are local for EVERY session class. The honest consequence, which
 * the panel states on screen rather than hiding: versions live in one browser
 * on one device, are not shared with collaborators, and are lost if site data
 * is cleared. DESIGN.md carries the migration path to durable storage.
 *
 * REUSES THE REPO'S EXISTING CONVENTIONS rather than inventing new ones:
 * `VersionedPayload` / `StorageResult` / `StorageErrorType` from
 * `../persist/types`, and the `olumi-canvas-*` key convention with a `-v1`
 * suffix. The payload is versioned from day one so a future shape change has a
 * migration seam instead of a silent data loss.
 */

import type { StorageResult, VersionedPayload } from '../persist/types'
import { StorageErrorType } from '../persist/types'
import type { ModelVersion } from './types'

export const VERSIONS_STORAGE_KEY = 'olumi-canvas-model-versions-v1'
export const VERSIONS_SCHEMA = 'canvas.versions.v1'
export const VERSIONS_SCHEMA_VERSION = '1.0.0'

/**
 * Retention bound. A version holds a whole graph, and localStorage is a ~5 MB
 * shared budget, so this is deliberately modest — the PoC question is "can I
 * see what changed", not "can I keep a year of history".
 */
export const MAX_VERSIONS = 20

function isLocalStorageAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
  } catch {
    return false
  }
}

/** Newest first — the order every surface wants, applied in ONE place. */
function newestFirst(versions: readonly ModelVersion[]): ModelVersion[] {
  return [...versions].sort((a, b) => b.createdAt - a.createdAt)
}

function isModelVersion(value: unknown): value is ModelVersion {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<ModelVersion>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.createdAt === 'number' &&
    Array.isArray(candidate.nodes) &&
    Array.isArray(candidate.edges)
  )
}

/**
 * Load every stored version, newest first.
 *
 * Never throws and never returns a partial lie: a corrupt or unreadable store
 * yields an EMPTY list plus a console warning, because the honest answer to
 * "which versions do I have" when the record is unreadable is "none I can
 * show you", not a silently truncated subset presented as complete.
 * Individually malformed entries are dropped and counted in the warning.
 */
export function loadVersions(): ModelVersion[] {
  if (!isLocalStorageAvailable()) return []

  try {
    const stored = localStorage.getItem(VERSIONS_STORAGE_KEY)
    if (!stored) return []

    const payload = JSON.parse(stored) as VersionedPayload<unknown>
    if (!payload || typeof payload !== 'object' || !Array.isArray(payload.data)) {
      console.warn('[versions] Stored payload is not a version list; ignoring')
      return []
    }

    const entries = payload.data as unknown[]
    const valid = entries.filter(isModelVersion)
    if (valid.length !== entries.length) {
      console.warn(`[versions] Dropped ${entries.length - valid.length} malformed version(s)`)
    }

    return newestFirst(valid)
  } catch (error) {
    console.warn('[versions] Failed to read versions; treating as empty', error)
    return []
  }
}

function writePayload(versions: readonly ModelVersion[]): void {
  const payload: VersionedPayload<ModelVersion[]> = {
    schema: VERSIONS_SCHEMA,
    version: VERSIONS_SCHEMA_VERSION,
    timestamp: Date.now(),
    data: [...versions],
  }
  localStorage.setItem(VERSIONS_STORAGE_KEY, JSON.stringify(payload))
}

function isQuotaError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
  )
}

/**
 * Persist a version list, pruned to `MAX_VERSIONS` newest-first.
 *
 * On a quota error it retries with progressively fewer versions rather than
 * failing outright — losing the oldest version is a far better outcome for the
 * user than losing the save they just asked for. If even a single version will
 * not fit, that is reported as a real failure, loudly, and never as success.
 */
export function saveVersions(versions: readonly ModelVersion[]): StorageResult<ModelVersion[]> {
  if (!isLocalStorageAvailable()) {
    return {
      success: false,
      error: { type: StorageErrorType.UNAVAILABLE, message: 'localStorage is not available' },
    }
  }

  const pruned = newestFirst(versions).slice(0, MAX_VERSIONS)

  // Writing an EMPTY list is a legitimate operation — it is what deleting the
  // last version means. The shedding loop below starts at `pruned.length` and
  // stops at 1, so without this an empty write would fall straight through to
  // the quota failure and the delete would silently not happen.
  if (pruned.length === 0) {
    try {
      writePayload([])
      return { success: true, data: [] }
    } catch (error) {
      return {
        success: false,
        error: {
          type: StorageErrorType.UNKNOWN,
          message: error instanceof Error ? error.message : 'Failed to clear versions',
          original: error instanceof Error ? error : undefined,
        },
      }
    }
  }

  for (let keep = pruned.length; keep >= 1; keep--) {
    const attempt = pruned.slice(0, keep)
    try {
      writePayload(attempt)
      if (keep < pruned.length) {
        console.warn(`[versions] Storage full — kept the ${keep} most recent version(s)`)
      }
      return { success: true, data: attempt }
    } catch (error) {
      if (!isQuotaError(error)) {
        return {
          success: false,
          error: {
            type: StorageErrorType.UNKNOWN,
            message: error instanceof Error ? error.message : 'Failed to save versions',
            original: error instanceof Error ? error : undefined,
          },
        }
      }
    }
  }

  return {
    success: false,
    error: {
      type: StorageErrorType.QUOTA_EXCEEDED,
      message: 'This model is too large to save a version in this browser.',
    },
  }
}

/** Append a version and persist. Returns the stored list, newest first. */
export function appendVersion(version: ModelVersion): StorageResult<ModelVersion[]> {
  return saveVersions([version, ...loadVersions()])
}

/** Remove one version by id and persist. */
export function deleteVersion(id: string): StorageResult<ModelVersion[]> {
  return saveVersions(loadVersions().filter((version) => version.id !== id))
}

/** Remove every stored version. */
export function clearVersions(): void {
  if (!isLocalStorageAvailable()) return
  try {
    localStorage.removeItem(VERSIONS_STORAGE_KEY)
  } catch (error) {
    console.warn('[versions] Failed to clear versions', error)
  }
}
