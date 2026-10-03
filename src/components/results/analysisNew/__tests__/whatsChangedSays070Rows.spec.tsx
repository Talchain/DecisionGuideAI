/**
 * Schemas 0.70.0 in the words (52f8cd 5937207590 + 5937225976; RC contract RERUN-EXPLANATION @a00cb9c8; DL "CANVAS words").
 *
 * Rows, each on a CONTRACT-PARSED delta (the package's own 0.70 fixtures where it has one):
 *   W1  a `sizing` row → olumi_accepted says RC's Accept sentence, naming the link's two ends.
 *   W2  RC's one-sentence-per-link: `sizing` → user + `strength` on the SAME link = ONE row, one sentence with the band
 *       before → after. CONTRAST: a strength row on ANOTHER link stays its own sentence.
 *   W3  a `strength` row alone says "You changed how much … : before → after."
 *   W4  `win_probabilities_unavailable: 'prior_withheld'` (the package fixture) → "The options can be compared for the
 *       first time." on the Compare section AND the canvas card. CONTRAST: `no_matched_option` and absent → the
 *       cause-neutral no-pairs line. The first-comparison line is never inferred from an empty array.
 *   W6  every contract `StrengthBand` literal reads in the band table's inline words (52f8cd 5937970750): no underscore,
 *       no literal. Bound to the package's own enum, so a new literal joins the row.
 *   W5  the Panel's one sentence (`runDeltaSentence`, Reasoning tab + chat card) says the same RC words for a sizing row,
 *       never the raw enum. CONTRAST: a factor value row keeps its "changed from … to …" sentence.
 */
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RunDeltaSchema, type RunDelta } from '@talchain/schemas/boundary'
import { maximalRunDelta, maximalRunDeltaPriorWithheld, maximalRunDeltaInputChangeSizing } from '@talchain/schemas/fixtures'
import { buildRunDeltaView } from '../runDeltaView'
import { StrengthBand } from '@talchain/schemas'
import {
  inputRowText,
  noPairsText,
  WhatsChanged,
  WHATS_CHANGED_FIRST_COMPARISON,
  WHATS_CHANGED_NO_PAIRS,
  WHATS_CHANGED_TESTID,
} from '../sections/WhatsChanged'
import { runChangesSummaryLines } from '../../../../canvas/graphChanges/runChangesSummaryLines'
import { runDeltaSentence } from '../commitmentSynthesis'

const LABELS: Record<string, string> = {
  fixture_factor_1: 'Monthly churn',
  fixture_factor_2: 'Sales team size',
  fixture_factor_3: 'New revenue',
}
const nodeLabel = (id: string) => LABELS[id] ?? null

function parsed(d: unknown): RunDelta {
  const r = RunDeltaSchema.safeParse(d)
  expect(r.success, JSON.stringify(r.success ? null : r.error.issues)).toBe(true)
  return d as RunDelta
}
function withChanges(changes: unknown[]): RunDelta {
  return parsed({ ...maximalRunDelta, input_coverage: 'complete', input_changes: changes })
}
const link = (from: string, to: string) => ({ entity_kind: 'link', entity_id: `${from}->${to}`, link: { from, to } })

describe('W1 · an Accept says RC\'s sentence', () => {
  it('the package\'s own sizing fixture (olumi_estimate → olumi_accepted)', () => {
    const view = buildRunDeltaView(withChanges([maximalRunDeltaInputChangeSizing]), () => null, nodeLabel)
    const rows = view.inputs!.rows
    expect(rows).toHaveLength(1)
    expect(rows[0].field).toBe('sizing')
    expect(inputRowText(rows[0])).toBe("You accepted Olumi's estimate for how much Sales team size changes New revenue.")
  })
})

describe('W2 · one sentence per link ("Edit the strength" writes sizing AND strength)', () => {
  const edit = [
    { ...link('fixture_factor_2', 'fixture_factor_3'), field: 'sizing', before: { raw: 'placeholder' }, after: { raw: 'user' }, change: 'changed' },
    { ...link('fixture_factor_2', 'fixture_factor_3'), field: 'strength', before: { raw: 'moderate' }, after: { raw: 'strong' }, change: 'changed' },
  ]
  it('the two rows for one link are ONE row and ONE sentence with the band before → after', () => {
    const view = buildRunDeltaView(withChanges(edit), () => null, nodeLabel)
    const rows = view.inputs!.rows
    expect(rows).toHaveLength(1)
    expect(inputRowText(rows[0])).toBe('You gave your own estimate for how much Sales team size changes New revenue: moderate → strong.')
  })
  it('CONTRAST: a strength row on ANOTHER link stays its own sentence', () => {
    const other = { ...link('fixture_factor_1', 'fixture_factor_3'), field: 'strength', before: { raw: 'slight' }, after: { raw: 'moderate' }, change: 'changed' }
    const view = buildRunDeltaView(withChanges([...edit, other]), () => null, nodeLabel)
    expect(view.inputs!.rows.map(inputRowText)).toEqual([
      'You gave your own estimate for how much Sales team size changes New revenue: moderate → strong.',
      'You changed how much Monthly churn changes New revenue: slight → moderate.',
    ])
  })
})

