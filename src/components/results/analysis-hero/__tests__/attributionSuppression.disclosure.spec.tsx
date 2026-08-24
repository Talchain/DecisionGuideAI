/**
 * Per-factor win-probability attribution — the SUPPRESSION VERDICT reaches the user.
 *
 * THE GAP THIS CLOSES. `enrichment.p_win_sensitivity` (ISL's per-factor
 * percentage-point-of-win deltas) and `enrichment.correlation_model` are both
 * parsed and stored by `src/v5/mapV5AnalysisToReport.ts` (lines 1302-1307,
 * 1497-1498) and read by NOTHING before this slice. Re-derived at UI PR head
 * `363d3fac` with `git grep -a -i -I` over the whole tracked tree (4,473 files):
 * `factor_correlations` 0 files / 0 lines, while the CONTRAST CONTROLS in the
 * SAME sweep returned `factor_evppi` 35 files / 107 lines and
 * `p_win_sensitivity` 24 files / 48 lines. Target zero + contrast non-zero in
 * one run: real absence, not a blind probe (trap 13e).
 *
 * ⚠⚠ WHAT `suppressed_attributions` ACTUALLY CONTAINS — READ THIS BEFORE
 * TOUCHING THE TABLE BELOW. It does NOT name factors. It is ISL's manifest of
 * withheld ATTRIBUTION KINDS, and the vocabulary is a closed four-member set
 * declared as module constants at `src/models/response_v2.py:1437-1440`
 * (ISL staging `28fe0c9`):
 *
 *     SUPPRESSED_ATTR_FACTOR_SENSITIVITY   = "factor_sensitivity"
 *     SUPPRESSED_ATTR_STABILITY_THRESHOLDS = "stability_thresholds"
 *     SUPPRESSED_ATTR_CONDITIONAL_WINNERS  = "conditional_winners"
 *     SUPPRESSED_ATTR_P_WIN_SENSITIVITY    = "p_win_sensitivity"
 *
 * The field's own `.describe()` (`response_v2.py:1481-1489`) says the same:
 * "Independence-assuming per-factor attributions omitted under active
 * correlation (e.g. factor_sensitivity, p_win_sensitivity,
 * conditional_winners)". Factor NODE IDS live one field over, in
 * `correlated_factors: List[str]`. PLoT states it verbatim too
 * (`src/lib/driver-order.ts:351-352`: "the members are ATTRIBUTION NAMES ...
 * not factor ids").
 *
 * THIS FILE'S FIRST VERSION GOT THAT WRONG: every positive fixture used
 * `['fac_price','fac_demand']`, values the producer never emits into this
 * field, so the whole corpus sat outside the producer's output domain
 * (trap 16-inverse — a fixture you wrote yourself is not evidence about the
 * wire). The table below is rebuilt from the four literals above.
 *
 * ⭐ WHY THE LITERALS ARE SPELLED OUT HERE AND NOT IMPORTED FROM THE READER.
 * `attributionSuppression.ts` binds to its own constant. If this spec imported
 * that constant, a mutation to it would move BOTH sides together and the test
 * would stay green — a guard agreeing with itself (trap 13b). The spec binds to
 * the PRODUCER'S BYTES; the module binds to its constant; the two must agree,
 * and this file REDs when they stop.
 *
 * WHY THE ABSENCE IS THE PRODUCT, AND NOT A NUMBER. From the pinned contract's
 * own `.describe()` (`@talchain/schemas` 0.48.0,
 * `dist/boundary/enrichment.js:1027-1043`, vendored tarball):
 *
 *   p_win_sensitivity — "ABSENT UNDER ACTIVE CORRELATION BY DESIGN — ISL
 *     suppresses it and names it in `correlation_model.suppressed_attributions`
 *     ('absent from the response, not null') while `factor_evppi` stays
 *     emitted. So absence here is a SUPPRESSION VERDICT, not a missing
 *     convenience. Transport only — pp display is barred by PP_TOKEN doctrine."
 *
 *   correlation_model — "the DISCRIMINATOR that makes an absent
 *     `p_win_sensitivity` readable as suppression rather than as 'not
 *     computed', which is why the family travels together: transporting the
 *     suppressed field's explanation without the explanation is the
 *     two-states-one-byte defect by construction."
 *
 * So this slice renders NO magnitude — "pp display is barred" is the producer's
 * own sentence — it renders the fact that ONE named per-factor answer was
 * WITHHELD, and the producer's reason.
 *
 * CLAIM TYPE: rendered text / DOM presence within jsdom, on the Drivers view of
 * a mounted `HeroEvidenceDisclosure`. NOT a visibility claim — jsdom cannot
 * prove layout and nothing here asserts one.
 *
 * ⚠ WHY THE DRIVERS VIEW AND NOT "Resolve next". Measured, not assumed: the
 * Drivers deck says `Ranked by effect on the analysed outcome` (heroCopy.ts
 * `driversNote`) — OUTCOME units. The suppressed quantity is per-factor effect
 * on the CHANCE AN OPTION COMES OUT AHEAD, a different estimand. Drivers is the
 * per-factor view where a reader would otherwise take the list as the complete
 * per-factor picture, so that is where the withholding has to be said. Resolve
 * next hosts `factor_evppi`, which the producer keeps emitting under
 * suppression — a suppression notice there would be false.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HeroEvidenceDisclosure } from '../HeroEvidenceDisclosure'
import { heroEvidenceModel, heroDriverRow } from '../__fixtures__/heroEvidenceModel'
import { HERO_COPY } from '../heroCopy'
import {
  readAttributionSuppression,
  type AttributionSuppressionVerdict,
} from '../../voi/attributionSuppression'

vi.mock('../../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusByTarget: vi.fn(),
  focusExistingTarget: vi.fn(),
  focusModelTarget: vi.fn(() => true),
}))

const TESTID = 'hero-evidence-attribution-suppressed'

/**
 * Open the disclosure. The Drivers view is the DEFAULT view, so no view chip is
 * clicked — asserting on the default is deliberate: a notice that only appears
 * after a user hunts for a tab is not the disclosure this slice owes.
 */
