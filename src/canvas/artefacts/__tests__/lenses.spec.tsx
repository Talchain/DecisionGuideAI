/**
 * Lenses on the model (Paul, 18 Oct 2026; DL-3 and PL rulings): ONE suggested next move from CEE's own ranking, ONE
 * lens bar that switches the thinking tools, and each lens's key card. Class rows, each with its contrast.
 */
import { describe, it, afterEach, beforeEach, vi } from 'vitest'
import assert from 'node:assert/strict'
import { render, fireEvent, cleanup, act } from '@testing-library/react'
import { ArtefactOffer } from '../../components/ArtefactOffer'
import { LensBar, placeLensBar } from '../LensBar'
import { nextBarLens, usePremortemArrival } from '../lenses'
import { RestsOnKey, restsOnHeadline } from '../RestsOnKey'
import { keyCardMove, keyCardSide } from '../../components/LensInfoPanel'
import { OVERLAY_BAND_LEFT_PAD } from '../../components/CanvasOverlayBand'
import { useActionBarStore } from '../../conversation/actionBar/actionBarStore'
import type { ActionBarV1, ActionOffer } from '../../conversation/actionBar/actionBarContract'
import { REVISION, PRE_MORTEM, SET_TARGET, WHAT_CHANGES, REVIEW } from '../../conversation/actionBar/__tests__/actionBarContractExample'
import { pressOffer, resetPressOfferClocks } from '../../conversation/actionBar/pressOffer'
import { setViewerScenario, __resetViewerModeForTests } from '../../../lib/viewerMode'
import { STRENGTHEN } from '../../conversation/actionBar/__tests__/actionBarContractExample'
import { useCanvasStore } from '../../store'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { worksheetFixture } from '../../../v5/__tests__/premortemFixture'
import { readPremortemWorksheet } from '../../../v5/readPremortemWorksheet'
import { TOP_PILL_BOTTOM_PX, TOP_PILL_TOP_PX } from '../../../components/layout/TopBar'

vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, isGraphLensEnabled: () => true }
})

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
  useCanvasStore.getState().setLens('full')
  useGuidanceStore.setState({
    _dispatchAction: (opts: { id: string; parameters?: Record<string, unknown> }) => { sent.push(opts) },
    _isConversationBusy: () => false,
  } as never)
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); __resetViewerModeForTests() })

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

  it('steps aside while a lens is on; option isolation, a view of the model, is not a lens', () => {
    useActionBarStore.setState({ bar: barOf([PRE_MORTEM]) })
    useCanvasStore.getState().setLens('premortem')
    const view = render(<ArtefactOffer />)
    assert.equal(view.queryByTestId('artefact-offer'), null)
    act(() => useCanvasStore.getState().setLens('option', 'opt-a'))
    assert.equal(view.queryAllByTestId('artefact-offer').length, 1)
  })

  it('CONTRAST: a viewer, who cannot send a turn, is suggested nothing', () => {
    setViewerScenario(SCENARIO)
    useActionBarStore.setState({ bar: barOf([PRE_MORTEM]) })
    const view = render(<ArtefactOffer />)
    assert.equal(view.queryByTestId('artefact-offer'), null)
  })

  it('CONTRAST: another scenario\'s bar suggests nothing here', () => {
    useActionBarStore.setState({ scenarioId: 'scn-other', bar: barOf([PRE_MORTEM]) })
    const view = render(<ArtefactOffer />)
    assert.equal(view.queryByTestId('artefact-offer'), null)
  })
})

describe('a worksheet the user asked for turns to "If it failed"', () => {
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
  function Arrival() { usePremortemArrival(); return null }
  const lens = () => useCanvasStore.getState().lens.active

  it('a NEW worksheet for the open scenario turns the lens on; leaving it stays left', () => {
    seedModel()
    render(<Arrival />)
    assert.equal(lens(), 'full')
    deliver('turn-1')
    assert.equal(lens(), 'premortem')
    act(() => useCanvasStore.getState().setLens('full'))
    deliver('turn-1')
    assert.equal(lens(), 'full', 'the same worksheet never turns back on what the user left')
  })

  it('CONTRAST: another scenario\'s worksheet turns nothing on', () => {
    seedModel('scn-other')
    render(<Arrival />)
    deliver('turn-1')
    assert.equal(lens(), 'full')
  })

  it('CONTRAST: a worksheet already held when the canvas mounts is not news; the next one is', () => {
    seedModel()
    useCanvasStore.setState({ runMeta: { premortemWorksheet: worksheetFor('turn-held'), premortemRun: null } } as never)
    render(<Arrival />)
    assert.equal(lens(), 'full')
    deliver('turn-new')
    assert.equal(lens(), 'premortem')
  })
})

