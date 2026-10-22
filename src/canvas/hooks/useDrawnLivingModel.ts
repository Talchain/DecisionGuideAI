/**
 * The person's model as the canvas draws it (`domain/livingModelCanvas.ts`), for the scenario on screen, from the one
 * shared saved-graph read. Two duties beside the drawing:
 *  · it publishes the model's outcomes to the store's layout (`domain/livingKinds.ts`), and when one still stands in a
 *    row of engine factors (the board was laid out before the living model was read) it asks for ONE layout, so the
 *    outcome moves to the outcome row. Once per scenario and outcome set: a card the person moves afterwards stays put;
 *  · it keeps each drawn-only card's object while nothing about it changed. React Flow rebuilds a card's measurement
 *    from the object it is given (`adoptUserNodes`), and these cards have no store row to carry one, so a fresh object on
 *    every store change (a selection, a measurement) would hide and re-measure them each time.
 */
import { useEffect, useMemo, useRef } from 'react'
import type { Edge, Node } from '@xyflow/react'

import { withoutCoreSwitches } from '../domain/coreSwitch'
import { livingOutcomeIdsOf, publishLivingOutcomeIds } from '../domain/livingKinds'
import { drawLivingModel, LIVING_ONLY_KEY } from '../domain/livingModelCanvas'
import { useSavedGraph } from '../nodes/shared/savedGraph'
import { useCanvasStore } from '../store'
import { graphNeedsInitialLayout } from '../utils/graphNeedsInitialLayout'

type Positioned = { id: string; type?: string; position?: { y?: number } }

/** A living-model outcome laid out in the same row as an engine factor: laid out before its kind was known. */
export function outcomeStandsInFactorRow(nodes: readonly Positioned[], outcomeIds: ReadonlySet<string>): boolean {
  const drawn = withoutCoreSwitches(nodes, []).nodes.filter((n) => n.type === 'factor')
  const factorRows = new Set(drawn.filter((n) => !outcomeIds.has(n.id)).map((n) => Math.round(n.position?.y ?? 0)))
  return drawn.some((n) => outcomeIds.has(n.id) && factorRows.has(Math.round(n.position?.y ?? 0)))
}

const isDrawnOnly = (x: { data?: unknown }): boolean => (x.data as Record<string, unknown> | undefined)?.[LIVING_ONLY_KEY] !== undefined

/** The previous object for a drawn-only item whose drawing did not change; every engine item passes through as given. */
function stable<T extends { id: string; data?: unknown }>(items: T[], previous: Map<string, { key: string; item: T }>): T[] {
  const next = new Map<string, { key: string; item: T }>()
  const out = items.map((item) => {
    if (!isDrawnOnly(item)) return item
    const key = JSON.stringify(item)
    const kept = previous.get(item.id)
    const chosen = kept !== undefined && kept.key === key ? kept.item : item
    next.set(item.id, { key, item: chosen })
    return chosen
  })
  previous.clear()
  for (const [id, entry] of next) previous.set(id, entry)
  return out
}

export function useDrawnLivingModel(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
  const graph = useSavedGraph()
  const scenarioId = useCanvasStore((s) => s.currentScenarioId)
  const pendingLayout = useCanvasStore((s) => s.pendingLayout)
  const layoutInProgress = useCanvasStore((s) => s.layoutInProgress)
  const outcomeIds = useMemo(() => livingOutcomeIdsOf(graph), [graph])
  const askedFor = useRef<string | null>(null)
  const keptNodes = useRef(new Map<string, { key: string; item: Node }>())
  const keptEdges = useRef(new Map<string, { key: string; item: Edge }>())

  useEffect(() => { publishLivingOutcomeIds(scenarioId ?? null, outcomeIds) }, [scenarioId, outcomeIds])

  useEffect(() => {
    if (outcomeIds.size === 0 || pendingLayout || layoutInProgress || graphNeedsInitialLayout(nodes)) return
    const key = `${scenarioId ?? ''}|${[...outcomeIds].sort().join(',')}`
    if (askedFor.current === key || !outcomeStandsInFactorRow(nodes, outcomeIds)) return
    askedFor.current = key
    useCanvasStore.getState().setPendingLayout(true)
  }, [nodes, outcomeIds, pendingLayout, layoutInProgress, scenarioId])

  return useMemo(() => {
    const drawn = drawLivingModel(nodes, edges, graph)
    if (drawn.nodes === nodes && drawn.edges === edges) return drawn
    return { nodes: stable(drawn.nodes, keptNodes.current), edges: stable(drawn.edges, keptEdges.current) }
  }, [nodes, edges, graph])
}