function renderDisclosure(verdict: AttributionSuppressionVerdict) {
  const utils = render(
    <HeroEvidenceDisclosure
      evidence={heroEvidenceModel({
        // The disclosure self-hides with nothing to disclose
        // (`HeroEvidenceDisclosure.tsx:215`), and the notice is a caveat ON the
        // drivers list — so a run carrying drivers is the state under test, not
        // scaffolding. A suppression with no drivers has no host by design.
        drivers: [heroDriverRow('not_estimated', { rank: 1, label: 'Price' })],
        attributionSuppression: verdict,
      })}
    />,
  )
  // The section is collapsed by default; the toggle is its only opener.
  fireEvent.click(screen.getByRole('button', { name: /why and what could change it/i }))
  return utils
}

describe('Drivers view — the suppression verdict is disclosed', () => {
  /**
   * BOTH-DIRECTION CONTROL, arm 1. Producer attested suppression → the user is
   * told. Bound by EXACT TEST ID, never by a value predicate another node could
   * satisfy.
   */
  it('renders the withholding notice when the producer attests suppression', () => {
    renderDisclosure('suppressed')
    const notice = screen.getByTestId(TESTID)
    expect(notice).toBeInTheDocument()
    // Bound to the ratified sentence by IDENTITY (the deck entry), not by a
    // substring another line of copy could also contain.
    expect(notice).toHaveTextContent(HERO_COPY.evidence.attributionSuppressed)
  })

  /**
   * BOTH-DIRECTION CONTROL, arm 2. No attestation → SILENCE. Not a placeholder,
   * not "unknown", not a zero. This is the arm that stops the notice becoming
   * decoration that fires on every run.
   */
  it('renders NOTHING when the producer attested no suppression', () => {
    renderDisclosure('not_attested')
    expect(screen.queryByTestId(TESTID)).toBeNull()
  })

  /**
   * POSITIVE CONTROL for arm 2 (trap 13). An absence assertion is vacuous
   * unless the same harness is shown to SEE the surrounding content — otherwise
   * a disclosure that failed to open would "prove" the absence.
   */
  it('arm-2 harness can see the Drivers view it claims the notice is absent from', () => {
    renderDisclosure('not_attested')
    expect(screen.getByTestId('hero-evidence-drivers')).toBeInTheDocument()
    expect(screen.getByText(HERO_COPY.evidence.driversNote)).toBeInTheDocument()
  })

  /**
   * THE SENTENCE IS ABOUT ONE ESTIMAND, SO IT MAY NOT CARRY A DIGIT OR A NAME.
   * Asserted against the ratified string itself rather than described in a
   * comment: the copy is what a user reads, and a magnitude arriving here is
   * the one failure the producer explicitly bars ("pp display is barred by
   * PP_TOKEN doctrine").
   */
  it('the ratified sentence carries no digit and no id-shaped factor name', () => {
    expect(HERO_COPY.evidence.attributionSuppressed).not.toMatch(/\d/)
    expect(HERO_COPY.evidence.attributionSuppressed).not.toMatch(/\bfac_[a-z0-9_]+/i)
    expect(HERO_COPY.evidence.attributionSuppressed).not.toMatch(/\bnode_[a-z0-9_]+/i)
  })
})

