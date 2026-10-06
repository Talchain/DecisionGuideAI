/**
 * Schemas 0.78.0 in the words (SD-1 cut 6, lease #87 6008093205; reader first, DL 0df0e1 6 Oct).
 *
 * An `effect` row says a link's SIZE moved, in the user's terms: each end is a figure PER a source change, the same per
 * on both ends (contract-refined). Before 0.78.0 this row could not parse (closed `RunInputField`, strict value), and
 * the responseParser would have quarantined the whole delta. Rows, each on a CONTRACT-PARSED delta:
 *   E1  the package's own effect fixture reads as ONE row, both figures with their "per …", in the served generic link
 *       sentence — never a bare "300 → 350" that drops what the figure is per.
 *   E2  no author is claimed: the row does not record who wrote the size, so the sentence never says "You".
 *   E3  the Panel's one sentence claims no author either (it narrates only a link sentence that starts "You").
 *   CONTROL  a `strength` row still says its served "You changed how much … : before → after." sentence.
 */
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'
import { RunDeltaSchema, type RunDelta } from '@talchain/schemas/boundary'
import { maximalRunDelta, maximalRunDeltaInputChangeEffect } from '@talchain/schemas/fixtures'
import { buildRunDeltaView } from '../runDeltaView'
import { inputRowText } from '../sections/WhatsChanged'
import { runDeltaSentence } from '../commitmentSynthesis'

const LABELS: Record<string, string> = {
  fixture_factor_3: 'Customers lost',
  fixture_factor_4: 'Monthly recurring revenue',
}
const nodeLabel = (id: string) => LABELS[id] ?? null

function parsed(d: unknown): RunDelta {
  const r = RunDeltaSchema.safeParse(d)
  expect(r.success, JSON.stringify(r.success ? null : r.error.issues)).toBe(true)
  return d as RunDelta
}
const withChanges = (changes: unknown[]): RunDelta =>
  parsed({ ...maximalRunDelta, input_coverage: 'complete', input_changes: changes })

describe('E1 · an effect row keeps what its figure is per', () => {
  const view = buildRunDeltaView(withChanges([maximalRunDeltaInputChangeEffect]), () => null, nodeLabel)
  const rows = view.inputs!.rows

  it('ONE row, field `effect`, both ends carrying their per', () => {
    expect(rows).toHaveLength(1)
    expect(rows[0].field).toBe('effect')
    expect(rows[0].before).toMatch(/300.* per 1 customer lost$/)
    expect(rows[0].after).toMatch(/350.* per 1 customer lost$/)
  })

  it('the served generic link sentence, with both figures', () => {
    expect(inputRowText(rows[0])).toBe(`How much Customers lost changes Monthly recurring revenue: ${rows[0].before} → ${rows[0].after}`)
  })

  it('E2 · no author is claimed', () => {
    expect(inputRowText(rows[0])).not.toMatch(/\bYou\b/)
  })
})

describe('E3 · the Panel sentence claims no author either', () => {
  it('a link sentence without "You" is not narrated there (served rule): no "you changed", no literal, no bare figure', () => {
    const view = buildRunDeltaView(withChanges([maximalRunDeltaInputChangeEffect]), () => null, nodeLabel)
    const said = runDeltaSentence(view, { isStale: false }) ?? ''
    expect(said).not.toMatch(/you changed how much customers lost/i)
    expect(said).not.toMatch(/\beffect\b/)
    expect(said).not.toMatch(/300\D[^p]*→/)
  })
})

describe('CONTROL · a strength row is unchanged', () => {
  it('still says "You changed how much … : before → after."', () => {
    const strength = { ...maximalRunDeltaInputChangeEffect, field: 'strength', before: { raw: 'moderate' }, after: { raw: 'strong' } }
    const view = buildRunDeltaView(withChanges([strength]), () => null, nodeLabel)
    expect(inputRowText(view.inputs!.rows[0])).toBe('You changed how much Customers lost changes Monthly recurring revenue: moderate → strong.')
  })
})
