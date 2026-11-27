import '@testing-library/jest-dom/vitest'
import { readFileSync } from 'node:fs'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCanvasStore } from '../../../../canvas/store'
import { drawViewCanvas } from '../../../canvas'
import { useMe } from '../../../../olumiCore/me'
import { useUIStore } from '../../../../stores/uiStore'
import type { View, ViewCard } from '../../../client'
import { tipOf } from '../../../__tests__/tipHelpers'
import { useStoredFocusSubject } from '../../../focus/state'
import { CoreCard } from '../../../previous/CoreCard'
import { useViewStore } from '../../../store'
import { ViewChat } from '../../../ViewChat'
import { visualOfAnswer, visualOfCard, type VisualV3 } from '../../../visual'
import { BANDS_DRAFT } from '../../scale/OptionBand'
import { setDefaultLevel, setLevel, useSimpleLevel } from '../../simpleStore'

const { drawn, call, focusCard } = vi.hoisted(() => ({
  drawn: vi.fn<[VisualV3], void>(),
  call: vi.fn(async () => { throw new Error('Unexpected Core call') }),
  focusCard: vi.fn(),
}))
vi.mock('../../../../olumiCore/team/api', async (original) => ({
  ...await original<typeof import('../../../../olumiCore/team/api')>(), call,
}))
vi.mock('../../../../canvas/utils/focusHelpers', async (original) => ({
  ...await original<typeof import('../../../../canvas/utils/focusHelpers')>(), focusNodeById: focusCard,
}))
vi.mock('../../../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
vi.mock('../../scale/OptionBand', async (original) => {
  const actual = await original<typeof import('../../scale/OptionBand')>()
  return {
    ...actual,
    BandsChart: (props: Parameters<typeof actual.BandsChart>[0]) => {
      drawn(props.payload)
      return <actual.BandsChart {...props} />
    },
  }
})

const served: View = JSON.parse(readFileSync('src/olumiView/fixtures/real/capacity.view3.json', 'utf8'))
const quantity = 'total_resolutions'
const reason = 'The model has no supported capacity estimate for shared staffing.'
const cardOf = (view: View) => view.model!.cards.find((card) => card.id === quantity)!
const withCard = (view: View, card: ViewCard): View => ({
  ...view, model: { ...view.model!, cards: view.model!.cards.map((c) => c.id === quantity ? card : c) },
})
function withVisual(view: View, visual: unknown): View {
  return { ...view, chat: view.chat.map((turn) => ({ ...turn, answer: { ...turn.answer!, visual } })) }
}
function fixture() {
  const source = cardOf(served)
  const card: ViewCard = {
    ...source,
    values: source.values!.filter((v) => v.option !== 'share_specialist').reverse(),
    values_withheld: [{ option: 'share_specialist', text: reason, cause: 'not_covered' }],
  }
  const model = { ...served.model!, run: { ...served.model!.run!, id: 'capacity-run-1' } }
  const view = withCard({ ...served, model }, card)
  const payload = visualOfCard(view.model, card, view)!
  return { card, payload, view: withVisual(view, JSON.parse(JSON.stringify(payload))) }
}

const chart = '[data-form="CH-bands"]'
const lanes = (root: ParentNode) => [...root.querySelectorAll<HTMLElement>('[data-band-option]')]
const orderOf = (root: ParentNode) => lanes(root).map((lane) => lane.dataset.bandOption)
function ready(view: View) {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false, at: null })
}
function drawQuantity(view: View): NodeProps['data'] {
  drawViewCanvas(view.model!, new Map(), [], [], view)
  return useCanvasStore.getState().nodes.find((node) => node.id === quantity)!.data
}

function CanvasCard({ data }: { data: NodeProps['data'] }) {
  const props = {
    id: quantity, type: 'viewCard', data, selected: false, dragging: false, zIndex: 0,
    isConnectable: false, positionAbsoluteX: 0, positionAbsoluteY: 0, selectable: true, deletable: false, draggable: false,
  } as NodeProps
  return <ReactFlowProvider><CoreCard {...props} /></ReactFlowProvider>
}

