/**
 * ⭐ DECIDE & REVIEW S1 (MG lease #85 5948537951): bring a signed-in user's recorded decision back on ANY device.
 *
 * When the open scenario has no record on this device, ask CEE for the owner's own records and show the newest
 * (`hydrateDecisionRecordFromServer`: memory only, applied only for the current owner epoch, never over a local
 * record). Renders nothing; mounted once beside `DecisionRecordModal`. A guest makes no call (CEE's DR001).
 */
import { useEffect } from 'react'
import { useCanvasStore } from '../../../canvas/store'
import { useAuth } from '../../../contexts/AuthContext'
import { listDecisionRecords } from '../../../services/decisionRecordListService'
import { hydrateDecisionRecordFromServer, useDecisionRecordStore } from './decisionRecordStore'
import { resolveScenarioKey } from './scenarioKey'

/** `scenarios.id` is a UUID column; anything else has no server records to read. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function DecisionRecordServerSync(): null {
  const scenarioId = useCanvasStore((s) => s.currentScenarioId)
  // Auth adoption sets the record store's owner epoch BEFORE it exposes the user (AuthContext), so keying on the user
  // re-reads once a cold open's session resolves after the scenario, and again after an account switch.
  const userId = useAuth().user?.id ?? null
  // The owner generation this read starts under; a reply is applied only in that same generation.
  const ownerEpoch = useDecisionRecordStore((s) => s.ownerEpoch)
  useEffect(() => {
    if (!userId || !ownerEpoch || typeof scenarioId !== 'string' || !UUID_RE.test(scenarioId)) return
    const key = resolveScenarioKey(scenarioId)
    if (useDecisionRecordStore.getState().byScenario[key]) return
    let live = true
    void listDecisionRecords(scenarioId).then((res) => {
      // A reply for a scenario the user has already left is dropped here; one that lands after an account switch is
      // refused by the store's owner-epoch check.
      if (!live || res.status !== 'ok' || res.records.length === 0) return
      hydrateDecisionRecordFromServer(key, res.ownerId, res.records[0]!, ownerEpoch)
    })
    return () => { live = false }
  }, [scenarioId, userId, ownerEpoch])
  return null
}
