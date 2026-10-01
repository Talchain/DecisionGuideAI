/**
 * SC-24 — "What's changed" says what differed in the INPUTS between the two Runs, in their units, after the result (schemas 0.68.0).
 * Design SC-24 v2 (#84 5914416431): result first → up to two exact input rows + "See all N" → the limit.
 * AIQ 5915390400: the earlier Run is named as earlier; nothing here derives a £ outcome.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { RunDelta } from '@talchain/schemas/boundary'
import { RunDeltaSchema } from '@talchain/schemas/boundary'
import { WhatsChanged, WHATS_CHANGED_TESTID as T } from '../sections/WhatsChanged'
import { buildRunDeltaView } from '../runDeltaView'

const LABELS: Record<string, string> = { opt_60: 'Raise to £60', opt_49: 'Keep £49', fac_price: 'Pro price', fac_churn: 'Monthly churn' }
const label = (id: string) => LABELS[id] ?? null

const PRICE = {
  entity_kind: 'option_setting', entity_id: 'fac_price', option_id: 'opt_60', field: 'value',
  label_before: 'Pro price', label_after: 'Pro price', before: { raw: 59, unit: '£' }, after: { raw: 60, unit: '£' }, change: 'changed',
} as const

const base = {
  attribution_case: 'C5_unattributed',
  pair_provenance: { seed_equal: true, hash_equal: false, builds_equal: 'unknown', n_equal: true },
  leader: { changed: false, noise_verdict: 'not_noise_qualified' },
  win_probabilities: [{ option_id: 'opt_60', prior: 0.41, current: 0.44, noise_verdict: 'not_noise_qualified' }],
  flip_thresholds: [],
  endpoints: { prior: { run_id: 'run-a', computed_at: '2026-09-30T13:02:00.000Z' }, current: { run_id: 'run-b', computed_at: '2026-09-30T13:09:00.000Z' } },
  input_coverage: 'complete',
  input_changes: [PRICE],
}

function view(over: Record<string, unknown> = {}) {
  const delta = { ...base, ...over }
  // The fixture is the CONTRACT's shape, not a hand-made one: it must parse.
  expect(RunDeltaSchema.safeParse(delta).success).toBe(true)
  return buildRunDeltaView(delta as unknown as RunDelta, label, label)
}

afterEach(cleanup)
const WHATS_CHANGED_TESTID_SECTION = () => T

describe('SC-24 · the exact input change, after the result', () => {
  it('£59 → £60 on the option it was made on, in the producer\'s units', () => {
    render(<WhatsChanged view={view()} />)
    const rows = screen.getAllByTestId(`${T}-input-row`)
    expect(rows.map((r) => r.textContent)).toEqual(['Pro price, Raise to £60: £59 → £60'])
  })

  it('RESULT FIRST: the outcome movement renders before the input rows, and the limit after both', () => {
    render(<WhatsChanged view={view()} />)
    const section = screen.getByTestId(T)
    const order = [`${T}-movements`, `${T}-inputs`, `${T}-comparability`].map((id) => screen.getByTestId(id))
    const all = Array.from(section.querySelectorAll('[data-testid]'))
    const idx = order.map((el) => all.indexOf(el))
    expect(idx[0]).toBeLessThan(idx[1])
    expect(idx[1]).toBeLessThan(idx[2])
  })

  it('the earlier Run is named as earlier, by its own time', () => {
    render(<WhatsChanged view={view()} />)
    expect(screen.getByTestId(`${T}-compared-with`).textContent).toMatch(/^Compared with the earlier run at \d\d:\d\d\.$/)
  })

  it('two rows first, then "See all N changes" reveals the producer\'s whole list in its order', () => {
    const churn = { entity_kind: 'factor_value', entity_id: 'fac_churn', field: 'value', label_before: 'Monthly churn', label_after: 'Monthly churn',
      before: { raw: 3.2, unit: '%' }, after: { raw: 3.7, unit: '%' }, change: 'changed' }
    const added = { entity_kind: 'option', entity_id: 'opt_49', field: 'presence', label_after: 'Keep £49', before: null, after: { raw: true }, change: 'added' }
    render(<WhatsChanged view={view({ input_changes: [PRICE, churn, added] })} />)
    expect(screen.getAllByTestId(`${T}-input-row`)).toHaveLength(2)
    fireEvent.click(screen.getByTestId(`${T}-inputs-toggle`))
    expect(screen.getAllByTestId(`${T}-input-row`).map((r) => r.textContent)).toEqual([
      'Pro price, Raise to £60: £59 → £60',
      'Monthly churn: 3.2% → 3.7%',
      'Keep £49 joined the comparison',
    ])
  })

  it('same inputs on both Runs is said as such (complete coverage, [])', () => {
    render(<WhatsChanged view={view({ input_changes: [] })} />)
    expect(screen.getByTestId(`${T}-inputs-unchanged`)).toHaveTextContent('Both runs used the same inputs.')
  })

  it('⛔ a PARTIAL pair with no rows never says "same inputs" — the partial line wins (AIQ 5921719917; served 4f61c322)', () => {
    render(<WhatsChanged view={view({ input_coverage: 'partial', input_changes: [] })} />)
    expect(screen.queryByTestId(`${T}-inputs-unchanged`)).toBeNull()
    expect(screen.getByTestId(WHATS_CHANGED_TESTID_SECTION()).textContent).not.toMatch(/same inputs/i)
    expect(screen.getByTestId(`${T}-inputs-partial`)).toHaveTextContent('Some inputs could not be compared between these two runs.')
  })

  it('a legacy earlier Run says its inputs were not recorded — never "nothing changed"', () => {
    const { input_changes: _drop, endpoints: _e, ...legacy } = base
    const v = buildRunDeltaView({ ...legacy, attribution_case: 'C2_unpaired',
      pair_provenance: { seed_equal: false, hash_equal: false, builds_equal: 'equal', n_equal: true }, input_coverage: 'not_recorded' } as unknown as RunDelta, label, label)
    render(<WhatsChanged view={v} />)
    expect(screen.getByTestId(`${T}-inputs-not-recorded`)).toBeInTheDocument()
    expect(screen.queryByTestId(`${T}-inputs-unchanged`)).toBeNull()
  })

  it('C5 is a refusal to attribute: its limit line is the shared "cannot be established" sentence', () => {
    render(<WhatsChanged view={view()} />)
    expect(screen.getByTestId(`${T}-attribution-limit`).textContent).toMatch(/cannot be established/)
  })

  it('AIQ 5916401270 (binding): a row has no author, so the block says "Changed between the two runs" and never "you"/"your"', () => {
    // The only difference: an approved Olumi starting figure (churn 3% → 2.5%). The user did not type it.
    const OLUMI_STARTING_FIGURE = {
      entity_kind: 'factor_value', entity_id: 'fac_churn', field: 'value',
      label_before: 'Monthly churn', label_after: 'Monthly churn', before: { raw: 3, unit: '%' }, after: { raw: 2.5, unit: '%' }, change: 'changed',
    } as const
    render(<WhatsChanged view={view({ input_changes: [OLUMI_STARTING_FIGURE] })} />)
    expect(screen.getByTestId(`${T}-inputs-heading`)).toHaveTextContent('Changed between the two runs')
    expect(screen.getAllByTestId(`${T}-input-row`).map((r) => r.textContent)).toEqual(['Monthly churn: 3% → 2.5%'])
    expect(screen.getByTestId(T).textContent ?? '').not.toMatch(/\byou(r|'ve)?\b/i)
  })

  it('AIQ 5918248701: a link added or removed says so in words, never "now on" / "now not set"', () => {
    const LINK = (change: 'added' | 'removed') => ({
      entity_kind: 'link', entity_id: 'fac_price->fac_churn', link: { from: 'fac_price', to: 'fac_churn' }, field: 'presence',
      before: change === 'added' ? null : { raw: 'on' }, after: change === 'added' ? { raw: 'on' } : null, change,
    } as const)
    render(<WhatsChanged view={view({ input_changes: [LINK('added')] })} />)
    expect(screen.getAllByTestId(`${T}-input-row`).map((r) => r.textContent)).toEqual(['Link from Pro price to Monthly churn added to the model'])
    cleanup()
    render(<WhatsChanged view={view({ input_changes: [LINK('removed')] })} />)
    expect(screen.getAllByTestId(`${T}-input-row`).map((r) => r.textContent)).toEqual(['Link from Pro price to Monthly churn removed from the model'])
  })

  it('a pre-SC-24 delta renders exactly as before: no input block, no compared-with line', () => {
    const { input_changes: _i, input_coverage: _c, endpoints: _e, ...old } = base
    render(<WhatsChanged view={buildRunDeltaView({ ...old, attribution_case: 'C2_unpaired',
      pair_provenance: { seed_equal: false, hash_equal: false, builds_equal: 'equal', n_equal: true } } as unknown as RunDelta, label, label)} />)
    expect(screen.queryByTestId(`${T}-inputs`)).toBeNull()
    expect(screen.queryByTestId(`${T}-compared-with`)).toBeNull()
  })
})
