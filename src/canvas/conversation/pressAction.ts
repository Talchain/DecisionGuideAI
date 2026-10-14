/**
 * Explicit registered action invocation. Reuses the open scenario's CEE offer
 * through the same pressOffer path as chat; without an offer, sends the existing
 * typed chip through askAi → dispatchAction. Interim prose rows retain the
 * base askAi question-family press, without an explicit typed pressId.
 */
import { askAi, type AskAiResult } from './askAi'
import { ACTION_REGISTRY, registeredPressId, type ActionId } from './actionRegistry'
import { useCanvasStore } from '../store'
import { useActionBarStore } from './actionBar/actionBarStore'
import { pressOffer, type PressOfferResult } from './actionBar/pressOffer'

export type PressActionResult = AskAiResult | PressOfferResult

export function pressAction(actionId: ActionId): PressActionResult {
  if (ACTION_REGISTRY[actionId].handler.kind === 'prose') {
    return askAi({ intent: ACTION_REGISTRY[actionId].ask, includeOptions: actionId === 'more_options' })
  }
  const pressId = registeredPressId(actionId)
  const { bar, scenarioId } = useActionBarStore.getState()
  const currentScenarioId = useCanvasStore.getState().currentScenarioId
  if (bar && currentScenarioId != null && scenarioId === currentScenarioId) {
    const offer = [...bar.priority, ...bar.standard, ...bar.more].find(o => o.action_id === actionId)
    // Same offer, identity, availability and double-press clock as a chat-bar press.
    if (offer) return pressOffer(offer, bar.revision)
  }
  // "More options" names the options already on the board, so new ones differ from them.
  // Named methods keep their typed handler even before a Run; CEE owns its typed preconditions.
  return askAi({ intent: ACTION_REGISTRY[actionId].ask, pressId, includeOptions: actionId === 'more_options' })
}
