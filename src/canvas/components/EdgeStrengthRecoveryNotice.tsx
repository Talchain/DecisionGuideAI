import { useState } from 'react'
import { typography } from '../../styles/typography'
import {
  openEdgeStrengthRecoveryRelationship,
  refreshEdgeStrengthAuthority,
} from '../edge-strength/edgeStrengthCoordinator'
import { useCanvasStore } from '../store'
import { getEdgeStrengthRecoveryBlock } from '../utils/canRunAnalysis'

interface EdgeStrengthRecoveryNoticeProps {
  /** Exact parent Run reason when already available; otherwise derived from
   *  the coordinator's bounded public read model. */
  blockedReason?: string
  id?: string
  className?: string
}

const MAX_VISIBLE_RELATIONSHIPS = 3
const EMPTY_RECOVERY_SUMMARY = { items: [], total: 0, remaining: 0 } as const

/** One shared display selector for dock, floating panel, and compact signals. */
export function useEdgeStrengthRecoveryBlockedReason(): string | undefined {
  const edgeStrengthSync = useCanvasStore((state) => state.edgeStrengthSync)
  return getEdgeStrengthRecoveryBlock(edgeStrengthSync)?.reason
}

/**
 * Shared, display-only recovery surface for canonical relationship writes.
 *
 * The coordinator/store projection remains the sole authority. This component
 * owns only transient button progress and never copies, mutates, or requeues a
 * relationship attempt. It deliberately displays labels rather than internal
 * ReactFlow ids and asks the coordinator to resolve endpoints at action time.
 */
export function EdgeStrengthRecoveryNotice({
  blockedReason,
  id,
  className = '',
}: EdgeStrengthRecoveryNoticeProps) {
  const [refreshingSharedModel, setRefreshingSharedModel] = useState(false)
  const [sharedModelRefreshError, setSharedModelRefreshError] = useState<string | null>(null)
  const currentScenarioId = useCanvasStore((state) => state.currentScenarioId)
  const unconfirmedEmittedEdits = useCanvasStore((state) => state.unconfirmedEmittedEdits)
  const edgeStrengthSync = useCanvasStore((state) => state.edgeStrengthSync)
  const derivedBlockedReason = getEdgeStrengthRecoveryBlock(edgeStrengthSync)?.reason
  const visibleBlockedReason = blockedReason ?? derivedBlockedReason
  const recoveryNeeded =
    unconfirmedEmittedEdits > 0 ||
    edgeStrengthSync.hydration === 'unconfirmed' ||
    edgeStrengthSync.issue !== null
  const projected = edgeStrengthSync.recoverySummary ?? EMPTY_RECOVERY_SUMMARY
  const items = projected.items.slice(0, MAX_VISIBLE_RELATIONSHIPS)
  const total = Math.max(projected.total, projected.items.length)
  const remaining = Math.max(projected.remaining, total - items.length)

  if (!visibleBlockedReason) return null

  const refresh = (replaceLocalGraph: boolean): void => {
    if (!currentScenarioId) return
    setSharedModelRefreshError(null)
    setRefreshingSharedModel(true)
    const request = replaceLocalGraph
      ? refreshEdgeStrengthAuthority(currentScenarioId, { replaceLocalGraph: true })
      : refreshEdgeStrengthAuthority(currentScenarioId)
    void request
      .then((ok) => {
        if (ok) return
        setSharedModelRefreshError(
          replaceLocalGraph
            ? 'The shared model could not be restored. Your local changes are still held from analysis.'
            : 'The shared model could not be checked. Your local changes are still held from analysis.',
        )
      })
      .finally(() => {
        setRefreshingSharedModel(false)
      })
  }

  return (
    <div
      id={id}
      className={`${typography.panelMeta} min-w-0 break-words text-text-light ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-busy={refreshingSharedModel}
      data-testid="edge-strength-recovery-notice"
    >
      <p className="break-words">{visibleBlockedReason}</p>
      {items.length > 0 && (
        <div className="mt-1.5">
          <p className="sr-only">Relationships affecting analysis:</p>
          <ul className="space-y-1" aria-label="Relationships affecting analysis">
            {items.map((item) => (
              <li key={`${item.from}\u0000${item.to}`} className="flex flex-wrap items-center gap-x-2">
                <span className="min-w-0 break-words">{item.label}</span>
                {item.relationshipExists && currentScenarioId && (
                  <button
                    type="button"
                    className="text-info underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info"
                    onClick={() => {
                      openEdgeStrengthRecoveryRelationship(
                        currentScenarioId,
                        item.from,
                        item.to,
                      )
                    }}
                  >
                    Review relationship
                    <span className="sr-only"> {item.label}</span>
                  </button>
                )}
              </li>
            ))}
          </ul>
          {remaining > 0 && (
            <p className="mt-1">
              And {remaining} more relationship{remaining === 1 ? '' : 's'} need attention.
            </p>
          )}
        </div>
      )}
      {recoveryNeeded && currentScenarioId && (
        <div className="mt-1 flex flex-wrap gap-2">
          <button
            type="button"
            className="text-info underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info disabled:opacity-50"
            disabled={refreshingSharedModel}
            onClick={() => refresh(false)}
          >
            {refreshingSharedModel ? 'Checking…' : 'Check shared model'}
          </button>
          <button
            type="button"
            className="text-info underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info disabled:opacity-50"
            disabled={refreshingSharedModel}
            onClick={() => refresh(true)}
          >
            Restore shared model
          </button>
        </div>
      )}
      {sharedModelRefreshError && (
        <p className="mt-1 text-danger" role="alert">{sharedModelRefreshError}</p>
      )}
    </div>
  )
}
