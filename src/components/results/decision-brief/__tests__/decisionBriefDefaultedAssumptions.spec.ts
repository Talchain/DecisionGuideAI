/**
 * Decision Brief — `defaulted_assumptions`, category identity, cap and poison-row behaviour.
 *
 * WHY THIS FILE EXISTS. Four defects were found by cross-review and confirmed here at the
 * bytes against real captures:
 *
 *  1. "What this rests on" rendered `key_assumptions`, which is a SUBSET of `top_drivers`
 *     on every capture measured (3 Aug: identical as sets, 3/3; 25 Aug live: 3/3 contained).
 *     A subset can never be a distinct answer, so the two categories showed the same list.
 *     The honest source for "what did the analysis have to assume" is `defaulted_assumptions`,
 *     which carries the PRODUCER'S OWN PROSE and answers a different question.
 *  2. A category emptied completely when the producer exceeded its own declared cap
 *     (`length > max` returned `[]`), so 11 items rendered as zero.
 *  3. One malformed row emptied its whole category, suppressing valid siblings.
 *  4. ⭐ CORRECTED. The row was additionally gated on the ANALYSIS GLOSSARY
 *     (`containsBannedTerm`), which bans ordinary business vocabulary — `variance`,
 *     `intervention`, `blocked`, `win rate`, `graph`, `posterior`, `elasticity`,
 *     `winner`, `recommended`, `confidence score`. Measured against 13 realistic
 *     business factor labels, TEN were withheld with no trace anywhere: the user lost
 *     the honesty disclosure precisely BECAUSE they had named a factor normally.
 *
 *     The gate was a CATEGORY ERROR, and three independent statements of this estate's
 *     own doctrine say so:
 *       - `glossaryCheck.ts`'s header scopes it to "UI-generated analysis copy" and
 *         states "we never rewrite user data, only the generated copy that names it";
 *       - `safeInterpolatedLabel`'s docstring: "The user's original label still appears
 *         verbatim in row titles and inspector views";
 *       - `analysis-hero/__tests__/copyHygiene.spec.tsx`, the scanner spec itself:
 *         "Producer-supplied strings ... are deliberately NOT scanned — they are
 *         rendered as data, never authored here."
 *
 *     The note is PRODUCER PROSE rendered verbatim as data; the label is USER DATA. The
 *     glossary answers "is Olumi authoring jargon or a leader claim in copy it wrote?",
 *     which is a different question from "is this producer sentence safe to render?" —
 *     and the second question is already answered, in full, by the raw-identifier,
 *     length, blank/NUL and `source` guards that remain. Nothing forced the gate: no
 *     spec scans this surface for banned terms, and the one source scanner is scoped to
 *     `src/canvas/components/pre-analysis-v3/`. So it is REMOVED, not narrowed.
 *
 * The rule this file enforces (brief §6): VET the whole rendered join, never REWRITE it.
 * A row whose producer sentence cannot be shown unchanged is WITHHELD, never repaired —
 * substituting a fallback into the producer's sentence would change its meaning. That
 * rule is intact; what changed is which strings count as unshowable.
 */
import { describe, it, expect } from 'vitest'
import { readDecisionBriefViewModel } from '../decisionBriefViewModel'

const BRIEF_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'
const CREATED_AT = '2026-08-25T08:16:20.000Z'

const note = (label: string) =>
  `No starting value was provided for "${label}" — the analysis used a default. `
  + 'Setting a real value or range would make this result more trustworthy.'

const defaulted = (label: string) => ({
  factor_label: label,
  note: note(label),
  source: 'value_defaulted',
  doctrine: 'provisional_doctrine_v0',
})

function brief(extra: Record<string, unknown>) {
  return { version: '1', brief_id: BRIEF_ID, created_at: CREATED_AT, ...extra }
}

describe('defaulted_assumptions reaches the view model', () => {
  it('carries the producer note verbatim, anchored by its factor label', () => {
    const vm = readDecisionBriefViewModel(brief({
      defaulted_assumptions: [defaulted('Available Growth Budget')],
    }))
    expect(vm?.defaultedAssumptions).toEqual([
      { factorLabel: 'Available Growth Budget', note: note('Available Growth Budget') },
    ])
  })

  it('withholds a row whose source is not the producer value_defaulted token', () => {
    const vm = readDecisionBriefViewModel(brief({
      defaulted_assumptions: [
        { ...defaulted('Current ARR'), source: 'something_else' },
        defaulted('B2B Market Demand'),
      ],
    }))
    expect(vm?.defaultedAssumptions.map(d => d.factorLabel)).toEqual(['B2B Market Demand'])
  })

  it('renders nothing for the category when the producer sends an empty list', () => {
    // Measured on the 25 Aug live wire: the key is present and empty on real runs.
    const vm = readDecisionBriefViewModel(brief({
      defaulted_assumptions: [],
      top_drivers: [{ factor_label: 'Churn Trend', sensitivity: 0.4, direction: 'positive' }],
    }))
    expect(vm?.defaultedAssumptions).toEqual([])
  })
})

