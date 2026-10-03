import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
vi.mock('../../../../canvas/ToastContext', () => ({ useShowToastSafe: () => vi.fn() }))
vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))
import { useCanvasStore } from '../../../../canvas/store'
import { useAnalysisNewViewModel } from '../useAnalysisNewViewModel'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { AtAGlance } from '../sections/AtAGlance'
import { genuineDecision } from './analysisNewFixtures'

const TID = 'analysis-new-glance-conditional-input-basis'
const admission = (ids: unknown = ['subscribers']) => ({ semantic_signals: { material_parameters_awaiting_user_node_ids: ids } })
const nodes = (source = 'cee_inference', intent?: string, override = false) => [
  { id: 'subscribers', type: 'factor', data: { label: 'Subscribers', observedState: { value: 300, source, ...(intent ? { reviewed_by_user: { intent } } : {}) } } },
  ...['opt_a', 'opt_b'].map((id) => ({ id, type: 'option', data: { interventions: override ? { subscribers: { value: 400 } } : {} } })),
]
const build = (source = 'cee_inference', a: unknown = admission(), current = true, intent?: string, override = false) => {
  const data = genuineDecision()
  data.recommendation.runAnalysisAdmission = a as never
  return buildAnalysisNewViewModel({ data, recommendations: [], isPreRun: false, isRunning: false, isStale: !current,
    analysisIdentityIsCurrent: current, analysisNodes: nodes(source, intent, override) })
}
afterEach(cleanup)

