/**
 * The glance's CONDITION LINE — what the reading rests on.
 *
 * The claim under test is an honesty claim, so the load-bearing cases are the
 * ones where the line must NOT appear. A version of this feature that defaulted
 * silence to "you supplied these figures" would pass every positive test here
 * and would be the exact lie the producer's three-state flag exists to prevent;
 * the negatives below are what separate the two.
 *
 * ⚠ EVERY ASSERTION BINDS BY IDENTITY — the `analysis-new-glance-input-provenance`
 * testid and the `data-input-provenance` attribute — never by searching the
 * panel for a phrase. Several other elements on this surface are prose in the
 * same style, and a text match would pass on any of them.
 */

import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { AtAGlance } from '../sections/AtAGlance'
import { GLANCE_PROVENANCE_COPY } from '../glanceProvenanceCopy'
import type { AtAGlance as AtAGlanceModel, GlanceInputProvenance } from '../analysisNewTypes'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import { buildNodeValueSourceMap } from '../../driverValueProvenance'
import { genuineDecision, makeData, makeDriver } from './analysisNewFixtures'
import codexExport from '../../../../canvas/registration/__tests__/fixtures/codex-export-2026-08-05.canvas.json'

const PROVENANCE_TESTID = 'analysis-new-glance-input-provenance'

const provenanceOf = (
  data: ResultsSectionDataReturn,
  nodeValueSources?: ReadonlyMap<string, string>,
) =>
  buildAnalysisNewViewModel({
    data,
    recommendations: [],
    isPreRun: false,
    isRunning: false,
    isStale: false,
    nodeValueSources,
  }).atAGlance.inputProvenance

/**
 * A run of N factor rows whose NODES carry exactly these sources.
 *
 * ⚠ THE SOURCE SITS ON THE NODE, NOT THE ROW, AND THAT IS THE POINT OF THE
 * CHANGE. The analysis result carries no `observed_state` at all; authorship is
 * canvas state, joined by factor id. `undefined` means the node exists with no
 * source — silence, which must never resolve to either claim.
 */
const withSources = (rows: Array<string | undefined>) => {
  const data = makeData({
    drivers: {
      drivers: rows.map((_, i) =>
        makeDriver({ factorKey: `f_${i}`, factorLabel: `Factor ${i}` }),
      ),
    },
  })
  const sources = new Map<string, string>()
  rows.forEach((s, i) => {
    if (s) sources.set(`f_${i}`, s)
  })
  return { data, sources }
}
const pv = (rows: Array<string | undefined>) => {
  const { data, sources } = withSources(rows)
  return provenanceOf(data, sources)
}

afterEach(() => cleanup())

// ── THE DERIVATION ──────────────────────────────────────────────────────────

describe('input provenance — the node settles it, or nothing is claimed', () => {
  it('⭐ says undetermined when no node carries a source', () => {
    expect(pv([undefined, undefined])).toBe('undetermined')
  })

  it('is null ONLY when there are no factor rows at all', () => {
    // Not a provenance state. `useResultsSectionData` downgrades driversStatus
    // 'computed' -> 'unavailable' whenever the row set is empty, so zero rows
    // always means the sensitivity feed failed — a transport condition.
    expect(pv([])).toBeNull()
  })

  it('reads a producer estimate as estimated', () => {
    expect(pv(['cee_inference'])).toBe('estimated')
  })

  it('⭐ says user_supplied only when every row is a user-owned source', () => {
    expect(pv(['user_confirmed', 'user_override'])).toBe('user_supplied')
  })

  it('says mixed when one of each is positively witnessed', () => {
    expect(pv(['cee_inference', 'user_confirmed'])).toBe('mixed')
    // Silence on a third row cannot falsify an existential pair.
    expect(pv(['cee_inference', 'user_confirmed', undefined])).toBe('mixed')
  })

  it('demotes a universal claim to "partly" when any row is unsettled', () => {
    expect(pv(['cee_inference', undefined])).toBe('partly_estimated')
    expect(pv(['user_confirmed', undefined])).toBe('partly_user_supplied')
  })

  it('⭐ brief extraction settles NOTHING — it is neither claim', () => {
    // THE RULING-PENDING CASE, and the discriminating twin for it. A rule that
    // read `brief_extraction` as the user's figure would say `user_supplied`
    // here; one that read it as Olumi's would say `estimated`. It is neither.
    expect(pv(['brief_extraction'])).toBe('undetermined')
    expect(pv(['brief_extraction', 'cee_inference'])).toBe('partly_estimated')
    expect(pv(['brief_extraction', 'user_confirmed'])).toBe('partly_user_supplied')
  })

  it('⭐ a literal the shared map does not know settles nothing either', () => {
    expect(pv(['some_future_literal'])).toBe('undetermined')
    expect(pv(['some_future_literal', 'cee_inference'])).toBe('partly_estimated')
  })

  it('⭐ never says undetermined once a single row is settled', () => {
    expect(pv(['cee_inference', undefined])).not.toBe('undetermined')
    expect(pv(['user_confirmed', undefined])).not.toBe('undetermined')
  })

  it('⭐ no longer reads the bootstrap-degeneracy signal at all', () => {
    // THE DEFECT THIS CHANGE CLOSES. `isDefaultedConfidence` answers whether the
    // CONFIDENCE was a placeholder, never who authored the VALUE. A row carrying
    // it, with a node that says the value is the user's, must read as the
    // user's — under the old expression it read as Olumi's.
    const data = makeData({
      drivers: {
        drivers: [
          makeDriver({
            factorKey: 'fac_switch_cost',
            factorLabel: 'Switching cost',
            isDefaultedConfidence: true,
            valueDefaulted: true,
          }),
        ],
      },
    })
    expect(provenanceOf(data, new Map([['fac_switch_cost', 'user_confirmed']]))).toBe('user_supplied')
  })

  it('counts a zero-influence factor as an input like any other', () => {
    // Provenance is a fact about where a number came from. Making it depend on
    // influence would let an unrelated quantity decide an honesty claim.
    expect(
      provenanceOf(
        makeData({
          drivers: {
            drivers: [
              makeDriver({
                factorKey: 'f_zero',
                factorLabel: 'Zero factor',
                zeroReason: 'zero_outcome_diff',
              }),
            ],
          },
        }),
        new Map([['f_zero', 'cee_inference']]),
      ),
    ).toBe('estimated')
  })

  it('reads the standing decision fixture as undetermined — no nodes, no claim', () => {
    expect(provenanceOf(genuineDecision())).toBe('undetermined')
  })
})

