/**
 * Brief 5.8B D2a — HeroQualifier tests.
 *
 * Pure threshold map. Asserts the lowest sub-threshold dimension wins,
 * all-≥70 suppresses the qualifier entirely, and unknown / non-numeric
 * inputs are ignored.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HeroQualifier, pickQualifier } from '../HeroQualifier'

describe('pickQualifier (Brief 5.8B D2a)', () => {
  it('returns null when dimensions is undefined', () => {
    expect(pickQualifier(undefined)).toBeNull()
  })

  it('returns null when dimensions is empty', () => {
    expect(pickQualifier({})).toBeNull()
  })

  it('returns null when every dimension is at or above 0.7', () => {
    expect(pickQualifier({ evidence: 0.85, robustness: 0.7, clarity: 0.91 })).toBeNull()
  })

  it('picks evidence when it is the lowest sub-threshold dimension', () => {
    const result = pickQualifier({ evidence: 0.4, robustness: 0.65, clarity: 0.8 })
    expect(result).toEqual({
      dimension: 'evidence',
      copy: 'Confidence limited by unverified estimates',
    })
  })

  it('picks robustness when it is the lowest sub-threshold dimension', () => {
    const result = pickQualifier({ evidence: 0.65, robustness: 0.4, clarity: 0.8 })
    expect(result?.dimension).toBe('robustness')
    expect(result?.copy).toBe('Result is sensitive to assumption shifts')
  })

  it('picks clarity when it is the lowest sub-threshold dimension', () => {
    const result = pickQualifier({ evidence: 0.65, robustness: 0.68, clarity: 0.3 })
    expect(result?.dimension).toBe('clarity')
    expect(result?.copy).toBe('Model framing has limitations')
  })

  it('handles wireframe-aliased keys (Structure / Coverage / Verified)', () => {
    expect(pickQualifier({ structure: 0.4 })?.copy).toBe('Model structure incomplete')
    expect(pickQualifier({ coverage: 0.4 })?.copy).toBe('Some factors lack data')
    expect(pickQualifier({ verified: 0.4 })?.copy).toBe('Key assumptions not yet confirmed')
  })

  it('ignores unknown dimension keys', () => {
    expect(pickQualifier({ unknown_dim: 0.1 })).toBeNull()
  })

  it('ignores non-numeric values (NaN, undefined)', () => {
    expect(pickQualifier({ evidence: NaN, robustness: 0.85 } as never)).toBeNull()
    expect(pickQualifier({ evidence: undefined } as never)).toBeNull()
  })

  it('treats exactly 0.7 as at-threshold (not below)', () => {
    expect(pickQualifier({ evidence: 0.7 })).toBeNull()
  })

  it('case-insensitive on dimension keys', () => {
    expect(pickQualifier({ EVIDENCE: 0.4 })?.dimension).toBe('evidence')
  })
})

describe('HeroQualifier render', () => {
  it('renders nothing when no dimension fires', () => {
    const { container } = render(<HeroQualifier dimensions={{ evidence: 0.85 }} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the picked qualifier with text-warning + data attribute', () => {
    render(<HeroQualifier dimensions={{ evidence: 0.4 }} />)
    const el = screen.getByTestId('hero-qualifier')
    expect(el.textContent).toBe('Confidence limited by unverified estimates')
    expect(el.className).toContain('text-warning')
    expect(el.getAttribute('data-qualifier-dimension')).toBe('evidence')
  })

  it('appends supplied className', () => {
    render(<HeroQualifier dimensions={{ evidence: 0.4 }} className="mt-2" />)
    expect(screen.getByTestId('hero-qualifier').className).toContain('mt-2')
  })

  // P0 V5 golden-path repair (Wave 4 wiring): completeness reasons take
  // precedence over dimension qualifiers. Pin the precedence + curated
  // copy mapping so future changes don't accidentally surface raw codes
  // or fall through to the dimension qualifier when source data is
  // incomplete.
  describe('completenessReasons (Wave 4 wiring)', () => {
    it('renders curated copy from the first completeness reason code', () => {
      render(
        <HeroQualifier
          dimensions={{ evidence: 0.85 }}
          completenessReasons={['win_probability_missing']}
        />,
      )
      const el = screen.getByTestId('hero-qualifier')
      // Curated copy from freshnessReasons.ts
      expect(el.textContent).toContain('Likelihood scores')
      expect(el.getAttribute('data-qualifier-source')).toBe('completeness')
      // FOLLOW-UP review (P1.2): raw code MUST NOT appear as a DOM
      // attribute. The semantic source attribute is sufficient.
      expect(el.getAttribute('data-qualifier-reason')).toBeNull()
    })

    it('completeness reasons take precedence over dimension qualifier', () => {
      // Even when a low-evidence dimension would otherwise fire, the
      // completeness qualifier is the more critical signal.
      render(
        <HeroQualifier
          dimensions={{ evidence: 0.3 }}
          completenessReasons={['sensitivity_missing']}
        />,
      )
      const el = screen.getByTestId('hero-qualifier')
      expect(el.getAttribute('data-qualifier-source')).toBe('completeness')
      expect(el.textContent).toContain('Factor sensitivity')
    })

    it('redaction: raw reason codes are NOT in any DOM attribute', () => {
      // Iterate every code in COMPLETENESS_REASON_COPY and verify the
      // raw code never appears in any element attribute on the
      // rendered output. The visible text comes from the curated
      // table; attributes use a semantic source value only.
      const codes = [
        'win_probability_missing',
        'sensitivity_missing',
        'robustness_unavailable',
        'decision_review_unavailable',
        'expected_outcome_missing',
      ]
      for (const code of codes) {
        const { container, unmount } = render(
          <HeroQualifier dimensions={undefined} completenessReasons={[code]} />,
        )
        const el = screen.getByTestId('hero-qualifier')
        for (const attr of Array.from(el.attributes)) {
          expect(
            attr.value,
            `attribute ${attr.name} for code ${code}`,
          ).not.toContain(code)
        }
        // Sanity: the visible text is non-empty (not the same check as
        // attribute redaction).
        expect(el.textContent!.length).toBeGreaterThan(0)
        // No descendant element exposes the code either.
        expect(container.outerHTML).not.toContain(code)
        unmount()
      }
    })

    it('falls through to dimension qualifier when completenessReasons is empty', () => {
      render(<HeroQualifier dimensions={{ evidence: 0.4 }} completenessReasons={[]} />)
      expect(screen.getByTestId('hero-qualifier').getAttribute('data-qualifier-source')).toBe(
        'dimension',
      )
    })

    it('unknown completeness reason code → safe generic fallback (raw code never echoed)', () => {
      render(
        <HeroQualifier
          dimensions={undefined}
          completenessReasons={['definitely_not_a_known_code_42']}
        />,
      )
      const el = screen.getByTestId('hero-qualifier')
      expect(el.textContent).not.toContain('definitely_not_a_known_code_42')
      expect(el.textContent!.length).toBeGreaterThan(0)
    })

    it('completeness copy contains no internal terms', () => {
      const FORBIDDEN = [
        /\bnoop\b/i,
        /\bzod\b/i,
        /\bgraph_hash\b/i,
        /\bfact_type\b/i,
        /\bedit_graph\b/i,
        /\bnormalised\b/i,
      ]
      const codes = [
        'win_probability_missing',
        'sensitivity_missing',
        'robustness_unavailable',
        'decision_review_unavailable',
        'expected_outcome_missing',
        'analysis_partial',
      ]
      for (const code of codes) {
        const { unmount } = render(
          <HeroQualifier dimensions={undefined} completenessReasons={[code]} />,
        )
        const el = screen.getByTestId('hero-qualifier')
        for (const pat of FORBIDDEN) {
          expect(el.textContent, `${code}: ${el.textContent}`).not.toMatch(pat)
        }
        unmount()
      }
    })
  })
})
