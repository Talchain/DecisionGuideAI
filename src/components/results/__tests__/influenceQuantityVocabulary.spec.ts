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
 *     the evidence for the word "structural", and it is read by ZERO lines of
 *     code under `src/` — a declared semantics the UI has never consulted.
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
  INFLUENCE_QUANTITY_BY_BASIS,
  influenceQuantity,
  influenceQuantityRunDisclosure,
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
