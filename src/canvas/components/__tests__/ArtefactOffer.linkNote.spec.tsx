/**
 * ⭐ AN OFFER ABOUT ONE LINK IS SAID ON THAT LINK (vision spec §3, 23 Oct 2026): the "This link moves the result the
 * most" strip at the canvas foot becomes Olumi's note pinned at the link's midpoint, with the same press and the same
 * "Not now". Bound by the offer's identity (offer_key, action_id) and the link's id.
 */
import { describe, it, beforeEach, afterEach, vi } from 'vitest'
import assert from 'node:assert/strict'
import { render, fireEvent, cleanup, act } from '@testing-library/react'
import { ArtefactOffer } from '../ArtefactOffer'
import { OLUMI_ATTENTION_CARD_TESTID } from '../OlumiAttentionCard'
import { useActionBarStore } from '../../conversation/actionBar/actionBarStore'
import type { ActionBarV1 } from '../../conversation/actionBar/actionBarContract'
import { REVISION, REVIEW, TEST_LINK, PRE_MORTEM } from '../../conversation/actionBar/__tests__/actionBarContractExample'
import { resetPressOfferClocks } from '../../conversation/actionBar/pressOffer'
import { useCanvasStore } from '../../store'
import { useGuidanceStore } from '../../stores/guidanceStore'

vi.mock('@xyflow/react', async (orig) => ({
  ...(await orig<object>()),
  useStore: (selector: (s: { transform: [number, number, number] }) => unknown) => selector({ transform: [0, 0, 1] }),
}))
vi.mock('../FloatingOlumiPanel', () => ({ measureDockInset: () => 0 }))

const SCENARIO = 'scn-link-note'
const barOf = (priority: readonly unknown[]): ActionBarV1 =>
  ({ v: 1, state_key: 'state-1', revision: REVISION, priority, standard: [REVIEW], more: [] }) as unknown as ActionBarV1
const card = (n: string, x: number) => ({ id: n, type: 'factor', position: { x, y: 0 }, measured: { width: 200, height: 80 }, data: { label: n } })

let sent: Array<{ id: string; parameters?: Record<string, unknown> }> = []
beforeEach(() => {
  sent = []
  resetPressOfferClocks()
  useCanvasStore.setState({
    currentScenarioId: SCENARIO,
    nodes: [card('f1', 0), card('g1', 600)],
    edges: [{ id: 'link-f1-g1', source: 'f1', target: 'g1', data: {} }],
    olumiAttention: null,
  } as never)
  useCanvasStore.getState().setLens('full')
  useActionBarStore.setState({ scenarioId: SCENARIO, bar: barOf([TEST_LINK]), dismissed: [] })
  useGuidanceStore.setState({
    _dispatchAction: (opts: { id: string; parameters?: Record<string, unknown> }) => { sent.push(opts) },
    _isConversationBusy: () => false,
  } as never)
})
afterEach(() => cleanup())

describe('the offer about one link is Olumi’s note on that link', () => {
  it('no strip: a note anchored at the link’s midpoint, with the offer’s own reason', () => {
    const view = render(<ArtefactOffer />)
    assert.equal(view.queryByTestId('artefact-offer'), null)
    const note = view.getByTestId(OLUMI_ATTENTION_CARD_TESTID)
    assert.equal(note.dataset.anchorId, 'link-f1-g1')
    assert.equal(note.dataset.anchorKind, 'link')
    assert.ok(note.textContent?.includes('This link moves the result the most.'))
    // Undrawn path: the midpoint between the two cards' centres (100,40)–(700,40) → (400,40); the note stands beside it.
    assert.equal(note.style.left, '414px')
    assert.equal(note.style.top, '40px')
  })

  it('"Test link" is the offer’s one press: one turn, carrying the offer it was made for', () => {
    const view = render(<ArtefactOffer />)
    const press = view.getAllByTestId(`${OLUMI_ATTENTION_CARD_TESTID}-action`).find((b) => b.dataset.actionId === 'test_link')!
    assert.equal(press.textContent, 'Test link')
    fireEvent.click(press)
    assert.equal(sent.length, 1)
    assert.equal(sent[0].parameters?.offer_key, TEST_LINK.offer_key)
  })

  it('"Not now" dismisses it exactly as it dismissed the strip', () => {
    const view = render(<ArtefactOffer />)
    const notNow = view.getAllByTestId(`${OLUMI_ATTENTION_CARD_TESTID}-action`).find((b) => b.dataset.actionId === 'not-now')!
    assert.equal(notNow.textContent, 'Not now')
    fireEvent.click(notNow)
    assert.deepEqual(useActionBarStore.getState().dismissed, [TEST_LINK.offer_key])
    assert.equal(view.queryByTestId(OLUMI_ATTENTION_CARD_TESTID), null)
    assert.equal(sent.length, 0)
  })

  it('steps aside while the assistant’s own note is open (Olumi speaks from one place)', () => {
    const view = render(<ArtefactOffer />)
    assert.ok(view.getByTestId(OLUMI_ATTENTION_CARD_TESTID))
    act(() => useCanvasStore.setState({ olumiAttention: { nodeIds: ['f1'], edgeIds: [], note: { body: 'Another note.' }, caveat: null, turnId: null, modelVersion: null } } as never))
    assert.equal(view.queryByTestId(OLUMI_ATTENTION_CARD_TESTID), null)
  })

  it('CONTRAST: an offer about a link not on the canvas, or about no link, keeps the strip', () => {
    useCanvasStore.setState({ edges: [] } as never)
    const view = render(<ArtefactOffer />)
    assert.ok(view.getByTestId('artefact-offer'))
    assert.equal(view.queryByTestId(OLUMI_ATTENTION_CARD_TESTID), null)
    cleanup()
    useCanvasStore.setState({ edges: [{ id: 'link-f1-g1', source: 'f1', target: 'g1', data: {} }] } as never)
    useActionBarStore.setState({ bar: barOf([PRE_MORTEM]) })
    const strip = render(<ArtefactOffer />)
    assert.ok(strip.getByTestId('artefact-offer'))
  })
})
