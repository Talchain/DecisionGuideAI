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
