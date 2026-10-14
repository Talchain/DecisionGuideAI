/**
 * "I disagree" on the Challenge card — RECORD the objection, not just open a
 * chat draft (DL request 14 Oct 2026; Paul's principle "preserve meaningful
 * dissent").
 *
 * ⭐⭐ THIS IS `StrengthenTheReasoning.commitDispute`'s MECHANISM, NOT A NEW ONE.
 * Same three writers, same order, same guards:
 *   1. `strengthenStore.seedIfAbsent` + `dispute` — the session record (seed
 *      first: `dispute` silently no-ops on an id the store holds no record for);
 *   2. `dissentStore.recordDissent` — the durable record, stamped with the run
 *      the words were written against; it is what survives a reload;
 *   3. the `finding_dissent` system event — only when a real run identity and a
 *      live conversation dispatcher exist (`buildFindingDissentEvent` returns
 *      null otherwise), sent strictly AFTER the durable write, with a swallowed,
 *      unlogged catch (the statement may carry PII — `findingDissent.ts`).
 * No new store and no new event type.
 *
 * ⚠ THE READ-BACK IS THE DURABLE STORE, BY FINDING ID. The card's receipt is
 * rendered from `readDissent(scenario)[rec.id]`, never from local "I just saved"
 * state, so it cannot say "recorded" about a write that failed, and it is the
 * same read a reload performs.
 *
 * ⚠ THE ADDRESS IS SNAPSHOTTED WHEN THE COMPOSER OPENS (scenario + run hash),
 * as `commitDispute` reads `disputeContext.current`: a decision switched
 * mid-compose reports the change and writes nothing rather than filing the
 * words under whichever decision is live when Save is pressed.
 *
 * Ported from PR #1952's hook, trimmed to what the current card renders.
 */
import { useCallback, useMemo, useRef, useState } from 'react'
import { useStrengthenStore, recordKey } from '../../../canvas/stores/strengthenStore'
import { useCanvasStore } from '../../../canvas/store'
import { useOptionalConversationContext } from '../../../canvas/conversation/ConversationContext'
import { buildFindingDissentEvent, isSendableAddress } from '../../../canvas/conversation/findingDissent'
import { recordDissent, readDissent, type DissentRecord } from '../../../canvas/stores/dissentStore'
import { ANALYSIS_NEW_COPY as COPY } from './analysisNewCopy'
import type { Recommendation } from '../strengthen/strengthenTypes'

export interface FindingDissentState {
  /** The finding id the composer is open for, or `null`. */
  openId: string | null
  draft: string
  setDraft: (value: string) => void
  saveError: string | null
  /** Opens the composer, prefilled from the standing durable record. */
  open: (rec: Recommendation, analysisHash: string | null) => void
  close: () => void
  /** Writes the objection; see the module docblock for the sequence. */
  commit: (rec: Recommendation) => void
  /** The durable record for this finding on the decision on screen, if any. */
  recorded: (rec: Recommendation) => DissentRecord | undefined
  /** Will a save from the open composer reach Olumi — the send's own predicate. */
  willSend: () => boolean
}

export function useFindingDissent(): FindingDissentState {
  const dispute = useStrengthenStore((st) => st.dispute)
  const seedIfAbsent = useStrengthenStore((st) => st.seedIfAbsent)
  const scenarioId = useCanvasStore((st) => st.currentScenarioId)
  const sendSystemEvent = useOptionalConversationContext()?.sendSystemEvent

  const [openId, setOpenId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [epoch, setEpoch] = useState(0)
  const contextRef = useRef<{ scenarioId: string | null; analysisHash: string | null } | null>(null)

  // Re-read on a write (epoch) or a decision change, not every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const durable = useMemo(() => readDissent(scenarioId), [epoch, scenarioId])

  const recorded = useCallback((rec: Recommendation) => durable[rec.id], [durable])

  const open = useCallback(
    (rec: Recommendation, analysisHash: string | null) => {
      contextRef.current = { scenarioId, analysisHash }
      setSaveError(null)
      setDraft(durable[rec.id]?.reason ?? '')
      setOpenId(rec.id)
    },
    [scenarioId, durable],
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
      isSendableAddress({ findingId: openId, analysisId: contextRef.current?.analysisHash ?? null }),
    [sendSystemEvent, openId],
  )

  const commit = useCallback(
    (rec: Recommendation) => {
      if (!draft.trim()) return
      const context = contextRef.current
      if (!context || context.scenarioId !== useCanvasStore.getState().currentScenarioId) {
        setSaveError(COPY.dissent.scenarioChanged)
        return
      }
      seedIfAbsent(rec, context.analysisHash, context.scenarioId)
      dispute(recordKey(context.scenarioId, rec.id), draft)
      const saved = recordDissent(context.scenarioId, rec.id, draft, context.analysisHash)
      setEpoch((n) => n + 1)
      if (!saved) {
        // Keep the words and the composer open so the same editor can retry;
        // the card must not claim a record that was not written.
        setSaveError(COPY.dissent.notSaved)
        return
      }
      const event = buildFindingDissentEvent({ findingId: rec.id, analysisId: context.analysisHash, statement: draft })
      if (sendSystemEvent && event) {
        // Additive only: the durable record already exists. Never logged.
        void Promise.resolve(sendSystemEvent(event)).catch(() => {})
      }
      close()
    },
    [draft, seedIfAbsent, dispute, sendSystemEvent, close],
  )

  return { openId, draft, setDraft, saveError, open, close, commit, recorded, willSend }
}
