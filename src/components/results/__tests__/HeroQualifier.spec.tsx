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
})
