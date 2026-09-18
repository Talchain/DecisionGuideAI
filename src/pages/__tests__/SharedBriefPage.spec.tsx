/**
 * SharedBriefPage tests.
 *
 * Re-pointed 18 Sep 2026 from `shared_briefs` to `shared_snapshots`. The old
 * mechanism could never deliver content — 0 rows, because its writer gates on
 * two columns the product stopped writing — and carried no graph even in
 * principle, so a recipient saw an empty canvas. Evidence:
 * output/accelerate-20260918/SHARE-GATING-ITEM-SETTLED.md.
 *
 * The privacy assertions below are kept and strengthened. The worst defect this
 * page has ever had was a `JSON.stringify` fallback that printed the raw stored
 * record at an anonymous reader; the guard against it must survive the change
 * of mechanism, so it is tested against the NEW payload shape.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import React from 'react'

const mockGetSharedSnapshotBySlug = vi.fn()
vi.mock('../../services/scenarioService', () => ({
  getSharedSnapshotBySlug: (...args: unknown[]) => mockGetSharedSnapshotBySlug(...args),
}))

import SharedBriefPage from '../SharedBriefPage'

function renderPage(slug = 'abc123') {
  return render(
    <MemoryRouter initialEntries={[`/brief/${slug}`]}>
      <Routes>
        <Route path="/brief/:slug" element={<SharedBriefPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

/**
 * ⭐ THIS FIXTURE'S SHAPE IS DERIVED FROM THE PRODUCER, NOT INVENTED.
 *
 * Census of every graph written in the 7 days to 18 Sep 2026 (45,876 nodes):
 * the taxonomy key is `kind`, present on 45,876; `type` occurs ZERO times.
 * `source_quote` 9,756 · `display_value` 4,695 · `description` 118 ·
 * `value`/`unit` 0. Kinds: factor 15,449 · option 12,020 · risk 6,698 ·
 * outcome 5,341 · decision 3,184 · goal 3,184.
 *
 * The envelope below is the exact shape `get_shared_snapshot_by_slug` returned
 * over HTTP to an anonymous caller, including the `+00:00` timestamp offset and
 * the explicit nulls the read deliberately does not strip.
 */
const SNAPSHOT = {
  graph: {
    nodes: [
      { id: 'd1', kind: 'decision', label: 'Open a second site' },
      { id: 'g1', kind: 'goal', label: 'Revenue', source_quote: 'we need to hit £2.4m by Q4' },
      { id: 'o1', kind: 'option', label: 'Lease in Leeds', source_quote: 'the Leeds unit is available' },
      { id: 'o2', kind: 'option', label: 'Stay put' },
      { id: 'f1', kind: 'factor', label: 'Local demand', display_value: '+12% YoY' },
      { id: 'r1', kind: 'risk', label: 'Demand does not materialise' },
    ],
    edges: [
      { from: 'f1', to: 'g1', strength: 0.6, effect_direction: 'increases', exists_probability: 0.9 },
      { from: 'o1', to: 'g1', strength: 0.4, effect_direction: 'increases', exists_probability: 0.8 },
    ],
  },
  analysis: null,
  brief_text: 'We need to decide whether to open a second site.',
  graph_hash: '1b30f286be0a9c',
  seed: null,
  created_at: '2026-09-18T00:29:15.899114+00:00',
  expires_at: null,
}

/**
 * ⭐ THE ANALYSIS FIXTURE'S SHAPE IS DERIVED FROM THE PRODUCER.
 *
 * Measured at the deployed database on 18 Sep 2026 across every `scenarios.brief`
 * CEE has written (39 rows, all written that day between 01:48Z and 12:37Z —
 * this column went live TODAY, which is why the page had nothing to show before).
 * All 18 keys present on all 39 rows. Population of the parts that matter:
 *
 *   options            39/39   [{ rank, label, option_id, win_probability }]
 *   headline           39/39   producer's own sentence
 *   robustness_caveat  39/39   { text, basis, doctrine, flip_evidence }
 *   what_would_change  39/39   array of STRINGS ("A → B")
 *   top_drivers        27/39   [{ factor_label, direction, sensitivity }]
 *   key_assumptions    27/39   array of STRINGS (factor labels)
 *   warnings           35/39   [{ code, message, severity }]
 *   defaulted_assumptions 9/39 [{ code, note, source }]
 *
 * win_probability measured across 131 option rows: min 0.000125, max 0.99595,
 * zero above 1 — a probability, not a percentage.
 *
 * `warnings` and `defaulted_assumptions` are DELIBERATELY ABSENT from the
 * allowlist and are included in this fixture to prove they stay out: measured
 * over the same rows, 12 of 103 warning messages carry raw node ids
 * ("root node '6bb6259c'", 'factor node "ab78e513"') and internal service
 * names ("ISL will default to intercept=0"). Contrast control in the same
 * sweep: every allowlisted field read ZERO hex ids across 40/188/56/135/60/40
 * elements, so the instrument could see ids and those zeros are real.
 */
