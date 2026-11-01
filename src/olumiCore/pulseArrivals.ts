/**
 * A card that ARRIVES on the canvas because a change was approved is acknowledged with the applied-edit pulse (the F4 ring, and the camera
 * brought to it): "version 2 saved" must be seen on the card it changed. The model's merge pulses a card whose figure was overwritten and
 * deliberately not one that is added, and the turn's card reaches the canvas a moment after the turn is applied, so this waits for it.
 * Fails closed: a card that never arrives is never pulsed, and the wait is dropped after a while.
 */
import { useCanvasStore } from '../canvas/store'
import { pulseAppliedTargets } from '../canvas/utils/appliedEditPulse'

const WAIT_MS = 10_000

export function pulseWhenOnCanvas(ids: readonly string[]): void {
  if (ids.length === 0) return
  let done = false
  const finish = (arrived: string[]) => {
    if (done) return
    done = true
    unsubscribe()
    clearTimeout(timer)
    if (arrived.length > 0) pulseAppliedTargets({ nodeIds: arrived })
  }
  const check = (nodes: ReadonlyArray<{ id: string }>) => {
    const arrived = ids.filter((id) => nodes.some((n) => n.id === id))
    if (arrived.length > 0) finish(arrived)
  }
  const unsubscribe = useCanvasStore.subscribe((s) => check(s.nodes))
  const timer = setTimeout(() => finish([]), WAIT_MS)
  check(useCanvasStore.getState().nodes)
}

/** The ids of a model's cards (the question card is not one) that the canvas does not hold yet. */
export function arrivalsOf(graphNodes: ReadonlyArray<{ id?: unknown; kind?: unknown }>, onCanvas: ReadonlyArray<{ id: string }>): string[] {
  const held = new Set(onCanvas.map((n) => n.id))
  return graphNodes.flatMap((g) => (typeof g.id === 'string' && g.kind !== 'decision' && !held.has(g.id) ? [g.id] : []))
}
