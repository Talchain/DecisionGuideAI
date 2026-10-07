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
import { actionOfAsk, typedPressIdOf } from './actionRegistry'
import { readProducerLeaderPermission } from '../../lib/decisionVerdict'

export interface AskAiRequest {
  includeOptions?: boolean
  context?: string
  intent?: AskIntent
  nodeIds?: Iterable<string>
  edgeIds?: Iterable<string>
  pressId?: string
  /** Only words the person typed may enter the composer wire. */
  userWords?: string
  /** Typed finding or method context for the person's own response. */
  parameters?: Record<string, unknown>
  node?: { type?: string; data?: unknown }
}
export type AskAiResult = 'sent' | 'busy' | 'refire' | 'none'

/**
 * CEE's cause for withholding the leading option, read off the result it qualifies: the same rule as
 * `resultBoundLeaderWithholdCause` (useAnalysisNewViewModel), restated over the import-free `readProducerLeaderPermission`
 * so this module does not pull the results view-model into every canvas import graph (#2592 CI: four suites whose
 * `flags` mocks lacked `isRequireLoginEnabled` failed at import).
 */
function resultLeaderWithholdCause(stamp: unknown): string | null {
  if (readProducerLeaderPermission(stamp) !== false) return null
  const cause = (stamp as { producer_cause?: unknown }).producer_cause
  if (typeof cause !== 'string') return null
  const token = cause.trim()
  return token === '' ? null : token
}

export function askAiStage(state = useCanvasStore.getState()): AskStage {
  const ran = state.hasCompletedFirstRun || !!state.results?.report || !!state.v5AnalysisFact?.hasRunAnalysisFact
  if (!ran) return 'drafted'
  // The draft's own automatic first pass, withheld only because nobody asked for a Run (CEE `unrequested_analysis_withheld`,
  // exact token, read off the result it qualifies), is not a Run the person made: ask the drafted question, because the
  // honest next step is to Run (DL ruling 7 Oct, Canvas askAi witness). A requested Run that withheld keeps 'withheld'.
  if (resultLeaderWithholdCause(state.results?.report?.producer_leader_permission) === 'unrequested_analysis_withheld') return 'drafted'
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
  const data = node?.data as { description?: unknown; body?: unknown } | undefined
  const description = typeof data?.description === 'string' && data.description.trim() ? data.description : undefined
  const body = typeof data?.body === 'string' && data.body.trim() ? data.body : undefined
  const authored = description && body && body.trim() !== description.trim() ? `${description}\n\n${body}` : description ?? body
  const authoredContext = authored && (node?.type === 'risk' || node?.type === 'outcome')
    ? `\n${node.type === 'risk' ? 'Risk' : 'Outcome'} context: ${authored}` : undefined
  const upstream = nodes.find(n => n.id === edges.find(e => e.target === nodeIds[0] && nodes.some(n => n.id === e.source && n.type === 'factor'))?.source)
  const context: QuestionContext = {
    stage, otherLabel: labelOf(nodes.find(n => n.id === nodeIds[1])), label: labelOf(node), kind: node?.type, authoredContext,
    validateQuestion: labelOf(upstream) ? `How can I validate my assumption about ${labelOf(upstream)} and its effect on ${labelOf(node) || 'this outcome'}?${authoredContext ?? ''}` : undefined,
    optionLabels: req.includeOptions ? nodes.filter(n => n.type === 'option').map(labelOf).filter((label): label is string => !!label) : undefined,
    sourceLabel: labelOf(nodes.find(n => n.id === edge?.source)),
    targetLabel: labelOf(nodes.find(n => n.id === edge?.target)),
    goalLabel: node?.type === 'goal' ? labelOf(node) : labelOf(nodes.find(n => n.type === 'goal')),
    decisionLabel: node?.type === 'decision' ? labelOf(node) : labelOf(nodes.find(n => n.type === 'decision')),
    baseline: resolveOptionIsBaseline(node?.data as { is_baseline?: unknown; label?: unknown },
      state?.ceeAnalysisReady?.options?.find(o => o.id === nodeIds[0]),
      graphDeclaresBaseline(nodes, state?.ceeAnalysisReady?.options)),
  }
  // The action registry is the one mapper from an action to CEE's typed press id (S-B slice 0).
  const action = actionOfAsk(intent)
  let pressId = req.pressId ?? (action ? typedPressIdOf(action, stage) : undefined)
  if (!pressId && edge && (intent === 'question-link' || intent === 'examine-link')) {
    const goalNode = nodes.find(n => n.type === 'goal')
    const data = edge.data as Record<string, unknown> | undefined
    const naturalEffect = data?.naturalEffect as { author?: string } | undefined
    const openAssumption = isStrengthPlaceholder(data)
      || (naturalEffect?.author === 'olumi_estimate' && edgeValueSource(data, 'weight') === 'cee')
    if (isQuestionAssumptionEnabled() && goalNode && openAssumption
      && findPathsToGoal(edge.source, goalNode.id, edges, { maxDepth: nodes.length }).includes(edge.id)) {
      pressId = `agent-question-assumption:${edge.source}>${edge.target}`
    }
  }
  // Ordinary Challenge keeps its own question. Examine falls back to Q3,
  // retaining the existing link chip and stage/eligibility rules.
  if (intent === 'examine-link') intent = 'link'
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
  const question = QUESTIONS[intent](context) + (req.context ? `\n${req.context}` : '')
  return { question, id: pressId ?? `ask:${intent}`, nodeIds, edgeIds }
}

export const ASK_BUSY_NOTICE = 'Olumi is still answering — try again in a moment'
// Each intent/target has its own refire clock; another ask is never silently dropped.
const lastSends = new WeakMap<object, Map<string, number>>()
export function askAi(req: AskAiRequest): AskAiResult {
  if (req.userWords === undefined && !req.intent && !req.pressId) return 'none'
  const state = useGuidanceStore.getState()
  const hasParameters = req.parameters !== undefined
  const send = req.userWords !== undefined && !hasParameters ? state._sendMessage : state._dispatchAction
  if (!send || (req.userWords !== undefined && !req.userWords.trim())) return 'none'
  const canvas = useCanvasStore.getState?.()
  const request = req.userWords !== undefined && req.nodeIds === undefined && req.edgeIds === undefined
    ? { ...req, nodeIds: canvas?.selection?.nodeIds ?? [], edgeIds: canvas?.selection?.edgeIds ?? [] } : req
  const built = buildAskAiQuestion(request)
  const text = req.userWords ?? built.question
  const key = JSON.stringify([req.intent ?? built.id, built.nodeIds, built.edgeIds,
    req.userWords === undefined ? null : text, req.parameters])
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
    if (req.userWords !== undefined) {
      // The published schema permits typed parameters only on chip sources.
      if (hasParameters) state._dispatchAction!({ label: text, message: text, parameters: req.parameters, source: 'chip' })
      else state._sendMessage!(text)
    } else state._dispatchAction!({ id: built.id, label: text, message: text, source: 'chip' })
  } catch (error) {
    clearAskTargetBinding(); clocks.delete(key); throw error
  }
  revealOlumiSurface()
  return 'sent'
}