const fetchStub = vi.fn(async () => { throw new Error('Unexpected fetch') })
beforeEach(() => {
  vi.stubGlobal('fetch', fetchStub)
  useMe.setState({ me: { id: served.you_id, name: served.you }, status: 'ready' })
  useUIStore.setState({ activeOutputTab: 'olumi' })
  window.localStorage.removeItem(`olumi.v12.level.${served.id}`)
  useSimpleLevel.setState({ levels: {} })
  setDefaultLevel('simple')
})
afterEach(() => {
  cleanup()
  expect(call).not.toHaveBeenCalled()
  expect(fetchStub).not.toHaveBeenCalled()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none' })
  useMe.setState({ me: null, status: 'none' })
  useStoredFocusSubject.setState({ subject: null })
})

describe('the reply visual and the canvas quantity at its version', () => {
  it('passes the same projected payload to the only renderer and draws identical full lanes on the canvas and in chat', async () => {
    const { view, card, payload } = fixture()
    ready(view)
    expect(view.chat[0]!.version).toBe(view.version!.label)
    expect(visualOfAnswer(view.chat[0]!.answer)).toEqual(payload)
    const conditional = card.values!.find((v) => v.option === 'add_specialist')!
    expect(payload.lanes[1]).toMatchObject({ state: 'value', p10: conditional.p10, p50: conditional.p50, p90: conditional.p90, text: conditional.text, if_absent: conditional.if_absent })
    expect(payload.unit).toBe(view.model!.aim!.unit)
    expect(payload.run).toBe('capacity-run-1')
    const canvas = render(<CanvasCard data={drawQuantity(view)} />)
    const chat = render(<ViewChat />)
    expect(drawn.mock.calls).toEqual([[payload], [payload]])
    expect(canvas.container.querySelectorAll(chart)).toHaveLength(1)
    expect(chat.container.querySelectorAll(chart)).toHaveLength(1)
    const reply = chat.container.querySelector(chart)!
    expect(reply.querySelector('[data-band-point]')).not.toBeNull()
    expect(reply.querySelector('[data-band-range]')).not.toBeNull()
    expect(reply.querySelector('[data-band-middle]')).not.toBeNull()
    const glance = canvas.container.querySelector(chart)!
    expect(glance).toHaveAttribute('data-band-tier', 'glance')
    expect(glance.querySelector('[data-band-words]')).toBeNull()
    expect(orderOf(glance)).toEqual(orderOf(reply))
    const heldInGlance = glance.querySelector<HTMLButtonElement>('[data-band-state="withheld"] button')!
    expect(await tipOf(heldInGlance)).toBe(reason)

    act(() => setLevel('working'))
    const face = canvas.container.querySelector(chart)!
    expect(lanes(face).map((lane) => lane.outerHTML)).toEqual(lanes(reply).map((lane) => lane.outerHTML))
    for (const root of [face, reply]) {
      const held = root.querySelector('[data-band-state="withheld"]')!
      expect(held.querySelector('[data-band-letter]')?.textContent).toBe('C')
      expect(held.querySelector('[data-band-words]')?.textContent).toBe(reason)
      expect(held.querySelector('[data-band-track]')).toBeNull()
    }
    fireEvent.click(lanes(reply)[0]!.querySelector('button')!)
    expect(focusCard).toHaveBeenCalledWith('keep_staffing')
    expect(useStoredFocusSubject.getState().subject).toMatchObject({ kind: 'option', id: 'keep_staffing', source: 'panel' })
  })

  it('reopens the pinned chart unchanged after the canvas changes and shows its own Core version label', () => {
    const { view, card } = fixture()
    ready(view)
    setDefaultLevel('working')
    const previousNode = drawQuantity(view)
    const initial = render(<ViewChat />)
    const earlier = initial.container.querySelector(chart)!.outerHTML
    initial.unmount()
    const newCard = { ...card, values: card.values!.map((value) => ({ ...value, p10: 120, p50: 120, p90: 120, text: '120 tickets/week' })) }
    const model = { ...view.model!, edit_base: 5, run: { ...view.model!.run!, id: 'capacity-run-2' } }
    const later = { ...withCard({ ...view, model }, newCard), version: { ...view.version!, id: 5, n: 2, label: 'version 2' } }
    ready(later)
    const chat = render(<ViewChat />)
    const canvas = render(<CanvasCard data={previousNode} />)
    expect(canvas.container.querySelector(chart)?.outerHTML).toBe(earlier)
    canvas.rerender(<CanvasCard data={drawQuantity(later)} />)
    expect(canvas.container.querySelector('[data-band-version]')?.textContent).toBe(later.version.label)
    expect(canvas.container.querySelector('[data-band-words]')?.textContent).toBe(newCard.values[0]!.text)
    expect(chat.container.querySelector('[data-band-version]')?.textContent).toBe(view.version!.label)
    expect(chat.container.querySelector(chart)?.outerHTML).toBe(earlier)
  })

  it('keeps the served capacity basis and uses each lane’s own provenance when available', () => {
    const { view, card, payload } = fixture()
    expect(payload.lanes[0]).toMatchObject({ provenance: { kind: 'olumi', basis: card.figure!.title } })
    const laneAuthor = { by: 'person' as const, text: 'Team estimate', title: 'Capacity reported by the team' }
    const laneOlumi = { glyph: '◆', title: 'Based on the staffing assumptions for this option' }
    const values = card.values!.map((value) => value.option === 'keep_staffing'
      ? { ...value, olumi: laneOlumi }
      : { ...value, author: laneAuthor })
    const projected = visualOfCard(view.model, { ...card, values: values as unknown as ViewCard['values'] }, view)!
    expect(projected.lanes[0]).toMatchObject({ provenance: { kind: 'olumi', basis: laneOlumi.title } })
    expect(projected.lanes[1]).toMatchObject({ provenance: { kind: 'theirs', author: laneAuthor } })
  })

  it('keeps the option order in a narrow chat render', () => {
    const { view } = fixture()
    ready(view)
    const expected = ['keep_staffing', 'add_specialist', 'share_specialist']
    const chat = render(<div style={{ width: 560 }}><ViewChat /></div>)
    expect(orderOf(chat.container)).toEqual(expected)
    chat.rerender(<div style={{ width: 280 }}><ViewChat /></div>)
    expect(orderOf(chat.container)).toEqual(expected)
  })

  it('draws a draft for a proposal and skips absent or malformed visuals', () => {
    const { view, card, payload } = fixture()
    const proposalView: View = JSON.parse(readFileSync('src/olumiView/golden/proposal.view.json', 'utf8'))
    const pending = { ...view, model: { ...view.model!, edit_base: null }, proposal: proposalView.proposal }
    const draft = { ...visualOfCard(pending.model, card, pending)!, run: null }
    expect(draft.binding).toEqual({ kind: 'proposal', id: pending.proposal!.id })
    ready(withVisual(view, draft))
    const chat = render(<ViewChat />)
    expect(chat.container.querySelector('[data-band-version]')?.textContent).toBe(BANDS_DRAFT)
    const runOnly = { ...payload, binding: { kind: 'proposal', id: null } }
    act(() => ready(withVisual(view, runOnly)))
    expect(chat.container.querySelector('[data-band-version]')?.textContent).toBe(BANDS_DRAFT)
    const versionOnly = { ...payload, run: null }
    act(() => ready(withVisual(view, versionOnly)))
    expect(chat.container.querySelector('[data-band-version]')?.textContent).toBe(view.version!.label)
    for (const invalid of [{ ...runOnly, run: null }, undefined, { kind: 'visual', chart: 'CH-bands' }, { ...payload, chart: 'CH-chance' }, { ...payload, lanes: [{ ...payload.lanes[0], p10: '80' }] }]) {
      act(() => ready(withVisual(view, invalid)))
      expect(chat.container.querySelector(chart)).toBeNull()
      expect(chat.container.querySelector('[data-testid="view-chat-answer"]')).not.toBeNull()
    }
  })
})
