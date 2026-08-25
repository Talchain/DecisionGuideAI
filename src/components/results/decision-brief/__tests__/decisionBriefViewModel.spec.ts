import { describe, expect, it } from 'vitest'
import { readDecisionBriefViewModel } from '../decisionBriefViewModel'

const WITHHELD_LIVE_PROJECTION = {
  brief_id: '50d0209b-6cfa-4b6a-a22b-84c94a80c06e',
  version: '1',
  created_at: '2026-08-25T08:16:07.476Z',
  options: [
    { option_id: 'opt_cro', label: 'Hire CRO Above VP of Sales', win_probability: 0.548 },
    { option_id: 'opt_coach', label: 'Coach VP for 90 Days', win_probability: 0.2865 },
  ],
  top_drivers: [
    { factor_label: 'October Product Launch Readiness', sensitivity: 1, direction: 'positive' },
    { factor_label: 'VP Enterprise Sales Scalability', sensitivity: 0.955, direction: 'positive' },
  ],
  key_assumptions: ['October Product Launch Readiness', 'VP Enterprise Sales Scalability'],
  what_would_change: [
    'October Product Launch Readiness → ARR Growth Trajectory',
    'ARR Growth Trajectory → Grow ARR to £6m by June 2027',
  ],
  warnings: [
    {
      code: 'CONSTRAINT_OUT_OF_DOMAIN',
      message: 'Constraint gc-e9543857-e145-4ed5-a729-905529d9b0dd targets risk node "risk_ae_attrition" with threshold 2 outside [0,1] range',
      severity: 'warning',
    },
    {
      code: 'INFLUENTIAL_EXTERNALS',
      message: 'External factors significantly affect your outcome but are inherently uncertain.',
      severity: 'warning',
    },
    {
      code: 'M2_UNAVAILABLE',
      message: 'Decision review was unavailable; brief uses deterministic coaching fallback',
      severity: 'warning',
    },
  ],
  analysis_summary: { robustness_band: 'fragile' },
}