// ── THE WIRE ────────────────────────────────────────────────────────────────

/**
 * ⭐⭐ BOUND TO A REAL EXPORTED GRAPH, NOT A FIXTURE THIS LANE WROTE.
 * Trap 16-inverse: a self-authored fixture encodes the author's model of the
 * producer rather than the producer.
 */
describe('the branch a real exported graph lands in', () => {
  const sources = buildNodeValueSourceMap((codexExport as { nodes: unknown[] }).nodes)
  const rowsFor = (ids: string[]) =>
    makeData({
      drivers: {
        drivers: ids.map((id, i) => makeDriver({ factorKey: id, factorLabel: `Factor ${i}` })),
      },
    })

  it('POSITIVE CONTROL — the export really does carry the two literals', () => {
    expect(sources.get('fac_conversion_rate')).toBe('cee_inference')
    expect(sources.get('fac_budget_spend')).toBe('brief_extraction')
  })

  it('⭐ a run of Olumi-inferred factors says so', () => {
    expect(provenanceOf(rowsFor(['fac_conversion_rate', 'fac_lead_volume']), sources))
      .toBe('estimated')
  })

  it('⭐ adding the brief-extracted factor demotes it to partly — same payload', () => {
    // The pair, at the glance level: two real ids from one real export moving
    // the sentence in opposite directions.
    expect(provenanceOf(rowsFor(['fac_conversion_rate', 'fac_budget_spend']), sources))
      .toBe('partly_estimated')
  })

  it('⭐ the brief-extracted factor alone claims nothing', () => {
    expect(provenanceOf(rowsFor(['fac_budget_spend']), sources)).toBe('undetermined')
  })
})

// ── THE COPY ────────────────────────────────────────────────────────────────

describe('the sanctioned sentences', () => {
  // A HAND-WRITTEN corpus, not an iteration of the map: iterating the map would
  // only prove the map agrees with itself and could never notice a missing or
  // reworded kind (CLAUDE.md trap 12d).
  it('states each kind exactly, and states no number', () => {
    expect(GLANCE_PROVENANCE_COPY.estimated).toBe('On inputs Olumi estimated')
    expect(GLANCE_PROVENANCE_COPY.partly_estimated).toBe('Partly on inputs Olumi estimated')
    expect(GLANCE_PROVENANCE_COPY.mixed).toBe("On a mix of your figures and Olumi's estimates")
    expect(GLANCE_PROVENANCE_COPY.user_supplied).toBe('On figures you supplied')
    expect(GLANCE_PROVENANCE_COPY.partly_user_supplied).toBe('Partly on figures you supplied')
    expect(GLANCE_PROVENANCE_COPY.undetermined).toBe(
      'On inputs whose source Olumi could not establish',
    )
  })

  it('contains no digit in any kind — the producer supplies a flag, not a proportion', () => {
    for (const sentence of Object.values(GLANCE_PROVENANCE_COPY)) {
      expect(sentence).not.toMatch(/\d/)
    }
  })

  it('⭐ the undetermined sentence attributes the figures to NOBODY', () => {
    // The load-bearing property, and the reason this kind may render where the
    // other five are gated: it reports our own knowledge. The moment it names
    // the reader as author it becomes the exact claim the module exists to
    // prevent — and it would then be a claim made on NO evidence at all.
    const s = GLANCE_PROVENANCE_COPY.undetermined
    expect(s).not.toMatch(/\byou\b|\byour\b|\byours\b/i)
    expect(s).not.toMatch(/\bsupplied\b|\bestimated\b/i)
  })
})

