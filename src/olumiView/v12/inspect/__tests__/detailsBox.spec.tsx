/**
 * S4 details lane (19 Nov): a figure's details box draws no control dimmed at rest with no reason, says "Change figure" once, and is short.
 * Task 1: Set / Try / What if are drawn only when they can act. Task 2: one "Change figure" in the older look's panel. Task 3: rows at rest.
 * Each row has a CONTRAST (the same control once it can act, or the lane's own box).
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { ToastProvider } from '../../../../canvas/ToastContext'
import { LaneEditingLayer } from '../../edit/LaneEditingLayer'
import { useLaneInspector } from '../../edit/inspectorStore'
import { triableCards } from '../../../layout'
import { useViewStore } from '../../../store'
import { approved, install, uninstall } from '../../edit/__tests__/harness'

const PLAIN = 'starting_customers'
const lane = (on: boolean): void => { vi.stubEnv('VITE_OLUMI_CORE', on ? '1' : '0') }
afterEach(() => { cleanup(); uninstall(); vi.unstubAllEnvs(); useLaneInspector.setState({ current: null, drafts: {} }) })
const mount = (id: string) => { useLaneInspector.getState().open({ kind: 'card', id }); return render(<ToastProvider><LaneEditingLayer /></ToastProvider>) }

/** A figure core works out (no edit of its own): the model's cards that have a figure and are not triable. */
const workedOut = () => { const m = useViewStore.getState().view!.model!; return m.cards.find((c) => c.figure !== null && !triableCards(m).some((t) => t.id === c.id))! }

describe('task 1: nothing is dimmed at rest with no reason', () => {
  beforeEach(() => { lane(true); install(approved()) })
  it('D1 the lane box: Set and Try are not drawn beside an empty field, and both are once it has text', () => {
    mount(PLAIN)
    expect(screen.getByTestId('inspector-figure-typed')).toBeInTheDocument()
    expect([screen.queryByTestId('inspector-figure-set'), screen.queryByTestId('inspector-figure-try')]).toEqual([null, null])
    fireEvent.change(screen.getByTestId('inspector-figure-typed'), { target: { value: '150' } })
    expect([screen.getByTestId('inspector-figure-set'), screen.getByTestId('inspector-figure-try')].map((b) => (b as HTMLButtonElement).disabled)).toEqual([false, false])
    fireEvent.change(screen.getByTestId('inspector-figure-typed'), { target: { value: '' } })
    expect(screen.queryByTestId('inspector-figure-set'), 'CONTRAST: emptied again, it goes').toBeNull()
  })
})

describe('tasks 1 to 3: the older look\'s panel', () => {
  beforeEach(() => { lane(false); install(approved()) })
  it('D2 a figure the team sets: its field has no Set until it has text, and "Change figure" is said once (field button, not also the edit row)', () => {
    mount(PLAIN)
    expect(screen.getByTestId('inspector-your-figure')).toBeInTheDocument()
    expect(screen.queryByTestId('inspector-figure-set')).toBeNull()
    expect(screen.queryByTestId('lane-inspector-change-figure'), 'the edit row duplicates the field\'s own button').toBeNull()
    fireEvent.change(screen.getByTestId('inspector-figure-typed'), { target: { value: '150' } })
    expect(screen.getByTestId('inspector-figure-set')).toHaveTextContent('Change figure')
    expect(screen.getAllByText('Change figure'), 'said once, with the text typed').toHaveLength(1)
  })
  it('D3 a worked-out figure has no What if (not drawn, not dimmed); CONTRAST: a figure that can be tried has it at full strength', () => {
    const w = workedOut()
    expect(w, 'precondition: the fixture has a worked-out figure').toBeDefined()
    mount(w.id)
    expect(screen.queryByTestId('inspector-what-if')).toBeNull()
    cleanup(); useLaneInspector.setState({ current: null })
    mount(PLAIN)
    expect(screen.getByTestId('inspector-what-if')).toBeEnabled()
    expect(screen.getByTestId('inspector-what-if').className).not.toMatch(/opacity-50/)
  })
  it('D4 a risk keeps its own Set chance and size row in the edit row (the field is not drawn for it): the filter is only for a figure field', () => {
    mount('slow_ramp')
    expect(screen.getByTestId('lane-inspector-size')).toBeInTheDocument()
  })
})

describe('task 3: a figure\'s box is short at rest', () => {
  it('D5 rows at rest on a figure: the lane box has no button row beside the empty field (before: Set and Try, 2 buttons), the older panel has no Set and no second Change figure', () => {
    lane(true); install(approved()); mount(PLAIN)
    const box = screen.getByTestId('lane-inspector')
    const buttons = (): string[] => [...box.querySelectorAll('button')].map((b) => b.getAttribute('data-testid') ?? b.getAttribute('aria-label') ?? '')
    const rest = buttons()
    expect(rest.filter((t) => t.startsWith('inspector-figure-')), `lane buttons at rest: ${rest.join(',')}`).toEqual([])
    fireEvent.change(screen.getByTestId('inspector-figure-typed'), { target: { value: '1' } })
    expect(buttons().length - rest.length, 'CONTRAST: the two it used to draw at rest').toBe(2)
  })
})

describe('S4 pop-up lane (20 Nov): the figure field is labelled once, in core\'s words, whole', () => {
  beforeEach(() => { lane(true); install(approved()) })
  it('P2 the lane box labels the field with core\'s own prompt, drawn once and uncut, with no chrome word before it; the ask stays as its hint', () => {
    const edit = useViewStore.getState().view!.model!.cards.find((c) => c.id === PLAIN)!.figure!.edit!
    expect(edit.prompt.length, 'precondition: core sent a prompt').toBeGreaterThan(0)
    mount(PLAIN)
    const label = screen.getByTestId('inspector-figure-typed').closest('div')!.querySelector('label')!
    expect(label.textContent, 'the label is core\'s prompt exactly: nothing prefixed, nothing cut').toBe(edit.prompt)
    expect(label.getAttribute('title')).toBe(edit.ask)
    expect(within(screen.getByTestId('lane-inspector')).getAllByText(edit.prompt, { exact: false }), 'the prompt is drawn once in the box').toHaveLength(1)
  })
  it('CONTRAST: the older look keeps its own field, labelled in its own words (the change is the lane box\'s Value row only)', () => {
    cleanup(); uninstall(); lane(false); install(approved())
    const edit = useViewStore.getState().view!.model!.cards.find((c) => c.id === PLAIN)!.figure!.edit!
    mount(PLAIN)
    expect(screen.getByTestId('inspector-your-figure').querySelector('label')!.textContent).toBe(`Your figure: ${edit.prompt}`)
  })
})
