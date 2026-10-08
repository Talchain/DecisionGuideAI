/**
 * P48 (audit #27, GAP-11): the ONE graph-level cue lights the set CEE says changed since the last Run — on demand, by
 * id, and never as a mark on a card. Driven through the real `adoptChangedSinceRun` (the hydration's writer) and the
 * real `useModelChangedSinceRun` (the trust verdict is the only mock, as in AnalysisStateCue.spec).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { AnalysisStateV1Schema } from '@talchain/schemas/boundary'
import type { FreshnessDisplaySemantic } from '../../store/analysisFreshness'

const trust: { semantic: FreshnessDisplaySemantic | undefined } = { semantic: 'changed' }
vi.mock('../../hooks/useAnalysisTrust', () => ({ useAnalysisTrust: () => ({ semantic: trust.semantic }) }))

import { AnalysisStateCue, ANALYSIS_STATE_CUE_COPY, ANALYSIS_STATE_CUE_TESTID, changedSetLightingCss } from '../AnalysisStateCue'
import { useCanvasStore } from '../../store'
import { adoptChangedSinceRun, useChangedSinceRunStore } from '../../changes/changedSinceRun'
import { composeAnalysisState } from '../../state/analysisStateSelector'
import { analysisSnapshotFromStore } from '../../store/autosaveProjection'
import { restoreAnalysisFromAutosave } from '../../store/restoreAnalysisFromAutosave'

const SID = 'scn-p48'
const REPORT = { option_comparison: [{ option_id: 'a', outcome: { mean: 1, p10: 0, p50: 1, p90: 2 } }] }
const RUN_AT = '2026-10-08T00:00:00.000Z'
const delta = (over: Record<string, unknown> = {}) => ({
  scenarioId: SID, analysisHash: 'hash_b',
  delta: { endpoints: { current: { run_id: 'run_b', computed_at: RUN_AT } } }, ...over,
})
const wire = (over: Record<string, unknown> = {}) => ({
  version: 1, since_run_id: 'run_b', node_ids: ['f'], links: [{ from: 'f', to: 'o' }], unattributed_changes: 0, complete: true, ...over,
})
const LIGHT = `${ANALYSIS_STATE_CUE_TESTID}-light`
const LIGHTING = `${ANALYSIS_STATE_CUE_TESTID}-lighting`
const lightingCss = () => screen.queryByTestId(LIGHTING)?.textContent ?? null

/** A stale read restores findings but serves no run_delta or producer-confirmed Run id. */
function restoreStaleRun() {
  useCanvasStore.getState().resultsLoadHistorical({
    id: 'run_a', ts: Date.parse(RUN_AT), hash: 'hash_a', report: REPORT,
  } as never, SID)
  const verdict = AnalysisStateV1Schema.parse({
    run_state: { kind: 'complete_stale', computed_at: RUN_AT, cause: 'graph_changed' },
    readiness: { status: 'ready', blockers: [] },
    leader_claim: { permitted: true },
    robustness: {},
    usable_for_prose: true, usable_for_chips: false, usable_for_followup: true,
    requires_rerun: true, blocked_unusable: false, contradictions: [],
  })
  useCanvasStore.getState().setAnalysisStateV1(verdict)
  trust.semantic = composeAnalysisState({
    analysisState: useCanvasStore.getState().analysisStateV1, freshness: null, dirty: false, source: undefined,
    resultsStatus: 'complete', importHold: false, hasReport: true, ceeAnalysisReadyStatus: undefined, aiPanelV2On: false,
  }).semantic
}

/** The cue inside a `.react-flow` root with a pane, as ReactFlowGraph mounts it. */
function renderInFlow() {
  return render(
    <div className="react-flow" data-testid="flow">
      <div className="react-flow__pane" data-testid="pane" />
      <div className="react-flow__node" data-testid="rf__node-g" />
      <svg>
        <g data-testid="rf__edge-e1">
          <path className="react-flow__edge-path" style={{ stroke: 'var(--edge-stroke)', strokeWidth: 1.5 }} />
        </g>
        <g data-testid="rf__edge-e2"><path className="react-flow__edge-path" /></g>
        <g data-testid="rf__edge-e3"><path className="react-flow__edge-path" /></g>
      </svg>
      <AnalysisStateCue />
    </div>,
  )
}

