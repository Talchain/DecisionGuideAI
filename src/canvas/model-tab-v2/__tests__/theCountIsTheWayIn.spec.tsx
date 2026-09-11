/**
 * ⭐⭐ THE MODEL OUTLINE'S GROUP-HEADING COUNTS NAMED WHAT NEEDED ATTENTION AND
 * OFFERED NOTHING TO PRESS.
 *
 * Seen on the deployed build, every group collapsed on arrival:
 *
 *     Goal 2               · 2 with no value yet
 *     Factors 5            · 4 estimated by Olumi
 *     Outcomes & risks 5   · 5 with no value yet
 *
 * Each clause names a specific, actionable subset of that group's rows. None of
 * them was an act: the reader was told four separate times that something needed
 * their input and given a chevron to the WHOLE list, at which point the subset
 * the heading had just named was gone again.
 *
 * That is the same defect #1491 and #1496 closed on the Reasoning tab — inert
 * prose naming a specific row — arriving on the surface where the model is
 * supposed to be WORKED ON.
 *
 * ── WHAT THIS FILE PINS ─────────────────────────────────────────────────────
 * Clicking a clause OPENS its group and NARROWS it to exactly the rows that
 * clause counts. Pressing it again restores the whole group.
 *
 * ⚠ THE BUCKETS ARE NOT RE-DERIVED HERE. `unsetBucketOf` is the single function
 * `unsetSummary` counts with and the layout filters by, so a clause and the rows
 * it reveals cannot disagree — the count and the filter are one predicate, not
 * two spellings of one (trap 12). The wording is UNTOUCHED: `unsetSummary` took
 * four attempts to make true and this change is about the ACT, not the words.
 *
 * ⚠ WHAT IS NOT HERE, AND WHY. No second value control. `ModelRowView` already
 * carries the Model tab's editor and, since #1451, the no-range notice beside it
 * at the `editing` beat. Importing `FactorValueControl` onto these rows would put
 * a SECOND writer on a row that already has one — the twin this estate is named
 * for. The reader lands on the rows; the row's own editor is the act.
 *
 * ⚠ jsdom PERFORMS NO LAYOUT. Everything below is DOM structure, accessible
 * names and event outcomes. Nothing here claims a pixel.
 */
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../store', () => ({
  useCanvasStore: (sel: (s: unknown) => unknown) => sel({ nodes: [] }),
}))

/**
 * ⚠ ONLY THE COMPONENT IS IMPORTED, DELIBERATELY. A spec that imported the
 * bucket predicate would not COLLECT at pristine, and a file that cannot collect
 * fails for a reason that has nothing to do with the defect — the RED-first
 * signatures below would be unreadable. Every precondition here is stated
 * against the FIXTURE's own fields or against the rendered heading.
 */
import { ModelOutline } from '../ModelOutline'
import type { ModelGroupId, ModelRow } from '../types'

// ── Fixture ──────────────────────────────────────────────────────────────────
// Three disjoint populations, so a mutant that swaps one bucket for another
// changes WHICH rows appear rather than merely how many.

/** Unset, nothing recorded anywhere — the `N with no value yet` bucket. */
const nothing = (id: string, label: string, group: ModelGroupId = 'factors'): ModelRow => ({
  id,
  kind: group === 'factors' ? 'factor' : 'outcome',
  group,
  label,
  primaryValue: null,
  attention: ['no-value'],
  editable: true,
})

/** Unset, but Olumi sent display text — the `N estimated by Olumi` bucket. */
const estimated = (id: string, label: string): ModelRow => ({
  id,
  kind: 'factor',
  group: 'factors',
  label,
  primaryValue: null,
  estimateText: '0.25 to 0.75',
  provenanceSource: 'cee_inference',
  attention: ['no-value'],
  editable: true,
})

/** Has a value. Counted in the group total, in no unset bucket. */
const set = (id: string, label: string, group: ModelGroupId = 'factors'): ModelRow => ({
  id,
  kind: group === 'factors' ? 'factor' : 'outcome',
  group,
  label,
  primaryValue: '60,000',
  provenanceSource: 'user',
  attention: [],
  editable: true,
})