describe('producer prose safety — vet, never rewrite (brief §6)', () => {
  /**
   * ⭐ THE 13-LABEL CORPUS, drawn from outside this module's head (trap 22): ordinary
   * business vocabulary a real user would type as a factor name. TEN of these were
   * silently withheld before the fix. The assertion binds by IDENTITY — the exact
   * label AND the byte-identical producer sentence — not by a count another row
   * could satisfy.
   */
  const ORDINARY_BUSINESS_LABELS = [
    'Budget Variance', 'Win Rate', 'Recommended Retail Price', 'Price Elasticity',
    'Blocked Pipeline Value', 'Government Intervention Risk', 'Knowledge Graph Coverage',
    'Posterior Demand Estimate', 'Confidence Score Threshold', 'Winner Take All Share',
    'Available Growth Budget', 'Current ARR', 'Churn Trend',
  ] as const

  it.each(ORDINARY_BUSINESS_LABELS)(
    'renders the disclosure for the ordinary factor name %s',
    (label) => {
      const vm = readDecisionBriefViewModel(brief({
        defaulted_assumptions: [defaulted(label)],
      }))
      expect(vm?.defaultedAssumptions).toEqual([{ factorLabel: label, note: note(label) }])
    },
  )

  it('renders a glossary-colliding row ALONGSIDE its siblings, withholding neither', () => {
    const vm = readDecisionBriefViewModel(brief({
      defaulted_assumptions: [defaulted('Budget Variance'), defaulted('Current ARR')],
    }))
    expect(vm?.defaultedAssumptions.map(d => d.factorLabel))
      .toEqual(['Budget Variance', 'Current ARR'])
  })

  /**
   * The no-substitution invariant is UNCHANGED and still load-bearing — it is the
   * reason `safeInterpolatedLabel` is deliberately not used here. What changed is
   * that the row now appears at all: previously this asserted the row was GONE,
   * which cemented the defect. It now proves the stronger property — the producer's
   * sentence reaches the model byte-identically, fallback text nowhere in sight.
   */
  it('never substitutes a fallback into the producer sentence', () => {
    const vm = readDecisionBriefViewModel(brief({
      defaulted_assumptions: [defaulted('Clinical Intervention Cost')],
    }))
    expect(vm?.defaultedAssumptions).toEqual([
      { factorLabel: 'Clinical Intervention Cost', note: note('Clinical Intervention Cost') },
    ])
    const joined = JSON.stringify(vm ?? {})
    expect(joined).not.toContain('this factor')
    // The user's own word survives verbatim rather than being repaired away.
    expect(vm?.defaultedAssumptions[0]?.note).toContain('Clinical Intervention Cost')
  })

  it('preserves typographic quotes, em dashes and CJK in the producer sentence', () => {
    const exotic = 'Δ Demand — “peak” 需要 variance ✅'
    const vm = readDecisionBriefViewModel(brief({
      defaulted_assumptions: [defaulted(exotic)],
    }))
    expect(vm?.defaultedAssumptions[0]?.note).toBe(note(exotic))
  })
})

/**
 * ⭐ THE OTHER DIRECTION. Removing the glossary gate must not weaken the guards that
 * genuinely answer "is this row safe to render?". Each of these must STILL withhold.
 */
