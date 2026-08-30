/**
 * KebabMenu — the start-new-model confirmation must not promise recovery.
 *
 * ── WHY THIS PIN EXISTS, AND WHY THIS ONE IS THE WORST OF THE THREE ─────────
 * The dialog said: "… Undo (Ctrl+Z / Cmd+Z) can bring the graph back. The
 * conversation cannot be recovered." Every clause of that recovery promise is
 * false, and it is attached to the most destructive control in the top bar:
 *
 *   · ⌘Z / Ctrl+Z are dead on the canvas. `useKeyboardShortcuts.ts` gates the
 *     undo and redo branches on `hasServerGraphAuthority(
 *     CANONICAL_EDIT_AUTHORITY.canvasSemanticMutations)`, and that authority is
 *     `'disabled'` — the branch folds to `false`.
 *   · `resetCanvas` pushes an UNLABELLED history entry, so the history toast
 *     never offers an Undo for it either (the toast fires only on a label).
 *   · `resetCanvas` calls `scenarios.clearAutosave()`, so the localStorage copy
 *     the canvas would otherwise reload from is destroyed too.
 *
 * So the graph cannot be brought back by any route the product offers, and the
 * dialog's contrast — graph recoverable, conversation not — inverted the truth
 * for the half a user is most likely to act on.
 *
 * BINDING: the message is read from the dialog THIS menu item opens, reached by
 * clicking "Start new model" (named "Reset canvas" until 30 Aug 2026 — see
 * `KebabMenu.startNewModel.spec.tsx`). A near-identical string lives at
 * `ReactFlowGraph.tsx`
 * behind a `showResetConfirm` that is never set true — so the string is not an
 * identity, and a pin that searched the repo (or the document) for the sentence
 * could be satisfied by the dead copy while the live one regressed.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { createRef } from 'react'
import { KebabMenu } from '../KebabMenu'
import { ToastProvider } from '../../../canvas/ToastContext'

/** `useSettingsStore()` is destructured whole here — no selector argument. */
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

/**
 * The other three dialogs this menu can open are irrelevant to the reset
 * confirmation's copy and drag in unrelated store surface. Stubbed so this pin
 * fails for exactly one reason: the message under test.
 */
vi.mock('../../../canvas/components/ImportExportDialog', () => ({
  ImportExportDialog: () => null,
}))
vi.mock('../../../canvas/components/SnapshotManager', () => ({
  SnapshotManager: () => null,
}))

function openResetDialog() {
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
  fireEvent.click(screen.getByRole('menuitem', { name: 'Start new model' }))
  return screen.getByRole('dialog').textContent ?? ''
}

describe('start-new-model confirmation promises no recovery', () => {
  it('does not claim undo can bring the graph back', () => {
    const text = openResetDialog()

    expect(text).not.toMatch(/can bring the graph back/i)
  })

  it('names no undo keyboard shortcut', () => {
    const text = openResetDialog()

    expect(text).not.toMatch(/ctrl\s*\+\s*z|cmd\s*\+\s*z|⌘z/i)
  })

  /**
   * The precondition. Without it the two assertions above would also pass on a
   * build where the dialog failed to open at all — asserting nothing.
   */
  it('PRECONDITION: the dialog opened and states the destruction', () => {
    const text = openResetDialog()

    expect(text).toMatch(/start a new model\?/i)
    expect(text).toMatch(/nodes? and connections?/i)
  })
})
