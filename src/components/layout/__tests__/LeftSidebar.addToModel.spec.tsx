import { describe, it, expect, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LeftSidebar } from '../LeftSidebar'
import {
  CANONICAL_EDIT_AUTHORITY,
  hasServerGraphAuthority,
} from '../../../canvas/mutations/mutationAuthority'

/**
 * ⭐ THE DOOR A FOUNDER SESSION COULD NOT FIND.
 *
 * Debug export `44e349fa` (UI `ab6ae8a6`, staging, 2026-09-14): 30 minutes, 18
 * turns, and ZERO canvas affordances used — every action in the log is a chat
 * message or a chip. The durable node-add was authorised the whole time and
 * reachable only by right-clicking empty canvas.
 *
 * These pin the door's EXISTENCE and its AUTHORITY. They cannot pin that it is
 * visible on screen — jsdom has no layout (CLAUDE.md trap 3) — so the claim
 * here is "mounted, named, and wired to the pane menu", not "seen".
 */
describe('LeftSidebar — the Add to model door', () => {
  it('renders, is named the same in the tooltip and the accessible name', async () => {
    render(<LeftSidebar onAddToModelClick={() => {}} />)
    const btn = screen.getByTestId('canvas-add-to-model')
    expect(btn).toHaveAccessibleName('Add to model')
    // It opens a menu rather than acting directly — announced, not implied.
    expect(btn).toHaveAttribute('aria-haspopup', 'menu')
    cleanup()
  })

  /**
   * ⭐ THE CONTRAST CONTROL. Without it, a component that rendered the button
   * unconditionally would pass the test above — and the whole point of the
   * prop is that a build with no durable carrier shows no door.
   */
  it('renders NO door when the caller passes no handler', () => {
    render(<LeftSidebar />)
    expect(screen.queryByTestId('canvas-add-to-model')).toBeNull()
    cleanup()
  })

  it('hands the caller an anchor so the menu opens at the button, not a guess', async () => {
    const onAdd = vi.fn()
    render(<LeftSidebar onAddToModelClick={onAdd} />)
    await userEvent.click(screen.getByTestId('canvas-add-to-model'))
    expect(onAdd).toHaveBeenCalledTimes(1)
    const anchor = onAdd.mock.calls[0][0]
    expect(typeof anchor.x).toBe('number')
    expect(typeof anchor.y).toBe('number')
    expect(Number.isFinite(anchor.x) && Number.isFinite(anchor.y)).toBe(true)
    cleanup()
  })
})

/**
 * ⭐⭐ THE LOAD-BEARING ASSERTION, AND IT IS ABOUT WHICH QUESTION THE DOOR ASKS.
 *
 * Two authorities, two answers, and re-gating this control on the wrong one
 * would silently close it again:
 *
 *   canvasNodeAddWithServerHash  → 'server_graph'  (a receipt-bearing
 *     `structural_add`, a server write to `scenarios.graph`, a committed
 *     `edit_graph` fact)
 *   canvasSemanticMutations      → 'disabled'      (still gates undo, redo,
 *     paste and the blueprint insert — none of which has a durable carrier)
 *
 * `contextMenu/useMenuItems.ts` separated these for this exact gesture on
 * 13 Sep 2026. The toolbar was not moved with it, because the toolbar had no
 * add control. This REDs the day someone collapses them, in either direction.
 */
describe('the two authorities stay named apart (trap 21)', () => {
  it('the node add is server-carried and the blanket key is not', () => {
    expect(hasServerGraphAuthority(CANONICAL_EDIT_AUTHORITY.canvasNodeAddWithServerHash)).toBe(true)
    expect(hasServerGraphAuthority(CANONICAL_EDIT_AUTHORITY.canvasSemanticMutations)).toBe(false)
  })
})
