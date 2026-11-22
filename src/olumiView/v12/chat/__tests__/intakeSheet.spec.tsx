import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render, within } from '@testing-library/react'
import { setTeamFetch } from '../../../../olumiCore/team/api'
import { useUIStore } from '../../../../stores/uiStore'
import type { View } from '../../../client'
import { useViewStore } from '../../../store'
import { ViewChat, ViewComposer } from '../../../ViewChat'
import { resetRemovedIntake, SHOW_RECORD, UNKNOWN, type IntakeFigure } from '../IntakeSheet'
import { tipOnFocus } from '../../../__tests__/tipHelpers'

vi.mock('../../../../canvas/hooks/useSelectionContext', () => ({ useSelectionContext: () => null }))
const pressed = vi.hoisted(() => ({ ids: [] as string[] }))
vi.mock('../../../reasoning/tabRing', async (orig) => ({ ...(await orig<object>()), pressCard: (id: string) => { pressed.ids.push(id) } }))

const DIR = path.resolve('src/olumiView')
const base = (): View => { const v = JSON.parse(readFileSync(path.join(DIR, 'fixtures/session', 'goal-understand.view3.json'), 'utf8')) as View; return { ...v, chat: v.chat.map((t) => ({ ...t, by_id: v.you_id })) } as View }
const q = (c: ParentNode, id: string) => c.querySelector<HTMLElement>(`[data-testid="${id}"]`)
const mount = (view: View) => {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false, at: null })
  return render(<><ViewChat /><ViewComposer /></>).container
}
// Invented quotes; `record` is a real record id of the fixture's model (its first card), null, or "unknown".
const withIntake = (v: View, figures: IntakeFigure[]): View => ({ ...v, intake: { figures } } as unknown as View)
const at = (row: number, start: number, end: number) => ({ row, start, end })
const FIGS = (v: View): IntakeFigure[] => [
  { source: { row: 'brief', start: 4, end: 20 }, quote: 'an invented figure of 40 a week', unit: 'item/week', stated: { value: { point: 40 }, bound: null }, record: v.model!.cards[0]!.id },
  { source: at(0, 30, 44), quote: 'an invented limit of 3 people', unit: 'person', stated: { value: { point: 3 }, bound: 'at_most' }, record: null },
  { source: at(1, 0, 18), quote: 'maybe an invented 10%', unit: '%', stated: null, record: UNKNOWN },
]
const open = (c: HTMLElement) => act(() => {
  const chip = q(c, 'view-chat-foot-intake')!
  if (chip.getAttribute('aria-expanded') === 'false') fireEvent.click(chip)
  fireEvent.click(q(c, 'view-intake-toggle')!)
})
const summary = (c: HTMLElement) => q(c, 'view-intake-summary')?.textContent
const reviewRows = (c: HTMLElement) => within(q(c, 'view-intake-rows')!)

beforeEach(() => {
  useUIStore.setState({ activeOutputTab: 'olumi' } as never)
  setTeamFetch((async () => new Response('{}', { status: 201 })) as never)
  pressed.ids = []
})
afterEach(() => {
  cleanup()
  resetRemovedIntake()
  setTeamFetch(null)
})

