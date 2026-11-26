/** Core’s break-even words in the Simple hover and Detailed row. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render } from '@testing-library/react'
import type { View, ViewCard, ViewModel } from '../../client'
import { tipOf } from '../../__tests__/tipHelpers'
import { SimpleFace } from '../SimpleFace'
import { RowBelow } from '../detailed/marks'
import { noChanceLineOf } from '../cards/words'

vi.mock('../../../olumiCore/lane', async (real) => ({ ...(await real<object>()), isOlumiCoreLane: () => true }))
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: 'u1', accessToken: null }), supabase: {} }))
vi.mock('../../../canvas/nodes/shared/savedGraph', () => ({ useSavedGraphRead: () => ({ status: 'none' }), useSavedGraph: () => null }))


const load = (file: string): View => JSON.parse(readFileSync(path.resolve(`src/olumiView/fixtures/${file}`), 'utf8'))
const fixtures = ['pending', 'approved'].flatMap((state) => [false, true].map((conditional) => ({
  name: `${conditional ? 'conditional ' : ''}${state}`,
  conditional,
  model: load(`break-even/break-even-${conditional ? 'cond-' : ''}${state}.view3.json`).model!,
})))
type TipRow = Extract<ViewCard['rows'][number], { kind: 'none' }>
const tipRow = (card: ViewCard) => card.rows.find((r): r is TipRow => r.kind === 'none' && r.aim_id === card.headline?.aim_id)!
const option = (model: ViewModel) => structuredClone(model.cards.find((c) => c.family === 'option' && tipRow(c)?.tips_face)!)
const draw = (card: ViewCard, model: ViewModel) => render(<SimpleFace card={card} model={model} noted={false} />).container
const markOf = (el: Element) => el.querySelector<HTMLElement>('[data-simple-face="no-chance"]')!
afterEach(cleanup)

describe.each(fixtures)('$name', ({ conditional, model }) => {
  it('anchors the full tipping sentence to the empty outline and keeps the row hooks', async () => {
    const card = option(model), row = tipRow(card)
    const container = draw(card, model), mark = markOf(container)
    expect(mark.getAttribute('data-view')).toBe(`${card.id}.rows.${card.rows.indexOf(row)}.tips_face`)
    expect(mark.getAttribute('data-simple-tips-whatif')).toBe(row.tips_label == null ? null : card.id)
    expect(mark.getAttribute('data-simple-tips-conditional')).toBe(conditional ? card.id : null)
    expect(mark.textContent).toBe('')
    expect(mark.querySelector('[data-face-mark="chance"]')).not.toBeNull()
    expect(mark.querySelector('button, [data-olumi-mark]')).toBeNull()
    expect(container.querySelector('[data-simple-foot]')).not.toBeNull()
    expect(container.textContent).not.toContain(row.tips_face)
    const { line, hover } = noChanceLineOf(card.headline!)
    expect(await tipOf(mark)).toContain([line, hover, row.tips].join('\n'))
  })

  it('keeps Detailed RowBelow’s full tipping sentence on its own row', () => {
    const card = option(model), row = tipRow(card), i = card.rows.indexOf(row)
    const { container } = render(<RowBelow r={row} at={`${card.id}.rows.${i}`} shown={card.headline!.text} />)
    const lines = container.querySelectorAll(`[data-view="${card.id}.rows.${i}.tips"]`)
    expect(lines).toHaveLength(1)
    expect(lines[0]!.textContent).toBe(row.tips)
    expect(container.textContent!.split(row.tips!).length - 1).toBe(1)
  })
})

const model = fixtures[0]!.model
it.each([undefined, ''])('keeps the full tipping sentence when tips_face is %s', async (empty) => {
  const card = option(model), row = tipRow(card)
  row.tips_face = empty
  const mark = markOf(draw(card, model))
  expect(mark.hasAttribute('data-view')).toBe(false)
  expect(await tipOf(mark)).toContain(row.tips)
})

it('does not attach another aim’s tipping sentence to the headline mark', async () => {
  const card = option(model), row = tipRow(card)
  row.aim_id = 'aim_storage'
  row.tips = 'Core’s separate tipping sentence for the storage aim.'
  const mark = markOf(draw(card, model))
  expect(mark.hasAttribute('data-view')).toBe(false)
  expect(await tipOf(mark)).not.toContain(row.tips)
})

it('keeps the chance gauge and its qualifier hover when a tipping row is also present', async () => {
  const chanceModel = load('core-38eebca9/european.view3.json').model!
  const card = structuredClone(chanceModel.cards.find((c) => c.family === 'option' && c.headline?.state === 'chance')!)
  card.rows.push({ ...tipRow(option(model)), aim_id: card.headline!.aim_id })
  const container = draw(card, chanceModel)
  expect(container.querySelector('[data-simple-face="chance"] [data-simple-chance]')).not.toBeNull()
  const anchor = container.querySelector<HTMLElement>('[data-simple-qual]')!
  expect(anchor).not.toBeNull()
  expect(await tipOf(anchor)).not.toContain(tipRow(option(model)).tips)
  expect(markOf(container)).toBeNull()
})

it('keeps the fixed value when a tipping row is also present', () => {
  const card = option(model)
  card.headline = { ...card.headline!, state: 'fixed', text: 'always met in this model' }
  const container = draw(card, model)
  expect(container.querySelector('[data-simple-face="fixed"]')?.textContent).toBe(card.headline.text)
  expect(markOf(container)).toBeNull()
})

it('keeps the fallback limit value on an option without a chance', async () => {
  const card = option(model)
  card.headline = { ...card.headline!, aim_id: null }
  card.rows.push({ kind: 'limit', aim_id: 'limit_budget', aim: 'Budget', value: 'within the budget', title: 'Within the stated budget.', olumi: null, estimate: null })
  const mark = markOf(draw(card, model))
  expect(mark.getAttribute('data-simple-limit')).toBe(card.id)
  expect(mark.textContent).toBe('within the budget')
  expect(await tipOf(mark)).toContain('within the budget\nWithin the stated budget.')
})
