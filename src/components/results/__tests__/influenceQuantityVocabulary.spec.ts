/**
 * THE TWO QUANTITIES ARE NAMED APART, AND THE PER-RUN BASIS IS DISCLOSED.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DEFECT
 * ═══════════════════════════════════════════════════════════════════════════
 * `influenceBasisNoun` returns 'Relative influence' for BOTH stamped bases, and
 * `influencePillAriaLabel` / `influenceBarAriaLabel` make the same collapse.
 * That is CORRECT about scale: both bases are set-relative normalisations, and
 * #1228 fixed a real falsehood by saying so. It is SILENT about quantity, and
 * `influenceBasisNoun`'s own docblock states the ruling it then does not carry:
 * "The SCALE is shared; the QUANTITY is not."
 *
 * Meanwhile `selectDriverDisplayModel` picks the basis PER RUN, all or nothing
 * (`factors.every(...)`), and the top row prints 100% by construction on both.
 * So the same "100%" beside the same factor name means one thing on one run and
 * a different thing on the next, with nothing on screen distinguishing them.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THE DISTINCTION IS MATERIAL — MEASURED, NOT ARGUED
 * ═══════════════════════════════════════════════════════════════════════════
 * The sweeps below are DERIVED from the JSON corpus under `src/` at test time,
 * so they RED if the corpus moves rather than certifying a prose sentence. What
 * they measured at `80bacf36`:
 *
 *   · 123 factor rows carry `influence_score`. It EQUALS the magnitude chain's
 *     `elasticity` on 57 and DIVERGES on 41 (25 carry no `elasticity`).
 *   · The divergences are the trust cases. `live-influence-score-one-2026-08-23
 *     .json`, a real staging response, carries "Monthly Payroll Burn" at
 *     `influence_score: 1` with `elasticity: 0` — the producer's demoted lever,
 *     top-ranked on one quantity and bottom-ranked on the other.
 *   · The producer ships BOTH ORDERINGS and they disagree: of the 95 rows
 *     carrying `importance_rank` and `influence_rank`, they differ on 55.
 *   · `importance_basis` reads `"graph_structural"` on 67 of 67 rows carrying
 *     it, with no other value anywhere in the corpus. That producer stamp is
 *     the evidence for the word "structural". It is READ as of this branch, and
 *     its scope is settled at PLoT `d37c8cfd` — see the final describe block.
 *
 * ⚠ THE ASSERTIONS ARE WRITTEN AGAINST THE PROPERTY, NOT THE COUNT, wherever a
 * count would go stale on an unrelated fixture landing (CLAUDE.md 12b: a control
 * pinned to "current" decays into a tautology). Where an exact figure IS pinned
 * it is pinned as a floor with the reason stated, so a corpus that grows stays
 * green and a corpus that loses the property REDs.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  HANDLED_IMPORTANCE_BASES,
  IMPORTANCE_BASIS_GRAPH_STRUCTURAL,
  INFLUENCE_QUANTITY_BY_BASIS,
  importanceBasisTrust,
  influenceQuantity,
  influenceQuantityForRun,
  influenceQuantityRunDisclosure,
  influenceQuantityRunDisclosureForRun,
} from '../influenceScaleCopy'
import {
  selectDriverDisplayModel,
  type DriverDisplayProvenance,
} from '../driverDisplayModel'

const SRC_ROOT = join(__dirname, '..', '..', '..')

/** Every `*.json` under `src/`, walked rather than listed (no hand-kept mirror). */
function jsonFilesUnderSrc(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) jsonFilesUnderSrc(full, out)
    else if (entry.isFile() && entry.name.endsWith('.json')) out.push(full)
  }
  return out
}

/** Every object anywhere in the corpus that looks like a factor-sensitivity row. */
function factorRows(): Array<Record<string, unknown>> {
  const rows: Array<Record<string, unknown>> = []
  for (const file of jsonFilesUnderSrc(SRC_ROOT)) {
    let parsed: unknown
    try {
      parsed = JSON.parse(readFileSync(file, 'utf8'))
    } catch {
      continue
    }
    const visit = (node: unknown): void => {
      if (Array.isArray(node)) {
        for (const child of node) visit(child)
        return
      }
      if (node !== null && typeof node === 'object') {
        const obj = node as Record<string, unknown>
        if ('factor_id' in obj && 'influence_score' in obj) rows.push(obj)
        for (const child of Object.values(obj)) visit(child)
      }
    }
    visit(parsed)
  }
  return rows
}

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null

