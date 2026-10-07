/** Explicit batch doors send chip turns; other callers retain their original draft route. */
import { useGuidanceStore } from '../../stores/guidanceStore'
import { revealOlumiSurface } from '../../conversation/revealOlumi'
import { openAskOlumi } from '../../../components/results/coaching/askOlumiStore'
import { useCanvasStore } from '../../store'
import { bindAskTarget } from './askTargetBinding'
import { askAi, type AskAiResult } from '../../conversation/askAi'
import { COACHING_ASK_INTENTS, type AskIntent } from '../../conversation/askAiQuestions'

export const ASK_SEMANTIC = 'send-chip-immediately' as const
export interface AskRequest {
  text: string
  label: string
  context?: string
  targetId?: string
  nodeIds?: Iterable<string>
  edgeIds?: Iterable<string>
  node?: { type?: string; data?: unknown }
  includeOptions?: boolean
  intent?: AskIntent
  pressId?: string
  editable?: boolean
  parameters?: Record<string, unknown>
  source?: string
}
export function requestAsk(req: AskRequest): AskAiResult | 'drawer' | 'composer' {
  if (!req.text.trim()) return 'none'
  const canvas = useCanvasStore.getState?.()
  const targetIsEdge = canvas?.edges?.some(e => e.id === req.targetId)
  const nodeIds = req.nodeIds ?? (req.targetId ? targetIsEdge ? [] : [req.targetId] : canvas?.selection?.nodeIds ?? [])
  const edgeIds = req.edgeIds ?? (req.targetId ? targetIsEdge ? [req.targetId] : [] : canvas?.selection?.edgeIds ?? [])
  const chipId = typeof req.parameters?.chip_id === 'string' ? req.parameters.chip_id : undefined
  const intent = req.intent ?? (chipId ? COACHING_ASK_INTENTS[chipId] : undefined)
  // Only registered batch doors use the new contract. Other callers retain
  // their own text and carrier, including incomplete templates.
  if (!req.editable && (intent || req.pressId)) {
    return askAi({ includeOptions: req.includeOptions, intent, nodeIds, edgeIds, node: req.node, pressId: req.pressId })
  }
  const state = useGuidanceStore.getState()
  if (!state._prefillChat && !state._sendMessage && !state._dispatchAction) return 'none'
  const text = req.editable ? req.text : req.text.trim()
  bindAskTarget(text, nodeIds, edgeIds)
  if (!req.editable && req.parameters === undefined && state._prefillChat) {
    state._prefillChat(text)
    revealOlumiSurface()
    return 'composer'
  }
  openAskOlumi({ context: req.context ?? '', draft: text, label: req.label,
    targetId: req.targetId, parameters: req.parameters, source: req.source ?? 'chip' })
  if (req.editable) revealOlumiSurface()
  return 'drawer'
}
/** Legacy callers can still use any registered draft surface. */
export function canReceiveAsk(state: { _prefillChat: unknown; _sendMessage: unknown; _dispatchAction: unknown }): boolean {
  return !!(state._prefillChat || state._sendMessage || state._dispatchAction)
}
