/**
 * StressTestSection — "Fragile factors (N)" must not render or count the same
 * relationship twice.
 *
 * WHY THIS EXISTS (manual test, 2026-08-16). The live Analysis surface showed
 * "If Leadership capacity shifts" TWICE inside one alt-winner group, and the
 * heading counted the duplicate: "Fragile factors (2)" for one relationship.
 *
 * The UI performed no dedup anywhere on the chain:
 *   useResultsSectionData.ts:3430-3491 → validity filter + alt-winner label
 *     resolution + sort. No identity check.
 *   ResultsBody.tsx:742                → passthrough.
 *   StressTestSection.tsx:281-303      → sort → slice(0,3) → length. No
 *     identity check, and the slice ran BEFORE any dedup could, so a duplicate
 *     also consumed one of only three display slots.
 *
 * DEDUP IS BY IDENTITY, NEVER BY DISPLAY STRING. Two genuinely different edges
 * can legitimately render the same "If X shifts" line (one source factor
 * feeding two different targets), and collapsing those would delete producer
 * findings. The controls below pin exactly that boundary in both directions.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StressTestSection } from '../StressTestSection'
import type { DriverItem } from '../types'
import type { ChallengeFragileEdge } from '../FragileEdgeGroupCard'

function makeDriver(overrides: Partial<DriverItem> = {}): DriverItem {
  return {
    factorKey: 'fac_default',
    factorLabel: 'Default factor',
    rawElasticity: 0.5,
    normalisedInfluence: 0.5,
    influenceScore: 0.5,
    rank: 1,
    direction: 'positive',
    semanticLabel: 'biggest',
    canFocus: true,
    matchedNodeId: 'node_default',
    confidence: 0.7,
    ...overrides,
  }
}

const TOP_FACTOR: DriverItem = makeDriver({
  factorKey: 'fac_top',
  factorLabel: 'Customer churn rate',
  rankFlipRate: 0.32,
  confidence: 0.8,
})

/** The relationship Paul saw duplicated, at the shape the hook emits. */
function leadershipEdge(overrides: Partial<ChallengeFragileEdge> = {}): ChallengeFragileEdge {
  return {
    edge_id: 'edge_leadership_delivery',
    from_id: 'node_leadership',
    from_label: 'Leadership capacity',
    to_label: 'Delivery throughput',
    switch_probability: 0.31,
    alternative_winner_id: 'opt_b',
    alternative_winner_label: 'Option B',
    ...overrides,
  }
}

function renderSection(fragileEdges: ChallengeFragileEdge[]) {
  return render(
    <StressTestSection
      drivers={[TOP_FACTOR]}
      fragileEdges={fragileEdges}
      winnerLabel="Option A"
      alternativeLabel="Option B"
      designationsWithheld={false}
    />,
  )
}

/**
 * Counts the rendered "If <label> shifts" rows naming a specific factor.
 * Binds by the factor's EXACT label — the object identity a reader sees — not
 * by a substring another row could satisfy.
 */
/**
 * Rows whose trigger names `label` as the SOURCE factor.
 *
 * ⚠ RE-POINTED, NOT NARROWED (Analysis convergence, 18 Aug 2026) — declared
 * here because silently re-pointing a probe is how a guard stops biting
 * (CLAUDE.md 13b/14).
 *
 * It previously required the row's text to equal the literal
 * `If {label} shifts`. `FragileEdgeGroupCard` now DISAMBIGUATES the exact case
 * this block's controls exist to protect: when one source feeds two targets in
 * the same group the rows read `If {source}'s effect on {target} shifts`, so
 * two genuinely different findings are no longer two identical sentences. The
 * old equality made the probe blind to precisely those rows — it would have
 * counted 0 and reported "the fix deleted producer findings" when the fix had
 * done the opposite.
 *
 * The PROPERTY under test is unchanged and is still counted: how many rows name
 * this source. Only the sentence template it tolerates is widened, and it is
 * still anchored at both ends (`If …` / `… shifts`), so a row that stopped
 * being a trigger sentence would not be counted.
 */
function countShiftRowsFor(label: string): number {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const trigger = new RegExp(`^If ${escaped}(?:'s effect on .+)? shifts$`)
  return screen.queryAllByText(label, { selector: 'span' })
    .filter(el => trigger.test(el.parentElement?.textContent ?? ''))
    .length
}