describe('influence quantity vocabulary — the two quantities are named apart', () => {
  /**
   * ⚠ THE POSITIVE CONTROL IS THE LOAD-BEARING PART (CLAUDE.md trap 13). Every
   * distinctness assertion below would pass on empty strings, so prove first
   * that the vocabulary is real copy.
   */
  it('POSITIVE CONTROL: the vocabulary is real, non-empty copy on every basis', () => {
    const entries = Object.entries(INFLUENCE_QUANTITY_BY_BASIS)
    expect(entries.length).toBeGreaterThanOrEqual(2)
    for (const [basis, quantity] of entries) {
      for (const field of ['noun', 'gloss', 'runDisclosure'] as const) {
        expect(quantity[field], `${basis}.${field} must be real copy`).toBeTruthy()
        expect(quantity[field].length, `${basis}.${field} must be a sentence`).toBeGreaterThan(10)
      }
    }
  })

  /**
   * ⭐ TOTALITY, DERIVED FROM THE PRODUCER RATHER THAN FROM A LIST.
   *
   * A union type cannot be enumerated at runtime, so a hand-written array of
   * provenances here would be exactly the mirror this vocabulary exists to
   * abolish. Instead the real policy function is DRIVEN until it has emitted
   * every provenance it can emit, and the record must have an entry for each.
   * A third basis added to `selectDriverDisplayModel` therefore REDs here even
   * though no one edited this file.
   */
  it('has an entry for every provenance the display policy can actually emit', () => {
    const emitted = new Set<DriverDisplayProvenance>()
    // Complete producer coverage -> the producer basis.
    for (const entry of selectDriverDisplayModel([
      { key: 'a', influenceScore: 1, rawElasticity: 0.4 },
      { key: 'b', influenceScore: 0.5, rawElasticity: 0.2 },
    ]).values()) {
      emitted.add(entry.provenance)
    }
    // One factor short of complete coverage -> the whole set falls back.
    for (const entry of selectDriverDisplayModel([
      { key: 'a', influenceScore: 1, rawElasticity: 0.4 },
      { key: 'b', influenceScore: null, rawElasticity: 0.2 },
    ]).values()) {
      emitted.add(entry.provenance)
    }
    // The control: the drive above must have produced BOTH, or the totality
    // assertion below is vacuous (an instrument that saw one basis cannot
    // certify coverage of two).
    expect(emitted.size).toBe(2)
    for (const provenance of emitted) {
      expect(
        INFLUENCE_QUANTITY_BY_BASIS[provenance],
        `no quantity named for provenance ${provenance}`,
      ).toBeTruthy()
    }
  })

  /**
   * ⭐⭐ THE DISCRIMINATING PAIR, BOUND BY IDENTITY.
   *
   * Distinctness alone is not enough: two different strings could still be
   * attached to the wrong bases. So each assertion names the BASIS KEY it is
   * about, and asserts the string that basis returns — never "some string in
   * the record contains 'structural'", which a swap would satisfy.
   *
   * This is the shape #1221's `noRunProvenance` control used on
   * `INFLUENCE_EXPLANATION_*`, and it caught a real over-reach there: a lane
   * aliased the two constants together and the control REDded. Aliasing these
   * two is the single most likely way this vocabulary gets undone.
   */
  it('names a DIFFERENT quantity for each basis, bound to the basis by identity', () => {
    const producer = INFLUENCE_QUANTITY_BY_BASIS.influence_score
    const fallback = INFLUENCE_QUANTITY_BY_BASIS.normalised_elasticity

    expect(producer.noun).not.toBe(fallback.noun)
    expect(producer.gloss).not.toBe(fallback.gloss)
    expect(producer.runDisclosure).not.toBe(fallback.runDisclosure)

    // Bound by key, not by predicate: the producer basis is the structural one.
    expect(producer.noun.toLowerCase()).toContain('structural')
    expect(producer.runDisclosure.toLowerCase()).toContain('structural influence')
    // ...and the fallback basis is the sensitivity one, which must NOT claim to
    // be structural. A swap flips both of these, which one alone would miss.
    expect(fallback.noun.toLowerCase()).not.toContain('structural')
    expect(fallback.noun.toLowerCase()).toContain('sensitivity')
  })

  /**
   * The fallback basis's disclosure has to say WHY the run is on it, because
   * "these are sensitivity" without the reason reads as a choice the product
   * made about these factors. It is not: it is the producer failing to supply a
   * score for EVERY factor, which is a fact about the run.
   */
  it("the fallback disclosure states the producer condition that caused it", () => {
    const fallback = INFLUENCE_QUANTITY_BY_BASIS.normalised_elasticity.runDisclosure.toLowerCase()
    expect(fallback).toContain('every factor')
    expect(fallback).toContain('not have')
  })

  /**
   * ⚠ NO STRING MAY IMPLY THE FIGURE MEANS THE SAME THING FROM ONE RUN TO THE
   * NEXT. The basis is per-run and all-or-nothing, so a definitional sentence
   * ("influence is ...") would be false half the time. Every disclosure is
   * scoped to the figures on screen.
   */
  it('no disclosure defines "influence" as a run-invariant quantity', () => {
    for (const [basis, quantity] of Object.entries(INFLUENCE_QUANTITY_BY_BASIS)) {
      expect(
        quantity.runDisclosure.toLowerCase(),
        `${basis}.runDisclosure asserts a stable cross-run meaning`,
      ).not.toMatch(/\binfluence (is|means) \b/)
      expect(quantity.runDisclosure.toLowerCase()).toContain('these show')
    }
  })

  it('fails closed: an unstamped basis names no quantity at all', () => {
    // Null rather than a third generic noun. There is no honest third name for
    // a quantity we do not know, and inventing one is the fabrication this
    // module has been corrected for twice.
    expect(influenceQuantity(null)).toBeNull()
    expect(influenceQuantity(undefined)).toBeNull()
    expect(influenceQuantityRunDisclosure(null)).toBeNull()
    // Control: the accessor is not simply always-null.
    expect(influenceQuantityRunDisclosure('influence_score')).toBe(
      INFLUENCE_QUANTITY_BY_BASIS.influence_score.runDisclosure,
    )
    expect(influenceQuantityRunDisclosure('normalised_elasticity')).toBe(
      INFLUENCE_QUANTITY_BY_BASIS.normalised_elasticity.runDisclosure,
    )
  })
})

