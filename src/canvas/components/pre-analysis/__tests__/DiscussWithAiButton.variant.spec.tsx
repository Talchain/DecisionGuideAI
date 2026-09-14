/**
 * DiscussWithAiButton — Brief 5.1 Task 9 variant regression.
 *
 * The sparkle button now takes a `variant` prop. 'primary' (default)
 * preserves current behaviour at every non-Analysis-tab call site.
 * 'secondary' reduces resting emphasis via opacity-50 while remaining
 * visible at all times — no invisible-but-focusable controls.
 *
 * Keyboard affordance: focus-visible and focus-within reveal the sparkle
 * to full opacity BEFORE activation, so keyboard users see the control
 * before interacting with it.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DiscussWithAiButton } from '../DiscussWithAiButton'
import { UNRECOGNISED_BIAS_SIGNAL_TITLE } from '../../../shared/biasSignalTitles'

describe('DiscussWithAiButton — Brief 5.1 Task 9 variant prop', () => {
  it('defaults to the primary variant when no variant prop is provided', () => {
    render(
      <DiscussWithAiButton
        element={{ kind: 'factor', label: 'Test Factor' }}
        onSend={() => {}}
      />,
    )

    const btn = screen.getByTestId('discuss-with-ai')
    expect(btn).toHaveAttribute('data-variant', 'primary')
    expect(btn.className).not.toContain('opacity-50')
  })

  it('secondary variant applies opacity-50 at rest and reveal classes on interaction', () => {
    render(
      <DiscussWithAiButton
        element={{ kind: 'factor', label: 'Test Factor' }}
        onSend={() => {}}
        variant="secondary"
      />,
    )

    const btn = screen.getByTestId('discuss-with-ai')
    expect(btn).toHaveAttribute('data-variant', 'secondary')
    // Visibility floor: opacity-50 at rest (not invisible).
    expect(btn.className).toContain('opacity-50')
    // Reveal to full emphasis on hover, focus-visible, focus-within.
    expect(btn.className).toContain('hover:opacity-100')
    expect(btn.className).toContain('focus-visible:opacity-100')
    expect(btn.className).toContain('focus-within:opacity-100')
  })

  it('secondary variant preserves the accessible name and keyboard focusability', () => {
    render(
      <DiscussWithAiButton
        element={{ kind: 'factor', label: 'Revenue' }}
        onSend={() => {}}
        variant="secondary"
      />,
    )

    // Screen reader name unchanged across variants.
    const btn = screen.getByRole('button', { name: 'Discuss Revenue with AI' })
    expect(btn).toBeInTheDocument()
    // Forbidden: invisible-but-focusable — no opacity-0 or sr-only.
    expect(btn.className).not.toContain('opacity-0')
    expect(btn.className).not.toContain('sr-only')
  })

  it('⛔ an UNCATEGORISED bias gets an accessible name that names no bias', () => {
    // ⚠ THIS IS THE DEFAULT ARIA LABEL, so it reached SCREEN-READER USERS ONLY.
    // `biasType` is `trigger.title`, the neutral fallback whenever the registry
    // could not resolve the producer's code — so an uncategorised signal
    // announced "Discuss Reasoning check with AI" as though that were a bias.
    render(
      <DiscussWithAiButton
        element={{ kind: 'bias', biasType: UNRECOGNISED_BIAS_SIGNAL_TITLE }}
        onSend={() => {}}
      />,
    )
    const btn = screen.getByRole('button', { name: 'Discuss this reasoning check with AI' })
    expect(btn).toBeInTheDocument()
  })

  it('⭐ CONTRAST — a RECOGNISED bias is still named, so the branch is not a blanket', () => {
    // Without this the fix could have replaced the label for every bias,
    // losing the categorisation we DO have. The arm above cannot see that.
    render(
      <DiscussWithAiButton element={{ kind: 'bias', biasType: 'Anchoring' }} onSend={() => {}} />,
    )
    expect(screen.getByRole('button', { name: 'Discuss Anchoring with AI' })).toBeInTheDocument()
  })

  it('primary variant does NOT add the opacity reveal classes (keeps behaviour at non-Analysis-tab call sites)', () => {
    render(
      <DiscussWithAiButton
        element={{ kind: 'factor', label: 'Test' }}
        onSend={() => {}}
        variant="primary"
      />,
    )

    const btn = screen.getByTestId('discuss-with-ai')
    expect(btn.className).not.toContain('opacity-50')
    expect(btn.className).not.toContain('hover:opacity-100')
    expect(btn.className).not.toContain('focus-within:opacity-100')
  })
})
