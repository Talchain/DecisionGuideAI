/**
 * The top bar's version-history control is REAL (R4, Paul, 16 Aug 2026).
 *
 * ── THE DEFECT THIS PINS ─────────────────────────────────────────────────────
 * This button existed and was a lie. It carried `aria-label="Version history"`
 * and a tooltip reading "Version history (coming soon)", and its click
 * dispatched an informational toast — *"Version history is coming soon."* —
 * while the fully built versions feature was mounted on the same route as a
 * floating pill 57px below it (ledger L-08). A control denying a capability the
 * product already had.
 *
 * ⚠ NOTE WHAT A PRESENCE TEST WOULD HAVE MISSED. `TopBar.test.tsx` already
 * asserted `getByRole('button', { name: /version history/i })` — and passed,
 * throughout, against the toast. Presence of a control is not coverage of what
 * it does (trap 13b). These tests assert the OUTCOME.
 *
 * ⚠ SCOPE (trap 16): jsdom proves the wiring, never that the button is visible
 * or reachable on a real screen.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TopBar } from '../TopBar'
import { ToastProvider } from '../../../canvas/ToastContext'
import { VersionsPanelHost } from '../../../canvas/versions/VersionsPanelHost'
import { useVersionsPanelStore } from '../../../canvas/versions/versionsPanelStore'

const baseProps = {
  scenarioTitle: 'Pricing decision',
  onTitleChange: vi.fn(),
  onSave: vi.fn(),
  onShare: vi.fn(),
}

/**
 * The bar and the panel host as SIBLINGS — the production arrangement on the
 * canvas route. Neither is an ancestor of the other, which is precisely the
 * condition under which the retired host-local `useState` could not have worked.
 */
function renderBarAndPanel() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <TopBar {...baseProps} />
        <VersionsPanelHost />
      </ToastProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  localStorage.clear()
  useVersionsPanelStore.setState({ isOpen: false })
})

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('TopBar — version history', () => {
  it('opens the version-history panel', () => {
    renderBarAndPanel()
    expect(screen.queryByTestId('what-changed-panel')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('topbar-versions-trigger'))

    expect(screen.getByTestId('what-changed-panel')).toBeInTheDocument()
  })

  it('dispatches NO toast — the "coming soon" denial is gone', () => {
    // Bound to the exact mechanism the defect used, not to the words: any
    // reinstated toast from this control fails here whatever it says.
    const toastSpy = vi.fn()
    window.addEventListener('topbar:show-toast', toastSpy)
    try {
      renderBarAndPanel()

      fireEvent.click(screen.getByTestId('topbar-versions-trigger'))

      expect(toastSpy).not.toHaveBeenCalled()
    } finally {
      window.removeEventListener('topbar:show-toast', toastSpy)
    }
  })

  it('carries no "coming soon" copy in the bar itself', () => {
    // ⚠ SCOPE, stated because a mutant measured it: reverting TopBar to the old
    // toast leaves this test GREEN. The denial travelled as a window event whose
    // renderer (ReactFlowGraph's listener) is not mounted here, so this can only
    // observe copy the BAR renders — never a toast. The discriminating guard for
    // the toast is the test above; this one guards the static copy, and saying so
    // is better than letting it read as coverage it does not have.
    renderBarAndPanel()

    fireEvent.click(screen.getByTestId('topbar-versions-trigger'))

    expect(document.body.textContent ?? '').not.toMatch(/coming soon/i)
  })

  it('keeps the control discoverable by its accessible name', () => {
    // The existing TopBar suite binds to this name; it must survive the rewiring.
    renderBarAndPanel()

    expect(screen.getByRole('button', { name: /version history/i })).toBeInTheDocument()
  })
})
