/**
 * v10 (#/canvas2) chat: which model version a reply read, and a receipt when the person's own edit is saved.
 * British English: visualisation, colour, initialise.
 *
 * Three small pieces, all mounted only when `usePresentation() === 'v10'`, so `#/canvas` is unchanged:
 *   · `ModelVersionChip`: a quiet "Version N" under an assistant reply. No number known, no chip (never invented).
 *   · `SavedVersionReceipts`: one check-and-words line per saved edit, placed in the thread by when it happened.
 *   · `ModelVersionStampSeed`: reads the head version once whenever the server model moves, so the chip has a number
 *     for any write (Olumi's, a teammate's), not only the ones that carry their own receipt.
 *
 * Ink and grey, never blue: blue means Olumi only, and these report the model, not Olumi's opinion.
 */
import { useEffect } from 'react'
import { Check, History } from 'lucide-react'
import { typography } from '../../../styles/typography'
import { useCanvasStore } from '../../store'
import {
  noteModelMoved,
  noteVersionRead,
  useModelVersionStampStore,
  versionAtTime,
  type SavedVersionReceipt,
} from '../../versions/modelVersionStamp'
import { isRestoreCapableIdentity, isScenarioServerAddressable } from '../../versions/sharedVersionsAvailability'
import type { ConversationMessage } from '../types'

/** The replies that read the model: real, finished assistant answers (not notices, dividers or half-streamed text). */
function readsTheModel(message: ConversationMessage): boolean {
  return message.role === 'assistant' && !message.synthetic && !message.isStreaming
    && typeof message.sessionDivider !== 'string' && message.content.trim().length > 0
}

export function ModelVersionChip({ message }: { message: ConversationMessage }) {
  const scenarioId = useCanvasStore((s) => s.currentScenarioId)
  const observations = useModelVersionStampStore((s) => s.observations)
  if (!readsTheModel(message)) return null
  const number = versionAtTime(observations, scenarioId, message.timestamp instanceof Date ? message.timestamp.getTime() : Number.NaN)
  if (number === null) return null
  return (
    <div
      className={`mt-1 inline-flex items-center gap-1 text-text-light ${typography.chatMeta}`}
      data-testid="model-version-chip"
      data-version={number}
    >
      <History size={12} aria-hidden="true" />
      <span>Version {number}</span>
    </div>
  )
}

/** The saved edits for this scenario, oldest first. */
export function useSavedVersionReceipts(): readonly SavedVersionReceipt[] {
  const scenarioId = useCanvasStore((s) => s.currentScenarioId)
  const receipts = useModelVersionStampStore((s) => s.receipts)
  return scenarioId ? receipts.filter((r) => r.scenarioId === scenarioId) : []
}

export function SavedVersionReceiptLine({ receipt }: { receipt: SavedVersionReceipt }) {
  return (
    <div
      className={`mb-3 flex items-center gap-1.5 text-text-body ${typography.chatMeta}`}
      data-testid="saved-version-receipt"
      data-version={receipt.number}
    >
      <Check size={12} aria-hidden="true" />
      <span>Version {receipt.number} saved: {receipt.what}</span>
    </div>
  )
}

/**
 * Reads the head version's number when the server model moves (and once when a scenario opens). Signed-in readers on a
 * scenario the server can address only: a guest has no versions, so nothing is read and no number is ever shown.
 * The move is noted first with no number, so a reply arriving in between is never stamped with the version before it.
 */
export function ModelVersionStampSeed() {
  const scenarioId = useCanvasStore((s) => s.currentScenarioId)
  const serverGraphHash = useCanvasStore((s) => s.lastServerGraphHash)
  useEffect(() => {
    if (!scenarioId || !serverGraphHash || !isScenarioServerAddressable(scenarioId)) return
    const movedAt = noteModelMoved(scenarioId)
    let cancelled = false
    void (async () => {
      const { getSessionIdentity } = await import('../../../lib/supabase')
      const identity = await getSessionIdentity()
      if (cancelled || !isRestoreCapableIdentity(identity.userId)) return
      const { listModelVersions } = await import('../../../adapters/cee/modelVersions')
      const listed = await listModelVersions(scenarioId, {
        userId: identity.userId,
        accessToken: identity.accessToken,
        limit: 1,
      })
      if (cancelled || listed.status !== 'list') return
      const head = listed.versions.find((v) => v.id === listed.currentVersionId)
      if (head) noteVersionRead(scenarioId, movedAt, head.versionNumber)
    })().catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [scenarioId, serverGraphHash])
  return null
}
