/**
 * ⭐ CEE #3660 MADE VISIBLE: what the model implies for the quantity nearest an aim with no target.
 *
 * WITHHELD rows use the served bytes verbatim (graph read, CEE 985958f1, 22 Oct 2026, guest scenarios 0ed8cbe0 and
 * bf9ccf15). No served Run had yet COMPUTED one (the DL has that finding), so the computed body follows CEE's tested type
 * (`goal-target/implied-quantity.ts` @9b4aa6dd), with synthetic labels and figures.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { AnalysisStateV1 } from '@talchain/schemas/boundary'

let runCurrent = true
vi.mock('../../../../canvas/state/analysisStateSelector', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, selectRunAffirmedCurrent: () => runCurrent }
})

import { useCanvasStore } from '../../../../canvas/store'
import { applyScenarioAnalysisRead, type ScenarioAnalysisApplyStore } from '../../../../canvas/hydrate/applyScenarioAnalysisRead'
import { readImpliedQuantity, recordImpliedQuantity, useImpliedQuantityStore } from '../../../../canvas/state/storedImpliedQuantity'
import { ImpliedQuantity, IMPLIED_QUANTITY_TEST_ID } from '../ImpliedQuantity'

/** Served, verbatim. */
const SERVED_WITHHELD_NO_QUANTITY = { reason: 'no_sized_quantity_on_every_path', status: 'withheld', version: 1 }
const SERVED_WITHHELD_INCOMPLETE = { reason: 'engine_read_incomplete', status: 'withheld', version: 1 }
/** CEE's computed shape, in the Run's option order: the LOWER median first, on purpose, so a re-sort would show. */
const COMPUTED = {
  version: 1, status: 'computed', node_id: 'volunteers', quantity: 'Volunteers signed up', unit: 'volunteers',
  by_option: { social: { p10: 21.2, p50: 30, p90: 38.9 }, schools: { p10: 27.4, p50: 37.1567, p90: 49 } },
  rests_on_olumi_estimates: true, by_when: 'within 6 weeks',
}

const BLOCK = {
  type: 'analysis_result' as const, summary: 's', leading_option_id: 'schools',
  enrichment: { option_comparison: [
    { id: 'schools', option_id: 'schools', label: 'Schools', option_label: 'Schools', status: 'computed', win_probability: 0.6 },
    { id: 'social', option_id: 'social', label: 'Social', option_label: 'Social', status: 'computed', win_probability: 0.4 },
  ] },
}
const CURRENT = {
  run_state: { kind: 'complete_current', computed_at: '2026-10-22T16:00:00.000Z' },
  readiness: { status: 'ready', blockers: [] }, leader_claim: { permitted: true },
  robustness: {}, usable_for_prose: true, usable_for_chips: true, usable_for_followup: true,
  requires_rerun: false, blocked_unusable: false, contradictions: [],
} as unknown as AnalysisStateV1

/** The cold read leg, as `serverGraphHydration` calls it; `shown` = the report hash already on screen (the dedupe). */
function read(impliedQuantity: unknown, shown: string | null = null): string {
  const resultsComplete = vi.fn()
  const store = { setAnalysisStateV1: vi.fn(), resultsComplete, setLimitVerdicts: vi.fn(), setCurrentReadInputBasis: vi.fn(),
    currentResultsHash: shown, currentScenarioId: 'scn-1' } as unknown as ScenarioAnalysisApplyStore
  applyScenarioAnalysisRead({ analysisState: CURRENT, analysisResult: BLOCK, impliedQuantity, store })
  return (resultsComplete.mock.calls[0]?.[0]?.hash as string | undefined) ?? shown!
}
const held = () => useImpliedQuantityStore.getState().held

const option = (id: string, label: string) => ({ id, type: 'option', position: { x: 0, y: 0 }, data: { label } })
function showRun(hash: string) {
  useCanvasStore.setState({
    nodes: [option('social', 'Social media campaign'), option('schools', 'Partnering with local schools')],
    results: { status: 'complete', hash, report: { model_card: { response_hash: hash } } },
  } as never)
}

beforeEach(() => { runCurrent = true; recordImpliedQuantity(null, null) })
afterEach(() => { cleanup(); useCanvasStore.setState({ nodes: [], results: { status: 'idle', report: null } } as never) })

