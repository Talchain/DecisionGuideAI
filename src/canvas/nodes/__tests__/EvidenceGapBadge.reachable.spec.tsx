/**
 * EvidenceGapBadge — the badge's meaning has to reach someone.
 *
 * The badge is a 12px circle holding a 7px "?" in warning colour. It is
 * `aria-hidden`, so ALL of its meaning lives on the sibling hover zone. That
 * makes the hover zone's accessible name the entire product surface here, and
 * it was being discarded: `aria-label` on a bare `<div>` maps to
 * `role="generic"`, and ARIA forbids a name on a generic element.
 *
 * These tests bind to the ROLE, not to the element — `getByRole('img', {name})`
 * fails if the role is dropped, if the name is dropped, or if a future refactor
 * moves the name onto something that cannot carry it. Querying the testid and
 * reading `getAttribute('aria-label')` would pass in every one of those cases,
 * because the attribute is present either way; it is the MAPPING that was
 * broken, and only a role query can see it.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EvidenceGapBadge } from '../EvidenceGapBadge'

describe('EvidenceGapBadge — meaning reaches assistive tech and the keyboard', () => {
  it('exposes its meaning as a named graphic, not an unnamed div', () => {
    render(<EvidenceGapBadge label="Annual Platform Cost" />)
    const badge = screen.getByRole('img', { name: /No observed data for "Annual Platform Cost"/ })
    expect(badge).toBeInTheDocument()
  })

  it('names the factor, so several badges on one canvas are distinguishable', () => {
    // Six of these render at once on a real model. An unnamed — or identically
    // named — set of six tells a screen-reader user nothing about which factor
    // is which.
    render(
      <>
        <EvidenceGapBadge label="Annual Platform Cost" />
        <EvidenceGapBadge label="Operational Overhead" />
      </>,
    )
    expect(screen.getByRole('img', { name: /Annual Platform Cost/ })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Operational Overhead/ })).toBeInTheDocument()
  })

  it('is reachable by keyboard — the meaning was mouse-hover-only', () => {
    // `title` needs a pointer. On touch and by keyboard the escalation copy was
    // unreachable, on a 20px transparent target.
    render(<EvidenceGapBadge label="Annual Platform Cost" escalation="critical" />)
    expect(screen.getByRole('img', { name: /Critical evidence gap/ })).toHaveAttribute('tabindex', '0')
  })

  it('carries the ESCALATION in the name, not only in the colour', () => {
    // Escalation currently changes border and text colour and adds a pulse.
    // Colour alone is not a channel every user has.
    render(<EvidenceGapBadge label="Runway" escalation="warning" />)
    expect(
      screen.getByRole('img', { name: /High investigation value/ }),
    ).toBeInTheDocument()
  })

  it('is NOT a button — there is no action behind it', () => {
    // A control that does nothing when pressed is worse than a graphic; this
    // pins the decision so a later "make it clickable" does not sneak in
    // without an action to back it.
    render(<EvidenceGapBadge label="Runway" />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('the visual glyph stays hidden, so the name is announced once and not twice', () => {
    const { container } = render(<EvidenceGapBadge label="Runway" />)
    const visual = container.querySelector('[data-testid="evidence-gap-badge"]')
    expect(visual).toHaveAttribute('aria-hidden', 'true')
  })
})
