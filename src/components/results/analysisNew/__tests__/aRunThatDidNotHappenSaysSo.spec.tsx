/**
 * ⭐⭐ A RUN THAT DID NOT HAPPEN SAYS SO, ON THE REASONING TAB.
 *
 * ── THE MEASURED GAP (code map at `714b2d9a`, 24 Sep 2026) ─────────────────
 * The legacy Results tab states a refused run through `AnalysisStateRegion`
 * (`OutputsDock.tsx` ~3807). The Reasoning tab mounts neither the region nor
 * the notice, and `useAnalysisRunState()` had ONE reader, the Results tab. So:
 *
 *   - a REFUSED first run read "No analysis has run yet for this model.";
 *   - a REFUSED re-run showed the previous result under "We cannot confirm
 *     whether this analysis reflects the current model." and never said the
 *     latest run did not happen;
 *   - an ERRORED re-run whose previous verdict was still `fresh` showed the
 *     old result with NO marker at all (`analysisNotConfirmedFresh` has no
 *     error term, `OutputsDock.tsx:1129`).
 *
 * ── WHAT THIS PINS ─────────────────────────────────────────────────────────
 * 1. The refusal is stated in the tab's OWN status slots (the pre-run sentence;
 *    the glance's status line), never as a second `AnalysisRefusalNotice` mount
 *    — `analysisStateRegion.mountSites.spec.ts` keeps that to one file.
 * 2. Its reason is CEE's `blocked_reason` through the SAME mapper the Results
 *    tab uses; an unmapped code gets the honest generic and never the raw code.
 * 3. A failed run after a displayed result says the result is the previous
 *    one, whatever the old freshness verdict was.
 * 4. A run in flight supersedes both: the note is about a finished attempt.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))
const runState = { value: 'complete_current' as string }
vi.mock('../../analysisState/useAnalysisRunState', () => ({ useAnalysisRunState: () => runState.value }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { useCanvasStore } from '../../../../canvas/store'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import {
  ANALYSIS_REFUSAL_GENERIC_REASON,
  ANALYSIS_REFUSAL_HEADLINE,
  ANALYSIS_REFUSAL_REASON_COPY,
} from '../../../../canvas/store/analysisRefusalNotice'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import { genuineDecision, openStrategicChallenge } from './analysisNewFixtures'

const MAPPED = 'options_not_configured'

const renderTab = (
  data: ResultsSectionDataReturn,
  over: { isPreRun: boolean; isStale?: boolean; isRunning?: boolean },
) =>
  render(
    <AnalysisNewTabBody
      resultsSectionData={data}
      isPreRun={over.isPreRun}
      isRunning={over.isRunning ?? false}
      isStale={over.isStale ?? false}
      responseHash="run_latest_note"
    />,
  )

const refuse = (blockedReason: string) =>
  useCanvasStore.setState({ analysisRefusalNotice: { blockedReason, computedAt: null } } as never)
const setResultsStatus = (status: string) =>
  useCanvasStore.setState({ results: { ...useCanvasStore.getState().results, status } } as never)

let previous: Record<string, unknown>
beforeEach(() => {
  const s = useCanvasStore.getState() as unknown as Record<string, unknown>
  previous = { analysisRefusalNotice: s.analysisRefusalNotice, results: s.results }
  useStrengthenStore.setState({ records: {} } as never)
  runState.value = 'complete_current'
  setResultsStatus('complete')
})
afterEach(() => {
  cleanup()
  useCanvasStore.setState(previous as never)
})

describe('a refused FIRST run', () => {
  it('PRECONDITION: the mapped code has copy, so the reason is not the generic', () => {
    expect(ANALYSIS_REFUSAL_REASON_COPY[MAPPED]).toBeTruthy()
  })

  it('states that it did not run, with CEE\'s reason, instead of "No analysis has run yet"', () => {
    runState.value = 'refused'
    refuse(MAPPED)
    renderTab(openStrategicChallenge(), { isPreRun: true })
    const block = screen.getByTestId('analysis-new-status-pre-run')
    const note = screen.getByTestId('analysis-new-status-did-not-run')
    expect(block).toContainElement(note)
    expect(note).toHaveTextContent(ANALYSIS_REFUSAL_HEADLINE)
    expect(note).toHaveTextContent(ANALYSIS_REFUSAL_REASON_COPY[MAPPED])
    expect(block).not.toHaveTextContent(COPY.status.preRun)
  })

  it('an unmapped code gets the honest generic, never the raw code', () => {
    runState.value = 'refused'
    refuse('some_code_ui_has_never_seen')
    renderTab(openStrategicChallenge(), { isPreRun: true })
    const note = screen.getByTestId('analysis-new-status-did-not-run')
    expect(note).toHaveTextContent(ANALYSIS_REFUSAL_GENERIC_REASON)
    expect(note.textContent).not.toMatch(/some_code_ui_has_never_seen/)
  })

  it('CONTRAST: no refusal held ⇒ the pre-run sentence is unchanged', () => {
    runState.value = 'never_run'
    renderTab(openStrategicChallenge(), { isPreRun: true })
    expect(screen.queryByTestId('analysis-new-status-did-not-run')).toBeNull()
    expect(screen.getByTestId('analysis-new-status-pre-run')).toHaveTextContent(COPY.status.preRun)
  })
})

describe('a refused RE-run, with the previous result displayed', () => {
  it('the status line says the latest run did not happen and that this is the previous result', () => {
    runState.value = 'refused'
    refuse(MAPPED)
    renderTab(genuineDecision(), { isPreRun: false, isStale: true })
    const note = screen.getByTestId('analysis-new-status-did-not-run')
    expect(note).toHaveTextContent(COPY.status.latestDidNotRun)
    expect(note).toHaveTextContent(ANALYSIS_REFUSAL_REASON_COPY[MAPPED])
    expect(note).toHaveTextContent(COPY.status.showingPrevious)
    // The vaguer "cannot confirm" line is superseded, not stacked beside it.
    expect(screen.queryByTestId('analysis-new-status-freshness-unknown')).toBeNull()
  })
})

describe('a FAILED run', () => {
  it('⭐ after a displayed result whose verdict was fresh, the result is marked as the previous one', () => {
    runState.value = 'unknown_degraded'
    setResultsStatus('error')
    renderTab(genuineDecision(), { isPreRun: false, isStale: false })
    const note = screen.getByTestId('analysis-new-status-run-failed')
    expect(note).toHaveTextContent(COPY.status.latestRunFailed)
    expect(note).toHaveTextContent(COPY.status.showingPrevious)
  })

  it('on a first run, the pre-run block says the last run did not complete', () => {
    runState.value = 'never_run'
    setResultsStatus('error')
    renderTab(openStrategicChallenge(), { isPreRun: true })
    const block = screen.getByTestId('analysis-new-status-pre-run')
    expect(block).toContainElement(screen.getByTestId('analysis-new-status-run-failed'))
    expect(block).not.toHaveTextContent(COPY.status.preRun)
  })

  it('CONTRAST: a completed run carries neither note', () => {
    renderTab(genuineDecision(), { isPreRun: false })
    expect(screen.queryByTestId('analysis-new-status-run-failed')).toBeNull()
    expect(screen.queryByTestId('analysis-new-status-did-not-run')).toBeNull()
  })
})

describe('a run in flight supersedes the note', () => {
  it('neither note renders while a run is running, even with a refusal and an error still held', () => {
    runState.value = 'running'
    refuse(MAPPED)
    setResultsStatus('error')
    renderTab(genuineDecision(), { isPreRun: false, isRunning: true })
    expect(screen.queryByTestId('analysis-new-status-did-not-run')).toBeNull()
    expect(screen.queryByTestId('analysis-new-status-run-failed')).toBeNull()
  })
})

/**
 * ⛔ REVIEW 5820019088 (BLOCKING): the wire can say `blocked` with NO typed
 * refusal held (a reachable mapper state, `useAnalysisRunState.mapping.spec.ts`),
 * and the note fell through to silence. It is stated as the model needing a
 * change, never as an attempt that was stopped.
 */
