/**
 * P48 (audit #27, GAP-11): the ONE graph-level cue lights the set CEE says changed since the last Run — on demand, by
 * id, and never as a mark on a card. Driven through the real `adoptChangedSinceRun` (the hydration's writer) and the
 * real `useModelChangedSinceRun` (the trust verdict is the only mock, as in AnalysisStateCue.spec).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import type { FreshnessDisplaySemantic } from '../../store/analysisFreshness'

const trust: { semantic: FreshnessDisplaySemantic | undefined } = { semantic: 'changed' }
vi.mock('../../hooks/useAnalysisTrust', () => ({ useAnalysisTrust: () => ({ semantic: trust.semantic }) }))

import { AnalysisStateCue, ANALYSIS_STATE_CUE_COPY, ANALYSIS_STATE_CUE_TESTID } from '../AnalysisStateCue'
import { useCanvasStore } from '../../store'
import { adoptChangedSinceRun, useChangedSinceRunStore } from '../../changes/changedSinceRun'

const SID = 'scn-p48'
const REPORT = { option_comparison: [{ option_id: 'a', outcome: { mean: 1, p10: 0, p50: 1, p90: 2 } }] }
const wire = (over: Record<string, unknown> = {}) => ({
  version: 1, since_run_id: 'run_b', node_ids: ['f'], links: [{ from: 'f', to: 'o' }], unattributed_changes: 0, complete: true, ...over,
})
const LIGHT = `${ANALYSIS_STATE_CUE_TESTID}-light`
const LIGHTING = `${ANALYSIS_STATE_CUE_TESTID}-lighting`
const lightingCss = () => screen.queryByTestId(LIGHTING)?.textContent ?? null

/** The cue inside a `.react-flow` root with a pane, as ReactFlowGraph mounts it. */
function renderInFlow() {
  return render(
    <div className="react-flow" data-testid="flow">
      <div className="react-flow__pane" data-testid="pane" />
      <div className="react-flow__node" data-testid="rf__node-g" />
      <AnalysisStateCue />
    </div>,
  )
}

beforeEach(() => {
  trust.semantic = 'changed'
  useCanvasStore.setState({
    currentScenarioId: SID,
    results: { status: 'complete', report: REPORT },
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

  it('a Run that makes the model current takes the sentence, and the pin, with it', () => {
    adoptChangedSinceRun(SID, wire())
    const { rerender } = renderInFlow()
    fireEvent.click(screen.getByTestId(LIGHT))
    expect(lightingCss()).not.toBeNull()
    trust.semantic = 'current'
    rerender(
      <div className="react-flow" data-testid="flow">
        <div className="react-flow__pane" data-testid="pane" />
        <AnalysisStateCue />
      </div>,
    )
    expect(screen.queryByTestId(ANALYSIS_STATE_CUE_TESTID)).toBeNull()
    expect(lightingCss()).toBeNull()
  })
})
