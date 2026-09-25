/**
 * ContestedSection — "Where our reviews disagree" (ROADMAP 2.376).
 *
 * CEE validates every drafted connection twice and flags the ones the two passes disagree
 * about. Those cards have been live in the Model tab for some time; this is the same fact,
 * put in front of the user on the surface they are actually standing on before they run —
 * the pre-analysis panel. It is an ADDITION to the pre-run screen, not a rescue of the Model
 * tab, which keeps its own uncapped, fully actionable list.
 *
 * ⚠⚠ "DISPLAY-ONLY" IS SUPERSEDED — THIS SECTION NOW SETTLES THE DISAGREEMENT. The paragraph
 * below is kept because its REASONING still governs what the new affordance may claim, but its
 * verdict is no longer true: the user can pick a reading here, and the verdict leaves the
 * browser as an `edge_adjudication` fact. `contestedVerdict.ts`'s header carries the measured
 * derivation (both ends of that seam were already complete and nothing connected them — the
 * emitter had ZERO product callers against a same-family contrast of TEN).
 *
 * WHAT THE ACT DOES, EXACTLY: CEE classifies `edge_adjudication` `'fact_and_commit'`, which
 * persists a typed turn fact stamped `provenance: 'user_set'` and writes NO graph. So the
 * verdict is recorded as the user's judgement and `judgement-signals.ts` stops counting the
 * connection in `contestedUnadjudicated` — and NO effect-strength value moves. That is the
 * whole claim, and `CONTESTED_COPY`'s settle strings are written to it. Changing a number is a
 * DIFFERENT question with a different, already-live verb (`edge_strength_edit`, `'mutating'`,
 * reachable from the inspector); folding the two together here would be trap 21.
 *
 * ⚠ THE ONE LOCAL WRITE IS VALIDATION METADATA, NOT A VALUE. Settling writes
 * `validation.user_action` / `resolved_by` / `resolved_value` on the edge, because
 * `selectSurfacedContestedEdges:53` already gates on `user_action !== 'pending'` — so the row
 * retires itself through the selector that owns that predicate rather than through a second
 * one written here. No `weight`, no `weightSource`, no `direction` is touched, so there is no
 * provenance laundering and no number on screen changes.
 *
 * ⛔⛔ AND THAT WRITE IS NOW GATED ON THE SETTLEMENT, BECAUSE THE ROW LEAVING IS ITSELF A CLAIM.
 * The first version of this file did `void sendSystemEvent(...)`, discarded the outcome, and
 * then retired the row and printed a success sentence UNCONDITIONALLY. `sendSystemEvent` has
 * five settlements and two of them mean the turn never happened: it THROWS on a network
 * reject, a 4xx/5xx or a parse failure (`useConversation:2245-2248`, thrown at `:5745`), and it
 * returns `SEND_BLOCKED` with NO NETWORK CALL AT ALL when the orchestrator flag is off
 * (`:5995`) or when serialisation drops the event (`:6005`). This file's own comment named that
 * harm — *"a settled-looking row whose verdict never left the browser is the silent lie"* — and
 * then guarded only the unreachable `event === null` case.
 *
 * ⭐ THE RULE IS NOT RE-DERIVED HERE. `conversation/settleSystemEventSend.ts` exists precisely
 * "so the next carrier gets the derivation by construction", after the two `edge_strength_edit`
 * `confirm_current` carriers each shipped `.catch(() => {})` and "every settlement collapsed to
 * silence, INCLUDING THE SERVER SAYING NO." This is the next carrier. It uses that module, and
 * `constants.ts` carries one sentence per settlement rather than a fourth spelling of the rule.
 *
 * ⛔ TWO HARMS, TWO PREDICATES, PLUS THE WINDOW BETWEEN THEM (CLAUDE.md traps 22b and 21).
 * `blocked`/`refused` mean the judgement is PROVABLY not with Olumi: the row STAYS, the buttons
 * stay live, and the line says so. `unverified` means it MAY be with Olumi: the row also stays,
 * but the line must NOT claim nothing was recorded, because that invites the user to answer
 * again about something already on file. And `pending` is a THIRD STATE, not the absence of the
 * other two — a settlement is always at least a microtask late, so it is the NORMAL state at
 * the instant of the press, and falling through to a success default there is exactly how the
 * unconditional claim survived. Every one of the six has its own sentence.
 *
 * ⚠ WHAT THE RETIREMENT DOES NOT PROMISE. A landed settlement retires the row FOR THIS SESSION.
 * It is not durable and the copy no longer says it is: this row's suppression reads
 * `validation.user_action`, an opaque passthrough of the producer's payload
 * (`domain/edges.ts:408-414`) rewritten at every full draft (`applyDraftResult.ts:139`) and at
 * every patch touching the connection, and `edge_adjudication` is `fact_and_commit`, which
 * writes NO graph — so the persisted connection keeps `'pending'` and the row returns on the
 * next draft, the next patch, or a reload. Olumi's own coaching DOES stop
 * (`judgement-signals.ts` joins against exactly these facts); this panel does not, and the
 * sentence the user reads is scoped to what the send did rather than to either.
 *
 * ⚠ ORIGINAL PARAGRAPH, SUPERSEDED, KEPT FOR ITS REASONING: There is no pre-analysis write path
 * to reuse: the legacy panel's contested resolve handler was deleted in the Brief 4 Task 6
 * dead-code sweep (`PreAnalysisPanel.tsx:76,1106`). The one affordance here is the EXISTING,
 * non-mutating cross-panel handoff the legacy panel already uses for exactly this destination
 * (`PreAnalysisPanel.tsx:2304`) — two ui-store calls, no graph mutation.
 *
 * ⚠⚠ AND THE CLAUSE THAT USED TO SIT IN THAT PARAGRAPH WAS FALSE, WHICH IS THE ONLY REASON
 * THIS BUTTON SHIPPED A PROMISE IT COULD NOT KEEP (derived at staging `2416ac3f`). It read:
 * *"the only live adjudication surface is the Model tab (`ModelTabBody::handleResolveContested`
 * → `RelationshipsSection` → `ContestedEdgeCard`)"*. That chain is REAL AND UNMOUNTED:
 * `<RelationshipsSection` sits inside `ModelTabBody`'s `{LEGACY_DETAILED_EDITOR_MOUNTED && (…)}`
 * block and the constant is `false`, so esbuild folds the whole stack away. Reading the call
 * site without its enclosing guard produces exactly the sentence above — the same way the
 * identical mistake was made and corrected in `ModelTabV2Panel.tsx`. **A comment that describes
 * a mount MUST name the guard, not just the call site.**
 *
 * On that false premise the CTA said "Settle these in the model tab". It now claims navigation
 * only. The ROUTE is unchanged and deliberately so: the destination shows the CAUSAL ones among
 * these relationships, marked "Two passes disagree", and their strength is editable per edge —
 * so removing the button would take away a real ability to act.
 * `contestedCtaPromiseIsHonest.spec.tsx` derives both halves and REDs if either moves.
 *
 * ⚠ "CAUSAL" IS NOT HEDGING — the destination applies `getCausalEdges` (`adapters.ts:136`) and
 * drops any edge touching a `decision` or `option` node; this section cannot apply that filter,
 * because `selectSurfacedContestedEdges` takes edges without nodes. So a row listed here may be
 * absent at the destination the button names. That divergence is pinned in both directions by
 * §2b of the spec above, and the question this repo cannot settle — whether CEE ever contests
 * such an edge — is recorded there rather than resolved by a comment.
 *
 * EMPTY MEANS ABSENT. Nothing renders when no connection is contested — no header, no "0",
 * no reassurance row. Same rule as SharpenSection.
 *
 * HIERARCHY. A single `border-t` and no static `bg-panel-hover` strip: the panel's one neutral
 * section-header strip belongs to Sharpen and its one `border-b` to the Header
 * (`hierarchyContract.spec.tsx`).
 */