describe('the wire says blocked, with no refusal held', () => {
  it('before a run: the model needs a change, not "No analysis has run yet"', () => {
    runState.value = 'blocked'
    renderTab(openStrategicChallenge(), { isPreRun: true })
    const block = screen.getByTestId('analysis-new-status-pre-run')
    const note = screen.getByTestId('analysis-new-status-blocked')
    expect(block).toContainElement(note)
    expect(note).toHaveTextContent(ANALYSIS_REFUSAL_REASON_COPY.analysis_not_ready)
    expect(block).not.toHaveTextContent(COPY.status.preRun)
    expect(screen.queryByTestId('analysis-new-status-did-not-run')).toBeNull()
  })

  it('after a run: the status line says the model needs a change and this is the previous result', () => {
    runState.value = 'blocked'
    renderTab(genuineDecision(), { isPreRun: false })
    const note = screen.getByTestId('analysis-new-status-blocked')
    expect(note).toHaveTextContent(COPY.status.latestBlocked)
    expect(note).toHaveTextContent(COPY.status.showingPrevious)
  })
})

describe('the wire\'s precedence holds over a stale error flag', () => {
  it('a wire-current run with a leftover results error carries no "did not complete" note', () => {
    runState.value = 'complete_current'
    setResultsStatus('error')
    renderTab(genuineDecision(), { isPreRun: false })
    expect(screen.queryByTestId('analysis-new-status-run-failed')).toBeNull()
  })
})
