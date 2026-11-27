import { tipOf } from '../../../__tests__/tipHelpers'
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

vi.mock('../../../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
vi.mock('@xyflow/react', async () => ({ ...(await vi.importActual<object>('@xyflow/react')), Handle: () => null }))

const PRICING = JSON.parse(readFileSync('src/olumiView/golden/pricing.view.json', 'utf8')) as View
const OPTION = 'raise_price'
const AIM = 'profit_goal'
const SCIENCE = '[data-card-science]'
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

function draw(view: View, level: Level): HTMLElement {
  const id = OPTION
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

beforeEach(() => { window.localStorage.clear(); useSimpleLevel.setState({ levels: {} }) })
afterEach(() => {
  cleanup()
  setDefaultLevel('simple')
  useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none' })
  useMe.setState({ me: null, status: 'none' })
})

describe.each(['simple', 'working'] as const)('%s option face', (level) => {
  it('leaves the measured tipping sentence out of the option face', () => {
    const { view, crossing } = pricing()
    expect(crossing.line).not.toBe('')
    const face = draw(view, level)
    expect(face.querySelector(SCIENCE)).toBeNull()
    expect(face.textContent).not.toContain(crossing.line)
  })

  it('leaves the Run’s withheld explanation out of the face and keeps the row’s own words', async () => {
    const { view, run, card } = pricing()
    withhold(card)
    setSilences(run, silence({ option: OPTION }))
    const face = draw(view, level)
    if (level === 'simple') {
      expect(face.textContent).not.toContain(WITHHELD)
      expect(await tipOf(face.querySelector<HTMLElement>('[data-simple-face="no-chance"]')!)).toContain(WITHHELD)
    } else {
      expect(face.textContent).toContain(WITHHELD)
    }
    expect(face.textContent).not.toContain(SILENT_LINE)
    expect(face.querySelector(SCIENCE)).toBeNull()
  })

  it('keeps the withheld row’s own break-even detail', async () => {
    const { view, card, crossing } = pricing()
    withhold(card, { tips_face: TIPS_FACE, tips: TIPS })
    const face = draw(view, level)
    if (level === 'simple') {
      expect(face.textContent).not.toContain(TIPS_FACE)
      expect(await tipOf(face.querySelector<HTMLElement>('[data-simple-face="no-chance"]')!)).toContain(TIPS)
    } else {
      expect(face.querySelector('[data-row-below="tips"][data-view="' + OPTION + '.rows.0.tips"]')?.textContent).toContain(TIPS)
    }
    expect(face.textContent).not.toContain(crossing.line)
  })
})

it('keeps Core’s tipping sentence verbatim in the Analysis readers', () => {
  const { model, run, crossing } = pricing()
  const { getByTestId } = render(<><Tipping run={run} /><TippingPerOption model={model} /></>)
  for (const id of ['view-run-tipping', 'analysis-tipping']) {
    expect(getByTestId(id).textContent).toContain(crossing.line)
  }
})