describe('the remaining safety guards still withhold', () => {
  it('withholds a row whose LABEL carries a raw identifier', () => {
    const vm = readDecisionBriefViewModel(brief({
      defaulted_assumptions: [
        defaulted('deadbeefcafe1234'),
        defaulted('Current ARR'),
      ],
    }))
    expect(vm?.defaultedAssumptions.map(d => d.factorLabel)).toEqual(['Current ARR'])
  })

  it('withholds a row whose NOTE carries a raw identifier', () => {
    const vm = readDecisionBriefViewModel(brief({
      defaulted_assumptions: [
        { factor_label: 'Current ARR', note: 'Defaulted from gc-3f2504e04f89 upstream.', source: 'value_defaulted' },
        defaulted('Churn Trend'),
      ],
    }))
    expect(vm?.defaultedAssumptions.map(d => d.factorLabel)).toEqual(['Churn Trend'])
  })

  it('withholds an over-length note rather than truncating it', () => {
    const vm = readDecisionBriefViewModel(brief({
      defaulted_assumptions: [
        { factor_label: 'Current ARR', note: 'x'.repeat(601), source: 'value_defaulted' },
        defaulted('Churn Trend'),
      ],
    }))
    expect(vm?.defaultedAssumptions.map(d => d.factorLabel)).toEqual(['Churn Trend'])
    expect(JSON.stringify(vm ?? {})).not.toContain('…')
  })

  it('withholds a row whose source is not the producer value_defaulted token', () => {
    const vm = readDecisionBriefViewModel(brief({
      defaulted_assumptions: [
        { ...defaulted('Budget Variance'), source: 'user_provided' },
        defaulted('Churn Trend'),
      ],
    }))
    expect(vm?.defaultedAssumptions.map(d => d.factorLabel)).toEqual(['Churn Trend'])
  })

  it('never leaks the provenance token into the view model', () => {
    const vm = readDecisionBriefViewModel(brief({
      defaulted_assumptions: [defaulted('Budget Variance')],
    }))
    const joined = JSON.stringify(vm ?? {})
    expect(joined).not.toContain('value_defaulted')
    expect(joined).not.toContain('defaulted_assumptions')
  })
})

describe('cap at the producer maximum truncates, never empties', () => {
  it('renders 10 of 11 key assumptions rather than zero', () => {
    const eleven = Array.from({ length: 11 }, (_, i) => `Assumption ${i + 1}`)
    const vm = readDecisionBriefViewModel(brief({ key_assumptions: eleven }))
    expect(vm?.keyAssumptions).toHaveLength(10)
    expect(vm?.keyAssumptions[0]).toBe('Assumption 1')
  })

  it('renders 5 of 6 top drivers rather than zero', () => {
    const six = Array.from({ length: 6 }, (_, i) => ({
      factor_label: `Driver ${i + 1}`, sensitivity: 1 - i / 10, direction: 'positive' as const,
    }))
    const vm = readDecisionBriefViewModel(brief({ top_drivers: six }))
    expect(vm?.topDrivers.map(d => d.label)).toEqual([
      'Driver 1', 'Driver 2', 'Driver 3', 'Driver 4', 'Driver 5',
    ])
  })
})

describe('one bad row cannot suppress valid siblings', () => {
  it('keeps the valid leading rows of a ranked category and truncates at the first bad one', () => {
    // Ranked data: dropping a middle row would silently re-rank what follows, so the
    // honest response is a prefix, not a filter.
    const vm = readDecisionBriefViewModel(brief({
      what_would_change: ['Demand holds', 'deadbeefcafe1234', 'Costs fall'],
    }))
    expect(vm?.whatWouldChange).toEqual(['Demand holds'])
  })

  it('keeps valid drivers when a later driver row is malformed', () => {
    const vm = readDecisionBriefViewModel(brief({
      top_drivers: [
        { factor_label: 'Churn Trend', sensitivity: 0.9, direction: 'positive' },
        { factor_label: 'Broken', sensitivity: 'nope', direction: 'positive' },
      ],
    }))
    expect(vm?.topDrivers.map(d => d.label)).toEqual(['Churn Trend'])
  })

  /**
   * ⚠ ADDED AFTER A SURVIVING MUTANT. Mutating the null-row `break` to `return []`
   * left the whole suite green, because the only malformed row in the fixture
   * above is ID-SHAPED and is caught by the *second* break. The corpus therefore
   * never exercised the first one. That is a gap in this kit, not an equivalent
   * mutant — a non-string row behaves differently in general — so the case is
   * added rather than the survivor being explained away.
   */
  it('truncates at a non-string row, keeping the valid rows before it', () => {
    const vm = readDecisionBriefViewModel(brief({
      what_would_change: ['Demand holds', 42 as unknown as string, 'Costs fall'],
    }))
    expect(vm?.whatWouldChange).toEqual(['Demand holds'])
  })

  it('truncates at a blank row, keeping the valid rows before it', () => {
    const vm = readDecisionBriefViewModel(brief({
      key_assumptions: ['Demand holds', '   ', 'Costs fall'],
    }))
    expect(vm?.keyAssumptions).toEqual(['Demand holds'])
  })
})

