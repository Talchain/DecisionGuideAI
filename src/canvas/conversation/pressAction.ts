/**
 * The ONE press path for an action in `ACTION_REGISTRY`: one chip turn through
 * `askAi`, which reads the action's chip id from the registry for the model's
 * current stage. A surface names the action; it never spells an id or a question.
 */
import { askAi, type AskAiResult } from './askAi'
import { ACTION_REGISTRY, type ActionId } from './actionRegistry'

export function pressAction(actionId: ActionId): AskAiResult {
  // "More options" names the options already on the board, so new ones differ from them.
  return askAi({ intent: ACTION_REGISTRY[actionId].ask, includeOptions: actionId === 'more_options' })
}
