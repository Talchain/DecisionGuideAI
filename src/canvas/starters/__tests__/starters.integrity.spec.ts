/**
 * Starter integrity — the fixtures are REAL CEE drafts, and the manifest
 * describes the graph it actually opens.
 *
 * WHAT THIS DEFENDS. Three drift surfaces, each of which would read green
 * without a pin:
 *   1. a card whose title/summary/counts describe a different graph;
 *   2. a fixture that is not actually a usable, analysis-shaped draft (i.e. a
 *      hand-authored toy quietly substituted for a captured one);
 *   3. a manifest entry with no dynamic import behind it (a card that
 *      dead-clicks) — pinned at module load in loadStarter.ts and re-asserted
 *      here so a test, not just a runtime throw, can see it.
 *
 * `scripts/build-starter-fixtures.mjs --check` is the other half: it re-derives
 * the fixtures from the committed source captures and byte-compares. Together
 * they mean a starter cannot drift from the live draft it came from without
 * something going red.
 */

import { describe, it, expect } from 'vitest'
import { STARTERS, loadStarterPayload, getStarter } from '../loadStarter'
import { findNearDuplicateLabels, formatCollision } from '../nearDuplicateLabels'

interface DraftFixture {
  nodes: Array<{ id: string; kind: string; label: string; display_value?: string; observed_state?: { value?: number } }>
  edges: Array<{ from: string; to: string }>
  analysis_ready?: {
    options?: Array<{
      id?: string
      label: string
      interventions?: Record<string, number | { value?: number; display_value?: string }>
      intervention_details?: Record<string, { display_value?: string; normalised_value?: number }>
    }>
    goal_node_id?: string
  }
  coaching?: { summary?: string }
  _pipeline_outcome?: { graph_drafted?: boolean; graph_structurally_valid?: boolean }
}

/** Unwrap an intervention entry, which is a bare number or a `{ value }` object. */
function interventionValue(entry: number | { value?: number } | undefined): number | undefined {
  return typeof entry === 'number' ? entry : entry?.value
}

/** The trailing numeric parenthetical in a display string: "Very high (0.8)" → 0.8. */
function numericParenthetical(text: string): number | null {
  const matches = [...text.matchAll(/\(\s*(-?\d+(?:\.\d+)?)\s*\)/g)]
  return matches.length ? Number(matches[matches.length - 1][1]) : null
}

interface InterventionRow {
  optionLabel: string
  factorId: string
  value: number
  displayValue?: string
  detailDisplayValue?: string
  factorDisplayValue?: string
  factorObservedValue?: number
}

/** Every option×factor intervention in one starter, joined to its factor node. */
function interventionRows(g: DraftFixture): InterventionRow[] {
  const factorById = new Map(g.nodes.filter((n) => n.kind === 'factor').map((n) => [n.id, n]))
  const rows: InterventionRow[] = []
  for (const option of g.analysis_ready?.options ?? []) {
    for (const [factorId, entry] of Object.entries(option.interventions ?? {})) {
      const value = interventionValue(entry)
      if (typeof value !== 'number') continue
      const factor = factorById.get(factorId)
      rows.push({
        optionLabel: option.label,
        factorId,
        value,
        displayValue: typeof entry === 'object' ? entry.display_value : undefined,
        detailDisplayValue: option.intervention_details?.[factorId]?.display_value,
        factorDisplayValue: factor?.display_value,
        factorObservedValue: factor?.observed_state?.value,
      })
    }
  }
  return rows
}