describe('the read records it under the report it describes', () => {
  it('⭐ the served withheld bytes are read as CEE wrote them', () => {
    expect(readImpliedQuantity(SERVED_WITHHELD_NO_QUANTITY)).toEqual({ status: 'withheld', reason: 'no_sized_quantity_on_every_path' })
    expect(readImpliedQuantity(SERVED_WITHHELD_INCOMPLETE)).toEqual({ status: 'withheld', reason: 'engine_read_incomplete' })
    const hash = read(SERVED_WITHHELD_INCOMPLETE)
    expect(held()).toEqual({ responseHash: hash, value: { status: 'withheld', reason: 'engine_read_incomplete' } })
  })

  it('⭐ recorded even on the re-read of the Run already shown (the turn that ran it does not carry it)', () => {
    const hash = read(null)
    expect(held().value).toBeNull()
    read(COMPUTED, hash)
    expect(held().responseHash).toBe(hash)
    expect(held().value).toMatchObject({ status: 'computed', quantity: 'Volunteers signed up' })
  })

  it('⛔ a body outside CEE\'s shape is no record', () => {
    expect(readImpliedQuantity({ ...COMPUTED, version: 2 })).toBeNull()
    expect(readImpliedQuantity({ ...COMPUTED, unit: '' })).toBeNull()
    expect(readImpliedQuantity({ ...COMPUTED, by_option: { social: { p10: 1, p50: Number.NaN, p90: 3 } } })).toBeNull()
    expect(readImpliedQuantity({ ...COMPUTED, by_option: {} })).toBeNull()
    expect(readImpliedQuantity({ ...COMPUTED, rests_on_olumi_estimates: 'yes' })).toBeNull()
    expect(readImpliedQuantity({ status: 'withheld', version: 1 })).toBeNull()
  })
})

describe('the results panel says it in CEE\'s words', () => {
  it('⭐ the heading, each option in the Run\'s order with its range and median, and whose estimates it rests on', () => {
    showRun('h-1'); recordImpliedQuantity('h-1', COMPUTED)
    render(<ImpliedQuantity />)
    expect(screen.getByTestId('implied-quantity-heading').textContent)
      .toBe('What the model implies for Volunteers signed up within 6 weeks, as the model stands')
    const rows = screen.getAllByRole('listitem').map((li) => li.textContent)
    expect(rows).toEqual([
      'Social media campaign: about 21.2 to 38.9 volunteers (most likely 30)',
      'Partnering with local schools: about 27.4 to 49 volunteers (most likely 37.2)',
    ])
    expect(screen.getByTestId('implied-quantity-olumi').textContent).toBe('Rests on Olumi’s estimates')
    // Model-relative: never a chance, a probability or a winner.
    expect(screen.getByTestId(IMPLIED_QUANTITY_TEST_ID).textContent).not.toMatch(/chance|%|probab|best|winner|recommend/i)
  })

  it('a deadline that is a date reads "by …"; none reads nothing; CEE\'s false says nothing of Olumi', () => {
    showRun('h-2'); recordImpliedQuantity('h-2', { ...COMPUTED, by_when: 'March 2027', rests_on_olumi_estimates: false })
    render(<ImpliedQuantity />)
    expect(screen.getByTestId('implied-quantity-heading').textContent).toContain('Volunteers signed up by March 2027, as')
    expect(screen.queryByTestId('implied-quantity-olumi')).toBeNull()
    cleanup()
    recordImpliedQuantity('h-2', { ...COMPUTED, by_when: null })
    render(<ImpliedQuantity />)
    expect(screen.getByTestId('implied-quantity-heading').textContent).toBe('What the model implies for Volunteers signed up, as the model stands')
  })

  it('⛔ nothing for the served withheld bytes, a Run no longer current, another Run, or an option the canvas lacks', () => {
    showRun('h-3'); recordImpliedQuantity('h-3', SERVED_WITHHELD_NO_QUANTITY)
    render(<ImpliedQuantity />)
    expect(screen.queryByTestId(IMPLIED_QUANTITY_TEST_ID)).toBeNull()
    cleanup()
    recordImpliedQuantity('h-3', COMPUTED); runCurrent = false
    render(<ImpliedQuantity />)
    expect(screen.queryByTestId(IMPLIED_QUANTITY_TEST_ID)).toBeNull()
    cleanup()
    runCurrent = true; recordImpliedQuantity('another-run', COMPUTED)
    render(<ImpliedQuantity />)
    expect(screen.queryByTestId(IMPLIED_QUANTITY_TEST_ID)).toBeNull()
    cleanup()
    recordImpliedQuantity('h-3', { ...COMPUTED, by_option: { ...COMPUTED.by_option, gone: { p10: 1, p50: 2, p90: 3 } } })
    render(<ImpliedQuantity />)
    expect(screen.queryByTestId(IMPLIED_QUANTITY_TEST_ID)).toBeNull()
    // Contrast: the same Run, current, every option on the canvas: shown.
    cleanup()
    recordImpliedQuantity('h-3', COMPUTED)
    render(<ImpliedQuantity />)
    expect(screen.getByTestId(IMPLIED_QUANTITY_TEST_ID)).toBeTruthy()
  })
})
