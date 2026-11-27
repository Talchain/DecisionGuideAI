import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setPagePerson } from '../../../../olumiCore/team/api'
import type { View, ViewCard, ViewRow } from '../../../client'
import pending from '../../../fixtures/break-even/break-even-pending.view3.json'
import pricing from '../../../fixtures/core-d4729b77/pricing.view3.json'
import { useViewStore } from '../../../store'
import type { WhatIfAnswer, WhatIfSize } from '../../../whatif'
import { setFocusSubject } from '../../../focus/subject'
import { useStoredFocusSubject } from '../../../focus/state'
import { useWhatIfSliderStore } from '../whatIfSliderStore'
import { StressTest } from '../StressTest'
import { WhatIfSlider, WHAT_IF_SLIDER_WORDS as WORDS } from '../WhatIfSlider'

vi.mock('../../../reasoning/tabRing', () => ({ pressCard: vi.fn(), ringFrom: vi.fn() }))

// ROW-V-DESIGN.v2 §0 and §4 pin the figures and expected outcomes in prose.
// No captured pre-seed View or Core answers were found in lead-20261125 or the View fixtures.
// Both pinned inputs are points. The projected View uses Core's flat-range shape.
// The labelled answers below are API.md shape stubs.
const source = pricing as unknown as View
const sid = source.id
const base = source.version!.id
const path = `/api/scenarios/${sid}/whatif`
const raise = { id: 'a_raise', label: 'A raise', value: 1_300_000, unit: 'GBP', words: '£1.3m' }
const spend = { id: 'b_spend', label: 'B spend', value: 150_000, unit: 'GBP/month', words: '£150k/month' }
const basis = 'Lean spend plus four hires at about £10,400/month fully loaded, all assumed.'
const aim = 'runway_aim'
const [optionA, optionB] = source.model!.cards.filter((card) => card.family === 'option')
const template = source.model!.cards.find((card) => card.figure?.edit != null)!
const chance = optionA.rows.find((row): row is Extract<ViewRow, { kind: 'chance' }> => row.kind === 'chance')!
const row = { ...chance, aim_id: aim, aim: 'Runway', value: 'Around 60%', title: 'Chance of reaching the runway target', chance: 0.6 }
const options = [
  { ...optionA, id: 'a', heading: 'A · Run lean', rows: [{ ...row, driver: { figure: raise.id, low: 0.5, high: 0.7 } }] },
  { ...optionB, id: 'b', heading: 'B · Hire faster', rows: [{ ...row, driver: { figure: spend.id, low: 0.75, high: 0.4 } }] },
]
const figures: ViewCard[] = [raise, spend].map((input) => ({
  ...template, family: 'quantity', id: input.id, heading: input.label,
  figure: { text: input.words, title: input.words, edit: { prompt: input.label, ask: 'Give a figure.' },
    range: { low: input.value, high: input.value, likely: input.value, unit: input.unit } },
  author: input === raise ? { by: 'person', text: 'Your figure', title: 'You said £1.3m' }
    : { by: 'olumi', text: 'Olumi’s estimate', title: `Proposed by Olumi: ${basis}` },
}))
const view: View = {
  ...source,
  model: { ...source.model!, cards: [...options, ...figures] },

}
const aLine = 'A · Run lean: the middle outcome for Runway moves from 12.00 months to 13.85 months.'
const bLine = 'B · Hire faster: the middle outcome for Runway moves from 13.33 months to 16.67 months.'
const stale = 'this what-if was asked on a different version'
const why = 'The middle outcome moves, and the chances shown stay the same.'
const assumption = 'Olumi’s estimate for B spend is £150k/month.'
const unavailable = 'Olumi cannot read the unit for A raise.'

