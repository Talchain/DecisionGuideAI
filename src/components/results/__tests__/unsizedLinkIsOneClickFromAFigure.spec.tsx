/**
 * B3c · DL [R2] (5930827933): an option withheld on the placeholder path shows its acceptable unsized links (B2
 * `acceptable_links`) with "Accept starting strength" (the canvas's own `confirm_current` path) and "Edit" (the link's
 * strength editor). Served run `0303ef5` plus a PLACEHOLDER_PATH warning on one option.
 *
 * #2408 CR (CODEX_CLI_OVERFLOW): the action exists only while it can still be true. These rows cover the Run being
 * current (render + click), the edge still being a placeholder (same edge before/after sizing, render + click), and
 * accepted-Olumi vs user-stated provenance never reading the same way.
 */
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, renderHook, screen, cleanup, fireEvent, act } from '@testing-library/react'

const confirm = vi.fn()
const openEditor = vi.fn()
vi.mock('../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))

import { useCanvasStore } from '../../../canvas/store'
import { mapV5AnalysisToReport } from '../../../v5/mapV5AnalysisToReport'
import { useResultsSectionData } from '../useResultsSectionData'
import { AnalysisNewTabBody } from '../analysisNew/AnalysisNewTabBody'
import { selectRunAffirmedCurrent } from '../../../canvas/state/analysisStateSelector'
import { useAnalysisTrust } from '../../../canvas/hooks/useAnalysisTrust'
import served from '../../../canvas/__tests__/fixtures/served-0303ef5-pricing-withheld-run.json'

afterEach(() => {
  cleanup()
  confirm.mockReset()
  openEditor.mockReset()
  useCanvasStore.setState({
    results: { status: 'idle', progress: 0 } as never,
    nodes: [] as never,
    edges: [] as never,
    hasCompletedFirstRun: false,
    analysisFreshness: null,
    analysisFreshnessDirty: false,
    importPendingServerRegistration: false,
  } as never)
})

const HELD = '59_with_next_release'
const WARNING = {
  code: 'GOAL_FIGURES_PLACEHOLDER_PATH',
  severity: 'warning',
  message: "Not shown. Olumi can't give this option's figures until a link on its path is sized.",
  option_ids: [HELD],
  acceptable_links: [{ from: 'fac_price', to: 'out1' }, { from: 'fac_gone', to: 'out1' }],
}

const PLACEHOLDER = { strength_mean: 0.5, weightSource: 'cee', strengthPlaceholder: 0.5 }
/** After Accept: CEE sized it as Olumi's estimate (no placeholder label on the wire, so none on the edge). */
const ACCEPTED_OLUMI = { strength_mean: 0.5, weightSource: 'cee' }
/** After Edit: the person stated it (`weightSource: 'user'` outranks the stale placeholder key). */
const USER_STATED = { strength_mean: 0.7, weightSource: 'user', strengthPlaceholder: 0.5 }

function seed(opts: { edgeData?: Record<string, unknown>; warning?: Record<string, unknown>; current?: boolean } = {}) {
  const ar = served.analysis_result as unknown as { enrichment: { inference_warnings: unknown[] } }
  const w = opts.warning ?? WARNING
  const block = { ...ar, enrichment: { ...ar.enrichment, inference_warnings: [...ar.enrichment.inference_warnings, w] } }
  const report = mapV5AnalysisToReport(block as never, {} as never)
  useCanvasStore.setState({
    hasCompletedFirstRun: true,
    analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match' },
    analysisFreshnessDirty: opts.current === false,
    importPendingServerRegistration: false,
    nodes: [
      { id: 'out1', type: 'outcome', position: { x: 0, y: 0 }, data: { label: 'MRR', kind: 'outcome' } },
      { id: 'fac_price', type: 'factor', position: { x: 0, y: 100 }, data: { label: 'Price', kind: 'factor' } },
      ...served.options.map((o, i) => ({ id: o.id, type: 'option', position: { x: i * 220, y: 200 }, data: { label: o.label, kind: 'option' } })),
    ] as never,
    edges: [{ id: 'e_price_mrr', source: 'fac_price', target: 'out1', data: opts.edgeData ?? PLACEHOLDER }] as never,
    results: { status: 'complete', progress: 100, report } as never,
  } as never)
}


const wireState = (kind: string) => ({
  run_state: { kind, computed_at: '2026-10-01T15:00:00.000Z' },
  readiness: { status: 'ready', blockers: [] },
  leader_claim: { permitted: true, separation: 'separated' },
  robustness: { aggregate_level: 'low' },
  usable_for_prose: true, usable_for_chips: true, usable_for_followup: true,
  requires_rerun: false, blocked_unusable: false, contradictions: [],
})

const optionById = () =>
  Object.fromEntries(renderHook(() => useResultsSectionData()).result.current.recommendation.allOptions.map((o) => [o.id, o]))

describe('B3c · the hook resolves the producer\'s acceptable links to canvas edges', () => {
  it('the withheld option carries its one on-canvas link; a link with no edge is dropped; other options carry none', () => {
    seed()
    const rec = renderHook(() => useResultsSectionData()).result.current.recommendation
    const byId = Object.fromEntries(rec.allOptions.map((o) => [o.id, o]))
    expect(byId[HELD].unsizedLinks).toEqual([{ edgeId: 'e_price_mrr', fromLabel: 'Price', toLabel: 'MRR' }])
    expect(byId.keep_49_price.unsizedLinks).toBeUndefined()
  })

  it('the Reasoning tab shows "1 link Olumi drafted isn\'t sized yet" with both actions on that option only', () => {
    seed()
    const data = renderHook(() => useResultsSectionData()).result.current
    render(<AnalysisNewTabBody resultsSectionData={data} isPreRun={false} isRunning={false} isStale={false} responseHash="b3c" />)
    const T = `analysis-new-options-unsized-${HELD}`
    expect(screen.getByTestId(`${T}-heading`)).toHaveTextContent("1 link Olumi drafted isn't sized yet")
    // One line at rest (8 Oct 2026); the list opens under the chevron.
    expect(screen.queryByTestId(`${T}-e_price_mrr-accept`)).toBeNull()
    fireEvent.click(screen.getByTestId(`${T}-toggle`))
    expect(screen.getByTestId(`${T}-e_price_mrr`)).toHaveTextContent('‘Price’ affects ‘MRR’')
    expect(screen.getByTestId(`${T}-e_price_mrr-accept`)).toHaveTextContent('Accept')
    expect(screen.getByTestId(`${T}-e_price_mrr-accept`)).toHaveAccessibleName("Accept Olumi's starting strength for ‘Price’ affects ‘MRR’")
    expect(screen.getByTestId(`${T}-e_price_mrr-edit`)).toHaveTextContent('Edit')
    expect(screen.queryByTestId('analysis-new-options-unsized-keep_49_price')).toBeNull()
  })
})

describe('B3c · the offer exists only while it can still be true (#2408 CR)', () => {
  it('⛔ the SAME edge before and after sizing: offered as a placeholder; gone once accepted; gone once user-stated', () => {
    seed({ edgeData: PLACEHOLDER })
    expect(optionById()[HELD].unsizedLinks?.map((l) => l.edgeId)).toEqual(['e_price_mrr'])
    cleanup()
    seed({ edgeData: ACCEPTED_OLUMI })
    expect(optionById()[HELD].unsizedLinks).toBeUndefined()
    cleanup()
    seed({ edgeData: USER_STATED })
    expect(optionById()[HELD].unsizedLinks).toBeUndefined()
  })

  it('accepted-Olumi vs user-stated provenance never read the same way', () => {
    const kept = { ...WARNING, withheld_claims: ['goal_probability', 'joint_probability', 'win_share'] }
    seed({ edgeData: ACCEPTED_OLUMI, warning: { ...kept, rests_on_accepted_olumi: [HELD] } })
    const accepted = optionById()[HELD]
    cleanup()
    seed({ edgeData: USER_STATED, warning: kept })
    const stated = optionById()[HELD]
    expect(accepted.outcomeRestsOnAcceptedOlumi).toBe(true)
    expect(stated.outcomeRestsOnAcceptedOlumi).toBeUndefined()
    expect(accepted.unsizedLinks).toBeUndefined()
    expect(stated.unsizedLinks).toBeUndefined()
  })

  it('⛔ a stale or unconfirmed Run renders no row; CONTRAST the current Run does; current → stale removes it', async () => {
    const T = `analysis-new-options-unsized-${HELD}`
    const drawTab = () => {
      const data = renderHook(() => useResultsSectionData()).result.current
      return render(<AnalysisNewTabBody resultsSectionData={data} isPreRun={false} isRunning={false} isStale={false} responseHash="b3c-cur" />)
    }
    seed({ current: false })
    drawTab()
    expect(screen.queryByTestId(T)).toBeNull()
    cleanup()
    seed({})
    useCanvasStore.setState({ analysisFreshness: null } as never)
    drawTab()
    expect(screen.queryByTestId(T), 'no verdict = not affirmatively current').toBeNull()
    cleanup()
    seed({})
    drawTab()
    expect(screen.getByTestId(T)).toBeInTheDocument()
    act(() => { useCanvasStore.setState({ analysisFreshnessDirty: true } as never) })
    expect(screen.queryByTestId(T)).toBeNull()
  })
})

describe('B3c · ONE composed currency gates the offer (#2408 delta CR)', () => {
  const T = `analysis-new-options-unsized-${HELD}`
  const drawTab = () => {
    const data = renderHook(() => useResultsSectionData()).result.current
    return render(<AnalysisNewTabBody resultsSectionData={data} isPreRun={false} isRunning={false} isStale={false} responseHash="b3c-wire" />)
  }

  it.each(['unknown_degraded', 'refused'])('⛔ local "fresh" + wire %s → cannot_confirm → no row', (kind) => {
    seed({})
    useCanvasStore.setState({ analysisStateV1: wireState(kind) } as never)
    expect(selectRunAffirmedCurrent(useCanvasStore.getState())).toBe(false)
    drawTab()
    expect(screen.queryByTestId(T)).toBeNull()
  })

  it('CONTRAST: local "fresh" + wire complete_current → the row renders', () => {
    seed({})
    useCanvasStore.setState({ analysisStateV1: wireState('complete_current') } as never)
    expect(selectRunAffirmedCurrent(useCanvasStore.getState())).toBe(true)
    drawTab()
    expect(screen.getByTestId(T)).toBeInTheDocument()
  })

  it('the predicate agrees with the composed hook the rest of the product reads', () => {
    for (const kind of [null, 'complete_current', 'unknown_degraded', 'refused', 'complete_stale']) {
      seed({})
      useCanvasStore.setState({ analysisStateV1: kind === null ? null : wireState(kind) } as never)
      const hookSaysCurrent = renderHook(() => useAnalysisTrust()).result.current.semantic === 'current'
      expect(selectRunAffirmedCurrent(useCanvasStore.getState()), String(kind)).toBe(hookSaysCurrent)
      cleanup()
    }
  })
})

describe('B3c · the actions reuse the canvas paths and claim no more than the send settled', () => {
  async function drawWithMocks(outcome: string) {
    vi.resetModules()
    vi.doMock('../../../canvas/hooks/useModelEditAuthority', () => ({
      useModelEditAuthority: () => ({ proposeEdgeStrengthConfirmation: (id: string, o: unknown) => { confirm(id, o); return outcome } }),
    }))
    vi.doMock('../../../canvas/utils/openEdgeStrengthEditor', () => ({ openEdgeStrengthEditor: (id: string) => openEditor(id) }))
    const store = (await import('../../../canvas/store')).useCanvasStore
    store.setState({
      analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match' },
      analysisFreshnessDirty: false,
      importPendingServerRegistration: false,
      edges: [{ id: 'e1', source: 'fac_price', target: 'out1', data: PLACEHOLDER }],
    } as never)
    const { UnsizedLinkActions } = await import('../analysisNew/sections/UnsizedLinkActions')
    render(<UnsizedLinkActions links={[{ edgeId: 'e1', fromLabel: 'Price', toLabel: 'MRR' }]} testId="u" />)
    // 8 Oct 2026: the list opens on demand; the acts behind it are unchanged.
    fireEvent.click(screen.getByTestId('u-toggle'))
    return store
  }

  it('Accept sends the confirm for that edge; "sent" says re-run, never "recorded"', async () => {
    await drawWithMocks('dispatched')
    fireEvent.click(screen.getByTestId('u-e1-accept'))
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(confirm.mock.calls[0][0]).toBe('e1')
    expect(screen.getByTestId('u-e1-note')).toHaveTextContent('Sending')
    const { onSendSettled } = confirm.mock.calls[0][1] as { onSendSettled: (s: string) => void }
    onSendSettled('sent')
    expect(await screen.findByText("Sent. Re-run to see this option's figures.")).toBeInTheDocument()
    expect(screen.getByTestId('u-e1-note').textContent).not.toMatch(/recorded|sized/i)
  })

  it('⛔ a refused send says it was not recorded; an undispatchable one points to Edit', async () => {
    await drawWithMocks('dispatched')
    fireEvent.click(screen.getByTestId('u-e1-accept'))
    ;(confirm.mock.calls[0][1] as { onSendSettled: (s: string) => void }).onSendSettled('refused')
    expect(await screen.findByText('Not recorded. Use Edit to set it.')).toBeInTheDocument()
    cleanup()
    confirm.mockReset()
    await drawWithMocks('no_carrier')
    fireEvent.click(screen.getByTestId('u-e1-accept'))
    expect(screen.getByTestId('u-e1-note')).toHaveTextContent("Olumi can't accept this one here. Use Edit to set it.")
  })

  it.each([
    ['local stale', { analysisFreshnessDirty: true }],
    ['wire unknown_degraded', { analysisStateV1: wireState('unknown_degraded') }],
    ['wire refused', { analysisStateV1: wireState('refused') }],
  ])('⛔ CAPTURED CLICK: current at render, %s at click → the handler sends nothing and says so', async (_l, change) => {
    const store = await drawWithMocks('dispatched')
    cleanup()
    const { UnsizedLinkRow } = await import('../analysisNew/sections/UnsizedLinkActions')
    render(<UnsizedLinkRow link={{ edgeId: 'e1', fromLabel: 'Price', toLabel: 'MRR' }} testId="r" />)
    store.setState(change as never)
    fireEvent.click(screen.getByTestId('r-e1-accept'))
    expect(confirm).not.toHaveBeenCalled()
    expect(screen.getByTestId('r-e1-note')).toHaveTextContent('This analysis may be out of date.')
  })

  it('⛔ CLICK TIME: a link sized after render (Edit / acceptance landed) sends nothing; CONTRAST the placeholder sends', async () => {
    const store = await drawWithMocks('dispatched')
    store.setState({ edges: [{ id: 'e1', source: 'fac_price', target: 'out1', data: USER_STATED }] } as never)
    fireEvent.click(screen.getByTestId('u-e1-accept'))
    expect(confirm).not.toHaveBeenCalled()
    expect(screen.getByTestId('u-e1-note')).toHaveTextContent('This link has a strength now.')
    store.setState({ edges: [{ id: 'e1', source: 'fac_price', target: 'out1', data: PLACEHOLDER }] } as never)
    cleanup()
    await drawWithMocks('dispatched')
    fireEvent.click(screen.getByTestId('u-e1-accept'))
    expect(confirm).toHaveBeenCalledTimes(1)
  })

  it('Edit opens that link\'s strength editor', async () => {
    await drawWithMocks('dispatched')
    fireEvent.click(screen.getByTestId('u-e1-edit'))
    expect(openEditor).toHaveBeenCalledWith('e1')
  })
})
