/**
 * The first pair after the user sizes their links (DL 58e392 ruling 2, 8 Oct): the earlier Run withheld its shares, so
 * CEE sends `win_probabilities: []` + `prior_withheld`. Compare draws each option's LATEST marker only, from the latest
 * Run's own shares, with Science github-93's words for the earlier side. Bound by IDENTITY: positions are checked per
 * option id against the report's own share, and every "drawn" row has a control that is not.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { AnalysisStateV1Schema } from '@talchain/schemas/boundary'
import { useCanvasStore } from '../../store'
import { mapV5AnalysisToReport } from '../../../v5/mapV5AnalysisToReport'
import { WHATS_CHANGED_FIRST_COMPARISON } from '../../../components/results/analysisNew/sections/WhatsChanged'
import { CompareRunPairBody } from '../CompareRunPairBody'
import { COMPARE_EARLIER_NOT_SHOWN, COMPARE_LATEST_ONLY_TEXT } from '../CompareSupportFigures'
import { RUN_CHANGE_LABELS, runChangeDelta } from './__fixtures__/runChangeArtefact'

const original = useCanvasStore.getState()
const SHARES = { opt_60: 0.1, opt_49: 0.9 }
type Reason = 'prior_withheld' | 'no_matched_option'

function seed({ reason = 'prior_withheld' as Reason, permitted = true, current = true, failed = null as string | null } = {}): string {
  const report = mapV5AnalysisToReport({ type: 'analysis_result', summary: 'Options compared', leading_option_id: 'opt_49', win_probabilities: SHARES })
  report.producer_leader_permission = { permitted }
  if (failed) (report.option_probabilities as unknown as Record<string, Record<string, unknown>>)[failed].status = 'failed'
  const hash = report.model_card.response_hash
  useCanvasStore.setState({ currentScenarioId: 'scn-1',
    nodes: [...RUN_CHANGE_LABELS.keys()].map((id) => ({ id, type: id.startsWith('opt') ? 'option' : 'factor', position: { x: 0, y: 0 }, data: { label: RUN_CHANGE_LABELS.get(id) } })),
    edges: [],
    results: { status: 'complete', progress: 100, report, hash },
    runDelta: { delta: runChangeDelta({ win_probabilities: [], win_probabilities_unavailable: reason }), analysisHash: hash, scenarioId: 'scn-1' },
    analysisStateV1: AnalysisStateV1Schema.parse({
      run_state: { kind: 'complete_current', computed_at: '2026-09-30T13:09:00.000Z' }, readiness: { status: 'ready', blockers: [] },
      leader_claim: { permitted: true }, robustness: {}, usable_for_prose: true, usable_for_chips: true, usable_for_followup: true,
      requires_rerun: false, blocked_unusable: false, contradictions: [],
    }),
    analysisFreshness: current ? { freshness: 'fresh', freshnessReason: 'graph_hash_match' } : { freshness: 'stale', freshnessReason: 'graph_hash_mismatch' },
    analysisFreshnessDirty: !current,
    importPendingServerRegistration: false, hasCompletedFirstRun: true, ceeAnalysisReady: null,
  } as never)
  return hash
}

const block = () => screen.queryByTestId('compare-latest-only')
const markersByOption = () => Object.fromEntries(screen.getAllByTestId('compare-latest-only-option').map((li) => [
  li.dataset.optionId,
  // The producer's own value, carried unaltered beside the drawn position (jsdom cannot read a clamp() back).
  [...li.querySelectorAll('[data-marker]')].map((m) => `${(m as HTMLElement).dataset.marker}@${(m as HTMLElement).dataset.current}`),
]))

beforeEach(() => { useCanvasStore.setState(original, true) })
afterEach(() => { cleanup(); useCanvasStore.setState(original, true) })

describe('Compare: the first sized pair draws the latest side only', () => {
  it('prior_withheld: one LATEST marker per option, at the report\'s own share, by id; no earlier marker (control: no_matched_option draws none)', () => {
    render(<CompareRunPairBody responseHash={seed()} />)
    expect(markersByOption()).toEqual({
      opt_60: [`latest@${SHARES.opt_60}`],
      opt_49: [`latest@${SHARES.opt_49}`],
    })
    expect(screen.getByTestId('compare-latest-only-note').textContent).toBe(COMPARE_LATEST_ONLY_TEXT)
    expect(screen.getByTestId('compare-latest-only-legend').textContent).toContain(COMPARE_EARLIER_NOT_SHOWN)
    // RC's first-comparison sentence stays; the latest side is drawn under it.
    expect(screen.getByText(WHATS_CHANGED_FIRST_COMPARISON)).toBeTruthy()
    cleanup()
    render(<CompareRunPairBody responseHash={seed({ reason: 'no_matched_option' })} />)
    expect(block()).toBeNull()
  })

  it('draws no number: positions only, as the two-marker figures (control: the shares are in the report)', () => {
    render(<CompareRunPairBody responseHash={seed()} />)
    expect(block()!.textContent).not.toMatch(/\d\s*%/)
    expect(Object.keys(markersByOption())).toHaveLength(2)
  })

  it('an option the producer says failed gets no marker (control: the computed one keeps its marker)', () => {
    render(<CompareRunPairBody responseHash={seed({ failed: 'opt_60' })} />)
    expect(Object.keys(markersByOption())).toEqual(['opt_49'])
  })

  it('a withheld or out-of-date latest Run draws nothing (control: the same pair, current and permitted, draws)', () => {
    render(<CompareRunPairBody responseHash={seed({ permitted: false })} />)
    expect(block()).toBeNull()
    cleanup()
    render(<CompareRunPairBody responseHash={seed({ current: false })} />)
    expect(block()).toBeNull()
    cleanup()
    render(<CompareRunPairBody responseHash={seed()} />)
    expect(block()).not.toBeNull()
  })

  it('a report that is not the delta\'s latest Run draws nothing (control: the bound one does)', () => {
    const hash = seed()
    render(<CompareRunPairBody responseHash={`${hash}-other`} />)
    expect(block()).toBeNull()
    cleanup()
    render(<CompareRunPairBody responseHash={hash} />)
    expect(within(block()!).getAllByTestId('compare-latest-only-option')).toHaveLength(2)
  })
})
