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
  nodes: Array<{ id: string; kind: string; label: string }>
  edges: Array<{ from: string; to: string }>
  analysis_ready?: { options?: Array<{ label: string }>; goal_node_id?: string }
  coaching?: { summary?: string }
  _pipeline_outcome?: { graph_drafted?: boolean; graph_structurally_valid?: boolean }
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
