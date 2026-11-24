import '@testing-library/jest-dom/vitest'
import { readFileSync } from 'node:fs'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useMe } from '../../../olumiCore/me'
import type { View } from '../../client'
import { chatQuestionsAllOf } from '../../layout'
import { pressCard, ringFrom } from '../../reasoning/tabRing'
import { useViewStore } from '../../store'
import { recordReach, showRecord } from '../../v12/showInWorkspace/show'
import { NEXT_STEP_WORDS, ViewChat } from '../../ViewChat'
import { CheckFirst, checkFirstCount, estimateChangesOf, missingInputsOf } from '../CheckFirst'

vi.mock('../../reasoning/tabRing', async (original) => ({
  ...(await original<typeof import('../../reasoning/tabRing')>()),
  pressCard: vi.fn(),
  ringFrom: vi.fn(),
}))

vi.mock('../../v12/showInWorkspace/show', async (original) => ({
  ...(await original<typeof import('../../v12/showInWorkspace/show')>()),
  recordReach: vi.fn(),
  showRecord: vi.fn(),
}))

const fixture = (name: string): View => JSON.parse(readFileSync(`src/olumiView/fixtures/${name}.view3.json`, 'utf8'))
const cafe = () => fixture('core-78c3afc4/cafe-waits')
const pending = () => fixture('break-even/break-even-pending')
const missingText = 'One missing input: a value for ‘tip gain’.'
const ready = (view: View) => {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false, at: null })
  useMe.setState({ me: { id: view.you_id, name: view.you }, status: 'ready' })
}
const figureIds = (root: HTMLElement) => [...root.querySelectorAll('[data-find-out-figure]')].map((row) => row.getAttribute('data-find-out-figure'))

beforeEach(() => {
  vi.mocked(recordReach).mockReturnValue('card')
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none', error: null })
  useMe.setState({ me: null, status: 'none' })
})

it('keeps the bakery estimate at its original path, with its scope and a pencil only in asks', () => {
  const view = fixture('core-38eebca9/bakery')
  ready(view)
  const { rerender } = render(<CheckFirst view={view} place="asks" />)
  const ranking = screen.getByTestId('port-find-out')
  const aim = view.model!.run!.find_out![0]!
  expect(figureIds(ranking)).toEqual(['extra_sold_per_oven'])
  expect(ranking.querySelector('[data-view="run.find_out.0.figures.1.line"]')?.textContent).toBe(aim.figures[1]!.line)
  expect(screen.getByTestId('find-out-scope').textContent).toBe(aim.line)
  expect(screen.getByTestId('find-out-scope')).toHaveAttribute('data-view', 'run.find_out.0.line')
  expect(screen.getByTestId('worth-edit-extra_sold_per_oven')).toContainElement(screen.getByTestId('worth-glyph-extra_sold_per_oven'))
  expect(checkFirstCount(view, 'asks')).toBe(1)

  rerender(<CheckFirst view={view} place="pending" />)
  expect(figureIds(screen.getByTestId('port-find-out'))).toEqual(['extra_sold_per_oven'])
  expect(screen.queryByTestId('worth-edit-extra_sold_per_oven')).toBeNull()
  expect(screen.getByTestId('check-first').querySelector('[data-find-out-give]')).toBeNull()
  expect(checkFirstCount(view, 'pending')).toBe(1)
})

it('keeps both European estimates in Core’s order', () => {
  const view = fixture('core-38eebca9/european')
  render(<CheckFirst view={view} place="asks" />)
  expect(figureIds(screen.getByTestId('port-find-out'))).toEqual(['existing_market_acquisitions', 'expansion_churn'])
  expect(checkFirstCount(view, 'asks')).toBe(2)
})

