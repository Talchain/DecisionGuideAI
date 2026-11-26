import '@testing-library/jest-dom/vitest'
import { readFileSync } from 'node:fs'
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCanvasStore } from '../../../canvas/store'
import type { View, ViewCard, ViewModel } from '../../client'
import { laneTipOf } from '../../__tests__/tipHelpers'
import { CoreCard } from '../../previous/CoreCard'
import { typography } from '../../../styles/typography'
import { useViewStore } from '../../store'
import { SimpleFace } from '../SimpleFace'

vi.mock('../../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
vi.mock('@xyflow/react', async () => ({ ...(await vi.importActual<object>('@xyflow/react')), Handle: () => null }))

const studio = JSON.parse(readFileSync('src/olumiView/fixtures/cardface/studio.view3.json', 'utf8')) as View
const model = studio.model!
const cardOf = (id: string) => model.cards.find((card) => card.id === id)!
const chance = cardOf('evening_classes')
const fixed = cardOf('weekend_workshops')
const aim = cardOf('takings_goal')
const quantity = cardOf('class_fee')
const why = 'The projected takings depend on the class fee.'
const add = 'Give the proposed class fee.'
const tips = 'The goal is met above £13 per class.'
const tipsFace = 'Above £13/class'
const description = 'The studio wants to increase takings without losing members.'
const withheld: ViewCard = {
  ...chance,
  headline: { ...chance.headline!, state: 'none', shared: false, text: 'No chance yet', title: why, range: null, why, add },
  rows: [{ kind: 'none', aim_id: aim.id, text: 'No chance yet', title: why, tips, tips_face: tipsFace }],
}
const gap = 'Not sized yet · The studio has not set a fee.'
const unsized: ViewCard = { ...quantity, figure: { ...quantity.figure!, text: '', title: gap } }
const waits: ViewCard = {
  ...quantity,
  figure: { ...quantity.figure!, state: 'waits', text: 'Waits on the attendance estimate.', title: 'The fee depends on attendance.' },
}
const notCounted: ViewCard = {
  ...aim,
  bound: { ...aim.bound!, measured: false, text: 'The target is not counted yet.', title: 'No figure measures this target.' },
}
const sharedLine = 'The study has no measure for this goal.'
const sharedTitle = 'Each option needs a measure for monthly takings.'
const sharedModel: ViewModel = {
  ...model,
  run: { ...model.run!, all_withheld: true },
  cards: model.cards.map((card) => card.family !== 'option' ? card : {
    ...card,
    headline: { ...card.headline!, state: 'none', aim_id: aim.id, shared: true, text: sharedLine, title: sharedTitle, why: null, add: null },
  }),
}

const cardModel = (card: ViewCard, current: ViewModel) => ({ ...current, cards: current.cards.map((c) => c.id === card.id ? card : c) })
const drawSimple = (card: ViewCard, current: ViewModel) => render(<SimpleFace card={card} model={cardModel(card, current)} noted={false} />).container
const drawFar = (card: ViewCard, current: ViewModel) => {
  useCanvasStore.setState({ lodRung: 'line' })
  useViewStore.setState({ view: { ...studio, model: cardModel(card, current) } })
  const props = { id: card.id, type: 'viewCard', data: { card }, selected: false, dragging: false, zIndex: 0, isConnectable: false,
    positionAbsoluteX: 0, positionAbsoluteY: 0, selectable: true, deletable: false, draggable: false } as NodeProps
  return render(<ReactFlowProvider><CoreCard {...props} /></ReactFlowProvider>).container
}

afterEach(() => {
  cleanup()
  useCanvasStore.setState({ lodRung: 'full' })
  useViewStore.setState({ view: null })
})

it('preserves the bound and chance mark widths while the full-width track can shrink', () => {
  const css = readFileSync('src/olumiView/look/olumiLook.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .map(([, selectors, body]) => ({ selectors: selectors!.split(',').map((selector) => selector.trim()), body: body! }))
  const bodyOf = (selector: string) => rules.filter((rule) => rule.selectors.includes(selector)).map((rule) => rule.body).join('\n')
  const keepsWidth = /(?:^|;)\s*(?:flex-shrink:\s*0|flex:\s*none)\s*;/

  const bound = bodyOf('.ok-face-mark-bound')
  expect(bound).toMatch(keepsWidth)
  expect(bound).toContain('width: calc(2 * var(--ok-bound-mark-height));')
  expect(bound).toContain('height: var(--ok-bound-mark-height);')
  expect(bodyOf('.ok-face-mark-chance')).toMatch(keepsWidth)
  expect(bodyOf('.ok-face-mark')).not.toMatch(keepsWidth)
  expect(bodyOf('.ok-face-mark-track')).toMatch(/\bwidth:\s*100%;/)
  expect(bodyOf('.ok-face-mark-track')).not.toMatch(keepsWidth)
})

const cases = [
  { name: 'no result', card: withheld, model, shape: 'chance', words: [add, why, add, tips], hidden: [tipsFace, why, add, tips] },
  { name: 'shared reason', card: aim, model: sharedModel, shape: 'chance', words: [sharedLine, sharedTitle], hidden: [sharedLine, sharedTitle, aim.bound!.text] },
  { name: 'unsized', card: unsized, model, shape: 'track', words: [gap], hidden: [gap] },
  { name: 'waits', card: waits, model, shape: 'track', words: [waits.figure!.text, waits.figure!.title], hidden: [waits.figure!.text, waits.figure!.title] },
  { name: 'not counted', card: notCounted, model, shape: 'bound', words: [notCounted.bound!.text, notCounted.bound!.title], hidden: [notCounted.bound!.text, notCounted.bound!.title] },
]

describe.each(cases)('$name', ({ card, model, shape, words, hidden }) => {
  it('shows a decorative mark and moves the words to its Simple hover', () => {
    const face = drawSimple(card, model)
    const mark = face.querySelector<HTMLElement>(`[data-face-mark="${shape}"]`)!
    expect(mark).toHaveAttribute('aria-hidden', 'true')
    expect(mark.textContent).toBe('')
    for (const sentence of hidden) expect(face.textContent).not.toContain(sentence)
    expect(laneTipOf(mark.parentElement!, 'focus')?.split('\n').slice(0, words.length)).toEqual(words)
  })

  it('shows the same mark and words in the reduced face hover', () => {
    const face = drawFar(card, model)
    const line = face.querySelector<HTMLElement>('[data-testid="node-lod-line"]')!
    expect(line.closest('[data-lod-hidden]')).not.toBeNull()
    expect(line.querySelector(`[data-face-mark="${shape}"]`)).toHaveAttribute('aria-hidden', 'true')
    expect(line.textContent).toBe('')
    expect(laneTipOf(line)?.split('\n').slice(0, words.length)).toEqual(words)
  })
})

it('keeps a shared reason on the aim even when Core’s typed shared headlines use different wording', () => {
  const other = sharedModel.cards.find((card) => card.family === 'option' && card.id !== chance.id)!
  const changed = { ...other, headline: { ...other.headline!, text: 'A second wording for the shared state.' } }
  const changedModel = cardModel(changed, sharedModel)
  const aimFace = drawSimple(aim, changedModel)
  expect(aimFace.querySelector('[data-simple-no-chance-once] [data-face-mark="chance"]')).not.toBeNull()
  const optionFace = drawSimple(changed, changedModel)
  expect(optionFace.querySelector('[data-simple-state]')).toBeNull()
})

it('keeps the chance words at both zooms and the dots on Simple', () => {
  const simple = drawSimple(chance, model)
  expect(simple.querySelector('[data-simple-chance]')?.textContent).toBe(chance.headline!.text)
  expect(simple.querySelectorAll('[data-chance-dot]')).toHaveLength(10)
  const far = drawFar(chance, model)
  expect(far.querySelector('[data-testid="node-lod-line-text"]')?.textContent).toBe(chance.headline!.text)
})

it('shows the chance lead and keeps the qualifier in hover at both zooms', () => {
  const lead = 'about 17% chance'
  const qualifier = "on Olumi's assumption for 'MRR at month 9'"
  const text = `${lead}, ${qualifier}`
  const qualified: ViewCard = {
    ...chance,
    headline: { ...chance.headline!, text },
    rows: chance.rows.map((row) => row.kind === 'chance' && row.aim_id === chance.headline!.aim_id
      ? { ...row, value: text, chance: 0.17, olumi: { glyph: '◉', title: qualifier } }
      : row),
  }

  const simple = drawSimple(qualified, model)
  const gauge = simple.querySelector<HTMLElement>('[data-simple-face="chance"]')!
  expect(gauge.querySelector('[data-simple-chance]')?.textContent).toBe(lead)
  expect(gauge.querySelectorAll('[data-chance-dot]')).toHaveLength(10)
  expect(gauge.querySelector('[data-olumi-mark]')).not.toBeNull()
  expect(simple.textContent).not.toContain(qualifier)
  expect(laneTipOf(gauge)?.split('\n').slice(0, 2)).toEqual([lead, qualifier])

  const far = drawFar(qualified, model)
  const line = far.querySelector<HTMLElement>('[data-testid="node-lod-line"]')!
  expect(line.textContent).toBe(lead)
  expect(laneTipOf(line)?.split('\n').slice(0, 2)).toEqual([lead, qualifier])
})

it('shows the standalone limit value and keeps the aim, value and explanation on separate hover lines', () => {
  const limit: ViewCard = { ...aim, family: 'limit' }
  const value = '£40 below the limit'
  const title = 'Projected spending stays within the limit.'
  const option: ViewCard = {
    ...withheld,
    headline: { ...withheld.headline!, aim_id: null },
    rows: [{ kind: 'limit', aim_id: limit.id, aim: limit.heading, value, title, olumi: null, estimate: null }],
  }
  const limitModel = cardModel(limit, model)
  const composed = `${limit.heading} ${value}`
  const simple = drawSimple(option, limitModel)
  const result = simple.querySelector<HTMLElement>('[data-simple-limit]')!
  expect(result.textContent).toBe(value)
  expect(result).toHaveClass(...typography.viewValue.split(' '))
  expect(simple.textContent).not.toContain(composed)
  expect(result.querySelector('[data-face-mark]')).toBeNull()
  const resultHover = laneTipOf(result)
  expect(resultHover?.split('\n').slice(0, 3)).toEqual([limit.heading, value, title])
  expect(resultHover).not.toContain(composed)
  const cardHover = laneTipOf(simple.querySelector<HTMLElement>('[data-simple-card]')!)
  expect(cardHover).toBe([limit.heading, value, title].join('\n'))

  const far = drawFar(option, limitModel)
  const line = far.querySelector<HTMLElement>('[data-testid="node-lod-line"]')!
  const farValue = line.querySelector<HTMLElement>('[data-testid="node-lod-line-text"]')!
  expect(farValue.textContent).toBe(value)
  expect(farValue).toHaveClass(...typography.viewValue.split(' '))
  expect(line.textContent).not.toContain(composed)
  const farHover = laneTipOf(line)
  expect(farHover?.split('\n').slice(0, 3)).toEqual([limit.heading, value, title])
  expect(farHover).not.toContain(composed)
})

it('keeps the fixed result on Simple and puts its words in hover at far zoom', () => {
  const simple = drawSimple(fixed, model)
  const value = simple.querySelector<HTMLElement>('[data-simple-face="fixed"]')!
  expect(value.textContent).toBe(fixed.headline!.text)
  expect(laneTipOf(value)).toBe(fixed.headline!.title)
  const far = drawFar(fixed, model)
  const line = far.querySelector<HTMLElement>('[data-testid="node-lod-line"]')!
  expect(line.textContent).toBe('')
  expect(laneTipOf(line)).toContain(fixed.headline!.text)
})

it.each([chance, fixed, aim, quantity])('keeps the description in hover for $family cards', (card) => {
  const described: ViewCard = { ...card, description }
  const simple = drawSimple(described, model)
  const anchor = simple.querySelector<HTMLElement>('[data-simple-description], [data-simple-face="fixed"]')!
  expect(simple.textContent).not.toContain(description)
  expect(laneTipOf(anchor)).toContain(description)
  const far = drawFar(described, model)
  const line = far.querySelector<HTMLElement>('[data-testid="node-lod-line"]')!
  expect(line.textContent).not.toContain(description)
  expect(laneTipOf(line)).toContain(description)
})