describe('W3 · a strength change alone', () => {
  it('says "You changed how much … : before → after."', () => {
    const view = buildRunDeltaView(
      withChanges([{ ...link('fixture_factor_1', 'fixture_factor_2'), field: 'strength', before: { raw: 'moderate' }, after: { raw: 'strong' }, change: 'changed' }]),
      () => null,
      nodeLabel,
    )
    expect(inputRowText(view.inputs!.rows[0])).toBe('You changed how much Monthly churn changes Sales team size: moderate → strong.')
  })
})

describe('W4 · the first comparison, only on the TYPED reason', () => {
  it('prior_withheld (the package fixture) → the first-comparison line, in Compare and on the canvas card', () => {
    const view = buildRunDeltaView(parsed(maximalRunDeltaPriorWithheld), () => null, nodeLabel)
    expect(view.winProbabilitiesUnavailable).toBe('prior_withheld')
    expect(noPairsText(view)).toBe(WHATS_CHANGED_FIRST_COMPARISON)
    render(<WhatsChanged view={view} />)
    expect(screen.getByTestId(`${WHATS_CHANGED_TESTID}-no-pairs`).textContent).toBe(WHATS_CHANGED_FIRST_COMPARISON)
    expect(runChangesSummaryLines(view, false, null).movedNote).toBe(WHATS_CHANGED_FIRST_COMPARISON)
    // RX-NO-MOVEMENT-WITHOUT-PRIOR: the line claims no movement.
    expect(WHATS_CHANGED_FIRST_COMPARISON).not.toMatch(/\b(rose|fell|moved|increased|decreased|up from|down from)\b/i)
  })
  it('CONTRAST: no_matched_option and an absent reason both keep the cause-neutral no-pairs line', () => {
    const noMatch = buildRunDeltaView(parsed({ ...maximalRunDeltaPriorWithheld, win_probabilities_unavailable: 'no_matched_option' }), () => null)
    const { win_probabilities_unavailable: _drop, ...rest } = maximalRunDeltaPriorWithheld as Record<string, unknown>
    const absent = buildRunDeltaView(parsed(rest), () => null)
    expect(noPairsText(noMatch)).toBe(WHATS_CHANGED_NO_PAIRS)
    expect(noPairsText(absent)).toBe(WHATS_CHANGED_NO_PAIRS)
    expect(absent.winProbabilitiesUnavailable).toBeNull()
  })
})

describe('W5 · the Panel sentence says the same words', () => {
  it('an Accept → "Since the last run, you accepted Olumi\'s estimate …", no enum', () => {
    const view = buildRunDeltaView(withChanges([maximalRunDeltaInputChangeSizing]), () => null, nodeLabel)
    const said = runDeltaSentence(view, { isStale: false }) ?? ''
    expect(said.startsWith("Since the last run, you accepted Olumi's estimate for how much Sales team size changes New revenue.")).toBe(true)
    expect(said).not.toMatch(/olumi_estimate|olumi_accepted|placeholder|unmarked/)
  })
  it('CONTRAST: a factor value row keeps its "changed from … to …" sentence', () => {
    const view = buildRunDeltaView(
      withChanges([{ entity_kind: 'factor_value', entity_id: 'fixture_factor_1', field: 'value', label_before: 'Monthly churn', label_after: 'Monthly churn', before: { raw: 7, unit: '%' }, after: { raw: 12, unit: '%' }, change: 'changed' }]),
      () => null,
      nodeLabel,
    )
    expect(runDeltaSentence(view, { isStale: false }) ?? '').toMatch(/^Since the last run, Monthly churn changed from 7\s?% to 12\s?%\./)
  })
})