describe('influence quantity vocabulary — the corpus says the two quantities differ', () => {
  const rows = factorRows()

  it('POSITIVE CONTROL: the sweep found real factor rows', () => {
    // Without this every measurement below would pass on an empty corpus — an
    // absence probe pointed at nothing.
    expect(rows.length).toBeGreaterThanOrEqual(100)
  })

  /**
   * The load-bearing measurement. If `influence_score` and the magnitude chain
   * agreed everywhere, the whole vocabulary would be ceremony over one number.
   * They do not: they diverge on a third of the rows that carry both.
   */
  it('influence_score and the magnitude chain DIVERGE on real captures', () => {
    let both = 0
    let diverged = 0
    for (const row of rows) {
      const influence = num(row.influence_score)
      const elasticity = num(row.elasticity)
      if (influence === null || elasticity === null) continue
      both += 1
      if (Math.abs(influence - elasticity) > 1e-12) diverged += 1
    }
    expect(both, 'no row carries both fields — the probe saw nothing').toBeGreaterThanOrEqual(90)
    // Floor, not an exact count: a fixture landing must not RED this, but the
    // property vanishing must. Measured 41 at 80bacf36.
    expect(diverged).toBeGreaterThanOrEqual(20)
  })

  /**
   * The trust case, pinned by identity rather than by "some row somewhere":
   * a factor the producer scores at the very top on one quantity and at zero on
   * the other. This is the row that makes a silent basis switch a lie rather
   * than a nuance.
   */
  it('a real staging capture tops one quantity and zeroes the other', () => {
    const demotedLevers = rows.filter(
      (row) => num(row.influence_score) === 1 && num(row.elasticity) === 0,
    )
    expect(
      demotedLevers.length,
      'no demoted lever in the corpus — the divergence case is gone',
    ).toBeGreaterThanOrEqual(1)
  })

  /**
   * The producer's own basis stamp — the evidence for the word "structural".
   *
   * ⚠ SCOPE (trap 20): this asserts what the CORPUS stamps. It is NOT a claim
   * that the UI reads the field; it does not, and this spec does not make it.
   * The value is asserted as an exact set so a second value arriving REDs here
   * and forces the noun to be re-derived rather than silently kept.
   */
  it('the producer stamps the structural basis, and stamps nothing else', () => {
    const stamps = rows
      .map((row) => row.importance_basis)
      .filter((v): v is string => typeof v === 'string')
    expect(stamps.length, 'no importance_basis stamp found — probe blind').toBeGreaterThanOrEqual(50)
    expect([...new Set(stamps)].sort()).toEqual(['graph_structural'])
  })

  /**
   * The producer ships two orderings and they disagree. A reader told only
   * "the top driver" is reading whichever ordering the display basis picked.
   */
  it('the producer ranks the same factors two different ways', () => {
    let both = 0
    let disagree = 0
    for (const row of rows) {
      const importance = num(row.importance_rank)
      const influence = num(row.influence_rank)
      if (importance === null || influence === null) continue
      both += 1
      if (importance !== influence) disagree += 1
    }
    expect(both, 'no row carries both ranks — probe blind').toBeGreaterThanOrEqual(50)
    // Measured 55 of 95 at 80bacf36; asserted as a floor for the same reason.
    expect(disagree).toBeGreaterThanOrEqual(25)
  })
})

