/**
 * Per-factor win-probability attribution — the SUPPRESSION VERDICT reaches the user.
 *
 * THE GAP THIS CLOSES. `enrichment.p_win_sensitivity` (ISL's per-factor
 * percentage-point-of-win deltas) and `enrichment.correlation_model` are both
 * parsed and stored by `src/v5/mapV5AnalysisToReport.ts` (lines 1302-1306,
 * 1497-1498) and read by NOTHING. Swept at UI staging tip
 * `88cb7e3728aff1e18a2d32635b0ac24cab1c348b` over `src/` + `tests/`, excluding
 * fixtures/`__tests__`/`vendor`, case-insensitive, `rg -a`: both symbols hit
 * ONLY those mapper lines. The same sweep's CONTRAST CONTROL — `factor_evppi`,
 * the sibling that IS displayed — returned 30+ consumer hits across
 * `useResultsSectionData.ts`, `voi/`, `types.ts` and `AnalysisHeroPanel.tsx`.
 * Target zero + contrast non-zero in one run: real absence, not a blind probe.
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
 * The UI holds the discriminator and drops it. So this slice renders NO
 * magnitude — "pp display is barred" is the producer's own sentence — it
 * renders the fact that a per-factor answer was WITHHELD and the producer's
 * reason. That is the whole licence, and it is why the reader returns a closed
 * two-member enum with no numeric path to the DOM (same structural guarantee
 * `voi/decisionVoi.ts` gives one field over).
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
  it("renders the withholding notice when the producer attests suppression", () => {
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
})

describe('readAttributionSuppression — the reader that decides it', () => {
  /**
   * Derived from the PRODUCER's declared semantics (the two `.describe()`
   * paragraphs quoted in this file's header), never from the field names.
   *
   * `correlation_model` is `z.object({}).passthrough()` in the pinned contract —
   * fully OPEN, so `suppressed_attributions`' element shape is NOT typed. Every
   * unreadable shape must therefore fail CLOSED to silence rather than assume
   * suppression.
   */
  const TABLE: ReadonlyArray<readonly [string, unknown, unknown, AttributionSuppressionVerdict]> = [
    // ── The one licensed positive ──────────────────────────────────────────
    [
      'attributions named AND the array absent — the contract\'s suppression state',
      { suppressed_attributions: ['fac_price', 'fac_demand'] },
      undefined,
      'suppressed',
    ],
    [
      'suppression state, p_win_sensitivity explicitly null (contract says "absent, not null" — null is still not an array)',
      { suppressed_attributions: ['fac_price'] },
      null,
      'suppressed',
    ],
    // ── Fail-closed: the answer actually arrived ───────────────────────────
    [
      'p_win_sensitivity PRESENT — nothing was suppressed, whatever the model says',
      { suppressed_attributions: ['fac_price'] },
      [{ factor_id: 'fac_price' }],
      'not_attested',
    ],
    [
      'p_win_sensitivity present and EMPTY — still an arrived array, not a suppression',
      { suppressed_attributions: ['fac_price'] },
      [],
      'not_attested',
    ],
    // ── Fail-closed: no readable attestation ───────────────────────────────
    ['no correlation_model at all — "not computed", never suppression', undefined, undefined, 'not_attested'],
    ['correlation_model null', null, undefined, 'not_attested'],
    ['correlation_model present but names no attributions', {}, undefined, 'not_attested'],
    ['suppressed_attributions EMPTY — named nothing, so suppressed nothing', { suppressed_attributions: [] }, undefined, 'not_attested'],
    ['suppressed_attributions not an array (open shape drifted)', { suppressed_attributions: 'fac_price' }, undefined, 'not_attested'],
    ['correlation_model is an array (open shape drifted)', [{ suppressed_attributions: ['x'] }], undefined, 'not_attested'],
    ['correlation_model is a primitive', 'active', undefined, 'not_attested'],
  ]

  it.each(TABLE)('%s', (_name, correlationModel, pWinSensitivity, expected) => {
    expect(readAttributionSuppression(correlationModel, pWinSensitivity)).toBe(expected)
  })

  /**
   * NO MAGNITUDE LEAVES THIS MODULE — the structural guarantee, asserted rather
   * than described. The verdict is a closed string enum, so there is no path by
   * which a digit from the suppressed payload can reach the DOM through it.
   */
  it('never returns a value carrying a digit from the payload', () => {
    const verdict = readAttributionSuppression(
      { suppressed_attributions: ['fac_price'], rho: 0.87, n_samples: 12000 },
      undefined,
    )
    expect(verdict).toBe('suppressed')
    expect(JSON.stringify(verdict)).not.toMatch(/\d/)
  })
})
