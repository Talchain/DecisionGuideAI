/**
 * SENDABLE trust defect — the Drivers panel disagreed with its own numbers.
 *
 * WITNESSED (UX-gate re-run 2026-08-19T22:01–22:38Z, deployed UI `ad79b344`,
 * fresh guest, real brief, real analysis), on ONE screen, in ONE run:
 *
 *   • THREE factors each displaying **Influence 100%**, badged respectively
 *     "Top driver", "High-impact driver" and "Lower influence".
 *   • "Both factors have similar influence on the outcome." printed under a
 *     section headed **4**.
 *
 * ROOT CAUSE — TWO DIFFERENT NUMBERS ON ONE ROW. The bar, the order and the
 * percentage all read `displayInfluence` (the `driverDisplayModel` policy).
 * The BADGE read `normalisedInfluence` — |elasticity| / max|elasticity|, a
 * second, unrelated basis. Under complete producer coverage the two diverge
 * freely, so a factor the panel prints at 100% can carry an elasticity share
 * of 0.1 and be badged "Lower influence" beside its own 100% bar.
 *
 * `driverDisplayModel.ts` had ALREADY declared the correct policy in its own
 * header — "the order, the rank-1 crown, and the bar must all follow the SAME
 * number" — and the crown/threshold half simply never moved there. So this is
 * not a new rule: it is the existing canonical owner finally owning the badge.
 *
 * SECOND CAUSE — THE CROWN IGNORES TIES. Rank 1 was crowned unconditionally
 * ("Rank 1 always gets 'biggest' (ensures uniqueness)"). At a tie the rank is
 * decided by the comparator's elasticity/key tie-breaks — invisible to the
 * user — so one of several equal factors is crowned "Top driver" and the rest
 * are demoted, on identical displayed numbers. Uniqueness of the BADGE was
 * bought by inventing a distinction the data does not contain.
 *
 * THIRD — THE COUNT WORD. "Both factors" is hard-coded, while the note fires
 * whenever ALL visible drivers are within the tie epsilon, however many there
 * are. Deriving a count here cannot fix it either: the note ranges over
 * `visibleDrivers` and the heading counts the non-zero-impact total, so any
 * derived count can still contradict the heading beside it. Count-free copy
 * cannot contradict any heading by construction.
 *
 * CONVERGENCE (Paul's binding rule). Canonical owner named:
 * `driverDisplayModel` owns the display value AND the label derived from it,
 * in `resolveDriverSemanticLabels`. Competitor superseded:
 * `getSemanticLabel(rank, normalisedInfluence)` is deleted, not wrapped, so
 * the second basis is no longer reachable. One tie epsilon
 * (`INFLUENCE_TIE_EPSILON`) replaces the literal that was inlined at the note.
 *
 * Trap-19 identity binding: every panel assertion locates its badge by the
 * row's own `factorKey` testid, never by a value predicate another row shares
 * — which matters especially here, where the rows carry EQUAL values.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import {
  INFLUENCE_TIE_EPSILON,
  resolveDriverSemanticLabels,
} from '../driverDisplayModel'
import { DriversSection } from '../DriversSection'
import { TriageActionCardsBody } from '../TriageActionCardsBody'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import type { DriversSectionData, DriverItem } from '../types'

vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
}))

function makeDriver(overrides: Partial<DriverItem> & { factorKey: string }): DriverItem {
  return {
    factorLabel: overrides.factorKey,
    rawElasticity: 0.5,
    normalisedInfluence: 0.8,
    influenceScore: 0.8,
    rank: 1,
    semanticLabel: 'biggest',
    canFocus: false,
    direction: 'positive',
    ...overrides,
  }
}

function makeData(drivers: DriverItem[], totalCount?: number): DriversSectionData {
  return {
    drivers,
    topDrivers: drivers.slice(0, 3),
    driversStatus: 'computed',
    totalCount: totalCount ?? drivers.length,
    hasMagnitudeData: true,
  }
}

// =============================================================================
// The badge is derived from the number printed beside it
// =============================================================================

describe('resolveDriverSemanticLabels — one number decides the bar and the badge', () => {
  it('THE WITNESSED ROW: three factors tied at the top share one badge, none crowned', () => {
    const labels = resolveDriverSemanticLabels([
      { key: 'cloud_migration_progress', value: 1 },
      { key: 'licence_cost', value: 1 },
      { key: 'team_capacity', value: 1 },
    ])
    // Bound by key identity — the whole point is that the VALUES cannot
    // distinguish these rows, so a value predicate would prove nothing.
    expect(labels.get('cloud_migration_progress')).toBe('strong')
    expect(labels.get('licence_cost')).toBe('strong')
    expect(labels.get('team_capacity')).toBe('strong')
    // No row may be crowned when the top is not unique.
    expect([...labels.values()]).not.toContain('biggest')
  })

  it('a UNIQUE top is still crowned — the tie rule does not cost us the crown', () => {
    const labels = resolveDriverSemanticLabels([
      { key: 'clear_leader', value: 1 },
      { key: 'second', value: 0.4 },
      { key: 'third', value: 0.1 },
    ])
    expect(labels.get('clear_leader')).toBe('biggest')
    expect(labels.get('second')).toBe('moderate')
    expect(labels.get('third')).toBe('minor')
  })

  it('a near-tie inside the epsilon is a tie; just outside it is not', () => {
    const tied = resolveDriverSemanticLabels([
      { key: 'a', value: 1 },
      { key: 'b', value: 1 - INFLUENCE_TIE_EPSILON / 2 },
    ])
    expect(tied.get('a')).not.toBe('biggest')

    const clear = resolveDriverSemanticLabels([
      { key: 'a', value: 1 },
      { key: 'b', value: 1 - INFLUENCE_TIE_EPSILON * 2 },
    ])
    expect(clear.get('a')).toBe('biggest')
  })

  it('the badge reads the DISPLAY value it is given, never a second basis', () => {
    // The witnessed shape: a factor the panel prints at 100% must not be
    // badged from some other number that happens to be small.
    const labels = resolveDriverSemanticLabels([
      { key: 'printed_at_100pct', value: 1 },
      { key: 'runner_up', value: 0.9 },
    ])
    expect(labels.get('printed_at_100pct')).not.toBe('minor')
    expect(labels.get('runner_up')).not.toBe('minor')
  })

  it('a single driver is crowned, and an empty set yields nothing', () => {
    expect(resolveDriverSemanticLabels([{ key: 'only', value: 0.05 }]).get('only')).toBe('biggest')
    expect(resolveDriverSemanticLabels([]).size).toBe(0)
  })
})

// =============================================================================
// The panel's own copy cannot contradict the heading beside it
// =============================================================================

describe('DriversSection — the equal-influence note states no count', () => {
  it('does not say "Both" when four factors are tied', () => {
    render(
      <DriversSection
        data={makeData(
          [
            makeDriver({ factorKey: 'f1', semanticLabel: 'strong', influenceScore: 1, normalisedInfluence: 1 }),
            makeDriver({ factorKey: 'f2', semanticLabel: 'strong', influenceScore: 1, normalisedInfluence: 1 }),
            makeDriver({ factorKey: 'f3', semanticLabel: 'strong', influenceScore: 1, normalisedInfluence: 1 }),
            makeDriver({ factorKey: 'f4', semanticLabel: 'strong', influenceScore: 1, normalisedInfluence: 1 }),
          ],
          4,
        )}
        goalLabel="test"
      />,
    )
    expect(screen.queryByText(/Both factors/i)).not.toBeInTheDocument()
    expect(screen.getByText(/similar influence on the outcome/i)).toBeInTheDocument()
  })

  it('says the same count-free sentence for exactly two tied factors', () => {
    render(
      <DriversSection
        data={makeData([
          makeDriver({ factorKey: 'f1', semanticLabel: 'strong', influenceScore: 1, normalisedInfluence: 1 }),
          makeDriver({ factorKey: 'f2', semanticLabel: 'strong', influenceScore: 1, normalisedInfluence: 1 }),
        ])}
        goalLabel="test"
      />,
    )
    expect(screen.getByText(/similar influence on the outcome/i)).toBeInTheDocument()
    expect(screen.queryByText(/Both factors/i)).not.toBeInTheDocument()
  })

  // ── OPPOSITE-DIRECTION TWIN ────────────────────────────────────────────
  // The note is genuinely useful when the factors ARE alike. Making it
  // count-free must not make it fire when they are not.
  it('TWIN — the note stays absent when the factors genuinely differ', () => {
    render(
      <DriversSection
        data={makeData([
          makeDriver({ factorKey: 'f1', semanticLabel: 'biggest', influenceScore: 1, normalisedInfluence: 1 }),
          makeDriver({ factorKey: 'f2', semanticLabel: 'minor', influenceScore: 0.1, normalisedInfluence: 0.1 }),
        ])}
        goalLabel="test"
      />,
    )
    expect(screen.queryByText(/similar influence on the outcome/i)).not.toBeInTheDocument()
  })
})

// =============================================================================
// "Dominant" is a comparative claim — a tie cannot support one
// =============================================================================

describe('T1 dominance nudge — no dominance claim without a margin', () => {
  function triageData(drivers: DriverItem[]) {
    return {
      drivers: {
        ...makeData(drivers),
        dominantFactorId: drivers[0]?.factorKey,
        dominantFactorLabel: drivers[0]?.factorLabel,
      },
      // Minimal siblings the body reads on its way to the nudge. Only the
      // nudge is under test here; every other card is deliberately empty.
      recommendation: { recommendedOption: null },
      confidence: { recommendedOptionId: undefined },
      assumptions: { items: [] },
      gaps: { items: [] },
      risks: { items: [] },
    } as unknown as ResultsSectionDataReturn
  }

  const tiedAtTop = [
    makeDriver({
      factorKey: 'cloud_migration_progress',
      factorLabel: 'Cloud migration progress',
      semanticLabel: 'strong',
      influenceScore: 1,
      normalisedInfluence: 1,
      displayInfluence: 1,
      displayProvenance: 'influence_score',
    }),
    makeDriver({
      factorKey: 'licence_cost',
      factorLabel: 'Licence cost',
      semanticLabel: 'strong',
      influenceScore: 1,
      normalisedInfluence: 1,
      displayInfluence: 1,
      displayProvenance: 'influence_score',
    }),
  ]

  it('THE WITNESSED CLAIM: no factor is called dominant while another reads the same', () => {
    render(<TriageActionCardsBody data={triageData(tiedAtTop)} suppressTriageQueue />)
    expect(screen.queryByTestId('t1-dominant-nudge')).not.toBeInTheDocument()
    expect(screen.queryByText(/Dominant factor/i)).not.toBeInTheDocument()
  })

  // ── OPPOSITE-DIRECTION TWIN ────────────────────────────────────────────
  // The nudge is the useful warning that one assumption carries the result.
  // Requiring a margin must not silence it when the margin is real.
  it('TWIN — a genuinely dominant factor is still named', () => {
    const clearlyDominant = [
      makeDriver({
        factorKey: 'cloud_migration_progress',
        factorLabel: 'Cloud migration progress',
        semanticLabel: 'biggest',
        influenceScore: 1,
        normalisedInfluence: 1,
        displayInfluence: 1,
        displayProvenance: 'influence_score',
      }),
      makeDriver({
        factorKey: 'licence_cost',
        factorLabel: 'Licence cost',
        semanticLabel: 'minor',
        influenceScore: 0.15,
        normalisedInfluence: 0.15,
        displayInfluence: 0.15,
        displayProvenance: 'influence_score',
      }),
    ]
    render(<TriageActionCardsBody data={triageData(clearlyDominant)} suppressTriageQueue />)
    expect(screen.getByTestId('t1-dominant-nudge')).toBeInTheDocument()
    expect(screen.getByText(/Dominant factor/i)).toBeInTheDocument()
  })
})
