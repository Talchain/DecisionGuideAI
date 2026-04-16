import { draftTurn, runTurn, buildTurnBase, sleep } from './_common.mjs'
import { buildRunAnalysis } from '../builders.mjs'
import { containsPhrase } from '../assertions.mjs'

export const NAME = 's5-run-analysis'
export const DESCRIPTION = 'Draft, then run analysis. If ready, analysis_response returned; if not, honest missing-data message.'

function deriveAnalysisInputs(ctx) {
  const optionNodes = ctx.graph.nodes.filter((n) => (n.kind ?? n.data?.kind) === 'option')
  const goalNode = ctx.graph.nodes.find((n) => (n.kind ?? n.data?.kind) === 'goal')
  const factorIds = new Set(
    ctx.graph.nodes
      .filter((n) => { const k = n.kind ?? n.data?.kind; return k === 'factor' || k === 'outcome' || k === 'risk' })
      .map((n) => n.id),
  )
  const options = optionNodes.map((optNode) => {
    const interventions = {}
    for (const edge of ctx.graph.edges) {
      if (edge.source !== optNode.id) continue
      if (!factorIds.has(edge.target)) continue
      const w = typeof edge.data?.weight === 'number' ? edge.data.weight : 1
      const dir = edge.data?.direction ?? (w < 0 ? 'negative' : 'positive')
      const signed = dir === 'negative' ? -Math.abs(w) : Math.abs(w)
      interventions[edge.target] = {
        value: signed,
        source: 'cee_hypothesis',
        target_match: { node_id: edge.target, match_type: 'exact_id', confidence: 'high' },
      }
    }
    return {
      id: optNode.id,
      label: optNode.data?.label ?? optNode.id,
      status: 'ready',
      interventions,
    }
  })
  return { options, goal_node_id: goalNode?.id ?? '' }
}

export async function run(ctx, mode) {
  const draft = await draftTurn({
    ctx,
    scenarioName: NAME,
    brief: 'Should I hire a tech lead or two junior developers? We have 18 months of runway, a team of 5 mid-weight developers and 1 senior, and need to ship a product rewrite. Budget is £85,000 per year.',
    mode,
  })
  if (!draft.ok) return { name: NAME, pass: false, logs: ctx.turnLogs, failures: draft.failures }
  await sleep(500)

  const analysisInputs = deriveAnalysisInputs(ctx)
  const t2 = await runTurn({
    ctx,
    scenarioName: NAME,
    mode,
    spec: {
      message: 'Run the analysis',
      turn_type: 'run_analysis',
      build: (c) => buildRunAnalysis({
        ...buildTurnBase(c),
        analysis_inputs: analysisInputs,
      }),
    },
  })

  const failures = []
  if (t2.transportError) return { name: NAME, pass: false, logs: ctx.turnLogs, failures: t2.log.failures }

  const env = t2.envelope
  const text = env?.assistant_text ?? ''
  const hasAnalysis = !!env?.analysis_response
  const hasError = !!env?.analysis_error

  if (hasAnalysis) {
    // Ready branch: OK.
  } else if (hasError || containsPhrase(text, ['missing', 'need to', 'not ready', 'before i can', 'cannot run', "can't run"])) {
    // Honest not-ready branch: OK.
    if (!text.trim() && !hasError) failures.push('no_missing_data_explanation')
  } else {
    // Silent failure — assistant claims success or says nothing about the gap.
    failures.push('no_analysis_and_no_honest_explanation')
  }

  // False-claim guard: if no analysis_response, assistant_text must not claim completion.
  if (!hasAnalysis && containsPhrase(text, ['analysis complete', 'analysis is complete', 'results show', 'the analysis shows', 'here are the results'])) {
    failures.push('false_claim_of_completion')
  }

  if (failures.length > 0) { t2.log.pass = false; t2.log.failures.push(...failures) }
  return { name: NAME, pass: failures.length === 0, logs: ctx.turnLogs, failures, analysisReady: hasAnalysis }
}