// ── THE RENDER ──────────────────────────────────────────────────────────────

const glanceModel = (
  inputProvenance: GlanceInputProvenance | null,
  overrides: Partial<AtAGlanceModel> = {},
): AtAGlanceModel => ({
  headline: 'Raise price currently scores higher',
  leaderLabel: 'Raise price',
  winShare: 'Ahead in 68% of simulated futures',
  winPercentLabel: '68%',
  winFraction: 0.68,
  comparisonScope: { kind: 'whole_set' },
  comparativeClaim: 'value',
  verdict: { tone: 'stable', label: 'Stable' },
  drivers: [{ id: 'a', label: 'Price elasticity', fraction: 1, targetId: null }],
  influenceIsSetRelative: false,
  condition: null,
  inputProvenance,
  primaryInterventionId: null,
  ...overrides,
})

describe('the condition line on screen', () => {
  it('renders the sentence, tagged with the kind it came from', () => {
    render(<AtAGlance glance={glanceModel('estimated')} />)
    const line = screen.getByTestId(PROVENANCE_TESTID)
    expect(line).toHaveAttribute('data-input-provenance', 'estimated')
    expect(line).toHaveTextContent('On inputs Olumi estimated')
  })

  it('renders the mixed sentence under its own kind', () => {
    // The discriminating pair: a render bound to the model rather than to one
    // hardcoded string would fail here.
    render(<AtAGlance glance={glanceModel('mixed')} />)
    const line = screen.getByTestId(PROVENANCE_TESTID)
    expect(line).toHaveAttribute('data-input-provenance', 'mixed')
    expect(line).toHaveTextContent("On a mix of your figures and Olumi's estimates")
  })

  it('⭐ renders the undetermined sentence beside the share it conditions', () => {
    // THE SHIPPED BEHAVIOUR. A reader who sees "Ahead in 68% of simulated
    // futures" now also sees, without interaction, that its basis was never
    // established. This is the case that used to render nothing.
    render(<AtAGlance glance={glanceModel('undetermined')} />)
    const line = screen.getByTestId(PROVENANCE_TESTID)
    expect(line).toHaveAttribute('data-input-provenance', 'undetermined')
    expect(line).toHaveTextContent('On inputs whose source Olumi could not establish')
    expect(screen.getByTestId('analysis-new-glance-win-share')).toBeVisible()
    expect(line).toBeVisible()
  })

  it('⭐ renders NOTHING when there is no provenance model at all', () => {
    // The other direction, and the one that matters. No fallback, no hedge, no
    // element at all — with no factor rows there is nothing to describe, and a
    // sentence about a set the producer never returned would be invented.
    render(<AtAGlance glance={glanceModel(null)} />)
    expect(screen.queryByTestId(PROVENANCE_TESTID)).toBeNull()
  })

  it('does not render an orphan caveat when there is no reading to condition', () => {
    render(
      <AtAGlance
        glance={glanceModel('estimated', {
          headline: null,
          leaderLabel: null,
          winShare: null,
          winPercentLabel: null,
          winFraction: null,
          comparativeClaim: 'none',
          verdict: null,
          drivers: [],
        })}
        primaryIntervention={{ id: 'r1', label: 'Define success', why: 'because' }}
        onRunIntervention={() => {}}
      />,
    )
    expect(screen.queryByTestId(PROVENANCE_TESTID)).toBeNull()
  })

  it('states no number in the rendered line', () => {
    render(<AtAGlance glance={glanceModel('partly_estimated')} />)
    expect(screen.getByTestId(PROVENANCE_TESTID).textContent ?? '').not.toMatch(/\d/)
  })

  it('sits beside the share it conditions, not behind a disclosure', () => {
    // Both in the same panel, both visible without interaction. A reader who
    // sees the percentage must see what it rests on.
    render(<AtAGlance glance={glanceModel('estimated')} />)
    expect(screen.getByTestId('analysis-new-glance-win-share')).toBeVisible()
    expect(screen.getByTestId(PROVENANCE_TESTID)).toBeVisible()
  })
})
