import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, renderHook, screen, within } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { useCanvasStore } from '../../../../canvas/store'
import { useCanonicalAnalysisViewStore } from '../../../../canvas/stores/canonicalAnalysisViewStore'
import { parseCanonicalAnalysisView } from '../../../../canvas/runView/canonicalAnalysisView'
import { buildRunView } from '../../../../canvas/runView/runView'
import { OptionNode } from '../../../../canvas/nodes/OptionNode'
import { OptionChanceCellProvider } from '../../../../canvas/nodes/shared/OptionChanceCellProvider'
import { useResultsSectionData } from '../../useResultsSectionData'
import { buildHeroModel } from '../buildHeroModel'
import { AnalysisHeroPanel } from '../AnalysisHeroPanel'
import { applyRealRead } from './helpers/realScenarioRead'
import served from './fixtures/cee-1c-served-read-464abd0a.json'
import figures from './fixtures/cee-94b2554d-served-read-b38d1c80.json'

vi.mock('@xyflow/react', async () => ({ ...await vi.importActual<Record<string, unknown>>('@xyflow/react'), Handle: () => null }))
const ctx = { goalChanceHeroSays: true, labelOf: (id: string) => id }
afterEach(() => {
  cleanup(); vi.unstubAllGlobals()
  useCanonicalAnalysisViewStore.setState({ scenarioId: null, view: null })
  useCanvasStore.setState({ nodes: [], edges: [], currentScenarioId: null, results: { status: 'idle', report: null },
    analysisStateV1: null, ceeAnalysisReady: null, analysisFreshness: null, lastAuthoritativeGraph: null } as never)
})
async function dataFrom(body: unknown) {
  expect((await applyRealRead({ j: body })).outcome.outcome).toBe('applied')
  return renderHook(() => useResultsSectionData()).result.current
}
// #2747 re-scope 2 (U0): the Reasoning tab's decision matrix is removed in C, and the canvas cards show no chance; the
// Results hero is the surface these served faces reach.
function mountHero(data: ReturnType<typeof useResultsSectionData>) {
  const model = buildHeroModel(data)
  expect(model.kind).toBe('chart')
  if (model.kind !== 'chart') throw new Error('Expected chart')
  // Container's supplemental withholding lines must not repeat the server explanation outside Why?.
  expect(model.goalOptionCoverage?.withheldLines).toEqual([])
  render(<AnalysisHeroPanel model={model} rerunDisabled={false} />)
  return (id: string) => screen.getByTestId(`hero-option-row-${model.rows.find(r => r.id === id)!.index}`)
}
describe('WS5 PR-C server faces', () => {
  // Run-3 judge C5 (label, don't hide): each row says its face AND CEE's full why, verbatim, without a "Why?" to open.
  // (Was: "full why only after Why?".) A why every row shares is said once beneath the rows.
  it('untouched served 464abd0a hero prints faces and each full why, verbatim, with nothing folded (mutant-sensitive)', async () => {
    const surface = 'hero'
    const data = await dataFrom(served)
    const rowOf = mountHero(data)
    const whys = served.canonical_analysis_view.options.flatMap(o => (typeof o.cell.why === 'string' ? [o.cell.why] : []))
    const shared = whys.length >= 2 && whys.every(why => why === whys[0])
    for (const option of served.canonical_analysis_view.options) {
      const row = rowOf(option.option_id)
      const cell = option.cell
      expect(data.runView!.chanceCellOf(option.option_id, ctx).text).toBe(cell.face)
      expect(row).toHaveTextContent(cell.face)
      expect(within(row).queryByRole('button', { name: 'Why?' })).toBeNull()
      if (typeof cell.why === 'string') {
        const where = shared ? screen.getByTestId('analysis-hero-panel') : row
        expect(within(where).getByText(cell.why)).toBeVisible()
      }
    }
    console.info('SERVER-FACES', surface, JSON.stringify(served.canonical_analysis_view.options.map(o => ({ id: o.option_id, face: o.cell.face }))))
  })
  // Post-C UI item 1 (DL, 12 Oct): each card says CEE's served cell for its option, verbatim (`servedCellOf`: its face, else
  // its display), with no "Why?" button and no full why in the card's text. In C the cards printed no chance (U0).
  it('untouched served 464abd0a cards say CEE\'s served face verbatim (post-C item 1): no Why?, no full why in the text', async () => {
    const data = await dataFrom(served)
    for (const option of served.canonical_analysis_view.options) {
      const node = useCanvasStore.getState().nodes.find(n => n.id === option.option_id)!
      const card = render(<ReactFlowProvider><OptionChanceCellProvider><OptionNode id={node.id} type="option" data={node.data as never}
        selected={false} isConnectable positionAbsoluteX={0} positionAbsoluteY={0} dragging={false} zIndex={0} deletable selectable draggable />
      </OptionChanceCellProvider></ReactFlowProvider>)
      const cell = data.runView!.servedCellOf(node.id)
      const face = cell?.kind === 'figure' || cell?.kind === 'range' ? cell.face ?? cell.display
        : cell?.kind === 'withheld' ? cell.face ?? null : null
      const readout = screen.queryByTestId(`option-win-readout-${node.id}`)
      if (face === null) expect(readout).toBeNull()
      else expect(readout?.textContent).toBe(face)
      expect(card.queryByRole('button', { name: 'Why?' })).toBeNull()
      if (typeof option.cell.why === 'string') expect(card.container.textContent).not.toContain(option.cell.why)
      card.unmount()
    }
  })
  it.each(['hero', 'card'] as const)('b38d1c80 figure %s: the hero and (post-C item 1) the card print the explicit face; self-authored additive 1c face, original fixture has display only', async surface => {
    const body = structuredClone(figures.j)
    // Historical bytes predate 1c. Explicit additive mutation, never claimed as served face bytes.
    const option = body.canonical_analysis_view.options.find(o => o.option_id === 'launch_starter_tier')!
    const face = '‘Launch starter tier’: about 69% chance of meeting your goal, in this model.'
    Object.assign(option.cell, { face })
    const data = await dataFrom(body)
    if (surface === 'card') {
      const node = useCanvasStore.getState().nodes.find(n => n.id === option.option_id)!
      render(<ReactFlowProvider><OptionChanceCellProvider><OptionNode id={node.id} type="option" data={node.data as never}
        selected={false} isConnectable positionAbsoluteX={0} positionAbsoluteY={0} dragging={false} zIndex={0} deletable selectable draggable />
      </OptionChanceCellProvider></ReactFlowProvider>)
      expect(screen.getByTestId(`option-win-readout-${node.id}`).textContent).toBe(face)
    } else expect(mountHero(data)(option.option_id)).toHaveTextContent(face)
    expect(data.runView!.chanceCellOf(option.option_id, ctx).text).toBe(face)
  })
  it('stale run prints face_when_stale; mismatched run keeps fallback; no-run never takes stale face', () => {
    const body = { ...served.canonical_analysis_view, face_when_stale: 'Chance not shown yet',
      staleness: { ...served.canonical_analysis_view.staleness, stale: true } }
    const report = { run_id: body.run.run_id }
    expect(buildRunView(report, body as never).chanceCellOf('absent', ctx).text).toBe(body.face_when_stale)
    expect(buildRunView({ run_id: 'other' }, body as never).chanceCellOf('absent', ctx).kind).toBe('none')
    expect(buildRunView(report, { ...body, run: null } as never).chanceCellOf('absent', ctx).kind).toBe('none')
  })
  it('parser rejects wrong-typed face/why/stale-face; absence of figure face prints only the server display', () => {
    expect(parseCanonicalAnalysisView(served)).toBeNull()
    const body = served.canonical_analysis_view
    expect(parseCanonicalAnalysisView(body)).toEqual(body)
    for (const mutation of [{ ...body, face_when_stale: 5 },
      { ...body, options: [{ ...body.options[0], cell: { ...body.options[0].cell, face: 5 } }] },
      { ...body, options: [{ ...body.options[0], cell: { ...body.options[0].cell, why: 5 } }] }]) {
      expect(parseCanonicalAnalysisView(mutation)).toBeNull()
    }
    const canonical = figures.j.canonical_analysis_view
    const option = canonical.options.find(o => o.option_id === 'launch_starter_tier')!
    expect(buildRunView({ run_id: canonical.run.run_id }, canonical as never).chanceCellOf(option.option_id, ctx).text).toBe(option.cell.display)
  })
})
