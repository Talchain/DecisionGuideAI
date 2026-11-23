import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'
import { useMe } from '../../../olumiCore/me'
import { typography } from '../../../styles/typography'
import { tipOf, tipOnFocus } from '../../__tests__/tipHelpers'
import type { View, ViewCard, ViewRow } from '../../client'
import { CoreCard } from '../../previous/CoreCard'
import { attCards } from '../../ring'
import { ChatFootRow } from '../chat/ChatFootRow'
import { useModelExplanations } from '../explanations'
import { useViewStore } from '../../store'
import { AimResults } from '../detailed/marks'
import { SimpleFace } from '../SimpleFace'
import { setDefaultLevel, useSimpleLevel } from '../simpleStore'

vi.mock('../../../olumiCore/lane', async (real) => ({ ...(await real<object>()), isOlumiCoreLane: () => true }))
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
vi.mock('../../../canvas/nodes/shared/savedGraph', () => ({ useSavedGraphRead: () => ({ status: 'none' }), useSavedGraph: () => null }))
vi.mock('@xyflow/react', async (real) => ({ ...(await real<object>()), Handle: () => null }))
vi.mock('../../ring', async (real) => ({ ...(await real<object>()), attCards: vi.fn() }))

const load = (name: string): View => JSON.parse(readFileSync(`src/olumiView/fixtures/core-38eebca9/${name}.view3.json`, 'utf8'))
const loadProducer = (name: 'studio' | 'app-launch' | 'bakery-asked'): View =>
  JSON.parse(readFileSync(`src/olumiView/v12/__tests__/fixtures/issue7-e499eff6-${name}.view3.json`, 'utf8'))
const cardOf = (view: View, id: string) => view.model!.cards.find((c) => c.id === id)!
type NoneRow = Extract<ViewRow, { kind: 'none' }>
const rowOf = (card: ViewCard, i = 0) => card.rows[i]! as NoneRow
const figure = (ref: string) => ({ ref, role: 'figure' as const })
const ring = vi.mocked(attCards)
const expectRing = (...ids: string[]) => expect(ring).toHaveBeenLastCalledWith(ids)
const at = (root: HTMLElement, path: string) => root.querySelector<HTMLElement>(`[data-view="${path}"]`)!
const detail = (view: View, id: string) => {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false, at: null } as never)
  useMe.setState({ me: { id: view.you_id, name: view.you }, status: 'ready' })
  const props = { id, type: 'viewCard', data: { card: cardOf(view, id) }, selected: false, dragging: false, zIndex: 0, isConnectable: false,
    positionAbsoluteX: 0, positionAbsoluteY: 0, selectable: true, deletable: false, draggable: false } as unknown as NodeProps
  return render(<ReactFlowProvider><CoreCard {...props} /></ReactFlowProvider>).container
}
const simple = (view: View, card: ViewCard) => <SimpleFace card={card} model={view.model!} noted={false} />
const classes = (el: HTMLElement) => Array.from(el.querySelectorAll('*'), (node) => node.getAttribute('class'))
// Leave the producer's fields intact while exercising the option's own line.
const keepOneOption = (view: View, id: string) => {
  view.model!.cards = view.model!.cards.filter((c) => c.family !== 'option' || c.id === id)
  return cardOf(view, id)
}

const headlineFixture = () => {
  const view = load('bakery-asked')
  const card = cardOf(view, 'second_oven')
  card.headline = { ...card.headline!, add: null }
  return { view, card, row: rowOf(card) }
}

beforeEach(() => {
  window.localStorage.clear()
  useSimpleLevel.setState({ levels: {} })
  setDefaultLevel('working')
  ring.mockClear()
})
afterEach(() => {
  cleanup()
  setDefaultLevel('simple')
  useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none' } as never)
  useMe.setState({ me: null, status: 'none' })
})

