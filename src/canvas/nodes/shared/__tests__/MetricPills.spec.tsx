/**
 * MetricPills — influence-scale disclosure (lane C4).
 *
 * The "I: NN%" chip shares its number with the Drivers panel via the shared
 * display model (useNodeDisplayMetadata → driverDisplayModel), but rendered it
 * bare — no tooltip, no accessible name. On the fallback basis
 * ('normalised_elasticity') that number is set-relative (top driver ≡ 100% by
 * construction), so the chip must disclose the scale the same way the panel
 * does. Canvas-node idiom: native `title` + `aria-label` on the pill span
 * (same as the sibling EdgePills strength pill — audit §8 P0-4).
 *
 * Fail-closed: with no provenance passed (legacy callers/fixtures) the chip
 * keeps a generic honest label and never claims a basis it was not given.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MetricPills } from '../MetricPills'

// Deliberately hard-coded (not imported from influenceScaleCopy) so a copy
// change is a conscious, visible decision in this spec. No em dashes (DS ban,
// review fix 3 — policed by influenceScaleCopy.copyHygiene.spec.ts).
const RELATIVE_TITLE =
  'Influence: how much this factor affects the outcome, relative to the strongest. The top driver always shows 100%.'
const ABSOLUTE_TITLE =
  'Influence: how much this factor affects the outcome, as an absolute causal influence score from the analysis.'
const GENERIC_TITLE = 'Influence: how much this factor affects the outcome'

describe('MetricPills — influence-scale disclosure (lane C4)', () => {
  // Review fix 5: aria-label on a role-less <span> is unreliably announced
  // (generic role). The pill must use the codebase's ratified idiom for
  // meaningful static markers — role="img" + aria-label (see
  // ReadinessColourStrip.tsx for the rationale) — so every assertion below
  // resolves the pill BY that role and accessible name.
  it('relative basis: pill is a role="img" named with the relative-scale disclosure, plus a title', () => {
    render(<MetricPills influencePct={100} influenceProvenance="normalised_elasticity" />)
    const pill = screen.getByRole('img', {
      name: 'Influence 100%, relative to the strongest factor. The top driver always shows 100%',
    })
    expect(pill.textContent).toBe('I: 100%')
    expect(pill.getAttribute('title')).toBe(RELATIVE_TITLE)
  })

  it('producer basis: pill carries the absolute-basis wording, never the relative claim', () => {
    render(<MetricPills influencePct={62} influenceProvenance="influence_score" />)
    const pill = screen.getByRole('img', {
      name: 'Influence 62%, an absolute causal influence score from the analysis',
    })
    expect(pill.textContent).toBe('I: 62%')
    expect(pill.getAttribute('title')).toBe(ABSOLUTE_TITLE)
    expect(pill.getAttribute('title')).not.toContain('always shows 100%')
  })

  it('no provenance (fail-closed): generic honest label, no basis claim', () => {
    render(<MetricPills influencePct={80} />)
    const pill = screen.getByRole('img', { name: 'Influence 80%' })
    expect(pill.textContent).toBe('I: 80%')
    expect(pill.getAttribute('title')).toBe(GENERIC_TITLE)
  })

  it('unchanged behaviour: renders nothing when no metric is present', () => {
    const { container } = render(<MetricPills />)
    expect(container.firstChild).toBeNull()
  })

  it('unchanged behaviour: confidence pill renders without an influence disclosure', () => {
    render(<MetricPills confidencePct={45} />)
    expect(screen.getByText('C: 45%')).toBeDefined()
    expect(screen.queryByText(/^I: /)).toBeNull()
  })
})
