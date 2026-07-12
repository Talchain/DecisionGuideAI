/**
 * Hero fixture gallery models — INTERNAL ONLY.
 *
 * Typed, hand-authored HeroChartModel/HeroStatusModel objects rendering the
 * FULL prototype surface (all four lenses, ghost marks, trust/status/named-
 * action slots, rich detail) so the complete hero UI can be reviewed before
 * the producer fields that feed it exist.
 *
 * Safeguards (do not weaken):
 *   - Every model here is branded `provenance: 'fixture'` — the panel
 *     renders a visible internal-preview banner for that brand, so fixture
 *     data can never be mistaken for real analysis output.
 *   - `buildHeroModel` is the ONLY producer of 'live' models; nothing in
 *     this file (or its consumers) can reach the live adapter path.
 *   - This module may be imported ONLY by the gallery route
 *     (src/routes/HeroGallery.tsx) and the module's own tests — enforced by
 *     __tests__/fixtureIsolation.spec.ts. Normal product routes never see it.
 *   - Strings that simulate producer text (trust line, status chip,
 *     stability labels, narratives) are DATA here, exactly as producer text
 *     would be — they are not UI-authored copy and never move to heroCopy.
 */
import type { HeroChartModel, HeroRowVM, HeroStatusModel } from '../heroTypes'

// ─── Builders (defaults keep each state definition small) ───────────────────

type RowOverrides = Partial<HeroRowVM> & { id: string; label: string; index: number }

function fixtureRow(o: RowOverrides): HeroRowVM {
  return {
    goal: { value: null, readout: '—' },
    outcome: { p10: null, p90: null, centre: null, readout: '—' },
    detail: {},
    // Fixtures have no numbering store; the badge falls back to index.
    stableNumber: null,
    ...o,
  }
}

function fixtureChart(o: Partial<HeroChartModel>): HeroChartModel {
  return {
    kind: 'chart',
    provenance: 'fixture',
    headline: 'Here is how your options compare.',
    subline: null,
    lenses: ['outcome'],
    defaultLens: 'outcome',
    hasConstraints: false,
    rows: [],
    leaders: { goal: null, outcome: null, stability: null, whatChanged: null },
    outcomeDomain: null,
    outcomeRangedRowCount: 0,
    showGoalHint: false,
    mainReason: null,
    quickLinks: { mainDriver: null, topFlipRisk: null },
    trustLine: null,
    statusChip: null,
    focusAction: null,
    targetUnit: null,
    ...o,
  }
}

// ─── Shared rich option set (echoes the staging Tech Lead scenario) ─────────
//
// Row ORDER (and the 1..4 number tokens) follow the SHARED display comparator
// — win probability descending: 77% > 15% > 6% > 2% (see each row's
// detail.winChance). It is deliberately NOT the active lens: rows 3 and 4
// read "11% / 22% fit" on Goal fit and "+4% / +6%" on Likely outcome — i.e.
// row 4 sits ABOVE row 3 on both lenses, yet ranks 4th because it wins least
// often. This mirrors what the live adapter produces (buildHeroModel ->
// sortOptionsForDisplay, the same comparator OptionCards/WinGauge use) and is
// pinned by buildHeroModel.spec + stagingScenario.spec. Per-lens values are
// expected to appear out of descending order here — that is the point, not a
// broken ranking. Keep the win probabilities monotonically descending so the
// fixture stays coherent with the order it renders.
const RICH_ROWS: HeroRowVM[] = [
  fixtureRow({
    id: 'fx_tech_lead',
    index: 1,
    label: 'Hire One Tech Lead',
    goal: { value: 0.62, readout: '62%' },
    outcome: {
      p10: -1,
      p90: 45,
      centre: 22,
      readout: '+22%',
      previous: { p10: -6, p90: 38, centre: 16 },
    },
    changeReadout: '+22% (was +16%)',
    stability: { value: 0.86, readout: 'Firm' },
    detail: {
      why: 'Strong technical leadership compounds across every other factor.',
      watch: 'Onboarding time could delay the first quarter of impact.',
      tradeOff: 'Highest salary cost of the options compared.',
      couldChangeIf: 'Current Team Technical Maturity crosses 70%.',
      winChance: '77% chance it is the strongest option overall.',
      range: 'Realistic range: -1% to +45%.',
      goalFit: '62% chance of hitting your goal.',
    },
  }),
  fixtureRow({
    id: 'fx_two_devs',
    index: 2,
    label: 'Hire Two Developers',
    goal: { value: 0.34, readout: '34%' },
    outcome: {
      p10: -5,
      p90: 25,
      centre: 8,
      readout: '+8%',
      previous: { p10: -8, p90: 22, centre: 6 },
    },
    changeReadout: '+8% (was +6%)',
    stability: { value: 0.55, readout: 'Moderate' },
    detail: {
      why: 'More capacity helps only after the current bottleneck clears.',
      winChance: '15% chance it is the strongest option overall.',
      range: 'Realistic range: -5% to +25%.',
      goalFit: '34% chance of hitting your goal.',
    },
  }),
  fixtureRow({
    id: 'fx_status_quo',
    index: 3,
    label: 'Keep Current Team (Status Quo)',
    goal: { value: 0.11, readout: '11%' },
    outcome: {
      p10: 1,
      p90: 7,
      centre: 4,
      readout: '+4%',
      previous: { p10: 0, p90: 8, centre: 4 },
    },
    changeReadout: '+4% (no change)',
    stability: { value: 0.31, readout: 'Fragile' },
    detail: {
      winChance: '6% chance it is the strongest option overall.',
      range: 'Realistic range: +1% to +7%.',
      goalFit: '11% chance of hitting your goal.',
    },
  }),
  // Fourth option: checks numbering and row density beyond three, with a
  // long bracketed label exercising the truncation/recovery behaviour.
  fixtureRow({
    id: 'fx_contract_dev',
    index: 4,
    label: 'Hire One Developer (Contract-to-Permanent)',
    goal: { value: 0.22, readout: '22%' },
    outcome: {
      p10: -3,
      p90: 18,
      centre: 6,
      readout: '+6%',
      previous: { p10: -4, p90: 20, centre: 7 },
    },
    changeReadout: '+6% (was +7%)',
    stability: { value: 0.48, readout: 'Moderate' },
    detail: {
      winChance: '2% chance it is the strongest option overall.',
      range: 'Realistic range: -3% to +18%.',
      goalFit: '22% chance of hitting your goal.',
    },
  }),
]

