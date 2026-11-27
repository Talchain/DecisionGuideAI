import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setPagePerson } from '../../../../olumiCore/team/api'
import type { View, ViewCard, ViewRow } from '../../../client'
import pending from '../../../fixtures/break-even/break-even-pending.view3.json'
import pricing from '../../../fixtures/core-d4729b77/pricing.view3.json'
import { useViewStore } from '../../../store'
import type { WhatIfAnswer, WhatIfSize } from '../../../whatif'
import { StressTest } from '../StressTest'
import { WhatIfSlider, WHAT_IF_SLIDER_WORDS as WORDS } from '../WhatIfSlider'

vi.mock('../../../reasoning/tabRing', () => ({ pressCard: vi.fn(), ringFrom: vi.fn() }))

// ROW-V-DESIGN.v2 §0 and §4 pin the figures and expected outcomes in prose.
// No captured pre-seed View or Core answers were found in lead-20261125 or the View fixtures.
// This synthetic View adapts the pricing capture's structure and supplies explicit trial
// ranges, which the design's point figures do not specify. Answers are API.md shape stubs.
const source = pricing as unknown as View
const sid = source.id
const base = source.version!.id
const path = `/api/scenarios/${sid}/whatif`
const raise = { id: 'a_raise', label: 'A raise', value: 1_300_000, low: 1_100_000, high: 1_500_000, unit: 'GBP', words: '£1.3m' }
const spend = { id: 'b_spend', label: 'B spend', value: 150_000, low: 120_000, high: 180_000, unit: 'GBP/month', words: '£150k/month' }
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
    range: { low: input.low, high: input.high, likely: input.value, unit: input.unit } },
  author: input === raise ? { by: 'person', text: 'Your figure', title: 'You said £1.3m' }
    : { by: 'olumi', text: 'Olumi’s estimate', title: 'Proposed by Olumi' },
}))
const view: View = {
  ...source,
  model: { ...source.model!, cards: [...options, ...figures] },
  session: { ...source.session, figure_first: {
    offer: null, headings: { theirs: 'Yours', olumi: 'Olumi’s figure', basis: 'Basis', seen: 'Seen', adopted: 'Adopted' },
    given: { view: 5, quantity: spend.id, label: spend.label, at: '',
      theirs: { quantity: spend.id, label: spend.label, text: '£120k/month', title: '£120k/month', unit: spend.unit, version: source.version!.n, value: 120_000 },
      olumi: { text: spend.words, title: spend.words, basis, version: source.version!.n, low: spend.low, high: spend.high, likely: spend.value, unit: spend.unit },
      seen_before: { status: 'unknown', text: 'Unknown' }, adopted: null, note: '',
    },
  } },
}
const aLine = 'A · Run lean: the middle outcome for Runway moves from 12.00 months to 13.85 months.'
const bLine = 'B · Hire faster: the middle outcome for Runway moves from 13.33 months to 16.67 months.'
const stale = 'this what-if was asked on a different version'
const why = 'The middle outcome moves, and the chances shown stay the same.'
const assumption = 'Olumi’s what-if for B spend: £120k to £180k/month.'
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

const route = vi.fn<(body: unknown) => Response | Promise<Response>>()
const network = vi.fn<typeof fetch>()
const renderStress = (v = view) => <StressTest view={v} model={v.model!} />
const slider = () => screen.getByRole('slider', { name: WORDS.label })
const posts = () => network.mock.calls.filter(([, init]) => init?.method === 'POST')
function move(value: number) {
  fireEvent.change(slider(), { target: { value: String(value) } })
}
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
  }
})

