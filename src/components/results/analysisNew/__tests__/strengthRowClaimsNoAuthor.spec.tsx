/**
 * ⛔ A BAND MOVE CLAIMS NO AUTHOR (cut 6; DL 0df0e1 6 Oct, parity with CEE S7's truth floor #2647; Science d5 6009444385
 * (ii) / 6009456901 Q2).
 *
 * A link's band moves when Olumi refits a frame (CEE #2631) or a level card re-frames the goal (live since 1 Oct), with
 * no write by the user, and a `strength` row does not record who moved it. Served, every surface read such a row as
 * "You changed how much … : before → after." Measured (Integrator, #2631 S5t): the user stated "Price rise → Customers
 * lost", and the sibling "Customers lost to price rise → monthly recurring revenue" moved moderate → very strong, with
 * its −£300 a month per customer unchanged. Each surface now says the served no-author link sentence:
 *   S1  Compare tab and its copy text (`inputRowText`, the `rerun` frame)
 *   S2  the canvas card (`runChangesSummaryLines`)
 *   S3  the Panel's one sentence (`runDeltaSentence` narrates only a link sentence that starts "You": it says none)
 *   CONTRAST  a `sizing` row → user still says "You gave your own estimate …" (the row itself records that author)
 */
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'
import { RunDeltaSchema, type RunDelta } from '@talchain/schemas/boundary'
import { maximalRunDelta, maximalRunDeltaInputChangeEffect } from '@talchain/schemas/fixtures'
import { buildRunDeltaView } from '../runDeltaView'
import { inputRowText } from '../sections/WhatsChanged'
import { runDeltaSentence } from '../commitmentSynthesis'
import { runChangesSummaryLines } from '../../../../canvas/graphChanges/runChangesSummaryLines'

const LABELS: Record<string, string> = {
  fixture_factor_3: 'Customers lost to price rise',
  fixture_factor_4: 'monthly recurring revenue',
}
const nodeLabel = (id: string) => LABELS[id] ?? null

function parsed(d: unknown): RunDelta {
  const r = RunDeltaSchema.safeParse(d)
  expect(r.success, JSON.stringify(r.success ? null : r.error.issues)).toBe(true)
  return d as RunDelta
}
const withChanges = (changes: unknown[]): RunDelta =>
  parsed({ ...maximalRunDelta, input_coverage: 'partial', input_changes: changes })

/** The refit sibling's row, as CEE's differ states it (field `strength`, band literals). */
const SIBLING_BAND = { ...maximalRunDeltaInputChangeEffect, field: 'strength', before: { raw: 'moderate' }, after: { raw: 'very_strong' } }
const NO_AUTHOR = 'How much Customers lost to price rise changes monthly recurring revenue: moderate → very strong'

describe('a strength row alone claims no author, on every surface that words it', () => {
  const view = buildRunDeltaView(withChanges([SIBLING_BAND]), () => null, nodeLabel)

  it('PRECONDITION: one row, field `strength`, the sibling\'s two ends', () => {
    expect(view.inputs!.rows.map((r) => [r.field, r.linkLabels?.from, r.linkLabels?.to]))
      .toEqual([['strength', 'Customers lost to price rise', 'monthly recurring revenue']])
  })

  it('⭐ S1 Compare tab: the served no-author link sentence, never "You changed"', () => {
    expect(inputRowText(view.inputs!.rows[0])).toBe(NO_AUTHOR)
  })

  it('⭐ S2 canvas card: the same sentence', () => {
    expect(runChangesSummaryLines(view, false, null).changed.map((c) => c.text)).toEqual([NO_AUTHOR])
  })

  it('⭐ S3 Panel sentence: says nothing about the link, so no "you changed"', () => {
    const said = runDeltaSentence(view, { isStale: false }) ?? ''
    expect(said).not.toMatch(/you changed/i)
    expect(said).not.toMatch(/customers lost to price rise/i)
  })
})

describe('CONTRAST: a row that records its author keeps "You"', () => {
  it('sizing → user (with its band move) says "You gave your own estimate …"', () => {
    const sizing = { ...maximalRunDeltaInputChangeEffect, field: 'sizing', before: { raw: 'olumi_estimate' }, after: { raw: 'user' } }
    const view = buildRunDeltaView(withChanges([sizing, SIBLING_BAND]), () => null, nodeLabel)
    expect(view.inputs!.rows.map(inputRowText)).toEqual([
      'You gave your own estimate for how much Customers lost to price rise changes monthly recurring revenue: moderate → very strong.',
    ])
  })
})
