import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

const canvas = vi.hoisted(() => ({ ring: vi.fn(), focus: vi.fn(), reach: vi.fn(), show: vi.fn() }))
const chat = vi.hoisted(() => ({ method: vi.fn(), prefill: vi.fn() }))
vi.mock('../../reasoning/tabRing', async (original) => ({ ...await original<typeof import('../../reasoning/tabRing')>(), ringFrom: canvas.ring }))
vi.mock('../../../canvas/utils/focusHelpers', async (original) => ({ ...await original<typeof import('../../../canvas/utils/focusHelpers')>(), focusNodeById: canvas.focus }))
vi.mock('../../v12/showInWorkspace/show', async (original) => ({ ...await original<typeof import('../../v12/showInWorkspace/show')>(), recordReach: canvas.reach, showRecord: canvas.show }))
vi.mock('../../ViewChat', async (original) => {
  const real = await original<typeof import('../../ViewChat')>()
  return {
    ...real,
    runMethod: chat.method,
    prefillComposer: (text: string) => {
      chat.prefill(text)
      real.prefillComposer(text)
    },
  }
})

import { getOutputTabsForParity } from '../../../canvas/components/OutputsDock'
import { useCanvasStore } from '../../../canvas/store'
import { useUIStore } from '../../../stores/uiStore'
import type { View } from '../../client'
import { installCanvasFocus } from '../../focus/canvas'
import { setFocusSubject } from '../../focus/subject'
import { viewOf } from '../../port/__tests__/viewAt'
import { useReasoningFocus } from '../../reasoning/focusRequest'
import { useViewStore } from '../../store'
import { useViewChat } from '../../ViewChat'
import { CheckList, CHECK_FILL } from '../CheckList'
import { checkItemsOf, checkNeedsOf, CHECK_WORDS } from '../items'

const fixture = () => {
  const view = viewOf('golden/bakery')
  const model = view.model!
  const run = model.run!
  const aim = run.find_out![0]!
  const [first, second] = aim.figures
  aim.figures = [second!, first!]
  run.find_out_heading = 'Core heading'
  run.find_out!.push({ ...aim, aim: 'within_budget', line: 'Core line without figures', figures: [] })
  const ranked = model.cards.find((card) => card.id === first!.id)!
  const other = model.cards.find((card) => card.id === 'oven_price')!
  for (const card of [ranked, other]) {
    card.heading = first!.label
    card.figure = { ...card.figure!, text: '' }
    card.values = null
    card.status = null
  }
  other.worth_checking = [{ code: 'assumption_without_test', title: other.heading, text: 'Core observation', olumi: true, rests_on: [] }]
  run.shared_blockers = [
    { aim_id: other.id, options: [], text: 'Same words' },
    { aim_id: ranked.id, options: [], text: 'Same words' },
  ]
  const option = model.cards.find((card) => card.id === 'second_oven')!
  const none = option.rows.find((item) => item.kind === 'none')!
  const chance = option.rows.find((item) => item.kind === 'chance')!
  for (const card of model.cards.filter((item) => item.family === 'option')) card.rows = []
  option.rows = [none, { ...chance, chance: null, title: '', value: 'Core held chance' }]
  run.waits_on = { head: '', label: '', text: '', items: [
    { id: 'fitting', text: 'Same words', title: 'First wait', answer: false, unknown: null, edit: null },
    { id: 'fitting', text: 'Second wait', title: '', answer: false, unknown: null, edit: null },
  ] }
  model.cards[0]!.challenged = true
  model.coaching_questions = ['Core question Z', 'Core question A']
  model.sharpen = [
    { id: 'shared_mechanism', lead: '', emphasis: 'Core fallback', rationale: 'Core reason', move: null },
    { id: 'risk_count', lead: 'Core lead', emphasis: 'Core emphasis', rationale: 'Core rationale', move: 'pre_mortem' },
  ]
  view.session!.methods = [{ ...view.session!.methods[0]!, id: 'pre_mortem', text: 'Core method' }]
  return { view, model, ranked, other, aim, first: first!, second: second! }
}