const NO_VALUE_FACTORS = ['fac_lead', 'fac_churn', 'fac_ramp'] as const
const OLUMI_FACTORS = ['fac_fit', 'fac_friction'] as const
const OUTCOME_ROWS = ['out_margin', 'out_slip', 'out_nps'] as const

const ROWS: readonly ModelRow[] = [
  nothing('fac_lead', 'Lead time'),
  nothing('fac_churn', 'Churn'),
  nothing('fac_ramp', 'Ramp time'),
  estimated('fac_fit', 'Feature fit'),
  estimated('fac_friction', 'Adoption friction'),
  set('out_margin', 'Gross margin', 'outcomes-risks'),
  nothing('out_slip', 'Schedule slip', 'outcomes-risks'),
  nothing('out_nps', 'NPS drop', 'outcomes-risks'),
]

/**
 * ⚠ FACTORS CLOSED, OUTCOMES OPEN. The unrelated-section assertion needs a
 * section whose narrowing would be VISIBLE: a closed group hides its rows
 * anyway, so a filter wrongly applied to it would leave no trace and the
 * assertion would pass vacuously (trap 13b).
 */
const renderOutline = () =>
  render(<ModelOutline rows={ROWS} tier="plain" filter="" initiallyClosedGroups={['factors']} />)

const toggle = (group: string) => screen.getByTestId(`model-group-v2-${group}-toggle`)
const summary = (group: string) => screen.getByTestId(`model-group-v2-${group}-unknown-summary`)
const visibleRowIds = (group: ModelGroupId): string[] => {
  const list = screen.queryByTestId(`model-outline-v2-${group}-rows`)
  if (list === null) return []
  /*
   * BOUND BY IDENTITY: each row's own `data-testid` carries its node id. Never
   * by position in the list and never by the label text.
   *
   * ⚠ THE ROW ROOT ONLY. `ModelRowView` stamps ~17 testids of the form
   * `model-row-v2-<id>-<atom>`; the root is the one with no suffix. Every
   * fixture id here is `[a-z_]+`, so a trailing `-` is exactly what separates an
   * atom from the root — asserted by the count check in the caller, which would
   * RED if atoms leaked in.
   */
  return Array.from(list.querySelectorAll('[data-testid]'))
    .map((el) => el.getAttribute('data-testid') ?? '')
    .map((t) => /^model-row-v2-([a-z0-9_]+)$/.exec(t)?.[1])
    .filter((id): id is string => typeof id === 'string')
}

afterEach(cleanup)