describe('a press turns on the lens its action is about, on every surface (the one press path)', () => {
  const strengthen = STRENGTHEN as unknown as ActionOffer
  const lens = () => useCanvasStore.getState().lens.active
  it('a SENT press of an action about the model\'s figures turns on "Rests on"', () => {
    assert.equal(pressOffer(strengthen, REVISION), 'sent')
    assert.equal(lens(), 'rests_on')
  })
  it('CONTRAST: a press that sends nothing turns nothing on (disabled, no conversation)', () => {
    assert.equal(pressOffer({ ...strengthen, enabled: false }, REVISION), 'disabled')
    assert.equal(lens(), 'full')
    useGuidanceStore.setState({ _dispatchAction: undefined } as never)
    assert.equal(pressOffer(strengthen, REVISION), 'none')
    assert.equal(lens(), 'full')
  })
  it('CONTRAST: an action about something else turns nothing on', () => {
    assert.equal(pressOffer(REVIEW as unknown as ActionOffer, REVISION), 'sent')
    assert.equal(lens(), 'full')
  })
})

describe('the lens bar: one press between lenses', () => {
  const seedModel = (complete: boolean) => useCanvasStore.setState({
    nodes: [{ id: 'f', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'f', observedState: { value: 1, source: 'cee_inference' } } }],
    edges: [], results: complete ? { status: 'complete', progress: 100, report: { robustness: {} } } : { status: 'idle', progress: 0 },
  } as never)
  const checked = (view: ReturnType<typeof render>) =>
    view.getAllByRole('radio').filter(r => r.getAttribute('aria-checked') === 'true').map(r => r.dataset.testid)

  it('one press turns a lens on; the bar shows exactly one lens chosen', () => {
    seedModel(true)
    const view = render(<LensBar />)
    assert.deepEqual(checked(view), ['lens-bar-full'])
    fireEvent.click(view.getByTestId('lens-bar-rests_on'))
    assert.equal(useCanvasStore.getState().lens.active, 'rests_on')
    assert.deepEqual(checked(view), ['lens-bar-rests_on'])
    // Its count is the figures nobody has settled, said with the label.
    assert.equal(view.getByTestId('lens-bar-rests_on').getAttribute('aria-label'), 'Rests on, 1 to check or set')
  })

  it('each lens has its own icon before its name; the name and the count stay (vision spec §3, 23 Oct)', () => {
    seedModel(true)
    const view = render(<LensBar />)
    const want: Array<[string, string, string]> = [
      ['full', 'Model', 'lucide-layers2'], ['tradeoffs', 'Trade-offs', 'lucide-scale'], ['rests_on', 'Rests on', 'lucide-anchor'],
      ['premortem', 'If it failed', 'lucide-alert-triangle'], ['what_changes', 'What would change', 'lucide-activity'],
      ['what_if', 'What if', 'lucide-arrow-right-left'],
    ]
    for (const [lens, name, iconClass] of want) {
      const segment = view.getByTestId(`lens-bar-${lens}`)
      const icon = view.getByTestId(`lens-bar-${lens}-icon`)
      assert.equal(segment.firstElementChild, icon, `${name}: the icon leads the segment`)
      assert.equal(icon.getAttribute('aria-hidden'), 'true')
      assert.ok(icon.getAttribute('class')?.split(' ').includes(iconClass), `${name}: ${icon.getAttribute('class')}`)
      assert.match(segment.textContent ?? '', new RegExp(`^${name}`, 'u'))
    }
    assert.equal(view.getByTestId('lens-bar-rests_on-count').textContent, '1')
  })

  it('"What would change" reads a Run: before one it is shown, says how to get one, and cannot be chosen', () => {
    seedModel(false)
    const view = render(<LensBar />)
    const segment = view.getByTestId('lens-bar-what_changes')
    assert.equal(segment.getAttribute('aria-disabled'), 'true')
    assert.equal(segment.getAttribute('title'), 'Run the analysis to see what would change it.')
    fireEvent.click(segment)
    assert.equal(useCanvasStore.getState().lens.active, 'full')
    // CONTRAST: after a Run the same press chooses it.
    cleanup()
    seedModel(true)
    const after = render(<LensBar />)
    fireEvent.click(after.getByTestId('lens-bar-what_changes'))
    assert.equal(useCanvasStore.getState().lens.active, 'what_changes')
  })

  it('L and the arrow keys walk the bar, skipping a lens that cannot show yet', () => {
    assert.equal(nextBarLens('full', false), 'tradeoffs')
    assert.equal(nextBarLens('tradeoffs', false), 'rests_on', 'Trade-offs reads the model: no Run needed')
    assert.equal(nextBarLens('premortem', false), 'what_if', 'no Run: "What would change" is skipped (What if needs none)')
    assert.equal(nextBarLens('premortem', true), 'what_changes')
    assert.equal(nextBarLens('what_changes', true), 'what_if')
    assert.equal(nextBarLens('what_if', true), 'full')
    assert.equal(nextBarLens('option', true), 'tradeoffs', 'option isolation sits on the Model segment')
    seedModel(false)
    const view = render(<LensBar />)
    fireEvent.keyDown(view.getByRole('radiogroup'), { key: 'ArrowLeft' })
    assert.equal(useCanvasStore.getState().lens.active, 'what_if')
  })

  it('CONTRAST: no model, no bar', () => {
    useCanvasStore.setState({ nodes: [], edges: [] } as never)
    const view = render(<LensBar />)
    assert.equal(view.queryByTestId('lens-bar'), null)
  })

  it('sits on the top pill\'s row between the pill and the dock, or one row down when the run is too narrow', () => {
    const wide = placeLensBar({ viewportWidth: 1440, pillRight: 300, dockInset: 400, barWidth: 420 })
    assert.equal(wide.top, TOP_PILL_TOP_PX)
    assert.ok(wide.left >= 300 + 12 && wide.left + 420 <= 1440 - 400 - 12, 'clear of the pill and the dock')
    const narrow = placeLensBar({ viewportWidth: 1280, pillRight: 520, dockInset: 480, barWidth: 420 })
    assert.ok(narrow.top > TOP_PILL_BOTTOM_PX, 'one row down, below the pill')
    assert.ok(narrow.left + 420 <= 1280 - 480 - 12, 'still clear of the dock')
    assert.ok(narrow.left >= OVERLAY_BAND_LEFT_PAD, 'clear of the canvas tools at the left edge')
  })
})

