/**
 * v10 (#/canvas2) What if: the same served what-if, asked and held the v10 way. Bound by identity: the option row by
 * option id, the change-course state by the figure CEE displayed, and Keep it by the one writer the factor card uses.
 * Contrast: without the v10 provider the key is the current design, unchanged.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const runWhatIfMock = vi.fn()
vi.mock('../../adapters/cee/whatIf', async (orig) => ({
  ...(await orig<typeof import('../../adapters/cee/whatIf')>()),
  runWhatIf: (...a: unknown[]) => runWhatIfMock(...a),
}))
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))
const savedHolder: { current: unknown } = { current: null }
vi.mock('../../canvas/nodes/shared/savedGraph', () => ({ useSavedGraph: () => savedHolder.current }))
const proposeMock = vi.fn()
vi.mock('../../canvas/hooks/useModelEditAuthority', () => ({
  useModelEditAuthority: (id: string | null) => ({ proposeFactorValue: (...a: unknown[]) => proposeMock(id, ...a) }),
}))

import { useCanvasStore } from '../../canvas/store'
import { useWhatIfStore } from '../../canvas/stores/whatIfStore'
import { WhatIfKey } from '../../canvas/artefacts/WhatIfKey'
import { PresentationProvider } from '../v10'
import { courseStateOf, readCoursePoint, readDisplayedPercent } from '../V10WhatIf'

const SID = 'a6ccf5cf-aab0-4f01-b889-e0d6c072067c'
const PRICE = { id: 'fac_price', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Price rise', observed_state: { value: 0.4, raw_value: 40, cap: 100, unit: '%' } } }
const OPT_A = { id: 'opt_a', type: 'option', position: { x: 300, y: 0 }, data: { label: 'Open on Sundays' } }
const OPT_B = { id: 'opt_b', type: 'option', position: { x: 300, y: 200 }, data: { label: 'Sell online' } }
const SAVED = { living_model: { factors: [{ id: 'fac_price' }], aims: [] } }
const cell = (display: string | null) => ({ display, provisional: false, not_shown: display === null ? 'withheld' : null })
const RAN = {
  status: 'ran', paired: true, changesRefused: 0,
  options: [
    { option_id: 'opt_a', saved: cell('40–55%'), what_if: cell('60–70%'), variation_words: null },
    { option_id: 'opt_b', saved: cell('38%'), what_if: cell('22%'), variation_words: null },
  ],
} as const

beforeEach(() => {
  runWhatIfMock.mockReset()
  proposeMock.mockReset()
  savedHolder.current = SAVED
  act(() => {
    useCanvasStore.setState({ nodes: [PRICE, OPT_A, OPT_B] as never, currentScenarioId: SID, lastServerGraphHash: 'h1' } as never)
    useWhatIfStore.getState().clear()
  })
})
afterEach(() => { cleanup() })

const v10 = (folded = false) => render(<MemoryRouter><PresentationProvider value="v10"><WhatIfKey folded={folded} /></PresentationProvider></MemoryRouter>)

async function tryIt(value = '60') {
  runWhatIfMock.mockResolvedValue(RAN)
  fireEvent.change(screen.getByTestId('what-if-value'), { target: { value } })
  fireEvent.click(screen.getByTestId('what-if-run'))
  await waitFor(() => expect(screen.getByTestId('what-if-result')).toBeTruthy())
}

describe('the change-course check reads only the figure CEE displayed', () => {
  it('a single figure is below or not; a range answers only when all of it is on one side; no figure is no answer', () => {
    expect(readDisplayedPercent('30%')).toEqual({ lo: 30, hi: 30 })
    expect(readDisplayedPercent('60–70%')).toEqual({ lo: 60, hi: 70 })
    expect(readDisplayedPercent('about 30%')).toBeNull()
    expect(courseStateOf(cell('22%'), 30)).toBe('reached')
    expect(courseStateOf(cell('30%'), 30)).toBe('not_reached')
    expect(courseStateOf(cell('60–70%'), 30)).toBe('not_reached')
    expect(courseStateOf(cell('10–20%'), 30)).toBe('reached')
    expect(courseStateOf(cell('20–40%'), 30)).toBe('cannot_tell')
    expect(courseStateOf(cell(null), 30)).toBe('no_figure')
    expect(readCoursePoint('')).toBeNull()
    expect(readCoursePoint('120')).toBeNull()
    expect(readCoursePoint('30')).toBe(30)
  })
})

describe('v10 What if', () => {
  it('Try it sends the one held change; the result is marked Not saved, with the change-course point set before it', async () => {
    v10()
    expect(screen.getByText(/Nothing is saved until you keep it/)).toBeTruthy()
    expect(screen.getByTestId('what-if-saved-was').textContent).toBe('Saved: 40%')
    expect(screen.getByTestId('what-if-run').textContent).toBe('Try it')
    fireEvent.click(screen.getByTestId('what-if-course-on'))
    fireEvent.change(screen.getByTestId('what-if-course-option'), { target: { value: 'opt_b' } })
    fireEvent.change(screen.getByTestId('what-if-course-pct'), { target: { value: '30' } })
    await tryIt('60')
    expect(runWhatIfMock.mock.calls[0][1]).toEqual({ changes: [{ kind: 'factor_value_edit', target_id: 'fac_price', value: 0.6, raw_value: 60, unit: '%', field: 'value' }], base_graph_hash: 'h1' })
    expect(screen.getByTestId('what-if-not-saved').textContent).toBe('Not saved')
    // Bound by option id: Sell online's what-if is 22%, below 30.
    expect(screen.getByTestId('what-if-row-opt_b').textContent).toContain('What if: 22%')
    expect(screen.getByTestId('what-if-course-row').textContent).toContain('Change course below 30% for Sell online')
    expect(screen.getByTestId('what-if-course-state').textContent).toBe('Reached')
    expect(screen.getByTestId('what-if-keep-bar').textContent).toContain('You set the change-course point before this result. Keep it to make 60% your figure, or let it go to go back to 40%.')
    expect(useCanvasStore.getState().nodes[0]).toBe(PRICE)
  })

  it('with no change-course point set, it says so and invents none', async () => {
    v10()
    await tryIt('60')
    expect(screen.getByTestId('what-if-course-row').textContent).toContain('No change-course point set')
    expect(screen.queryByTestId('what-if-course-state')).toBeNull()
    expect(screen.getByTestId('what-if-keep-bar').textContent).not.toContain('change-course point before')
  })

  it('Let it go discards the held value and the result; nothing is written', async () => {
    v10()
    await tryIt('60')
    fireEvent.click(screen.getByTestId('what-if-let-go'))
    expect(useWhatIfStore.getState().held).toBeNull()
    expect(screen.queryByTestId('what-if-result')).toBeNull()
    expect(proposeMock).not.toHaveBeenCalled()
  })

  it('Keep it sends the held figure by the saved path\'s own writer, on the held factor, then clears the what-if', async () => {
    proposeMock.mockReturnValue('dispatched')
    v10()
    await tryIt('60')
    fireEvent.click(screen.getByTestId('what-if-keep'))
    expect(proposeMock).toHaveBeenCalledTimes(1)
    expect(proposeMock).toHaveBeenCalledWith('fac_price', 60, undefined)
    expect(useWhatIfStore.getState().held).toBeNull()
    expect(screen.getByTestId('what-if-kept').textContent).toBe('Sent as your figure: Price rise is now 60%. The chat says when it is saved.')
  })

  it('a figure that cannot be sent is not reported as kept', async () => {
    proposeMock.mockReturnValue('not_encodable')
    v10()
    await tryIt('60')
    fireEvent.click(screen.getByTestId('what-if-keep'))
    expect(screen.getByTestId('what-if-kept').textContent).toBe("Couldn't keep it. Nothing was saved.")
  })

  it('folded, the lens bar line is marked Not saved and offers Keep it / Let it go only once there is a result', () => {
    act(() => useWhatIfStore.getState().hold({ scenarioId: SID, baseGraphHash: 'h1', nodeId: 'fac_price', label: 'Price rise', saved: 40, whatIf: 60, unit: '%' }))
    v10(true)
    expect(screen.getByTestId('what-if-legend').textContent).toContain('What if Price rise were 60%Not saved')
    expect(screen.queryByTestId('what-if-keep')).toBeNull()
    act(() => useWhatIfStore.getState().finish(useWhatIfStore.getState().start(), RAN as never))
    expect(screen.getByTestId('what-if-keep')).toBeTruthy()
    expect(screen.getByTestId('what-if-let-go')).toBeTruthy()
  })

  it('contrast: the current design has none of this', () => {
    render(<MemoryRouter><WhatIfKey folded={false} /></MemoryRouter>)
    expect(screen.getByText('What-if, nothing saved')).toBeTruthy()
    expect(screen.queryByTestId('what-if-course')).toBeNull()
    expect(screen.queryByTestId('what-if-saved-was')).toBeNull()
  })
})
