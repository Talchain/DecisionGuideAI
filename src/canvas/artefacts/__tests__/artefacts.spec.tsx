/**
 * The reasoning artefact on the canvas (18 Oct 2026): ONE suggested next move from CEE's own ranking, and ONE artefact
 * beside the model. Class rows, each with its contrast.
 */
import { describe, it, afterEach, beforeEach, vi } from 'vitest'
import assert from 'node:assert/strict'
import { render, fireEvent, cleanup, act } from '@testing-library/react'
import { ArtefactOffer } from '../../components/ArtefactOffer'
import { ArtefactColumn } from '../ArtefactColumn'
import { useArtefactStore } from '../artefactStore'
import { useActionBarStore } from '../../conversation/actionBar/actionBarStore'
import type { ActionBarV1, ActionOffer } from '../../conversation/actionBar/actionBarContract'
import { REVISION, PRE_MORTEM, SET_TARGET, WHAT_CHANGES, REVIEW } from '../../conversation/actionBar/__tests__/actionBarContractExample'
import { resetPressOfferClocks } from '../../conversation/actionBar/pressOffer'
import { useCanvasStore } from '../../store'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { worksheetFixture } from '../../../v5/__tests__/premortemFixture'
import { readPremortemWorksheet } from '../../../v5/readPremortemWorksheet'
import { computeFitPadding, ARTEFACT_COLUMN_SELECTOR, DOCK_SELECTOR } from '../../utils/computeFitPadding'

const SCENARIO = 'scn-artefacts'
const barOf = (priority: readonly unknown[], standard: readonly unknown[] = [REVIEW]): ActionBarV1 =>
  ({ v: 1, state_key: 'state-1', revision: REVISION, priority, standard, more: [] }) as unknown as ActionBarV1

