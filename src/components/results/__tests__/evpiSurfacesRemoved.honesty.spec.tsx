/**
 * EVPI display surfaces — REMOVED (results side).
 *
 * `evpi_percentage_points` is refuted, not merely uncalibrated. Replayed live
 * on 2026-07-25 against PLoT `1dd45b6a` → ISL `3aea011c`:
 *
 *   decision   factor                          PLoT evpi_pp   ISL p_win_delta_pp / factor_evppi
 *   50b336a6   Market Receptivity to Feature   12.3           0.0 / 0.0
 *   a4b32ee2   Existing Team Experience Level  10.2           0.0 / 0.000034
 *   a4b32ee2   Annual Salary Cost               6.6           0.0 / 0.000012
 *
 * Both numbers travel in the SAME payload, one level apart. The formula
 * (`voi × winProbSpread × 100`) multiplies BY the top-two win-probability gap,
 * which inverts decision theory — ISL measures the near-tied decision as worth
 * 16× the foregone one, and PLoT ranks them opposite.
 *
 * These specs pin that no percentage-point claim about resolving a factor
 * reaches the DOM, while proving each harness can still see the surrounding
 * content (trap 13 — an absence assertion with no positive control is vacuous).
 *
 * CLAIM TYPE: rendered text / DOM presence within jsdom. NOT a visibility
 * claim — jsdom cannot prove layout, and nothing here asserts one.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ConfidenceSection } from '../ConfidenceSection'
import { TriageCard } from '../../shared/TriageCard'
import type { ConfidenceSectionData } from '../types'
// Any "<n>pp" token, and the prose that used to carry it — ONE definition,
// shared with `evpiSurfacesRemoved.resolveNext.honesty.spec.tsx`, which pins the
// same absence on the NEW "Resolve next" surface. While each file held its own
// copy, narrowing one would have left the other passing.
import {
  PP_TOKEN,
  RESOLVING_CLAIM,
  WORTH_CLAIM,
  REFUTED_CLAIM_CONTROLS,
} from './helpers/refutedEvpiClaimMatchers'

vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusByTarget: vi.fn(),
}))

/**
 * Inject a prop the component no longer declares. The removal only means
 * something if a caller that STILL supplies the old prop renders nothing — a
 * test that merely omits it would also pass against a component that reads it.
 */
function withRemovedProp<P>(props: P, removed: Record<string, unknown>): P {
  return { ...props, ...removed } as P
}

function baseData(): ConfidenceSectionData {
  return {
    tier: { tier: 'strong', icon: '✓', label: 'Good foundation', description: 'ok' },
    qualityScore: 75,
    uncertainties: [],
    topUncertainties: [],
    improvements: [],
    topImprovements: [],
    rankingStability: 0.85,
  } as unknown as ConfidenceSectionData
}

describe('ConfidenceSection — no percentage-point value claim on an evidence gap', () => {
  /**
   * The gap fixture is the live `a4b32ee2` top gap, carrying the exact refuted
   * figure PLoT publishes for it.
   */
  const LIVE_GAP = {
    factorId: 'fac_team_experience',
    factorLabel: 'Existing Team Experience Level',
    suggestion: 'Gather data on "Existing Team Experience Level" to reduce uncertainty',
    voi: 0.3764947747747747,
    confidence: 44,
    evpiPp: 10.2,
  }

  function renderWithGap() {
    const data = {
      ...baseData(),
      evidenceGaps: [LIVE_GAP],
      topEvidenceGaps: [LIVE_GAP],
    } as unknown as ConfidenceSectionData
    return render(<ConfidenceSection data={data} />)
  }

  it('POSITIVE CONTROL: the gap itself still renders — removal did not empty the panel', () => {
    const { container } = renderWithGap()
    // Without this, every absence assertion below could pass on a blank panel.
    expect(screen.getByText('Existing Team Experience Level')).toBeInTheDocument()
    expect(container.textContent ?? '').toContain('Existing Team Experience Level')
  })

  it('does not render "Resolving could improve confidence by up to Xpp"', () => {
    const { container } = renderWithGap()
    const text = container.textContent ?? ''
    expect(text).not.toMatch(RESOLVING_CLAIM)
    expect(text).not.toContain('10.2')
    expect(text).not.toMatch(PP_TOKEN)
  })

  it('renders no pp claim even for a large figure that would be hard to miss', () => {
    const data = {
      ...baseData(),
      evidenceGaps: [{ ...LIVE_GAP, evpiPp: 52.9 }],
      topEvidenceGaps: [{ ...LIVE_GAP, evpiPp: 52.9 }],
    } as unknown as ConfidenceSectionData
    const { container } = render(<ConfidenceSection data={data} />)
    const text = container.textContent ?? ''
    // The old line ran the value through Math.round, so `52.9` never appeared
    // literally — asserting only on `52.9` would have been a vacuous test that
    // passed against the defect. Assert on what was actually rendered.
    expect(text).not.toContain('53pp')
    expect(text).not.toMatch(RESOLVING_CLAIM)
    expect(text).not.toMatch(PP_TOKEN)
  })
})