it('opens Olumi asks with zero questions and one shared missing input pointing to tip gain', () => {
  const view = cafe()
  ready(view)
  expect(chatQuestionsAllOf(view.model)).toHaveLength(0)
  expect(missingInputsOf(view.model!)).toEqual([{ aim: 'aim_tips', text: missingText, at: 'opt_a.rows.0', refs: ['tip_gain'] }])
  render(<ViewChat />)
  const asks = screen.getByTestId('view-chat-foot-asks')
  expect(asks).toHaveAccessibleName('Olumi asks · 1')
  fireEvent.click(asks)
  const check = screen.getByTestId('check-first')
  expect(check).toBeVisible()
  expect(within(check).getAllByText(missingText, { exact: true })).toHaveLength(1)
  const target = within(check).getByRole('button', { name: missingText })
  expect(target).toHaveAttribute('data-check-first-target', 'tip_gain')
  expect(target).toHaveAttribute('data-view', 'opt_a.rows.0.next_test')
  fireEvent.focus(target)
  expect(ringFrom).toHaveBeenLastCalledWith('check-first', ['tip_gain'])
  fireEvent.blur(target)
  expect(ringFrom).toHaveBeenLastCalledWith('check-first', [])
  fireEvent.mouseEnter(target)
  expect(ringFrom).toHaveBeenLastCalledWith('check-first', ['tip_gain'])
  fireEvent.mouseLeave(target)
  expect(ringFrom).toHaveBeenLastCalledWith('check-first', [])
  fireEvent.click(target)
  expect(pressCard).toHaveBeenCalledTimes(1)
  expect(pressCard).toHaveBeenCalledWith('tip_gain')
})

it.each(['ambiguous', 'missing card'] as const)('draws plain text when the target is %s', (kind) => {
  const view = cafe(), model = view.model!
  if (kind === 'ambiguous') {
    const row = model.cards.find((card) => card.id === 'opt_b')!.rows[0]!
    if (row.kind !== 'none') throw new Error('Expected the cafe option to have a missing input')
    row.blocked_by!.push({ role: 'figure', ref: 'tip_bar' })
    expect(missingInputsOf(model)[0]!.refs).toEqual(['tip_gain', 'tip_bar'])
  } else {
    model.cards = model.cards.filter((card) => card.id !== 'tip_gain')
  }

  render(<CheckFirst view={view} place="asks" />)
  const check = screen.getByTestId('check-first')
  const sentence = within(check).getByText(missingText, { exact: true })
  expect(sentence.tagName).toBe('P')
  expect(sentence).toHaveAttribute('data-check-first-input', '')
  expect(sentence).toHaveAttribute('data-view', 'opt_a.rows.0.next_test')
  expect(check.querySelector('button')).toBeNull()
  fireEvent.click(sentence)
  expect(pressCard).not.toHaveBeenCalled()
})

it('draws only the sized, added estimate from the pending break-even proposal', () => {
  const view = pending()
  const late = view.model!.cards.find((card) => card.id === 'late_change')!
  const { rerender } = render(<CheckFirst view={view} place="pending" />)
  const check = screen.getByTestId('check-first')
  expect(screen.getByTestId('check-first-unranked').textContent).toBe('Not ranked yet')
  expect(estimateChangesOf(view)).toEqual([{ i: 5, card: late }])
  expect(within(check).getAllByRole('listitem')).toHaveLength(1)
  expect(check.querySelector('[data-view="late_change.heading"]')?.textContent).toBe(late.heading)
  expect(check.querySelector('[data-view="late_change.figure.text"]')?.textContent).toBe(late.figure!.text)
  expect(check.querySelector('[data-view^="late_after."], [data-view^="f_after."], [data-view^="eff_dispatch."]')).toBeNull()
  expect(check.querySelector('button')).toBeNull()
  expect(checkFirstCount(view, 'pending')).toBe(1)
  expect(checkFirstCount(view, 'asks')).toBe(0)

  delete late.figure!.range
  rerender(<CheckFirst view={view} place="pending" />)
  expect(screen.queryByTestId('check-first-unranked')).toBeNull()
  expect(screen.queryByTestId('check-first')).toBeNull()
})

