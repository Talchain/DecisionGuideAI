import { useCanvasStore } from '../store'
import { useGuidanceStore } from '../stores/guidanceStore'
import { selectRunAffirmedCurrent } from '../state/analysisStateSelector'
import { selectGoalProbability } from '../../components/results/utils/selectGoalProbability'
import { selectRunWithholdsFigures } from '../ui/inspector-v2/useAnalysisResults'
import { bindAskTarget, clearAskTargetBinding } from '../ui/inspector-v2/askTargetBinding'
import { revealOlumiSurface } from './revealOlumi'
import { isQuestionAssumptionEnabled, isTestWithoutLinkEnabled } from '../../flags'
import { isStrengthPlaceholder } from '../domain/strengthPlaceholder'
import { edgeValueSource } from '../domain/edgeValueProvenance'
import { findPathsToGoal } from '../utils/pathFinding'
import { resolveEffectiveAdmission } from '../hooks/useAnalysisReady'
import { selectBootReadPermittedMode, useBootReadAdmissionStore } from '../hydrate/bootReadAdmission'
import { testWithoutLinkEligibility } from '../../components/results/analysisNew/testWithoutLinkEligibility'
import { graphDeclaresBaseline, resolveOptionIsBaseline } from '../utils/baselineDetection'
import { QUESTIONS, type AskIntent, type AskStage, type QuestionContext } from './askAiQuestions'

export interface AskAiRequest {
  includeOptions?: boolean
  intent?: AskIntent
  nodeIds?: Iterable<string>
  edgeIds?: Iterable<string>
  pressId?: string
  /** Only words the person typed may enter the composer wire. */
  userWords?: string
  node?: { type?: string; data?: unknown }
}
export type AskAiResult = 'sent' | 'busy' | 'refire' | 'none'

export function askAiStage(state = useCanvasStore.getState()): AskStage {
  const ran = state.hasCompletedFirstRun || !!state.results?.report || !!state.v5AnalysisFact?.hasRunAnalysisFact
  if (!ran) return 'drafted'
  if (!selectRunAffirmedCurrent(state)) return 'stale'
  if (selectRunWithholdsFigures(state)) return 'withheld'
  const probabilities = (state.results?.report as { option_probabilities?: Record<string, Parameters<typeof selectGoalProbability>[0]> } | undefined)?.option_probabilities
  if (probabilities && Object.values(probabilities).some(p => selectGoalProbability(p).goalProbability === null)) return 'withheld'
  return 'ran-current'
}
const labelOf = (node: { data?: unknown } | undefined): string | undefined => {
  const label = (node?.data as { label?: unknown } | undefined)?.label
  return typeof label === 'string' && label.trim() ? label.trim() : undefined
}

