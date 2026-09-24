/**
 * "I disagree" (E18, ruling `c5806258826.md` §3: "keep `I disagree`
 * available") — THE PROPER SAVE PATH.
 *
 * ⭐⭐ THIS PORTS `StrengthenTheReasoning.commitDispute` (:615-700), NOT A NEW
 * MECHANISM. That component already ships the canonical writer for a
 * disagreement: `strengthenStore.dispute` (session record, read back on this
 * device), `dissentStore.recordDissent` (durable, survives a reload) and the
 * `finding_dissent` system event (reaches CEE, schemas 0.55.0). The Challenge
 * card's own "I disagree" opened a chat draft instead — a claim that never
 * became a record until the person separately pressed Send in the drawer, and
 * on the drawer's own account nothing IS recorded until they do. This hook is
 * the same mechanism, scoped to the ONE finding the card ever shows.
 *
 * ⛔⛔ A DOCUMENTED PRODUCT DECISION CUTS THE OTHER WAY, AND THE REVIEWER MUST
 * SEE IT. `buildReviewQueue.ts`'s `reviewItemDisagreePayload` carries: *"V2
 * routes disagreement INTO THE CONVERSATION, the one place both the person
 * and Olumi can act on it (the brief removes separate note stores)."* This
 * hook writes exactly the separate note store that sentence says the brief
 * removed. The ChatGPT ruling this PR builds from says only "keep `I
 * disagree` available" — it does not adjudicate the store question, and the
 * editability map that assigned this PR classes it REWIRE and says "get an
 * independent verdict on the exact head". That verdict has NOT been sought
 * yet; this PR is the artefact for it, not a merge candidate.
 *
 * ═══ WHAT IS PORTED, AND WHAT IS DELIBERATELY LEFT FOR A FOLLOW-UP ═══
 * Ported: seed-then-dispute (dispute silently no-ops on an unseeded id),
 * the scenario-identity guard (a decision switched mid-compose must not write
 * under whichever one happens to be on screen when Send is pressed), the
 * durable write and its failure path (keep the words, do not close, let the
 * user retry), the wire send with its swallowed catch (the words may contain
 * PII and schemas 0.55.0 licenses persisting them, not re-emitting them to a
 * console), and the read-back (`standing`), falling back to the session
 * record's own history the same way `StrengthenTheReasoning` does for a board
 * with no persisted identity.
 *
 * NOT ported: `sentRecordKeys` ("Sent to Olumi" vs "Kept in this tab only"),
 * `dissentCurrency` ("written against an earlier analysis") and the
 * cross-tab "rescued unsaved" notice. Each is a real refinement on the
 * shipped surface and none changes whether the record is written — they are
 * additional truth about a record this hook already writes correctly, so
 * deferring them is not deferring correctness. Named here so "ported" is not
 * read as "identical".
 */
import { useCallback, useMemo, useRef, useState } from 'react'
import { useStrengthenStore, recordKey } from '../../../canvas/stores/strengthenStore'
import { useCanvasStore } from '../../../canvas/store'
import { useOptionalConversationContext } from '../../../canvas/conversation/ConversationContext'
import { buildFindingDissentEvent, isSendableAddress } from '../../../canvas/conversation/findingDissent'
import { recordDissent, readDissent } from '../../../canvas/stores/dissentStore'
import { ANALYSIS_NEW_COPY as COPY } from './analysisNewCopy'
import type { Recommendation } from '../strengthen/strengthenTypes'

export interface FindingDissentState {
  /** The finding id the composer is open for, or `null`. At most one at a time. */
  openId: string | null
  draft: string
  setDraft: (value: string) => void
  saveError: string | null
  /** Opens the composer, prefilled from any standing record. */
  open: (rec: Recommendation, analysisHash: string | null) => void
  close: () => void
  /** Writes the disagreement; see the module docblock for the sequence. */
  commit: (rec: Recommendation) => void
  /** The reader's own words from a prior send, if any — the read-back. */
  standing: (rec: Recommendation) => string | undefined
  /**
   * Will THIS commit reach CEE — asked while the words do not exist yet, so
   * the disclosure beside the textarea is never wrong. The send's own
   * predicate, not a second one: see `findingDissent.ts#isSendableAddress`.
   */
  willSend: () => boolean
}

