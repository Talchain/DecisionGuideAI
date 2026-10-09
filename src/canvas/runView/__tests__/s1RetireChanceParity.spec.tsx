import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, renderHook } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import b1 from './fixtures/p45-b1-0eba01bb-run2-turn.json'
import b2Reloaded from './fixtures/p02-B2-464abd0a-read-reloaded.json'
import b2Served from './fixtures/cee-1c-served-read-464abd0a.json'
import b3 from '../../../components/results/analysisNew/__tests__/b3-captured-census-read.fixture.json'
import { mapV5AnalysisToReport } from '../../../v5/mapV5AnalysisToReport'
import { parseCanonicalAnalysisView } from '../canonicalAnalysisView'
import { runViewOf } from '../runView'
import { useCanvasStore } from '../../store'
import { useCanonicalAnalysisViewStore } from '../../stores/canonicalAnalysisViewStore'
import { useNodeDisplayMetadata } from '../../hooks/useNodeDisplayMetadata'
import { useResultsSectionData } from '../../../components/results/useResultsSectionData'
import { optionChanceCellFromResults } from '../../../components/results/optionChanceCellFromResults'
import { buildGoalFitRows } from '../../components/model-tab/buildGoalFitRows'
import { buildDecisionBrief, DECISION_BRIEF_COPY } from '../../decisionBrief/buildDecisionBrief'
import { DecisionSummary } from '../../components/DecisionSummary'
import { GoalNode } from '../../nodes/GoalNode'
import { GoalPanel } from '../../ui/inspector-v2/panels/GoalPanel'
import { fromOptionProbabilities } from '../../../lib/discriminationFallback'

vi.mock('../../../contexts/AuthContext', async importOriginal => ({
  ...await importOriginal<typeof import('../../../contexts/AuthContext')>(),
  useAuth: () => ({ authenticated: false, user: null }),
}))
vi.mock('../../../hooks/useISLConformal', () => ({ useISLConformal: () => ({ data: null, loading: false, predict: vi.fn() }) }))
vi.mock('../../hooks/useComparisonDetection', () => ({ useComparisonDetection: () => ({ optionNodes: [], isComparison: false }) }))
vi.mock('@xyflow/react', async importOriginal => ({ ...await importOriginal<typeof import('@xyflow/react')>(), Handle: () => null }))

afterEach(() => { cleanup(); useCanonicalAnalysisViewStore.setState({ scenarioId: null, view: null }) })
const cases = [
  ['B1 served turn', { graph: b1.draft_graph, analysis_result: b1.blocks[0], analysis_state: b1.analysis_state, graph_hash: b1.graph_hash }],
  ['B2 reloaded READ', b2Reloaded.j],
  ['B2 canonical served READ', b2Served],
] as const

function install(body: any) {
  const report = mapV5AnalysisToReport(body.analysis_result)
  const nodes = body.graph.nodes.map((n: any) => ({ id: n.id, type: n.kind ?? n.type, position: { x: 0, y: 0 }, data: { ...n, kind: n.kind ?? n.type } }))
  const goal = nodes.find((n: any) => n.type === 'goal')!
  const options = nodes.filter((n: any) => n.type === 'option')
  const canonical = parseCanonicalAnalysisView(body.canonical_analysis_view)
  useCanvasStore.setState({ currentScenarioId: 's1', nodes, edges: [], outcomeNodeId: goal.id,
    goalThreshold: 20000, goalConstraints: [], runMeta: null, rawV2Response: null, ceeAnalysisReady: null,
    results: { status: 'complete', report }, hasCompletedFirstRun: true,
  } as any)
  useCanonicalAnalysisViewStore.setState({ scenarioId: 's1', view: canonical })
  return { report, nodes, goal, options, canonical }
}