// ─── Gallery entries ─────────────────────────────────────────────────────────

export interface GalleryEntry {
  id: string
  title: string
  /** What this state demonstrates and which producer fields would feed it live. */
  description: string
  model: HeroChartModel | HeroStatusModel
  isStale?: boolean
  /** Render the rerun action as in-flight (spinner, controls disabled). */
  rerunDisabled?: boolean
  /** Render the promoted target action as actionable (no-op apply route). */
  withApplyTarget?: boolean
}

export const GALLERY_ENTRIES: GalleryEntry[] = [
  {
    id: 'full-prototype',
    title: 'Full prototype (all producer fields present)',
    description:
      'Every slot lit: four data-bearing lenses, status chip, trust line, named focus action, ghost marks on What changed, and rich expanded detail (Why / Watch / Trade-off / ranges / goal fit / win). Live unlock: issues 211, 212, 217, 219, 220, 221.',
    model: fixtureChart({
      headline: 'Hire One Tech Lead is most likely to be strongest overall.',
      subline:
        'Hire One Tech Lead has the highest expected outcome. Realistic ranges overlap, so validate the assumptions before deciding.',
      lenses: ['goal', 'outcome', 'stability', 'whatChanged'],
      defaultLens: 'goal',
      rows: RICH_ROWS,
      leaders: {
        goal: 'fx_tech_lead',
        outcome: 'fx_tech_lead',
        stability: 'fx_tech_lead',
        whatChanged: 'fx_tech_lead',
      },
      outcomeDomain: { min: -10, max: 47 },
      outcomeRangedRowCount: 4,
      mainReason: 'Main driver: Current Team Technical Maturity.',
      // Producer-text simulations: em-dash-free (house style; the panel
      // also glyph-guards these slots) and a status consistent with the
      // previous-run marks the What-changed lens draws — a first pass
      // cannot have a previous run.
      trustLine: 'Trust: moderate. 4,000 samples; 2 assumptions still to verify.',
      statusChip: 'Second pass',
      focusAction: 'Focus next: calibrate Current Team Technical Maturity.',
    }),
  },
  {
    id: 'live-parity-goal',
    title: 'Live parity — goal-bearing run (today’s producer fields)',
    description:
      'What staging renders now for a goal-bearing run: Goal fit + Likely outcome carry data; Stability and What changed show their honest unavailable states; no trust/status/named-action producer fields exist, so those slots are empty.',
    model: fixtureChart({
      headline: 'Hire One Tech Lead best fits your goal.',
      subline: 'Hire One Tech Lead also has the strongest expected outcome.',
      lenses: ['goal', 'outcome'],
      defaultLens: 'goal',
      rows: RICH_ROWS.map((r) => ({
        ...r,
        outcome: { ...r.outcome, previous: undefined },
        changeReadout: undefined,
        stability: undefined,
        detail: { ...r.detail, watch: undefined, tradeOff: undefined },
      })),
      leaders: {
        goal: 'fx_tech_lead',
        outcome: 'fx_tech_lead',
        stability: null,
        whatChanged: null,
      },
      outcomeDomain: { min: -10, max: 47 },
      outcomeRangedRowCount: 4,
      mainReason: 'Main driver: Current Team Technical Maturity.',
    }),
  },
  {
    id: 'no-goal-unlock',
    title: 'No success target — single live lens + promoted unlock action',
    description:
      'No target set: only Likely outcome carries data; Goal fit explains how to unlock it and the Focus-next slot carries the actionable set-a-target editor (wired to the real apply-and-rerun route in product).',
    withApplyTarget: true,
    model: fixtureChart({
      headline: 'Hire One Tech Lead is most likely to be strongest overall.',
      subline:
        'Hire One Tech Lead has the highest expected outcome. Realistic ranges overlap, so validate the assumptions before deciding.',
      lenses: ['outcome'],
      defaultLens: 'outcome',
      rows: RICH_ROWS.map((r) => ({
        ...r,
        goal: { value: null, readout: '—' },
        outcome: { ...r.outcome, previous: undefined },
        changeReadout: undefined,
        stability: undefined,
        detail: { ...r.detail, watch: undefined, tradeOff: undefined, goalFit: undefined },
      })),
      leaders: { goal: null, outcome: 'fx_tech_lead', stability: null, whatChanged: null },
      outcomeDomain: { min: -10, max: 47 },
      outcomeRangedRowCount: 4,
      showGoalHint: true,
      mainReason: 'Main driver: Current Team Technical Maturity.',
      targetUnit: '%',
    }),
  },
  {
    id: 'band-b-slightly-ahead',
    title: 'Leader banding — state B (slightly ahead, runner-up close)',
    description:
      'Win probability between 0.50 and 0.65 with genuinely close expected outcomes: tempered claim, runner-up named from the rendered ranking.',
    model: fixtureChart({
      headline: 'Hire One Tech Lead is slightly ahead.',
      subline: 'Hire Two Developers is close on expected outcome.',
      lenses: ['outcome'],
      defaultLens: 'outcome',
      rows: RICH_ROWS.slice(0, 2).map((r, i) => ({
        ...r,
        outcome: {
          ...r.outcome,
          centre: i === 0 ? 22 : 21,
          readout: i === 0 ? '+22%' : '+21%',
          previous: undefined,
        },
        changeReadout: undefined,
        stability: undefined,
        goal: { value: null, readout: '—' },
        detail: { ...r.detail, watch: undefined, tradeOff: undefined, goalFit: undefined },
      })),
      leaders: { goal: null, outcome: 'fx_tech_lead', stability: null, whatChanged: null },
      outcomeDomain: { min: -10, max: 47 },
      outcomeRangedRowCount: 2,
      showGoalHint: true,
    }),
  },
  {
    id: 'band-c-no-clear-leader',
    title: 'Leader banding — state C (no clear leader)',
    description:
      'Near-tied win probabilities below majority: the hero declines to crown anyone and points at the comparison instead.',
    model: fixtureChart({
      headline: 'No option is clearly ahead.',
      subline: 'Compare the top options before deciding.',
      lenses: ['outcome'],
      defaultLens: 'outcome',
      rows: RICH_ROWS.slice(0, 2).map((r, i) => ({
        ...r,
        outcome: {
          ...r.outcome,
          centre: i === 0 ? 22 : 21,
          readout: i === 0 ? '+22%' : '+21%',
          previous: undefined,
        },
        changeReadout: undefined,
        stability: undefined,
        goal: { value: null, readout: '—' },
        detail: { ...r.detail, watch: undefined, tradeOff: undefined, goalFit: undefined },
      })),
      leaders: { goal: null, outcome: 'fx_tech_lead', stability: null, whatChanged: null },
      outcomeDomain: { min: -10, max: 47 },
      outcomeRangedRowCount: 2,
      showGoalHint: true,
    }),
  },
  {
    id: 'none-on-track',
    title: 'Goal honesty — no option on track',
    description:
      'Every goal probability floors below 1%: the headline states the shortfall truth; the goal lens stays default because the "< 1%" rows ARE the story.',
    model: fixtureChart({
      headline: 'No option is currently on track to reach your goal.',
      subline: 'Hire One Tech Lead has the highest expected outcome.',
      lenses: ['goal', 'outcome'],
      defaultLens: 'goal',
      rows: RICH_ROWS.map((r) => ({
        ...r,
        goal: { value: 0.004, readout: '< 1%' },
        outcome: { ...r.outcome, previous: undefined },
        changeReadout: undefined,
        stability: undefined,
        detail: { ...r.detail, watch: undefined, tradeOff: undefined, goalFit: undefined },
      })),
      leaders: { goal: null, outcome: 'fx_tech_lead', stability: null, whatChanged: null },
      outcomeDomain: { min: -10, max: 47 },
      outcomeRangedRowCount: 4,
    }),
  },
  {
    id: 'stale',
    title: 'Stale analysis (soft-disabled chart + re-run route)',
    description:
      'Model edited since the last run: chart dims and locks, detail disclosure and win meta hide uniformly, footer swaps to the Re-run action.',
    isStale: true,
    model: fixtureChart({
      headline: 'Hire One Tech Lead best fits your goal.',
      subline: 'Hire One Tech Lead also has the strongest expected outcome.',
      lenses: ['goal', 'outcome'],
      defaultLens: 'goal',
      rows: RICH_ROWS.map((r) => ({
        ...r,
        outcome: { ...r.outcome, previous: undefined },
        changeReadout: undefined,
        stability: undefined,
        detail: { ...r.detail, watch: undefined, tradeOff: undefined },
      })),
      leaders: {
        goal: 'fx_tech_lead',
        outcome: 'fx_tech_lead',
        stability: null,
        whatChanged: null,
      },
      outcomeDomain: { min: -10, max: 47 },
      outcomeRangedRowCount: 4,
      mainReason: 'Main driver: Current Team Technical Maturity.',
    }),
  },
  {
    id: 'stale-rerunning',
    title: 'Rerun in progress (post-apply)',
    description:
      'What the user sees after committing a change that reruns (e.g. applying a success target): the chart stays dimmed and locked, and the footer rerun action shows in-flight progress with its controls disabled.',
    isStale: true,
    rerunDisabled: true,
    model: fixtureChart({
      headline: 'Hire One Tech Lead best fits your goal.',
      subline: 'Hire One Tech Lead also has the strongest expected outcome.',
      lenses: ['goal', 'outcome'],
      defaultLens: 'goal',
      rows: RICH_ROWS.map((r) => ({
        ...r,
        outcome: { ...r.outcome, previous: undefined },
        changeReadout: undefined,
        stability: undefined,
        detail: { ...r.detail, watch: undefined, tradeOff: undefined },
      })),
      leaders: {
        goal: 'fx_tech_lead',
        outcome: 'fx_tech_lead',
        stability: null,
        whatChanged: null,
      },
      outcomeDomain: { min: -10, max: 47 },
      outcomeRangedRowCount: 4,
      mainReason: 'Main driver: Current Team Technical Maturity.',
    }),
  },
  {
    id: 'single-option',
    title: 'Single option',
    description: 'One analysed option: the only-option headline, no subline, no comparison claims.',
    model: fixtureChart({
      headline: 'Hire One Tech Lead is your only option.',
      lenses: ['goal', 'outcome'],
      defaultLens: 'goal',
      rows: [
        {
          ...RICH_ROWS[0],
          outcome: { ...RICH_ROWS[0].outcome, previous: undefined },
          changeReadout: undefined,
          stability: undefined,
        },
      ],
      leaders: {
        goal: 'fx_tech_lead',
        outcome: 'fx_tech_lead',
        stability: null,
        whatChanged: null,
      },
      outcomeDomain: { min: -10, max: 47 },
      outcomeRangedRowCount: 1,
    }),
  },
  {
    id: 'status-partial',
    title: 'Status — partial analysis',
    description: 'PLoT-reported partial run: curated non-chart card, no fabricated numbers.',
    model: {
      kind: 'status',
      provenance: 'fixture',
      variant: 'partial',
      headline: 'Some analysis steps did not complete',
      body: 'Results are partial. Run the analysis again to see the full picture here.',
    },
  },
  {
    id: 'status-failed',
    title: 'Status — failed analysis',
    description: 'Failed run: curated non-chart card with the re-run instruction.',
    model: {
      kind: 'status',
      provenance: 'fixture',
      variant: 'failed',
      headline: 'The analysis did not complete',
      body: 'Run the analysis again to see results here.',
    },
  },
  {
    id: 'status-blocked',
    title: 'Status — blocked analysis',
    description: 'Blocked run: curated non-chart card pointing back at the canvas.',
    model: {
      kind: 'status',
      provenance: 'fixture',
      variant: 'blocked',
      headline: 'The analysis could not run',
      body: 'Resolve the items flagged on the canvas, then run the analysis again.',
    },
  },
]
