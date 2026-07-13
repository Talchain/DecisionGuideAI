/**
 * StrengthenContainer — the ONE store-aware mount wrapper for Wave 3a
 * (mounted exclusively by ResultsBody behind VITE_FEATURE_STRENGTHEN_PANEL,
 * replacing FocusNow inside the flag; the panel itself is store-free).
 *
 * Responsibilities:
 * - map the results data + guidance items into the narrow engine inputs;
 * - run buildRecommendations and reconcile the lifecycle store on each
 *   COMPLETED analysis (keyed by the results hash — reconcile-by-id, so a
 *   new response never resets progress);
 * - label everything stale when the model changes (visible-but-stale: this
 *   panel deliberately keeps rendering snapshots the fail-stale guidance
 *   eviction would drop, per plan §3 — the freshness strip stays the tab's
 *   single freshness OWNER; the per-rec label is detail, not a verdict);
 * - route actions per §8.8, reading callbacks at CLICK time (they start
 *   null and go transiently null across host remounts): ai-dialogue via
 *   _dispatchAction with an EXPLICIT action_type (chip_metadata survives
 *   only conversation-typed turns), degrading to _sendMessage with a DEV
 *   warn; canvas focus via the fail-closed focusModelTarget (resolves
 *   node ids, canvas edge ids and PLoT arrow-form edge ids).
 * - suppress any panel-local freshness banner (AnalysisFreshnessNotice owns
 *   the tab's freshness surface — same contract as FocusNowContainer).
 */
import { useEffect, useMemo } from 'react'
import { useCanvasStore } from '../../../canvas/store'
import { useGuidanceStore } from '../../../canvas/stores/guidanceStore'
import {
  selectActive,
  selectHistory,
  useStrengthenStore,
  type RecRecord,
} from '../../../canvas/stores/strengthenStore'
import { focusModelTarget } from '../../../canvas/utils/focusHelpers'
import { buildRecommendations } from './buildRecommendations'
import type { StrengthenInputs } from './strengthenTypes'
import { StrengthenPanel } from './StrengthenPanel'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'

export interface StrengthenContainerProps {
  data: ResultsSectionDataReturn
}

export function StrengthenContainer({ data }: StrengthenContainerProps) {
  const resultsHash = useCanvasStore((s) => s.results.hash ?? null)
  const freshnessDirty = useCanvasStore((s) => s.analysisFreshnessDirty === true)
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
    const confidence = data.confidence as Record<string, unknown>
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
        influenceScore: d.influenceScore,
        confidence: d.confidence ?? null,
        worthInvestigating: (d as Record<string, unknown>).worthInvestigating === true,
        evpiPercentagePoints:
          typeof (d as Record<string, unknown>).evpiPercentagePoints === 'number'
            ? ((d as Record<string, unknown>).evpiPercentagePoints as number)
            : null,
        canFocus: d.canFocus,
      })),
      robustness: {
        status: (confidence.robustnessStatus as string | undefined) ?? null,
        level: (confidence.robustnessLevel as string | undefined) ?? null,
      },
      // Producer-owned bias findings only (§19): no live emission until CEE
      // ships the signal — the engine keeps broaden gated on this list.
      biasFindingTypes: [],
      phase3Items: guidanceItems.map((item) => ({
        id: item.item_id,
        title: item.title,
        body: item.detail,
        actionIntent: item.primary_action.type === 'discuss' ? 'discuss' : item.primary_action.type,
        actionLabel: undefined,
        targetIds: item.target_object?.id ? [item.target_object.id] : [],
        // GuidanceItem priority is 0-100 higher-first; the engine wants
        // ascending, so invert onto its phase-3 band.
        priorityRank: 100 - (item.priority ?? 0),
      })),
    }
  }, [data, guidanceItems])

  // Reconcile on each COMPLETED analysis (identified by the results hash).
  useEffect(() => {
    if (!inputs.analysisComplete && inputs.goalThreshold != null) return
    const { reconcile } = useStrengthenStore.getState()
    reconcile(buildRecommendations(inputs), resultsHash ?? 'no-analysis')
  }, [inputs, resultsHash])

  // The model changed since the last completed analysis: label, never evict.
  useEffect(() => {
    if (freshnessDirty) useStrengthenStore.getState().markAllStale()
  }, [freshnessDirty])

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
    if (rec.action.kind === 'ai-dialogue') {
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

  const onWorkThrough = (record: RecRecord) => {
    if (dispatchAiDialogue(record)) {
      useStrengthenStore.getState().markInProgress(record.id)
    }
  }

  const onFocusCanvas = (record: RecRecord) => {
    if (record.snapshot.targetId) {
      focusModelTarget(record.snapshot.targetId)
    }
  }

  const onNotRelevant = (record: RecRecord) => {
    useStrengthenStore.getState().dismiss(record.id)
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
    />
  )
}
