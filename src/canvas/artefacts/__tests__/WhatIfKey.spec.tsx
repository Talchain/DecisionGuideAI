/**
 * ⭐ WHAT IF (slice 1): one held change, run beside the saved model, NOTHING SAVED.
 *
 * Bound by identity: the factor id and the gesture the saved path itself builds (scale rule), the exact body sent, the
 * option rows by option id with CEE's own words. Contrasts: the canvas model is untouched by a run; a stale or a late
 * answer is never shown.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const runWhatIfMock = vi.fn()
vi.mock('../../../adapters/cee/whatIf', async (orig) => ({
  ...(await orig<typeof import('../../../adapters/cee/whatIf')>()),
  runWhatIf: (...a: unknown[]) => runWhatIfMock(...a),
}))
vi.mock('../../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))

import { useCanvasStore } from '../../store'
import { useWhatIfStore } from '../../stores/whatIfStore'
import { WHAT_IF_COPY, WhatIfKey, whatIfChangeOf, whatIfFactorChoices } from '../WhatIfKey'

const SID = 'a6ccf5cf-aab0-4f01-b889-e0d6c072067c'
const PRICE = { id: 'fac_price', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Price rise', observed_state: { value: 0.4, raw_value: 40, cap: 100, unit: '%' } } }
const STAFF = { id: 'fac_staff', type: 'factor', position: { x: 0, y: 200 }, data: { label: 'Staff', observed_state: { value: 12, raw_value: 12, unit: 'people' } } }
const UNSET = { id: 'fac_unset', type: 'factor', position: { x: 0, y: 400 }, data: { label: 'Unset', observed_state: {} } }
const OPT_A = { id: 'opt_a', type: 'option', position: { x: 300, y: 0 }, data: { label: 'Open on Sundays' } }
const OPT_B = { id: 'opt_b', type: 'option', position: { x: 300, y: 200 }, data: { label: 'Sell online' } }
const NODES = [PRICE, STAFF, UNSET, OPT_A, OPT_B]

const RAN = {
  status: 'ran', paired: true, changesRefused: 0,
  options: [
    { option_id: 'opt_a', saved: { display: '40–55%', provisional: false, not_shown: null }, what_if: { display: '60–70%', provisional: true, not_shown: null },
      variation_words: 'CEE variation sentence A' },
    { option_id: 'opt_b', saved: { display: null, provisional: false, not_shown: 'CEE withheld sentence' }, what_if: { display: '30%', provisional: false, not_shown: null },
      variation_words: null },
  ],
} as const

beforeEach(() => {
  runWhatIfMock.mockReset()
  act(() => {
    useCanvasStore.setState({ nodes: NODES as never, currentScenarioId: SID, lastServerGraphHash: 'h1' } as never)
    useWhatIfStore.getState().clear()
  })
})
afterEach(() => { cleanup() })

describe('the gesture: the saved path\'s own builder and wire adapter (one scale rule)', () => {
  it('a capped % factor goes out as the saved edit would: model-scale value, the typed figure as raw_value, its unit', () => {
    const held = { scenarioId: SID, baseGraphHash: 'h1', nodeId: 'fac_price', label: 'Price rise', saved: 40, whatIf: 60, unit: '%' }
    expect(whatIfChangeOf(held, PRICE.data)).toEqual({ kind: 'factor_value_edit', target_id: 'fac_price', value: 0.6, raw_value: 60, unit: '%', field: 'value' })
  })

  it('choices are the factors whose card shows a value, in the card\'s own figure; a factor with none is not offered', () => {
    expect(whatIfFactorChoices(NODES)).toEqual([
      { id: 'fac_price', label: 'Price rise', saved: 40, unit: '%' },
      { id: 'fac_staff', label: 'Staff', saved: 12, unit: 'people' },
    ])
  })
})

describe('the key', () => {
  it('⭐ run: sends ONE held change for the picked factor with the base hash; shows each option saved beside what-if in CEE\'s words; the model is untouched', async () => {
    runWhatIfMock.mockResolvedValue(RAN)
    const before = useCanvasStore.getState().nodes
    render(<WhatIfKey folded={false} />)
    fireEvent.change(screen.getByTestId('what-if-value'), { target: { value: '60' } })
    fireEvent.click(screen.getByTestId('what-if-run'))
    await waitFor(() => expect(screen.getByTestId('what-if-result')).toBeTruthy())
    expect(runWhatIfMock).toHaveBeenCalledTimes(1)
    const [sid, body] = runWhatIfMock.mock.calls[0]
    expect(sid).toBe(SID)
    expect(body).toEqual({ changes: [{ kind: 'factor_value_edit', target_id: 'fac_price', value: 0.6, raw_value: 60, unit: '%', field: 'value' }], base_graph_hash: 'h1' })
    const a = screen.getByTestId('what-if-row-opt_a').textContent
    expect(a).toContain('Open on Sundays')
    expect(a).toContain('Saved: 40–55%')
    expect(a).toContain('What if: 60–70%Provisional')
    expect(a).toContain('CEE variation sentence A')
    expect(screen.getByTestId('what-if-row-opt_b').textContent).toContain('Saved: CEE withheld sentence')
    expect(screen.queryByTestId('what-if-not-paired')).toBeNull()
    // ⛔ NOTHING SAVED: the canvas model is the same object; the held change lives only in the what-if store.
    expect(useCanvasStore.getState().nodes).toBe(before)
    expect(useWhatIfStore.getState().held).toMatchObject({ nodeId: 'fac_price', saved: 40, whatIf: 60, unit: '%', baseGraphHash: 'h1' })
  })

  it('not paired: says the two results come from different draws', async () => {
    runWhatIfMock.mockResolvedValue({ ...RAN, paired: false })
    render(<WhatIfKey folded={false} />)
    fireEvent.change(screen.getByTestId('what-if-value'), { target: { value: '60' } })
    fireEvent.click(screen.getByTestId('what-if-run'))
    await waitFor(() => expect(screen.getByTestId('what-if-not-paired').textContent).toBe(WHAT_IF_COPY.notPaired))
  })

  it('a stale-base refusal says the model changed; the saved value itself cannot be run', async () => {
    runWhatIfMock.mockResolvedValue({ status: 'refused', reason: 'stale_base' })
    render(<WhatIfKey folded={false} />)
    fireEvent.change(screen.getByTestId('what-if-value'), { target: { value: '40' } })
    expect((screen.getByTestId('what-if-run') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByTestId('what-if-value'), { target: { value: '55' } })
    fireEvent.click(screen.getByTestId('what-if-run'))
    await waitFor(() => expect(screen.getByTestId('what-if-notice').textContent).toBe(WHAT_IF_COPY.staleBase))
  })

  it('⛔ the saved model moving drops the held change; a late answer for it is never shown', async () => {
    let resolve: (v: unknown) => void = () => {}
    runWhatIfMock.mockReturnValue(new Promise((r) => { resolve = r }))
    render(<WhatIfKey folded={false} />)
    fireEvent.change(screen.getByTestId('what-if-value'), { target: { value: '60' } })
    fireEvent.click(screen.getByTestId('what-if-run'))
    await waitFor(() => expect(useWhatIfStore.getState().run.kind).toBe('running'))
    act(() => { useCanvasStore.setState({ lastServerGraphHash: 'h2' } as never) })
    expect(useWhatIfStore.getState().held).toBeNull()
    await act(async () => { resolve(RAN) })
    expect(useWhatIfStore.getState().run.kind).toBe('idle')
    expect(screen.queryByTestId('what-if-result')).toBeNull()
  })

  it('folded, the legend names the held change; leaving the lens discards it', () => {
    act(() => useWhatIfStore.getState().hold({ scenarioId: SID, baseGraphHash: 'h1', nodeId: 'fac_price', label: 'Price rise', saved: 40, whatIf: 60, unit: '%' }))
    const { unmount } = render(<WhatIfKey folded />)
    expect(screen.getByTestId('what-if-legend').textContent).toBe('What if Price rise were 60%? Nothing is saved.')
    unmount()
    expect(useWhatIfStore.getState().held).toBeNull()
  })
})