const ANALYSIS = {
  version: '1',
  brief_id: 'brief-internal-9f2',
  created_at: '2026-09-18T00:20:00Z',
  graph_hash: 'deadbeefcafe',
  seed: 424242,
  lineage: { run_id: 'run-internal-441' },
  headline:
    'Lease in Leeds produced the best outcome in 82% of runs of this model. The link from Local demand to Revenue is where this result is most sensitive to your assumptions.',
  headline_banded: {
    band: 'clearly_ahead',
    text: 'Lease in Leeds is clearly ahead.',
    leader_label: 'Lease in Leeds',
    leader_option_id: 'b54e5dac',
    runner_up_option_id: '9c25f4ff',
    robustness_gated: false,
    win_probability_gap: 0.6571,
    doctrine: 'provisional_doctrine_v0',
  },
  analysis_summary: {
    leading_option: 'Lease in Leeds',
    robustness_band: 'moderate',
    win_probability: 0.823475,
  },
  options: [
    { rank: 1, label: 'Lease in Leeds', option_id: 'b54e5dac', win_probability: 0.823475 },
    { rank: 2, label: 'Stay put', option_id: '9c25f4ff', win_probability: 0.176525 },
  ],
  robustness: 'moderate',
  robustness_caveat: {
    text: 'This run held up under the changes we tested. That is not a guarantee. Defaulted or uncertain inputs could still change it.',
    basis: 'is_robust',
    doctrine: 'provisional_doctrine_v0',
    flip_evidence: { text: 'Varying any one factor did not change the order.', status: 'all_no_effect' },
  },
  top_drivers: [
    { factor_label: 'Local demand', direction: 'positive', sensitivity: 0.3077636585204695 },
    { factor_label: 'Build cost', direction: 'negative', sensitivity: 0.2073286500854376 },
  ],
  what_would_change: ['Local demand → Revenue', 'Build cost → Revenue'],
  key_assumptions: ['Local demand', 'Build cost'],
  warnings: [
    {
      code: 'GOAL_ANCESTOR_DATA_GAP',
      message:
        "Goal node 'aa289540' is scored from its forward-propagated outcome distribution, but root ancestor(s) '6bb6259c' carry no observed value. ISL will default to intercept=0.",
      severity: 'warning',
    },
  ],
  warning_codes: ['GOAL_ANCESTOR_DATA_GAP'],
  defaulted_assumptions: [
    {
      code: 'ROOT_NODE_DEFAULT_VALUE',
      note: "No observed value provided for root node '6bb6259c'; defaulted to 0.0.",
      source: 'default_disclosure',
    },
  ],
}

const SNAPSHOT_WITH_ANALYSIS = { ...SNAPSHOT, analysis: ANALYSIS }