it('counts only quantity cards as estimates', () => {
  const view = pending()
  const late = view.model!.cards.find((card) => card.id === 'late_change')!
  const option = view.model!.cards.find((card) => card.id === 'opt_now')!
  option.figure = { ...late.figure!, range: structuredClone(late.figure!.range!) }

  expect(estimateChangesOf(view)).toEqual([{ i: 5, card: late }])
  render(<CheckFirst view={view} place="pending" />)
  expect(screen.getByTestId('check-first').querySelector('[data-view="opt_now.heading"]')).toBeNull()
})

it('counts only added cards as estimates', () => {
  const view = pending()
  const late = view.model!.cards.find((card) => card.id === 'late_change')!
  late.change = { ...late.change!, kind: 'changed' }

  expect(estimateChangesOf(view)).toEqual([])
  render(<CheckFirst view={view} place="pending" />)
  expect(screen.queryByTestId('check-first-unranked')).toBeNull()
})

it('mounts once inside the open review while held, then once in asks alongside the questions', () => {
  const view = fixture('core-38eebca9/european')
  const proposal = fixture('core-38eebca9/proposal').proposal
  expect(proposal).not.toBeNull()
  ready({ ...view, proposal })
  render(<ViewChat />)

  const n = chatQuestionsAllOf(view.model).length
  expect(n).toBeGreaterThan(0)
  expect(screen.getByTestId('view-chat-foot-asks')).toHaveAccessibleName(`Olumi asks · ${n}`)
  fireEvent.click(screen.getByTestId('view-chat-foot-proposal'))
  expect(screen.queryByTestId('check-first')).toBeNull()
  fireEvent.click(screen.getByTestId('view-proposal-review-toggle'))
  const review = screen.getByTestId('view-proposal-review')
  const check = within(review).getByTestId('check-first')
  expect(check).toHaveAttribute('data-check-first', 'pending')
  expect(check.previousElementSibling?.textContent).toBe(NEXT_STEP_WORDS.approve)
  expect(check).toBeVisible()
  expect(screen.getAllByTestId('check-first')).toEqual([check])

  act(() => ready(view))
  expect(screen.queryByTestId('view-proposal-review')).toBeNull()
  const asks = screen.getByTestId('view-chat-foot-asks')
  expect(asks).toHaveAccessibleName(`Olumi asks · ${n + 2}`)
  fireEvent.click(asks)
  const now = screen.getByTestId('check-first')
  expect(now).toHaveAttribute('data-check-first', 'asks')
  expect(now.nextElementSibling).toBe(screen.getByTestId('view-model-question'))
  expect(now).toBeVisible()
})

it('omits reference rows from the missing inputs', () => {
  const view = cafe(), model = view.model!
  const row = model.cards.find((card) => card.id === 'opt_a')!.rows[0]!
  if (row.kind !== 'none') throw new Error('Expected the cafe option to have a missing input')
  row.aim_role = 'reference'
  row.next_test = 'Reference words'

  expect(missingInputsOf(model).map(({ text }) => text)).not.toContain('Reference words')
  render(<CheckFirst view={view} place="asks" />)
  const check = within(screen.getByTestId('check-first'))
  expect(check.queryByText('Reference words')).toBeNull()
  expect(check.getAllByText(missingText, { exact: true })).toHaveLength(1)
})

it('uses only figure refs for the missing input target', () => {
  const view = cafe(), model = view.model!
  const row = model.cards.find((card) => card.id === 'opt_b')!.rows[0]!
  if (row.kind !== 'none') throw new Error('Expected the cafe option to have a missing input')
  row.blocked_by!.push({ role: 'link', ref: 'some_link' }, { role: 'risk', ref: 'some_risk' })

  expect(missingInputsOf(model)[0]!.refs).toEqual(['tip_gain'])
  render(<CheckFirst view={view} place="asks" />)
  const target = within(screen.getByTestId('check-first')).getByRole('button', { name: missingText })
  expect(target).toHaveAttribute('data-check-first-target', 'tip_gain')
})

