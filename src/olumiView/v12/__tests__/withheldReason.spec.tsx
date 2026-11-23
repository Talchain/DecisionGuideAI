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
import { useViewStore } from '../../store'
import { AimResults, ROW_WORDS_MAX } from '../detailed/marks'
import { SimpleFace } from '../SimpleFace'
import { setDefaultLevel, useSimpleLevel } from '../simpleStore'

vi.mock('../../../olumiCore/lane', async (real) => ({ ...(await real<object>()), isOlumiCoreLane: () => true }))
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
vi.mock('../../../canvas/nodes/shared/savedGraph', () => ({ useSavedGraphRead: () => ({ status: 'none' }), useSavedGraph: () => null }))
vi.mock('@xyflow/react', async (real) => ({ ...(await real<object>()), Handle: () => null }))
vi.mock('../../ring', async (real) => ({ ...(await real<object>()), attCards: vi.fn() }))

const load = (name: string): View => JSON.parse(readFileSync(`src/olumiView/fixtures/core-38eebca9/${name}.view3.json`, 'utf8'))
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
  it('(a) draws the whole Detailed title at rest with the next step in a separate element', async () => {
    const { view, card, row } = headlineFixture()
    const add = 'Check the signed delivery schedule.'
    const reason = 'The chance is withheld because the delivery schedule leaves the available production time unspecified.'
    expect(reason.length).toBeGreaterThan(ROW_WORDS_MAX)
    row.title = reason
    card.headline = { ...card.headline!, add }
    const face = detail(view, card.id).querySelector<HTMLElement>('[data-ok-face="none"]')!
    const line = at(face, `${card.id}.rows.0.title`)
    expect(line.textContent).toBe(reason)
    expect(line.className).toContain(typography.viewPanelMeta)
    expect(line.classList.contains('text-text-light')).toBe(true)
    expect(at(face, `${card.id}.headline.add`).textContent).toBe(add)
    expect(line.nextElementSibling).toBe(at(face, `${card.id}.headline.add`))
    expect(face.querySelector('[data-row-words-long]')).toBeNull()
    expect(face.textContent).not.toContain(card.headline.text)
    expect(line.hasAttribute('tabindex')).toBe(false)
    expect(await tipOf(line)).toBe(`${card.headline.why}\n${add}`)
  })

  it.each([null, ''])('(a) retains the Detailed status and its existing add fallback when the title is %s', (title) => {
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

  it('(b) draws one long shared title and rings only the options that use its line', () => {
    const view = load('app-launch')
    const first = cardOf(view, 'option_scheduled'), second = cardOf(view, 'option_delay'), third = cardOf(view, 'option_isolate')
    const title = 'The release review cannot be evaluated until the team establishes how much validation time remains.'
    rowOf(first).title = rowOf(second).title = title
    rowOf(third).title = 'This option has a separate reason.'
    third.headline = { ...third.headline!, why: 'The last option has its own explanation.' }
    rowOf(first).blocked_by = [figure('release_offset')]
    rowOf(second).blocked_by = [figure('repair_duration'), figure('release_offset')]
    rowOf(third).blocked_by = [figure('validation_duration')]
    const aim = 'boss_discussion', root = detail(view, aim)
    const shared = root.querySelector<HTMLElement>(`[data-said-once-on="${aim}"] .ok-dt-said-line`)!
    expect(title.length).toBeGreaterThan(ROW_WORDS_MAX)
    expect(shared.textContent).toBe(title)
    expect(shared.parentElement!.textContent).toBe(title)
    expect(shared.querySelector('[data-row-words-long]')).toBeNull()
    fireEvent.pointerEnter(shared)
    expectRing('release_offset', 'repair_duration')
    fireEvent.pointerLeave(shared)
    expectRing()
  })

  it('(a, c) keeps the existing long-text button for a headline-less row until Core supplies a title', () => {
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
    row.title = row.text
    const reason = detail(view, card.id)
    const title = at(reason, `${card.id}.rows.0.title`)
    expect(title.textContent).toBe(row.title)
    expect(title.hasAttribute('tabindex')).toBe(false)
    expect(reason.querySelector('[data-row-words-long]')).toBeNull()
    fireEvent.pointerEnter(title)
    expectRing('sales_target')
  })

  it('(b, c) rings only the represented secondary rows from their shared keyboard stop', () => {
    const view = load('bakery-asked'), aim = 'within_budget'
    const first = rowOf(cardOf(view, 'second_oven'), 1), second = rowOf(cardOf(view, 'longer_hours'), 1)
    first.blocked_by = [figure('oven_price')]
    second.blocked_by = [figure('budget')]
    cardOf(view, 'second_oven').rows.push({ ...first, title: 'A separate withheld row.', blocked_by: [figure('fitting')] })
    const root = detail(view, aim)
    const shared = root.querySelector<HTMLElement>(`[data-said-once-on="${aim}"] .ok-dt-said-line`)!
    expect(shared.textContent).toBe(first.title)
    expect(root.querySelector('[data-aim-result="second_oven"]')?.textContent).toContain('A separate withheld row.')
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
    fireEvent.pointerEnter(at(detailed, `${card.id}.rows.0.title`))
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