describe('starter fixtures', () => {
  it('every manifest entry has a loader behind it (no card can dead-click)', async () => {
    for (const s of STARTERS) {
      await expect(loadStarterPayload(s.id)).resolves.toBeTruthy()
    }
  })

  it('an unknown id rejects loudly rather than resolving empty', async () => {
    await expect(loadStarterPayload('not-a-starter')).rejects.toThrow(/unknown starter id/)
  })

  describe.each(STARTERS.map((s) => [s.id, s] as const))('%s', (id, meta) => {
    it('is a real, structurally-valid CEE draft (not a hand-authored fixture)', async () => {
      const g = (await loadStarterPayload(id)) as DraftFixture
      // These flags come from CEE's own pipeline outcome. A hand-written graph
      // could not carry them honestly.
      expect(g._pipeline_outcome?.graph_drafted).toBe(true)
      expect(g._pipeline_outcome?.graph_structurally_valid).toBe(true)
      // Enterprise shape, per the probe evidence: 16–19 nodes, 26–37 edges.
      expect(g.nodes.length).toBeGreaterThanOrEqual(12)
      expect(g.edges.length).toBeGreaterThanOrEqual(12)
      // The parts a template fixture lacks and a demo needs.
      expect(g.nodes.filter((n) => n.kind === 'goal')).toHaveLength(1)
      expect(g.nodes.filter((n) => n.kind === 'decision')).toHaveLength(1)
      expect(g.nodes.filter((n) => n.kind === 'risk').length).toBeGreaterThan(0)
      expect(typeof g.analysis_ready?.goal_node_id).toBe('string')
      expect((g.analysis_ready?.options ?? []).length).toBeGreaterThanOrEqual(3)
      expect((g.coaching?.summary ?? '').length).toBeGreaterThan(40)
    })

    it('manifest counts match the fixture (a mislabelled card fails here)', async () => {
      const g = (await loadStarterPayload(id)) as DraftFixture
      expect(meta.nodeCount).toBe(g.nodes.length)
      expect(meta.edgeCount).toBe(g.edges.length)
      expect(meta.optionCount).toBe((g.analysis_ready?.options ?? []).length)
    })

    it('card title/summary are the graph’s own decision/goal labels, verbatim', async () => {
      const g = (await loadStarterPayload(id)) as DraftFixture
      expect(meta.title).toBe(g.nodes.find((n) => n.kind === 'decision')?.label)
      expect(meta.summary).toBe(g.nodes.find((n) => n.kind === 'goal')?.label)
    })

    it('carries the verbatim brief the redraft re-sends', () => {
      // Reads the brief the way the redraft actually reads it
      // (StarterProvenanceBanner: `getStarter(starterId)` then `starter.brief`).
      // The retired `starterBrief()` wrapper claimed in its own docstring that
      // "the redraft affordance re-sends THIS string" — it did not; nothing on
      // the live path ever called it. Testing the wrapper proved nothing about
      // the sentence the user actually gets.
      const brief = getStarter(id)?.brief
      expect(typeof brief).toBe('string')
      // Long enough to be the real enterprise brief, not a shortened one. The
      // probe lane's explicit instruction was NOT to shorten these: a short
      // brief drafts more reliably but stops representing an enterprise
      // decision, which hides the wall instead of clearing it.
      expect((brief ?? '').length).toBeGreaterThan(300)
    })

    it('ships no diagnostic trace payload (bundle + raw-model-output hygiene)', async () => {
      const g = (await loadStarterPayload(id)) as Record<string, unknown>
      expect(g).not.toHaveProperty('trace')
      expect(g).not.toHaveProperty('_timings')
    })

    it('carries no near-duplicate label pair (the 1.320 edit-failure shape)', async () => {
      const g = (await loadStarterPayload(id)) as DraftFixture
      const collisions = findNearDuplicateLabels(g.nodes)
      // ROADMAP 1.320: a clean 6/6 correlate — every graph whose edits failed
      // carried a near-duplicate label sibling, every graph whose edits landed
      // carried none. A starter is the first graph a new user ever edits, so
      // shipping one with a collision hands them the ~50%-failure shape on
      // their first attempt. The message lists the offenders so a recapture
      // that reintroduces one says which labels to reword.
      expect(collisions.map(formatCollision)).toEqual([])
    })

    /**
     * An option's receipt must describe THAT OPTION, never the status quo.
     *
     * ⚠ THIS IS THE ASSERTION WHOSE ABSENCE LET THE DEFECT SHIP. The five
     * captures predate CEE #944 (2026-08-14), which added the
     * `sitsAtObservedState` guard to `buildInterventionDetail`. Before it, every
     * option that touched a factor BORROWED that factor's own baseline
     * `display_value` — so `Germany First` rendered "Low (0) → Low (0)" for an
     * intervention moving the factor 0 → 1, and `fac_adoption_friction` read
     * "Very high (0.8)" on options setting it to 0.1. 27 of 70 interventions
     * across ALL FIVE starters carried one. A starter is the first model a
     * colleague opens, and a receipt that describes the status quo is not a
     * rough edge — it tells them the option does nothing, or the opposite of
     * what it does.
     *
     * Written against the SPEC (CEE's own `sitsAtObservedState` rule), NOT
     * against the symptom that surfaced it. The symptom was a numeric
     * parenthetical that disagreed with its value; a check shaped like that
     * finds 19 and certifies build-vs-buy clean, because its eight borrows read
     * "Moderate engineering allocation (2 of 4 engineers)" and
     * "No in-house build pursued" — no numeric parenthetical to disagree with
     * anything (CLAUDE.md trap 13e: a probe scoped to one syntax returns a
     * false clean). The spec-shaped rule below sees all 27.
     */
    it('no option borrows the factor’s baseline display string while moving it (CEE #944 sitsAtObservedState)', async () => {
      const g = (await loadStarterPayload(id)) as DraftFixture
      const borrowed = interventionRows(g)
        .filter(
          (r) =>
            r.displayValue !== undefined &&
            r.factorDisplayValue !== undefined &&
            r.displayValue === r.factorDisplayValue &&
            r.factorObservedValue !== r.value,
        )
        .map((r) => `${r.optionLabel} · ${r.factorId}: "${r.displayValue}" but sets ${r.value} (baseline ${r.factorObservedValue})`)
      expect(borrowed).toEqual([])
    })

    it('a display string’s own numeric parenthetical agrees with its value', async () => {
      const g = (await loadStarterPayload(id)) as DraftFixture
      const contradictions: string[] = []
      for (const r of interventionRows(g)) {
        for (const [mirror, text] of [
          ['interventions', r.displayValue],
          ['intervention_details', r.detailDisplayValue],
        ] as const) {
          if (text === undefined) continue
          const stated = numericParenthetical(text)
          if (stated !== null && Math.abs(stated - r.value) > 1e-9) {
            contradictions.push(`${r.optionLabel} · ${r.factorId} · ${mirror}: "${text}" but value is ${r.value}`)
          }
        }
      }
      expect(contradictions).toEqual([])
    })

    it('the two display mirrors carry the same string (a fix must not split them)', async () => {
      const g = (await loadStarterPayload(id)) as DraftFixture
      const split = interventionRows(g)
        .filter((r) => r.displayValue !== undefined && r.detailDisplayValue !== r.displayValue)
        .map((r) => `${r.optionLabel} · ${r.factorId}: ${JSON.stringify(r.displayValue)} vs ${JSON.stringify(r.detailDisplayValue)}`)
      expect(split).toEqual([])
    })

    /**
     * COVERAGE PIN — the three assertions above are all ABSENCE claims, and an
     * absence claim over an empty collection is free. Stripping `display_value`
     * from every intervention would satisfy all three while deleting the very
     * data they exist to police: a silent "fix" that reads green.
     *
     * So the set is pinned in BOTH directions. It REDs if a starter gains or
     * loses an intervention, and it REDs if any intervention stops carrying a
     * display string on either mirror.
     */
    it('every intervention still carries a display string on both mirrors (the guards above cannot go vacuous)', async () => {
      const g = (await loadStarterPayload(id)) as DraftFixture
      const rows = interventionRows(g)
      expect(rows.length).toBe(meta.interventionCount)
      expect(rows.filter((r) => r.displayValue !== undefined)).toHaveLength(meta.interventionCount)
      expect(rows.filter((r) => r.detailDisplayValue !== undefined)).toHaveLength(meta.interventionCount)
    })
  })

  /**
   * POSITIVE CONTROL (CLAUDE.md trap 13: an absence assertion must first prove
   * it can see a presence).
   *
   * Without this, `findNearDuplicateLabels` could return `[]` unconditionally —
   * a detector that never fires, silently converting all five per-starter
   * assertions above into assertions about nothing. Each clause of the rule is
   * exercised against the shape it was written for, including the exact
   * exemplar ROADMAP 1.320 recorded.
   */
  describe('the collision detector can SEE a collision', () => {
    const node = (id: string, kind: string, label: string) => ({ id, kind, label })

    it('fires on SUBSET — the shape shipped in vendor-selection and market-entry', () => {
      const found = findNearDuplicateLabels([
        node('a', 'factor', 'Data Team Capacity'),
        node('b', 'risk', 'Data Team Capacity Strain'),
      ])
      expect(found).toHaveLength(1)
      expect(found[0].rule).toBe('SUBSET')
    })

    it('fires on JACCARD — 1.320’s own `Three-Year TCO {…}` exemplar', () => {
      const found = findNearDuplicateLabels([
        node('a', 'factor', 'Three-Year TCO Multiplier'),
        node('b', 'factor', 'Three-Year TCO Pressure'),
      ])
      expect(found).toHaveLength(1)
      expect(found[0].rule).toBe('JACCARD')
      expect(found[0].score).toBeGreaterThanOrEqual(0.6)
    })

    it('fires on EQUAL — same tokens, different punctuation and case', () => {
      const found = findNearDuplicateLabels([
        node('a', 'option', 'Adopt Segment'),
        node('b', 'outcome', 'adopt — segment'),
      ])
      expect(found).toHaveLength(1)
      expect(found[0].rule).toBe('EQUAL')
    })

    it('does NOT fire on genuinely distinct labels (the rule is not "always red")', () => {
      // A detector that flagged everything would pass the three tests above and
      // still be useless — it would just make the per-starter assertion
      // unsatisfiable. These are real labels from the shipped fixtures.
      expect(
        findNearDuplicateLabels([
          node('a', 'option', 'Germany First'),
          node('b', 'option', 'Nordics First'),
          node('c', 'goal', 'Achieve ARR Growth by Q3'),
          node('d', 'risk', 'Localisation Cost Overrun'),
        ]),
      ).toEqual([])
    })
  })
})
