/**
 * SC-24 — THE ONE READER of the displayed Run's comparison with the Run before it.
 *
 * Two surfaces show it: the Reasoning tab (a one-line receipt) and the Compare tab (the full block). They
 * must never disagree about whether a comparison exists or what it says, so both read it HERE, from the
 * same stored delta, under the same identity rule (`runDeltaDescribesDisplayedAnalysis`: the delta must
 * describe the analysis on screen, in this scenario — fail-closed on any absence), through the same view
 * model (`buildRunDeltaView`). A second reader is how two panels came to contradict each other about one
 * edit on 5 Aug (see `canvas/compare-tab/graphChangeDiff.ts`).
 *
 * Compare tab as its own tab: SC-24 v3 (ChatGPT #75 5917800777), lease DL #75 5917856638.
 */
import { useMemo } from 'react'
import { useCanvasStore } from '../../../canvas/store'
import { runDeltaDescribesDisplayedAnalysis, type StoredRunDelta } from '../../../canvas/state/storedRunDelta'
import { buildRunDeltaView, type RunDeltaView } from './runDeltaView'

/** Node id → its label, from the canvas's own nodes, so the comparison names an option what the canvas calls it. */
export function nodeLabelMap(nodes: ReadonlyArray<{ id: string; data?: unknown }> | null | undefined): Map<string, string> {
  const m = new Map<string, string>()
  for (const n of nodes ?? []) {
    const label = (n?.data as { label?: unknown } | undefined)?.label
    if (typeof label === 'string' && label.trim().length > 0) m.set(n.id, label)
  }
  return m
}

/** The comparison for the analysis on screen, or `null` when there is none that describes it. */
export function displayedRunDeltaView(
  stored: StoredRunDelta | null | undefined,
  responseHash: string | null | undefined,
  scenarioId: string | null | undefined,
  labels: ReadonlyMap<string, string>,
): RunDeltaView | null {
  if (!runDeltaDescribesDisplayedAnalysis(stored, responseHash, scenarioId)) return null
  const label = (id: string) => labels.get(id) ?? null
  return buildRunDeltaView(stored!.delta, label, label)
}

/** The Compare tab's read. The Reasoning tab's view model calls `displayedRunDeltaView` with the same inputs. */
export function useDisplayedRunDeltaView(responseHash: string | null | undefined): RunDeltaView | null {
  const stored = useCanvasStore((s) => s.runDelta)
  const scenarioId = useCanvasStore((s) => s.currentScenarioId)
  const nodes = useCanvasStore((s) => s.nodes)
  const labels = useMemo(() => nodeLabelMap(nodes), [nodes])
  return useMemo(
    () => displayedRunDeltaView(stored, responseHash, scenarioId, labels),
    [stored, responseHash, scenarioId, labels],
  )
}