describe('a pick is one thing selected', () => {
  it('selecting a figure on a card after a link leaves no link selected, so the key opens the card\'s figure', () => {
    useCanvasStore.setState({
      nodes: [{ id: 'f', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'f' } }, { id: 'g', type: 'goal', position: { x: 0, y: 200 }, data: { label: 'g' } }],
      edges: [{ id: 'e', source: 'f', target: 'g', data: {} }],
    } as never)
    useCanvasStore.getState().selectEdgeWithoutHistory('e')
    // POSITIVE CONTROL: the link really was selected, flag and all (React Flow syncs the selection from the flags).
    assert.equal(useCanvasStore.getState().edges[0].selected, true)
    useCanvasStore.getState().selectNodeWithoutHistory('f')
    const after = useCanvasStore.getState()
    assert.equal(after.edges[0].selected, false)
    assert.deepEqual([...after.selection.nodeIds], ['f'])
    assert.equal(after.selection.edgeIds.size, 0)
  })
})

describe('the key card covers as little of the model as it can', () => {
  const card = (x: number, y: number, w = 200, h = 80) => ({ x, y, w, h })
  it('stands in the corner that covers less of the model; the left on a tie', () => {
    const left = card(70, 500, 320, 120)
    const right = card(700, 500, 320, 120)
    assert.equal(keyCardSide(left, right, [card(100, 520)]), 'right')
    assert.equal(keyCardSide(left, right, [card(720, 520)]), 'left')
    assert.equal(keyCardSide(left, right, []), 'left')
  })
  type R = { x: number; y: number; w: number; h: number }
  const moved = (c: R, m: { dx: number; dy: number; scale: number }): R => ({ x: c.x * m.scale + m.dx, y: c.y * m.scale + m.dy, w: c.w * m.scale, h: c.h * m.scale })
  const overlaps = (a: R, b: R) => Math.min(a.x + a.w, b.x + b.w) > Math.max(a.x, b.x) && Math.min(a.y + a.h, b.y + b.h) > Math.max(a.y, b.y)
  const inside = (c: R, a: R) => c.x >= a.x - 1e-6 && c.y >= a.y - 1e-6 && c.x + c.w <= a.x + a.w + 1e-6 && c.y + c.h <= a.y + a.h + 1e-6
  it('with room above, the model only rises, as far as the cards under the key, at its own size', () => {
    const area = card(60, 60, 1100, 640)
    assert.deepEqual(keyCardMove(card(70, 500, 320, 120), [card(100, 450, 200, 100), card(500, 200)], area, 0.6), { dx: 0, dy: -58, scale: 1 })
    assert.equal(keyCardMove(card(70, 500, 320, 120), [card(500, 100)], area, 0.6), null, 'CONTRAST: nothing covered, no move')
  })
  it('⭐ 1280 (measured 22 Oct: the key sat over the goal, no room above): the model moves beside the key, zoomed out only as far as it must', () => {
    const area = card(60, 60, 800, 640)
    const key = card(540, 520, 320, 180)
    const cards = [card(100, 60, 200, 80), card(300, 300, 200, 80), card(100, 600, 500, 80)]
    const m = keyCardMove(key, cards, area, 0.6)!
    assert.ok(m.scale < 1 && m.scale > 0.9, `zoomed out a little, not to fit the height (${m.scale})`)
    for (const c of cards) {
      assert.ok(!overlaps(moved(c, m), key), 'no card in front stands under the key')
      assert.ok(inside(moved(c, m), area), 'every card stays where it can be read')
    }
  })
  it('never zooms below the zoom where cards drop their labels, and never pushes a card off screen: then it only lifts', () => {
    const area = card(60, 60, 800, 640)
    // A model wider than the room even at the floor zoom: no side move keeps it on screen, so only the plain lift is left.
    const m = keyCardMove(card(540, 460, 320, 240), [card(100, 400, 2000, 200)], area, 0.6)!
    assert.deepEqual({ dx: m.dx, scale: m.scale }, { dx: 0, scale: 1 })
    // A model that fits beside the key at a readable zoom moves there, and no further out than the floor allows.
    const n = keyCardMove(card(540, 460, 320, 240), [card(100, 300, 600, 380)], area, 0.6)!
    assert.ok(n.scale >= 0.6 && n.scale <= 1, `zoom ${n.scale}`)
  })
  it('⛔ a move never leaves more of the model under the key than staying put (measured 22 Oct: a clamped shift slid 3 cards under it)', () => {
    const area = card(60, 60, 800, 640)
    const key = card(540, 560, 320, 120)
    const cards = [card(100, 60, 400, 80), card(600, 300, 250, 80), card(600, 600, 240, 80)]
    const cover = (m: { dx: number; dy: number; scale: number } | null) => cards.reduce((sum, c) => {
      const r = m ? moved(c, m) : c
      return sum + Math.max(0, Math.min(r.x + r.w, key.x + key.w) - Math.max(r.x, key.x)) * Math.max(0, Math.min(r.y + r.h, key.y + key.h) - Math.max(r.y, key.y))
    }, 0)
    const m = keyCardMove(key, cards, area, 1)
    assert.ok(cover(m) <= cover(null), `covered ${cover(m)} after the move, ${cover(null)} before`)
  })
})