import { memo, useCallback, useRef, useState } from 'react'
import { Scale } from 'lucide-react'
import { typography, typo } from '../../../../styles/typography'
import { useUIStore } from '../../../../stores/uiStore'
import { useCanvasStore } from '../../../store'
import { useOptionalConversationContext } from '../../../conversation/ConversationContext'
import { buildEdgeAdjudicationEvent } from '../../../conversation/edgeAdjudication'
import { settleSystemEventSend } from '../../../conversation/settleSystemEventSend'
import type { SystemEventSendSettlement } from '../../../conversation/settleSystemEventSend'
import { fenceRefusalCopyForCategory } from '../../../../v5/failureTypeRetryability'
import type { EdgeData } from '../../../domain/edges'
import type { ValidationMetadata } from '../../../domain/validation'
import { CONTESTED_COPY } from '../constants'
import { contestedVerdictOptions, type ContestedVerdict } from './contestedVerdict'
import type { ContestedRowModel } from '../selectors/computeContestedRows'

/** Button label per verdict. Kept beside the union so a new member fails RED at the type. */
const VERDICT_LABEL: Record<ContestedVerdict, string> = {
  accepted_pass1: CONTESTED_COPY.settlePass1,
  accepted_pass2: CONTESTED_COPY.settlePass2,
  dismissed: CONTESTED_COPY.settleUnsure,
}

