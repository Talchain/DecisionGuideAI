import { readFileSync } from 'node:fs'
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMe } from '../../../../olumiCore/me'
import type { View, ViewCard, ViewModel, ViewRow, ViewRun } from '../../../client'
import { TippingPerOption } from '../../../port/AnalysisReaders'
import { CoreCard } from '../../../previous/CoreCard'
import { useViewStore } from '../../../store'
import { Tipping } from '../../../ViewChances'
import { setDefaultLevel, useSimpleLevel, type Level } from '../../simpleStore'
import * as cardWords from '../words'

vi.mock('../../../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
vi.mock('@xyflow/react', async () => ({ ...(await vi.importActual<object>('@xyflow/react')), Handle: () => null }))

const PRICING = JSON.parse(readFileSync('src/olumiView/golden/pricing.view.json', 'utf8')) as View
const OPTION = 'raise_price'
const OTHER_OPTION = 'carry_on'
const AIM = 'profit_goal'
const OTHER_AIM = 'another_aim'
const SCIENCE = '[data-card-science]'
const CROSSING = 'run.tipping.0.line'
const SILENCE = 'run.tipping_aims.0.silent.0.line'
const TIPS = "The aim is met if 'cups change' is above −502 cups/month."
const TIPS_FACE = 'Above −502 cups/month'
const WITHHELD = 'The cups change figure is missing.'
const SILENT_LINE = "The chance for 'Raise the price by 45p' could not be worked out."

const cardOf = (model: ViewModel, id: string): ViewCard => model.cards.find((card) => card.id === id)!
const pricing = () => {
  const view = structuredClone(PRICING)
  const model = view.model!
  const run = model.run!
  return { view, model, run, card: cardOf(model, OPTION), crossing: run.tipping[0]! }
}
type Pricing = ReturnType<typeof pricing>
type WithheldRow = Extract<ViewRow, { kind: 'none' }>
type Silent = ViewRun['tipping_aims'][number]['silent'][number]

function withhold(card: ViewCard, fields: Partial<Pick<WithheldRow, 'tips' | 'tips_face'>> = {}): void {
  const head = card.headline!
  card.headline = { ...head, state: 'none', text: WITHHELD, title: WITHHELD, range: null, why: null, add: null, shared: false }
  card.rows = [{ kind: 'none', aim_id: head.aim_id, text: WITHHELD, title: WITHHELD, ...fields }]
}

function setSilences(run: ViewRun, ...silent: Silent[]): void {
  run.tipping = []
  run.tipping_aims = [{ aim: AIM, lines: [], silent }]
}

const silence = (fields: Partial<Silent> = {}): Silent => ({
  crossing: 'chance', reason: 'not_worked_out', text: SILENT_LINE, line: SILENT_LINE, ...fields,
})

function draw(view: View, level: Level, id = OPTION): HTMLElement {
  setDefaultLevel(level)
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false, at: null })
  useMe.setState({ me: { id: view.you_id, name: view.you }, status: 'ready' })
  const props = {
    id, type: 'viewCard', data: { card: cardOf(view.model!, id) }, selected: false, dragging: false, zIndex: 0,
    isConnectable: false, positionAbsoluteX: 0, positionAbsoluteY: 0, selectable: true, deletable: false, draggable: false,
  } as NodeProps
  const { container } = render(<ReactFlowProvider><CoreCard {...props} /></ReactFlowProvider>)
  const face = container.querySelector<HTMLElement>(`[data-core-card="${id}"]`)!
  expect(face).not.toBeNull()
  return face
}

function expectScience(face: HTMLElement, at: string, line: string): Element {
  const rows = face.querySelectorAll(SCIENCE)
  expect(rows).toHaveLength(1)
  const row = rows[0]!
  expect(row.getAttribute('data-card-science')).toBe(OPTION)
  expect(row.getAttribute('data-view')).toBe(at)
  expect(row.textContent).toBe(line)
  return row
}

beforeEach(() => { window.localStorage.clear(); useSimpleLevel.setState({ levels: {} }) })
afterEach(() => {
  cleanup()
  setDefaultLevel('simple')
  useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none' })
  useMe.setState({ me: null, status: 'none' })
})