describe('StressTestSection — fragile factors dedup by relationship identity', () => {
  describe('the reported defect', () => {
    it('renders one row and counts 1 when the producer repeats the SAME edge_id', () => {
      renderSection([leadershipEdge(), leadershipEdge()])

      expect(countShiftRowsFor('Leadership capacity')).toBe(1)
      expect(screen.getByText('Fragile factors (1)')).toBeInTheDocument()
      expect(screen.queryByText('Fragile factors (2)')).not.toBeInTheDocument()
    })

    it('dedups on the endpoint pair when the producer sent no edge_id', () => {
      renderSection([
        leadershipEdge({ edge_id: undefined }),
        leadershipEdge({ edge_id: undefined }),
      ])

      expect(countShiftRowsFor('Leadership capacity')).toBe(1)
      expect(screen.getByText('Fragile factors (1)')).toBeInTheDocument()
    })

    it('frees the display slot the duplicate consumed (dedup precedes the 3-row cap)', () => {
      // Four entries, one of which is a duplicate. Pre-fix the slice(0,3) ran
      // first, so the duplicate ate a slot and the fourth REAL relationship
      // never rendered. Post-fix all three distinct relationships show.
      renderSection([
        leadershipEdge({ switch_probability: 0.31 }),
        leadershipEdge({ switch_probability: 0.31 }),
        leadershipEdge({
          edge_id: 'edge_funding',
          from_id: 'node_funding',
          from_label: 'Funding cycle',
          switch_probability: 0.24,
        }),
        leadershipEdge({
          edge_id: 'edge_hiring',
          from_id: 'node_hiring',
          from_label: 'Hiring rate',
          switch_probability: 0.19,
        }),
      ])

      expect(countShiftRowsFor('Leadership capacity')).toBe(1)
      expect(countShiftRowsFor('Funding cycle')).toBe(1)
      expect(countShiftRowsFor('Hiring rate')).toBe(1)
      expect(screen.getByText('Fragile factors (3)')).toBeInTheDocument()
    })

    it('keeps the highest-ranked instance when a duplicate carries a weaker probability', () => {
      // Dedup runs AFTER the sort, so the surviving row is the one the
      // producer ranked first — never an arbitrary array position.
      renderSection([
        leadershipEdge({ marginal_switch_probability: 0.12 }),
        leadershipEdge({ marginal_switch_probability: 0.44 }),
        leadershipEdge({
          edge_id: 'edge_funding',
          from_id: 'node_funding',
          from_label: 'Funding cycle',
          marginal_switch_probability: 0.30,
        }),
      ])

      expect(countShiftRowsFor('Leadership capacity')).toBe(1)
      expect(screen.getByText('Fragile factors (2)')).toBeInTheDocument()
    })
  })

  describe('over-dedup controls — these MUST stay green, or the fix deletes producer findings', () => {
    it('keeps two DIFFERENT relationships that share a source factor (same display string)', () => {
      // Both render the identical line "If Leadership capacity shifts". They
      // are not duplicates: different edges, different targets. A
      // display-string dedup would collapse them — this is the assertion that
      // proves the fix keys on identity instead.
      renderSection([
        leadershipEdge({
          edge_id: 'edge_leadership_delivery',
          to_label: 'Delivery throughput',
          switch_probability: 0.31,
        }),
        leadershipEdge({
          edge_id: 'edge_leadership_morale',
          to_label: 'Team morale',
          switch_probability: 0.27,
        }),
      ])

      expect(countShiftRowsFor('Leadership capacity')).toBe(2)
      expect(screen.getByText('Fragile factors (2)')).toBeInTheDocument()
    })

    it('keeps the same edge when it flips the lead to two DIFFERENT alternative winners', () => {
      // Same relationship, two distinct producer claims. Collapsing them would
      // silently drop one alternative winner from the stress test.
      renderSection([
        leadershipEdge({ alternative_winner_id: 'opt_b', alternative_winner_label: 'Option B' }),
        leadershipEdge({ alternative_winner_id: 'opt_c', alternative_winner_label: 'Option C' }),
      ])

      expect(countShiftRowsFor('Leadership capacity')).toBe(2)
      expect(screen.getByText('Fragile factors (2)')).toBeInTheDocument()
      expect(screen.getAllByTestId('fragile-alt-winner').map(el => el.textContent))
        .toEqual(['Option B', 'Option C'])
    })

    it('leaves a duplicate-free producer list byte-identical (count and rows unchanged)', () => {
      renderSection([
        leadershipEdge({ switch_probability: 0.31 }),
        leadershipEdge({
          edge_id: 'edge_funding',
          from_id: 'node_funding',
          from_label: 'Funding cycle',
          switch_probability: 0.24,
        }),
      ])

      expect(countShiftRowsFor('Leadership capacity')).toBe(1)
      expect(countShiftRowsFor('Funding cycle')).toBe(1)
      expect(screen.getByText('Fragile factors (2)')).toBeInTheDocument()
    })
  })
})
