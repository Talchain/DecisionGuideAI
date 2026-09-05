/**
 * THE INFLUENCE FIGURE MUST SAY WHAT IT IS DERIVED FROM.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE USER-VISIBLE HARM
 * ═══════════════════════════════════════════════════════════════════════════
 * A user re-runs an analysis, the option win-shares move, and every factor
 * influence number stands still. Factors are the bulk of the model, so the
 * graph looks like it did not respond — and on the factor half it did not.
 * Until 5 Sep 2026 the tooltip asserted the opposite ("an absolute causal
 * influence score from the analysis"); that clause was removed and nothing
 * was put in its place, so at the previous head the reader had no way to
 * learn the figure is structural.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT WAS MEASURED IN THIS TREE (base 53dbd616), not inherited
 * ═══════════════════════════════════════════════════════════════════════════
 * Every live capture fixture carrying factor rows stamps the producer's own
 * basis field: `importance_basis` = "graph_structural" on 67/67 rows across
 * 12 capture fixtures (31 Jul – 17 Aug 2026), complete manifest, no sampling.
 * No row carries any other value. Before this change the field had ZERO code
 * readers repo-wide (contrast control in the same sweep: `influence_score`
 * has many), so the one fact that answers the user's question was arriving
 * on the wire and being dropped on the floor.
 *
 * ⭐ THE COPY IS KEYED ON THE FIELD'S VALUE, NEVER ON AN ASSUMPTION.
 * 67/67 is a complete manifest of the captures in THIS TREE, not of every
 * possible run. If the producer ever emits a simulation-derived basis, copy
 * keyed to the VALUE stays true and simply says nothing new; copy keyed to
 * "it is always structural" would become the next false sentence. That is
 * what `says nothing new for an unknown basis value` below exists to pin,
 * and it is the load-bearing test in this file.
 *
 * ⚠ THE DISCLOSURE IS GATED ON BOTH THE DISPLAY BASIS AND THE STAMP.
 * `importance_basis` describes the producer's `influence_score`. When the
 * display model falls back to `normalised_elasticity` the rendered number is
 * normalised magnitude from the run, NOT the producer score — so the
 * structural note must not attach there even though the stamp is present.
 */
import { describe, it, expect } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

import {
  INFLUENCE_EXPLANATION_ABSOLUTE,
  INFLUENCE_STRUCTURAL_BASIS_NOTE,
  STRUCTURAL_IMPORTANCE_BASIS,
  influenceExplanation,
  influenceBarAriaLabel,
  influencePillAriaLabel,
} from '../influenceScaleCopy'
import {
  extractPolicyRow,
  selectDriverDisplayModel,
} from '../driverDisplayModel'
import { selectDriverPolicyFeed } from '../useResultsSectionData'
import { MetricPills } from '../../../canvas/nodes/shared/MetricPills'

import walkAFixture from '../../../v5/__tests__/fixtures/live-analysis-turn-walkA-2026-08-04.json'

afterEach(cleanup)

/** The real captured wire rows from a live analysis turn (31 Jul–17 Aug corpus). */
function capturedFactorRows(): Array<Record<string, unknown>> {
  const blocks = (walkAFixture as { blocks?: Array<Record<string, unknown>> }).blocks ?? []
  for (const block of blocks) {
    const enrichment = block.enrichment as { factor_sensitivity?: unknown } | undefined
    const rows = enrichment?.factor_sensitivity
    if (Array.isArray(rows) && rows.length > 0) return rows as Array<Record<string, unknown>>
  }
  return []
}

