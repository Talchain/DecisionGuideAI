/**
 * v10 (#/canvas2) What if, as a PREVIEW: the same served what-if, asked and held the v10 way, with NO write path. Bound by
 * identity: the option row by option id, the change-course point by the option it was set for. The edit authority is mocked
 * only to prove it is never reached. Contrast: without the v10 provider the key is the current design, unchanged.
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
import { readFileSync } from 'node:fs'
import { courseTypedIsInvalid, readCoursePoint } from '../V10WhatIf'

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

describe('the change-course point is the person\'s own number', () => {
  it('reads a typed percentage from 0 to 100, and nothing else; anything else is flagged, not corrected', () => {
    expect(readCoursePoint('')).toBeNull()
    expect(readCoursePoint('120')).toBeNull()
    expect(readCoursePoint('30')).toBe(30)
    expect(courseTypedIsInvalid('')).toBe(false)
    expect(courseTypedIsInvalid('30')).toBe(false)
    expect(courseTypedIsInvalid('3o')).toBe(true)
    expect(courseTypedIsInvalid('120')).toBe(true)
  })
})

describe('v10 What if (preview only)', () => {
  it('Try it sends the one held change; the result is marked Not saved, with the person\'s point beside CEE\'s cell and no verdict', async () => {
    v10()
    expect(screen.getByText(/Nothing is saved: to change a figure, edit it on the canvas/)).toBeTruthy()
    expect(screen.getByTestId('what-if-saved-was').textContent).toBe('Saved: 40%')
    expect(screen.getByTestId('what-if-run').textContent).toBe('Try it')
    fireEvent.click(screen.getByTestId('what-if-course-on'))
    fireEvent.change(screen.getByTestId('what-if-course-option'), { target: { value: 'opt_b' } })
    fireEvent.change(screen.getByTestId('what-if-course-pct'), { target: { value: '30' } })
    await tryIt('60')
    expect(runWhatIfMock.mock.calls[0][1]).toEqual({ changes: [{ kind: 'factor_value_edit', target_id: 'fac_price', value: 0.6, raw_value: 60, unit: '%', field: 'value' }], base_graph_hash: 'h1' })
    expect(screen.getByTestId('what-if-not-saved').textContent).toBe('Not saved')
    // Bound by option id: Sell online's what-if cell is CEE's 22%, and the person's point sits beside it.
    expect(screen.getByTestId('what-if-row-opt_b').textContent).toContain('What if: 22%Your change-course point: below 30%')
    expect(screen.getByTestId('what-if-row-opt_a').textContent).not.toContain('change-course point')
    // ⛔ No verdict: no judgement word anywhere in the result.
    expect(screen.getByTestId('what-if-result').textContent).not.toMatch(/Reached|Not reached|can't tell|fallen|crossed|below target/i)
    expect(useCanvasStore.getState().nodes[0]).toBe(PRICE)
  })

  it('with no change-course point set, it says so and invents none', async () => {
    v10()
    await tryIt('60')
    expect(screen.getByTestId('what-if-course-row').textContent).toContain('No change-course point set')
    expect(screen.queryByTestId('what-if-course-point')).toBeNull()
  })

  it('⛔ no write call is reachable: every control is pressed and the edit authority is never called; no keep or send wording', async () => {
    v10()
    await tryIt('60')
    expect(screen.queryByText(/Keep it|Let it go|Sent|Kept|Couldn't keep/)).toBeNull()
    expect(screen.queryByTestId('what-if-keep')).toBeNull()
    fireEvent.click(screen.getByTestId('what-if-clear'))
    await tryIt('55')
    fireEvent.click(screen.getByTestId('what-if-clear'))
    expect(proposeMock).not.toHaveBeenCalled()
    // And by construction: the v10 view imports no edit authority, value editor or system-event sender.
    const imports = readFileSync('src/presentation/V10WhatIf.tsx', 'utf8').split('\n').filter((l) => l.startsWith('import ')).join('\n')
    expect(imports).not.toMatch(/useModelEditAuthority|conversation|NodeValueEditor|valueCommitSettlement|factorValueEdit/)
    expect(imports).toMatch(/whatIfStore/) // contrast: the scan does see imports
  })

  it('"Clear this what-if" only clears the held preview', async () => {
    v10()
    await tryIt('60')
    const nodes = useCanvasStore.getState().nodes
    fireEvent.click(screen.getByTestId('what-if-clear'))
    expect(useWhatIfStore.getState().held).toBeNull()
    expect(screen.queryByTestId('what-if-result')).toBeNull()
    expect(useCanvasStore.getState().nodes).toBe(nodes)
  })

  it('where the run supplies no preview for any option on the canvas, it says so and draws nothing', async () => {
    runWhatIfMock.mockResolvedValue({ ...RAN, options: [{ option_id: 'opt_gone', saved: cell('40%'), what_if: cell('30%'), variation_words: null }] })
    v10()
    fireEvent.change(screen.getByTestId('what-if-value'), { target: { value: '60' } })
    fireEvent.click(screen.getByTestId('what-if-run'))
    await waitFor(() => expect(screen.getByTestId('what-if-no-preview')).toBeTruthy())
    expect(screen.getByTestId('what-if-no-preview').textContent).toBe('No preview from this run.')
    expect(screen.queryByTestId('what-if-row-opt_gone')).toBeNull()
    expect(screen.getByTestId('what-if-result').textContent).not.toMatch(/%\s*$|40%|30%/)
  })

  it('a percentage that is not 0 to 100 shows an error beside the field, is not silently corrected, and blocks Try it', () => {
    v10()
    fireEvent.change(screen.getByTestId('what-if-value'), { target: { value: '60' } })
    fireEvent.click(screen.getByTestId('what-if-course-on'))
    fireEvent.change(screen.getByTestId('what-if-course-pct'), { target: { value: '3o' } })
    expect((screen.getByTestId('what-if-course-pct') as HTMLInputElement).value).toBe('3o')
    expect(screen.getByTestId('what-if-course-error').textContent).toBe('Enter a percentage from 0 to 100.')
    expect((screen.getByTestId('what-if-run') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByTestId('what-if-course-pct'), { target: { value: '30' } })
    expect(screen.queryByTestId('what-if-course-error')).toBeNull()
    expect((screen.getByTestId('what-if-run') as HTMLButtonElement).disabled).toBe(false)
  })

  describe('the change-course point clears', () => {
    const setPoint = () => {
      fireEvent.click(screen.getByTestId('what-if-course-on'))
      fireEvent.change(screen.getByTestId('what-if-course-option'), { target: { value: 'opt_b' } })
      fireEvent.change(screen.getByTestId('what-if-course-pct'), { target: { value: '30' } })
      expect((screen.getByTestId('what-if-course-on') as HTMLInputElement).checked).toBe(true)
    }
    const cleared = () => {
      expect((screen.getByTestId('what-if-course-on') as HTMLInputElement).checked).toBe(false)
      expect((screen.getByTestId('what-if-course-pct') as HTMLInputElement).value).toBe('')
    }

    it('when its option is removed, and it does not move to another option', async () => {
      v10()
      setPoint()
      act(() => { useCanvasStore.setState({ nodes: [PRICE, OPT_A] as never }) })
      cleared()
      act(() => { useCanvasStore.setState({ nodes: [PRICE, OPT_A, OPT_B] as never }) })
      await tryIt('60')
      expect(screen.queryByTestId('what-if-course-point')).toBeNull()
    })

    it('when the model hash changes', () => {
      v10()
      setPoint()
      act(() => { useCanvasStore.setState({ lastServerGraphHash: 'h2' } as never) })
      cleared()
    })

    it('when the scenario switches', () => {
      v10()
      setPoint()
      act(() => { useCanvasStore.setState({ currentScenarioId: 'b7ddf6d0-bbc1-4f12-c990-f1e1d7e1178d' } as never) })
      cleared()
    })
  })

  it('folded, the lens bar line is marked Not saved and offers only "Clear this what-if"', () => {
    act(() => useWhatIfStore.getState().hold({ scenarioId: SID, baseGraphHash: 'h1', nodeId: 'fac_price', label: 'Price rise', saved: 40, whatIf: 60, unit: '%' }))
    v10(true)
    expect(screen.getByTestId('what-if-legend').textContent).toContain('What if Price rise were 60%Not saved')
    expect(screen.queryByText(/Keep it|Let it go/)).toBeNull()
    fireEvent.click(screen.getByTestId('what-if-clear'))
    expect(useWhatIfStore.getState().held).toBeNull()
  })

  it('contrast: the current design has none of this', () => {
    render(<MemoryRouter><WhatIfKey folded={false} /></MemoryRouter>)
    expect(screen.getByText('What-if, nothing saved')).toBeTruthy()
    expect(screen.queryByTestId('what-if-course')).toBeNull()
    expect(screen.queryByTestId('what-if-saved-was')).toBeNull()
  })
})
