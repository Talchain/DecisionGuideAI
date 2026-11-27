import '@testing-library/jest-dom/vitest'
import { readFileSync } from 'node:fs'
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

vi.mock('../../../olumiCore/team/api', async (original) => ({
  ...await original<typeof import('../../../olumiCore/team/api')>(),
  call: vi.fn(async () => { throw new Error('Unexpected Core call') }),
}))
beforeEach(() => vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('Unexpected fetch') })))
afterEach(() => vi.unstubAllGlobals())
import { useCanvasStore } from '../../../canvas/store'
import type { View, ViewCard, ViewModel } from '../../client'
import { barsOf, QUESTION } from '../../layout'
import { CoreCard } from '../../previous/CoreCard'
import { useViewStore } from '../../store'
import { sharedNoChanceOf } from '../cards/words'
import { figureRange } from '../contract'
import { visualOfCard } from '../../visual'
import { levelOf, setDefaultLevel } from '../simpleStore'
import budget from './faceTextBudget.json'

vi.mock('../../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
vi.mock('@xyflow/react', async () => ({ ...(await vi.importActual<object>('@xyflow/react')), Handle: () => null }))

const readView = (path: string) => JSON.parse(readFileSync(`src/olumiView/${path}.view3.json`, 'utf8')) as View
const studio = readView('fixtures/cardface/studio')
const issue7 = (name: string) => readView(`v12/__tests__/fixtures/issue7-e499eff6-${name}`)

const studioModel = studio.model!
const studioCard = (id: string) => studioModel.cards.find((card) => card.id === id)!
const chance = studioCard('evening_classes')
const aim = studioCard('takings_goal')
const quantity = studioCard('class_fee')

function withCards(view: View, ...cards: ViewCard[]): View {
  return { ...view, model: { ...view.model!, cards: view.model!.cards.map((card) => cards.find((c) => c.id === card.id) ?? card) } }
}

const qualifiedChanceText = `${chance.headline!.text}, on Olumi's assumption for the class fee`
const qualifiedChance: ViewCard = {
  ...chance,
  headline: { ...chance.headline!, text: qualifiedChanceText },
  rows: chance.rows.map((row) => row.kind === 'chance' && row.aim_id === chance.headline!.aim_id
    ? { ...row, value: qualifiedChanceText }
    : row),
}
const withheld: ViewCard = {
  ...chance,
  headline: { ...chance.headline!, state: 'none', shared: false, text: 'No chance yet', range: null, why: 'The class fee is missing.', add: 'Give the proposed class fee.', title: 'The class fee is missing.' },
  rows: [{ kind: 'none', aim_id: aim.id, text: 'No chance yet', title: 'The class fee is missing.' }],
}
const shared: View = {
  ...studio,
  model: {
    ...studioModel,
    run: { ...studioModel.run!, all_withheld: true },
    cards: studioModel.cards.map((card) => card.family !== 'option' ? card : {
      ...card,
      headline: { ...card.headline!, state: 'none', aim_id: aim.id, shared: true, text: 'No chance yet', range: null, why: 'The studio has no measure for monthly takings.', add: null },
    }),
  },
}
const unsized: ViewCard = { ...quantity, figure: { ...quantity.figure!, text: '', title: 'The studio has not set a class fee.' } }
const rangeWithoutText: ViewCard = {
  ...quantity,
  figure: { ...quantity.figure!, text: '', range: { low: 12, likely: null, high: 12, unit: 'GBP/class' } },
}
const waits: ViewCard = { ...quantity, figure: { ...quantity.figure!, state: 'waits', text: 'Waits on attendance.', title: 'The fee depends on attendance.' } }
const notcounted: ViewCard = { ...aim, bound: { ...aim.bound!, measured: false, text: 'The target is not counted yet.' } }

type Face =
  | { family: 'option'; row: 'chance' | 'fixed' | 'noresult' | 'shared' }
  | { family: 'quantity'; row: 'value' | 'range' | 'bands' | 'unsized' | 'waits' }
  | { family: 'aim'; row: 'shared' | 'bound' | 'notcounted' }
  | { family: 'question'; row: 'question' }
type CardCase = Face & { view: View; id: string; fixture: string; card?: ViewCard }
type Measurement = CardCase & { faceWords: number; titleWords: number }

function faceOf(card: ViewCard, model: ViewModel): Face | null {
  if (card.family === 'option' && card.headline != null) {
    const { state, aim_id } = card.headline
    if (state === 'none' && sharedNoChanceOf(model, aim_id, 'typed') !== null) return { family: 'option', row: 'shared' }
    return { family: 'option', row: state === 'none' ? 'noresult' : state }
  }
  if (card.family === 'goal' || card.family === 'limit') {
    if (sharedNoChanceOf(model, card.id, 'typed') !== null) return { family: 'aim', row: 'shared' }
    if (card.bound != null) return { family: 'aim', row: card.bound.measured ? 'bound' : 'notcounted' }
  }
  if (card.family === 'quantity') {
    if (visualOfCard(model, card, null) !== null) return { family: 'quantity', row: 'bands' }
    const figure = card.figure
    if (figure == null) return null
    if (figure.state === 'waits') return { family: 'quantity', row: 'waits' }
    if (figureRange(card) !== null) return { family: 'quantity', row: 'range' }
    return { family: 'quantity', row: figure.text === '' ? 'unsized' : 'value' }
  }
  return null
}

function fixtureCases(fixture: string, view: View): CardCase[] {
  const model = view.model!
  const foldedBars = barsOf(model)
  return [
    { fixture, view, id: QUESTION, family: 'question', row: 'question' },
    ...model.cards.flatMap((card) => {
      const face = faceOf(card, model)
      return face === null || foldedBars.has(card.id) ? [] : [{ ...face, fixture, view, id: card.id, card }]
    }),
  ]
}

const cases: CardCase[] = [
  ...fixtureCases('cardface studio', studio),
  ...fixtureCases('issue 7 studio', issue7('studio')),
  ...fixtureCases('issue 7 bakery asked', issue7('bakery-asked')),
  ...fixtureCases('issue 7 app launch', issue7('app-launch')),
]

const variants: { fixture: string; view: View; card: ViewCard; expectedRow: Face['row'] }[] = [
  { fixture: 'studio qualified chance', view: withCards(studio, qualifiedChance), card: qualifiedChance, expectedRow: 'chance' },
  { fixture: 'studio withheld', view: withCards(studio, withheld), card: withheld, expectedRow: 'noresult' },
  { fixture: 'studio shared blocker', view: shared, card: aim, expectedRow: 'shared' },
  { fixture: 'studio unsized fee', view: withCards(studio, unsized), card: unsized, expectedRow: 'unsized' },
  { fixture: 'studio flat fee range without text', view: withCards(studio, rangeWithoutText), card: rangeWithoutText, expectedRow: 'range' },
  { fixture: 'studio fee waits', view: withCards(studio, waits), card: waits, expectedRow: 'waits' },
  { fixture: 'studio unmeasured bound', view: withCards(studio, notcounted), card: notcounted, expectedRow: 'notcounted' },
]

function variantCases(): CardCase[] {
  return variants.map(({ fixture, view, card, expectedRow }) => {
    const face = faceOf(card, view.model!)
    if (face === null || face.row !== expectedRow) {
      throw new Error(`${fixture} / ${card.id}: expected ${expectedRow}, got ${face?.row ?? 'no FACE row'}`)
    }
    return { ...face, fixture, view, id: card.id, card }
  })
}

function drawCard({ view, id, card }: CardCase) {
  useViewStore.setState({ view })
  const props = {
    id, type: card === undefined ? 'viewQuestion' : 'viewCard', data: card === undefined ? {} : { card },
    selected: false, dragging: false, zIndex: 0, isConnectable: false,
    positionAbsoluteX: 0, positionAbsoluteY: 0, selectable: true, deletable: false, draggable: false,
  } as NodeProps
  return render(<ReactFlowProvider><CoreCard {...props} /></ReactFlowProvider>)
}

// Vitest disables stylesheets. Mirror olumiLook.css's resting visibility rules
// for card actions, Simple chrome and the quick-action rail.
const excludedAtRest = [
  '[hidden]', '[aria-hidden="true"]', '.sr-only', '.hidden', '.invisible', '.opacity-0',
  '[data-card-action]:not([data-card-edit-cue], [data-card-edit-cue] *, .ok-card-chrome *)',
  '.ok-card-chrome', '[data-testid^="node-card-rail-"]',
].join(', ')

// With stylesheets disabled, the computed display covers native elements and
// inline styles. Read the display utilities used on the cards as well.
const blockDisplays = ['block', 'flow-root', 'flex', 'grid', 'list-item', 'table', 'table-row', 'table-cell', 'table-caption']
const displayUtilities = [...blockDisplays, 'inline', 'inline-block', 'inline-flex', 'inline-grid', 'contents']
const itemLayouts = ['flex', 'inline-flex', 'grid', 'inline-grid']

function visibleText(node: Node, except?: Element, layoutItem = false): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? ''
  if (!(node instanceof Element) || node === except || node.matches(excludedAtRest)) return ''
  const style = getComputedStyle(node)
  if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || style.opacity === '0') return ''
  if (node.tagName === 'BR') return ' '
  const display = (node as HTMLElement).style?.display || displayUtilities.find((value) => node.classList.contains(value)) || style.display
  const childrenAreItems = itemLayouts.includes(display) || (display === 'contents' && layoutItem)
  const text = Array.from(node.childNodes, (child) => visibleText(child, except, childrenAreItems)).join('')
  return blockDisplays.includes(display) || (layoutItem && display !== 'contents') ? ` ${text} ` : text
}