function answer(input: typeof raise) {
  const a = input === raise
  const option = a ? options[0] : options[1]
  const before = a ? '12.00 months' : '13.33 months'
  const after = a ? '13.85 months' : '16.67 months'
  const size: WhatIfSize = { option: option.id, goal: aim, read: true, line: a ? aLine : bLine,
    chance: { before: 0.6, after: 0.6, status: 'exact_equal', difference: 0, precision_95: null, draws: 100, differ: 0 },
    middle: { before: a ? 12 : 13.33, after: a ? 13.85 : 16.67, shift: a ? 1.85 : 3.34,
      shift_of_spread: null, beyond_cut: true, before_text: before, after_text: after },
    emphasis: 'size',
  }
  const words = a ? 'Set "A raise" to £1,500,000.' : 'Set "B spend" to £120,000/month.'
  const facts = a ? [{ id: 'input_b_spend', text: assumption, value: spend.words, about: { kind: 'input', olumi: true, quantity: spend.id } }] : []
  return { scenario: sid, version: { id: base, n: source.version!.n }, hypothetical: true, saved: false, coach: null,
    variants: [{ hypothetical: true, edits: [{ quantity: input.id, label: input.label, words }],
      blocked: null, stopped: null, moved: false, why_not: why, rows: [{ option_id: option.id, rows: [{ ...row, driver: null }] }],
      most_likely: null, size: [size], values: [],
      facts,
    }],
  } satisfies WhatIfAnswer & { coach: null; variants: (WhatIfAnswer['variants'][number] & { values: unknown[] })[] }
}

const route = vi.fn<[body: unknown], Response | Promise<Response>>()
const network = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
const renderStress = (v = view) => <StressTest view={v} model={v.model!} />
const slider = () => screen.getByRole('slider', { name: WORDS.label })
const numberField = () => screen.getByRole('spinbutton', { name: WORDS.label })
const posts = () => network.mock.calls.filter(([, init]) => init?.method === 'POST')
function move(value: number) {
  fireEvent.change(numberField(), { target: { value: String(value) } })
}
const enter = () => fireEvent.keyDown(numberField(), { key: 'Enter' })
function body(quantity: string, value: number) {
  return { base, variants: [{ edits: [{ quantity, value: { kind: 'point', value } }] }] }
}

beforeEach(() => {
  setPagePerson(source.you_id)
  route.mockReset()
  network.mockReset()
  network.mockImplementation(async (url, init) => {
    if (url === '/api/me' && init?.method === 'GET') return Response.json({ me: { id: source.you_id } })
    if (url === path && init?.method === 'POST') return route(JSON.parse(String(init.body)))
    throw new Error(`Unexpected request ${init?.method} ${url}`)
  })
  vi.stubGlobal('fetch', network)
})
afterEach(() => {
  cleanup()
  // V-4(g) applies to every case. All requests are intercepted, and the only permitted
  // POST is the no-hook what-if route. A save, version or provider request fails this check.
  try {
    for (const [url, init] of network.mock.calls) {
      expect([['GET', '/api/me'], ['POST', path]]).toContainEqual([init?.method, url])
    }
    expect(posts()).toHaveLength(route.mock.calls.length)
  } finally {
    vi.unstubAllGlobals()
    setPagePerson(null)
    useViewStore.setState(useViewStore.getInitialState(), true)
    useWhatIfSliderStore.setState(useWhatIfSliderStore.getInitialState(), true)
    useStoredFocusSubject.setState({ subject: null })
  }
})

