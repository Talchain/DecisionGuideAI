/**
 * StrengthenContainer — the ONE store-aware mount wrapper for the Strengthen
 * panel (mounted exclusively by ResultsBody behind
 * VITE_FEATURE_STRENGTHEN_PANEL, replacing FocusNow inside the flag; the
 * panel itself is store-free).
 *
 * Responsibilities:
 * - map the results data + guidance items into the narrow engine inputs
 *   (including the producer worth_investigating flag threaded through the
 *   drivers VM, the producer-owned CEE bias signals for the broaden gate,
 *   and the producer stage signal for adaptive priority — UI-SEM-076);
 * - run buildRecommendations and reconcile the lifecycle store on each
 *   COMPLETED analysis (keyed by the results hash — reconcile-by-id, so a
 *   new response never resets progress);
 * - credit the success-measure rec DIRECTLY when the user sets a success
 *   target (goalThreshold null → number) instead of waiting for the next
 *   completed-analysis reconcile — a failed/cancelled rerun otherwise
 *   leaves a stale "Define what success looks like" row;
 * - label everything stale when the model changes (visible-but-stale: this
 *   panel deliberately keeps rendering snapshots the fail-stale guidance
 *   eviction would drop, per plan §3 — the freshness strip stays the tab's
 *   single freshness OWNER; the per-rec label is detail, not a verdict);
 * - route actions per §8.8, reading callbacks at CLICK time (they start
 *   null and go transiently null across host remounts). Two DISTINCT routes
 *   per the prototype: the PRIMARY action does the thing (ai-dialogue via
 *   _dispatchAction with an EXPLICIT action_type, degrading to _sendMessage
 *   with a DEV warn; canvas focus via the fail-closed focusModelTarget) and
 *   marks the rec in progress on success; "Work through this with Olumi"
 *   opens the Ask-Olumi drawer PREFILLED (never auto-sends, never mutates
 *   status — the drawer owns dispatch/degrade/toasts).
 * - suppress any panel-local freshness banner (AnalysisFreshnessNotice owns
 *   the tab's freshness surface — same contract as FocusNowContainer).
 */
import { useEffect, useMemo, useRef } from 'react'
import { leaderDesignationPermitted } from '../leaderDesignation'
import { useCanvasStore } from '../../../canvas/store'
import { useGuidanceStore } from '../../../canvas/stores/guidanceStore'
import {
  selectActive,
  selectHistory,
  useStrengthenStore,
  type RecRecord,
} from '../../../canvas/stores/strengthenStore'
import { focusModelTarget } from '../../../canvas/utils/focusHelpers'
import { attentionNoteForRecommendation } from './recommendationAttention'
import { useShowToastSafe } from '../../../canvas/ToastContext'
import { openDefineSuccess, openDecisionRecord, useDecisionRecordForScenario } from '../modals'
import { openAskOlumi } from '../coaching/askOlumiStore'
import { buildRecommendations, toStrengthenPhase3Item } from './buildRecommendations'
import { mergeBiasFindingTypes } from './biasTypesFromGuidance'
import { STRENGTHEN_COPY as COPY } from './strengthenCopy'
import type { HelpType, StrengthenInputs } from './strengthenTypes'
import { StrengthenPanel } from './StrengthenPanel'
import { resolveFactorConfidenceDisplay } from '../driverConfidenceDisplayPolicy'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import type { ScenarioStage } from '../../../types/scenario'
import { CANONICAL_EDIT_AUTHORITY, hasServerGraphAuthority } from '../../../canvas/mutations/mutationAuthority'

/**
 * UI-SEM-076: producer stage → strengthen adaptive-priority taxonomy bridge.
 * The orchestrator's stage_indicator (ScenarioStage, stored producer-side in
 * canvas currentStage) is mapped onto the strengthen help-type taxonomy so
 * matching recommendations float to the top — ordering only, never a gate
 * and never fabricated from local canvas state (a null stage leaves the
 * deterministic engine ladder untouched). 'optimise' has no strengthen
 * equivalent and maps to null. Remove when CEE ships a canonical
 * strengthen-priority signal on the wire.
 */
export function adaptivePriorityFromStage(stage: ScenarioStage | null): HelpType | null {
  switch (stage) {
    case 'frame': return 'clarify'
    case 'ideate': return 'broaden'
    case 'evaluate': return 'evaluate'
    case 'decide': return 'commit'
    default: return null
  }
}

export interface StrengthenContainerProps {
  data: ResultsSectionDataReturn
}