// One row per real option, with a declared pointer ONLY for exercising the pointer-bound goal surfaces.
// The served report and producer chance/withhold/range bytes stay intact.
describe('S1 R1: changed chance displays share the option card cell', () => {
  for (const [name, body] of cases) {
    it(name, () => {
      const { report, nodes, goal, options, canonical } = install(body)
      const data = renderHook(() => useResultsSectionData({ registerCanvasRows: false })).result.current
      const view = runViewOf(report, canonical)
      const brief = buildDecisionBrief({ graph: body.graph, graphHash: body.graph_hash ?? null,
        analysisState: body.analysis_state as never, analysisResult: body.analysis_result,
        canonicalAnalysisView: (body as any).canonical_analysis_view,
      })
      expect(brief.run.status).toBe('current')
      // These served Runs have a partial chance field; staging suppresses the brief's full set.
      expect(brief.chances).toEqual([])
      expect(brief.chancesNote).toBe(DECISION_BRIEF_COPY.noChances)
      const rows = buildGoalFitRows(options, report.option_probabilities, view, { goalChanceHeroSays: view.goalChance !== null, labelOf: id => nodes.find((n: any) => n.id === id)?.data.label ?? null })!
      expect(rows).not.toBeNull()
      expect(data.recommendation.allOptions.some(row => optionChanceCellFromResults(data, row.id).kind !== 'none')).toBe(true)
      for (const option of options) {
        const cell = optionChanceCellFromResults(data, option.id)
        if (cell.kind === 'none') {
          expect(rows.find(row => row.id === option.id)).toBeUndefined()
          continue
        }
        expect(rows.find(row => row.id === option.id)?.chanceCell).toEqual(cell)
        const chance = view.chanceOf(option.id)
        const numeric = chance.kind === 'figure' ? chance.pct / 100 : null
        expect(data.recommendation.allOptions.find(row => row.id === option.id)?.goalProbability).toBe(numeric)
        useCanvasStore.setState({ results: { status: 'complete', report: { ...report, robustness: { ...(report as any).robustness, recommended_option_id: option.id } } },
          nodes: [option, ...nodes.filter((n: any) => n.id !== option.id)],
        } as any)
        const metadata = renderHook(() => useNodeDisplayMetadata(goal.id, 'goal')).result.current
        expect(metadata.achievementChanceCell).toEqual(cell)
        expect(metadata.achievementProbability).toBe(numeric)
        const summary = render(<DecisionSummary />)
        expect(summary.container.textContent).toContain(cell.text)
        summary.unmount()
        const goalMount = render(<ReactFlowProvider><GoalNode {...({ id: goal.id, data: { ...goal.data, success_threshold: 20000, threshold_source: 'user' }, isConnectable: true } as any)} /></ReactFlowProvider>)
        expect(goalMount.container.textContent).toContain(cell.text)
        goalMount.unmount()
        const panel = render(<GoalPanel {...({ nodeId: goal.id, node: { ...goal, data: { ...goal.data, goal_threshold_raw: 20000 } } } as any)} />)
        expect(panel.container.textContent).toContain(cell.text)
        panel.unmount()
        console.info(`R1 ${name} ${option.id}: ${cell.kind} ${cell.text}`)
      }
    })
  }
  it('B3 captured graph has no Run fixture: every option has no chance cell', () => {
    // This repository's B3 capture is a graph/census fixture, not an analysis-result capture.
    expect('analysis_result' in b3).toBe(false)
    const view = runViewOf(null)
    const options = b3.graph.nodes.filter((n: any) => n.kind === 'option' || n.type === 'option')
    expect(options.length).toBeGreaterThan(0)
    for (const node of options) expect(view.chanceCellOf(node.id, { goalChanceHeroSays: false, labelOf: () => null })).toEqual({ kind: 'none', text: null })
  })
})