const words = (text: string) => text.match(/[\p{L}\p{Nd}]+/gu)?.length ?? 0

function measureCard(sample: CardCase, witness?: string): Measurement {
  const rendered = drawCard(sample)
  try {
    const root = rendered.getByRole('group')
    const title = rendered.getByTestId('node-title')
    expect(root).toHaveAttribute('data-simple-compact')
    if (witness !== undefined) expect(root.querySelector(witness)).not.toBeNull()
    // The option letter is drawn by CSS, outside the DOM text.
    const optionLetter = sample.family === 'option' ? root.querySelector('[data-option-letter]')?.getAttribute('data-option-letter') ?? '' : ''
    return { ...sample, faceWords: words(visibleText(root, title)) + words(optionLetter), titleWords: words(visibleText(title)) }
  } finally {
    rendered.unmount()
  }
}

function budgetFor(face: Face): number {
  switch (face.family) {
    case 'option': return budget.faces.option[face.row]
    case 'quantity': return budget.faces.quantity[face.row]
    case 'aim': return budget.faces.aim[face.row]
    case 'question': return budget.faces.question[face.row]
  }
}

function assertWithinBudget(card: Measurement): void {
  const label = `${card.fixture} / ${card.id} (${card.family}/${card.row})`
  const faceBudget = budgetFor(card)
  if (!Number.isInteger(faceBudget) || card.faceWords > faceBudget) {
    throw new Error(`${label}: face count ${card.faceWords}, budget ${faceBudget}`)
  }
  if (!Number.isInteger(budget.titleWords) || card.titleWords > budget.titleWords) {
    throw new Error(`${label}: title count ${card.titleWords}, budget ${budget.titleWords}`)
  }
}

