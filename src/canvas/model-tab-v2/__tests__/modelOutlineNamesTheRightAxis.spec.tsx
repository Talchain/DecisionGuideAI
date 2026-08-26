/**
 * THE GROUP HEADING COUNTED ONE AXIS AND NAMED THE OTHER.
 *
 * The count is `primaryValue === null` — `getPrimaryValue`, i.e. **`raw_value`
 * is undefined** — "nobody has SUPPLIED a number". Honest and useful, and
 * unchanged by this spec. The SENTENCE said *"N of M have no value yet"*, which
 * is the other question, and it was false.
 *
 * ── MEASURED, NOT IMAGINED ────────────────────────────────────────────────
 * Live signed-in journey `20260826T082826Z-fresh-extended-17c4a0`
 * (UI `d0e24ccc` / CEE `c24bfe3`), persisted graph at the cold re-read:
 *
 *   One-Off Migration and Setup Cost  value 1.3  raw_value 65000  user_set
 *   Sales Rep Adoption Rate           value 0.6  raw_value —      ai_inferred
 *   CRM Annual Licence Cost           value 0.5  raw_value 50000  ai_inferred
 *   CRM Feature Fit for B2B Sales     value —    raw_value —      ai_inferred
 *
 * Two rows had no `raw_value`, so the heading said "2 of 4 have no value yet".
 * **One of them HAS a value — Olumi estimated it at 0.6** and the product had
 * already computed the words (`display_value: "High (0.6)"`). Four inches away
 * the context pack said "one factor has no value", because CEE's `has_value`
 * reads `value`. Neither surface lying; together incoherent — and that
 * incoherence sent an expert lane chasing a regression that did not exist.
 *
 * ⚠ THE TWO PREDICATES STAY SEPARATE. `valueProvenance.ts:389` is explicit:
 * *"NOT THE SAME QUESTION AS `no-value` (trap 21) … named apart on purpose
 * rather than aligned."* This is not an alignment. It is the copy naming the
 * axis it counts, and reading the other from the predicate that already exists.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ModelOutline } from '../ModelOutline'
import type { ModelRow } from '../types'

const row = (over: Partial<ModelRow>): ModelRow =>
  ({
    id: 'n1',
    kind: 'factor',
    group: 'factors',
    label: 'A factor',
    primaryValue: null,
    attention: [],
    editable: true,
    ...over,
  }) as ModelRow

/** Set by the user — has a `raw_value`, so it is NOT counted. */
const setRow = (id: string) =>
  row({ id, label: `Set ${id}`, primaryValue: '£65k', attention: [] })

/** Olumi estimated it: no `raw_value`, but a value the user can confirm. */
const estimatedRow = (id: string) =>
  row({ id, label: `Estimated ${id}`, primaryValue: null, attention: ['no-value', 'unconfirmed-estimate'] })

/** Genuinely nothing: no value on either axis. */
const emptyRow = (id: string) =>
  row({ id, label: `Empty ${id}`, primaryValue: null, attention: ['no-value'] })

function summaryText(rows: ModelRow[]): string | null {
  render(<ModelOutline rows={rows} tier="plain" />)
  const el = screen.queryByTestId('model-group-v2-factors-unknown-summary')
  return el === null ? null : (el.textContent ?? '')
}

describe('the group heading names the axis it counts', () => {
  it('PRECONDITION — the fixture really does reproduce the measured mix', () => {
    // Without this the cases below could pass over rows that are not the shape
    // the live journey found (trap 13b — pin your own precondition).
    const e = estimatedRow('a')
    expect(e.primaryValue).toBeNull()
    expect(e.attention).toContain('unconfirmed-estimate')
    expect(setRow('b').primaryValue).not.toBeNull()
  })

  it('⭐ never says "no value" about a factor Olumi has estimated', () => {
    const out = summaryText([setRow('a'), estimatedRow('b'), setRow('c'), emptyRow('d')])
    expect(out).not.toContain('have no value yet')
    // Exact: the sentence is the whole claim, so containment would miss anything ADDED.
    expect(out).toBe('2 of 4 not set by your team · Olumi estimated 1')
  })

  it('still says "no value yet" when NOTHING has been estimated — the honest case is preserved', () => {
    const out = summaryText([setRow('a'), emptyRow('b'), emptyRow('c')])
    expect(out).toBe('2 of 3 have no value yet')
  })

  it('counts every estimate, not just the first', () => {
    const out = summaryText([estimatedRow('a'), estimatedRow('b'), emptyRow('c')])
    expect(out).toBe('3 of 3 not set by your team · Olumi estimated 2')
  })

  it('THE COUNT IS UNCHANGED — this fix is the sentence, never the arithmetic', () => {
    // The measured shape: 2 of 4 unset. If a later edit "fixes" the count by
    // folding in estimates, this REDs — which is the whole point of the split.
    const out = summaryText([setRow('a'), estimatedRow('b'), setRow('c'), emptyRow('d')])
    expect(out).toMatch(/^2 of 4 /)
  })

  it('renders NOTHING when every row is set — a group states no zero', () => {
    expect(summaryText([setRow('a'), setRow('b')])).toBeNull()
  })
})
