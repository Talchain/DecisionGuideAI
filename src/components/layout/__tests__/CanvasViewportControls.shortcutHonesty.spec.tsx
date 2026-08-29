/**
 * THE TOOLBAR MUST NOT ADVERTISE KEYBOARD SHORTCUTS THAT DO NOT EXIST.
 *
 * ## The defect this pins
 *
 * Three tooltips advertised `⌘-`, `⌘+` and `⌘0`. No handler for `-`, `+`, `=`
 * or `0` exists anywhere in `src` — swept 29 Aug 2026 with `rg -a`, target 0,
 * contrast non-zero in the same run (`useCanvasKeyboardShortcuts.ts:125` for
 * `T`, `:208` for `Shift+A`), so the zero is a real zero and not a blind probe.
 *
 * ⚠ AND THIS ONE IS WORSE THAN A NO-OP, which is why it outranks its size:
 * `⌘-` / `⌘+` / `⌘0` are the BROWSER's zoom. A user who follows our own
 * instruction does not get "nothing" — they scale the entire page, including
 * the toolbar that told them to. The product taught them a gesture that
 * visibly breaks it. Unsupervised, on Monday, nobody is there to say "no, not
 * that one".
 *
 * The BUTTONS are fine and are untouched: `onZoomIn`, `onZoomOut` and
 * `onFitView` all work. Only the parenthetical was false.
 *
 * ## The contrast case is the point of the pair (standing brief §3)
 *
 * Case (b) proves the fix removed the FALSE hints and not "all hints" — the
 * lazy version of this change is to strip every parenthetical, which would
 * pass case (a) perfectly while deleting a true and useful affordance.
 * `Shift+A` is genuinely implemented and ungated (`useCanvasKeyboardShortcuts
 * .ts:208` calls `onAutoArrange()` with no authority guard, unlike `T`), so it
 * must SURVIVE. One case alone proves nothing here.
 */
import { describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReactFlowProvider } from '@xyflow/react'

import { CanvasViewportControls } from '../CanvasViewportControls'

function renderControls() {
  return render(
    <ReactFlowProvider>
      <CanvasViewportControls
        onZoomIn={vi.fn()}
        onZoomOut={vi.fn()}
        onZoomReset={vi.fn()}
        onFitView={vi.fn()}
        onAutoArrange={vi.fn()}
      />
    </ReactFlowProvider>,
  )
}

describe('CanvasViewportControls — advertises only shortcuts that exist', () => {
  it('(a) no tooltip claims a zoom or fit-view keyboard shortcut', async () => {
    const user = userEvent.setup()
    renderControls()

    for (const name of ['Zoom out', 'Zoom in', 'Fit to view']) {
      // Positive control: the control itself is on screen, so a missing
      // shortcut string below is a fact about the copy, not about an absent
      // button (trap 13 — an absence assertion needs a proven presence).
      const button = screen.getByRole('button', { name })
      expect(button).toBeInTheDocument()

      await user.hover(button)
      // The browser's own zoom keys must not be presented as ours.
      expect(screen.queryByText(/⌘-|⌘\+|⌘0/)).toBeNull()
      await user.unhover(button)
    }
  })

  it('(b) CONTRAST — the shortcut that IS implemented is still advertised', async () => {
    const user = userEvent.setup()
    renderControls()

    const autoArrange = screen.getByRole('button', { name: 'Auto-arrange' })
    await user.hover(autoArrange)
    expect(await screen.findByText(/⇧A/)).toBeInTheDocument()
  })
})
