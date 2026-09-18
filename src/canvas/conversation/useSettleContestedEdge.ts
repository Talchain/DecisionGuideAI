/**
 * useSettleContestedEdge — ONE implementation of the settle act, for every surface.
 *
 * WHY A HOOK AND NOT A SECOND COPY. The act shipped first inside `ContestedSection`
 * (pre-analysis v3). The inspector's `EdgePanel` renders the SAME disagreement
 * (`EdgeReviewDisagreement`, on `validation.status === 'contested'`) and had no way to
 * settle it either. Spelling the emit, the fail-closed rules and the retire write a second
 * time there is the hand-maintained mirror this estate keeps paying for (CLAUDE.md trap 12)
 * — and the two copies would drift on exactly the fields that carry the user's judgement.
 * So the logic moved here and both surfaces call it. There is no second derivation to
 * disagree with.
 *
 * WHAT THE ACT IS. CEE classifies `edge_adjudication` `'fact_and_commit'`
 * (`system-events/dispatch.ts:327`): it persists a typed turn fact stamped
 * `provenance: 'user_set'` and writes NO graph. `judgement-signals.ts` then derives
 * `contestedUnadjudicated` by joining contested edges against exactly these facts, so a
 * verdict — ANY verdict — stops the product re-raising that connection.
 *
 * ⚠ THIS IS A JUDGEMENT, NOT A VALUE EDIT (trap 21). "Which reading do I trust?" and "what
 * should this number be?" are different questions, and the second already has a live,
 * `'mutating'` verb (`edge_strength_edit`). Nothing here writes an effect-strength value,
 * and no caller may claim one moved.
 *
 * ⚠ ONE TURN PER SETTLE, AND IT IS NOT GUARDED BY A RE-ENTRY FLAG — measured. A
 * `user_action !== 'pending'` guard was written first and a mutant DELETING it left the
 * suite green: the retire write is a synchronous zustand `set`, so a surface that recomputes
 * its rows from the edges unmounts the control before a second click lands. The invariant is
 * pinned by behavioural tests instead of by unpinned code.
 *
 * ⛔ A SURFACE THAT KEEPS ITS CONTROL MOUNTED AFTER A SETTLE MUST SAY SO. `EdgePanel` is
 * exactly that case — the inspector stays open on the edge you just settled — so it reads
 * `hasSettled` below and renders its acknowledgement in place of the controls. That is why
 * this hook reports the settled state rather than leaving each caller to re-derive it.
 */

import { useCallback } from 'react'

import { useCanvasStore } from '../store'
import { useOptionalConversationContext } from './ConversationContext'
import { buildEdgeAdjudicationEvent } from './edgeAdjudication'
import type { ContestedVerdict } from './contestedVerdict'
import type { EdgeData } from '../domain/edges'
import type { ValidationMetadata } from '../domain/validation'

export interface SettleContestedEdge {
  /**
   * Null when no send is available. A caller MUST render a stated reason rather than a
   * control in that case — an affordance that terminates in silence is the defect class
   * this estate ships most often.
   */
  settle: ((edgeId: string, verdict: ContestedVerdict, resolvedMean: number | null) => void) | null
}

export function useSettleContestedEdge(): SettleContestedEdge {
  // Optional by design, as every other conversation consumer in these panels does it: a
  // missing provider degrades to a stated refusal, never a throw. Routing through the context
  // is also what puts the verdict behind `useConversation`'s deferral buffer, so one sent
  // during a running analysis is queued rather than dropped.
  const sendSystemEvent = useOptionalConversationContext()?.sendSystemEvent

  const settle = useCallback(
    (edgeId: string, verdict: ContestedVerdict, resolvedMean: number | null) => {
      if (!sendSystemEvent) return
      // Read the edge FRESH from the store. The wire event binds to its edge by from+to NODE
      // ids (`edgeAdjudication.ts`'s IDENTITY RULE), and the same read feeds the event and the
      // local write, so the two can never describe different edges.
      const edge = useCanvasStore.getState().edges.find(e => e.id === edgeId)
      if (!edge) return

      const event = buildEdgeAdjudicationEvent(
        edge,
        verdict,
        resolvedMean === null ? undefined : resolvedMean,
      )
      // The builder FAILS CLOSED on any shape the wire's cross-field rules would refuse. Null
      // means "do not emit" — never a production 422, and never a local write either: a
      // settled-looking row whose verdict never left the browser is the silent lie.
      if (!event) return

      void sendSystemEvent(event, {
        debugSource: 'settle-contested-edge',
        debugInitiatedBy: 'user',
      })

      const validation = (edge.data as { validation?: ValidationMetadata } | undefined)?.validation
      if (!validation) return

      const settledValidation: ValidationMetadata = {
        ...validation,
        user_action: verdict,
        resolved_by: 'user',
        // ⚠ A dismissal asserts NO value, by the same contract rule the builder applies.
        resolved_value:
          verdict === 'dismissed' || resolvedMean === null
            ? null
            : { strength_mean: resolvedMean },
      }

      // ⚠ ONLY `validation` IS PASSED, AND THAT IS LOAD-BEARING. `updateEdge` merges
      // `{ ...e.data, ...updates.data }`, so a partial `data` leaves every other field alone.
      //
      // ⛔ DO NOT "SIMPLIFY" THIS TO `updateEdgeData`. That helper sets `weight: undefined` and
      // `belief: undefined` EXPLICITLY whenever the caller omits them (`store.ts:3659-3667`),
      // and those explicit keys survive the spread merge — routing a validation-only update
      // through it would blank the edge's weight.
      //
      // The cast is the partial-update contract `updateEdgeData` itself documents at
      // `store.ts:3667`: `updateEdge` declares `data: EdgeData` while the implementation
      // merges partial data.
      useCanvasStore.getState().updateEdge(edgeId, {
        data: { validation: settledValidation } as EdgeData,
      })
    },
    [sendSystemEvent],
  )

  return { settle: sendSystemEvent ? settle : null }
}