const absentCases: [string, (fixture: Pricing) => void][] = [
  ['a null run', ({ model }) => { model.run = null }],
  ['no tipping heading', ({ run }) => { run.tipping_heading = '' }],
  ['no headline aim', ({ card }) => { card.headline!.aim_id = null }],
  ['the wrong option', ({ crossing }) => { crossing.option = OTHER_OPTION }],
  ['the wrong aim', ({ crossing }) => { crossing.aim = OTHER_AIM }],
  ['only a lead crossing', ({ crossing }) => { crossing.kind = 'lead' }],
  ['only aim-wide silence', ({ run }) => { setSilences(run, silence({ crossing: null })) }],
]

describe.each([
  { face: 'Simple', level: 'simple' },
  { face: 'Detailed', level: 'working' },
] as const)('$face option science', ({ level }) => {
  it('a. Draws the first matching measured sentence whole at its Core path, after the state or aim rows', () => {
    const { view, run, card, crossing } = pricing()
    const head = card.headline!
    const row = card.rows[0]!
    if (row.kind !== 'chance') throw new Error('Pricing must start with a measured option')
    const qualifier = head.range!
    row.value = `${row.value}, ${qualifier}`
    head.text = row.value
    // AimRows draws results for aims that have no card on the board.
    card.rows.push({ ...row, aim_id: OTHER_AIM })
    run.tipping = [
      { ...crossing, id: 'lead', kind: 'lead' },
      crossing,
      { ...crossing, id: 'later', line: crossing.hover },
    ]
    run.tipping_aims[0]!.silent = [silence({ option: OPTION })]

    const face = draw(view, level)
    const science = expectScience(face, 'run.tipping.1.line', crossing.line)
    if (level === 'simple') {
      const state = face.querySelector('[data-simple-qual]')!
      expect(state.textContent).toBe(qualifier)
      expect(state.nextElementSibling).toBe(science)
      expect(science.nextElementSibling).toBe(face.querySelector('[data-simple-foot]'))
    } else {
      const aimRows = face.querySelector(`[data-view="${OPTION}.limits"]`)!
      expect(aimRows.querySelector(`[data-ok-limit="${OTHER_AIM}"]`)).not.toBeNull()
      expect(aimRows.nextElementSibling).toBe(science)
    }
  })

  it('b. Draws the whole measured sentence when the crossing is genuinely zero', () => {
    const { view, crossing } = pricing()
    crossing.at = 0
    expectScience(draw(view, level), CROSSING, crossing.line)
  })

  it('c. Draws the withheld option’s own silence at its Core path', () => {
    const { view, run, card } = pricing()
    withhold(card)
    run.most_likely = null
    const own = silence({ option: OPTION })
    setSilences(run, silence({ option: OTHER_OPTION, line: cardOf(view.model!, OTHER_OPTION).headline!.title }), own)
    expectScience(draw(view, level), 'run.tipping_aims.0.silent.1.line', own.line)
  })

  it('d. Draws an unnamed silence on the leader when both option and aim match', () => {
    const { view, run } = pricing()
    const unnamed = silence()
    setSilences(run, unnamed)
    expectScience(draw(view, level), SILENCE, unnamed.line)
  })

  it.each([
    ['option', { option: OTHER_OPTION }],
    ['aim', { aim_id: OTHER_AIM }],
  ] as const)('d. Omits an unnamed silence when the leader’s %s differs', (_, mismatch) => {
    const { view, run } = pricing()
    setSilences(run, silence())
    run.most_likely = { ...run.most_likely!, ...mismatch }
    expect(draw(view, level).querySelector(SCIENCE)).toBeNull()
  })

  it.each(absentCases)('e. Omits the row with %s', (_, change) => {
    const fixture = pricing()
    change(fixture)
    expect(draw(fixture.view, level).querySelector(SCIENCE)).toBeNull()
  })

  it('e. Omits the row on a v2 View', () => {
    const { view, model } = pricing()
    delete (model as Partial<ViewModel>).run
    const legacy = { ...view, schema: 'olumi.view/2' } as unknown as View
    expect(draw(legacy, level).querySelector(SCIENCE)).toBeNull()
  })

  it('e. Omits the row on a non-option even with a matching id and headline aim', () => {
    const { view, model, card, crossing } = pricing()
    const goal = cardOf(model, AIM)
    goal.headline = card.headline!
    crossing.option = goal.id
    expect(draw(view, level, goal.id).querySelector(SCIENCE)).toBeNull()
  })
})

