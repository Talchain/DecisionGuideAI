/**
 * THE SHARE BUTTON ONLY APPEARS WHEN THE LINK ACTUALLY CARRIES THE DECISION
 * (29 Aug 2026).
 *
 * ── THE DEFECT THIS PINS ─────────────────────────────────────────────────────
 * The bar showed one Share button for two very different outcomes, and neither
 * told the truth:
 *
 *   · GUEST (or any unsaved canvas) — `handleShare` fell through to
 *     `buildShareLink(hash)`, which is `#/canvas?run=<hash>`. That hash
 *     resolves against the sender's OWN device history
 *     (`tryRestoreResultsFromHistory`); `shareLink.ts`'s own header says
 *     "Share links are local-device only (no backend sync in current scope)".
 *     The clipboard write SUCCEEDED, so the sender had every reason to think
 *     they had shared something — and the failure landed on a SECOND person,
 *     who opened an empty canvas with no idea why. Worse than a dead control:
 *     it appears to succeed, and it misleads someone who never touched it.
 *
 *   · BEFORE A RUN — `results.hash` is absent, so the handler hit
 *     `console.warn('[CanvasMVP] Cannot share scenario: no results hash
 *     available')` and returned. A silently dead click.
 *
 * Only the PERSISTED path was ever real: `createSharedBrief()` mints a row via
 * RPC and returns a slug served by the `/brief/:slug` route
 * (`AppPoC.tsx:938` → `SharedBriefPage`). That path is kept. The button is now
 * bound to it, so the control exists exactly when it can do what it says.
 *
 * ⚠ SCOPE (trap 3/16): jsdom proves the gating and the copy, never that the
 * button is visible on a real screen, and nothing here witnesses the RPC.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TopBar } from '../TopBar'
import { ToastProvider } from '../../../canvas/ToastContext'

const baseProps = {
  scenarioTitle: 'Pricing decision',
  onTitleChange: vi.fn(),
  onSave: vi.fn(),
  onShare: vi.fn(),
}

function renderBar(extra: Record<string, unknown> = {}) {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <TopBar {...baseProps} {...extra} />
      </ToastProvider>
    </MemoryRouter>,
  )
}

describe('TopBar share control', () => {
  /**
   * ⚠ THESE BIND BY `data-testid`, NOT BY ACCESSIBLE NAME, AND THAT IS THE
   * WHOLE POINT — MEASURED, NOT ASSUMED. The first version of this file
   * queried `getByRole('button', { name: /share/i })`. A discriminating mutant
   * (render the button unconditionally) left it fully GREEN: the control's
   * accessible name is now "Copy link to decision brief", which contains no
   * "share", so the absence assertion could never have observed the button it
   * was written to exclude. It was a guard agreeing with itself, and only the
   * mutant pair showed it. Binding by identity is what makes the mutant bite.
   */
  it('is ABSENT for a guest / unsaved canvas — the link would carry nothing', () => {
    renderBar({ shareScenarioId: null })
    expect(screen.queryByTestId('topbar-share')).toBeNull()
  })

  it('is ABSENT when the scenario id is an empty string', () => {
    // Guards the `!== ''` half specifically: an empty id is not a persisted
    // scenario, and `''` is falsy-but-present in a way a `!= null` check alone
    // would wave through.
    renderBar({ shareScenarioId: '' })
    expect(screen.queryByTestId('topbar-share')).toBeNull()
  })

  it('is PRESENT for a persisted scenario — the twin, so absence is not vacuous', () => {
    renderBar({ shareScenarioId: 'scn_abc123' })
    expect(screen.getByTestId('topbar-share')).toBeInTheDocument()
  })

  /**
   * The accessible name must say WHAT THE LINK CARRIES. "Share decision" was
   * true of both outcomes above and therefore distinguished neither; the point
   * of the label is that a recipient gets the decision, not the sender's
   * device state.
   */
  it('names what the link carries, and does not promise the canvas', () => {
    renderBar({ shareScenarioId: 'scn_abc123' })
    const btn = screen.getByTestId('topbar-share')
    const name = (btn.getAttribute('aria-label') ?? '').toLowerCase()
    expect(name).toMatch(/brief/)
    // POSITIVE CONTROL for the probe: it must be able to read a non-empty name
    // at all, or the assertion above would pass on an unlabelled button.
    expect(name.length).toBeGreaterThan(0)
  })
})