describe('readDecisionBriefViewModel', () => {
  it('reads only the licensed non-leader groups from the live withheld V1 projection', () => {
    const view = readDecisionBriefViewModel(WITHHELD_LIVE_PROJECTION)

    expect(view).toEqual({
      topDrivers: [
        { label: 'October Product Launch Readiness' },
        { label: 'VP Enterprise Sales Scalability' },
      ],
      keyAssumptions: WITHHELD_LIVE_PROJECTION.key_assumptions,
      whatWouldChange: WITHHELD_LIVE_PROJECTION.what_would_change,
      // Present and empty on this capture — the 25 Aug live wire carries the key
      // with zero entries, which is a real producer state, not an absence.
      defaultedAssumptions: [],
    })

    // The projection carries probabilities, but this reader has no field from
    // which a caller could reconstruct a leader or confidence claim.
    expect(view).not.toHaveProperty('options')
    expect(view).not.toHaveProperty('headline')
    expect(view).not.toHaveProperty('robustness')
    expect(view).not.toHaveProperty('warnings')
  })

  it('never re-admits opaque nested warning rows, even when a UI template exists for the code', () => {
    const view = readDecisionBriefViewModel({
      ...WITHHELD_LIVE_PROJECTION,
      warnings: [
        WITHHELD_LIVE_PROJECTION.warnings[0],
      ],
    })

    expect(view).not.toHaveProperty('warnings')
    expect(view?.topDrivers).toHaveLength(2)
  })

  it('fails identity/version closed and never treats a similarly named object as this artefact', () => {
    expect(readDecisionBriefViewModel({ ...WITHHELD_LIVE_PROJECTION, version: '2' })).toBeNull()
    expect(readDecisionBriefViewModel({ ...WITHHELD_LIVE_PROJECTION, brief_id: 'exported-brief' })).toBeNull()
    expect(readDecisionBriefViewModel({ ...WITHHELD_LIVE_PROJECTION, created_at: 'today' })).toBeNull()
    expect(readDecisionBriefViewModel({ ...WITHHELD_LIVE_PROJECTION, created_at: '2026-99-99T99:99:99Z' })).toBeNull()
    expect(readDecisionBriefViewModel({ ...WITHHELD_LIVE_PROJECTION, created_at: '2026-02-31T08:16:07.000Z' })).toBeNull()
    expect(readDecisionBriefViewModel(null)).toBeNull()
  })

  /**
   * ⚠ THIS TEST'S EXPECTATION WAS THE DEFECT, and is corrected here rather than
   * deleted. It asserted `topDrivers === []` when row 1 was VALID and row 2 was
   * malformed — i.e. it pinned "one bad row empties the whole category", which
   * is exactly the behaviour cross-review flagged as suppressing valid siblings.
   * Its title already said "preserving valid siblings"; it only ever preserved
   * the sibling CATEGORIES, never the valid rows inside the affected one.
   *
   * The corrected rule is a PREFIX: ordering is meaningful, so a malformed row
   * ends the list rather than being filtered out of the middle (which would
   * silently re-rank what follows) and rather than emptying it (which discards
   * true rows for one bad one). Every row shown holds its real rank.
   *
   * The single-bad-row cases below are unchanged and still pass: when the only
   * row is unusable the category is still empty. This change is strictly less
   * destructive, never more permissive.
   */
  it('truncates a ranked category at the first malformed row, keeping valid leading rows', () => {
    const view = readDecisionBriefViewModel({
      ...WITHHELD_LIVE_PROJECTION,
      top_drivers: [
        WITHHELD_LIVE_PROJECTION.top_drivers[0],
        { factor_label: 'Unlicensed row', sensitivity: 'high', direction: 'positive' },
      ],
    })

    expect(view?.topDrivers).toEqual([
      { label: WITHHELD_LIVE_PROJECTION.top_drivers[0].factor_label },
    ])
    expect(view?.keyAssumptions).toEqual(WITHHELD_LIVE_PROJECTION.key_assumptions)
    expect(view?.whatWouldChange).toEqual(WITHHELD_LIVE_PROJECTION.what_would_change)
  })

  it.each([
    ['top drivers', {
      top_drivers: [{ factor_label: 'factor_launch_readiness', sensitivity: 1, direction: 'positive' }],
    }, 'topDrivers'],
    ['key assumptions', {
      key_assumptions: ['risk_ae_attrition'],
    }, 'keyAssumptions'],
    ['what would change', {
      what_would_change: ['out_headcount_growth → goal_x'],
    }, 'whatWouldChange'],
  ] as const)('fails ID-shaped %s closed while preserving valid siblings', (_name, override, key) => {
    const view = readDecisionBriefViewModel({
      ...WITHHELD_LIVE_PROJECTION,
      ...override,
    })

    expect(view?.[key]).toEqual([])
    expect(view).not.toBeNull()
  })

  it('also rejects UUID, graph-constraint, and opaque-hex identifier shapes', () => {
    const view = readDecisionBriefViewModel({
      ...WITHHELD_LIVE_PROJECTION,
      top_drivers: [
        { factor_label: 'gc-e9543857-e145-4ed5-a729-905529d9b0dd', sensitivity: 1, direction: 'positive' },
      ],
      key_assumptions: ['50d0209b-6cfa-4b6a-a22b-84c94a80c06e'],
      what_would_change: ['95ba57a8 → e25cc9aa'],
    })

    expect(view).toBeNull()
  })

  it('preserves producer order and prose bytes without ranking or rewriting them', () => {
    const view = readDecisionBriefViewModel(WITHHELD_LIVE_PROJECTION)

    expect(view?.topDrivers.map(driver => driver.label)).toEqual([
      'October Product Launch Readiness',
      'VP Enterprise Sales Scalability',
    ])
    expect(view?.whatWouldChange).toEqual([
      'October Product Launch Readiness → ARR Growth Trajectory',
      'ARR Growth Trajectory → Grow ARR to £6m by June 2027',
    ])
  })

  it('returns no surface when none of the licensed categories is usable', () => {
    expect(readDecisionBriefViewModel({
      brief_id: WITHHELD_LIVE_PROJECTION.brief_id,
      version: '1',
      created_at: WITHHELD_LIVE_PROJECTION.created_at,
      top_drivers: [],
      key_assumptions: [],
      what_would_change: [],
      warnings: WITHHELD_LIVE_PROJECTION.warnings,
    })).toBeNull()
  })
})