const show = (view: View) => {
  useViewStore.setState({ view, sid: view.id, at: null, error: null, stale: false, status: 'ready' })
  return render(<CheckList model={view.model!} view={view} sid={view.id} />)
}
const row = (key: string) => document.querySelector<HTMLButtonElement>(`[data-check-item="${key}"]`)!
const details = (button: HTMLButtonElement) => document.getElementById(button.getAttribute('aria-controls')!)!
const toggle = (group: string) => document.querySelector<HTMLButtonElement>(`[data-check-more="${group}"]`)!
let unsubscribeCanvas: (() => void) | undefined

afterEach(() => {
  cleanup()
  unsubscribeCanvas?.()
  unsubscribeCanvas = undefined
  setFocusSubject(null)
  useCanvasStore.getState().clearSelection()
  useUIStore.setState({ activeOutputTab: 'results', activeOutputTabVersion: 0 })
  useViewChat.setState({ text: '', prefilled: null })
  vi.clearAllMocks()
  canvas.reach.mockReset()
  canvas.show.mockReset()
  vi.unstubAllEnvs()
  useViewStore.setState({ sid: null, view: null, at: null })
  useReasoningFocus.setState({ request: null })
})

describe('What to check', () => {
  it('uses the fixed groups and Core order, keeping identical words and dropping only the matching size id', () => {
    const { model, view, ranked, other, first, second } = fixture()
    const groups = checkItemsOf(model, view)
    expect(groups.map((group) => group.kind)).toEqual(['needs', 'find', 'examine'])
    const [needs, find, examine] = groups.map((group) => group.blocks.flatMap((block) => block.items))
    expect(needs!.slice(0, 2).map(({ key, short }) => [key, short])).toEqual([['blocks:0', 'Same words'], ['blocks:1', 'Same words']])
    expect(needs!.filter(({ kind }) => kind === 'waits').map(({ key, short }) => [key, short])).toEqual([['waits:fitting', 'Same words']])
    expect(checkNeedsOf(model).map(({ key }) => key)).toEqual([
      'blocks:0', 'blocks:1', 'none:second_oven.0', 'held:second_oven.1', 'waits:fitting', `size:${ranked.id}`, `size:${other.id}`, `worth:${other.id}.0`,
    ])
    expect(needs!.map(({ key }) => key)).toEqual([
      'blocks:0', 'blocks:1', 'none:second_oven.0', 'held:second_oven.1', 'waits:fitting', `size:${other.id}`, `worth:${other.id}.0`,
    ])
    expect(needs!.at(-1)).toMatchObject({ key: `worth:${other.id}.0`, short: other.heading, at: `${other.id}.worth_checking.0.title`, long: [{ text: 'Core observation', at: `${other.id}.worth_checking.0.text` }] })
    expect(find!.map(({ key }) => key)).toEqual([`f:0:${second.id}`, `f:0:${first.id}`])
    const widen = ['askOption', 'askRisk'].filter((key) => view.model_words[key as keyof View['model_words']]).map((key) => `w:${key}`)
    expect(examine!.map(({ key }) => key)).toEqual([`c:${model.cards[0]!.id}`, 'q:0', 'q:1', ...widen, 's:risk_count', 's:shared_mechanism'])
    show(view)
    expect([...document.querySelectorAll<HTMLElement>('[data-check-group]')].map((el) => el.dataset.checkGroup)).toEqual(['needs', 'find', 'examine'])
    expect(screen.getByText('Core heading')).toHaveAttribute('data-view', 'run.find_out_heading')
    expect(document.querySelector('[data-view="within_budget.heading"]')).toHaveTextContent(model.cards.find((card) => card.id === 'within_budget')!.heading)
    expect(screen.queryByText('Core line without figures')).toBeNull()
    expect(toggle('find')).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(toggle('find'))
    expect(screen.getByText('Core line without figures')).toHaveAttribute('data-view', 'run.find_out.1.line')
    expect(document.querySelector('[data-view="run.find_out.0.line"]')).toHaveTextContent(model.run!.find_out![0]!.line)
  })

  it('shows four card tiles at rest, then the remaining tiles and card-less rows when expanded', async () => {
    const user = userEvent.setup()
    const { view, model, other } = fixture()
    model.run!.shared_blockers!.push({ aim_id: 'unshown-aim', options: [], text: 'Core card-less need' })
    show(view)
    const needs = document.querySelector('[data-check-group="needs"]')!
    const keys = () => [...needs.querySelectorAll<HTMLButtonElement>('[data-check-item]')].map((button) => button.dataset.checkItem)
    expect(keys()).toEqual(['blocks:0', 'blocks:1', 'none:second_oven.0', 'held:second_oven.1'])
    expect(toggle('needs')).toHaveTextContent(CHECK_WORDS.more(4))
    const held = row('held:second_oven.1')
    expect(held.closest('ul')).toHaveClass('grid-cols-2')
    expect(held.querySelector('[data-node-shape="option"]')).toHaveAttribute('width', '14')
    expect(held.querySelector('[data-letter-chip]')).toHaveTextContent('A')
    expect(held.querySelector('[data-view="second_oven.heading"]')).toHaveClass('line-clamp-2')
    expect(held).toHaveAttribute('aria-expanded', 'false')
    expect(held).not.toHaveAttribute('aria-pressed')
    await user.hover(held)
    expect(await screen.findByRole('tooltip')).toHaveAttribute('data-view', 'second_oven.rows.1.value')
    expect(screen.getByRole('tooltip')).toHaveTextContent('Core held chance')
    await user.click(held)
    expect(held).toHaveAttribute('aria-expanded', 'true')
    expect(details(held)).toHaveClass('col-span-2')
    expect(held.nextElementSibling).toBe(details(held))
    expect(details(held).querySelector('[data-view="second_oven.rows.1.value"]')).toHaveTextContent('Core held chance')
    expect(within(details(held)).getAllByRole('button')).toEqual([within(details(held)).getByRole('button', { name: CHECK_WORDS.ask })])
    fireEvent.click(held)
    expect(details(held)).toHaveAttribute('hidden')
    fireEvent.click(toggle('needs'))
    expect(keys().slice(4)).toEqual(['waits:fitting', `size:${other.id}`, `worth:${other.id}.0`, 'blocks:2'])
    expect(row('waits:fitting').querySelector('[data-face-mark="track"]')).toBeInTheDocument()
    expect(row(`size:${other.id}`).querySelector('[data-face-mark="track"]')).toBeInTheDocument()
    expect(row('blocks:2')).not.toHaveAttribute('data-check-tile')
    expect(row('blocks:2')).toHaveTextContent('Core card-less need')
  })

  it('retargets to the first matching row and unfolds its group without moving focus or the camera', () => {
    const { view, ranked } = fixture()
    unsubscribeCanvas = installCanvasFocus()
    show(view)
    act(() => row('blocks:0').focus())
    expect(row('waits:fitting')).toBeNull()
    act(() => useCanvasStore.getState().selectNodes(['fitting']))
    expect(row('waits:fitting')).toHaveAttribute('aria-expanded', 'true')
    expect(toggle('needs')).toHaveAttribute('aria-expanded', 'true')
    expect(row('blocks:0')).toHaveFocus()
    expect(canvas.focus).not.toHaveBeenCalled()
    expect(canvas.show).not.toHaveBeenCalled()

    act(() => useCanvasStore.getState().selectNodes([ranked.id]))
    expect(row('blocks:1')).toHaveAttribute('aria-expanded', 'true')
    expect(row(`f:0:${ranked.id}`)).toHaveAttribute('aria-expanded', 'false')
    act(() => useCanvasStore.getState().selectNodes(['carry_on']))
    expect(row('blocks:1')).toHaveAttribute('aria-expanded', 'true')
    expect(row('blocks:0')).toHaveFocus()

    canvas.ring.mockClear()
    fireEvent.click(row('blocks:1'))
    expect(row('blocks:1')).toHaveAttribute('aria-expanded', 'false')
    expect(canvas.ring).not.toHaveBeenCalled()
  })

  it('keeps a canvas row dismissed through a View refresh until a new canvas subject is set', () => {
    const { view, other } = fixture()
    const { rerender } = show(view)
    const subject = { kind: 'card', id: other.id, cards: [other.id], source: 'canvas' } as const
    act(() => setFocusSubject(subject))
    expect(row('blocks:0')).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(row('blocks:0'))
    expect(row('blocks:0')).toHaveAttribute('aria-expanded', 'false')

    const refreshed = structuredClone(view)
    rerender(<CheckList model={refreshed.model!} view={refreshed} sid={refreshed.id} />)
    expect(row('blocks:0')).toHaveAttribute('aria-expanded', 'false')
    act(() => setFocusSubject(subject))
    expect(row('blocks:0')).toHaveAttribute('aria-expanded', 'true')
  })

  it('drops the selected gap when a same-scenario refresh reuses its key for another card', () => {
    const { view, other, ranked } = fixture()
    const { rerender } = show(view)
    fireEvent.click(row('blocks:0'))
    expect(canvas.ring).toHaveBeenLastCalledWith('focus-subject', [other.id])

    const refreshed = structuredClone(view)
    refreshed.model!.run!.shared_blockers!.shift()
    rerender(<CheckList model={refreshed.model!} view={refreshed} sid={refreshed.id} />)
    expect(row('blocks:0')).toHaveAttribute('data-check-tile', ranked.id)
    expect(row('blocks:0')).toHaveAttribute('aria-expanded', 'false')
    expect(canvas.ring).toHaveBeenLastCalledWith('focus-subject', [])
  })

  it('places Ask Olumi after the row action, prefills the exact words once and fronts Olumi', () => {
    const { view, first } = fixture()
    vi.stubEnv('VITE_FEATURE_AI_PANEL_V2', 'true')
    useUIStore.setState({ activeOutputTab: 'analysisNew' })
    useViewChat.setState({ text: 'Existing draft' })
    show(view)
    expect(screen.queryByRole('button', { name: CHECK_WORDS.ask })).toBeNull()
    const figure = row(`f:0:${first.id}`)
    fireEvent.click(figure)
    const ask = within(details(figure)).getByRole('button', { name: CHECK_WORDS.ask })
    expect(within(details(figure)).getAllByRole('button')).toEqual([screen.getByTestId(`check-edit-${first.id}`), ask])
    fireEvent.click(ask)
    expect(chat.prefill.mock.calls).toEqual([[first.label]])
    expect(useViewChat.getState().text).toBe(`Existing draft\n${first.label}`)
    expect(useUIStore.getState().activeOutputTab).toBe('olumi')

    fireEvent.click(toggle('examine'))
    const question = row('q:0')
    fireEvent.click(question)
    expect(within(details(question)).getAllByRole('button').map((button) => button.textContent)).toEqual([CHECK_FILL])
  })

  it('uses the find heading to disclose the scope when all its figures fit', () => {
    const { view, model, aim } = fixture()
    model.run!.find_out = [aim]
    show(view)
    const button = toggle('find')
    const aimHeading = () => document.querySelector('[data-check-aim-heading]')
    expect(within(screen.getByRole('heading', { name: /Core heading/ })).getByRole('button')).toBe(button)
    expect(aimHeading()).toBeNull()
    expect(document.querySelector('[data-check-aim-line]')).toBeNull()
    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(aimHeading()).toHaveAttribute('data-view', `${aim.aim}.heading`)
    expect(document.querySelector('[data-view="run.find_out.0.line"]')).toHaveTextContent(aim.line)
    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(document.querySelector('[data-check-aim-line]')).toBeNull()
  })

  it('shows the method lead at rest, emphasis on hover and each selected segment at its own path', async () => {
    const user = userEvent.setup()
    const { view } = fixture()
    show(view)
    fireEvent.click(toggle('examine'))
    const method = row('s:risk_count')
    expect(method).toHaveTextContent(/^Core lead$/)
    expect(method.querySelector('[data-view="sharpen.1.lead"]')).toHaveClass('line-clamp-2')
    expect(row('s:shared_mechanism')).toHaveTextContent(/^Core fallback$/)
    await user.hover(method)
    const tip = await screen.findByRole('tooltip')
    expect(tip).toHaveTextContent(/^Core emphasis$/)
    expect(tip).toHaveAttribute('data-view', 'sharpen.1.emphasis')
    await user.click(method)
    expect([...details(method).querySelectorAll('[data-view]')].map((el) => [el.textContent, el.getAttribute('data-view')])).toEqual([
      ['Core emphasis', 'sharpen.1.emphasis'], ['Core rationale', 'sharpen.1.rationale'],
    ])
    expect(chat.method).not.toHaveBeenCalled()
    await user.click(within(details(method)).getByRole('button', { name: 'Core method' }))
    expect(chat.method.mock.calls).toEqual([['pre_mortem']])
  })

  it('selects one card, holds its shared ring apart from hover, and hides the actions when deselected', () => {
    const { view, first } = fixture()
    canvas.reach.mockReturnValue('card')
    const { unmount } = show(view)
    const button = row(`f:0:${first.id}`)
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(button).toHaveClass('grid', 'grid-cols-2')
    const value = button.querySelector('[data-view="run.find_out.0.figures.1.estimate_text"]')!
    expect(value.textContent).toBe(first.estimate_text)
    expect(value).toHaveClass('tabular-nums')
    fireEvent.pointerEnter(button)
    expect(canvas.ring).toHaveBeenLastCalledWith('check-tab-hover', [first.id])
    fireEvent.click(button)
    expect(canvas.ring).toHaveBeenLastCalledWith('focus-subject', [first.id])
    expect(canvas.focus.mock.calls).toEqual([[first.id]])
    expect(button).toHaveAttribute('data-selected', 'true')
    expect(within(details(button)).getByTestId(`check-edit-${first.id}`)).toBeInTheDocument()
    expect(details(button).querySelector('[data-view="run.find_out.0.figures.1.line"]')?.textContent).toBe(first.line)
    expect(details(button).querySelector('[data-view="run.find_out.0.figures.1.estimate_text"]')).toBeNull()
    fireEvent.pointerLeave(button)
    expect(canvas.ring).toHaveBeenLastCalledWith('check-tab-hover', [])
    fireEvent.click(button)
    expect(canvas.ring).toHaveBeenLastCalledWith('focus-subject', [])
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByTestId(`check-edit-${first.id}`)).toBeNull()
    expect(canvas.focus).toHaveBeenCalledTimes(1)
    fireEvent.click(button)
    unmount()
    expect(canvas.ring).toHaveBeenLastCalledWith('focus-subject', [])
  })

  it('moves focus between row buttons and uses native Enter and Space activation', async () => {
    const user = userEvent.setup()
    const { view, second } = fixture()
    canvas.reach.mockReturnValue('show')
    show(view)
    await user.tab()
    expect(row('blocks:0')).toHaveFocus()
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}')
    const ranked = row(`f:0:${second.id}`)
    expect(ranked).toHaveFocus()
    expect(ranked).toHaveAttribute('tabindex', '0')
    await user.keyboard('{Enter}')
    expect(ranked).toHaveAttribute('aria-expanded', 'true')
    expect(canvas.show.mock.calls).toEqual([[second.id]])
    expect(canvas.focus).not.toHaveBeenCalled()
    await user.keyboard(' ')
    expect(ranked).toHaveAttribute('aria-expanded', 'false')
    await user.keyboard('{ArrowUp}')
    expect(row('held:second_oven.1')).toHaveFocus()
  })

  it('focuses a folded card only after the show finishes and the card is reachable', async () => {
    const { view, first } = fixture()
    let finish!: () => void
    canvas.reach.mockReturnValueOnce('show').mockReturnValueOnce('card')
    canvas.show.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve }))
    show(view)
    fireEvent.click(row(`f:0:${first.id}`))
    expect(canvas.show.mock.calls).toEqual([[first.id]])
    expect(canvas.ring).toHaveBeenLastCalledWith('focus-subject', [first.id])
    expect(canvas.focus).not.toHaveBeenCalled()
    await act(async () => finish())
    expect(canvas.reach.mock.calls).toEqual([[first.id], [first.id]])
    expect(canvas.focus.mock.calls).toEqual([[first.id]])
  })

  it('does not focus a revealed card after its row has been deselected', async () => {
    const { view, first } = fixture()
    let finish!: () => void
    canvas.reach.mockReturnValueOnce('show').mockReturnValue('card')
    canvas.show.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve }))
    show(view)
    const button = row(`f:0:${first.id}`)
    fireEvent.click(button)
    fireEvent.click(button)
    await act(async () => finish())
    expect(canvas.focus).not.toHaveBeenCalled()
  })

  it('does not reselect the first panel row when its unfold resolves after another panel press', async () => {
    const { view, first, second } = fixture()
    let finish!: () => void
    canvas.reach.mockReturnValueOnce('show').mockReturnValue('card')
    canvas.show.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve }))
    show(view)
    const a = row(`f:0:${first.id}`)
    const b = row(`f:0:${second.id}`)
    fireEvent.click(a)
    fireEvent.click(b)
    await act(async () => finish())
    expect(canvas.focus.mock.calls).toEqual([[second.id]])
    expect(a).toHaveAttribute('aria-expanded', 'false')
    expect(b).toHaveAttribute('aria-expanded', 'true')
    expect(canvas.ring).toHaveBeenLastCalledWith('focus-subject', [second.id])
  })

  it('cancels pending panel focus when the canvas selects a card with no matching row', async () => {
    const { view, first } = fixture()
    let finish!: () => void
    canvas.reach.mockReturnValueOnce('show').mockReturnValue('card')
    canvas.show.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve }))
    show(view)
    const button = row(`f:0:${first.id}`)
    fireEvent.click(button)
    act(() => setFocusSubject({ kind: 'option', id: 'carry_on', cards: ['carry_on'], source: 'canvas' }))
    await act(async () => finish())
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(canvas.focus).not.toHaveBeenCalled()
  })

  it('keeps a typed question draft when its details are hidden and reopened', async () => {
    const user = userEvent.setup()
    const { view, model } = fixture()
    model.questions = [{ id: 'question', text: 'What would change your estimate?', about: null, role: null, unit: null }]
    show(view)
    fireEvent.click(toggle('examine'))
    const question = row('q:question')
    expect(screen.queryByTestId('reasoning-answer-input')).toBeNull()
    await user.click(question)
    const draft = screen.getByTestId('reasoning-answer-input')
    await user.type(draft, 'My unsent answer')
    await user.click(question)
    expect(question).toHaveAttribute('aria-expanded', 'false')
    expect(details(question)).toHaveAttribute('hidden')
    expect(draft).not.toBeVisible()
    await user.click(question)
    expect(screen.getByTestId('reasoning-answer-input')).toBe(draft)
    expect(draft).toBeVisible()
    expect(draft).toHaveValue('My unsent answer')
  })

  it('offers one Fill action and no Ask for a typed question on a historical View', () => {
    const { view, model } = fixture()
    model.questions = [{ id: 'question', text: 'What would change your estimate?', about: null, role: null, unit: null }]
    show(view)
    act(() => useViewStore.setState({ at: 1 }))
    fireEvent.click(toggle('examine'))
    const question = row('q:question')
    fireEvent.click(question)
    expect(within(details(question)).getAllByRole('button').map((button) => button.textContent)).toEqual([CHECK_FILL])
  })

  it('selects and focuses a requested folded item, and focuses the toggle when it folds again', () => {
    const { view } = fixture()
    show(view)
    expect(row('s:risk_count')).toBeNull()
    act(() => useReasoningFocus.setState({ request: { sid: view.id, key: 's:risk_count' } }))
    expect(row('s:risk_count')).toHaveFocus()
    expect(row('s:risk_count')).toHaveAttribute('aria-expanded', 'true')
    expect(useReasoningFocus.getState().request).toBeNull()
    fireEvent.click(toggle('examine'))
    expect(row('s:risk_count')).toBeNull()
    expect(toggle('examine')).toHaveFocus()
    expect(toggle('examine')).toHaveTextContent(CHECK_WORDS.more(6))
  })

  it('resets selection on a scenario change and rings without moving when the card is unreachable', () => {
    const { view, first } = fixture()
    const key = `f:0:${first.id}`
    canvas.reach.mockReturnValue(null)
    unsubscribeCanvas = installCanvasFocus()
    const { rerender } = show(view)
    fireEvent.click(row(key))
    expect(canvas.ring).toHaveBeenLastCalledWith('focus-subject', [first.id])
    expect(canvas.focus).not.toHaveBeenCalled()
    expect(canvas.show).not.toHaveBeenCalled()
    act(() => useViewStore.setState({ sid: 'another-scenario' }))
    rerender(<CheckList model={view.model!} view={view} sid="another-scenario" />)
    expect(row(key)).toHaveAttribute('aria-expanded', 'false')
    expect(canvas.ring).toHaveBeenLastCalledWith('focus-subject', [])
  })

  it('labels analysisNew Check on the Core lane and Reasoning off the lane', () => {
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    expect(getOutputTabsForParity().find((tab) => tab.id === 'analysisNew')?.label).toBe('Check')
    vi.stubEnv('VITE_OLUMI_CORE', '0')
    expect(getOutputTabsForParity().find((tab) => tab.id === 'analysisNew')?.label).toBe('Reasoning')
  })
})