it('omits top proposal changes from the unranked estimates', () => {
  const view = pending()
  view.proposal!.changes[5]!.top = true

  expect(estimateChangesOf(view)).toEqual([])
  render(<CheckFirst view={view} place="pending" />)
  expect(screen.queryByTestId('check-first-unranked')).toBeNull()
})

it('draws the ranking in place of the missing input fallback', () => {
  const view = fixture('core-38eebca9/bakery')
  const option = view.model!.cards.find((card) => card.id === 'longer_hours')!
  option.rows[0] = {
    ...option.rows[0]!,
    kind: 'none',
    next_test: 'Fallback words',
    blocked_by: [{ role: 'figure', ref: 'extra_hours_sold' }],
  } as (typeof option.rows)[number]

  ready(view)
  render(<CheckFirst view={view} place="asks" />)
  const check = screen.getByTestId('check-first')
  expect(figureIds(within(check).getByTestId('port-find-out'))).toEqual(['extra_sold_per_oven'])
  expect(check.querySelector('[data-check-first-input]')).toBeNull()
  expect(check.querySelector('[data-check-first-target]')).toBeNull()
  expect(within(check).queryByText('Fallback words')).toBeNull()
  expect(checkFirstCount(view, 'asks')).toBe(1)
})

it('draws nothing in asks or pending when the ranking is person-owned', () => {
  const view = fixture('core-38eebca9/bakery')
  view.model!.run!.find_out![0]!.figures[1]!.whose = 'theirs'
  const option = view.model!.cards.find((card) => card.id === 'longer_hours')!
  option.rows[0] = {
    ...option.rows[0]!,
    kind: 'none',
    next_test: 'Fallback words',
    blocked_by: [{ role: 'figure', ref: 'extra_hours_sold' }],
  } as (typeof option.rows)[number]

  expect(checkFirstCount(view, 'asks')).toBe(0)
  expect(checkFirstCount(view, 'pending')).toBe(0)
  const { container, rerender } = render(<CheckFirst view={view} place="asks" />)
  expect(container).toBeEmptyDOMElement()
  expect(screen.queryByText('Fallback words')).toBeNull()
  rerender(<CheckFirst view={view} place="pending" />)
  expect(container).toBeEmptyDOMElement()
  expect(screen.queryByText('Fallback words')).toBeNull()
})

it('omits retained missing inputs from ruled-out options', () => {
  const view = cafe(), model = view.model!
  const option = model.cards.find((card) => card.id === 'opt_a')!
  option.status = 'ruled out'
  const row = option.rows[0]!
  if (row.kind !== 'none') throw new Error('Expected the cafe option to have a missing input')
  row.next_test = 'Retained words'

  expect(missingInputsOf(model).map(({ text }) => text)).not.toContain('Retained words')
  render(<CheckFirst view={view} place="asks" />)
  const check = within(screen.getByTestId('check-first'))
  expect(check.queryByText('Retained words')).toBeNull()
  expect(check.getAllByText(missingText, { exact: true })).toHaveLength(1)
})

it('draws plain text when the workspace cannot reach the target', () => {
  vi.mocked(recordReach).mockReturnValue(null)
  render(<CheckFirst view={cafe()} place="asks" />)
  const check = screen.getByTestId('check-first')
  const sentence = within(check).getByText(missingText, { exact: true })
  expect(sentence.tagName).toBe('P')
  expect(sentence).toHaveAttribute('data-check-first-input', '')
  expect(check.querySelector('button')).toBeNull()
  fireEvent.click(sentence)
  expect(pressCard).not.toHaveBeenCalled()
  expect(showRecord).not.toHaveBeenCalled()
})

it('shows the target when workspace reach is show', () => {
  vi.mocked(recordReach).mockReturnValue('show')
  render(<CheckFirst view={cafe()} place="asks" />)
  const target = within(screen.getByTestId('check-first')).getByRole('button', { name: missingText })
  fireEvent.click(target)
  expect(showRecord).toHaveBeenCalledWith('tip_gain')
  expect(pressCard).not.toHaveBeenCalled()
})