export function buildAskAiQuestion(req: AskAiRequest) {
  const state = useCanvasStore.getState?.()
  const nodes = state?.nodes ?? []
  const edges = state?.edges ?? []
  const nodeIds = [...(req.nodeIds ?? [])]
  const edgeIds = [...(req.edgeIds ?? [])]
  const node = req.node ?? nodes.find(n => n.id === nodeIds[0])
  const edge = edges.find(e => e.id === edgeIds[0])
  const stage = state ? askAiStage(state) : 'drafted'
  let intent = req.intent ?? (edgeIds.length ? 'link' : 'explain')
  const context: QuestionContext = {
    stage, label: labelOf(node), kind: node?.type,
    optionLabels: req.includeOptions ? nodes.filter(n => n.type === 'option').map(labelOf).filter((label): label is string => !!label) : undefined,
    sourceLabel: labelOf(nodes.find(n => n.id === edge?.source)),
    targetLabel: labelOf(nodes.find(n => n.id === edge?.target)),
    goalLabel: node?.type === 'goal' ? labelOf(node) : labelOf(nodes.find(n => n.type === 'goal')),
    decisionLabel: node?.type === 'decision' ? labelOf(node) : labelOf(nodes.find(n => n.type === 'decision')),
    baseline: resolveOptionIsBaseline(node?.data as { is_baseline?: unknown; label?: unknown },
      state?.ceeAnalysisReady?.options?.find(o => o.id === nodeIds[0]),
      graphDeclaresBaseline(nodes, state?.ceeAnalysisReady?.options)),
  }
  let pressId = req.pressId ?? (intent === 'widen' && stage === 'ran-current' ? 'agent-next-widen'
    : intent === 'pre-mortem' && (stage === 'ran-current' || stage === 'withheld') ? 'agent-next-pre-mortem'
      : intent === 'what-would-change' && stage === 'ran-current' ? 'agent-next-what-would-change'
        : intent === 'strengthen' && stage === 'ran-current' ? 'agent-next-strengthen'
          : intent === 'review' && stage === 'ran-current' ? 'agent-next-review-decision' : undefined)
  if (!pressId && edge && intent === 'question-link') {
    const goalNode = nodes.find(n => n.type === 'goal')
    const data = edge.data as Record<string, unknown> | undefined
    const naturalEffect = data?.naturalEffect as { author?: string } | undefined
    const openAssumption = isStrengthPlaceholder(data)
      || (naturalEffect?.author === 'olumi_estimate' && edgeValueSource(data, 'weight') === 'cee')
    if (isQuestionAssumptionEnabled() && goalNode && openAssumption
      && findPathsToGoal(edge.source, goalNode.id, edges, { maxDepth: nodes.length }).includes(edge.id)) {
      pressId = `agent-question-assumption:${edge.source}>${edge.target}`
    } else intent = 'link'
  }
  if (!pressId && edge && intent === 'link' && stage === 'ran-current' && isTestWithoutLinkEnabled()) {
    const eligible = testWithoutLinkEligibility({
      permittedAnalysisMode: resolveEffectiveAdmission(state?.ceeAnalysisReady?.analysis_admission, state?.retainedAnalysisAdmission)?.permitted_analysis_mode
        ?? selectBootReadPermittedMode(state!, useBootReadAdmissionStore.getState().record),
      analysisState: state?.analysisStateV1, hasResult: state?.results?.report != null,
      sourceType: nodes.find(n => n.id === edge.source)?.type,
      targetType: nodes.find(n => n.id === edge.target)?.type,
      edgeType: typeof edge.data?.edge_type === 'string' ? edge.data.edge_type : undefined,
    })
    if (eligible.eligible) pressId = `agent-test-without-link:${JSON.stringify([edge.source, edge.target])}`
  }
  if (pressId?.startsWith('agent-question-assumption:')) intent = 'question-link'
  if (pressId?.startsWith('agent-test-without-link:')) intent = 'test-link'
  const question = QUESTIONS[intent](context)
  return { question, id: pressId ?? `ask:${intent}`, nodeIds, edgeIds }
}

export const ASK_BUSY_NOTICE = 'Olumi is still answering — try again in a moment'
// Each intent/target has its own refire clock; another ask is never silently dropped.
const lastSends = new WeakMap<object, Map<string, number>>()
export function askAi(req: AskAiRequest): AskAiResult {
  if (req.userWords === undefined && !req.intent && !req.pressId) return 'none'
  const state = useGuidanceStore.getState()
  const send = req.userWords !== undefined ? state._sendMessage : state._dispatchAction
  if (!send || (req.userWords !== undefined && !req.userWords.trim())) return 'none'
  const canvas = useCanvasStore.getState?.()
  const request = req.userWords !== undefined && req.nodeIds === undefined && req.edgeIds === undefined
    ? { ...req, nodeIds: canvas?.selection?.nodeIds ?? [], edgeIds: canvas?.selection?.edgeIds ?? [] } : req
  const built = buildAskAiQuestion(request)
  const text = req.userWords ?? built.question
  const key = JSON.stringify([req.intent ?? built.id, built.nodeIds, built.edgeIds,
    req.userWords === undefined ? null : text])
  const owner = send
  const previous = lastSends.get(owner)?.get(key)
  if (previous !== undefined && Date.now() - previous < 500) return 'refire'
  if (state._isConversationBusy?.()) {
    revealOlumiSurface()
    window.dispatchEvent(new CustomEvent('topbar:show-toast', {
      detail: { message: ASK_BUSY_NOTICE, level: 'warning' },
    }))
    return 'busy'
  }
  const clocks = lastSends.get(owner) ?? new Map<string, number>()
  for (const [oldKey, at] of clocks) if (Date.now() - at >= 500) clocks.delete(oldKey)
  clocks.set(key, Date.now())
  lastSends.set(owner, clocks)
  bindAskTarget(text, built.nodeIds, built.edgeIds, true)
  try {
    if (req.userWords !== undefined) state._sendMessage!(text)
    else state._dispatchAction!({ id: built.id, label: text, message: text, source: 'chip' })
  } catch (error) {
    clearAskTargetBinding(); clocks.delete(key); throw error
  }
  revealOlumiSurface()
  return 'sent'
}
