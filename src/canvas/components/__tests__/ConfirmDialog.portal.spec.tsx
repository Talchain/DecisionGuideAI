/**
 * ConfirmDialog escapes its mount point, because a fixed overlay does not.
 *
 * ── THE DEFECT, MEASURED ON THE DEPLOYED BUILD ─────────────────────────────
 * The overlay is `position: fixed; inset-0`, which everyone reads as "fills the
 * viewport". It does not when an ancestor establishes a containing block — and
 * `TopBar.module.css` sets `backdrop-filter: blur(8px)` on the floating pill,
 * which does exactly that. `backdrop-filter` is easy to miss: unlike
 * `transform` it is invisible in the layout and nobody writing a modal thinks
 * of it.
 *
 * Measured at 1280x800, guest, on two consecutive deploys:
 *   deploy 6a93f806 (before) "Reset canvas?"     overlay 477x43  card top  -73
 *   deploy 6a94047c (after)  "Start a new model?" overlay 411x43 card top -112
 * The overlay is the size of the TOP BAR, not the viewport, and the card is
 * centred in a 43px box — so its title and first line render ABOVE THE FOLD,
 * unreadable. Pre-existing on both builds; the second is worse only because
 * that card is taller.
 *
 * ── WHY THIS TEST IS SHAPED THIS WAY ───────────────────────────────────────
 * jsdom cannot prove visibility or layout (CLAUDE.md trap 3) and nothing here
 * claims it does. What it CAN prove is the structural property that the fix
 * rests on: the overlay is not a descendant of whatever mounted it, so no
 * ancestor's `backdrop-filter`/`transform` can capture it. The user-visible
 * half — the card lands inside the viewport — is asserted in a real browser by
 * `e2e/visual/confirmDialogWithinViewport.visual.spec.ts`. Neither is
 * sufficient alone: this one would pass on a portal that rendered off-screen,
 * that one would pass on a lucky ancestor.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ConfirmDialog } from '../ConfirmDialog'

function renderInsideAContainingBlock() {
  const host = document.createElement('div')
  // The real hazard, reproduced: an ancestor that captures fixed descendants.
  host.style.backdropFilter = 'blur(8px)'
  host.setAttribute('data-testid', 'mount-point')
  document.body.appendChild(host)
  render(
    <ConfirmDialog title="T" message="M" onConfirm={vi.fn()} onCancel={vi.fn()} />,
    { container: host },
  )
  return host
}

describe('ConfirmDialog is portalled out of its mount point', () => {
  it('renders the overlay outside the element that mounted it', () => {
    const host = renderInsideAContainingBlock()

    const dialog = screen.getByRole('dialog')
    expect(host.contains(dialog)).toBe(false)
  })

  it('renders it as a child of document.body', () => {
    renderInsideAContainingBlock()

    expect(screen.getByRole('dialog').parentElement).toBe(document.body)
  })

  /**
   * The precondition. Without it both assertions above would also pass on a
   * build where the dialog failed to render at all.
   */
  it('PRECONDITION: the dialog rendered, with its content', () => {
    renderInsideAContainingBlock()

    const dialog = screen.getByRole('dialog')
    expect(dialog.textContent).toContain('T')
    expect(dialog.textContent).toContain('M')
  })
})