/**
 * How one connection's verdict settled, as this surface knows it.
 *
 * ⭐ `'pending'` IS A MEMBER, NOT A NULL. `settleSystemEventSend` settles a promise, so a
 * settlement cannot arrive in the same tick as the press: between the two, this is the state,
 * and it is the state EVERY settle passes through. Modelling it as "no settlement yet" and
 * letting the render fall through to the success branch is the defect this file shipped.
 */
type ContestedSettleState = SystemEventSendSettlement | 'pending'

/**
 * The settlements on which the verdict has left, or is buffered to leave, the browser — and
 * therefore the only ones on which the row may retire.
 *
 * ⚠ `'sent'` IS NOT A RECEIPT. It means a POST left and the server has not answered. Retiring
 * on it is a session-scoped convenience, not a claim that Olumi holds the judgement; the
 * SENTENCE is what carries the claim, and `CONTESTED_SETTLE_STATE_COPY.sent` claims only that
 * it was sent. `'queued'` is buffered behind an in-flight turn and will go, so it retires too.
 */
function settlementLanded(settlement: ContestedSettleState): settlement is 'sent' | 'queued' {
  return settlement === 'sent' || settlement === 'queued'
}

/**
 * Retire one settled row through the predicate that already owns retirement
 * (`selectSurfacedContestedEdges:53` gates on `user_action !== 'pending'`).
 *
 * ⚠ THE EDGE IS RE-READ AT SETTLEMENT TIME, NOT CAPTURED AT PRESS TIME. A draft or a patch can
 * rewrite `validation` inside the window the send is open, and merging onto a snapshot taken
 * before the send would write back whatever that snapshot held. Identity is not at risk either
 * way — the WIRE event is built from the press-time read, so the fact and the local write can
 * still never describe different connections.
 */
function retireSettledRow(
  edgeId: string,
  verdict: ContestedVerdict,
  resolvedMean: number | null,
): void {
  const edge = useCanvasStore.getState().edges.find(e => e.id === edgeId)
  const validation = (edge?.data as { validation?: ValidationMetadata } | undefined)?.validation
  if (!validation) return
  const settledValidation: ValidationMetadata = {
    ...validation,
    user_action: verdict,
    resolved_by: 'user',
    // ⚠ A dismissal asserts NO value, by the same contract rule the builder applies.
    resolved_value:
      verdict === 'dismissed' || resolvedMean === null ? null : { strength_mean: resolvedMean },
  }
  // ⚠ ONLY `validation` IS PASSED, AND THAT IS LOAD-BEARING — NOT TIDINESS.
  //
  // `updateEdge` merges `{ ...e.data, ...updates.data }`, so a partial `data` leaves every
  // other field alone. Spreading `edge.data` in here instead would widen the write to the
  // whole edge for no gain, and `edge.data` is `EdgeData | undefined` at this type, so the
  // spread also loses the required fields and fails the gate.
  //
  // ⛔ AND DO NOT "SIMPLIFY" THIS TO `updateEdgeData`. That helper sets `weight: undefined` and
  // `belief: undefined` EXPLICITLY whenever the caller omits them (`store.ts:3659-3667`), and
  // those explicit keys survive the spread merge — routing a validation-only update through it
  // would blank the edge's weight.
  //
  // The cast is the partial-update contract `updateEdgeData` itself documents at
  // `store.ts:3667`: `updateEdge` declares `data: EdgeData` while the implementation merges
  // partial data.
  useCanvasStore.getState().updateEdge(edgeId, {
    data: { validation: settledValidation } as EdgeData,
  })
}

