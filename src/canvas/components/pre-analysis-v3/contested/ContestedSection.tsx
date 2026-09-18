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

import { memo, useCallback, useState } from 'react'
import { Scale } from 'lucide-react'
import { typography, typo } from '../../../../styles/typography'
import { useUIStore } from '../../../../stores/uiStore'
import { useCanvasStore } from '../../../store'
import { useOptionalConversationContext } from '../../../conversation/ConversationContext'
import { buildEdgeAdjudicationEvent } from '../../../conversation/edgeAdjudication'
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
 * One contested connection. The expert detail (what the second look was based on, and its
 * own sentence) sits behind a per-row reveal, in the panel's existing reveal idiom — an
 * `aria-expanded` text button, as SharpenSection's "Show N more" uses. Conditional render
 * rather than `hidden`: PanelDisclosure's always-mounted rule exists so a section-level
 * `aria-controls` target is valid, and this row-level reveal has no such target.
 */
const ContestedRow = memo(function ContestedRow({
  row,
  onSettle,
}: {
  row: ContestedRowModel
  /** Null when no send is available — the row then explains instead of offering a dead button. */
  onSettle: ((row: ContestedRowModel, verdict: ContestedVerdict, resolvedMean: number | null) => void) | null
}) {
  const [open, setOpen] = useState(false)
  const options = contestedVerdictOptions(row)
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
                  onClick={() => onSettle(row, option.verdict, option.resolvedMean)}
                  className={typo(
                    'panelMeta',
                    'rounded border border-panel-border px-2 py-1 text-text-body outline-none transition-colors hover:bg-panel-hover focus-visible:ring-2 focus-visible:ring-info/40',
                  )}
                  data-testid={`pre-analysis-v3-contested-settle-${option.verdict}-${row.edgeId}`}
                >
                  {VERDICT_LABEL[option.verdict]}
                </button>
              ))}
            </div>
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

  /** Verdicts sent this session, newest first — the acknowledgement's only source. */
  const [settled, setSettled] = useState<string[]>([])

  const handleSettle = useCallback(
    (row: ContestedRowModel, verdict: ContestedVerdict, resolvedMean: number | null) => {
      if (!sendSystemEvent) return
      // Read the edge FRESH from the store rather than reconstructing one from the row model:
      // the wire event binds to its edge by from+to NODE ids (`edgeAdjudication.ts`'s IDENTITY
      // RULE) and the row model carries labels, not ids. The same read feeds the event and the
      // local write, so the two can never describe different edges.
      const edge = useCanvasStore.getState().edges.find(e => e.id === row.edgeId)
      if (!edge) return

      const validation = (edge.data as { validation?: ValidationMetadata } | undefined)?.validation

      // ⭐ ONE TURN PER CLICK IS LOAD-BEARING (`sendSystemEvent` is a network TURN, not a
      // fire-and-forget ping) AND IT IS NOT GUARDED HERE — DELIBERATELY, AND MEASURED.
      //
      // A `user_action !== 'pending'` re-entry guard was written here first. A mutant that
      // DELETED it left the suite fully GREEN, which is the only honest way to learn that a
      // guard is doing nothing: the retire write below is a synchronous zustand `set`, the
      // parent recomputes `rows` from the edges, and the row UNMOUNTS before a second click can
      // reach this handler. The guard could not fire on any reachable path, so it was removed
      // rather than shipped as unpinned code with a confident comment beside it.
      //
      // The INVARIANT is pinned instead, at the level a user experiences it:
      // `contestedSectionSettles.spec.tsx` clicks twice and asserts ONE send, with a live
      // sibling row proving the suite is not merely observing an unmounted button. Any future
      // change that keeps the row mounted through a settle turns that test RED, which is where
      // the decision belongs.
      const event = buildEdgeAdjudicationEvent(
        edge,
        verdict,
        resolvedMean === null ? undefined : resolvedMean,
      )
      // The builder FAILS CLOSED on any shape the wire's cross-field rules would refuse. A null
      // here means "do not emit" — never a production 422, and never a local write either: a
      // settled-looking row whose verdict never left the browser is the silent lie.
      if (!event) return

      void sendSystemEvent(event, {
        debugSource: 'pre-analysis-v3-contested',
        debugInitiatedBy: 'user',
        debugSourceSurface: 'pre-analysis',
      })

      // Retire the row through the predicate that already owns it
      // (`selectSurfacedContestedEdges:53` gates on `user_action !== 'pending'`). Validation
      // METADATA only — no weight, no weightSource, no direction.
      if (validation) {
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
        // ⚠ ONLY `validation` IS PASSED, AND THAT IS LOAD-BEARING — NOT TIDINESS.
        //
        // `updateEdge` merges `{ ...e.data, ...updates.data }`, so a partial `data` leaves every
        // other field alone. Spreading `edge.data` in here instead would widen the write to the
        // whole edge for no gain, and `edge.data` is `EdgeData | undefined` at this type, so the
        // spread also loses the required fields and fails the gate.
        //
        // ⛔ AND DO NOT "SIMPLIFY" THIS TO `updateEdgeData`. That helper sets
        // `weight: undefined` and `belief: undefined` EXPLICITLY whenever the caller omits them
        // (`store.ts:3659-3667`), and those explicit keys survive the spread merge — routing a
        // validation-only update through it would blank the edge's weight.
        //
        // The cast is the partial-update contract `updateEdgeData` itself documents at
        // `store.ts:3667`: `updateEdge` declares `data: EdgeData` while the implementation
        // merges partial data.
        useCanvasStore.getState().updateEdge(row.edgeId, {
          data: { validation: settledValidation } as EdgeData,
        })
      }

      setSettled(prev => [row.edgeId, ...prev.filter(id => id !== row.edgeId)])
    },
    [sendSystemEvent],
  )

  // ⚠ NOT `rows.length === 0` ALONE. Settling the LAST contested connection empties `rows`, and
  // returning null on that render would take the acknowledgement down with the row that earned
  // it — the user would click and see the whole section vanish with no confirmation that
  // anything was recorded. EMPTY MEANS ABSENT still holds for a session that settled nothing.
  if (rows.length === 0 && settled.length === 0) return null

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
            onSettle={sendSystemEvent ? handleSettle : null}
          />
        ))}
      </div>
      {settled.length > 0 && (
        <p
          className={`${typography.panelMeta} mt-2 text-text-light`}
          role="status"
          data-testid="pre-analysis-v3-contested-settled-ack"
        >
          {CONTESTED_COPY.settledAck}
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