describe('B3-8 on the mounted result, from existing bound fields', () => {
  it('RED: names the Olumi input beside the licensed result and states bounded coverage', () => {
    render(<AtAGlance glance={build().atAGlance} />)
    expect(screen.getByTestId(TID)).toHaveTextContent('Olumi’s estimates for "Subscribers"')
    expect(screen.getByTestId(TID)).toHaveTextContent('factor starting values on the comparison’s paths')
  })
  it('RED: the named basis remains visible without a sensitivity feed', () => {
    const data = genuineDecision(); data.drivers.drivers = []
    data.recommendation.runAnalysisAdmission = admission() as never
    const vm = buildAnalysisNewViewModel({ data, recommendations: [], isPreRun: false, isRunning: false, isStale: false, analysisIdentityIsCurrent: true, analysisNodes: nodes() })
    expect(vm.atAGlance.inputProvenance).toBeNull()
    render(<AtAGlance glance={vm.atAGlance} />)
    expect(screen.getByTestId(TID)).toHaveTextContent('Olumi’s estimates for "Subscribers"')
  })
  it.each(['user_confirmed', 'inferred', 'cee_repair'])('RED: %s remains an Olumi-authored input', (source) => {
    expect(build(source).atAGlance.conditionalInputBasis).toContain('Olumi’s estimates')
  })
  it('RED: accepted Olumi figure differs from a bare user assumption and pairing review', () => {
    expect(build('user_assumption', admission(), true, 'confirm').atAGlance.conditionalInputBasis).toContain('Olumi’s estimates')
    expect(build('user_assumption').atAGlance.conditionalInputBasis).toBeNull()
    expect(build('user_assumption', admission(), true, 'confirm_pairing').atAGlance.conditionalInputBasis).toBeNull()
  })
  it('CONTROL: user-stated inputs, unused baselines and known-empty census preserve the existing result', () => {
    expect(build('brief_extraction').atAGlance.conditionalInputBasis).toBeNull()
    expect(build('cee_inference', admission(), true, undefined, true).atAGlance.conditionalInputBasis).toBeNull()
    expect(build('cee_inference', admission([])).atAGlance.conditionalInputBasis).toBeNull()
  })
  it('RED: a failed option cannot reintroduce a baseline unused by every computed option', () => {
    const data = genuineDecision(); data.recommendation.runAnalysisAdmission = admission() as never
    data.recommendation.allOptions!.push({ ...data.recommendation.allOptions![0]!, id: 'failed', label: 'Failed option', computeStatus: 'failed' })
    const graph = [...nodes('cee_inference', undefined, true), { id: 'failed', type: 'option', data: { interventions: {} } }]
    const vm = buildAnalysisNewViewModel({ data, recommendations: [], isPreRun: false, isRunning: false, isStale: false, analysisIdentityIsCurrent: true, analysisNodes: graph })
    expect(vm.atAGlance.conditionalInputBasis).toBeNull()
  })
  it('RED: unavailable/malformed/unresolved census remains distinct', () => {
    for (const raw of [{}, admission(null), admission(['missing']), admission([42])]) {
      expect(build('cee_inference', raw).atAGlance.conditionalInputBasis).toContain('unavailable')
    }
    expect(build('unknown_source').atAGlance.conditionalInputBasis).toContain('"Subscribers": source unrecorded')
  })
  it('CONTROL: a stale or withheld result never acquires the disclosure or a leader', () => {
    expect(build('cee_inference', admission(), false).atAGlance.conditionalInputBasis).toBeNull()
    const data = genuineDecision(); data.recommendation.leaderDesignationPermitted = false
    const vm = buildAnalysisNewViewModel({ data, recommendations: [], isPreRun: false, isRunning: false, isStale: false, analysisIdentityIsCurrent: true, analysisNodes: nodes() })
    expect(vm.atAGlance.headline).toBeNull()
    expect(vm.atAGlance.conditionalInputBasis).toBeNull()
  })
  it('CONTROL: a serialization round trip preserves the same disclosure inputs', () => {
    const data = genuineDecision(); data.recommendation.runAnalysisAdmission = admission() as never
    const input = { data, recommendations: [], isPreRun: false, isRunning: false, isStale: false, analysisIdentityIsCurrent: true, analysisNodes: nodes() }
    const first = buildAnalysisNewViewModel(input).atAGlance.conditionalInputBasis
    expect(first).toContain('Subscribers')
    expect(buildAnalysisNewViewModel(JSON.parse(JSON.stringify(input))).atAGlance.conditionalInputBasis).toBe(first)
  })
  it('RED: real store hydration withholds the basis until currentness is confirmed, and subscriptions update it', () => {
    const data = genuineDecision(); data.recommendation.runAnalysisAdmission = admission() as never
    const persistedNodes = nodes('user_assumption', 'confirm')
    useCanvasStore.setState({ nodes: persistedNodes, analysisFreshness: null, analysisFreshnessDirty: false,
      importPendingServerRegistration: false, pendingEmittedEdits: 0, analysisStateV1: null } as never)
    const readCurrent = () => useCanvasStore.getState().setAnalysisFreshness({ freshness: 'fresh', freshness_reason: 'graph_hash_match' })
    readCurrent()
    function MountedResult() {
      const vm = useAnalysisNewViewModel({ data, isPreRun: false, isRunning: false, isStale: false })
      return <AtAGlance glance={vm.atAGlance} />
    }
    const mounted = render(<MountedResult />)
    expect(screen.getByTestId(TID)).toHaveTextContent('Olumi’s estimates for "Subscribers"')
    act(() => useCanvasStore.getState().setAnalysisFreshness({ freshness: 'stale', freshness_reason: 'graph_hash_mismatch' }))
    expect(screen.queryByTestId(TID)).not.toBeInTheDocument()
    act(readCurrent)
    expect(screen.getByTestId(TID)).toBeInTheDocument()
    mounted.unmount()
    // The production cold-load action deliberately installs a report with UNKNOWN currentness.
    useCanvasStore.getState().resultsHydrateFromSupabase({ results: { status: 'complete', progress: 100,
      runId: 'b3-readback', report: { schema: 'report.v1', meta: { seed: 1, response_id: 'b3-readback', elapsed_ms: 1 },
        model_card: { response_hash: 'b3-hash', response_hash_algo: 'sha256', normalized: true }, results: {} } }, runMeta: {} } as never)
    useCanvasStore.setState({ nodes: JSON.parse(JSON.stringify(persistedNodes)) } as never)
    render(<MountedResult />)
    expect(useCanvasStore.getState().analysisFreshness?.freshness).toBe('unknown')
    expect(screen.queryByTestId(TID)).not.toBeInTheDocument()
    act(readCurrent)
    expect(screen.getByTestId(TID)).toHaveTextContent('Olumi’s estimates for "Subscribers"')
    act(() => useCanvasStore.setState({ nodes: nodes('user_override') } as never))
    expect(screen.queryByTestId(TID)).not.toBeInTheDocument()
  })
})