// ─────────────────────────────────────────────────────────────────────────────
describe('(a) PRECONDITION — the fixture reproduces the heading the defect is about', () => {
  /**
   * ⚠ PINNED IN-TEST. Every assertion below is about a heading carrying TWO
   * clauses over DISJOINT row sets, next to a second group that also carries
   * one. A fixture that produced one clause, or an empty second group, would let
   * the whole file pass while measuring a state the defect cannot occur in.
   */
  it('the factors heading carries two clauses over disjoint, non-empty buckets', () => {
    renderOutline()
    expect(summary('factors').textContent).toBe('3 with no value yet · 2 estimated by Olumi')

    // The two populations are genuinely DISJOINT in the fixture's own fields —
    // the `unsetSummary` buckets separate an unset row Olumi has spoken about
    // from one nobody has. Stated here so a later fixture edit that collapsed
    // them REDs rather than quietly making every assertion below vacuous.
    const factors = ROWS.filter((r) => r.group === 'factors')
    expect(factors).toHaveLength(5)
    expect(factors.every((r) => r.primaryValue === null)).toBe(true)
    expect(
      factors.filter((r) => r.estimateText === undefined).map((r) => r.id),
    ).toEqual([...NO_VALUE_FACTORS])
    expect(
      factors.filter((r) => r.estimateText !== undefined).map((r) => r.id),
    ).toEqual([...OLUMI_FACTORS])
  })

  it('the unrelated section is OPEN and shows a row a filter would remove', () => {
    renderOutline()
    expect(toggle('outcomes-risks').getAttribute('aria-expanded')).toBe('true')
    // `out_margin` has a value, so it belongs to NO unset bucket — it is the row
    // that disappears if a bucket filter leaks into this group.
    expect(visibleRowIds('outcomes-risks')).toEqual([...OUTCOME_ROWS])
    expect(ROWS.find((r) => r.id === 'out_margin')?.primaryValue).toBe('60,000')
  })

  it('factors starts CLOSED, so "expanded" below is a change and not the resting state', () => {
    renderOutline()
    expect(toggle('factors').getAttribute('aria-expanded')).toBe('false')
    expect(visibleRowIds('factors')).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('(b) the count is an ACT', () => {
  it('⭐ RED-FIRST: "3 with no value yet" is a control, not a label', () => {
    renderOutline()
    const clause = screen.getByRole('button', { name: '3 with no value yet' })
    expect(clause).toBeInTheDocument()
    expect(clause).toBeEnabled()
    // Unpressed at rest: nothing is filtered until the reader asks.
    expect(clause.getAttribute('aria-pressed')).toBe('false')
  })

  it('⭐ RED-FIRST: "2 estimated by Olumi" is a control too', () => {
    renderOutline()
    expect(screen.getByRole('button', { name: '2 estimated by Olumi' })).toBeEnabled()
  })

  it('⛔ a bucket with no rows offers no control — there is no empty clause to press', () => {
    renderOutline()
    // "you set N" is the third clause. No factor row is in that bucket here, so
    // the clause is absent entirely rather than rendered as a zero.
    expect(screen.queryByRole('button', { name: /^you set / })).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('(c) X — the clause reveals ITS OWN rows', () => {
  it('⭐ clicking "3 with no value yet" opens factors and narrows it to exactly those three', async () => {
    const user = userEvent.setup()
    renderOutline()
    await user.click(screen.getByRole('button', { name: '3 with no value yet' }))

    expect(toggle('factors').getAttribute('aria-expanded')).toBe('true')
    // EXACTLY those rows, by node id. Not "at least", not "three of them".
    expect(visibleRowIds('factors')).toEqual([...NO_VALUE_FACTORS])
    for (const id of OLUMI_FACTORS) {
      expect(screen.queryByTestId(`model-row-v2-${id}`)).toBeNull()
    }
    expect(
      screen.getByRole('button', { name: '3 with no value yet' }).getAttribute('aria-pressed'),
    ).toBe('true')
  })

  it('⭐ the OTHER clause reveals the OTHER two — the same act, a different subset', async () => {
    const user = userEvent.setup()
    renderOutline()
    await user.click(screen.getByRole('button', { name: '2 estimated by Olumi' }))

    expect(visibleRowIds('factors')).toEqual([...OLUMI_FACTORS])
    for (const id of NO_VALUE_FACTORS) {
      expect(screen.queryByTestId(`model-row-v2-${id}`)).toBeNull()
    }
  })

  it('pressing it again restores the whole group — the filter is reversible', async () => {
    const user = userEvent.setup()
    renderOutline()
    const press = () => screen.getByRole('button', { name: '3 with no value yet' })
    await user.click(press())
    expect(visibleRowIds('factors')).toHaveLength(3)
    await user.click(press())
    expect(visibleRowIds('factors')).toEqual([...NO_VALUE_FACTORS, ...OLUMI_FACTORS])
    expect(press().getAttribute('aria-pressed')).toBe('false')
  })

  it('collapsing the group clears its filter, so reopening by the chevron shows everything', async () => {
    const user = userEvent.setup()
    renderOutline()
    await user.click(screen.getByRole('button', { name: '3 with no value yet' }))
    await user.click(toggle('factors')) // close
    await user.click(toggle('factors')) // open again
    expect(visibleRowIds('factors')).toEqual([...NO_VALUE_FACTORS, ...OLUMI_FACTORS])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('(d) Y — an unrelated section is untouched', () => {
  it('⭐ clicking the FACTORS clause leaves OUTCOMES & RISKS showing every one of its rows', async () => {
    const user = userEvent.setup()
    renderOutline()
    await user.click(screen.getByRole('button', { name: '3 with no value yet' }))

    // Still open, still complete — including `out_margin`, which is in no bucket.
    expect(toggle('outcomes-risks').getAttribute('aria-expanded')).toBe('true')
    expect(visibleRowIds('outcomes-risks')).toEqual([...OUTCOME_ROWS])
  })

  it("the outcomes clause is that group's own, and presses independently", async () => {
    const user = userEvent.setup()
    renderOutline()
    await user.click(screen.getByRole('button', { name: '2 with no value yet' }))
    expect(visibleRowIds('outcomes-risks')).toEqual(['out_slip', 'out_nps'])
    // Factors was not opened by another group's clause.
    expect(toggle('factors').getAttribute('aria-expanded')).toBe('false')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('(e) the words and the accessible name are UNCHANGED', () => {
  it('the summary still reads exactly what it read before — this change adds no copy', () => {
    renderOutline()
    expect(summary('factors').textContent).toBe('3 with no value yet · 2 estimated by Olumi')
    expect(summary('outcomes-risks').textContent).toBe('2 with no value yet')
  })

  it("the toggle's accessible name still QUOTES the summary span's own string", () => {
    renderOutline()
    const name = toggle('factors').getAttribute('aria-label') ?? ''
    expect(name).toBe('Factors, 5 elements, 3 with no value yet · 2 estimated by Olumi')
    expect(name).toContain(`, ${summary('factors').textContent}`)
  })

  it('⭐ the counts do not change under a pressed clause — a lens, not an edit', async () => {
    /*
     * ⚠ THE CONSTRAINT THIS PINS. The heading reads `headingRows`, not the
     * narrowed `rows`. Read from `rows`, the heading would recount the list it
     * had just filtered: "Factors 5 · 3 with no value yet · 2 estimated by
     * Olumi" collapses to "Factors 3 · 3 with no value yet" on the first press —
     * the total changes, the second clause vanishes, and with it the reader's
     * way to the other subset. The counts are derived and correct; this change
     * makes them actionable, not different.
     */
    const user = userEvent.setup()
    renderOutline()
    await user.click(screen.getByRole('button', { name: '3 with no value yet' }))

    // PRECONDITION: it really did narrow, so the assertions below are about a
    // filtered state rather than a resting one.
    expect(visibleRowIds('factors')).toEqual([...NO_VALUE_FACTORS])

    expect(summary('factors').textContent).toBe('3 with no value yet · 2 estimated by Olumi')
    expect(toggle('factors').getAttribute('aria-label')).toBe(
      'Factors, 5 elements, 3 with no value yet · 2 estimated by Olumi',
    )
    // The other clause is still on screen and still pressable — the way across.
    expect(screen.getByRole('button', { name: '2 estimated by Olumi' })).toBeEnabled()
  })

  it('⛔ the clause controls are NOT nested inside the toggle button', () => {
    // Interactive content inside a button is invalid and unreachable by
    // keyboard in the order a reader expects. The summary keeps its identity by
    // living in THIS group's header container instead.
    renderOutline()
    const clause = screen.getByRole('button', { name: '3 with no value yet' })
    expect(toggle('factors').contains(clause)).toBe(false)
    const header = screen.getByTestId('model-group-heading-v2-factors')
    expect(header.contains(clause)).toBe(true)
    expect(header.contains(toggle('factors'))).toBe(true)
    // IDENTITY, not proximity: this header belongs to the factors section.
    expect(
      within(screen.getByTestId('model-group-v2-factors')).getByTestId(
        'model-group-heading-v2-factors',
      ),
    ).toBe(header)
  })
})
