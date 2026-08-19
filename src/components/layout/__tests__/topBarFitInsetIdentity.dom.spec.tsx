/**
 * UX GATE 7b — THE SELECTOR THE FIT FRAME USES POINTS AT THE REAL TOP BAR.
 *
 * `computeFitPadding` reserves the top edge by measuring
 * `document.querySelector(TOP_BAR_SELECTOR)`. `topBarFitInset.spec.ts` proves
 * the ARITHMETIC against a stubbed rect; it cannot prove the selector finds the
 * bar a user actually sees. Without this file the whole 7b fix could be
 * measuring nothing and every test would still be green — platform trap 13 (an
 * absence/presence probe with no positive control) reached through a selector.
 *
 * IDENTITY BINDING (trap 19): the assertion is not "some element matched". It
 * is that the matched element IS the rendered `TopBar` — the one carrying the
 * single model-name control this bar owns — and that it is UNIQUE, so the
 * `querySelector` (which silently takes the first match) cannot drift onto a
 * different landmark.
 *
 * jsdom proves the binding, never the geometry (trap 3): `position: fixed` and
 * the 45px height come from CSS that jsdom does not run, so nothing here
 * asserts a pixel. The live rect is recorded in `topBarFitInset.spec.ts`.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TopBar } from '../TopBar'
import { ToastProvider } from '../../../canvas/ToastContext'
import { TOP_BAR_SELECTOR } from '../../../canvas/utils/computeFitPadding'

function renderTopBar() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <TopBar
          scenarioTitle="Pricing model 2025"
          onTitleChange={vi.fn()}
          onSave={vi.fn()}
          onShare={vi.fn()}
        />
      </ToastProvider>
    </MemoryRouter>,
  )
}

describe('TOP_BAR_SELECTOR binds to the rendered TopBar (UX gate 7b)', () => {
  // Ordered FIRST on purpose: it must observe a document this file has not
  // rendered into, so it cannot depend on RTL's afterEach cleanup running.
  it('CONTRAST CONTROL: with no TopBar rendered, the selector finds nothing', () => {
    expect(document.querySelector(TOP_BAR_SELECTOR)).toBeNull()
  })

  it('finds exactly one element, and it is the TopBar itself', () => {
    renderTopBar()

    const matches = document.querySelectorAll(TOP_BAR_SELECTOR)
    expect(matches.length, 'querySelector takes the FIRST match — a second banner would silently redirect the fit inset').toBe(1)

    const bar = matches[0] as HTMLElement
    // Identity, not "an element exists": the bar is the ancestor of the single
    // model-name control it owns. A different landmark picking up role="banner"
    // would fail here rather than quietly becoming the fit occluder.
    expect(bar.contains(screen.getByTestId('scenario-name-button'))).toBe(true)
  })

})
