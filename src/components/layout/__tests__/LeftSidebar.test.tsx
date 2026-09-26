import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LeftSidebar } from '../LeftSidebar'

// Disable graph lens feature flag so LensDropdown doesn't render
vi.mock('../../../flags', () => ({
  isGraphLensEnabled: () => false,
}))

vi.mock('../../../canvas/store', () => ({
  useCanvasStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      viewMode: 'standard',
      comparisonMode: { active: false },
    }),
}))

/**
 * contract v3.1 `.canvas-tools` (DESIGN-GAP #13, 26 Sep 2026): the tools are
 * +, pointer, hand, undo, layers. The served build drew a pointer↔hand TOGGLE,
 * a Redo button and a Standard/Detailed eye. Redo is now the keyboard's
 * (⌘⇧Z / ⌘Y, `useKeyboardShortcuts`); the view toggle moved to the viewport
 * tools' overflow menu (`CanvasViewportControls`).
 */
describe('LeftSidebar', () => {
  it('renders the contract tool run: select, hand, undo — and no redo or view eye', () => {
    render(<LeftSidebar />)

    expect(screen.getByRole('navigation', { name: /canvas tools/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Select mode' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hand mode' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument()
    // Positively enumerated, so a control added back under another name fails.
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Select mode',
      'Hand mode',
      'Undo',
    ])
    expect(screen.queryByRole('button', { name: /redo/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /standard view|detailed view/i })).toBeNull()
  })

  it('invokes undo when the Undo button is clicked', () => {
    const onUndoClick = vi.fn()
    render(<LeftSidebar onUndoClick={onUndoClick} />)
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(onUndoClick).toHaveBeenCalledTimes(1)
  })

  it('disables undo when canUndo is false', () => {
    render(<LeftSidebar canUndo={false} />)
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()
  })

  describe('pointer and hand — two tools, the current one active', () => {
    it('select mode: pointer is pressed, hand is not', () => {
      render(<LeftSidebar interactionMode="select" />)
      expect(screen.getByRole('button', { name: 'Select mode' })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByRole('button', { name: 'Hand mode' })).toHaveAttribute('aria-pressed', 'false')
    })

    it('hand mode: hand is pressed, pointer is not', () => {
      render(<LeftSidebar interactionMode="hand" />)
      expect(screen.getByRole('button', { name: 'Hand mode' })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByRole('button', { name: 'Select mode' })).toHaveAttribute('aria-pressed', 'false')
    })

    it('the INACTIVE tool switches the mode; the active one never flips you out of it', () => {
      // The call site hands a single toggle (`onSelectClick` flips the mode).
      const onSelectClick = vi.fn()
      const { rerender } = render(<LeftSidebar interactionMode="select" onSelectClick={onSelectClick} />)
      fireEvent.click(screen.getByRole('button', { name: 'Select mode' }))
      expect(onSelectClick, 'clicking the ACTIVE pointer must not toggle to hand').not.toHaveBeenCalled()
      fireEvent.click(screen.getByRole('button', { name: 'Hand mode' }))
      expect(onSelectClick).toHaveBeenCalledTimes(1)

      rerender(<LeftSidebar interactionMode="hand" onSelectClick={onSelectClick} />)
      fireEvent.click(screen.getByRole('button', { name: 'Hand mode' }))
      expect(onSelectClick, 'clicking the ACTIVE hand must not toggle to select').toHaveBeenCalledTimes(1)
      fireEvent.click(screen.getByRole('button', { name: 'Select mode' }))
      expect(onSelectClick).toHaveBeenCalledTimes(2)
    })
  })
})