const witnesses: Record<Face['row'], string> = {
  chance: '[data-simple-chance]',
  fixed: '[data-simple-face="fixed"]',
  noresult: '[data-simple-state] [data-face-mark="chance"]',
  shared: '[data-simple-no-chance-once] [data-face-mark="chance"]',
  value: '[data-simple-face="figure"]',
  range: '[data-testid="range-bar"] [data-testid="range-point"]',
  bands: '[data-form="CH-bands"]',
  unsized: '[data-unsized] [data-face-mark="track"]',
  waits: '[data-simple-pending] [data-face-mark="track"]',
  bound: '.ok-bound',
  notcounted: '[data-simple-bound-state] [data-face-mark="bound"]',
  question: '[data-ok-family="question"]',
}

const witnessCases: Record<Face['row'], string> = {
  chance: 'cardface studio',
  fixed: 'cardface studio',
  noresult: 'studio withheld',
  shared: 'studio shared blocker',
  value: 'cardface studio',
  range: 'studio flat fee range without text',
  bands: 'cardface studio',
  unsized: 'studio unsized fee',
  waits: 'studio fee waits',
  bound: 'cardface studio',
  notcounted: 'studio unmeasured bound',
  question: 'cardface studio',
}

let previousLevel: ReturnType<typeof levelOf>
let previousLod: ReturnType<typeof useCanvasStore.getState>['lodRung']
let previousView: Pick<ReturnType<typeof useViewStore.getState>, 'sid' | 'view'>