it('R2: raw goal_probability without a licence never supplies a number or numeric gate', () => {
  const body = structuredClone(b2Served) as any
  delete body.canonical_analysis_view
  body.analysis_result.enrichment.inference_warnings = []
  for (const row of body.analysis_result.enrichment.option_comparison) row.probability_of_goal = 0.734
  const { report, options, goal } = install(body)
  const data = renderHook(() => useResultsSectionData({ registerCanvasRows: false })).result.current
  const rows = buildGoalFitRows(options, report.option_probabilities, runViewOf(report))!
  expect(rows.length).toBeGreaterThan(0)
  expect(Object.values(report.option_probabilities ?? {}).some((row: any) => row.goal_probability === 0.734)).toBe(true)
  const brief = buildDecisionBrief({ graph: body.graph, graphHash: body.graph_hash, analysisState: body.analysis_state, analysisResult: body.analysis_result })
  expect(brief.chances).toEqual([])
  expect(brief.chancesNote).toBe(DECISION_BRIEF_COPY.noChances)
  expect(rows.every(row => row.probability === null && row.chanceCell.kind === 'withheld')).toBe(true)
  expect(data.recommendation.allOptions.every(row => row.goalProbability === null)).toBe(true)
  expect(fromOptionProbabilities(report.option_probabilities as never, {}, report)).toEqual([])
  for (const option of options) {
    useCanvasStore.setState({ results: { status: 'complete', report: { ...report, robustness: { recommended_option_id: option.id } } } } as any)
    const metadata = renderHook(() => useNodeDisplayMetadata(goal.id, 'goal')).result.current
    expect(metadata.achievementProbability).toBeNull()
    expect(metadata.goalFitAvailable).toBe(false)
    expect(metadata.achievementChanceCell?.text).not.toMatch(/\d+%/)
    useCanvasStore.setState({ nodes: [option, ...useCanvasStore.getState().nodes.filter(n => n.id !== option.id)] })
    const summary = render(<DecisionSummary />)
    expect(summary.container.textContent).toContain(metadata.achievementChanceCell?.text)
    expect(summary.container.textContent).not.toContain('73%')
    summary.unmount()
    const goalMount = render(<ReactFlowProvider><GoalNode {...({ id: goal.id, data: { ...goal.data, success_threshold: 20000, threshold_source: 'user' }, isConnectable: true } as any)} /></ReactFlowProvider>)
    expect(goalMount.container.textContent).toContain(metadata.achievementChanceCell?.text)
    expect(goalMount.container.textContent).not.toContain('73%')
    goalMount.unmount()
    const panel = render(<GoalPanel {...({ nodeId: goal.id } as any)} />)
    expect(panel.container.textContent).toContain(metadata.achievementChanceCell?.text)
    expect(panel.container.textContent).not.toContain('73%')
    panel.unmount()
  }
})

it('R2: an option omitted or withheld by an otherwise valid licence cannot spend its raw figure', () => {
  const report = {
    option_probabilities: { a: { goal_probability: 0.991, confidence: 0.9 }, b: { goal_probability: 0.993 }, c: { goal_probability: 0.995 } },
    inference_warnings: [{ code: 'GOAL_CHANCE_LICENSED', form: 'each', message: 'licensed', severity: 'info',
      option_ids: ['a', 'b'], pct_by_option: { a: 17 }, withheld_option_ids: ['b'],
      target: { comparator: 'at_least', value: 100, unit: 'GBP' } }],
  }
  const view = runViewOf(report)
  expect(view.goalChance).not.toBeNull()
  expect(view.chanceOf('a')).toMatchObject({ kind: 'figure', pct: 17 })
  expect(view.chanceOf('b').kind).toBe('withheld')
  expect(view.chanceOf('c').kind).toBe('none')
  const nodes = ['a', 'b', 'c'].map(id => ({ id, type: 'option', position: { x: 0, y: 0 }, data: { label: id } }))
  const rows = buildGoalFitRows(nodes, report.option_probabilities, view)!
  expect(rows.map(row => row.id)).toEqual(['a', 'b'])
  expect(rows.map(row => row.probability)).toEqual([0.17, null])
  expect(rows[1].chanceCell.kind).toBe('withheld')
  expect(fromOptionProbabilities(report.option_probabilities, {}, report)).toEqual([
    { optionId: 'a', optionLabel: 'a', value: 17, confidence: 0.9 },
  ])
})

