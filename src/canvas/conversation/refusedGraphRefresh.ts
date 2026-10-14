import { useCanvasStore } from '../store'
import { hydrateCanvasFromServer } from '../hydrate/serverGraphHydration'
import { editDeliveryHold, subscribeDeliveryRegisters } from '../registration/editDeliveryHold'
import { pendingFactorEditValue } from './pendingFactorEdit'
import { isModelChangingSystemEvent } from './types'

/** CEE dispatch (815da42b, :1226/:2614) commits a manual prior range as mutatedGraph,
 * except distribution_required's fact-only fallback. A proven CAS/fence refusal
 * therefore needs graph recovery despite the older client freshness classification. */
export function isGraphRecoverySystemEvent(type: string | undefined): boolean {
  return isModelChangingSystemEvent(type) || type === 'prior_range_edit'
}

/** A particular continuous opening; A → B → A creates a different object. */
interface GraphOpening { scenarioId: string | null }

export interface RefusedGraphRefreshOptions {
  hasPendingTurn: () => boolean
  identity: () => Promise<{ userId: string | null; accessToken: string | null }>
  onFailure: () => void
}

/** Coordinates recovery only. The canonical reader and merge remain the sole graph authority. */
export function createRefusedGraphRefresh(opts: RefusedGraphRefreshOptions) {
  let opening: GraphOpening = { scenarioId: useCanvasStore.getState().currentScenarioId ?? null }
  let requested = false
  let running = false
  let disposed = false
  let generation = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let controller: AbortController | undefined
  const seen = new WeakSet<object>()
  let unsubscribeDelivery: (() => void) | undefined
  const stopWatchingDelivery = () => {
    unsubscribeDelivery?.()
    unsubscribeDelivery = undefined
  }

  const hasPending = () => {
    const state = useCanvasStore.getState()
    return opts.hasPendingTurn() || editDeliveryHold(state) !== null ||
      state.nodes.some(node => pendingFactorEditValue(node.id) !== null)
  }

  // A task boundary lets the rejected send's promise consumers complete their
  // synchronous rollback/copy before a read can apply, including raw carriers.
  const schedule = () => {
    if (disposed || !requested || running || timer !== undefined) return
    timer = setTimeout(() => {
      timer = undefined
      void refresh()
    }, 0)
  }

  const refresh = async () => {
    if (disposed || !requested || running || hasPending()) return
    const captured = opening
    const atRead = generation
    const scenarioId = captured.scenarioId
    if (!scenarioId) return
    running = true
    const readController = new AbortController()
    controller = readController
    const ownsOpening = () => !disposed && opening === captured &&
      useCanvasStore.getState().currentScenarioId === scenarioId
    const canApply = () => ownsOpening() && generation === atRead && !hasPending()
    try {
      const identity = await opts.identity()
      if (!canApply()) return
      const outcome = await hydrateCanvasFromServer(scenarioId, {
        ...identity, signal: readController.signal, requireServedScenario: true,
        reapplyServerGraph: true, canApply,
      })
      if (!ownsOpening() || generation !== atRead || hasPending()) return
      requested = false
      stopWatchingDelivery()
      if (outcome !== 'merged') {
        useCanvasStore.getState().markAnalysisFreshnessDirty?.()
        opts.onFailure()
      }
    } catch {
      if (canApply()) {
        requested = false
        stopWatchingDelivery()
        useCanvasStore.getState().markAnalysisFreshnessDirty?.()
        opts.onFailure()
      }
    } finally {
      running = false
      if (controller === readController) controller = undefined
      schedule()
    }
  }

  const changed = () => {
    const scenarioId = useCanvasStore.getState().currentScenarioId ?? null
    if (opening.scenarioId !== scenarioId) {
      opening = { scenarioId }
      requested = false
      stopWatchingDelivery()
      controller?.abort()
    }
    // Even an edit that begins AND settles before the read answers invalidates
    // that read. Once it settles, fetch again; never apply the older answer.
    if (requested && hasPending()) generation += 1
    schedule()
  }
  const unsubscribeCanvas = useCanvasStore.subscribe(changed)

  return {
    captureOpening: () => opening,
    request(error: object, captured: GraphOpening | undefined): (() => void) | undefined {
      if (disposed || captured !== opening || !opening.scenarioId) return undefined
      if (!seen.has(error)) {
        seen.add(error)
        requested = true
        // This UI subscription advances a shared external-store snapshot on
        // register changes. Keep it absent until recovery actually needs it.
        unsubscribeDelivery ??= subscribeDeliveryRegisters(changed)
        generation += 1
      }
      schedule()
      // S calls this after its carrier rollback. U already scheduled the same
      // request, so raw carriers and settlement-aware carriers share one read.
      return schedule
    },
    dispose() {
      disposed = true
      requested = false
      if (timer !== undefined) clearTimeout(timer)
      controller?.abort()
      unsubscribeCanvas()
      stopWatchingDelivery()
    },
  }
}
