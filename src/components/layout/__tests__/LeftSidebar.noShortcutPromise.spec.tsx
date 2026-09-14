/**
 * LeftSidebar — the Undo/Redo tooltips must not promise a keyboard shortcut.
 *
 * ⚠ AMENDED — THE BUTTONS ARE NO LONGER DISABLED, AND THIS PIN IS UNCHANGED
 * IN PURPOSE. The paragraph below describes the state at the time it was
 * written; both buttons are now reachable and answer a click with
 * `canvasUndoUnavailableNotice()`, the same sentence the keyboard already
 * gives. What that repair did NOT do is make any shortcut work — the undo and
 * redo branches are still gated on the same `'disabled'` authority — so the
 * rule this file enforces stands exactly as written: no tooltip here may name
 * a key. Only the PRECONDITION at the foot has changed, and it says why.
 *
 * ── WHY THIS PIN EXISTS ─────────────────────────────────────────────────────
 * These two buttons were PERMANENTLY disabled. `ReactFlowGraph.tsx` passes
 * `canUndo={CANVAS_SEMANTIC_MUTATIONS_CONNECTED && canUndo()}`, and that
 * constant is `hasServerGraphAuthority(CANONICAL_EDIT_AUTHORITY
 * .canvasSemanticMutations)` where the authority is `'disabled'` — so it folds
 * to `false` and `disabled={!canUndo}` is always true. `onUndoClick` is a
 * no-op arrow at the same call site.
 *
 * The tooltips nevertheless read "Undo (⌘Z)" and "Redo (⌘⇧Z)". Both shortcuts
 * are dead: `useKeyboardShortcuts.ts` gates the undo AND redo branches on the
 * same constant. So the product was naming a key that does nothing, on a
 * control that does nothing.
 *
 * ⚠ THE TOOLTIP IS VISIBLE EVEN THOUGH THE BUTTON IS DISABLED — which is why
 * this is a user-facing defect and not a dead string. `Tooltip` attaches its
 * hover/focus reference to a WRAPPER div, not to the button, so a disabled
 * button's tooltip still opens. The pin drives that wrapper deliberately.
 *
 * BINDING: the assertion resolves the tooltip THROUGH the Undo button's own
 * wrapper, never by searching the document for the text "Undo" — four other
 * surfaces in this repo carry that label (the history toast, the strengthen
 * panel, `ServerVersionsSection`'s "Undo restore", and the context menu), so
 * the string is not an identity.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LeftSidebar } from '../LeftSidebar'

vi.mock('../../../flags', () => ({
  isGraphLensEnabled: () => false,
}))

const mockSetViewMode = vi.fn()
vi.mock('../../../canvas/store', () => ({
  useCanvasStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      viewMode: 'standard',
      setViewMode: mockSetViewMode,
      comparisonMode: { active: false },
    }),
}))

/**
 * Open the tooltip owned by ONE named button and return its text.
 * Goes through that button's own wrapper so the result cannot come from a
 * sibling control's tooltip.
 */
async function tooltipTextFor(buttonName: RegExp): Promise<string> {
  const button = screen.getByRole('button', { name: buttonName })
  const reference = button.parentElement
  if (reference === null) throw new Error('tooltip reference wrapper missing')
  fireEvent.mouseEnter(reference)
  fireEvent.focus(reference)
  const tip = await waitFor(() => screen.getByRole('tooltip'))
  return tip.textContent ?? ''
}

describe('LeftSidebar undo/redo tooltips make no shortcut promise', () => {
  it('the Undo tooltip does not name ⌘Z', async () => {
    render(<LeftSidebar canUndo={false} canRedo={false} />)

    const text = await tooltipTextFor(/^undo$/i)

    expect(text).not.toContain('⌘Z')
    expect(text).not.toMatch(/⌘|ctrl|cmd/i)
  })

  it('the Redo tooltip does not name ⌘⇧Z', async () => {
    render(<LeftSidebar canUndo={false} canRedo={false} />)

    const text = await tooltipTextFor(/^redo$/i)

    expect(text).not.toContain('⌘⇧Z')
    expect(text).not.toMatch(/⌘|ctrl|cmd/i)
  })

  /**
   * The precondition this pin depends on. Without it the two assertions above
   * could pass on a build where the shortcuts had become LIVE — i.e. they
   * would be asserting nothing about the defect.
   *
   * ⚠ UPDATED WITH THE BUTTON, AND THE DISTINCTION IS THE POINT. This used to
   * assert `toBeDisabled()` and was titled "when the authority withholds
   * them". Both buttons are now REACHABLE in exactly that posture: the
   * authority still withholds, so clicking answers with
   * `canvasUndoUnavailableNotice()` instead of greying out — see the reasoning
   * at the buttons in `LeftSidebar`. What has NOT changed, and what this pin
   * is actually about, is that no keyboard shortcut works, so no tooltip here
   * may name one. Asserting `toBeDisabled()` would now pin the wrong fact and
   * would red on the honest build.
   */
  it('PRECONDITION: the authority still withholds — present, and not operable', () => {
    render(<LeftSidebar canUndo={false} canRedo={false} undoUnavailable redoUnavailable />)

    for (const name of [/^undo$/i, /^redo$/i]) {
      const button = screen.getByRole('button', { name })
      // Reachable, so the tooltip and the explanation can both be got at...
      expect(button).not.toBeDisabled()
      // ...but never advertised as able to perform the action it names.
      expect(button).toHaveAttribute('aria-disabled', 'true')
    }
  })
})
