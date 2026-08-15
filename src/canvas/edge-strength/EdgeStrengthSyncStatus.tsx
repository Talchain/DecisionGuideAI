import { useMemo, useState } from 'react'

import { typography } from '../../styles/typography'
import { useCanvasStore } from '../store'
import {
  applyMyEdgeStrengthValue,
  acceptSharedEdgeStrengthValue,
  getEdgeStrengthEndpointStatus,
  refreshEdgeStrengthAuthority,
  type EdgeStrengthTuple,
} from './edgeStrengthCoordinator'

function signedTuple(tuple: EdgeStrengthTuple): string {
  const value = tuple.mean === 0 ? 0 : tuple.mean
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(2)}`
}

export function EdgeStrengthSyncStatus(props: {
  scenarioId: string | null
  from: string
  to: string
}): JSX.Element | null {
  const { scenarioId, from, to } = props
  const revision = useCanvasStore((state) => state.edgeStrengthSync.revision)
  const [checking, setChecking] = useState(false)
  const [actionFailed, setActionFailed] = useState(false)
  const status = useMemo(
    () => getEdgeStrengthEndpointStatus(scenarioId, from, to),
    [scenarioId, from, to, revision],
  )

  const checkSharedModel = async (): Promise<void> => {
    if (!scenarioId || checking) return
    setChecking(true)
    setActionFailed(false)
    const ok = await refreshEdgeStrengthAuthority(scenarioId)
    setChecking(false)
    if (!ok) setActionFailed(true)
  }

  const restoreSharedModel = async (): Promise<void> => {
    if (!scenarioId || checking) return
    setChecking(true)
    setActionFailed(false)
    const ok = await refreshEdgeStrengthAuthority(scenarioId, { replaceLocalGraph: true })
    setChecking(false)
    if (!ok) setActionFailed(true)
  }

  if (status.kind === 'idle' && !checking && !actionFailed) return null

  let message = ''
  let error = false
  if (checking) message = 'Checking the shared model…'
  else if (actionFailed) {
    message = 'We could not verify the shared model. Check your connection and try again.'
    error = true
  } else if (status.kind === 'queued') message = 'Change ready to save'
  else if (status.kind === 'saving') message = 'Saving relationship…'
  else if (status.kind === 'saved') message = 'Relationship saved to the shared model'
  else if (status.kind === 'confirmed') message = 'Shared value confirmed'
  else if (status.kind === 'shared_value_refreshed') message = 'Shared model refreshed'
  else if (status.kind === 'conflict') {
    const { recovery } = status
    message = recovery.sharedCurrent
      ? `Another change was saved first. Shared value: ${signedTuple(recovery.sharedCurrent)}; your change: ${signedTuple(recovery.attempted)}.`
      : 'Another change was saved first. Check the shared model before analysing.'
    error = true
  } else if (status.kind === 'unconfirmed') {
    message = `We could not confirm whether your ${signedTuple(status.recovery.attempted)} change was saved. Check the shared model before analysing.`
    error = true
  }

  return (
    <div
      className={`mt-2 ${typography.panelMeta} ${error ? 'text-danger' : 'text-text-light'}`}
      aria-live="polite"
      aria-atomic="true"
      aria-busy={checking || status.kind === 'queued' || status.kind === 'saving'}
      {...(error ? { role: 'alert' } : {})}
      data-testid="edge-strength-sync-status"
    >
      <p>{message}</p>
      {!checking && (status.kind === 'conflict' || status.kind === 'unconfirmed' || actionFailed) && (
        <div className="mt-1.5 flex flex-wrap gap-2">
          {status.kind === 'conflict' && status.recovery.sharedCurrent && scenarioId && (
            <>
              <button
                type="button"
                className="text-info underline underline-offset-2"
                onClick={() => {
                  setActionFailed(false)
                  setChecking(true)
                  void acceptSharedEdgeStrengthValue(scenarioId, from, to).then((ok) => {
                    setChecking(false)
                    if (!ok) setActionFailed(true)
                  })
                }}
              >
                Use shared value
              </button>
              <button
                type="button"
                className="text-info underline underline-offset-2"
                onClick={() => {
                  if (!applyMyEdgeStrengthValue(scenarioId, from, to)) setActionFailed(true)
                }}
              >
                Apply my change
              </button>
            </>
          )}
          {(status.kind === 'unconfirmed' ||
            (status.kind === 'conflict' && !status.recovery.sharedCurrent) ||
            actionFailed) && (
            <button
              type="button"
              className="text-info underline underline-offset-2"
              onClick={() => { void checkSharedModel() }}
            >
              Check shared model
            </button>
          )}
          {scenarioId && (status.kind === 'conflict' || status.kind === 'unconfirmed' || actionFailed) && (
            <button
              type="button"
              className="text-info underline underline-offset-2"
              onClick={() => { void restoreSharedModel() }}
            >
              Restore shared model
            </button>
          )}
        </div>
      )}
    </div>
  )
}