describe('Issue 7 withheld reasons and card blockers', () => {
  it('(a) draws the flagged Detailed row title at rest and leaves out the fallback words', () => {
    const view = loadProducer('studio')
    const option = keepOneOption(view, 'evening_classes'), row = rowOf(option)
    const path = `${option.id}.rows.0`
    const drawn = at(detail(view, row.aim_id!), path)
    const line = at(drawn, `${path}.title`)
    expect(line.textContent).toBe(row.title)
    expect(line.className).toContain(typography.viewPanelMeta)
    expect(line.classList.contains('text-text-light')).toBe(true)
    expect(drawn.textContent).not.toContain(row.text)
    expect(line.hasAttribute('tabindex')).toBe(false)
    expect(drawn.tabIndex).toBe(0)
  })

  it('(b) draws the title in place of text when a flagged headline has no add', () => {
    const view = loadProducer('app-launch'), card = cardOf(view, 'option_scheduled')
    const h = card.headline!
    const shared = detail(view, h.aim_id!).querySelector<HTMLElement>(`[data-said-once-on="${h.aim_id}"]`)!
    expect(shared.textContent).toBe(h.title)
    cleanup()
    keepOneOption(view, card.id)
    const face = detail(view, card.id).querySelector<HTMLElement>('[data-ok-face="none"]')!
    const line = at(face, `${card.id}.headline.title`)
    expect(line.textContent).toBe(h.title)
    expect(face.textContent).not.toContain(h.text)
    expect(at(face, `${card.id}.headline.add`)).toBeNull()
    expect(line.hasAttribute('tabindex')).toBe(false)
  })

  it('(h) says a flagged headline once only where every represented option draws the same line; a mixed set keeps each option\'s own line', () => {
    // Positive: the producer's equal flagged headlines are said once on their aim.
    const aim = 'allow_readiness_work', ids = ['option_scheduled', 'option_delay', 'option_isolate']
    const equal = loadProducer('app-launch'), title = cardOf(equal, ids[0]!).headline!.title
    const once = detail(equal, aim).querySelector<HTMLElement>(`[data-said-once-on="${aim}"]`)!
    expect(once.textContent).toContain(title)
    cleanup()
    // Mixed control (SYNTHETIC inputs, recorded): one emitted flag removed (option_delay), and distinct valid blocker refs on each
    // option's headline row (rows[2]) so the rings can be told apart. Every other emitted field is left as the producer wrote it.
    const mixed = loadProducer('app-launch')
    delete cardOf(mixed, 'option_delay').headline!.bare_fallback
    const refs: Record<string, string> = { option_scheduled: 'release_offset', option_delay: 'repair_duration', option_isolate: 'validation_duration' }
    for (const id of ids) rowOf(cardOf(mixed, id), 2).blocked_by = [figure(refs[id]!)]
    const aimFace = detail(mixed, aim)
    expect(aimFace.querySelector(`[data-said-once-on="${aim}"]`)?.textContent ?? '').not.toContain(title)
    cleanup()
    for (const id of ids) {
      const card = cardOf(mixed, id), h = card.headline!
      const face = detail(mixed, id).querySelector<HTMLElement>('[data-ok-face="none"]')!
      const line = id === 'option_delay' ? at(face, `${id}.headline.text`) : at(face, `${id}.headline.title`)
      expect(line.textContent).toBe(id === 'option_delay' ? h.text : h.title)
      fireEvent.pointerEnter(line)
      expectRing(refs[id]!)
      fireEvent.pointerLeave(line)
      expectRing()
      cleanup()
    }
  })

  it('(c) keeps the add line and base hover exactly with a flagged headline that has an add', async () => {
    const view = loadProducer('bakery-asked'), card = keepOneOption(view, 'second_oven')
    const h = card.headline!
    const face = detail(view, card.id).querySelector<HTMLElement>('[data-ok-face="none"]')!
    const line = at(face, `${card.id}.headline.add`)
    // The face leads with the add line; the headline row's own input to check (RowBelow, base A7(a)) stays under it.
    expect(face.textContent?.startsWith(h.add!)).toBe(true)
    expect(line.textContent).toBe(h.add)
    expect(at(face, `${card.id}.headline.title`)).toBeNull()
    const flaggedHTML = face.outerHTML
    expect(await tipOf(line)).toBe(`${h.why}\n${h.add}`)
    cleanup()
    delete h.bare_fallback
    const base = detail(view, card.id).querySelector<HTMLElement>('[data-ok-face="none"]')!
    expect(base.outerHTML).toBe(flaggedHTML)
  })

  it('(d) keeps base row and headline words when the flags are removed from the same producer fixture', () => {
    const view = loadProducer('app-launch'), option = keepOneOption(view, 'option_scheduled')
    const row = rowOf(option), h = option.headline!, path = `${option.id}.rows.0`
    delete row.bare_fallback
    delete h.bare_fallback
    const aim = detail(view, row.aim_id!)
    expect(at(aim, path).querySelector('[data-row-words]')?.textContent).toBe(row.text)
    expect(at(aim, `${path}.title`)).toBeNull()
    cleanup()
    const face = detail(view, option.id)
    expect(at(face, `${option.id}.headline.text`).textContent).toBe(h.text)
    expect(at(face, `${option.id}.headline.title`)).toBeNull()
  })

  it('(e) keeps the base long-text control for an unflagged mixed reason', () => {
    const view = loadProducer('studio'), option = keepOneOption(view, 'evening_classes')
    const row = rowOf(option), path = `${option.id}.rows.0`
    // Core W3 combines the studio fixture's shared line with a separate option-specific blocker.
    const mixed = `${row.title} The evening classes have a separate unresolved condition.`
    delete row.bare_fallback
    row.text = row.title = mixed
    const drawn = at(detail(view, row.aim_id!), path)
    const button = drawn.querySelector<HTMLButtonElement>('[data-row-words-long] button')!
    expect(drawn.textContent).not.toContain(mixed)
    expect(at(drawn, `${path}.title`)).toBeNull()
    expect(button.getAttribute('aria-label')).toBe(mixed)
    fireEvent.click(button)
    expect(drawn.querySelector('[role="note"]')?.textContent).toBe(mixed)
  })

  it('(f) shares equal flagged row titles with exactly their card blockers and keeps distinct titles visible', () => {
    const view = loadProducer('app-launch'), aim = 'boss_discussion'
    const scheduled = cardOf(view, 'option_scheduled'), delayed = cardOf(view, 'option_delay'), isolated = cardOf(view, 'option_isolate')
    const first = rowOf(scheduled), second = rowOf(delayed), third = rowOf(isolated)
    first.blocked_by = [figure('release_offset')]
    second.blocked_by = [figure('repair_duration'), figure('release_offset')]
    third.blocked_by = [figure('validation_duration')]
    const sharedRoot = detail(view, aim)
    const selector = `[data-said-once-on="${aim}"] .ok-dt-said-line`
    const shared = sharedRoot.querySelectorAll<HTMLElement>(selector)
    expect([...shared].map((line) => line.textContent)).toEqual([first.title])
    expect(shared[0]!.querySelector('[data-row-words-long]')).toBeNull()
    expect(sharedRoot.querySelector('[data-aim-result]')).toBeNull()
    fireEvent.pointerEnter(shared[0]!)
    expectRing('release_offset', 'repair_duration', 'validation_duration')
    fireEvent.pointerLeave(shared[0]!)
    expectRing()
    cleanup()
    second.title = rowOf(delayed, 1).title
    third.title = rowOf(isolated, 2).title
    const split = detail(view, aim)
    expect(split.querySelector(selector)).toBeNull()
    expect([...split.querySelectorAll('[data-aim-result] [data-row-words]')].map((line) => line.textContent))
      .toEqual([first.title, second.title, third.title])
  })

  it.each([null, ''])('(g) rings the unflagged Detailed status when the row title is %s', (title) => {
    const { view, card, row } = headlineFixture()
    Object.assign(row, { title })
    const root = detail(view, card.id)
    const status = at(root, `${card.id}.headline.text`)
    expect(status.textContent).toBe(card.headline!.text)
    expect(at(root, `${card.id}.rows.0.title`)).toBeNull()
    fireEvent.pointerEnter(status)
    expectRing('sales_target')
    cleanup()
    card.headline = { ...card.headline!, add: 'Review the delivery schedule.' }
    const withAdd = detail(view, card.id)
    expect(at(withAdd, `${card.id}.headline.add`).textContent).toBe(card.headline.add)
    expect(at(withAdd, `${card.id}.headline.text`)).toBeNull()
  })

  it('(g) rings only the options that use an unflagged shared headline', () => {
    const view = load('app-launch')
    const first = cardOf(view, 'option_scheduled'), second = cardOf(view, 'option_delay'), third = cardOf(view, 'option_isolate')
    rowOf(first).title = 'The scheduled option has its own row title.'
    rowOf(second).title = 'The delayed option has its own row title.'
    rowOf(third).title = 'This option has a separate reason.'
    third.headline = { ...third.headline!, why: 'The last option has its own explanation.' }
    rowOf(first).blocked_by = [figure('release_offset')]
    rowOf(second).blocked_by = [figure('repair_duration'), figure('release_offset')]
    rowOf(third).blocked_by = [figure('validation_duration')]
    const aim = 'boss_discussion', root = detail(view, aim)
    const shared = root.querySelector<HTMLElement>(`[data-said-once-on="${aim}"] .ok-dt-said-line`)!
    expect(shared.textContent).toBe(first.headline!.text)
    fireEvent.pointerEnter(shared)
    expectRing('release_offset', 'repair_duration')
    fireEvent.pointerLeave(shared)
    expectRing()
  })

  it('(g) rings a headline-less row from its long-text button or short pointer-only line', () => {
    const { view, card, row } = headlineFixture()
    card.headline = null
    row.aim_id = null
    row.title = ''
    row.text = 'The figures cannot be calculated until the delivery team confirms the arrival date for the second oven.'
    const fallback = detail(view, card.id)
    const button = fallback.querySelector<HTMLButtonElement>('[data-row-words-long] button')!
    act(() => button.focus())
    expectRing('sales_target')
    cleanup()
    row.text = 'Confirm the delivery date.'
    row.title = 'The full explanation stays off the row.'
    const short = detail(view, card.id)
    const line = at(short, `${card.id}.rows.0.text`)
    expect(line.textContent).toBe(row.text)
    expect(line.hasAttribute('tabindex')).toBe(false)
    expect(short.querySelector('[data-row-words-long]')).toBeNull()
    fireEvent.pointerEnter(line)
    expectRing('sales_target')
  })

  it('(g) rings only the represented secondary rows from their shared keyboard stop', () => {
    const view = load('bakery-asked'), aim = 'within_budget'
    const first = rowOf(cardOf(view, 'second_oven'), 1), second = rowOf(cardOf(view, 'longer_hours'), 1)
    first.blocked_by = [figure('oven_price')]
    second.blocked_by = [figure('budget')]
    cardOf(view, 'second_oven').rows.push({ ...first, title: 'A separate withheld row.', blocked_by: [figure('fitting')] })
    const root = detail(view, aim)
    const shared = root.querySelector<HTMLElement>(`[data-said-once-on="${aim}"] .ok-dt-said-line`)!
    expect(shared.textContent).toBe(first.state_text)
    expect(root.querySelector('[data-aim-result="second_oven"]')).toBeNull()
    act(() => shared.focus())
    expect(document.activeElement).toBe(shared)
    expectRing('oven_price', 'budget')
    act(() => shared.blur())
    expectRing()
  })

  it('(c) composes the Detailed row tip and clears on leave, blur and Escape after hover, focus or press', async () => {
    const view = load('bakery-asked'), card = cardOf(view, 'second_oven'), row = rowOf(card, 1)
    row.title = 'The oven price is still missing.'
    const root = detail(view, 'within_budget'), el = at(root, `${card.id}.rows.1`)
    fireEvent.pointerEnter(el)
    expectRing('oven_price')
    fireEvent.pointerLeave(el)
    expectRing()
    expect(await tipOf(el)).toContain(row.title)
    act(() => el.focus())
    expect(document.activeElement).toBe(el)
    expectRing('oven_price')
    act(() => el.blur())
    expectRing()
    act(() => el.focus())
    fireEvent.keyDown(el, { key: 'Escape' })
    expectRing()
    fireEvent.click(el)
    expectRing('oven_price')
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expectRing()
  })

  it('(c) leave and unmount release only their own instance even when the row path is the same', () => {
    const view = load('bakery-asked'), aim = 'within_budget', path = 'second_oven.rows.1'
    const draw = (id: string) => {
      const copy = structuredClone(view)
      rowOf(cardOf(copy, 'second_oven'), 1).blocked_by = [figure(id)]
      return render(<AimResults aim={cardOf(copy, aim)} model={copy.model!} shared={new Map()} />)
    }
    const left = draw('oven_price'), right = draw('budget')
    const first = at(left.container, path), second = at(right.container, path)
    act(() => second.focus())
    fireEvent.pointerEnter(first)
    expectRing('budget', 'oven_price')
    fireEvent.pointerLeave(first)
    expectRing('budget')
    fireEvent.pointerEnter(first)
    expectRing('budget', 'oven_price')
    left.unmount()
    expectRing('budget')
    right.unmount()
    expectRing()
  })

  it('(d) preserves all Simple text, classes and tips while the existing status and stop control the ring', async () => {
    const { view, card, row } = headlineFixture()
    const untouched = structuredClone(card)
    row.blocked_by = []
    rowOf(untouched).blocked_by = []
    const { container, rerender } = render(simple(view, untouched))
    const text = container.textContent, beforeClasses = classes(container)
    row.blocked_by = [figure('sales_target')]
    rerender(simple(view, card))
    expect(container.textContent).toBe(text)
    expect(classes(container)).toEqual(beforeClasses)
    const status = container.querySelector<HTMLElement>('[data-simple-face="no-chance"]')!
    const stop = container.querySelector<HTMLElement>('[data-simple-card]')!
    expect(status.hasAttribute('tabindex')).toBe(false)
    expect(stop.tabIndex).toBe(0)
    fireEvent.pointerEnter(status)
    expectRing('sales_target')
    fireEvent.pointerLeave(status)
    expectRing()
    expect(await tipOf(status)).toBe(card.headline!.why)
    act(() => stop.focus())
    expectRing('sales_target')
    act(() => stop.blur())
    expectRing()
    expect(await tipOnFocus(stop)).toContain(rowOf(card, 1).title)
    expectRing()
  })

  it('(d) keeps Simple pointer-only when there are no other-results words for a card stop', () => {
    const { view, card } = headlineFixture()
    card.rows = [card.rows[0]!]
    const { container } = render(simple(view, card))
    const stop = container.querySelector<HTMLElement>('[data-simple-card]')!
    const status = container.querySelector<HTMLElement>('[data-simple-face="no-chance"]')!
    expect(stop.hasAttribute('tabindex')).toBe(false)
    expect(status.hasAttribute('tabindex')).toBe(false)
    fireEvent.click(status)
    expectRing('sales_target')
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expectRing()
  })

  it('(d) rings the shared Simple aim status without giving it a keyboard stop', () => {
    const view = load('app-launch'), card = cardOf(view, 'boss_discussion')
    rowOf(cardOf(view, 'option_scheduled')).blocked_by = [figure('release_offset')]
    const { container } = render(simple(view, card))
    const status = container.querySelector<HTMLElement>('[data-simple-no-chance-once]')!
    expect(status.hasAttribute('tabindex')).toBe(false)
    expect(status.closest('[data-simple-card]')!.hasAttribute('tabindex')).toBe(false)
    fireEvent.pointerEnter(status)
    expectRing('release_offset', 'boss_discussion')
  })

  it('(e) ignores a drawn link record and an unknown ref without adding text on either face', () => {
    const { view, card, row } = headlineFixture()
    row.blocked_by = []
    const baseline = detail(view, card.id).querySelector<HTMLElement>('[data-ok-face="none"]')!.textContent
    const simpleBase = render(simple(view, card)).container.textContent
    cleanup()
    row.blocked_by = [{ ref: view.model!.links[0]!.records[0]!, role: 'link' }, figure('unknown_record')]
    const detailed = detail(view, card.id).querySelector<HTMLElement>('[data-ok-face="none"]')!
    const simpleWithRefs = render(simple(view, card)).container
    expect(detailed.textContent).toBe(baseline)
    expect(simpleWithRefs.textContent).toBe(simpleBase)
    fireEvent.pointerEnter(at(detailed, `${card.id}.headline.text`))
    fireEvent.pointerEnter(simpleWithRefs.querySelector('[data-simple-face="no-chance"]')!)
    expect(ring).not.toHaveBeenCalled()
    // Positive contrast makes this case fail on the base as well.
    row.blocked_by = [figure('sales_target'), ...row.blocked_by]
    cleanup()
    const positive = render(simple(view, card)).container
    fireEvent.pointerEnter(positive.querySelector('[data-simple-face="no-chance"]')!)
    expectRing('sales_target')
  })

  it('(e) keeps relation records rendered as links out of the card painter', () => {
    const view = load('app-launch'), aim = 'allow_readiness_work'
    for (const option of view.model!.cards.filter((c) => c.family === 'option')) {
      rowOf(option, 2).blocked_by = [figure('isolation_readiness_link'), { ref: 'schedule_assumptions', role: 'note' }]
    }
    const root = detail(view, aim)
    fireEvent.pointerEnter(root.querySelector('[data-said-once-on] .ok-dt-said-line')!)
    expectRing('schedule_assumptions')
  })
})

it('withheld result copy stays out of a figure’s passages and a caution does not become a next action', () => {
  const view = { ...loadProducer('studio'), gated: false }
  const option = cardOf(view, 'evening_classes')
  const withheld = rowOf(option)
  const reason = 'Waiting for the landlord’s written consent.'
  withheld.title = reason
  withheld.blocked_by = [figure(option.id)]
  option.worth_checking = [{ code: 'assumption_without_test', title: 'An untested assumption', text: 'The range needs scrutiny.', rests_on: [option.id], olumi: true }]
  view.model!.run!.find_out = []
  useViewStore.setState({ view, error: null, stale: false })
  useMe.setState({ me: { id: view.you_id, name: view.you }, status: 'ready' })
  function Foot() {
    const explanations = useModelExplanations()
    return <ChatFootRow sources={[]} explanations={{ ...explanations, selected: option.id }} />
  }
  const result = render(<Foot />)
  fireEvent.click(result.getByTestId('view-chat-foot-explanations'))
  expect(result.getByText('No next action recorded')).toBeDefined()
  expect(result.getByText('The range needs scrutiny.')).toBeDefined()
  expect(result.queryByText(reason)).toBeNull()
})
