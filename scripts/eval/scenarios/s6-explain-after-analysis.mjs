import { draftTurn, runTurn, buildTurnBase, sleep } from './_common.mjs'
import { buildRunAnalysis, buildExplain } from '../builders.mjs'
import { stageEquals, containsPhrase } from '../assertions.mjs'
import { run as s5run } from './s5-run-analysis.mjs'

export const NAME = 's6-explain-after-analysis'
export const DESCRIPTION = 'Draft → run analysis → explain. Must surface analytical content and be in evaluate stage.'

// Reuse s5's input-building logic.
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
    return { id: optNode.id, label: optNode.data?.label ?? optNode.id, status: 'ready', interventions }
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

  const t2 = await runTurn({
    ctx,
    scenarioName: NAME,
    mode,
    spec: {
      message: 'Run the analysis',
      turn_type: 'run_analysis',
      build: (c) => buildRunAnalysis({
        ...buildTurnBase(c),
        analysis_inputs: deriveAnalysisInputs(c),
      }),
    },
  })
  if (t2.transportError) return { name: NAME, pass: false, logs: ctx.turnLogs, failures: t2.log.failures }
  if (!t2.envelope?.analysis_response) {
    return {
      name: NAME,
      pass: false,
      logs: ctx.turnLogs,
      failures: ['analysis_not_ready_cannot_test_explain'],
    }
  }
  await sleep(500)

  const t3Msg = 'Which option is stronger and why?'
  const t3 = await runTurn({
    ctx,
    scenarioName: NAME,
    mode,
    spec: {
      message: t3Msg,
      turn_type: 'explain',
      build: (c) => buildExplain({
        ...buildTurnBase(c),
        message: t3Msg,
        analysis_state: c.analysisState,
      }),
    },
  })
  const failures = []
  if (t3.transportError) return { name: NAME, pass: false, logs: ctx.turnLogs, failures: t3.log.failures }

  const text = t3.envelope?.assistant_text ?? ''
  if (!text.trim()) failures.push('empty_explain_text')

  // Analytical content: percentage OR numeric range OR a driver-named term.
  const hasPercent = /\b\d{1,3}\s?%/.test(text)
  const hasDriverLanguage = containsPhrase(text, ['because', 'driven by', 'the biggest', 'main driver', 'strongest factor', 'probability', 'likely', 'higher expected'])
  if (!hasPercent && !hasDriverLanguage) failures.push('no_analytical_content')

  if (containsPhrase(text, ['action not available', 'cannot do that yet', 'not available right now'])) {
    failures.push('action_not_available_language')
  }
  if (!stageEquals(t3.envelope?.stage_indicator, 'evaluate')) {
    failures.push(`stage_not_evaluate:${t3.log.stage_indicator ?? 'null'}`)
  }

  if (failures.length > 0) { t3.log.pass = false; t3.log.failures.push(...failures) }
  return { name: NAME, pass: failures.length === 0, logs: ctx.turnLogs, failures }
}