let sent: Array<{ id: string; parameters?: Record<string, unknown> }> = []
beforeEach(() => {
  sent = []
  resetPressOfferClocks()
  try { localStorage.clear() } catch { /* none */ }
  useCanvasStore.setState({ currentScenarioId: SCENARIO })
  useActionBarStore.setState({ scenarioId: SCENARIO, bar: null, dismissed: [] })
  useArtefactStore.setState({ open: null })
  useGuidanceStore.setState({
    _dispatchAction: (opts: { id: string; parameters?: Record<string, unknown> }) => { sent.push(opts) },
    _isConversationBusy: () => false,
  } as never)
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('one suggested next move', () => {
  const cases: Array<{ name: string; priority: readonly unknown[]; shows: string | null }> = [
    { name: 'a ranked method', priority: [PRE_MORTEM], shows: PRE_MORTEM.why_now! },
    { name: 'a standing gap', priority: [SET_TARGET, PRE_MORTEM], shows: SET_TARGET.why_now! },
    { name: 'nothing ranked ("none" is an answer)', priority: [], shows: null },
    { name: 'only a disabled offer', priority: [WHAT_CHANGES], shows: null },
  ]
  for (const c of cases) it(`${c.name}: ${c.shows === null ? 'no suggestion' : 'exactly one suggestion'}`, () => {
    useActionBarStore.setState({ bar: barOf(c.priority) })
    const view = render(<ArtefactOffer />)
    const offers = view.queryAllByTestId('artefact-offer')
    assert.equal(offers.length, c.shows === null ? 0 : 1)
    if (c.shows !== null) assert.ok(view.getByText(c.shows))
  })

  it('the press is the bar\'s one press path: one turn, carrying the offer it was made for', () => {
    useActionBarStore.setState({ bar: barOf([PRE_MORTEM]) })
    const view = render(<ArtefactOffer />)
    fireEvent.click(view.getByTestId('artefact-offer-press'))
    assert.equal(sent.length, 1)
    assert.equal(sent[0].parameters?.offer_key, PRE_MORTEM.offer_key)
    assert.deepEqual(sent[0].parameters?.revision, REVISION)
  })

  it('"Not now" sets that offer aside until the state changes; a new offer_key may be suggested again', () => {
    useActionBarStore.setState({ bar: barOf([PRE_MORTEM]) })
    const view = render(<ArtefactOffer />)
    fireEvent.click(view.getByTestId('artefact-offer-not-now'))
    assert.equal(view.queryByTestId('artefact-offer'), null)
    assert.deepEqual(useActionBarStore.getState().dismissed, [PRE_MORTEM.offer_key])
    act(() => useActionBarStore.setState({ bar: barOf([{ ...PRE_MORTEM, offer_key: 'cccccccccccccccc' } as ActionOffer]) }))
    assert.equal(view.queryAllByTestId('artefact-offer').length, 1)
  })

  it('steps aside while an artefact is open beside the model', () => {
    useActionBarStore.setState({ bar: barOf([PRE_MORTEM]) })
    useArtefactStore.setState({ open: 'premortem' })
    const view = render(<ArtefactOffer />)
    assert.equal(view.queryByTestId('artefact-offer'), null)
  })

  it('CONTRAST: another scenario\'s bar suggests nothing here', () => {
    useActionBarStore.setState({ scenarioId: 'scn-other', bar: barOf([PRE_MORTEM]) })
    const view = render(<ArtefactOffer />)
    assert.equal(view.queryByTestId('artefact-offer'), null)
  })
})

describe('one artefact beside the model', () => {
  // The fixture's scenario id is bound inside the worksheet (`binding.scenario_id`), so the open scenario moves instead.
  const FIXTURE_SCENARIO = worksheetFixture().scenario_id
  const worksheetFor = (turnId: string) => {
    const read = readPremortemWorksheet({ _premortem_worksheet: { ...worksheetFixture(), turn_id: turnId } })
    assert.equal(read.status, 'available', 'POSITIVE CONTROL: the delivered worksheet parses')
    return read
  }
  const seedModel = (openScenario = FIXTURE_SCENARIO) => {
    const w = worksheetFixture()
    useCanvasStore.setState({
      currentScenarioId: openScenario, analysisFreshnessDirty: false, lastServerGraphHash: w.run.graph_hash_at_run, edges: [],
      nodes: ['opt-a', 'opt-b', 'factor', 'goal'].map(id => ({ id, type: id.startsWith('opt') ? 'option' : id === 'goal' ? 'goal' : 'factor', position: { x: 0, y: 0 }, data: { label: id } })),
      runMeta: {},
    } as never)
  }
  const deliver = (turnId: string) => act(() => {
    useCanvasStore.setState({ runMeta: { premortemWorksheet: worksheetFor(turnId), premortemRun: null } } as never)
  })

  it('a NEW worksheet for the open scenario opens beside the model; Close keeps it closed', () => {
    seedModel()
    const view = render(<ArtefactColumn isStale={false} isBusy={false} />)
    assert.equal(view.queryByTestId('artefact-column'), null)
    deliver('turn-1')
    assert.ok(view.getByTestId('artefact-column'))
    assert.ok(view.getByTestId('premortem-worksheet'))
    fireEvent.click(view.getByTestId('artefact-column-close'))
    assert.equal(view.queryByTestId('artefact-column'), null)
    deliver('turn-1')
    assert.equal(view.queryByTestId('artefact-column'), null, 'the same worksheet never reopens what the user closed')
  })

  it('CONTRAST: another scenario\'s worksheet opens nothing', () => {
    seedModel('scn-other')
    const view = render(<ArtefactColumn isStale={false} isBusy={false} />)
    deliver('turn-1')
    assert.equal(view.queryByTestId('artefact-column'), null)
  })

  it('CONTRAST: a worksheet already held when the canvas mounts is not news; the next one is', () => {
    seedModel()
    useCanvasStore.setState({ runMeta: { premortemWorksheet: worksheetFor('turn-held'), premortemRun: null } } as never)
    const view = render(<ArtefactColumn isStale={false} isBusy={false} />)
    assert.equal(view.queryByTestId('artefact-column'), null)
    deliver('turn-new')
    assert.ok(view.getByTestId('artefact-column'))
  })
})

describe('the graph is framed beside the column', () => {
  const rect = (r: Partial<DOMRect>) => ({ getBoundingClientRect: () => ({ x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON: () => ({}), ...r }) }) as unknown as HTMLElement
  const flow = rect({ left: 0, top: 0, right: 1440, bottom: 900, width: 1440, height: 900 })
  const dock = rect({ left: 1060, right: 1440, top: 0, bottom: 900, width: 380, height: 900 })
  const column = rect({ left: 700, right: 1060, top: 0, bottom: 900, width: 360, height: 900 })
  const stub = (map: Record<string, HTMLElement>) =>
    vi.spyOn(document, 'querySelector').mockImplementation((sel: string) => (map[sel] ?? null) as Element | null)

  it('the right padding clears the column while it is open, and only the dock when it is not', () => {
    stub({ '.react-flow': flow, [DOCK_SELECTOR]: dock, [ARTEFACT_COLUMN_SELECTOR]: column })
    const open = parseInt(computeFitPadding().right, 10)
    vi.restoreAllMocks()
    stub({ '.react-flow': flow, [DOCK_SELECTOR]: dock })
    const closed = parseInt(computeFitPadding().right, 10)
    assert.equal(open - closed, 360)
  })
})