describe('W6 · every strength band literal reads as words (52f8cd 5937970750)', () => {
  const WORDS: Record<string, string> = { very_strong: 'very strong', strong: 'strong', moderate: 'moderate', slight: 'slight' }
  it('the expectation table covers the package enum exactly', () => {
    expect([...StrengthBand.options].sort()).toEqual(Object.keys(WORDS).sort())
  })
  for (const band of StrengthBand.options) {
    it(`${band}: strength alone and the folded own-estimate sentence`, () => {
      const other = band === 'moderate' ? 'strong' : 'moderate'
      const alone = buildRunDeltaView(
        withChanges([{ ...link('fixture_factor_1', 'fixture_factor_2'), field: 'strength', before: { raw: other }, after: { raw: band }, change: 'changed' }]),
        () => null,
        nodeLabel,
      )
      expect(inputRowText(alone.inputs!.rows[0])).toBe(`You changed how much Monthly churn changes Sales team size: ${WORDS[other]} → ${WORDS[band]}.`)
      const folded = buildRunDeltaView(
        withChanges([
          { ...link('fixture_factor_2', 'fixture_factor_3'), field: 'sizing', before: { raw: 'placeholder' }, after: { raw: 'user' }, change: 'changed' },
          { ...link('fixture_factor_2', 'fixture_factor_3'), field: 'strength', before: { raw: band }, after: { raw: other }, change: 'changed' },
        ]),
        () => null,
        nodeLabel,
      )
      const said = inputRowText(folded.inputs!.rows[0])
      expect(said).toBe(`You gave your own estimate for how much Sales team size changes New revenue: ${WORDS[band]} → ${WORDS[other]}.`)
      expect(said).not.toMatch(/_/)
    })
  }
})


describe('saved versions · link wording has neutral historical authorship', () => {
  it('Accept is neutral in versions while the default rerun sentence is unchanged', () => {
    const delta = withChanges([maximalRunDeltaInputChangeSizing])
    const rerun = buildRunDeltaView(delta, () => null, nodeLabel)
    expect(inputRowText(rerun.inputs!.rows[0])).toBe("You accepted Olumi's estimate for how much Sales team size changes New revenue.")
    render(<WhatsChanged view={buildRunDeltaView(delta, () => null, nodeLabel, 'versions')} />)
    const section = screen.getByTestId(WHATS_CHANGED_TESTID)
    expect(section).toHaveTextContent("Olumi's estimate for how much Sales team size changes New revenue was accepted.")
    expect(section).not.toHaveTextContent('You accepted')
  })

  it('a saved user sizing and strength change does not claim the viewer authored it', () => {
    const delta = withChanges([
      { ...link('fixture_factor_2', 'fixture_factor_3'), field: 'sizing', before: { raw: 'placeholder' }, after: { raw: 'user' }, change: 'changed' },
      { ...link('fixture_factor_2', 'fixture_factor_3'), field: 'strength', before: { raw: 'moderate' }, after: { raw: 'strong' }, change: 'changed' },
      { ...link('fixture_factor_1', 'fixture_factor_3'), field: 'strength', before: { raw: 'slight' }, after: { raw: 'moderate' }, change: 'changed' },
    ])
    render(<WhatsChanged view={buildRunDeltaView(delta, () => null, nodeLabel, 'versions')} />)
    const rows = screen.getAllByTestId(`${WHATS_CHANGED_TESTID}-input-row`)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('A user estimate was recorded for how much Sales team size changes New revenue: moderate → strong.')
    expect(rows[1]).toHaveTextContent('The estimate for how much Monthly churn changes New revenue changed: slight → moderate.')
    expect(rows.map((row) => row.textContent).join(' ')).not.toMatch(/\byou(?:r)?\b/i)
  })

  it.each([
    ['placeholder', 'user', 'A user estimate was recorded for how much Sales team size changes New revenue.'],
    ['user', 'placeholder', 'How much Sales team size changes New revenue: a user estimate → not yet sized'],
  ])('neutral sizing without a strength row: %s → %s', (before, after, expected) => {
    const delta = withChanges([
      { ...link('fixture_factor_2', 'fixture_factor_3'), field: 'sizing', before: { raw: before }, after: { raw: after }, change: 'changed' },
    ])
    render(<WhatsChanged view={buildRunDeltaView(delta, () => null, nodeLabel, 'versions')} />)
    const row = screen.getByTestId(`${WHATS_CHANGED_TESTID}-input-row`)
    expect(row).toHaveTextContent(expected)
    expect(row).not.toHaveTextContent(/\byou(?:r)?\b/i)
  })
})