export function StrengthenContainer({ data }: StrengthenContainerProps) {
  // L-10: the primary CTA's failure arm has to be able to SAY something.
  const showToast = useShowToastSafe()
  const resultsHash = useCanvasStore((s) => s.results.hash ?? null)
  const freshnessDirty = useCanvasStore((s) => s.analysisFreshnessDirty === true)
  const currentStage = useCanvasStore((s) => s.currentStage)
  const biasSignals = useCanvasStore((s) => s.draftCoaching?.biasSignals ?? null)
  const guidanceItems = useGuidanceStore((s) => s.guidanceItems)

  const records = useStrengthenStore((s) => s.records)
  const priorityOrder = useStrengthenStore((s) => s.priorityOrder)
  const active = useMemo(() => selectActive({ records, priorityOrder }), [records, priorityOrder])
  const history = useMemo(() => selectHistory({ records, priorityOrder }), [records, priorityOrder])
  const addressedCount = useMemo(
    () => Object.values(records).filter((r) => r.status === 'addressed').length,
    [records],
  )

  const inputs: StrengthenInputs = useMemo(() => {
    const fragile = (data.confidence.challengeFragileEdges ?? []) as Array<Record<string, unknown>>
    const phase3Items = guidanceItems.map(toStrengthenPhase3Item)
    return {
      goalThreshold: data.recommendation.goalThreshold ?? null,
      hasStatedGoalTarget: data.recommendation.hasGoalTarget,
      analysisComplete: data.recommendation.analysisStatus === 'computed',
      // ROADMAP 1.243: the OWNED leader entitlement, quoted from the single
      // verdict (`deriveDecisionVerdict`, the same instance the canvas and the
      // option cards read) and never re-derived. `analysisComplete` above is a
      // lifecycle fact, not an entitlement — the engine needs both, separately.
      // Undefined when a legacy caller supplies no verdict; the engine's read
      // is strict (`=== false`), so only an explicit withheld claim suppresses.
      hasLeadingOption: leaderDesignationPermitted(data.recommendation),
      // Presence branch (schemas 0.30.0; UI half of plot-lite-service#294):
      // only a MEASURED switch_probability may feed the engine's rendered
      // "% chance the result flips" claim and the switch_probability wire
      // param. marginal_switch_probability is a DIFFERENT Monte Carlo
      // (P(flip | only this edge varies)) and was previously PREFERRED here —
      // a mislabel whenever both quantities arrived. An unmeasured edge
      // produces no flip recommendation (absence renders nothing).
      flipThresholds: data.recommendation.flipThresholds ?? null,
      fragileEdges: fragile
        .filter((fe) => typeof fe.switch_probability === 'number')
        .map((fe) => ({
          edgeId: String(fe.edge_id ?? `${fe.from_id ?? fe.from_label}->${fe.to_label}`),
          factorLabel: String(fe.from_label ?? 'this factor'),
          switchProbability: Number(fe.switch_probability),
          alternativeWinnerLabel:
            typeof fe.alternative_winner_label === 'string' ? fe.alternative_winner_label : undefined,
        })),
      factors: data.drivers.drivers.map((d) => ({
        factorId: d.matchedNodeId ?? d.factorKey,
        label: d.factorLabel,
        // Lane 2 (policy): the engine ranks/gates on the SAME display value
        // the panel bars show — displayInfluence is stamped by
        // selectDriverDisplayModel; raw influenceScore only as legacy
        // fallback (runtime-dead, fixture-only).
        influence: d.displayInfluence ?? d.influenceScore,
        // Resolved once, here, through THE policy module — the engine never
        // sees the raw producer number (see StrengthenFactor.confidenceDisplay).
        confidenceDisplay: resolveFactorConfidenceDisplay({
          confidence: d.confidence,
          isDefaulted: d.isDefaultedConfidence,
          confidenceProvenance: d.confidenceProvenance,
        }),
        // Producer flag threaded through the drivers VM (factor_sensitivity
        // row or robustness VOI suggestion joined by factor id) — strict
        // explicit-true read, so the engine's source line stays honest.
        worthInvestigating: d.worthInvestigating === true,
        canFocus: d.canFocus,
      })),
      robustness: {
        status: data.confidence.robustnessStatus ?? null,
        level: data.confidence.robustnessLevel ?? null,
      },
      // Producer-owned bias findings only (§19) — never local option counting.
      // ⭐ BOTH producer channels, unioned: CEE draft-coaching `bias_signals`
      // AND the phase-3 bias-signal cards. `draftCoaching` is NULL on the
      // re-draft path (measured on deployed `cffe418d`), so the draft channel
      // alone left this empty while the producer's own "Narrow framing" card
      // was on screen. See `biasTypesFromGuidance.ts`.
      biasFindingTypes: mergeBiasFindingTypes(biasSignals, phase3Items),
      // Producer stage signal → adaptive priority (UI-SEM-076, ordering only).
      adaptivePriority: adaptivePriorityFromStage(currentStage),
      // UI-SEM-085 (narrowed): the shared mapper carries the producer's
      // `priority_rank` VERBATIM (ascending, unbounded, presence =
      // producer-ranked) — the historic `100 - priority` re-inversion here
      // is what collapsed the coaching band. Never reintroduce a local map.
      phase3Items,
    }
  }, [data, guidanceItems, biasSignals, currentStage])

  // Reconcile on each COMPLETED analysis (identified by the results hash).
  useEffect(() => {
    if (!inputs.analysisComplete && inputs.goalThreshold != null) return
    const { reconcile } = useStrengthenStore.getState()
    reconcile(buildRecommendations(inputs), resultsHash ?? 'no-analysis')
  }, [inputs, resultsHash])

  // Setting a success target credits the success-measure rec DIRECTLY —
  // never wait for the next completed-analysis reconcile (a failed or
  // cancelled rerun would otherwise leave the contradiction visible).
  const prevGoalThresholdRef = useRef<number | null>(inputs.goalThreshold)
  useEffect(() => {
    const prev = prevGoalThresholdRef.current
    prevGoalThresholdRef.current = inputs.goalThreshold
    if (prev != null || inputs.goalThreshold == null) return
    const record = useStrengthenStore.getState().records['strengthen:success-measure']
    if (
      record &&
      (record.status === 'recommended' || record.status === 'in_progress' || record.status === 'reopened')
    ) {
      useStrengthenStore.getState().markAddressed('strengthen:success-measure', 'success target set')
    }
  }, [inputs.goalThreshold])

  // The model changed since the last completed analysis: label, never evict.
  useEffect(() => {
    if (freshnessDirty) useStrengthenStore.getState().markAllStale()
  }, [freshnessDirty])

  // A captured decision record credits the commit rec — same direct-credit
  // pattern as the success-measure threshold effect above.
  const currentScenarioId = useCanvasStore((s) => s.currentScenarioId)
  const decisionRecord = useDecisionRecordForScenario(currentScenarioId)
  useEffect(() => {
    if (!decisionRecord) return
    const record = useStrengthenStore.getState().records['strengthen:commit']
    if (
      record &&
      (record.status === 'recommended' || record.status === 'in_progress' || record.status === 'reopened')
    ) {
      useStrengthenStore.getState().markAddressed('strengthen:commit', 'decision recorded')
    }
  }, [decisionRecord])

  // ── §8.8 routing (callbacks read at CLICK time; degrade, never dead-end) ──
  const dispatchAiDialogue = (record: RecRecord) => {
    const rec = record.snapshot
    const { _dispatchAction, _sendMessage } = useGuidanceStore.getState()
    if (_dispatchAction) {
      _dispatchAction({
        action_type: rec.action.actionType, // explicit — never the keyword heuristic
        parameters: rec.action.parameters,
        label: rec.action.label,
        message: rec.action.prompt ?? rec.title,
        source: 'strengthen_panel',
      })
    } else if (_sendMessage) {
      if (import.meta.env.DEV) console.warn('[Strengthen] dispatchAction unregistered — degrading to sendMessage')
      _sendMessage(rec.action.prompt ?? rec.title)
    } else {
      if (import.meta.env.DEV) console.warn('[Strengthen] no conversation callbacks registered — action dropped')
      return false
    }
    return true
  }

  const onPrimaryAction = (record: RecRecord) => {
    const rec = record.snapshot
    let ok = false
    if (rec.action.kind === 'open-modal') {
      if (rec.action.modal === 'define-success') {
        if (hasServerGraphAuthority(CANONICAL_EDIT_AUTHORITY.goalSuccessTarget)) {
          openDefineSuccess()
        } else {
          // Keep the coaching action useful without opening the local-only
          // success editor: hand the user into an editable Olumi draft. No
          // graph claim or mutation happens until they explicitly send it.
          openAskOlumi({
            context: rec.whyNow,
            draft: COPY.workThroughDraft(rec.title),
            label: rec.title,
            targetId: rec.targetId ?? undefined,
            parameters: rec.action.parameters,
            source: 'chip',
          })
        }
        ok = true
      } else if (rec.action.modal === 'decision-record') {
        openDecisionRecord()
        ok = true
      }
    } else if (rec.action.kind === 'ai-dialogue') {
      ok = dispatchAiDialogue(record)
    } else if (rec.action.kind === 'canvas-focus' && rec.targetId) {
      // The camera arriving somewhere is not an explanation. Both of these
      // routes send the user to an element BECAUSE of something the engine
      // found, and the finding is already in hand — so it travels with them
      // and is held beside the element instead of being left behind in the
      // panel they just navigated away from.
      ok = focusModelTarget(rec.targetId, attentionNoteForRecommendation(rec))
    } else if (rec.action.kind === 'inline-edit' && rec.targetId) {
      ok = focusModelTarget(rec.targetId, attentionNoteForRecommendation(rec))
    }
    // §8.8: close only after the action genuinely succeeds — a successful
    // dispatch marks IN PROGRESS (the user confirms addressed themselves).
    if (ok) {
      useStrengthenStore.getState().markInProgress(record.id)
      return
    }
    // ⭐ L-10 FIX: the failure arm was SILENT. Every `ok === false` path here
    // — no conversation callbacks registered, a focus target that no longer
    // exists, an `open-modal` action with no modal — dropped the click with a
    // `console.warn` that `import.meta.env.DEV` compiles OUT of the production
    // bundle. The user pressed a primary CTA and the product did nothing, said
    // nothing, and changed nothing: indistinguishable from a broken build.
    //
    // Telling them is the whole fix. We deliberately do NOT invent a
    // recovery, mark the record, or retry: we do not know why the seam was
    // unavailable, and a fabricated "we've queued it" would be worse than the
    // silence. (`useShowToastSafe` is a no-op outside a ToastProvider, so this
    // cannot throw in a test or a stray mount.)
    showToast("That didn't go through. Open the Olumi conversation and ask there.")
  }

  // Prototype route (b): the ✦ ask hands the rec to the Ask-Olumi drawer
  // PREFILLED — context is the why-line (prototype asymmetry: the primary
  // sends the tip, the ask passes the why; for phase-3 recs the why-line IS
  // the producer's finding body verbatim, never a boilerplate line), the
  // draft is editable, nothing auto-sends, and the rec status is NOT mutated
  // (the user may abandon the conversation). The drawer owns dispatch,
  // degrade and toasts.
  const onWorkThrough = (record: RecRecord) => {
    const rec = record.snapshot
    openAskOlumi({
      context: rec.whyNow,
      draft: COPY.workThroughDraft(rec.title),
      label: rec.title,
      targetId: rec.targetId ?? undefined,
      parameters: rec.action.parameters,
      source: 'chip',
      /*
       * ⭐ THE FINDING TRAVELS ONE HOP FURTHER THAN IT USED TO.
       *
       * The two `canvas-focus` routes above already hold the element under
       * attention with this note. The ask route did not: it handed the drawer
       * the why-line as prose, and if the user then pressed "Focus on canvas"
       * the camera moved and the finding stayed behind in the drawer. Same
       * recommendation, same producer text, two different outcomes depending
       * on which door was taken.
       *
       * Built HERE because this is where the producer data is. The drawer
       * receives no `helpType` and so cannot derive the `move` honestly;
       * `attentionNoteForRecommendation` returns null when there is nothing
       * honest to say, and a null note is exactly the old behaviour.
       */
      attentionNote: attentionNoteForRecommendation(rec),
    })
  }

  const onFocusCanvas = (record: RecRecord): boolean => {
    if (!record.snapshot.targetId) return false
    return focusModelTarget(
      record.snapshot.targetId,
      attentionNoteForRecommendation(record.snapshot),
    )
  }

  const onNotRelevant = (record: RecRecord) => {
    useStrengthenStore.getState().dismiss(record.id)
  }

  const onUndoDismiss = (record: RecRecord) => {
    useStrengthenStore.getState().restoreDismissed(record.id)
  }

  const onMarkAddressed = (record: RecRecord) => {
    useStrengthenStore.getState().markAddressed(record.id)
  }

  return (
    <StrengthenPanel
      active={active}
      history={history}
      addressedCount={addressedCount}
      onPrimaryAction={onPrimaryAction}
      onWorkThrough={onWorkThrough}
      onFocusCanvas={onFocusCanvas}
      onNotRelevant={onNotRelevant}
      onMarkAddressed={onMarkAddressed}
      onUndoDismiss={onUndoDismiss}
    />
  )
}