describe('influence figure discloses the basis it is derived from', () => {
  it('POSITIVE CONTROL: the capture really does stamp importance_basis on every row', () => {
    // Without this the wiring assertions below could pass on an empty corpus.
    const rows = capturedFactorRows()
    expect(rows.length).toBeGreaterThanOrEqual(5)
    for (const row of rows) {
      expect(row.importance_basis, `row ${String(row.factor_id)}`).toBe('graph_structural')
    }
    // CONTRAST CONTROL for the value-keyed guard: no captured row carries a
    // simulation basis, so the "unknown value" case below is a real guard
    // over a class the corpus cannot supply, not a restatement of the data.
    expect(rows.some((r) => r.importance_basis !== STRUCTURAL_IMPORTANCE_BASIS)).toBe(false)
  })

  it('discloses the structural basis in the tooltip when the stamp says graph_structural', () => {
    const copy = influenceExplanation('influence_score', 'graph_structural')
    expect(copy).toContain(INFLUENCE_EXPLANATION_ABSOLUTE)
    expect(copy).toContain(INFLUENCE_STRUCTURAL_BASIS_NOTE)
    expect(copy).toMatch(/structure of your model/)
  })

  it('discloses it in both accessible names too, so the disclosure is not pointer-only', () => {
    expect(influenceBarAriaLabel('influence_score', 'graph_structural')).toContain(
      INFLUENCE_STRUCTURAL_BASIS_NOTE,
    )
    expect(influencePillAriaLabel(62, 'influence_score', 'graph_structural')).toContain(
      INFLUENCE_STRUCTURAL_BASIS_NOTE,
    )
  })

  it('says nothing new when no basis is stamped (fail-closed, absence is not evidence)', () => {
    expect(influenceExplanation('influence_score')).toBe(INFLUENCE_EXPLANATION_ABSOLUTE)
    expect(influenceExplanation('influence_score', null)).toBe(INFLUENCE_EXPLANATION_ABSOLUTE)
    expect(influenceExplanation('influence_score', undefined)).toBe(INFLUENCE_EXPLANATION_ABSOLUTE)
    expect(influenceBarAriaLabel('influence_score', null)).not.toContain(
      INFLUENCE_STRUCTURAL_BASIS_NOTE,
    )
  })

  it('⭐ says nothing new for an UNKNOWN basis value — the copy is keyed on the value, not on an assumption', () => {
    for (const unknownBasis of [
      'simulation',
      'isl_simulation',
      'monte_carlo',
      'GRAPH_STRUCTURAL',
      '',
    ]) {
      expect(influenceExplanation('influence_score', unknownBasis), unknownBasis).toBe(
        INFLUENCE_EXPLANATION_ABSOLUTE,
      )
      expect(
        influencePillAriaLabel(62, 'influence_score', unknownBasis),
        unknownBasis,
      ).not.toContain(INFLUENCE_STRUCTURAL_BASIS_NOTE)
    }
  })

  it('does NOT attach the note on the set-relative basis — that number is from the run', () => {
    // The stamp describes influence_score. Under the elasticity fallback the
    // rendered number is normalised magnitude, so the structural claim would
    // be false about the figure actually on screen.
    expect(influenceExplanation('normalised_elasticity', 'graph_structural')).not.toContain(
      INFLUENCE_STRUCTURAL_BASIS_NOTE,
    )
    expect(influenceBarAriaLabel('normalised_elasticity', 'graph_structural')).not.toContain(
      INFLUENCE_STRUCTURAL_BASIS_NOTE,
    )
    expect(influenceExplanation(null, 'graph_structural')).not.toContain(
      INFLUENCE_STRUCTURAL_BASIS_NOTE,
    )
  })
})

describe('importance_basis is carried through the shared driver policy, not re-derived per surface', () => {
  it('extractPolicyRow lifts the stamp off a captured wire row', () => {
    const row = extractPolicyRow(capturedFactorRows()[0])
    expect(row).not.toBeNull()
    expect(row?.importanceBasis).toBe('graph_structural')
  })

  it('extractPolicyRow fails closed on an absent or non-string stamp', () => {
    expect(extractPolicyRow({ factor_id: 'f1', influence_score: 0.4 })?.importanceBasis).toBeNull()
    expect(
      extractPolicyRow({ factor_id: 'f1', influence_score: 0.4, importance_basis: 7 })
        ?.importanceBasis,
    ).toBeNull()
  })

  it('selectDriverDisplayModel carries the stamp onto the display entry', () => {
    const model = selectDriverDisplayModel([
      { key: 'a', influenceScore: 0.9, rawElasticity: 0.5, importanceBasis: 'graph_structural' },
      { key: 'b', influenceScore: 0.4, rawElasticity: 0.2, importanceBasis: 'graph_structural' },
    ])
    expect(model.get('a')?.provenance).toBe('influence_score')
    expect(model.get('a')?.importanceBasis).toBe('graph_structural')
    expect(model.get('b')?.importanceBasis).toBe('graph_structural')
  })

  it('the SHARED feed both surfaces read carries the stamp from a real capture', () => {
    const rows = capturedFactorRows()
    const feed = selectDriverPolicyFeed({ factor_sensitivity: rows } as never)
    expect(feed.policyRows.length).toBe(rows.length)
    for (const policyRow of feed.policyRows) {
      expect(policyRow.importanceBasis, policyRow.key).toBe('graph_structural')
    }
    for (const [key, entry] of feed.displayModel) {
      expect(entry.importanceBasis, key).toBe('graph_structural')
    }
  })
})

describe('the canvas pill renders the disclosure it is given', () => {
  // Bound by IDENTITY: the influence pill is the one whose accessible name
  // opens with the influence noun and carries THIS percentage, so the
  // confidence pill (same role, same container) cannot satisfy the query.
  const influencePill = () => screen.getByRole('img', { name: /^Influence score 62%/ })

  it('puts the structural note on the influence pill title and accessible name', () => {
    render(
      <MetricPills
        influencePct={62}
        influenceProvenance="influence_score"
        influenceImportanceBasis="graph_structural"
      />,
    )
    const pill = influencePill()
    expect(pill.getAttribute('title')).toContain(INFLUENCE_STRUCTURAL_BASIS_NOTE)
    expect(pill.getAttribute('aria-label')).toContain(INFLUENCE_STRUCTURAL_BASIS_NOTE)
  })

  it('renders no structural note when the stamp is absent', () => {
    render(<MetricPills influencePct={62} influenceProvenance="influence_score" />)
    const pill = influencePill()
    expect(pill.getAttribute('title')).not.toContain(INFLUENCE_STRUCTURAL_BASIS_NOTE)
  })
})