it('f. Tipping and TippingPerOption render identical text with the card selector stubbed to null', () => {
  const { view, model, run, crossing } = pricing()
  const readAnalysis = () => {
    const { getByTestId, unmount } = render(<><Tipping run={run} /><TippingPerOption model={model} /></>)
    const text = [getByTestId('view-run-tipping').textContent, getByTestId('analysis-tipping').textContent]
    unmount()
    return text
  }
  expectScience(draw(view, 'working'), CROSSING, crossing.line)
  const original = readAnalysis()
  for (const text of original) expect(text).toContain(crossing.line)
  cleanup()

  const selector = vi.spyOn(cardWords, 'optionScienceOf').mockReturnValue(null)
  try {
    expect(draw(view, 'working').querySelector(SCIENCE)).toBeNull()
    expect(selector).toHaveBeenCalled()
    expect(readAnalysis()).toEqual(original)
  } finally {
    selector.mockRestore()
  }
})

const SIMPLE_TIPS = '[data-simple-face="tips"]'
const HEAD_TIPS = `[data-row-below="tips"][data-view="${OPTION}.rows.0.tips"]`

it('g1. Simple CP-3 and Detailed headline tips each take precedence over a matching crossing', () => {
  const { view, card } = pricing()
  withhold(card, { tips_face: TIPS_FACE, tips: TIPS })

  const simple = draw(view, 'simple')
  expect(simple.querySelector(SIMPLE_TIPS)?.lastChild?.textContent).toBe(TIPS_FACE)
  expect(simple.querySelector(SCIENCE)).toBeNull()
  cleanup()

  const detailed = draw(view, 'working')
  expect(detailed.querySelector(HEAD_TIPS)?.textContent).toBe(TIPS)
  expect(detailed.querySelector(SCIENCE)).toBeNull()
})

it('g2. With tips only, Detailed draws its tips and Simple draws the matching crossing', () => {
  const { view, card, crossing } = pricing()
  withhold(card, { tips: TIPS })

  const detailed = draw(view, 'working')
  expect(detailed.querySelector(HEAD_TIPS)?.textContent).toBe(TIPS)
  expect(detailed.querySelector(SCIENCE)).toBeNull()
  cleanup()

  const simple = draw(view, 'simple')
  expect(simple.querySelector(SIMPLE_TIPS)).toBeNull()
  expectScience(simple, CROSSING, crossing.line)
})

it('h. Simple draws the matching crossing when shared withholding bypasses CP-3 despite tips_face', () => {
  const { view, model, run, crossing } = pricing()
  run.all_withheld = true
  for (const option of model.cards.filter((c) => c.family === 'option')) {
    withhold(option, { tips_face: TIPS_FACE, tips: TIPS })
    option.headline!.shared = true
  }

  const face = draw(view, 'simple')
  expect(face.querySelector(`${SIMPLE_TIPS}, [data-simple-face="no-chance"]`)).toBeNull()
  expectScience(face, CROSSING, crossing.line)
})

it('i. Detailed draws the matching crossing when its headline already says the tips sentence', () => {
  const { view, card, crossing } = pricing()
  withhold(card, { tips: TIPS })
  card.headline!.add = `${WITHHELD} ${TIPS}`

  const face = draw(view, 'working')
  expect(face.querySelector(`[data-view="${OPTION}.headline.add"]`)?.textContent).toBe(card.headline!.add)
  expect(face.querySelector(HEAD_TIPS)).toBeNull()
  expectScience(face, CROSSING, crossing.line)
})

it('j. Detailed draws the headline’s matching crossing alongside another aim’s tips', () => {
  const { view, card, crossing } = pricing()
  withhold(card)
  card.rows.push({ kind: 'none', aim_id: OTHER_AIM, text: WITHHELD, title: WITHHELD, tips: TIPS })

  const face = draw(view, 'working')
  expect(face.querySelector(`[data-row-below="tips"][data-view="${OPTION}.rows.1.tips"]`)?.textContent).toBe(TIPS)
  expectScience(face, CROSSING, crossing.line)
})