/**
 * ⭐ DEFECT 2 — the cap was applied BEFORE the validity filter, so leading
 * non-qualifying rows starved the category to zero. Pure ordering dependence:
 * the SAME two valid rows rendered 2 when placed first and 0 when placed after
 * ten `user_provided` rows. This is the same "cap empties the list" defect the
 * previous change fixed in `readStringList` and did not fix here.
 *
 * Currently unreachable — all ten captured briefs carry exactly one `source`
 * token — but it arms the moment the producer adds a second, which is precisely
 * how a latent defect ships.
 */
describe('the cap counts qualifying rows, not array positions', () => {
  const tenOtherRows = Array.from({ length: 10 }, (_, i) => ({
    ...defaulted(`Provided ${i + 1}`), source: 'user_provided',
  }))

  it('renders valid rows that sit AFTER a full cap of non-qualifying rows', () => {
    const vm = readDecisionBriefViewModel(brief({
      defaulted_assumptions: [
        ...tenOtherRows,
        defaulted('Available Growth Budget'),
        defaulted('Current ARR'),
      ],
    }))
    expect(vm?.defaultedAssumptions).toEqual([
      { factorLabel: 'Available Growth Budget', note: note('Available Growth Budget') },
      { factorLabel: 'Current ARR', note: note('Current ARR') },
    ])
  })

  it('renders the SAME two rows whether they lead or trail — no ordering dependence', () => {
    const leading = readDecisionBriefViewModel(brief({
      defaulted_assumptions: [
        defaulted('Available Growth Budget'), defaulted('Current ARR'), ...tenOtherRows,
      ],
    }))
    const trailing = readDecisionBriefViewModel(brief({
      defaulted_assumptions: [
        ...tenOtherRows, defaulted('Available Growth Budget'), defaulted('Current ARR'),
      ],
    }))
    expect(trailing?.defaultedAssumptions).toEqual(leading?.defaultedAssumptions)
    expect(trailing?.defaultedAssumptions).toHaveLength(2)
  })

  it('interleaved non-qualifying rows do not consume cap budget', () => {
    const interleaved = Array.from({ length: 12 }, (_, i) => (
      i % 2 === 0
        ? defaulted(`Valid ${i / 2 + 1}`)
        : { ...defaulted(`Other ${i}`), source: 'user_provided' }
    ))
    const vm = readDecisionBriefViewModel(brief({ defaulted_assumptions: interleaved }))
    expect(vm?.defaultedAssumptions.map(d => d.factorLabel))
      .toEqual(['Valid 1', 'Valid 2', 'Valid 3', 'Valid 4', 'Valid 5', 'Valid 6'])
  })

  /** THE OTHER DIRECTION — the cap must still cap. */
  it('still truncates to the producer maximum when all rows qualify', () => {
    const twelve = Array.from({ length: 12 }, (_, i) => defaulted(`Factor ${i + 1}`))
    const vm = readDecisionBriefViewModel(brief({ defaulted_assumptions: twelve }))
    expect(vm?.defaultedAssumptions).toHaveLength(10)
    expect(vm?.defaultedAssumptions.map(d => d.factorLabel))
      .toEqual(Array.from({ length: 10 }, (_, i) => `Factor ${i + 1}`))
  })

  /** A hostile payload must not force unbounded work; the scan is bounded. */
  it('bounds the scan rather than walking an unbounded hostile array', () => {
    const hostile = [
      ...Array.from({ length: 5000 }, () => ({ ...defaulted('Noise'), source: 'user_provided' })),
      defaulted('Never Reached'),
    ]
    const vm = readDecisionBriefViewModel(brief({ defaulted_assumptions: hostile }))
    expect(vm?.defaultedAssumptions ?? []).toEqual([])
  })
})

/**
 * ⭐ DEFECT 3 — a malformed row at INDEX 0 discards an entire ranked category.
 *
 * DECIDED, NOT INCIDENTAL: the prefix `break` is KEPT, at row 0 as everywhere else.
 * The alternative (`continue`) would render row 1 as though it were row 0 — the UI
 * would assert a #1 that is not the producer's #1. That is a fabricated ranking, and
 * this surface's whole design is to withhold rather than to substitute.
 *
 * What settles it is the RENDERER: `BriefGroup` collapses to `PREVIEW_ITEMS = 1`, so
 * the only item most users ever see IS the top-ranked one. A rank shift would land
 * squarely, and invisibly, on that single previewed row. Losing the category is a
 * visible absence; showing a shifted #1 is a confident wrongness.
 *
 * The cost is real and is accepted: two true sentences are lost to one malformed row.
 * It is pinned here so the behaviour is deliberate rather than incidental, and so any
 * future change to `continue` REDs and has to argue with this comment.
 */