/**
 * One contested connection. The expert detail (what the second look was based on, and its
 * own sentence) sits behind a per-row reveal, in the panel's existing reveal idiom — an
 * `aria-expanded` text button, as SharpenSection's "Show N more" uses. Conditional render
 * rather than `hidden`: PanelDisclosure's always-mounted rule exists so a section-level
 * `aria-controls` target is valid, and this row-level reveal has no such target.
 */
const ContestedRow = memo(function ContestedRow({
  row,
  settleState,
  refusalCopy,
  onSettle,
}: {
  row: ContestedRowModel
  /**
   * The turn fence's own sentence when a `refused` settlement was a STOPPED or SUPERSEDED turn
   * (CEE #1868) — "Olumi did not take this judgement" is false about a turn the user stopped.
   */
  refusalCopy?: string | null
  /**
   * How this row's verdict settled, or `undefined` when none has been sent this session.
   *
   * ⚠ `undefined` AND `'pending'` ARE DIFFERENT FACTS and the render must not merge them:
   * `undefined` means the user has not acted, `'pending'` means they have and the answer has
   * not arrived. Only the second earns a sentence.
   */
  settleState?: ContestedSettleState
  /** Null when no send is available — the row then explains instead of offering a dead button. */
  onSettle: ((row: ContestedRowModel, verdict: ContestedVerdict, resolvedMean: number | null) => void) | null
}) {
  const [open, setOpen] = useState(false)
  const options = contestedVerdictOptions(row)
  const isPending = settleState === 'pending'
  /**
   * ⚠ A LANDED SETTLEMENT HAS NO ROW LINE, because a landed settlement normally has no ROW: the
   * retire unmounts it and the section-level acknowledgement carries the sentence. What is left
   * here is exactly the set of reasons the user is still looking at this connection — the send
   * is in flight, or it did not land, or it cannot be shown to have landed.
   */
  const settleLine =
    settleState !== undefined && !settlementLanded(settleState)
      ? (settleState === 'refused' && refusalCopy ? refusalCopy : CONTESTED_COPY.settleState[settleState])
      : null
  return (
    <div
      className="grid grid-cols-[16px_1fr] items-start gap-2 border-t border-panel-border py-2 first:border-t-0"
      data-testid={`pre-analysis-v3-contested-row-${row.edgeId}`}
      data-contested-edge-id={row.edgeId}
    >
      <Scale className="mt-0.5 h-3.5 w-3.5 flex-none text-text-light" aria-hidden />
      <div className="min-w-0">
        <p className={`${typography.panelBody} text-text-body`}>
          {CONTESTED_COPY.rowLeadIn}{' '}
          {/* Shared graph labels render VERBATIM — the panel never rewrites them. */}
          <span className="font-semibold text-text-header">{row.sourceLabel}</span>{' '}
          {CONTESTED_COPY.rowConnective}{' '}
          <span className="font-semibold text-text-header">{row.targetLabel}</span>
        </p>
        {row.reasons.map(reason => (
          <p key={reason} className={`${typography.panelMeta} text-text-light`}>
            {reason}
          </p>
        ))}
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(v => !v)}
          className={typo(
            'panelMeta',
            'mt-1 rounded text-info outline-none transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-info/40',
          )}
          data-testid={`pre-analysis-v3-contested-detail-${row.edgeId}`}
        >
          {open ? CONTESTED_COPY.hideDetail : CONTESTED_COPY.showDetail}
        </button>
        {open && (
          <div className="mt-1 space-y-0.5">
            <p className={`${typography.panelMeta} text-text-light`}>{row.basis}</p>
            {row.reasoning && (
              <p className={`${typography.panelMeta} text-text-light`}>{row.reasoning}</p>
            )}
          </div>
        )}
        {/*
          THE ACT. Rendered only where the verdict can actually leave the browser: with no
          send, a button here would record nothing and say nothing, which is the advertised-
          action-terminating-in-silence pattern this estate keeps paying for. The sentence
          takes its place instead.
        */}
        {onSettle === null ? (
          <p
            className={`${typography.panelMeta} mt-1.5 text-text-light`}
            data-testid={`pre-analysis-v3-contested-settle-unavailable-${row.edgeId}`}
          >
            {CONTESTED_COPY.settleUnavailable}
          </p>
        ) : (
          <div className="mt-1.5">
            <p className={`${typography.panelMeta} text-text-light`} id={`contested-settle-${row.edgeId}`}>
              {CONTESTED_COPY.settlePrompt}
            </p>
            <div
              className="mt-1 flex flex-wrap gap-1.5"
              role="group"
              aria-labelledby={`contested-settle-${row.edgeId}`}
            >
              {options.map(option => (
                <button
                  key={option.verdict}
                  type="button"
                  // ⚠ DISABLED WHILE IN FLIGHT, NOT REMOVED. A control that vanishes and returns
                  // reads as a failure of the app; one that is visibly unavailable while the
                  // sentence beneath it says why reads as the app doing what it was told. The
                  // re-entry latch in `handleSettle` is what ENFORCES one turn per press — this
                  // attribute only shows it.
                  disabled={isPending}
                  onClick={() => onSettle(row, option.verdict, option.resolvedMean)}
                  className={typo(
                    'panelMeta',
                    'rounded border border-panel-border px-2 py-1 text-text-body outline-none transition-colors hover:bg-panel-hover focus-visible:ring-2 focus-visible:ring-info/40 disabled:cursor-not-allowed disabled:opacity-40',
                  )}
                  data-testid={`pre-analysis-v3-contested-settle-${option.verdict}-${row.edgeId}`}
                >
                  {VERDICT_LABEL[option.verdict]}
                </button>
              ))}
            </div>
            {/*
              ⛔ THE SENTENCE THE USER READS AFTER THEY ACT, AND IT IS THE SETTLEMENT'S, NOT A
              DEFAULT. A row is only still mounted here because its verdict did NOT land
              (`blocked`/`refused`), because we cannot show that it did (`unverified`), or
              because the answer has not arrived yet (`pending`). `role="status"` because the
              text changes asynchronously under a control the user just pressed.

              `data-settlement` is the IDENTITY the spec binds to (CLAUDE.md trap 19) — a text
              predicate would let a neighbouring row's sentence satisfy the assertion.
            */}
            {settleLine !== null && (
              <p
                className={`${typography.panelMeta} mt-1.5 text-text-light`}
                role="status"
                data-testid={`pre-analysis-v3-contested-settle-state-${row.edgeId}`}
                data-settlement={settleState}
              >
                {settleLine}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
})

export const ContestedSection = memo(function ContestedSection({
  rows,
}: {
  rows: ContestedRowModel[]
}) {
  // The established pre-analysis → Model tab handoff (PreAnalysisPanel.tsx:2304). Navigation
  // only: it asks the Model tab to open its relationships section and activates that tab.
  // Nothing here writes graph data.
  const openInModelTab = useCallback(() => {
    useUIStore.getState().requestModelTabSection('relationships')
    useUIStore.getState().setActiveOutputTab('diagnostics')
  }, [])

  /**
   * Optional by design, exactly as `CalibrateDrillIn` and `FactorControllablePanel` do it in
   * this same panel: a missing provider must degrade to a stated refusal, never throw. It is
   * also what puts the verdict behind `useConversation`'s deferral buffer, so one sent during
   * a running analysis is queued rather than dropped.
   */
  const sendSystemEvent = useOptionalConversationContext()?.sendSystemEvent

  /**
   * ⭐ THE RE-ENTRY LATCH IS BACK, AND THIS TIME IT IS REACHABLE — which is why the measurement
   * that removed it was right AT THE TIME and is wrong now. A mutant deleting the old guard
   * left the suite green because the retire write was SYNCHRONOUS: the row unmounted before a
   * second click could reach the handler, so the guard could not fire on any path. The retire
   * is now gated on the settlement, so the row stays mounted for the whole in-flight window and
   * a second press WOULD send a second network turn. `contestedSectionSettles.spec.tsx`'s
   * double-click case now bites this latch rather than an unmount.
   *
   * A ref, not state: it is a correctness latch read inside an async callback, and state would
   * hand `handleSettle` a stale closure of itself. The rendered half is `settleState` below.
   */
  const inFlight = useRef<Set<string>>(new Set())

  /** How each connection's verdict settled. Absent = never pressed. */
  const [settleState, setSettleState] = useState<Record<string, ContestedSettleState>>({})
  const [refusalCopy, setRefusalCopy] = useState<Record<string, string | null>>({})

  /**
   * Verdicts that LEFT the browser this session, newest first — the acknowledgement's only
   * source. A settlement that did not land never reaches this list, so the acknowledgement
   * cannot appear for a verdict that never went.
   */
  const [landed, setLanded] = useState<Array<{ edgeId: string; settlement: 'sent' | 'queued' }>>([])

  const handleSettle = useCallback(
    (row: ContestedRowModel, verdict: ContestedVerdict, resolvedMean: number | null) => {
      if (!sendSystemEvent) return
      // ⭐ ONE TURN PER PRESS IS LOAD-BEARING — `sendSystemEvent` is a network TURN, not a
      // fire-and-forget ping. See the latch's declaration for why it is reachable now and was
      // not before.
      if (inFlight.current.has(row.edgeId)) return
      // Read the edge FRESH from the store rather than reconstructing one from the row model:
      // the wire event binds to its edge by from+to NODE ids (`edgeAdjudication.ts`'s IDENTITY
      // RULE) and the row model carries labels, not ids.
      const edge = useCanvasStore.getState().edges.find(e => e.id === row.edgeId)
      if (!edge) return

      const event = buildEdgeAdjudicationEvent(
        edge,
        verdict,
        resolvedMean === null ? undefined : resolvedMean,
      )
      // The builder FAILS CLOSED on any shape the wire's cross-field rules would refuse. A null
      // here means "do not emit" — never a production 422, and never a local write either: a
      // settled-looking row whose verdict never left the browser is the silent lie.
      if (!event) return

      inFlight.current.add(row.edgeId)
      // ⛔ THE PENDING STATE IS SET BEFORE THE SEND, NOT AFTER IT. Setting it in the settlement
      // callback would leave the press with no rendered consequence for the whole window the
      // change exists to describe.
      setSettleState(prev => ({ ...prev, [row.edgeId]: 'pending' }))

      /**
       * ⛔⛔ THE OUTCOME IS NOT DISCARDED, AND THE RULE IS NOT RE-DERIVED.
       * `settleSystemEventSend` owns the five settlements and the `refused`/`unverified` split
       * (it asks `isProvenNoWriteConflict`, the one authority for "did the producer state it
       * wrote nothing?"). Deciding any of that here would be the third spelling of one rule,
       * which is what that module was extracted to stop.
       */
      settleSystemEventSend(
        sendSystemEvent(event, {
          debugSource: 'pre-analysis-v3-contested',
          debugInitiatedBy: 'user',
          debugSourceSurface: 'pre-analysis',
        }),
        (settlement, detail) => {
          setSettleState(prev => ({ ...prev, [row.edgeId]: settlement }))
          setRefusalCopy(prev => ({
            ...prev,
            [row.edgeId]: settlement === 'refused' ? fenceRefusalCopyForCategory(detail.conflictCategory) : null,
          }))
          // ⭐ THE LATCH GUARDS THE IN-FLIGHT WINDOW AND NOTHING WIDER, SO IT RELEASES ON EVERY
          // SETTLEMENT. Holding it shut afterwards looks tidier and is worse: this row is
          // re-raised by the producer at the next draft or patch (see the header), and a
          // re-raised question the user cannot answer is a dead control, which is the harm this
          // whole surface exists to remove. On the failure settlements the retry is the POINT of
          // telling them; `unverified` releases too, because refusing a retry there would be the
          // opposite lie to the one being fixed.
          inFlight.current.delete(row.edgeId)
          if (!settlementLanded(settlement)) {
            // NOT RECORDED, or NOT SHOWN TO BE RECORDED. The row stays, un-retired, and says so.
            return
          }
          // ⚠ RESIDUAL, DISCLOSED RATHER THAN GUARDED (the reviewer's call, and it is right):
          // `retireSettledRow` is a no-op for an edge the store holds with no `validation`, so
          // such a row would stay mounted after a landed send and a second press would send a
          // second turn. Unreachable today — rows exist only for validated connections, which is
          // what `selectSurfacedContestedEdges` selects on. A guard here would be unpinnable
          // code with a confident comment beside it, which is what the removed re-entry guard
          // already taught this file.
          retireSettledRow(row.edgeId, verdict, resolvedMean)
          setLanded(prev => [
            { edgeId: row.edgeId, settlement },
            ...prev.filter(entry => entry.edgeId !== row.edgeId),
          ])
        },
      )
    },
    [sendSystemEvent],
  )

  // ⚠ NOT `rows.length === 0` ALONE. Settling the LAST contested connection empties `rows`, and
  // returning null on that render would take the acknowledgement down with the row that earned
  // it — the user would click and see the whole section vanish with no confirmation that
  // anything was sent. EMPTY MEANS ABSENT still holds for a session that settled nothing.
  if (rows.length === 0 && landed.length === 0) return null

  return (
    <div className="border-t border-panel-border px-4 py-4" data-testid="pre-analysis-v3-contested">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h2 className={`${typography.panelHeader} text-text-header`}>{CONTESTED_COPY.title}</h2>
        {/*
          The count and the lead describe a list of OPEN disagreements. With none left they
          would read "0 connections" under "the two looks did not agree here" — a header
          describing rows that are not there. They go with the rows; the acknowledgement stays.
        */}
        {rows.length > 0 && (
          <span className={`${typography.panelMeta} flex-none text-text-light`}>
            {CONTESTED_COPY.meta(rows.length)}
          </span>
        )}
      </div>
      {rows.length > 0 && (
        <p className={`${typography.panelMeta} mb-2 text-text-light`}>{CONTESTED_COPY.lead}</p>
      )}
      <div>
        {rows.map(row => (
          <ContestedRow
            key={row.edgeId}
            row={row}
            settleState={settleState[row.edgeId]}
            refusalCopy={refusalCopy[row.edgeId]}
            onSettle={sendSystemEvent ? handleSettle : null}
          />
        ))}
      </div>
      {/*
        ⛔ THE ACKNOWLEDGEMENT IS THE SETTLEMENT'S SENTENCE, AND IT EXISTS ONLY FOR VERDICTS THAT
        LEFT. `landed` is appended to inside the settlement callback and only for `sent`/
        `queued`, so there is no path on which this renders for a send that was refused, never
        left, or cannot be shown to have left — those stay on their own row, which stays.

        ⚠ IT SPEAKS FOR THE MOST RECENT LANDED VERDICT, not for all of them: `sent` and `queued`
        are different facts and one line cannot be true of both at once. Newest-first is the
        order the list is built in, so `landed[0]` is the one the user just earned.
      */}
      {landed.length > 0 && (
        <p
          className={`${typography.panelMeta} mt-2 text-text-light`}
          role="status"
          data-testid="pre-analysis-v3-contested-settled-ack"
          data-settlement={landed[0].settlement}
        >
          {CONTESTED_COPY.settleState[landed[0].settlement]}
        </p>
      )}
      {/*
        NAVIGATION ONLY, and it goes when the list does: its destination shows the CAUSAL
        contested relationships, so with none left it would promise a populated screen that is
        empty. `contestedCtaPromiseIsHonest.spec.tsx` owns the promise; this owns its presence.
      */}
      {rows.length > 0 && (
        <button
          type="button"
          onClick={openInModelTab}
          className={typo(
            'panelMeta',
            'mt-2 inline-flex items-center gap-1 self-start rounded text-info outline-none hover:underline focus-visible:ring-2 focus-visible:ring-info/40',
          )}
          data-testid="pre-analysis-v3-contested-review"
        >
          {CONTESTED_COPY.reviewCta} ›
        </button>
      )}
    </div>
  )
})
