/** V12 inspector for a selected figure: range slot, What it moves, Your figure, Ask Olumi and What if. */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { ToastProvider } from '../../../../canvas/ToastContext'
import { useCanvasStore } from '../../../../canvas/store'
import { LaneInspector } from '../../edit/LaneInspector'
import { useLaneInspector } from '../../edit/inspectorStore'
import { useViewLens } from '../../../lens'
import { useViewStore } from '../../../store'
import type { View } from '../../../client'
import { SID, approved, install, uninstall, type Stub } from '../../edit/__tests__/harness'
import { movesOf } from '../whatItMoves'
import { sampledChanceWords } from '../../scale/chanceWords'
import { useWhatIfFocus } from '../whatIfFocus'

const askAI = vi.fn()
vi.mock('../../../../canvas/contextMenu/actions', async (orig) => ({ ...(await orig<object>()), askAI: (...a: unknown[]) => askAI(...a) }))

const FIG = 'broad_entry_acquisitions'
/** The fixture's View with `broader_entry` driven by FIG: low 0.2, high 0.9, and one chance row (0.5) as its "now". */
function driven(over: (v: View) => void = () => undefined): View {
  const v = structuredClone(approved())
  const o = v.model!.cards.find((c) => c.id === 'broader_entry')!
  o.driver = { text: "core's words about the driver", title: 't', figure: FIG, low: 0.2, high: 0.9 }
  o.rows = [{ kind: 'chance', chance: 0.5, aim_id: 'a1' } as never]
  over(v)
  return v
}
let stub: Stub
beforeEach(() => { askAI.mockClear(); stub = install(driven()) })
afterEach(() => { cleanup(); uninstall(); useLaneInspector.setState({ current: null }); useViewLens.setState({ lens: 'full' }); useWhatIfFocus.setState({ id: null }); useCanvasStore.setState({ nodes: [] } as never) })
const open = (id = FIG) => { useLaneInspector.getState().open({ kind: 'card', id }); return render(<ToastProvider><LaneInspector /></ToastProvider>) }

describe('What it moves', () => {
  it('draws now, if high and if low for each option the figure moves, from the numbers the View holds', () => {
    open()
    const opt = screen.getByTestId('inspector-moves').querySelector('[data-moves-option="broader_entry"]') as HTMLElement
    expect(opt).toHaveTextContent('50%')
    expect(opt.querySelector('[data-moves-bar="now"]')).toHaveTextContent('50%')
    expect(opt.querySelector('[data-moves-bar="if high"]')).toHaveTextContent('90%')
    expect(opt.querySelector('[data-moves-bar="if low"]')).toHaveTextContent('20%')
  })
  it('without the numbers it draws core\'s driver words and no bar; with two chance rows "now" is left out rather than guessed', () => {
    cleanup(); uninstall()
    stub = install(driven((v) => { v.model!.cards.find((c) => c.id === 'broader_entry')!.driver!.high = null as never }))
    open()
    expect(screen.getByTestId('inspector-moves-words')).toHaveTextContent("core's words about the driver")
    expect(screen.getByTestId('inspector-moves').querySelector('[data-moves-bar]')).toBeNull()
    const m = structuredClone(approved()).model!
    const o = m.cards.find((c) => c.id === 'broader_entry')!
    o.driver = { text: 'w', title: 't', figure: FIG, low: 0.2, high: 0.9 }
    o.rows = [{ kind: 'chance', chance: 0.5, aim_id: 'a1' } as never, { kind: 'chance', chance: 0.6, aim_id: 'a2' } as never]
    expect(movesOf(m, FIG)[0]).toMatchObject({ now: null, high: 0.9, low: 0.2 })
  })
  it('a sampled chance is worded by core\'s one rule (format.ts chanceHedge/chancePct at 66f33c7e): never "100%" or "0%". CONTRASTS: just inside each threshold says the number', () => {
    expect([1, 0.995, 0.9949, 0.72, 0.005, 0.0049, 0].map(sampledChanceWords)).toEqual(['over 99%', 'over 99%', 'about 99%', 'about 72%', 'about 1%', 'under 1%', 'under 1%'])
  })
  it('a figure no option moves has no What it moves section', () => { cleanup(); open('starting_customers'); expect(screen.queryByTestId('inspector-moves')).toBeNull() })
})

describe('Your figure', () => {
  it('on an Olumi estimate the button says "Change to your figure (was Olumi\'s estimate)" and saves through the edit route as typed', async () => {
    open()
    const form = screen.getByTestId('inspector-your-figure')
    expect(within(form).getByTestId('inspector-figure-set')).toHaveTextContent("Change to your figure (was Olumi's estimate)")
    expect(screen.getByTestId('inspector-figure-set')).toBeDisabled()
    fireEvent.change(screen.getByTestId('inspector-figure-typed'), { target: { value: '120' } })
    fireEvent.click(screen.getByTestId('inspector-figure-set'))
    await waitFor(() => expect(stub.posts()).toHaveLength(1))
    expect(stub.posts()[0]!.path).toBe(`/api/scenarios/${SID}/edit`)
    expect(stub.posts()[0]!.body).toMatchObject({ quantity: FIG, typed: '120' })
  })
  it('CONTRAST: the team\'s own figure says "Change figure", and a card with no edit offers no field', () => {
    open('starting_customers')
    expect(screen.getByTestId('inspector-figure-set')).toHaveTextContent('Change figure')
    cleanup(); open('single_country_test')
    expect(screen.queryByTestId('inspector-your-figure')).toBeNull()
  })
})

describe('range slot, Ask Olumi and What if', () => {
  const withRange = (v: View) => { (v.model!.cards.find((c) => c.id === FIG)!.figure as unknown as { range: unknown }).range = { low: 1, likely: 3, high: 6, unit: 'mo' } }
  it('hands the slot the card and its numeric range, and draws nothing when the View holds none', () => {
    cleanup(); uninstall(); stub = install(driven(withRange))
    useLaneInspector.getState().open({ kind: 'card', id: FIG })
    render(<ToastProvider><LaneInspector range={(c, r) => <i data-testid="slot">{c.id}:{r.low}-{r.high}{r.unit}</i>} /></ToastProvider>)
    expect(screen.getByTestId('slot')).toHaveTextContent(`${FIG}:1-6mo`)
    cleanup(); uninstall(); stub = install(driven())
    useLaneInspector.getState().open({ kind: 'card', id: FIG })
    render(<ToastProvider><LaneInspector range={() => <i data-testid="slot" />} /></ToastProvider>)
    expect(screen.queryByTestId('slot')).toBeNull()
  })
  it('Ask Olumi asks about this card through the existing ask action', () => {
    useCanvasStore.setState({ nodes: [{ id: FIG, type: 'factor', position: { x: 0, y: 0 }, data: { label: 'x' } }] } as never)
    open()
    fireEvent.click(screen.getByTestId('inspector-ask'))
    expect(askAI).toHaveBeenCalledTimes(1)
    expect(askAI.mock.calls[0]![0]).toMatchObject({ kind: 'node', nodeId: FIG })
  })
  it('What if turns the What if lens on for this figure', () => {
    open()
    fireEvent.click(screen.getByTestId('inspector-what-if'))
    expect(useViewLens.getState().lens).toBe('what_if')
    expect(useWhatIfFocus.getState().id).toBe(FIG)
    expect(useViewStore.getState().sid).toBe(SID)
  })
})