describe('readAttributionSuppression — the reader that decides it', () => {
  /**
   * ⭐ THE MANIFESTS BELOW ARE THE PRODUCER'S, NOT MINE. Each is what ISL's
   * skip-site appends actually build, derived at
   * `src/services/robustness_analyzer_v2.py` (ISL staging `28fe0c9`). The
   * manifest is RECORD-not-PREDICT — the analyzer appends at each skip site, so
   * its MEMBERSHIP is a function of which phases were requested AND ran:
   *
   *   :2351-2360  `factor_sensitivity` + `stability_thresholds`
   *               iff `factor_sampler.has_uncertainties()`
   *                   AND `"sensitivity" in request.analysis_types`
   *   :2373-2375  `conditional_winners`
   *               iff `factor_sampler.has_uncertainties()`
   *                   AND `len(request.options) > 1`
   *   :2585-2587  `p_win_sensitivity`
   *               iff `request.include_voi`
   *                   AND `factor_sampler.has_uncertainties()`
   *
   * Those three gates are INDEPENDENT. So a NON-EMPTY manifest that does NOT
   * contain `p_win_sensitivity` is a shape the producer really can emit, and
   * the notice must stay silent on it — that is the OPPOSITE-DIRECTION TWIN
   * (trap 22b) the first version of this file had no case for.
   */
  const TABLE: ReadonlyArray<readonly [string, unknown, unknown, AttributionSuppressionVerdict]> = [
    // ── The licensed positives: the manifest NAMES p_win_sensitivity ────────
    [
      'full correlation-active manifest (all four kinds withheld) — the canonical suppression state',
      {
        active: true,
        suppressed_attributions: [
          'factor_sensitivity',
          'stability_thresholds',
          'conditional_winners',
          'p_win_sensitivity',
        ],
        suppression_reason: 'not_separable_under_correlation',
      },
      undefined,
      'suppressed',
    ],
    [
      'single-option run: no conditional_winners, but p_win_sensitivity IS named',
      {
        active: true,
        suppressed_attributions: ['factor_sensitivity', 'stability_thresholds', 'p_win_sensitivity'],
      },
      undefined,
      'suppressed',
    ],
    [
      'sensitivity not requested: only p_win_sensitivity named',
      { active: true, suppressed_attributions: ['p_win_sensitivity'] },
      undefined,
      'suppressed',
    ],
    [
      'a member the UI has never seen rides alongside p_win_sensitivity — the named one still decides',
      { active: true, suppressed_attributions: ['downside_attribution', 'p_win_sensitivity'] },
      undefined,
      'suppressed',
    ],

    // ── OPPOSITE-DIRECTION TWINS: manifest non-empty, p_win_sensitivity NOT in it
    // Each of these lit the notice under the pre-review reader. Each is a
    // sentence the product would have been telling a user falsely.
    [
      'TWIN: include_voi=false — factor_sensitivity/stability/conditional withheld, p_win_sensitivity NOT named',
      {
        active: true,
        suppressed_attributions: [
          'factor_sensitivity',
          'stability_thresholds',
          'conditional_winners',
        ],
      },
      undefined,
      'not_attested',
    ],
    [
      'TWIN: only factor_sensitivity + stability_thresholds withheld (single-option, include_voi=false)',
      { active: true, suppressed_attributions: ['factor_sensitivity', 'stability_thresholds'] },
      undefined,
      'not_attested',
    ],
    [
      'TWIN: only conditional_winners withheld',
      { active: true, suppressed_attributions: ['conditional_winners'] },
      undefined,
      'not_attested',
    ],
    [
      'TWIN: a future member the UI does not know, alone — never a win-probability claim',
      { active: true, suppressed_attributions: ['downside_attribution'] },
      undefined,
      'not_attested',
    ],
    [
      'TWIN: a near-miss spelling is not the token (no substring or prefix matching)',
      { active: true, suppressed_attributions: ['p_win_sensitivity_v2'] },
      undefined,
      'not_attested',
    ],
    [
      'TWIN: case matters — the producer emits the exact lower-case literal',
      { active: true, suppressed_attributions: ['P_WIN_SENSITIVITY'] },
      undefined,
      'not_attested',
    ],

    // ── Fail-closed: the answer actually ARRIVED ────────────────────────────
    // The producer's rule is that suppression means the field is ABSENT, so any
    // arrived value refutes the manifest, whatever the manifest says.
    [
      'p_win_sensitivity PRESENT with real ISL rows — nothing was suppressed, whatever the manifest says',
      { active: true, suppressed_attributions: ['p_win_sensitivity'] },
      // Shape copied from a real capture:
      // src/v5/__tests__/fixtures/live-analysis-turn-T3-20260808T155759Z.json
      // → blocks[0].enrichment.p_win_sensitivity[0]
      [
        {
          factor_id: 'fac_annual_crm_cost',
          p_win_delta: 0.019167,
          p_win_delta_percentage_points: 1.92,
          metric_type: 'p_win_recommended',
          method: 'p_win_delta_at_mean_v1',
          status: 'below_resolution',
        },
      ],
      'not_attested',
    ],
    [
      'p_win_sensitivity present and EMPTY — still an arrived array, not a suppression',
      { active: true, suppressed_attributions: ['p_win_sensitivity'] },
      [],
      'not_attested',
    ],

    // ── Fail-closed: the key ARRIVED but is UNREADABLE ──────────────────────
    // These are the F4 class. The contract's suppression signal is ABSENCE
    // ("absent from the response, not null"), so a key that arrived carrying
    // ANYTHING is not that signal — and an unreadable shape is the one case
    // where guessing "suppressed" would tell a user their analysis withheld
    // something it may well have computed.
    [
      'FAIL-CLOSED: p_win_sensitivity explicitly null — the contract says suppression is ABSENT, not null',
      { active: true, suppressed_attributions: ['p_win_sensitivity'] },
      null,
      'not_attested',
    ],
    [
      'FAIL-CLOSED: p_win_sensitivity arrived as an object (open shape drifted)',
      { active: true, suppressed_attributions: ['p_win_sensitivity'] },
      { factor_id: 'fac_price' },
      'not_attested',
    ],
    [
      'FAIL-CLOSED: p_win_sensitivity arrived as a string',
      { active: true, suppressed_attributions: ['p_win_sensitivity'] },
      'suppressed',
      'not_attested',
    ],
    [
      'FAIL-CLOSED: p_win_sensitivity arrived as a number',
      { active: true, suppressed_attributions: ['p_win_sensitivity'] },
      0,
      'not_attested',
    ],

    // ── Fail-closed: no readable attestation at all ─────────────────────────
    [
      'no correlation_model at all — "not computed", never suppression',
      undefined,
      undefined,
      'not_attested',
    ],
    ['correlation_model null', null, undefined, 'not_attested'],
    ['correlation_model present but names no attributions', { active: true }, undefined, 'not_attested'],
    [
      'suppressed_attributions EMPTY — named nothing, so suppressed nothing',
      { active: true, suppressed_attributions: [] },
      undefined,
      'not_attested',
    ],
    [
      'suppressed_attributions not an array (open shape drifted)',
      { active: true, suppressed_attributions: 'p_win_sensitivity' },
      undefined,
      'not_attested',
    ],
    [
      'correlation_model is an array (open shape drifted)',
      [{ suppressed_attributions: ['p_win_sensitivity'] }],
      undefined,
      'not_attested',
    ],
    ['correlation_model is a primitive', 'active', undefined, 'not_attested'],
  ]

  it.each(TABLE)('%s', (_name, correlationModel, pWinSensitivity, expected) => {
    expect(readAttributionSuppression(correlationModel, pWinSensitivity)).toBe(expected)
  })

  /**
   * ⭐ THE ASSUMPTION THIS SLICE NO LONGER RELIES ON, PINNED SO IT CANNOT COME
   * BACK SILENTLY.
   *
   * The pre-review reader returned `'suppressed'` on ANY non-empty manifest.
   * That was only ACCIDENTALLY equivalent to the member-level question, and the
   * accident is a PLoT constant: `src/integrations/isl/translator-v3.ts:967`
   * hardcodes `include_voi: true` on every ISL request, and
   * `src/types/engine-v3.ts:707-714` says an inbound `include_voi` is IGNORED
   * ("PLoT always sends include_e_values: true and include_voi: true to ISL
   * regardless of these flags"). With `include_voi` always true, ISL's
   * `:2585-2587` gate always fires under correlation, so `p_win_sensitivity`
   * was always in the manifest — and reading the manifest's LENGTH looked
   * identical to reading its MEMBERSHIP.
   *
   * The day PLoT makes `include_voi` request-gated, those two questions come
   * apart and the length reader starts saying "your win-probability
   * attribution was withheld" about runs where it was simply never asked for.
   * This test asserts the reader has NO such dependence: the manifest of a
   * correlation-active run that did not request VOI must stay silent.
   */
  it('does NOT depend on PLoT hardcoding include_voi: true (the twin that pins it)', () => {
    const voiRequested = ['factor_sensitivity', 'stability_thresholds', 'conditional_winners', 'p_win_sensitivity']
    const voiNotRequested = ['factor_sensitivity', 'stability_thresholds', 'conditional_winners']

    expect(readAttributionSuppression({ active: true, suppressed_attributions: voiRequested }, undefined)).toBe(
      'suppressed',
    )
    expect(readAttributionSuppression({ active: true, suppressed_attributions: voiNotRequested }, undefined)).toBe(
      'not_attested',
    )
    // The two manifests differ ONLY by the token under test — so the pair above
    // is a DISCRIMINATION, not two independent readings that happen to differ.
    expect(voiRequested.filter((m) => !voiNotRequested.includes(m))).toEqual(['p_win_sensitivity'])
  })

  /**
   * NO MAGNITUDE LEAVES THIS MODULE — the structural guarantee, asserted rather
   * than described. The verdict is a closed string enum, so there is no path by
   * which a digit from the suppressed payload can reach the DOM through it.
   */
  it('never returns a value carrying a digit from the payload', () => {
    const verdict = readAttributionSuppression(
      {
        active: true,
        suppressed_attributions: ['p_win_sensitivity'],
        correlated_factors: ['fac_price', 'fac_demand'],
        n_pairs: 1,
        rho: 0.87,
        n_samples: 12000,
      },
      undefined,
    )
    expect(verdict).toBe('suppressed')
    expect(JSON.stringify(verdict)).not.toMatch(/\d/)
    // ...and no factor id either: `correlated_factors` is where ISL puts node
    // ids, and nothing in the verdict can carry one.
    expect(JSON.stringify(verdict)).not.toMatch(/fac_/)
  })
})
