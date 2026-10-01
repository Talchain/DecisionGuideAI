/**
 * B3c · DL [R2] (5930827933): an option withheld on the placeholder path shows its acceptable unsized links (B2
 * `acceptable_links`) with "Accept starting strength" (the canvas's own `confirm_current` path) and "Edit" (the link's
 * strength editor). Served run `0303ef5` plus a PLACEHOLDER_PATH warning on one option.
 */
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, renderHook, screen, cleanup, fireEvent } from '@testing-library/react'

const confirm = vi.fn()
const openEditor = vi.fn()
vi.mock('../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))

import { useCanvasStore } from '../../../canvas/store'
import { mapV5AnalysisToReport } from '../../../v5/mapV5AnalysisToReport'
import { useResultsSectionData } from '../useResultsSectionData'
import { AnalysisNewTabBody } from '../analysisNew/AnalysisNewTabBody'
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

function seed() {
  const ar = served.analysis_result as unknown as { enrichment: { inference_warnings: unknown[] } }
  const block = { ...ar, enrichment: { ...ar.enrichment, inference_warnings: [...ar.enrichment.inference_warnings, WARNING] } }
  const report = mapV5AnalysisToReport(block as never, {} as never)
  useCanvasStore.setState({
    hasCompletedFirstRun: true,
    analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match' },
    analysisFreshnessDirty: false,
    nodes: [
      { id: 'out1', type: 'outcome', position: { x: 0, y: 0 }, data: { label: 'MRR', kind: 'outcome' } },
      { id: 'fac_price', type: 'factor', position: { x: 0, y: 100 }, data: { label: 'Price', kind: 'factor' } },
      ...served.options.map((o, i) => ({ id: o.id, type: 'option', position: { x: i * 220, y: 200 }, data: { label: o.label, kind: 'option' } })),
    ] as never,
    edges: [{ id: 'e_price_mrr', source: 'fac_price', target: 'out1', data: {} }] as never,
    results: { status: 'complete', progress: 100, report } as never,
  } as never)
}

describe('B3c · the hook resolves the producer\'s acceptable links to canvas edges', () => {
  it('the withheld option carries its one on-canvas link; a link with no edge is dropped; other options carry none', () => {
    seed()
    const rec = renderHook(() => useResultsSectionData()).result.current.recommendation
    const byId = Object.fromEntries(rec.allOptions.map((o) => [o.id, o]))
    expect(byId[HELD].unsizedLinks).toEqual([{ edgeId: 'e_price_mrr', fromLabel: 'Price', toLabel: 'MRR' }])
    expect(byId.keep_49_price.unsizedLinks).toBeUndefined()
  })

  it('the Reasoning tab shows "1 link not sized yet" with both actions on that option only', () => {
    seed()
    const data = renderHook(() => useResultsSectionData()).result.current
    render(<AnalysisNewTabBody resultsSectionData={data} isPreRun={false} isRunning={false} isStale={false} responseHash="b3c" />)
    const T = `analysis-new-options-unsized-${HELD}`
    expect(screen.getByTestId(`${T}-heading`)).toHaveTextContent('1 link not sized yet')
    expect(screen.getByTestId(`${T}-e_price_mrr-accept`)).toHaveTextContent('Accept starting strength')
    expect(screen.getByTestId(`${T}-e_price_mrr-edit`)).toHaveTextContent('Edit')
    expect(screen.queryByTestId('analysis-new-options-unsized-keep_49_price')).toBeNull()
  })
})

describe('B3c · the actions reuse the canvas paths and claim no more than the send settled', () => {
  async function drawWithMocks(outcome: string) {
    vi.resetModules()
    vi.doMock('../../../canvas/hooks/useModelEditAuthority', () => ({
      useModelEditAuthority: () => ({ proposeEdgeStrengthConfirmation: (id: string, o: unknown) => { confirm(id, o); return outcome } }),
    }))
    vi.doMock('../../../canvas/utils/openEdgeStrengthEditor', () => ({ openEdgeStrengthEditor: (id: string) => openEditor(id) }))
    const { UnsizedLinkActions } = await import('../analysisNew/sections/UnsizedLinkActions')
    render(<UnsizedLinkActions links={[{ edgeId: 'e1', fromLabel: 'Price', toLabel: 'MRR' }]} testId="u" />)
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

  it('Edit opens that link\'s strength editor', async () => {
    await drawWithMocks('dispatched')
    fireEvent.click(screen.getByTestId('u-e1-edit'))
    expect(openEditor).toHaveBeenCalledWith('e1')
  })
})