describe('V-4 · What-if slider from the approved View', () => {
  it('(a) sends the numeric point only on release and reads A’s runway, status and assumptions verbatim', async () => {
    route.mockReturnValue(Response.json(answer(raise)))
    render(renderStress())
    expect(screen.queryByRole('slider')).toBeNull()
    expect(numberField()).toHaveValue(raise.value)
    expect(numberField()).toHaveAccessibleDescription(raise.unit)
    expect(screen.queryByTestId('range-bar')).toBeNull()
    move(1_400_000)
    move(1_500_000)
    expect(network).not.toHaveBeenCalled()
    enter()
    expect(await screen.findByText(aLine)).toBeVisible()
    expect(screen.getByText(assumption)).toBeVisible()
    expect(screen.getByText(why)).toBeVisible()
    const preview = screen.getByLabelText(WORDS.preview)
    expect(preview).toHaveTextContent(row.value)
    expect(preview.querySelector('[data-testid="view-whatif-saved"]')).toBeNull()
    fireEvent.blur(numberField())
    expect(route).toHaveBeenCalledWith(body(raise.id, 1_500_000))
    expect(route).toHaveBeenCalledOnce()
  })

  it('(b) tries £120k from the labelled Olumi point, reads the stubbed 16.67 months and drops the preview on a stale reply', async () => {
    route.mockReturnValueOnce(Response.json(answer(spend))).mockReturnValueOnce(Response.json({ error: stale }, { status: 409 }))
    useViewStore.setState({ view, sid, status: 'ready' })
    render(renderStress())
    fireEvent.click(screen.getByRole('button', { name: spend.label }))
    expect(numberField()).toHaveAccessibleDescription(spend.unit)
    expect(screen.getByText(`Proposed by Olumi: ${basis}`)).toBeVisible()
    move(120_000)
    expect(network).not.toHaveBeenCalled()
    enter()
    expect(await screen.findByText(bLine)).toBeVisible()
    expect(route).toHaveBeenNthCalledWith(1, body(spend.id, 120_000))
    expect(useViewStore.getState().view).toBe(view)

    move(125_000)
    fireEvent.blur(numberField())
    expect(await screen.findByText(stale)).toBeVisible()
    expect(screen.queryByText(bLine)).toBeNull()
    expect(numberField()).toHaveValue(spend.value)
    expect(useViewStore.getState().view).toBe(view)
  })

  it('(b) offers a number field for the same Olumi point without inventing slider bounds', () => {
    render(renderStress())
    fireEvent.click(screen.getByRole('button', { name: spend.label }))
    expect(numberField()).toHaveValue(spend.value)
    expect(screen.queryByRole('slider')).toBeNull()
    expect(network).not.toHaveBeenCalled()
  })

  it('refuses the same Olumi point if the current card has no visible basis', () => {
    const cards = view.model!.cards.map((card) => card.id === spend.id
      ? { ...card, author: { ...card.author!, title: 'Proposed by Olumi' } } : card)
    render(renderStress({ ...view, model: { ...view.model!, cards } }))
    fireEvent.click(screen.getByRole('button', { name: spend.label }))
    expect(screen.getByText(WORDS.ineligible)).toBeVisible()
    expect(screen.queryByRole('slider')).toBeNull()
    expect(screen.queryByRole('spinbutton')).toBeNull()
    expect(network).not.toHaveBeenCalled()
  })

  it('tries an actual ranged Olumi input using its current card basis and exact bounds', async () => {
    const ranged = source.model!.cards.find((card) => card.id === 'cups_change')!
    const bounds = ranged.figure!.range!
    const a = answer(raise)
    route.mockReturnValue(Response.json({ ...a, variants: [{ ...a.variants[0], size: [], rows: [], facts: [],
      edits: [{ quantity: ranged.id, label: ranged.heading, words: 'Set cups change to −900 cups/month.' }],
    }] }))
    render(<WhatIfSlider view={source} quantity={ranged.id} />)
    expect(screen.getByText(ranged.author!.title)).toBeVisible()
    expect(slider()).toHaveAttribute('min', String(bounds.low))
    expect(slider()).toHaveAttribute('max', String(bounds.high))
    fireEvent.change(slider(), { target: { value: String(bounds.low) } })
    expect(network).not.toHaveBeenCalled()
    fireEvent.keyUp(slider(), { key: 'Home' })
    expect(await screen.findByText('Set cups change to −900 cups/month.')).toBeVisible()
    expect(route).toHaveBeenCalledWith(body(ranged.id, bounds.low))
    expect(route).toHaveBeenCalledOnce()
  })

  it('offers the number field from a visible calculation input when no chance row names a driver', () => {
    const link = { ...view.model!.links[0], from: raise.id, to: 'runway', role: 'input' as const }
    const result: ViewCard = { ...template, id: 'runway', heading: 'Runway', figure: null, author: null }
    const noDriver: View = { ...view, model: { ...view.model!, links: [link],
      cards: [...options.map((option) => ({ ...option, rows: [{ ...row, driver: null }] })), ...figures, result],
    } }
    render(renderStress(noDriver))
    fireEvent.click(screen.getByRole('button', { name: raise.label }))
    expect(numberField()).toHaveValue(raise.value)
    expect(network).not.toHaveBeenCalled()
  })

  it('retargets to a focused visible non-driver with other drivers present', () => {
    const focused: ViewCard = { ...figures[0], id: 'reserve', heading: 'Reserve' }
    const v: View = { ...view, model: { ...view.model!, cards: [...view.model!.cards, focused] } }
    useViewStore.setState({ view: v, sid, status: 'ready' })
    render(renderStress(v))
    act(() => setFocusSubject({ kind: 'card', id: focused.id, cards: [focused.id], source: 'canvas' }))
    expect(screen.getByRole('button', { name: focused.heading })).toHaveAttribute('aria-pressed', 'true')
    expect(numberField()).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: spend.label }))
    expect(numberField()).toHaveValue(spend.value)
  })

  it('(c) refuses an unsupported input using Core’s reason, even with a worked result row', () => {
    const run = view.model!.run!
    const blocked: View = { ...view, model: { ...view.model!,
      cards: [...options, { ...figures[0], figure: { ...figures[0].figure!, range: undefined } }, figures[1]],
      run: { ...run, waits_on: { ...run.waits_on!, items: [{ id: raise.id, text: raise.label, title: unavailable,
        answer: false, unknown: null, edit: null }] } },
    } }
    render(renderStress(blocked))
    expect(screen.queryByRole('slider')).toBeNull()
    expect(screen.getByText(unavailable)).toBeVisible()
    expect(network).not.toHaveBeenCalled()
  })

  it('(c) refuses a ranged Olumi card when the current author title only gives attribution', () => {
    const id = 'cups_change'
    const cards = source.model!.cards.map((card) => card.id === id
      ? { ...card, author: { ...card.author!, title: 'Proposed by Olumi · Named by Priya' } } : card)
    render(<WhatIfSlider view={{ ...source, model: { ...source.model!, cards } }} quantity={id} />)
    expect(screen.getByText(WORDS.ineligible)).toBeVisible()
    expect(screen.queryByRole('slider')).toBeNull()
    expect(network).not.toHaveBeenCalled()
  })

  it('(d) hides a pending-only draft and a chat visual pinned to an older version', () => {
    const draft: View = { ...view, version: null, proposal: (pending as unknown as View).proposal, model: { ...view.model!, edit_base: null } }
    const { rerender } = render(renderStress(draft))
    expect(screen.queryByRole('spinbutton')).toBeNull()
    rerender(<WhatIfSlider view={view} quantity={raise.id} pinnedVersion={base - 1} />)
    expect(screen.queryByRole('spinbutton')).toBeNull()
    rerender(<WhatIfSlider view={view} quantity={raise.id} pinnedVersion={base} pinnedRun="old" currentRun="new" />)
    expect(screen.queryByRole('spinbutton')).toBeNull()
    rerender(<WhatIfSlider view={view} quantity={raise.id} pinnedVersion={base} pinnedRun="new" currentRun="new" />)
    expect(numberField()).toBeVisible()
    expect(network).not.toHaveBeenCalled()
  })

  it('(e) says Core’s stale-base refusal verbatim and drops the previous result', async () => {
    route.mockReturnValueOnce(Response.json(answer(raise))).mockReturnValueOnce(Response.json({ error: stale }, { status: 409 }))
    const first = render(renderStress())
    move(1_500_000)
    enter()
    expect(await screen.findByText(aLine)).toBeVisible()
    first.unmount()
    const second = render(renderStress())
    expect(screen.getByText(aLine)).toBeVisible()
    move(1_450_000)
    fireEvent.blur(numberField())
    expect(await screen.findByText(stale)).toBeVisible()
    second.unmount()
    render(renderStress())
    expect(screen.getByText(stale)).toBeVisible()
    expect(screen.queryByText(aLine)).toBeNull()
    expect(numberField()).toHaveValue(raise.value)
  })

  it('(e) drops a late success when the approved version changes', async () => {
    let settle!: (response: Response) => void
    route.mockImplementation(() => new Promise((resolve) => { settle = resolve }))
    useViewStore.setState({ view, sid, status: 'ready' })
    const first = render(renderStress())
    move(1_500_000)
    enter()
    await waitFor(() => expect(route).toHaveBeenCalledOnce())
    const later = { ...view, version: { ...view.version!, id: base + 1 }, model: { ...view.model!, edit_base: base + 1 } }
    first.unmount()
    useViewStore.setState({ view: later })
    await act(async () => { settle(Response.json(answer(raise))) })
    render(renderStress(later))
    expect(screen.queryByText(aLine)).toBeNull()
    expect(screen.getByText(stale)).toBeVisible()
    expect(numberField()).toHaveValue(raise.value)
  })

  it('(f) Clear restores the original slider position and saved view without another request', async () => {
    route.mockReturnValue(Response.json(answer(raise)))
    useViewStore.setState({ view, sid, status: 'ready' })
    render(renderStress())
    move(1_500_000)
    enter()
    expect(await screen.findByText(aLine)).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: WORDS.clear }))
    expect(screen.queryByText(aLine)).toBeNull()
    expect(numberField()).toHaveValue(raise.value)
    expect(useViewStore.getState().view).toBe(view)
    expect(screen.getAllByText(row.value).some((line) => line.closest('button'))).toBe(true)
    expect(route).toHaveBeenCalledOnce()
  })
})