beforeEach(() => {
  trust.semantic = 'changed'
  useCanvasStore.setState({
    currentScenarioId: SID,
    results: { status: 'complete', report: REPORT, runId: 'run_b', hash: 'hash_b', runEpoch: 1, reportEpoch: 1 },
    runDelta: null,
    analysisStateV1: null,
    edges: [
      { id: 'e1', source: 'f', target: 'o' },
      { id: 'e2', source: 'o', target: 'f' },
      { id: 'e3', source: 'g', target: 'o' },
    ],
  } as never)
  useChangedSinceRunStore.setState({ scenarioId: null, value: null })
})

describe('P48: the analysis-state cue lights the changed set', () => {
  it('CONTRAST: with no answer from CEE the sentence is the plain line it always was (no toggle, no lighting)', () => {
    renderInFlow()
    expect(screen.getByTestId(ANALYSIS_STATE_CUE_TESTID).textContent).toBe(ANALYSIS_STATE_CUE_COPY)
    expect(screen.queryByTestId(LIGHT)).toBeNull()
    expect(screen.queryByTestId(LIGHTING)).toBeNull()
  })

  it('an answer held for ANOTHER scenario is never lit here', () => {
    adoptChangedSinceRun('another-scenario', wire())
    renderInFlow()
    expect(screen.queryByTestId(LIGHT)).toBeNull()
  })

  it.each(['run_a', null])('changes since %s cannot describe the displayed run_b findings', (sinceRunId) => {
    adoptChangedSinceRun(SID, wire({ since_run_id: sinceRunId }))
    renderInFlow()
    expect(screen.getByTestId(ANALYSIS_STATE_CUE_TESTID).textContent).toBe(ANALYSIS_STATE_CUE_COPY)
    expect(screen.queryByTestId(LIGHT)).toBeNull()
    expect(lightingCss()).toBeNull()
  })

  it.each([undefined, 'restored:hash_b'])('an absent or placeholder displayed Run id (%s) leaves the plain sentence', (runId) => {
    useCanvasStore.setState({ results: { ...useCanvasStore.getState().results, runId } })
    adoptChangedSinceRun(SID, wire())
    renderInFlow()
    expect(screen.queryByTestId(LIGHT)).toBeNull()
  })

  it.each<[string, Record<string, unknown>]>([
    ['connecting run_b still holds run_a’s report', { status: 'connecting', runEpoch: 2, reportEpoch: 1 }],
    ['a conversation report inherits a legacy run_b id', { resultsSource: 'conversation' }],
    ['the report has no epoch proving its run_b identity', { reportEpoch: undefined }],
    ['a hydrated report inherited run_b with the historical sentinel', { reportEpoch: 0, runEpoch: 0 }],
  ])('%s never borrows that legacy id for lighting', (_label, over) => {
    useCanvasStore.setState({ results: { ...useCanvasStore.getState().results, ...over } } as never)
    adoptChangedSinceRun(SID, wire())
    renderInFlow()
    expect(screen.queryByTestId(LIGHT)).toBeNull()
  })

  it('a scenario-stamped historical restore can identify the displayed run_b', () => {
    useCanvasStore.setState({ results: {
      ...useCanvasStore.getState().results, runEpoch: undefined, reportEpoch: 0, restoredForScenarioId: SID,
    } })
    adoptChangedSinceRun(SID, wire())
    renderInFlow()
    act(() => screen.getByTestId(LIGHT).focus())
    expect(lightingCss()).toContain('rf__node-f')
  })

  // ⛔ A complete_stale verdict binds NOTHING (Codex review r4 on #2648, P1 ×2): the verdict is not bound to the
  // displayed report, and a normal stale hydration drops the report. Plain line, never lit against another Run.
  it.each([
    ['a matching stamp', { since_run_id: 'run_a', since_run_computed_at: RUN_AT }],
    ['a one-character mismatch', { since_run_id: 'run_a', since_run_computed_at: '2026-10-08T00:00:00.001Z' }],
    ['an absent stamp', { since_run_id: 'run_a' }],
  ])('a stale reload with %s stays the plain line (no toggle, no lighting)', (_name, over) => {
    restoreStaleRun()
    expect(trust.semantic).toBe('changed')
    adoptChangedSinceRun(SID, wire(over))
    renderInFlow()
    expect(screen.getByTestId(ANALYSIS_STATE_CUE_TESTID).textContent).toBe(ANALYSIS_STATE_CUE_COPY)
    expect(screen.queryByTestId(LIGHT)).toBeNull()
    expect(lightingCss()).toBeNull()
  })

  it('after a stale reload, a complete_current Run B binds by since_run_id and lights', () => {
    restoreStaleRun()
    adoptChangedSinceRun(SID, wire({ since_run_id: 'run_a', since_run_computed_at: RUN_AT }))
    renderInFlow()
    expect(screen.queryByTestId(LIGHT)).toBeNull()
    act(() => {
      useCanvasStore.setState({
        results: { ...useCanvasStore.getState().results, runId: 'run_b', hash: 'hash_b', runEpoch: 2, reportEpoch: 2 },
        runDelta: delta(), analysisStateV1: { run_state: { kind: 'complete_current', computed_at: RUN_AT } },
      } as never)
      adoptChangedSinceRun(SID, wire())
    })
    act(() => screen.getByTestId(LIGHT).focus())
    expect(lightingCss()).toContain('[data-testid="rf__node-f"]')
  })

  it('a V5 report B restored with inherited Run A identity cannot light A-relative changes', () => {
    useCanvasStore.setState({ results: {
      ...useCanvasStore.getState().results, runId: 'run_a', hash: 'hash_a',
    } })
    const reportB = { ...REPORT, meta: { response_id: 'hash_b' } }
    useCanvasStore.getState().resultsComplete({ report: reportB, hash: 'hash_b', resultsSource: 'conversation' } as never)
    const analysis = analysisSnapshotFromStore(useCanvasStore.getState())!
    expect(analysis.report).toBe(reportB)
    expect(analysis.runId).toBe('run_a')
    expect(analysis.resultsSource).toBe('conversation')
    restoreAnalysisFromAutosave({ scenarioId: SID, analysis }, useCanvasStore.getState().resultsLoadHistorical)
    expect(useCanvasStore.getState().results.report).toBe(reportB)
    expect(useCanvasStore.getState().results.runId).toBe('run_a')
    expect(useCanvasStore.getState().results.resultsSource).toBeUndefined()
    useCanvasStore.setState({ analysisStateV1: { run_state: {
      kind: 'complete_stale', computed_at: RUN_AT, cause: 'graph_changed',
    } } } as never)
    adoptChangedSinceRun(SID, wire({ since_run_id: 'run_a' }))
    renderInFlow()
    expect(screen.queryByTestId(LIGHT)).toBeNull()
  })

  it('V5 uses the hash/scenario-bound current endpoint run_b, even beside an inherited legacy run_a id', () => {
    useCanvasStore.setState({
      results: { ...useCanvasStore.getState().results, resultsSource: 'conversation', runId: 'run_a' },
      runDelta: delta(), analysisStateV1: { run_state: { kind: 'complete_current', computed_at: RUN_AT } },
    } as never)
    adoptChangedSinceRun(SID, wire())
    renderInFlow()
    act(() => screen.getByTestId(LIGHT).focus())
    expect(lightingCss()).toContain('rf__node-f')
  })

  it('conflicting direct run_b findings and a canonical run_a delta cannot borrow either id', () => {
    useCanvasStore.setState({
      runDelta: delta({ delta: { endpoints: { current: { run_id: 'run_a', computed_at: RUN_AT } } } }),
      analysisStateV1: { run_state: { kind: 'complete_current', computed_at: RUN_AT } },
    } as never)
    adoptChangedSinceRun(SID, wire({ since_run_id: 'run_a' }))
    renderInFlow()
    expect(screen.queryByTestId(LIGHT)).toBeNull()
    act(() => adoptChangedSinceRun(SID, wire()))
    expect(screen.queryByTestId(LIGHT)).toBeNull()
    act(() => useCanvasStore.setState({ analysisStateV1: null }))
    act(() => screen.getByTestId(LIGHT).focus())
    expect(lightingCss()).toContain('rf__node-f')
  })

  it('a newer canonical Run without a delta cannot borrow an inherited direct run_b id', () => {
    useCanvasStore.setState({ analysisStateV1: { run_state: { kind: 'complete_current', computed_at: RUN_AT } } } as never)
    adoptChangedSinceRun(SID, wire())
    renderInFlow()
    expect(screen.queryByTestId(LIGHT)).toBeNull()
  })

  it.each([null, { run_state: {} }, { run_state: { kind: 'complete_current', computed_at: '' } }])(
    'V5 cannot identify displayed run_b from a delta when canonical Run time is absent (%j)', (analysisStateV1) => {
      useCanvasStore.setState({
        results: { ...useCanvasStore.getState().results, resultsSource: 'conversation' },
        runDelta: delta(), analysisStateV1,
      } as never)
      adoptChangedSinceRun(SID, wire())
      renderInFlow()
      expect(screen.queryByTestId(LIGHT)).toBeNull()
    },
  )

  it.each<[string, ReturnType<typeof delta>]>([
    ['another analysis hash', delta({ analysisHash: 'hash_a' })],
    ['another scenario', delta({ scenarioId: 'scn-other' })],
    ['another endpoint Run', delta({ delta: { endpoints: { current: { run_id: 'run_a', computed_at: RUN_AT } } } })],
    ['an older endpoint time despite a colliding hash', delta({ delta: { endpoints: { current: { run_id: 'run_b', computed_at: '2026-10-07T00:00:00.000Z' } } } })],
    ['an endpoint without a recorded time', delta({ delta: { endpoints: { current: { run_id: 'run_b' } } } })],
  ])('V5 refuses a Run id bound to %s', (_label, runDelta) => {
    useCanvasStore.setState({
      results: { ...useCanvasStore.getState().results, resultsSource: 'conversation' },
      runDelta, analysisStateV1: { run_state: { kind: 'complete_current', computed_at: RUN_AT } },
    } as never)
    adoptChangedSinceRun(SID, wire())
    renderInFlow()
    expect(screen.queryByTestId(LIGHT)).toBeNull()
  })

  it('Run A → complete Run B → edit again never revives A-relative changes beside B’s findings', () => {
    useCanvasStore.setState({ results: { ...useCanvasStore.getState().results, runId: 'run_a', hash: 'hash_a' } })
    adoptChangedSinceRun(SID, wire({ since_run_id: 'run_a' }))
    const { rerender } = renderInFlow()
    fireEvent.click(screen.getByTestId(LIGHT))
    expect(lightingCss()).toContain('rf__node-f')
    trust.semantic = 'current'
    act(() => useCanvasStore.setState({ results: {
      ...useCanvasStore.getState().results, runId: 'run_b', hash: 'hash_b', runEpoch: 2, reportEpoch: 2,
    } }))
    rerender(
      <div className="react-flow" data-testid="flow">
        <div className="react-flow__pane" data-testid="pane" />
        <div className="react-flow__node" data-testid="rf__node-g" />
        <AnalysisStateCue />
      </div>,
    )
    expect(screen.queryByTestId(ANALYSIS_STATE_CUE_TESTID)).toBeNull()
    trust.semantic = 'changed'
    rerender(
      <div className="react-flow" data-testid="flow">
        <div className="react-flow__pane" data-testid="pane" />
        <div className="react-flow__node" data-testid="rf__node-g" />
        <AnalysisStateCue />
      </div>,
    )
    expect(screen.getByTestId(ANALYSIS_STATE_CUE_TESTID).textContent).toBe(ANALYSIS_STATE_CUE_COPY)
    expect(screen.queryByTestId(LIGHT)).toBeNull()
    expect(lightingCss()).toBeNull()
    act(() => adoptChangedSinceRun(SID, wire({ node_ids: ['g'], links: [{ from: 'g', to: 'o' }] })))
    expect(screen.getByTestId(LIGHT)).toHaveAttribute('aria-pressed', 'false')
    expect(lightingCss()).toBeNull()
    act(() => screen.getByTestId(LIGHT).focus())
    expect(lightingCss()).toContain('rf__node-g')
    expect(lightingCss()).toContain('rf__edge-e3')
    expect(lightingCss()).not.toContain('rf__node-f')
    expect(lightingCss()).not.toContain('rf__edge-e1')
  })

  it('new run_c findings and changes arriving together invalidate run_b’s focus and pin', () => {
    adoptChangedSinceRun(SID, wire())
    renderInFlow()
    const light = screen.getByTestId(LIGHT)
    act(() => light.focus())
    fireEvent.click(light)
    act(() => {
      useCanvasStore.setState({ results: {
        ...useCanvasStore.getState().results, runId: 'run_c', hash: 'hash_c', runEpoch: 2, reportEpoch: 2,
      } })
      adoptChangedSinceRun(SID, wire({ since_run_id: 'run_c', node_ids: ['g'], links: [{ from: 'g', to: 'o' }] }))
    })
    expect(screen.getByTestId(LIGHT)).toBe(light)
    expect(light).toHaveAttribute('aria-pressed', 'false')
    expect(lightingCss()).toBeNull()
  })

  it('keyboard: focus lights exactly the named node and the link by its two ends; blur clears', () => {
    adoptChangedSinceRun(SID, wire())
    renderInFlow()
    const light = screen.getByTestId(LIGHT)
    // The status line's words are unchanged: the toggle IS the sentence.
    expect(screen.getByTestId(ANALYSIS_STATE_CUE_TESTID).textContent).toBe(ANALYSIS_STATE_CUE_COPY)
    expect(lightingCss()).toBeNull()
    act(() => light.focus())
    const css = lightingCss()!
    expect(css).toContain('[data-testid="rf__node-f"]')
    expect(css).toContain('[data-testid="rf__edge-e1"]')
    // Contrast by identity: an unnamed node, the reversed link and an unrelated link stay dark.
    expect(css).not.toContain('rf__node-g"')
    expect(css).not.toContain('rf__node-o"')
    expect(css).not.toContain('rf__edge-e2"')
    expect(css).not.toContain('rf__edge-e3"')
    act(() => light.blur())
    expect(lightingCss()).toBeNull()
  })

  it('the toggle is named by the visible sentence; its action hint is a separate description', () => {
    adoptChangedSinceRun(SID, wire())
    renderInFlow()
    const light = screen.getByTestId(LIGHT)
    expect(light).toHaveAccessibleName(ANALYSIS_STATE_CUE_COPY)
    expect(light).toHaveAccessibleDescription('Show what changed since the last run')
    expect(light).not.toHaveAttribute('aria-label')
  })

  it('link e1 lighting wins over StyledEdge’s inline stroke and strokeWidth', () => {
    adoptChangedSinceRun(SID, wire())
    renderInFlow()
    act(() => screen.getByTestId(LIGHT).focus())
    const edge = screen.getByTestId('rf__edge-e1')
    const path = edge.querySelector<SVGPathElement>('.react-flow__edge-path')!
    expect(path.style.stroke).toBe('var(--edge-stroke)')
    expect(path.style.strokeWidth).toBe('1.5')
    const style = screen.getByTestId(LIGHTING) as HTMLStyleElement
    const edgeRule = [...style.sheet!.cssRules].find((rule) =>
      (rule as CSSStyleRule).selectorText.includes('[data-testid="rf__edge-e1"]'),
    ) as CSSStyleRule
    expect(edgeRule).toBeDefined()
    for (const selector of edgeRule.selectorText.split(',')) {
      expect(path.matches(selector)).toBe(true)
      expect(screen.getByTestId('rf__node-g').matches(selector)).toBe(false)
      expect(screen.getByTestId('rf__edge-e2').querySelector('path')!.matches(selector)).toBe(false)
      expect(screen.getByTestId('rf__edge-e3').querySelector('path')!.matches(selector)).toBe(false)
    }
    expect(edgeRule.style.getPropertyValue('stroke')).toBe('var(--info)')
    expect(edgeRule.style.getPropertyPriority('stroke')).toBe('important')
    expect(edgeRule.style.getPropertyValue('stroke-width')).toBe('3px')
    expect(edgeRule.style.getPropertyPriority('stroke-width')).toBe('important')
  })

  it('a press pins the lighting; a second press, or Esc, clears it', () => {
    adoptChangedSinceRun(SID, wire())
    renderInFlow()
    const light = screen.getByTestId(LIGHT)
    fireEvent.click(light)
    expect(light).toHaveAttribute('aria-pressed', 'true')
    expect(lightingCss()).toContain('rf__node-f')
    fireEvent.click(light)
    expect(lightingCss()).toBeNull()
    fireEvent.click(light)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(light).toHaveAttribute('aria-pressed', 'false')
    expect(lightingCss()).toBeNull()
  })

  it('keyboard: a second activation and Escape dismiss lighting while focus remains; refocus restores it', () => {
    adoptChangedSinceRun(SID, wire())
    renderInFlow()
    const light = screen.getByTestId(LIGHT)
    act(() => light.focus())
    fireEvent.click(light)
    fireEvent.click(light)
    expect(light).toHaveFocus()
    expect(light).toHaveAttribute('aria-pressed', 'false')
    expect(lightingCss()).toBeNull()
    act(() => light.blur())
    act(() => light.focus())
    expect(lightingCss()).toContain('rf__node-f')
    fireEvent.click(light)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(light).toHaveFocus()
    expect(light).toHaveAttribute('aria-pressed', 'false')
    expect(lightingCss()).toBeNull()
    act(() => light.blur())
    act(() => light.focus())
    expect(lightingCss()).toContain('rf__node-f')
  })

  it('pointer: a second pane click and Escape dismiss lighting until the pointer leaves and returns', () => {
    adoptChangedSinceRun(SID, wire())
    renderInFlow()
    const sentence = screen.getByTestId(ANALYSIS_STATE_CUE_TESTID)
    sentence.getBoundingClientRect = () => ({ left: 10, right: 250, top: 700, bottom: 713, width: 240, height: 13, x: 10, y: 700, toJSON: () => ({}) })
    const at = (x: number, type = 'pointermove') =>
      act(() => { screen.getByTestId('pane').dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x, clientY: 706 })) })
    at(50)
    at(50, 'click')
    at(50, 'click')
    expect(screen.getByTestId(LIGHT)).toHaveAttribute('aria-pressed', 'false')
    expect(lightingCss()).toBeNull()
    at(51)
    expect(lightingCss()).toBeNull()
    at(400)
    at(50)
    expect(lightingCss()).toContain('rf__node-f')
    fireEvent.keyDown(document, { key: 'Escape' })
    at(51)
    expect(lightingCss()).toBeNull()
    at(400)
    at(50)
    expect(lightingCss()).toContain('rf__node-f')
    at(50, 'click')
    fireEvent.keyDown(document, { key: 'Escape' })
    at(51)
    expect(lightingCss()).toBeNull()
  })

  it('pointer: a PANE hit over the sentence lights the set; the same point on a CARD does not (the board wins)', () => {
    adoptChangedSinceRun(SID, wire())
    renderInFlow()
    const sentence = screen.getByTestId(ANALYSIS_STATE_CUE_TESTID)
    sentence.getBoundingClientRect = () => ({ left: 10, right: 250, top: 700, bottom: 713, width: 240, height: 13, x: 10, y: 700, toJSON: () => ({}) })
    const at = (target: Element, x: number, y: number, type = 'pointermove') =>
      act(() => { target.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y })) })
    at(screen.getByTestId('rf__node-g'), 50, 706)
    expect(lightingCss()).toBeNull()
    at(screen.getByTestId('pane'), 400, 706)
    expect(lightingCss()).toBeNull()
    at(screen.getByTestId('pane'), 50, 706)
    expect(lightingCss()).toContain('rf__node-f')
    expect(screen.getByTestId('flow')).toHaveAttribute('data-analysis-cue-hover')
    at(screen.getByTestId('pane'), 50, 706, 'click')
    at(screen.getByTestId('pane'), 400, 706)
    expect(lightingCss()).toContain('rf__node-f') // pinned by the click
    expect(screen.getByTestId('flow')).not.toHaveAttribute('data-analysis-cue-hover')
  })

  it('changes CEE cannot place are said once, as a count, only while lit', () => {
    adoptChangedSinceRun(SID, wire({ unattributed_changes: 2 }))
    renderInFlow()
    expect(screen.queryByText('2 other changes since the last Run')).toBeNull()
    fireEvent.click(screen.getByTestId(LIGHT))
    expect(screen.getByText('2 other changes since the last Run')).toBeInTheDocument()
  })

  it('the count grows above the bottom-anchored sentence, leaving its pane hit target fixed', () => {
    // JSDOM does not lay out flex children: pin the cascade that anchors the first child at the bottom.
    const css = readFileSync(resolve(__dirname, '../AnalysisStateCue.module.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    const slotRule = [...css.matchAll(/\.slot\s*\{([^}]*)\}/g)].at(-1)?.[1] ?? ''
    expect(slotRule).toMatch(/flex-direction\s*:\s*column-reverse/)
    expect(slotRule).toMatch(/justify-content\s*:\s*flex-start/)
    adoptChangedSinceRun(SID, wire({ unattributed_changes: 2 }))
    renderInFlow()
    const sentence = screen.getByTestId(ANALYSIS_STATE_CUE_TESTID)
    sentence.getBoundingClientRect = () => ({ left: 10, right: 250, top: 700, bottom: 713, width: 240, height: 13, x: 10, y: 700, toJSON: () => ({}) })
    const at = (type: string) =>
      act(() => { screen.getByTestId('pane').dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: 50, clientY: 706 })) })
    at('pointermove')
    expect(screen.getByText('2 other changes since the last Run')).toBeInTheDocument()
    expect(screen.getByTestId(ANALYSIS_STATE_CUE_TESTID)).toBe(sentence)
    at('click')
    expect(screen.getByTestId(LIGHT)).toHaveAttribute('aria-pressed', 'true')
  })

  it('focus → sentence removed by a Run → return has no focus, pin or lighting on the retained cue instance', () => {
    adoptChangedSinceRun(SID, wire())
    const { rerender } = renderInFlow()
    const node = screen.getByTestId('rf__node-g')
    act(() => screen.getByTestId(LIGHT).focus())
    expect(lightingCss()).toContain('rf__node-f')
    trust.semantic = 'current'
    rerender(
      <div className="react-flow" data-testid="flow">
        <div className="react-flow__pane" data-testid="pane" />
        <div className="react-flow__node" data-testid="rf__node-g" />
        <AnalysisStateCue />
      </div>,
    )
    expect(screen.queryByTestId(LIGHT)).toBeNull()
    trust.semantic = 'changed'
    rerender(
      <div className="react-flow" data-testid="flow">
        <div className="react-flow__pane" data-testid="pane" />
        <div className="react-flow__node" data-testid="rf__node-g" />
        <AnalysisStateCue />
      </div>,
    )
    expect(screen.getByTestId('rf__node-g')).toBe(node)
    expect(screen.getByTestId(LIGHT)).not.toHaveFocus()
    expect(screen.getByTestId(LIGHT)).toHaveAttribute('aria-pressed', 'false')
    expect(lightingCss()).toBeNull()
  })

  it('a Run that makes the model current takes the sentence, and the pin, with it', () => {
    adoptChangedSinceRun(SID, wire())
    const { rerender } = renderInFlow()
    const node = screen.getByTestId('rf__node-g')
    fireEvent.click(screen.getByTestId(LIGHT))
    expect(lightingCss()).not.toBeNull()
    trust.semantic = 'current'
    rerender(
      <div className="react-flow" data-testid="flow">
        <div className="react-flow__pane" data-testid="pane" />
        <div className="react-flow__node" data-testid="rf__node-g" />
        <AnalysisStateCue />
      </div>,
    )
    expect(screen.queryByTestId('rf__node-g')).toBe(node)
    expect(screen.queryByTestId(ANALYSIS_STATE_CUE_TESTID)).toBeNull()
    expect(lightingCss()).toBeNull()
    trust.semantic = 'changed'
    rerender(
      <div className="react-flow" data-testid="flow">
        <div className="react-flow__pane" data-testid="pane" />
        <div className="react-flow__node" data-testid="rf__node-g" />
        <AnalysisStateCue />
      </div>,
    )
    expect(screen.queryByTestId('rf__node-g')).toBe(node)
    expect(screen.getByTestId(LIGHT)).toHaveAttribute('aria-pressed', 'false')
    expect(lightingCss()).toBeNull()
  })
})