/* ══════════════════════════════════════════════════════════════════════════
 * THE STAMP IS READ, AND AN UNRECOGNISED ONE FAILS CLOSED.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * The suite above cites `importance_basis` as EVIDENCE for the word
 * "structural" and says explicitly that it does not make the field a read path.
 * This block is that read path's guard.
 *
 * ⚠ THE LOAD-BEARING CASE IS THE DERIVED ONE ("handles exactly the stamp set
 * the corpus carries"). Everything else here is behaviour over hand-written
 * inputs, which can only ever prove the code does what this file imagined. The
 * derived case is the one that REDs when the PRODUCER moves, and it is the
 * reason a new basis value cannot reach a user under a noun written for the old
 * one.
 */
describe('importance_basis — the producer stamp is read, and fails closed', () => {
  const rows = factorRows()

  it('POSITIVE CONTROL: the sweep found real factor rows', () => {
    // Without this, "the observed stamp set equals the handled set" would pass
    // vacuously on an empty corpus — an absence probe pointed at nothing.
    expect(rows.length).toBeGreaterThanOrEqual(100)
  })

  /**
   * ⭐⭐ THE DERIVED COMPLETENESS GUARD — the deliverable of this lane.
   *
   * `HANDLED_IMPORTANCE_BASES` is hand-written and cannot be derived: the
   * producer's value space lives in another service. So the check on it is not
   * derived FROM it (that would be a guard agreeing with itself, trap 13b) —
   * it is derived from the CORPUS, which is written by the producer. Equality
   * in BOTH directions is asserted deliberately:
   *
   *   · corpus ⊄ handled → a new producer value has arrived and the code would
   *     name a quantity on evidence that no longer supports it. RED.
   *   · handled ⊄ corpus → the code claims to handle a basis nothing has ever
   *     stamped, which is an unreviewed assumption about the producer. RED.
   *
   * A `toContain`/superset assertion would satisfy the first and miss the
   * second, and the second is exactly how a well-meaning "let's also accept
   * `structural_graph`" edit slips in.
   */
  it('handles EXACTLY the stamp set the corpus carries, in both directions', () => {
    const stamps = rows
      .map((row) => row.importance_basis)
      .filter((v): v is string => typeof v === 'string')
    expect(stamps.length, 'no importance_basis stamp found — probe blind').toBeGreaterThanOrEqual(50)
    expect([...new Set(stamps)].sort()).toEqual([...HANDLED_IMPORTANCE_BASES].sort())
  })

  it('the handled value is the one the corpus actually stamps', () => {
    // Binds the exported constant to the wire string by identity, so renaming
    // the constant's VALUE (rather than adding to the list) also REDs.
    expect(HANDLED_IMPORTANCE_BASES).toContain(IMPORTANCE_BASIS_GRAPH_STRUCTURAL)
    expect(rows.some((row) => row.importance_basis === IMPORTANCE_BASIS_GRAPH_STRUCTURAL)).toBe(true)
  })

  /* ── the three states, kept apart ─────────────────────────────────────── */

  it('CONFIRMED when every stamp present is one the code handles', () => {
    expect(importanceBasisTrust([IMPORTANCE_BASIS_GRAPH_STRUCTURAL])).toBe('confirmed')
    expect(
      importanceBasisTrust([IMPORTANCE_BASIS_GRAPH_STRUCTURAL, undefined, IMPORTANCE_BASIS_GRAPH_STRUCTURAL]),
    ).toBe('confirmed')
  })

  it('UNSTAMPED — absent is NOT unrecognised, and that distinction is the point', () => {
    // A narrowing read in the normaliser would collapse these two states into
    // one and make the fail-closed rule unimplementable. 56 of the corpus's 123
    // factor rows carry no stamp; blanking the disclosure on those would be a
    // regression against legacy payloads, not caution.
    expect(importanceBasisTrust([])).toBe('unstamped')
    expect(importanceBasisTrust([undefined, null])).toBe('unstamped')
    expect(importanceBasisTrust(['', '   '])).toBe('unstamped')
  })

  it('UNRECOGNISED as soon as ANY row stamps a value the code does not handle', () => {
    expect(importanceBasisTrust(['montecarlo_variance'])).toBe('unrecognised')
    // Eager and set-wide: one unhandled stamp poisons the run, mirroring
    // selectDriverDisplayModel's own all-or-nothing coverage rule. A majority
    // of good rows does NOT rescue the sentence.
    expect(
      importanceBasisTrust([
        IMPORTANCE_BASIS_GRAPH_STRUCTURAL,
        IMPORTANCE_BASIS_GRAPH_STRUCTURAL,
        'montecarlo_variance',
      ]),
    ).toBe('unrecognised')
    // Near-misses are unrecognised too — this is not a fuzzy match.
    expect(importanceBasisTrust(['graph_structural_v2'])).toBe('unrecognised')
    expect(importanceBasisTrust(['GRAPH_STRUCTURAL'])).toBe('unrecognised')
  })

  /* ── the gate over the vocabulary ─────────────────────────────────────── */

  /**
   * ⭐⭐ THE DISCRIMINATING PAIR, BOUND TO THE NAMED ARM.
   *
   * Two assertions that a single mutant cannot satisfy together, so the pair
   * proves the gate is bound to the `influence_score` arm rather than to
   * "some withholding happens somewhere":
   *
   *   · widen `HANDLED_IMPORTANCE_BASES` to accept everything → the WITHHOLDING
   *     assertion REDs, the control stays green;
   *   · empty `HANDLED_IMPORTANCE_BASES` so nothing is accepted → the CONTROL
   *     REDs, the withholding assertion stays green.
   *
   * Either alone proves only sensitivity to something. The pair proves the
   * binding, and each mutant fails a DIFFERENT assertion.
   */
  it('withholds the structural noun on an unrecognised stamp, and only then', () => {
    // WITHHOLDING: the noun's evidence is falsified, so it is not named.
    expect(influenceQuantityForRun('influence_score', ['montecarlo_variance'])).toBeNull()
    expect(influenceQuantityRunDisclosureForRun('influence_score', ['montecarlo_variance'])).toBeNull()

    // CONTROL: the gate is not simply always-null. A handled stamp still names
    // the quantity, and names the SAME one the ungated path names — so the gate
    // narrows and never substitutes.
    expect(influenceQuantityForRun('influence_score', [IMPORTANCE_BASIS_GRAPH_STRUCTURAL])).toBe(
      INFLUENCE_QUANTITY_BY_BASIS.influence_score,
    )
    // CONTROL: an unstamped run is unchanged from the pre-gate behaviour.
    expect(influenceQuantityRunDisclosureForRun('influence_score', [])).toBe(
      influenceQuantityRunDisclosure('influence_score'),
    )
  })

  /**
   * ⚠ SCOPE, ASSERTED RATHER THAN DESCRIBED. Only the `influence_score` arm is
   * gated. The fallback arm's noun is this app's own normalisation of the
   * magnitude chain and `importance_basis` is not evidence for it either way,
   * so suppressing it on an unrecognised stamp would blank a sentence whose
   * support is untouched — on the run that is already the degraded one.
   */
  it('does NOT withhold the fallback arm, whose noun the stamp is not evidence for', () => {
    expect(influenceQuantityRunDisclosureForRun('normalised_elasticity', ['montecarlo_variance'])).toBe(
      INFLUENCE_QUANTITY_BY_BASIS.normalised_elasticity.runDisclosure,
    )
  })

  it('still names nothing when there is no basis at all, stamp or no stamp', () => {
    expect(influenceQuantityForRun(null, [IMPORTANCE_BASIS_GRAPH_STRUCTURAL])).toBeNull()
    expect(influenceQuantityForRun(undefined, ['montecarlo_variance'])).toBeNull()
  })

  /**
   * The gate may only ever NARROW. Whatever the stamps, the gated function
   * returns either exactly what the ungated one returns, or null — it can never
   * introduce a quantity the ungated path would not have named. This is what
   * bounds the blast radius of a bug in this file to a missing sentence.
   */
  it('is a strict narrowing of the ungated vocabulary, over every stamp state', () => {
    const stampStates: ReadonlyArray<ReadonlyArray<string | null | undefined>> = [
      [],
      [undefined],
      [IMPORTANCE_BASIS_GRAPH_STRUCTURAL],
      ['montecarlo_variance'],
      [IMPORTANCE_BASIS_GRAPH_STRUCTURAL, 'montecarlo_variance'],
    ]
    let sawNamed = 0
    for (const provenance of ['influence_score', 'normalised_elasticity'] as const) {
      for (const stamps of stampStates) {
        const gated = influenceQuantityForRun(provenance, stamps)
        if (gated !== null) {
          expect(gated).toBe(influenceQuantity(provenance))
          sawNamed += 1
        }
      }
    }
    // Control: the loop above must have exercised the NAMED branch, or
    // "never substitutes" would hold vacuously on an all-null result.
    expect(sawNamed).toBeGreaterThan(0)
  })
})