describe('TriageCard — no pp badge', () => {
  const CARD_PROPS = {
    cardKey: 'gap-fac_team_experience-0',
    ordinal: 1,
    title: 'Existing Team Experience Level',
    detail: 'Gather data on "Existing Team Experience Level" to reduce uncertainty',
    category: 'add_evidence' as const,
    targetNodeId: 'fac_team_experience',
  }

  it('POSITIVE CONTROL: the card renders its title and detail', () => {
    const { container } = render(<TriageCard {...CARD_PROPS} />)
    expect(container.textContent ?? '').toContain('Existing Team Experience Level')
  })

  it('accepts no evoiImpact prop and renders no "N.Npp" badge', () => {
    // `evoiImpact` was fed from `gap.evpiPp` and rendered as `{n.toFixed(1)}pp`
    // on BOTH the compact and full card. Passing it now must be a type error;
    // at runtime the badge must not appear.
    const { container } = render(
      <TriageCard {...withRemovedProp(CARD_PROPS, { evoiImpact: 10.2 })} />,
    )
    const text = container.textContent ?? ''
    expect(text).not.toMatch(PP_TOKEN)
    expect(text).not.toContain('10.2')
  })
})

describe('the removed prose templates appear nowhere in a rendered results surface', () => {
  it('neither "Worth Xpp if resolved" nor "Resolving could improve confidence" survives', () => {
    const gap = {
      factorId: 'f1',
      factorLabel: 'Market Receptivity to Feature',
      suggestion: 'Gather data on it',
      voi: 0.15,
      confidence: 44,
      evpiPp: 12.3,
    }
    const data = {
      ...baseData(),
      evidenceGaps: [gap],
      topEvidenceGaps: [gap],
    } as unknown as ConfidenceSectionData
    const { container } = render(<ConfidenceSection data={data} />)
    const text = container.textContent ?? ''

    // POSITIVE CONTROL on the matchers themselves: they CAN fire.
    //
    // ⚠ DRIVEN FROM THE SHARED TABLE, AND NOT HAND-LISTED, BECAUSE HAND-LISTING
    // LEFT A HOLE HERE. Until the adversarial review of PR #533 this block named
    // WORTH_CLAIM and RESOLVING_CLAIM only — but this file uses PP_TOKEN in three
    // absence assertions above, and PP_TOKEN had no control at all. Once the
    // definitions moved to a shared module (item 13 of the /simplify sweep),
    // neutering the shared PP_TOKEN left this spec 6/6 GREEN while those three
    // assertions silently stopped testing anything, about a REFUTED quantity.
    // Mutation-proven both ways: neutering WORTH_CLAIM or RESOLVING_CLAIM RED-ed
    // this file, neutering PP_TOKEN did not.
    //
    // Iterating the shared table closes that by construction: a pattern cannot be
    // added to the vocabulary without acquiring a control here, and the length
    // assertion means a SHRUNK table reds rather than quietly checking less.
    expect(REFUTED_CLAIM_CONTROLS.length).toBeGreaterThanOrEqual(6)
    for (const [re, original] of REFUTED_CLAIM_CONTROLS) {
      expect(re.test(original), `matcher must see: ${original}`).toBe(true)
    }

    expect(text).not.toMatch(WORTH_CLAIM)
    expect(text).not.toMatch(RESOLVING_CLAIM)
    expect(text).not.toContain('12.3')
  })
})