export function useFindingDissent(): FindingDissentState {
  const dispute = useStrengthenStore((st) => st.dispute)
  const seedIfAbsent = useStrengthenStore((st) => st.seedIfAbsent)
  const strengthenRecords = useStrengthenStore((st) => st.records)
  const scenarioId = useCanvasStore((st) => st.currentScenarioId)
  const sendSystemEvent = useOptionalConversationContext()?.sendSystemEvent

  const [openId, setOpenId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [epoch, setEpoch] = useState(0)

  /**
   * ⚠⚠ THE SNAPSHOT, NOT THE LIVE VALUE — same reason `StrengthenTheReasoning`
   * reads `disputeContext.current` rather than a live prop: a run settling or
   * a scenario changing mid-compose must not move the address a send is about
   * to use out from under the words already on screen.
   */
  const contextRef = useRef<{ scenarioId: string | null; analysisHash: string | null } | null>(null)

  // Re-read on an epoch, not on every render: `readDissent` touches storage.
  const durable = useMemo(() => readDissent(scenarioId), [epoch, scenarioId])

  const standing = useCallback(
    (rec: Recommendation): string | undefined => {
      const fromDurable = durable[rec.id]?.reason
      if (fromDurable) return fromDurable
      const record = strengthenRecords[recordKey(scenarioId, rec.id)]
      if (!record) return undefined
      return [...record.history].reverse().find((e) => e.event === 'disputed')?.disputeReason
    },
    [durable, strengthenRecords, scenarioId],
  )

  const open = useCallback(
    (rec: Recommendation, analysisHash: string | null) => {
      contextRef.current = { scenarioId, analysisHash }
      setSaveError(null)
      setDraft(standing(rec) ?? '')
      setOpenId(rec.id)
    },
    [scenarioId, standing],
  )

  const close = useCallback(() => {
    setOpenId(null)
    setDraft('')
    setSaveError(null)
    contextRef.current = null
  }, [])

  const willSend = useCallback(
    () =>
      Boolean(sendSystemEvent) &&
      isSendableAddress({
        findingId: openId,
        analysisId: contextRef.current?.analysisHash ?? null,
      }),
    [sendSystemEvent, openId],
  )

  const commit = useCallback(
    (rec: Recommendation) => {
      if (!draft.trim()) {
        close()
        return
      }
      const context = contextRef.current
      // The address moved out from under the words: do not write under
      // whichever decision happens to be live when Send was pressed.
      if (!context || context.scenarioId !== useCanvasStore.getState().currentScenarioId) {
        setSaveError(COPY.dissent.scenarioChanged)
        return
      }
      // Seed first: `dispute` silently no-ops on an id the store holds no
      // record for, and a pre-run finding has none yet.
      seedIfAbsent(rec, context.analysisHash, context.scenarioId)
      dispute(recordKey(context.scenarioId, rec.id), draft)
      // No persisted identity: keep the session-only record and stop. There
      // is no durable home and nothing to send an id for.
      if (!context.scenarioId) {
        close()
        return
      }
      const saved = recordDissent(context.scenarioId, rec.id, draft, context.analysisHash)
      setEpoch((n) => n + 1)
      if (!saved) {
        // Keep the words on screen so the same composer can retry; do not
        // close over an unsaved sentence.
        setSaveError(COPY.dissent.notSaved)
        return
      }
      const event = buildFindingDissentEvent({
        findingId: rec.id,
        analysisId: context.analysisHash,
        statement: draft,
      })
      if (sendSystemEvent && event) {
        // Additive only: the durable record is already written, so nothing
        // below this line may subtract from what the reader already has.
        // Never logged — the statement may carry PII (findingDissent.ts).
        void Promise.resolve(sendSystemEvent(event)).catch(() => {})
      }
      close()
    },
    [draft, seedIfAbsent, dispute, sendSystemEvent, close],
  )

  return { openId, draft, setDraft, saveError, open, close, commit, standing, willSend }
}
