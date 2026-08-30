/**
 * KebabMenu — the route to a fresh model is NAMED AS ONE.
 *
 * ── WHY ────────────────────────────────────────────────────────────────────
 * `resetCanvas` is the product's ONLY route to a blank canvas: `CanvasToolbar`
 * is production-unmounted, and `ReactFlowGraph.tsx`'s copy of the sheet sits
 * behind a `showResetConfirm` that is never set true (established by the
 * sibling pin, `KebabMenu.resetNotRecoverable.spec.tsx`). So this one menu item
 * is the whole of "I have finished with this model, let me start my own".
 *
 * It was called **Reset canvas** — a name that describes the MECHANISM (a
 * destructive wipe) rather than the INTENT (beginning something). An
 * unsupervised tester looking for "start a new model" does not find it there,
 * and one who does find it reads a red, irreversible-sounding control and
 * reasonably declines to press it. The capability was reachable and unusable.
 *
 * ── WHAT THIS PINS, AND WHAT IT DELIBERATELY DOES NOT ──────────────────────
 * Renaming a destructive control is only honest if the destruction stays
 * disclosed. So this pins BOTH halves together — the intent-name AND the
 * confirmation that still states the loss — because either one alone is a
 * regression: the old name was honest and unusable; a bare rename would be
 * usable and dishonest.
 *
 * It does NOT claim recovery. `KebabMenu.resetNotRecoverable.spec.tsx` owns
 * that claim and continues to own it; nothing here weakens it.
 *
 * BINDING: menu items by role=menuitem + EXACT accessible name, never by
 * substring — "Start new model" and a hypothetical "Start new model from
 * template" are different controls, and `getByText` would not separate them.
 * The action is bound to the STORE CALL, not to the dialog closing, so a
 * control that merely dismisses itself cannot pass.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { createRef } from 'react'
import { KebabMenu } from '../KebabMenu'
import { ToastProvider } from '../../../canvas/ToastContext'

vi.mock('../../../canvas/settingsStore', () => ({
  useSettingsStore: () => ({
    showGrid: false,
    gridSize: 20,
    snapToGrid: false,
    showAlignmentGuides: false,
    highContrastMode: false,
    setShowGrid: vi.fn(),
    setGridSize: vi.fn(),
    setSnapToGrid: vi.fn(),
    setShowAlignmentGuides: vi.fn(),
    setHighContrastMode: vi.fn(),
  }),
}))

const resetCanvas = vi.fn()
vi.mock('../../../canvas/store', () => ({
  useCanvasStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ resetCanvas, nodes: [], edges: [] }),
}))

vi.mock('../../../canvas/components/ImportExportDialog', () => ({
  ImportExportDialog: () => null,
}))
vi.mock('../../../canvas/components/SnapshotManager', () => ({
  SnapshotManager: () => null,
}))

function renderMenu() {
  render(
    <ToastProvider>
      <KebabMenu
        isOpen
        onToggle={vi.fn()}
        onClose={vi.fn()}
        onStartRename={vi.fn()}
        onShowKeyboardLegend={vi.fn()}
        onShowInfluenceExplainer={vi.fn()}
        menuRef={createRef<HTMLDivElement>()}
      />
    </ToastProvider>,
  )
}

function startNewModelItem(): HTMLElement {
  return screen.getByRole('menuitem', { name: 'Start new model' })
}

describe('the kebab names the route to a fresh model by its intent', () => {
  beforeEach(() => {
    resetCanvas.mockClear()
  })

  it('offers a "Start new model" menu item', () => {
    renderMenu()

    expect(startNewModelItem()).toBeInTheDocument()
  })

  /**
   * The discriminating half. Without it the suite would pass on a build that
   * ADDED the new name beside the old one, leaving two controls for one action
   * — which is worse than either name alone.
   */
  it('no longer offers a control named "Reset canvas"', () => {
    renderMenu()

    expect(screen.queryByRole('menuitem', { name: 'Reset canvas' })).toBeNull()
  })

  it('opens a confirmation that still states the loss, and destroys nothing yet', () => {
    renderMenu()
    fireEvent.click(startNewModelItem())

    const text = screen.getByRole('dialog').textContent ?? ''
    // Bound to the CLAIM, not to a phrasing: the dialog must say the
    // graph goes. A regex copied from the copy under test would pass on
    // any rewording that quietly dropped the disclosure.
    expect(text).toMatch(/nodes? and connections?/i)
    expect(text).toMatch(/analysis/i)
    expect(text).toMatch(/conversation/i)
    expect(text).toMatch(/cannot be undone/i)
    // Opening the confirmation must not itself clear the model.
    expect(resetCanvas).not.toHaveBeenCalled()
  })

  /**
   * The confirmation points at the one thing that makes the loss avoidable.
   * `Export` is a real capability in this same menu and `importCanvas` really
   * replaces the whole graph (`ImportExportDialog.tsx:163-164`), so this is a
   * route the product can keep, not a reassurance.
   */
  it('the confirmation names Export as the way to keep a copy first', () => {
    renderMenu()
    fireEvent.click(startNewModelItem())

    expect(screen.getByRole('dialog').textContent ?? '').toMatch(/export/i)
  })

  it('clears the model only when the confirmation is confirmed', () => {
    renderMenu()
    fireEvent.click(startNewModelItem())

    fireEvent.click(screen.getByRole('button', { name: 'Start new model' }))

    expect(resetCanvas).toHaveBeenCalledTimes(1)
  })

  it('cancelling leaves the model alone', () => {
    renderMenu()
    fireEvent.click(startNewModelItem())

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(resetCanvas).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