describe('the "Rests on" key says where the reasoning is unexamined, never a score', () => {
  const counts = (c: Partial<Record<'yours' | 'accepted' | 'unchecked' | 'unknown' | 'missing', number>>) =>
    ({ yours: 0, accepted: 0, unchecked: 0, unknown: 0, missing: 0, ...c })
  it('names the unsettled figures, largest claim first; settled ones are never counted as done', () => {
    assert.equal(restsOnHeadline(counts({ unchecked: 7, missing: 4, yours: 2 })), "7 are Olumi's estimates nobody has checked and 4 have no figure yet.")
    assert.equal(restsOnHeadline(counts({ unchecked: 1, missing: 1, unknown: 2 })), "1 is Olumi's estimate nobody has checked, 1 has no figure yet and 2 have no known origin.")
    assert.equal(restsOnHeadline(counts({ yours: 3, accepted: 2 })), 'Each one is yours, or an estimate of Olumi’s you accepted.')
    assert.doesNotMatch(restsOnHeadline(counts({ yours: 3, unchecked: 1 })), /of|%|score|complete/u)
  })

  it('a pick opens that figure with its own controls; the same number is on the model', () => {
    useCanvasStore.setState({
      currentScenarioId: SCENARIO, outcomeNodeId: 'g', ceeAnalysisReady: null, edges: [],
      nodes: [
        { id: 'f', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Churn', observedState: { value: 3, source: 'cee_inference' } } },
        { id: 'h', type: 'factor', position: { x: 300, y: 0 }, data: { label: 'Price', observedState: { value: 49, source: 'user_override' } } },
        { id: 'g', type: 'goal', position: { x: 0, y: 300 }, data: { label: 'MRR' } },
      ],
      selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    } as never)
    const view = render(<RestsOnKey />)
    assert.equal(view.queryByTestId('rests-on-key-picked'), null)
    assert.deepEqual(view.getAllByTestId('rests-on-key-row').map(r => [r.dataset.target, r.textContent]), [['node:f', '1'], ['node:h', '2']])
    act(() => useCanvasStore.getState().selectNodeWithoutHistory('f'))
    const picked = view.getByTestId('rests-on-key-picked')
    assert.match(picked.textContent ?? '', /Churn/u)
    assert.match(picked.textContent ?? '', /Olumi’s estimate, not yet checked/u)
    assert.ok(view.getByTestId('rests-on-figure'), 'the figure opens with its own controls')
    // CONTRAST: picking the other figure opens that one, not both.
    act(() => useCanvasStore.getState().selectNodeWithoutHistory('h'))
    assert.match(view.getByTestId('rests-on-key-picked').textContent ?? '', /Price/u)
    assert.doesNotMatch(view.getByTestId('rests-on-key-picked').textContent ?? '', /Churn/u)
  })
})