/* ══════════════════════════════════════════════════════════════════════════
 * ⭐⭐ THE TWO RANK FAMILIES, AND WHY THEIR SPLIT IS *NOT* EVIDENCE ABOUT THE
 * STAMP. THIS BLOCK EXISTS BECAUSE TWO SEPARATE REVIEWS GOT IT WRONG.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * The producer ships `importance_rank` and `influence_rank`, and they order by
 * DIFFERENT values. That is true, it is measured below, and it was twice read
 * as proving that `importance_basis` — sharing the `importance_` prefix —
 * describes the elasticity family and therefore cannot be evidence for the noun
 * on `influence_score`. The gate in `influenceScaleCopy.ts` was very nearly
 * deleted on that inference.
 *
 * THE INFERENCE IS FALSE. Derived at PLoT `d37c8cfd` (the deployed SHA): the
 * stamp is written once per RESPONSE from `factorSensitivitySource`
 * (`run.ts:8077-8082`), which is the same branch that decides whether
 * `influence_score` is the graph path-analysis quantity (`factor-influence.ts:798`)
 * or ISL's Monte-Carlo output (`run.ts:1056`). The families diverge for an
 * unrelated reason: option-controlled LEVERS have `elasticity` zeroed
 * (`factor-influence.ts:84-89`) and are re-ranked to the back of
 * `importance_rank` (`importance-authority.ts:96-115`), while `influence_score`
 * and `influence_rank` keep their structural values.
 *
 * So this block pins BOTH facts — the split, and its mechanism — because the
 * split alone is exactly the misleading half.
 *
 * ⚠ SCOPED TO `graph_structural` GROUPS ON PURPOSE, AND THE SCOPE IS THE CLAIM.
 * Everything asserted here is a fact about the GRAPH path: that is where
 * `elasticity` and `influence_score` start life as the same expression and
 * where lever suppression pulls them apart. On an `isl_uncertainty` response
 * both quantities come from ISL instead, and nothing below has been measured
 * against one — no such capture exists in this repo. Asserting over "any
 * stamped row" would state a predicate broader than the evidence behind it
 * (CLAUDE.md trap 22) and would RED on the first ISL capture to land, for a
 * reason that is not a defect. The arrival of a new basis value is caught by
 * the corpus completeness guard above, loudly, which is its job and not this
 * block's.
 *
 * ⚠ TIES ARE NOT VIOLATIONS. A pair only contradicts an ordering when the
 * better-ranked row has a STRICTLY smaller value; equal values are consistent
 * with any rank order. Without that, zero-elasticity runs would read as
 * counter-evidence when they are simply uninformative.
 */