describe('SharedBriefPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSharedSnapshotBySlug.mockResolvedValue(SNAPSHOT)
  })

  it('reads the SNAPSHOT by slug, not the brief', async () => {
    renderPage('abc123')
    await waitFor(() => {
      expect(mockGetSharedSnapshotBySlug).toHaveBeenCalledWith('abc123')
    })
  })

  it('shows the sender’s brief text', async () => {
    renderPage()
    expect(
      await screen.findByText('We need to decide whether to open a second site.'),
    ).toBeInTheDocument()
  })

  it('shows the model — the whole reason the link is worth opening', async () => {
    renderPage()
    // Bound by exact label, never by a value predicate another node could satisfy.
    expect(await screen.findByText('Open a second site')).toBeInTheDocument()
    expect(screen.getByText('Lease in Leeds')).toBeInTheDocument()
    expect(screen.getByText('Stay put')).toBeInTheDocument()
    expect(screen.getByText('Local demand')).toBeInTheDocument()
    expect(screen.getByText('Options on the table')).toBeInTheDocument()
  })

  it('groups by the producer’s `kind`, which is the key real graphs actually carry', async () => {
    renderPage()
    // All six headings must appear. If this grouped by `type` instead, every
    // node would fall into "Also in the model" — 45,876 of them, in a week.
    expect(await screen.findByText('The decision')).toBeInTheDocument()
    expect(screen.getByText('What it is for')).toBeInTheDocument()
    expect(screen.getByText('Options on the table')).toBeInTheDocument()
    expect(screen.getByText('What it depends on')).toBeInTheDocument()
    expect(screen.getByText('What could go wrong')).toBeInTheDocument()
    expect(screen.queryByText('Also in the model')).not.toBeInTheDocument()
  })

  it('renders `risk` — 6,698 nodes a week that the first draft of this page had no group for', async () => {
    renderPage()
    expect(await screen.findByText('Demand does not materialise')).toBeInTheDocument()
  })

  it('still groups a LEGACY graph that carries `type` instead of `kind`', async () => {
    mockGetSharedSnapshotBySlug.mockResolvedValue({
      ...SNAPSHOT,
      graph: { nodes: [{ id: 'o9', type: 'option', label: 'Legacy option' }], edges: [] },
    })
    renderPage()
    expect(await screen.findByText('Options on the table')).toBeInTheDocument()
    expect(screen.getByText('Legacy option')).toBeInTheDocument()
  })

  it('shows the sender’s own words per element — the attribution, not just the label', async () => {
    renderPage()
    expect(await screen.findByText(/we need to hit £2\.4m by Q4/)).toBeInTheDocument()
    expect(screen.getByText(/the Leeds unit is available/)).toBeInTheDocument()
  })

  it('prefers display_value over re-deriving a number, so sender and recipient see one figure', async () => {
    renderPage()
    expect(await screen.findByText('+12% YoY')).toBeInTheDocument()
  })

  it('formats a bare value with its unit rather than dropping the unit', async () => {
    // `value`/`unit` occur ZERO times in current data; this path exists only for
    // older graphs, and is tested so it cannot rot unnoticed.
    mockGetSharedSnapshotBySlug.mockResolvedValue({
      ...SNAPSHOT,
      graph: { nodes: [{ id: 'o1', kind: 'option', label: 'Lease', value: 480000, unit: 'GBP' }], edges: [] },
    })
    renderPage()
    expect(await screen.findByText('480000 GBP')).toBeInTheDocument()
  })

  it('counts elements and links in the footer', async () => {
    renderPage()
    expect(await screen.findByText(/6 elements · 2 links/)).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Privacy — the guard that must survive the change of mechanism
  // -------------------------------------------------------------------------

  it('never renders an unrecognised field at the anonymous reader', async () => {
    mockGetSharedSnapshotBySlug.mockResolvedValue({
      ...SNAPSHOT,
      graph: {
        nodes: [
          {
            id: 'secret-node-id',
            kind: 'option',
            label: 'Lease in Leeds',
            internal_owner_email: 'someone@example.com',
            // `provenance` is on 45,856 of 45,876 real nodes, so this is the
            // realistic carrier of internal detail, not an invented one.
            provenance: { author_id: 'user-123' },
            starterId: 'starter-abc',
          },
        ],
        edges: [],
      },
    })
    renderPage()

    expect(await screen.findByText('Lease in Leeds')).toBeInTheDocument()
    // The allowlist holds: nothing outside it reaches the DOM.
    expect(screen.queryByText(/someone@example\.com/)).not.toBeInTheDocument()
    expect(screen.queryByText(/user-123/)).not.toBeInTheDocument()
    expect(screen.queryByText(/secret-node-id/)).not.toBeInTheDocument()
    expect(screen.queryByText(/starter-abc/)).not.toBeInTheDocument()
  })

  it('says so honestly when the model carries no nameable element', async () => {
    mockGetSharedSnapshotBySlug.mockResolvedValue({
      ...SNAPSHOT,
      graph: { nodes: [{ id: 'x', kind: 'option' }], edges: [] },
    })
    renderPage()

    expect(
      await screen.findByTestId('shared-snapshot-unrenderable'),
    ).toBeInTheDocument()
    expect(screen.queryByTestId('shared-snapshot-model')).not.toBeInTheDocument()
  })

  it('handles a graph that is not an object without throwing', async () => {
    mockGetSharedSnapshotBySlug.mockResolvedValue({ ...SNAPSHOT, graph: null })
    renderPage()
    expect(
      await screen.findByTestId('shared-snapshot-unrenderable'),
    ).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // States
  // -------------------------------------------------------------------------

  // -------------------------------------------------------------------------
  // The analysis — what the run concluded, not just what was modelled
  // -------------------------------------------------------------------------

  describe('the analysis', () => {
    beforeEach(() => {
      mockGetSharedSnapshotBySlug.mockResolvedValue(SNAPSHOT_WITH_ANALYSIS)
    })

    it('shows the producer’s own headline — the claim it was entitled to make', async () => {
      renderPage()
      expect(
        await screen.findByText(/produced the best outcome in 82% of runs/),
      ).toBeInTheDocument()
    })

    it('ranks the options with their win probabilities', async () => {
      renderPage()
      const section = await screen.findByTestId('shared-snapshot-analysis')
      // Bound by identity: the option LABEL carries its own probability, so a
      // row cannot pass by matching a number that belongs to another option.
      const leeds = within(section).getByTestId('shared-option-0')
      expect(within(leeds).getByText('Lease in Leeds')).toBeInTheDocument()
      expect(within(leeds).getByText('82%')).toBeInTheDocument()

      const stay = within(section).getByTestId('shared-option-1')
      expect(within(stay).getByText('Stay put')).toBeInTheDocument()
      expect(within(stay).getByText('18%')).toBeInTheDocument()
    })

    it('keeps robustness as a SEPARATE disclosure, never folded into the leader claim', async () => {
      // decisionVerdict.ts: separation and robustness are two axes, and every
      // contradictory string this product has shipped came from collapsing
      // them. The producer's own caveat sentence is rendered as written.
      renderPage()
      expect(
        await screen.findByText(/held up under the changes we tested/),
      ).toBeInTheDocument()
    })

    it('shows what would change the outcome', async () => {
      renderPage()
      expect(await screen.findByText('Local demand → Revenue')).toBeInTheDocument()
      expect(screen.getByText('Build cost → Revenue')).toBeInTheDocument()
    })

    it('names the factors the result is most sensitive to', async () => {
      renderPage()
      const drivers = await screen.findByTestId('shared-analysis-drivers')
      expect(within(drivers).getByText('Local demand')).toBeInTheDocument()
      expect(within(drivers).getByText('Build cost')).toBeInTheDocument()
    })

    it('never renders the raw sensitivity number, whose units are not disclosed', async () => {
      // 0.3077636585204695 is not a probability and not a percentage; the
      // producer does not say which. Rendering it would invent a presentation.
      renderPage()
      await screen.findByTestId('shared-snapshot-analysis')
      expect(screen.queryByText(/0\.30776/)).not.toBeInTheDocument()
      expect(screen.queryByText(/31%/)).not.toBeInTheDocument()
    })

    // -----------------------------------------------------------------------
    // ⛔ The allowlist — this page is PUBLIC and anonymous
    // -----------------------------------------------------------------------

    it('never renders an analysis internal at the anonymous reader', async () => {
      renderPage()
      await screen.findByTestId('shared-snapshot-analysis')

      // Producer-internal identifiers carried in every real brief.
      expect(screen.queryByText(/b54e5dac/)).not.toBeInTheDocument()
      expect(screen.queryByText(/9c25f4ff/)).not.toBeInTheDocument()
      expect(screen.queryByText(/brief-internal-9f2/)).not.toBeInTheDocument()
      expect(screen.queryByText(/run-internal-441/)).not.toBeInTheDocument()
      expect(screen.queryByText(/deadbeefcafe/)).not.toBeInTheDocument()
      expect(screen.queryByText(/424242/)).not.toBeInTheDocument()
      expect(screen.queryByText(/provisional_doctrine_v0/)).not.toBeInTheDocument()
    })

    it('never renders warnings or defaulted assumptions — they carry raw node ids', async () => {
      // Measured: 12 of 103 warning messages name internal node ids and the
      // ISL service by name. They are operator diagnostics, not content for a
      // recipient, so they are outside the allowlist by decision, not by
      // oversight.
      renderPage()
      await screen.findByTestId('shared-snapshot-analysis')

      expect(screen.queryByText(/aa289540/)).not.toBeInTheDocument()
      expect(screen.queryByText(/6bb6259c/)).not.toBeInTheDocument()
      expect(screen.queryByText(/ISL will default/)).not.toBeInTheDocument()
      expect(screen.queryByText(/GOAL_ANCESTOR_DATA_GAP/)).not.toBeInTheDocument()
      expect(screen.queryByText(/ROOT_NODE_DEFAULT_VALUE/)).not.toBeInTheDocument()
      expect(screen.queryByText(/default_disclosure/)).not.toBeInTheDocument()
    })

    it('renders no raw dump, however deeply an unknown field is nested', async () => {
      // The worst defect this page ever had was a JSON.stringify fallback.
      mockGetSharedSnapshotBySlug.mockResolvedValue({
        ...SNAPSHOT,
        analysis: {
          ...ANALYSIS,
          internal_owner_email: 'someone@example.com',
          telemetry: { session_id: 'sess-777', prompt_version: 'v202' },
        },
      })
      renderPage()
      await screen.findByTestId('shared-snapshot-analysis')

      expect(screen.queryByText(/someone@example\.com/)).not.toBeInTheDocument()
      expect(screen.queryByText(/sess-777/)).not.toBeInTheDocument()
      expect(screen.queryByText(/v202/)).not.toBeInTheDocument()
    })

    // -----------------------------------------------------------------------
    // Withheld claims and missing analysis
    // -----------------------------------------------------------------------

    it('makes NO leader claim when the producer withheld one', async () => {
      // CEE #711 made SILENCE MEANINGFUL: on a withheld turn it drops
      // `headline`/`headline_banded` while the per-option win probabilities
      // keep riding the wire, because the DATA is not withheld — only the
      // CLAIM. decisionVerdict.ts deleted the UI-side fallback rather than
      // gating it, for exactly this reason. This page must not rebuild the
      // claim the producer declined to make.
      const { headline, headline_banded, analysis_summary, ...withheld } = ANALYSIS
      void headline
      void headline_banded
      void analysis_summary
      mockGetSharedSnapshotBySlug.mockResolvedValue({
        ...SNAPSHOT,
        analysis: withheld,
      })
      renderPage()

      const section = await screen.findByTestId('shared-snapshot-analysis')
      // The data still renders.
      expect(within(section).getByText('Lease in Leeds')).toBeInTheDocument()
      expect(within(section).getByText('82%')).toBeInTheDocument()
      // The claim does not.
      expect(screen.queryByTestId('shared-analysis-headline')).not.toBeInTheDocument()
      expect(screen.queryByText(/clearly ahead/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/\brecommended\b/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/\bbest option\b/i)).not.toBeInTheDocument()
    })

    it('does not rebuild the claim from `headline_banded` when `headline` is gone', async () => {
      // Found by a surviving mutant. The case above drops `headline`,
      // `headline_banded` AND `analysis_summary` together, which is what CEE
      // #711 does on a withheld turn — so it could not tell a page that
      // rebuilds the claim from `headline_banded.text` apart from one that
      // does not. This case keeps the banded object present and adversarial:
      // the page must still make no claim, because `headline` is the only
      // field it is allowed to render, and a fallback is precisely the
      // "Authority 3" that decisionVerdict.ts deleted rather than gated.
      const { headline, ...withBanded } = ANALYSIS
      void headline
      mockGetSharedSnapshotBySlug.mockResolvedValue({
        ...SNAPSHOT,
        analysis: withBanded,
      })
      renderPage()

      const section = await screen.findByTestId('shared-snapshot-analysis')
      expect(within(section).getByText('Lease in Leeds')).toBeInTheDocument()
      expect(screen.queryByTestId('shared-analysis-headline')).not.toBeInTheDocument()
      expect(screen.queryByText(/is clearly ahead/i)).not.toBeInTheDocument()
    })

    it('shows the model and NO analysis section when the scenario has no brief', async () => {
      // 14,213 of 14,252 scenarios measured on 18 Sep 2026. The link must open
      // cleanly for them — no empty heading, no broken section.
      mockGetSharedSnapshotBySlug.mockResolvedValue(SNAPSHOT)
      renderPage()

      expect(await screen.findByTestId('shared-snapshot-model')).toBeInTheDocument()
      expect(screen.queryByTestId('shared-snapshot-analysis')).not.toBeInTheDocument()
    })

    it('shows no analysis section when the analysis carries nothing renderable', async () => {
      mockGetSharedSnapshotBySlug.mockResolvedValue({
        ...SNAPSHOT,
        analysis: { brief_id: 'x', lineage: { run_id: 'y' }, warnings: ANALYSIS.warnings },
      })
      renderPage()

      expect(await screen.findByTestId('shared-snapshot-model')).toBeInTheDocument()
      expect(screen.queryByTestId('shared-snapshot-analysis')).not.toBeInTheDocument()
    })

    it('shows the analysis even when the model itself cannot be rendered', async () => {
      // The two sections are independent: a graph this page cannot read must
      // not take the conclusions down with it.
      mockGetSharedSnapshotBySlug.mockResolvedValue({
        ...SNAPSHOT_WITH_ANALYSIS,
        graph: null,
      })
      renderPage()

      expect(
        await screen.findByTestId('shared-snapshot-unrenderable'),
      ).toBeInTheDocument()
      expect(screen.getByTestId('shared-snapshot-analysis')).toBeInTheDocument()
    })

    it('survives an analysis whose arrays are the wrong type', async () => {
      mockGetSharedSnapshotBySlug.mockResolvedValue({
        ...SNAPSHOT,
        analysis: {
          headline: 'A sentence.',
          options: 'not-an-array',
          top_drivers: { nope: true },
          what_would_change: 42,
          key_assumptions: null,
          robustness_caveat: 'not-an-object',
        },
      })
      renderPage()

      const section = await screen.findByTestId('shared-snapshot-analysis')
      expect(within(section).getByText('A sentence.')).toBeInTheDocument()
    })
  })

  it('shows a not-found state for an unknown or expired slug', async () => {
    mockGetSharedSnapshotBySlug.mockResolvedValue(null)
    renderPage()
    expect(await screen.findByText('Decision not found')).toBeInTheDocument()
  })

  it('shows an error state when the read fails', async () => {
    mockGetSharedSnapshotBySlug.mockRejectedValue(new Error('network down'))
    renderPage()
    expect(await screen.findByText('Failed to load this decision')).toBeInTheDocument()
    expect(screen.getByText('network down')).toBeInTheDocument()
  })

/**
 * COLLAB — the recipient can tell a panel answer from the sender's own number.
 *
 * ⭐ THE SHAPE IS THE PRODUCER'S, READ OFF PERSISTED PRODUCTION ROWS, NOT INVENTED.
 * CEE stamps it in `factor-value-edit.ts:369-383` (staging 01684837) when the
 * owner applies a panellist's value, and every id in the stamp is taken from the
 * COLLAB STORE rather than from the client's claim, so a weakened lookup shows up
 * as an ABSENT stamp and never as a forged one:
 *
 *   "observed_state": { "value": 0.85, "source": "panel_elicited",
 *                       "raw_value": 0.85,
 *                       "elicited_from": { "round_id": …, "participant_id": …,
 *                                          "evidence_event_id": … } }
 *
 * Read verbatim from `scenarios.graph` at the deployed database, 18 Sep 2026
 * (scenario 8514e46b). `createSharedSnapshot` passes that same server-held graph
 * as `p_graph`, so the stamp already rides to the recipient untouched — the page
 * was simply dropping it.
 *
 * ⛔ WHY THE COPY SAYS "THE TEAM" AND NOT "A COLLEAGUE" — this is a correctness
 * property, not a tone preference. THE OWNER CAN BE A PANELLIST IN THEIR OWN
 * ROUND: `rounds-service.ts:154-172` looks for the closing owner on the roster
 * and REFUSES the close until they have answered or declined, because "seeing
 * the others first would anchor it". So `participant_id` may name the sender,
 * and any wording that excludes them ("a colleague's estimate", "a teammate
 * supplied this") is FALSE on a designed, reachable arm. "The team" includes the
 * sender; the narrower words do not.
 *
 * ⛔ AND WHAT IT MUST NEVER GROW INTO: a consensus claim. The stamp records that
 * ONE panellist's value was applied. It says nothing about agreement, and
 * `DisagreementBody`'s header bans exactly this ("no mean, no midpoint, no
 * 'recommended', no consensus line") one surface away. This mark states
 * PROVENANCE only.
 */
describe('a value that came from a panel', () => {
  const NODES = [
    {
      id: 'f-panel',
      kind: 'factor',
      label: 'Churn risk after a price rise',
      display_value: '0.85',
      observed_state: {
        value: 0.85,
        source: 'panel_elicited',
        raw_value: 0.85,
        elicited_from: {
          round_id: '53f37a3c-a384-45ac-96a2-895dedb32cc0',
          participant_id: '7186723c-4a31-4671-ac8c-6b51ab798989',
          evidence_event_id: '882ff08c-9d80-4ff5-bc28-7c435aba6de5',
        },
      },
    },
    {
      id: 'f-own',
      kind: 'factor',
      label: 'Local demand',
      display_value: '+12% YoY',
      observed_state: { value: 0.12, source: 'user_set', raw_value: 0.12 },
    },
    { id: 'f-bare', kind: 'factor', label: 'Supplier lead time', display_value: '6 weeks' },
  ]

  function renderWithNodes() {
    mockGetSharedSnapshotBySlug.mockResolvedValue({
      ...SNAPSHOT,
      graph: { nodes: NODES, edges: [] },
    })
    renderPage()
  }

  /** The list item for one node, found BY ITS LABEL — never by a value predicate
   *  another node could satisfy (trap 19). */
  async function itemFor(label: string): Promise<HTMLElement> {
    const model = await screen.findByTestId('shared-snapshot-model')
    const name = within(model).getByText(label)
    const li = name.closest('li')
    if (li === null) throw new Error(`no list item for ${label}`)
    return li as HTMLElement
  }

  it('marks the panel-elicited factor, on that factor', async () => {
    renderWithNodes()
    const item = await itemFor('Churn risk after a price rise')
    expect(within(item).getByText('From the team')).toBeInTheDocument()
  })

  it('leaves the sender’s own factor unmarked — the discriminating twin', async () => {
    renderWithNodes()
    const item = await itemFor('Local demand')
    expect(within(item).queryByText('From the team')).not.toBeInTheDocument()
  })

  it('leaves a factor with no observed_state at all unmarked', async () => {
    renderWithNodes()
    const item = await itemFor('Supplier lead time')
    expect(within(item).queryByText('From the team')).not.toBeInTheDocument()
  })

  it('marks exactly one of the three factors — the mark is not painted on everything', async () => {
    renderWithNodes()
    await screen.findByTestId('shared-snapshot-model')
    expect(screen.getAllByText('From the team')).toHaveLength(1)
  })

  it('never leaks the ids inside the stamp to an anonymous reader', async () => {
    renderWithNodes()
    await screen.findByTestId('shared-snapshot-model')
    expect(screen.queryByText(/53f37a3c/)).not.toBeInTheDocument()
    expect(screen.queryByText(/7186723c/)).not.toBeInTheDocument()
    expect(screen.queryByText(/882ff08c/)).not.toBeInTheDocument()
    expect(screen.queryByText(/panel_elicited/)).not.toBeInTheDocument()
  })

  it('states provenance only — no consensus, agreement or averaging claim', async () => {
    renderWithNodes()
    const item = await itemFor('Churn risk after a price rise')
    expect(item.textContent ?? '').not.toMatch(/agree|consensus|average|mean|recommend|majority/i)
  })

  it('still shows the value the sender saw, unchanged by the mark', async () => {
    renderWithNodes()
    const item = await itemFor('Churn risk after a price rise')
    expect(within(item).getByText('0.85')).toBeInTheDocument()
  })
})

})