beforeEach(() => {
  vi.stubEnv('VITE_OLUMI_CORE', '1')
  previousLevel = levelOf(null)
  setDefaultLevel('simple')
  previousLod = useCanvasStore.getState().lodRung
  useCanvasStore.setState({ lodRung: 'full' })
  const { sid, view } = useViewStore.getState()
  previousView = { sid, view }
  useViewStore.setState({ sid: null })
})

afterEach(() => {
  cleanup()
  setDefaultLevel(previousLevel)
  useCanvasStore.setState({ lodRung: previousLod })
  useViewStore.setState(previousView)
  vi.unstubAllEnvs()
})

it('keeps all fixture cards within budget and ratchets each budget to the measured maximum', () => {
  const witnessed = new Set<Face['row']>()
  const maxima = new Map<string, number>()
  let titleMax = 0
  for (const sample of [...cases, ...variantCases()]) {
    const witness = !witnessed.has(sample.row) && sample.fixture === witnessCases[sample.row] ? witnesses[sample.row] : undefined
    const measured = measureCard(sample, witness)
    if (witness !== undefined) witnessed.add(sample.row)
    assertWithinBudget(measured)
    const key = `${sample.family}/${sample.row}`
    maxima.set(key, Math.max(maxima.get(key) ?? 0, measured.faceWords))
    titleMax = Math.max(titleMax, measured.titleWords)
  }
  expect([...witnessed].sort()).toEqual(Object.keys(witnesses).sort())
  for (const [family, rows] of Object.entries(budget.faces)) {
    for (const [row, cap] of Object.entries(rows)) {
      const key = `${family}/${row}`
      expect(cap, `${key}: lower the budget to the measured maximum`).toBe(maxima.get(key))
    }
  }
  expect(budget.titleWords, 'lower the title allowance to the measured maximum').toBe(titleMax)
})

it('reports a planted sentence drawn at rest from a typed figure field', () => {
  const original: CardCase = { fixture: 'planted breach', view: studio, id: quantity.id, card: quantity, family: 'quantity', row: 'value' }
  const sentence = 'This extra sentence about the class fee should only appear when someone asks for more detail.'
  const planted: ViewCard = { ...quantity, figure: { ...quantity.figure!, text: `${quantity.figure!.text} ${sentence}` } }
  const baseline = measureCard(original)
  const breached = measureCard({ ...original, view: withCards(studio, planted), card: planted })
  expect(breached.faceWords - baseline.faceWords).toBe(words(sentence))
  expect(breached.titleWords).toBe(baseline.titleWords)
  expect(() => assertWithinBudget(breached)).toThrow(
    `planted breach / ${planted.id} (quantity/value): face count ${breached.faceWords}, budget ${budget.faces.quantity.value}`,
  )
})

it('counts inline fragments together and separates text at layout breaks', () => {
  const { container } = render(
    <div>
      work<span>shop</span><br />
      next<div>block</div>after
      <span className="inline-flex"><span>flex</span><span>items</span></span>
      <div className="grid"><span>grid</span><span>items</span></div>
    </div>,
  )
  expect(visibleText(container).trim().split(/\s+/)).toEqual(['workshop', 'next', 'block', 'after', 'flex', 'items', 'grid', 'items'])
})
