import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('../../../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, within } from '@testing-library/react'
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'
import * as coreLane from '../../../../olumiCore/lane'
import { useMe } from '../../../../olumiCore/me'
import { boardOf } from '../../../canvas'
import type { View, ViewCard, ViewModel } from '../../../client'
import { CoreCard } from '../../../previous/CoreCard'
import { useViewStore } from '../../../store'
import { detailsOf, useLaneInspector } from '../../edit/inspectorStore'
import { SimpleFace } from '../../SimpleFace'
import { setLevel, useSimpleLevel, type Level } from '../../simpleStore'

const BASE = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/core-38eebca9/bakery-asked.view3.json'), 'utf8')) as View
const AIM = 'within_budget', BAR = 'budget'
const aim = BASE.model!.cards.find((c) => c.id === AIM)!
const bound = aim.bound!
const question = { id: 'goal-measure', role: 'measure' as const, about: AIM, text: 'What should we count to track bakery sales?', unit: null }
const label = 'Not counted yet'
const opener = `view-aim-edit-${BAR}`

function modelOf(withBar: boolean, measured = false): ViewModel {
  const model = BASE.model!
  const cards = model.cards.map((c): ViewCard => {
    // The stored aim is a limit. A measure question is drawn only for a goal.
    if (c.id === AIM) return { ...c, family: 'goal', bound: { ...bound, measured }, doubt: true }
    if (c.id === BAR) return { ...c, author: { ...c.author!, by: 'olumi' }, ...(withBar ? { bar_of: AIM } : {}) }
    return c
  })
  return { ...model, cards, questions: [question], coaching_questions: [question.text] }
}

function board(model: ViewModel, level: Level) {
  const view = { ...BASE, model }
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false, at: null } as never)
  useMe.setState({ me: { id: view.you_id, name: view.you }, status: 'ready' })
  setLevel(level, view.id)
  return boardOf(model)
}

const aimOf = (model: ViewModel) => model.cards.find((c) => c.id === AIM)!
const drawSimple = (model: ViewModel) => render(<SimpleFace card={aimOf(model)} model={model} noted={false} />).container
const CardNode = CoreCard as unknown as (props: NodeProps) => JSX.Element
function drawWorking(model: ViewModel) {
  board(model, 'working')
  const props = { id: AIM, type: 'viewCard', data: { card: aimOf(model) }, selected: false, dragging: false, zIndex: 0, isConnectable: false,
    positionAbsoluteX: 0, positionAbsoluteY: 0, selectable: true, deletable: false, draggable: false } as unknown as NodeProps
  const { container } = render(<ReactFlowProvider><CardNode {...props} /></ReactFlowProvider>)
  return container.querySelector<HTMLElement>(`[data-core-lead="${AIM}"][data-ok-face="target"]`)!
}

beforeEach(() => {
  vi.spyOn(coreLane, 'isOlumiCoreLane').mockReturnValue(true)
  useLaneInspector.getState().close()
})

afterEach(() => {
  cleanup()
  useLaneInspector.getState().close()
  useSimpleLevel.setState({ levels: {} })
  window.localStorage.removeItem(`olumi.v12.level.${BASE.id}`)
  useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none' } as never)
  useMe.setState({ me: null, status: 'none' })
  vi.restoreAllMocks()
})

describe('Simple receiving face', () => {
  it('S1 shows the bound before the measure question and opens the folded bar’s details', () => {
    const model = modelOf(true)
    const drawn = board(model, 'simple')
    const face = within(drawSimple(model).querySelector<HTMLElement>('[data-simple-bound-state]')!)
    const words = face.getByText(bound.text)
    const line = face.getByRole('button', { name: label })
    expect(words).toBeVisible()
    expect(line).toBeVisible()
    expect(words.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const edit = face.getByTestId(opener)
    expect(edit).toContainElement(words)
    fireEvent.click(edit)
    expect(detailsOf(useLaneInspector.getState())).toMatchObject({ kind: 'card', id: BAR })
    expect(drawn.model.cards.map((c) => c.id)).not.toContain(BAR)
  })

  it('S2 shows the question alone and draws the budget card when bar_of is absent', () => {
    const model = modelOf(false)
    const drawn = board(model, 'simple')
    const face = within(drawSimple(model).querySelector<HTMLElement>('[data-simple-bound-state]')!)
    expect(face.getByRole('button', { name: label })).toBeVisible()
    expect(face.queryByText(bound.text)).not.toBeInTheDocument()
    expect(drawn.model.cards.map((c) => c.id)).toContain(BAR)
  })

  it('S3 shows the bound as plain words when edit_base is null', () => {
    const model = { ...modelOf(true), edit_base: null }
    board(model, 'simple')
    const face = within(drawSimple(model).querySelector<HTMLElement>('[data-simple-bound-state]')!)
    expect(face.getByText(bound.text)).toBeVisible()
    expect(face.queryByTestId(opener)).not.toBeInTheDocument()
  })

  it('S4 keeps the measured bound pill when bar_of is absent', () => {
    const model = modelOf(false, true)
    board(model, 'simple')
    const card = drawSimple(model)
    const pill = card.querySelector<HTMLElement>('.ok-pill.ok-bound')!
    expect(pill).toBeVisible()
    expect(pill.textContent).toBe(bound.text)
    expect(within(card).queryByRole('button', { name: label })).not.toBeInTheDocument()
  })
})

describe('Working receiving face', () => {
  it('W1 shows the bound opener, the bar’s working-level author mark and the question', () => {
    const target = drawWorking(modelOf(true))
    const face = within(target)
    expect(face.getByTestId(opener)).toHaveTextContent(bound.text)
    expect(target.querySelector('.ok-target [data-author-mark="olumi"]')).toBeVisible()
    expect(target.querySelector('.ok-target [data-simple-author]')).toBeNull()
    expect(face.getByRole('button', { name: label })).toBeVisible()
    expect(face.getByTestId(opener).compareDocumentPosition(face.getByRole('button', { name: label })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('W2 shows the question alone when bar_of is absent', () => {
    const face = within(drawWorking(modelOf(false)))
    expect(face.getByRole('button', { name: label })).toBeVisible()
    expect(face.queryByText(bound.text)).not.toBeInTheDocument()
    expect(face.queryByTestId(opener)).not.toBeInTheDocument()
  })

  it('W3 shows the bound as plain words when edit_base is null', () => {
    const face = within(drawWorking({ ...modelOf(true), edit_base: null }))
    expect(face.getByText(bound.text)).toBeVisible()
    expect(face.queryByTestId(opener)).not.toBeInTheDocument()
  })

  it('W4 keeps the budget card on the board when bar_of is present', () => {
    expect(board(modelOf(true), 'working').model.cards.map((c) => c.id)).toContain(BAR)
  })
})