describe('P48: the lighting rule keeps an id exact', () => {
  it('a line break in an edge id is escaped, never folded into a space that names another edge', () => {
    const host = document.createElement('div')
    host.className = 'react-flow'
    host.innerHTML = '<svg><g class="changed"><path class="react-flow__edge-path"/></g><g class="other"><path class="react-flow__edge-path"/></g></svg>'
    document.body.appendChild(host)
    host.querySelector('.changed')!.setAttribute('data-testid', 'rf__edge-e\n1')
    host.querySelector('.other')!.setAttribute('data-testid', 'rf__edge-e 1')
    const sheet = document.createElement('style')
    sheet.textContent = changedSetLightingCss([], ['e\n1'])
    document.head.appendChild(sheet)
    const rule = (sheet.sheet!.cssRules[0] as CSSStyleRule).selectorText
    expect(host.querySelector('.changed path')!.matches(rule)).toBe(true)
    expect(host.querySelector('.other path')!.matches(rule)).toBe(false)
    sheet.remove()
    host.remove()
  })
})

describe('P48: the node lighting rule reaches the changed node itself', () => {
  it('node f matches the rule and carries the outline; unchanged node g does not match', () => {
    const host = document.createElement('div')
    host.className = 'react-flow'
    host.innerHTML = '<div class="react-flow__node" data-testid="rf__node-f"></div><div class="react-flow__node" data-testid="rf__node-g"></div>'
    document.body.appendChild(host)
    const sheet = document.createElement('style')
    sheet.textContent = changedSetLightingCss(['f'], [])
    document.head.appendChild(sheet)
    const rule = sheet.sheet!.cssRules[0] as CSSStyleRule
    expect(host.querySelector('[data-testid="rf__node-f"]')!.matches(rule.selectorText)).toBe(true)
    expect(host.querySelector('[data-testid="rf__node-g"]')!.matches(rule.selectorText)).toBe(false)
    expect(rule.style.getPropertyValue('outline')).toContain('dashed')
    sheet.remove()
    host.remove()
  })
})
