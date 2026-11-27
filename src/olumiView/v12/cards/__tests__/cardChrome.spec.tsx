import '@testing-library/jest-dom/vitest'
import { readFileSync } from 'node:fs'
import { cleanup, render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useCanvasStore } from '../../../../canvas/store'
import { useMe } from '../../../../olumiCore/me'
import type { View } from '../../../client'
import { CoreCard } from '../../../previous/CoreCard'
import { useViewStore } from '../../../store'
import { levelOf, setDefaultLevel } from '../../simpleStore'

vi.mock('../../../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
vi.mock('@xyflow/react', async () => ({ ...(await vi.importActual<object>('@xyflow/react')), Handle: () => null }))

const studio = JSON.parse(readFileSync('src/olumiView/fixtures/cardface/studio.view3.json', 'utf8')) as View
const look = readFileSync('src/olumiView/look/olumiLook.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const chromeRules = [...look.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .filter(([, selector]) => selector!.trim().endsWith('.ok-card-chrome'))
const titleReservationSelector = look.match(/([^{}]+)\{\s*padding-inline-end: calc\(var\(--ok-chrome-width\)/)![1]!.trim()

const setupFixture = () => {
  const { sid, view, at } = useViewStore.getState()
  const { me } = useMe.getState()
  const { lodRung } = useCanvasStore.getState()
  const level = levelOf(null)
  setDefaultLevel('simple')
  useCanvasStore.setState({ lodRung: 'full' })
  useViewStore.setState({ sid: studio.id, view: studio, at: null })
  useMe.setState({ me: { id: studio.you_id, name: studio.you } })
  return () => {
    setDefaultLevel(level)
    useCanvasStore.setState({ lodRung })
    useViewStore.setState({ sid, view, at })
    useMe.setState({ me })
  }
}

let restoreFixture: () => void
beforeEach(() => {
  vi.stubEnv('VITE_OLUMI_CORE', '1')
  restoreFixture = setupFixture()
})
afterEach(() => {
  cleanup()
  restoreFixture()
  vi.unstubAllEnvs()
})

function draw(id: string) {
  const card = useViewStore.getState().view!.model!.cards.find((card) => card.id === id)!
  const node = (selected: boolean) => (
    <div className="olumi-look">
      {/* React Flow supplies this wrapper and its selected class on the board. */}
      <div className={selected ? 'react-flow__node selected' : 'react-flow__node'}>
        <ReactFlowProvider>
          <CoreCard {...({ id, type: 'viewCard', data: { card }, selected, dragging: false, zIndex: 0, isConnectable: false,
            positionAbsoluteX: 0, positionAbsoluteY: 0, selectable: true, deletable: false, draggable: false } as NodeProps)} />
        </ReactFlowProvider>
      </div>
      <button type="button">After the card</button>
    </div>
  )
  const rendered = render(node(false))
  return { ...rendered, select: (selected: boolean) => rendered.rerender(node(selected)) }
}

it('puts the class fee pencil and person mark in the corner and omits the empty foot', () => {
  const { container, getByTestId } = draw('class_fee')
  const chrome = container.querySelector('.ok-card-chrome')!
  expect(chrome).toContainElement(getByTestId('view-figure-edit-class_fee'))
  expect(chrome.querySelector('[data-author-mark="person"] [data-person-mark]')).not.toBeNull()
  expect(container.querySelector('[data-simple-foot]')).toBeNull()
  expect(getByTestId('node-header-row').firstElementChild).toBe(container.querySelector(titleReservationSelector))
})

it('keeps Olumi authorship in the foot and puts the unsized figure pencil in the corner', () => {
  const { container, getByTestId } = draw('member_mood')
  const foot = container.querySelector('[data-simple-foot]')!
  expect(foot).toHaveClass('ml-auto', 'ok-card-gap-stack')
  expect(foot.querySelector('[data-author-mark="olumi"] [data-olumi-mark]')).not.toBeNull()
  expect(container.querySelector('.ok-card-chrome')).toContainElement(getByTestId('view-figure-edit-member_mood'))
  expect(container.querySelector('.ok-card-chrome [data-author-mark]')).toBeNull()
})

it('gives the title the full width when an Olumi-authored card has no edit or pending proposal', () => {
  const model = studio.model!
  const cards = model.cards.map((card) => card.id === 'member_mood'
    ? { ...card, figure: { ...card.figure!, edit: null } }
    : card)
  useViewStore.setState({ view: { ...studio, proposal: null, model: { ...model, cards } } })

  const { container } = draw('member_mood')
  expect(container.querySelector('[data-simple-foot] [data-author-mark="olumi"]')).not.toBeNull()
  expect(container.querySelector('.ok-card-chrome')).toBeNull()
  expect(container.querySelector(titleReservationSelector)).toBeNull()
})

it('keeps the resting pencil in the tab order and reveals the slot on hover, focus within or selection', async () => {
  const user = userEvent.setup()
  const { container, getByTestId, getByRole, select } = draw('class_fee')
  const chrome = container.querySelector<HTMLElement>('.ok-card-chrome')!
  const card = chrome.closest('.react-flow__node')!
  const pencil = getByTestId('view-figure-edit-class_fee')
  const stylesheet = document.createElement('style')
  stylesheet.textContent = chromeRules.map(([rule]) => rule).join('\n')
  container.prepend(stylesheet)

  const appearance = () => {
    const { opacity, pointerEvents } = getComputedStyle(chrome)
    return [opacity, pointerEvents]
  }

  expect(appearance()).toEqual(['0', 'none'])
  expect(getComputedStyle(chrome).position).toBe('absolute')
  // jsdom does not evaluate :focus-within on an ancestor. Bind its reveal
  // rule here and verify that real Tab navigation puts focus inside the node.
  const shown = chromeRules.find(([, , declarations]) => declarations!.includes('opacity: 1;'))!
  expect(shown[1]!.trim()).toBe('.olumi-look .react-flow__node:is(:hover, :focus-within, .selected) .ok-card-frame > .ok-card-chrome')
  expect(shown[2]!.trim()).toBe('opacity: 1;\n  pointer-events: auto;')
  const tabStops = container.querySelectorAll('button, [tabindex="0"]').length
  for (let i = 0; i < tabStops && document.activeElement !== pencil; i++) await user.tab()
  expect(pencil).toHaveFocus()
  expect(card).toContainElement(document.activeElement as HTMLElement)

  getByRole('button', { name: 'After the card' }).focus()
  select(true)
  expect(appearance()).toEqual(['1', 'auto'])
  select(false)
  expect(appearance()).toEqual(['0', 'none'])
})