describe('V-4 · What-if slider from the approved View', () => {
  it('(a) sends the numeric point only on release and reads A’s runway, status and assumptions verbatim', async () => {
    route.mockReturnValue(Response.json(answer(raise)))
    render(renderStress())
    expect(slider()).toHaveAttribute('min', String(raise.low))
    expect(slider()).toHaveAttribute('max', String(raise.high))
    expect(slider()).toHaveValue(String(raise.value))
    move(1_400_000)
    move(1_500_000)
    expect(network).not.toHaveBeenCalled()
    fireEvent.pointerUp(slider())
    expect(await screen.findByText(aLine)).toBeVisible()
    expect(screen.getByText(assumption)).toBeVisible()
    expect(screen.getByText(why)).toBeVisible()
    expect(screen.getByTestId('view-whatif-track')).toBeVisible()
    expect(route).toHaveBeenCalledWith(body(raise.id, 1_500_000))
    expect(route).toHaveBeenCalledOnce()
  })

  it('(b) tries the labelled B assumption from its visible basis and reads B’s runway on keyboard release', async () => {
    route.mockReturnValue(Response.json(answer(spend)))
    render(renderStress())
    fireEvent.click(screen.getByRole('button', { name: spend.label }))
    expect(screen.getByText(basis, { exact: false })).toBeVisible()
    expect(slider()).toHaveAttribute('min', String(spend.low))
    expect(slider()).toHaveAttribute('max', String(spend.high))
    move(120_000)
    expect(network).not.toHaveBeenCalled()
    fireEvent.keyUp(slider(), { key: 'Home' })
    expect(await screen.findByText(bLine)).toBeVisible()
    expect(route).toHaveBeenCalledWith(body(spend.id, 120_000))
    expect(route).toHaveBeenCalledOnce()
  })

  it('offers the slider from a visible calculation input when no chance row names a driver', () => {
    const link = { ...view.model!.links[0], from: raise.id, to: 'runway', role: 'input' as const }
    const result: ViewCard = { ...template, id: 'runway', heading: 'Runway', figure: null, author: null }
    const noDriver: View = { ...view, model: { ...view.model!, links: [link],
      cards: [...options.map((option) => ({ ...option, rows: [{ ...row, driver: null }] })), ...figures, result],
    } }
    render(renderStress(noDriver))
    fireEvent.click(screen.getByRole('button', { name: raise.label }))
    expect(slider()).toHaveValue(String(raise.value))
    expect(network).not.toHaveBeenCalled()
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

  it('(c) requires a typed basis for an Olumi estimate and refuses a point with no supported span', () => {
    const noBasis = { ...view, session: { ...view.session, figure_first: null } }
    const { rerender } = render(<WhatIfSlider view={noBasis} quantity={spend.id} />)
    expect(screen.getByText(WORDS.ineligible)).toBeVisible()
    expect(screen.queryByRole('slider')).toBeNull()
    const point: View = { ...view, model: { ...view.model!, cards: [
      { ...figures[0], figure: { ...figures[0].figure!, range: { low: raise.value, high: raise.value, likely: raise.value, unit: raise.unit } } },
    ] } }
    rerender(<WhatIfSlider view={point} quantity={raise.id} />)
    expect(screen.getByText(WORDS.ineligible)).toBeVisible()
    expect(screen.queryByRole('slider')).toBeNull()
    expect(network).not.toHaveBeenCalled()
  })

  it('(d) hides a pending-only draft and a chat visual pinned to an older version', () => {
    const draft: View = { ...view, version: null, proposal: (pending as unknown as View).proposal, model: { ...view.model!, edit_base: null } }
    const { rerender } = render(renderStress(draft))
    expect(screen.queryByRole('slider')).toBeNull()
    rerender(<WhatIfSlider view={view} quantity={raise.id} pinnedVersion={base - 1} />)
    expect(screen.queryByRole('slider')).toBeNull()
    expect(network).not.toHaveBeenCalled()
  })

  it('(e) says Core’s stale-base refusal verbatim and drops the previous result', async () => {
    route.mockReturnValueOnce(Response.json(answer(raise))).mockReturnValueOnce(Response.json({ error: stale }, { status: 409 }))
    render(renderStress())
    move(1_500_000)
    fireEvent.pointerUp(slider())
    expect(await screen.findByText(aLine)).toBeVisible()
    move(1_450_000)
    fireEvent.pointerUp(slider())
    expect(await screen.findByText(stale)).toBeVisible()
    expect(screen.queryByText(aLine)).toBeNull()
    expect(slider()).toHaveValue(String(raise.value))
  })

  it('(e) drops a late success when the approved version changes', async () => {
    let settle!: (response: Response) => void
    route.mockImplementation(() => new Promise((resolve) => { settle = resolve }))
    const { rerender } = render(renderStress())
    move(1_500_000)
    fireEvent.pointerUp(slider())
    await waitFor(() => expect(route).toHaveBeenCalledOnce())
    const later = { ...view, version: { ...view.version!, id: base + 1 }, model: { ...view.model!, edit_base: base + 1 } }
    rerender(renderStress(later))
    await act(async () => { settle(Response.json(answer(raise))) })
    expect(screen.queryByText(aLine)).toBeNull()
    expect(screen.getByText(stale)).toBeVisible()
    expect(slider()).toHaveValue(String(raise.value))
  })

  it('(f) Clear restores the original slider position and saved view without another request', async () => {
    route.mockReturnValue(Response.json(answer(raise)))
    useViewStore.setState({ view, sid, status: 'ready' })
    render(renderStress())
    move(1_500_000)
    fireEvent.pointerUp(slider())
    expect(await screen.findByText(aLine)).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: WORDS.clear }))
    expect(screen.queryByText(aLine)).toBeNull()
    expect(slider()).toHaveValue(String(raise.value))
    expect(useViewStore.getState().view).toBe(view)
    expect(screen.getAllByText(row.value).some((line) => line.closest('button'))).toBe(true)
    expect(route).toHaveBeenCalledOnce()
  })
})