describe('What you said review', () => {
  it('shows the missing figure count, then opens to the verbatim dashed sentence before the linked card', () => {
    const v = base(), [present, absent, unknown] = FIGS(v)
    const quote = 'We can use 3 people.\n  That is the limit for now.'
    const c = mount(withIntake(v, [present!, { ...absent!, quote }, unknown!]))
    const foot = q(c, 'view-chat-foot-intake')!
    expect(foot).toHaveAttribute('aria-expanded', 'false')
    expect(foot).toHaveTextContent('2')
    fireEvent.click(foot)
    const sheet = q(c, 'view-intake')!
    const toggle = within(sheet).getByRole('button', { name: 'Review', expanded: false })
    expect(toggle).toHaveClass('bg-success')
    expect(toggle).not.toHaveAttribute('aria-controls')
    expect(summary(c)).toBe('1 figure not in your model yet')
    expect(q(c, 'view-intake-rows')).toBeNull()
    expect(q(c, 'view-chat-scroll')).not.toContainElement(sheet)

    fireEvent.click(toggle)
    const rows = reviewRows(c)
    const gapHeading = rows.getByRole('heading', { name: 'Not in your model yet' })
    const [gap, linked] = rows.getAllByRole('listitem')
    expect(gapHeading.compareDocumentPosition(gap!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(gap).toHaveClass('underline', 'decoration-dashed', 'whitespace-pre-wrap')
    expect(gap?.textContent).toBe(quote)
    expect(within(gap!).queryByRole('button')).toBeNull()
    expect(within(linked!).getByRole('button')).toHaveAttribute('data-intake-show', present!.record)
    expect(rows.queryByText(unknown!.quote)).toBeNull()
    expect(toggle).toHaveAccessibleName('Hide figures')
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(toggle).toHaveAttribute('aria-controls', q(c, 'view-intake-rows')!.id)
    fireEvent.click(toggle)
    expect(q(c, 'view-intake-rows')).toBeNull()
  })

  it('counts individual figures, renders one gap per source sentence and shows each card once across sentences', () => {
    const v = base(), [present, absent] = FIGS(v)
    const c = mount(withIntake(v, [
      present!,
      { ...present!, source: at(1, 0, 8), quote: '40 again here.' },
      absent!,
      { ...absent!, source: at(0, 45, 50) },
      { ...absent!, source: at(2, 30, 44) },
    ]))
    open(c)
    expect(summary(c)).toBe('3 figures not in your model yet')
    const rows = reviewRows(c)
    expect(rows.getAllByText(absent!.quote)).toHaveLength(2)
    expect(rows.getAllByRole('button')).toHaveLength(1)
    expect(rows.queryByText(present!.quote)).toBeNull()
  })

  it('counts linked figures when there are no gaps and opens the card through the existing show path', async () => {
    const v = base(), card = v.model!.cards[0]!, [present, , unknown] = FIGS(v)
    const c = mount(withIntake(v, [present!, { ...present!, source: at(2, 0, 8) }, unknown!]))
    open(c)
    expect(summary(c)).toBe('2 figures from what you said')
    const rows = reviewRows(c)
    expect(rows.queryByRole('heading')).toBeNull()
    const row = rows.getByRole('button')
    expect(row).toHaveAttribute('data-intake-show', card.id)
    expect(within(row).getByText(card.heading)).toBeInTheDocument()
    expect(within(row).getByText(card.figure!.text)).toHaveClass('text-right', 'tabular-nums')
    expect(row.querySelector('svg circle')).toHaveAttribute('fill', 'var(--factor)')
    expect(await tipOnFocus(row)).toBe(`${SHOW_RECORD}: ${card.heading}`)
    fireEvent.click(row)
    expect(pressed.ids).toEqual([card.id])
  })

  it('omits unknown and malformed figures from the sheet and the foot count', () => {
    const v = base(), [, , unknown] = FIGS(v)
    const invalid = { ...unknown!, source: at(-1, 0, 2), record: null }
    const c = mount(withIntake(v, [unknown!, { ...unknown!, source: null }, invalid]))
    expect(q(c, 'view-chat-foot-intake')).toBeNull()
    expect(q(c, 'view-intake')).toBeNull()
  })

  it('offers the review once a model exists', () => {
    const v = base()
    expect(q(mount(withIntake({ ...v, model: null } as View, FIGS(v))), 'view-chat-foot-intake')).toBeNull()
    cleanup()
    expect(q(mount(withIntake(v, FIGS(v))), 'view-chat-foot-intake')).not.toBeNull()
  })

  it('removes the sheet and shows it again for a new list of figures', () => {
    const v = base(), c = mount(withIntake(v, FIGS(v)))
    open(c)
    fireEvent.click(q(c, 'view-intake-remove')!)
    expect(q(c, 'view-intake')).toBeNull()
    cleanup()
    const more = [...FIGS(v), { source: at(2, 0, 9), quote: 'an invented third figure of 5', unit: null, record: null }]
    const next = mount(withIntake(v, more))
    open(next)
    expect(q(next, 'view-intake')).not.toBeNull()
  })
})
