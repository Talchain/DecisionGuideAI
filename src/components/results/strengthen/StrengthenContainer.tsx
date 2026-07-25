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
import { useCanvasStore } from '../../../canvas/store'
import { useGuidanceStore } from '../../../canvas/stores/guidanceStore'
import {
  selectActive,
  selectHistory,
  useStrengthenStore,
  type RecRecord,
} from '../../../canvas/stores/strengthenStore'
import { focusModelTarget } from '../../../canvas/utils/focusHelpers'
import { openDefineSuccess, openDecisionRecord, useDecisionRecordForScenario } from '../modals'
import { openAskOlumi } from '../coaching/askOlumiStore'
import { buildRecommendations, toStrengthenPhase3Item } from './buildRecommendations'
import { STRENGTHEN_COPY as COPY } from './strengthenCopy'
import type { HelpType, StrengthenInputs } from './strengthenTypes'
import { StrengthenPanel } from './StrengthenPanel'
import { resolveFactorConfidenceDisplay } from '../driverConfidenceDisplayPolicy'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import type { ScenarioStage } from '../../../types/scenario'

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
    return {
      goalThreshold: data.recommendation.goalThreshold ?? null,
      analysisComplete: data.recommendation.analysisStatus === 'computed',
      fragileEdges: fragile
        .filter((fe) => typeof (fe.marginal_switch_probability ?? fe.switch_probability) === 'number')
        .map((fe) => ({
          edgeId: String(fe.edge_id ?? `${fe.from_id ?? fe.from_label}->${fe.to_label}`),
          factorLabel: String(fe.from_label ?? 'this factor'),
          switchProbability: Number(fe.marginal_switch_probability ?? fe.switch_probability),
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
      // Producer-owned bias findings only (§19): CEE draft-coaching
      // bias_signals (e.g. 'narrow_framing'), verbatim types — never local
      // option counting. Empty until CEE sends the signal (fail-closed).
      biasFindingTypes: (biasSignals ?? []).map((b) => b.type),
      // Producer stage signal → adaptive priority (UI-SEM-076, ordering only).
      adaptivePriority: adaptivePriorityFromStage(currentStage),
      // UI-SEM-085 (narrowed): the shared mapper carries the producer's
      // `priority_rank` VERBATIM (ascending, unbounded, presence =
      // producer-ranked) — the historic `100 - priority` re-inversion here
      // is what collapsed the coaching band. Never reintroduce a local map.
      phase3Items: guidanceItems.map(toStrengthenPhase3Item),
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
      if (rec.action.modal === 'define-success') openDefineSuccess()
      else if (rec.action.modal === 'decision-record') openDecisionRecord()
      ok = rec.action.modal != null
    } else if (rec.action.kind === 'ai-dialogue') {
      ok = dispatchAiDialogue(record)
    } else if (rec.action.kind === 'canvas-focus' && rec.targetId) {
      ok = focusModelTarget(rec.targetId)
    } else if (rec.action.kind === 'inline-edit' && rec.targetId) {
      ok = focusModelTarget(rec.targetId)
    }
    // §8.8: close only after the action genuinely succeeds — a successful
    // dispatch marks IN PROGRESS (the user confirms addressed themselves).
    if (ok) useStrengthenStore.getState().markInProgress(record.id)
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
    })
  }

  const onFocusCanvas = (record: RecRecord): boolean => {
    if (!record.snapshot.targetId) return false
    return focusModelTarget(record.snapshot.targetId)
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
