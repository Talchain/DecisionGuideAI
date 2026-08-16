/**
 * DebugPanel — the collapsed pill must name what it opens.
 *
 * Manual test, 2026-08-16: a button on the left of the canvas, stacked
 * directly above the zoom/viewport controls, reads "Test". It is NOT a
 * leftover debug affordance to delete — it is the live collapsed state of the
 * Debug Panel, and clicking it expands DebugPanelV2 (DebugPanel.tsx:416-439).
 * Its own tooltip already said "Open Debug Panel"; only the visible label was
 * wrong, which is why an `aria-label="Test"` / `title="Test"` grep found
 * nothing — "Test" was the button's text node.
 *
 * So per the brief's own fork: the button is real, and it gets its real label.
 *
 * Position evidence for "near the zoom controls": DebugPanel.tsx:402-404 pins
 * `left: 12, bottom: 200` with a comment computing that offset as exactly the
 * height of CanvasViewportControls (`fixed bottom-3 left-3`).
 *
 * The pill had NO test coverage before this file — neither
 * debugPanelVisibility.spec.ts nor DebugPanelV2.spec.tsx touches the collapsed
 * state, so the label was unpinned.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DebugPanel } from '../DebugPanel'

describe('DebugPanel — collapsed pill label', () => {
  beforeEach(() => {
    // The panel gates on staging/dev + (?diag | window.__OLUMI_DEBUG).
    // Assert the gate opened, so an absent button can never be mistaken for a
    // passing assertion about its label (a vacuous-absence guard).
    window.__OLUMI_DEBUG = true
  })

  afterEach(() => {
    delete window.__OLUMI_DEBUG
  })

  // Bound by the `title` the button ALREADY carried at pristine, so the anchor
  // is stable across the fix and the label assertions are the only thing that
  // moves. Binding by role+name would have been circular here: the accessible
  // name IS the label under test.
  const findPill = () => screen.queryByTitle('Open Debug Panel')

  it('renders the collapsed pill at all (precondition for every assertion below)', () => {
    // GREEN at pristine — a real control. Without it, "the pill is not
    // labelled Test" would also pass on an empty document.
    render(<DebugPanel />)
    expect(findPill()).toBeInTheDocument()
  })

  it('does not label itself "Test"', () => {
    render(<DebugPanel />)
    // Bind to the element, then assert on ITS text — not a document-wide
    // queryByText, which another surface could satisfy or starve.
    expect(findPill()?.textContent?.trim()).not.toBe('Test')
  })

  it('names the thing it opens, in the label and in the accessible name', () => {
    render(<DebugPanel />)
    const pill = findPill()
    expect(pill?.textContent?.trim()).toBe('Debug')
    // The visible label is necessarily short; the accessible name carries the
    // full action so a screen-reader user is not handed the bare word "Debug".
    expect(pill).toHaveAttribute('aria-label', 'Open Debug Panel')
    expect(screen.getByRole('button', { name: 'Open Debug Panel' })).toBe(pill)
  })

  it('stays hidden when the diagnostics gate is closed', () => {
    // The gate is staging/dev + (?diag | window.__OLUMI_DEBUG). This pins that
    // the assertions above are reading a gate that can genuinely shut.
    delete window.__OLUMI_DEBUG
    render(<DebugPanel />)
    expect(findPill()).not.toBeInTheDocument()
  })
})
