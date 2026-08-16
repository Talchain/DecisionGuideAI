/**
 * React binding for versions: list, save, delete, and the selected comparison.
 * British English: visualisation, colour, initialise.
 *
 * Holds NO diff logic and NO storage logic — it composes `versionStorage` and
 * `diffModelVersions`. The diff authority stays the single one.
 */

import { useCallback, useMemo, useState } from 'react'
import { useCanvasStore } from '../store'
import { captureModelVersion } from './captureModelVersion'
import { diffModelVersions } from './diffModelVersions'
import type { ModelChangeset, ModelVersion, VersionOrigin } from './types'
import { appendVersion, deleteVersion as deleteStoredVersion, loadVersions } from './versionStorage'

/** Result of a save attempt, for surfacing an honest message. */
export interface SaveOutcome {
  ok: boolean
  message?: string
}

function newVersionId(): string {
  const globalCrypto = typeof globalThis === 'undefined' ? undefined : globalThis.crypto
  if (globalCrypto && typeof globalCrypto.randomUUID === 'function') {
    return `ver_${globalCrypto.randomUUID()}`
  }
  return `ver_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

export interface UseModelVersions {
  versions: ModelVersion[]
  /** Id of the earlier side of the comparison. */
  fromId: string | null
  /** Id of the later side of the comparison. */
  toId: string | null
  setFromId: (id: string) => void
  setToId: (id: string) => void
  /** The changeset for the current selection, or null when one is not selectable. */
  changeset: ModelChangeset | null
  from: ModelVersion | null
  to: ModelVersion | null
  saveVersion: (name: string, origin?: VersionOrigin) => SaveOutcome
  removeVersion: (id: string) => void
}

/**
 * Manage the stored version list and the pair currently being compared.
 *
 * Default selection is "latest vs previous" — the question a user actually
 * arrives with. It is computed from the list rather than stored, so it stays
 * correct after a save or a delete without a second piece of state to keep in
 * step.
 */
export function useModelVersions(): UseModelVersions {
  const [versions, setVersions] = useState<ModelVersion[]>(() => loadVersions())
  const [selectedFromId, setSelectedFromId] = useState<string | null>(null)
  const [selectedToId, setSelectedToId] = useState<string | null>(null)

  // Versions are newest-first, so [1] is the previous one.
  const defaultToId = versions[0]?.id ?? null
  const defaultFromId = versions[1]?.id ?? null

  const toId = selectedToId && versions.some((v) => v.id === selectedToId) ? selectedToId : defaultToId
  const fromId =
    selectedFromId && versions.some((v) => v.id === selectedFromId) ? selectedFromId : defaultFromId

  const from = useMemo(() => versions.find((v) => v.id === fromId) ?? null, [versions, fromId])
  const to = useMemo(() => versions.find((v) => v.id === toId) ?? null, [versions, toId])

  const changeset = useMemo(() => {
    if (!from || !to || from.id === to.id) return null
    return diffModelVersions(from, to)
  }, [from, to])

  const saveVersion = useCallback((name: string, origin: VersionOrigin = 'manual'): SaveOutcome => {
    const { nodes, edges } = useCanvasStore.getState()
    const version = captureModelVersion(nodes, edges, {
      id: newVersionId(),
      name,
      origin,
      createdAt: Date.now(),
    })

    const result = appendVersion(version)
    if (!result.success) {
      // Exceptions loud: the user asked for a save and did not get one.
      return { ok: false, message: result.error.message }
    }

    setVersions(result.data)
    setSelectedToId(version.id)
    setSelectedFromId(result.data[1]?.id ?? null)
    return { ok: true }
  }, [])

  const removeVersion = useCallback((id: string) => {
    const result = deleteStoredVersion(id)
    if (result.success) setVersions(result.data)
  }, [])

  return {
    versions,
    fromId,
    toId,
    setFromId: setSelectedFromId,
    setToId: setSelectedToId,
    changeset,
    from,
    to,
    saveVersion,
    removeVersion,
  }
}
