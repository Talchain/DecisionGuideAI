/** CP-3: core's break-even words on the Simple option face; invented core fixtures only. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import type { View, ViewCard, ViewModel } from '../../client'
import { olumiKey } from '../../layout'
import { typography } from '../../../styles/typography'
import { colourClass, ICONS } from '../../look/icons'
import { tipOf } from '../../__tests__/tipHelpers'
import { SimpleFace } from '../SimpleFace'
import { RowBelow } from '../detailed/marks'
import { noChanceLineOf } from '../cards/words'

vi.mock('../../../olumiCore/lane', async (real) => ({ ...(await real<object>()), isOlumiCoreLane: () => true }))
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: 'u1', accessToken: null }), supabase: {} }))
vi.mock('../../../canvas/nodes/shared/savedGraph', () => ({ useSavedGraphRead: () => ({ status: 'none' }), useSavedGraph: () => null }))

const load = (file: string): View => JSON.parse(readFileSync(path.resolve(`src/olumiView/fixtures/${file}`), 'utf8'))
const fixtures = ['pending', 'approved'].flatMap((state) => [false, true].map((conditional) => ({ state, conditional, model: load(`break-even/break-even-${conditional ? 'cond-' : ''}${state}.view3.json`).model! })))
const option = (model: ViewModel) => structuredClone(model.cards.find((c) => c.family === 'option' && c.rows.some((r) => r.kind === 'none' && r.aim_id === c.headline?.aim_id && !!r.tips_face))!)
type TipRow = Extract<ViewCard['rows'][number], { kind: 'none' }> & { tips_face?: string; tips_label?: string }
const tipRow = (card: ViewCard) => card.rows.find((r) => r.kind === 'none' && r.aim_id === card.headline!.aim_id)! as TipRow
const draw = (card: ViewCard, model: ViewModel) => render(<SimpleFace card={card} model={model} noted={false} />).container
const tips = (el: Element) => el.querySelector<HTMLElement>('[data-simple-face="tips"]')
const count = (s: string, w: string) => s.split(w).length - 1
afterEach(cleanup)

for (const { state, conditional, model } of fixtures) describe(`${conditional ? 'conditional ' : ''}${state}`, () => {
  // AC1 must be RED at c5d802d6: that base renders the ordinary no-chance line, with no tips face.
  it('AC1 draws exactly one verbatim face, with the calculation mark before its words', async () => {
    const card = option(model), row = tipRow(card), i = card.rows.indexOf(row)
    const el = draw(card, model), line = tips(el)!
    expect(el.querySelectorAll('[data-simple-face="tips"]')).toHaveLength(1)
    expect(line.getAttribute('data-view')).toBe(`${card.id}.rows.${i}.tips_face`)
    const mark = line.querySelector<HTMLElement>('[data-olumi-mark]')!
    expect(mark).not.toBeNull()
    expect(mark.getAttribute('aria-label')).toBe(olumiKey(model)!.text)
    expect(await tipOf(mark)).toBe(olumiKey(model)!.text)
    const copy = line.cloneNode(true) as HTMLElement
    copy.querySelector('[data-olumi-mark]')!.remove()
    copy.querySelector('button')?.remove()
    expect(copy.textContent).toBe(row.tips_face)
    expect(line.firstElementChild!.contains(mark)).toBe(true)
  })

  it('AC1b a what-if is said in the face itself; tips_label only marks it, never a second line', () => {
    const card = option(model), row = tipRow(card), el = draw(card, model), line = tips(el)!
    expect(el.querySelector('[data-simple-tips-label]')).toBeNull()
    if (row.tips_label != null) expect([line.getAttribute('data-simple-tips-whatif'), count(el.textContent!, row.tips_label)]).toEqual([card.id, count(row.tips_face!, row.tips_label)])
    else expect(line.hasAttribute('data-simple-tips-whatif')).toBe(false)
    expect(state === 'pending' ? row.tips_label != null : row.tips_label == null).toBe(true)
  })

  it('AC2 stays quiet, clamped to two lines, without chance styling or UI percentages', () => {
    const card = option(model), row = tipRow(card), el = draw(card, model), line = tips(el)!
    expect(line).not.toBeNull()
    expect(el.querySelector('[data-simple-chance], [data-testid="chance-band"], .ok-track')).toBeNull()
    expect(line.classList.contains('ok-quiet')).toBe(true)
    expect(line.classList.contains('ok-two-lines')).toBe(true)
    for (const cls of typography.viewValue.split(' ')) expect(line.classList.contains(cls)).toBe(false)
    expect(line.textContent?.split('%').length).toBe(row.tips_face!.split('%').length)
  })

  it('AC5 the tips line takes the full row; the footer stays, below it', () => {
    const card = option(model), el = draw(card, model), line = tips(el)!
    expect(line.classList.contains('basis-full')).toBe(true)
    expect(line.classList.contains('flex-[1_1_7rem]')).toBe(false)
    expect(line.classList.contains('ok-two-lines')).toBe(true)
    const footer = el.querySelector(`[data-simple-foot="${card.id}"]`)
    expect(footer).not.toBeNull()
    expect(line.contains(footer)).toBe(false)
  })

  it("AC6 a conditional threshold discloses its full premise through the registry's icon and word; unflagged rows show no button", () => {
    const card = option(model), row = tipRow(card)
    const onCardKeyDown = vi.fn()
    const { container } = render(
      <div onKeyDown={onCardKeyDown}>
        <SimpleFace card={card} model={model} noted={false} />
      </div>,
    )
    const line = tips(container)!
    const entry = ICONS['conditional-tag']
    const buttons = line.querySelectorAll<HTMLButtonElement>('button')
    expect(buttons).toHaveLength(conditional ? 1 : 0)
    expect(line.getAttribute('data-simple-tips-conditional')).toBe(conditional ? card.id : null)
    if (conditional) {
      const button = buttons[0]!, clamp = line.className
      expect(entry.mode).toBe('icon-plus-word')
      expect(entry.hover).toBe('Conditional')
      expect(button.textContent).toBe(entry.hover)
      expect(button.classList.contains(colourClass(entry.colour))).toBe(true)
      expect(button.querySelector('svg')?.classList.contains('lucide-git-branch')).toBe(true)
      expect(button.querySelector('svg')?.getAttribute('width')).toBe('14')
      expect(button.querySelector('svg')?.getAttribute('height')).toBe('14')
      expect(button.nextSibling?.nodeType).toBe(Node.TEXT_NODE)
      expect(button.nextSibling?.textContent).toBe(row.tips_face)
      expect(button.previousElementSibling?.querySelector('[data-olumi-mark]')).not.toBeNull()
      expect(button.tabIndex).toBe(0)
      expect(button.classList.contains('h-6')).toBe(true)
      expect(button.getAttribute('aria-expanded')).toBe('false')
      const panel = button.getAttribute('aria-controls')!
      expect(panel).toBeTruthy()
      expect(document.getElementById(panel)).toBeNull()
      button.focus()
      fireEvent.keyDown(button, { key: 'Enter' })
      expect(onCardKeyDown).not.toHaveBeenCalled()
      fireEvent.click(button)
      expect(button.getAttribute('aria-expanded')).toBe('true')
      const premise = document.getElementById(panel)!
      const face = line.closest('[data-simple-card]')
      expect(face?.contains(premise)).toBe(true)
      expect(line.nextElementSibling).toBe(premise)
      for (let el: HTMLElement | null = premise; el !== null; el = el.parentElement) {
        expect(getComputedStyle(el).position).not.toBe('fixed')
      }
      expect(premise.textContent).toBe(row.tips)
      expect(count(document.body.textContent!, row.tips!)).toBe(1)
      expect(line.className).toBe(clamp)
      expect(line.classList.contains('ok-two-lines')).toBe(true)
      expect(button.nextSibling?.textContent).toBe(row.tips_face)
      fireEvent.keyDown(button, { key: 'Escape' })
      expect(button.getAttribute('aria-expanded')).toBe('false')
      expect(document.getElementById(panel)).toBeNull()
      expect(document.activeElement).toBe(button)
      fireEvent.click(button)
      fireEvent.click(button)
      expect(button.getAttribute('aria-expanded')).toBe('false')
      expect(document.activeElement).toBe(button)
      fireEvent.click(button)
      fireEvent.pointerDown(document.body)
      expect(button.getAttribute('aria-expanded')).toBe('false')
      expect(document.getElementById(panel)).toBeNull()
      expect(document.activeElement).toBe(button)

      const onEscape = vi.fn()
      const { getByRole } = render(<button type="button" onKeyDown={onEscape}>Next control</button>)
      const next = getByRole('button', { name: 'Next control' })
      fireEvent.click(button)
      expect(button.getAttribute('aria-expanded')).toBe('true')
      act(() => next.focus())
      expect(button.getAttribute('aria-expanded')).toBe('false')
      expect(document.getElementById(panel)).toBeNull()
      expect(document.activeElement).toBe(next)
      expect(fireEvent.keyDown(next, { key: 'Escape' })).toBe(true)
      expect(onEscape).toHaveBeenCalledOnce()
      expect(button.getAttribute('aria-expanded')).toBe('false')
      expect(document.activeElement).toBe(next)
    }
  })

  it('AC3 hover preserves why and add whole, with tips exactly once', async () => {
    const card = option(model), row = tipRow(card)
    card.headline = { ...card.headline!, add: 'Check the depot survey before changing the model.' }
    const el = draw(card, model), line = tips(el)!
    expect(line).not.toBeNull()
    const hover = await tipOf(line)
    expect(hover).toContain(card.headline.why)
    expect(hover).toContain(card.headline.add)
    expect(hover.split(row.tips!).length - 1).toBe(1)
    expect(line.lastChild?.textContent).toBe(row.tips_face)
    expect(el.querySelector('[data-simple-face="no-chance"]')).toBeNull()
  })

  it('AC5 Detailed RowBelow draws the whole tips sentence once at its row path', () => {
    const card = option(model), row = tipRow(card), i = card.rows.indexOf(row)
    const { container } = render(<RowBelow r={row} at={`${card.id}.rows.${i}`} shown={card.headline!.text} />)
    const lines = container.querySelectorAll(`[data-view="${card.id}.rows.${i}.tips"]`)
    expect(lines).toHaveLength(1)
    expect(lines[0]!.textContent).toBe(row.tips)
    expect(container.textContent!.split(row.tips!).length - 1).toBe(1)
  })
})

const model = fixtures[0]!.model
for (const empty of [undefined, '']) it(`AC4 tips_face ${String(empty)} retains today's line without a calculation mark`, () => {
  const card = option(model)
  tipRow(card).tips_face = empty
  const el = draw(card, model), line = el.querySelector('[data-simple-face="no-chance"]')!
  expect(tips(el)).toBeNull()
  expect(line.textContent).toBe(noChanceLineOf(card.headline!).line)
  expect(line.querySelector('[data-olumi-mark]')).toBeNull()
  expect(el.querySelector('[data-simple-tips-label]')).toBeNull()
})
it('AC4 another aim cannot supply this tip', () => {
  const card = option(model)
  tipRow(card).aim_id = 'aim_storage'
  expect(tips(draw(card, model))).toBeNull()
})
it('AC4 chance keeps its gauge ahead of tips (existing chance fixture)', () => {
  const chanceModel = load('core-38eebca9/european.view3.json').model!
  const card = structuredClone(chanceModel.cards.find((c) => c.family === 'option' && c.headline?.state === 'chance')!)
  card.rows.push({ ...tipRow(option(model)), aim_id: card.headline!.aim_id })
  const el = draw(card, chanceModel)
  expect(el.querySelector('[data-simple-face="gauge"]')).not.toBeNull()
  expect(el.querySelector('[data-simple-chance]')).not.toBeNull()
  expect(tips(el)).toBeNull()
})
it('AC5 a non-tips quiet line keeps its flex basis (existing chance fixture)', () => {
  const chanceModel = load('core-38eebca9/european.view3.json').model!
  const card = structuredClone(chanceModel.cards.find((c) => c.family === 'option' && c.headline?.state === 'chance')!)
  const el = draw(card, chanceModel), line = el.querySelector(`[data-simple-qual="${card.id}"]`)!
  expect(line).not.toBeNull()
  expect(line.classList.contains('flex-[1_1_7rem]')).toBe(true)
})
it('AC4 fixed keeps its own line ahead of tips', () => {
  const card = option(model)
  card.headline = { ...card.headline!, state: 'fixed', text: 'always met in this model' }
  const el = draw(card, model)
  expect(el.querySelector('[data-simple-face="fixed"]')?.textContent).toBe(card.headline.text)
  expect(tips(el)).toBeNull()
})
it('AC4 a limit lead keeps its line ahead of tips', () => {
  const card = option(model)
  card.headline = { ...card.headline!, aim_id: null }
  card.rows.push({ kind: 'limit', aim_id: 'limit_budget', value: 'within the budget', title: 'Within the stated budget.' } as ViewCard['rows'][number])
  const el = draw(card, model)
  expect(el.querySelector('[data-simple-face="limit"]')).not.toBeNull()
  expect(tips(el)).toBeNull()
})
it('AC4 shared no-chance headline keeps options silent', () => {
  const shared = structuredClone(model)
  shared.run = { ...shared.run!, all_withheld: true }
  for (const card of shared.cards.filter((c) => c.family === 'option')) card.headline = { ...card.headline!, aim_id: 'aim_late', state: 'none', shared: true, add: null, text: 'The inspection figures are missing.' }
  const el = draw(option(shared), shared)
  expect(tips(el)).toBeNull()
  expect(el.querySelector('[data-simple-face="no-chance"], [data-simple-tips-label]')).toBeNull()
})
it('AC4 no olumi key keeps the verbatim line without a calculation mark', () => {
  const without = { ...model, key: model.key.filter((k) => k.id !== 'olumi') }
  const card = option(without), line = tips(draw(card, without))!
  expect(line).not.toBeNull()
  expect(line.textContent).toBe(tipRow(card).tips_face)
  expect(line.querySelector('[data-olumi-mark]')).toBeNull()
})

it('AC3 appends the whole tip once when the existing hover does not contain it', async () => {
  const card = option(model), row = tipRow(card)
  card.headline = { ...card.headline!, why: 'The depot survey is missing.', add: 'Ask the depot team for its survey.' }
  const line = tips(draw(card, model))!
  expect(line).not.toBeNull()
  expect(await tipOf(line)).toBe(`${noChanceLineOf(card.headline).hover}\n${row.tips}`)
})
