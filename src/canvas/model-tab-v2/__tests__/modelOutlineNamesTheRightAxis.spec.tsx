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
import { toModelRows } from '../adapters'
import type { ModelRow } from '../types'

const row = (over: Partial<ModelRow>): ModelRow =>
  ({
    id: 'n1',
    kind: 'factor',
    group: 'factors',
    label: 'A factor',
    primaryValue: null,
    attention: [],
    provenanceSource: undefined,
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
    expect(out).toBe('1 with no value yet · 1 estimated by Olumi')
  })

  it('still says "no value yet" when NOTHING has been estimated — the honest case is preserved', () => {
    const out = summaryText([setRow('a'), emptyRow('b'), emptyRow('c')])
    expect(out).toBe('2 with no value yet')
  })

  it('counts every estimate, not just the first', () => {
    const out = summaryText([estimatedRow('a'), estimatedRow('b'), emptyRow('c')])
    expect(out).toBe('1 with no value yet · 2 estimated by Olumi')
  })

  it('THE COUNT IS UNCHANGED — this fix is the sentence, never the arithmetic', () => {
    // The measured shape: 2 of 4 unset. If a later edit "fixes" the count by
    // folding in estimates, this REDs — which is the whole point of the split.
    const out = summaryText([setRow('a'), estimatedRow('b'), setRow('c'), emptyRow('d')])
    // The COUNT is now expressed as a disjoint decomposition, so the guard is
    // that the buckets still SUM to the unset population — folding estimates
    // into `unset` would change that total.
    const nums = [...(out ?? '').matchAll(/(\d+)/g)].map(m => Number(m[1]))
    expect(nums.reduce((a, b) => a + b, 0)).toBe(2)
  })

  /*
   * ⛔ THE AUTHORSHIP GATE. The first cut said "not set by your team" about the
   * whole `unset` population. Measured end-to-end: editing a factor that carries
   * `value` with no `raw_value` persists `{value: 0.8, source: 'user'}` — the row
   * comes back `{primaryValue: null, provenanceSource: 'user'}`, so the heading
   * told the user the factor they had JUST TYPED was not set by them.
   *
   * Authorship is now DERIVED from the shared taxonomy, never asserted over the
   * count. A third axis, deliberately not aligned with the other two.
   */
  it('⛔ NEVER tells the user a value THEY set is not theirs', () => {
    const userSet = row({
      id: 'u',
      label: 'User typed this',
      primaryValue: null,
      attention: ['no-value'],
      provenanceSource: 'user',
    })
    const out = summaryText([userSet, emptyRow('b')])
    // ⚠ ASSERTS ONLY THE AUTHORSHIP AXIS. An exact full-string match here would
    // also fail on any head-wording change, making this case indistinguishable
    // from the head guard — measured: two different mutants failed the identical
    // six cases, so the kit proved sensitivity without specificity.
    expect(out).not.toMatch(/not set by your team/i)
    expect(out).toMatch(/\byou set 1\b/)
  })

  it('DISCRIMINATING — a producer value is NOT credited to the user', () => {
    // Without this, "userOwned everything" satisfies the case above while
    // inventing authorship the taxonomy does not support.
    const inferred = row({
      id: 'i',
      label: 'Olumi inferred this',
      primaryValue: null,
      attention: ['no-value'],
      provenanceSource: 'cee_inference',
    })
    const out = summaryText([inferred, emptyRow('b')])
    // Authorship axis only — see the note above.
    expect(out).not.toMatch(/you set/i)
  })

  /*
   * ⭐ THE CROSS-PR GAP (#867 × #866), closed by the HEAD WORDING rather than by
   * widening the count.
   *
   * #867 renders a producer BAND in the value cell ("Olumi: 0.25 to 0.75") for a
   * factor with no numeric `observedState.value`. `factorIsConfirmable` requires
   * a finite value, so such a row is NOT `unconfirmed-estimate` and the estimate
   * clause does not fire. Under the old head that produced "1 of 1 have no value
   * yet" DIRECTLY ABOVE a visible value.
   *
   * Widening the count to `|| estimateText !== undefined` would have been a
   * SECOND answer to "has Olumi estimated this?" — the shape this file refused
   * in the first place. A band is simply not a figure, so the head is true and
   * the cell is true, together.
   */
  it('⭐ a producer BAND does not make the heading claim there is no value', () => {
    const band = row({
      id: 'band',
      label: 'CRM Feature Fit',
      primaryValue: null,
      attention: ['no-value'],
      estimateText: '0.25 to 0.75',
    })
    const out = summaryText([band])
    // HEAD axis only, so this case discriminates a head-wording regression from
    // an authorship one.
    expect(out).not.toMatch(/no value/i)
    expect(out).not.toMatch(/you set/i)
  })

  /*
   * ⭐⭐ THE CROSS-PR INTERACTION, PROVEN AS ONE RENDER RATHER THAN TWO CLAIMS.
   *
   * The heading and the value cell were built in separate PRs and each was
   * reviewed against base in isolation, so neither review could see the pair.
   * Independent adjudication found the gap: the cell renders a producer band for
   * a factor with no numeric value, while the heading's estimate clause requires
   * `factorIsConfirmable`, which needs a finite one — so the old head said
   * "have no value yet" DIRECTLY ABOVE a visible value.
   *
   * This drives the REAL adapter, so it fails if either side regresses, and it
   * asserts the two elements are consistent WITH EACH OTHER rather than each
   * being separately defensible.
   */
  it('⭐⭐ heading and cell do not contradict each other on a band-only factor', () => {
    const rows = toModelRows({
      nodes: [
        {
          id: 'band',
          type: 'factor',
          data: { label: 'CRM Feature Fit', kind: 'factor', display_value: '0.25 to 0.75' },
        },
      ],
      edges: [],
    } as never)

    // PRECONDITION — the real adapter really did produce the shape the gap needs:
    // a band in the cell and NO confirmable estimate for the heading.
    expect(rows[0].estimateText).toBe('0.25 to 0.75')
    expect(rows[0].attention).not.toContain('unconfirmed-estimate')

    render(<ModelOutline rows={rows} tier="plain" />)
    const heading = screen.getByTestId('model-group-v2-factors-unknown-summary').textContent ?? ''
    const cell = screen.getByTestId('model-row-v2-band-value-estimate').textContent ?? ''

    // The cell shows Olumi's band …
    expect(cell).toBe('Olumi: 0.25 to 0.75')
    // … and the heading above it does not deny that a value exists.
    expect(heading).not.toMatch(/no value/i)
    expect(heading).toBe('1 estimated by Olumi')
  })

  /*
   * ⛔⛔ THE THIRD REFUTED HEAD, AND WHY THERE IS NO LONGER A HEAD.
   *
   * `estimateText` is CEE's `display_value` through `readFactorDisplayValue`,
   * gated only on EMPTINESS — it is NOT restricted to bands and qualitative
   * text. The estate's own fixtures carry '£20,000' (11 occurrences), '£30k',
   * '£49', '3 months', '20%', '0.7'. So "without a figure" was false the moment
   * a row rendered "Olumi: £20,000" beneath it.
   *
   * Three heads, three classes each corpus excluded. The population is
   * HETEROGENEOUS, so no adjective can be true of it — which is why this states
   * the composition rather than characterising it.
   */
  it('⛔ a NUMERIC estimate is never called figureless — the third refutation, pinned', () => {
    const numeric = row({
      id: 'n',
      label: 'Annual CRM Licence Cost',
      primaryValue: null,
      attention: ['no-value'],
      estimateText: '£20,000',
    })
    const out = summaryText([numeric])
    expect(out).not.toMatch(/without a figure/i)
    expect(out).not.toMatch(/no value/i)
    expect(out).toBe('1 estimated by Olumi')
  })

  /*
   * ⚠ THE OVERLAP CASE, ADDED AFTER A MUTANT SURVIVED. The first disjointness
   * test used three rows that each satisfied exactly ONE bucket condition, so
   * removing the `userOwned !== true` exclusion from Olumi's bucket — which
   * makes the buckets overlap — changed nothing and passed. A disjointness test
   * whose fixture cannot produce an overlap asserts nothing about disjointness.
   *
   * This row is BOTH user-owned AND carries `estimateText`, which is a real
   * shape: a user can set a value on a factor CEE has also sent display text
   * for. It must be counted ONCE, as theirs.
   */
  it('DISJOINT — a row that satisfies TWO conditions is counted once, as the user\'s', () => {
    const both = row({
      id: 'both',
      label: 'User set, Olumi also has text',
      primaryValue: null,
      attention: ['no-value', 'unconfirmed-estimate'],
      provenanceSource: 'user',
      estimateText: '£20,000',
    })
    const out = summaryText([both, emptyRow('x')])
    expect(out).toBe('1 with no value yet · you set 1')
    // and the buckets still sum to the unset population — not 3 from 2 rows.
    const nums = [...(out ?? '').matchAll(/(\d+)/g)].map(m => Number(m[1]))
    expect(nums.reduce((a, b) => a + b, 0)).toBe(2)
  })

  it('DISJOINT — every unset row lands in exactly one bucket, and they sum', () => {
    // Without this, a row could be counted twice (or dropped) and each clause
    // would still read as true on its own.
    const out = summaryText([
      emptyRow('a'),
      row({ id: 'b', primaryValue: null, attention: ['no-value'], estimateText: '£20,000' }),
      row({ id: 'c', primaryValue: null, attention: ['no-value'], provenanceSource: 'user' }),
      setRow('d'),
    ])
    const nums = [...(out ?? '').matchAll(/(\d+)/g)].map(m => Number(m[1]))
    expect(nums.reduce((a, b) => a + b, 0)).toBe(3)
    expect(out).toBe('1 with no value yet · 1 estimated by Olumi · you set 1')
  })

  it('renders NOTHING when every row is set — a group states no zero', () => {
    expect(summaryText([setRow('a'), setRow('b')])).toBeNull()
  })
})
