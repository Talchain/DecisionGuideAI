/**
 * Lane 4 (P5): kebab-menu capabilities are REAL, and no kebab control lies.
 *
 * POC-DONE pass-condition 2: "no surface states an untruth" — a visible
 * control that does nothing is an untruth. These tests pin:
 *   1. Kebab -> Export opens the REAL Export Canvas dialog (was console.warn).
 *   2. Kebab -> Import opens the REAL Import Canvas dialog (required so the
 *      export dialog's own "re-importable" claim stays true).
 *   3. Kebab -> Snapshots opens the REAL Snapshot Manager.
 *   4. Kebab has NO "Replay tour" control (it dispatched into a flag-gated
 *      overlay that is off in every deploy context — removed lie).
 *   5. TopBar mounts the ScenarioSwitcher (scenario switching + scenario
 *      export/import reachable).
 *   6. The switcher's dropdown opens BELOW the trigger (TopBar is fixed at
 *      the top of the viewport; the toolbar-era default opened upward).
 *
 * Identity binding: menu items by EXACT accessible name (role=menuitem),
 * dialogs by their BottomSheet <h2> heading text, switcher by data-testid.
 * jsdom proves presence/wiring only, never pixels (trap 3) — the post-deploy
 * browser walk uses the testids listed in the lane report.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TopBar } from '../TopBar'
import { ToastProvider } from '../../../canvas/ToastContext'

function renderTopBar() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <TopBar
          scenarioTitle="Pricing Decision 2025"
          onTitleChange={vi.fn()}
          onSave={vi.fn()}
          onShare={vi.fn()}
        />
      </ToastProvider>
    </MemoryRouter>,
  )
}

function openKebab() {
  fireEvent.click(screen.getByRole('button', { name: 'More options' }))
}

describe('TopBar kebab capabilities (Lane 4 P5)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('kebab Export opens the real Export Canvas dialog', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    renderTopBar()
    openKebab()

    fireEvent.click(screen.getByRole('menuitem', { name: 'Export' }))

    // The REAL dialog: BottomSheet with the exact "Export Canvas" heading
    // and the real export action button.
    expect(
      screen.getByRole('heading', { name: 'Export Canvas' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Export as JSON/ }),
    ).toBeInTheDocument()
    // And the old lie is gone: no console.warn('Export') stub.
    expect(warnSpy).not.toHaveBeenCalledWith('Export')
    warnSpy.mockRestore()
  })

  it('kebab has an Import entry that opens the real Import Canvas dialog', () => {
    renderTopBar()
    openKebab()

    fireEvent.click(screen.getByRole('menuitem', { name: 'Import' }))

    expect(
      screen.getByRole('heading', { name: 'Import Canvas' }),
    ).toBeInTheDocument()
  })

  it('kebab has a Snapshots entry that opens the real Snapshot Manager', () => {
    renderTopBar()
    openKebab()

    fireEvent.click(screen.getByRole('menuitem', { name: 'Snapshots' }))

    expect(
      screen.getByRole('heading', { name: 'Snapshot Manager' }),
    ).toBeInTheDocument()
  })

  it('kebab does NOT offer a Replay tour control (removed lie)', () => {
    renderTopBar()
    openKebab()

    // The menu itself must be open for this absence assertion to see anything
    // (positive control against a vacuous pass — trap 13).
    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(
      screen.queryByRole('menuitem', { name: 'Replay tour' }),
    ).toBeNull()
  })

  it('TopBar mounts the ScenarioSwitcher', () => {
    renderTopBar()
    expect(screen.getByTestId('scenario-switcher-trigger')).toBeInTheDocument()
  })

  it('ScenarioSwitcher dropdown opens BELOW the trigger in the TopBar', () => {
    renderTopBar()
    fireEvent.click(screen.getByTestId('scenario-switcher-trigger'))

    const menu = screen.getByTestId('scenario-switcher-menu')
    expect(menu.className).toContain('top-full')
    expect(menu.className).not.toContain('bottom-full')
  })
})