describe('the two rank families track different values — and that is lever suppression, not two producers', () => {
  /** Factor-row arrays, deduplicated by content (debug bundles repeat one array 5×). */
  function stampedGroups(): Array<Array<Record<string, unknown>>> {
    const groups: Array<Array<Record<string, unknown>>> = []
    const seen = new Set<string>()
    for (const file of jsonFilesUnderSrc(SRC_ROOT)) {
      let parsed: unknown
      try {
        parsed = JSON.parse(readFileSync(file, 'utf8'))
      } catch {
        continue
      }
      const visit = (node: unknown): void => {
        if (Array.isArray(node)) {
          const rows = node.filter(
            (x): x is Record<string, unknown> =>
              x !== null
              && typeof x === 'object'
              && !Array.isArray(x)
              && (x as Record<string, unknown>).importance_basis === IMPORTANCE_BASIS_GRAPH_STRUCTURAL,
          )
          if (rows.length >= 2) {
            const key = JSON.stringify(rows)
            if (!seen.has(key)) {
              seen.add(key)
              groups.push(rows)
            }
          }
          for (const child of node) visit(child)
          return
        }
        if (node !== null && typeof node === 'object') {
          for (const child of Object.values(node as Record<string, unknown>)) visit(child)
        }
      }
      visit(parsed)
    }
    return groups
  }

  /** Rank/value pairs that contradict each other, ties-aware, on absolute values. */
  function violations(
    rows: ReadonlyArray<Record<string, unknown>>,
    rankField: string,
    valueField: string,
  ): number {
    const usable = rows
      .map((r) => ({ rank: num(r[rankField]), value: num(r[valueField]) }))
      .filter((r): r is { rank: number; value: number } => r.rank !== null && r.value !== null)
    let bad = 0
    for (const a of usable) {
      for (const b of usable) {
        if (a.rank < b.rank && Math.abs(a.value) < Math.abs(b.value)) bad += 1
      }
    }
    return bad
  }

  const groups = stampedGroups()

  it('POSITIVE CONTROL: the sweep found stamped groups, and groups that can DISCRIMINATE', () => {
    // Without the second assertion every ordering claim below could pass on a
    // corpus where the two values never differ — an absence probe pointed at
    // nothing (CLAUDE.md trap 13).
    expect(groups.length, 'no stamped factor-row groups found — probe blind').toBeGreaterThanOrEqual(10)
    const discriminating = groups.filter(
      (rows) =>
        violations(rows, 'importance_rank', 'influence_score') > 0
        || violations(rows, 'influence_rank', 'elasticity') > 0,
    )
    expect(
      discriminating.length,
      'no group distinguishes the two families — the ordering assertions would be vacuous',
    ).toBeGreaterThanOrEqual(5)
  })

  it('importance_rank orders by |elasticity|, and influence_rank by influence_score', () => {
    for (const rows of groups) {
      expect(violations(rows, 'importance_rank', 'elasticity')).toBe(0)
      expect(violations(rows, 'influence_rank', 'influence_score')).toBe(0)
    }
  })

  it('and each family CONTRADICTS the other quantity — they are not two names for one order', () => {
    const crossed = groups.filter(
      (rows) =>
        violations(rows, 'importance_rank', 'influence_score') > 0
        && violations(rows, 'influence_rank', 'elasticity') > 0,
    )
    // Measured 10 of 13 at 015d2dbb; pinned as a floor so a growing corpus
    // stays green and a corpus that loses the property REDs.
    expect(crossed.length).toBeGreaterThanOrEqual(5)
  })

  /**
   * ⭐ THE LOAD-BEARING ONE. The split above is caused by lever suppression, so
   * it says NOTHING about which producer built the response — which is what
   * `importance_basis` discloses and what the structural noun rests on. If this
   * ever REDs, the mechanism has changed and the gate's justification must be
   * re-derived at PLoT before anything here is "corrected".
   */
  it('every divergence between elasticity and influence_score is a suppressed lever', () => {
    const stamped = factorRows().filter(
      (r) => r.importance_basis === IMPORTANCE_BASIS_GRAPH_STRUCTURAL,
    )
    const diverging = stamped.filter((r) => num(r.elasticity) !== num(r.influence_score))
    expect(diverging.length, 'no diverging rows — this guard would be vacuous').toBeGreaterThanOrEqual(10)
    for (const row of diverging) {
      expect(row.zero_reason).toBe('intervention_override')
      expect(num(row.elasticity)).toBe(0)
    }
  })
})