describe('a malformed row at index 0 (ranked categories)', () => {
  it('discards the ranked category rather than promoting row 1 into rank 0', () => {
    const vm = readDecisionBriefViewModel(brief({
      what_would_change: [
        { not: 'a string' } as unknown as string,
        'A genuinely useful sentence',
        'And another',
      ],
      top_drivers: [{ factor_label: 'Churn Trend', sensitivity: 0.4, direction: 'positive' }],
    }))
    expect(vm?.whatWouldChange).toEqual([])
    // The sentences are absent entirely — never re-ranked, never paraphrased.
    expect(JSON.stringify(vm ?? {})).not.toContain('A genuinely useful sentence')
  })

  it('discards the ranked category when an ID-shaped row leads it', () => {
    const vm = readDecisionBriefViewModel(brief({
      key_assumptions: ['deadbeefcafe1234', 'Demand holds', 'Costs fall'],
      top_drivers: [{ factor_label: 'Churn Trend', sensitivity: 0.4, direction: 'positive' }],
    }))
    expect(vm?.keyAssumptions).toEqual([])
  })

  /**
   * ⚠ ADDED AFTER A SURVIVING MUTANT (`isRecord` break -> continue, readTopDrivers).
   * The driver case below uses a row that IS a record and merely fails the sensitivity
   * check — so it hits the SECOND break and never exercised the isRecord one. Exactly
   * the gap the previous change hit in `readStringList`, reproduced here in the driver
   * reader. A non-record row behaves differently in general, so the case is added
   * rather than the survivor being explained away.
   */
  it('discards the ranked drivers when the first driver row is not an object at all', () => {
    const vm = readDecisionBriefViewModel(brief({
      top_drivers: [
        null as unknown as Record<string, unknown>,
        { factor_label: 'Churn Trend', sensitivity: 0.9, direction: 'positive' },
      ],
      what_would_change: ['Demand holds'],
    }))
    expect(vm?.topDrivers).toEqual([])
    expect(JSON.stringify(vm ?? {})).not.toContain('Churn Trend')
  })

  it('discards the ranked drivers when the FIRST driver row is malformed', () => {
    const vm = readDecisionBriefViewModel(brief({
      top_drivers: [
        { factor_label: 'Broken', sensitivity: 'nope', direction: 'positive' },
        { factor_label: 'Churn Trend', sensitivity: 0.9, direction: 'positive' },
      ],
      what_would_change: ['Demand holds'],
    }))
    expect(vm?.topDrivers).toEqual([])
    expect(JSON.stringify(vm ?? {})).not.toContain('Churn Trend')
  })

  /**
   * ⭐ THE DELIBERATE CONTRAST. `defaulted_assumptions` is an unordered SET, so it
   * uses `continue` — there is no rank to lie about and each remaining row is
   * independently true. This test is what makes the two semantics a DECISION rather
   * than an inconsistency: flipping either one to match the other REDs here.
   */
  it('does NOT discard the unordered defaulted set when its first row is malformed', () => {
    const vm = readDecisionBriefViewModel(brief({
      defaulted_assumptions: [
        { not: 'a row' } as unknown as Record<string, unknown>,
        defaulted('Available Growth Budget'),
        defaulted('Current ARR'),
      ],
    }))
    expect(vm?.defaultedAssumptions.map(d => d.factorLabel))
      .toEqual(['Available Growth Budget', 'Current ARR'])
  })

  /**
   * ⚠ ALSO ADDED AFTER A SURVIVING MUTANT (`isRecord` continue -> break, defaulted set).
   * The contrast case above leads with `{ not: 'a row' }`, which IS a record — it is
   * skipped by the `source` guard, so the isRecord branch went untested and flipping it
   * to `break` left the suite green. This case leads with a genuine non-record.
   */
  it('does NOT discard the unordered defaulted set when its first row is not an object', () => {
    const vm = readDecisionBriefViewModel(brief({
      defaulted_assumptions: [
        null as unknown as Record<string, unknown>,
        defaulted('Available Growth Budget'),
        defaulted('Current ARR'),
      ],
    }))
    expect(vm?.defaultedAssumptions.map(d => d.factorLabel))
      .toEqual(['Available Growth Budget', 'Current ARR'])
  })

  it('keeps the ranked category intact when NO row is malformed (positive control)', () => {
    const vm = readDecisionBriefViewModel(brief({
      what_would_change: ['A genuinely useful sentence', 'And another'],
    }))
    expect(vm?.whatWouldChange).toEqual(['A genuinely useful sentence', 'And another'])
  })
})
